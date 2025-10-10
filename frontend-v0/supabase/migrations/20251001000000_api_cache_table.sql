-- API Cache Table for Performance Optimization
-- Stores cached API responses with automatic expiration

CREATE TABLE IF NOT EXISTS api_cache (
  key TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- Index for efficient cleanup of expired cache
CREATE INDEX idx_api_cache_expires_at ON api_cache(expires_at);

-- Function to automatically clean expired cache entries
CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM api_cache
  WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE api_cache IS 'Stores cached API responses for performance optimization';
COMMENT ON COLUMN api_cache.key IS 'Unique cache key identifier';
COMMENT ON COLUMN api_cache.data IS 'Cached response data in JSONB format';
COMMENT ON COLUMN api_cache.created_at IS 'When the cache entry was created';
COMMENT ON COLUMN api_cache.expires_at IS 'When the cache entry should expire';
