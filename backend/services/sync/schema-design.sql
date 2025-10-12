-- ===================================================================
-- COMPREHENSIVE PLOOMES PRODUCT SYNC DATABASE SCHEMA
-- ===================================================================
-- This schema supports all Ploomes product types:
-- - 11,793 total products across categories
-- - 127 services (CIA_ prefix)
-- - 95 rental/location items (CIA_LOC_ prefix)
-- - 1,307 Atlas products, 1,952 Ingersoll products
-- - 10,982 Omie-created products
-- ===================================================================

-- Drop existing constraints and tables (for clean migration)
DROP TABLE IF EXISTS product_sync_logs CASCADE;
DROP TABLE IF EXISTS product_categories CASCADE;
DROP TABLE IF EXISTS product_variants CASCADE;
DROP TABLE IF EXISTS product_suppliers CASCADE;
DROP TABLE IF EXISTS service_specifications CASCADE;
DROP TABLE IF EXISTS rental_specifications CASCADE;

-- Enhanced products table with all product types
CREATE TABLE IF NOT EXISTS products_enhanced (
    id BIGSERIAL PRIMARY KEY,

    -- Core identifiers
    ploomes_product_id TEXT UNIQUE NOT NULL,
    external_id TEXT, -- For Omie integration IDs

    -- Basic product information
    name TEXT NOT NULL,
    code TEXT,
    description TEXT,

    -- Product classification
    product_type VARCHAR(20) NOT NULL DEFAULT 'product'
        CHECK (product_type IN ('product', 'service', 'rental', 'kit', 'component')),
    category TEXT,
    subcategory TEXT,
    brand TEXT,

    -- Pricing
    base_price NUMERIC(15,2) DEFAULT 0.00,
    cost_price NUMERIC(15,2),
    suggested_price NUMERIC(15,2),
    currency VARCHAR(3) DEFAULT 'BRL',

    -- Physical attributes (for products)
    weight NUMERIC(10,3), -- kg
    dimensions JSONB, -- {length, width, height, unit}

    -- Business attributes
    ncm_code VARCHAR(10),
    cfop_code VARCHAR(4),
    tax_regime TEXT,

    -- Inventory (for physical products)
    stock_quantity INTEGER DEFAULT 0,
    minimum_stock INTEGER DEFAULT 0,
    unit_of_measure VARCHAR(10) DEFAULT 'UN',

    -- Status and flags
    active BOOLEAN DEFAULT true,
    available_for_sale BOOLEAN DEFAULT true,
    requires_approval BOOLEAN DEFAULT false,
    is_kit BOOLEAN DEFAULT false,

    -- Source tracking
    source_system VARCHAR(20) DEFAULT 'ploomes'
        CHECK (source_system IN ('ploomes', 'omie', 'manual')),
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

-- Product categories lookup table
CREATE TABLE product_categories (
    id BIGSERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    parent_id BIGINT REFERENCES product_categories(id),
    description TEXT,
    is_service BOOLEAN DEFAULT false,
    is_rental BOOLEAN DEFAULT false,
    commission_rate NUMERIC(5,2) DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

-- Service-specific specifications
CREATE TABLE service_specifications (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT REFERENCES products_enhanced(id) ON DELETE CASCADE,

    -- Service delivery
    service_type VARCHAR(50), -- installation, maintenance, consultation
    duration_hours NUMERIC(8,2),
    billing_cycle VARCHAR(20), -- hourly, daily, monthly, project

    -- Resource requirements
    required_skills JSONB DEFAULT '[]'::jsonb,
    equipment_needed JSONB DEFAULT '[]'::jsonb,
    location_type VARCHAR(20) DEFAULT 'customer_site', -- customer_site, remote, office

    -- SLA
    response_time_hours INTEGER,
    completion_time_hours INTEGER,
    warranty_months INTEGER DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

-- Rental-specific specifications
CREATE TABLE rental_specifications (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT REFERENCES products_enhanced(id) ON DELETE CASCADE,

    -- Rental terms
    minimum_rental_period INTEGER DEFAULT 1, -- days
    maximum_rental_period INTEGER,
    daily_rate NUMERIC(15,2),
    weekly_rate NUMERIC(15,2),
    monthly_rate NUMERIC(15,2),

    -- Availability
    total_units INTEGER DEFAULT 1,
    available_units INTEGER DEFAULT 1,

    -- Conditions
    security_deposit NUMERIC(15,2) DEFAULT 0.00,
    late_fee_daily NUMERIC(15,2) DEFAULT 0.00,
    damage_assessment_fee NUMERIC(15,2) DEFAULT 0.00,

    -- Logistics
    delivery_required BOOLEAN DEFAULT true,
    pickup_required BOOLEAN DEFAULT true,
    delivery_fee NUMERIC(15,2) DEFAULT 0.00,
    pickup_fee NUMERIC(15,2) DEFAULT 0.00,

    created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

-- Product variants (for Atlas, Ingersoll, different sizes/models)
CREATE TABLE product_variants (
    id BIGSERIAL PRIMARY KEY,
    parent_product_id BIGINT REFERENCES products_enhanced(id) ON DELETE CASCADE,

    variant_name TEXT NOT NULL,
    variant_code TEXT,

    -- Variant-specific attributes
    size TEXT,
    color TEXT,
    model TEXT,
    specification JSONB DEFAULT '{}'::jsonb,

    -- Pricing override
    price_adjustment NUMERIC(15,2) DEFAULT 0.00,
    price_adjustment_type VARCHAR(10) DEFAULT 'fixed' CHECK (price_adjustment_type IN ('fixed', 'percentage')),

    -- Inventory
    sku TEXT UNIQUE,
    barcode TEXT,
    stock_quantity INTEGER DEFAULT 0,

    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

-- Supplier/brand information
CREATE TABLE product_suppliers (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT REFERENCES products_enhanced(id) ON DELETE CASCADE,

    supplier_name TEXT NOT NULL,
    supplier_code TEXT,
    supplier_product_code TEXT,

    -- Commercial terms
    cost_price NUMERIC(15,2),
    minimum_order_quantity INTEGER DEFAULT 1,
    lead_time_days INTEGER DEFAULT 0,

    -- Relationship
    is_primary_supplier BOOLEAN DEFAULT false,
    preferred_supplier BOOLEAN DEFAULT false,

    created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

-- Enhanced sync logging
CREATE TABLE product_sync_logs (
    id BIGSERIAL PRIMARY KEY,

    -- Sync metadata
    sync_id UUID DEFAULT gen_random_uuid(),
    sync_type VARCHAR(20) NOT NULL CHECK (sync_type IN ('full', 'incremental', 'real_time', 'manual')),
    sync_scope VARCHAR(50), -- products, services, rentals, atlas, ingersoll, omie

    -- Execution details
    started_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
    completed_at TIMESTAMPTZ,
    status VARCHAR(20) DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'partial')),

    -- Results
    total_records INTEGER DEFAULT 0,
    processed_records INTEGER DEFAULT 0,
    created_records INTEGER DEFAULT 0,
    updated_records INTEGER DEFAULT 0,
    failed_records INTEGER DEFAULT 0,
    skipped_records INTEGER DEFAULT 0,

    -- Error tracking
    error_message TEXT,
    error_details JSONB,
    failed_products JSONB DEFAULT '[]'::jsonb,

    -- Performance metrics
    duration_seconds INTEGER,
    records_per_second NUMERIC(8,2),

    -- Configuration
    batch_size INTEGER DEFAULT 100,
    parallel_workers INTEGER DEFAULT 1,

    created_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

-- ===================================================================
-- INDEXES FOR PERFORMANCE
-- ===================================================================

-- Core indexes
CREATE INDEX IF NOT EXISTS idx_products_enhanced_ploomes_id ON products_enhanced(ploomes_product_id);
CREATE INDEX IF NOT EXISTS idx_products_enhanced_code ON products_enhanced(code) WHERE code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_enhanced_type ON products_enhanced(product_type);
CREATE INDEX IF NOT EXISTS idx_products_enhanced_category ON products_enhanced(category) WHERE category IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_enhanced_brand ON products_enhanced(brand) WHERE brand IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_enhanced_active ON products_enhanced(active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_products_enhanced_source ON products_enhanced(source_system);
CREATE INDEX IF NOT EXISTS idx_products_enhanced_sync ON products_enhanced(last_sync_at);

-- Full-text search
CREATE INDEX IF NOT EXISTS idx_products_enhanced_search ON products_enhanced
    USING gin(to_tsvector('portuguese', name || ' ' || coalesce(description, '')));

-- JSONB indexes for custom fields and tags
CREATE INDEX IF NOT EXISTS idx_products_enhanced_tags ON products_enhanced USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_products_enhanced_custom_fields ON products_enhanced USING gin(custom_fields);

-- Variant indexes
CREATE INDEX IF NOT EXISTS idx_product_variants_parent ON product_variants(parent_product_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_sku ON product_variants(sku) WHERE sku IS NOT NULL;

-- Supplier indexes
CREATE INDEX IF NOT EXISTS idx_product_suppliers_product ON product_suppliers(product_id);
CREATE INDEX IF NOT EXISTS idx_product_suppliers_name ON product_suppliers(supplier_name);

-- Sync log indexes
CREATE INDEX IF NOT EXISTS idx_product_sync_logs_sync_id ON product_sync_logs(sync_id);
CREATE INDEX IF NOT EXISTS idx_product_sync_logs_type ON product_sync_logs(sync_type);
CREATE INDEX IF NOT EXISTS idx_product_sync_logs_status ON product_sync_logs(status);
CREATE INDEX IF NOT EXISTS idx_product_sync_logs_started ON product_sync_logs(started_at);

-- ===================================================================
-- TRIGGERS FOR UPDATED_AT
-- ===================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc', now());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply to all relevant tables
DROP TRIGGER IF EXISTS update_products_enhanced_updated_at ON products_enhanced;
CREATE TRIGGER update_products_enhanced_updated_at
    BEFORE UPDATE ON products_enhanced
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_service_specifications_updated_at ON service_specifications;
CREATE TRIGGER update_service_specifications_updated_at
    BEFORE UPDATE ON service_specifications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_rental_specifications_updated_at ON rental_specifications;
CREATE TRIGGER update_rental_specifications_updated_at
    BEFORE UPDATE ON rental_specifications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_product_variants_updated_at ON product_variants;
CREATE TRIGGER update_product_variants_updated_at
    BEFORE UPDATE ON product_variants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_product_suppliers_updated_at ON product_suppliers;
CREATE TRIGGER update_product_suppliers_updated_at
    BEFORE UPDATE ON product_suppliers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===================================================================
-- VIEWS FOR CONVENIENT ACCESS
-- ===================================================================

-- All products with their specifications
CREATE OR REPLACE VIEW products_complete AS
SELECT
    p.*,
    ss.service_type,
    ss.duration_hours,
    ss.billing_cycle,
    rs.minimum_rental_period,
    rs.daily_rate,
    rs.monthly_rate,
    rs.total_units as rental_units,
    COUNT(pv.id) as variant_count,
    COALESCE(ARRAY_AGG(ps.supplier_name) FILTER (WHERE ps.supplier_name IS NOT NULL), '{}') as suppliers
FROM products_enhanced p
LEFT JOIN service_specifications ss ON p.id = ss.product_id
LEFT JOIN rental_specifications rs ON p.id = rs.product_id
LEFT JOIN product_variants pv ON p.id = pv.parent_product_id AND pv.active = true
LEFT JOIN product_suppliers ps ON p.id = ps.product_id
GROUP BY p.id, ss.service_type, ss.duration_hours, ss.billing_cycle,
         rs.minimum_rental_period, rs.daily_rate, rs.monthly_rate, rs.total_units;

-- Product categories hierarchy
CREATE OR REPLACE VIEW product_categories_hierarchy AS
WITH RECURSIVE category_tree AS (
    -- Base case: root categories
    SELECT id, name, parent_id, description, is_service, is_rental, 0 as level, name as path
    FROM product_categories
    WHERE parent_id IS NULL

    UNION ALL

    -- Recursive case: child categories
    SELECT c.id, c.name, c.parent_id, c.description, c.is_service, c.is_rental,
           ct.level + 1, ct.path || ' > ' || c.name
    FROM product_categories c
    INNER JOIN category_tree ct ON c.parent_id = ct.id
)
SELECT * FROM category_tree;

-- ===================================================================
-- INITIAL DATA SETUP
-- ===================================================================

-- Insert basic product categories based on Ploomes structure
INSERT INTO product_categories (name, description, is_service, is_rental) VALUES
('CIA Services', 'CIA prefixed services', true, false),
('CIA Rentals', 'CIA_LOC prefixed rental items', false, true),
('Atlas Products', 'Atlas brand products', false, false),
('Ingersoll Products', 'Ingersoll brand products', false, false),
('Omie Products', 'Products created via Omie integration', false, false),
('Standard Products', 'General product catalog', false, false)
ON CONFLICT (name) DO NOTHING;

-- ===================================================================
-- COMMENTS FOR DOCUMENTATION
-- ===================================================================

COMMENT ON TABLE products_enhanced IS 'Enhanced products table supporting all Ploomes product types including services, rentals, and variants';
COMMENT ON TABLE product_categories IS 'Hierarchical product categorization system';
COMMENT ON TABLE service_specifications IS 'Service-specific attributes and SLA specifications';
COMMENT ON TABLE rental_specifications IS 'Rental-specific terms, rates, and logistics';
COMMENT ON TABLE product_variants IS 'Product variants for different sizes, models, or specifications';
COMMENT ON TABLE product_suppliers IS 'Supplier information and commercial terms per product';
COMMENT ON TABLE product_sync_logs IS 'Detailed logging for all product synchronization operations';

-- Performance and maintenance notes
COMMENT ON INDEX idx_products_enhanced_search IS 'Full-text search index for product names and descriptions in Portuguese';
COMMENT ON VIEW products_complete IS 'Complete product view with all related specifications and counts';