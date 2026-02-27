/**
 * Sincroniza deals do Ploomes para vendedores que têm 0 clientes no Supabase.
 *
 * Usage: node scripts/sync-missing-vendor-sales.js
 * Requires: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, PLOOMES_API_KEY in .env.local
 */

const path = require('path');
const fs = require('fs');

// Load .env.local manually
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const match = line.match(/^([A-Z_]+)=(.+)$/);
    if (match) process.env[match[1]] = match[2].trim();
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PLOOMES_KEY = process.env.PLOOMES_API_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY || !PLOOMES_KEY) {
  console.error('Missing env vars. Check SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, PLOOMES_API_KEY');
  process.exit(1);
}

// Vendors with 0 customers (identified in diagnostic)
const TARGET_OWNER_IDS = [120001339, 120001588];

async function fetchPloomes(path) {
  const url = `https://public-api2.ploomes.com${path}`;
  const res = await fetch(url, {
    headers: { 'User-Key': PLOOMES_KEY, 'Content-Type': 'application/json' }
  });
  if (!res.ok) throw new Error(`Ploomes ${res.status}: ${await res.text()}`);
  return res.json();
}

async function supabaseRequest(method, path, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    method,
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase ${res.status}: ${text}`);
  }
  return res.status === 204 ? null : res.json();
}

// Cache all deals once (same approach as backfill-sales-owner-id.js which worked)
let _allDealsCache = null;
async function fetchAllDeals() {
  if (_allDealsCache) return _allDealsCache;

  const allDeals = [];
  let skip = 0;
  const top = 300;

  while (true) {
    const data = await fetchPloomes(`/Deals?$select=Id,ContactId,OwnerId,Amount,StageId,CreateDate,LastUpdateDate,Title&$top=${top}&$skip=${skip}`);
    const deals = data.value || [];
    allDeals.push(...deals);
    if (allDeals.length % 3000 < top) {
      console.log(`  Fetched ${allDeals.length} deals total from Ploomes...`);
    }
    if (deals.length < top) break;
    skip += top;
    await new Promise(r => setTimeout(r, 120)); // rate limit
  }

  _allDealsCache = allDeals;
  return allDeals;
}

async function fetchAllDealsForOwner(ownerId) {
  const all = await fetchAllDeals();
  return all.filter(d => d.OwnerId === ownerId);
}

function dealToSaleRow(deal) {
  return {
    ploomes_deal_id: String(deal.Id),
    customer_id: String(deal.ContactId),
    owner_id: deal.OwnerId,
    person_id: deal.OwnerId,
    deal_value: deal.Amount || 0,
    stage_id: deal.StageId ? String(deal.StageId) : null,
    deal_stage: deal.StageId ? String(deal.StageId) : null,
    status: 'open', // Win/Lose fields are restricted in API; default to open
    products: [],
  };
}

async function main() {
  console.log('=== Sync Missing Vendor Sales ===');
  console.log(`Target owners: ${TARGET_OWNER_IDS.join(', ')}\n`);

  let totalInserted = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  for (const ownerId of TARGET_OWNER_IDS) {
    console.log(`\n--- Owner ID: ${ownerId} ---`);
    const deals = await fetchAllDealsForOwner(ownerId);
    console.log(`Total deals fetched: ${deals.length}`);

    if (deals.length === 0) {
      console.log('No deals found, skipping.');
      continue;
    }

    // Check which customers exist in Supabase
    const contactIds = [...new Set(deals.map(d => String(d.ContactId)).filter(Boolean))];
    console.log(`Unique ContactIds: ${contactIds.length}`);

    // Fetch existing customers in batches of 100
    const existingCustomerIds = new Set();
    for (let i = 0; i < contactIds.length; i += 100) {
      const batch = contactIds.slice(i, i + 100);
      const ids = batch.join(',');
      const data = await supabaseRequest('GET', `/customers?id=in.(${ids})&select=id`);
      if (Array.isArray(data)) {
        for (const row of data) existingCustomerIds.add(String(row.id));
      }
    }
    console.log(`Customers found in Supabase: ${existingCustomerIds.size} / ${contactIds.length}`);

    // Build rows for valid deals (customer exists in Supabase)
    const rows = deals
      .filter(d => d.ContactId && existingCustomerIds.has(String(d.ContactId)))
      .map(dealToSaleRow);

    const skippedNoCustomer = deals.length - rows.length;
    console.log(`Rows to upsert: ${rows.length} (skipped ${skippedNoCustomer} — customer not in Supabase)`);
    totalSkipped += skippedNoCustomer;

    // Upsert in batches of 200
    const BATCH = 200;
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH);
      try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/sales`, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates,return=minimal',
          },
          body: JSON.stringify(batch),
        });
        if (!res.ok) {
          const text = await res.text();
          console.error(`  Batch ${i}-${i + batch.length} error: ${text}`);
          totalErrors += batch.length;
        } else {
          totalInserted += batch.length;
          console.log(`  Upserted batch ${i}-${i + batch.length}`);
        }
      } catch (err) {
        console.error(`  Batch error:`, err.message);
        totalErrors += batch.length;
      }
    }
  }

  console.log('\n=== Result ===');
  console.log(`Upserted: ${totalInserted}`);
  console.log(`Skipped (customer not in Supabase): ${totalSkipped}`);
  console.log(`Errors: ${totalErrors}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
