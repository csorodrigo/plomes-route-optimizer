#!/bin/bash

# Test script for CRON job sync-customer-sales
# This script simulates calling the CRON endpoint locally

set -e

# Load environment variables
source .env.local 2>/dev/null || echo "⚠️  No .env.local file found"

# Configuration
CRON_ENDPOINT="http://localhost:3000/api/cron/sync-customer-sales"
CRON_SECRET="${CRON_SECRET:-customer-sales-sync-cron-secret-2025}"

echo "🔄 Testing CRON Job: Customer Sales Sync"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📍 Endpoint: $CRON_ENDPOINT"
echo "🔑 Secret: ${CRON_SECRET:0:20}..."
echo ""
echo "⏳ Starting sync..."
echo ""

# Call the CRON endpoint
START_TIME=$(date +%s)

RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -X GET "$CRON_ENDPOINT" \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json")

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

# Extract HTTP status
HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS:" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | grep -v "HTTP_STATUS:")

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📊 Results:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "HTTP Status: $HTTP_STATUS"
echo "Duration: ${DURATION}s"
echo ""
echo "Response:"
echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
echo ""

# Check if successful
if [ "$HTTP_STATUS" -eq 200 ]; then
  echo "✅ CRON job completed successfully!"

  # Parse stats from response
  CUSTOMERS_SYNCED=$(echo "$BODY" | jq -r '.stats.customersSynced // 0' 2>/dev/null || echo "0")
  DEALS_PROCESSED=$(echo "$BODY" | jq -r '.stats.dealsProcessed // 0' 2>/dev/null || echo "0")
  EXEC_TIME=$(echo "$BODY" | jq -r '.stats.executionTime // 0' 2>/dev/null || echo "0")

  echo ""
  echo "📈 Statistics:"
  echo "  - Customers synced: $CUSTOMERS_SYNCED"
  echo "  - Deals processed: $DEALS_PROCESSED"
  echo "  - Execution time: ${EXEC_TIME}ms"

else
  echo "❌ CRON job failed with status $HTTP_STATUS"

  # Show error details
  ERROR_MSG=$(echo "$BODY" | jq -r '.error // "Unknown error"' 2>/dev/null || echo "Unknown error")
  echo ""
  echo "Error: $ERROR_MSG"
  exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🔍 Verifying data in Supabase..."
echo ""

# Query Supabase to verify data
echo "Sample customers from database:"
echo ""

# Simple curl to Supabase REST API
SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL:-https://yxwokryybudwygtemfmu.supabase.co}"
SUPABASE_KEY="${NEXT_PUBLIC_SUPABASE_ANON_KEY}"

CUSTOMERS=$(curl -s \
  "${SUPABASE_URL}/rest/v1/customer_sales?select=customer_name,total_revenue,total_deals&order=total_revenue.desc&limit=5" \
  -H "apikey: $SUPABASE_KEY" \
  -H "Authorization: Bearer $SUPABASE_KEY")

echo "$CUSTOMERS" | jq '.[] | "\(.customer_name): R$ \(.total_revenue) (\(.total_deals) deals)"' 2>/dev/null || echo "$CUSTOMERS"

echo ""
echo "✅ Test completed!"
