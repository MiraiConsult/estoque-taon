'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { formatCurrency, formatNumber, casaBgColor } from '@/lib/format';
import CasaFilter from '@/components/CasaFilter';
import StatCard from '@/components/StatCard';
import { BarChart3, TrendingUp, DollarSign, Wine, Package } from 'lucide-react';

interface AnalysisData {
  salesByCategory: Array<{ category: string; quantity: number; revenue: number; cost: number; profit: number }>;
  salesByDate: Array<{ date: string; revenue: number; quantity: number }>;
  topProfitDrinks: Array<{ name: string; casa: string; profit: number; margin_pct: number; quantity: number }>;
  topCostDrinks: Array<{ name: string; casa: string; cost: number; quantity: number; total_cost: number }>;
  casaComparison: Array<{ casa: string; revenue: number; cost: number; profit: number; items_sold: number }>;
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  avgTicket: number;
  totalItems: number;
}

export default function AnalisePage() {
  const [selectedCasa, setSelectedCasa] = useState('all');
  const [period, setPeriod] = useState('all');
  const [data, setData] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(true);

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

    let salesQuery = supabase
      .from('sales')
      .select('quantity, total_value, ticket_medio, event_date, product:products(name, category, cost, type), casa:casas(name)');

    if (casaId) salesQuery = salesQuery.eq('casa_id', casaId);

    if (period !== 'all') {
      const now = new Date();
      let startDate: Date;
      if (period === '7d') startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      else if (period === '30d') startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      else startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      salesQuery = salesQuery.gte('event_date', startDate.toISOString().split('T')[0]);
    }

    const { data: salesRaw } = await salesQuery;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sales = ((salesRaw || []) as any[]).map((s) => ({
      quantity: Number(s.quantity),
      total_value: Number(s.total_value),
      ticket_medio: Number(s.ticket_medio),
      event_date: String(s.event_date),
      product: s.product as { name: string; category: string; cost: number; type: string } | null,
      casa: s.casa as { name: string } | null,
    }));

    const totalRevenue = sales.reduce((s, r) => s + Number(r.total_value), 0);
    const totalItems = sales.reduce((s, r) => s + Number(r.quantity), 0);
    const totalCost = sales.reduce(
      (s, r) => s + (Number(r.product?.cost || 0) * Number(r.quantity)),
      0
    );
    const totalProfit = totalRevenue - totalCost;
    const avgTicket = totalItems > 0 ? totalRevenue / totalItems : 0;

    const categoryMap = new Map<string, { quantity: number; revenue: number; cost: number }>();
    sales.forEach((s) => {
      const cat = s.product?.category || 'Outros';
      const existing = categoryMap.get(cat) || { quantity: 0, revenue: 0, cost: 0 };
      existing.quantity += Number(s.quantity);
      existing.revenue += Number(s.total_value);
      existing.cost += Number(s.product?.cost || 0) * Number(s.quantity);
      categoryMap.set(cat, existing);
    });
    const salesByCategory = Array.from(categoryMap.entries())
      .map(([category, d]) => ({
        category,
        ...d,
        profit: d.revenue - d.cost,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    const dateMap = new Map<string, { revenue: number; quantity: number }>();
    sales.forEach((s) => {
      const date = s.event_date;
      const existing = dateMap.get(date) || { revenue: 0, quantity: 0 };
      existing.revenue += Number(s.total_value);
      existing.quantity += Number(s.quantity);
      dateMap.set(date, existing);
    });
    const salesByDate = Array.from(dateMap.entries())
      .map(([date, d]) => ({ date, ...d }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const drinkProfitMap = new Map<string, { name: string; casa: string; revenue: number; cost: number; quantity: number }>();
    sales.forEach((s) => {
      if (s.product?.type !== 'drink') return;
      const key = `${s.product.name}-${s.casa?.name}`;
      const existing = drinkProfitMap.get(key) || {
        name: s.product.name,
        casa: s.casa?.name || '',
        revenue: 0,
        cost: 0,
        quantity: 0,
      };
      existing.revenue += Number(s.total_value);
      existing.cost += Number(s.product.cost) * Number(s.quantity);
      existing.quantity += Number(s.quantity);
      drinkProfitMap.set(key, existing);
    });
    const topProfitDrinks = Array.from(drinkProfitMap.values())
      .map((d) => ({
        ...d,
        profit: d.revenue - d.cost,
        margin_pct: d.revenue > 0 ? ((d.revenue - d.cost) / d.revenue) * 100 : 0,
      }))
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 10);

    const topCostDrinks = Array.from(drinkProfitMap.values())
      .map((d) => ({
        name: d.name,
        casa: d.casa,
        cost: d.cost / (d.quantity || 1),
        quantity: d.quantity,
        total_cost: d.cost,
      }))
      .sort((a, b) => b.total_cost - a.total_cost)
      .slice(0, 10);

    const casaMap = new Map<string, { revenue: number; cost: number; items_sold: number }>();
    sales.forEach((s) => {
      const casa = s.casa?.name || 'Desconhecido';
      const existing = casaMap.get(casa) || { revenue: 0, cost: 0, items_sold: 0 };
      existing.revenue += Number(s.total_value);
      existing.cost += Number(s.product?.cost || 0) * Number(s.quantity);
      existing.items_sold += Number(s.quantity);
      casaMap.set(casa, existing);
    });
    const casaComparison = Array.from(casaMap.entries())
      .map(([casa, d]) => ({
        casa,
        ...d,
        profit: d.revenue - d.cost,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    setData({
      salesByCategory,
      salesByDate,
      topProfitDrinks,
      topCostDrinks,
      casaComparison,
      totalRevenue,
      totalCost,
      totalProfit,
      avgTicket,
      totalItems,
    });

    setLoading(false);
  }, [selectedCasa, period]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Analise</h1>
          <p className="text-sm text-gray-500">Analise detalhada de vendas, custos e lucros</p>
        </div>
        <div className="flex gap-4 flex-wrap">
          <CasaFilter selected={selectedCasa} onChange={setSelectedCasa} />
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="all">Todo periodo</option>
            <option value="7d">Ultimos 7 dias</option>
            <option value="30d">Ultimos 30 dias</option>
            <option value="90d">Ultimos 90 dias</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        <StatCard
          title="Receita Total"
          value={formatCurrency(data.totalRevenue)}
          icon={<DollarSign size={18} />}
          color="green"
        />
        <StatCard
          title="Custo Total"
          value={formatCurrency(data.totalCost)}
          icon={<Package size={18} />}
          color="red"
        />
        <StatCard
          title="Lucro Total"
          value={formatCurrency(data.totalProfit)}
          icon={<TrendingUp size={18} />}
          color="blue"
        />
        <StatCard
          title="Ticket Medio"
          value={formatCurrency(data.avgTicket)}
          icon={<Wine size={18} />}
          color="purple"
        />
        <StatCard
          title="Itens Vendidos"
          value={formatNumber(data.totalItems)}
          icon={<BarChart3 size={18} />}
          color="amber"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="font-semibold text-gray-900 mb-4">Comparativo por Casa</h3>
          {data.casaComparison.length > 0 ? (
            <div className="space-y-4">
              {data.casaComparison.map((casa) => (
                <div key={casa.casa} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className={`text-sm font-medium px-2 py-0.5 rounded ${casaBgColor(casa.casa)}`}>
                      {casa.casa}
                    </span>
                    <span className="text-sm text-gray-500">{formatNumber(casa.items_sold)} itens</span>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs text-gray-500">Receita</p>
                      <p className="text-sm font-semibold text-gray-900">{formatCurrency(casa.revenue)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Custo</p>
                      <p className="text-sm font-semibold text-red-600">{formatCurrency(casa.cost)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Lucro</p>
                      <p className="text-sm font-semibold text-emerald-600">{formatCurrency(casa.profit)}</p>
                    </div>
                  </div>
                  <div className="mt-2 w-full bg-gray-100 rounded-full h-2">
                    <div
                      className="h-2 rounded-full bg-emerald-500"
                      style={{
                        width: `${casa.revenue > 0 ? (casa.profit / casa.revenue) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Margem: {casa.revenue > 0 ? ((casa.profit / casa.revenue) * 100).toFixed(1) : 0}%
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 text-center py-8">Nenhum dado disponivel</p>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="font-semibold text-gray-900 mb-4">Vendas por Categoria</h3>
          {data.salesByCategory.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b">
                    <th className="pb-2 font-medium">Categoria</th>
                    <th className="pb-2 font-medium text-right">Qtd</th>
                    <th className="pb-2 font-medium text-right">Receita</th>
                    <th className="pb-2 font-medium text-right">Lucro</th>
                  </tr>
                </thead>
                <tbody>
                  {data.salesByCategory.map((cat) => (
                    <tr key={cat.category} className="border-b border-gray-50">
                      <td className="py-2 font-medium text-gray-900">{cat.category}</td>
                      <td className="py-2 text-right text-gray-600">{formatNumber(cat.quantity)}</td>
                      <td className="py-2 text-right text-gray-900">{formatCurrency(cat.revenue)}</td>
                      <td className={`py-2 text-right font-medium ${cat.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {formatCurrency(cat.profit)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-500 text-center py-8">Nenhum dado disponivel</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="font-semibold text-gray-900 mb-4">Top 10 Drinks por Lucro</h3>
          {data.topProfitDrinks.length > 0 ? (
            <div className="space-y-3">
              {data.topProfitDrinks.map((drink, i) => (
                <div key={`${drink.name}-${drink.casa}`} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-400 w-6">{i + 1}</span>
                    <div>
                      <span className="text-sm font-medium text-gray-900">{drink.name}</span>
                      <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${casaBgColor(drink.casa)}`}>
                        {drink.casa}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-semibold text-emerald-600">
                      {formatCurrency(drink.profit)}
                    </span>
                    <span className="text-xs text-gray-500 ml-1">
                      ({drink.margin_pct.toFixed(0)}%)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 text-center py-8">Nenhum dado disponivel</p>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="font-semibold text-gray-900 mb-4">Top 10 Maiores Custos</h3>
          {data.topCostDrinks.length > 0 ? (
            <div className="space-y-3">
              {data.topCostDrinks.map((drink, i) => (
                <div key={`${drink.name}-${drink.casa}`} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-400 w-6">{i + 1}</span>
                    <div>
                      <span className="text-sm font-medium text-gray-900">{drink.name}</span>
                      <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${casaBgColor(drink.casa)}`}>
                        {drink.casa}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-semibold text-red-600">
                      {formatCurrency(drink.total_cost)}
                    </span>
                    <span className="text-xs text-gray-500 ml-1">
                      ({drink.quantity} un)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 text-center py-8">Nenhum dado disponivel</p>
          )}
        </div>
      </div>

      {data.salesByDate.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="font-semibold text-gray-900 mb-4">Vendas por Data</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="pb-2 font-medium">Data</th>
                  <th className="pb-2 font-medium text-right">Itens</th>
                  <th className="pb-2 font-medium text-right">Receita</th>
                </tr>
              </thead>
              <tbody>
                {data.salesByDate.map((d) => (
                  <tr key={d.date} className="border-b border-gray-50">
                    <td className="py-2 font-medium text-gray-900">{d.date}</td>
                    <td className="py-2 text-right text-gray-600">{formatNumber(d.quantity)}</td>
                    <td className="py-2 text-right font-medium text-gray-900">
                      {formatCurrency(d.revenue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
