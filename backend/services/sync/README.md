# Ploomes Product Sync Integration System

Complete integration system for synchronizing all Ploomes product types with Supabase database.

## Overview

This system handles **11,793+ products** across multiple categories:
- **127 services** (CIA_ prefixed)
- **95 rental/location items** (CIA_LOC_ prefixed)
- **1,307 Atlas products**
- **1,952 Ingersoll products**
- **10,982 products** created via Omie integration

## Key Features

### 🎯 Intelligent Sync Strategy Selection
- **Real-time sync** for urgent updates (<10 products)
- **Incremental sync** for regular maintenance (changed products only)
- **Batch sync** for full refresh (all products)
- Automatic strategy selection based on context

### 🗄️ Multi-Layer Caching
- Memory cache for frequently accessed products
- Database cache for API responses
- Smart invalidation on updates
- Cache warming for optimal performance

### 🛡️ Comprehensive Error Handling
- Exponential backoff retry logic
- Circuit breaker pattern for service protection
- Detailed error classification and logging
- Graceful degradation under load

### 📊 Performance Monitoring
- Real-time performance metrics
- System health monitoring
- Resource usage tracking
- Automatic optimization

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   API Routes    │ -> │ Sync Orchestrator│ -> │  Product Sync   │
│                 │    │                  │    │    Service      │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         v                       v                       v
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Cache Service  │    │  Error Handler   │    │ Ploomes Service │
│                 │    │                  │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         v                       v                       v
┌─────────────────────────────────────────────────────────────────┐
│                    Supabase Database                             │
│  products_enhanced | service_specs | rental_specs | variants    │
└─────────────────────────────────────────────────────────────────┘
```

## Quick Start

### 1. Database Setup

Apply the enhanced schema:

```sql
-- Run schema-design.sql to create enhanced tables
\i backend/services/sync/schema-design.sql
```

### 2. Environment Configuration

```env
# Required
PLOOME_API_KEY=your_ploomes_api_key
PLOOME_API_URL=https://public-api2.ploomes.com

# Optional Performance Tuning
PRODUCT_SYNC_BATCH_SIZE=100
PRODUCT_SYNC_CONCURRENT=3
ENABLE_REAL_TIME_PRODUCT_SYNC=true
INCREMENTAL_SYNC_HOURS=6
AUTO_WARM_CACHE=true
```

### 3. Basic Usage

```javascript
const { syncProducts, getProduct, searchProducts } = require('./backend/services/sync');

// Intelligent sync (auto-selects strategy)
const result = await syncProducts({
    urgency: 'normal',
    businessContext: { affects_pricing: true }
});

// Get cached product
const product = await getProduct(123);

// Search with caching
const results = await searchProducts({
    q: 'atlas',
    category: 'Atlas Products',
    limit: 50
});
```

## API Endpoints

### Sync Operations

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/sync/products` | POST | Main sync endpoint with intelligent strategy selection |
| `/api/sync/products/full` | POST | Force full synchronization |
| `/api/sync/products/incremental` | POST | Incremental sync only |
| `/api/sync/products/real-time` | POST | Real-time sync for specific products |

### Category-Specific Sync

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/sync/products/services` | POST | Sync CIA services only |
| `/api/sync/products/rentals` | POST | Sync CIA rental items only |
| `/api/sync/products/atlas` | POST | Sync Atlas products only |
| `/api/sync/products/ingersoll` | POST | Sync Ingersoll products only |
| `/api/sync/products/omie` | POST | Sync Omie-created products only |

### Monitoring

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/sync/products/status` | GET | Current sync status and metrics |
| `/api/sync/products/logs` | GET | Detailed sync logs with filtering |
| `/api/sync/products/health` | GET | Health check for monitoring systems |

### Product Queries

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/sync/products/search` | GET | Search products with filters |
| `/api/sync/products/categories` | GET | Get all categories with counts |

## Sync Strategies

### Real-Time Sync
- **Use case**: Urgent updates, pricing changes, stock alerts
- **Trigger**: ≤10 products, critical urgency
- **Performance**: ~2 seconds per product
- **Resource impact**: Low

### Incremental Sync
- **Use case**: Regular maintenance, daily sync
- **Trigger**: Changes since last sync (≤6 hours)
- **Performance**: ~30% of full sync time
- **Resource impact**: Medium

### Batch Sync
- **Use case**: Full refresh, initial load, recovery
- **Trigger**: >50 products, >6 hours since last sync
- **Performance**: Optimized for high throughput
- **Resource impact**: High

## Database Schema

### Enhanced Products Table

```sql
CREATE TABLE products_enhanced (
    id BIGSERIAL PRIMARY KEY,
    ploomes_product_id TEXT UNIQUE NOT NULL,
    external_id TEXT, -- For Omie integration
    name TEXT NOT NULL,
    code TEXT,
    description TEXT,

    -- Classification
    product_type VARCHAR(20) NOT NULL DEFAULT 'product',
    category TEXT,
    subcategory TEXT,
    brand TEXT,

    -- Pricing
    base_price NUMERIC(15,2) DEFAULT 0.00,
    cost_price NUMERIC(15,2),
    currency VARCHAR(3) DEFAULT 'BRL',

    -- Physical attributes
    weight NUMERIC(10,3),
    dimensions JSONB,

    -- Business attributes
    ncm_code VARCHAR(10),
    cfop_code VARCHAR(4),

    -- Inventory
    stock_quantity INTEGER DEFAULT 0,
    unit_of_measure VARCHAR(10) DEFAULT 'UN',

    -- Status
    active BOOLEAN DEFAULT true,
    available_for_sale BOOLEAN DEFAULT true,

    -- Source tracking
    source_system VARCHAR(20) DEFAULT 'ploomes',
    source_created_at TIMESTAMPTZ,
    source_updated_at TIMESTAMPTZ,

    -- Metadata
    tags JSONB DEFAULT '[]'::jsonb,
    custom_fields JSONB DEFAULT '{}'::jsonb,

    -- Audit
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
    last_sync_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
    sync_version INTEGER DEFAULT 1
);
```

### Specialized Tables

- **service_specifications**: Service-specific attributes (duration, billing cycle, SLA)
- **rental_specifications**: Rental terms, rates, and logistics
- **product_variants**: Size, color, model variations
- **product_suppliers**: Supplier information and commercial terms
- **product_sync_logs**: Detailed sync operation tracking

## Caching Strategy

### Memory Cache (NodeCache)
- **TTL**: 5 minutes for products, 10 minutes for categories
- **Capacity**: 10,000 keys maximum
- **Hit rate target**: >70%

### Database Cache (api_cache table)
- **TTL**: 10 minutes for API responses
- **Use case**: Long-term storage of expensive API calls
- **Cleanup**: Automatic expiration handling

### Cache Keys Structure
```
prod:{id}           # Individual product
search:{hash}       # Search results
cat:hierarchy       # Category hierarchy
count:all          # Product counts
api:{endpoint_hash} # API responses
```

## Error Handling

### Error Classification
- **Network**: Connection issues, timeouts
- **Rate Limit**: API quota exceeded
- **Database**: Connection or query failures
- **Validation**: Data format errors
- **Authentication**: API key issues

### Retry Logic
- **Exponential backoff**: 1s, 2s, 4s, 8s delays
- **Jitter**: Random delay to prevent thundering herd
- **Circuit breaker**: Fail fast when service is down
- **Max retries**: 3 attempts for retryable errors

## Performance Optimization

### Batch Processing
- **Default batch size**: 100 products
- **Parallel workers**: 3 concurrent requests
- **Rate limiting**: 1 request per 500ms to Ploomes API

### Database Optimization
- **Indexes**: Comprehensive indexing on search fields
- **JSONB**: Efficient storage for metadata and custom fields
- **Views**: Pre-computed joins for complex queries

### Monitoring Metrics
- Records per second processing rate
- Cache hit/miss ratios
- Error rates by category
- System resource usage

## Deployment

### Production Setup

1. **Apply database schema**:
```bash
psql -f backend/services/sync/schema-design.sql
```

2. **Configure environment variables**:
```env
NODE_ENV=production
PLOOME_API_KEY=prod_api_key
PRODUCT_SYNC_BATCH_SIZE=200
PRODUCT_SYNC_CONCURRENT=5
```

3. **Set up monitoring**:
```bash
# Health check endpoint
curl https://your-app.com/api/sync/products/health

# Status monitoring
curl https://your-app.com/api/sync/products/status
```

### Scheduled Sync

Set up cron job for regular synchronization:

```javascript
// In your cron handler
const { scheduledSync } = require('./backend/services/sync');

// Every 6 hours
await scheduledSync();
```

## Troubleshooting

### Common Issues

1. **High error rate**:
   - Check Ploomes API key validity
   - Verify network connectivity
   - Review rate limiting settings

2. **Slow performance**:
   - Monitor batch size configuration
   - Check database query performance
   - Review concurrent workers setting

3. **Cache misses**:
   - Verify memory limits
   - Check TTL configuration
   - Monitor cache invalidation patterns

### Debug Mode

Enable detailed logging:

```env
NODE_ENV=development
DEBUG=product-sync:*
```

### Monitoring Commands

```javascript
// Get system status
const status = await getSystemStatus();

// Check cache performance
const cacheStats = await getCacheStats();

// View error statistics
const errorStats = errorHandler.getErrorStats();
```

## Integration Examples

### Express.js Route Integration

```javascript
const express = require('express');
const { routes } = require('./backend/services/sync');

const app = express();
app.use('/api/sync', routes);
```

### Webhook Integration

```javascript
// Handle Ploomes webhook
app.post('/webhook/ploomes', async (req, res) => {
    const { EntityType, EntityId, ChangeType } = req.body;

    if (EntityType === 'Product') {
        await syncProductsRealTime([EntityId]);
    }

    res.json({ success: true });
});
```

### Background Job Integration

```javascript
// Bull queue job
queue.process('sync-products', async (job) => {
    const { category, urgency } = job.data;

    return await syncProducts({
        categories: [category],
        urgency,
        businessContext: { priority: 'high' }
    });
});
```

## Testing

### Unit Tests
```bash
npm test backend/services/sync/
```

### Integration Tests
```bash
npm run test:integration
```

### Load Testing
```bash
npm run test:load
```

## Contributing

1. Follow existing code patterns
2. Add comprehensive error handling
3. Include performance monitoring
4. Update documentation
5. Add unit tests for new features

## License

Internal use only - Ciara Máquinas project.