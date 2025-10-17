# Ploomes Product Sync Test Suite

Comprehensive test suite for the Ploomes product synchronization implementation, designed to validate the sync of all 11,793 products across 5 categories.

## 📊 Test Coverage Overview

### Product Categories Tested
- **127 Services** - CIA_ prefix (non-rental)
- **95 Rentals** - CIA_LOC_ prefix
- **1,307 Atlas Products** - Atlas brand products
- **1,952 Ingersoll Products** - Ingersoll brand products
- **10,982 Omie Products** - Omie brand products
- **Total: 11,793 Products**

## 🧪 Test Files Structure

```
src/lib/__tests__/
├── README.md                     # This documentation
├── test-data-factory.ts          # Mock data generation
├── ploomes-sync.test.ts          # Unit tests for PloomesSyncService
├── sync-manager.test.ts          # Unit tests for SyncManager
└── performance.test.ts           # Performance tests for large batches

src/app/api/sync/__tests__/
├── products.test.ts              # Integration tests for /api/sync/products
└── status.test.ts                # Integration tests for /api/sync/status
```

## 🚀 Quick Start

### Run All Tests
```bash
npm test
```

### Run Specific Test Suites
```bash
# Unit tests only
npm test -- --testPathPattern=ploomes-sync

# Integration tests only
npm test -- --testPathPattern=api/sync

# Performance tests only
npm test -- --testPathPattern=performance

# Sync-specific tests only
npm run test:sync
```

### Generate Coverage Report
```bash
npm run test:coverage
```

### Run Complete Test Suite with Analysis
```bash
./scripts/run-sync-tests.sh
```

## 📋 Test Categories

### 1. Unit Tests (`ploomes-sync.test.ts`)

**PloomesSyncService Tests:**
- ✅ Product type detection (SERVICE, RENTAL, PRODUCT)
- ✅ Brand detection and mapping
- ✅ API data fetching and enrichment
- ✅ Batch processing to Supabase
- ✅ Error handling and recovery
- ✅ Complete 11,793 product categorization validation

**Key Test Scenarios:**
```typescript
// Product type detection
CIA_LOC_001 → ProductType.RENTAL
CIA_SERV_001 → ProductType.SERVICE
ATL001 → ProductType.PRODUCT

// Brand detection
'ATLAS' → ProductBrand.ATLAS
'ingersoll' → ProductBrand.INGERSOLL
'unknown' → ProductBrand.OTHER

// Batch processing
11,793 products → 24 batches of 500 products each
```

### 2. Integration Tests (`sync-manager.test.ts`)

**SyncManager Tests:**
- ✅ Retry mechanism (3 attempts with 5-second delays)
- ✅ Webhook notifications
- ✅ Status recording to database
- ✅ Interrupted sync resumption
- ✅ Concurrent operation handling
- ✅ Error recovery patterns

### 3. API Integration Tests (`products.test.ts`, `status.test.ts`)

**API Endpoint Tests:**
- ✅ POST `/api/sync/products` - Start sync operations
- ✅ GET `/api/sync/products` - Retrieve last sync status
- ✅ GET `/api/sync/status` - Get current sync status
- ✅ Error handling and validation
- ✅ Concurrent request handling

### 4. Performance Tests (`performance.test.ts`)

**Load Testing:**
- ✅ Complete 11,793 product dataset processing
- ✅ Different batch size optimization (100, 250, 500, 1000)
- ✅ Memory usage analysis
- ✅ Concurrent operation performance
- ✅ End-to-end workflow timing
- ✅ Production load simulation

**Performance Benchmarks:**
```
Target Performance:
- 11,793 products processed in <15 seconds
- Memory usage <10KB per product
- Batch processing <500ms per batch
- API enrichment <5 seconds for full dataset
```

## 🛠 Test Data Factory

The `TestDataFactory` creates realistic test data matching production requirements:

```typescript
// Create complete dataset
const allProducts = TestDataFactory.createCompleteProductSet(); // 11,793 products

// Create specific categories
const services = TestDataFactory.createServiceProducts(127);
const rentals = TestDataFactory.createRentalProducts(95);
const atlas = TestDataFactory.createAtlasProducts(1307);
const ingersoll = TestDataFactory.createIngersollProducts(1952);
const omie = TestDataFactory.createOmieProducts(10982);

// Create performance test data
const largeBatch = TestDataFactory.createLargeBatch(5000);
```

## 📊 Coverage Requirements

### Minimum Coverage Thresholds
```javascript
{
  global: {
    branches: 70%,
    functions: 70%,
    lines: 70%,
    statements: 70%
  },
  'ploomes-sync.ts': {
    branches: 90%,
    functions: 95%,
    lines: 90%,
    statements: 90%
  },
  'sync-manager.ts': {
    branches: 85%,
    functions: 90%,
    lines: 85%,
    statements: 85%
  }
}
```

### Critical Test Scenarios
1. **Product Categorization Accuracy** - 100% accuracy for all 11,793 products
2. **Error Recovery** - All failure scenarios must have recovery paths
3. **Performance Limits** - Must handle peak loads within time constraints
4. **Data Integrity** - No data loss during batch processing failures
5. **API Reliability** - All endpoints must handle concurrent requests

## 🎯 Test Validation

### Automated Validation Checks
- ✅ Exact product count validation (11,793 total)
- ✅ Category distribution validation (127+95+1307+1952+10982)
- ✅ Product type assignment accuracy
- ✅ Brand detection reliability
- ✅ Batch processing integrity
- ✅ Error handling completeness

### Manual Validation Steps
1. **Run complete test suite**: `./scripts/run-sync-tests.sh`
2. **Review coverage report**: Open `coverage/lcov-report/index.html`
3. **Validate performance**: Check console output for timing benchmarks
4. **Verify categorization**: Ensure all 5 product categories are correctly tested

## 🔧 Configuration

### Environment Variables for Testing
```bash
# Required for API tests
PLOOMES_API_TOKEN=test-token

# Optional for webhook tests
SYNC_WEBHOOK_URL=https://test-webhook.example.com
WEBHOOK_SECRET=test-secret
```

### Jest Configuration
The test suite uses custom Jest configuration with:
- Next.js integration
- TypeScript support
- Supabase mocking
- Performance timing
- Coverage thresholds

## 🚨 Troubleshooting

### Common Issues

**Test Timeouts:**
```bash
# Increase timeout for performance tests
jest.setTimeout(30000);
```

**Memory Issues:**
```bash
# Run tests with more memory
node --max-old-space-size=4096 node_modules/.bin/jest
```

**Mock Issues:**
```javascript
// Reset mocks between tests
beforeEach(() => {
  jest.clearAllMocks();
  TestDataFactory.resetCounter();
});
```

### Performance Test Failures
Performance tests may fail on slower systems. Adjust thresholds in `performance.test.ts`:
```typescript
// Increase time limits for slower systems
expect(executionTime).toBeLessThan(30000); // 30 seconds instead of 15
```

## 📈 Continuous Integration

### CI/CD Integration
```yaml
# GitHub Actions example
- name: Run Ploomes Sync Tests
  run: |
    npm ci
    npm run test:coverage
    ./scripts/run-sync-tests.sh
```

### Quality Gates
- ✅ All unit tests must pass
- ✅ Integration tests must pass
- ✅ Coverage must meet thresholds
- ✅ Performance tests should pass (warning only)
- ✅ Product categorization validation must pass

## 🔍 Debugging Tests

### Verbose Test Output
```bash
npm test -- --verbose --testPathPattern=ploomes-sync
```

### Debug Specific Test
```bash
npm test -- --testNamePattern="should correctly categorize all 11,793 products"
```

### Coverage Analysis
```bash
npm run test:coverage
node scripts/test-coverage-report.js
```

## 📝 Adding New Tests

### Test Structure Template
```typescript
describe('New Feature', () => {
  beforeEach(() => {
    TestDataFactory.resetCounter();
    jest.clearAllMocks();
  });

  test('should handle specific scenario', async () => {
    // Arrange
    const testData = TestDataFactory.createProduct();

    // Act
    const result = await serviceMethod(testData);

    // Assert
    expect(result).toEqual(expectedResult);
  });
});
```

### Performance Test Template
```typescript
test('should handle large dataset efficiently', async () => {
  const dataset = TestDataFactory.createLargeBatch(1000);

  const startTime = performance.now();
  const result = await processDataset(dataset);
  const endTime = performance.now();

  expect(result.status).toBe('COMPLETED');
  expect(endTime - startTime).toBeLessThan(5000); // 5 seconds
});
```

## 🎉 Success Criteria

The test suite is considered successful when:
- ✅ All 7 test files pass completely
- ✅ Coverage meets minimum thresholds (70% global, 90%+ for sync services)
- ✅ Product categorization validates exactly 11,793 products in 5 categories
- ✅ Performance tests complete within reasonable time limits
- ✅ No memory leaks or resource exhaustion
- ✅ All error scenarios have proper handling and recovery

## 📞 Support

For test-related issues:
1. Check this README for common solutions
2. Review test output and error messages
3. Run individual test files to isolate issues
4. Verify environment setup and dependencies
5. Check Jest configuration and mocks