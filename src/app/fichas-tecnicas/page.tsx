'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { formatCurrency, formatNumber, casaBgColor } from '@/lib/format';
import CasaFilter from '@/components/CasaFilter';
import { ClipboardList, Search, Wine, DollarSign, TrendingUp } from 'lucide-react';

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
}

export default function FichasTecnicasPage() {
  const [recipes, setRecipes] = useState<DrinkRecipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCasa, setSelectedCasa] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [search, setSearch] = useState('');

  const fetchRecipes = useCallback(async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from('drink_recipes')
      .select(`
        id,
        product_id,
        product:products (
          id,
          name,
          category,
          sale_price,
          cost,
          markup,
          margin,
          casa:casas ( name )
        )
      `);

    if (error) {
      console.error('Error fetching recipes:', error);
      setLoading(false);
      return;
    }

    const mapped: DrinkRecipe[] = ((data || []) as unknown as Array<{
      id: string;
      product_id: string;
      product: {
        id: string;
        name: string;
        category: string;
        sale_price: number;
        cost: number;
        markup: number;
        margin: number;
        casa: { name: string } | null;
      } | null;
    }>)
      .filter((r) => r.product !== null)
      .map((r) => ({
        id: r.id,
        product_id: r.product_id,
        product_name: r.product!.name,
        category: r.product!.category || 'Sem categoria',
        casa_name: r.product!.casa?.name || 'Desconhecido',
        sale_price: Number(r.product!.sale_price) || 0,
        cost: Number(r.product!.cost) || 0,
        markup: Number(r.product!.markup) || 0,
        margin: Number(r.product!.margin) || 0,
      }));

    setRecipes(mapped);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchRecipes();
  }, [fetchRecipes]);

  const categories = useMemo(() => {
    const cats = new Set(recipes.map((r) => r.category));
    return ['all', ...Array.from(cats).sort()];
  }, [recipes]);

  const filtered = useMemo(() => {
    return recipes.filter((r) => {
      if (selectedCasa !== 'all' && r.casa_name !== selectedCasa) return false;
      if (selectedCategory !== 'all' && r.category !== selectedCategory) return false;
      if (search && !r.product_name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [recipes, selectedCasa, selectedCategory, search]);

  const stats = useMemo(() => {
    const total = filtered.length;
    const avgCost = total > 0 ? filtered.reduce((s, r) => s + r.cost, 0) / total : 0;
    const avgMarkup = total > 0
      ? filtered.filter((r) => r.markup > 0).reduce((s, r) => s + r.markup, 0) /
        (filtered.filter((r) => r.markup > 0).length || 1)
      : 0;
    return { total, avgCost, avgMarkup };
  }, [filtered]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <ClipboardList className="text-indigo-600" size={28} />
            Fichas Tecnicas
          </h1>
          <p className="text-sm text-gray-500">Receitas e custos detalhados dos drinks</p>
        </div>
        <CasaFilter selected={selectedCasa} onChange={setSelectedCasa} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4">
          <div className="p-3 rounded-lg bg-indigo-50 text-indigo-600">
            <Wine size={18} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Receitas</p>
            <p className="text-xl font-bold text-gray-900">{stats.total}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4">
          <div className="p-3 rounded-lg bg-red-50 text-red-600">
            <DollarSign size={18} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Custo Medio</p>
            <p className="text-xl font-bold text-gray-900">{formatCurrency(stats.avgCost)}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4">
          <div className="p-3 rounded-lg bg-emerald-50 text-emerald-600">
            <TrendingUp size={18} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Markup Medio</p>
            <p className="text-xl font-bold text-gray-900">{formatNumber(stats.avgMarkup, 1)}x</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Buscar por nome do drink..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
          />
        </div>
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
        >
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat === 'all' ? 'Todas as categorias' : cat}
            </option>
          ))}
        </select>
      </div>

      {/* Recipe Cards Grid */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <ClipboardList className="mx-auto text-gray-300 mb-3" size={48} />
          <p className="text-gray-500 text-lg font-medium">Nenhuma ficha tecnica encontrada</p>
          <p className="text-gray-400 text-sm mt-1">Tente ajustar os filtros de busca</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((recipe) => (
            <Link
              key={recipe.id}
              href={`/fichas-tecnicas/${recipe.id}`}
              className="group bg-white rounded-xl border border-gray-200 p-4 hover:shadow-lg hover:border-indigo-200 transition-all duration-200"
            >
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors line-clamp-2">
                  {recipe.product_name}
                </h3>
                <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ml-2 ${casaBgColor(recipe.casa_name)}`}>
                  {recipe.casa_name}
                </span>
              </div>

              <span className="inline-block text-xs px-2 py-1 rounded bg-gray-100 text-gray-600 mb-4">
                {recipe.category}
              </span>

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
  );
}
