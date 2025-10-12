# Ploome Service Dashboard Extension

## Overview

Extended PloomeService class with new methods for fetching dashboard data including products, deals, and comprehensive metrics.

## New Methods

### 1. `fetchProducts(filters)`

Fetch active products from Ploomes API with pagination.

**Parameters:**
- `filters.skip` (number): Records to skip for pagination (default: 0)
- `filters.top` (number): Records to fetch per page (default: 100)

**Returns:** Promise<Object> with products data

**Rate Limiting:** Maintains 500ms delay between requests

**Example:**
```javascript
const products = await ploomeService.fetchProducts({ skip: 0, top: 50 });
console.log(`Fetched ${products.value.length} products`);
```

### 2. `fetchAllProducts(onProgress)`

Fetch all active products with automatic pagination and progress tracking.

**Parameters:**
- `onProgress` (function): Callback for progress updates

**Returns:** Promise<Array> of mapped product objects

**Example:**
```javascript
const allProducts = await ploomeService.fetchAllProducts((progress) => {
    console.log(`Fetched ${progress.fetched} products`);
});
```

### 3. `fetchDeals(filters)`

Fetch deals (sales opportunities) with filtering capabilities.

**Parameters:**
- `filters.skip` (number): Pagination offset
- `filters.top` (number): Records per page
- `filters.statusId` (number): Filter by deal status
- `filters.startDate` (string): Start date (ISO format)
- `filters.endDate` (string): End date (ISO format)

**Returns:** Promise<Object> with deals data including expanded Products and Contact

**Example:**
```javascript
const deals = await ploomeService.fetchDeals({
    statusId: 3,
    startDate: '2024-01-01',
    endDate: '2024-12-31'
});
```

### 4. `fetchProductsByDeal(dealId)`

Fetch products associated with a specific deal for pricing history tracking.

**Parameters:**
- `dealId` (number): The deal ID

**Returns:** Promise<Array> of deal products with pricing details

**Example:**
```javascript
const dealProducts = await ploomeService.fetchProductsByDeal(12345);
dealProducts.forEach(p => {
    console.log(`${p.productName}: ${p.quantity}x R$ ${p.unitPrice}`);
});
```

### 5. `getDashboardMetrics(options)`

Aggregate method that fetches comprehensive dashboard data.

**Parameters:**
- `options.startDate` (string): Date range start
- `options.endDate` (string): Date range end
- `options.dealStatusId` (number): Filter deals by status

**Returns:** Promise<Object> with structured dashboard metrics

**Structure:**
```javascript
{
    products: { count, data, error },
    deals: { count, data, error },
    contacts: { count, data, error },
    summary: {
        totalRevenue,
        averageDealValue,
        activeProducts,
        totalContacts
    },
    timestamp
}
```

**Example:**
```javascript
const metrics = await ploomeService.getDashboardMetrics({
    startDate: '2024-01-01',
    endDate: '2024-12-31',
    dealStatusId: 3
});

console.log(`Revenue: R$ ${metrics.summary.totalRevenue}`);
console.log(`Average Deal: R$ ${metrics.summary.averageDealValue}`);
```

## Key Features

### Rate Limiting Compliance
- Maintains existing 500ms delay between requests
- Uses p-limit concurrency control (1 concurrent request)
- Automatic retry on rate limit errors (429)
- Maximum 3 retries with 5-second backoff

### Error Handling
- Graceful error handling with detailed logging
- Individual error tracking per data type in metrics
- Non-blocking errors in getDashboardMetrics
- Timeout protection (60 seconds per request)

### Progress Tracking
- Progress callbacks for long operations
- Detailed console logging with emojis
- Batch progress reporting

### Data Mapping
- Consistent field naming (camelCase)
- Timestamp addition for cache management
- Null-safe field extraction

## API Endpoints Used

| Method | Endpoint | Filters |
|--------|----------|---------|
| fetchProducts | GET /Products | Active eq true |
| fetchDeals | GET /Deals | StatusId, CreateDate range |
| fetchProductsByDeal | GET /Deals({id}) | $expand=Products |
| fetchContacts | GET /Contacts | (existing) |

## TypeScript Support

Type definitions available in `ploome-types.d.ts`:

```typescript
import { Product, Deal, DashboardMetrics } from './ploome-types';

const metrics: DashboardMetrics = await ploomeService.getDashboardMetrics();
```

## Usage Examples

Complete examples available in `examples/dashboard-usage.js`:

1. Basic product fetching
2. Paginated product retrieval
3. Filtered deal queries
4. Deal-specific product lists
5. Comprehensive dashboard metrics
6. Product pricing history tracking

## Testing

Run examples:
```bash
cd backend/services/sync/examples
node dashboard-usage.js
```

## Rate Limit Considerations

With 120 req/min limit and 500ms delay:
- Theoretical max: 120 requests/minute
- Actual with delays: ~120 requests/minute
- fetchAllProducts (2000 products): ~20 seconds
- fetchDeals (500 deals): ~5 seconds
- getDashboardMetrics: ~3 seconds (3 calls)

## Error Recovery

All methods implement:
- Automatic retry on RATE_LIMIT errors
- Exponential backoff on failures
- Error logging with context
- Non-throwing errors in aggregate methods

## Integration Points

### Existing Integration
```javascript
const PloomeService = require('./services/sync/ploome-service');
const service = new PloomeService(process.env.PLOOME_API_KEY);
```

### New Dashboard Route
```javascript
app.get('/api/dashboard/metrics', async (req, res) => {
    const metrics = await ploomeService.getDashboardMetrics({
        startDate: req.query.startDate,
        endDate: req.query.endDate
    });
    res.json(metrics);
});
```

## Performance Optimization

- Batch size: 50 records (balance between speed and timeout)
- Parallel processing: Not used (rate limit constraint)
- Caching: Implement at application level
- Progress tracking: Minimal overhead

## Future Enhancements

Potential improvements:
1. Redis caching for frequently accessed data
2. Batch processing for multiple deal lookups
3. Webhook integration for real-time updates
4. GraphQL API for flexible queries
5. Background job queue for large datasets

## Maintenance Notes

- Rate limiter configured in constructor
- Delay time: 500ms (configurable via requestDelay)
- Timeout: 60 seconds per request
- Retry logic: 3 attempts with 5-second delay

## Dependencies

Existing dependencies (no new requirements):
- axios: HTTP client
- p-limit: Concurrency control

## Security

- API key via environment variable
- No sensitive data in logs
- Secure HTTPS connections
- Timeout protection against hanging requests