import { PloomesProduct, ProductBrand, ProductCategory, ProductType, PloomesSyncStatus, PloomesApiResponse } from '../ploomes-types';

export class TestDataFactory {
  private static productCounter = 1;

  /**
   * Creates a base product with realistic defaults
   */
  static createProduct(overrides?: Partial<PloomesProduct>): PloomesProduct {
    const id = this.productCounter++;
    return {
      id: `product-${id}`,
      product_code: `PROD${id.toString().padStart(4, '0')}`,
      product_name: `Test Product ${id}`,
      ncm_code: `${Math.floor(Math.random() * 10000000000)}`,
      unit_price: Math.floor(Math.random() * 10000) + 100,
      brand: ProductBrand.OTHER,
      category: ProductCategory.PARTS,
      product_type: ProductType.PRODUCT,
      internal_notes: `Test notes for product ${id}`,
      creator: 'test-user',
      created_at: new Date(),
      updated_at: new Date(),
      ...overrides,
    };
  }

  /**
   * Creates CIA service products (127 total as per requirements)
   */
  static createServiceProducts(count = 127): PloomesProduct[] {
    return Array.from({ length: count }, (_, index) => {
      const serviceId = (index + 1).toString().padStart(3, '0');
      return this.createProduct({
        product_code: `CIA_SERV_${serviceId}`,
        product_name: `Ciara Service ${serviceId}`,
        product_type: ProductType.SERVICE,
        category: ProductCategory.SERVICE,
        brand: ProductBrand.OTHER,
        unit_price: Math.floor(Math.random() * 5000) + 500,
      });
    });
  }

  /**
   * Creates CIA rental products (95 total as per requirements)
   */
  static createRentalProducts(count = 95): PloomesProduct[] {
    return Array.from({ length: count }, (_, index) => {
      const rentalId = (index + 1).toString().padStart(3, '0');
      return this.createProduct({
        product_code: `CIA_LOC_${rentalId}`,
        product_name: `Ciara Rental Equipment ${rentalId}`,
        product_type: ProductType.RENTAL,
        category: ProductCategory.RENTAL,
        brand: ProductBrand.OTHER,
        unit_price: Math.floor(Math.random() * 3000) + 200,
      });
    });
  }

  /**
   * Creates Atlas brand products (1,307 total as per requirements)
   */
  static createAtlasProducts(count = 1307): PloomesProduct[] {
    return Array.from({ length: count }, (_, index) => {
      const atlasId = (index + 1).toString().padStart(4, '0');
      const categories = [ProductCategory.PARTS, ProductCategory.VALVE, ProductCategory.THIRD_PARTY_EQUIPMENT];
      const randomCategory = categories[Math.floor(Math.random() * categories.length)];

      return this.createProduct({
        product_code: `ATL${atlasId}`,
        product_name: `Atlas Product ${atlasId}`,
        brand: ProductBrand.ATLAS,
        category: randomCategory,
        product_type: ProductType.PRODUCT,
        unit_price: Math.floor(Math.random() * 8000) + 300,
      });
    });
  }

  /**
   * Creates Ingersoll brand products (1,952 total as per requirements)
   */
  static createIngersollProducts(count = 1952): PloomesProduct[] {
    return Array.from({ length: count }, (_, index) => {
      const ingersollId = (index + 1).toString().padStart(4, '0');
      const categories = [ProductCategory.PARTS, ProductCategory.VALVE, ProductCategory.THIRD_PARTY_EQUIPMENT];
      const randomCategory = categories[Math.floor(Math.random() * categories.length)];

      return this.createProduct({
        product_code: `ING${ingersollId}`,
        product_name: `Ingersoll Product ${ingersollId}`,
        brand: ProductBrand.INGERSOLL,
        category: randomCategory,
        product_type: ProductType.PRODUCT,
        unit_price: Math.floor(Math.random() * 12000) + 400,
      });
    });
  }

  /**
   * Creates Omie brand products (10,982 total as per requirements)
   */
  static createOmieProducts(count = 10982): PloomesProduct[] {
    return Array.from({ length: count }, (_, index) => {
      const omieId = (index + 1).toString().padStart(5, '0');
      const categories = [ProductCategory.PARTS, ProductCategory.VALVE, ProductCategory.THIRD_PARTY_EQUIPMENT];
      const randomCategory = categories[Math.floor(Math.random() * categories.length)];

      return this.createProduct({
        product_code: `OMI${omieId}`,
        product_name: `Omie Product ${omieId}`,
        brand: ProductBrand.OMIE,
        category: randomCategory,
        product_type: ProductType.PRODUCT,
        unit_price: Math.floor(Math.random() * 6000) + 200,
      });
    });
  }

  /**
   * Creates complete product dataset matching the 11,793 total requirement
   */
  static createCompleteProductSet(): PloomesProduct[] {
    return [
      ...this.createServiceProducts(127),
      ...this.createRentalProducts(95),
      ...this.createAtlasProducts(1307),
      ...this.createIngersollProducts(1952),
      ...this.createOmieProducts(10982),
    ];
  }

  /**
   * Creates realistic API response with pagination
   */
  static createApiResponse<T>(data: T[], page = 1, pageSize = 500): PloomesApiResponse<T> {
    return {
      data,
      total: data.length,
      page,
      page_size: pageSize,
    };
  }

  /**
   * Creates sync status for testing
   */
  static createSyncStatus(overrides?: Partial<PloomesSyncStatus>): PloomesSyncStatus {
    return {
      total_products: 11793,
      processed_products: 0,
      status: 'PENDING',
      started_at: new Date(),
      progress_percentage: 0,
      ...overrides,
    };
  }

  /**
   * Creates batch of products for performance testing
   */
  static createLargeBatch(size: number): PloomesProduct[] {
    return Array.from({ length: size }, (_, index) => {
      const brands = [ProductBrand.ATLAS, ProductBrand.INGERSOLL, ProductBrand.OMIE, ProductBrand.OTHER];
      const types = [ProductType.PRODUCT, ProductType.SERVICE, ProductType.RENTAL];
      const categories = Object.values(ProductCategory);

      return this.createProduct({
        product_code: `PERF${index.toString().padStart(6, '0')}`,
        product_name: `Performance Test Product ${index}`,
        brand: brands[index % brands.length],
        product_type: types[index % types.length],
        category: categories[index % categories.length],
      });
    });
  }

  /**
   * Creates products with specific brand distribution for testing
   */
  static createProductsByBrand(): Record<ProductBrand, PloomesProduct[]> {
    return {
      [ProductBrand.ATLAS]: this.createAtlasProducts(10),
      [ProductBrand.INGERSOLL]: this.createIngersollProducts(10),
      [ProductBrand.OMIE]: this.createOmieProducts(10),
      [ProductBrand.DANFOSS]: Array.from({ length: 5 }, (_, i) =>
        this.createProduct({
          product_code: `DANF${(i + 1).toString().padStart(3, '0')}`,
          brand: ProductBrand.DANFOSS,
        })
      ),
      [ProductBrand.OTHER]: Array.from({ length: 5 }, (_, i) =>
        this.createProduct({
          product_code: `OTHER${(i + 1).toString().padStart(3, '0')}`,
          brand: ProductBrand.OTHER,
        })
      ),
    };
  }

  /**
   * Creates products with edge cases for testing
   */
  static createEdgeCaseProducts(): PloomesProduct[] {
    return [
      // Products with special characters
      this.createProduct({
        product_code: 'CIA_SPEC@#$',
        product_name: 'Product with special chars @#$%',
        unit_price: 0,
      }),
      // Products with very long names
      this.createProduct({
        product_code: 'LONG_NAME',
        product_name: 'A'.repeat(500),
        unit_price: 999999.99,
      }),
      // Products with minimal data
      this.createProduct({
        product_code: 'MIN',
        product_name: 'Min',
        ncm_code: undefined,
        internal_notes: undefined,
        unit_price: 0.01,
      }),
      // Products with null/undefined fields
      this.createProduct({
        product_code: 'NULL_TEST',
        product_name: 'Null Test Product',
        ncm_code: null as any,
        internal_notes: null as any,
      }),
    ];
  }

  /**
   * Resets the counter for consistent test results
   */
  static resetCounter(): void {
    this.productCounter = 1;
  }
}