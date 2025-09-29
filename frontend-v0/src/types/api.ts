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