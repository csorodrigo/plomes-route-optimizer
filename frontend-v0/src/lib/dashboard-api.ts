import axios from 'axios';
import { env as clientEnv } from './env.client';

const API_BASE_URL = clientEnv.API_URL;

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

api.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = window.localStorage.getItem('auth_token');
      if (token) {
        config.headers = config.headers ?? {};
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export interface DashboardMetrics {
  totalRevenue: number;
  revenueChange?: number;
  avgDeal: number;
  avgDealChange?: number;
  activeProducts: number;
  productsChange?: number;
  totalCustomers: number;
  customersChange?: number;
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
  product_id: string;
  product_name: string;
  revenue: number;
  quantity: number;
  avg_price: number;
  deal_count: number;
}

export interface TimeSeriesData {
  date: string;
  revenue: number;
  deals: number;
}

export interface DashboardFilters {
  startDate?: string;
  endDate?: string;
  customerId?: string;
  productId?: string;
}

/**
 * Dashboard API Client
 * Provides typed API calls for dashboard analytics endpoints using live Supabase-cached data
 */
export const dashboardAPI = {
  /**
   * Get dashboard metrics summary from Supabase
   */
  getMetrics: async (filters?: DashboardFilters) => {
    const response = await api.get('/api/dashboard/metrics-simple', {
      params: filters,
    });
    return response.data;
  },

  /**
   * Get customer sales performance from Supabase
   */
  getCustomers: async (search?: string) => {
    const params = search ? { search } : {};
    const response = await api.get('/api/dashboard/customers', {
      params,
    });
    return response.data;
  },

  /**
   * Get customer sales performance (alias for compatibility)
   */
  getCustomerSales: async (filters?: DashboardFilters) => {
    const params = filters ? { search: filters.customerId } : {};
    const response = await api.get('/api/dashboard/customer-sales', {
      params,
    });
    return response.data;
  },

  /**
   * Get product performance data
   */
  getProductPerformance: (filters?: DashboardFilters) =>
    api.get<{ products: ProductPerformance[] }>('/api/dashboard/product-performance', {
      params: filters,
    }).then((res) => res.data),

  /**
   * Get pricing history for a product/customer
   */
  getPricingHistory: async (productId?: string, customerId?: string) => {
    const params: any = {};
    if (productId) params.productId = productId;
    if (customerId) params.customerId = customerId;

    const response = await api.get('/api/dashboard/pricing-history', {
      params,
    });
    return response.data;
  },

  /**
   * Get time series revenue data
   */
  getTimeSeries: (filters?: DashboardFilters) =>
    api.get<{ data: TimeSeriesData[] }>('/api/dashboard/time-series', {
      params: filters,
    }).then((res) => res.data),

  /**
   * Sync data from Ploomes to Supabase
   */
  syncData: () =>
    api.post<{ success: boolean; message: string }>('/api/dashboard/sync', {}).then((res) => res.data),
};

// Keep the old export for backwards compatibility
export const dashboardApi = dashboardAPI;

/**
 * Helper function to format currency for Brazilian Real
 */
export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

/**
 * Helper function to format date
 */
export const formatDate = (date: string | Date): string => {
  return new Intl.DateTimeFormat('pt-BR').format(new Date(date));
};

/**
 * Helper function to calculate percentage change
 */
export const calculatePercentageChange = (current: number, previous: number): number => {
  if (previous === 0) return 0;
  return ((current - previous) / previous) * 100;
};