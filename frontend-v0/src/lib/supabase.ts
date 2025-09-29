import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from './env.server';

let supabaseInstance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  // Return null if required env vars are missing
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('Supabase credentials missing, running without database');
    return null;
  }

  // Create singleton instance
  if (!supabaseInstance) {
    supabaseInstance = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  }

  return supabaseInstance;
}

export function hasSupabase(): boolean {
  return !!(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
}