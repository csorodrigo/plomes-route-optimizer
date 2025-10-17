"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { apiService } from '@/lib/api';

interface AuthUser {
  id: number;
  email: string;
  name: string;
  lastLogin?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{
    success: boolean;
    error?: string;
    user?: AuthUser;
  }>;
  signUp: (email: string, password: string, metadata?: { name?: string }) => Promise<{
    success: boolean;
    error?: string;
    user?: AuthUser;
  }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{
    success: boolean;
    error?: string;
  }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing auth token
    const checkAuthToken = async () => {
      try {
        const token = localStorage.getItem('auth_token');

        if (token) {
          // Verify token with API
          const result = await apiService.verify();
          if (result.success && result.user) {
            setUser(result.user);
            console.log('Auth state changed: INITIAL_SESSION', result.user.email);
          } else {
            // Invalid token, remove it
            localStorage.removeItem('auth_token');
          }
        }
      } catch (error) {
        console.error('Error verifying token:', error);
        localStorage.removeItem('auth_token');
      } finally {
        setLoading(false);
      }
    };

    checkAuthToken();
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true);

      const result = await apiService.login(email.toLowerCase().trim(), password);

      if (result.success && result.token && result.user) {
        // Store token in localStorage
        localStorage.setItem('auth_token', result.token);
        setUser(result.user);
        console.log('Auth state changed: SIGNED_IN', result.user.email);

        return {
          success: true,
          user: result.user,
        };
      }

      return {
        success: false,
        error: result.message || 'Falha no login. Tente novamente.',
      };
    } catch (error) {
      console.error('Sign in error:', error);
      return {
        success: false,
        error: 'Erro de conexão. Verifique sua internet e tente novamente.',
      };
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string, metadata?: { name?: string }) => {
    try {
      setLoading(true);

      // For now, sign up is not implemented with our custom API
      // This would need to be created as a new endpoint
      return {
        success: false,
        error: 'Registro não implementado. Entre em contato com o administrador.',
      };
    } catch (error) {
      console.error('Sign up error:', error);
      return {
        success: false,
        error: 'Erro de conexão. Verifique sua internet e tente novamente.',
      };
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setLoading(true);

      // Remove token from localStorage
      localStorage.removeItem('auth_token');
      setUser(null);
      console.log('Auth state changed: SIGNED_OUT');
    } catch (error) {
      console.error('Sign out error:', error);
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (email: string) => {
    try {
      // Reset password is not implemented with our custom API
      // This would need to be created as a new endpoint
      return {
        success: false,
        error: 'Reset de senha não implementado. Entre em contato com o administrador.',
      };
    } catch (error) {
      console.error('Reset password error:', error);
      return {
        success: false,
        error: 'Erro de conexão. Verifique sua internet e tente novamente.',
      };
    }
  };

  const value: AuthContextType = {
    user,
    loading,
    signIn,
    signUp,
    signOut,
    resetPassword,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}