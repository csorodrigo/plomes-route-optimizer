const getApiUrl = () => {
  const hostname = window.location.hostname;
  const isDevelopment = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0';
  
  // Em desenvolvimento local, usa localhost:3001
  if (isDevelopment) {
    return 'http://localhost:3001';
  }
  
  // Em produção ou qualquer outro ambiente, usa caminho relativo (mesma origem)
  return '';
};

export const API_URL = getApiUrl();
export const API_BASE_URL = API_URL;

// Environment detection
const isProduction = () => {
  const hostname = window.location.hostname;
  return hostname !== 'localhost' && hostname !== '127.0.0.1' && hostname !== '0.0.0.0';
};

// Debug info
console.log('Environment Config:', {
  hostname: window.location.hostname,
  origin: window.location.origin,
  isProduction: isProduction(),
  apiUrl: API_URL || 'Using relative path (same origin)',
  fullApiUrl: API_URL ? API_URL : window.location.origin
});