import useSWR from 'swr';
// Use DIRECT Ploomes API for real-time data - NO SUPABASE!
import { ploomesClient } from '@/lib/ploomes-client';
import type {
  DashboardMetrics,
  CustomerSale,
  ProductPerformance,
  PricingHistoryEntry,
  ApiResponse,
  DateRange,
} from '../types/dashboard';

interface PloomesFilters {
  startDate?: string;
  endDate?: string;
  customerId?: string;
  productId?: string;
  search?: string;
  active?: boolean;
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch data');
  return res.json();
};

/**
 * METRICS FROM LIVE PLOOMES API - NO SUPABASE CACHE!
 */
export function useDashboardMetrics(dateRange?: DateRange) {
  const { data, error, isLoading, mutate } = useSWR(
    ['dashboard-metrics-live', dateRange],
    async () => {
      console.log('🔥 [DASHBOARD] Fetching LIVE metrics via new endpoint...');

      // Build query parameters
      const params = new URLSearchParams();
      if (dateRange?.startDate) params.append('startDate', dateRange.startDate);
      if (dateRange?.endDate) params.append('endDate', dateRange.endDate);

      const url = `/api/dashboard/metrics-live${params.toString() ? '?' + params.toString() : ''}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to fetch metrics: ${response.statusText}`);
      }

      return response.json();
    },
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 30000, // 30 seconds (shorter for live data)
      errorRetryCount: 3,
      errorRetryInterval: 2000,
    }
  );

  return {
    metrics: data?.data,
    isLoading,
    isError: error,
    refresh: mutate,
    source: data?.metadata?.source || 'ploomes_live_api',
    timestamp: data?.metadata?.timestamp,
  };
}

/**
 * CUSTOMER SALES FROM LIVE PLOOMES API - NO SUPABASE CACHE!
 */
export function useCustomerSales(dateRange?: DateRange, search?: string) {
  const { data, error, isLoading, mutate } = useSWR(
    ['dashboard-customers-live', search, dateRange],
    async () => {
      console.log('🔥 [DASHBOARD] Fetching LIVE customer sales via new endpoint...');

      // Build query parameters
      const params = new URLSearchParams();
      if (search) params.append('search', search);

      const url = `/api/dashboard/customers-live${params.toString() ? '?' + params.toString() : ''}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to fetch customers: ${response.statusText}`);
      }

      return response.json();
    },
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000, // 1 minute
      errorRetryCount: 3,
      errorRetryInterval: 2000,
    }
  );

  return {
    sales: data?.data || [],
    summary: data?.metadata,
    isLoading,
    isError: error,
    refresh: mutate,
    source: data?.metadata?.source || 'ploomes_live_api',
    timestamp: data?.metadata?.timestamp,
  };
}

/**
 * PRODUCT PERFORMANCE FROM LIVE PLOOMES API - REAL DEAL DATA
 */
export function useProductPerformance(dateRange?: DateRange, category?: string) {
  const { data, error, isLoading, mutate } = useSWR(
    ['ploomes-product-performance-live', dateRange, category],
    async () => {
      console.log('🔥 [DASHBOARD] Fetching LIVE product performance with real deal data...');

      // Build query parameters
      const params = new URLSearchParams();
      if (dateRange?.startDate) params.append('startDate', dateRange.startDate);
      if (dateRange?.endDate) params.append('endDate', dateRange.endDate);
      if (category) params.append('category', category);

      const url = `/api/dashboard/product-performance${params.toString() ? '?' + params.toString() : ''}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to fetch product performance: ${response.statusText}`);
      }

      const result = await response.json();

      console.log(`🔥 [LIVE PRODUCT PERFORMANCE] Found ${result.data?.length || 0} products with real sales data`);

      return result;
    },
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000, // 1 minute for expensive operation
      errorRetryCount: 3,
      errorRetryInterval: 2000,
    }
  );

  return {
    products: data?.data || [],
    isLoading,
    isError: error,
    refresh: mutate,
    source: data?.metadata?.source || 'ploomes_live_api_with_products',
    timestamp: data?.metadata?.timestamp,
    summary: data?.metadata?.summary
  };
}

/**
 * PRICING HISTORY FROM LIVE PLOOMES API
 */
export function usePricingHistory(productId?: string, customerId?: string) {
  const shouldFetch = productId || customerId;

  const { data, error, isLoading, mutate } = useSWR(
    shouldFetch ? ['ploomes-pricing-history-live', productId, customerId] : null,
    async () => {
      console.log('🔥 [DASHBOARD] Fetching LIVE pricing history from Ploomes API...');

      let dealFilter = "StatusId eq 2"; // Won deals only
      if (customerId) {
        dealFilter += ` and ContactId eq ${customerId}`;
      }

      // Get recent deals with products
      const deals = await ploomesClient.getDeals({
        select: ['Id', 'Title', 'Amount', 'CreatedDate', 'ContactId'],
        filter: dealFilter,
        top: 100,
        orderby: 'CreatedDate desc'
      });

      const pricingHistory: PricingHistoryEntry[] = [];
      const productSummary = new Map();

      // For each deal, try to get products
      for (const deal of deals.slice(0, 10)) { // Process first 10 for performance
        try {
          const dealProducts = await ploomesClient.getDealProducts(deal.Id);

          dealProducts.forEach((dp: any) => {
            const product = dp.Product;
            if (product && (!productId || product.Id.toString() === productId)) {
              const entry: PricingHistoryEntry = {
                deal_id: deal.Id.toString(),
                customer_id: deal.ContactId?.toString() || '',
                product_id: product.Id.toString(),
                product_name: product.Name || 'Unknown',
                price: dp.UnitPrice || product.Price || 0,
                quantity: dp.Quantity || 1,
                total: (dp.UnitPrice || product.Price || 0) * (dp.Quantity || 1),
                date: deal.CreatedDate || new Date().toISOString()
              };
              pricingHistory.push(entry);

              // Update product summary
              const key = product.Id.toString();
              const existing = productSummary.get(key) || {
                product_id: key,
                product_name: product.Name,
                total_revenue: 0,
                total_quantity: 0,
                deal_count: 0
              };
              existing.total_revenue += entry.total;
              existing.total_quantity += entry.quantity;
              existing.deal_count += 1;
              productSummary.set(key, existing);
            }
          });
        } catch (error) {
          console.error(`Error fetching products for deal ${deal.Id}:`, error);
        }
      }

      console.log(`🔥 [LIVE PRICING] Found ${pricingHistory.length} pricing entries`);

      return {
        data: {
          pricing_history: pricingHistory,
          product_summary: Array.from(productSummary.values()),
          total_records: pricingHistory.length,
          unique_products: productSummary.size
        },
        metadata: {
          source: 'ploomes_live_api',
          timestamp: new Date().toISOString()
        }
      };
    },
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000,
      errorRetryCount: 3,
      errorRetryInterval: 2000,
    }
  );

  return {
    history: data?.data?.pricing_history || [],
    productSummary: data?.data?.product_summary || [],
    totalRecords: data?.data?.total_records || 0,
    uniqueProducts: data?.data?.unique_products || 0,
    dateRange: data?.data?.date_range,
    isLoading,
    isError: error,
    refresh: mutate,
    source: data?.metadata?.source || 'ploomes_live_api',
    timestamp: data?.metadata?.timestamp,
  };
}

/**
 * CUSTOMERS FROM LIVE PLOOMES API - DIRECT!
 */
export function useCustomers(search?: string, active?: boolean) {
  const { data, error, isLoading, mutate } = useSWR(
    ['ploomes-customers-direct', search, active],
    async () => {
      console.log('🔥 [DASHBOARD] Fetching LIVE customers from Ploomes API...');

      let filter = "StatusId eq 1"; // Active contacts
      if (search) {
        filter += ` and contains(Name,'${search}')`;
      }

      const contacts = await ploomesClient.getContacts({
        select: ['Id', 'Name', 'Document', 'Email', 'TypeId'],
        filter: filter,
        top: 100
      });

      const customers = contacts.map(contact => ({
        id: contact.Id.toString(),
        name: contact.Name || 'Unknown',
        document: contact.Document || '',
        email: contact.Email || '',
        type: contact.TypeId === 1 ? 'Empresa' : 'Pessoa'
      }));

      console.log(`🔥 [LIVE CUSTOMERS] Found ${customers.length} customers`);

      return {
        data: customers,
        metadata: {
          source: 'ploomes_live_api',
          timestamp: new Date().toISOString(),
          totalCustomers: customers.length
        }
      };
    },
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000,
      errorRetryCount: 3,
      errorRetryInterval: 2000,
    }
  );

  return {
    customers: data?.data || [],
    isLoading,
    isError: error,
    refresh: mutate,
    source: data?.metadata?.source || 'ploomes_live_api',
    timestamp: data?.metadata?.timestamp,
  };
}

/**
 * DEALS FROM LIVE PLOOMES API - DIRECT!
 */
export function useDeals(filters?: PloomesFilters) {
  const { data, error, isLoading, mutate } = useSWR(
    ['ploomes-deals-direct', filters],
    async () => {
      console.log('🔥 [DASHBOARD] Fetching LIVE deals from Ploomes API...');

      let dealFilter = "StatusId eq 2"; // Won deals only
      if (filters?.customerId) {
        dealFilter += ` and ContactId eq ${filters.customerId}`;
      }

      const deals = await ploomesClient.getDeals({
        select: ['Id', 'Title', 'Amount', 'CreatedDate', 'ContactId', 'StatusId'],
        filter: dealFilter,
        top: 200,
        orderby: 'CreatedDate desc'
      });

      console.log(`🔥 [LIVE DEALS] Found ${deals.length} deals`);

      return {
        data: deals,
        metadata: {
          source: 'ploomes_live_api',
          timestamp: new Date().toISOString(),
          totalDeals: deals.length
        }
      };
    },
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000,
      errorRetryCount: 3,
      errorRetryInterval: 2000,
    }
  );

  return {
    deals: data?.data || [],
    isLoading,
    isError: error,
    refresh: mutate,
    source: data?.metadata?.source || 'ploomes_live_api',
    timestamp: data?.metadata?.timestamp,
  };
}

/**
 * CUSTOMER DEAL PRODUCTS FROM LIVE PLOOMES API
 */
export function useCustomerDealProducts(customerId?: string, dealId?: string) {
  const shouldFetch = customerId || dealId;

  const { data, error, isLoading, mutate } = useSWR(
    shouldFetch ? ['ploomes-customer-deal-products', customerId, dealId] : null,
    async () => {
      console.log('🔥 [DASHBOARD] Fetching customer deal products from Ploomes API...');

      // Build query parameters
      const params = new URLSearchParams();
      if (customerId) params.append('customerId', customerId);
      if (dealId) params.append('dealId', dealId);

      const url = `/api/dashboard/customer-deal-products${params.toString() ? '?' + params.toString() : ''}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to fetch customer deal products: ${response.statusText}`);
      }

      const result = await response.json();

      console.log(`🔥 [CUSTOMER DEAL PRODUCTS] Found ${result.data?.length || 0} deals with products`);

      return result;
    },
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000,
      errorRetryCount: 3,
      errorRetryInterval: 2000,
    }
  );

  return {
    dealProducts: data?.data || [],
    isLoading,
    isError: error,
    refresh: mutate,
    source: data?.metadata?.source || 'ploomes_live_api_with_products',
    timestamp: data?.metadata?.timestamp,
    summary: data?.metadata?.summary
  };
}

export function useRefreshAll() {
  const { refresh: refreshMetrics } = useDashboardMetrics();
  const { refresh: refreshSales } = useCustomerSales();
  const { refresh: refreshProducts } = useProductPerformance();

  const refreshAll = async () => {
    await Promise.all([
      refreshMetrics(),
      refreshSales(),
      refreshProducts(),
    ]);
  };

  return { refreshAll };
}