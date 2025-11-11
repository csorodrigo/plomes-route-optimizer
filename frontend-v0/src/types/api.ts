/**
 * Comprehensive TypeScript interfaces for API responses and data structures
 * This file centralizes all type definitions to prevent TypeScript errors
 */

// Auth types
export interface User {
  id: number;
  email: string;
  name: string;
  lastLogin?: string; // Optional to handle existing users without this field
}

export interface AuthResponse {
  success: boolean;
  user?: User;
  token?: string;
  error?: string;
  message?: string;
}

// Customer types
export interface Customer {
  id: string;
  name: string;
  razao_social?: string; // Company legal name
  cnpj?: string; // Brazilian tax ID
  email?: string;
  phone?: string;
  address?: string;
  cep?: string;
  city?: string;
  state?: string;
  latitude?: number;
  longitude?: number;
  lat?: number; // Alternative naming
  lng?: number; // Alternative naming
  ploome_person_id?: string;
  distanceFromPrevious?: number; // For route optimization
}

// Ploome API response types
export interface PloomeContact {
  Id: number;
  Name: string;
  Email?: string;
  Phones?: Array<{
    PhoneNumber: string;
    PhoneType?: number;
  }>;
  Addresses?: Array<{
    Street: string;
    ZipCode: string;
    CityName: string;
    StateId: number;
    StateName: string;
  }>;
  LastActivityDate?: string;
  CreatedDate?: string;
}

export interface PloomeResponse {
  value?: PloomeContact[];
  '@odata.count'?: number;
  error?: {
    code: string;
    message: string;
  };
}

export interface PloomeDealsResponse {
  value?: Array<{
    Id: number;
    Title: string;
    Amount?: number;
    Status?: number;
    StageId?: number;
    CreatedDate?: string;
    ExpectedCloseDate?: string;
  }>;
  '@odata.count'?: number;
}

// Geocoding API response types
export interface GoogleGeocodingResult {
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  formatted_address: string;
  address_components: Array<{
    long_name: string;
    short_name: string;
    types: string[];
  }>;
}

export interface GoogleGeocodingResponse {
  status: 'OK' | 'ZERO_RESULTS' | 'INVALID_REQUEST' | 'OVER_DAILY_LIMIT' | 'OVER_QUERY_LIMIT' | 'REQUEST_DENIED' | 'UNKNOWN_ERROR';
  results: GoogleGeocodingResult[];
  error_message?: string;
}

export interface ViaCepResponse {
  cep: string;
  logradouro: string;
  complemento?: string;
  bairro: string;
  localidade: string;
  uf: string;
  ibge?: string;
  gia?: string;
  ddd?: string;
  siafi?: string;
  erro?: boolean;
}

export interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
  address?: {
    city?: string;
    state?: string;
    country?: string;
  };
}

export interface PositionstackResult {
  latitude: number;
  longitude: number;
  name?: string;
  label?: string;
  locality?: string;
  administrative_area?: string;
  region?: string;
  country?: string;
}

export interface PositionstackResponse {
  data?: PositionstackResult[];
  error?: {
    code: string;
    message: string;
  };
}

export interface GeocodeResponse {
  lat: number;
  lng: number;
  latitude?: number;
  longitude?: number;
  address?: string;
  city?: string;
  state?: string;
  cep?: string;
  provider?: string;
  success?: boolean;
  error?: string;
}

// Statistics types
export interface ContactStatistics {
  total: number;
  recentlyActive: number;
  withEmail: number;
  withPhone: number;
  withAddress: number;
  byState: Record<string, number>;
  byCity: Record<string, number>;
}

export interface ClientStatistics {
  total: number;
  withGeolocation: number;
  withoutGeolocation: number;
  byState: Record<string, number>;
  byCity: Record<string, number>;
  recentlyAdded: number;
}

export interface DealStatistics {
  total: number;
  totalAmount: number;
  averageAmount: number;
  openDeals: number;
  closedDeals: number;
  wonDeals: number;
  lostDeals: number;
  byStage: Record<string, number>;
  byMonth: Record<string, number>;
}

export interface SystemStatistics {
  contacts: ContactStatistics;
  clients: ClientStatistics;
  deals: DealStatistics;
  lastUpdated: string;
  geocodingStatus: {
    total: number;
    geocoded: number;
    pending: number;
    failed: number;
  };
}

// PDF Export types
export interface RouteStop extends Customer {
  order: number;
  distanceFromPrevious?: number;
  timeFromPrevious?: string;
  estimatedArrival?: string;
}

export interface RouteData {
  stops: RouteStop[];
  totalDistance?: number;
  totalTime?: string;
  optimized?: boolean;
  startLocation?: {
    lat: number;
    lng: number;
    address?: string;
  };
}

// HTTP Response types for error handling
export interface HttpsResponse {
  ok: boolean;
  status: number;
  statusText: string;
  json: () => Promise<unknown>;
  text: () => Promise<string>;
}

// Error types
export interface ApiError {
  success: false;
  error: string;
  code?: string;
  details?: unknown;
  timestamp?: string;
}

export interface ApiSuccess<T = unknown> {
  success: true;
  data?: T;
  message?: string;
  timestamp?: string;
}

export type ApiResponse<T = unknown> = ApiSuccess<T> | ApiError;

// Route params types for Next.js 15
export interface RouteParams {
  params: Promise<{
    [key: string]: string | string[];
  }>;
}

export interface CepRouteParams {
  params: Promise<{
    cep: string;
  }>;
}

// Dashboard API types
export interface DashboardMetrics {
  totalRevenue: number;
  avgDealValue: number;
  activeProducts: number;
  totalCustomers: number;
  topProducts: Array<{
    productId: string;
    productName: string;
    revenue: number;
    dealCount: number;
  }>;
  revenueByMonth: Record<string, number>;
  conversionRate: number;
}

export interface CustomerSalesData {
  customerId: string;
  customerName: string;
  totalRevenue: number;
  dealCount: number;
  avgDealSize: number;
  lastSaleDate?: string;
  status: 'active' | 'inactive';
}

export interface CustomerSalesResponse {
  success: boolean;
  data: CustomerSalesData[];
  summary: {
    totalCustomersWithSales: number;
    activeCustomers: number;
    totalRevenue: number;
    totalDeals: number;
    avgRevenuePerCustomer: number;
  };
  metadata: {
    source: string;
    timestamp: string;
    filters: {
      limit: number;
      sortBy: string;
    };
  };
}

export interface ProductPerformance {
  productId: string;
  productName: string;
  category?: string;
  totalSold: number;
  revenue: number;
  dealCount: number;
  avgDealSize: number;
  uniqueCustomers: number;
  growthRate?: number;
  lastSaleDate?: string;
}

export interface ProductPerformanceResponse {
  success: boolean;
  data: ProductPerformance[];
  summary: {
    totalProducts: number;
    totalRevenue: number;
    totalUnitsSold: number;
    avgRevenuePerProduct: number;
    categoryBreakdown: Record<string, { count: number; revenue: number }>;
  };
  metadata: {
    source: string;
    timestamp: string;
    filters: {
      limit: number;
      category: string | null;
    };
  };
}

export interface PricingHistoryRecord {
  customerId: string;
  customerName: string;
  productId: string;
  productName: string;
  price: number;
  validFrom: string;
  validTo?: string;
  minPriceEver: number;
  maxPriceEver: number;
  currentPrice: boolean;
  warning?: string;
}

export interface PricingHistoryResponse {
  success: boolean;
  data: PricingHistoryRecord[];
  summary: {
    totalRecords: number;
    uniqueCustomers: number;
    priceRange: {
      min: number;
      max: number;
      avg: number;
      variance: number;
      volatility: number;
    };
    customerSummary: Array<{
      customerId: string;
      customerName: string;
      avgPrice: number;
      minPrice: number;
      maxPrice: number;
      priceChanges: number;
    }>;
  };
  metadata: {
    source: string;
    timestamp: string;
    filters: {
      productId: string;
      customerId: string | null;
    };
  };
}

export interface DashboardMetricsResponse {
  success: boolean;
  data: DashboardMetrics;
  metadata: {
    source: string;
    timestamp: string;
    filters: {
      startDate: string | null;
      endDate: string | null;
      statusId: string | null;
    };
    period: {
      dealCount: number;
      dataPoints: number;
    };
  };
}