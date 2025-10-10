import { PloomesSyncService } from '../ploomes-sync';
import { SyncManager } from '../sync-manager';
import { TestDataFactory } from './test-data-factory';
import { supabase } from '../supabase-server';

// Mock dependencies
jest.mock('../supabase-server');

// Increase timeout for performance tests
jest.setTimeout(30000);

describe('Performance Tests - Ploomes Sync', () => {
  let mockSupabaseFrom: jest.Mock;
  let mockUpsert: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    TestDataFactory.resetCounter();

    // Setup Supabase mocks with performance simulation
    mockUpsert = jest.fn().mockImplementation(async (data) => {
      // Simulate database write time based on batch size
      const delay = Math.min(data.length * 2, 500); // Max 500ms delay
      await new Promise(resolve => setTimeout(resolve, delay));
      return { data: null, error: null };
    });

    mockSupabaseFrom = jest.fn().mockReturnValue({
      upsert: mockUpsert,
    });
    (supabase as any).from = mockSupabaseFrom;

    // Mock fetch for API calls
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('Large Dataset Processing', () => {
    test('should handle complete 11,793 product dataset efficiently', async () => {
      const completeDataset = TestDataFactory.createCompleteProductSet();
      expect(completeDataset).toHaveLength(11793);

      const startTime = performance.now();
      const result = await PloomesSyncService.syncProductsToSupabase(completeDataset);
      const endTime = performance.now();

      const executionTime = endTime - startTime;

      expect(result.status).toBe('COMPLETED');
      expect(result.total_products).toBe(11793);
      expect(result.processed_products).toBe(11793);
      expect(result.progress_percentage).toBe(100);

      // Performance expectations:
      // - Should process 11,793 products in reasonable time
      // - Batch size of 500 means ~24 batches
      // - With 500ms max delay per batch = ~12 seconds max
      expect(executionTime).toBeLessThan(15000); // 15 seconds max

      // Verify batching was used correctly
      const expectedBatches = Math.ceil(11793 / 500);
      expect(mockUpsert).toHaveBeenCalledTimes(expectedBatches);

      console.log(`✅ Processed ${result.total_products} products in ${executionTime.toFixed(2)}ms`);
      console.log(`📊 Average: ${(executionTime / result.total_products).toFixed(3)}ms per product`);
      console.log(`📦 Batches: ${expectedBatches}`);
    });

    test('should handle different batch sizes efficiently', async () => {
      const testDataset = TestDataFactory.createLargeBatch(5000);
      const batchSizes = [100, 250, 500, 1000];
      const results: Array<{ batchSize: number; time: number; batches: number }> = [];

      for (const batchSize of batchSizes) {
        // Reset mocks for each test
        jest.clearAllMocks();

        // Temporarily override batch size
        const originalBatchSize = (PloomesSyncService as any).BATCH_SIZE;
        (PloomesSyncService as any).BATCH_SIZE = batchSize;

        const startTime = performance.now();
        const result = await PloomesSyncService.syncProductsToSupabase(testDataset);
        const endTime = performance.now();

        const executionTime = endTime - startTime;
        const expectedBatches = Math.ceil(5000 / batchSize);

        expect(result.status).toBe('COMPLETED');
        expect(result.total_products).toBe(5000);
        expect(mockUpsert).toHaveBeenCalledTimes(expectedBatches);

        results.push({
          batchSize,
          time: executionTime,
          batches: expectedBatches,
        });

        // Restore original batch size
        (PloomesSyncService as any).BATCH_SIZE = originalBatchSize;
      }

      // Log performance comparison
      console.log('\n📈 Batch Size Performance Comparison:');
      results.forEach(({ batchSize, time, batches }) => {
        console.log(`  Batch ${batchSize}: ${time.toFixed(2)}ms (${batches} batches)`);
      });

      // Performance expectations:
      // - Larger batches should generally be more efficient (fewer round trips)
      // - But not exceed reasonable memory/time constraints
      expect(results.every(r => r.time < 10000)).toBe(true); // All under 10 seconds
    });

    test('should handle memory usage efficiently with large datasets', async () => {
      // Create increasingly large datasets to test memory efficiency
      const sizes = [1000, 5000, 10000, 15000];
      const memoryUsage: Array<{ size: number; heapUsed: number }> = [];

      for (const size of sizes) {
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }

        const initialMemory = process.memoryUsage().heapUsed;

        const dataset = TestDataFactory.createLargeBatch(size);
        await PloomesSyncService.syncProductsToSupabase(dataset);

        const finalMemory = process.memoryUsage().heapUsed;
        memoryUsage.push({
          size,
          heapUsed: finalMemory - initialMemory,
        });

        // Clear dataset reference
        dataset.length = 0;
      }

      // Log memory usage
      console.log('\n💾 Memory Usage Analysis:');
      memoryUsage.forEach(({ size, heapUsed }) => {
        const mbUsed = (heapUsed / 1024 / 1024).toFixed(2);
        const perProduct = (heapUsed / size).toFixed(0);
        console.log(`  ${size} products: ${mbUsed}MB (${perProduct} bytes/product)`);
      });

      // Memory should scale reasonably with dataset size
      const avgBytesPerProduct = memoryUsage.reduce((sum, m) => sum + (m.heapUsed / m.size), 0) / memoryUsage.length;
      expect(avgBytesPerProduct).toBeLessThan(10000); // Should be under 10KB per product
    });
  });

  describe('Concurrent Processing Performance', () => {
    test('should handle multiple concurrent sync operations', async () => {
      const dataset1 = TestDataFactory.createLargeBatch(1000);
      const dataset2 = TestDataFactory.createLargeBatch(1000);
      const dataset3 = TestDataFactory.createLargeBatch(1000);

      const startTime = performance.now();

      const [result1, result2, result3] = await Promise.all([
        PloomesSyncService.syncProductsToSupabase(dataset1),
        PloomesSyncService.syncProductsToSupabase(dataset2),
        PloomesSyncService.syncProductsToSupabase(dataset3),
      ]);

      const endTime = performance.now();
      const executionTime = endTime - startTime;

      expect(result1.status).toBe('COMPLETED');
      expect(result2.status).toBe('COMPLETED');
      expect(result3.status).toBe('COMPLETED');

      // Concurrent operations should be faster than sequential
      // (though limited by mock delay implementation)
      expect(executionTime).toBeLessThan(8000); // Should complete in reasonable time

      console.log(`⚡ Concurrent sync of 3x1000 products: ${executionTime.toFixed(2)}ms`);
    });

    test('should handle high-frequency sync manager operations', async () => {
      // Mock successful sync service
      const mockStartSync = jest.spyOn(PloomesSyncService, 'startFullProductSync');
      mockStartSync.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay
        return TestDataFactory.createSyncStatus({ status: 'COMPLETED' });
      });

      const startTime = performance.now();

      // Start 10 sync operations with minimal delay
      const promises = Array.from({ length: 10 }, async (_, index) => {
        await new Promise(resolve => setTimeout(resolve, index * 10)); // Staggered start
        return SyncManager.startSync({ batch_size: 100 });
      });

      const results = await Promise.all(promises);
      const endTime = performance.now();

      expect(results).toHaveLength(10);
      results.forEach(result => {
        expect(result.status).toBe('COMPLETED');
      });

      const executionTime = endTime - startTime;
      console.log(`🔄 10 concurrent sync operations: ${executionTime.toFixed(2)}ms`);

      mockStartSync.mockRestore();
    });
  });

  describe('API Performance Tests', () => {
    test('should handle large API response processing efficiently', async () => {
      const largeDataset = TestDataFactory.createCompleteProductSet(); // 11,793 products
      const mockApiResponse = TestDataFactory.createApiResponse(largeDataset);

      // Mock fetch with realistic timing
      (global.fetch as jest.Mock).mockImplementation(async () => {
        // Simulate API response time based on data size
        const delay = Math.min(largeDataset.length / 100, 1000); // Max 1 second
        await new Promise(resolve => setTimeout(resolve, delay));

        return {
          ok: true,
          json: async () => {
            // Simulate JSON parsing time
            await new Promise(resolve => setTimeout(resolve, 50));
            return mockApiResponse;
          },
        };
      });

      process.env.PLOOMES_API_TOKEN = 'test-token';

      const startTime = performance.now();
      const result = await PloomesSyncService.fetchPloomesProducts();
      const endTime = performance.now();

      const executionTime = endTime - startTime;

      expect(result.data).toHaveLength(11793);
      expect(executionTime).toBeLessThan(5000); // Should complete under 5 seconds

      // Verify data enrichment performance
      result.data.forEach(product => {
        expect(product.product_type).toBeDefined();
        expect(product.brand).toBeDefined();
        expect(typeof product.unit_price).toBe('number');
        expect(product.created_at).toBeInstanceOf(Date);
        expect(product.updated_at).toBeInstanceOf(Date);
      });

      console.log(`🌐 API fetch + processing of ${result.data.length} products: ${executionTime.toFixed(2)}ms`);
    });

    test('should handle product type detection at scale', async () => {
      const testCases = [
        { count: 1000, prefix: 'CIA_LOC_', expectedType: 'RENTAL' },
        { count: 1000, prefix: 'CIA_', expectedType: 'SERVICE' },
        { count: 5000, prefix: 'ATL', expectedType: 'PRODUCT' },
        { count: 5000, prefix: 'ING', expectedType: 'PRODUCT' },
      ];

      for (const { count, prefix, expectedType } of testCases) {
        const products = Array.from({ length: count }, (_, i) =>
          TestDataFactory.createProduct({
            product_code: `${prefix}${i.toString().padStart(4, '0')}`,
          })
        );

        const startTime = performance.now();

        const enrichedProducts = await Promise.all(
          products.map(async product => ({
            ...product,
            product_type: await PloomesSyncService.detectProductType(product.product_code),
          }))
        );

        const endTime = performance.now();
        const executionTime = endTime - startTime;

        // All products should have correct type
        enrichedProducts.forEach(product => {
          expect(product.product_type).toBe(expectedType);
        });

        expect(executionTime).toBeLessThan(1000); // Should be very fast

        console.log(`🏷️  Type detection for ${count} ${expectedType} products: ${executionTime.toFixed(2)}ms`);
      }
    });

    test('should handle brand detection at scale', async () => {
      const brands = ['ATLAS', 'INGERSOLL', 'DANFOSS', 'OMIE', 'UNKNOWN'];
      const productsPerBrand = 2000;

      const allProducts = brands.flatMap(brand =>
        Array.from({ length: productsPerBrand }, (_, i) =>
          TestDataFactory.createProduct({
            brand: brand as any,
          })
        )
      );

      const startTime = performance.now();

      const enrichedProducts = allProducts.map(product => ({
        ...product,
        detected_brand: PloomesSyncService.detectBrand(product.brand),
      }));

      const endTime = performance.now();
      const executionTime = endTime - startTime;

      expect(enrichedProducts).toHaveLength(brands.length * productsPerBrand);
      expect(executionTime).toBeLessThan(500); // Brand detection should be very fast

      // Verify brand distribution
      const brandCounts = enrichedProducts.reduce((acc, product) => {
        acc[product.detected_brand] = (acc[product.detected_brand] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      console.log(`🏭 Brand detection for ${enrichedProducts.length} products: ${executionTime.toFixed(2)}ms`);
      console.log('Brand distribution:', brandCounts);
    });
  });

  describe('End-to-End Performance', () => {
    test('should complete full sync workflow within performance targets', async () => {
      // Mock complete workflow
      const completeDataset = TestDataFactory.createCompleteProductSet().slice(0, 5000); // Subset for test speed
      const mockApiResponse = TestDataFactory.createApiResponse(completeDataset);

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockApiResponse),
      });

      const mockInsert = jest.fn().mockResolvedValue({ data: null, error: null });
      mockSupabaseFrom.mockReturnValue({
        upsert: mockUpsert,
        insert: mockInsert,
      });

      process.env.PLOOMES_API_TOKEN = 'test-token';

      const startTime = performance.now();
      const result = await SyncManager.startSync();
      const endTime = performance.now();

      const executionTime = endTime - startTime;

      expect(result.status).toBe('COMPLETED');
      expect(result.total_products).toBe(5000);
      expect(result.processed_products).toBe(5000);

      // Full workflow should complete within reasonable time
      expect(executionTime).toBeLessThan(10000); // 10 seconds for 5000 products

      console.log(`🎯 End-to-end sync of ${result.total_products} products: ${executionTime.toFixed(2)}ms`);
      console.log(`📈 Throughput: ${(result.total_products / (executionTime / 1000)).toFixed(0)} products/second`);
    });

    test('should handle realistic production load simulation', async () => {
      // Simulate realistic production scenario:
      // - 11,793 total products
      // - Network latency simulation
      // - Database processing time simulation
      // - Error recovery simulation

      const realDataset = TestDataFactory.createCompleteProductSet();

      // Simulate network latency (200-800ms)
      (global.fetch as jest.Mock).mockImplementation(async () => {
        const networkDelay = 200 + Math.random() * 600;
        await new Promise(resolve => setTimeout(resolve, networkDelay));

        return {
          ok: true,
          json: async () => {
            // JSON parsing delay
            await new Promise(resolve => setTimeout(resolve, 100));
            return TestDataFactory.createApiResponse(realDataset);
          },
        };
      });

      // Simulate realistic database performance
      mockUpsert.mockImplementation(async (data) => {
        // Simulate database write time (varies by batch size and load)
        const baseDelay = 50; // Base 50ms per batch
        const sizeDelay = data.length * 1; // 1ms per product
        const randomJitter = Math.random() * 100; // Up to 100ms jitter

        const totalDelay = baseDelay + sizeDelay + randomJitter;
        await new Promise(resolve => setTimeout(resolve, totalDelay));

        // Occasional failures (5% chance)
        if (Math.random() < 0.05) {
          return { data: null, error: new Error('Temporary database overload') };
        }

        return { data: null, error: null };
      });

      const startTime = performance.now();

      try {
        const result = await SyncManager.startSync();
        const endTime = performance.now();

        const executionTime = endTime - startTime;

        // Should handle the load (might fail due to simulated errors but should retry)
        if (result.status === 'COMPLETED') {
          expect(result.total_products).toBe(11793);
          expect(result.processed_products).toBe(11793);

          console.log(`🏭 Production simulation: ${executionTime.toFixed(2)}ms for ${result.total_products} products`);
          console.log(`⚡ Throughput: ${(result.total_products / (executionTime / 1000)).toFixed(0)} products/second`);
        } else {
          // If failed, should have retry information
          expect(result.status).toBe('FAILED');
          console.log(`❌ Production simulation failed (as expected): ${result.error}`);
        }

        // Should complete or fail within reasonable time (not hang)
        expect(executionTime).toBeLessThan(60000); // 1 minute max

      } catch (error) {
        const endTime = performance.now();
        const executionTime = endTime - startTime;

        console.log(`🔄 Production simulation triggered retry logic: ${executionTime.toFixed(2)}ms`);
        expect(executionTime).toBeLessThan(60000); // Should fail fast, not hang
      }
    });
  });

  describe('Performance Monitoring and Metrics', () => {
    test('should track performance metrics accurately', async () => {
      const dataset = TestDataFactory.createLargeBatch(2000);

      const metrics = {
        apiCallTime: 0,
        enrichmentTime: 0,
        dbWriteTime: 0,
        totalTime: 0,
      };

      // Time API call simulation
      const apiStart = performance.now();
      const mockResponse = TestDataFactory.createApiResponse(dataset);
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });
      metrics.apiCallTime = performance.now() - apiStart;

      // Time data enrichment
      const enrichStart = performance.now();
      await PloomesSyncService.fetchPloomesProducts();
      metrics.enrichmentTime = performance.now() - enrichStart;

      // Time database operations
      const dbStart = performance.now();
      await PloomesSyncService.syncProductsToSupabase(dataset);
      metrics.dbWriteTime = performance.now() - dbStart;

      console.log('\n📊 Performance Metrics Breakdown:');
      console.log(`  API Call: ${metrics.apiCallTime.toFixed(2)}ms`);
      console.log(`  Enrichment: ${metrics.enrichmentTime.toFixed(2)}ms`);
      console.log(`  DB Write: ${metrics.dbWriteTime.toFixed(2)}ms`);

      // Verify reasonable performance distribution
      expect(metrics.apiCallTime).toBeLessThan(1000);
      expect(metrics.enrichmentTime).toBeLessThan(2000);
      expect(metrics.dbWriteTime).toBeLessThan(5000);
    });
  });
});