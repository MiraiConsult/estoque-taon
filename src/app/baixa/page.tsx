'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { formatCurrency, formatNumber, formatDateTime, casaBgColor } from '@/lib/format';
import CasaFilter from '@/components/CasaFilter';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle,
  AlertCircle,
  History,
  X,
  Trash2,
  ArrowRight,
  Search,
  Eraser,
} from 'lucide-react';
import * as XLSX from 'xlsx';

type Step = 'upload' | 'review' | 'done';

interface PreviewRow {
  originalName: string;
  quantity: number;
  value: number;
  ticketMedio: number;
  matchedProductId: string | null;
  matchedProductName: string | null;
  status: 'matched' | 'fuzzy' | 'unmatched' | 'ignored';
}

interface Product {
  id: string;
  name: string;
  cost: number;
  linked_insumo_id: string | null;
  unit_conversion: number;
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
  const [step, setStep] = useState<Step>('upload');
  const [selectedCasa, setSelectedCasa] = useState('Isla');
  const [eventDate, setEventDate] = useState(new Date().toISOString().split('T')[0]);
  const [eventName, setEventName] = useState('');
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ matched: number; ignored: number; totalValue: number; totalItems: number } | null>(null);
  const [history, setHistory] = useState<ImportHistory[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [clearAllConfirm, setClearAllConfirm] = useState(false);
  const [searchUnmatched, setSearchUnmatched] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchHistory = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('sale_imports')
        .select('*, casa:casas(name)')
        .order('created_at', { ascending: false })
        .limit(50);

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
      console.error('Fetch history error:', err);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const data = evt.target?.result;
      const workbook = XLSX.read(data, { type: 'binary' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(sheet) as Array<Record<string, unknown>>;

      // Fetch products
      const { data: productsData } = await supabase
        .from('products')
        .select('id, name, cost, linked_insumo_id, unit_conversion');
      const allProducts: Product[] = (productsData || []).map((p) => ({
        id: p.id,
        name: p.name,
        cost: Number(p.cost),
        linked_insumo_id: p.linked_insumo_id || null,
        unit_conversion: Number(p.unit_conversion) || 1,
      }));
      setProducts(allProducts);

      const normalize = (s: string) =>
        s
          .normalize('NFD')
          .replace(/[̀-ͯ]/g, '')
          .replace(/\s*\([^)]*\)\s*/g, ' ')
          .replace(/['`']/g, '')
          .replace(/\s+/g, ' ')
          .trim()
          .toLowerCase();

      const exactMap = new Map<string, { id: string; name: string }>();
      const normMap = new Map<string, { id: string; name: string }>();
      allProducts.forEach((p) => {
        exactMap.set(p.name.toUpperCase().trim(), { id: p.id, name: p.name });
        normMap.set(normalize(p.name), { id: p.id, name: p.name });
      });

      const fuzzyMatch = (search: string): { id: string; name: string } | null => {
        const normSearch = normalize(search);
        if (!normSearch) return null;

        // 1. Exact normalized match
        const direct = normMap.get(normSearch);
        if (direct) return direct;

        // 2. One contains the other (substring) - prefer longer/closer
        let best: { id: string; name: string; score: number } | null = null;
        for (const [normName, p] of normMap) {
          if (normName.length < 3) continue;
          let score = 0;
          if (normName === normSearch) score = 100;
          else if (normName.includes(normSearch) || normSearch.includes(normName)) {
            score = Math.min(normName.length, normSearch.length) / Math.max(normName.length, normSearch.length) * 80;
          } else {
            // Levenshtein-lite: count common words
            const w1 = new Set(normSearch.split(' ').filter((x) => x.length > 2));
            const w2 = new Set(normName.split(' ').filter((x) => x.length > 2));
            const common = [...w1].filter((w) => w2.has(w)).length;
            if (common > 0 && w1.size > 0 && w2.size > 0) {
              score = (common / Math.max(w1.size, w2.size)) * 60;
            }
          }
          if (score >= 50 && (!best || score > best.score)) {
            best = { ...p, score };
          }
        }
        return best;
      };

      const parsedRows: PreviewRow[] = jsonData
        .map((row) => {
          const productName = String(
            row['produto'] || row['Produto'] || row['PRODUTO'] || row['product'] || ''
          ).trim();
          const quantity = Number(row['quantidade'] || row['Quantidade'] || row['QUANTIDADE'] || row['qty'] || 0);
          const value = Number(row['valor'] || row['Valor'] || row['VALOR'] || row['value'] || 0);
          const ticketMedio = Number(row['ticket_medio'] || row['Ticket Medio'] || row['TICKET_MEDIO'] || 0);

          // Try exact first
          const exact = exactMap.get(productName.toUpperCase().trim());
          let matched: { id: string; name: string } | null = exact || null;
          let status: PreviewRow['status'] = exact ? 'matched' : 'unmatched';

          // Try fuzzy if no exact
          if (!matched) {
            const fuzzy = fuzzyMatch(productName);
            if (fuzzy) {
              matched = fuzzy;
              status = 'fuzzy';
            }
          }

          return {
            originalName: productName,
            quantity,
            value,
            ticketMedio: ticketMedio || (quantity > 0 ? value / quantity : 0),
            matchedProductId: matched?.id || null,
            matchedProductName: matched?.name || null,
            status,
          };
        })
        .filter((r) => r.originalName && r.quantity > 0);

      setRows(parsedRows);
      setStep('review');
    };
    reader.readAsBinaryString(file);
  };

  const resetUpload = () => {
    setStep('upload');
    setFileName('');
    setRows([]);
    setProducts([]);
    setImportResult(null);
    setSearchUnmatched('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const updateRowMatch = (index: number, productId: string) => {
    const matchedProduct = products.find((p) => p.id === productId);
    setRows((prev) =>
      prev.map((r, i) =>
        i === index
          ? {
              ...r,
              matchedProductId: productId || null,
              matchedProductName: matchedProduct?.name || null,
              status: productId ? 'matched' : 'unmatched',
            }
          : r
      )
    );
  };

  const confirmFuzzy = (index: number) => {
    setRows((prev) =>
      prev.map((r, i) => (i === index ? { ...r, status: 'matched' } : r))
    );
  };

  const toggleIgnore = (index: number) => {
    setRows((prev) =>
      prev.map((r, i) =>
        i === index
          ? { ...r, status: r.status === 'ignored' ? (r.matchedProductId ? 'matched' : 'unmatched') : 'ignored' }
          : r
      )
    );
  };

  const confirmImport = async () => {
    setImporting(true);

    try {
      const { data: casa } = await supabase.from('casas').select('id').eq('name', selectedCasa).single();
      if (!casa) throw new Error('Casa não encontrada');

      const toImport = rows.filter((r) => r.status === 'matched' && r.matchedProductId);

      const totalValue = toImport.reduce((s, r) => s + r.value, 0);
      const totalItems = toImport.reduce((s, r) => s + r.quantity, 0);

      // Create import record first
      const { data: importRecord, error: impErr } = await supabase
        .from('sale_imports')
        .insert({
          casa_id: casa.id,
          event_date: eventDate,
          event_name: eventName || null,
          file_name: fileName,
          total_items: totalItems,
          total_value: totalValue,
        })
        .select('id')
        .single();

      if (impErr || !importRecord) throw new Error(impErr?.message || 'Falha ao criar importação');

      const importId = importRecord.id;

      // Insert sales with import_id
      const salesRecords = toImport.map((r) => ({
        casa_id: casa.id,
        import_id: importId,
        event_date: eventDate,
        event_name: eventName || null,
        product_id: r.matchedProductId!,
        quantity: r.quantity,
        total_value: r.value,
        ticket_medio: r.ticketMedio,
      }));

      await supabase.from('sales').insert(salesRecords);

      // Update stock + create movements
      for (const r of toImport) {
        const product = products.find((p) => p.id === r.matchedProductId);
        const useInsumoStock = product?.linked_insumo_id;
        const conversion = product?.unit_conversion || 1;

        // If product is linked to an insumo, deduct from insumo stock instead of product stock
        const stockQuery = supabase
          .from('stock_items')
          .select('id, quantity')
          .eq('casa_id', casa.id);

        const { data: stockItem } = useInsumoStock
          ? await stockQuery.eq('insumo_id', useInsumoStock).maybeSingle()
          : await stockQuery.eq('product_id', r.matchedProductId!).maybeSingle();

        if (stockItem) {
          await supabase
            .from('stock_items')
            .update({
              quantity: Math.max(0, stockItem.quantity - (r.quantity * conversion)),
              updated_at: new Date().toISOString(),
            })
            .eq('id', stockItem.id);
        }

        // Recipe ingredients deduction
        const { data: recipe } = await supabase
          .from('drink_recipes')
          .select('id')
          .eq('product_id', r.matchedProductId!)
          .maybeSingle();

        if (recipe) {
          const { data: ingredients } = await supabase
            .from('recipe_ingredients')
            .select('insumo_id, quantity')
            .eq('recipe_id', recipe.id);

          if (ingredients) {
            for (const ing of ingredients) {
              const totalUsed = ing.quantity * r.quantity;
              const { data: insumoStock } = await supabase
                .from('stock_items')
                .select('id, quantity')
                .eq('casa_id', casa.id)
                .eq('insumo_id', ing.insumo_id)
                .maybeSingle();

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
          product_id: r.matchedProductId!,
          import_id: importId,
          movement_type: 'venda',
          quantity: -r.quantity,
          reference: `Venda ${eventDate}`,
          notes: eventName || null,
        });
      }

      const ignored = rows.filter((r) => r.status === 'unmatched' || r.status === 'ignored').length;

      setImportResult({ matched: toImport.length, ignored, totalValue, totalItems });
      setStep('done');
      fetchHistory();
    } catch (err) {
      alert(`Erro ao importar: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setImporting(false);
    }
  };

  const deleteImport = async (importId: string) => {
    try {
      // Get all sales from this import to reverse stock
      const { data: sales } = await supabase
        .from('sales')
        .select('product_id, quantity, casa_id, product:products(linked_insumo_id, unit_conversion)')
        .eq('import_id', importId);

      if (sales) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const sale of (sales as any[])) {
          const linkedInsumoId = sale.product?.linked_insumo_id;
          const conversion = Number(sale.product?.unit_conversion) || 1;
          const reverseQty = sale.quantity * conversion;

          // Reverse stock (insumo if linked, otherwise product)
          const baseQuery = supabase
            .from('stock_items')
            .select('id, quantity')
            .eq('casa_id', sale.casa_id);
          const { data: stockItem } = linkedInsumoId
            ? await baseQuery.eq('insumo_id', linkedInsumoId).maybeSingle()
            : await baseQuery.eq('product_id', sale.product_id).maybeSingle();

          if (stockItem) {
            await supabase
              .from('stock_items')
              .update({
                quantity: stockItem.quantity + reverseQty,
                updated_at: new Date().toISOString(),
              })
              .eq('id', stockItem.id);
          }

          // Reverse recipe ingredients
          const { data: recipe } = await supabase
            .from('drink_recipes')
            .select('id')
            .eq('product_id', sale.product_id)
            .maybeSingle();

          if (recipe) {
            const { data: ingredients } = await supabase
              .from('recipe_ingredients')
              .select('insumo_id, quantity')
              .eq('recipe_id', recipe.id);

            if (ingredients) {
              for (const ing of ingredients) {
                const { data: insumoStock } = await supabase
                  .from('stock_items')
                  .select('id, quantity')
                  .eq('casa_id', sale.casa_id)
                  .eq('insumo_id', ing.insumo_id)
                  .maybeSingle();

                if (insumoStock) {
                  await supabase
                    .from('stock_items')
                    .update({
                      quantity: insumoStock.quantity + (ing.quantity * sale.quantity),
                      updated_at: new Date().toISOString(),
                    })
                    .eq('id', insumoStock.id);
                }
              }
            }
          }
        }
      }

      // Delete the import (cascades to sales and stock_movements)
      await supabase.from('sale_imports').delete().eq('id', importId);
      setDeleteConfirm(null);
      fetchHistory();
    } catch (err) {
      alert(`Erro ao deletar: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const clearAllImports = async () => {
    try {
      // Get all imports to reverse
      const { data: allImports } = await supabase.from('sale_imports').select('id');
      if (allImports) {
        for (const imp of allImports) {
          await deleteImport(imp.id);
        }
      }
      setClearAllConfirm(false);
      fetchHistory();
    } catch (err) {
      alert(`Erro: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const matchedCount = rows.filter((r) => r.status === 'matched').length;
  const fuzzyCount = rows.filter((r) => r.status === 'fuzzy').length;
  const unmatchedCount = rows.filter((r) => r.status === 'unmatched').length;
  const ignoredCount = rows.filter((r) => r.status === 'ignored').length;
  const filteredAttention = rows
    .map((r, i) => ({ ...r, _idx: i }))
    .filter((r) => r.status !== 'matched')
    .filter((r) => !searchUnmatched || r.originalName.toLowerCase().includes(searchUnmatched.toLowerCase()));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Importar Vendas</h1>
        <p className="text-sm text-gray-500">
          Importe planilhas de vendas para dar baixa no estoque automaticamente
        </p>
      </div>

      {/* STEP 1: UPLOAD */}
      {step === 'upload' && (
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
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Evento (opcional)</label>
              <input
                type="text"
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                placeholder="Ex: Festa de Sexta"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50/50 transition-colors"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileSelect}
              className="hidden"
            />
            <FileSpreadsheet size={40} className="mx-auto text-gray-400 mb-3" />
            <p className="text-sm font-medium text-gray-900">Clique para selecionar a planilha</p>
            <p className="text-xs text-gray-500 mt-1">Formatos: .xlsx, .xls, .csv</p>
            <p className="text-xs text-gray-400 mt-1">Colunas: produto, quantidade, valor, ticket_medio</p>
          </div>
        </div>
      )}

      {/* STEP 2: REVIEW */}
      {step === 'review' && (
        <div className="space-y-4 mb-6">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-gray-900">Revisao da Importacao</h3>
                <p className="text-xs text-gray-500 mt-0.5">Arquivo: {fileName} - {selectedCasa} - {eventDate}</p>
              </div>
              <button onClick={resetUpload} className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
                <X size={14} /> Cancelar
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-emerald-700">{matchedCount}</p>
                <p className="text-xs text-emerald-600">Identificados</p>
              </div>
              <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-yellow-700">{fuzzyCount}</p>
                <p className="text-xs text-yellow-600">Similares (Confirmar)</p>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-amber-700">{unmatchedCount}</p>
                <p className="text-xs text-amber-600">Não Identificados</p>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-gray-700">{ignoredCount}</p>
                <p className="text-xs text-gray-600">Ignorados</p>
              </div>
            </div>
          </div>

          {/* Unmatched + fuzzy products to fix */}
          {(unmatchedCount > 0 || ignoredCount > 0 || fuzzyCount > 0) && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-amber-700 flex items-center gap-2">
                  <AlertCircle size={18} />
                  Produtos que precisam de atenção
                </h4>
                <div className="relative">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={searchUnmatched}
                    onChange={(e) => setSearchUnmatched(e.target.value)}
                    placeholder="Buscar..."
                    className="pl-8 pr-3 py-1.5 border border-gray-300 rounded-lg text-xs"
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500 mb-3">
                <span className="text-yellow-700 font-medium">Similares</span>: o sistema encontrou um produto parecido - confirme se está correto.{' '}
                <span className="text-amber-700 font-medium">Não Identificados</span>: selecione um produto manualmente ou ignore.
              </p>
              <div className="overflow-x-auto max-h-96 overflow-y-auto border rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-600">Nome na Planilha</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-600">Qtd</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-600">Valor</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-600">Vincular a Produto</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAttention.map((r) => (
                      <tr
                        key={r._idx}
                        className={`border-t ${
                          r.status === 'ignored' ? 'opacity-50 bg-gray-50' :
                          r.status === 'fuzzy' ? 'bg-yellow-50/50' : ''
                        }`}
                      >
                        <td className="px-3 py-2 font-medium text-gray-900">
                          {r.originalName}
                          {r.status === 'fuzzy' && (
                            <span className="ml-2 inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-yellow-200 text-yellow-800">
                              <AlertCircle size={10} /> Similar
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-700">{r.quantity}</td>
                        <td className="px-3 py-2 text-right text-gray-700">{formatCurrency(r.value)}</td>
                        <td className="px-3 py-2">
                          <select
                            value={r.matchedProductId || ''}
                            onChange={(e) => updateRowMatch(r._idx, e.target.value)}
                            disabled={r.status === 'ignored'}
                            className="w-full border border-gray-300 rounded px-2 py-1 text-xs"
                          >
                            <option value="">-- Selecione --</option>
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex gap-1 justify-end">
                            {r.status === 'fuzzy' && (
                              <button
                                onClick={() => confirmFuzzy(r._idx)}
                                className="text-xs px-2 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700"
                                title="Confirmar este vinculo"
                              >
                                OK
                              </button>
                            )}
                            <button
                              onClick={() => toggleIgnore(r._idx)}
                              className={`text-xs px-2 py-1 rounded ${
                                r.status === 'ignored'
                                  ? 'bg-gray-200 text-gray-700'
                                  : 'bg-red-50 text-red-600 hover:bg-red-100'
                              }`}
                            >
                              {r.status === 'ignored' ? 'Restaurar' : 'Ignorar'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Matched products preview */}
          {matchedCount > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h4 className="font-semibold text-emerald-700 flex items-center gap-2 mb-3">
                <CheckCircle size={18} />
                Produtos identificados ({matchedCount})
              </h4>
              <div className="overflow-x-auto max-h-60 overflow-y-auto border rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-600">Produto</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-600">Qtd</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-600">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.filter((r) => r.status === 'matched').map((r, i) => {
                      const product = products.find((p) => p.id === r.matchedProductId);
                      return (
                        <tr key={i} className="border-t">
                          <td className="px-3 py-2 text-gray-900">{product?.name || r.originalName}</td>
                          <td className="px-3 py-2 text-right text-gray-700">{r.quantity}</td>
                          <td className="px-3 py-2 text-right text-gray-700">{formatCurrency(r.value)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Confirm button */}
          <div className="flex gap-3">
            <button
              onClick={resetUpload}
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50"
            >
              Voltar
            </button>
            <button
              onClick={confirmImport}
              disabled={importing || matchedCount === 0}
              className="flex-1 bg-blue-700 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-800 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {importing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  Importando...
                </>
              ) : (
                <>
                  <Upload size={18} />
                  Confirmar e Importar ({matchedCount} produtos)
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: DONE */}
      {step === 'done' && importResult && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <div className="text-center py-4">
            <CheckCircle size={48} className="mx-auto text-emerald-500 mb-3" />
            <h3 className="text-lg font-bold text-gray-900 mb-2">Importacao realizada com sucesso!</h3>
            <p className="text-sm text-gray-600 mb-6">
              {importResult.matched} produtos importados | {importResult.totalItems} unidades | {formatCurrency(importResult.totalValue)}
              {importResult.ignored > 0 && <span className="block text-amber-600 text-xs mt-1">{importResult.ignored} linhas ignoradas</span>}
            </p>
            <button
              onClick={resetUpload}
              className="bg-blue-700 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-blue-800 flex items-center gap-2 mx-auto"
            >
              <ArrowRight size={16} />
              Nova Importacao
            </button>
          </div>
        </div>
      )}

      {/* HISTORY */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <History size={18} />
            Historico de Importacoes
          </h3>
          {history.length > 0 && (
            <button
              onClick={() => setClearAllConfirm(true)}
              className="text-xs px-3 py-1.5 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 flex items-center gap-1.5"
            >
              <Eraser size={14} />
              Limpar Tudo
            </button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="pb-2 font-medium">Data</th>
                <th className="pb-2 font-medium">Casa</th>
                <th className="pb-2 font-medium">Evento</th>
                <th className="pb-2 font-medium">Arquivo</th>
                <th className="pb-2 font-medium text-right">Itens</th>
                <th className="pb-2 font-medium text-right">Valor</th>
                <th className="pb-2 font-medium">Importado em</th>
                <th className="pb-2 font-medium"></th>
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
                  <td className="py-2 text-gray-600 max-w-[150px] truncate" title={h.file_name}>{h.file_name}</td>
                  <td className="py-2 text-right text-gray-900">{formatNumber(h.total_items)}</td>
                  <td className="py-2 text-right font-medium text-gray-900">{formatCurrency(h.total_value)}</td>
                  <td className="py-2 text-gray-500 text-xs">{formatDateTime(h.created_at)}</td>
                  <td className="py-2 text-right">
                    {deleteConfirm === h.id ? (
                      <div className="flex gap-1 justify-end">
                        <button
                          onClick={() => deleteImport(h.id)}
                          className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                        >
                          Confirmar
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(null)}
                          className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirm(h.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                        title="Excluir importacao"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {history.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-gray-500">
                    Nenhuma importacao realizada
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Clear all confirmation modal */}
      {clearAllConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 max-w-md">
            <h3 className="font-bold text-lg text-gray-900 mb-2">Limpar todo o historico?</h3>
            <p className="text-sm text-gray-600 mb-4">
              Isso vai deletar TODAS as importacoes, reverter o estoque de cada venda e restaurar os insumos consumidos. Essa acao nao pode ser desfeita.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setClearAllConfirm(false)}
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg font-medium hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={clearAllImports}
                className="flex-1 bg-red-600 text-white px-4 py-2.5 rounded-lg font-medium hover:bg-red-700"
              >
                Sim, limpar tudo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
