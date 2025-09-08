import { API_URL } from '../config/config';

export const checkApiConnection = async () => {
  console.log('=== API Connection Check ===');
  console.log('API URL:', API_URL || 'Using relative path (same origin)');
  console.log('Current location:', window.location.hostname);
  console.log('Is Production:', window.location.hostname !== 'localhost');
  console.log('Full URL:', window.location.href);
  console.log('===========================');
};

// Export for debugging
window.checkApiConnection = checkApiConnection;