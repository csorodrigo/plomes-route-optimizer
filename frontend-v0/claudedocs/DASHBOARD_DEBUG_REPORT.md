# Dashboard Data Issues - Debug Report
**Date**: 2025-10-01
**Status**: Critical data synchronization issues identified

---

## 🚨 CRITICAL ISSUES IDENTIFIED

### 1. Customer Count Wrong (87 vs 2000+ Expected)

**Location**: `/src/app/api/dashboard/customers/route.ts` Line 36
**Root Cause**: ONLY showing customers that have sales records

```typescript
// LINE 36: Fetching contacts with $top=10000
const [contactsResult, salesResult] = await Promise.all([
  ploomesClient.getContacts({
    select: ['Id', 'Name', 'Document'],
    top: 10000  // ✅ This is correct - fetches up to 10K contacts
  }),
  supabase.from('sales').select('*')
]);
```

**The Problem**:
```typescript
// LINE 76-106: Filtering logic only includes customers WITH sales
filteredSales.forEach((sale: any) => {
  const customerId = parseInt(sale.customer_id) || 0;
  if (!customerId) return;

  const contact = contacts.find(c => c.Id === customerId);
  if (!contact) return;  // ❌ Only maps customers that have sales!

  customerMap.set(customerId, { ... });
});
```

**Evidence**:
- API fetches 10,000 contacts correctly ✅
- But only shows customers that exist in `sales` table ❌
- If Supabase `sales` table only has 87 unique customers → dashboard shows 87
- Missing: 1,913 customers with NO sales records

**Fix Required**:
```typescript
// Option A: Show ALL contacts from Ploomes (with zero sales if needed)
const allCustomersData = contacts.map(contact => {
  const customerSales = sales.filter(s => s.customer_id === contact.Id);
  return {
    customerId: contact.Id,
    customerName: contact.Name,
    cnpj: contact.Document || '-',
    totalRevenue: customerSales.reduce((sum, s) => sum + parseFloat(s.deal_value), 0),
    dealCount: customerSales.length,
    avgDealSize: customerSales.length > 0 ? totalRevenue / customerSales.length : 0,
    lastPurchaseDate: customerSales.length > 0 ? Math.max(...customerSales.map(s => s.created_at)) : null
  };
});

// Option B: Add toggle to show "only customers with sales" vs "all customers"
```

---

### 2. CNPJ Missing - Shows "-" Despite API Permissions

**Location**: `/src/app/api/dashboard/customers/route.ts` Line 35-44
**Status**: Graceful fallback implemented, but may be unnecessary

```typescript
// LINE 33-44: Fallback logic for Document field
const [contactsResult, salesResult] = await Promise.all([
  ploomesClient.getContacts({
    select: ['Id', 'Name', 'Document'], // Document = CNPJ/CPF
    top: 10000
  }).catch(async () => {
    // ⚠️ If Document fails, try without it
    console.log('[CUSTOMERS API] ⚠️ Document field forbidden, trying without CNPJ');
    return ploomesClient.getContacts({
      select: ['Id', 'Name'],
      top: 10000
    });
  }),
```

**Testing Needed**:
1. Check if `Document` field is actually returning data or hitting the catch block
2. User says API has full permissions - verify with test call:
```bash
curl -H "User-Key: $PLOOMES_API_KEY" \
  "https://public-api2.ploomes.com/Contacts?\$top=5&\$select=Id,Name,Document"
```

3. Check production logs for warning: `"Document field forbidden"`

**Possible Causes**:
- Field permission issue (403 error)
- Field doesn't exist in some contacts (null/undefined)
- API returning empty Document for companies without CNPJ

**Fix Required**:
- Test Document field access directly
- If working: remove unnecessary catch block
- If failing: investigate Ploomes API permissions
- Add better logging to distinguish between "field forbidden" vs "field empty"

---

### 3. Sales Data Incomplete - Only 2023 Visible

**Location**: Multiple sync scripts and API filtering
**Root Cause**: Likely insufficient data sync from Ploomes

**Evidence from Sync Scripts**:

1. **sync-dashboard-data.js** Line 88:
```javascript
$filter: 'StageId eq 3', // Only won deals
$top: 5000,  // ⚠️ LIMITED TO 5000 DEALS
$orderby: 'CreateDate desc',  // Most recent first
```

2. **sync-sales.js** Line 32-48:
```javascript
// Batch sync with pagination
let skip = 0;
const batchSize = 100;  // ⚠️ Small batch size

while (hasMore) {
  const response = await ploomeService.fetchDeals({
    skip,
    top: batchSize
  });
  // ... but no date filtering!
}
```

**The Problem**:
- `sync-dashboard-data.js` limits to 5000 deals total
- If user has >5000 deals, only gets most recent 5000
- No date range filtering = gets whatever fits in limit
- "Only 2023 visible" suggests older data wasn't synced

**Testing**:
```sql
-- Check Supabase sales table date ranges
SELECT
  COUNT(*) as total_sales,
  MIN(created_at) as earliest_sale,
  MAX(created_at) as latest_sale,
  COUNT(DISTINCT customer_id) as unique_customers,
  COUNT(DISTINCT EXTRACT(YEAR FROM created_at)) as years_with_data
FROM sales;

-- Check year distribution
SELECT
  EXTRACT(YEAR FROM created_at) as year,
  COUNT(*) as sales_count,
  SUM(deal_value) as total_revenue
FROM sales
GROUP BY EXTRACT(YEAR FROM created_at)
ORDER BY year DESC;
```

**Fix Required**: Implement batch sync by date ranges

```javascript
// NEW: Batch sync by year to ensure complete data
async function syncAllSalesWithDateRanges() {
  const currentYear = new Date().getFullYear();
  const startYear = 2020; // Or earliest year in Ploomes

  for (let year = startYear; year <= currentYear; year++) {
    const startDate = `${year}-01-01T00:00:00Z`;
    const endDate = `${year}-12-31T23:59:59Z`;

    console.log(`Syncing year ${year}...`);

    let skip = 0;
    let hasMore = true;

    while (hasMore) {
      const response = await ploomeService.fetchDeals({
        skip,
        top: 500,
        filter: `CreateDate ge ${startDate} and CreateDate le ${endDate}`
      });

      // Process batch...
      skip += 500;
      hasMore = response.value.length === 500;
    }
  }
}
```

---

## 📊 PLOOMES API LIMITS INVESTIGATION

**From Code Analysis**:
- `/src/lib/ploomes-client.ts` supports `$top` parameter (no hardcoded limit)
- `/src/app/api/dashboard/customers/route.ts` uses `top: 10000` ✅
- `/src/app/api/dashboard/metrics/route.ts` uses `top: 10000` ✅

**Ploomes API Documentation**:
- Default `$top`: 25 results
- Max `$top`: Typically 1000 per request
- For >1000 records: Must use `$skip` pagination

**Current Implementation Issues**:
1. ❌ No pagination in customer/metrics APIs
2. ❌ `top: 10000` likely gets capped at 1000 by Ploomes
3. ❌ No error handling if data is truncated
4. ❌ No indication to user that data is incomplete

**Testing Needed**:
```bash
# Test 1: Check if $top=10000 works or gets capped
curl -s -H "User-Key: $PLOOMES_API_KEY" \
  "https://public-api2.ploomes.com/Contacts?\$top=10000&\$count=true" \
  | jq '.["@odata.count"], (.value | length)'

# Test 2: Get total count
curl -s -H "User-Key: $PLOOMES_API_KEY" \
  "https://public-api2.ploomes.com/Contacts?\$count=true&\$top=0" \
  | jq '.["@odata.count"]'

# Test 3: Check deal count
curl -s -H "User-Key: $PLOOMES_API_KEY" \
  "https://public-api2.ploomes.com/Deals?\$count=true&\$top=0" \
  | jq '.["@odata.count"]'
```

---

## 🔧 RECOMMENDED FIXES

### Priority 1: Fix Customer Count (Immediate)

**File**: `/src/app/api/dashboard/customers/route.ts`

```typescript
// AFTER Line 52: Instead of only mapping customers with sales

// Option 1: Show all contacts (with zero sales if needed)
const customerSalesMap = new Map();

// First, aggregate sales by customer
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

// Then, map ALL contacts (whether they have sales or not)
let customerSales: CustomerSale[] = contacts.map(contact => {
  const salesData = customerSalesMap.get(contact.Id) || {
    totalRevenue: 0,
    dealCount: 0,
    lastPurchaseDate: null
  };

  return {
    customerId: contact.Id.toString(),
    customerName: contact.Name || 'Unknown Customer',
    cnpj: contact.Document || '-',
    totalRevenue: salesData.totalRevenue,
    dealCount: salesData.dealCount,
    avgDealSize: salesData.dealCount > 0 ? salesData.totalRevenue / salesData.dealCount : 0,
    lastPurchaseDate: salesData.lastPurchaseDate || new Date().toISOString()
  };
});

// Sort by total revenue (or filter to show only customers with sales if needed)
customerSales.sort((a, b) => b.totalRevenue - a.totalRevenue);
```

### Priority 2: Implement Pagination for Large Datasets

**File**: `/src/lib/ploomes-client.ts` - Add pagination helper

```typescript
/**
 * Fetch all records with automatic pagination
 */
async fetchAllContacts(options: {
  select?: string[];
  expand?: string[];
  filter?: string;
}): Promise<PloomesContact[]> {
  const allContacts: PloomesContact[] = [];
  const batchSize = 1000; // Ploomes max per request
  let skip = 0;
  let hasMore = true;

  while (hasMore) {
    const batch = await this.getContacts({
      ...options,
      top: batchSize,
      skip
    });

    allContacts.push(...batch);
    console.log(`[PLOOMES] Fetched ${allContacts.length} contacts so far...`);

    hasMore = batch.length === batchSize;
    skip += batchSize;

    // Safety limit: stop at 50K records
    if (allContacts.length >= 50000) {
      console.warn(`[PLOOMES] Reached safety limit of 50K contacts`);
      break;
    }
  }

  return allContacts;
}
```

**Update APIs to use pagination**:

```typescript
// In customers/route.ts and metrics/route.ts
const contacts = await ploomesClient.fetchAllContacts({
  select: ['Id', 'Name', 'Document']
});
```

### Priority 3: Batch Sync with Date Ranges

**File**: Create `/scripts/sync-by-date-ranges.js`

```javascript
#!/usr/bin/env node

/**
 * Batch sync sales by date ranges to ensure complete historical data
 */

async function syncSalesByYearRange(startYear, endYear) {
  console.log(`🔄 Syncing sales from ${startYear} to ${endYear}...`);

  for (let year = startYear; year <= endYear; year++) {
    console.log(`\n📅 Processing year ${year}...`);

    // Sync by quarters to avoid memory issues
    for (let quarter = 1; quarter <= 4; quarter++) {
      const qStartMonth = (quarter - 1) * 3 + 1;
      const qEndMonth = quarter * 3;
      const startDate = `${year}-${qStartMonth.toString().padStart(2, '0')}-01T00:00:00Z`;
      const endDate = `${year}-${qEndMonth.toString().padStart(2, '0')}-31T23:59:59Z`;

      console.log(`  Q${quarter}: ${startDate} to ${endDate}`);

      let skip = 0;
      let hasMore = true;
      let quarterTotal = 0;

      while (hasMore) {
        const response = await ploomesApi.get('/Deals', {
          params: {
            $select: 'Id,Title,Amount,StageId,ContactId,CreateDate',
            $expand: 'Products($select=ProductId,Quantity,Price,Total)',
            $filter: `CreateDate ge ${startDate} and CreateDate le ${endDate}`,
            $top: 500,
            $skip: skip
          }
        });

        const deals = response.data.value || [];
        if (deals.length === 0) break;

        // Process and save to Supabase
        await syncSalesToSupabase(deals);

        quarterTotal += deals.length;
        skip += 500;
        hasMore = deals.length === 500;
      }

      console.log(`  ✅ Q${quarter}: ${quarterTotal} deals synced`);
    }
  }
}

// Run for 2020-2025
syncSalesByYearRange(2020, 2025);
```

---

## 📋 TESTING CHECKLIST

- [ ] Test Ploomes API with `$top=10000` - does it return all or cap at 1000?
- [ ] Check Supabase `sales` table - how many records? What date range?
- [ ] Test Document field access - working or hitting catch block?
- [ ] Verify total customer count in Ploomes vs dashboard display
- [ ] Check if pagination is needed for 2000+ contacts
- [ ] Run date range sync to fill in historical data gaps
- [ ] Verify all years appear in dashboard after sync

---

## 🎯 EXPECTED RESULTS AFTER FIXES

1. **Customer Count**: Shows 2000+ customers (all from Ploomes)
2. **CNPJ Display**: Shows actual CNPJ/CPF for all customers (or properly indicates "N/A")
3. **Sales History**: Shows sales from ALL years (2020-2025) not just 2023
4. **Data Completeness**: Confidence that all historical data is synchronized

---

## 📞 NEXT STEPS

1. Run Ploomes API tests to understand pagination limits
2. Check Supabase data to see current state
3. Implement customer mapping fix (Priority 1)
4. Add pagination helper (Priority 2)
5. Run batch sync by date ranges (Priority 3)
6. Deploy and verify in production
7. Add monitoring/alerts for data sync completeness
