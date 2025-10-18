'use client';

import { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { usePricingHistory } from '../hooks/useDashboardData';

interface PricingHistoryViewProps {
  productId?: string;
  customerId?: string;
}

interface TooltipProps {
  active?: boolean;
  payload?: Array<{
    value: number;
    payload: {
      date: string;
      price: number;
      quantity: number;
      customerName: string;
    };
  }>;
}

function CustomTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0].payload;

  return (
    <div className="bg-white p-4 rounded-lg shadow-lg border border-slate-200">
      <p className="font-semibold text-slate-900 mb-2">
        {new Date(data.date).toLocaleDateString('pt-BR')}
      </p>
      <div className="space-y-1 text-sm">
        <div className="flex justify-between gap-4">
          <span className="text-slate-600">Preço:</span>
          <span className="font-medium text-slate-900">
            {new Intl.NumberFormat('pt-BR', {
              style: 'currency',
              currency: 'BRL',
            }).format(data.price)}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-slate-600">Quantidade:</span>
          <span className="font-medium text-slate-900">{data.quantity}</span>
        </div>
        {data.customerName && (
          <div className="flex justify-between gap-4">
            <span className="text-slate-600">Cliente:</span>
            <span className="font-medium text-slate-900">{data.customerName}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function PricingHistoryView({ productId, customerId }: PricingHistoryViewProps) {
  const { history, isLoading, isError } = usePricingHistory(productId, customerId);

  const { chartData, minPrice, maxPrice } = useMemo(() => {
    if (history.length === 0) {
      return { chartData: [], minPrice: 0, maxPrice: 0 };
    }

    const sorted = [...history].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const prices = sorted.map((h) => h.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);

    return {
      chartData: sorted,
      minPrice: min,
      maxPrice: max,
    };
  }, [history]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

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
          Não foi possível carregar o histórico de preços.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow border border-slate-200 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-slate-200 rounded w-48"></div>
          <div className="h-80 bg-slate-200 rounded"></div>
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-20 bg-slate-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow border border-slate-200 p-8 text-center">
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
          Nenhum histórico disponível
        </h3>
        <p className="text-slate-600">
          Não há histórico de preços para os critérios selecionados.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow border border-slate-200 p-6">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-slate-900">
          Histórico de Preços
        </h2>
        <p className="text-sm text-slate-600 mt-1">
          Evolução de preços ao longo do tempo
        </p>
      </div>

      {/* Warning Banner */}
      {minPrice > 0 && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-start gap-3">
            <svg
              className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <div>
              <h4 className="text-sm font-medium text-amber-900 mb-1">
                Atenção ao preço mínimo histórico
              </h4>
              <p className="text-sm text-amber-800">
                O menor preço registrado foi{' '}
                <strong>{formatCurrency(minPrice)}</strong>. Evite vender abaixo
                deste valor para manter a rentabilidade.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Price Trend Chart */}
      <div className="mb-6">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart
            data={chartData}
            margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              dataKey="date"
              tick={{ fill: '#64748b', fontSize: 12 }}
              tickFormatter={(value) =>
                new Date(value).toLocaleDateString('pt-BR', {
                  day: '2-digit',
                  month: '2-digit',
                })
              }
            />
            <YAxis
              tick={{ fill: '#64748b', fontSize: 12 }}
              tickFormatter={(value) =>
                new Intl.NumberFormat('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                  notation: 'compact',
                }).format(value)
              }
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine
              y={minPrice}
              stroke="#dc2626"
              strokeDasharray="3 3"
              label={{
                value: 'Mínimo',
                fill: '#dc2626',
                fontSize: 12,
                position: 'right',
              }}
            />
            <Line
              type="monotone"
              dataKey="price"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={{ fill: '#3b82f6', r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Price Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
          <div className="text-sm text-slate-600 mb-1">Preço Mínimo</div>
          <div className="text-xl font-bold text-red-600">
            {formatCurrency(minPrice)}
          </div>
        </div>
        <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
          <div className="text-sm text-slate-600 mb-1">Preço Máximo</div>
          <div className="text-xl font-bold text-green-600">
            {formatCurrency(maxPrice)}
          </div>
        </div>
        <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
          <div className="text-sm text-slate-600 mb-1">Variação</div>
          <div className="text-xl font-bold text-slate-900">
            {formatCurrency(maxPrice - minPrice)}
          </div>
        </div>
      </div>

      {/* Timeline of Prices */}
      <div>
        <h3 className="text-sm font-semibold text-slate-900 mb-3">
          Histórico Detalhado
        </h3>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {chartData.map((entry, index) => (
            <div
              key={entry.id}
              className={`p-4 rounded-lg border ${
                entry.isMinimumPrice || entry.price === minPrice
                  ? 'border-red-300 bg-red-50'
                  : 'border-slate-200 bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-slate-900">
                      {new Date(entry.date).toLocaleDateString('pt-BR')}
                    </span>
                    {(entry.isMinimumPrice || entry.price === minPrice) && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                        Preço Mínimo
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-slate-600">
                    {entry.customerName} • {entry.quantity} unidades
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-slate-900">
                    {formatCurrency(entry.price)}
                  </div>
                  <div className="text-sm text-slate-600">
                    Total: {formatCurrency(entry.totalValue)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}