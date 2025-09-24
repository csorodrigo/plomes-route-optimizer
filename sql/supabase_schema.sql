-- Supabase Schema for PLOMES-ROTA-CEP
-- Database tables and functions for permanent storage

-- Enable RLS (Row Level Security)
ALTER DATABASE postgres SET "app.environment" = 'production';

-- Create customers table
CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    ploome_person_id TEXT NOT NULL,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    address TEXT,
    cep TEXT,
    city TEXT,
    state TEXT,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    geocoding_status TEXT DEFAULT 'pending',
    geocoded_address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create geocoding_stats table
CREATE TABLE IF NOT EXISTS geocoding_stats (
    id TEXT PRIMARY KEY DEFAULT 'global',
    total_processed INTEGER DEFAULT 0,
    total_geocoded INTEGER DEFAULT 0,
    total_failed INTEGER DEFAULT 0,
    total_skipped INTEGER DEFAULT 0,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create batch_logs table
CREATE TABLE IF NOT EXISTS batch_logs (
    batch_id TEXT PRIMARY KEY,
    completed_at TIMESTAMP WITH TIME ZONE,
    batch_size INTEGER,
    skip_count INTEGER,
    processed INTEGER DEFAULT 0,
    geocoded INTEGER DEFAULT 0,
    failed INTEGER DEFAULT 0,
    skipped INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create generic key_value_store table for backward compatibility
CREATE TABLE IF NOT EXISTS key_value_store (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_customers_ploome_id ON customers(ploome_person_id);
CREATE INDEX IF NOT EXISTS idx_customers_cep ON customers(cep);
CREATE INDEX IF NOT EXISTS idx_customers_city ON customers(city);
CREATE INDEX IF NOT EXISTS idx_customers_geocoded ON customers(latitude, longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
CREATE INDEX IF NOT EXISTS idx_customers_geocoding_status ON customers(geocoding_status);
CREATE INDEX IF NOT EXISTS idx_key_value_expires ON key_value_store(expires_at) WHERE expires_at IS NOT NULL;

-- Function to create customers table if not exists (for RPC calls)
CREATE OR REPLACE FUNCTION create_customers_table_if_not_exists()
RETURNS BOOLEAN AS $$
BEGIN
    -- Table creation is handled by the schema above
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to create geocoding_stats table if not exists (for RPC calls)
CREATE OR REPLACE FUNCTION create_geocoding_stats_table_if_not_exists()
RETURNS BOOLEAN AS $$
BEGIN
    -- Insert default record if not exists
    INSERT INTO geocoding_stats (id)
    VALUES ('global')
    ON CONFLICT (id) DO NOTHING;
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to create batch_logs table if not exists (for RPC calls)
CREATE OR REPLACE FUNCTION create_batch_logs_table_if_not_exists()
RETURNS BOOLEAN AS $$
BEGIN
    -- Table creation is handled by the schema above
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to clean expired key-value entries
CREATE OR REPLACE FUNCTION cleanup_expired_keys()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM key_value_store
    WHERE expires_at IS NOT NULL AND expires_at < NOW();

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get customer statistics
CREATE OR REPLACE FUNCTION get_customer_statistics()
RETURNS JSON AS $$
DECLARE
    total_customers INTEGER;
    geocoded_customers INTEGER;
    pending_customers INTEGER;
    geocoding_rate DECIMAL;
BEGIN
    SELECT COUNT(*) INTO total_customers FROM customers;

    SELECT COUNT(*) INTO geocoded_customers
    FROM customers
    WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

    pending_customers := total_customers - geocoded_customers;

    IF total_customers > 0 THEN
        geocoding_rate := ROUND((geocoded_customers::DECIMAL / total_customers::DECIMAL) * 100, 2);
    ELSE
        geocoding_rate := 0;
    END IF;

    RETURN json_build_object(
        'total', total_customers,
        'geocoded', geocoded_customers,
        'pending', pending_customers,
        'geocoding_rate', geocoding_rate,
        'timestamp', NOW()
    );
END;
$$ LANGUAGE plpgsql;

-- Function to update geocoding statistics
CREATE OR REPLACE FUNCTION update_geocoding_stats(
    processed INTEGER DEFAULT 0,
    geocoded INTEGER DEFAULT 0,
    failed INTEGER DEFAULT 0,
    skipped INTEGER DEFAULT 0
)
RETURNS BOOLEAN AS $$
BEGIN
    INSERT INTO geocoding_stats (
        id,
        total_processed,
        total_geocoded,
        total_failed,
        total_skipped,
        last_updated
    ) VALUES (
        'global',
        processed,
        geocoded,
        failed,
        skipped,
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        total_processed = geocoding_stats.total_processed + excluded.total_processed,
        total_geocoded = geocoding_stats.total_geocoded + excluded.total_geocoded,
        total_failed = geocoding_stats.total_failed + excluded.total_failed,
        total_skipped = geocoding_stats.total_skipped + excluded.total_skipped,
        last_updated = excluded.last_updated,
        updated_at = NOW();

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply update triggers
CREATE TRIGGER update_customers_updated_at
    BEFORE UPDATE ON customers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_geocoding_stats_updated_at
    BEFORE UPDATE ON geocoding_stats
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS policies (adjust as needed for your security requirements)
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE geocoding_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE batch_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE key_value_store ENABLE ROW LEVEL SECURITY;

-- Create policies for service role (full access)
CREATE POLICY "Service role can do everything on customers" ON customers
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role can do everything on geocoding_stats" ON geocoding_stats
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role can do everything on batch_logs" ON batch_logs
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role can do everything on key_value_store" ON key_value_store
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Public access policies (for anon users - adjust as needed)
CREATE POLICY "Allow public read on customers" ON customers
    FOR SELECT USING (true);

CREATE POLICY "Allow public read on geocoding_stats" ON geocoding_stats
    FOR SELECT USING (true);

-- Insert initial geocoding stats record
INSERT INTO geocoding_stats (id) VALUES ('global') ON CONFLICT (id) DO NOTHING;