-- Create customer_sales table for pre-calculated sales data
-- This table is populated by a CRON job that aggregates Ploomes deals

CREATE TABLE IF NOT EXISTS customer_sales (
  customer_id INTEGER PRIMARY KEY,
  customer_name TEXT NOT NULL,
  cnpj TEXT,
  total_revenue DECIMAL(15, 2) DEFAULT 0,
  deal_count INTEGER DEFAULT 0,
  avg_deal_size DECIMAL(15, 2) DEFAULT 0,
  last_purchase_date TIMESTAMPTZ,
  last_sync_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_customer_sales_revenue ON customer_sales(total_revenue DESC);
CREATE INDEX IF NOT EXISTS idx_customer_sales_customer_name ON customer_sales(customer_name);
CREATE INDEX IF NOT EXISTS idx_customer_sales_last_sync ON customer_sales(last_sync_at);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_customer_sales_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS customer_sales_updated_at ON customer_sales;
CREATE TRIGGER customer_sales_updated_at
  BEFORE UPDATE ON customer_sales
  FOR EACH ROW
  EXECUTE FUNCTION update_customer_sales_updated_at();

-- Add comment
COMMENT ON TABLE customer_sales IS 'Pre-calculated sales data aggregated from Ploomes. Updated by CRON job every 6 hours.';
