import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { API_URL } from '../config/config';

const AuthContext = createContext();

// Custom hook to use auth context
export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

// Configure axios defaults
axios.defaults.baseURL = API_URL;
axios.defaults.withCredentials = true;
axios.defaults.timeout = 30000; // 30 second timeout to prevent hanging requests

const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [token, setToken] = useState(localStorage.getItem('auth_token'));

    // Logout function - defined early to avoid circular dependency
    const logout = useCallback(async () => {
        try {
            // Call logout endpoint if token exists
            if (token) {
                await axios.post('/api/auth/logout');
            }
        } catch (error) {
            // Ignore logout errors, clean up locally anyway
            console.error('Logout error:', error);
        } finally {
            // Always clean up local state
            localStorage.removeItem('auth_token');
            setToken(null);
            setUser(null);
            toast.info('You have been logged out');
        }
    }, [token]);

    // Setup axios interceptor for auth token
    useEffect(() => {
        const requestInterceptor = axios.interceptors.request.use(
            (config) => {
                const currentToken = localStorage.getItem('auth_token');
                if (currentToken) {
                    config.headers.Authorization = `Bearer ${currentToken}`;
                }
                return config;
            },
            (error) => {
                return Promise.reject(error);
            }
        );

        const responseInterceptor = axios.interceptors.response.use(
            (response) => response,
            (error) => {
                if (error.response?.status === 401) {
                    // Token expired or invalid
                    logout();
                    toast.error('Session expired. Please log in again.');
                }
                return Promise.reject(error);
            }
        );

        return () => {
            axios.interceptors.request.eject(requestInterceptor);
            axios.interceptors.response.eject(responseInterceptor);
        };
    }, [logout]);

    // Check if user is authenticated on app load
    useEffect(() => {
        const checkAuth = async () => {
            const savedToken = localStorage.getItem('auth_token');
            
            if (!savedToken) {
                setLoading(false);
                return;
            }

            try {
                const response = await axios.get('/api/auth/verify');
                
                if (response.data.success) {
                    setUser(response.data.user);
                    setToken(savedToken);
                } else {
                    localStorage.removeItem('auth_token');
                    setToken(null);
                }
            } catch (error) {
                console.error('Auth verification failed:', error);
                localStorage.removeItem('auth_token');
                setToken(null);
            } finally {
                setLoading(false);
            }
        };

        checkAuth();
    }, []);

    const login = async (email, password) => {
        try {
            setLoading(true);
            console.log('🔐 Starting login process for:', email);

            const response = await axios.post('/api/auth/login', {
                email: email.toLowerCase(),
                password
            });

            console.log('📡 Login response received:', response.status);

            if (response.data.success) {
                const { token: authToken, user: userData } = response.data;

                localStorage.setItem('auth_token', authToken);
                setToken(authToken);
                setUser(userData);

                toast.success(`Welcome back, ${userData.name}!`);
                console.log('✅ Login successful');

                return { success: true, user: userData };
            } else {
                console.log('❌ Login failed:', response.data.error);
                toast.error(response.data.error || 'Login failed');
                return { success: false, error: response.data.error };
            }
        } catch (error) {
            console.error('💥 Login error:', error);

            let errorMessage = 'An error occurred during login';

            if (error.code === 'ECONNABORTED') {
                errorMessage = 'Request timeout - please check your connection and try again';
            } else if (error.response?.data?.error) {
                errorMessage = error.response.data.error;
            } else if (error.response?.status) {
                errorMessage = `Server error (${error.response.status})`;
            } else if (error.request) {
                errorMessage = 'Unable to connect to server - please check your connection';
            }

            toast.error(errorMessage);
            return { success: false, error: errorMessage };
        } finally {
            setLoading(false);
        }
    };

    const register = async (email, password, name) => {
        try {
            setLoading(true);
            
            const response = await axios.post('/api/auth/register', {
                email: email.toLowerCase(),
                password,
                name: name.trim()
            });

            if (response.data.success) {
                const { token: authToken, user: userData } = response.data;
                
                localStorage.setItem('auth_token', authToken);
                setToken(authToken);
                setUser(userData);
                
                toast.success(`Welcome, ${userData.name}! Your account has been created.`);
                
                return { success: true, user: userData };
            } else {
                toast.error(response.data.error || 'Registration failed');
                return { success: false, error: response.data.error };
            }
        } catch (error) {
            const errorMessage = error.response?.data?.error || 'An error occurred during registration';
            toast.error(errorMessage);
            return { success: false, error: errorMessage };
        } finally {
            setLoading(false);
        }
    };


    const updateProfile = async (newName) => {
        try {
            const response = await axios.put('/api/auth/profile', {
                name: newName.trim()
            });

            if (response.data.success) {
                setUser(response.data.user);
                toast.success('Profile updated successfully');
                return { success: true };
            } else {
                toast.error(response.data.error || 'Profile update failed');
                return { success: false, error: response.data.error };
            }
        } catch (error) {
            const errorMessage = error.response?.data?.error || 'An error occurred while updating profile';
            toast.error(errorMessage);
            return { success: false, error: errorMessage };
        }
    };

    const changePassword = async (currentPassword, newPassword) => {
        try {
            const response = await axios.put('/api/auth/password', {
                currentPassword,
                newPassword
            });

            if (response.data.success) {
                toast.success('Password changed successfully. Please log in again.');
                
                // Force logout since all sessions are invalidated
                setTimeout(() => {
                    logout();
                }, 2000);
                
                return { success: true, requireReauth: true };
            } else {
                toast.error(response.data.error || 'Password change failed');
                return { success: false, error: response.data.error };
            }
        } catch (error) {
            const errorMessage = error.response?.data?.error || 'An error occurred while changing password';
            toast.error(errorMessage);
            return { success: false, error: errorMessage };
        }
    };

    const isAuthenticated = () => {
        return !!(token && user);
    };

    const getAuthHeader = () => {
        return token ? { Authorization: `Bearer ${token}` } : {};
    };

    const value = {
        user,
        token,
        loading,
        login,
        register,
        logout,
        updateProfile,
        changePassword,
        isAuthenticated,
        getAuthHeader
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export default AuthProvider;