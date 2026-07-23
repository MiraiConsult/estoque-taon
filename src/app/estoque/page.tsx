'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { formatCurrency, formatNumber, casaBgColor } from '@/lib/format';
import CasaFilter from '@/components/CasaFilter';
import StatCard from '@/components/StatCard';
import LoadingState from '@/components/LoadingState';
import {
  Package,
  AlertTriangle,
  DollarSign,
  Search,
  Plus,
  X,
  Trash2,
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
  casa_id: string;
}

interface Insumo {
  id: string;
  name: string;
  unit: string;
  unit_cost: number;
  casa_id: string;
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
  return (
    <Suspense>
      <EstoqueContent />
    </Suspense>
  );
}

function EstoqueContent() {
  const searchParams = useSearchParams();
  const [selectedCasa, setSelectedCasa] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [casas, setCasas] = useState<Casa[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    if (searchParams.get('ajustar') === 'true') {
      setModalOpen(true);
      window.history.replaceState(null, '', '/estoque');
    }
  }, [searchParams]);
  const [submitting, setSubmitting] = useState(false);
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  // Edição inline de quantidade na tabela
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQty, setEditQty] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);

  // Form state
  const [formCasaId, setFormCasaId] = useState('');
  const [formItemType, setFormItemType] = useState<'product' | 'insumo'>('product');
  const [formItemId, setFormItemId] = useState('');
  const [formQuantity, setFormQuantity] = useState('');
  const [formMovementType, setFormMovementType] = useState<'entrada' | 'saida' | 'ajuste'>('entrada');
  const [formNotes, setFormNotes] = useState('');
  // Criar novo produto/insumo direto no modal
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [newUnit, setNewUnit] = useState('ml');
  const [newPrice, setNewPrice] = useState('');
  const [newCost, setNewCost] = useState('');
  // Editar / excluir item (produto ou insumo)
  const [editItem, setEditItem] = useState<StockItem | null>(null);
  const [eName, setEName] = useState('');
  const [eCategory, setECategory] = useState('');
  const [ePrice, setEPrice] = useState('');
  const [eCost, setECost] = useState('');
  const [eUnit, setEUnit] = useState('');
  const [eMin, setEMin] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleteItemConfirm, setDeleteItemConfirm] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
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
        supabase.from('products').select('id, name, category, type, sale_price, cost, casa_id').order('name'),
        supabase.from('insumos').select('id, name, unit, unit_cost, casa_id').order('name'),
      ]);

      setStockItems((stockRes.data || []) as unknown as StockItem[]);
      setCasas((casasRes.data || []) as Casa[]);
      setProducts((productsRes.data || []) as Product[]);
      setInsumos((insumosRes.data || []) as Insumo[]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('Fetch error:', msg);
      setFetchError(msg);
    } finally {
      setLoading(false);
    }
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

  // Categorias disponíveis (dos itens carregados)
  const categorias = Array.from(new Set(stockItems.map((i) => getItemCategory(i)).filter(Boolean))).sort();

  // Filter items by search query + categoria
  const filteredItems = stockItems.filter((item) => {
    const name = getItemName(item).toLowerCase();
    const matchSearch = name.includes(searchQuery.toLowerCase());
    const matchCat = categoryFilter === 'all' || getItemCategory(item) === categoryFilter;
    return matchSearch && matchCat;
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
    setNewName('');
    setNewCategory('');
    setNewUnit('ml');
    setNewPrice('');
    setNewCost('');
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

    // Criar novo produto/insumo quando selecionado "+ Criar novo"
    let itemId = formItemId;
    let newInsumoUnit = 'un';
    if (formItemId === '__new__') {
      if (!newName.trim()) { setSubmitting(false); return; }
      if (isProduct) {
        const price = parseFloat(newPrice) || 0;
        const cost = parseFloat(newCost) || 0;
        const { data, error } = await supabase
          .from('products')
          .insert({
            name: newName.trim(),
            category: newCategory.trim() || 'Outros',
            type: 'product',
            sale_price: price,
            cost,
            markup: price > 0 && cost > 0 ? price / cost : 0,
            margin: price - cost,
            casa_id: formCasaId,
          })
          .select('id')
          .single();
        if (error || !data) { alert('Erro ao criar produto: ' + (error?.message || '')); setSubmitting(false); return; }
        itemId = data.id;
      } else {
        newInsumoUnit = newUnit.trim() || 'un';
        const { data, error } = await supabase
          .from('insumos')
          .insert({
            name: newName.trim(),
            unit: newInsumoUnit,
            unit_cost: parseFloat(newCost) || 0,
            casa_id: formCasaId,
          })
          .select('id')
          .single();
        if (error || !data) { alert('Erro ao criar insumo: ' + (error?.message || '')); setSubmitting(false); return; }
        itemId = data.id;
      }
    }

    // Find existing stock item
    let stockQuery = supabase
      .from('stock_items')
      .select('id, quantity')
      .eq('casa_id', formCasaId);

    if (isProduct) {
      stockQuery = stockQuery.eq('product_id', itemId).is('insumo_id', null);
    } else {
      stockQuery = stockQuery.eq('insumo_id', itemId).is('product_id', null);
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
      const selectedInsumo = insumos.find((i) => i.id === itemId);
      await supabase.from('stock_items').insert({
        casa_id: formCasaId,
        product_id: isProduct ? itemId : null,
        insumo_id: !isProduct ? itemId : null,
        quantity: newQuantity,
        minimum: 0,
        unit: isProduct ? 'un' : selectedInsumo ? selectedInsumo.unit : newInsumoUnit,
      });
    }

    // Insert stock movement
    await supabase.from('stock_movements').insert({
      casa_id: formCasaId,
      product_id: isProduct ? itemId : null,
      insumo_id: !isProduct ? itemId : null,
      movement_type: formMovementType,
      quantity: qty,
      notes: formNotes || null,
    });

    setSubmitting(false);
    setModalOpen(false);
    fetchData();
  };

  // Ajuste rápido: edita a quantidade direto na linha e registra o movimento de ajuste.
  const saveQuantity = async (item: StockItem) => {
    const newQty = parseFloat(editQty.replace(',', '.'));
    if (isNaN(newQty) || newQty < 0 || newQty === item.quantity) {
      setEditingId(null);
      return;
    }
    setSavingId(item.id);
    const diff = newQty - item.quantity;
    await supabase
      .from('stock_items')
      .update({ quantity: newQty, updated_at: new Date().toISOString() })
      .eq('id', item.id);
    await supabase.from('stock_movements').insert({
      casa_id: item.casa_id,
      product_id: item.product_id,
      insumo_id: item.insumo_id,
      movement_type: 'ajuste',
      quantity: diff,
      notes: 'Ajuste rápido na tabela de estoque',
    });
    setStockItems((prev) => prev.map((s) => (s.id === item.id ? { ...s, quantity: newQty } : s)));
    setSavingId(null);
    setEditingId(null);
  };

  // Abre o editor de detalhes do item (produto ou insumo)
  const openEditItem = (item: StockItem) => {
    setEditItem(item);
    setDeleteItemConfirm(false);
    setEMin(String(item.minimum ?? 0));
    if (item.product_id) {
      const p = products.find((x) => x.id === item.product_id);
      setEName(p?.name || item.product?.name || '');
      setECategory(p?.category || item.product?.category || '');
      setEPrice(String(p?.sale_price ?? ''));
      setECost(String(p?.cost ?? item.product?.cost ?? ''));
    } else {
      const ins = insumos.find((x) => x.id === item.insumo_id);
      setEName(ins?.name || item.insumo?.name || '');
      setEUnit(ins?.unit || item.insumo?.unit || 'un');
      setECost(String(ins?.unit_cost ?? ''));
    }
  };

  const saveEdit = async () => {
    if (!editItem || !eName.trim()) return;
    setSavingEdit(true);
    if (editItem.product_id) {
      const price = parseFloat(ePrice) || 0;
      const cost = parseFloat(eCost) || 0;
      await supabase.from('products').update({
        name: eName.trim(), category: eCategory.trim() || 'Outros',
        sale_price: price, cost, markup: price > 0 && cost > 0 ? price / cost : 0, margin: price - cost,
      }).eq('id', editItem.product_id);
    } else {
      await supabase.from('insumos').update({
        name: eName.trim(), unit: eUnit.trim() || 'un', unit_cost: parseFloat(eCost) || 0,
      }).eq('id', editItem.insumo_id);
    }
    await supabase.from('stock_items').update({ minimum: parseFloat(eMin) || 0 }).eq('id', editItem.id);
    setSavingEdit(false);
    setEditItem(null);
    fetchData();
  };

  const deleteItem = async () => {
    if (!editItem) return;
    setSavingEdit(true);
    try {
      if (editItem.product_id) {
        const id = editItem.product_id;
        await supabase.from('sales').delete().eq('product_id', id);
        await supabase.from('stock_movements').delete().eq('product_id', id);
        await supabase.from('transfers').delete().eq('product_id', id);
        await supabase.from('stock_items').delete().eq('product_id', id);
        await supabase.from('event_reconciliation').delete().eq('product_id', id);
        await supabase.from('product_components').delete().eq('component_product_id', id);
        const { error } = await supabase.from('products').delete().eq('id', id);
        if (error) throw new Error(error.message);
      } else {
        const id = editItem.insumo_id;
        await supabase.from('recipe_ingredients').delete().eq('insumo_id', id);
        await supabase.from('stock_movements').delete().eq('insumo_id', id);
        await supabase.from('transfers').delete().eq('insumo_id', id);
        await supabase.from('stock_items').delete().eq('insumo_id', id);
        await supabase.from('event_reconciliation').delete().eq('insumo_id', id);
        const { error } = await supabase.from('insumos').delete().eq('id', id);
        if (error) throw new Error(error.message);
      }
      setEditItem(null);
      fetchData();
    } catch (err) {
      alert('Erro ao excluir: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSavingEdit(false);
    }
  };

  const SortHeader = ({ field, label, align }: { field: SortField; label: string; align?: string }) => (
    <th
      className={`px-4 py-3 font-medium cursor-pointer hover:text-gray-900 select-none whitespace-nowrap ${
        align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'
      }`}
      onClick={() => handleSort(field)}
    >
      <span className={`inline-flex items-center gap-1 ${align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : ''}`}>
        {label}
        <ArrowUpDown
          size={14}
          className={sortField === field ? 'text-blue-700' : 'text-gray-300'}
        />
      </span>
    </th>
  );

  return (
    <LoadingState loading={loading} error={fetchError}>
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Estoque</h1>
          <p className="text-sm text-gray-500">Controle de estoque por casa</p>
        </div>
        <CasaFilter selected={selectedCasa} onChange={setSelectedCasa} />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
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
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 sm:w-52"
        >
          <option value="all">Todas as categorias</option>
          {categorias.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <button
          onClick={openModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-700 text-white rounded-lg text-sm font-medium hover:bg-blue-800 transition-colors whitespace-nowrap"
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
              <tr className="text-gray-500 border-b bg-gray-50/50">
                <SortHeader field="name" label="Produto / Insumo" />
                <SortHeader field="category" label="Categoria" align="center" />
                <SortHeader field="casa" label="Casa" align="center" />
                <SortHeader field="quantity" label="Quantidade" align="center" />
                <SortHeader field="minimum" label="Minimo" align="center" />
                <SortHeader field="status" label="Status" align="center" />
                <th className="px-4 py-3 font-medium text-center">Unidade</th>
              </tr>
            </thead>
            <tbody>
              {sortedItems.map((item) => {
                const status = getStatus(item);
                return (
                  <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      <button
                        onClick={() => openEditItem(item)}
                        className="text-left hover:text-blue-700 hover:underline decoration-dashed underline-offset-2 transition-colors"
                        title="Editar / excluir este item"
                      >
                        {getItemName(item)}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-center text-gray-600">{getItemCategory(item)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded ${casaBgColor(getCasaName(item))}`}>
                        {getCasaName(item)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center font-medium text-gray-900">
                      {editingId === item.id ? (
                        <input
                          type="number"
                          value={editQty}
                          autoFocus
                          disabled={savingId === item.id}
                          onChange={(e) => setEditQty(e.target.value)}
                          onBlur={() => saveQuantity(item)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveQuantity(item);
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                          className="w-20 px-2 py-1 border border-blue-400 rounded text-center text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                        />
                      ) : (
                        <button
                          onClick={() => { setEditingId(item.id); setEditQty(String(item.quantity)); }}
                          className="hover:text-blue-700 hover:underline decoration-dashed underline-offset-2 transition-colors"
                          title="Clique para ajustar a quantidade"
                        >
                          {formatNumber(item.quantity)}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-600">
                      {formatNumber(item.minimum)}
                    </td>
                    <td className="px-4 py-3 text-center">
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
                    <td className="px-4 py-3 text-center text-gray-600">{item.unit}</td>
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
                  onChange={(e) => { setFormCasaId(e.target.value); setFormItemId(''); }}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
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
                        ? 'bg-blue-700 text-white border-blue-700'
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
                        ? 'bg-blue-700 text-white border-blue-700'
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  <option value="">
                    {formCasaId
                      ? `Selecione ${formItemType === 'product' ? 'o produto' : 'o insumo'}`
                      : 'Selecione a casa primeiro'}
                  </option>
                  {formCasaId && (
                    <option value="__new__">➕ Criar novo {formItemType === 'product' ? 'produto' : 'insumo'}</option>
                  )}
                  {formItemType === 'product'
                    ? products
                        .filter((p) => p.casa_id === formCasaId)
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))
                    : insumos
                        .filter((i) => i.casa_id === formCasaId)
                        .map((i) => (
                          <option key={i.id} value={i.id}>
                            {i.name} ({i.unit})
                          </option>
                        ))}
                </select>
              </div>

              {/* Campos de criação de novo produto/insumo */}
              {formItemId === '__new__' && (
                <div className="space-y-3 rounded-lg border border-blue-200 bg-blue-50/40 p-3">
                  <p className="text-xs font-medium text-blue-800">
                    Novo {formItemType === 'product' ? 'produto' : 'insumo'} na {casas.find((c) => c.id === formCasaId)?.name}
                  </p>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Nome"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                  {formItemType === 'product' ? (
                    <div className="grid grid-cols-3 gap-2">
                      <input type="text" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="Categoria" className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                      <input type="number" step="0.01" value={newPrice} onChange={(e) => setNewPrice(e.target.value)} placeholder="Preço venda" className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                      <input type="number" step="0.01" value={newCost} onChange={(e) => setNewCost(e.target.value)} placeholder="Custo" className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <input type="text" value={newUnit} onChange={(e) => setNewUnit(e.target.value)} placeholder="Unidade (ml, g, un)" className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                      <input type="number" step="0.0001" value={newCost} onChange={(e) => setNewCost(e.target.value)} placeholder="Custo por unidade" className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                    </div>
                  )}
                </div>
              )}

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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
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
                  className="flex-1 px-4 py-2.5 bg-blue-700 text-white rounded-lg text-sm font-medium hover:bg-blue-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal editar / excluir item */}
      {editItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setEditItem(null)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                Editar {editItem.product_id ? 'produto' : 'insumo'}
              </h2>
              <button onClick={() => setEditItem(null)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nome</label>
                <input type="text" value={eName} onChange={(e) => setEName(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600" />
              </div>
              {editItem.product_id ? (
                <div className="grid grid-cols-3 gap-2">
                  <div><label className="block text-xs text-gray-600 mb-1">Categoria</label><input type="text" value={eCategory} onChange={(e) => setECategory(e.target.value)} className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm" /></div>
                  <div><label className="block text-xs text-gray-600 mb-1">Preço venda</label><input type="number" step="0.01" value={ePrice} onChange={(e) => setEPrice(e.target.value)} className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm" /></div>
                  <div><label className="block text-xs text-gray-600 mb-1">Custo</label><input type="number" step="0.01" value={eCost} onChange={(e) => setECost(e.target.value)} className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm" /></div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="block text-xs text-gray-600 mb-1">Unidade</label><input type="text" value={eUnit} onChange={(e) => setEUnit(e.target.value)} className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm" /></div>
                  <div><label className="block text-xs text-gray-600 mb-1">Custo por unidade</label><input type="number" step="0.0001" value={eCost} onChange={(e) => setECost(e.target.value)} className="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm" /></div>
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Estoque mínimo</label>
                <input type="number" step="1" value={eMin} onChange={(e) => setEMin(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 mt-5">
              {deleteItemConfirm ? (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-red-600">Excluir mesmo?</span>
                  <button onClick={deleteItem} disabled={savingEdit} className="px-3 py-1.5 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50">{savingEdit ? '...' : 'Sim, excluir'}</button>
                  <button onClick={() => setDeleteItemConfirm(false)} className="px-3 py-1.5 text-xs bg-gray-200 text-gray-700 rounded">Não</button>
                </div>
              ) : (
                <button onClick={() => setDeleteItemConfirm(true)} className="inline-flex items-center gap-1.5 text-sm text-red-600 hover:bg-red-50 px-3 py-2 rounded-lg">
                  <Trash2 size={15} /> Excluir
                </button>
              )}
              <div className="flex gap-2">
                <button onClick={() => setEditItem(null)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">Cancelar</button>
                <button onClick={saveEdit} disabled={savingEdit || !eName.trim()} className="px-4 py-2 bg-blue-700 text-white rounded-lg text-sm font-medium hover:bg-blue-800 disabled:opacity-50">{savingEdit ? 'Salvando…' : 'Salvar'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    </LoadingState>
  );
}
