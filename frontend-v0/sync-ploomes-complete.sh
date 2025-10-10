#!/bin/bash

# Complete Ploomes to Supabase sync
# This script runs both steps sequentially:
# 1. Fetch all deals from Ploomes API (bypasses Supabase import issue)
# 2. Insert aggregated sales data into Supabase

echo "🔄 Starting complete Ploomes → Supabase sync..."
echo ""

# Step 1: Fetch from Ploomes
echo "📦 [STEP 1/2] Fetching deals from Ploomes API..."
node step1-fetch-ploomes.js

if [ $? -ne 0 ]; then
  echo "❌ Step 1 failed! Aborting..."
  exit 1
fi

echo ""
echo "✅ Step 1 complete!"
echo ""

# Step 2: Insert to Supabase
echo "💾 [STEP 2/2] Inserting sales data into Supabase..."
node step2-insert-supabase.js

if [ $? -ne 0 ]; then
  echo "❌ Step 2 failed! Check the error above."
  exit 1
fi

echo ""
echo "🎉 Complete sync finished successfully!"
echo ""
