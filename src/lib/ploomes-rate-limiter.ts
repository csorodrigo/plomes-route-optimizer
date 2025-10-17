/**
 * Ploomes API Rate Limiter
 * Based on official API documentation: 120 requests per minute
 * With automatic retry and exponential backoff
 */

interface RequestLog {
  timestamp: number;
  endpoint: string;
}

class PloomesRateLimiter {
  private requests: RequestLog[] = [];
  private readonly LIMIT = 120; // 120 requests per minute
  private readonly WINDOW = 60000; // 1 minute in ms
  private readonly MIN_DELAY = 500; // Minimum 500ms between requests
  private readonly MAX_RETRIES = 3;
  private readonly BATCH_SIZE = 100; // Recommended batch size from docs
  private readonly MAX_ITEMS = 300; // Maximum items per request from docs

  // Enhanced protection against API blocks
  private readonly CONSERVATIVE_LIMIT = 80; // Use only 66% of rate limit for safety
  private readonly BLOCK_DETECTION_WINDOW = 300000; // 5 minutes
  private consecutiveErrors = 0;
  private lastBlockTime = 0;
  private isInBackoffMode = false;

  /**
   * Wait if rate limit would be exceeded (enhanced with block detection)
   */
  private async waitIfNeeded(): Promise<void> {
    const now = Date.now();

    // Check if we're in backoff mode due to recent blocks
    if (this.isInBackoffMode) {
      const timeSinceBlock = now - this.lastBlockTime;
      if (timeSinceBlock < this.BLOCK_DETECTION_WINDOW) {
        const extraDelay = Math.max(0, this.BLOCK_DETECTION_WINDOW - timeSinceBlock);
        console.log(`[RATE LIMITER] 🛡️ Still in backoff mode. Waiting additional ${extraDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, extraDelay));
      } else {
        console.log(`[RATE LIMITER] ✅ Exiting backoff mode`);
        this.isInBackoffMode = false;
        this.consecutiveErrors = 0;
      }
    }

    // Clean up old requests outside the window
    this.requests = this.requests.filter(req => now - req.timestamp < this.WINDOW);

    // Use conservative limit if we've had recent errors
    const effectiveLimit = this.consecutiveErrors > 2 ? Math.floor(this.CONSERVATIVE_LIMIT * 0.5) : this.CONSERVATIVE_LIMIT;

    // If at limit, wait for oldest request to expire
    if (this.requests.length >= effectiveLimit) {
      const oldestRequest = this.requests[0];
      const waitTime = this.WINDOW - (now - oldestRequest.timestamp) + 100; // +100ms margin

      console.log(`[RATE LIMITER] ⏳ Conservative limit reached (${this.requests.length}/${effectiveLimit}). Waiting ${waitTime}ms...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));

      // Clean again after waiting
      this.requests = this.requests.filter(req => Date.now() - req.timestamp < this.WINDOW);
    }

    // Ensure minimum delay between requests (increased if in error state)
    const minDelay = this.consecutiveErrors > 0 ? this.MIN_DELAY * 2 : this.MIN_DELAY;
    if (this.requests.length > 0) {
      const lastRequest = this.requests[this.requests.length - 1];
      const timeSinceLastRequest = now - lastRequest.timestamp;

      if (timeSinceLastRequest < minDelay) {
        const delayNeeded = minDelay - timeSinceLastRequest;
        await new Promise(resolve => setTimeout(resolve, delayNeeded));
      }
    }
  }

  /**
   * Detect potential API blocks and enter protective mode
   */
  private handlePotentialBlock(error: Error): void {
    const now = Date.now();

    // Detect 403 errors or other block indicators
    if (error.message.includes('403') || error.message.includes('Forbidden') || error.message.includes('rate limit')) {
      this.consecutiveErrors++;
      this.lastBlockTime = now;

      if (this.consecutiveErrors >= 3) {
        this.isInBackoffMode = true;
        console.log(`[RATE LIMITER] 🚨 API block detected! Entering backoff mode for ${this.BLOCK_DETECTION_WINDOW}ms`);
      } else {
        console.log(`[RATE LIMITER] ⚠️ Potential block detected (${this.consecutiveErrors}/3). Increasing caution.`);
      }
    }
  }

  /**
   * Reset error tracking on successful requests
   */
  private handleSuccessfulRequest(): void {
    if (this.consecutiveErrors > 0) {
      console.log(`[RATE LIMITER] ✅ Successful request - resetting error count`);
      this.consecutiveErrors = 0;
    }
  }

  /**
   * Execute API call with rate limiting and retry logic
   */
  async execute<T>(
    endpoint: string,
    fetcher: () => Promise<Response>,
    options: {
      retries?: number;
      backoff?: boolean;
    } = {}
  ): Promise<T> {
    const maxRetries = options.retries ?? this.MAX_RETRIES;
    const useBackoff = options.backoff ?? true;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Wait if necessary for rate limiting
        await this.waitIfNeeded();

        // Log the request
        this.requests.push({
          timestamp: Date.now(),
          endpoint
        });

        // Execute the request
        const response = await fetcher();

        // Handle rate limit response
        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After');
          const delay = retryAfter
            ? parseInt(retryAfter) * 1000
            : Math.min(1000 * Math.pow(2, attempt), 60000);

          console.log(`[RATE LIMITER] 429 received. Retry after ${delay}ms`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        // Handle server errors with retry
        if (response.status >= 500 && response.status < 600) {
          if (attempt < maxRetries - 1) {
            const delay = useBackoff
              ? Math.min(1000 * Math.pow(2, attempt), 30000)
              : 1000;

            console.log(`[RATE LIMITER] Server error ${response.status}. Retrying after ${delay}ms`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
        }

        // Check for successful response
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`API Error ${response.status}: ${errorText}`);
        }

        // Parse and return the data
        const data = await response.json();

        // Mark successful request
        this.handleSuccessfulRequest();

        return data;

      } catch (error) {
        // Handle potential API blocks
        this.handlePotentialBlock(error as Error);

        // On last attempt, throw the error
        if (attempt === maxRetries - 1) {
          console.error(`[RATE LIMITER] Failed after ${maxRetries} attempts:`, error);
          throw error;
        }

        // Wait before retry with exponential backoff
        if (useBackoff) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 30000);
          console.log(`[RATE LIMITER] Error on attempt ${attempt + 1}. Retrying after ${delay}ms`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw new Error('Failed to execute request after all retries');
  }

  /**
   * Execute multiple requests in parallel with rate limiting
   */
  async executeBatch<T>(
    requests: Array<{
      endpoint: string;
      fetcher: () => Promise<Response>;
    }>,
    maxConcurrent: number = 5
  ): Promise<T[]> {
    const results: T[] = [];

    // Process in batches to avoid overwhelming the API
    for (let i = 0; i < requests.length; i += maxConcurrent) {
      const batch = requests.slice(i, i + maxConcurrent);

      const batchResults = await Promise.all(
        batch.map(req =>
          this.execute<T>(req.endpoint, req.fetcher)
        )
      );

      results.push(...batchResults);

      // Add a small delay between batches
      if (i + maxConcurrent < requests.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return results;
  }

  /**
   * Get current rate limit status
   */
  getStatus(): {
    current: number;
    limit: number;
    remaining: number;
    resetIn: number;
  } {
    const now = Date.now();
    this.requests = this.requests.filter(req => now - req.timestamp < this.WINDOW);

    const oldestRequest = this.requests[0];
    const resetIn = oldestRequest
      ? Math.max(0, this.WINDOW - (now - oldestRequest.timestamp))
      : 0;

    return {
      current: this.requests.length,
      limit: this.LIMIT,
      remaining: Math.max(0, this.LIMIT - this.requests.length),
      resetIn
    };
  }

  /**
   * Clear all tracked requests (useful for testing)
   */
  reset(): void {
    this.requests = [];
    console.log('[RATE LIMITER] Reset request tracking');
  }
}

// Export singleton instance
export const rateLimiter = new PloomesRateLimiter();

// Helper function for pagination with rate limiting
export async function paginatedFetch<T>(
  baseEndpoint: string,
  fetcher: (endpoint: string) => Promise<Response>,
  options: {
    pageSize?: number;
    maxPages?: number;
  } = {}
): Promise<T[]> {
  const pageSize = Math.min(options.pageSize ?? 100, 300); // Max 300 per request
  const maxPages = options.maxPages ?? 100;

  let allData: T[] = [];
  let skip = 0;
  let hasMore = true;
  let pageCount = 0;

  while (hasMore && pageCount < maxPages) {
    const endpoint = `${baseEndpoint}${baseEndpoint.includes('?') ? '&' : '?'}$top=${pageSize}&$skip=${skip}`;

    const response = await rateLimiter.execute<{ value: T[] }>(
      endpoint,
      () => fetcher(endpoint)
    );

    if (response.value && response.value.length > 0) {
      allData = [...allData, ...response.value];
      skip += pageSize;
      hasMore = response.value.length === pageSize;
      pageCount++;
    } else {
      hasMore = false;
    }

    // Log progress
    if (pageCount % 5 === 0) {
      console.log(`[PAGINATED FETCH] Fetched ${allData.length} items in ${pageCount} pages`);
    }
  }

  console.log(`[PAGINATED FETCH] Complete: ${allData.length} total items in ${pageCount} pages`);
  return allData;
}

// Export utilities for dashboard
export const PloomesAPIUtils = {
  rateLimiter,
  paginatedFetch,

  // Constants from documentation
  LIMITS: {
    RATE_LIMIT: 120, // requests per minute
    MAX_ITEMS_PER_REQUEST: 300,
    RECOMMENDED_BATCH_SIZE: 100,
    MAX_PAYLOAD_MB: 10
  },

  // Helper to check if we're approaching rate limit
  isNearRateLimit(): boolean {
    const status = rateLimiter.getStatus();
    return status.remaining < 20; // Consider "near" if less than 20 requests remaining
  },

  // Helper to wait for rate limit reset if needed
  async waitForRateLimit(): Promise<void> {
    const status = rateLimiter.getStatus();
    if (status.remaining === 0) {
      console.log(`[RATE LIMITER] Waiting ${status.resetIn}ms for rate limit reset`);
      await new Promise(resolve => setTimeout(resolve, status.resetIn + 100));
    }
  }
};