'use client';

import { Fragment, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { formatDateTime } from '@/lib/format';
import { History, ChevronDown, ChevronRight, Filter, Search } from 'lucide-react';
import LoadingState from '@/components/LoadingState';

const TABLE_NAME_LABELS: Record<string, string> = {
  products: 'Produtos',
  insumos: 'Insumos',
  stock_items: 'Estoque',
  stock_movements: 'Movimentacoes',
  transfers: 'Transferencias',
  sales: 'Vendas',
  sale_imports: 'Importacoes',
  drink_recipes: 'Receitas',
  recipe_ingredients: 'Ingredientes',
  casas: 'Casas',
};

const ACTION_COLORS: Record<string, string> = {
  INSERT: 'bg-emerald-100 text-emerald-700',
  UPDATE: 'bg-blue-100 text-blue-700',
  DELETE: 'bg-red-100 text-red-700',
};

const PAGE_SIZE = 30;

interface AuditLogEntry {
  id: string;
  table_name: string;
  record_id: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  changed_by: string;
  changed_at: string;
  profile: { name: string; email: string } | null;
}

function getChangedFields(
  oldData: Record<string, unknown> | null,
  newData: Record<string, unknown> | null
): string[] {
  if (!oldData || !newData) return [];
  const allKeys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);
  const changed: string[] = [];
  for (const key of allKeys) {
    if (JSON.stringify(oldData[key]) !== JSON.stringify(newData[key])) {
      changed.push(key);
    }
  }
  return changed;
}

function getSummary(entry: AuditLogEntry): string {
  const tableLabel = TABLE_NAME_LABELS[entry.table_name] || entry.table_name;
  switch (entry.action) {
    case 'INSERT':
      return `Criou registro em ${tableLabel}`;
    case 'DELETE':
      return `Removeu registro de ${tableLabel}`;
    case 'UPDATE': {
      const changed = getChangedFields(entry.old_data, entry.new_data);
      if (changed.length === 0) return `Atualizou registro em ${tableLabel}`;
      if (changed.length <= 3) return `Alterou ${changed.join(', ')} em ${tableLabel}`;
      return `Alterou ${changed.length} campos em ${tableLabel}`;
    }
    default:
      return entry.action;
  }
}

function JsonDiffView({
  oldData,
  newData,
}: {
  oldData: Record<string, unknown> | null;
  newData: Record<string, unknown> | null;
}) {
  if (!oldData || !newData) return null;
  const allKeys = Array.from(new Set([...Object.keys(oldData), ...Object.keys(newData)]));
  const changedKeys = getChangedFields(oldData, newData);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs font-mono">
        <thead>
          <tr className="text-gray-500 border-b">
            <th className="px-3 py-2 text-left font-medium">Campo</th>
            <th className="px-3 py-2 text-left font-medium">Antes</th>
            <th className="px-3 py-2 text-left font-medium">Depois</th>
          </tr>
        </thead>
        <tbody>
          {allKeys.map((key) => {
            const isChanged = changedKeys.includes(key);
            return (
              <tr
                key={key}
                className={isChanged ? 'bg-yellow-50' : ''}
              >
                <td className={`px-3 py-1.5 font-semibold ${isChanged ? 'text-yellow-800' : 'text-gray-600'}`}>
                  {key}
                </td>
                <td className={`px-3 py-1.5 ${isChanged ? 'text-red-600 line-through' : 'text-gray-500'}`}>
                  {JSON.stringify(oldData[key] ?? null)}
                </td>
                <td className={`px-3 py-1.5 ${isChanged ? 'text-emerald-700 font-medium' : 'text-gray-500'}`}>
                  {JSON.stringify(newData[key] ?? null)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function FullDataView({ data }: { data: Record<string, unknown> | null }) {
  if (!data) return <p className="text-xs text-gray-400 italic">Sem dados</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs font-mono">
        <thead>
          <tr className="text-gray-500 border-b">
            <th className="px-3 py-2 text-left font-medium">Campo</th>
            <th className="px-3 py-2 text-left font-medium">Valor</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(data).map(([key, value]) => (
            <tr key={key}>
              <td className="px-3 py-1.5 font-semibold text-gray-600">{key}</td>
              <td className="px-3 py-1.5 text-gray-800">{JSON.stringify(value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function HistoricoPage() {
  const router = useRouter();
  const { isAdmin, loading: authLoading } = useAuth();

  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  // Filters
  const [tableNames, setTableNames] = useState<string[]>([]);
  const [filterTable, setFilterTable] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Redirect non-admins
  useEffect(() => {
    if (!authLoading && !isAdmin) {
      router.push('/dashboard');
    }
  }, [authLoading, isAdmin, router]);

  // Fetch distinct table names for the filter dropdown
  useEffect(() => {
    async function fetchTableNames() {
      const { data } = await supabase
        .from('audit_log')
        .select('table_name');
      if (data) {
        const unique = Array.from(new Set(data.map((r: any) => r.table_name))).sort();
        setTableNames(unique);
      }
    }
    fetchTableNames();
  }, []);

  const fetchEntries = useCallback(async () => {
    setLoading(true);

    let query = supabase
      .from('audit_log')
      .select('*, profile:profiles(name, email)', { count: 'exact' })
      .order('changed_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (filterTable) {
      query = query.eq('table_name', filterTable);
    }
    if (filterAction) {
      query = query.eq('action', filterAction);
    }
    if (searchQuery.trim()) {
      query = query.or(
        `old_data.cs.{"${searchQuery.trim()}"},new_data.cs.{"${searchQuery.trim()}"}`
      );
    }

    const { data, count } = await query;

    setEntries((data || []) as any as AuditLogEntry[]);
    setTotalCount(count || 0);
    setLoading(false);
  }, [page, filterTable, filterAction, searchQuery]);

  useEffect(() => {
    if (!authLoading && isAdmin) {
      fetchEntries();
    }
  }, [fetchEntries, authLoading, isAdmin]);

  // Reset page when filters change
  useEffect(() => {
    setPage(0);
  }, [filterTable, filterAction, searchQuery]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  if (authLoading || (!isAdmin && !authLoading)) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-700" />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <History size={20} className="text-blue-700" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Historico de Auditoria</h1>
            <p className="text-sm text-gray-500">Registro de todas as alteracoes no sistema</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Filter size={16} className="text-gray-500" />
          <span className="text-sm font-medium text-gray-700">Filtros</span>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <select
            value={filterTable}
            onChange={(e) => setFilterTable(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
          >
            <option value="">Todas as tabelas</option>
            {tableNames.map((name) => (
              <option key={name} value={name}>
                {TABLE_NAME_LABELS[name] || name}
              </option>
            ))}
          </select>

          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
          >
            <option value="">Todas as acoes</option>
            <option value="INSERT">INSERT</option>
            <option value="UPDATE">UPDATE</option>
            <option value="DELETE">DELETE</option>
          </select>

          <div className="relative flex-1">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar nos detalhes do registro..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-700" />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500 border-b bg-gray-50/50">
                    <th className="px-4 py-3 font-medium text-left w-8" />
                    <th className="px-4 py-3 font-medium text-left whitespace-nowrap">Data/Hora</th>
                    <th className="px-4 py-3 font-medium text-left">Usuario</th>
                    <th className="px-4 py-3 font-medium text-left">Tabela</th>
                    <th className="px-4 py-3 font-medium text-center">Acao</th>
                    <th className="px-4 py-3 font-medium text-left">Resumo</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => {
                    const isExpanded = expandedId === entry.id;
                    const profile = entry.profile as any;
                    return (
                      <Fragment key={entry.id}>
                        <tr
                          className="border-b border-gray-50 hover:bg-gray-50/50 cursor-pointer"
                          onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                        >
                          <td className="px-4 py-3 text-gray-400">
                            {isExpanded ? (
                              <ChevronDown size={16} />
                            ) : (
                              <ChevronRight size={16} />
                            )}
                          </td>
                          <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                            {formatDateTime(entry.changed_at)}
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-gray-900 font-medium">
                              {profile?.name || 'Desconhecido'}
                            </div>
                            <div className="text-xs text-gray-400">
                              {profile?.email || ''}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-gray-700">
                            {TABLE_NAME_LABELS[entry.table_name] || entry.table_name}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span
                              className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                                ACTION_COLORS[entry.action] || 'bg-gray-100 text-gray-700'
                              }`}
                            >
                              {entry.action}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-600">
                            {getSummary(entry)}
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="bg-gray-50/80">
                            <td colSpan={6} className="px-6 py-4">
                              <div className="bg-white rounded-lg border border-gray-200 p-4">
                                <div className="flex items-center gap-2 mb-3">
                                  <span className="text-xs font-medium text-gray-500">
                                    ID do Registro: {entry.record_id}
                                  </span>
                                </div>
                                {entry.action === 'UPDATE' ? (
                                  <JsonDiffView
                                    oldData={entry.old_data}
                                    newData={entry.new_data}
                                  />
                                ) : entry.action === 'INSERT' ? (
                                  <FullDataView data={entry.new_data} />
                                ) : (
                                  <FullDataView data={entry.old_data} />
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                  {entries.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-gray-500">
                        Nenhum registro encontrado
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalCount > 0 && (
              <div className="flex items-center justify-between px-4 py-3 bg-gray-50/50 border-t">
                <span className="text-sm text-gray-500">
                  Mostrando {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, totalCount)} de{' '}
                  {totalCount} registros
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="px-3 py-1.5 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Anterior
                  </button>
                  <button
                    onClick={() => setPage((p) => p + 1)}
                    disabled={page >= totalPages - 1}
                    className="px-3 py-1.5 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Proxima
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
