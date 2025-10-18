export interface DashboardMetrics {
  totalRevenue: number;
  avgDeal: number;
  activeProducts: number;
  totalCustomers: number;
}

export interface CustomerSale {
  customer_id: string;
  customer_name: string;
  total_revenue: number;
  deal_count: number;
  avg_deal_value: number;
  last_deal_date: string;
}

export interface ProductPerformance {
  productId: string;
  productName: string;
  revenue: number;
  unitsSold: number;
  avgPrice: number;
  category?: string;
}

export interface PricingHistoryEntry {
  deal_id: string;
  product_id: string;
  product_name: string;
  customer_id: string;
  customer_name?: string;
  price: number;
  quantity: number;
  total: number;
  date: string;
  isMinimumPrice?: boolean;
}

export interface RegionalSale {
  region: string;
  revenue: number;
  dealCount: number;
  avgDealSize: number;
}

export interface DateRange {
  startDate: string;
  endDate: string;
}

export type DateRangePreset = '7d' | '30d' | '90d' | 'custom';

export interface DashboardFilters {
  dateRange: DateRange;
  preset: DateRangePreset;
  category?: string;
  search?: string;
}

export interface PaginationState {
  page: number;
  pageSize: number;
  total: number;
}

export interface SortState {
  column: string;
  direction: 'asc' | 'desc';
}

export interface ApiResponse<T> {
  data: T;
  success: boolean;
  error?: string;
}