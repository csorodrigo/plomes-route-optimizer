-- =====================================================
-- ENHANCED PRODUCTS SCHEMA MIGRATION
-- =====================================================
-- Purpose: Optimized schema for 11,793 Ploomes products
-- Categories: 127 services, 95 rentals, Atlas/Ingersoll brands, Omie products
-- Performance: Partitioning, indexes, materialized views, full-text search
-- =====================================================

-- =====================================================
-- ENHANCED PRODUCTS TABLE
-- =====================================================
-- Main products table with partitioning support for 11K+ products
-- Optimized for brand/category filtering and full-text search
-- =====================================================

CREATE TABLE IF NOT EXISTS public.products_enhanced (
  id BIGSERIAL PRIMARY KEY,

  -- Ploomes Integration
  ploomes_product_id TEXT NOT NULL UNIQUE,
  external_id TEXT, -- For Omie/other system integration

  -- Core Product Information
  name TEXT NOT NULL,
  code TEXT,
  description TEXT,

  -- Classification
  product_type VARCHAR(20) NOT NULL DEFAULT 'product', -- product, service, rental
  category TEXT,
  brand TEXT,

  -- Pricing
  base_price NUMERIC(15,2) NOT NULL DEFAULT 0.00,
  cost_price NUMERIC(15,2),
  currency VARCHAR(3) NOT NULL DEFAULT 'BRL',

  -- Physical Properties
  weight NUMERIC(10,3), -- kg
  dimensions JSONB, -- {length, width, height, unit}

  -- Tax and Legal
  ncm_code VARCHAR(20), -- Brazilian tax classification

  -- Inventory
  stock_quantity INTEGER DEFAULT 0,
  unit_of_measure VARCHAR(10) DEFAULT 'UN',

  -- Status
  active BOOLEAN NOT NULL DEFAULT true,
  available_for_sale BOOLEAN NOT NULL DEFAULT true,

  -- Source System Tracking
  source_system VARCHAR(20) NOT NULL DEFAULT 'ploomes', -- ploomes, omie
  source_created_at TIMESTAMPTZ,
  source_updated_at TIMESTAMPTZ,

  -- Sync Control
  sync_version INTEGER NOT NULL DEFAULT 1,
  last_sync_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),

  -- Flexible Data
  tags TEXT[], -- For additional categorization
  custom_fields JSONB, -- Flexible field storage

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),

  -- Constraints
  CONSTRAINT valid_product_type CHECK (product_type IN ('product', 'service', 'rental')),
  CONSTRAINT valid_currency CHECK (currency ~ '^[A-Z]{3}$'),
  CONSTRAINT positive_prices CHECK (base_price >= 0 AND (cost_price IS NULL OR cost_price >= 0))
) PARTITION BY HASH (ploomes_product_id);

-- Create partitions for better performance (4 partitions for ~3K products each)
CREATE TABLE products_enhanced_p0 PARTITION OF products_enhanced
  FOR VALUES WITH (MODULUS 4, REMAINDER 0);

CREATE TABLE products_enhanced_p1 PARTITION OF products_enhanced
  FOR VALUES WITH (MODULUS 4, REMAINDER 1);

CREATE TABLE products_enhanced_p2 PARTITION OF products_enhanced
  FOR VALUES WITH (MODULUS 4, REMAINDER 2);

CREATE TABLE products_enhanced_p3 PARTITION OF products_enhanced
  FOR VALUES WITH (MODULUS 4, REMAINDER 3);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Primary lookup indexes
CREATE INDEX idx_products_enhanced_ploomes_id ON products_enhanced(ploomes_product_id);
CREATE INDEX idx_products_enhanced_external_id ON products_enhanced(external_id) WHERE external_id IS NOT NULL;
CREATE INDEX idx_products_enhanced_code ON products_enhanced(code) WHERE code IS NOT NULL;

-- Filtering indexes (most common queries)
CREATE INDEX idx_products_enhanced_active ON products_enhanced(active) WHERE active = true;
CREATE INDEX idx_products_enhanced_type_active ON products_enhanced(product_type, active) WHERE active = true;
CREATE INDEX idx_products_enhanced_category_active ON products_enhanced(category, active) WHERE active = true AND category IS NOT NULL;
CREATE INDEX idx_products_enhanced_brand_active ON products_enhanced(brand, active) WHERE active = true AND brand IS NOT NULL;

-- Performance indexes for business logic
CREATE INDEX idx_products_enhanced_sync_version ON products_enhanced(sync_version, last_sync_at);
CREATE INDEX idx_products_enhanced_source_system ON products_enhanced(source_system, active);

-- Price range filtering
CREATE INDEX idx_products_enhanced_price_range ON products_enhanced(base_price) WHERE active = true AND base_price > 0;

-- Full-text search indexes
CREATE INDEX idx_products_enhanced_name_search ON products_enhanced
  USING gin(to_tsvector('portuguese', name));

CREATE INDEX idx_products_enhanced_name_code_search ON products_enhanced
  USING gin(to_tsvector('portuguese', name || ' ' || COALESCE(code, '')));

-- JSONB indexes for flexible querying
CREATE INDEX idx_products_enhanced_tags ON products_enhanced USING gin(tags);
CREATE INDEX idx_products_enhanced_custom_fields ON products_enhanced USING gin(custom_fields);
CREATE INDEX idx_products_enhanced_dimensions ON products_enhanced USING gin(dimensions);

COMMENT ON TABLE products_enhanced IS 'Enhanced product catalog with 11K+ products, optimized for brand/category filtering and full-text search';

-- =====================================================
-- SERVICE SPECIFICATIONS TABLE
-- =====================================================
-- Specifications for CIA_ prefixed service products (127 services)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.service_specifications (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES products_enhanced(id) ON DELETE CASCADE,

  -- Service Details
  service_type VARCHAR(50) NOT NULL DEFAULT 'general', -- maintenance, installation, consulting, etc.
  duration_hours NUMERIC(6,2), -- Expected duration
  billing_cycle VARCHAR(20) DEFAULT 'project', -- hourly, daily, project, monthly

  -- Requirements
  required_skills TEXT[], -- Technical skills needed
  location_type VARCHAR(30) DEFAULT 'customer_site', -- customer_site, workshop, remote
  equipment_required TEXT[], -- Tools/equipment needed

  -- Pricing Modifiers
  base_hourly_rate NUMERIC(10,2),
  overtime_multiplier NUMERIC(4,2) DEFAULT 1.5,
  weekend_multiplier NUMERIC(4,2) DEFAULT 2.0,

  -- Contract Terms
  minimum_hours NUMERIC(6,2) DEFAULT 1,
  travel_charges_included BOOLEAN DEFAULT false,
  warranty_period_days INTEGER,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),

  CONSTRAINT unique_service_spec_per_product UNIQUE(product_id)
);

CREATE INDEX idx_service_specs_product_id ON service_specifications(product_id);
CREATE INDEX idx_service_specs_type ON service_specifications(service_type);
CREATE INDEX idx_service_specs_location ON service_specifications(location_type);

COMMENT ON TABLE service_specifications IS 'Service-specific specifications for CIA_ service products';

-- =====================================================
-- RENTAL SPECIFICATIONS TABLE
-- =====================================================
-- Specifications for CIA_LOC_ prefixed rental products (95 rentals)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.rental_specifications (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES products_enhanced(id) ON DELETE CASCADE,

  -- Rental Terms
  minimum_rental_period INTEGER NOT NULL DEFAULT 1, -- days
  maximum_rental_period INTEGER, -- days, NULL = unlimited

  -- Pricing Structure
  daily_rate NUMERIC(10,2),
  weekly_rate NUMERIC(10,2),
  monthly_rate NUMERIC(10,2),
  long_term_rate NUMERIC(10,2), -- for > 30 days

  -- Inventory Management
  total_units INTEGER NOT NULL DEFAULT 1,
  available_units INTEGER NOT NULL DEFAULT 1,
  reserved_units INTEGER NOT NULL DEFAULT 0,
  maintenance_units INTEGER NOT NULL DEFAULT 0,

  -- Financial
  security_deposit NUMERIC(10,2) NOT NULL DEFAULT 0,
  replacement_value NUMERIC(12,2),
  insurance_required BOOLEAN DEFAULT false,

  -- Logistics
  delivery_required BOOLEAN DEFAULT true,
  delivery_radius_km INTEGER, -- Maximum delivery distance
  pickup_required BOOLEAN DEFAULT true,

  -- Condition Tracking
  condition_new INTEGER DEFAULT 0,
  condition_good INTEGER DEFAULT 0,
  condition_fair INTEGER DEFAULT 0,
  condition_repair INTEGER DEFAULT 0,

  -- Maintenance
  maintenance_interval_days INTEGER,
  last_maintenance_date DATE,
  next_maintenance_date DATE,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),

  CONSTRAINT unique_rental_spec_per_product UNIQUE(product_id),
  CONSTRAINT valid_unit_counts CHECK (
    total_units = available_units + reserved_units + maintenance_units
  )
);

CREATE INDEX idx_rental_specs_product_id ON rental_specifications(product_id);
CREATE INDEX idx_rental_specs_availability ON rental_specifications(available_units) WHERE available_units > 0;
CREATE INDEX idx_rental_specs_maintenance ON rental_specifications(next_maintenance_date) WHERE next_maintenance_date IS NOT NULL;

COMMENT ON TABLE rental_specifications IS 'Rental-specific specifications for CIA_LOC_ rental products';

-- =====================================================
-- PRODUCT SYNC LOGS TABLE
-- =====================================================
-- Track sync operations for monitoring and debugging
-- =====================================================

CREATE TABLE IF NOT EXISTS public.product_sync_logs (
  id BIGSERIAL PRIMARY KEY,
  sync_id TEXT NOT NULL UNIQUE,
  sync_type VARCHAR(20) NOT NULL, -- full, incremental, real_time
  sync_scope TEXT, -- categories synced

  -- Progress Tracking
  status VARCHAR(20) NOT NULL DEFAULT 'running', -- running, completed, failed
  total_records INTEGER DEFAULT 0,
  processed_records INTEGER DEFAULT 0,
  created_records INTEGER DEFAULT 0,
  updated_records INTEGER DEFAULT 0,
  failed_records INTEGER DEFAULT 0,

  -- Performance
  duration_seconds INTEGER,
  records_per_second NUMERIC(10,2),
  batch_size INTEGER,
  parallel_workers INTEGER,

  -- Error Handling
  error_message TEXT,
  error_details JSONB,

  -- Timestamps
  started_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  completed_at TIMESTAMPTZ,

  CONSTRAINT valid_sync_status CHECK (status IN ('running', 'completed', 'failed'))
);

CREATE INDEX idx_product_sync_logs_status ON product_sync_logs(status, started_at DESC);
CREATE INDEX idx_product_sync_logs_type ON product_sync_logs(sync_type, started_at DESC);

COMMENT ON TABLE product_sync_logs IS 'Audit trail for product synchronization operations';

-- =====================================================
-- MATERIALIZED VIEWS FOR PERFORMANCE
-- =====================================================

-- Product summary by category and brand
CREATE MATERIALIZED VIEW IF NOT EXISTS product_summary_by_category AS
SELECT
  product_type,
  category,
  brand,
  COUNT(*) as total_products,
  COUNT(*) FILTER (WHERE active = true) as active_products,
  COUNT(*) FILTER (WHERE available_for_sale = true AND active = true) as sellable_products,
  AVG(base_price) FILTER (WHERE active = true AND base_price > 0) as avg_price,
  MIN(base_price) FILTER (WHERE active = true AND base_price > 0) as min_price,
  MAX(base_price) FILTER (WHERE active = true AND base_price > 0) as max_price,
  SUM(stock_quantity) FILTER (WHERE active = true) as total_stock
FROM products_enhanced
GROUP BY product_type, category, brand;

CREATE UNIQUE INDEX idx_product_summary_category_unique
  ON product_summary_by_category(product_type, COALESCE(category, ''), COALESCE(brand, ''));

-- Service summary for CIA services
CREATE MATERIALIZED VIEW IF NOT EXISTS service_summary AS
SELECT
  ss.service_type,
  COUNT(*) as total_services,
  COUNT(*) FILTER (WHERE p.active = true) as active_services,
  AVG(ss.base_hourly_rate) FILTER (WHERE ss.base_hourly_rate > 0) as avg_hourly_rate,
  AVG(ss.duration_hours) FILTER (WHERE ss.duration_hours > 0) as avg_duration_hours
FROM service_specifications ss
JOIN products_enhanced p ON ss.product_id = p.id
GROUP BY ss.service_type;

CREATE UNIQUE INDEX idx_service_summary_type ON service_summary(service_type);

-- Rental availability summary
CREATE MATERIALIZED VIEW IF NOT EXISTS rental_availability_summary AS
SELECT
  p.category,
  p.brand,
  COUNT(*) as total_rental_products,
  SUM(rs.total_units) as total_units,
  SUM(rs.available_units) as available_units,
  SUM(rs.reserved_units) as reserved_units,
  AVG(rs.daily_rate) FILTER (WHERE rs.daily_rate > 0) as avg_daily_rate
FROM rental_specifications rs
JOIN products_enhanced p ON rs.product_id = p.id
WHERE p.active = true
GROUP BY p.category, p.brand;

CREATE UNIQUE INDEX idx_rental_availability_category
  ON rental_availability_summary(COALESCE(category, ''), COALESCE(brand, ''));

COMMENT ON MATERIALIZED VIEW product_summary_by_category IS 'Aggregated product metrics by category and brand for dashboard performance';
COMMENT ON MATERIALIZED VIEW service_summary IS 'Service metrics for CIA_ prefixed services';
COMMENT ON MATERIALIZED VIEW rental_availability_summary IS 'Rental availability metrics for CIA_LOC_ prefixed rentals';

-- =====================================================
-- FUNCTIONS FOR SYNC OPERATIONS
-- =====================================================

-- Function to refresh all materialized views
CREATE OR REPLACE FUNCTION refresh_product_materialized_views()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY product_summary_by_category;
  REFRESH MATERIALIZED VIEW CONCURRENTLY service_summary;
  REFRESH MATERIALIZED VIEW CONCURRENTLY rental_availability_summary;
END;
$$ LANGUAGE plpgsql;

-- Function to get product search results with ranking
CREATE OR REPLACE FUNCTION search_products(
  search_term TEXT,
  product_types TEXT[] DEFAULT NULL,
  categories TEXT[] DEFAULT NULL,
  brands TEXT[] DEFAULT NULL,
  active_only BOOLEAN DEFAULT true,
  limit_results INTEGER DEFAULT 50
)
RETURNS TABLE (
  id BIGINT,
  ploomes_product_id TEXT,
  name TEXT,
  code TEXT,
  category TEXT,
  brand TEXT,
  base_price NUMERIC,
  search_rank REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.ploomes_product_id,
    p.name,
    p.code,
    p.category,
    p.brand,
    p.base_price,
    ts_rank(
      to_tsvector('portuguese', p.name || ' ' || COALESCE(p.code, '')),
      plainto_tsquery('portuguese', search_term)
    ) as search_rank
  FROM products_enhanced p
  WHERE
    (NOT active_only OR p.active = true)
    AND (product_types IS NULL OR p.product_type = ANY(product_types))
    AND (categories IS NULL OR p.category = ANY(categories))
    AND (brands IS NULL OR p.brand = ANY(brands))
    AND (
      to_tsvector('portuguese', p.name || ' ' || COALESCE(p.code, '')) @@
      plainto_tsquery('portuguese', search_term)
    )
  ORDER BY search_rank DESC, p.name
  LIMIT limit_results;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get products by category with pagination
CREATE OR REPLACE FUNCTION get_products_by_category(
  target_category TEXT,
  target_brand TEXT DEFAULT NULL,
  page_offset INTEGER DEFAULT 0,
  page_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  id BIGINT,
  ploomes_product_id TEXT,
  name TEXT,
  code TEXT,
  base_price NUMERIC,
  stock_quantity INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.ploomes_product_id,
    p.name,
    p.code,
    p.base_price,
    p.stock_quantity
  FROM products_enhanced p
  WHERE
    p.active = true
    AND p.category = target_category
    AND (target_brand IS NULL OR p.brand = target_brand)
  ORDER BY p.name
  OFFSET page_offset
  LIMIT page_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to validate product data before sync
CREATE OR REPLACE FUNCTION validate_product_data(
  product_name TEXT,
  product_code TEXT,
  product_type TEXT,
  base_price NUMERIC
)
RETURNS TEXT AS $$
BEGIN
  -- Validate required fields
  IF product_name IS NULL OR LENGTH(TRIM(product_name)) = 0 THEN
    RETURN 'Product name is required';
  END IF;

  IF product_type NOT IN ('product', 'service', 'rental') THEN
    RETURN 'Invalid product type';
  END IF;

  IF base_price < 0 THEN
    RETURN 'Base price cannot be negative';
  END IF;

  -- Check for duplicate codes (if provided)
  IF product_code IS NOT NULL AND LENGTH(TRIM(product_code)) > 0 THEN
    IF EXISTS (
      SELECT 1 FROM products_enhanced
      WHERE code = TRIM(product_code) AND active = true
    ) THEN
      RETURN 'Product code already exists';
    END IF;
  END IF;

  RETURN 'valid';
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION refresh_product_materialized_views IS 'Refreshes all product-related materialized views for updated metrics';
COMMENT ON FUNCTION search_products IS 'Full-text search for products with ranking and filtering';
COMMENT ON FUNCTION get_products_by_category IS 'Paginated product listing by category and brand';
COMMENT ON FUNCTION validate_product_data IS 'Validates product data before insertion or update';

-- =====================================================
-- TRIGGERS FOR DATA INTEGRITY
-- =====================================================

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Auto-refresh materialized views trigger
CREATE OR REPLACE FUNCTION refresh_views_on_product_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Schedule materialized view refresh (async)
  PERFORM pg_notify('refresh_product_views', '');
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Rental unit consistency trigger
CREATE OR REPLACE FUNCTION validate_rental_units()
RETURNS TRIGGER AS $$
BEGIN
  -- Ensure unit counts are consistent
  IF NEW.total_units != (NEW.available_units + NEW.reserved_units + NEW.maintenance_units) THEN
    RAISE EXCEPTION 'Total units must equal sum of available, reserved, and maintenance units';
  END IF;

  -- Ensure all unit counts are non-negative
  IF NEW.available_units < 0 OR NEW.reserved_units < 0 OR NEW.maintenance_units < 0 THEN
    RAISE EXCEPTION 'Unit counts cannot be negative';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
CREATE TRIGGER update_products_enhanced_updated_at
  BEFORE UPDATE ON products_enhanced
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_service_specs_updated_at
  BEFORE UPDATE ON service_specifications
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rental_specs_updated_at
  BEFORE UPDATE ON rental_specifications
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER refresh_views_on_product_insert
  AFTER INSERT ON products_enhanced
  FOR EACH ROW
  EXECUTE FUNCTION refresh_views_on_product_change();

CREATE TRIGGER refresh_views_on_product_update
  AFTER UPDATE ON products_enhanced
  FOR EACH ROW
  EXECUTE FUNCTION refresh_views_on_product_change();

CREATE TRIGGER validate_rental_units_trigger
  BEFORE INSERT OR UPDATE ON rental_specifications
  FOR EACH ROW
  EXECUTE FUNCTION validate_rental_units();

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS
ALTER TABLE products_enhanced ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_specifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE rental_specifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_sync_logs ENABLE ROW LEVEL SECURITY;

-- Policies for authenticated users (read access)
CREATE POLICY "Allow authenticated read on products_enhanced"
  ON products_enhanced
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated read on service_specifications"
  ON service_specifications
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated read on rental_specifications"
  ON rental_specifications
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated read on product_sync_logs"
  ON product_sync_logs
  FOR SELECT
  TO authenticated
  USING (true);

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================

-- Grant table access
GRANT SELECT ON products_enhanced TO authenticated;
GRANT SELECT ON service_specifications TO authenticated;
GRANT SELECT ON rental_specifications TO authenticated;
GRANT SELECT ON product_sync_logs TO authenticated;

-- Grant materialized view access
GRANT SELECT ON product_summary_by_category TO authenticated;
GRANT SELECT ON service_summary TO authenticated;
GRANT SELECT ON rental_availability_summary TO authenticated;

-- Grant function access
GRANT EXECUTE ON FUNCTION search_products TO authenticated;
GRANT EXECUTE ON FUNCTION get_products_by_category TO authenticated;
GRANT EXECUTE ON FUNCTION validate_product_data TO authenticated;
GRANT EXECUTE ON FUNCTION refresh_product_materialized_views TO authenticated;

-- Grant sequence access for potential admin operations
GRANT USAGE ON SEQUENCE products_enhanced_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE service_specifications_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE rental_specifications_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE product_sync_logs_id_seq TO authenticated;

-- =====================================================
-- SAMPLE DATA AND VALIDATION QUERIES
-- =====================================================

-- Sample insert for validation
-- INSERT INTO products_enhanced (
--   ploomes_product_id, name, code, product_type, category, brand,
--   base_price, active, source_system
-- ) VALUES (
--   'test-001', 'CIA_SERVICE_MAINTENANCE', 'CIA_MAINT_001', 'service', 'CIA Services', null,
--   150.00, true, 'ploomes'
-- );

-- Sample search query
-- SELECT * FROM search_products('Atlas compressor', ARRAY['product'], null, ARRAY['Atlas'], true, 10);

-- Sample category listing
-- SELECT * FROM get_products_by_category('Atlas Products', 'Atlas', 0, 20);

-- Sample materialized view query
-- SELECT * FROM product_summary_by_category WHERE product_type = 'service';

-- Performance validation query
-- EXPLAIN (ANALYZE, BUFFERS)
-- SELECT COUNT(*) FROM products_enhanced WHERE active = true AND brand = 'Atlas';

COMMENT ON SCHEMA public IS 'Enhanced product schema supporting 11K+ products with optimized performance for Ploomes sync';