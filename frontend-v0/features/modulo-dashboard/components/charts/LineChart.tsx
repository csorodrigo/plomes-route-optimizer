'use client';

import { LineChart as RechartsLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export interface LineChartData {
  name: string;
  value: number;
  [key: string]: string | number;
}

interface LineChartProps {
  data: LineChartData[];
  dataKey?: string;
  xAxisKey?: string;
  loading?: boolean;
  height?: number;
  lineColor?: string;
  strokeWidth?: number;
}

export default function LineChart({
  data,
  dataKey = 'value',
  xAxisKey = 'name',
  loading = false,
  height = 400,
  lineColor = '#3b82f6',
  strokeWidth = 2
}: LineChartProps) {
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
        <RechartsLineChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
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
          <Line
            type="monotone"
            dataKey={dataKey}
            stroke={lineColor}
            strokeWidth={strokeWidth}
            dot={{ fill: lineColor, r: 4 }}
            activeDot={{ r: 6 }}
          />
        </RechartsLineChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Usage Example:
 *
 * const trendsData = [
 *   { name: 'Jan', value: 15000 },
 *   { name: 'Fev', value: 18000 },
 *   { name: 'Mar', value: 22000 },
 *   { name: 'Abr', value: 25000 }
 * ];
 *
 * <LineChart
 *   data={trendsData}
 *   dataKey="value"
 *   xAxisKey="name"
 *   lineColor="#10b981"
 * />
 */