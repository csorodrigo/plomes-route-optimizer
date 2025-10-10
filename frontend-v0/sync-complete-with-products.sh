#!/bin/bash

# Complete sync workflow with products
# Usage: ./sync-complete-with-products.sh

echo "🚀 Starting complete Ploomes sync with products..."
echo ""

# Step 1: Fetch deals with products from Ploomes
echo "📦 [STEP 1] Fetching deals with products from Ploomes API..."
node step1-fetch-ploomes.js
if [ $? -ne 0 ]; then
    echo "❌ Step 1 failed!"
    exit 1
fi
echo ""

# Step 2: Aggregate sales by customer
echo "📊 [STEP 2] Aggregating sales by customer..."
node step2-insert-supabase.js
if [ $? -ne 0 ]; then
    echo "❌ Step 2 failed!"
    exit 1
fi
echo ""

# Step 3: Insert individual sales with products
echo "💾 [STEP 3] Inserting individual sales with products..."
node step3-insert-sales.js
if [ $? -ne 0 ]; then
    echo "❌ Step 3 failed!"
    exit 1
fi
echo ""

echo "✅ Complete sync finished successfully!"
echo ""
echo "📋 Summary:"
echo "  - Deals fetched from Ploomes (with products)"
echo "  - Customer sales aggregated"
echo "  - Individual sales inserted (with product details)"
echo ""
echo "🎯 Next: Check dashboard to verify product data"
