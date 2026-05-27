'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { formatCurrency, formatNumber, casaBgColor } from '@/lib/format';
import CasaFilter from '@/components/CasaFilter';
import StatCard from '@/components/StatCard';
import LoadingState from '@/components/LoadingState';
import {
  DollarSign,
  Package,
  TrendingUp,
  Wine,
  AlertTriangle,
  ShoppingCart,
} from 'lucide-react';

interface DashboardData {
  totalProducts: number;
  totalDrinks: number;
  totalSales: number;
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  avgMarkup: number;
  lowStockItems: Array<{
    id: string;
    product_name: string;
    casa_name: string;
    quantity: number;
    minimum: number;
  }>;
  recentSales: Array<{
    id: string;
    product_name: string;
    casa_name: string;
    quantity: number;
    total_value: number;
    event_date: string;
  }>;
  salesByCasa: Array<{ casa: string; total: number }>;
  topDrinks: Array<{ name: string; quantity: number; revenue: number }>;
}

export default function DashboardPage() {
  const [selectedCasa, setSelectedCasa] = useState('all');
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
    const casaFilter = selectedCasa !== 'all';
    let casaId: string | null = null;

    if (casaFilter) {
      const { data: casa } = await supabase
        .from('casas')
        .select('id')
        .eq('name', selectedCasa)
        .single();
      casaId = casa?.id || null;
    }

    const [
      productsRes,
      drinksRes,
      salesRes,
      lowStockRes,
      recentSalesRes,
    ] = await Promise.all([
      supabase.from('products').select('id', { count: 'exact', head: true }),
      supabase.from('products').select('id', { count: 'exact', head: true }).eq('type', 'drink'),
      (() => {
        let q = supabase.from('sales').select('quantity, total_value, product_id');
        if (casaId) q = q.eq('casa_id', casaId);
        return q;
      })(),
      (() => {
        let q = supabase
          .from('stock_items')
          .select('id, quantity, minimum, product:products(name), casa:casas(name)')
          .not('product_id', 'is', null);
        if (casaId) q = q.eq('casa_id', casaId);
        return q;
      })(),
      (() => {
        let q = supabase
          .from('sales')
          .select('id, quantity, total_value, event_date, product:products(name), casa:casas(name)')
          .order('created_at', { ascending: false })
          .limit(10);
        if (casaId) q = q.eq('casa_id', casaId);
        return q;
      })(),
    ]);

    const sales = salesRes.data || [];
    const totalRevenue = sales.reduce((sum, s) => sum + Number(s.total_value), 0);
    const totalSalesQty = sales.reduce((sum, s) => sum + Number(s.quantity), 0);

    const productsForCost = await (async () => {
      const productIds = [...new Set(sales.map((s) => s.product_id))];
      if (productIds.length === 0) return [];
      const { data } = await supabase
        .from('products')
        .select('id, cost')
        .in('id', productIds);
      return data || [];
    })();

    const costMap = new Map(productsForCost.map((p) => [p.id, Number(p.cost)]));
    const totalCost = sales.reduce(
      (sum, s) => sum + (costMap.get(s.product_id) || 0) * Number(s.quantity),
      0
    );

    const { data: allProducts } = await supabase
      .from('products')
      .select('markup')
      .eq('type', 'drink')
      .gt('markup', 0);
    const avgMarkup =
      allProducts && allProducts.length > 0
        ? allProducts.reduce((sum, p) => sum + Number(p.markup), 0) / allProducts.length
        : 0;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stockItems = (lowStockRes.data || []) as any[];
    const lowStock = stockItems
      .filter((item) => item.quantity < item.minimum && item.minimum > 0)
      .map((item) => ({
        id: item.id,
        product_name: item.product?.name || 'Desconhecido',
        casa_name: item.casa?.name || '',
        quantity: item.quantity,
        minimum: item.minimum,
      }))
      .slice(0, 10);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recentSalesData = (recentSalesRes.data || []) as any[];
    const recentSales = recentSalesData.map((s) => ({
      id: s.id,
      product_name: s.product?.name || 'Desconhecido',
      casa_name: s.casa?.name || '',
      quantity: s.quantity,
      total_value: s.total_value,
      event_date: s.event_date,
    }));

    const { data: salesByCasaRaw } = await supabase
      .from('sales')
      .select('total_value, casa:casas(name)');
    const casaTotals = new Map<string, number>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ((salesByCasaRaw || []) as any[]).forEach((s) => {
      const name = s.casa?.name || 'Desconhecido';
      casaTotals.set(name, (casaTotals.get(name) || 0) + Number(s.total_value));
    });
    const salesByCasa = Array.from(casaTotals.entries()).map(([casa, total]) => ({ casa, total }));

    const salesByProduct = new Map<string, { name: string; quantity: number; revenue: number }>();
    const { data: allSalesWithProducts } = await supabase
      .from('sales')
      .select('quantity, total_value, product:products(name)');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ((allSalesWithProducts || []) as any[]).forEach((s) => {
      const name = s.product?.name || 'Desconhecido';
      const existing = salesByProduct.get(name) || { name, quantity: 0, revenue: 0 };
      existing.quantity += Number(s.quantity);
      existing.revenue += Number(s.total_value);
      salesByProduct.set(name, existing);
    });
    const topDrinks = Array.from(salesByProduct.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    setData({
      totalProducts: productsRes.count || 0,
      totalDrinks: drinksRes.count || 0,
      totalSales: totalSalesQty,
      totalRevenue,
      totalCost,
      totalProfit: totalRevenue - totalCost,
      avgMarkup,
      lowStockItems: lowStock,
      recentSales,
      salesByCasa,
      topDrinks,
    });

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('Dashboard fetch error:', msg);
      setFetchError(msg);
    } finally {
      setLoading(false);
    }
  }, [selectedCasa]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <LoadingState loading={loading} error={fetchError}>
      <div>
      {data && (<>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500">Visao geral do estoque e vendas</p>
        </div>
        <CasaFilter selected={selectedCasa} onChange={setSelectedCasa} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <StatCard
          title="Receita Total"
          value={formatCurrency(data.totalRevenue)}
          icon={<DollarSign size={18} />}
          color="green"
        />
        <StatCard
          title="Custo Total"
          value={formatCurrency(data.totalCost)}
          icon={<ShoppingCart size={18} />}
          color="red"
        />
        <StatCard
          title="Lucro"
          value={formatCurrency(data.totalProfit)}
          icon={<TrendingUp size={18} />}
          color="blue"
        />
        <StatCard
          title="Vendas"
          value={formatNumber(data.totalSales)}
          subtitle="unidades vendidas"
          icon={<Wine size={18} />}
          color="purple"
        />
        <StatCard
          title="Markup Medio"
          value={`${formatNumber(data.avgMarkup, 1)}x`}
          icon={<TrendingUp size={18} />}
          color="amber"
        />
        <StatCard
          title="Estoque Baixo"
          value={data.lowStockItems.length}
          subtitle="abaixo do minimo"
          icon={<AlertTriangle size={18} />}
          color="red"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="font-semibold text-gray-900 mb-4">Top 10 Produtos Mais Vendidos</h3>
          <div className="space-y-3">
            {data.topDrinks.map((drink, i) => (
              <div key={drink.name} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-400 w-6">{i + 1}</span>
                  <span className="text-sm font-medium text-gray-900">{drink.name}</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-semibold text-gray-900">
                    {formatCurrency(drink.revenue)}
                  </span>
                  <span className="text-xs text-gray-500 ml-2">({drink.quantity} un)</span>
                </div>
              </div>
            ))}
            {data.topDrinks.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">Nenhuma venda registrada</p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="font-semibold text-gray-900 mb-4">Receita por Casa</h3>
          <div className="space-y-4">
            {data.salesByCasa.map((item) => {
              const maxValue = Math.max(...data.salesByCasa.map((s) => s.total));
              const percentage = maxValue > 0 ? (item.total / maxValue) * 100 : 0;
              return (
                <div key={item.casa}>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-sm font-medium px-2 py-0.5 rounded ${casaBgColor(item.casa)}`}>
                      {item.casa}
                    </span>
                    <span className="text-sm font-semibold text-gray-900">
                      {formatCurrency(item.total)}
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        item.casa === 'Isla'
                          ? 'bg-emerald-500'
                          : item.casa === 'Playa'
                          ? 'bg-blue-500'
                          : 'bg-purple-500'
                      }`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {data.salesByCasa.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">Nenhuma venda registrada</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="font-semibold text-gray-900 mb-4">Vendas Recentes</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="pb-2 font-medium">Produto</th>
                  <th className="pb-2 font-medium">Casa</th>
                  <th className="pb-2 font-medium text-right">Qtd</th>
                  <th className="pb-2 font-medium text-right">Valor</th>
                </tr>
              </thead>
              <tbody>
                {data.recentSales.map((sale) => (
                  <tr key={sale.id} className="border-b border-gray-50">
                    <td className="py-2 font-medium text-gray-900">{sale.product_name}</td>
                    <td className="py-2">
                      <span className={`text-xs px-2 py-0.5 rounded ${casaBgColor(sale.casa_name)}`}>
                        {sale.casa_name}
                      </span>
                    </td>
                    <td className="py-2 text-right text-gray-600">{sale.quantity}</td>
                    <td className="py-2 text-right font-medium text-gray-900">
                      {formatCurrency(sale.total_value)}
                    </td>
                  </tr>
                ))}
                {data.recentSales.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-gray-500">
                      Nenhuma venda registrada
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-500" />
            Estoque Baixo
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="pb-2 font-medium">Produto</th>
                  <th className="pb-2 font-medium">Casa</th>
                  <th className="pb-2 font-medium text-right">Atual</th>
                  <th className="pb-2 font-medium text-right">Minimo</th>
                </tr>
              </thead>
              <tbody>
                {data.lowStockItems.map((item) => (
                  <tr key={item.id} className="border-b border-gray-50">
                    <td className="py-2 font-medium text-gray-900">{item.product_name}</td>
                    <td className="py-2">
                      <span className={`text-xs px-2 py-0.5 rounded ${casaBgColor(item.casa_name)}`}>
                        {item.casa_name}
                      </span>
                    </td>
                    <td className="py-2 text-right text-red-600 font-medium">{item.quantity}</td>
                    <td className="py-2 text-right text-gray-600">{item.minimum}</td>
                  </tr>
                ))}
                {data.lowStockItems.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-gray-500">
                      Todos os itens acima do minimo
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      </>)}
      </div>
    </LoadingState>
  );
}
