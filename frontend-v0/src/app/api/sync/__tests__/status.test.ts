import { GET } from '../status/route';
import { supabase } from '@/lib/supabase-server';
import { TestDataFactory } from '@/lib/__tests__/test-data-factory';

// Mock Supabase
jest.mock('@/lib/supabase-server');

describe('/api/sync/status', () => {
  let mockSupabaseFrom: jest.Mock;
  let mockSelect: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    TestDataFactory.resetCounter();

    // Setup Supabase mocks
    mockSelect = jest.fn();
    mockSupabaseFrom = jest.fn().mockReturnValue({
      select: mockSelect,
    });
    (supabase as any).from = mockSupabaseFrom;
  });

  describe('GET /api/sync/status', () => {
    test('should retrieve latest sync status successfully', async () => {
      const latestStatus = TestDataFactory.createSyncStatus({
        status: 'COMPLETED',
        total_products: 11793,
        processed_products: 11793,
        progress_percentage: 100,
        started_at: new Date('2024-01-15T10:00:00Z'),
        completed_at: new Date('2024-01-15T10:30:00Z'),
      });

      mockSelect.mockReturnValue({
        order: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: latestStatus, error: null }),
          }),
        }),
      });

      const response = await GET();
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData).toEqual(latestStatus);

      // Verify correct query structure
      expect(mockSupabaseFrom).toHaveBeenCalledWith('sync_status');
      expect(mockSelect).toHaveBeenCalledWith('*');
    });

    test('should handle in-progress sync status', async () => {
      const inProgressStatus = TestDataFactory.createSyncStatus({
        status: 'IN_PROGRESS',
        total_products: 11793,
        processed_products: 5896,
        progress_percentage: 50,
        started_at: new Date('2024-01-15T10:00:00Z'),
      });

      mockSelect.mockReturnValue({
        order: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: inProgressStatus, error: null }),
          }),
        }),
      });

      const response = await GET();
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.status).toBe('IN_PROGRESS');
      expect(responseData.progress_percentage).toBe(50);
      expect(responseData.completed_at).toBeUndefined();
    });

    test('should handle failed sync status', async () => {
      const failedStatus = TestDataFactory.createSyncStatus({
        status: 'FAILED',
        total_products: 11793,
        processed_products: 3000,
        progress_percentage: 25,
        error: 'Database connection timeout during batch processing',
        started_at: new Date('2024-01-15T10:00:00Z'),
      });

      mockSelect.mockReturnValue({
        order: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: failedStatus, error: null }),
          }),
        }),
      });

      const response = await GET();
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.status).toBe('FAILED');
      expect(responseData.error).toBe('Database connection timeout during batch processing');
      expect(responseData.processed_products).toBe(3000);
    });

    test('should handle pending sync status', async () => {
      const pendingStatus = TestDataFactory.createSyncStatus({
        status: 'PENDING',
        total_products: 11793,
        processed_products: 0,
        progress_percentage: 0,
        started_at: new Date('2024-01-15T10:00:00Z'),
      });

      mockSelect.mockReturnValue({
        order: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: pendingStatus, error: null }),
          }),
        }),
      });

      const response = await GET();
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.status).toBe('PENDING');
      expect(responseData.processed_products).toBe(0);
      expect(responseData.progress_percentage).toBe(0);
    });

    test('should handle database connection errors', async () => {
      const dbError = new Error('Connection to database failed');

      mockSelect.mockReturnValue({
        order: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: null, error: dbError }),
          }),
        }),
      });

      const response = await GET();
      const responseData = await response.json();

      expect(response.status).toBe(500);
      expect(responseData).toEqual({
        error: 'Could not retrieve sync status',
        details: 'Connection to database failed',
      });
    });

    test('should handle no sync status found', async () => {
      mockSelect.mockReturnValue({
        order: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      });

      const response = await GET();
      const responseData = await response.json();

      expect(response.status).toBe(500);
      expect(responseData).toEqual({
        error: 'Could not retrieve sync status',
        details: 'Unknown error',
      });
    });

    test('should handle database query timeout', async () => {
      const timeoutError = new Error('Query timeout after 30 seconds');

      mockSelect.mockReturnValue({
        order: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            single: jest.fn().mockRejectedValue(timeoutError),
          }),
        }),
      });

      const response = await GET();
      const responseData = await response.json();

      expect(response.status).toBe(500);
      expect(responseData).toEqual({
        error: 'Could not retrieve sync status',
        details: 'Query timeout after 30 seconds',
      });
    });

    test('should verify correct database query structure', async () => {
      const status = TestDataFactory.createSyncStatus({ status: 'COMPLETED' });

      const mockOrder = jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: status, error: null }),
        }),
      });

      const mockLimit = jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({ data: status, error: null }),
      });

      const mockSingle = jest.fn().mockResolvedValue({ data: status, error: null });

      mockSelect.mockReturnValue({
        order: mockOrder,
      });

      await GET();

      // Verify query chain
      expect(mockSupabaseFrom).toHaveBeenCalledWith('sync_status');
      expect(mockSelect).toHaveBeenCalledWith('*');
      expect(mockOrder).toHaveBeenCalledWith('started_at', { ascending: false });
      expect(mockOrder().limit).toHaveBeenCalledWith(1);
      expect(mockOrder().limit().single).toHaveBeenCalled();
    });

    test('should handle multiple sync records correctly', async () => {
      // Simulate scenario where multiple syncs exist but only latest should be returned
      const latestStatus = TestDataFactory.createSyncStatus({
        status: 'COMPLETED',
        started_at: new Date('2024-01-15T15:00:00Z'), // Latest
        completed_at: new Date('2024-01-15T15:30:00Z'),
      });

      mockSelect.mockReturnValue({
        order: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: latestStatus, error: null }),
          }),
        }),
      });

      const response = await GET();
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData).toEqual(latestStatus);

      // Verify that ordering is by started_at descending to get latest
      const mockOrder = mockSelect().order;
      expect(mockOrder).toHaveBeenCalledWith('started_at', { ascending: false });
    });

    test('should handle large sync status data', async () => {
      const largeStatus = TestDataFactory.createSyncStatus({
        status: 'COMPLETED',
        total_products: 100000, // Large sync
        processed_products: 100000,
        progress_percentage: 100,
        error: 'A'.repeat(5000), // Large error message
      });

      mockSelect.mockReturnValue({
        order: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: largeStatus, error: null }),
          }),
        }),
      });

      const response = await GET();
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.total_products).toBe(100000);
      expect(responseData.error).toHaveLength(5000);
    });

    test('should handle sync status with special characters', async () => {
      const statusWithSpecialChars = TestDataFactory.createSyncStatus({
        status: 'FAILED',
        error: 'Sync failed due to invalid characters: ñ, é, ç, 中文, 🚀',
      });

      mockSelect.mockReturnValue({
        order: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: statusWithSpecialChars, error: null }),
          }),
        }),
      });

      const response = await GET();
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.error).toBe('Sync failed due to invalid characters: ñ, é, ç, 中文, 🚀');
    });

    test('should handle date serialization correctly', async () => {
      const statusWithDates = TestDataFactory.createSyncStatus({
        status: 'COMPLETED',
        started_at: new Date('2024-01-15T10:00:00.123Z'),
        completed_at: new Date('2024-01-15T10:30:45.678Z'),
      });

      mockSelect.mockReturnValue({
        order: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: statusWithDates, error: null }),
          }),
        }),
      });

      const response = await GET();
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.started_at).toBe('2024-01-15T10:00:00.123Z');
      expect(responseData.completed_at).toBe('2024-01-15T10:30:45.678Z');
    });
  });

  describe('Performance and Concurrency', () => {
    test('should handle concurrent requests efficiently', async () => {
      const status = TestDataFactory.createSyncStatus({ status: 'IN_PROGRESS' });

      mockSelect.mockReturnValue({
        order: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: status, error: null }),
          }),
        }),
      });

      // Simulate 50 concurrent requests
      const promises = Array.from({ length: 50 }, () => GET());
      const responses = await Promise.all(promises);

      expect(responses).toHaveLength(50);
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      // Each request should trigger a database query
      expect(mockSupabaseFrom).toHaveBeenCalledTimes(50);
    });

    test('should handle rapid successive requests', async () => {
      const status = TestDataFactory.createSyncStatus({ status: 'COMPLETED' });

      mockSelect.mockReturnValue({
        order: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: status, error: null }),
          }),
        }),
      });

      // Simulate rapid requests in sequence
      const responses = [];
      for (let i = 0; i < 10; i++) {
        responses.push(await GET());
      }

      expect(responses).toHaveLength(10);
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });

    test('should handle database slow response', async () => {
      const status = TestDataFactory.createSyncStatus({ status: 'COMPLETED' });

      // Simulate slow database response
      const slowResponse = new Promise(resolve => {
        setTimeout(() => {
          resolve({ data: status, error: null });
        }, 100);
      });

      mockSelect.mockReturnValue({
        order: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue(slowResponse),
          }),
        }),
      });

      const startTime = Date.now();
      const response = await GET();
      const endTime = Date.now();

      expect(response.status).toBe(200);
      expect(endTime - startTime).toBeGreaterThanOrEqual(100);
    });
  });

  describe('Error Recovery', () => {
    test('should handle intermittent database failures', async () => {
      const dbError = new Error('Temporary connection issue');
      const status = TestDataFactory.createSyncStatus({ status: 'COMPLETED' });

      mockSelect
        .mockReturnValueOnce({
          order: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              single: jest.fn().mockRejectedValue(dbError),
            }),
          }),
        })
        .mockReturnValueOnce({
          order: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: status, error: null }),
            }),
          }),
        });

      // First request fails
      const failedResponse = await GET();
      expect(failedResponse.status).toBe(500);

      // Second request succeeds
      const successResponse = await GET();
      expect(successResponse.status).toBe(200);
    });

    test('should handle non-standard error objects', async () => {
      mockSelect.mockReturnValue({
        order: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            single: jest.fn().mockRejectedValue('String error'),
          }),
        }),
      });

      const response = await GET();
      const responseData = await response.json();

      expect(response.status).toBe(500);
      expect(responseData.details).toBe('Unknown error');
    });

    test('should handle null error with no data', async () => {
      mockSelect.mockReturnValue({
        order: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      });

      const response = await GET();
      const responseData = await response.json();

      expect(response.status).toBe(500);
      expect(responseData).toEqual({
        error: 'Could not retrieve sync status',
        details: 'Unknown error',
      });
    });
  });
});