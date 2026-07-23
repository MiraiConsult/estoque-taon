'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { formatCurrency, formatNumber, casaBgColor } from '@/lib/format';
import LoadingState from '@/components/LoadingState';
import {
  ArrowLeft,
  ClipboardList,
  Wine,
  DollarSign,
  TrendingUp,
  Percent,
  Pencil,
  Trash2,
  Plus,
  Save,
  X,
} from 'lucide-react';

interface Ingredient {
  id: string;
  insumo_id: string;
  insumo_name: string;
  quantity: number;
  unit: string;
  unit_cost: number;
  ingredient_cost: number;
}

interface InsumoOption {
  id: string;
  name: string;
  unit: string;
  unit_cost: number;
}

interface RecipeDetail {
  id: string | null; // null = produto ainda sem ficha técnica
  product_id: string;
  product_name: string;
  category: string;
  casa_name: string;
  sale_price: number;
  cost: number;
  markup: number;
  margin: number;
  ingredients: Ingredient[];
}

function EditableTitle({ productId, value, onSaved }: { productId: string; value: string; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(value);

  if (!editing) {
    return (
      <button
        onClick={() => { setV(value); setEditing(true); }}
        className="text-2xl font-bold text-gray-900 hover:text-blue-700 transition-colors text-left"
        title="Clique para editar"
      >
        {value}
      </button>
    );
  }

  const save = async () => {
    if (v.trim() && v !== value) {
      await supabase.from('products').update({ name: v.trim() }).eq('id', productId);
      onSaved();
    }
    setEditing(false);
  };

  return (
    <input
      type="text"
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
      autoFocus
      className="text-2xl font-bold text-gray-900 border-b-2 border-blue-600 outline-none w-full"
    />
  );
}

export default function FichaTecnicaDetailPage() {
  const params = useParams();
  const router = useRouter();
  // A rota agora é identificada pelo ID do PRODUTO (não da receita),
  // para funcionar também com produtos que ainda não têm ficha técnica.
  const productId = params.id as string;

  const [recipe, setRecipe] = useState<RecipeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit ingredient state
  const [editingIngredientId, setEditingIngredientId] = useState<string | null>(null);
  const [editQuantity, setEditQuantity] = useState<string>('');

  // Add ingredient state
  const [showAddForm, setShowAddForm] = useState(false);
  const [insumos, setInsumos] = useState<InsumoOption[]>([]);
  const [newInsumoId, setNewInsumoId] = useState('');
  const [newQuantity, setNewQuantity] = useState('');

  // Edit sale price state
  const [editingSalePrice, setEditingSalePrice] = useState(false);
  const [editSalePrice, setEditSalePrice] = useState<string>('');

  // Saving state
  const [saving, setSaving] = useState(false);

  const fetchRecipe = useCallback(async () => {
    setLoading(true);
    setError(null);

    // 1) Produto (sempre existe, mesmo sem ficha)
    const { data: productData, error: productError } = await supabase
      .from('products')
      .select(`id, name, category, sale_price, cost, markup, margin, casa:casas ( name )`)
      .eq('id', productId)
      .single();

    if (productError || !productData) {
      setError('Produto nao encontrado');
      setLoading(false);
      return;
    }

    const product = productData as unknown as {
      id: string;
      name: string;
      category: string;
      sale_price: number;
      cost: number;
      markup: number;
      margin: number;
      casa: { name: string } | null;
    };

    // 2) Receita associada a este produto (pode não existir ainda)
    const { data: recipeRow } = await supabase
      .from('drink_recipes')
      .select('id')
      .eq('product_id', productId)
      .maybeSingle();

    const recipeRowId = recipeRow?.id ?? null;

    // 3) Ingredientes (só se houver receita)
    let ingredients: Ingredient[] = [];
    if (recipeRowId) {
      const { data: ingredientsData, error: ingredientsError } = await supabase
        .from('recipe_ingredients')
        .select(`
          id,
          insumo_id,
          quantity,
          unit,
          ingredient_cost,
          insumo:insumos (
            id,
            name,
            unit_cost
          )
        `)
        .eq('recipe_id', recipeRowId)
        .order('id');

      if (ingredientsError) {
        console.error('Error fetching ingredients:', ingredientsError);
      }

      ingredients = ((ingredientsData || []) as unknown as Array<{
        id: string;
        insumo_id: string;
        quantity: number;
        unit: string;
        ingredient_cost: number;
        insumo: { id: string; name: string; unit_cost: number } | null;
      }>).map((ing) => ({
        id: ing.id,
        insumo_id: ing.insumo_id,
        insumo_name: ing.insumo?.name || 'Desconhecido',
        quantity: Number(ing.quantity) || 0,
        unit: ing.unit || '',
        unit_cost: Number(ing.insumo?.unit_cost) || 0,
        ingredient_cost: Number(ing.ingredient_cost) || 0,
      }));
    }

    setRecipe({
      id: recipeRowId,
      product_id: product.id,
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
  }, [productId]);

  // Cria a ficha técnica (drink_recipe) para um produto que ainda não tem.
  const createRecipe = async () => {
    setSaving(true);
    await supabase.from('drink_recipes').insert({ product_id: productId });
    setSaving(false);
    await fetchRecipe();
  };

  // Exclui o drink (produto) e volta para a lista.
  const deleteDrink = async () => {
    if (!window.confirm('Excluir este drink e sua ficha técnica? Esta ação não pode ser desfeita.')) return;
    setSaving(true);
    try {
      await supabase.from('sales').delete().eq('product_id', productId);
      await supabase.from('stock_movements').delete().eq('product_id', productId);
      await supabase.from('transfers').delete().eq('product_id', productId);
      await supabase.from('stock_items').delete().eq('product_id', productId);
      await supabase.from('event_reconciliation').delete().eq('product_id', productId);
      await supabase.from('product_components').delete().eq('component_product_id', productId);
      const { error } = await supabase.from('products').delete().eq('id', productId);
      if (error) throw new Error(error.message);
      router.push('/fichas-tecnicas');
    } catch (err) {
      alert('Erro ao excluir: ' + (err instanceof Error ? err.message : String(err)));
      setSaving(false);
    }
  };

  const fetchInsumos = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('insumos')
      .select('id, name, unit, unit_cost')
      .order('name');

    if (!err && data) {
      setInsumos(data as InsumoOption[]);
    }
  }, []);

  useEffect(() => {
    fetchRecipe();
  }, [fetchRecipe]);

  const recalculateProductTotals = async (productId: string, salePrice: number) => {
    // Sum all ingredient costs for all recipes of this product
    const { data: recipes } = await supabase
      .from('drink_recipes')
      .select('id')
      .eq('product_id', productId);

    if (!recipes || recipes.length === 0) return;

    const recipeIds = recipes.map((r: { id: string }) => r.id);

    const { data: allIngredients } = await supabase
      .from('recipe_ingredients')
      .select('ingredient_cost')
      .in('recipe_id', recipeIds);

    const totalCost = (allIngredients || []).reduce(
      (sum: number, ing: { ingredient_cost: number }) => sum + Number(ing.ingredient_cost),
      0
    );

    const markup = totalCost > 0 ? salePrice / totalCost : 0;
    const margin = salePrice - totalCost;

    await supabase
      .from('products')
      .update({ cost: totalCost, markup, margin })
      .eq('id', productId);
  };

  // Edit ingredient quantity
  const handleEditIngredient = (ing: Ingredient) => {
    setEditingIngredientId(ing.id);
    setEditQuantity(String(ing.quantity));
  };

  const handleCancelEditIngredient = () => {
    setEditingIngredientId(null);
    setEditQuantity('');
  };

  const handleSaveIngredientQuantity = async (ing: Ingredient) => {
    if (!recipe) return;
    const qty = parseFloat(editQuantity);
    if (isNaN(qty) || qty <= 0) return;

    setSaving(true);
    const ingredientCost = qty * ing.unit_cost;

    await supabase
      .from('recipe_ingredients')
      .update({ quantity: qty, ingredient_cost: ingredientCost })
      .eq('id', ing.id);

    await recalculateProductTotals(recipe.product_id, recipe.sale_price);

    setEditingIngredientId(null);
    setEditQuantity('');
    setSaving(false);
    await fetchRecipe();
  };

  // Remove ingredient
  const handleRemoveIngredient = async (ing: Ingredient) => {
    if (!recipe) return;
    const confirmed = window.confirm(
      `Remover "${ing.insumo_name}" da receita?`
    );
    if (!confirmed) return;

    setSaving(true);

    await supabase
      .from('recipe_ingredients')
      .delete()
      .eq('id', ing.id);

    await recalculateProductTotals(recipe.product_id, recipe.sale_price);

    setSaving(false);
    await fetchRecipe();
  };

  // Add ingredient
  const handleOpenAddForm = () => {
    fetchInsumos();
    setShowAddForm(true);
    setNewInsumoId('');
    setNewQuantity('');
  };

  const handleCancelAdd = () => {
    setShowAddForm(false);
    setNewInsumoId('');
    setNewQuantity('');
  };

  const selectedInsumo = insumos.find((i) => i.id === newInsumoId);
  const newIngredientCost =
    selectedInsumo && newQuantity
      ? parseFloat(newQuantity) * selectedInsumo.unit_cost
      : 0;

  const handleSaveNewIngredient = async () => {
    if (!recipe || !recipe.id || !selectedInsumo) return;
    const qty = parseFloat(newQuantity);
    if (isNaN(qty) || qty <= 0) return;

    setSaving(true);
    const ingredientCost = qty * selectedInsumo.unit_cost;

    await supabase.from('recipe_ingredients').insert({
      recipe_id: recipe.id,
      insumo_id: selectedInsumo.id,
      quantity: qty,
      unit: selectedInsumo.unit,
      ingredient_cost: ingredientCost,
    });

    await recalculateProductTotals(recipe.product_id, recipe.sale_price);

    setShowAddForm(false);
    setNewInsumoId('');
    setNewQuantity('');
    setSaving(false);
    await fetchRecipe();
  };

  // Edit sale price
  const handleEditSalePrice = () => {
    if (!recipe) return;
    setEditingSalePrice(true);
    setEditSalePrice(String(recipe.sale_price));
  };

  const handleCancelEditSalePrice = () => {
    setEditingSalePrice(false);
    setEditSalePrice('');
  };

  const handleSaveSalePrice = async () => {
    if (!recipe) return;
    const price = parseFloat(editSalePrice);
    if (isNaN(price) || price < 0) return;

    setSaving(true);

    const markup = recipe.cost > 0 ? price / recipe.cost : 0;
    const margin = price - recipe.cost;

    await supabase
      .from('products')
      .update({ sale_price: price, markup, margin })
      .eq('id', recipe.product_id);

    setEditingSalePrice(false);
    setEditSalePrice('');
    setSaving(false);
    await fetchRecipe();
  };

  const totalIngredientCost = recipe ? recipe.ingredients.reduce((sum, ing) => sum + ing.ingredient_cost, 0) : 0;

  return (
    <LoadingState loading={loading}>
    <div className="max-w-4xl mx-auto">
      {error || !recipe ? (
        <div className="text-center py-20">
          <ClipboardList className="mx-auto text-gray-300 mb-4" size={48} />
          <p className="text-gray-500 text-lg font-medium">{error || 'Erro ao carregar ficha tecnica'}</p>
          <Link
            href="/fichas-tecnicas"
            className="inline-flex items-center gap-2 mt-4 text-blue-700 hover:text-blue-900 font-medium"
          >
            <ArrowLeft size={16} />
            Voltar para lista
          </Link>
        </div>
      ) : (<>
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
              <div className="p-2 rounded-lg bg-blue-50 text-blue-700">
                <Wine size={24} />
              </div>
              <div>
                <EditableTitle
                  productId={recipe.product_id}
                  value={recipe.product_name}
                  onSaved={fetchRecipe}
                />
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
          <button
            onClick={deleteDrink}
            disabled={saving}
            className="inline-flex items-center gap-1.5 text-sm text-red-600 hover:bg-red-50 px-3 py-2 rounded-lg self-start disabled:opacity-50"
            title="Excluir este drink"
          >
            <Trash2 size={15} /> Excluir
          </button>
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
            {editingSalePrice ? (
              <div className="flex items-center justify-center gap-1 mt-1">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editSalePrice}
                  onChange={(e) => setEditSalePrice(e.target.value)}
                  className="w-24 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveSalePrice();
                    if (e.key === 'Escape') handleCancelEditSalePrice();
                  }}
                />
                <button
                  onClick={handleSaveSalePrice}
                  disabled={saving}
                  className="p-1 text-emerald-600 hover:text-emerald-800"
                  title="Salvar"
                >
                  <Save size={14} />
                </button>
                <button
                  onClick={handleCancelEditSalePrice}
                  className="p-1 text-gray-400 hover:text-gray-600"
                  title="Cancelar"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <p
                className="text-lg font-bold text-emerald-700 cursor-pointer hover:underline inline-flex items-center gap-1 justify-center"
                onClick={handleEditSalePrice}
                title="Clique para editar"
              >
                {formatCurrency(recipe.sale_price)}
                <Pencil size={12} className="text-emerald-400" />
              </p>
            )}
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
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <ClipboardList size={18} className="text-blue-700" />
            Ingredientes
          </h2>
          {recipe.id && (
            <button
              onClick={handleOpenAddForm}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors"
            >
              <Plus size={16} />
              Adicionar
            </button>
          )}
        </div>

        {/* Add ingredient form */}
        {showAddForm && (
          <div className="px-6 py-4 border-b border-gray-200 bg-blue-50/50">
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
              <div className="sm:col-span-4">
                <label className="block text-xs font-medium text-gray-600 mb-1">Insumo</label>
                <select
                  value={newInsumoId}
                  onChange={(e) => setNewInsumoId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  <option value="">Selecione um insumo...</option>
                  {insumos.map((insumo) => (
                    <option key={insumo.id} value={insumo.id}>
                      {insumo.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Quantidade</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={newQuantity}
                  onChange={(e) => setNewQuantity(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Unidade</label>
                <input
                  type="text"
                  value={selectedInsumo?.unit || ''}
                  readOnly
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-100 text-gray-500"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Custo</label>
                <input
                  type="text"
                  value={newIngredientCost > 0 ? formatCurrency(newIngredientCost) : '-'}
                  readOnly
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-100 text-gray-500"
                />
              </div>
              <div className="sm:col-span-2 flex gap-2">
                <button
                  onClick={handleSaveNewIngredient}
                  disabled={saving || !selectedInsumo || !newQuantity || parseFloat(newQuantity) <= 0}
                  className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed rounded-lg transition-colors"
                >
                  <Save size={14} />
                  Salvar
                </button>
                <button
                  onClick={handleCancelAdd}
                  className="inline-flex items-center justify-center px-3 py-2 text-sm font-medium text-gray-600 bg-white hover:bg-gray-50 border border-gray-300 rounded-lg transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          </div>
        )}

        {!recipe.id ? (
          <div className="p-12 text-center">
            <ClipboardList className="mx-auto text-gray-300 mb-3" size={40} />
            <p className="text-gray-600 font-medium">Este produto ainda não tem ficha técnica</p>
            <p className="text-gray-400 text-sm mt-1 mb-4">
              Crie a ficha para cadastrar os ingredientes e calcular o custo automaticamente.
            </p>
            <button
              onClick={createRecipe}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-50 rounded-lg transition-colors"
            >
              <Plus size={16} />
              {saving ? 'Criando...' : 'Criar ficha técnica'}
            </button>
          </div>
        ) : recipe.ingredients.length === 0 && !showAddForm ? (
          <div className="p-12 text-center">
            <p className="text-gray-500">Nenhum ingrediente cadastrado para esta receita</p>
          </div>
        ) : recipe.ingredients.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 bg-gray-50 border-b border-gray-200">
                  <th className="px-6 py-3 font-medium">Insumo</th>
                  <th className="px-6 py-3 font-medium text-right">Quantidade</th>
                  <th className="px-6 py-3 font-medium text-center">Unidade</th>
                  <th className="px-6 py-3 font-medium text-right">Custo Unitario</th>
                  <th className="px-6 py-3 font-medium text-right">Custo do Ingrediente</th>
                  <th className="px-6 py-3 font-medium text-center w-24">Acoes</th>
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
                    <td className="px-6 py-3.5 text-right text-gray-700">
                      {editingIngredientId === ing.id ? (
                        <div className="flex items-center justify-end gap-1">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={editQuantity}
                            onChange={(e) => setEditQuantity(e.target.value)}
                            className="w-24 px-2 py-1 text-sm text-right border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-600"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveIngredientQuantity(ing);
                              if (e.key === 'Escape') handleCancelEditIngredient();
                            }}
                          />
                          <button
                            onClick={() => handleSaveIngredientQuantity(ing)}
                            disabled={saving}
                            className="p-1 text-emerald-600 hover:text-emerald-800"
                            title="Salvar"
                          >
                            <Save size={14} />
                          </button>
                          <button
                            onClick={handleCancelEditIngredient}
                            className="p-1 text-gray-400 hover:text-gray-600"
                            title="Cancelar"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        formatNumber(ing.quantity, 2)
                      )}
                    </td>
                    <td className="px-6 py-3.5 text-center">
                      <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                        {ing.unit}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-right text-gray-700">{formatCurrency(ing.unit_cost)}</td>
                    <td className="px-6 py-3.5 text-right font-medium text-gray-900">{formatCurrency(ing.ingredient_cost)}</td>
                    <td className="px-6 py-3.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleEditIngredient(ing)}
                          disabled={editingIngredientId !== null}
                          className="p-1.5 text-gray-400 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Editar quantidade"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => handleRemoveIngredient(ing)}
                          disabled={saving}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Remover ingrediente"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-blue-50 border-t-2 border-blue-300">
                  <td colSpan={4} className="px-6 py-3.5 text-right font-semibold text-blue-950">
                    Custo Total dos Ingredientes
                  </td>
                  <td className="px-6 py-3.5 text-right font-bold text-blue-950 text-base">
                    {formatCurrency(totalIngredientCost)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        ) : null}
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
                      className="h-2 rounded-full bg-blue-600 transition-all duration-300"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      </>)}
    </div>
    </LoadingState>
  );
}
