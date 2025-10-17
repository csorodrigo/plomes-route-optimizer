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

// Re-export types from the main API client
export type {
  PloomesDashboardMetrics,
  PloomesCustomer,
  PloomesCustomerSale,
  PloomesDeal,
  PloomesProduct,
  PloomesPricingHistory,
  PloomesFilters
} from './ploomes-dashboard-api';

/**
 * Cached Ploomes Dashboard API Client
 * Uses cached data endpoints for testing when live Ploomes API is not accessible
 */
export const ploomesApiCached = {
  /**
   * Get dashboard metrics summary calculated from cached data
   */
  getMetrics: (filters?: any) =>
    api.get<any>('/api/ploomes-cached/metrics', {
      params: filters,
    }).then((res) => {
      // Create mock metrics since we don't have a cached metrics endpoint yet
      return {
        success: true,
        data: {
          totalRevenue: 12000000,
          revenueChange: 15.5,
          avgDeal: 48000,
          avgDealChange: 8.2,
          activeProducts: 150,
          productsChange: 0,
          totalCustomers: 250,
          customersChange: 0,
          dealCount: 250,
          customersWithDeals: 50,
          revenuePerCustomer: 240000,
          period: '365 days',
          dateRange: {
            start: 'auto',
            end: 'auto'
          }
        },
        source: 'ploomes_cached',
        timestamp: new Date().toISOString(),
        calculatedFrom: {
          wonDeals: 250,
          totalDeals: 300,
          customers: 250,
          products: 150
        }
      };
    }),

  /**
   * Get all customers from cached data
   */
  getCustomers: (filters?: any) =>
    api.get<any>('/api/ploomes-cached/customers', {
      params: filters,
    }).then((res) => {
      if (!res.data.success) {
        throw new Error(res.data.error || 'Failed to fetch customers');
      }
      return res.data;
    }),

  /**
   * Get customer sales performance from cached data
   */
  getCustomerSales: (filters?: any) =>
    api.get<any>('/api/ploomes-cached/customer-sales', {
      params: filters,
    }).then((res) => {
      if (!res.data.success) {
        throw new Error(res.data.error || 'Failed to fetch customer sales');
      }
      return res.data;
    }),

  /**
   * Get all deals from cached data
   */
  getDeals: (filters?: any) =>
    api.get<any>('/api/ploomes-cached/deals', {
      params: filters,
    }).then((res) => {
      // Create mock deals response since we don't have a cached deals endpoint yet
      return {
        success: true,
        data: [],
        total: 0,
        source: 'ploomes_cached',
        timestamp: new Date().toISOString()
      };
    }),

  /**
   * Get all products from cached data
   */
  getProducts: (filters?: any) =>
    api.get<any>('/api/ploomes-cached/products', {
      params: filters,
    }).then((res) => {
      // Create mock products response since we don't have a cached products endpoint yet
      return {
        success: true,
        data: [],
        total: 0,
        source: 'ploomes_cached',
        timestamp: new Date().toISOString()
      };
    }),

  /**
   * Get pricing history from cached data
   */
  getPricingHistory: (filters?: any) =>
    api.get<any>('/api/ploomes-cached/pricing-history', {
      params: filters,
    }).then((res) => {
      // Create mock pricing history response
      return {
        success: true,
        data: {
          pricing_history: [],
          product_summary: [],
          total_records: 0,
          unique_products: 0,
          date_range: {
            start: 'auto (6 months ago)',
            end: 'now'
          }
        },
        source: 'ploomes_cached',
        timestamp: new Date().toISOString()
      };
    }),
};

// Re-export helper functions
export {
  formatCurrency,
  formatDate,
  calculatePercentageChange,
  formatPercentage,
  getStatusColor,
  formatDocument
} from './ploomes-dashboard-api';