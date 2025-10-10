-- =====================================================
-- Sales Dashboard Schema Migration
-- =====================================================
-- Purpose: Add products, sales, and pricing_history tables
-- for comprehensive sales analytics and dashboard functionality
--
-- Design Goals:
-- 1. Link to Ploomes Product.Id and Deal.Id
-- 2. Track pricing history to prevent selling cheaper than before
-- 3. Optimize for dashboard queries (date ranges, customer analysis)
-- 4. Enable RLS for security while maintaining read performance
-- =====================================================

-- =====================================================
-- PRODUCTS TABLE
-- =====================================================
-- Stores product catalog synced from Ploomes
-- Key patterns: Filter by active status, search by code/name
-- =====================================================

CREATE TABLE IF NOT EXISTS public.products (
  id BIGSERIAL PRIMARY KEY,
  ploomes_product_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  code TEXT,
  category TEXT,
  price NUMERIC(15,2) NOT NULL DEFAULT 0.00,
  active BOOLEAN NOT NULL DEFAULT true,
  description TEXT,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- Index for Ploomes sync lookups (already UNIQUE, creates index automatically)
-- Index for active product filtering (common dashboard query)
CREATE INDEX idx_products_active ON public.products(active) WHERE active = true;

-- Composite index for category filtering with active status
CREATE INDEX idx_products_category_active ON public.products(category, active)
  WHERE active = true;

-- Index for code lookups (product searches)
CREATE INDEX idx_products_code ON public.products(code) WHERE code IS NOT NULL;

-- Full-text search index on product names
CREATE INDEX idx_products_name_search ON public.products USING gin(to_tsvector('portuguese', name));

COMMENT ON TABLE public.products IS 'Product catalog synced from Ploomes Product entities';
COMMENT ON COLUMN public.products.ploomes_product_id IS 'Foreign key to Ploomes Product.Id';
COMMENT ON COLUMN public.products.price IS 'Current list price (base price, may differ from deal-specific pricing)';


-- =====================================================
-- SALES TABLE
-- =====================================================
-- Stores sales/deals from Ploomes with product details
-- Key patterns: Customer history, date range queries, pipeline analysis
-- =====================================================

CREATE TABLE IF NOT EXISTS public.sales (
  id BIGSERIAL PRIMARY KEY,
  ploomes_deal_id TEXT NOT NULL UNIQUE,

  -- Relationships
  customer_id TEXT NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,

  -- Deal Information
  deal_stage TEXT NOT NULL,
  deal_value NUMERIC(15,2) NOT NULL DEFAULT 0.00,
  probability INTEGER CHECK (probability >= 0 AND probability <= 100),

  -- Dates
  expected_close_date DATE,
  actual_close_date DATE,

  -- Status tracking
  status VARCHAR(50) NOT NULL DEFAULT 'open',

  -- Products sold (JSONB array for flexibility)
  -- Structure: [{ product_id, ploomes_product_id, quantity, unit_price, total }]
  products JSONB,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),

  -- Constraints
  CONSTRAINT valid_status CHECK (status IN ('open', 'won', 'lost', 'abandoned'))
);

-- Index for customer sales history (most common query pattern)
CREATE INDEX idx_sales_customer_id ON public.sales(customer_id);

-- Index for date range queries (dashboard filtering by close date)
CREATE INDEX idx_sales_close_dates ON public.sales(actual_close_date DESC NULLS LAST)
  WHERE actual_close_date IS NOT NULL;

-- Composite index for won deals analysis (revenue reports)
CREATE INDEX idx_sales_status_value ON public.sales(status, deal_value DESC)
  WHERE status = 'won';

-- Index for expected close date (pipeline forecasting)
CREATE INDEX idx_sales_expected_close ON public.sales(expected_close_date)
  WHERE expected_close_date IS NOT NULL AND status = 'open';

-- GIN index for product searches within JSONB array
CREATE INDEX idx_sales_products ON public.sales USING gin(products);

-- Index for Ploomes sync lookups (already UNIQUE, creates index automatically)

COMMENT ON TABLE public.sales IS 'Sales/deals synced from Ploomes Deal entities';
COMMENT ON COLUMN public.sales.ploomes_deal_id IS 'Foreign key to Ploomes Deal.Id';
COMMENT ON COLUMN public.sales.customer_id IS 'Foreign key to customers table (Ploomes Person.Id)';
COMMENT ON COLUMN public.sales.products IS 'JSONB array of products sold in this deal with pricing details';
COMMENT ON COLUMN public.sales.status IS 'Deal status: open, won, lost, abandoned';


-- =====================================================
-- PRICING HISTORY TABLE
-- =====================================================
-- Tracks product prices per customer over time
-- Critical for preventing price erosion (selling cheaper than before)
--
-- Query patterns:
-- 1. Find lowest price ever sold for a product
-- 2. Find lowest price sold to specific customer
-- 3. Check if proposed price is lower than history
-- =====================================================

CREATE TABLE IF NOT EXISTS public.pricing_history (
  id BIGSERIAL PRIMARY KEY,

  -- Relationships
  customer_id TEXT NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,

  -- Pricing Details
  price NUMERIC(15,2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'BRL',

  -- Validity Period
  valid_from TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  valid_to TIMESTAMPTZ,

  -- Audit Trail
  deal_id BIGINT REFERENCES public.sales(id) ON DELETE SET NULL,
  created_by TEXT,
  notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),

  -- Constraints
  CONSTRAINT valid_price CHECK (price >= 0),
  CONSTRAINT valid_currency CHECK (currency ~ '^[A-Z]{3}$'),
  CONSTRAINT valid_period CHECK (valid_to IS NULL OR valid_to > valid_from)
);

-- Critical index for price validation queries
-- "What's the lowest price we've sold product X for?"
CREATE INDEX idx_pricing_history_product_price ON public.pricing_history(product_id, price ASC);

-- Index for customer-specific pricing history
-- "What prices have we offered customer Y?"
CREATE INDEX idx_pricing_history_customer_product ON public.pricing_history(customer_id, product_id, valid_from DESC);

-- Index for active pricing lookups
-- "What's the current valid price for customer Y on product X?"
CREATE INDEX idx_pricing_history_current ON public.pricing_history(customer_id, product_id, valid_from DESC)
  WHERE valid_to IS NULL;

-- Index for temporal queries (pricing trends over time)
CREATE INDEX idx_pricing_history_validity ON public.pricing_history(valid_from, valid_to);

COMMENT ON TABLE public.pricing_history IS 'Historical record of product prices per customer for price erosion prevention';
COMMENT ON COLUMN public.pricing_history.valid_from IS 'Start date of price validity';
COMMENT ON COLUMN public.pricing_history.valid_to IS 'End date of price validity (NULL = still active)';
COMMENT ON COLUMN public.pricing_history.deal_id IS 'Optional link to the deal that established this price';


-- =====================================================
-- HELPER FUNCTION: Get Lowest Price Ever Sold
-- =====================================================
-- Returns the minimum price ever sold for a product
-- Useful for price validation before creating new deals
-- =====================================================

CREATE OR REPLACE FUNCTION get_lowest_price_for_product(p_product_id BIGINT)
RETURNS NUMERIC(15,2) AS $$
  SELECT COALESCE(MIN(price), 0.00)
  FROM public.pricing_history
  WHERE product_id = p_product_id;
$$ LANGUAGE SQL STABLE;

COMMENT ON FUNCTION get_lowest_price_for_product IS 'Returns the minimum price ever sold for a specific product';


-- =====================================================
-- HELPER FUNCTION: Get Lowest Price for Customer
-- =====================================================
-- Returns the minimum price sold to a specific customer
-- for a specific product
-- =====================================================

CREATE OR REPLACE FUNCTION get_lowest_price_for_customer(
  p_customer_id TEXT,
  p_product_id BIGINT
)
RETURNS NUMERIC(15,2) AS $$
  SELECT COALESCE(MIN(price), 0.00)
  FROM public.pricing_history
  WHERE customer_id = p_customer_id
    AND product_id = p_product_id;
$$ LANGUAGE SQL STABLE;

COMMENT ON FUNCTION get_lowest_price_for_customer IS 'Returns the minimum price ever sold to a customer for a product';


-- =====================================================
-- TRIGGER FUNCTIONS: updated_at timestamp maintenance
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers to products and sales tables
CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sales_updated_at
  BEFORE UPDATE ON public.sales
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON FUNCTION update_updated_at_column IS 'Automatically updates updated_at timestamp on row modification';


-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================
-- Enable RLS for all tables with read-only access for authenticated users
-- Write operations should go through API with business logic validation
-- =====================================================

-- Enable RLS
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_history ENABLE ROW LEVEL SECURITY;

-- Products: Authenticated users can read all products
CREATE POLICY "Allow authenticated read access on products"
  ON public.products
  FOR SELECT
  TO authenticated
  USING (true);

-- Sales: Authenticated users can read all sales
CREATE POLICY "Allow authenticated read access on sales"
  ON public.sales
  FOR SELECT
  TO authenticated
  USING (true);

-- Pricing History: Authenticated users can read all pricing history
CREATE POLICY "Allow authenticated read access on pricing_history"
  ON public.pricing_history
  FOR SELECT
  TO authenticated
  USING (true);

COMMENT ON POLICY "Allow authenticated read access on products" ON public.products IS 'Dashboard users need read access to product catalog';
COMMENT ON POLICY "Allow authenticated read access on sales" ON public.sales IS 'Dashboard users need read access to sales data';
COMMENT ON POLICY "Allow authenticated read access on pricing_history" ON public.pricing_history IS 'Dashboard users need read access to pricing history for analysis';


-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================
-- Ensure authenticated users can query these tables
-- =====================================================

GRANT SELECT ON public.products TO authenticated;
GRANT SELECT ON public.sales TO authenticated;
GRANT SELECT ON public.pricing_history TO authenticated;

-- Grant usage on sequences for potential admin operations
GRANT USAGE ON SEQUENCE products_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE sales_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE pricing_history_id_seq TO authenticated;


-- =====================================================
-- SAMPLE QUERIES FOR VALIDATION
-- =====================================================

-- Find all sales for a customer with product details
-- SELECT s.*, c.name as customer_name, s.products
-- FROM sales s
-- JOIN customers c ON s.customer_id = c.id
-- WHERE s.customer_id = 'customer-uuid'
-- ORDER BY s.actual_close_date DESC;

-- Find lowest price ever sold for a product
-- SELECT product_id, MIN(price) as lowest_price
-- FROM pricing_history
-- WHERE product_id = 123
-- GROUP BY product_id;

-- Find products sold to customer with pricing
-- SELECT DISTINCT
--   p.name,
--   p.code,
--   ph.price,
--   ph.valid_from
-- FROM pricing_history ph
-- JOIN products p ON ph.product_id = p.id
-- WHERE ph.customer_id = 'customer-uuid'
-- ORDER BY ph.valid_from DESC;

-- Dashboard: Monthly sales revenue (won deals)
-- SELECT
--   DATE_TRUNC('month', actual_close_date) as month,
--   COUNT(*) as deals_count,
--   SUM(deal_value) as total_revenue
-- FROM sales
-- WHERE status = 'won'
--   AND actual_close_date >= NOW() - INTERVAL '12 months'
-- GROUP BY DATE_TRUNC('month', actual_close_date)
-- ORDER BY month DESC;