'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { formatCurrency, formatNumber, casaBgColor } from '@/lib/format';
import CasaFilter from '@/components/CasaFilter';
import StatCard from '@/components/StatCard';
import LoadingState from '@/components/LoadingState';
import { ClipboardList, Search, Wine, DollarSign, TrendingUp, LayoutGrid, List, ArrowUpDown, Download, Plus, X } from 'lucide-react';
import { exportToExcel } from '@/lib/exportExcel';

interface DrinkRecipe {
  id: string;
  product_id: string;
  product_name: string;
  category: string;
  casa_name: string;
  sale_price: number;
  cost: number;
  markup: number;
  margin: number;
  has_recipe: boolean;
}

type SortField = 'product_name' | 'casa_name' | 'category' | 'cost' | 'sale_price' | 'markup';

export default function FichasTecnicasPage() {
  const router = useRouter();
  const [recipes, setRecipes] = useState<DrinkRecipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selectedCasa, setSelectedCasa] = useState('all');
  // Nova ficha
  const [casasList, setCasasList] = useState<Array<{ id: string; name: string }>>([]);
  const [showNew, setShowNew] = useState(false);
  const [nfName, setNfName] = useState('');
  const [nfCasaId, setNfCasaId] = useState('');
  const [nfCategory, setNfCategory] = useState('');
  const [nfPrice, setNfPrice] = useState('');
  const [creating, setCreating] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [sortField, setSortField] = useState<SortField>('markup');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const fetchRecipes = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      // Todos os drinks (com ou sem ficha técnica)
      const { data } = await supabase
        .from('products')
        .select(`id, name, category, sale_price, cost, markup, margin, casa:casas ( name ), recipe:drink_recipes ( id )`)
        .eq('type', 'drink');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mapped: DrinkRecipe[] = ((data || []) as any[]).map((p) => ({
        id: p.recipe?.[0]?.id || p.id,
        product_id: p.id,
        product_name: p.name,
        category: p.category || 'Sem categoria',
        casa_name: p.casa?.name || 'Desconhecido',
        sale_price: Number(p.sale_price) || 0,
        cost: Number(p.cost) || 0,
        markup: Number(p.markup) || 0,
        margin: Number(p.margin) || 0,
        has_recipe: (p.recipe?.length || 0) > 0,
      }));

      setRecipes(mapped);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('Fetch error:', msg);
      setFetchError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecipes();
  }, [fetchRecipes]);

  useEffect(() => {
    supabase.from('casas').select('id, name').order('name').then(({ data }) => {
      if (data) setCasasList(data as Array<{ id: string; name: string }>);
    });
  }, []);

  // Cria uma nova ficha técnica (drink ou dose) e vai para o detalhe pra adicionar ingredientes.
  const createFicha = async () => {
    if (!nfName.trim() || !nfCasaId) return;
    setCreating(true);
    const price = parseFloat(nfPrice) || 0;
    const { data: prod, error } = await supabase
      .from('products')
      .insert({
        name: nfName.trim(),
        category: nfCategory.trim() || 'Autorais',
        type: 'drink',
        sale_price: price,
        cost: 0,
        markup: 0,
        margin: price,
        casa_id: nfCasaId,
      })
      .select('id')
      .single();
    if (error || !prod) { alert('Erro ao criar ficha: ' + (error?.message || '')); setCreating(false); return; }
    await supabase.from('drink_recipes').insert({ product_id: prod.id });
    router.push(`/fichas-tecnicas/${prod.id}`);
  };

  const categories = useMemo(() => {
    return ['all', ...Array.from(new Set(recipes.map((r) => r.category))).sort()];
  }, [recipes]);

  const filtered = useMemo(() => {
    let result = recipes.filter((r) => {
      if (selectedCasa !== 'all' && r.casa_name !== selectedCasa) return false;
      if (selectedCategory !== 'all' && r.category !== selectedCategory) return false;
      if (search && !r.product_name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });

    result.sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (typeof aVal === 'string') return (aVal as string).localeCompare(bVal as string, 'pt-BR') * dir;
      return (Number(aVal) - Number(bVal)) * dir;
    });

    return result;
  }, [recipes, selectedCasa, selectedCategory, search, sortField, sortDir]);

  const stats = useMemo(() => {
    const total = filtered.length;
    const avgCost = total > 0 ? filtered.reduce((s, r) => s + r.cost, 0) / total : 0;
    const validMarkups = filtered.filter((r) => r.markup > 0);
    const avgMarkup = validMarkups.length > 0 ? validMarkups.reduce((s, r) => s + r.markup, 0) / validMarkups.length : 0;
    return { total, avgCost, avgMarkup };
  }, [filtered]);

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir(field === 'product_name' || field === 'casa_name' || field === 'category' ? 'asc' : 'desc');
    }
  }

  return (
    <LoadingState loading={loading} error={fetchError}>
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <ClipboardList className="text-blue-700" size={24} />
            Fichas Tecnicas
          </h1>
          <p className="text-sm text-gray-500">Receitas e custos detalhados dos drinks</p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <button
            onClick={async () => {
              // Fetch all ingredients for the filtered recipes
              const recipeIds = filtered.map((r) => r.id);
              const { data: ings } = await supabase
                .from('recipe_ingredients')
                .select('recipe_id, quantity, unit, ingredient_cost, insumo:insumos(name)')
                .in('recipe_id', recipeIds);
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const ingMap = new Map<string, any[]>();
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              ((ings || []) as any[]).forEach((i) => {
                const arr = ingMap.get(i.recipe_id) || [];
                arr.push(i);
                ingMap.set(i.recipe_id, arr);
              });

              exportToExcel('fichas_tecnicas', {
                Receitas: filtered.map((r) => ({
                  Drink: r.product_name,
                  Casa: r.casa_name,
                  Categoria: r.category,
                  'Custo (R$)': r.cost,
                  'Preco Venda (R$)': r.sale_price,
                  'Margem (R$)': r.margin,
                  Markup: r.markup,
                })),
                Ingredientes: filtered.flatMap((r) =>
                  (ingMap.get(r.id) || []).map((ing) => ({
                    Drink: r.product_name,
                    Casa: r.casa_name,
                    Insumo: ing.insumo?.name || '',
                    Quantidade: ing.quantity,
                    Unidade: ing.unit,
                    'Custo Ingrediente (R$)': ing.ingredient_cost,
                  }))
                ),
              });
            }}
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
          >
            <Download size={16} />
            Excel
          </button>
          <button
            onClick={() => { setShowNew(true); setNfName(''); setNfCasaId(''); setNfCategory(''); setNfPrice(''); }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-700 text-white rounded-lg hover:bg-blue-800 transition-colors text-sm font-medium"
          >
            <Plus size={16} />
            Nova Ficha
          </button>
          <CasaFilter selected={selectedCasa} onChange={setSelectedCasa} />
        </div>
      </div>

      {/* Modal Nova Ficha */}
      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowNew(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Nova Ficha Técnica</h2>
              <button onClick={() => setShowNew(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              Serve para drinks e doses (ex.: Dose Absolut). Depois de criar, você adiciona os insumos e as quantidades (ml/g).
            </p>
            <div className="space-y-3">
              <input type="text" value={nfName} onChange={(e) => setNfName(e.target.value)} placeholder="Nome (ex.: Caipirinha, Dose Absolut)" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600" />
              <div className="grid grid-cols-2 gap-2">
                <select value={nfCasaId} onChange={(e) => setNfCasaId(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
                  <option value="">Casa</option>
                  {casasList.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
                </select>
                <input type="text" value={nfCategory} onChange={(e) => setNfCategory(e.target.value)} placeholder="Categoria (ex.: Doses)" className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
              <input type="number" step="0.01" value={nfPrice} onChange={(e) => setNfPrice(e.target.value)} placeholder="Preço de venda (R$)" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowNew(false)} className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50">Cancelar</button>
              <button
                onClick={createFicha}
                disabled={creating || !nfName.trim() || !nfCasaId}
                className="flex-1 bg-blue-700 text-white px-4 py-2.5 rounded-lg font-medium hover:bg-blue-800 disabled:opacity-50"
              >
                {creating ? 'Criando…' : 'Criar e adicionar insumos'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <StatCard title="Receitas" value={stats.total} icon={<Wine size={18} />} color="purple" />
        <StatCard title="Custo Medio" value={formatCurrency(stats.avgCost)} icon={<DollarSign size={18} />} color="red" />
        <StatCard title="Markup Medio" value={`${formatNumber(stats.avgMarkup, 1)}x`} icon={<TrendingUp size={18} />} color="green" />
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Buscar por nome do drink..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white"
          />
        </div>
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
        >
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat === 'all' ? 'Todas as categorias' : cat}
            </option>
          ))}
        </select>
        <div className="flex border border-gray-300 rounded-lg overflow-hidden">
          <button
            onClick={() => setViewMode('list')}
            className={`px-3 py-2 text-sm ${viewMode === 'list' ? 'bg-blue-700 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
          >
            <List size={16} />
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={`px-3 py-2 text-sm ${viewMode === 'grid' ? 'bg-blue-700 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
          >
            <LayoutGrid size={16} />
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <ClipboardList className="mx-auto text-gray-300 mb-3" size={48} />
          <p className="text-gray-500 font-medium">Nenhuma ficha tecnica encontrada</p>
          <p className="text-gray-400 text-sm mt-1">Tente ajustar os filtros de busca</p>
        </div>
      ) : viewMode === 'list' ? (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  {([
                    { field: 'product_name' as SortField, label: 'Drink', align: 'left' },
                    { field: 'casa_name' as SortField, label: 'Casa', align: 'center' },
                    { field: 'category' as SortField, label: 'Categoria', align: 'center' },
                    { field: 'cost' as SortField, label: 'Custo', align: 'right' },
                    { field: 'sale_price' as SortField, label: 'Preco Venda', align: 'right' },
                    { field: 'markup' as SortField, label: 'Markup', align: 'center' },
                  ]).map((col) => (
                    <th
                      key={col.field}
                      onClick={() => handleSort(col.field)}
                      className={`px-4 py-3 font-semibold text-gray-600 cursor-pointer select-none hover:bg-gray-100 whitespace-nowrap ${
                        col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                      }`}
                    >
                      <span className={`inline-flex items-center gap-1 ${col.align === 'right' ? 'justify-end' : col.align === 'center' ? 'justify-center' : ''}`}>
                        {col.label}
                        <ArrowUpDown size={14} className={sortField === col.field ? 'text-blue-700' : 'text-gray-300'} />
                      </span>
                    </th>
                  ))}
                  <th className="px-4 py-3 font-semibold text-gray-600 text-right">Margem</th>
                  <th className="px-4 py-3 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((recipe) => (
                  <tr key={recipe.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      <Link href={`/fichas-tecnicas/${recipe.product_id}`} className="hover:text-blue-700 transition-colors">
                        {recipe.product_name}
                      </Link>
                      {!recipe.has_recipe && (
                        <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">sem ficha</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${casaBgColor(recipe.casa_name)}`}>
                        {recipe.casa_name}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-gray-600">{recipe.category}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{formatCurrency(recipe.cost)}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">{formatCurrency(recipe.sale_price)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded font-semibold text-xs ${
                        recipe.markup >= 5 ? 'text-emerald-700 bg-emerald-50' :
                        recipe.markup >= 3 ? 'text-amber-700 bg-amber-50' :
                        'text-red-700 bg-red-50'
                      }`}>
                        {formatNumber(recipe.markup, 1)}x
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">{formatCurrency(recipe.margin)}</td>
                    <td className="px-4 py-3 text-center">
                      <Link href={`/fichas-tecnicas/${recipe.product_id}`} className="text-blue-600 hover:text-blue-800">
                        <ClipboardList size={16} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 bg-gray-50 border-t text-xs text-gray-500">
            {filtered.length} receita{filtered.length !== 1 ? 's' : ''}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((recipe) => (
            <Link
              key={recipe.id}
              href={`/fichas-tecnicas/${recipe.product_id}`}
              className="group bg-white rounded-xl border border-gray-200 p-4 hover:shadow-lg hover:border-blue-300 transition-all"
            >
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-semibold text-gray-900 group-hover:text-blue-700 transition-colors line-clamp-2">
                  {recipe.product_name}
                </h3>
                <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ml-2 ${casaBgColor(recipe.casa_name)}`}>
                  {recipe.casa_name}
                </span>
              </div>
              <span className="inline-block text-xs px-2 py-1 rounded bg-gray-100 text-gray-600 mb-4">
                {recipe.category}
              </span>
              {!recipe.has_recipe && (
                <span className="inline-block ml-1.5 text-xs px-2 py-1 rounded bg-amber-100 text-amber-700 mb-4">sem ficha</span>
              )}
              <div className="space-y-2 pt-3 border-t border-gray-100">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Custo</span>
                  <span className="font-medium text-gray-900">{formatCurrency(recipe.cost)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Preco de Venda</span>
                  <span className="font-medium text-gray-900">{formatCurrency(recipe.sale_price)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Markup</span>
                  <span className={`font-semibold ${recipe.markup >= 3 ? 'text-emerald-600' : recipe.markup >= 2 ? 'text-amber-600' : 'text-red-600'}`}>
                    {formatNumber(recipe.markup, 1)}x
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
    </LoadingState>
  );
}
