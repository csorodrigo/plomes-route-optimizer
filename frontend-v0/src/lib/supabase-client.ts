"use client";

import { createClient } from '@supabase/supabase-js';
import { clientEnv } from './env.client';

// Singleton pattern for Supabase client
let supabaseClient: ReturnType<typeof createClient> | null = null;

export function getSupabaseClient() {
  if (!supabaseClient) {
    supabaseClient = createClient(
      clientEnv.SUPABASE_URL,
      clientEnv.SUPABASE_ANON_KEY,
      {
        auth: {
          persistSession: true,
          storageKey: 'supabase.auth.token',
          storage: typeof window !== 'undefined' ? window.localStorage : undefined,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      }
    );
  }
  return supabaseClient;
}

// Auth types
export interface AuthUser {
  id: string;
  email: string;
  user_metadata?: {
    name?: string;
    full_name?: string;
  };
  created_at: string;
  last_sign_in_at?: string;
}

export interface AuthResponse {
  user: AuthUser | null;
  session: {
    access_token: string;
    refresh_token: string;
    expires_at: number;
  } | null;
  error?: {
    message: string;
    status?: number;
  };
}

export interface SignUpData {
  email: string;
  password: string;
  options?: {
    data?: {
      name?: string;
      full_name?: string;
    };
  };
}

// Export the client for direct use
export const supabase = getSupabaseClient();