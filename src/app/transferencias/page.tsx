'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { formatNumber, formatDateTime, casaBgColor } from '@/lib/format';
import { ArrowLeftRight, Plus, ArrowRight, X, Package, ShoppingBasket } from 'lucide-react';

interface TransferRecord {
  id: string;
  from_casa: string;
  to_casa: string;
  item_name: string;
  item_type: 'product' | 'insumo';
  quantity: number;
  notes: string | null;
  created_at: string;
}

interface SelectOption {
  id: string;
  name: string;
}

export default function TransferenciasPage() {
  const [transfers, setTransfers] = useState<TransferRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [casas, setCasas] = useState<SelectOption[]>([]);
  const [products, setProducts] = useState<SelectOption[]>([]);
  const [insumos, setInsumos] = useState<SelectOption[]>([]);

  const [fromCasa, setFromCasa] = useState('');
  const [toCasa, setToCasa] = useState('');
  const [itemType, setItemType] = useState<'product' | 'insumo'>('product');
  const [itemId, setItemId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchTransfers = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('transfers')
      .select(
        'id, quantity, notes, created_at, from_casa:casas!transfers_from_casa_id_fkey(name), to_casa:casas!transfers_to_casa_id_fkey(name), product:products(name), insumo:insumos(name)'
      )
      .order('created_at', { ascending: false })
      .limit(50);

    if (data) {
      setTransfers(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (data as any[]).map((t) => ({
          id: t.id,
          from_casa: t.from_casa?.name || '',
          to_casa: t.to_casa?.name || '',
          item_name: t.product?.name || t.insumo?.name || 'Desconhecido',
          item_type: t.product ? 'product' : 'insumo',
          quantity: t.quantity,
          notes: t.notes,
          created_at: t.created_at,
        }))
      );
    }
    setLoading(false);
  }, []);

  const fetchOptions = useCallback(async () => {
    const [casasRes, productsRes, insumosRes] = await Promise.all([
      supabase.from('casas').select('id, name').order('name'),
      supabase.from('products').select('id, name').order('name'),
      supabase.from('insumos').select('id, name').order('name'),
    ]);
    setCasas(casasRes.data || []);
    setProducts(productsRes.data || []);
    setInsumos(insumosRes.data || []);
  }, []);

  useEffect(() => {
    fetchTransfers();
    fetchOptions();
  }, [fetchTransfers, fetchOptions]);

  const handleSubmit = async () => {
    if (!fromCasa || !toCasa || !itemId || !quantity || fromCasa === toCasa) return;

    setSubmitting(true);

    const transferData: Record<string, unknown> = {
      from_casa_id: fromCasa,
      to_casa_id: toCasa,
      quantity: Number(quantity),
      notes: notes || null,
    };

    if (itemType === 'product') {
      transferData.product_id = itemId;
    } else {
      transferData.insumo_id = itemId;
    }

    await supabase.from('transfers').insert(transferData);

    const itemField = itemType === 'product' ? 'product_id' : 'insumo_id';

    const { data: fromStock } = await supabase
      .from('stock_items')
      .select('id, quantity')
      .eq('casa_id', fromCasa)
      .eq(itemField, itemId)
      .single();

    if (fromStock) {
      await supabase
        .from('stock_items')
        .update({
          quantity: Math.max(0, fromStock.quantity - Number(quantity)),
          updated_at: new Date().toISOString(),
        })
        .eq('id', fromStock.id);
    }

    const { data: toStock } = await supabase
      .from('stock_items')
      .select('id, quantity')
      .eq('casa_id', toCasa)
      .eq(itemField, itemId)
      .single();

    if (toStock) {
      await supabase
        .from('stock_items')
        .update({
          quantity: toStock.quantity + Number(quantity),
          updated_at: new Date().toISOString(),
        })
        .eq('id', toStock.id);
    } else {
      const newStockItem: Record<string, unknown> = {
        casa_id: toCasa,
        quantity: Number(quantity),
        minimum: 0,
        unit: 'un',
      };
      if (itemType === 'product') newStockItem.product_id = itemId;
      else newStockItem.insumo_id = itemId;
      await supabase.from('stock_items').insert(newStockItem);
    }

    await supabase.from('stock_movements').insert([
      {
        casa_id: fromCasa,
        [itemField]: itemId,
        movement_type: 'transferencia',
        quantity: -Number(quantity),
        reference: `Transferencia para outra casa`,
        notes: notes || null,
      },
      {
        casa_id: toCasa,
        [itemField]: itemId,
        movement_type: 'transferencia',
        quantity: Number(quantity),
        reference: `Transferencia de outra casa`,
        notes: notes || null,
      },
    ]);

    setSubmitting(false);
    setShowModal(false);
    setFromCasa('');
    setToCasa('');
    setItemId('');
    setQuantity('');
    setNotes('');
    fetchTransfers();
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Transferencias</h1>
          <p className="text-sm text-gray-500">Transferir mercadorias entre casas</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 flex items-center gap-2"
        >
          <Plus size={18} />
          Nova Transferencia
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="font-semibold text-gray-900 mb-4">Historico de Transferencias</h3>
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="pb-2 font-medium">Data</th>
                  <th className="pb-2 font-medium">De</th>
                  <th className="pb-2 font-medium"></th>
                  <th className="pb-2 font-medium">Para</th>
                  <th className="pb-2 font-medium">Item</th>
                  <th className="pb-2 font-medium">Tipo</th>
                  <th className="pb-2 font-medium text-right">Quantidade</th>
                  <th className="pb-2 font-medium">Observacao</th>
                </tr>
              </thead>
              <tbody>
                {transfers.map((t) => (
                  <tr key={t.id} className="border-b border-gray-50">
                    <td className="py-2 text-gray-500 text-xs">
                      {formatDateTime(t.created_at)}
                    </td>
                    <td className="py-2">
                      <span className={`text-xs px-2 py-0.5 rounded ${casaBgColor(t.from_casa)}`}>
                        {t.from_casa}
                      </span>
                    </td>
                    <td className="py-2">
                      <ArrowRight size={14} className="text-gray-400" />
                    </td>
                    <td className="py-2">
                      <span className={`text-xs px-2 py-0.5 rounded ${casaBgColor(t.to_casa)}`}>
                        {t.to_casa}
                      </span>
                    </td>
                    <td className="py-2 font-medium text-gray-900">{t.item_name}</td>
                    <td className="py-2">
                      {t.item_type === 'product' ? (
                        <span className="text-xs text-blue-600 flex items-center gap-1">
                          <Package size={12} /> Produto
                        </span>
                      ) : (
                        <span className="text-xs text-amber-600 flex items-center gap-1">
                          <ShoppingBasket size={12} /> Insumo
                        </span>
                      )}
                    </td>
                    <td className="py-2 text-right font-medium text-gray-900">
                      {formatNumber(t.quantity)}
                    </td>
                    <td className="py-2 text-gray-500 text-xs">{t.notes || '-'}</td>
                  </tr>
                ))}
                {transfers.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-gray-500">
                      Nenhuma transferencia realizada
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <ArrowLeftRight size={18} />
                Nova Transferencia
              </h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">De</label>
                  <select
                    value={fromCasa}
                    onChange={(e) => setFromCasa(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="">Selecione...</option>
                    {casas.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Para</label>
                  <select
                    value={toCasa}
                    onChange={(e) => setToCasa(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="">Selecione...</option>
                    {casas
                      .filter((c) => c.id !== fromCasa)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo do Item</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setItemType('product');
                      setItemId('');
                    }}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border ${
                      itemType === 'product'
                        ? 'bg-blue-50 text-blue-700 border-blue-300'
                        : 'bg-white text-gray-700 border-gray-300'
                    }`}
                  >
                    <Package size={14} className="inline mr-1" />
                    Produto
                  </button>
                  <button
                    onClick={() => {
                      setItemType('insumo');
                      setItemId('');
                    }}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border ${
                      itemType === 'insumo'
                        ? 'bg-amber-50 text-amber-700 border-amber-300'
                        : 'bg-white text-gray-700 border-gray-300'
                    }`}
                  >
                    <ShoppingBasket size={14} className="inline mr-1" />
                    Insumo
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Item</label>
                <select
                  value={itemId}
                  onChange={(e) => setItemId(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">Selecione...</option>
                  {(itemType === 'product' ? products : insumos).map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantidade</label>
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="0"
                  min="1"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Observacao (opcional)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex: Reposicao para evento"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>

              <button
                onClick={handleSubmit}
                disabled={submitting || !fromCasa || !toCasa || !itemId || !quantity || fromCasa === toCasa}
                className="w-full bg-indigo-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                ) : (
                  <>
                    <ArrowLeftRight size={16} />
                    Realizar Transferencia
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
