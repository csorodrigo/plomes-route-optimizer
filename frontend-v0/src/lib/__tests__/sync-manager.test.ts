import { SyncManager } from '../sync-manager';
import { PloomesSyncService } from '../ploomes-sync';
import { PloomesSyncStatus } from '../ploomes-types';
import { TestDataFactory } from './test-data-factory';
import { supabase } from '../supabase-server';

// Mock dependencies
jest.mock('../ploomes-sync');
jest.mock('../supabase-server');

describe('SyncManager', () => {
  const mockPloomesSyncService = PloomesSyncService as jest.Mocked<typeof PloomesSyncService>;
  let mockSupabaseFrom: jest.Mock;
  let mockInsert: jest.Mock;
  let mockSelect: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    TestDataFactory.resetCounter();

    // Setup Supabase mocks
    mockInsert = jest.fn().mockResolvedValue({ data: null, error: null });
    mockSelect = jest.fn().mockReturnValue({
      order: jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    });
    mockSupabaseFrom = jest.fn().mockReturnValue({
      insert: mockInsert,
      select: mockSelect,
    });
    (supabase as any).from = mockSupabaseFrom;

    // Setup fetch mock for webhooks
    global.fetch = jest.fn();

    // Setup environment variables
    delete process.env.SYNC_WEBHOOK_URL;
    delete process.env.WEBHOOK_SECRET;
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('startSync', () => {
    test('should complete sync successfully on first attempt', async () => {
      const expectedStatus = TestDataFactory.createSyncStatus({
        status: 'COMPLETED',
        total_products: 1000,
        processed_products: 1000,
        progress_percentage: 100,
        completed_at: new Date(),
      });

      mockPloomesSyncService.startFullProductSync.mockResolvedValueOnce(expectedStatus);

      const result = await SyncManager.startSync();

      expect(result).toEqual(expectedStatus);
      expect(mockPloomesSyncService.startFullProductSync).toHaveBeenCalledTimes(1);
      expect(mockSupabaseFrom).toHaveBeenCalledWith('sync_status');
      expect(mockInsert).toHaveBeenCalledWith(expectedStatus);
    });

    test('should pass custom options to sync service', async () => {
      const customOptions = {
        batch_size: 200,
        force_full_sync: true,
        include_services: false,
        include_rentals: true,
      };

      const expectedStatus = TestDataFactory.createSyncStatus({ status: 'COMPLETED' });
      mockPloomesSyncService.startFullProductSync.mockResolvedValueOnce(expectedStatus);

      await SyncManager.startSync(customOptions);

      expect(mockPloomesSyncService.startFullProductSync).toHaveBeenCalledWith(customOptions);
    });

    test('should retry on failure and succeed on second attempt', async () => {
      const failedStatus = TestDataFactory.createSyncStatus({
        status: 'FAILED',
        error: 'Temporary network error',
      });

      const successStatus = TestDataFactory.createSyncStatus({
        status: 'COMPLETED',
        total_products: 500,
        processed_products: 500,
        progress_percentage: 100,
      });

      mockPloomesSyncService.startFullProductSync
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockResolvedValueOnce(successStatus);

      const result = await SyncManager.startSync();

      expect(result).toEqual(successStatus);
      expect(mockPloomesSyncService.startFullProductSync).toHaveBeenCalledTimes(2);
      expect(mockInsert).toHaveBeenCalledTimes(1); // Only successful result is recorded
    });

    test('should retry up to maximum attempts before failing', async () => {
      const networkError = new Error('Persistent network error');

      mockPloomesSyncService.startFullProductSync.mockRejectedValue(networkError);

      await expect(SyncManager.startSync()).rejects.toThrow('Persistent network error');

      expect(mockPloomesSyncService.startFullProductSync).toHaveBeenCalledTimes(3); // MAX_RETRY_ATTEMPTS
      expect(mockInsert).toHaveBeenCalledTimes(1); // Failed status is recorded
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'FAILED',
          error: 'Sync failed after max retries',
        })
      );
    });

    test('should wait between retry attempts', async () => {
      const startTime = Date.now();
      const networkError = new Error('Network error');

      mockPloomesSyncService.startFullProductSync.mockRejectedValue(networkError);

      // Mock setTimeout to track delays
      const originalSetTimeout = global.setTimeout;
      const setTimeoutSpy = jest.spyOn(global, 'setTimeout');

      try {
        await expect(SyncManager.startSync()).rejects.toThrow();

        // Should have called setTimeout twice (for 2 retries)
        expect(setTimeoutSpy).toHaveBeenCalledTimes(2);
        expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 5000);
      } finally {
        global.setTimeout = originalSetTimeout;
        setTimeoutSpy.mockRestore();
      }
    });

    test('should handle sync service returning failed status', async () => {
      const failedStatus = TestDataFactory.createSyncStatus({
        status: 'FAILED',
        error: 'Database connection failed',
        total_products: 1000,
        processed_products: 250,
        progress_percentage: 25,
      });

      mockPloomesSyncService.startFullProductSync.mockResolvedValueOnce(failedStatus);

      const result = await SyncManager.startSync();

      expect(result).toEqual(failedStatus);
      expect(mockInsert).toHaveBeenCalledWith(failedStatus);
    });
  });

  describe('recordSyncStatus', () => {
    test('should record sync status successfully', async () => {
      const status = TestDataFactory.createSyncStatus({ status: 'COMPLETED' });

      // Use reflection to access private method
      const recordSyncStatus = (SyncManager as any).recordSyncStatus;
      await recordSyncStatus(status);

      expect(mockSupabaseFrom).toHaveBeenCalledWith('sync_status');
      expect(mockInsert).toHaveBeenCalledWith(status);
    });

    test('should handle database errors gracefully', async () => {
      const status = TestDataFactory.createSyncStatus({ status: 'COMPLETED' });
      const dbError = new Error('Database unavailable');

      mockInsert.mockResolvedValueOnce({ data: null, error: dbError });

      // Spy on console.error to verify error logging
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      const recordSyncStatus = (SyncManager as any).recordSyncStatus;
      await recordSyncStatus(status);

      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to record sync status:', dbError);

      consoleErrorSpy.mockRestore();
    });
  });

  describe('sendWebhookNotification', () => {
    beforeEach(() => {
      process.env.SYNC_WEBHOOK_URL = 'https://webhook.example.com/sync';
      process.env.WEBHOOK_SECRET = 'webhook-secret-123';
    });

    test('should send webhook notification successfully', async () => {
      const status = TestDataFactory.createSyncStatus({ status: 'COMPLETED' });

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
      });

      const sendWebhookNotification = (SyncManager as any).sendWebhookNotification;
      await sendWebhookNotification(status);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://webhook.example.com/sync',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer webhook-secret-123',
          },
          body: JSON.stringify(status),
        }
      );
    });

    test('should handle webhook failure gracefully', async () => {
      const status = TestDataFactory.createSyncStatus({ status: 'COMPLETED' });

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        statusText: 'Internal Server Error',
      });

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      const sendWebhookNotification = (SyncManager as any).sendWebhookNotification;
      await sendWebhookNotification(status);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Webhook notification failed:',
        'Internal Server Error'
      );

      consoleErrorSpy.mockRestore();
    });

    test('should handle network errors gracefully', async () => {
      const status = TestDataFactory.createSyncStatus({ status: 'COMPLETED' });
      const networkError = new Error('Network timeout');

      (global.fetch as jest.Mock).mockRejectedValueOnce(networkError);

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      const sendWebhookNotification = (SyncManager as any).sendWebhookNotification;
      await sendWebhookNotification(status);

      expect(consoleErrorSpy).toHaveBeenCalledWith('Webhook notification error:', networkError);

      consoleErrorSpy.mockRestore();
    });
  });

  describe('webhook integration with startSync', () => {
    test('should send webhook when URL is configured', async () => {
      process.env.SYNC_WEBHOOK_URL = 'https://webhook.example.com/sync';
      process.env.WEBHOOK_SECRET = 'secret';

      const status = TestDataFactory.createSyncStatus({ status: 'COMPLETED' });

      mockPloomesSyncService.startFullProductSync.mockResolvedValueOnce(status);
      (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true });

      await SyncManager.startSync();

      expect(global.fetch).toHaveBeenCalledWith(
        'https://webhook.example.com/sync',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(status),
        })
      );
    });

    test('should skip webhook when URL is not configured', async () => {
      delete process.env.SYNC_WEBHOOK_URL;

      const status = TestDataFactory.createSyncStatus({ status: 'COMPLETED' });
      mockPloomesSyncService.startFullProductSync.mockResolvedValueOnce(status);

      await SyncManager.startSync();

      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('getLatestSyncStatus', () => {
    test('should retrieve latest sync status successfully', async () => {
      const latestStatus = TestDataFactory.createSyncStatus({
        status: 'COMPLETED',
        started_at: new Date('2024-01-15T10:00:00Z'),
      });

      mockSelect.mockReturnValue({
        order: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: latestStatus, error: null }),
          }),
        }),
      });

      const result = await SyncManager.getLatestSyncStatus();

      expect(result).toEqual(latestStatus);
      expect(mockSupabaseFrom).toHaveBeenCalledWith('sync_status');
      expect(mockSelect).toHaveBeenCalledWith('*');
    });

    test('should handle database errors', async () => {
      const dbError = new Error('Database connection failed');

      mockSelect.mockReturnValue({
        order: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: null, error: dbError }),
          }),
        }),
      });

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await SyncManager.getLatestSyncStatus();

      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error fetching latest sync status:', dbError);

      consoleErrorSpy.mockRestore();
    });

    test('should return null when no sync status exists', async () => {
      mockSelect.mockReturnValue({
        order: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      });

      const result = await SyncManager.getLatestSyncStatus();

      expect(result).toBeNull();
    });
  });

  describe('resumeInterruptedSync', () => {
    test('should resume interrupted sync when status is IN_PROGRESS', async () => {
      const interruptedStatus = TestDataFactory.createSyncStatus({
        status: 'IN_PROGRESS',
        total_products: 1000,
        processed_products: 500,
        progress_percentage: 50,
      });

      const completedStatus = TestDataFactory.createSyncStatus({
        status: 'COMPLETED',
        total_products: 1000,
        processed_products: 1000,
        progress_percentage: 100,
      });

      mockSelect.mockReturnValue({
        order: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: interruptedStatus, error: null }),
          }),
        }),
      });

      mockPloomesSyncService.startFullProductSync.mockResolvedValueOnce(completedStatus);

      const result = await SyncManager.resumeInterruptedSync();

      expect(result).toEqual(completedStatus);
      expect(mockPloomesSyncService.startFullProductSync).toHaveBeenCalledWith({
        batch_size: 500,
        force_full_sync: false,
      });
    });

    test('should resume interrupted sync when status is PENDING', async () => {
      const pendingStatus = TestDataFactory.createSyncStatus({
        status: 'PENDING',
        total_products: 1000,
        processed_products: 0,
        progress_percentage: 0,
      });

      const completedStatus = TestDataFactory.createSyncStatus({
        status: 'COMPLETED',
        total_products: 1000,
        processed_products: 1000,
        progress_percentage: 100,
      });

      mockSelect.mockReturnValue({
        order: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: pendingStatus, error: null }),
          }),
        }),
      });

      mockPloomesSyncService.startFullProductSync.mockResolvedValueOnce(completedStatus);

      const result = await SyncManager.resumeInterruptedSync();

      expect(result).toEqual(completedStatus);
    });

    test('should not resume when sync is COMPLETED', async () => {
      const completedStatus = TestDataFactory.createSyncStatus({
        status: 'COMPLETED',
        total_products: 1000,
        processed_products: 1000,
        progress_percentage: 100,
      });

      mockSelect.mockReturnValue({
        order: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: completedStatus, error: null }),
          }),
        }),
      });

      const result = await SyncManager.resumeInterruptedSync();

      expect(result).toBeNull();
      expect(mockPloomesSyncService.startFullProductSync).not.toHaveBeenCalled();
    });

    test('should not resume when sync is FAILED', async () => {
      const failedStatus = TestDataFactory.createSyncStatus({
        status: 'FAILED',
        error: 'Previous sync failed',
      });

      mockSelect.mockReturnValue({
        order: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: failedStatus, error: null }),
          }),
        }),
      });

      const result = await SyncManager.resumeInterruptedSync();

      expect(result).toBeNull();
      expect(mockPloomesSyncService.startFullProductSync).not.toHaveBeenCalled();
    });

    test('should return null when no sync status exists', async () => {
      mockSelect.mockReturnValue({
        order: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      });

      const result = await SyncManager.resumeInterruptedSync();

      expect(result).toBeNull();
      expect(mockPloomesSyncService.startFullProductSync).not.toHaveBeenCalled();
    });
  });

  describe('Error Recovery and Resilience', () => {
    test('should handle multiple consecutive failures followed by success', async () => {
      const networkError = new Error('Network unstable');
      const successStatus = TestDataFactory.createSyncStatus({ status: 'COMPLETED' });

      mockPloomesSyncService.startFullProductSync
        .mockRejectedValueOnce(networkError)
        .mockRejectedValueOnce(networkError)
        .mockResolvedValueOnce(successStatus);

      const result = await SyncManager.startSync();

      expect(result).toEqual(successStatus);
      expect(mockPloomesSyncService.startFullProductSync).toHaveBeenCalledTimes(3);
    });

    test('should handle mixed success and failure scenarios', async () => {
      const partialSuccess = TestDataFactory.createSyncStatus({
        status: 'FAILED',
        total_products: 1000,
        processed_products: 750,
        progress_percentage: 75,
        error: 'Batch processing failed',
      });

      mockPloomesSyncService.startFullProductSync.mockResolvedValueOnce(partialSuccess);

      const result = await SyncManager.startSync();

      expect(result).toEqual(partialSuccess);
      expect(mockInsert).toHaveBeenCalledWith(partialSuccess);
    });

    test('should handle concurrent sync attempts gracefully', async () => {
      const status1 = TestDataFactory.createSyncStatus({ status: 'COMPLETED' });
      const status2 = TestDataFactory.createSyncStatus({ status: 'COMPLETED' });

      mockPloomesSyncService.startFullProductSync
        .mockResolvedValueOnce(status1)
        .mockResolvedValueOnce(status2);

      // Start two syncs simultaneously
      const [result1, result2] = await Promise.all([
        SyncManager.startSync(),
        SyncManager.startSync(),
      ]);

      expect(result1).toEqual(status1);
      expect(result2).toEqual(status2);
      expect(mockPloomesSyncService.startFullProductSync).toHaveBeenCalledTimes(2);
      expect(mockInsert).toHaveBeenCalledTimes(2);
    });
  });
});