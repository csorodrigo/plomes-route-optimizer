-- Create sales table for synced Ploomes deals
CREATE TABLE IF NOT EXISTS sales (
  id BIGSERIAL PRIMARY KEY,
  deal_id INTEGER UNIQUE NOT NULL,
  title TEXT,
  deal_value DECIMAL(15, 2) DEFAULT 0,
  customer_id INTEGER,
  customer_name TEXT,
  status TEXT DEFAULT 'open', -- open, won, lost
  stage_id INTEGER,
  products JSONB DEFAULT '[]'::jsonb, -- Products as JSONB array
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expected_close_date TIMESTAMP WITH TIME ZONE,
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_sales_customer_id ON sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_status ON sales(status);
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at);
CREATE INDEX IF NOT EXISTS idx_sales_deal_id ON sales(deal_id);

-- Create dashboard stats table
CREATE TABLE IF NOT EXISTS dashboard_stats (
  id INTEGER PRIMARY KEY DEFAULT 1,
  total_customers INTEGER DEFAULT 0,
  total_deals INTEGER DEFAULT 0,
  total_products INTEGER DEFAULT 0,
  last_sync TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create API cache table for caching responses
CREATE TABLE IF NOT EXISTS api_cache (
  key TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on expires_at for cleanup
CREATE INDEX IF NOT EXISTS idx_api_cache_expires_at ON api_cache(expires_at);

-- Function to cleanup expired cache entries
CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM api_cache WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Insert initial dashboard stats if not exists
INSERT INTO dashboard_stats (id, total_customers, total_deals, total_products)
VALUES (1, 0, 0, 0)
ON CONFLICT (id) DO NOTHING;