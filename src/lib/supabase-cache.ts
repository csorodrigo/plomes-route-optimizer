/**
 * Supabase Cache Utility
 *
 * Provides caching layer using Supabase database
 * Used as fallback when Vercel CDN cache misses
 */

import { createClient } from '@supabase/supabase-js';
import { env } from './env.server';

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

/**
 * Get cached data from Supabase
 * Returns null if cache miss or expired
 */
export async function getCache<T = any>(key: string): Promise<T | null> {
  try {
    const { data, error } = await supabase
      .from('api_cache')
      .select('data')
      .eq('key', key)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (error || !data) {
      console.log(`[SUPABASE CACHE] ❌ MISS: ${key}`);
      return null;
    }

    console.log(`[SUPABASE CACHE] ✅ HIT: ${key}`);
    return data.data as T;
  } catch (error) {
    console.error(`[SUPABASE CACHE] Error getting cache for ${key}:`, error);
    return null;
  }
}

/**
 * Set cache data in Supabase with TTL
 * @param key - Cache key
 * @param data - Data to cache
 * @param ttlMinutes - Time to live in minutes (default: 5)
 */
export async function setCache<T = any>(
  key: string,
  data: T,
  ttlMinutes: number = 5
): Promise<void> {
  try {
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

    const { error } = await supabase
      .from('api_cache')
      .upsert({
        key,
        data,
        expires_at: expiresAt.toISOString()
      }, {
        onConflict: 'key'
      });

    if (error) {
      console.error(`[SUPABASE CACHE] Error setting cache for ${key}:`, error);
      return;
    }

    console.log(`[SUPABASE CACHE] 💾 SET: ${key} (ttl: ${ttlMinutes}min)`);
  } catch (error) {
    console.error(`[SUPABASE CACHE] Error setting cache for ${key}:`, error);
  }
}

/**
 * Delete cache entry
 */
export async function clearCache(key: string): Promise<void> {
  try {
    await supabase
      .from('api_cache')
      .delete()
      .eq('key', key);

    console.log(`[SUPABASE CACHE] 🗑️  CLEAR: ${key}`);
  } catch (error) {
    console.error(`[SUPABASE CACHE] Error clearing cache for ${key}:`, error);
  }
}

/**
 * Clean up all expired cache entries
 */
export async function cleanupExpiredCache(): Promise<void> {
  try {
    const { error } = await supabase.rpc('cleanup_expired_cache');

    if (error) {
      console.error('[SUPABASE CACHE] Error cleaning up expired cache:', error);
      return;
    }

    console.log('[SUPABASE CACHE] 🧹 Cleaned up expired cache entries');
  } catch (error) {
    console.error('[SUPABASE CACHE] Error cleaning up expired cache:', error);
  }
}
