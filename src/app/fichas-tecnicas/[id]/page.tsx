'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { formatCurrency, formatNumber, casaBgColor } from '@/lib/format';
import {
  ArrowLeft,
  ClipboardList,
  Wine,
  DollarSign,
  TrendingUp,
  Percent,
} from 'lucide-react';

interface Ingredient {
  id: string;
  insumo_name: string;
  quantity: number;
  unit: string;
  unit_cost: number;
  ingredient_cost: number;
}

interface RecipeDetail {
  id: string;
  product_name: string;
  category: string;
  casa_name: string;
  sale_price: number;
  cost: number;
  markup: number;
  margin: number;
  ingredients: Ingredient[];
}

export default function FichaTecnicaDetailPage() {
  const params = useParams();
  const recipeId = params.id as string;

  const [recipe, setRecipe] = useState<RecipeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRecipe = useCallback(async () => {
    setLoading(true);
    setError(null);

    // Fetch recipe with product info
    const { data: recipeData, error: recipeError } = await supabase
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
      `)
      .eq('id', recipeId)
      .single();

    if (recipeError || !recipeData) {
      setError('Ficha tecnica nao encontrada');
      setLoading(false);
      return;
    }

    const product = (recipeData as unknown as {
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
    }).product;

    if (!product) {
      setError('Produto associado nao encontrado');
      setLoading(false);
      return;
    }

    // Fetch ingredients
    const { data: ingredientsData, error: ingredientsError } = await supabase
      .from('recipe_ingredients')
      .select(`
        id,
        quantity,
        unit,
        ingredient_cost,
        insumo:insumos (
          id,
          name,
          unit_cost
        )
      `)
      .eq('recipe_id', recipeId)
      .order('id');

    if (ingredientsError) {
      console.error('Error fetching ingredients:', ingredientsError);
    }

    const ingredients: Ingredient[] = ((ingredientsData || []) as unknown as Array<{
      id: string;
      quantity: number;
      unit: string;
      ingredient_cost: number;
      insumo: { id: string; name: string; unit_cost: number } | null;
    }>).map((ing) => ({
      id: ing.id,
      insumo_name: ing.insumo?.name || 'Desconhecido',
      quantity: Number(ing.quantity) || 0,
      unit: ing.unit || '',
      unit_cost: Number(ing.insumo?.unit_cost) || 0,
      ingredient_cost: Number(ing.ingredient_cost) || 0,
    }));

    setRecipe({
      id: recipeData.id,
      product_name: product.name,
      category: product.category || 'Sem categoria',
      casa_name: product.casa?.name || 'Desconhecido',
      sale_price: Number(product.sale_price) || 0,
      cost: Number(product.cost) || 0,
      markup: Number(product.markup) || 0,
      margin: Number(product.margin) || 0,
      ingredients,
    });

    setLoading(false);
  }, [recipeId]);

  useEffect(() => {
    fetchRecipe();
  }, [fetchRecipe]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (error || !recipe) {
    return (
      <div className="text-center py-20">
        <ClipboardList className="mx-auto text-gray-300 mb-4" size={48} />
        <p className="text-gray-500 text-lg font-medium">{error || 'Erro ao carregar ficha tecnica'}</p>
        <Link
          href="/fichas-tecnicas"
          className="inline-flex items-center gap-2 mt-4 text-indigo-600 hover:text-indigo-800 font-medium"
        >
          <ArrowLeft size={16} />
          Voltar para lista
        </Link>
      </div>
    );
  }

  const totalIngredientCost = recipe.ingredients.reduce((sum, ing) => sum + ing.ingredient_cost, 0);

  return (
    <div className="max-w-4xl mx-auto">
      {/* Back button */}
      <Link
        href="/fichas-tecnicas"
        className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-900 mb-6 transition-colors text-sm font-medium"
      >
        <ArrowLeft size={16} />
        Voltar para Fichas Tecnicas
      </Link>

      {/* Header Card */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
                <Wine size={24} />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{recipe.product_name}</h1>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${casaBgColor(recipe.casa_name)}`}>
                    {recipe.casa_name}
                  </span>
                  <span className="text-xs px-2.5 py-0.5 rounded bg-gray-100 text-gray-600">
                    {recipe.category}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-gray-100">
          <div className="text-center p-3 rounded-lg bg-red-50">
            <DollarSign className="mx-auto text-red-500 mb-1" size={20} />
            <p className="text-xs text-red-600 font-medium">Custo Total</p>
            <p className="text-lg font-bold text-red-700">{formatCurrency(recipe.cost)}</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-emerald-50">
            <DollarSign className="mx-auto text-emerald-500 mb-1" size={20} />
            <p className="text-xs text-emerald-600 font-medium">Preco de Venda</p>
            <p className="text-lg font-bold text-emerald-700">{formatCurrency(recipe.sale_price)}</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-blue-50">
            <TrendingUp className="mx-auto text-blue-500 mb-1" size={20} />
            <p className="text-xs text-blue-600 font-medium">Markup</p>
            <p className={`text-lg font-bold ${recipe.markup >= 3 ? 'text-emerald-700' : recipe.markup >= 2 ? 'text-blue-700' : 'text-red-700'}`}>
              {formatNumber(recipe.markup, 2)}x
            </p>
          </div>
          <div className="text-center p-3 rounded-lg bg-purple-50">
            <Percent className="mx-auto text-purple-500 mb-1" size={20} />
            <p className="text-xs text-purple-600 font-medium">Margem</p>
            <p className="text-lg font-bold text-purple-700">{formatNumber(recipe.margin, 1)}%</p>
          </div>
        </div>
      </div>

      {/* Ingredients Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <ClipboardList size={18} className="text-indigo-600" />
            Ingredientes
          </h2>
        </div>

        {recipe.ingredients.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-500">Nenhum ingrediente cadastrado para esta receita</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 bg-gray-50 border-b border-gray-200">
                  <th className="px-6 py-3 font-medium">Insumo</th>
                  <th className="px-6 py-3 font-medium text-right">Quantidade</th>
                  <th className="px-6 py-3 font-medium text-center">Unidade</th>
                  <th className="px-6 py-3 font-medium text-right">Custo Unitario</th>
                  <th className="px-6 py-3 font-medium text-right">Custo do Ingrediente</th>
                </tr>
              </thead>
              <tbody>
                {recipe.ingredients.map((ing, index) => (
                  <tr
                    key={ing.id}
                    className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                      index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                    }`}
                  >
                    <td className="px-6 py-3.5 font-medium text-gray-900">{ing.insumo_name}</td>
                    <td className="px-6 py-3.5 text-right text-gray-700">{formatNumber(ing.quantity, 2)}</td>
                    <td className="px-6 py-3.5 text-center">
                      <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                        {ing.unit}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-right text-gray-700">{formatCurrency(ing.unit_cost)}</td>
                    <td className="px-6 py-3.5 text-right font-medium text-gray-900">{formatCurrency(ing.ingredient_cost)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-indigo-50 border-t-2 border-indigo-200">
                  <td colSpan={4} className="px-6 py-3.5 text-right font-semibold text-indigo-900">
                    Custo Total dos Ingredientes
                  </td>
                  <td className="px-6 py-3.5 text-right font-bold text-indigo-900 text-base">
                    {formatCurrency(totalIngredientCost)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Cost Breakdown */}
      {recipe.ingredients.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mt-6">
          <h3 className="font-semibold text-gray-900 mb-4">Composicao de Custo</h3>
          <div className="space-y-3">
            {recipe.ingredients.map((ing) => {
              const percentage = totalIngredientCost > 0
                ? (ing.ingredient_cost / totalIngredientCost) * 100
                : 0;
              return (
                <div key={ing.id}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-gray-700">{ing.insumo_name}</span>
                    <span className="text-gray-900 font-medium">
                      {formatNumber(percentage, 1)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div
                      className="h-2 rounded-full bg-indigo-500 transition-all duration-300"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
