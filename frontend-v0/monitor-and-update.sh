#!/bin/bash

# Monitor product sync and auto-update Supabase when complete

LOG_FILE="products-sync.log"
PROGRESS_FILE="products-fetch-progress.json"
CHECK_INTERVAL=120  # 2 minutes

echo "🔍 Monitoring product sync..."
echo "   Log: $LOG_FILE"
echo "   Checking every $CHECK_INTERVAL seconds"
echo ""

while true; do
  # Check if process is still running
  if ! pgrep -f "step4-fetch-products-ALL.js" > /dev/null; then
    echo ""
    echo "✅ Sync process completed!"
    echo ""

    # Show final results
    echo "📊 Final Results:"
    tail -20 "$LOG_FILE"
    echo ""

    # Check if we have the output file
    if [ -f "ploomes-deals-with-products.json" ]; then
      echo "✅ Found ploomes-deals-with-products.json"

      # Count deals with products
      DEALS_WITH_PRODUCTS=$(node -e "const fs=require('fs'); const deals=JSON.parse(fs.readFileSync('ploomes-deals-with-products.json')); console.log(deals.filter(d=>d.Products&&d.Products.length>0).length);")

      echo "📦 Deals with products: $DEALS_WITH_PRODUCTS"
      echo ""

      if [ "$DEALS_WITH_PRODUCTS" -gt 0 ]; then
        echo "🚀 Starting Supabase update..."
        echo ""
        node step5-update-supabase-products.js

        if [ $? -eq 0 ]; then
          echo ""
          echo "✅ COMPLETE! Products updated in Supabase"
          echo "🎯 Check dashboard to verify products are displaying"
        else
          echo ""
          echo "❌ Supabase update failed. Check logs above."
        fi
      else
        echo "⚠️  No products found to update"
      fi
    else
      echo "❌ Output file not found. Check if sync completed successfully."
      tail -50 "$LOG_FILE"
    fi

    break
  fi

  # Show current progress
  echo "[$(date +'%H:%M:%S')] Sync running..."

  if [ -f "$PROGRESS_FILE" ]; then
    PROGRESS=$(cat "$PROGRESS_FILE" | node -e "const fs=require('fs'); const p=JSON.parse(fs.readFileSync('/dev/stdin')); console.log('Processed: '+(p.lastProcessedIndex+1)+' | With products: '+p.stats.withProducts+' | Total products: '+p.stats.totalProducts);")
    echo "   $PROGRESS"
  fi

  # Show last few lines
  tail -3 "$LOG_FILE" | grep -E "^\[|Deal.*products|Stats:"
  echo ""

  sleep $CHECK_INTERVAL
done

echo ""
echo "🏁 Monitor finished"
