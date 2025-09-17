// API Configuration - Railway-aware
const getApiUrl = () => {
    // If explicitly set via environment variable, use it
    if (process.env.REACT_APP_API_URL) {
        return process.env.REACT_APP_API_URL;
    }

    // In production (Railway), use same origin (SPA served by backend)
    if (process.env.NODE_ENV === 'production') {
        return window.location.origin;
    }

    // In development, use localhost with backend port
    return 'http://localhost:3001';
};

export const API_URL = getApiUrl();
export const API_ENDPOINTS = {
    auth: {
        login: '/api/auth/login',
        register: '/api/auth/register',
        logout: '/api/auth/logout',
        verify: '/api/auth/verify',
        profile: '/api/auth/profile'
    },
    ploomes: {
        customers: '/api/ploomes/customers',
        sync: '/api/ploomes/sync',
        status: '/api/ploomes/status'
    },
    route: {
        optimize: '/api/route/optimize',
        geocode: '/api/route/geocode'
    }
};

export default { API_URL, API_ENDPOINTS };