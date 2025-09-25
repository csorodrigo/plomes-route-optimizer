"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiService } from "@/lib/api";

interface User {
  id: number;
  email: string;
  name: string;
  lastLogin: string;
}

interface AuthState {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
}

export const useAuth = (): AuthState & { logout: () => void } => {
  const router = useRouter();
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    loading: true,
    isAuthenticated: false,
  });

  const logout = () => {
    localStorage.removeItem("auth_token");
    setAuthState({
      user: null,
      loading: false,
      isAuthenticated: false,
    });
    router.push("/login");
  };

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem("auth_token");

      if (!token) {
        setAuthState({
          user: null,
          loading: false,
          isAuthenticated: false,
        });
        return;
      }

      try {
        const response = await apiService.verify();

        if (response.success && response.user) {
          setAuthState({
            user: response.user,
            loading: false,
            isAuthenticated: true,
          });
        } else {
          // Invalid token
          localStorage.removeItem("auth_token");
          setAuthState({
            user: null,
            loading: false,
            isAuthenticated: false,
          });
        }
      } catch (error) {
        console.error("Auth verification failed:", error);
        localStorage.removeItem("auth_token");
        setAuthState({
          user: null,
          loading: false,
          isAuthenticated: false,
        });
      }
    };

    checkAuth();
  }, []);

  return {
    ...authState,
    logout,
  };
};

export const useRequireAuth = () => {
  const router = useRouter();
  const auth = useAuth();

  useEffect(() => {
    if (!auth.loading && !auth.isAuthenticated) {
      router.push("/login");
    }
  }, [auth.loading, auth.isAuthenticated, router]);

  return auth;
};