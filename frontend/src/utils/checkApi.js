import { API_URL } from '../config/config';

const isProduction = () => {
  const hostname = window.location.hostname;
  return hostname !== 'localhost' && hostname !== '127.0.0.1' && hostname !== '0.0.0.0';
};

export const checkApiConnection = async () => {
  console.log('=== API Connection Check ===');
  console.log('API URL:', API_URL || 'Using relative path (same origin)');
  console.log('Current location:', window.location.hostname);
  console.log('Current origin:', window.location.origin);
  console.log('Is Production:', isProduction());
  console.log('Full URL:', window.location.href);
  console.log('Full API URL:', API_URL ? API_URL : window.location.origin);
  console.log('===========================');
};

// Export for debugging
window.checkApiConnection = checkApiConnection;