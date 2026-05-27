'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { formatCurrency, formatNumber } from '@/lib/format';
import StatCard from '@/components/StatCard';
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  ShoppingBasket,
  X,
  DollarSign,
} from 'lucide-react';

interface Insumo {
  id: string;
  code: string;
  name: string;
  unit: string;
  package_qty: number;
  package_price: number;
  unit_cost: number;
  minimum: number;
  created_at: string;
}

interface InsumoForm {
  code: string;
  name: string;
  unit: string;
  package_qty: string;
  package_price: string;
  minimum: string;
}

const emptyForm: InsumoForm = {
  code: '',
  name: '',
  unit: 'ml',
  package_qty: '',
  package_price: '',
  minimum: '0',
};

export default function InsumosPage() {
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<InsumoForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const fetchInsumos = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('insumos')
      .select('*')
      .order('name', { ascending: true });

    if (!error && data) {
      setInsumos(
        data.map((i: Record<string, unknown>) => ({
          ...i,
          minimum: Number(i.minimum) || 0,
        })) as Insumo[]
      );
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchInsumos();
  }, [fetchInsumos]);

  const filteredInsumos = insumos.filter((insumo) =>
    insumo.name.toLowerCase().includes(search.toLowerCase()) ||
    insumo.code.toLowerCase().includes(search.toLowerCase())
  );

  const totalInsumos = insumos.length;
  const avgUnitCost =
    insumos.length > 0
      ? insumos.reduce((sum, i) => sum + Number(i.unit_cost), 0) / insumos.length
      : 0;

  const computedUnitCost =
    Number(form.package_qty) > 0
      ? Number(form.package_price) / Number(form.package_qty)
      : 0;

  const generateCode = async (): Promise<string> => {
    const { data } = await supabase
      .from('insumos')
      .select('code')
      .like('code', 'INS%')
      .order('code', { ascending: false })
      .limit(1);

    if (data && data.length > 0) {
      const lastNum = parseInt(data[0].code.replace('INS', ''), 10) || 0;
      return `INS${String(lastNum + 1).padStart(3, '0')}`;
    }
    return 'INS001';
  };

  const openAddModal = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEditModal = (insumo: Insumo) => {
    setEditingId(insumo.id);
    setForm({
      code: insumo.code,
      name: insumo.name,
      unit: insumo.unit,
      package_qty: String(insumo.package_qty),
      package_price: String(insumo.package_price),
      minimum: String(insumo.minimum),
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.package_qty || !form.package_price) return;

    setSaving(true);

    const packageQty = Number(form.package_qty);
    const packagePrice = Number(form.package_price);
    const unitCost = packageQty > 0 ? packagePrice / packageQty : 0;

    let code = form.code.trim();
    if (!code) {
      code = await generateCode();
    }

    const payload = {
      code,
      name: form.name.trim(),
      unit: form.unit,
      package_qty: packageQty,
      package_price: packagePrice,
      unit_cost: unitCost,
      minimum: Number(form.minimum) || 0,
    };

    if (editingId) {
      await supabase.from('insumos').update(payload).eq('id', editingId);
    } else {
      await supabase.from('insumos').insert(payload);
    }

    setSaving(false);
    closeModal();
    fetchInsumos();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('insumos').delete().eq('id', id);
    setDeleteConfirm(null);
    fetchInsumos();
  };

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Insumos</h1>
          <p className="text-sm text-gray-500">Gerenciamento de ingredientes e suprimentos</p>
        </div>
        <button
          onClick={openAddModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
        >
          <Plus size={18} />
          Novo Insumo
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
        <StatCard
          title="Total de Insumos"
          value={formatNumber(totalInsumos)}
          subtitle="cadastrados"
          icon={<ShoppingBasket size={18} />}
          color="purple"
        />
        <StatCard
          title="Custo Medio por Unidade"
          value={formatCurrency(avgUnitCost)}
          subtitle="media de todos os insumos"
          icon={<DollarSign size={18} />}
          color="green"
        />
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nome ou codigo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <p className="text-sm text-gray-500">
            {filteredInsumos.length} de {insumos.length} insumos
          </p>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="pb-3 font-medium">Codigo</th>
                <th className="pb-3 font-medium">Nome</th>
                <th className="pb-3 font-medium">Unidade</th>
                <th className="pb-3 font-medium text-right">Qtd Embalagem</th>
                <th className="pb-3 font-medium text-right">Preco Embalagem (R$)</th>
                <th className="pb-3 font-medium text-right">Custo por ml/un (R$)</th>
                <th className="pb-3 font-medium text-center">Qtd Minima</th>
                <th className="pb-3 font-medium text-right">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {filteredInsumos.map((insumo) => (
                <tr
                  key={insumo.id}
                  className="border-b border-gray-50 hover:bg-gray-50 transition-colors"
                >
                  <td className="py-3">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-md bg-gray-100 text-gray-700 text-xs font-mono font-medium">
                      {insumo.code}
                    </span>
                  </td>
                  <td className="py-3 font-medium text-gray-900">{insumo.name}</td>
                  <td className="py-3 text-gray-600">{insumo.unit}</td>
                  <td className="py-3 text-right text-gray-600">
                    {formatNumber(insumo.package_qty)}
                  </td>
                  <td className="py-3 text-right text-gray-600">
                    {formatCurrency(insumo.package_price)}
                  </td>
                  <td className="py-3 text-right font-medium text-gray-900">
                    {formatCurrency(insumo.unit_cost)}
                  </td>
                  <td className="py-3 text-center text-gray-600">
                    {formatNumber(insumo.minimum)}
                  </td>
                  <td className="py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEditModal(insumo)}
                        className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="Editar"
                      >
                        <Pencil size={16} />
                      </button>
                      {deleteConfirm === insumo.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleDelete(insumo.id)}
                            className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                          >
                            Confirmar
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(null)}
                            className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirm(insumo.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Excluir"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredInsumos.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-gray-500">
                    {search
                      ? 'Nenhum insumo encontrado com esse termo'
                      : 'Nenhum insumo cadastrado'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={closeModal} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingId ? 'Editar Insumo' : 'Novo Insumo'}
              </h2>
              <button
                onClick={closeModal}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Code */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Codigo
                </label>
                <input
                  type="text"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  placeholder="Auto-gerado se vazio (ex: INS001)"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Nome do insumo"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              {/* Unit */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Unidade
                </label>
                <select
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
                >
                  <option value="ml">ml</option>
                  <option value="L">L</option>
                  <option value="g">g</option>
                  <option value="kg">kg</option>
                  <option value="un">un</option>
                </select>
              </div>

              {/* Package Qty and Price */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Qtd Embalagem <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={form.package_qty}
                    onChange={(e) => setForm({ ...form, package_qty: e.target.value })}
                    placeholder="0"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Preco Embalagem (R$) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={form.package_price}
                    onChange={(e) => setForm({ ...form, package_price: e.target.value })}
                    placeholder="0.00"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Minimum */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Quantidade Minima
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={form.minimum}
                  onChange={(e) => setForm({ ...form, minimum: e.target.value })}
                  placeholder="0"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              {/* Calculated Unit Cost */}
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Custo por {form.unit}:</span>
                  <span className="text-lg font-semibold text-gray-900">
                    {formatCurrency(computedUnitCost)}
                  </span>
                </div>
                {Number(form.package_qty) > 0 && (
                  <p className="text-xs text-gray-400 mt-1">
                    {formatCurrency(Number(form.package_price))} / {formatNumber(Number(form.package_qty), 2)} {form.unit}
                  </p>
                )}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
              <button
                onClick={closeModal}
                className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.name.trim() || !form.package_qty || !form.package_price}
                className="px-4 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Salvando...' : editingId ? 'Salvar Alteracoes' : 'Adicionar Insumo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
