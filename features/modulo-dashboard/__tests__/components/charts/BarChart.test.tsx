import React from 'react';
import { render, screen } from '../../utils/test-utils';
import BarChart, { BarChartData } from '../../../components/charts/BarChart';
import { mockChartData } from '../../utils/mock-data';

// Mock Recharts components
jest.mock('recharts', () => ({
  BarChart: ({ children, data }: any) => (
    <div data-testid="recharts-bar-chart" data-chart-data={JSON.stringify(data)}>
      {children}
    </div>
  ),
  Bar: ({ dataKey, fill }: any) => (
    <div data-testid="recharts-bar" data-key={dataKey} data-fill={fill} />
  ),
  XAxis: ({ dataKey, stroke }: any) => (
    <div data-testid="recharts-x-axis" data-key={dataKey} data-stroke={stroke} />
  ),
  YAxis: ({ stroke }: any) => (
    <div data-testid="recharts-y-axis" data-stroke={stroke} />
  ),
  CartesianGrid: ({ strokeDasharray, stroke }: any) => (
    <div data-testid="recharts-grid" data-dash={strokeDasharray} data-stroke={stroke} />
  ),
  Tooltip: ({ contentStyle }: any) => (
    <div data-testid="recharts-tooltip" data-style={JSON.stringify(contentStyle)} />
  ),
  Legend: ({ wrapperStyle }: any) => (
    <div data-testid="recharts-legend" data-style={JSON.stringify(wrapperStyle)} />
  ),
  ResponsiveContainer: ({ children, width, height }: any) => (
    <div data-testid="recharts-responsive-container" data-width={width} data-height={height}>
      {children}
    </div>
  ),
}));

describe('BarChart Component', () => {
  const mockData: BarChartData[] = [
    { name: 'Product A', value: 45000 },
    { name: 'Product B', value: 32000 },
    { name: 'Product C', value: 28000 },
    { name: 'Product D', value: 15000 },
  ];

  describe('Basic Rendering', () => {
    it('renders bar chart with data', () => {
      render(<BarChart data={mockData} />);

      expect(screen.getByTestId('recharts-bar-chart')).toBeInTheDocument();
      expect(screen.getByTestId('recharts-bar')).toBeInTheDocument();
      expect(screen.getByTestId('recharts-x-axis')).toBeInTheDocument();
      expect(screen.getByTestId('recharts-y-axis')).toBeInTheDocument();
    });

    it('renders with default props', () => {
      render(<BarChart data={mockData} />);

      const bar = screen.getByTestId('recharts-bar');
      const xAxis = screen.getByTestId('recharts-x-axis');

      expect(bar).toHaveAttribute('data-key', 'value');
      expect(bar).toHaveAttribute('data-fill', '#3b82f6');
      expect(xAxis).toHaveAttribute('data-key', 'name');
    });

    it('renders with custom props', () => {
      render(
        <BarChart
          data={mockData}
          dataKey="customValue"
          xAxisKey="customName"
          barColor="#ef4444"
          height={300}
        />
      );

      const bar = screen.getByTestId('recharts-bar');
      const xAxis = screen.getByTestId('recharts-x-axis');
      const container = screen.getByTestId('recharts-responsive-container');

      expect(bar).toHaveAttribute('data-key', 'customValue');
      expect(bar).toHaveAttribute('data-fill', '#ef4444');
      expect(xAxis).toHaveAttribute('data-key', 'customName');
      expect(container).toHaveAttribute('data-height', '300');
    });
  });

  describe('Data Handling', () => {
    it('passes correct data to chart component', () => {
      render(<BarChart data={mockData} />);

      const chartComponent = screen.getByTestId('recharts-bar-chart');
      const chartData = JSON.parse(chartComponent.getAttribute('data-chart-data') || '[]');

      expect(chartData).toEqual(mockData);
      expect(chartData).toHaveLength(4);
    });

    it('handles complex data structures', () => {
      const complexData: BarChartData[] = [
        { name: 'Q1', value: 100000, revenue: 50000, units: 25 },
        { name: 'Q2', value: 150000, revenue: 75000, units: 30 },
        { name: 'Q3', value: 120000, revenue: 60000, units: 28 },
      ];

      render(<BarChart data={complexData} dataKey="revenue" />);

      const bar = screen.getByTestId('recharts-bar');
      expect(bar).toHaveAttribute('data-key', 'revenue');

      const chartComponent = screen.getByTestId('recharts-bar-chart');
      const chartData = JSON.parse(chartComponent.getAttribute('data-chart-data') || '[]');
      expect(chartData[0]).toEqual(complexData[0]);
    });

    it('handles single data point', () => {
      const singleData: BarChartData[] = [
        { name: 'Only Item', value: 50000 },
      ];

      render(<BarChart data={singleData} />);

      expect(screen.getByTestId('recharts-bar-chart')).toBeInTheDocument();

      const chartComponent = screen.getByTestId('recharts-bar-chart');
      const chartData = JSON.parse(chartComponent.getAttribute('data-chart-data') || '[]');
      expect(chartData).toHaveLength(1);
    });

    it('handles large datasets', () => {
      const largeData: BarChartData[] = Array.from({ length: 100 }, (_, i) => ({
        name: `Item ${i + 1}`,
        value: Math.random() * 100000,
      }));

      render(<BarChart data={largeData} />);

      expect(screen.getByTestId('recharts-bar-chart')).toBeInTheDocument();

      const chartComponent = screen.getByTestId('recharts-bar-chart');
      const chartData = JSON.parse(chartComponent.getAttribute('data-chart-data') || '[]');
      expect(chartData).toHaveLength(100);
    });
  });

  describe('Loading States', () => {
    it('shows loading state when loading is true', () => {
      render(<BarChart data={mockData} loading={true} />);

      expect(screen.getByText('Carregando dados...')).toBeInTheDocument();
      expect(screen.queryByTestId('recharts-bar-chart')).not.toBeInTheDocument();
    });

    it('shows chart when loading is false', () => {
      render(<BarChart data={mockData} loading={false} />);

      expect(screen.queryByText('Carregando dados...')).not.toBeInTheDocument();
      expect(screen.getByTestId('recharts-bar-chart')).toBeInTheDocument();
    });

    it('shows chart when loading is undefined', () => {
      render(<BarChart data={mockData} />);

      expect(screen.queryByText('Carregando dados...')).not.toBeInTheDocument();
      expect(screen.getByTestId('recharts-bar-chart')).toBeInTheDocument();
    });

    it('applies correct CSS classes to loading state', () => {
      render(<BarChart data={mockData} loading={true} />);

      const loadingContainer = screen.getByText('Carregando dados...').closest('div');
      expect(loadingContainer).toHaveClass(
        'flex',
        'items-center',
        'justify-center',
        'min-h-[300px]',
        'md:min-h-[400px]',
        'bg-white',
        'rounded-lg',
        'shadow'
      );
    });
  });

  describe('Empty State', () => {
    it('shows empty state when data is empty array', () => {
      render(<BarChart data={[]} />);

      expect(screen.getByText('Nenhum dado disponível')).toBeInTheDocument();
      expect(screen.queryByTestId('recharts-bar-chart')).not.toBeInTheDocument();
    });

    it('shows empty state when data is null', () => {
      render(<BarChart data={null as any} />);

      expect(screen.getByText('Nenhum dado disponível')).toBeInTheDocument();
      expect(screen.queryByTestId('recharts-bar-chart')).not.toBeInTheDocument();
    });

    it('shows empty state when data is undefined', () => {
      render(<BarChart data={undefined as any} />);

      expect(screen.getByText('Nenhum dado disponível')).toBeInTheDocument();
      expect(screen.queryByTestId('recharts-bar-chart')).not.toBeInTheDocument();
    });

    it('applies correct CSS classes to empty state', () => {
      render(<BarChart data={[]} />);

      const emptyContainer = screen.getByText('Nenhum dado disponível').closest('div');
      expect(emptyContainer).toHaveClass(
        'flex',
        'items-center',
        'justify-center',
        'min-h-[300px]',
        'md:min-h-[400px]',
        'bg-white',
        'rounded-lg',
        'shadow'
      );
    });
  });

  describe('Chart Configuration', () => {
    it('configures chart grid correctly', () => {
      render(<BarChart data={mockData} />);

      const grid = screen.getByTestId('recharts-grid');
      expect(grid).toHaveAttribute('data-dash', '3 3');
      expect(grid).toHaveAttribute('data-stroke', '#e2e8f0');
    });

    it('configures axis colors correctly', () => {
      render(<BarChart data={mockData} />);

      const xAxis = screen.getByTestId('recharts-x-axis');
      const yAxis = screen.getByTestId('recharts-y-axis');

      expect(xAxis).toHaveAttribute('data-stroke', '#64748b');
      expect(yAxis).toHaveAttribute('data-stroke', '#64748b');
    });

    it('configures tooltip styling', () => {
      render(<BarChart data={mockData} />);

      const tooltip = screen.getByTestId('recharts-tooltip');
      const style = JSON.parse(tooltip.getAttribute('data-style') || '{}');

      expect(style).toEqual({
        backgroundColor: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: '0.5rem'
      });
    });

    it('configures legend styling', () => {
      render(<BarChart data={mockData} />);

      const legend = screen.getByTestId('recharts-legend');
      const style = JSON.parse(legend.getAttribute('data-style') || '{}');

      expect(style).toEqual({
        paddingTop: '10px'
      });
    });

    it('configures responsive container correctly', () => {
      render(<BarChart data={mockData} height={500} />);

      const container = screen.getByTestId('recharts-responsive-container');
      expect(container).toHaveAttribute('data-width', '100%');
      expect(container).toHaveAttribute('data-height', '500');
    });
  });

  describe('Styling and CSS Classes', () => {
    it('applies correct CSS classes to chart container', () => {
      render(<BarChart data={mockData} />);

      const chartContainer = screen.getByTestId('recharts-responsive-container').closest('div');
      expect(chartContainer).toHaveClass(
        'bg-white',
        'p-4',
        'rounded-lg',
        'shadow',
        'min-h-[300px]',
        'md:min-h-[400px]'
      );
    });

    it('handles custom colors correctly', () => {
      const customColors = ['#ef4444', '#10b981', '#f59e0b', '#8b5cf6'];

      customColors.forEach((color) => {
        const { unmount } = render(<BarChart data={mockData} barColor={color} />);

        const bar = screen.getByTestId('recharts-bar');
        expect(bar).toHaveAttribute('data-fill', color);

        unmount();
      });
    });

    it('applies responsive height classes', () => {
      render(<BarChart data={mockData} />);

      const containers = document.querySelectorAll('.min-h-\\[300px\\].md\\:min-h-\\[400px\\]');
      expect(containers.length).toBeGreaterThan(0);
    });
  });

  describe('Integration with Mock Data', () => {
    it('works with product performance mock data', () => {
      render(<BarChart data={mockChartData.barChart} />);

      expect(screen.getByTestId('recharts-bar-chart')).toBeInTheDocument();

      const chartComponent = screen.getByTestId('recharts-bar-chart');
      const chartData = JSON.parse(chartComponent.getAttribute('data-chart-data') || '[]');

      expect(chartData).toEqual(mockChartData.barChart);
      expect(chartData[0]).toHaveProperty('name');
      expect(chartData[0]).toHaveProperty('revenue');
      expect(chartData[0]).toHaveProperty('unitsSold');
    });

    it('handles revenue data formatting', () => {
      const revenueData: BarChartData[] = [
        { name: 'Q1 2024', value: 1500000.75 },
        { name: 'Q2 2024', value: 2250000.50 },
        { name: 'Q3 2024', value: 1875000.25 },
      ];

      render(<BarChart data={revenueData} />);

      const chartComponent = screen.getByTestId('recharts-bar-chart');
      const chartData = JSON.parse(chartComponent.getAttribute('data-chart-data') || '[]');

      expect(chartData[0].value).toBe(1500000.75);
      expect(chartData[1].value).toBe(2250000.50);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('handles data with missing values gracefully', () => {
      const dataWithMissing: BarChartData[] = [
        { name: 'Complete', value: 100 },
        { name: 'Missing Value' } as any,
        { name: 'Zero Value', value: 0 },
        { name: 'Negative', value: -50 },
      ];

      render(<BarChart data={dataWithMissing} />);

      expect(screen.getByTestId('recharts-bar-chart')).toBeInTheDocument();
    });

    it('handles extremely large values', () => {
      const largeValueData: BarChartData[] = [
        { name: 'Small', value: 1000 },
        { name: 'Large', value: 999999999999 },
        { name: 'Extreme', value: Number.MAX_SAFE_INTEGER },
      ];

      render(<BarChart data={largeValueData} />);

      expect(screen.getByTestId('recharts-bar-chart')).toBeInTheDocument();
    });

    it('handles special numeric values', () => {
      const specialData: BarChartData[] = [
        { name: 'Zero', value: 0 },
        { name: 'Negative', value: -1000 },
        { name: 'Decimal', value: 1234.56 },
        { name: 'Scientific', value: 1.23e6 },
      ];

      render(<BarChart data={specialData} />);

      expect(screen.getByTestId('recharts-bar-chart')).toBeInTheDocument();
    });

    it('handles very long names', () => {
      const longNameData: BarChartData[] = [
        {
          name: 'This is an extremely long product name that might cause layout issues in the chart component',
          value: 50000
        },
        { name: 'Short', value: 30000 },
      ];

      render(<BarChart data={longNameData} />);

      expect(screen.getByTestId('recharts-bar-chart')).toBeInTheDocument();
    });

    it('handles special characters in names', () => {
      const specialCharData: BarChartData[] = [
        { name: 'Produto & Serviços', value: 25000 },
        { name: 'Items < $100', value: 15000 },
        { name: 'Produtos "Premium"', value: 35000 },
        { name: 'Itens 100% Novos', value: 45000 },
      ];

      render(<BarChart data={specialCharData} />);

      expect(screen.getByTestId('recharts-bar-chart')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('provides proper container structure for screen readers', () => {
      render(<BarChart data={mockData} />);

      const chartContainer = screen.getByTestId('recharts-responsive-container').closest('div');
      expect(chartContainer).toBeInTheDocument();
    });

    it('handles loading state accessibility', () => {
      render(<BarChart data={mockData} loading={true} />);

      const loadingText = screen.getByText('Carregando dados...');
      expect(loadingText).toBeInTheDocument();
      expect(loadingText).toHaveClass('text-slate-500');
    });

    it('handles empty state accessibility', () => {
      render(<BarChart data={[]} />);

      const emptyText = screen.getByText('Nenhum dado disponível');
      expect(emptyText).toBeInTheDocument();
      expect(emptyText).toHaveClass('text-slate-400');
    });
  });

  describe('Performance', () => {
    it('renders quickly with reasonable dataset', () => {
      const startTime = performance.now();

      render(<BarChart data={mockData} />);

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      // Should render in less than 50ms
      expect(renderTime).toBeLessThan(50);
    });

    it('handles rapid re-renders efficiently', () => {
      const { rerender } = render(<BarChart data={mockData} />);

      // Rapidly change props
      for (let i = 0; i < 20; i++) {
        rerender(
          <BarChart
            data={mockData}
            barColor={`#${Math.floor(Math.random() * 16777215).toString(16)}`}
            height={300 + i * 10}
          />
        );
      }

      // Should not crash
      expect(screen.getByTestId('recharts-bar-chart')).toBeInTheDocument();
    });
  });
});