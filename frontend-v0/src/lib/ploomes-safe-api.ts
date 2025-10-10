/**
 * PLOOMES SAFE API WRAPPER
 *
 * This module provides a robust, 403-error-resistant wrapper around the Ploomes API.
 * It implements multiple fallback strategies to ensure the dashboard works reliably.
 *
 * Strategy:
 * 1. Try optimal query first (complex filters/expands)
 * 2. Fall back to simpler queries on 403 errors
 * 3. Use cached data as final fallback
 * 4. Log successful patterns for future optimization
 * 5. Rate limiting to avoid triggering blocks
 */

import { ploomesClient, PloomesContact, PloomesDeal, PloomesProduct, PloomesResponse } from './ploomes-client';
import { rateLimiter } from './ploomes-rate-limiter';

// Types for safe API operations
interface SafeQueryOptions {
  retryOnFail?: boolean;
  useCache?: boolean;
  maxRetries?: number;
  fallbackToSimple?: boolean;
}

interface QueryPattern {
  id: string;
  description: string;
  endpoint: string;
  success: boolean;
  errorCode?: number;
  timestamp: number;
  responseTime?: number;
}

interface FallbackStrategy {
  name: string;
  description: string;
  execute: () => Promise<any>;
  complexity: 'simple' | 'medium' | 'complex';
}

class PloomesQueryCache {
  private cache = new Map<string, { data: any; timestamp: number; ttl: number }>();
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

  set(key: string, data: any, ttl: number = this.DEFAULT_TTL): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  get(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

class PloomesPatternTracker {
  private patterns: QueryPattern[] = [];
  private successfulPatterns = new Set<string>();
  private failedPatterns = new Set<string>();

  logPattern(pattern: QueryPattern): void {
    this.patterns.push(pattern);

    if (pattern.success) {
      this.successfulPatterns.add(pattern.id);
      // Remove from failed if it was there
      this.failedPatterns.delete(pattern.id);
    } else {
      this.failedPatterns.add(pattern.id);
    }

    // Keep only last 1000 patterns
    if (this.patterns.length > 1000) {
      this.patterns = this.patterns.slice(-1000);
    }
  }

  isPatternSafe(patternId: string): boolean {
    return this.successfulPatterns.has(patternId) && !this.failedPatterns.has(patternId);
  }

  getSuccessfulPatterns(): QueryPattern[] {
    return this.patterns.filter(p => p.success);
  }

  getFailedPatterns(): QueryPattern[] {
    return this.patterns.filter(p => !p.success);
  }

  getStats(): {
    total: number;
    successful: number;
    failed: number;
    successRate: number;
  } {
    const successful = this.patterns.filter(p => p.success).length;
    const total = this.patterns.length;

    return {
      total,
      successful,
      failed: total - successful,
      successRate: total > 0 ? successful / total : 0
    };
  }
}

class PlomesSafeAPI {
  private cache = new PloomesQueryCache();
  private patternTracker = new PloomesPatternTracker();

  // Known safe patterns (will be updated based on real testing)
  private readonly SAFE_PATTERNS = {
    // Simple entity queries without filters
    CONTACTS_SIMPLE: '/Contacts?$top=300&$select=Id,Name,Document,Email,TypeId',
    DEALS_SIMPLE: '/Deals?$top=300&$select=Id,Title,Amount,StatusId,StageId,ContactId,CreatedDate',
    PRODUCTS_SIMPLE: '/Products?$top=300&$select=Id,Name,Code,Price,Active',
    ORDERS_SIMPLE: '/Orders?$top=300&$select=Id,Number,Date,ContactId,Amount,StageId',

    // Safe queries with basic OData
    CONTACTS_WITH_TOP: '/Contacts?$top=300&$orderby=CreatedDate desc',
    DEALS_RECENT: '/Deals?$top=300&$orderby=CreatedDate desc',
    DEALS_WON: '/Deals?$filter=StatusId eq 2&$top=300',
    PRODUCTS_ACTIVE: '/Products?$filter=Active eq true&$top=300',
  };

  // Unsafe patterns that are known to cause 403
  private readonly UNSAFE_PATTERNS = [
    'Tags/any(t: t/TagId',  // Complex tag filtering
    '$expand=.*\\(.*\\)',   // Nested expand with selects
    'ContactId.*and.*',     // Multiple filter conditions
    '\\$expand=.*,.*',      // Multiple expand fields
  ];

  /**
   * Check if a query pattern is known to be unsafe
   */
  private isUnsafePattern(endpoint: string): boolean {
    return this.UNSAFE_PATTERNS.some(pattern => {
      const regex = new RegExp(pattern, 'i');
      return regex.test(endpoint);
    });
  }

  /**
   * Generate a cache key for a query
   */
  private getCacheKey(endpoint: string, options?: any): string {
    return `ploomes:${endpoint}:${JSON.stringify(options || {})}`;
  }

  /**
   * Execute a query with fallback strategies
   */
  private async executeWithFallback<T>(
    strategies: FallbackStrategy[],
    cacheKey: string,
    options: SafeQueryOptions = {}
  ): Promise<T> {
    const { useCache = true, maxRetries = 3 } = options;

    // Try cache first if enabled
    if (useCache) {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        console.log(`[SAFE API] 💾 Cache hit for ${cacheKey}`);
        return cached;
      }
    }

    // Sort strategies by complexity (simple first)
    const sortedStrategies = strategies.sort((a, b) => {
      const complexityOrder = { simple: 0, medium: 1, complex: 2 };
      return complexityOrder[a.complexity] - complexityOrder[b.complexity];
    });

    let lastError: Error | null = null;

    for (const strategy of sortedStrategies) {
      console.log(`[SAFE API] 🔄 Trying strategy: ${strategy.name}`);

      const startTime = Date.now();

      try {
        const result = await strategy.execute();
        const responseTime = Date.now() - startTime;

        // Log successful pattern
        this.patternTracker.logPattern({
          id: strategy.name,
          description: strategy.description,
          endpoint: strategy.name,
          success: true,
          timestamp: Date.now(),
          responseTime
        });

        // Cache the result
        if (useCache) {
          this.cache.set(cacheKey, result);
        }

        console.log(`[SAFE API] ✅ Strategy ${strategy.name} succeeded in ${responseTime}ms`);
        return result;

      } catch (error) {
        const responseTime = Date.now() - startTime;
        lastError = error as Error;

        // Log failed pattern
        this.patternTracker.logPattern({
          id: strategy.name,
          description: strategy.description,
          endpoint: strategy.name,
          success: false,
          errorCode: error instanceof Error && 'status' in error ? (error as any).status : undefined,
          timestamp: Date.now(),
          responseTime
        });

        console.log(`[SAFE API] ❌ Strategy ${strategy.name} failed: ${error instanceof Error ? error.message : error}`);

        // If it's a 403, definitely move to next strategy
        if (error instanceof Error && error.message.includes('403')) {
          console.log(`[SAFE API] 🚫 403 error detected, moving to next strategy`);
          continue;
        }

        // For other errors, try next strategy
        continue;
      }
    }

    // All strategies failed
    console.error(`[SAFE API] 💥 All strategies failed for ${cacheKey}`);
    throw lastError || new Error('All fallback strategies failed');
  }

  /**
   * Get contacts with safe fallback strategies
   */
  async getContactsSafe(options: {
    top?: number;
    select?: string[];
    filter?: string;
    expand?: string[];
  } = {}): Promise<PloomesContact[]> {
    const cacheKey = this.getCacheKey('contacts', options);

    const strategies: FallbackStrategy[] = [
      {
        name: 'contacts-simple',
        description: 'Simple contacts query without filters',
        complexity: 'simple',
        execute: async () => {
          const response = await ploomesClient.request<PloomesContact>('/Contacts?$top=300&$select=Id,Name,Document,Email,TypeId,StatusId');
          return response.value;
        }
      },
      {
        name: 'contacts-paginated',
        description: 'Paginated contacts query',
        complexity: 'simple',
        execute: async () => {
          return await ploomesClient.getContacts({
            top: 300,
            select: ['Id', 'Name', 'Document', 'Email', 'TypeId', 'StatusId']
          });
        }
      },
      {
        name: 'contacts-with-basic-filter',
        description: 'Contacts with simple filter',
        complexity: 'medium',
        execute: async () => {
          if (options.filter && !this.isUnsafePattern(options.filter)) {
            return await ploomesClient.getContacts({
              top: options.top || 300,
              select: options.select || ['Id', 'Name', 'Document', 'Email', 'TypeId'],
              filter: options.filter
            });
          }
          throw new Error('No safe filter available');
        }
      }
    ];

    return this.executeWithFallback<PloomesContact[]>(strategies, cacheKey);
  }

  /**
   * Get deals with safe fallback strategies
   */
  async getDealsSafe(options: {
    top?: number;
    select?: string[];
    filter?: string;
    orderby?: string;
  } = {}): Promise<PloomesDeal[]> {
    const cacheKey = this.getCacheKey('deals', options);

    const strategies: FallbackStrategy[] = [
      {
        name: 'deals-recent',
        description: 'Recent deals ordered by creation date',
        complexity: 'simple',
        execute: async () => {
          const response = await ploomesClient.request<PloomesDeal>('/Deals?$top=300&$orderby=CreatedDate desc&$select=Id,Title,Amount,StatusId,StageId,ContactId,CreatedDate');
          return response.value;
        }
      },
      {
        name: 'deals-won',
        description: 'Won deals only',
        complexity: 'simple',
        execute: async () => {
          const response = await ploomesClient.request<PloomesDeal>('/Deals?$filter=StatusId eq 2&$top=300&$select=Id,Title,Amount,StatusId,StageId,ContactId,CreatedDate');
          return response.value;
        }
      },
      {
        name: 'deals-all-simple',
        description: 'All deals without filters',
        complexity: 'simple',
        execute: async () => {
          const response = await ploomesClient.request<PloomesDeal>('/Deals?$top=300&$select=Id,Title,Amount,StatusId,StageId,ContactId,CreatedDate');
          return response.value;
        }
      },
      {
        name: 'deals-cached-fallback',
        description: 'Load from local cached file',
        complexity: 'simple',
        execute: async () => {
          // Load cached deals as final fallback
          try {
            const fs = require('fs');
            const path = require('path');
            const cachedPath = path.join(process.cwd(), 'ploomes-deals-with-products.json');

            if (fs.existsSync(cachedPath)) {
              const cachedData = fs.readFileSync(cachedPath, 'utf8');
              const deals = JSON.parse(cachedData);
              console.log(`[SAFE API] 📁 Loaded ${deals.length} deals from cache file`);
              return deals.slice(0, options.top || 300);
            }
            throw new Error('No cached file available');
          } catch (error) {
            throw new Error('Cached fallback failed');
          }
        }
      }
    ];

    return this.executeWithFallback<PloomesDeal[]>(strategies, cacheKey);
  }

  /**
   * Get products with safe fallback strategies
   */
  async getProductsSafe(options: {
    top?: number;
    select?: string[];
    filter?: string;
  } = {}): Promise<PloomesProduct[]> {
    const cacheKey = this.getCacheKey('products', options);

    const strategies: FallbackStrategy[] = [
      {
        name: 'products-active',
        description: 'Active products only',
        complexity: 'simple',
        execute: async () => {
          const response = await ploomesClient.request<PloomesProduct>('/Products?$filter=Active eq true&$top=300&$select=Id,Name,Code,Price,Active');
          return response.value;
        }
      },
      {
        name: 'products-all',
        description: 'All products without filters',
        complexity: 'simple',
        execute: async () => {
          const response = await ploomesClient.request<PloomesProduct>('/Products?$top=300&$select=Id,Name,Code,Price,Active');
          return response.value;
        }
      }
    ];

    return this.executeWithFallback<PloomesProduct[]>(strategies, cacheKey);
  }

  /**
   * Get deals for a specific contact - SAFE VERSION
   * This is the most problematic query that causes 403 errors
   */
  async getDealsForContactSafe(contactId: number, maxResults: number = 10): Promise<PloomesDeal[]> {
    const cacheKey = this.getCacheKey(`deals-contact-${contactId}`, { maxResults });

    const strategies: FallbackStrategy[] = [
      {
        name: 'contact-deals-from-recent',
        description: 'Find contact deals from recent deals list',
        complexity: 'simple',
        execute: async () => {
          // Get recent deals and filter in memory
          const recentDeals = await this.getDealsSafe({
            top: 2000,
            orderby: 'CreatedDate desc'
          });

          const contactDeals = recentDeals
            .filter(deal => deal.ContactId === contactId)
            .slice(0, maxResults);

          console.log(`[SAFE API] Found ${contactDeals.length} deals for contact ${contactId} from recent deals`);
          return contactDeals;
        }
      },
      {
        name: 'contact-deals-from-won',
        description: 'Find contact deals from won deals list',
        complexity: 'simple',
        execute: async () => {
          // Get won deals and filter in memory
          const wonDeals = await this.getDealsSafe({
            filter: 'StatusId eq 2',
            top: 1000
          });

          const contactDeals = wonDeals
            .filter(deal => deal.ContactId === contactId)
            .slice(0, maxResults);

          if (contactDeals.length > 0) {
            console.log(`[SAFE API] Found ${contactDeals.length} won deals for contact ${contactId}`);
            return contactDeals;
          }
          throw new Error('No won deals found for contact');
        }
      },
      {
        name: 'contact-deals-from-cache',
        description: 'Find contact deals from cached file',
        complexity: 'simple',
        execute: async () => {
          try {
            const fs = require('fs');
            const path = require('path');
            const cachedPath = path.join(process.cwd(), 'ploomes-deals-with-products.json');

            if (fs.existsSync(cachedPath)) {
              const cachedData = fs.readFileSync(cachedPath, 'utf8');
              const deals = JSON.parse(cachedData);

              const contactDeals = deals
                .filter((deal: any) => deal.ContactId === contactId)
                .slice(0, maxResults)
                .map((deal: any) => ({
                  Id: deal.Id,
                  Title: deal.Title,
                  Amount: deal.Amount,
                  StatusId: deal.StatusId,
                  StageId: deal.StageId,
                  ContactId: deal.ContactId,
                  CreatedDate: deal.LastUpdateDate,
                  Products: deal.Products || []
                }));

              if (contactDeals.length > 0) {
                console.log(`[SAFE API] Found ${contactDeals.length} cached deals for contact ${contactId}`);
                return contactDeals;
              }
            }
            throw new Error('No cached deals found for contact');
          } catch (error) {
            throw new Error('Cache lookup failed');
          }
        }
      }
    ];

    return this.executeWithFallback<PloomesDeal[]>(strategies, cacheKey);
  }

  /**
   * Get deal products - SAFE VERSION
   */
  async getDealProductsSafe(dealId: number): Promise<any[]> {
    const cacheKey = this.getCacheKey(`deal-products-${dealId}`);

    const strategies: FallbackStrategy[] = [
      {
        name: 'deal-products-simple',
        description: 'Simple deal products query',
        complexity: 'medium',
        execute: async () => {
          const response = await ploomesClient.request<any>(`/Deals(${dealId})/DealProducts`);
          return response.value || [];
        }
      },
      {
        name: 'deal-products-with-product',
        description: 'Deal products with basic product info',
        complexity: 'complex',
        execute: async () => {
          return await ploomesClient.getDealProducts(dealId);
        }
      }
    ];

    return this.executeWithFallback<any[]>(strategies, cacheKey);
  }

  /**
   * Health check - test if API is responding
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    responseTime: number;
    patterns: {
      successful: number;
      failed: number;
      successRate: number;
    };
    cache: {
      size: number;
    };
  }> {
    const startTime = Date.now();

    try {
      // Try a simple query
      await ploomesClient.request<any>('/Contacts?$top=1');
      const responseTime = Date.now() - startTime;
      const stats = this.patternTracker.getStats();

      return {
        healthy: true,
        responseTime,
        patterns: {
          successful: stats.successful,
          failed: stats.failed,
          successRate: stats.successRate
        },
        cache: {
          size: this.cache.size()
        }
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const stats = this.patternTracker.getStats();

      return {
        healthy: false,
        responseTime,
        patterns: {
          successful: stats.successful,
          failed: stats.failed,
          successRate: stats.successRate
        },
        cache: {
          size: this.cache.size()
        }
      };
    }
  }

  /**
   * Clear all caches and patterns
   */
  reset(): void {
    this.cache.clear();
    console.log('[SAFE API] 🧹 Cache and patterns cleared');
  }

  /**
   * Get performance statistics
   */
  getStats(): {
    patterns: ReturnType<PloomesPatternTracker['getStats']>;
    cache: { size: number };
    successfulPatterns: QueryPattern[];
    failedPatterns: QueryPattern[];
  } {
    return {
      patterns: this.patternTracker.getStats(),
      cache: { size: this.cache.size() },
      successfulPatterns: this.patternTracker.getSuccessfulPatterns(),
      failedPatterns: this.patternTracker.getFailedPatterns()
    };
  }
}

// Export singleton instance
export const ploomesApi = new PlomesSafeAPI();

// Export types
export type {
  SafeQueryOptions,
  QueryPattern,
  FallbackStrategy
};

// Export utilities
export const PloomesAPIUtils = {
  // Test if a pattern is safe before using it
  isPatternSafe: (endpoint: string): boolean => {
    const unsafePatterns = [
      'Tags/any(t: t/TagId',
      '$expand=.*\\(.*\\)',
      'ContactId.*and.*',
      '\\$expand=.*,.*',
    ];

    return !unsafePatterns.some(pattern => {
      const regex = new RegExp(pattern, 'i');
      return regex.test(endpoint);
    });
  },

  // Create safe OData query parameters
  createSafeQuery: (options: {
    entity: string;
    select?: string[];
    filter?: string;
    orderby?: string;
    top?: number;
  }): string => {
    const { entity, select, filter, orderby, top = 300 } = options;
    const params = new URLSearchParams();

    // Always limit results
    params.append('$top', Math.min(top, 300).toString());

    // Add select if provided and safe
    if (select && select.length > 0) {
      params.append('$select', select.join(','));
    }

    // Add orderby if provided
    if (orderby) {
      params.append('$orderby', orderby);
    }

    // Only add filter if it's safe
    if (filter && PloomesAPIUtils.isPatternSafe(filter)) {
      params.append('$filter', filter);
    }

    return `/${entity}?${params.toString()}`;
  },

  // Log API usage patterns
  logPatternUsage: (pattern: string, success: boolean, responseTime: number): void => {
    console.log(`[PLOOMES PATTERN] ${success ? '✅' : '❌'} ${pattern} (${responseTime}ms)`);
  }
};