# Dashboard Issues - Investigation Complete ✅

**Date**: 2025-10-01
**Status**: Root causes identified with concrete evidence
**Severity**: Critical - All three issues require immediate fixes

---

## 🔬 TEST RESULTS (Actual Data from Ploomes API)

### API Limits Discovered:
```
Total Contacts in Ploomes: 10,013
Total Deals in Ploomes:    19,448
API Max Records Per Call:  300 (NOT 1000, NOT 10000!)
Pagination Required:       YES - 34 batches for contacts
Document Field Access:     NO - 403 Forbidden
Date Range in Deals:       2023-2025 (3 years)
```

---

## 🚨 ISSUE #1: Customer Count Wrong (87 vs 10,013)

### Root Cause: TWO Problems
1. **Pagination Failure**: API returns max 300 records, but code requests 10,000
2. **Filter Logic**: Code only shows customers WITH sales, not all contacts

### Evidence:
```typescript
// Line 36: customers/route.ts
ploomesClient.getContacts({
  select: ['Id', 'Name', 'Document'],
  top: 10000  // ❌ Requests 10K but API caps at 300!
})

// Line 76-82: Only maps customers with sales
filteredSales.forEach((sale: any) => {
  const customerId = parseInt(sale.customer_id) || 0;
  const contact = contacts.find(c => c.Id === customerId);
  if (!contact) return;  // ❌ Ignores 9,713 contacts without sales!
});
```

### Impact:
- Shows only 87 customers (those with sales in Supabase)
- Missing 9,926 contacts from Ploomes (99.1% of data!)
- Users can't see complete customer list

### Fix Priority: **CRITICAL** 🔴

---

## 🚨 ISSUE #2: CNPJ Missing (Shows "-" for All)

### Root Cause: API Permission Denied

### Evidence from Test:
```bash
GET /Contacts?$select=Id,Name,Document
Response: 403 FORBIDDEN
Error: "No access to Document field"
```

### Code Has Fallback (Working as Designed):
```typescript
// Line 37-44: customers/route.ts
.catch(async () => {
  console.log('[CUSTOMERS API] ⚠️ Document field forbidden, trying without CNPJ');
  return ploomesClient.getContacts({
    select: ['Id', 'Name'],  // ✅ Falls back without Document
    top: 10000
  });
})
```

### Impact:
- All customers show "-" for CNPJ
- Cannot filter/search by CNPJ
- Compliance issues if CNPJ is required for business

### Options:
1. **Contact Ploomes Support**: Request Document field permission
2. **Remove CNPJ Column**: Hide from dashboard if not available
3. **Alternative Field**: Check if CNPJ stored in OtherProperties

### Fix Priority: **HIGH** 🟡 (Blocked by API permissions)

---

## 🚨 ISSUE #3: Sales Data Incomplete (Only 2023+, Missing History)

### Root Cause: Sync Script Limitations

### Evidence:
```javascript
// sync-dashboard-data.js Line 88:
$filter: 'StageId eq 3', // Only won deals
$top: 5000,              // ❌ LIMITED! Ploomes has 19,448 deals
$orderby: 'CreateDate desc',  // Gets most recent only
```

### Actual Data:
- Total deals in Ploomes: **19,448**
- Sync script limit: **5,000 deals**
- Missing: **14,448 deals** (74% of data!)
- Date range: 2023-2025 (only 3 years, but could have older data)

### Impact:
- Dashboard only shows recent sales
- Historical trends incomplete
- Revenue calculations wrong

### Fix Priority: **CRITICAL** 🔴

---

## 📊 DETAILED FINDINGS

### Ploomes API Behavior:
```
Request:  $top=10000
Returns:  300 records (API hard limit)
Expected: Need pagination with $skip

Request:  $top=1000
Returns:  300 records (same limit)

Request:  $top=300
Returns:  300 records ✅
```

**Conclusion**: Ploomes API has 300 records/request limit, NOT 1000!

### Pagination Required:
```
Total contacts: 10,013
Records per call: 300
Batches needed: 34 batches
Time estimate: ~34 seconds (1 sec per batch)

Total deals: 19,448
Records per call: 300
Batches needed: 65 batches
Time estimate: ~65 seconds (1 sec per batch)
```

---

## 🔧 FIXES REQUIRED

### Fix #1: Implement Pagination for Contacts (CRITICAL)

**File**: `/src/lib/ploomes-client.ts`

Add pagination helper:
```typescript
async fetchAllContacts(options: {
  select?: string[];
  expand?: string[];
  filter?: string;
}): Promise<PloomesContact[]> {
  const allContacts: PloomesContact[] = [];
  const batchSize = 300; // Ploomes max
  let skip = 0;
  let hasMore = true;

  console.log('[PLOOMES] Fetching all contacts with pagination...');

  while (hasMore) {
    const batch = await this.getContacts({
      ...options,
      top: batchSize,
      skip
    });

    allContacts.push(...batch);
    hasMore = batch.length === batchSize;
    skip += batchSize;

    console.log(`[PLOOMES] Fetched ${allContacts.length} contacts...`);

    // Safety: stop at 50K
    if (allContacts.length >= 50000) break;
  }

  console.log(`[PLOOMES] ✅ Total contacts fetched: ${allContacts.length}`);
  return allContacts;
}
```

**Update**: `/src/app/api/dashboard/customers/route.ts`

```typescript
// OLD (Line 34):
const [contactsResult, salesResult] = await Promise.all([
  ploomesClient.getContacts({
    select: ['Id', 'Name', 'Document'],
    top: 10000  // ❌ Only gets 300!
  }),
  // ...
]);

// NEW:
const [contacts, salesResult] = await Promise.all([
  ploomesClient.fetchAllContacts({
    select: ['Id', 'Name']  // Remove Document (403 forbidden)
  }),
  supabase.from('sales').select('*')
]);
```

**Result**: Will fetch all 10,013 contacts instead of 300 ✅

---

### Fix #2: Show ALL Contacts (Not Just With Sales)

**File**: `/src/app/api/dashboard/customers/route.ts`

```typescript
// OLD (Line 76-106): Only processes customers with sales

// NEW: Map ALL contacts first, then add sales data
const sales = salesResult.data || [];

// Build sales map
const customerSalesMap = new Map();
filteredSales.forEach((sale: any) => {
  const customerId = parseInt(sale.customer_id) || 0;
  if (!customerId) return;

  const existing = customerSalesMap.get(customerId) || {
    totalRevenue: 0,
    dealCount: 0,
    lastPurchaseDate: null
  };

  existing.totalRevenue += parseFloat(sale.deal_value) || 0;
  existing.dealCount += 1;
  if (!existing.lastPurchaseDate || sale.created_at > existing.lastPurchaseDate) {
    existing.lastPurchaseDate = sale.created_at;
  }

  customerSalesMap.set(customerId, existing);
});

// Map ALL contacts (whether they have sales or not)
let customerSales: CustomerSale[] = contacts.map(contact => {
  const salesData = customerSalesMap.get(contact.Id) || {
    totalRevenue: 0,
    dealCount: 0,
    lastPurchaseDate: null
  };

  return {
    customerId: contact.Id.toString(),
    customerName: contact.Name || 'Unknown Customer',
    cnpj: '-', // Removed Document field due to 403
    totalRevenue: salesData.totalRevenue,
    dealCount: salesData.dealCount,
    avgDealSize: salesData.dealCount > 0
      ? salesData.totalRevenue / salesData.dealCount
      : 0,
    lastPurchaseDate: salesData.lastPurchaseDate || null
  };
});

// Sort by total revenue (highest first)
customerSales.sort((a, b) => b.totalRevenue - a.totalRevenue);
```

**Result**: Will show all 10,013 customers instead of 87 ✅

---

### Fix #3: Batch Sync All Deals with Pagination

**File**: Create `/scripts/sync-all-deals-paginated.js`

```javascript
#!/usr/bin/env node

/**
 * Sync ALL deals from Ploomes with proper pagination
 * Handles 19,448 deals in batches of 300
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

const PLOOMES_API_KEY = process.env.PLOOME_API_KEY || process.env.PLOOMES_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const ploomesApi = axios.create({
  baseURL: 'https://public-api2.ploomes.com',
  headers: {
    'User-Key': PLOOMES_API_KEY,
    'Content-Type': 'application/json',
  },
  timeout: 60000,
});

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function syncAllDeals() {
  console.log('🚀 Starting FULL deal sync with pagination...\n');

  const batchSize = 300; // Ploomes API limit
  let skip = 0;
  let hasMore = true;
  let totalSynced = 0;
  let totalProcessed = 0;

  while (hasMore) {
    console.log(`\n📦 Fetching batch ${Math.floor(skip / batchSize) + 1}...`);
    console.log(`   Skip: ${skip}, Top: ${batchSize}`);

    try {
      const response = await ploomesApi.get('/Deals', {
        params: {
          $select: 'Id,Title,Amount,StageId,ContactId,CreateDate,StatusId',
          $expand: 'Products($select=ProductId,ProductName,Quantity,UnitValue)',
          $top: batchSize,
          $skip: skip,
          $orderby: 'CreateDate desc'
        }
      });

      const deals = response.data.value || [];
      totalProcessed += deals.length;

      console.log(`   ✅ Received ${deals.length} deals`);

      if (deals.length === 0) {
        console.log('   ℹ️  No more deals to fetch');
        break;
      }

      // Transform and save to Supabase
      const salesData = deals.map(deal => ({
        ploomes_deal_id: deal.Id.toString(),
        customer_id: deal.ContactId?.toString() || null,
        deal_stage: deal.StageId?.toString() || 'unknown',
        deal_value: deal.Amount || 0,
        status: deal.StatusId === 3 ? 'won' : deal.StatusId === 2 ? 'lost' : 'open',
        products: (deal.Products || []).map(p => ({
          product_id: p.ProductId,
          product_name: p.ProductName || 'Unknown',
          quantity: p.Quantity || 1,
          unit_price: p.UnitValue || 0,
          total: (p.Quantity || 1) * (p.UnitValue || 0)
        })),
        created_at: deal.CreateDate || new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));

      // Upsert to Supabase (insert or update on conflict)
      const { error, count } = await supabase
        .from('sales')
        .upsert(salesData, {
          onConflict: 'ploomes_deal_id'
        });

      if (error) {
        console.error('   ❌ Supabase error:', error.message);
      } else {
        totalSynced += salesData.length;
        console.log(`   ✅ Saved ${salesData.length} deals to Supabase`);
        console.log(`   📊 Progress: ${totalSynced} / 19,448 deals (${((totalSynced / 19448) * 100).toFixed(1)}%)`);
      }

      // Check if we should continue
      hasMore = deals.length === batchSize;
      skip += batchSize;

      // Rate limiting: pause between batches
      if (hasMore) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }

    } catch (error) {
      console.error('   ❌ Error:', error.message);

      // Continue with next batch on error
      skip += batchSize;
      hasMore = totalProcessed < 19448;
    }
  }

  console.log('\n\n✅ Sync completed!');
  console.log(`   Total processed: ${totalProcessed}`);
  console.log(`   Total synced: ${totalSynced}`);
  console.log(`   Success rate: ${((totalSynced / totalProcessed) * 100).toFixed(1)}%`);
}

syncAllDeals().catch(error => {
  console.error('\n💥 Fatal error:', error);
  process.exit(1);
});
```

**Result**: Will sync all 19,448 deals instead of 5,000 ✅

---

### Fix #4: Remove CNPJ Column (Temporary Solution)

**File**: `/features/modulo-dashboard/components/CustomerSalesTable.tsx`

```typescript
// Remove CNPJ column from table definition
const columns = [
  { key: 'customerName', label: 'Customer' },
  // { key: 'cnpj', label: 'CNPJ' },  // ❌ Remove - API forbidden
  { key: 'totalRevenue', label: 'Revenue' },
  { key: 'dealCount', label: 'Deals' },
  { key: 'avgDealSize', label: 'Avg Deal' },
  { key: 'lastPurchaseDate', label: 'Last Purchase' }
];
```

**Alternative**: Request Document field permission from Ploomes support

---

## 📋 IMPLEMENTATION CHECKLIST

### Phase 1: Quick Wins (1-2 hours)
- [ ] Add `fetchAllContacts()` helper to ploomes-client.ts
- [ ] Update customers API to use pagination
- [ ] Update metrics API to use pagination
- [ ] Remove CNPJ column from dashboard table
- [ ] Test locally with dev environment

### Phase 2: Data Sync (2-3 hours)
- [ ] Create sync-all-deals-paginated.js script
- [ ] Run initial full sync (expect ~65 minutes)
- [ ] Verify all 19,448 deals in Supabase
- [ ] Check date range coverage (2023-2025)
- [ ] Add sync script to cron/scheduled jobs

### Phase 3: Validation (1 hour)
- [ ] Test dashboard shows 10,013 customers
- [ ] Verify sales data from all years visible
- [ ] Check performance with full dataset
- [ ] Update documentation
- [ ] Deploy to production

### Phase 4: Future Improvements
- [ ] Request Document field access from Ploomes
- [ ] Add caching layer for contact data
- [ ] Implement incremental sync (only new deals)
- [ ] Add progress indicators for long operations

---

## 🎯 EXPECTED RESULTS AFTER FIXES

```
Before:
- Customers: 87 shown (out of 10,013)
- CNPJ: "-" for all
- Sales: Only recent deals (5,000 max)
- Data completeness: ~5%

After:
- Customers: 10,013 shown (100%)
- CNPJ: Removed (blocked by API) or "-" if permission granted
- Sales: All 19,448 deals synced
- Data completeness: 100%
```

---

## 📞 NEXT ACTIONS

1. **Implement pagination** (highest priority)
2. **Run full deal sync** (run overnight if needed)
3. **Remove CNPJ column** or request API permissions
4. **Test with real data**
5. **Deploy to production**
6. **Monitor performance**

---

## 🔍 FILES AFFECTED

```
Frontend:
- /src/lib/ploomes-client.ts (add pagination)
- /src/app/api/dashboard/customers/route.ts (use pagination + show all)
- /src/app/api/dashboard/metrics/route.ts (use pagination)
- /features/modulo-dashboard/components/CustomerSalesTable.tsx (remove CNPJ)

Scripts:
- /scripts/sync-all-deals-paginated.js (NEW - full sync with pagination)
- /scripts/test-ploomes-limits.js (NEW - testing tool)

Documentation:
- /claudedocs/DASHBOARD_DEBUG_REPORT.md (detailed investigation)
- /claudedocs/DASHBOARD_ISSUES_SUMMARY.md (this file)
```

---

**Investigation Status**: ✅ **COMPLETE**
**Implementation Status**: 🚧 **READY TO START**
**Time Estimate**: 4-6 hours total implementation + sync time
