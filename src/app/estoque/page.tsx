'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { formatCurrency, formatNumber, casaBgColor } from '@/lib/format';
import CasaFilter from '@/components/CasaFilter';
import StatCard from '@/components/StatCard';
import {
  Package,
  AlertTriangle,
  DollarSign,
  Search,
  Plus,
  X,
  ArrowUpDown,
} from 'lucide-react';

interface Casa {
  id: string;
  name: string;
}

interface Product {
  id: string;
  name: string;
  category: string;
  type: string;
  sale_price: number;
  cost: number;
}

interface Insumo {
  id: string;
  name: string;
  unit: string;
}

interface StockItem {
  id: string;
  casa_id: string;
  product_id: string | null;
  insumo_id: string | null;
  quantity: number;
  minimum: number;
  unit: string;
  updated_at: string;
  product: { name: string; category: string; cost: number } | null;
  insumo: { name: string; unit: string } | null;
  casa: { name: string } | null;
}

type SortField = 'name' | 'category' | 'casa' | 'quantity' | 'minimum' | 'status';
type SortDirection = 'asc' | 'desc';

export default function EstoquePage() {
  const [selectedCasa, setSelectedCasa] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [casas, setCasas] = useState<Casa[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Form state
  const [formCasaId, setFormCasaId] = useState('');
  const [formItemType, setFormItemType] = useState<'product' | 'insumo'>('product');
  const [formItemId, setFormItemId] = useState('');
  const [formQuantity, setFormQuantity] = useState('');
  const [formMovementType, setFormMovementType] = useState<'entrada' | 'saida' | 'ajuste'>('entrada');
  const [formNotes, setFormNotes] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);

    let casaId: string | null = null;
    if (selectedCasa !== 'all') {
      const { data: casa } = await supabase
        .from('casas')
        .select('id')
        .eq('name', selectedCasa)
        .single();
      casaId = casa?.id || null;
    }

    const [stockRes, casasRes, productsRes, insumosRes] = await Promise.all([
      (() => {
        let q = supabase
          .from('stock_items')
          .select('id, casa_id, product_id, insumo_id, quantity, minimum, unit, updated_at, product:products(name, category, cost), insumo:insumos(name, unit), casa:casas(name)');
        if (casaId) q = q.eq('casa_id', casaId);
        return q;
      })(),
      supabase.from('casas').select('id, name'),
      supabase.from('products').select('id, name, category, type, sale_price, cost').order('name'),
      supabase.from('insumos').select('id, name, unit').order('name'),
    ]);

    setStockItems((stockRes.data || []) as unknown as StockItem[]);
    setCasas((casasRes.data || []) as Casa[]);
    setProducts((productsRes.data || []) as Product[]);
    setInsumos((insumosRes.data || []) as Insumo[]);
    setLoading(false);
  }, [selectedCasa]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getItemName = (item: StockItem): string => {
    return item.product?.name || item.insumo?.name || 'Desconhecido';
  };

  const getItemCategory = (item: StockItem): string => {
    if (item.product) return item.product.category || 'Produto';
    if (item.insumo) return 'Insumo';
    return '-';
  };

  const getCasaName = (item: StockItem): string => {
    return item.casa?.name || '';
  };

  const getStatus = (item: StockItem): 'Comprar' | 'Suficiente' => {
    return item.quantity < item.minimum ? 'Comprar' : 'Suficiente';
  };

  // Filter items by search query
  const filteredItems = stockItems.filter((item) => {
    const name = getItemName(item).toLowerCase();
    return name.includes(searchQuery.toLowerCase());
  });

  // Sort items
  const sortedItems = [...filteredItems].sort((a, b) => {
    let comparison = 0;
    switch (sortField) {
      case 'name':
        comparison = getItemName(a).localeCompare(getItemName(b));
        break;
      case 'category':
        comparison = getItemCategory(a).localeCompare(getItemCategory(b));
        break;
      case 'casa':
        comparison = getCasaName(a).localeCompare(getCasaName(b));
        break;
      case 'quantity':
        comparison = a.quantity - b.quantity;
        break;
      case 'minimum':
        comparison = a.minimum - b.minimum;
        break;
      case 'status':
        comparison = getStatus(a).localeCompare(getStatus(b));
        break;
    }
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  // Summary calculations
  const totalItems = stockItems.length;
  const itemsEmFalta = stockItems.filter((item) => item.quantity < item.minimum).length;
  const valorEstimado = stockItems.reduce((sum, item) => {
    const unitCost = item.product?.cost || 0;
    return sum + unitCost * item.quantity;
  }, 0);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const resetForm = () => {
    setFormCasaId('');
    setFormItemType('product');
    setFormItemId('');
    setFormQuantity('');
    setFormMovementType('entrada');
    setFormNotes('');
  };

  const openModal = () => {
    resetForm();
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCasaId || !formItemId || !formQuantity) return;

    setSubmitting(true);

    const qty = parseFloat(formQuantity);
    if (isNaN(qty) || qty <= 0) {
      setSubmitting(false);
      return;
    }

    const isProduct = formItemType === 'product';

    // Find existing stock item
    let stockQuery = supabase
      .from('stock_items')
      .select('id, quantity')
      .eq('casa_id', formCasaId);

    if (isProduct) {
      stockQuery = stockQuery.eq('product_id', formItemId).is('insumo_id', null);
    } else {
      stockQuery = stockQuery.eq('insumo_id', formItemId).is('product_id', null);
    }

    const { data: existingItems } = await stockQuery;
    const existingItem = existingItems?.[0];

    let newQuantity: number;
    if (formMovementType === 'ajuste') {
      newQuantity = qty;
    } else if (formMovementType === 'entrada') {
      newQuantity = (existingItem?.quantity || 0) + qty;
    } else {
      newQuantity = Math.max(0, (existingItem?.quantity || 0) - qty);
    }

    // Upsert stock item
    if (existingItem) {
      await supabase
        .from('stock_items')
        .update({ quantity: newQuantity, updated_at: new Date().toISOString() })
        .eq('id', existingItem.id);
    } else {
      const selectedInsumo = insumos.find((i) => i.id === formItemId);
      await supabase.from('stock_items').insert({
        casa_id: formCasaId,
        product_id: isProduct ? formItemId : null,
        insumo_id: !isProduct ? formItemId : null,
        quantity: newQuantity,
        minimum: 0,
        unit: !isProduct && selectedInsumo ? selectedInsumo.unit : 'un',
      });
    }

    // Insert stock movement
    await supabase.from('stock_movements').insert({
      casa_id: formCasaId,
      product_id: isProduct ? formItemId : null,
      insumo_id: !isProduct ? formItemId : null,
      movement_type: formMovementType,
      quantity: qty,
      notes: formNotes || null,
    });

    setSubmitting(false);
    setModalOpen(false);
    fetchData();
  };

  const SortHeader = ({ field, label, align }: { field: SortField; label: string; align?: string }) => (
    <th
      className={`pb-3 font-medium cursor-pointer hover:text-gray-900 select-none ${align === 'right' ? 'text-right' : 'text-left'}`}
      onClick={() => handleSort(field)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <ArrowUpDown
          size={14}
          className={sortField === field ? 'text-indigo-600' : 'text-gray-300'}
        />
      </span>
    </th>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Estoque</h1>
          <p className="text-gray-500 mt-1">Controle de estoque por casa</p>
        </div>
        <CasaFilter selected={selectedCasa} onChange={setSelectedCasa} />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard
          title="Total de Itens"
          value={formatNumber(totalItems)}
          subtitle="itens em estoque"
          icon={<Package size={20} />}
          color="blue"
        />
        <StatCard
          title="Itens em Falta"
          value={formatNumber(itemsEmFalta)}
          subtitle="abaixo do minimo"
          icon={<AlertTriangle size={20} />}
          color="red"
        />
        <StatCard
          title="Valor Estimado em Estoque"
          value={formatCurrency(valorEstimado)}
          subtitle="baseado no custo"
          icon={<DollarSign size={20} />}
          color="green"
        />
      </div>

      {/* Search and Actions */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nome do produto ou insumo..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
        <button
          onClick={openModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors whitespace-nowrap"
        >
          <Plus size={18} />
          Ajustar Estoque
        </button>
      </div>

      {/* Stock Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b bg-gray-50/50">
                <SortHeader field="name" label="Produto / Insumo" />
                <SortHeader field="category" label="Categoria" />
                <SortHeader field="casa" label="Casa" />
                <SortHeader field="quantity" label="Quantidade" align="right" />
                <SortHeader field="minimum" label="Minimo" align="right" />
                <SortHeader field="status" label="Status" />
                <th className="pb-3 font-medium text-left">Unidade</th>
              </tr>
            </thead>
            <tbody>
              {sortedItems.map((item) => {
                const status = getStatus(item);
                return (
                  <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="py-3 px-0 font-medium text-gray-900">
                      {getItemName(item)}
                    </td>
                    <td className="py-3 text-gray-600">{getItemCategory(item)}</td>
                    <td className="py-3">
                      <span className={`text-xs px-2 py-0.5 rounded ${casaBgColor(getCasaName(item))}`}>
                        {getCasaName(item)}
                      </span>
                    </td>
                    <td className="py-3 text-right font-medium text-gray-900">
                      {formatNumber(item.quantity, 2)}
                    </td>
                    <td className="py-3 text-right text-gray-600">
                      {formatNumber(item.minimum, 2)}
                    </td>
                    <td className="py-3">
                      <span
                        className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                          status === 'Comprar'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        {status}
                      </span>
                    </td>
                    <td className="py-3 text-gray-600">{item.unit}</td>
                  </tr>
                );
              })}
              {sortedItems.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-500">
                    {searchQuery
                      ? 'Nenhum item encontrado para a busca'
                      : 'Nenhum item em estoque'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {sortedItems.length > 0 && (
          <div className="px-4 py-3 bg-gray-50/50 border-t text-sm text-gray-500">
            {sortedItems.length} {sortedItems.length === 1 ? 'item' : 'itens'} encontrado{sortedItems.length === 1 ? '' : 's'}
          </div>
        )}
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setModalOpen(false)}
          />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Ajustar Estoque</h2>
              <button
                onClick={() => setModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Casa */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Casa</label>
                <select
                  value={formCasaId}
                  onChange={(e) => setFormCasaId(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Selecione a casa</option>
                  {casas.map((casa) => (
                    <option key={casa.id} value={casa.id}>
                      {casa.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Item type toggle */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setFormItemType('product'); setFormItemId(''); }}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                      formItemType === 'product'
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    Produto
                  </button>
                  <button
                    type="button"
                    onClick={() => { setFormItemType('insumo'); setFormItemId(''); }}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                      formItemType === 'insumo'
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    Insumo
                  </button>
                </div>
              </div>

              {/* Product/Insumo select */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {formItemType === 'product' ? 'Produto' : 'Insumo'}
                </label>
                <select
                  value={formItemId}
                  onChange={(e) => setFormItemId(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">
                    Selecione {formItemType === 'product' ? 'o produto' : 'o insumo'}
                  </option>
                  {formItemType === 'product'
                    ? products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))
                    : insumos.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.name} ({i.unit})
                        </option>
                      ))}
                </select>
              </div>

              {/* Movement type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo de Movimentacao
                </label>
                <div className="flex gap-2">
                  {(['entrada', 'saida', 'ajuste'] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setFormMovementType(type)}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-colors capitalize ${
                        formMovementType === type
                          ? type === 'entrada'
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : type === 'saida'
                            ? 'bg-red-600 text-white border-red-600'
                            : 'bg-amber-600 text-white border-amber-600'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {type === 'saida' ? 'Saida' : type.charAt(0).toUpperCase() + type.slice(1)}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {formMovementType === 'entrada'
                    ? 'Adiciona a quantidade ao estoque atual'
                    : formMovementType === 'saida'
                    ? 'Remove a quantidade do estoque atual'
                    : 'Define a quantidade exata do estoque'}
                </p>
              </div>

              {/* Quantity */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantidade</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formQuantity}
                  onChange={(e) => setFormQuantity(e.target.value)}
                  required
                  placeholder="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Observacoes <span className="text-gray-400">(opcional)</span>
                </label>
                <input
                  type="text"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Motivo do ajuste..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
