import axios from 'axios';
import { env as clientEnv } from './env.client';

const API_BASE_URL = clientEnv.API_URL;

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 120000, // Increased timeout for real-time API calls
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

export interface PloomesDashboardMetrics {
  totalRevenue: number;
  revenueChange?: number;
  avgDeal: number;
  avgDealChange?: number;
  activeProducts: number;
  productsChange?: number;
  totalCustomers: number;
  customersChange?: number;
  dealCount: number;
  customersWithDeals: number;
  revenuePerCustomer: number;
  period: string;
  dateRange: {
    start: string;
    end: string;
  };
}

export interface PloomesCustomer {
  id: string;
  name: string;
  document: string;
  email: string;
  type: 'company' | 'person';
  status: 'active' | 'inactive';
  address: string;
  cityId?: number;
  ploomes: {
    id: number;
    typeId: number;
    statusId: number;
  };
}

export interface PloomesCustomerSale {
  customer_id: string;
  customer_name: string;
  customer_document: string;
  customer_email: string;
  customer_type: 'company' | 'person';
  total_revenue: number;
  deal_count: number;
  avg_deal_value: number;
  last_deal_date: string;
  deals: Array<{
    id: number;
    amount: number;
    createdDate: string;
  }>;
  ploomes: {
    customerId: number;
    dealIds: number[];
  };
}

export interface PloomesDeal {
  id: string;
  title: string;
  amount: number;
  status: 'open' | 'won' | 'lost';
  statusId: number;
  stageId: number;
  customerId: string;
  personId: string;
  createdDate: string;
  lastInteractionDate?: string;
  products: Array<{
    id: number;
    name: string;
    code: string;
    price: number;
    quantity: number;
    total: number;
  }>;
  ploomes: {
    id: number;
    statusId: number;
    stageId: number;
    contactId?: number;
    personId?: number;
  };
}

export interface PloomesProduct {
  id: string;
  name: string;
  code: string;
  price: number;
  active: boolean;
  groupId?: number;
  familyId?: number;
  ploomes: {
    id: number;
    groupId?: number;
    familyId?: number;
  };
}

export interface PloomesPricingHistory {
  product_id: string;
  product_name: string;
  product_code: string;
  deal_id: string;
  deal_title: string;
  customer_id: string;
  date: string;
  unit_price: number;
  quantity: number;
  total_price: number;
  ploomes: {
    dealId: number;
    productId: number;
    customerId?: number;
    dealProductId?: number;
  };
}

export interface PloomesFilters {
  startDate?: string;
  endDate?: string;
  customerId?: string;
  productId?: string;
  period?: string;
  status?: 'open' | 'won' | 'lost';
  active?: boolean;
  search?: string;
  limit?: number;
  minRevenue?: number;
  includeProducts?: boolean;
}

/**
 * Ploomes Dashboard API Client
 * Direct real-time access to Ploomes CRM data without Supabase caching
 */
export const ploomesApi = {
  /**
   * Get dashboard metrics summary calculated from live Ploomes data
   */
  getMetrics: (filters?: PloomesFilters) =>
    api.get<{
      success: boolean;
      data: PloomesDashboardMetrics;
      source: string;
      timestamp: string;
      calculatedFrom: {
        wonDeals: number;
        totalDeals: number;
        customers: number;
        products: number;
      };
    }>('/api/ploomes/metrics', {
      params: filters,
    }).then((res) => {
      if (!res.data.success) {
        throw new Error(res.data.error || 'Failed to fetch metrics');
      }
      return res.data;
    }),

  /**
   * Get all customers from Ploomes CRM
   */
  getCustomers: (filters?: PloomesFilters) =>
    api.get<{
      success: boolean;
      data: PloomesCustomer[];
      total: number;
      source: string;
      timestamp: string;
    }>('/api/ploomes/customers', {
      params: filters,
    }).then((res) => {
      if (!res.data.success) {
        throw new Error(res.data.error || 'Failed to fetch customers');
      }
      return res.data;
    }),

  /**
   * Get customer sales performance aggregated from live deals
   */
  getCustomerSales: (filters?: PloomesFilters) =>
    api.get<{
      success: boolean;
      data: {
        customers: PloomesCustomerSale[];
        summary: {
          totalCustomers: number;
          totalRevenue: number;
          totalDeals: number;
          avgRevenuePerCustomer: number;
          periodDays: number;
        };
      };
      total: number;
      source: string;
      timestamp: string;
    }>('/api/ploomes/customer-sales', {
      params: filters,
    }).then((res) => {
      if (!res.data.success) {
        throw new Error(res.data.error || 'Failed to fetch customer sales');
      }
      return res.data;
    }),

  /**
   * Get all deals from Ploomes CRM
   */
  getDeals: (filters?: PloomesFilters) =>
    api.get<{
      success: boolean;
      data: PloomesDeal[];
      total: number;
      source: string;
      includeProducts?: boolean;
      timestamp: string;
    }>('/api/ploomes/deals', {
      params: filters,
    }).then((res) => {
      if (!res.data.success) {
        throw new Error(res.data.error || 'Failed to fetch deals');
      }
      return res.data;
    }),

  /**
   * Get all products from Ploomes CRM
   */
  getProducts: (filters?: PloomesFilters) =>
    api.get<{
      success: boolean;
      data: PloomesProduct[];
      total: number;
      source: string;
      timestamp: string;
    }>('/api/ploomes/products', {
      params: filters,
    }).then((res) => {
      if (!res.data.success) {
        throw new Error(res.data.error || 'Failed to fetch products');
      }
      return res.data;
    }),

  /**
   * Get pricing history analyzed from deal products
   */
  getPricingHistory: (filters?: PloomesFilters) =>
    api.get<{
      success: boolean;
      data: {
        pricing_history: PloomesPricingHistory[];
        product_summary: Array<{
          product_id: string;
          product_name: string;
          product_code: string;
          min_price: number;
          max_price: number;
          avg_price: number;
          price_variance: number;
          totalRevenue: number;
          totalQuantity: number;
          dealCount: number;
          avg_deal_value: number;
          lastSaleDate: string;
        }>;
        total_records: number;
        unique_products: number;
        date_range: {
          start: string;
          end: string;
        };
      };
      source: string;
      timestamp: string;
    }>('/api/ploomes/pricing-history', {
      params: filters,
    }).then((res) => {
      if (!res.data.success) {
        throw new Error(res.data.error || 'Failed to fetch pricing history');
      }
      return res.data;
    }),
};

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

/**
 * Helper function to format percentage
 */
export const formatPercentage = (value: number): string => {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
};

/**
 * Helper function to get status color for deals
 */
export const getStatusColor = (status: string): string => {
  switch (status) {
    case 'won': return 'text-green-600 bg-green-100';
    case 'lost': return 'text-red-600 bg-red-100';
    case 'open': return 'text-blue-600 bg-blue-100';
    default: return 'text-gray-600 bg-gray-100';
  }
};

/**
 * Helper function to format document (CPF/CNPJ)
 */
export const formatDocument = (document: string): string => {
  if (!document) return '';

  // Remove non-digits
  const digits = document.replace(/\D/g, '');

  if (digits.length === 11) {
    // CPF format: 000.000.000-00
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  } else if (digits.length === 14) {
    // CNPJ format: 00.000.000/0000-00
    return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  }

  return document; // Return as-is if not CPF/CNPJ format
};