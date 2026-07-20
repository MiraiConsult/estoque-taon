'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { formatNumber, formatDateTime, casaBgColor } from '@/lib/format';
import LoadingState from '@/components/LoadingState';
import {
  ClipboardCheck,
  ArrowLeft,
  Check,
  X,
  AlertTriangle,
  Printer,
  CheckCircle2,
  Lock,
} from 'lucide-react';

interface EventRow {
  id: string;
  casa_name: string;
  event_date: string;
  event_name: string | null;
  file_name: string;
  created_at: string;
  reconciled_at: string | null;
  total: number;
}

interface ReconRow {
  id: string;
  product_id: string;
  product_name: string;
  category: string;
  stock_before: number;
  sold: number;
  stock_expected: number;
  stock_counted: number | null;
  status: string; // pendente | ok | ajustado
  obs: string | null;
  is_approx: boolean;
  // estado local de edição
  countInput: string;
  obsInput: string;
  saving: boolean;
}

export default function ProvaRealPage() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<EventRow | null>(null);
  const [rows, setRows] = useState<ReconRow[]>([]);
  const [loadingRows, setLoadingRows] = useState(false);
  const [showReport, setShowReport] = useState(false);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await supabase
        .from('sale_imports')
        .select('*, casa:casas(name), recon:event_reconciliation(count)')
        .order('created_at', { ascending: false })
        .limit(100);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mapped: EventRow[] = ((data as any[]) || [])
        .map((d) => ({
          id: d.id,
          casa_name: d.casa?.name || '',
          event_date: d.event_date,
          event_name: d.event_name,
          file_name: d.file_name,
          created_at: d.created_at,
          reconciled_at: d.reconciled_at,
          total: d.recon?.[0]?.count ?? 0,
        }))
        .filter((e) => e.total > 0);
      setEvents(mapped);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const openEvent = async (ev: EventRow) => {
    setSelected(ev);
    setShowReport(false);
    setLoadingRows(true);
    const { data } = await supabase
      .from('event_reconciliation')
      .select('*, product:products(name, category)')
      .eq('import_id', ev.id);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mapped: ReconRow[] = ((data as any[]) || [])
      .map((r) => ({
        id: r.id,
        product_id: r.product_id,
        product_name: r.product?.name || '—',
        category: r.product?.category || '',
        stock_before: Number(r.stock_before),
        sold: Number(r.sold),
        stock_expected: Number(r.stock_expected),
        stock_counted: r.stock_counted === null ? null : Number(r.stock_counted),
        status: r.status,
        obs: r.obs,
        is_approx: r.is_approx,
        countInput: r.stock_counted === null ? '' : String(Number(r.stock_counted)),
        obsInput: r.obs || '',
        saving: false,
      }))
      .sort((a, b) => b.sold - a.sold || a.product_name.localeCompare(b.product_name));
    setRows(mapped);
    setLoadingRows(false);
  };

  const setRow = (id: string, patch: Partial<ReconRow>) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  // Confirma que a contagem bate com o previsto (✓), sem mexer no estoque.
  const confirmOk = async (row: ReconRow) => {
    setRow(row.id, { saving: true });
    const counted = row.stock_expected;
    await supabase
      .from('event_reconciliation')
      .update({ stock_counted: counted, status: 'ok', obs: row.obsInput || null, checked_at: new Date().toISOString() })
      .eq('id', row.id);
    setRow(row.id, { saving: false, stock_counted: counted, status: 'ok', countInput: String(counted), obs: row.obsInput || null });
  };

  // Salva a contagem física digitada. Se divergir, corrige o estoque e registra o furo.
  const saveCount = async (row: ReconRow) => {
    const counted = parseFloat(row.countInput.replace(',', '.'));
    if (isNaN(counted) || counted < 0) return;
    setRow(row.id, { saving: true });
    const diff = counted - row.stock_expected;
    const status = diff === 0 ? 'ok' : 'ajustado';

    // Corrige estoque + movimento de ajuste quando há diferença
    if (diff !== 0 && selected) {
      const casaId = await getCasaId(selected.casa_name);
      if (casaId) {
        const { data: stockItem } = await supabase
          .from('stock_items')
          .select('id')
          .eq('casa_id', casaId)
          .eq('product_id', row.product_id)
          .is('insumo_id', null)
          .maybeSingle();
        if (stockItem) {
          await supabase
            .from('stock_items')
            .update({ quantity: counted, updated_at: new Date().toISOString() })
            .eq('id', stockItem.id);
        }
        await supabase.from('stock_movements').insert({
          casa_id: casaId,
          product_id: row.product_id,
          movement_type: 'ajuste',
          quantity: diff,
          reference: `Prova real ${selected.event_name || selected.file_name}`,
          notes: row.obsInput || `Ajuste prova real (${diff > 0 ? '+' : ''}${diff})`,
        });
      }
    }

    await supabase
      .from('event_reconciliation')
      .update({ stock_counted: counted, status, obs: row.obsInput || null, checked_at: new Date().toISOString() })
      .eq('id', row.id);

    setRow(row.id, { saving: false, stock_counted: counted, status, obs: row.obsInput || null });
  };

  const casaIdCache = new Map<string, string>();
  const getCasaId = async (name: string): Promise<string | null> => {
    if (casaIdCache.has(name)) return casaIdCache.get(name)!;
    const { data } = await supabase.from('casas').select('id').eq('name', name).single();
    if (data?.id) {
      casaIdCache.set(name, data.id);
      return data.id;
    }
    return null;
  };

  const closeReconciliation = async () => {
    if (!selected) return;
    await supabase.from('sale_imports').update({ reconciled_at: new Date().toISOString() }).eq('id', selected.id);
    setSelected({ ...selected, reconciled_at: new Date().toISOString() });
    fetchEvents();
    setShowReport(true);
  };

  // ---- Resumo ----
  const done = rows.filter((r) => r.status !== 'pendente').length;
  const okCount = rows.filter((r) => r.status === 'ok').length;
  const adjCount = rows.filter((r) => r.status === 'ajustado').length;
  const pending = rows.length - done;
  const totalFuro = rows
    .filter((r) => r.status === 'ajustado' && r.stock_counted !== null)
    .reduce((s, r) => s + (r.stock_counted! - r.stock_expected), 0);

  // =================== LISTA DE EVENTOS ===================
  if (!selected) {
    return (
      <LoadingState loading={loading} error={error}>
        <div>
          <div className="mb-6">
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <ClipboardCheck size={22} className="text-blue-700" /> Prova Real
            </h1>
            <p className="text-sm text-gray-500">
              Confira o estoque físico contra o que o sistema calculou após cada evento
            </p>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 bg-gray-50 border-b">
                  <th className="px-4 py-3 font-medium">Data</th>
                  <th className="px-4 py-3 font-medium">Casa</th>
                  <th className="px-4 py-3 font-medium">Evento / Arquivo</th>
                  <th className="px-4 py-3 font-medium text-right">Produtos</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {events.map((ev) => (
                  <tr key={ev.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-900">{ev.event_date}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded ${casaBgColor(ev.casa_name)}`}>{ev.casa_name}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-700 max-w-[280px] truncate" title={ev.file_name}>
                      {ev.event_name || ev.file_name}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-900">{ev.total}</td>
                    <td className="px-4 py-3">
                      {ev.reconciled_at ? (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-emerald-50 text-emerald-700">
                          <Lock size={11} /> Fechada
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-amber-50 text-amber-700">
                          Aberta
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => openEvent(ev)}
                        className="text-xs px-3 py-1.5 rounded-lg bg-blue-700 text-white hover:bg-blue-800"
                      >
                        Abrir
                      </button>
                    </td>
                  </tr>
                ))}
                {events.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                      Nenhum evento com prova real ainda. Importe uma planilha de vendas para gerar uma.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </LoadingState>
    );
  }

  // =================== DETALHE / CONFERÊNCIA ===================
  return (
    <div>
      {/* Cabeçalho */}
      <div className="flex items-center justify-between mb-4 no-print">
        <button
          onClick={() => { setSelected(null); setShowReport(false); }}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900"
        >
          <ArrowLeft size={16} /> Voltar
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setShowReport(true); setTimeout(() => window.print(), 200); }}
            className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            <Printer size={15} /> Relatório / PDF
          </button>
          {!selected.reconciled_at && (
            <button
              onClick={closeReconciliation}
              disabled={pending > 0}
              title={pending > 0 ? 'Confira todos os itens antes de fechar' : 'Fechar prova real'}
              className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              <CheckCircle2 size={15} /> Fechar prova real
            </button>
          )}
        </div>
      </div>

      {/* Info do evento + resumo */}
      <div className="print-area">
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <ClipboardCheck size={20} className="text-blue-700" />
                Prova Real — {selected.event_name || selected.file_name}
              </h1>
              <p className="text-xs text-gray-500 mt-0.5">
                <span className={`px-2 py-0.5 rounded ${casaBgColor(selected.casa_name)}`}>{selected.casa_name}</span>
                {' '}· {selected.event_date} · {formatDateTime(selected.created_at)}
                {selected.reconciled_at && <span className="ml-2 text-emerald-700">· Fechada</span>}
              </p>
            </div>
            <div className="flex gap-4 text-center">
              <div><p className="text-lg font-bold text-gray-900">{rows.length}</p><p className="text-[11px] text-gray-500">Itens</p></div>
              <div><p className="text-lg font-bold text-emerald-700">{okCount}</p><p className="text-[11px] text-gray-500">OK</p></div>
              <div><p className="text-lg font-bold text-amber-700">{adjCount}</p><p className="text-[11px] text-gray-500">Ajustados</p></div>
              <div><p className="text-lg font-bold text-gray-400">{pending}</p><p className="text-[11px] text-gray-500">Pendentes</p></div>
              <div><p className={`text-lg font-bold ${totalFuro === 0 ? 'text-gray-900' : totalFuro < 0 ? 'text-red-700' : 'text-blue-700'}`}>{totalFuro > 0 ? '+' : ''}{formatNumber(totalFuro, 0)}</p><p className="text-[11px] text-gray-500">Furo total</p></div>
            </div>
          </div>
          {rows.some((r) => r.is_approx) && (
            <p className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-center gap-1.5">
              <AlertTriangle size={13} /> Estoque &quot;antes&quot; deste evento é aproximado (importação anterior ao recurso de foto).
            </p>
          )}
        </div>

        {/* Tabela de conferência */}
        {loadingRows ? (
          <div className="py-16 text-center text-gray-400">Carregando…</div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 bg-gray-50 border-b">
                  <th className="px-4 py-3 font-medium">Produto</th>
                  <th className="px-3 py-3 font-medium text-right">Antes</th>
                  <th className="px-3 py-3 font-medium text-right">Vendido</th>
                  <th className="px-3 py-3 font-medium text-right">Previsto</th>
                  <th className="px-3 py-3 font-medium text-right">Contagem física</th>
                  <th className="px-3 py-3 font-medium text-right">Furo</th>
                  <th className="px-4 py-3 font-medium">Obs</th>
                  <th className="px-3 py-3 font-medium text-center no-print">Ação</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const countedNum = r.countInput === '' ? null : parseFloat(r.countInput.replace(',', '.'));
                  const liveDiff = countedNum === null || isNaN(countedNum) ? null : countedNum - r.stock_expected;
                  return (
                    <tr key={r.id} className={`border-b border-gray-50 ${r.status === 'ajustado' ? 'bg-amber-50/40' : r.status === 'ok' ? 'bg-emerald-50/30' : ''}`}>
                      <td className="px-4 py-2.5 font-medium text-gray-900">
                        {r.product_name}
                        <span className="ml-2 text-[10px] text-gray-400">{r.category}</span>
                      </td>
                      <td className="px-3 py-2.5 text-right text-gray-600">{formatNumber(r.stock_before, 0)}</td>
                      <td className="px-3 py-2.5 text-right text-gray-600">{formatNumber(r.sold, 0)}</td>
                      <td className="px-3 py-2.5 text-right font-medium text-gray-900">{formatNumber(r.stock_expected, 0)}</td>
                      <td className="px-3 py-2.5 text-right">
                        <input
                          type="number"
                          value={r.countInput}
                          disabled={!!selected.reconciled_at}
                          onChange={(e) => setRow(r.id, { countInput: e.target.value })}
                          placeholder="—"
                          className="w-20 px-2 py-1 border border-gray-300 rounded text-right text-sm disabled:bg-gray-100 no-print"
                        />
                        <span className="hidden print-only">{r.stock_counted ?? '—'}</span>
                      </td>
                      <td className={`px-3 py-2.5 text-right font-medium ${liveDiff === null ? 'text-gray-300' : liveDiff === 0 ? 'text-emerald-600' : liveDiff < 0 ? 'text-red-600' : 'text-blue-600'}`}>
                        {liveDiff === null ? '—' : `${liveDiff > 0 ? '+' : ''}${formatNumber(liveDiff, 0)}`}
                      </td>
                      <td className="px-4 py-2.5">
                        <input
                          type="text"
                          value={r.obsInput}
                          disabled={!!selected.reconciled_at}
                          onChange={(e) => setRow(r.id, { obsInput: e.target.value })}
                          placeholder="—"
                          className="w-full min-w-[120px] px-2 py-1 border border-gray-200 rounded text-sm disabled:bg-gray-100 no-print"
                        />
                        <span className="hidden print-only">{r.obs || ''}</span>
                      </td>
                      <td className="px-3 py-2.5 text-center no-print">
                        {selected.reconciled_at ? (
                          <span className="text-xs text-gray-400">{r.status}</span>
                        ) : (
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => confirmOk(r)}
                              disabled={r.saving}
                              title="Bateu certo (usar o previsto)"
                              className="p-1.5 rounded-md bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-40"
                            >
                              <Check size={14} />
                            </button>
                            <button
                              onClick={() => saveCount(r)}
                              disabled={r.saving || r.countInput === ''}
                              title="Salvar contagem (corrige estoque se divergir)"
                              className="p-1.5 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-40"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {showReport && (
          <p className="mt-4 text-xs text-gray-500 no-print">
            Dica: na janela de impressão escolha &quot;Salvar como PDF&quot;.
          </p>
        )}
      </div>
    </div>
  );
}
