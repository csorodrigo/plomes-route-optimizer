'use client';

import { BarChart as RechartsBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export interface BarChartData {
  name: string;
  value: number;
  [key: string]: string | number;
}

interface BarChartProps {
  data: BarChartData[];
  dataKey?: string;
  xAxisKey?: string;
  loading?: boolean;
  height?: number;
  barColor?: string;
}

export default function BarChart({
  data,
  dataKey = 'value',
  xAxisKey = 'name',
  loading = false,
  height = 400,
  barColor = '#3b82f6'
}: BarChartProps) {
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
        <RechartsBarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
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
          <Bar dataKey={dataKey} fill={barColor} radius={[4, 4, 0, 0]} />
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Usage Example:
 *
 * const revenueData = [
 *   { name: 'Cliente A', value: 45000 },
 *   { name: 'Cliente B', value: 32000 },
 *   { name: 'Cliente C', value: 28000 }
 * ];
 *
 * <BarChart
 *   data={revenueData}
 *   dataKey="value"
 *   xAxisKey="name"
 *   barColor="#3b82f6"
 * />
 */