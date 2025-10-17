import { NextRequest } from 'next/server';
import { POST, GET } from '../products/route';
import { PloomesSyncService } from '@/lib/ploomes-sync';
import { TestDataFactory } from '@/lib/__tests__/test-data-factory';

// Mock dependencies
jest.mock('@/lib/ploomes-sync');

describe('/api/sync/products', () => {
  const mockPloomesSyncService = PloomesSyncService as jest.Mocked<typeof PloomesSyncService>;

  beforeEach(() => {
    jest.clearAllMocks();
    TestDataFactory.resetCounter();
  });

  describe('POST /api/sync/products', () => {
    test('should start product sync with default options', async () => {
      const syncStatus = TestDataFactory.createSyncStatus({
        status: 'COMPLETED',
        total_products: 11793,
        processed_products: 11793,
        progress_percentage: 100,
      });

      mockPloomesSyncService.startFullProductSync.mockResolvedValueOnce(syncStatus);

      const request = new NextRequest('http://localhost:3000/api/sync/products', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await POST(request);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData).toEqual(syncStatus);
      expect(mockPloomesSyncService.startFullProductSync).toHaveBeenCalledWith({});
    });

    test('should start product sync with custom options', async () => {
      const customOptions = {
        batch_size: 200,
        force_full_sync: true,
        include_services: false,
        include_rentals: true,
      };

      const syncStatus = TestDataFactory.createSyncStatus({
        status: 'COMPLETED',
        total_products: 10000,
        processed_products: 10000,
        progress_percentage: 100,
      });

      mockPloomesSyncService.startFullProductSync.mockResolvedValueOnce(syncStatus);

      const request = new NextRequest('http://localhost:3000/api/sync/products', {
        method: 'POST',
        body: JSON.stringify(customOptions),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await POST(request);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData).toEqual(syncStatus);
      expect(mockPloomesSyncService.startFullProductSync).toHaveBeenCalledWith(customOptions);
    });

    test('should handle sync service failures', async () => {
      const syncError = new Error('Ploomes API unavailable');
      mockPloomesSyncService.startFullProductSync.mockRejectedValueOnce(syncError);

      const request = new NextRequest('http://localhost:3000/api/sync/products', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await POST(request);
      const responseData = await response.json();

      expect(response.status).toBe(500);
      expect(responseData).toEqual({
        error: 'Product sync failed',
        details: 'Ploomes API unavailable',
      });
    });

    test('should handle invalid JSON in request body', async () => {
      const request = new NextRequest('http://localhost:3000/api/sync/products', {
        method: 'POST',
        body: 'invalid json',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await POST(request);
      const responseData = await response.json();

      expect(response.status).toBe(500);
      expect(responseData.error).toBe('Product sync failed');
      expect(responseData.details).toContain('Unexpected token');
    });

    test('should handle failed sync status from service', async () => {
      const failedSyncStatus = TestDataFactory.createSyncStatus({
        status: 'FAILED',
        total_products: 11793,
        processed_products: 5000,
        progress_percentage: 42,
        error: 'Database connection timeout',
      });

      mockPloomesSyncService.startFullProductSync.mockResolvedValueOnce(failedSyncStatus);

      const request = new NextRequest('http://localhost:3000/api/sync/products', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await POST(request);
      const responseData = await response.json();

      expect(response.status).toBe(200); // API call succeeds even if sync fails
      expect(responseData).toEqual(failedSyncStatus);
    });

    test('should handle large sync options payload', async () => {
      const largeOptions = {
        batch_size: 1000,
        force_full_sync: true,
        include_services: true,
        include_rentals: true,
        // Add large description for stress testing
        description: 'A'.repeat(10000),
      };

      const syncStatus = TestDataFactory.createSyncStatus({ status: 'COMPLETED' });
      mockPloomesSyncService.startFullProductSync.mockResolvedValueOnce(syncStatus);

      const request = new NextRequest('http://localhost:3000/api/sync/products', {
        method: 'POST',
        body: JSON.stringify(largeOptions),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await POST(request);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData).toEqual(syncStatus);
    });

    test('should handle sync with progress tracking', async () => {
      const inProgressStatus = TestDataFactory.createSyncStatus({
        status: 'IN_PROGRESS',
        total_products: 11793,
        processed_products: 2500,
        progress_percentage: 21,
      });

      mockPloomesSyncService.startFullProductSync.mockResolvedValueOnce(inProgressStatus);

      const request = new NextRequest('http://localhost:3000/api/sync/products', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await POST(request);
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData.status).toBe('IN_PROGRESS');
      expect(responseData.progress_percentage).toBe(21);
      expect(responseData.processed_products).toBe(2500);
    });
  });

  describe('GET /api/sync/products', () => {
    beforeEach(() => {
      // Mock the getLastSyncStatus method that appears in the route
      mockPloomesSyncService.getLastSyncStatus = jest.fn();
    });

    test('should retrieve last sync status successfully', async () => {
      const lastSyncStatus = TestDataFactory.createSyncStatus({
        status: 'COMPLETED',
        total_products: 11793,
        processed_products: 11793,
        progress_percentage: 100,
        completed_at: new Date('2024-01-15T10:30:00Z'),
      });

      (mockPloomesSyncService.getLastSyncStatus as jest.Mock).mockResolvedValueOnce(lastSyncStatus);

      const response = await GET();
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData).toEqual(lastSyncStatus);
      expect(mockPloomesSyncService.getLastSyncStatus).toHaveBeenCalledTimes(1);
    });

    test('should handle when no sync status exists', async () => {
      (mockPloomesSyncService.getLastSyncStatus as jest.Mock).mockResolvedValueOnce(null);

      const response = await GET();
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData).toBeNull();
    });

    test('should handle service errors', async () => {
      const serviceError = new Error('Database connection failed');
      (mockPloomesSyncService.getLastSyncStatus as jest.Mock).mockRejectedValueOnce(serviceError);

      const response = await GET();
      const responseData = await response.json();

      expect(response.status).toBe(500);
      expect(responseData).toEqual({
        error: 'Could not retrieve sync status',
        details: 'Database connection failed',
      });
    });

    test('should handle failed sync status retrieval', async () => {
      const failedStatus = TestDataFactory.createSyncStatus({
        status: 'FAILED',
        total_products: 11793,
        processed_products: 3000,
        progress_percentage: 25,
        error: 'Sync was interrupted',
      });

      (mockPloomesSyncService.getLastSyncStatus as jest.Mock).mockResolvedValueOnce(failedStatus);

      const response = await GET();
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData).toEqual(failedStatus);
      expect(responseData.status).toBe('FAILED');
      expect(responseData.error).toBe('Sync was interrupted');
    });

    test('should handle in-progress sync status', async () => {
      const inProgressStatus = TestDataFactory.createSyncStatus({
        status: 'IN_PROGRESS',
        total_products: 11793,
        processed_products: 7500,
        progress_percentage: 64,
        started_at: new Date('2024-01-15T10:00:00Z'),
      });

      (mockPloomesSyncService.getLastSyncStatus as jest.Mock).mockResolvedValueOnce(inProgressStatus);

      const response = await GET();
      const responseData = await response.json();

      expect(response.status).toBe(200);
      expect(responseData).toEqual(inProgressStatus);
      expect(responseData.status).toBe('IN_PROGRESS');
      expect(responseData.progress_percentage).toBe(64);
    });
  });

  describe('Integration Scenarios', () => {
    test('should handle POST followed by GET requests', async () => {
      // First, start a sync
      const syncStatus = TestDataFactory.createSyncStatus({
        status: 'COMPLETED',
        total_products: 11793,
        processed_products: 11793,
        progress_percentage: 100,
      });

      mockPloomesSyncService.startFullProductSync.mockResolvedValueOnce(syncStatus);
      (mockPloomesSyncService.getLastSyncStatus as jest.Mock).mockResolvedValueOnce(syncStatus);

      // POST request to start sync
      const postRequest = new NextRequest('http://localhost:3000/api/sync/products', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const postResponse = await POST(postRequest);
      const postData = await postResponse.json();

      expect(postResponse.status).toBe(200);
      expect(postData.status).toBe('COMPLETED');

      // GET request to retrieve status
      const getResponse = await GET();
      const getData = await getResponse.json();

      expect(getResponse.status).toBe(200);
      expect(getData).toEqual(syncStatus);
    });

    test('should handle concurrent POST requests', async () => {
      const syncStatus1 = TestDataFactory.createSyncStatus({ status: 'COMPLETED' });
      const syncStatus2 = TestDataFactory.createSyncStatus({ status: 'COMPLETED' });

      mockPloomesSyncService.startFullProductSync
        .mockResolvedValueOnce(syncStatus1)
        .mockResolvedValueOnce(syncStatus2);

      const request1 = new NextRequest('http://localhost:3000/api/sync/products', {
        method: 'POST',
        body: JSON.stringify({ batch_size: 300 }),
        headers: { 'Content-Type': 'application/json' },
      });

      const request2 = new NextRequest('http://localhost:3000/api/sync/products', {
        method: 'POST',
        body: JSON.stringify({ batch_size: 400 }),
        headers: { 'Content-Type': 'application/json' },
      });

      const [response1, response2] = await Promise.all([POST(request1), POST(request2)]);

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
      expect(mockPloomesSyncService.startFullProductSync).toHaveBeenCalledTimes(2);
    });

    test('should handle high-frequency GET requests', async () => {
      const syncStatus = TestDataFactory.createSyncStatus({
        status: 'IN_PROGRESS',
        total_products: 11793,
        processed_products: 5000,
        progress_percentage: 42,
      });

      (mockPloomesSyncService.getLastSyncStatus as jest.Mock).mockResolvedValue(syncStatus);

      // Simulate multiple clients checking sync status
      const promises = Array.from({ length: 10 }, () => GET());
      const responses = await Promise.all(promises);

      expect(responses).toHaveLength(10);
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      expect(mockPloomesSyncService.getLastSyncStatus).toHaveBeenCalledTimes(10);
    });

    test('should handle mixed success and failure scenarios', async () => {
      const successStatus = TestDataFactory.createSyncStatus({ status: 'COMPLETED' });
      const failureError = new Error('Sync service unavailable');

      mockPloomesSyncService.startFullProductSync
        .mockResolvedValueOnce(successStatus)
        .mockRejectedValueOnce(failureError);

      const successRequest = new NextRequest('http://localhost:3000/api/sync/products', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' },
      });

      const failureRequest = new NextRequest('http://localhost:3000/api/sync/products', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' },
      });

      const successResponse = await POST(successRequest);
      const failureResponse = await POST(failureRequest);

      expect(successResponse.status).toBe(200);
      expect(failureResponse.status).toBe(500);

      const successData = await successResponse.json();
      const failureData = await failureResponse.json();

      expect(successData.status).toBe('COMPLETED');
      expect(failureData.error).toBe('Product sync failed');
    });
  });

  describe('Error Handling Edge Cases', () => {
    test('should handle sync service throwing non-Error objects', async () => {
      mockPloomesSyncService.startFullProductSync.mockRejectedValueOnce('String error');

      const request = new NextRequest('http://localhost:3000/api/sync/products', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const responseData = await response.json();

      expect(response.status).toBe(500);
      expect(responseData.details).toBe('Unknown error');
    });

    test('should handle malformed request bodies gracefully', async () => {
      const request = new NextRequest('http://localhost:3000/api/sync/products', {
        method: 'POST',
        body: '{"invalid": json}',
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const responseData = await response.json();

      expect(response.status).toBe(500);
      expect(responseData.error).toBe('Product sync failed');
    });

    test('should handle empty request body', async () => {
      const syncStatus = TestDataFactory.createSyncStatus({ status: 'COMPLETED' });
      mockPloomesSyncService.startFullProductSync.mockResolvedValueOnce(syncStatus);

      const request = new NextRequest('http://localhost:3000/api/sync/products', {
        method: 'POST',
        body: '',
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const responseData = await response.json();

      expect(response.status).toBe(500);
      expect(responseData.error).toBe('Product sync failed');
    });
  });
});