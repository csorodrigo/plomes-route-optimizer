# Sales Dashboard Schema Documentation

## Overview

The sales dashboard schema extends the existing Supabase database with three core tables for comprehensive sales analytics and pricing management:

- **products**: Product catalog synced from Ploomes
- **sales**: Sales/deals tracking with customer relationships
- **pricing_history**: Historical pricing records for price erosion prevention

## Schema Design

### 1. Products Table

**Purpose**: Central product catalog synced from Ploomes Product entities

**Schema**:
```sql
CREATE TABLE public.products (
  id BIGSERIAL PRIMARY KEY,
  ploomes_product_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  code TEXT,
  category TEXT,
  price NUMERIC(15,2) NOT NULL DEFAULT 0.00,
  active BOOLEAN NOT NULL DEFAULT true,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);
```

**Indexes**:
- `products_pkey`: Primary key on id
- `products_ploomes_product_id_key`: UNIQUE constraint on ploomes_product_id
- `idx_products_active`: Partial index WHERE active = true
- `idx_products_category_active`: Composite (category, active) WHERE active = true
- `idx_products_code`: Partial index WHERE code IS NOT NULL
- `idx_products_name_search`: Full-text search GIN index (Portuguese)

**Key Features**:
- Links to Ploomes via `ploomes_product_id`
- Supports active/inactive product filtering
- Full-text search on product names
- Automatic updated_at timestamp maintenance

---

### 2. Sales Table

**Purpose**: Track deals/sales from Ploomes with product details and customer relationships

**Schema**:
```sql
CREATE TABLE public.sales (
  id BIGSERIAL PRIMARY KEY,
  ploomes_deal_id TEXT NOT NULL UNIQUE,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  deal_stage TEXT NOT NULL,
  deal_value NUMERIC(15,2) NOT NULL DEFAULT 0.00,
  probability INTEGER CHECK (probability >= 0 AND probability <= 100),
  expected_close_date DATE,
  actual_close_date DATE,
  status VARCHAR(50) NOT NULL DEFAULT 'open',
  products JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT valid_status CHECK (status IN ('open', 'won', 'lost', 'abandoned'))
);
```

**Indexes**:
- `sales_pkey`: Primary key on id
- `sales_ploomes_deal_id_key`: UNIQUE constraint on ploomes_deal_id
- `idx_sales_customer_id`: Fast customer history lookups
- `idx_sales_close_dates`: Date range queries WHERE actual_close_date IS NOT NULL
- `idx_sales_status_value`: Revenue analysis WHERE status = 'won'
- `idx_sales_expected_close`: Pipeline forecasting WHERE status = 'open'
- `idx_sales_products`: GIN index for JSONB product searches

**Products JSONB Structure**:
```json
[
  {
    "product_id": 123,
    "ploomes_product_id": "prod-uuid",
    "quantity": 5,
    "unit_price": 1500.00,
    "total": 7500.00
  }
]
```

**Key Features**:
- Foreign key to customers table (2,247 existing records)
- Status constraint: 'open', 'won', 'lost', 'abandoned'
- Probability validation: 0-100%
- JSONB array for flexible product details
- Automatic updated_at timestamp maintenance

---

### 3. Pricing History Table

**Purpose**: Track product prices per customer over time to prevent price erosion

**Schema**:
```sql
CREATE TABLE public.pricing_history (
  id BIGSERIAL PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  price NUMERIC(15,2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'BRL',
  valid_from TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  valid_to TIMESTAMPTZ,
  deal_id BIGINT REFERENCES sales(id) ON DELETE SET NULL,
  created_by TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT valid_price CHECK (price >= 0),
  CONSTRAINT valid_currency CHECK (currency ~ '^[A-Z]{3}$'),
  CONSTRAINT valid_period CHECK (valid_to IS NULL OR valid_to > valid_from)
);
```

**Indexes**:
- `pricing_history_pkey`: Primary key on id
- `idx_pricing_history_product_price`: Critical for "lowest price ever" queries
- `idx_pricing_history_customer_product`: Customer-specific pricing history
- `idx_pricing_history_current`: Active pricing WHERE valid_to IS NULL
- `idx_pricing_history_validity`: Temporal queries on validity periods

**Key Features**:
- Temporal validity tracking (valid_from, valid_to)
- Optional link to originating deal
- Currency validation (3-letter ISO codes)
- Price validation (must be >= 0)
- Audit trail support (created_by, notes)

---

## Helper Functions

### get_lowest_price_for_product(p_product_id BIGINT)

Returns the minimum price ever sold for a specific product across all customers.

**Usage**:
```sql
SELECT get_lowest_price_for_product(123);
-- Returns: 1299.99
```

**Use Case**: Price validation before creating new deals - ensure not selling below historical minimum.

---

### get_lowest_price_for_customer(p_customer_id TEXT, p_product_id BIGINT)

Returns the minimum price sold to a specific customer for a specific product.

**Usage**:
```sql
SELECT get_lowest_price_for_customer('customer-uuid', 123);
-- Returns: 1499.99
```

**Use Case**: Customer-specific pricing validation - ensure not selling below what customer has previously paid.

---

## Security Configuration

### Row Level Security (RLS)

All three tables have RLS enabled with read-only access for authenticated users:

- **products**: Authenticated users can SELECT all products
- **sales**: Authenticated users can SELECT all sales
- **pricing_history**: Authenticated users can SELECT all pricing history

**Policy Philosophy**:
- Dashboard users need read access for analytics
- Write operations should go through API with business logic validation
- Prevents accidental data modification from dashboard queries

### Permissions

```sql
GRANT SELECT ON public.products TO authenticated;
GRANT SELECT ON public.sales TO authenticated;
GRANT SELECT ON public.pricing_history TO authenticated;
GRANT USAGE ON SEQUENCE products_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE sales_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE pricing_history_id_seq TO authenticated;
```

---

## Performance Optimization

### Index Strategy

1. **Ploomes Sync**: UNIQUE indexes on ploomes_product_id and ploomes_deal_id for fast upsert operations
2. **Customer Analysis**: idx_sales_customer_id for customer history queries
3. **Date Filtering**: Partial indexes on close dates for dashboard date range queries
4. **Revenue Reports**: Composite index on (status, deal_value) for won deals analysis
5. **Price Validation**: idx_pricing_history_product_price for lowest price queries
6. **Full-Text Search**: GIN index on product names for search functionality

### Query Patterns

**Dashboard: Monthly Revenue**
```sql
SELECT
  DATE_TRUNC('month', actual_close_date) as month,
  COUNT(*) as deals_count,
  SUM(deal_value) as total_revenue
FROM sales
WHERE status = 'won'
  AND actual_close_date >= NOW() - INTERVAL '12 months'
GROUP BY DATE_TRUNC('month', actual_close_date)
ORDER BY month DESC;
```
*Uses: idx_sales_status_value (partial index WHERE status = 'won')*

**Customer Sales History**
```sql
SELECT s.*, c.name as customer_name, s.products
FROM sales s
JOIN customers c ON s.customer_id = c.id
WHERE s.customer_id = 'customer-uuid'
ORDER BY s.actual_close_date DESC;
```
*Uses: idx_sales_customer_id*

**Lowest Price Check**
```sql
SELECT MIN(price) as lowest_price_ever
FROM pricing_history
WHERE product_id = 123;
```
*Uses: idx_pricing_history_product_price*

**Current Customer Pricing**
```sql
SELECT * FROM pricing_history
WHERE customer_id = 'customer-uuid'
  AND product_id = 123
  AND valid_to IS NULL
ORDER BY valid_from DESC
LIMIT 1;
```
*Uses: idx_pricing_history_current (partial index WHERE valid_to IS NULL)*

---

## Business Rules

### Price Erosion Prevention

The pricing_history table enables enforcement of pricing rules:

1. **Global Floor Price**: Never sell below the lowest price ever sold
2. **Customer Floor Price**: Never sell to a customer below their historical price
3. **Price Trend Analysis**: Track pricing changes over time per customer/product
4. **Deal Attribution**: Link pricing records to deals that established them

**Implementation Example**:
```javascript
// Before creating a deal with price $1200
const lowestPrice = await supabase
  .rpc('get_lowest_price_for_product', { p_product_id: 123 });

if (proposedPrice < lowestPrice) {
  throw new Error(`Price $${proposedPrice} is below historical minimum $${lowestPrice}`);
}
```

### Temporal Pricing

- `valid_from`: When this price became effective
- `valid_to`: When this price expired (NULL = still active)
- Only one active pricing record per customer-product pair (valid_to IS NULL)

---

## Migration Details

**File**: `/frontend-v0/supabase/migrations/20250930000000_sales_dashboard_schema.sql`

**Applied**: 2025-09-30

**Includes**:
- 3 table definitions with constraints
- 18 performance indexes
- 2 helper functions for price validation
- 2 triggers for updated_at maintenance
- 3 RLS policies for security
- Permission grants for authenticated users

---

## Integration with Existing Schema

### Foreign Key Relationships

```
customers (2,247 records)
  ├─→ sales.customer_id (CASCADE DELETE)
  └─→ pricing_history.customer_id (CASCADE DELETE)

products (0 records - ready for sync)
  └─→ pricing_history.product_id (CASCADE DELETE)

sales (0 records - ready for sync)
  └─→ pricing_history.deal_id (SET NULL on delete)
```

### Cascade Behavior

- **Customer deletion**: Removes all associated sales and pricing history
- **Product deletion**: Removes all associated pricing history records
- **Sale deletion**: Nullifies deal_id in pricing history (preserves audit trail)

---

## Security Advisory Notes

The security advisor flagged warnings for the new functions:

**Warning**: Function search_path mutable
- Functions: `get_lowest_price_for_product`, `get_lowest_price_for_customer`, `update_updated_at_column`
- Impact: Low risk (read-only queries, simple operations)
- Remediation: Set explicit `search_path` in function definitions if needed for production hardening

**Status**: Acceptable for dashboard analytics use case. Functions perform simple aggregations without security-sensitive operations.

---

## Next Steps

### 1. Data Sync Implementation

Create sync scripts to populate from Ploomes:

```javascript
// products sync
const ploomesProducts = await fetchPloomesProducts();
for (const product of ploomesProducts) {
  await supabase.from('products').upsert({
    ploomes_product_id: product.Id,
    name: product.Name,
    code: product.Code,
    category: product.Category,
    price: product.Price,
    active: product.Active
  }, { onConflict: 'ploomes_product_id' });
}

// sales sync
const ploomesDeals = await fetchPloomesDeals();
for (const deal of ploomesDeals) {
  await supabase.from('sales').upsert({
    ploomes_deal_id: deal.Id,
    customer_id: deal.PersonId,
    deal_stage: deal.Stage,
    deal_value: deal.Amount,
    probability: deal.Probability,
    expected_close_date: deal.ExpectedCloseDate,
    actual_close_date: deal.ActualCloseDate,
    status: mapDealStatus(deal.Status),
    products: deal.Products
  }, { onConflict: 'ploomes_deal_id' });
}
```

### 2. Pricing History Population

Backfill pricing history from existing deals:

```sql
INSERT INTO pricing_history (customer_id, product_id, price, valid_from, deal_id)
SELECT
  s.customer_id,
  (p->>'product_id')::BIGINT as product_id,
  (p->>'unit_price')::NUMERIC as price,
  s.actual_close_date as valid_from,
  s.id as deal_id
FROM sales s
CROSS JOIN LATERAL jsonb_array_elements(s.products) as p
WHERE s.status = 'won' AND s.actual_close_date IS NOT NULL;
```

### 3. Dashboard Implementation

Build React dashboard components:
- Sales pipeline visualization
- Revenue trends chart
- Customer purchase history
- Product performance metrics
- Pricing analysis reports

### 4. API Endpoints

Create protected API routes:
- `/api/sales/revenue` - Revenue analytics
- `/api/sales/pipeline` - Pipeline forecasting
- `/api/products/performance` - Product metrics
- `/api/pricing/validate` - Price validation before deal creation
- `/api/customers/:id/history` - Customer purchase history

---

## Summary

Schema successfully created with:
- 3 tables optimized for dashboard queries
- 18 performance indexes for fast analytics
- 2 helper functions for price validation
- Complete RLS security configuration
- Foreign key relationships to existing customers table
- Ready for Ploomes data synchronization

All tables are empty and ready for data population from Ploomes API.