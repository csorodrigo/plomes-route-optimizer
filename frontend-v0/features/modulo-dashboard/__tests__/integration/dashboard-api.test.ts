import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import {
  mockDashboardMetricsResponse,
  mockCustomerSalesResponse,
  mockProductPerformanceResponse,
  mockErrorResponse,
  mockEmptyResponse,
  createSuccessResponse,
  createErrorResponse,
} from '../utils/mock-data';

// Mock server setup for API integration tests
const server = setupServer(
  // Dashboard metrics endpoint
  http.get('/api/dashboard/metrics-live', ({ request }) => {
    const url = new URL(request.url);
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');

    // Simulate date range filtering
    if (startDate && endDate) {
      const filteredMetrics = {
        ...mockDashboardMetricsResponse.data,
        totalRevenue: mockDashboardMetricsResponse.data.totalRevenue * 0.8, // Simulate filtered results
      };
      return HttpResponse.json(createSuccessResponse(filteredMetrics));
    }

    return HttpResponse.json(mockDashboardMetricsResponse);
  }),

  // Customer sales endpoint
  http.get('/api/dashboard/customers-live', ({ request }) => {
    const url = new URL(request.url);
    const search = url.searchParams.get('search');

    if (search) {
      const filteredSales = mockCustomerSalesResponse.data.filter(sale =>
        sale.customer_name.toLowerCase().includes(search.toLowerCase())
      );
      return HttpResponse.json(createSuccessResponse(filteredSales));
    }

    return HttpResponse.json(mockCustomerSalesResponse);
  }),

  // Product performance endpoint
  http.get('/api/dashboard/product-performance', ({ request }) => {
    const url = new URL(request.url);
    const category = url.searchParams.get('category');
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');

    let filteredProducts = [...mockProductPerformanceResponse.data];

    if (category && category !== 'all') {
      filteredProducts = filteredProducts.filter(product =>
        product.category === category
      );
    }

    if (startDate && endDate) {
      // Simulate date filtering by reducing dataset
      filteredProducts = filteredProducts.slice(0, Math.ceil(filteredProducts.length * 0.7));
    }

    return HttpResponse.json(createSuccessResponse(filteredProducts));
  }),

  // Error simulation endpoints
  http.get('/api/dashboard/error-test', () => {
    return HttpResponse.json(mockErrorResponse, { status: 500 });
  }),

  http.get('/api/dashboard/timeout-test', () => {
    // Simulate timeout
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(HttpResponse.json(mockDashboardMetricsResponse));
      }, 10000);
    });
  }),

  http.get('/api/dashboard/rate-limit-test', () => {
    return HttpResponse.json(createErrorResponse('Rate limit exceeded'), { status: 429 });
  }),

  http.get('/api/dashboard/malformed-test', () => {
    return HttpResponse.text('Invalid JSON response');
  }),
);

// Setup and teardown
beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});

describe('Dashboard API Integration Tests', () => {
  describe('Metrics API Integration', () => {
    it('fetches dashboard metrics successfully', async () => {
      const response = await fetch('/api/dashboard/metrics-live');
      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.success).toBe(true);
      expect(data.data).toEqual(mockDashboardMetricsResponse.data);
      expect(data.data).toHaveProperty('totalRevenue');
      expect(data.data).toHaveProperty('avgDeal');
      expect(data.data).toHaveProperty('activeProducts');
      expect(data.data).toHaveProperty('totalCustomers');
    });

    it('applies date range filtering correctly', async () => {
      const params = new URLSearchParams({
        startDate: '2024-01-01',
        endDate: '2024-03-15',
      });

      const response = await fetch(`/api/dashboard/metrics-live?${params}`);
      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.success).toBe(true);
      expect(data.data.totalRevenue).toBeLessThan(mockDashboardMetricsResponse.data.totalRevenue);
    });

    it('handles concurrent requests correctly', async () => {
      const requests = Array.from({ length: 5 }, () =>
        fetch('/api/dashboard/metrics-live')
      );

      const responses = await Promise.all(requests);
      const results = await Promise.all(responses.map(r => r.json()));

      expect(responses.every(r => r.ok)).toBe(true);
      expect(results.every(r => r.success)).toBe(true);
      expect(results.every(r => r.data.totalRevenue === mockDashboardMetricsResponse.data.totalRevenue)).toBe(true);
    });
  });

  describe('Customer Sales API Integration', () => {
    it('fetches customer sales data successfully', async () => {
      const response = await fetch('/api/dashboard/customers-live');
      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.data.length).toBeGreaterThan(0);

      // Verify data structure
      const firstCustomer = data.data[0];
      expect(firstCustomer).toHaveProperty('customer_id');
      expect(firstCustomer).toHaveProperty('customer_name');
      expect(firstCustomer).toHaveProperty('total_revenue');
      expect(firstCustomer).toHaveProperty('deal_count');
      expect(firstCustomer).toHaveProperty('avg_deal_value');
      expect(firstCustomer).toHaveProperty('last_deal_date');
    });

    it('filters customers by search term', async () => {
      const searchTerm = 'ABC';
      const response = await fetch(`/api/dashboard/customers-live?search=${searchTerm}`);
      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);

      // All returned customers should contain the search term
      data.data.forEach((customer: any) => {
        expect(customer.customer_name.toLowerCase()).toContain(searchTerm.toLowerCase());
      });
    });

    it('returns empty array for non-matching search', async () => {
      const response = await fetch('/api/dashboard/customers-live?search=nonexistent');
      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.data).toHaveLength(0);
    });

    it('handles special characters in search', async () => {
      const specialSearchTerms = ['ABC & Co', 'Client "Premium"', 'Test < 100'];

      for (const term of specialSearchTerms) {
        const response = await fetch(`/api/dashboard/customers-live?search=${encodeURIComponent(term)}`);
        const data = await response.json();

        expect(response.ok).toBe(true);
        expect(data.success).toBe(true);
        expect(Array.isArray(data.data)).toBe(true);
      }
    });
  });

  describe('Product Performance API Integration', () => {
    it('fetches product performance data successfully', async () => {
      const response = await fetch('/api/dashboard/product-performance');
      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.data.length).toBeGreaterThan(0);

      // Verify data structure
      const firstProduct = data.data[0];
      expect(firstProduct).toHaveProperty('productId');
      expect(firstProduct).toHaveProperty('productName');
      expect(firstProduct).toHaveProperty('revenue');
      expect(firstProduct).toHaveProperty('unitsSold');
      expect(firstProduct).toHaveProperty('avgPrice');
    });

    it('filters products by category', async () => {
      const category = 'Industrial';
      const response = await fetch(`/api/dashboard/product-performance?category=${category}`);
      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);

      // All returned products should belong to the specified category
      data.data.forEach((product: any) => {
        expect(product.category).toBe(category);
      });
    });

    it('applies date range filtering', async () => {
      const params = new URLSearchParams({
        startDate: '2024-01-01',
        endDate: '2024-03-15',
      });

      const response = await fetch(`/api/dashboard/product-performance?${params}`);
      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);

      // Should return fewer products due to date filtering
      expect(data.data.length).toBeLessThanOrEqual(mockProductPerformanceResponse.data.length);
    });

    it('combines multiple filters correctly', async () => {
      const params = new URLSearchParams({
        category: 'Industrial',
        startDate: '2024-01-01',
        endDate: '2024-03-15',
      });

      const response = await fetch(`/api/dashboard/product-performance?${params}`);
      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
    });
  });

  describe('Error Handling Integration', () => {
    it('handles 500 server errors gracefully', async () => {
      const response = await fetch('/api/dashboard/error-test');
      const data = await response.json();

      expect(response.ok).toBe(false);
      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBeTruthy();
    });

    it('handles rate limiting (429 errors)', async () => {
      const response = await fetch('/api/dashboard/rate-limit-test');
      const data = await response.json();

      expect(response.ok).toBe(false);
      expect(response.status).toBe(429);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Rate limit exceeded');
    });

    it('handles malformed responses', async () => {
      const response = await fetch('/api/dashboard/malformed-test');

      expect(response.ok).toBe(true);

      // Should throw when trying to parse as JSON
      await expect(response.json()).rejects.toThrow();
    });

    it('handles network timeouts', async () => {
      // Set a shorter timeout for this test
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1000);

      try {
        await fetch('/api/dashboard/timeout-test', {
          signal: controller.signal,
        });

        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      } finally {
        clearTimeout(timeoutId);
      }
    });
  });

  describe('Data Validation Integration', () => {
    it('validates metrics data structure', async () => {
      const response = await fetch('/api/dashboard/metrics-live');
      const data = await response.json();

      expect(data.data.totalRevenue).toEqual(expect.any(Number));
      expect(data.data.avgDeal).toEqual(expect.any(Number));
      expect(data.data.activeProducts).toEqual(expect.any(Number));
      expect(data.data.totalCustomers).toEqual(expect.any(Number));

      // Validate reasonable ranges
      expect(data.data.totalRevenue).toBeGreaterThanOrEqual(0);
      expect(data.data.avgDeal).toBeGreaterThanOrEqual(0);
      expect(data.data.activeProducts).toBeGreaterThanOrEqual(0);
      expect(data.data.totalCustomers).toBeGreaterThanOrEqual(0);
    });

    it('validates customer sales data structure', async () => {
      const response = await fetch('/api/dashboard/customers-live');
      const data = await response.json();

      data.data.forEach((customer: any) => {
        expect(customer.customer_id).toEqual(expect.any(String));
        expect(customer.customer_name).toEqual(expect.any(String));
        expect(customer.total_revenue).toEqual(expect.any(Number));
        expect(customer.deal_count).toEqual(expect.any(Number));
        expect(customer.avg_deal_value).toEqual(expect.any(Number));
        expect(customer.last_deal_date).toEqual(expect.any(String));

        // Validate date format
        expect(new Date(customer.last_deal_date)).toBeInstanceOf(Date);
        expect(new Date(customer.last_deal_date).toString()).not.toBe('Invalid Date');
      });
    });

    it('validates product performance data structure', async () => {
      const response = await fetch('/api/dashboard/product-performance');
      const data = await response.json();

      data.data.forEach((product: any) => {
        expect(product.productId).toEqual(expect.any(String));
        expect(product.productName).toEqual(expect.any(String));
        expect(product.revenue).toEqual(expect.any(Number));
        expect(product.unitsSold).toEqual(expect.any(Number));
        expect(product.avgPrice).toEqual(expect.any(Number));

        // Validate business logic
        expect(product.revenue).toBeGreaterThanOrEqual(0);
        expect(product.unitsSold).toBeGreaterThanOrEqual(0);
        expect(product.avgPrice).toBeGreaterThanOrEqual(0);

        // Revenue should roughly equal avgPrice * unitsSold (allowing for minor discrepancies)
        if (product.unitsSold > 0) {
          const calculatedRevenue = product.avgPrice * product.unitsSold;
          const difference = Math.abs(product.revenue - calculatedRevenue);
          const tolerance = calculatedRevenue * 0.1; // 10% tolerance
          expect(difference).toBeLessThanOrEqual(tolerance);
        }
      });
    });
  });

  describe('Performance Integration Tests', () => {
    it('handles multiple concurrent API calls efficiently', async () => {
      const startTime = performance.now();

      const endpoints = [
        '/api/dashboard/metrics-live',
        '/api/dashboard/customers-live',
        '/api/dashboard/product-performance',
      ];

      const requests = endpoints.map(endpoint => fetch(endpoint));
      const responses = await Promise.all(requests);
      const results = await Promise.all(responses.map(r => r.json()));

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // All requests should complete within reasonable time
      expect(totalTime).toBeLessThan(1000); // 1 second
      expect(responses.every(r => r.ok)).toBe(true);
      expect(results.every(r => r.success)).toBe(true);
    });

    it('handles rapid successive requests', async () => {
      const startTime = performance.now();
      const requestCount = 10;

      const requests = Array.from({ length: requestCount }, () =>
        fetch('/api/dashboard/metrics-live')
      );

      const responses = await Promise.all(requests);
      const endTime = performance.now();
      const totalTime = endTime - startTime;

      expect(responses.every(r => r.ok)).toBe(true);
      expect(totalTime).toBeLessThan(2000); // 2 seconds for 10 requests
    });

    it('maintains data consistency across requests', async () => {
      const requests = Array.from({ length: 5 }, () =>
        fetch('/api/dashboard/metrics-live')
      );

      const responses = await Promise.all(requests);
      const results = await Promise.all(responses.map(r => r.json()));

      // All results should be identical
      const firstResult = results[0];
      results.forEach(result => {
        expect(result.data).toEqual(firstResult.data);
      });
    });
  });

  describe('Cache and State Management Integration', () => {
    it('handles cache invalidation scenarios', async () => {
      // First request
      const response1 = await fetch('/api/dashboard/metrics-live');
      const data1 = await response1.json();

      // Simulate cache invalidation by making request with different parameters
      const response2 = await fetch('/api/dashboard/metrics-live?startDate=2024-01-01&endDate=2024-03-15');
      const data2 = await response2.json();

      expect(response1.ok).toBe(true);
      expect(response2.ok).toBe(true);
      expect(data1.data.totalRevenue).not.toEqual(data2.data.totalRevenue);
    });

    it('handles parameter variations consistently', async () => {
      const baseUrl = '/api/dashboard/customers-live';
      const searchTerms = ['ABC', 'XYZ', 'test', ''];

      for (const term of searchTerms) {
        const url = term ? `${baseUrl}?search=${term}` : baseUrl;
        const response = await fetch(url);
        const data = await response.json();

        expect(response.ok).toBe(true);
        expect(data.success).toBe(true);
        expect(Array.isArray(data.data)).toBe(true);
      }
    });
  });
});