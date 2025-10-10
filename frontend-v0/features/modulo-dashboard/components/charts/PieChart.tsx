'use client';

import { PieChart as RechartsPieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export interface PieChartData {
  name: string;
  value: number;
  [key: string]: string | number;
}

interface PieChartProps {
  data: PieChartData[];
  loading?: boolean;
  height?: number;
  colors?: string[];
}

const DEFAULT_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function PieChart({
  data,
  loading = false,
  height = 400,
  colors = DEFAULT_COLORS
}: PieChartProps) {
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
        <RechartsPieChart margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={(entry: any) => `${entry.name} ${(entry.percent * 100).toFixed(0)}%`}
            outerRadius={120}
            fill="#8884d8"
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: '0.5rem'
            }}
          />
          <Legend
            wrapperStyle={{ paddingTop: '20px' }}
            iconType="circle"
          />
        </RechartsPieChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Usage Example:
 *
 * const categoryData = [
 *   { name: 'Categoria A', value: 45 },
 *   { name: 'Categoria B', value: 30 },
 *   { name: 'Categoria C', value: 25 }
 * ];
 *
 * <PieChart
 *   data={categoryData}
 *   colors={['#3b82f6', '#10b981', '#f59e0b']}
 * />
 */