"use client";

import axios from "axios";
import type { AxiosRequestConfig } from "axios";

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
  lat?: number;
  lng?: number;
  ploome_person_id?: string;
}

export interface GeocodeResponse {
  lat: number;
  lng: number;
  latitude?: number; // Backward compatibility
  longitude?: number; // Backward compatibility
  address?: string;
  city?: string;
  state?: string;
  cep?: string;
  provider?: string;
  success?: boolean;
}

export interface RouteOptimizationResponse {
  totalDistance: number;
  estimatedTime: number;
  waypoints: Array<{
    id?: string;
    name: string;
    lat: number;
    lng: number;
    address?: string;
    isOrigin?: boolean;
  }>;
  polyline?: string;
  realRoute?: {
    distance?: { text: string; value: number };
    duration?: { text: string; value: number };
    coordinates?: Array<[number, number]>;
    decodedPath?: Array<{ lat: number; lng: number }>;
    polyline?: string;
    fallback?: boolean;
    legs?: Array<{
      distance: { text: string; value: number };
      duration: { text: string; value: number };
      start_location: { lat: number; lng: number };
      end_location: { lat: number; lng: number };
    }>;
  };
}

export interface StatisticsResponse {
  totalCustomers?: number;
  geocodedCustomers?: number;
  unGeocodedCustomers?: number;
  lastSync?: string;
}

// Environment-based API configuration
const getApiBaseUrl = (): string => {
  // 1. Use explicit environment variable if provided
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }

  // 2. Production detection (works in both SSR and client)
  const isProduction = process.env.NODE_ENV === 'production';
  const isVercel = process.env.VERCEL === '1' ||
                   (typeof window !== "undefined" && window.location.hostname.includes('vercel.app'));

  // 3. Use relative URLs for Vercel production deployments
  if (isProduction && isVercel) {
    return ""; // Relative URLs - let Vercel handle routing
  }

  // 4. Fallback to localhost for development
  return "http://localhost:3001";
};

const API_BASE_URL = getApiBaseUrl();

// Debug logging for API configuration
if (typeof window !== "undefined" && process.env.NODE_ENV === 'development') {
  console.log('🔧 API Configuration Debug:', {
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    VERCEL: process.env.VERCEL,
    hostname: window.location.hostname,
    origin: window.location.origin,
    calculatedBaseUrl: API_BASE_URL,
  });
}

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000,
  headers: {
    "Content-Type": "application/json",
    "X-Requested-With": "XMLHttpRequest",
  },
  withCredentials: true,
});

type AxiosConfig = AxiosRequestConfig;

api.interceptors.request.use(
  (config) => {
    if (typeof window !== "undefined") {
      const token = window.localStorage.getItem("auth_token");
      if (token) {
        config.headers = config.headers ?? {};
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== "undefined") {
      window.localStorage.removeItem("auth_token");
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }

    const message =
      error.response?.data?.message ??
      error.response?.data?.error ??
      error.message ??
      "Erro desconhecido";

    return Promise.reject(new Error(message));
  }
);

interface CustomerListResponse {
  success: boolean;
  count: number;
  customers: Customer[];
}

export interface LoginResponse {
  success: boolean;
  message?: string;
  token?: string;
  user?: {
    id: number;
    email: string;
    name: string;
    lastLogin: string;
  };
}

export const apiService = {
  login: (email: string, password: string) =>
    api
      .post<LoginResponse>("/api/auth/login", {
        email: email.toLowerCase(),
        password,
      })
      .then((res) => res.data),

  verify: () => api.get<{ success: boolean; user: Record<string, unknown> }>("/api/auth/verify").then((res) => res.data),

  getStatistics: () => api.get<StatisticsResponse>("/api/statistics").then((res) => res.data),

  getCustomers: async (params: AxiosConfig["params"] = {}) => {
    const res = await api.get<CustomerListResponse>("/api/customers", { params, timeout: 60000 });
    return res.data;
  },

  geocodeAddress: (cep: string, options: AxiosConfig = {}) =>
    api
      .get<GeocodeResponse>(`/api/geocoding/cep/${cep.replace(/\D/g, "")}`, options)
      .then((res) => res.data),

  optimizeRoute: async (
    origin: { lat: number; lng: number; cep?: string },
    waypoints: Array<{ lat: number; lng: number; name?: string; id?: string }>,
    options: Record<string, unknown> = {}
  ) => {
    const res = await api.post<{ success: boolean; route: RouteOptimizationResponse }>("/api/routes/optimize", {
      origin,
      waypoints,
      options,
    });
    return res.data;
  },

  syncCustomers: () => api.post("/api/sync/customers", {}, { timeout: 300000 }).then((res) => res.data),
};

export type { Customer as ApiCustomer };
