# Dashboard Quick Start Guide

## 🎯 What Was Done

### ✅ Integration Complete
The dashboard module has been successfully integrated into the Next.js app.

### 📍 Access Point
```
http://localhost:3003/dashboard
```

## 🚀 Quick Start (3 Steps)

### Step 1: Environment Setup
Create `.env.local` in frontend-v0/:
```bash
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### Step 2: Database Setup
Run the migration in Supabase:
```sql
-- See DASHBOARD_SETUP.md for full SQL schema
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ploomes_product_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  price DECIMAL(10, 2),
  is_active BOOLEAN DEFAULT true
);

CREATE TABLE sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ploomes_deal_id TEXT NOT NULL,
  ploomes_product_id TEXT NOT NULL,
  total_amount DECIMAL(10, 2),
  sale_date TIMESTAMP WITH TIME ZONE
);
```

### Step 3: Initial Data Sync
```bash
cd frontend-v0
export PLOOMES_API_KEY=your-key
export SUPABASE_URL=your-url
export SUPABASE_SERVICE_KEY=your-service-key
node scripts/sync-dashboard-data.js
```

## 📁 Files Created

```
✅ src/app/dashboard/page.tsx          - Route integration
✅ src/lib/dashboard-api.ts             - API client
✅ scripts/sync-dashboard-data.js       - Data sync script
✅ tsconfig.json                        - Updated with @/features/* alias
✅ DASHBOARD_SETUP.md                   - Complete setup guide
✅ INTEGRATION_SUMMARY.md               - Technical details
```

## 🔧 Backend Requirements

You need to implement these API endpoints:

```javascript
GET  /api/dashboard/metrics            → Aggregate metrics
GET  /api/dashboard/customer-sales     → Customer sales data
GET  /api/dashboard/product-performance→ Product performance
GET  /api/dashboard/time-series        → Revenue over time
POST /api/dashboard/sync               → Trigger data sync
```

See `DASHBOARD_SETUP.md` for endpoint specifications.

## 🧪 Testing

```bash
# Type check
npm run type-check

# Start dev server
npm run dev

# Access dashboard
open http://localhost:3003/dashboard
```

## 📊 Features Available

- ✅ Metrics cards (Revenue, Avg Deal, Products, Customers)
- ✅ Product performance chart
- ✅ Customer sales table with sorting
- ✅ Date range filtering
- ✅ Manual data refresh
- ✅ Responsive design
- ✅ Authentication protected

## 🆘 Troubleshooting

### Dashboard not loading?
1. Check backend is running on port 3001
2. Verify you're logged in
3. Check browser console for errors

### No data showing?
1. Run the sync script
2. Check Supabase tables have data
3. Verify API endpoints are implemented

### Build errors?
```bash
npm run type-check  # Should pass with 0 errors
```

## 📚 Documentation

- **Complete Setup:** `DASHBOARD_SETUP.md`
- **Technical Details:** `INTEGRATION_SUMMARY.md`
- **API Reference:** `src/lib/dashboard-api.ts`

## ⚡ Next Actions

1. **Implement backend API endpoints** (see DASHBOARD_SETUP.md)
2. **Run database migration** (SQL in DASHBOARD_SETUP.md)
3. **Sync initial data** (`node scripts/sync-dashboard-data.js`)
4. **Test the dashboard** (`npm run dev` → visit /dashboard)
5. **Set up scheduled sync** (cron job or backend trigger)

---

**Status:** ✅ Frontend integration complete
**TypeScript:** ✅ 0 errors
**Ready for:** Backend API implementation