ALTER TABLE customers ADD COLUMN IF NOT EXISTS owner_id bigint;
CREATE INDEX IF NOT EXISTS idx_customers_owner_id ON customers(owner_id);
