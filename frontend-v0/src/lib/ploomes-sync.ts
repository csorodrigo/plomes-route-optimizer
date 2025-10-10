import { PloomesProduct, ProductBrand, ProductCategory, ProductType, PloomesSyncStatus, PloomesSyncOptions, PloomesApiResponse } from './ploomes-types';
import { supabaseServer } from './supabase-server';

export class PloomesSyncService {
  private static BATCH_SIZE = 500;
  private static BRAND_MAP: Record<string, ProductBrand> = {
    'ATLAS': ProductBrand.ATLAS,
    'INGERSOLL': ProductBrand.INGERSOLL,
    'DANFOSS': ProductBrand.DANFOSS,
    'OMIE': ProductBrand.OMIE
  };

  static async detectProductType(productCode: string): ProductType {
    if (productCode.startsWith('CIA_LOC_')) {
      return ProductType.RENTAL;
    }
    if (productCode.startsWith('CIA_')) {
      return ProductType.SERVICE;
    }
    return ProductType.PRODUCT;
  }

  static detectBrand(brandName: string): ProductBrand {
    return this.BRAND_MAP[brandName.toUpperCase()] || ProductBrand.OTHER;
  }

  static async fetchPloomesProducts(
    options: PloomesSyncOptions = {}
  ): Promise<PloomesApiResponse<PloomesProduct>> {
    const {
      batch_size = this.BATCH_SIZE,
      force_full_sync = false,
      include_services = true,
      include_rentals = true
    } = options;

    try {
      // TODO: Replace with actual Ploomes API client
      const response = await fetch('https://api.ploomes.com/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.PLOOMES_API_TOKEN}`
        },
        body: JSON.stringify({
          batch_size,
          include_services,
          include_rentals,
          force_full_sync
        })
      });

      if (!response.ok) {
        throw new Error(`Ploomes API error: ${response.statusText}`);
      }

      const data: PloomesApiResponse<PloomesProduct> = await response.json();

      // Process and enrich products
      data.data = await Promise.all(
        data.data.map(async (product) => ({
          ...product,
          product_type: await this.detectProductType(product.product_code),
          brand: this.detectBrand(product.brand || 'OTHER'),
          unit_price: Number(product.unit_price) || 0,
          created_at: new Date(),
          updated_at: new Date()
        }))
      );

      return data;
    } catch (error) {
      console.error('Product sync error:', error);
      throw error;
    }
  }

  static async syncProductsToSupabase(
    products: PloomesProduct[]
  ): Promise<PloomesSyncStatus> {
    const syncStatus: PloomesSyncStatus = {
      total_products: products.length,
      processed_products: 0,
      status: 'IN_PROGRESS',
      started_at: new Date(),
      progress_percentage: 0
    };

    try {
      for (let i = 0; i < products.length; i += this.BATCH_SIZE) {
        const batch = products.slice(i, i + this.BATCH_SIZE);

        const { data, error } = await supabase
          .from('products')
          .upsert(batch, {
            onConflict: 'product_code',
            returning: 'minimal'
          });

        if (error) throw error;

        syncStatus.processed_products += batch.length;
        syncStatus.progress_percentage = Math.round(
          (syncStatus.processed_products / syncStatus.total_products) * 100
        );
      }

      syncStatus.status = 'COMPLETED';
      syncStatus.completed_at = new Date();

      return syncStatus;
    } catch (error) {
      console.error('Supabase sync error:', error);

      syncStatus.status = 'FAILED';
      syncStatus.error = error instanceof Error ? error.message : 'Unknown error';

      return syncStatus;
    }
  }

  static async startFullProductSync(
    options: PloomesSyncOptions = {}
  ): Promise<PloomesSyncStatus> {
    try {
      const { data } = await this.fetchPloomesProducts(options);
      return await this.syncProductsToSupabase(data);
    } catch (error) {
      console.error('Full product sync failed:', error);
      return {
        total_products: 0,
        processed_products: 0,
        status: 'FAILED',
        started_at: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
        progress_percentage: 0
      };
    }
  }
}