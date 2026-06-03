'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { formatCurrency, formatNumber, casaBgColor } from '@/lib/format';
import CasaFilter from '@/components/CasaFilter';
import StatCard from '@/components/StatCard';
import LoadingState from '@/components/LoadingState';
import {
  Wine,
  DollarSign,
  TrendingUp,
  Percent,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Check,
  X,
  PackageOpen,
  ClipboardList,
  Link2,
  Unlink,
  Download,
} from 'lucide-react';
import { exportToExcel } from '@/lib/exportExcel';

interface Product {
  id: string;
  name: string;
  category: string;
  type: string;
  sale_price: number;
  cost: number;
  markup: number;
  margin: number;
  casa_id: string;
  casa_name: string;
  recipe_id: string | null;
  linked_insumo_id: string | null;
  linked_insumo_name: string | null;
}

type SortField = 'name' | 'casa_name' | 'category' | 'type' | 'sale_price' | 'cost' | 'margin' | 'markup';
type SortDirection = 'asc' | 'desc';

function InlineNameEdit({ productId, initial, onSaved }: { productId: string; initial: string; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initial);
  const [busy, setBusy] = useState(false);

  if (!editing) {
    return (
      <button
        onClick={() => { setValue(initial); setEditing(true); }}
        className="text-left hover:text-blue-700 hover:underline decoration-dashed underline-offset-2 transition-colors"
        title="Clique para editar"
      >
        {initial}
      </button>
    );
  }

  const save = async () => {
    if (!value.trim() || value === initial) { setEditing(false); return; }
    setBusy(true);
    await supabase.from('products').update({ name: value.trim() }).eq('id', productId);
    setBusy(false);
    setEditing(false);
    onSaved();
  };

  return (
    <input
      type="text"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => {
        if (e.key === 'Enter') save();
        if (e.key === 'Escape') setEditing(false);
      }}
      autoFocus
      disabled={busy}
      className="w-full px-2 py-1 border border-blue-400 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
    />
  );
}

export default function DrinksPage() {
  const [selectedCasa, setSelectedCasa] = useState('all');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [sortField, setSortField] = useState<SortField>('markup');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [linkModalProduct, setLinkModalProduct] = useState<Product | null>(null);
  const [allInsumos, setAllInsumos] = useState<Array<{ id: string; name: string; unit: string }>>([]);
  const [linkSearch, setLinkSearch] = useState('');

  const fetchProducts = useCallback(async () => {
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

      let query = supabase
        .from('products')
        .select('id, name, category, type, sale_price, cost, markup, margin, casa_id, linked_insumo_id, casa:casas(name), insumo:insumos!linked_insumo_id(id, name, unit)');

      if (casaId) {
        query = query.eq('casa_id', casaId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching products:', error);
        return;
      }

      const { data: recipes } = await supabase.from('drink_recipes').select('id, product_id');
      const recipeMap = new Map((recipes || []).map(r => [r.product_id, r.id]));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mapped = ((data || []) as any[]).map((p: any) => ({
        id: p.id,
        name: p.name,
        category: p.category || '',
        type: p.type || '',
        sale_price: Number(p.sale_price) || 0,
        cost: Number(p.cost) || 0,
        markup: Number(p.markup) || 0,
        margin: Number(p.margin) || 0,
        casa_id: p.casa_id,
        casa_name: p.casa?.name || '',
        recipe_id: recipeMap.get(p.id) || null,
        linked_insumo_id: p.linked_insumo_id || null,
        linked_insumo_name: p.insumo?.name || null,
      }));

      setProducts(mapped);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('Fetch error:', msg);
      setFetchError(msg);
    } finally {
      setLoading(false);
    }
  }, [selectedCasa]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    supabase.from('insumos').select('id, name, unit').order('name').then(({ data }) => {
      if (data) setAllInsumos(data);
    });
  }, []);

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  async function linkInsumo(productId: string, insumoId: string | null) {
    await supabase.from('products').update({ linked_insumo_id: insumoId }).eq('id', productId);
    setLinkModalProduct(null);
    setLinkSearch('');
    fetchProducts();
  }

  const categories = Array.from(new Set(products.map((p) => p.category).filter(Boolean))).sort();

  const filtered = products
    .filter((p) => {
      if (searchTerm && !p.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      if (categoryFilter !== 'all' && p.category !== categoryFilter) return false;
      if (typeFilter !== 'all' && p.type !== typeFilter) return false;
      return true;
    })
    .sort((a, b) => {
      const dir = sortDirection === 'asc' ? 1 : -1;
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return aVal.localeCompare(bVal, 'pt-BR') * dir;
      }
      return (Number(aVal) - Number(bVal)) * dir;
    });

  const totalDrinks = filtered.length;
  const avgPrice = totalDrinks > 0 ? filtered.reduce((s, p) => s + p.sale_price, 0) / totalDrinks : 0;
  const avgCost = totalDrinks > 0 ? filtered.reduce((s, p) => s + p.cost, 0) / totalDrinks : 0;
  const avgMarkup = totalDrinks > 0 ? filtered.reduce((s, p) => s + p.markup, 0) / totalDrinks : 0;

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection(field === 'name' || field === 'casa_name' || field === 'category' || field === 'type' ? 'asc' : 'desc');
    }
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <ArrowUpDown size={14} className="text-gray-400" />;
    return sortDirection === 'asc' ? (
      <ArrowUp size={14} className="text-blue-700" />
    ) : (
      <ArrowDown size={14} className="text-blue-700" />
    );
  }

  function startEditing(product: Product) {
    setEditingId(product.id);
    setEditValue(product.sale_price.toFixed(2).replace('.', ','));
  }

  async function savePrice(product: Product) {
    const parsed = parseFloat(editValue.replace(',', '.'));
    if (isNaN(parsed) || parsed < 0) {
      setEditingId(null);
      return;
    }

    const newSalePrice = parsed;
    const cost = product.cost;
    const newMargin = newSalePrice - cost;
    const newMarkup = cost > 0 ? newSalePrice / cost : 0;

    setSaving(true);
    const { error } = await supabase
      .from('products')
      .update({
        sale_price: newSalePrice,
        margin: newMargin,
        markup: parseFloat(newMarkup.toFixed(2)),
      })
      .eq('id', product.id);

    if (error) {
      console.error('Error updating price:', error);
    } else {
      setProducts((prev) =>
        prev.map((p) =>
          p.id === product.id
            ? { ...p, sale_price: newSalePrice, margin: newMargin, markup: parseFloat(newMarkup.toFixed(2)) }
            : p
        )
      );
    }

    setSaving(false);
    setEditingId(null);
  }

  function handleKeyDown(e: React.KeyboardEvent, product: Product) {
    if (e.key === 'Enter') {
      savePrice(product);
    } else if (e.key === 'Escape') {
      setEditingId(null);
    }
  }

  function markupColor(markup: number): string {
    if (markup >= 5) return 'text-emerald-700 bg-emerald-50';
    if (markup >= 3) return 'text-amber-700 bg-amber-50';
    return 'text-red-700 bg-red-50';
  }

  return (
    <LoadingState loading={loading} error={fetchError}>
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Drinks &amp; Produtos</h1>
          <p className="text-sm text-gray-500">Banco de dados de todos os produtos e drinks</p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <button
            onClick={() => {
              exportToExcel('drinks_produtos', {
                Produtos: filtered.map((p) => ({
                  Nome: p.name,
                  Casa: p.casa_name,
                  Categoria: p.category,
                  Tipo: p.type === 'drink' ? 'Drink' : 'Produto',
                  'Preco Venda (R$)': p.sale_price,
                  'Custo (R$)': p.cost,
                  'Margem (R$)': p.margin,
                  Markup: p.markup,
                  'Insumo Vinculado': p.linked_insumo_name || '',
                })),
              });
            }}
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
          >
            <Download size={16} />
            Excel
          </button>
          <CasaFilter selected={selectedCasa} onChange={setSelectedCasa} />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard
          title="Total Produtos"
          value={formatNumber(totalDrinks)}
          subtitle="drinks e produtos"
          icon={<Wine size={18} />}
          color="purple"
        />
        <StatCard
          title="Preco Medio"
          value={formatCurrency(avgPrice)}
          subtitle="preco de venda"
          icon={<DollarSign size={18} />}
          color="green"
        />
        <StatCard
          title="Custo Medio"
          value={formatCurrency(avgCost)}
          subtitle="custo unitario"
          icon={<Percent size={18} />}
          color="red"
        />
        <StatCard
          title="Markup Medio"
          value={`${formatNumber(avgMarkup, 1)}x`}
          subtitle="venda / custo"
          icon={<TrendingUp size={18} />}
          color="amber"
        />
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nome..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent bg-white"
          >
            <option value="all">Todas Categorias</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent bg-white"
          >
            <option value="all">Todos os Tipos</option>
            <option value="drink">Drink</option>
            <option value="product">Produto</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-3 py-3 font-semibold text-gray-600 text-center w-10">Ficha</th>
                {([
                  { field: 'name' as SortField, label: 'Nome', align: 'left' },
                  { field: 'casa_name' as SortField, label: 'Casa', align: 'left' },
                  { field: 'category' as SortField, label: 'Categoria', align: 'left' },
                  { field: 'type' as SortField, label: 'Tipo', align: 'left' },
                  { field: 'sale_price' as SortField, label: 'Preco Venda', align: 'right' },
                  { field: 'cost' as SortField, label: 'Custo', align: 'right' },
                  { field: 'margin' as SortField, label: 'Margem', align: 'right' },
                  { field: 'markup' as SortField, label: 'Markup', align: 'right' },
                ]).map((col) => (
                  <th
                    key={col.field}
                    onClick={() => handleSort(col.field)}
                    className={`px-4 py-3 font-semibold text-gray-600 cursor-pointer select-none hover:bg-gray-100 transition-colors ${
                      col.align === 'right' ? 'text-right' : 'text-left'
                    }`}
                  >
                    <div className={`flex items-center gap-1.5 ${col.align === 'right' ? 'justify-end' : ''}`}>
                      <span>{col.label}</span>
                      <SortIcon field={col.field} />
                    </div>
                  </th>
                ))}
                <th className="px-4 py-3 font-semibold text-gray-600 text-left">Insumo Vinculado</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((product) => (
                <tr
                  key={product.id}
                  className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                >
                  <td className="px-3 py-3 text-center">
                    {product.recipe_id ? (
                      <Link
                        href={`/fichas-tecnicas/${product.recipe_id}`}
                        className="inline-flex items-center justify-center text-blue-600 hover:text-blue-800 transition-colors"
                        title="Ver ficha técnica"
                      >
                        <ClipboardList size={16} />
                      </Link>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    <InlineNameEdit
                      productId={product.id}
                      initial={product.name}
                      onSaved={() => fetchProducts()}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${casaBgColor(product.casa_name)}`}>
                      {product.casa_name}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{product.category}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs px-2 py-0.5 rounded font-medium ${
                        product.type === 'drink'
                          ? 'bg-blue-50 text-blue-800'
                          : 'bg-orange-50 text-orange-700'
                      }`}
                    >
                      {product.type === 'drink' ? 'Drink' : 'Produto'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {editingId === product.id ? (
                      <div className="flex items-center justify-end gap-1">
                        <span className="text-gray-400 text-xs">R$</span>
                        <input
                          ref={inputRef}
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() => savePrice(product)}
                          onKeyDown={(e) => handleKeyDown(e, product)}
                          disabled={saving}
                          className="w-24 px-2 py-1 text-right border border-blue-400 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                        />
                        <button
                          onClick={() => savePrice(product)}
                          className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                          title="Salvar"
                        >
                          <Check size={14} />
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="p-1 text-gray-400 hover:bg-gray-100 rounded"
                          title="Cancelar"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => startEditing(product)}
                        className="text-gray-900 font-medium hover:text-blue-700 hover:underline decoration-dashed underline-offset-2 transition-colors cursor-pointer"
                        title="Clique para editar"
                      >
                        {formatCurrency(product.sale_price)}
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600">
                    {formatCurrency(product.cost)}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">
                    {formatCurrency(product.margin)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span
                      className={`inline-block px-2 py-0.5 rounded font-semibold text-xs ${markupColor(product.markup)}`}
                    >
                      {formatNumber(product.markup, 1)}x
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setLinkModalProduct(product)}
                      className={`inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded transition-colors ${
                        product.linked_insumo_id
                          ? 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                          : 'bg-gray-50 text-gray-500 hover:bg-gray-100 border border-dashed border-gray-300'
                      }`}
                      title={product.linked_insumo_id ? 'Trocar insumo vinculado' : 'Vincular a um insumo'}
                    >
                      {product.linked_insumo_id ? (
                        <>
                          <Link2 size={12} />
                          <span className="max-w-[150px] truncate">{product.linked_insumo_name}</span>
                        </>
                      ) : (
                        <>
                          <Link2 size={12} />
                          Vincular
                        </>
                      )}
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center">
                    <PackageOpen size={40} className="mx-auto text-gray-300 mb-3" />
                    <p className="text-gray-500 font-medium">Nenhum produto encontrado</p>
                    <p className="text-gray-400 text-xs mt-1">Tente ajustar os filtros de busca</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {filtered.length > 0 && (
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 text-xs text-gray-500">
            Exibindo {filtered.length} de {products.length} produtos
          </div>
        )}
      </div>

      {linkModalProduct && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full max-h-[80vh] flex flex-col">
            <div className="p-4 border-b">
              <h3 className="font-semibold text-gray-900">Vincular Insumo</h3>
              <p className="text-xs text-gray-500 mt-1">
                Produto: <span className="font-medium">{linkModalProduct.name}</span>
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Quando este produto for vendido, o estoque do insumo vinculado será deduzido.
              </p>
            </div>
            <div className="p-4 border-b">
              <input
                type="text"
                placeholder="Buscar insumo..."
                value={linkSearch}
                onChange={(e) => setLinkSearch(e.target.value)}
                autoFocus
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {linkModalProduct.linked_insumo_id && (
                <button
                  onClick={() => linkInsumo(linkModalProduct.id, null)}
                  className="w-full text-left px-3 py-2 mb-2 rounded-lg text-sm bg-red-50 text-red-700 hover:bg-red-100 flex items-center gap-2"
                >
                  <Unlink size={14} />
                  Remover vínculo atual ({linkModalProduct.linked_insumo_name})
                </button>
              )}
              {allInsumos
                .filter((i) => !linkSearch || i.name.toLowerCase().includes(linkSearch.toLowerCase()))
                .slice(0, 50)
                .map((insumo) => (
                  <button
                    key={insumo.id}
                    onClick={() => linkInsumo(linkModalProduct.id, insumo.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between ${
                      linkModalProduct.linked_insumo_id === insumo.id
                        ? 'bg-blue-100 text-blue-800'
                        : 'hover:bg-gray-100 text-gray-700'
                    }`}
                  >
                    <span>{insumo.name}</span>
                    <span className="text-xs text-gray-400">{insumo.unit}</span>
                  </button>
                ))}
            </div>
            <div className="p-3 border-t bg-gray-50 flex justify-end">
              <button
                onClick={() => { setLinkModalProduct(null); setLinkSearch(''); }}
                className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-200 rounded-lg"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </LoadingState>
  );
}
