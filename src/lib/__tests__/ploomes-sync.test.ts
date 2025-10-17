import { PloomesSyncService } from '../ploomes-sync';
import { ProductBrand, ProductType, ProductCategory } from '../ploomes-types';
import { TestDataFactory } from './test-data-factory';
import { supabase } from '../supabase-server';

// Mock the supabase module
jest.mock('../supabase-server');

describe('PloomesSyncService', () => {
  beforeEach(() => {
    TestDataFactory.resetCounter();
    jest.clearAllMocks();

    // Setup default fetch mock
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('detectProductType', () => {
    test('should detect RENTAL type for CIA_LOC_ prefix', async () => {
      const type = await PloomesSyncService.detectProductType('CIA_LOC_001');
      expect(type).toBe(ProductType.RENTAL);
    });

    test('should detect SERVICE type for CIA_ prefix (non-rental)', async () => {
      const type = await PloomesSyncService.detectProductType('CIA_SERV_001');
      expect(type).toBe(ProductType.SERVICE);
    });

    test('should detect PRODUCT type for non-CIA products', async () => {
      const productCodes = ['ATL001', 'ING001', 'OMI001', 'DANF001', 'OTHER001'];

      for (const code of productCodes) {
        const type = await PloomesSyncService.detectProductType(code);
        expect(type).toBe(ProductType.PRODUCT);
      }
    });

    test('should handle edge cases', async () => {
      const edgeCases = [
        { code: 'CIA_', expected: ProductType.SERVICE },
        { code: 'CIA_LOC', expected: ProductType.SERVICE }, // Not LOC_
        { code: 'cia_loc_001', expected: ProductType.PRODUCT }, // Case sensitive
        { code: '', expected: ProductType.PRODUCT },
        { code: 'CIA_LOC_', expected: ProductType.RENTAL },
      ];

      for (const { code, expected } of edgeCases) {
        const type = await PloomesSyncService.detectProductType(code);
        expect(type).toBe(expected);
      }
    });
  });

  describe('detectBrand', () => {
    test('should detect known brands correctly', () => {
      const brandTests = [
        { input: 'ATLAS', expected: ProductBrand.ATLAS },
        { input: 'atlas', expected: ProductBrand.ATLAS },
        { input: 'Atlas', expected: ProductBrand.ATLAS },
        { input: 'INGERSOLL', expected: ProductBrand.INGERSOLL },
        { input: 'ingersoll', expected: ProductBrand.INGERSOLL },
        { input: 'DANFOSS', expected: ProductBrand.DANFOSS },
        { input: 'OMIE', expected: ProductBrand.OMIE },
      ];

      brandTests.forEach(({ input, expected }) => {
        const result = PloomesSyncService.detectBrand(input);
        expect(result).toBe(expected);
      });
    });

    test('should return OTHER for unknown brands', () => {
      const unknownBrands = ['UNKNOWN', 'RANDOM', '', 'BRAND123', null, undefined];

      unknownBrands.forEach(brand => {
        const result = PloomesSyncService.detectBrand(brand as string);
        expect(result).toBe(ProductBrand.OTHER);
      });
    });
  });

  describe('fetchPloomesProducts', () => {
    beforeEach(() => {
      process.env.PLOOMES_API_TOKEN = 'test-token';
    });

    test('should fetch products successfully with default options', async () => {
      const testProducts = TestDataFactory.createCompleteProductSet().slice(0, 500);
      const mockResponse = TestDataFactory.createApiResponse(testProducts);

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockResponse),
      });

      const result = await PloomesSyncService.fetchPloomesProducts();

      expect(global.fetch).toHaveBeenCalledWith('https://api.ploomes.com/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token',
        },
        body: JSON.stringify({
          batch_size: 500,
          include_services: true,
          include_rentals: true,
          force_full_sync: false,
        }),
      });

      expect(result.data).toHaveLength(500);
      expect(result.total).toBe(500);
    });

    test('should handle custom options', async () => {
      const testProducts = TestDataFactory.createLargeBatch(100);
      const mockResponse = TestDataFactory.createApiResponse(testProducts, 1, 100);

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockResponse),
      });

      const options = {
        batch_size: 100,
        force_full_sync: true,
        include_services: false,
        include_rentals: false,
      };

      await PloomesSyncService.fetchPloomesProducts(options);

      expect(global.fetch).toHaveBeenCalledWith('https://api.ploomes.com/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token',
        },
        body: JSON.stringify(options),
      });
    });

    test('should enrich products with type, brand, and pricing', async () => {
      const rawProducts = [
        { product_code: 'CIA_LOC_001', product_name: 'Rental Item', brand: 'ATLAS', unit_price: '1500' },
        { product_code: 'CIA_SERV_001', product_name: 'Service Item', brand: 'ingersoll', unit_price: '2500.50' },
        { product_code: 'ATL001', product_name: 'Atlas Product', brand: 'ATLAS', unit_price: '500' },
      ];

      const mockResponse = TestDataFactory.createApiResponse(rawProducts);

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockResponse),
      });

      const result = await PloomesSyncService.fetchPloomesProducts();

      expect(result.data[0]).toMatchObject({
        product_code: 'CIA_LOC_001',
        product_type: ProductType.RENTAL,
        brand: ProductBrand.ATLAS,
        unit_price: 1500,
      });

      expect(result.data[1]).toMatchObject({
        product_code: 'CIA_SERV_001',
        product_type: ProductType.SERVICE,
        brand: ProductBrand.INGERSOLL,
        unit_price: 2500.5,
      });

      expect(result.data[2]).toMatchObject({
        product_code: 'ATL001',
        product_type: ProductType.PRODUCT,
        brand: ProductBrand.ATLAS,
        unit_price: 500,
      });

      // Check that dates were added
      result.data.forEach(product => {
        expect(product.created_at).toBeInstanceOf(Date);
        expect(product.updated_at).toBeInstanceOf(Date);
      });
    });

    test('should handle API errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        statusText: 'Internal Server Error',
      });

      await expect(PloomesSyncService.fetchPloomesProducts()).rejects.toThrow(
        'Ploomes API error: Internal Server Error'
      );
    });

    test('should handle network errors', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      await expect(PloomesSyncService.fetchPloomesProducts()).rejects.toThrow('Network error');
    });

    test('should handle invalid unit prices', async () => {
      const rawProducts = [
        { product_code: 'TEST001', product_name: 'Test', brand: 'OTHER', unit_price: 'invalid' },
        { product_code: 'TEST002', product_name: 'Test', brand: 'OTHER', unit_price: null },
        { product_code: 'TEST003', product_name: 'Test', brand: 'OTHER', unit_price: undefined },
      ];

      const mockResponse = TestDataFactory.createApiResponse(rawProducts);

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockResponse),
      });

      const result = await PloomesSyncService.fetchPloomesProducts();

      result.data.forEach(product => {
        expect(product.unit_price).toBe(0);
      });
    });
  });

  describe('syncProductsToSupabase', () => {
    let mockSupabaseFrom: jest.Mock;
    let mockUpsert: jest.Mock;

    beforeEach(() => {
      mockUpsert = jest.fn().mockResolvedValue({ data: null, error: null });
      mockSupabaseFrom = jest.fn().mockReturnValue({
        upsert: mockUpsert,
      });
      (supabase as any).from = mockSupabaseFrom;
    });

    test('should sync products in batches successfully', async () => {
      const products = TestDataFactory.createLargeBatch(1200); // > batch size

      const result = await PloomesSyncService.syncProductsToSupabase(products);

      expect(result.status).toBe('COMPLETED');
      expect(result.total_products).toBe(1200);
      expect(result.processed_products).toBe(1200);
      expect(result.progress_percentage).toBe(100);
      expect(result.completed_at).toBeInstanceOf(Date);

      // Should be called 3 times (1200 / 500 = 2.4, rounded up to 3)
      expect(mockSupabaseFrom).toHaveBeenCalledTimes(3);
      expect(mockUpsert).toHaveBeenCalledTimes(3);

      // Check batch sizes
      expect(mockUpsert).toHaveBeenNthCalledWith(1,
        expect.arrayContaining([expect.objectContaining({ product_code: expect.any(String) })]),
        { onConflict: 'product_code', returning: 'minimal' }
      );
    });

    test('should handle single batch sync', async () => {
      const products = TestDataFactory.createLargeBatch(300); // < batch size

      const result = await PloomesSyncService.syncProductsToSupabase(products);

      expect(result.status).toBe('COMPLETED');
      expect(result.total_products).toBe(300);
      expect(result.processed_products).toBe(300);
      expect(result.progress_percentage).toBe(100);

      expect(mockSupabaseFrom).toHaveBeenCalledTimes(1);
      expect(mockUpsert).toHaveBeenCalledTimes(1);
    });

    test('should handle empty product array', async () => {
      const result = await PloomesSyncService.syncProductsToSupabase([]);

      expect(result.status).toBe('COMPLETED');
      expect(result.total_products).toBe(0);
      expect(result.processed_products).toBe(0);
      expect(result.progress_percentage).toBe(0);

      expect(mockSupabaseFrom).not.toHaveBeenCalled();
    });

    test('should handle database errors', async () => {
      const products = TestDataFactory.createLargeBatch(100);
      const dbError = new Error('Database connection failed');

      mockUpsert.mockResolvedValueOnce({ data: null, error: dbError });

      const result = await PloomesSyncService.syncProductsToSupabase(products);

      expect(result.status).toBe('FAILED');
      expect(result.error).toBe('Database connection failed');
      expect(result.processed_products).toBe(0);
    });

    test('should track progress correctly during partial failure', async () => {
      const products = TestDataFactory.createLargeBatch(1000);

      // First batch succeeds, second fails
      mockUpsert
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: null, error: new Error('Batch 2 failed') });

      const result = await PloomesSyncService.syncProductsToSupabase(products);

      expect(result.status).toBe('FAILED');
      expect(result.processed_products).toBe(500); // Only first batch processed
      expect(result.progress_percentage).toBe(50);
      expect(result.error).toBe('Batch 2 failed');
    });
  });

  describe('startFullProductSync', () => {
    let mockSupabaseFrom: jest.Mock;
    let mockUpsert: jest.Mock;

    beforeEach(() => {
      mockUpsert = jest.fn().mockResolvedValue({ data: null, error: null });
      mockSupabaseFrom = jest.fn().mockReturnValue({
        upsert: mockUpsert,
      });
      (supabase as any).from = mockSupabaseFrom;
      process.env.PLOOMES_API_TOKEN = 'test-token';
    });

    test('should complete full sync successfully', async () => {
      const testProducts = TestDataFactory.createCompleteProductSet().slice(0, 1000);
      const mockResponse = TestDataFactory.createApiResponse(testProducts);

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockResponse),
      });

      const result = await PloomesSyncService.startFullProductSync();

      expect(result.status).toBe('COMPLETED');
      expect(result.total_products).toBe(1000);
      expect(result.processed_products).toBe(1000);
    });

    test('should handle fetch errors gracefully', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('API unavailable'));

      const result = await PloomesSyncService.startFullProductSync();

      expect(result.status).toBe('FAILED');
      expect(result.error).toBe('API unavailable');
      expect(result.total_products).toBe(0);
      expect(result.processed_products).toBe(0);
    });

    test('should handle sync errors gracefully', async () => {
      const testProducts = TestDataFactory.createLargeBatch(100);
      const mockResponse = TestDataFactory.createApiResponse(testProducts);

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockResponse),
      });

      mockUpsert.mockResolvedValueOnce({ data: null, error: new Error('Sync failed') });

      const result = await PloomesSyncService.startFullProductSync();

      expect(result.status).toBe('FAILED');
      expect(result.error).toBe('Sync failed');
    });
  });

  describe('Integration Tests - Product Categorization', () => {
    test('should correctly categorize all 11,793 products', async () => {
      const completeSet = TestDataFactory.createCompleteProductSet();

      // Verify total count
      expect(completeSet).toHaveLength(11793);

      // Verify services (CIA_ prefix, not LOC_)
      const services = completeSet.filter(p => p.product_type === ProductType.SERVICE);
      expect(services).toHaveLength(127);
      services.forEach(service => {
        expect(service.product_code).toMatch(/^CIA_(?!LOC_)/);
        expect(service.category).toBe(ProductCategory.SERVICE);
      });

      // Verify rentals (CIA_LOC_ prefix)
      const rentals = completeSet.filter(p => p.product_type === ProductType.RENTAL);
      expect(rentals).toHaveLength(95);
      rentals.forEach(rental => {
        expect(rental.product_code).toMatch(/^CIA_LOC_/);
        expect(rental.category).toBe(ProductCategory.RENTAL);
      });

      // Verify Atlas products
      const atlasProducts = completeSet.filter(p => p.brand === ProductBrand.ATLAS);
      expect(atlasProducts).toHaveLength(1307);
      atlasProducts.forEach(product => {
        expect(product.product_code).toMatch(/^ATL/);
        expect(product.product_type).toBe(ProductType.PRODUCT);
      });

      // Verify Ingersoll products
      const ingersollProducts = completeSet.filter(p => p.brand === ProductBrand.INGERSOLL);
      expect(ingersollProducts).toHaveLength(1952);
      ingersollProducts.forEach(product => {
        expect(product.product_code).toMatch(/^ING/);
        expect(product.product_type).toBe(ProductType.PRODUCT);
      });

      // Verify Omie products
      const omieProducts = completeSet.filter(p => p.brand === ProductBrand.OMIE);
      expect(omieProducts).toHaveLength(10982);
      omieProducts.forEach(product => {
        expect(product.product_code).toMatch(/^OMI/);
        expect(product.product_type).toBe(ProductType.PRODUCT);
      });
    });

    test('should handle mixed batch with all product types', async () => {
      const mixedBatch = [
        ...TestDataFactory.createServiceProducts(10),
        ...TestDataFactory.createRentalProducts(10),
        ...TestDataFactory.createAtlasProducts(10),
        ...TestDataFactory.createIngersollProducts(10),
        ...TestDataFactory.createOmieProducts(10),
      ];

      const mockResponse = TestDataFactory.createApiResponse(mixedBatch);

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockResponse),
      });

      const result = await PloomesSyncService.fetchPloomesProducts();

      // Verify all types are correctly categorized
      const productsByType = result.data.reduce((acc, product) => {
        acc[product.product_type] = (acc[product.product_type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      expect(productsByType[ProductType.SERVICE]).toBe(10);
      expect(productsByType[ProductType.RENTAL]).toBe(10);
      expect(productsByType[ProductType.PRODUCT]).toBe(30); // Atlas + Ingersoll + Omie
    });
  });
});