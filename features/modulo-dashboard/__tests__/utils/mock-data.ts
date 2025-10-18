import type {
  DashboardMetrics,
  CustomerSale,
  ProductPerformance,
  PricingHistoryEntry,
  ApiResponse,
} from '../../types/dashboard';

// Dashboard Metrics Mock Data
export const mockDashboardMetrics: DashboardMetrics = {
  totalRevenue: 2500000.75,
  avgDeal: 125000.50,
  activeProducts: 45,
  totalCustomers: 128,
};

export const mockDashboardMetricsResponse: ApiResponse<DashboardMetrics> = {
  data: mockDashboardMetrics,
  success: true,
};

// Customer Sales Mock Data
export const mockCustomerSales: CustomerSale[] = [
  {
    customer_id: '1',
    customer_name: 'Empresa ABC Ltda',
    total_revenue: 850000.25,
    deal_count: 12,
    avg_deal_value: 70833.35,
    last_deal_date: '2024-03-15T10:30:00Z',
  },
  {
    customer_id: '2',
    customer_name: 'Indústria XYZ S.A.',
    total_revenue: 1200000.00,
    deal_count: 8,
    avg_deal_value: 150000.00,
    last_deal_date: '2024-03-10T14:20:00Z',
  },
  {
    customer_id: '3',
    customer_name: 'Comércio 123 ME',
    total_revenue: 450000.50,
    deal_count: 5,
    avg_deal_value: 90000.10,
    last_deal_date: '2024-02-28T09:15:00Z',
  },
];

export const mockCustomerSalesResponse: ApiResponse<CustomerSale[]> = {
  data: mockCustomerSales,
  success: true,
};

// Product Performance Mock Data
export const mockProductPerformance: ProductPerformance[] = [
  {
    productId: 'P001',
    productName: 'Equipamento Industrial A',
    revenue: 450000.75,
    unitsSold: 15,
    avgPrice: 30000.05,
    category: 'Industrial',
  },
  {
    productId: 'P002',
    productName: 'Sistema de Controle B',
    revenue: 320000.00,
    unitsSold: 8,
    avgPrice: 40000.00,
    category: 'Automação',
  },
  {
    productId: 'P003',
    productName: 'Componente Especial C',
    revenue: 180000.25,
    unitsSold: 25,
    avgPrice: 7200.01,
    category: 'Componentes',
  },
];

export const mockProductPerformanceResponse: ApiResponse<ProductPerformance[]> = {
  data: mockProductPerformance,
  success: true,
};

// Pricing History Mock Data
export const mockPricingHistory: PricingHistoryEntry[] = [
  {
    deal_id: 'D001',
    product_id: 'P001',
    product_name: 'Equipamento Industrial A',
    customer_id: '1',
    customer_name: 'Empresa ABC Ltda',
    price: 30000.00,
    quantity: 2,
    total: 60000.00,
    date: '2024-03-15T10:30:00Z',
    isMinimumPrice: false,
  },
  {
    deal_id: 'D002',
    product_id: 'P001',
    product_name: 'Equipamento Industrial A',
    customer_id: '2',
    customer_name: 'Indústria XYZ S.A.',
    price: 28500.00,
    quantity: 1,
    total: 28500.00,
    date: '2024-03-10T14:20:00Z',
    isMinimumPrice: true,
  },
  {
    deal_id: 'D003',
    product_id: 'P002',
    product_name: 'Sistema de Controle B',
    customer_id: '1',
    customer_name: 'Empresa ABC Ltda',
    price: 40000.00,
    quantity: 1,
    total: 40000.00,
    date: '2024-02-28T09:15:00Z',
    isMinimumPrice: false,
  },
];

export const mockPricingHistoryResponse: ApiResponse<PricingHistoryEntry[]> = {
  data: mockPricingHistory,
  success: true,
};

// Error Response Mock Data
export const mockErrorResponse: ApiResponse<null> = {
  data: null,
  success: false,
  error: 'Failed to fetch data from Ploomes API',
};

// Empty Data Mock
export const mockEmptyResponse: ApiResponse<any[]> = {
  data: [],
  success: true,
};

// Edge Case Data
export const mockExtremeMetrics: DashboardMetrics = {
  totalRevenue: 0,
  avgDeal: 0,
  activeProducts: 0,
  totalCustomers: 0,
};

export const mockLargeNumbers: DashboardMetrics = {
  totalRevenue: 999999999.99,
  avgDeal: 50000000.00,
  activeProducts: 9999,
  totalCustomers: 99999,
};

export const mockNegativeNumbers: DashboardMetrics = {
  totalRevenue: -50000.00,
  avgDeal: -5000.00,
  activeProducts: 0,
  totalCustomers: 0,
};

// Malformed data for error testing
export const mockMalformedData = {
  totalRevenue: 'not-a-number',
  avgDeal: null,
  activeProducts: undefined,
  totalCustomers: {},
};

// Date range mock data
export const mockDateRanges = {
  last7Days: {
    startDate: '2024-03-08',
    endDate: '2024-03-15',
  },
  last30Days: {
    startDate: '2024-02-14',
    endDate: '2024-03-15',
  },
  last90Days: {
    startDate: '2023-12-15',
    endDate: '2024-03-15',
  },
  custom: {
    startDate: '2024-01-01',
    endDate: '2024-03-15',
  },
};

// Chart data transformations
export const mockChartData = {
  barChart: mockProductPerformance.map(p => ({
    name: p.productName.substring(0, 15) + '...',
    revenue: p.revenue,
    unitsSold: p.unitsSold,
  })),
  lineChart: mockPricingHistory.map(h => ({
    date: new Date(h.date).toLocaleDateString('pt-BR'),
    price: h.price,
    productName: h.product_name,
  })),
  pieChart: mockProductPerformance.map(p => ({
    name: p.category || 'Outros',
    value: p.revenue,
    percentage: (p.revenue / mockProductPerformance.reduce((sum, item) => sum + item.revenue, 0) * 100).toFixed(1),
  })),
};

// API Response helpers
export const createSuccessResponse = <T>(data: T): ApiResponse<T> => ({
  data,
  success: true,
});

export const createErrorResponse = (error: string): ApiResponse<null> => ({
  data: null,
  success: false,
  error,
});

// Search and filter mock data
export const mockSearchResults = {
  'ABC': mockCustomerSales.filter(c => c.customer_name.includes('ABC')),
  'XYZ': mockCustomerSales.filter(c => c.customer_name.includes('XYZ')),
  'empty': [],
};

export const mockFilteredProducts = {
  'Industrial': mockProductPerformance.filter(p => p.category === 'Industrial'),
  'Automação': mockProductPerformance.filter(p => p.category === 'Automação'),
  'Componentes': mockProductPerformance.filter(p => p.category === 'Componentes'),
  'all': mockProductPerformance,
};

// Network conditions mock
export const mockNetworkConditions = {
  slow: (delay: number = 2000) => new Promise(resolve => setTimeout(resolve, delay)),
  timeout: () => new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Network timeout')), 5000)
  ),
  offline: () => Promise.reject(new Error('Network error: offline')),
};

// Loading states helper
export const createLoadingState = (isLoading: boolean = true) => ({
  data: undefined,
  error: undefined,
  isLoading,
  mutate: jest.fn(),
});

// SWR mock responses
export const mockSWRResponse = <T>(data: T, isLoading = false, error = null) => ({
  data,
  error,
  isLoading,
  isValidating: false,
  mutate: jest.fn(),
  size: 1,
  setSize: jest.fn(),
});

// Performance test data
export const generateLargeDataset = (size: number): CustomerSale[] => {
  return Array.from({ length: size }, (_, index) => ({
    customer_id: `customer_${index + 1}`,
    customer_name: `Cliente ${index + 1} Ltda`,
    total_revenue: Math.random() * 1000000,
    deal_count: Math.floor(Math.random() * 20) + 1,
    avg_deal_value: Math.random() * 100000,
    last_deal_date: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000).toISOString(),
  }));
};

export const generateLargeProductDataset = (size: number): ProductPerformance[] => {
  const categories = ['Industrial', 'Automação', 'Componentes', 'Serviços', 'Manutenção'];

  return Array.from({ length: size }, (_, index) => ({
    productId: `P${String(index + 1).padStart(3, '0')}`,
    productName: `Produto ${index + 1}`,
    revenue: Math.random() * 500000,
    unitsSold: Math.floor(Math.random() * 100) + 1,
    avgPrice: Math.random() * 50000,
    category: categories[index % categories.length],
  }));
};