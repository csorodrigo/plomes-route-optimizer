# CRON Job Quick Fix Checklist

## ✅ Completed Fixes

### 1. Environment Variable
- [x] Changed `PLOOME_API_KEY` to `PLOOMES_API_KEY` in `.env.local`
- [x] Verified Ploomes API is working with key

### 2. Database Schema
- [x] Created migration: `supabase/migrations/20251002_update_customer_sales_schema.sql`
- [x] Applied migration to Supabase database
- [x] Schema now matches CRON job expectations

### 3. API Endpoints
- [x] Updated `/api/dashboard/customers` column mappings
- [x] Changed `cnpj` → `customer_cnpj`
- [x] Changed `deal_count` → `total_deals`
- [x] Changed `avg_deal_size` → `average_deal_value`

### 4. Documentation & Testing
- [x] Created test script: `scripts/test-cron-sync.sh`
- [x] Created debugging guide: `CRON_DEBUGGING_GUIDE.md`
- [x] Created summary: `CRON_FIXES_SUMMARY.md`

## 🚀 Next Steps (Your Action Required)

### Step 1: Test Locally
```bash
# Start dev server (if not running)
npm run dev

# In another terminal, run test
./scripts/test-cron-sync.sh
```

**Expected output**:
- ✅ HTTP Status: 200
- ✅ Customers synced: 2000+
- ✅ Deals processed: up to 30k
- ✅ Execution time: 30-60s

### Step 2: Deploy to Production
```bash
vercel --prod
```

### Step 3: Configure Vercel CRON
1. Go to Vercel Dashboard → Your Project → Settings → Cron Jobs
2. Add new CRON job with these settings:
   - **Path**: `/api/cron/sync-customer-sales`
   - **Schedule**: `0 */6 * * *` (every 6 hours)
   - **Command**: (leave empty for API route)
   
3. Add environment variable (if not already set):
   - Key: `CRON_SECRET`
   - Value: `customer-sales-sync-cron-secret-2025`

4. Ensure `PLOOMES_API_KEY` is set in Vercel environment variables

### Step 4: Verify Production
1. Manually trigger CRON from Vercel dashboard
2. Check logs: Vercel → Functions → View logs
3. Verify data in Supabase:
   ```sql
   SELECT COUNT(*) FROM customer_sales;
   SELECT * FROM customer_sales LIMIT 5;
   ```
4. Test dashboard: Navigate to `/dashboard/customers`

## 🔍 Verification Commands

### Check Environment Variables
```bash
# Local
cat .env.local | grep PLOOMES

# Vercel
vercel env ls
```

### Check Database
```sql
-- Verify table structure
\d customer_sales

-- Check data
SELECT customer_name, total_revenue, total_deals 
FROM customer_sales 
ORDER BY total_revenue DESC 
LIMIT 10;

-- Check last sync
SELECT MAX(last_sync_at) FROM customer_sales;
```

### Test API Endpoints
```bash
# Test Ploomes API
curl "https://public-api2.ploomes.com/Deals?\$select=Id&\$top=1" \
  -H "User-Key: YOUR_KEY"

# Test CRON endpoint (local)
curl http://localhost:3000/api/cron/sync-customer-sales \
  -H "Authorization: Bearer customer-sales-sync-cron-secret-2025"

# Test customers API (local)
curl http://localhost:3000/api/dashboard/customers
```

## ⚠️ Troubleshooting

### If CRON returns 403
- Check `PLOOMES_API_KEY` is correct (with S, not PLOOME_API_KEY)
- Verify key in Vercel environment variables
- Test Ploomes API directly with curl

### If CRON returns 500 (database error)
- Ensure migration was applied: check Supabase → Database → Migrations
- Verify table exists: `SELECT * FROM customer_sales LIMIT 1;`
- Check column names match CRON job expectations

### If dashboard shows no data
- Run CRON manually first to populate data
- Check `customer_sales` table has records
- Verify `/api/dashboard/customers` returns data
- Check browser console for errors

## 📊 Expected Performance

| Metric | Before | After |
|--------|--------|-------|
| Dashboard load | 3+ minutes | <500ms |
| Data freshness | Real-time (slow) | 6-hour cache |
| Customer count | Limited | 2000+ |
| CRON execution | Failed | 30-60s |

## 📁 Files Summary

**Configuration**:
- `.env.local` - Environment variables (FIXED)

**Database**:
- `supabase/migrations/20251002_update_customer_sales_schema.sql` - Schema (NEW)

**API Routes**:
- `src/app/api/cron/sync-customer-sales/route.ts` - CRON job (uses fixed env)
- `src/app/api/dashboard/customers/route.ts` - Dashboard API (UPDATED)

**Testing & Docs**:
- `scripts/test-cron-sync.sh` - Test script (NEW)
- `CRON_DEBUGGING_GUIDE.md` - Full guide (NEW)
- `CRON_FIXES_SUMMARY.md` - Executive summary (NEW)
- `QUICK_FIX_CHECKLIST.md` - This file (NEW)

---

**Status**: ✅ Ready for testing and deployment
**Next**: Run `./scripts/test-cron-sync.sh`
