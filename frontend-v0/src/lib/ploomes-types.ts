// Product Types for Ploomes Integration

export enum ProductBrand {
  ATLAS = 'ATLAS',
  INGERSOLL = 'INGERSOLL',
  DANFOSS = 'DANFOSS',
  OMIE = 'OMIE',
  OTHER = 'OTHER'
}

export enum ProductCategory {
  PARTS = 'PEÇAS',
  VALVE = 'VALVULA',
  THIRD_PARTY_EQUIPMENT = 'EQUIPAMENTOS DE TERCEIROS',
  SERVICE = 'SERVIÇO',
  RENTAL = 'LOCAÇÃO'
}

export enum ProductType {
  PRODUCT = 'PRODUCT',
  SERVICE = 'SERVICE',
  RENTAL = 'RENTAL'
}

export interface PloomesProduct {
  id?: string;
  product_code: string;
  product_name: string;
  ncm_code?: string;
  unit_price: number;
  brand: ProductBrand;
  category: ProductCategory;
  product_type: ProductType;
  internal_notes?: string;
  creator: string;
  created_at?: Date;
  updated_at?: Date;
}

export interface PloomesSyncStatus {
  total_products: number;
  processed_products: number;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  started_at: Date;
  completed_at?: Date;
  error?: string;
  progress_percentage: number;
}

export interface PloomesSyncOptions {
  batch_size?: number;
  force_full_sync?: boolean;
  include_services?: boolean;
  include_rentals?: boolean;
}

export interface PloomesApiResponse<T> {
  data: T[];
  total: number;
  page: number;
  page_size: number;
}