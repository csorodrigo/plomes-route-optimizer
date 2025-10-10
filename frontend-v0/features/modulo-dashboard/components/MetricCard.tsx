import type { ReactNode } from 'react';

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: number;
  icon?: ReactNode;
  loading?: boolean;
}

function formatChange(change: number): string {
  const sign = change >= 0 ? '+' : '';
  return `${sign}${change.toFixed(1)}%`;
}

function MetricCardSkeleton() {
  return (
    <div className="bg-white rounded-lg shadow border border-slate-200 p-6 animate-pulse">
      <div className="flex items-center justify-between mb-4">
        <div className="h-4 bg-slate-200 rounded w-24"></div>
        <div className="h-8 w-8 bg-slate-200 rounded"></div>
      </div>
      <div className="h-8 bg-slate-200 rounded w-32 mb-2"></div>
      <div className="h-3 bg-slate-200 rounded w-20"></div>
    </div>
  );
}

export function MetricCard({ title, value, change, icon, loading }: MetricCardProps) {
  if (loading) {
    return <MetricCardSkeleton />;
  }

  const changeColor = change
    ? change >= 0
      ? 'text-blue-600'
      : 'text-red-600'
    : 'text-slate-500';

  return (
    <div className="bg-white rounded-lg shadow border border-slate-200 p-6 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-slate-600">{title}</h3>
        {icon && (
          <div className="text-slate-400">
            {icon}
          </div>
        )}
      </div>

      <div className="mb-2">
        <p className="text-2xl md:text-3xl font-bold text-slate-900">
          {typeof value === 'number'
            ? value.toLocaleString('pt-BR')
            : value
          }
        </p>
      </div>

      {change !== undefined && (
        <div className="flex items-center text-sm">
          <span className={`font-medium ${changeColor}`}>
            {formatChange(change)}
          </span>
          <span className="text-slate-500 ml-2">vs período anterior</span>
        </div>
      )}
    </div>
  );
}