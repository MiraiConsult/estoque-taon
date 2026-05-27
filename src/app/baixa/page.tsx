'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { formatCurrency, formatNumber, formatDateTime, casaBgColor } from '@/lib/format';
import CasaFilter from '@/components/CasaFilter';
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, History, X } from 'lucide-react';
import * as XLSX from 'xlsx';

interface ImportResult {
  success: boolean;
  matched: number;
  unmatched: string[];
  totalValue: number;
  totalItems: number;
}

interface ImportHistory {
  id: string;
  casa_name: string;
  event_date: string;
  event_name: string | null;
  file_name: string;
  total_items: number;
  total_value: number;
  created_at: string;
}

export default function BaixaPage() {
  const [selectedCasa, setSelectedCasa] = useState('Isla');
  const [eventDate, setEventDate] = useState(new Date().toISOString().split('T')[0]);
  const [eventName, setEventName] = useState('');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [history, setHistory] = useState<ImportHistory[]>([]);
  const [previewData, setPreviewData] = useState<Array<Record<string, unknown>> | null>(null);
  const [fileName, setFileName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchHistory = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('sale_imports')
        .select('*, casa:casas(name)')
        .order('created_at', { ascending: false })
        .limit(20);

      if (data) {
        setHistory(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (data as any[]).map((d) => ({
            id: d.id,
            casa_name: d.casa?.name || '',
            event_date: d.event_date,
            event_name: d.event_name,
            file_name: d.file_name,
            total_items: d.total_items,
            total_value: d.total_value,
            created_at: d.created_at,
          }))
        );
      }
    } catch (err) {
      console.error('Fetch error:', err);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setResult(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = evt.target?.result;
      const workbook = XLSX.read(data, { type: 'binary' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(sheet) as Array<Record<string, unknown>>;
      setPreviewData(jsonData);
    };
    reader.readAsBinaryString(file);
  };

  const handleImport = async () => {
    if (!previewData || previewData.length === 0) return;

    setImporting(true);
    setResult(null);

    const { data: casa } = await supabase
      .from('casas')
      .select('id')
      .eq('name', selectedCasa)
      .single();

    if (!casa) {
      setImporting(false);
      return;
    }

    const { data: allProducts } = await supabase.from('products').select('id, name, cost');
    const productMap = new Map<string, { id: string; cost: number }>();
    (allProducts || []).forEach((p) => {
      productMap.set(p.name.toUpperCase().trim(), { id: p.id, cost: Number(p.cost) });
    });

    const matched: Array<{
      product_id: string;
      quantity: number;
      total_value: number;
      ticket_medio: number;
    }> = [];
    const unmatched: string[] = [];

    for (const row of previewData) {
      const productName = String(
        row['produto'] || row['Produto'] || row['PRODUTO'] || row['product'] || ''
      ).trim();
      const quantity = Number(row['quantidade'] || row['Quantidade'] || row['QUANTIDADE'] || row['qty'] || 0);
      const value = Number(row['valor'] || row['Valor'] || row['VALOR'] || row['value'] || 0);
      const ticketMedio = Number(
        row['ticket_medio'] || row['Ticket Medio'] || row['TICKET_MEDIO'] || 0
      );

      if (!productName || quantity === 0) continue;

      const product = productMap.get(productName.toUpperCase());
      if (product) {
        matched.push({
          product_id: product.id,
          quantity,
          total_value: value,
          ticket_medio: ticketMedio || (quantity > 0 ? value / quantity : 0),
        });
      } else {
        unmatched.push(productName);
      }
    }

    if (matched.length > 0) {
      const salesRecords = matched.map((m) => ({
        casa_id: casa.id,
        event_date: eventDate,
        event_name: eventName || null,
        product_id: m.product_id,
        quantity: m.quantity,
        total_value: m.total_value,
        ticket_medio: m.ticket_medio,
      }));

      await supabase.from('sales').insert(salesRecords);

      for (const m of matched) {
        const product = allProducts?.find((p) => p.id === m.product_id);
        if (!product) continue;

        const { data: stockItem } = await supabase
          .from('stock_items')
          .select('id, quantity')
          .eq('casa_id', casa.id)
          .eq('product_id', m.product_id)
          .single();

        if (stockItem) {
          await supabase
            .from('stock_items')
            .update({
              quantity: Math.max(0, stockItem.quantity - m.quantity),
              updated_at: new Date().toISOString(),
            })
            .eq('id', stockItem.id);
        }

        const { data: recipe } = await supabase
          .from('drink_recipes')
          .select('id')
          .eq('product_id', m.product_id)
          .single();

        if (recipe) {
          const { data: ingredients } = await supabase
            .from('recipe_ingredients')
            .select('insumo_id, quantity, unit')
            .eq('recipe_id', recipe.id);

          if (ingredients) {
            for (const ing of ingredients) {
              const totalUsed = ing.quantity * m.quantity;
              const { data: insumoStock } = await supabase
                .from('stock_items')
                .select('id, quantity')
                .eq('casa_id', casa.id)
                .eq('insumo_id', ing.insumo_id)
                .single();

              if (insumoStock) {
                await supabase
                  .from('stock_items')
                  .update({
                    quantity: Math.max(0, insumoStock.quantity - totalUsed),
                    updated_at: new Date().toISOString(),
                  })
                  .eq('id', insumoStock.id);
              }
            }
          }
        }

        await supabase.from('stock_movements').insert({
          casa_id: casa.id,
          product_id: m.product_id,
          movement_type: 'venda',
          quantity: -m.quantity,
          reference: `Venda ${eventDate}`,
          notes: eventName || null,
        });
      }

      const totalValue = matched.reduce((sum, m) => sum + m.total_value, 0);
      const totalItems = matched.reduce((sum, m) => sum + m.quantity, 0);

      await supabase.from('sale_imports').insert({
        casa_id: casa.id,
        event_date: eventDate,
        event_name: eventName || null,
        file_name: fileName,
        total_items: totalItems,
        total_value: totalValue,
      });

      setResult({
        success: true,
        matched: matched.length,
        unmatched,
        totalValue,
        totalItems,
      });
    } else {
      setResult({
        success: false,
        matched: 0,
        unmatched,
        totalValue: 0,
        totalItems: 0,
      });
    }

    setImporting(false);
    fetchHistory();
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Importar Vendas</h1>
        <p className="text-sm text-gray-500">
          Importe planilhas de vendas para dar baixa no estoque automaticamente
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <h3 className="font-semibold text-gray-900 mb-4">Nova Importacao</h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Casa</label>
            <CasaFilter selected={selectedCasa} onChange={setSelectedCasa} showAll={false} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Data do Evento</label>
            <input
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nome do Evento (opcional)
            </label>
            <input
              type="text"
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              placeholder="Ex: Festa de Sexta"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
            />
          </div>
        </div>

        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50/50 transition-colors"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileSelect}
            className="hidden"
          />
          <FileSpreadsheet size={40} className="mx-auto text-gray-400 mb-3" />
          {fileName ? (
            <div>
              <p className="text-sm font-medium text-gray-900">{fileName}</p>
              <p className="text-xs text-gray-500 mt-1">
                {previewData?.length || 0} linhas encontradas
              </p>
            </div>
          ) : (
            <div>
              <p className="text-sm font-medium text-gray-900">
                Clique para selecionar a planilha
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Formatos aceitos: .xlsx, .xls, .csv
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Colunas esperadas: produto, quantidade, valor, ticket_medio
              </p>
            </div>
          )}
        </div>

        {previewData && previewData.length > 0 && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-gray-700">
                Pre-visualizacao ({previewData.length} itens)
              </h4>
              <button
                onClick={() => {
                  setPreviewData(null);
                  setFileName('');
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
              >
                <X size={14} /> Limpar
              </button>
            </div>
            <div className="max-h-60 overflow-auto border rounded-lg">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    {Object.keys(previewData[0]).map((key) => (
                      <th key={key} className="px-3 py-2 text-left font-medium text-gray-500">
                        {key}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewData.slice(0, 15).map((row, i) => (
                    <tr key={i} className="border-t">
                      {Object.values(row).map((val, j) => (
                        <td key={j} className="px-3 py-1.5 text-gray-700">
                          {String(val)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button
              onClick={handleImport}
              disabled={importing}
              className="mt-4 w-full bg-blue-700 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {importing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  Importando...
                </>
              ) : (
                <>
                  <Upload size={18} />
                  Importar e Dar Baixa no Estoque
                </>
              )}
            </button>
          </div>
        )}

        {result && (
          <div
            className={`mt-4 p-4 rounded-lg ${
              result.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
            }`}
          >
            <div className="flex items-start gap-3">
              {result.success ? (
                <CheckCircle size={20} className="text-green-600 mt-0.5" />
              ) : (
                <AlertCircle size={20} className="text-red-600 mt-0.5" />
              )}
              <div>
                <p className={`font-medium ${result.success ? 'text-green-800' : 'text-red-800'}`}>
                  {result.success ? 'Importacao realizada com sucesso!' : 'Nenhum produto encontrado'}
                </p>
                <div className="text-sm mt-1 space-y-1">
                  <p className="text-gray-700">
                    {result.matched} produtos encontrados | {result.totalItems} unidades |{' '}
                    {formatCurrency(result.totalValue)}
                  </p>
                  {result.unmatched.length > 0 && (
                    <div className="mt-2">
                      <p className="text-amber-700 font-medium">
                        {result.unmatched.length} produtos nao encontrados:
                      </p>
                      <ul className="text-amber-600 text-xs mt-1 space-y-0.5">
                        {result.unmatched.map((name, i) => (
                          <li key={i}>- {name}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <History size={18} />
          Historico de Importacoes
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="pb-2 font-medium">Data</th>
                <th className="pb-2 font-medium">Casa</th>
                <th className="pb-2 font-medium">Evento</th>
                <th className="pb-2 font-medium">Arquivo</th>
                <th className="pb-2 font-medium text-right">Itens</th>
                <th className="pb-2 font-medium text-right">Valor Total</th>
                <th className="pb-2 font-medium">Importado em</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id} className="border-b border-gray-50">
                  <td className="py-2 text-gray-900">{h.event_date}</td>
                  <td className="py-2">
                    <span className={`text-xs px-2 py-0.5 rounded ${casaBgColor(h.casa_name)}`}>
                      {h.casa_name}
                    </span>
                  </td>
                  <td className="py-2 text-gray-600">{h.event_name || '-'}</td>
                  <td className="py-2 text-gray-600">{h.file_name}</td>
                  <td className="py-2 text-right text-gray-900">{formatNumber(h.total_items)}</td>
                  <td className="py-2 text-right font-medium text-gray-900">
                    {formatCurrency(h.total_value)}
                  </td>
                  <td className="py-2 text-gray-500 text-xs">{formatDateTime(h.created_at)}</td>
                </tr>
              ))}
              {history.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-500">
                    Nenhuma importacao realizada
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
