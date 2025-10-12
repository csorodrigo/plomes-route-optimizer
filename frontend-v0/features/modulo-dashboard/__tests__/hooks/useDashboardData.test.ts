import { renderHook, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';
import React from 'react';
import {
  useDashboardMetrics,
  useCustomerSales,
  useProductPerformance,
  usePricingHistory,
  useRefreshAll,
} from '../../hooks/useDashboardData';
import {
  mockDashboardMetricsResponse,
  mockCustomerSalesResponse,
  mockProductPerformanceResponse,
  mockPricingHistoryResponse,
  mockErrorResponse,
  mockEmptyResponse,
  mockNetworkConditions,
  createSuccessResponse,
  createErrorResponse,
} from '../utils/mock-data';
import { mockFetch, clearAllMocks } from '../utils/test-utils';

// Mock the Ploomes client
jest.mock('@/lib/ploomes-client', () => ({
  ploomesClient: {
    getDeals: jest.fn(),
    getDealProducts: jest.fn(),
    getContacts: jest.fn(),
  },
}));

// SWR wrapper for testing
const swrWrapper = ({ children }: { children: React.ReactNode }) => (
  <SWRConfig value={{
    dedupingInterval: 0,
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    shouldRetryOnError: false,
    fallbackData: undefined,
  }}>
    {children}
  </SWRConfig>
);

describe('Dashboard Data Hooks', () => {
  beforeEach(() => {
    clearAllMocks();
    // Reset any cached SWR data
    if (typeof window !== 'undefined') {
      // Clear any localStorage or sessionStorage if used by SWR
      window.localStorage.clear();
    }
  });

  afterEach(() => {
    clearAllMocks();
  });

  describe('useDashboardMetrics', () => {
    it('fetches dashboard metrics successfully', async () => {
      mockFetch({
        '/api/dashboard/metrics-live': mockDashboardMetricsResponse,
      });

      const { result } = renderHook(() => useDashboardMetrics(), {
        wrapper: swrWrapper,
      });

      // Initially loading
      expect(result.current.isLoading).toBe(true);
      expect(result.current.metrics).toBeUndefined();

      // Wait for data to load
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.metrics).toEqual(mockDashboardMetricsResponse.data);
      expect(result.current.isError).toBeFalsy();
      expect(result.current.source).toBe('ploomes_live_api');
    });

    it('handles API errors gracefully', async () => {
      mockFetch({
        '/api/dashboard/metrics-live': mockErrorResponse,
      });

      global.fetch = jest.fn().mockRejectedValue(new Error('API Error'));

      const { result } = renderHook(() => useDashboardMetrics(), {
        wrapper: swrWrapper,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isError).toBeTruthy();
      expect(result.current.metrics).toBeUndefined();
    });

    it('includes date range in API request', async () => {
      const dateRange = {
        startDate: '2024-01-01',
        endDate: '2024-03-15',
      };

      mockFetch({
        '/api/dashboard/metrics-live?startDate=2024-01-01&endDate=2024-03-15': mockDashboardMetricsResponse,
      });

      renderHook(() => useDashboardMetrics(dateRange), {
        wrapper: swrWrapper,
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('startDate=2024-01-01&endDate=2024-03-15')
        );
      });
    });

    it('provides refresh functionality', async () => {
      mockFetch({
        '/api/dashboard/metrics-live': mockDashboardMetricsResponse,
      });

      const { result } = renderHook(() => useDashboardMetrics(), {
        wrapper: swrWrapper,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(typeof result.current.refresh).toBe('function');

      // Clear mock and set new response
      clearAllMocks();
      const updatedMetrics = createSuccessResponse({
        ...mockDashboardMetricsResponse.data,
        totalRevenue: 3000000,
      });

      mockFetch({
        '/api/dashboard/metrics-live': updatedMetrics,
      });

      // Trigger refresh
      await result.current.refresh();

      await waitFor(() => {
        expect(result.current.metrics?.totalRevenue).toBe(3000000);
      });
    });

    it('handles network timeouts', async () => {
      global.fetch = jest.fn().mockImplementation(() =>
        mockNetworkConditions.timeout()
      );

      const { result } = renderHook(() => useDashboardMetrics(), {
        wrapper: swrWrapper,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isError).toBeTruthy();
    });
  });

  describe('useCustomerSales', () => {
    it('fetches customer sales data successfully', async () => {
      mockFetch({
        '/api/dashboard/customers-live': mockCustomerSalesResponse,
      });

      const { result } = renderHook(() => useCustomerSales(), {
        wrapper: swrWrapper,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.sales).toEqual(mockCustomerSalesResponse.data);
      expect(result.current.isError).toBeFalsy();
    });

    it('includes search parameter in API request', async () => {
      const searchTerm = 'ABC';
      mockFetch({
        [`/api/dashboard/customers-live?search=${searchTerm}`]: mockCustomerSalesResponse,
      });

      renderHook(() => useCustomerSales(undefined, searchTerm), {
        wrapper: swrWrapper,
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining(`search=${searchTerm}`)
        );
      });
    });

    it('handles empty search results', async () => {
      mockFetch({
        '/api/dashboard/customers-live?search=nonexistent': mockEmptyResponse,
      });

      const { result } = renderHook(() => useCustomerSales(undefined, 'nonexistent'), {
        wrapper: swrWrapper,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.sales).toEqual([]);
      expect(result.current.isError).toBeFalsy();
    });

    it('debounces search requests properly', async () => {
      jest.useFakeTimers();

      mockFetch({
        '/api/dashboard/customers-live?search=ABC': mockCustomerSalesResponse,
      });

      const { rerender } = renderHook(
        ({ search }) => useCustomerSales(undefined, search),
        {
          wrapper: swrWrapper,
          initialProps: { search: 'A' },
        }
      );

      // Rapidly change search term
      rerender({ search: 'AB' });
      rerender({ search: 'ABC' });

      // Fast-forward time
      jest.advanceTimersByTime(300);

      await waitFor(() => {
        // Should only make final request
        expect(global.fetch).toHaveBeenCalledTimes(1);
      });

      jest.useRealTimers();
    });
  });

  describe('useProductPerformance', () => {
    it('fetches product performance data successfully', async () => {
      mockFetch({
        '/api/dashboard/product-performance': mockProductPerformanceResponse,
      });

      const { result } = renderHook(() => useProductPerformance(), {
        wrapper: swrWrapper,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.products).toEqual(mockProductPerformanceResponse.data);
      expect(result.current.isError).toBeFalsy();
    });

    it('includes category filter in API request', async () => {
      const category = 'Industrial';
      mockFetch({
        [`/api/dashboard/product-performance?category=${category}`]: mockProductPerformanceResponse,
      });

      renderHook(() => useProductPerformance(undefined, category), {
        wrapper: swrWrapper,
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining(`category=${category}`)
        );
      });
    });

    it('includes date range parameters', async () => {
      const dateRange = {
        startDate: '2024-01-01',
        endDate: '2024-03-15',
      };

      mockFetch({
        '/api/dashboard/product-performance?startDate=2024-01-01&endDate=2024-03-15': mockProductPerformanceResponse,
      });

      renderHook(() => useProductPerformance(dateRange), {
        wrapper: swrWrapper,
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('startDate=2024-01-01&endDate=2024-03-15')
        );
      });
    });
  });

  describe('usePricingHistory', () => {
    // Mock the Ploomes client
    const mockPloomesClient = require('@/lib/ploomes-client').ploomesClient;

    beforeEach(() => {
      mockPloomesClient.getDeals.mockResolvedValue([
        {
          Id: 'D001',
          Title: 'Deal 1',
          Amount: 50000,
          CreatedDate: '2024-03-15T10:30:00Z',
          ContactId: '1',
        },
      ]);

      mockPloomesClient.getDealProducts.mockResolvedValue([
        {
          Product: {
            Id: 'P001',
            Name: 'Product A',
            Price: 25000,
          },
          UnitPrice: 30000,
          Quantity: 2,
        },
      ]);
    });

    it('fetches pricing history successfully', async () => {
      const { result } = renderHook(() => usePricingHistory('P001'), {
        wrapper: swrWrapper,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.history).toBeDefined();
      expect(result.current.productSummary).toBeDefined();
      expect(mockPloomesClient.getDeals).toHaveBeenCalled();
    });

    it('does not fetch when no parameters provided', () => {
      const { result } = renderHook(() => usePricingHistory(), {
        wrapper: swrWrapper,
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.history).toEqual([]);
      expect(mockPloomesClient.getDeals).not.toHaveBeenCalled();
    });

    it('filters by customer ID when provided', async () => {
      const customerId = '123';

      renderHook(() => usePricingHistory(undefined, customerId), {
        wrapper: swrWrapper,
      });

      await waitFor(() => {
        expect(mockPloomesClient.getDeals).toHaveBeenCalledWith(
          expect.objectContaining({
            filter: expect.stringContaining(`ContactId eq ${customerId}`),
          })
        );
      });
    });

    it('handles API errors gracefully', async () => {
      mockPloomesClient.getDeals.mockRejectedValue(new Error('API Error'));

      const { result } = renderHook(() => usePricingHistory('P001'), {
        wrapper: swrWrapper,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isError).toBeTruthy();
    });
  });

  describe('useRefreshAll', () => {
    it('refreshes all dashboard data hooks', async () => {
      mockFetch({
        '/api/dashboard/metrics-live': mockDashboardMetricsResponse,
        '/api/dashboard/customers-live': mockCustomerSalesResponse,
        '/api/dashboard/product-performance': mockProductPerformanceResponse,
      });

      const { result } = renderHook(() => {
        const metrics = useDashboardMetrics();
        const sales = useCustomerSales();
        const products = useProductPerformance();
        const refreshAll = useRefreshAll();

        return { metrics, sales, products, refreshAll };
      }, {
        wrapper: swrWrapper,
      });

      // Wait for initial data load
      await waitFor(() => {
        expect(result.current.metrics.isLoading).toBe(false);
        expect(result.current.sales.isLoading).toBe(false);
        expect(result.current.products.isLoading).toBe(false);
      });

      // Clear fetch mock and set new responses
      clearAllMocks();
      mockFetch({
        '/api/dashboard/metrics-live': createSuccessResponse({ totalRevenue: 3000000, avgDeal: 150000, activeProducts: 50, totalCustomers: 150 }),
        '/api/dashboard/customers-live': createSuccessResponse([]),
        '/api/dashboard/product-performance': createSuccessResponse([]),
      });

      // Trigger refresh all
      await result.current.refreshAll.refreshAll();

      // Verify all endpoints were called
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(3);
      });
    });
  });

  describe('Error Boundary Integration', () => {
    it('handles malformed API responses', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ malformed: 'data' }),
      });

      const { result } = renderHook(() => useDashboardMetrics(), {
        wrapper: swrWrapper,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should handle gracefully without crashing
      expect(result.current.metrics).toBeDefined();
    });

    it('handles network connectivity issues', async () => {
      global.fetch = jest.fn().mockImplementation(() =>
        mockNetworkConditions.offline()
      );

      const { result } = renderHook(() => useDashboardMetrics(), {
        wrapper: swrWrapper,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isError).toBeTruthy();
    });
  });

  describe('Performance and Caching', () => {
    it('caches responses appropriately', async () => {
      mockFetch({
        '/api/dashboard/metrics-live': mockDashboardMetricsResponse,
      });

      // First render
      const { result: result1 } = renderHook(() => useDashboardMetrics(), {
        wrapper: swrWrapper,
      });

      await waitFor(() => {
        expect(result1.current.isLoading).toBe(false);
      });

      // Second render with same parameters
      const { result: result2 } = renderHook(() => useDashboardMetrics(), {
        wrapper: swrWrapper,
      });

      // Should use cached data
      expect(result2.current.isLoading).toBe(false);
      expect(result2.current.metrics).toEqual(result1.current.metrics);
    });

    it('handles rapid successive requests', async () => {
      mockFetch({
        '/api/dashboard/metrics-live': mockDashboardMetricsResponse,
      });

      // Render multiple instances rapidly
      const hooks = Array.from({ length: 5 }, () =>
        renderHook(() => useDashboardMetrics(), { wrapper: swrWrapper })
      );

      // Wait for all to complete
      await Promise.all(
        hooks.map(({ result }) =>
          waitFor(() => expect(result.current.isLoading).toBe(false))
        )
      );

      // Should deduplicate requests
      expect(global.fetch).toHaveBeenCalledTimes(1);

      // All should have same data
      const firstResult = hooks[0].result.current.metrics;
      hooks.forEach(({ result }) => {
        expect(result.current.metrics).toEqual(firstResult);
      });
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    it('handles extremely large datasets', async () => {
      const largeDataset = Array.from({ length: 10000 }, (_, i) => ({
        customer_id: `customer_${i}`,
        customer_name: `Customer ${i}`,
        total_revenue: Math.random() * 1000000,
        deal_count: Math.floor(Math.random() * 20),
        avg_deal_value: Math.random() * 100000,
        last_deal_date: new Date().toISOString(),
      }));

      mockFetch({
        '/api/dashboard/customers-live': createSuccessResponse(largeDataset),
      });

      const { result } = renderHook(() => useCustomerSales(), {
        wrapper: swrWrapper,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.sales).toHaveLength(10000);
    });

    it('handles concurrent hook usage', async () => {
      mockFetch({
        '/api/dashboard/metrics-live': mockDashboardMetricsResponse,
        '/api/dashboard/customers-live': mockCustomerSalesResponse,
        '/api/dashboard/product-performance': mockProductPerformanceResponse,
      });

      const { result } = renderHook(() => ({
        metrics: useDashboardMetrics(),
        sales: useCustomerSales(),
        products: useProductPerformance(),
      }), {
        wrapper: swrWrapper,
      });

      await waitFor(() => {
        expect(result.current.metrics.isLoading).toBe(false);
        expect(result.current.sales.isLoading).toBe(false);
        expect(result.current.products.isLoading).toBe(false);
      });

      expect(result.current.metrics.metrics).toBeDefined();
      expect(result.current.sales.sales).toBeDefined();
      expect(result.current.products.products).toBeDefined();
    });
  });
});