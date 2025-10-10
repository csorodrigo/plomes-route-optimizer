#!/bin/bash

# Quick status checker

echo "═══════════════════════════════════════════════════════════"
echo "📊 PRODUCT SYNC STATUS"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Check if sync is running
if pgrep -f "step4-fetch-products-ALL.js" > /dev/null; then
  echo "✅ Sync process: RUNNING"

  # Show progress
  if [ -f "products-fetch-progress.json" ]; then
    echo ""
    echo "📈 Progress:"
    node -e "
      const fs=require('fs');
      const p=JSON.parse(fs.readFileSync('products-fetch-progress.json'));
      const pct=((p.lastProcessedIndex+1)/10228*100).toFixed(1);
      console.log('   Processed: '+(p.lastProcessedIndex+1)+'/10228 ('+pct+'%)');
      console.log('   With products: '+p.stats.withProducts);
      console.log('   Total products: '+p.stats.totalProducts);
    " 2>/dev/null || echo "   Progress not available yet (first checkpoint at 100 deals)"
  fi

  # Show recent log
  echo ""
  echo "📝 Recent activity:"
  tail -5 products-sync.log | grep -E "Deal.*products|Stats:|^\[" | tail -3

else
  echo "⭕ Sync process: NOT RUNNING"

  # Check if completed
  if [ -f "ploomes-deals-with-products.json" ]; then
    echo ""
    echo "✅ Output file exists: ploomes-deals-with-products.json"

    # Count results
    DEALS_WITH_PRODUCTS=$(node -e "const fs=require('fs'); const deals=JSON.parse(fs.readFileSync('ploomes-deals-with-products.json')); console.log(deals.filter(d=>d.Products&&d.Products.length>0).length);")
    TOTAL_PRODUCTS=$(node -e "const fs=require('fs'); const deals=JSON.parse(fs.readFileSync('ploomes-deals-with-products.json')); console.log(deals.reduce((sum,d)=>(d.Products||[]).length+sum,0));")

    echo ""
    echo "📊 Final Results:"
    echo "   Deals with products: $DEALS_WITH_PRODUCTS"
    echo "   Total products: $TOTAL_PRODUCTS"
  else
    echo ""
    echo "⚠️  No output file found yet"
  fi
fi

echo ""

# Check if Supabase update has run
if [ -f "monitor.log" ]; then
  if grep -q "COMPLETE! Products updated" monitor.log; then
    echo "✅ Supabase: UPDATED"
  else
    echo "⏳ Supabase: PENDING"
  fi
else
  echo "⏳ Supabase: PENDING"
fi

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "Commands:"
echo "  tail -f products-sync.log  - Watch sync progress"
echo "  tail -f monitor.log        - Watch auto-updater"
echo "  ./check-status.sh          - Check status again"
echo "═══════════════════════════════════════════════════════════"
