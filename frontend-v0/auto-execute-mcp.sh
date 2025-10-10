#!/bin/bash

# Auto-execute all 1,641 SQL updates via direct psql connection
# Using Supabase connection string

# Load environment variables
export $(cat .env.local | xargs)

# Supabase connection details
SUPABASE_URL="yxwokryybudwygtemfmu.supabase.co"
SUPABASE_DB="postgres"
SUPABASE_USER="postgres"
# Password from SUPABASE_DB_PASSWORD env var

echo "🚀 Starting automatic SQL execution via psql..."
echo "📊 Total updates: 1,641"
echo "🔗 Connecting to Supabase database..."

# Execute via psql
PGPASSWORD="$SUPABASE_DB_PASSWORD" psql \
  -h "$SUPABASE_URL" \
  -U "$SUPABASE_USER" \
  -d "$SUPABASE_DB" \
  -f FINAL-UPDATE-ALL.sql \
  -v ON_ERROR_STOP=1

if [ $? -eq 0 ]; then
  echo "✅ All 1,641 updates executed successfully!"

  # Verify
  echo "🔍 Verifying updates..."
  PGPASSWORD="$SUPABASE_DB_PASSWORD" psql \
    -h "$SUPABASE_URL" \
    -U "$SUPABASE_USER" \
    -d "$SUPABASE_DB" \
    -c "SELECT COUNT(*) as total_sales, COUNT(CASE WHEN products IS NOT NULL AND jsonb_array_length(products) > 0 THEN 1 END) as sales_with_products FROM sales;"
else
  echo "❌ Error executing SQL updates"
  exit 1
fi
