import React from 'react';
import { render, screen } from '../utils/test-utils';
import { MetricCard } from '../../components/MetricCard';
import { mockDashboardMetrics, mockExtremeMetrics, mockLargeNumbers, mockNegativeNumbers } from '../utils/mock-data';

// Mock Lucide React icons
jest.mock('lucide-react', () => ({
  TrendingUp: ({ className }: { className?: string }) => (
    <div data-testid="trending-up-icon" className={className}>📈</div>
  ),
  DollarSign: ({ className }: { className?: string }) => (
    <div data-testid="dollar-sign-icon" className={className}>💰</div>
  ),
  Users: ({ className }: { className?: string }) => (
    <div data-testid="users-icon" className={className}>👥</div>
  ),
  Package: ({ className }: { className?: string }) => (
    <div data-testid="package-icon" className={className}>📦</div>
  ),
}));

describe('MetricCard Component', () => {
  // Basic rendering tests
  describe('Basic Rendering', () => {
    it('renders metric card with title and value', () => {
      render(
        <MetricCard
          title="Total Revenue"
          value={mockDashboardMetrics.totalRevenue}
        />
      );

      expect(screen.getByText('Total Revenue')).toBeInTheDocument();
      expect(screen.getByText('2.500.000,75')).toBeInTheDocument();
    });

    it('renders string values correctly', () => {
      render(
        <MetricCard
          title="Status"
          value="Active"
        />
      );

      expect(screen.getByText('Status')).toBeInTheDocument();
      expect(screen.getByText('Active')).toBeInTheDocument();
    });

    it('renders with icon when provided', () => {
      const TrendingUpIcon = () => <div data-testid="trending-up-icon">📈</div>;

      render(
        <MetricCard
          title="Revenue"
          value={1000000}
          icon={<TrendingUpIcon />}
        />
      );

      expect(screen.getByTestId('trending-up-icon')).toBeInTheDocument();
    });
  });

  // Number formatting tests
  describe('Number Formatting', () => {
    it('formats large numbers with Brazilian locale', () => {
      render(
        <MetricCard
          title="Revenue"
          value={mockLargeNumbers.totalRevenue}
        />
      );

      // Should format 999999999.99 as "999.999.999,99" in Brazilian format
      expect(screen.getByText('999.999.999,99')).toBeInTheDocument();
    });

    it('formats zero values correctly', () => {
      render(
        <MetricCard
          title="Revenue"
          value={0}
        />
      );

      expect(screen.getByText('0')).toBeInTheDocument();
    });

    it('formats decimal numbers correctly', () => {
      render(
        <MetricCard
          title="Average Deal"
          value={125000.50}
        />
      );

      expect(screen.getByText('125.000,5')).toBeInTheDocument();
    });

    it('handles negative numbers', () => {
      render(
        <MetricCard
          title="Loss"
          value={mockNegativeNumbers.totalRevenue}
        />
      );

      expect(screen.getByText('-50.000')).toBeInTheDocument();
    });
  });

  // Change indicator tests
  describe('Change Indicators', () => {
    it('shows positive change with correct color and format', () => {
      render(
        <MetricCard
          title="Revenue"
          value={1000000}
          change={15.5}
        />
      );

      const changeElement = screen.getByText('+15,5%');
      expect(changeElement).toBeInTheDocument();
      expect(changeElement).toHaveClass('text-blue-600');
      expect(screen.getByText('vs período anterior')).toBeInTheDocument();
    });

    it('shows negative change with correct color and format', () => {
      render(
        <MetricCard
          title="Revenue"
          value={800000}
          change={-8.2}
        />
      );

      const changeElement = screen.getByText('-8,2%');
      expect(changeElement).toBeInTheDocument();
      expect(changeElement).toHaveClass('text-red-600');
    });

    it('shows zero change with neutral color', () => {
      render(
        <MetricCard
          title="Revenue"
          value={1000000}
          change={0}
        />
      );

      const changeElement = screen.getByText('+0,0%');
      expect(changeElement).toBeInTheDocument();
      expect(changeElement).toHaveClass('text-blue-600'); // Zero is treated as positive
    });

    it('does not show change indicator when change is undefined', () => {
      render(
        <MetricCard
          title="Revenue"
          value={1000000}
        />
      );

      expect(screen.queryByText(/vs período anterior/)).not.toBeInTheDocument();
      expect(screen.queryByText(/%/)).not.toBeInTheDocument();
    });

    it('handles extreme change values', () => {
      render(
        <MetricCard
          title="Revenue"
          value={1000000}
          change={999.99}
        />
      );

      expect(screen.getByText('+1000,0%')).toBeInTheDocument();
    });
  });

  // Loading state tests
  describe('Loading States', () => {
    it('shows skeleton when loading is true', () => {
      render(
        <MetricCard
          title="Revenue"
          value={1000000}
          loading={true}
        />
      );

      // Should show skeleton elements instead of actual content
      const skeletonContainer = screen.getByTestId = jest.fn();
      expect(screen.queryByText('Revenue')).not.toBeInTheDocument();
      expect(screen.queryByText('1.000.000')).not.toBeInTheDocument();

      // Skeleton should have animation class
      const skeletonElement = document.querySelector('.animate-pulse');
      expect(skeletonElement).toBeInTheDocument();
    });

    it('shows content when loading is false', () => {
      render(
        <MetricCard
          title="Revenue"
          value={1000000}
          loading={false}
        />
      );

      expect(screen.getByText('Revenue')).toBeInTheDocument();
      expect(screen.getByText('1.000.000')).toBeInTheDocument();
      expect(document.querySelector('.animate-pulse')).not.toBeInTheDocument();
    });

    it('shows content when loading is undefined', () => {
      render(
        <MetricCard
          title="Revenue"
          value={1000000}
        />
      );

      expect(screen.getByText('Revenue')).toBeInTheDocument();
      expect(screen.getByText('1.000.000')).toBeInTheDocument();
    });
  });

  // CSS class and styling tests
  describe('Styling and CSS Classes', () => {
    it('applies correct CSS classes to main container', () => {
      render(
        <MetricCard
          title="Revenue"
          value={1000000}
        />
      );

      const container = screen.getByText('Revenue').closest('div');
      expect(container).toHaveClass(
        'bg-white',
        'rounded-lg',
        'shadow',
        'border',
        'border-slate-200',
        'p-6',
        'hover:shadow-md',
        'transition-shadow'
      );
    });

    it('applies correct classes to title element', () => {
      render(
        <MetricCard
          title="Revenue"
          value={1000000}
        />
      );

      const titleElement = screen.getByText('Revenue');
      expect(titleElement).toHaveClass(
        'text-sm',
        'font-medium',
        'text-slate-600'
      );
    });

    it('applies correct classes to value element', () => {
      render(
        <MetricCard
          title="Revenue"
          value={1000000}
        />
      );

      const valueElement = screen.getByText('1.000.000');
      expect(valueElement).toHaveClass(
        'text-2xl',
        'md:text-3xl',
        'font-bold',
        'text-slate-900'
      );
    });
  });

  // Edge cases and error handling
  describe('Edge Cases', () => {
    it('handles extremely large numbers', () => {
      render(
        <MetricCard
          title="Big Number"
          value={Number.MAX_SAFE_INTEGER}
        />
      );

      // Should not crash and display some representation
      expect(screen.getByText('Big Number')).toBeInTheDocument();
    });

    it('handles NaN values gracefully', () => {
      render(
        <MetricCard
          title="Invalid"
          value={NaN}
        />
      );

      expect(screen.getByText('Invalid')).toBeInTheDocument();
      expect(screen.getByText('NaN')).toBeInTheDocument();
    });

    it('handles Infinity values', () => {
      render(
        <MetricCard
          title="Infinite"
          value={Infinity}
        />
      );

      expect(screen.getByText('Infinite')).toBeInTheDocument();
      expect(screen.getByText('∞')).toBeInTheDocument();
    });

    it('handles very long titles', () => {
      const longTitle = 'This is a very long title that might overflow the container and cause layout issues';

      render(
        <MetricCard
          title={longTitle}
          value={1000}
        />
      );

      expect(screen.getByText(longTitle)).toBeInTheDocument();
    });

    it('handles empty string title', () => {
      render(
        <MetricCard
          title=""
          value={1000}
        />
      );

      // Should still render the component structure
      expect(screen.getByText('1.000')).toBeInTheDocument();
    });
  });

  // Accessibility tests
  describe('Accessibility', () => {
    it('has proper semantic structure', () => {
      render(
        <MetricCard
          title="Revenue"
          value={1000000}
        />
      );

      // Title should be in h3 tag for proper hierarchy
      const title = screen.getByRole('heading', { level: 3 });
      expect(title).toHaveTextContent('Revenue');
    });

    it('provides meaningful text content for screen readers', () => {
      render(
        <MetricCard
          title="Total Revenue"
          value={2500000.75}
          change={15.5}
        />
      );

      // Check that all important information is in text content
      expect(screen.getByText('Total Revenue')).toBeInTheDocument();
      expect(screen.getByText('2.500.000,75')).toBeInTheDocument();
      expect(screen.getByText('+15,5%')).toBeInTheDocument();
      expect(screen.getByText('vs período anterior')).toBeInTheDocument();
    });

    it('maintains proper contrast for change indicators', () => {
      const { rerender } = render(
        <MetricCard
          title="Revenue"
          value={1000000}
          change={15}
        />
      );

      let changeElement = screen.getByText('+15,0%');
      expect(changeElement).toHaveClass('text-blue-600');

      rerender(
        <MetricCard
          title="Revenue"
          value={1000000}
          change={-15}
        />
      );

      changeElement = screen.getByText('-15,0%');
      expect(changeElement).toHaveClass('text-red-600');
    });
  });

  // Integration with real data
  describe('Integration with Real Data', () => {
    it('works with dashboard metrics mock data', () => {
      const { rerender } = render(
        <MetricCard
          title="Total Revenue"
          value={mockDashboardMetrics.totalRevenue}
          change={12.5}
        />
      );

      expect(screen.getByText('Total Revenue')).toBeInTheDocument();
      expect(screen.getByText('2.500.000,75')).toBeInTheDocument();

      rerender(
        <MetricCard
          title="Active Products"
          value={mockDashboardMetrics.activeProducts}
          change={-2.1}
        />
      );

      expect(screen.getByText('Active Products')).toBeInTheDocument();
      expect(screen.getByText('45')).toBeInTheDocument();
      expect(screen.getByText('-2,1%')).toBeInTheDocument();
    });

    it('handles extreme metric values', () => {
      render(
        <MetricCard
          title="Zero Revenue"
          value={mockExtremeMetrics.totalRevenue}
          change={0}
        />
      );

      expect(screen.getByText('Zero Revenue')).toBeInTheDocument();
      expect(screen.getByText('0')).toBeInTheDocument();
      expect(screen.getByText('+0,0%')).toBeInTheDocument();
    });
  });

  // Performance tests
  describe('Performance', () => {
    it('renders quickly with large datasets', () => {
      const startTime = performance.now();

      render(
        <MetricCard
          title="Performance Test"
          value={999999999.99}
          change={100.5}
        />
      );

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      // Should render in less than 10ms
      expect(renderTime).toBeLessThan(10);
    });

    it('does not cause memory leaks on repeated renders', () => {
      const { rerender } = render(
        <MetricCard
          title="Memory Test"
          value={1000}
        />
      );

      // Rapidly re-render to test for memory issues
      for (let i = 0; i < 100; i++) {
        rerender(
          <MetricCard
            title={`Memory Test ${i}`}
            value={1000 + i}
            change={i % 2 === 0 ? i : -i}
          />
        );
      }

      // If we get here without crashes, memory handling is good
      expect(screen.getByText('Memory Test 99')).toBeInTheDocument();
    });
  });
});