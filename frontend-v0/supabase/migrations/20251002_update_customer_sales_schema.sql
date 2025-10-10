-- Update customer_sales table schema to match CRON job expectations
-- This migration adds all fields needed by sync-customer-sales API

-- Drop existing table if it exists (safe because this is a cache table)
DROP TABLE IF EXISTS customer_sales CASCADE;

-- Create customer_sales table with complete schema
CREATE TABLE customer_sales (
  customer_id INTEGER PRIMARY KEY,
  customer_name TEXT NOT NULL,
  customer_cnpj TEXT,

  -- Sales metrics
  total_sales DECIMAL(15, 2) DEFAULT 0,
  total_deals INTEGER DEFAULT 0,
  won_deals INTEGER DEFAULT 0,
  open_deals INTEGER DEFAULT 0,
  lost_deals INTEGER DEFAULT 0,
  total_revenue DECIMAL(15, 2) DEFAULT 0,
  average_deal_value DECIMAL(15, 2) DEFAULT 0,

  -- Product metrics
  products_purchased INTEGER[] DEFAULT '{}',
  total_products INTEGER DEFAULT 0,

  -- Date metrics
  first_purchase_date TIMESTAMPTZ,
  last_purchase_date TIMESTAMPTZ,
  days_since_last_purchase INTEGER,

  -- Pricing metrics (updated by separate pricing sync)
  has_custom_pricing BOOLEAN DEFAULT FALSE,
  pricing_history_count INTEGER DEFAULT 0,

  -- System fields
  last_sync_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for fast queries
CREATE INDEX idx_customer_sales_revenue ON customer_sales(total_revenue DESC);
CREATE INDEX idx_customer_sales_name ON customer_sales(customer_name);
CREATE INDEX idx_customer_sales_last_purchase ON customer_sales(last_purchase_date DESC);
CREATE INDEX idx_customer_sales_total_deals ON customer_sales(total_deals DESC);
CREATE INDEX idx_customer_sales_last_sync ON customer_sales(last_sync_at);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_customer_sales_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER customer_sales_updated_at
  BEFORE UPDATE ON customer_sales
  FOR EACH ROW
  EXECUTE FUNCTION update_customer_sales_updated_at();

-- Add table comment
COMMENT ON TABLE customer_sales IS 'Pre-calculated sales data aggregated from Ploomes API. Updated by CRON job every 6 hours via /api/cron/sync-customer-sales.';

-- Grant permissions (if needed for anon key access)
GRANT SELECT ON customer_sales TO anon;
GRANT SELECT ON customer_sales TO authenticated;
