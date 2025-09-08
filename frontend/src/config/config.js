const getApiUrl = () => {
  // Em produção, usa caminho relativo (mesma origem)
  if (window.location.hostname !== 'localhost') {
    return '';
  }
  // Em desenvolvimento, usa localhost:3001
  return 'http://localhost:3001';
};

export const API_URL = getApiUrl();
export const API_BASE_URL = API_URL;

// Debug info
console.log('Environment Config:', {
  hostname: window.location.hostname,
  isProduction: window.location.hostname !== 'localhost',
  apiUrl: API_URL || 'Using relative path (same origin)'
});