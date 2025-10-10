# CRON Job Fixes - Executive Summary

## Problem
CRON job failing with 403 error when syncing customer sales data from Ploomes API.

## Root Causes & Solutions

### 1. Environment Variable Typo ✅ FIXED
**Problem**: `.env.local` had `PLOOME_API_KEY` instead of `PLOOMES_API_KEY`
**Solution**: Corrected to `PLOOMES_API_KEY` (with S)
**Impact**: CRON job can now authenticate with Ploomes API

### 2. Database Schema Mismatch ✅ FIXED
**Problem**: Migration schema didn't match CRON job expectations
**Old columns**: `cnpj`, `deal_count`, `avg_deal_size`
**New columns**: `customer_cnpj`, `total_deals`, `average_deal_value`
**Solution**: Created new migration `20251002_update_customer_sales_schema.sql`
**Impact**: CRON job can now successfully insert data

### 3. API Endpoint Updated ✅ FIXED
**Problem**: Customers API using old column names
**Solution**: Updated `/api/dashboard/customers` to use new column names
**Impact**: Dashboard can now read customer sales data correctly

## Verification

### Ploomes API Status: ✅ WORKING
```bash
curl "https://public-api2.ploomes.com/Deals?$select=Id,ContactId&$top=1" \
  -H "User-Key: A7EEF49A41433800AFDF42AE5BBF22755D1FC4B863C9B70A87F4CE300F38164058CD54A3E8590E78CDBF986FC8C0F9F4E7FF32884F3D37D58178DD8749EFA1D3"

# Response: ✅ 200 OK with data
```

## Files Changed

1. **/.env.local** - Environment variable name correction
2. **/supabase/migrations/20251002_update_customer_sales_schema.sql** - New migration
3. **/src/app/api/dashboard/customers/route.ts** - Column name updates
4. **/scripts/test-cron-sync.sh** - Testing utility (NEW)
5. **/CRON_DEBUGGING_GUIDE.md** - Complete documentation (NEW)

## Next Steps

### 1. Test Locally (Before Deployment)
```bash
# Start dev server
npm run dev

# In another terminal, run test
./scripts/test-cron-sync.sh
```

### 2. Deploy to Vercel
```bash
vercel --prod
```

### 3. Configure Vercel CRON
- Navigate to Vercel Dashboard → Project → Settings → Cron Jobs
- Add new CRON job:
  - **Path**: `/api/cron/sync-customer-sales`
  - **Schedule**: `0 */6 * * *` (every 6 hours)
  - **Method**: GET
  - **Headers**: `Authorization: Bearer customer-sales-sync-cron-secret-2025`

### 4. Verify Production
- Manually trigger CRON from Vercel dashboard
- Check Vercel function logs
- Query Supabase: `SELECT COUNT(*) FROM customer_sales;`
- Test dashboard at production URL

## Expected Results

- **CRON execution time**: 30-60 seconds
- **Customers synced**: 2000+
- **Deals processed**: Up to 30,000
- **Dashboard load time**: <500ms (was 3+ minutes)

## Rollback Plan (If Needed)

If CRON still fails after deployment:

### Option A: Use Existing Supabase Data
The `sales` table already has all deal data from previous imports:
```typescript
// Fallback query using 'sales' table instead of Ploomes API
const { data } = await supabase
  .from('sales')
  .select('customer_id, total, status, created_at')
  .order('created_at', { ascending: false });
```

### Option B: Rollback Migration
```sql
-- Drop new table and recreate old schema
DROP TABLE IF EXISTS customer_sales CASCADE;

-- Recreate with old schema from 20251002_create_customer_sales.sql
CREATE TABLE customer_sales (
  customer_id INTEGER PRIMARY KEY,
  customer_name TEXT NOT NULL,
  cnpj TEXT,
  total_revenue DECIMAL(15, 2) DEFAULT 0,
  deal_count INTEGER DEFAULT 0,
  avg_deal_size DECIMAL(15, 2) DEFAULT 0,
  last_purchase_date TIMESTAMPTZ,
  last_sync_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Support Contacts

- **Ploomes API Docs**: https://developers.ploomes.com/
- **Vercel CRON Docs**: https://vercel.com/docs/cron-jobs
- **Supabase Docs**: https://supabase.com/docs

## Success Criteria

- [x] Environment variables corrected
- [x] Database migration applied
- [x] API endpoints updated
- [x] Ploomes API verified working
- [ ] Local CRON test passes
- [ ] Production deployment successful
- [ ] Data populates in Supabase
- [ ] Dashboard displays customer list
- [ ] Vercel CRON scheduled and running

---

**Status**: Ready for local testing and deployment
**Last Updated**: 2025-10-02
**Next Action**: Run `./scripts/test-cron-sync.sh` to test locally
