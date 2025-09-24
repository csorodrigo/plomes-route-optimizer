import axios from 'axios';
import { API_URL } from '../config/config';

// Create axios instance with base configuration
const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Request interceptor for authentication and debugging
api.interceptors.request.use(
  (config) => {
    console.log('API Request:', config.method?.toUpperCase(), config.url);
    
    // Add auth token to headers if available
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    return config;
  },
  (error) => {
    console.error('API Request Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for error handling and auth
api.interceptors.response.use(
  (response) => {
    console.log('API Response interceptor - data:', response.data);
    return response.data;
  },
  (error) => {
    console.error('API Response Error:', error);
    
    if (error.response) {
      // Handle authentication errors
      if (error.response.status === 401) {
        // Token expired or invalid - remove it and redirect to login
        localStorage.removeItem('auth_token');
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
        throw new Error('Session expired. Please log in again.');
      }
      
      // Server responded with error status
      const message = error.response.data?.message || error.response.data?.error || 'Erro no servidor';
      throw new Error(message);
    } else if (error.request) {
      // Request made but no response received
      throw new Error('Servidor não está respondendo. Verifique sua conexão.');
    } else {
      // Something else happened
      throw new Error('Erro na requisição: ' + error.message);
    }
  }
);

// API methods
const apiService = {
  // Statistics
  getStatistics: () => api.get('/api/statistics'),

  // Customer management
  getCustomers: (params = {}) => api.get('/api/customers', { params }),
  
  getCustomersInRadius: (lat, lng, radius) => 
    api.get('/api/customers/radius', { 
      params: { lat, lng, radius } 
    }),

  // Geocoding
  geocodeAddress: (cep, options = {}) => api.get(`/api/geocoding/cep/${cep.replace(/\D/g, '')}`, options),

  geocodeBatch: (addresses) => api.post('/api/geocoding/batch', { addresses }),

  // Route optimization
  optimizeRoute: (origin, waypoints, options = {}) => 
    api.post('/api/routes/optimize', { 
      origin, 
      waypoints, 
      options 
    }),

  calculateRoute: (waypoints) => 
    api.post('/api/routes/calculate', { waypoints }),

  // Ploome integration
  syncCustomers: () => api.post('/api/sync/customers', {}, {
    timeout: 300000 // 5 minutes timeout for sync operations
  }),
  
  getPloomeStatus: () => api.get('/api/statistics'),

  testPloomeConnection: () => api.get('/api/test-connection'),

  // CEP services (deprecated - use geocodeAddress instead)
  getCepInfo: (cep) => api.get(`/api/geocoding/cep/${cep.replace(/\D/g, '')}`),

  // Geocoding queue management
  startGeocoding: () => api.post('/api/geocode/start'),

  getGeocodingProgress: () => api.get('/api/geocode/progress'),

  // Batch geocoding - NEW ENDPOINTS FOR GEOCODING FIX
  startBatchGeocoding: (batchSize = 50, skip = 0) =>
    api.post(`/api/geocoding/batch?batch_size=${batchSize}&skip=${skip}`),

  getGeocodingStatus: () => api.get('/api/geocoding/batch'), // Uses same endpoint with GET method

  // Utility functions for data formatting
  formatCustomerForMap: (customer) => ({
    id: customer.id,
    name: customer.name,
    email: customer.email,
    phone: customer.phone,
    address: customer.address,
    cep: customer.cep,
    city: customer.city,
    state: customer.state,
    lat: customer.latitude,
    lng: customer.longitude,
    ploomeId: customer.ploome_person_id,
  }),

  formatRouteWaypoint: (customer) => ({
    lat: customer.latitude || customer.lat,
    lng: customer.longitude || customer.lng,
    name: customer.name,
    address: customer.address,
    id: customer.id,
  }),
};

export default apiService;