"use client";

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading) {
      if (!user && pathname !== '/login') {
        // Redirect to login if not authenticated
        router.push('/login');
      } else if (user && pathname === '/login') {
        // Redirect authenticated users away from login page
        router.push('/dashboard/cliente');
      }
    }
  }, [user, loading, pathname, router]);

  // Show loading spinner while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent mx-auto mb-4" />
          <p className="text-slate-600">Verificando autenticação...</p>
        </div>
      </div>
    );
  }

  // Don't render protected content if not authenticated
  if (!user && pathname !== '/login') {
    return null;
  }

  return <>{children}</>;
}