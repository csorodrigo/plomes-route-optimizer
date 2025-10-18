'use client';

import { AreaChart as RechartsAreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export interface AreaChartData {
  name: string;
  value: number;
  [key: string]: string | number;
}

interface AreaChartProps {
  data: AreaChartData[];
  dataKey?: string;
  xAxisKey?: string;
  loading?: boolean;
  height?: number;
  fillColor?: string;
  strokeColor?: string;
}

export default function AreaChart({
  data,
  dataKey = 'value',
  xAxisKey = 'name',
  loading = false,
  height = 400,
  fillColor = 'rgba(59, 130, 246, 0.2)',
  strokeColor = '#3b82f6'
}: AreaChartProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px] md:min-h-[400px] bg-white rounded-lg shadow">
        <div className="text-slate-500">Carregando dados...</div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[300px] md:min-h-[400px] bg-white rounded-lg shadow">
        <div className="text-slate-400">Nenhum dado disponível</div>
      </div>
    );
  }

  return (
    <div className="bg-white p-4 rounded-lg shadow min-h-[300px] md:min-h-[400px]">
      <ResponsiveContainer width="100%" height={height}>
        <RechartsAreaChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <defs>
            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={strokeColor} stopOpacity={0.3} />
              <stop offset="95%" stopColor={strokeColor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey={xAxisKey}
            stroke="#64748b"
            tick={{ fill: '#64748b' }}
          />
          <YAxis
            stroke="#64748b"
            tick={{ fill: '#64748b' }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: '0.5rem'
            }}
          />
          <Legend
            wrapperStyle={{ paddingTop: '10px' }}
          />
          <Area
            type="monotone"
            dataKey={dataKey}
            stroke={strokeColor}
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorValue)"
          />
        </RechartsAreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Usage Example:
 *
 * const cumulativeData = [
 *   { name: 'Jan', value: 15000 },
 *   { name: 'Fev', value: 33000 },
 *   { name: 'Mar', value: 55000 },
 *   { name: 'Abr', value: 80000 }
 * ];
 *
 * <AreaChart
 *   data={cumulativeData}
 *   dataKey="value"
 *   xAxisKey="name"
 *   strokeColor="#10b981"
 * />
 */