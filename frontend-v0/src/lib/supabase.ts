import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from './env.server';

let supabaseInstance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  // Return null if required env vars are missing
  if (!env.SUPABASE_URL || (!env.SUPABASE_SERVICE_ROLE_KEY && !env.SUPABASE_ANON_KEY)) {
    console.warn('Supabase credentials missing, running without database');
    return null;
  }

  // Create singleton instance - use ANON_KEY if SERVICE_ROLE_KEY is invalid
  if (!supabaseInstance) {
    const key = env.SUPABASE_ANON_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
    supabaseInstance = createClient(env.SUPABASE_URL, key);
  }

  return supabaseInstance;
}

export function hasSupabase(): boolean {
  return !!(env.SUPABASE_URL && (env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY));
}