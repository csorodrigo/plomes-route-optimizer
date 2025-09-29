// Detectar automaticamente a URL da API
const getApiUrl = () => {
  // Se estiver definida explicitamente, usar ela
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }

  // Se estiver em produção (domínio do Vercel), usar a mesma origem
  if (window.location.hostname.includes('vercel.app')) {
    return window.location.origin;
  }

  // Desenvolvimento local
  return 'http://localhost:3001';
};

export const API_URL = getApiUrl();
export const PLOOME_API_KEY = process.env.REACT_APP_PLOOME_API_KEY || '';