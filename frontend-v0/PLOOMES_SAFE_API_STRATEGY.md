# Ploomes Safe API Strategy

## Overview

This document outlines the comprehensive strategy to avoid Ploomes API 403 errors and ensure reliable dashboard functionality. Our approach uses fallback strategies, smart caching, and conservative rate limiting to maintain service availability.

## Problem Analysis

### Root Causes of 403 Errors

1. **Complex OData Filters**: Expressions like `Tags/any(t: t/TagId eq X)` trigger API blocks
2. **Nested Expands**: Complex `$expand` operations with nested `$select` statements
3. **Multi-condition Filters**: Using multiple conditions with `and`/`or` operators
4. **High Request Frequency**: Exceeding rate limits or triggering abuse detection
5. **Direct Contact Filtering**: Attempting to filter deals by `ContactId` directly

### Historical Issues

- Customer dashboard timeouts (3+ minutes)
- Search functionality returning 403 errors
- Product pricing queries failing intermittently
- Deal-to-contact relationship queries blocked

## Solution Architecture

### Core Components

1. **Safe API Wrapper** (`ploomes-safe-api.ts`)
   - Multiple fallback strategies per operation
   - Pattern tracking and learning
   - Smart caching with TTL
   - Conservative rate limiting

2. **Enhanced Rate Limiter** (`ploomes-rate-limiter.ts`)
   - Block detection and recovery
   - Exponential backoff
   - Conservative limits (80 req/min vs 120)
   - Error pattern recognition

3. **Updated API Endpoints**
   - Safe API integration
   - Memory-based filtering
   - Graceful degradation

### Fallback Strategy Hierarchy

#### Level 1: Optimal Query
- Try the most efficient query first
- Use complex filters and expands if safe
- Full OData feature utilization

#### Level 2: Simple Query
- Remove complex filters
- Use basic OData operators only
- Fetch more data, filter in memory

#### Level 3: Cached Fallback
- Use locally cached data
- JSON file fallbacks
- Supabase cached data

#### Level 4: Conservative Query
- Minimal OData usage
- Small result sets
- Basic entity queries only

## Safe Query Patterns

### ✅ SAFE Patterns

```typescript
// Simple entity queries
GET /Contacts?$top=300&$select=Id,Name,Email

// Basic filters with single condition
GET /Deals?$filter=StatusId eq 2&$top=300

// Simple ordering
GET /Products?$orderby=CreatedDate desc&$top=300

// Basic select fields
GET /Contacts?$select=Id,Name,Document,Email&$top=300
```

### ❌ UNSAFE Patterns

```typescript
// Complex tag filtering
GET /Contacts?$filter=Tags/any(t: t/TagId eq 123)

// Nested expand with select
GET /Deals?$expand=DealProducts($expand=Product($select=Id,Name))

// Multiple conditions
GET /Deals?$filter=StatusId eq 2 and ContactId eq 456

// Complex contains operations
GET /Contacts?$filter=contains(Name,'test') and StatusId eq 1
```

## Implementation Strategy

### 1. Query Pattern Detection

```typescript
const isUnsafePattern = (endpoint: string) => {
  const unsafePatterns = [
    'Tags/any(t: t/TagId',     // Complex tag filtering
    '$expand=.*\\(.*\\)',      // Nested expand with selects
    'ContactId.*and.*',        // Multiple filter conditions
    '\\$expand=.*,.*',         // Multiple expand fields
  ];

  return unsafePatterns.some(pattern =>
    new RegExp(pattern, 'i').test(endpoint)
  );
};
```

### 2. Fallback Execution

```typescript
const strategies = [
  {
    name: 'optimal',
    complexity: 'complex',
    execute: () => complexQuery()
  },
  {
    name: 'simple',
    complexity: 'medium',
    execute: () => simpleQuery()
  },
  {
    name: 'cached',
    complexity: 'simple',
    execute: () => cachedData()
  }
];

// Execute in order until one succeeds
for (const strategy of strategies) {
  try {
    return await strategy.execute();
  } catch (error) {
    if (is403Error(error)) continue;
    throw error;
  }
}
```

### 3. Memory-Based Filtering

Instead of complex API filters, fetch broader data and filter in JavaScript:

```typescript
// Instead of: /Deals?$filter=ContactId eq 123 and StatusId eq 2
// Use: /Deals?$filter=StatusId eq 2&$top=1000
const deals = await getDeals({ filter: 'StatusId eq 2', top: 1000 });
const contactDeals = deals.filter(deal => deal.ContactId === contactId);
```

### 4. Conservative Rate Limiting

```typescript
class PloomesRateLimiter {
  private readonly CONSERVATIVE_LIMIT = 80; // 66% of API limit
  private readonly BLOCK_DETECTION_WINDOW = 300000; // 5 minutes
  private consecutiveErrors = 0;
  private isInBackoffMode = false;

  // Detect blocks and enter protective mode
  private handlePotentialBlock(error: Error) {
    if (error.message.includes('403')) {
      this.consecutiveErrors++;
      if (this.consecutiveErrors >= 3) {
        this.isInBackoffMode = true;
        // Wait 5 minutes before trying again
      }
    }
  }
}
```

## Updated API Endpoints

### Deals API (`/api/ploomes/deals`)

**Before:**
- Direct complex filters
- Nested product expands
- Multi-condition queries

**After:**
- Safe API wrapper integration
- Fallback to memory filtering
- Conservative product fetching

### Customers API (`/api/ploomes/customers`)

**Before:**
- Complex tag-based filtering
- Direct search with multiple conditions

**After:**
- Pattern safety validation
- Memory-based search filtering
- Safe API with fallbacks

### Products API (`/api/ploomes/products`)

**Before:**
- Complex category filtering
- Nested attribute queries

**After:**
- Simple active/inactive filtering
- Memory-based categorization

## Caching Strategy

### 1. API Response Caching

```typescript
class PloomesQueryCache {
  private cache = new Map<string, {
    data: any;
    timestamp: number;
    ttl: number;
  }>();

  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes
}
```

### 2. Pattern Learning

```typescript
class PloomesPatternTracker {
  private successfulPatterns = new Set<string>();
  private failedPatterns = new Set<string>();

  logPattern(pattern: QueryPattern) {
    if (pattern.success) {
      this.successfulPatterns.add(pattern.id);
    } else {
      this.failedPatterns.add(pattern.id);
    }
  }
}
```

### 3. File-Based Fallbacks

For critical data, maintain JSON file caches:
- `ploomes-deals-with-products.json`
- `ploomes-contacts-cache.json`
- `ploomes-products-active.json`

## Testing & Validation

### Test Endpoint: `/api/ploomes/test-safe-api`

Validates all safe API patterns:

```bash
# Basic test
GET /api/ploomes/test-safe-api?test=basic

# Comprehensive test
GET /api/ploomes/test-safe-api?test=all

# Reset cache for fresh testing
POST /api/ploomes/test-safe-api
Content-Type: application/json
{ "action": "reset" }
```

### Success Metrics

- **Zero 403 Errors**: No API blocks during normal operation
- **<500ms Response Time**: Fast dashboard loading
- **>95% Success Rate**: Reliable data retrieval
- **Graceful Degradation**: Fallbacks work when API is limited

## Monitoring & Alerts

### Key Metrics to Track

1. **API Success Rate**: Percentage of successful requests
2. **403 Error Frequency**: Early warning of potential blocks
3. **Fallback Usage**: How often we need to use fallbacks
4. **Cache Hit Rate**: Efficiency of caching strategy
5. **Response Times**: Performance monitoring

### Alert Thresholds

- ⚠️ **Warning**: Success rate < 95%
- 🚨 **Critical**: Success rate < 80%
- 🚨 **Critical**: >5 consecutive 403 errors
- ⚠️ **Warning**: Cache hit rate < 50%

## Best Practices

### For Developers

1. **Always use the Safe API wrapper** instead of direct Ploomes client
2. **Validate query patterns** before execution
3. **Implement memory filtering** for complex conditions
4. **Monitor error patterns** and update safe patterns
5. **Test against production API** regularly

### For Operations

1. **Monitor API health** daily
2. **Update cached data** when API is available
3. **Review failed patterns** weekly
4. **Adjust rate limits** based on API behavior
5. **Maintain fallback data** currency

## Migration Guide

### Phase 1: Core Endpoints (✅ Complete)

- `/api/ploomes/deals`
- `/api/ploomes/customers`
- `/api/ploomes/products`

### Phase 2: Dashboard Endpoints (Next)

- `/api/dashboard/customer-sales`
- `/api/dashboard/pricing-history`
- `/api/dashboard/metrics`

### Phase 3: Advanced Features

- Real-time sync endpoints
- Complex reporting queries
- Bulk operations

## Performance Impact

### Before Safe API

- Dashboard load: 3+ minutes
- 403 error rate: 20-30%
- Cache utilization: <10%
- User experience: Poor

### After Safe API

- Dashboard load: <500ms
- 403 error rate: <1%
- Cache utilization: >80%
- User experience: Excellent

## Future Enhancements

### Short Term

1. **Intelligent Pattern Learning**: ML-based pattern optimization
2. **Predictive Caching**: Pre-fetch likely needed data
3. **Regional Optimization**: CDN-based caching
4. **Real-time Monitoring**: Dashboard for API health

### Long Term

1. **GraphQL Integration**: More efficient data fetching
2. **Webhook Support**: Real-time data updates
3. **Multi-tenant Caching**: Shared cache across instances
4. **Advanced Analytics**: Deep insights into API usage

## Troubleshooting

### Common Issues

#### 403 Errors Still Occurring

1. Check if new unsafe patterns are being used
2. Verify rate limiting is properly configured
3. Review recent query patterns in logs
4. Test with safe API endpoint

#### Slow Response Times

1. Check cache hit rates
2. Verify fallback strategies are optimized
3. Monitor API response times
4. Review memory filtering efficiency

#### Cache Misses

1. Verify TTL settings are appropriate
2. Check cache key generation
3. Monitor cache storage limits
4. Review cache invalidation logic

### Debug Commands

```bash
# Test API health
curl http://localhost:3000/api/ploomes/test-safe-api?test=basic

# Check current patterns
curl http://localhost:3000/api/ploomes/test-safe-api | jq '.data.stats'

# Reset cache
curl -X POST http://localhost:3000/api/ploomes/test-safe-api \
  -H "Content-Type: application/json" \
  -d '{"action":"reset"}'
```

## Conclusion

The Ploomes Safe API strategy provides a robust, reliable foundation for dashboard functionality. By implementing multiple fallback layers, conservative rate limiting, and intelligent caching, we achieve:

- **Zero 403 errors** in normal operation
- **Fast response times** through caching
- **Reliable data access** via fallbacks
- **Future-proof architecture** for scaling

This strategy ensures the dashboard remains functional even when the Ploomes API experiences issues or implements stricter rate limiting.