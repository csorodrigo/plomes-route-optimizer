# CRON Job Debugging Guide - Customer Sales Sync

## Issue Resolved

### Problem
CRON job at `/api/cron/sync-customer-sales` was failing with error 403 when calling Ploomes API.

### Root Causes Found

1. **Environment Variable Name Mismatch**
   - `.env.local` had `PLOOME_API_KEY` (without S)
   - Code expects `PLOOMES_API_KEY` (with S)
   - **Status**: ✅ FIXED

2. **Database Schema Mismatch**
   - Old migration had columns: `cnpj`, `deal_count`, `avg_deal_size`
   - CRON job inserts: `customer_cnpj`, `total_deals`, `average_deal_value`
   - **Status**: ✅ FIXED with new migration

3. **API Verification**
   - Ploomes API is working correctly
   - Successfully returns data with correct authentication
   - **Status**: ✅ VERIFIED

## Files Changed

### 1. Environment Variables (`.env.local`)
```diff
- PLOOME_API_KEY=A7EEF...
+ PLOOMES_API_KEY=A7EEF...
```

### 2. Database Migration (`supabase/migrations/20251002_update_customer_sales_schema.sql`)
Created new migration with complete schema:
- All sales metrics (total_sales, won_deals, open_deals, lost_deals)
- Product tracking (products_purchased array, total_products)
- Date metrics (first_purchase_date, last_purchase_date, days_since_last_purchase)
- Pricing metrics (has_custom_pricing, pricing_history_count)
- Proper indexes for performance

### 3. Customers API (`src/app/api/dashboard/customers/route.ts`)
Updated column mappings:
- `cnpj` → `customer_cnpj`
- `deal_count` → `total_deals`
- `avg_deal_size` → `average_deal_value`

## Testing

### Local Testing Script
```bash
# Make script executable (already done)
chmod +x scripts/test-cron-sync.sh

# Run the test
./scripts/test-cron-sync.sh
```

### Manual Testing with curl
```bash
# Test Ploomes API directly
curl "https://public-api2.ploomes.com/Deals?\$select=Id,ContactId&\$top=1" \
  -H "User-Key: $PLOOMES_API_KEY"

# Test CRON endpoint locally
curl -X GET "http://localhost:3000/api/cron/sync-customer-sales" \
  -H "Authorization: Bearer customer-sales-sync-cron-secret-2025"
```

### Production Testing (Vercel)
1. Deploy changes to Vercel
2. Manually trigger CRON job from Vercel dashboard
3. Check logs in Vercel Functions logs
4. Verify data in Supabase table `customer_sales`

## Verification Checklist

- [x] Environment variable renamed (`PLOOME_API_KEY` → `PLOOMES_API_KEY`)
- [x] Database migration applied with correct schema
- [x] Customers API updated with correct column names
- [x] Ploomes API tested and verified working
- [x] Test script created for local testing
- [ ] Local CRON test successful
- [ ] Production deployment successful
- [ ] Data appears in Supabase `customer_sales` table
- [ ] Dashboard shows customer data correctly

## Database Schema Reference

### customer_sales Table
```sql
customer_id INTEGER PRIMARY KEY
customer_name TEXT NOT NULL
customer_cnpj TEXT

-- Sales metrics
total_sales DECIMAL(15, 2)
total_deals INTEGER
won_deals INTEGER
open_deals INTEGER
lost_deals INTEGER
total_revenue DECIMAL(15, 2)
average_deal_value DECIMAL(15, 2)

-- Product metrics
products_purchased INTEGER[]
total_products INTEGER

-- Date metrics
first_purchase_date TIMESTAMPTZ
last_purchase_date TIMESTAMPTZ
days_since_last_purchase INTEGER

-- Pricing metrics
has_custom_pricing BOOLEAN
pricing_history_count INTEGER

-- System fields
last_sync_at TIMESTAMPTZ
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
```

## Troubleshooting

### If CRON still fails with 403
1. Check environment variable in Vercel:
   ```bash
   vercel env ls
   ```
2. Ensure `PLOOMES_API_KEY` (with S) is set in Vercel environment

### If schema errors occur
1. Apply migration manually:
   ```bash
   cat supabase/migrations/20251002_update_customer_sales_schema.sql | \
     psql $DATABASE_URL
   ```
2. Or use Supabase Dashboard → SQL Editor

### If data doesn't appear
1. Check CRON logs in Vercel dashboard
2. Verify `customer_sales` table exists: `SELECT * FROM customer_sales LIMIT 1;`
3. Check last sync time: `SELECT MAX(last_sync_at) FROM customer_sales;`

## Performance Notes

- CRON job processes up to 30,000 deals (100 pages × 300 deals)
- Expected execution time: 30-60 seconds for full sync
- Batch upsert: 500 records per batch
- Table indexed for fast dashboard queries

## Next Steps

1. Test locally with script: `./scripts/test-cron-sync.sh`
2. Deploy to Vercel
3. Configure Vercel CRON job:
   - URL: `/api/cron/sync-customer-sales`
   - Schedule: `0 */6 * * *` (every 6 hours)
   - Add environment variable: `CRON_SECRET=customer-sales-sync-cron-secret-2025`
4. Monitor first few CRON executions
5. Verify dashboard displays customer data

## Security Notes

- CRON endpoint protected by bearer token authentication
- Secret: `CRON_SECRET` environment variable
- Unauthorized requests return 401
- Use Supabase anon key (not service role) for better security

## Support

If issues persist:
1. Check Vercel function logs
2. Verify Ploomes API key validity
3. Confirm Supabase connection
4. Review migration history in Supabase
