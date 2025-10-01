'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { useProductPerformance } from '../hooks/useDashboardData';
import { useDashboardFilters } from '../hooks/useDashboardFilters';

function ChartSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-80 bg-slate-200 rounded"></div>
    </div>
  );
}

interface TooltipProps {
  active?: boolean;
  payload?: Array<{
    value: number;
    payload: {
      productName: string;
      revenue: number;
      unitsSold: number;
      avgPrice: number;
    };
  }>;
}

function CustomTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0].payload;

  return (
    <div className="bg-white p-4 rounded-lg shadow-lg border border-slate-200">
      <p className="font-semibold text-slate-900 mb-2">{data.productName}</p>
      <div className="space-y-1 text-sm">
        <div className="flex justify-between gap-4">
          <span className="text-slate-600">Receita:</span>
          <span className="font-medium text-slate-900">
            {new Intl.NumberFormat('pt-BR', {
              style: 'currency',
              currency: 'BRL',
            }).format(data.revenue)}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-slate-600">Unidades:</span>
          <span className="font-medium text-slate-900">{data.unitsSold}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-slate-600">Preço médio:</span>
          <span className="font-medium text-slate-900">
            {new Intl.NumberFormat('pt-BR', {
              style: 'currency',
              currency: 'BRL',
            }).format(data.avgPrice)}
          </span>
        </div>
      </div>
    </div>
  );
}

const COLORS = [
  '#3b82f6', // blue-500
  '#06b6d4', // cyan-500
  '#8b5cf6', // violet-500
  '#ec4899', // pink-500
  '#f59e0b', // amber-500
  '#10b981', // emerald-500
  '#6366f1', // indigo-500
  '#f97316', // orange-500
];

export function ProductPerformanceChart() {
  const { filters } = useDashboardFilters();
  const { products, isLoading, isError } = useProductPerformance(
    filters.dateRange,
    filters.category
  );

  const topProducts = products
    .sort((a: { revenue: number }, b: { revenue: number }) => b.revenue - a.revenue)
    .slice(0, 10);

  if (isError) {
    return (
      <div className="bg-white rounded-lg shadow border border-slate-200 p-8 text-center">
        <div className="text-red-500 mb-4">
          <svg
            className="w-12 h-12 mx-auto"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-slate-900 mb-2">
          Erro ao carregar dados
        </h3>
        <p className="text-slate-600">
          Não foi possível carregar o desempenho dos produtos.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow border border-slate-200 p-6">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-slate-900">
          Desempenho de Produtos
        </h2>
        <p className="text-sm text-slate-600 mt-1">
          Top 10 produtos por receita
        </p>
      </div>

      {isLoading ? (
        <ChartSkeleton />
      ) : topProducts.length === 0 ? (
        <div className="h-80 flex flex-col items-center justify-center text-center">
          <div className="text-slate-400 mb-4">
            <svg
              className="w-12 h-12 mx-auto"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-slate-900 mb-2">
            Nenhum dado disponível
          </h3>
          <p className="text-slate-600">
            Não há dados de produtos no período selecionado.
          </p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={400}>
          <BarChart
            data={topProducts}
            margin={{ top: 20, right: 30, left: 20, bottom: 80 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              dataKey="productName"
              angle={-45}
              textAnchor="end"
              height={100}
              tick={{ fill: '#64748b', fontSize: 12 }}
            />
            <YAxis
              tick={{ fill: '#64748b', fontSize: 12 }}
              tickFormatter={(value) =>
                new Intl.NumberFormat('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                  notation: 'compact',
                  compactDisplay: 'short',
                }).format(value)
              }
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="revenue" radius={[8, 8, 0, 0]}>
              {topProducts.map((_item: unknown, index: number) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}