/**
 * Sync Deals from Ploomes to Supabase
 * This script fetches all deals from Ploomes and syncs them to Supabase
 * for dashboard metrics calculation
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Setup path for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL || 'https://yxwokryybudwygtemfmu.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || ''
);

// Ploomes configuration
const PLOOMES_BASE_URL = 'https://public-api2.ploomes.com';
const PLOOMES_API_KEY = process.env.PLOOMES_API_KEY || process.env.PLOOME_API_KEY;

if (!PLOOMES_API_KEY) {
  console.error('❌ PLOOMES_API_KEY not configured!');
  process.exit(1);
}

/**
 * Rate limiter to respect Ploomes API limits (120 req/min)
 */
class RateLimiter {
  constructor() {
    this.requests = [];
    this.LIMIT = 120;
    this.WINDOW = 60000; // 1 minute
  }

  async waitIfNeeded() {
    const now = Date.now();
    this.requests = this.requests.filter(time => now - time < this.WINDOW);

    if (this.requests.length >= this.LIMIT) {
      const oldestRequest = this.requests[0];
      const waitTime = this.WINDOW - (now - oldestRequest) + 100;
      console.log(`⏳ Rate limit reached. Waiting ${waitTime}ms...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      this.requests = this.requests.filter(time => Date.now() - time < this.WINDOW);
    }

    this.requests.push(now);
  }
}

const rateLimiter = new RateLimiter();

/**
 * Fetch data from Ploomes API with rate limiting
 */
async function fetchFromPloomes(endpoint) {
  await rateLimiter.waitIfNeeded();

  const url = `${PLOOMES_BASE_URL}${endpoint}`;
  console.log(`🔄 Fetching: ${endpoint}`);

  const response = await fetch(url, {
    headers: {
      'User-Key': PLOOMES_API_KEY,
      'Content-Type': 'application/json; charset=utf-8'
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`❌ API Error ${response.status}: ${errorText}`);
    throw new Error(`Ploomes API error: ${response.status}`);
  }

  const data = await response.json();
  return data.value || [];
}

/**
 * Fetch all deals with pagination
 */
async function fetchAllDeals() {
  console.log('📊 Fetching all deals from Ploomes...');

  let allDeals = [];
  let skip = 0;
  const pageSize = 300; // Ploomes max limit
  let hasMore = true;

  while (hasMore) {
    const endpoint = `/Deals?$select=Id,Title,Amount,StatusId,StageId,PersonId,CompanyId,CreatedDate,ExpectedCloseDate,Products&$expand=Products&$top=${pageSize}&$skip=${skip}`;

    try {
      const deals = await fetchFromPloomes(endpoint);

      if (deals.length > 0) {
        allDeals = [...allDeals, ...deals];
        console.log(`✅ Fetched ${deals.length} deals (total: ${allDeals.length})`);

        if (deals.length < pageSize) {
          hasMore = false;
        } else {
          skip += pageSize;
        }
      } else {
        hasMore = false;
      }
    } catch (error) {
      console.error(`❌ Error fetching deals at skip=${skip}:`, error);
      hasMore = false;
    }
  }

  console.log(`✅ Total deals fetched: ${allDeals.length}`);
  return allDeals;
}

/**
 * Fetch all contacts (customers)
 */
async function fetchAllContacts() {
  console.log('👥 Fetching all contacts from Ploomes...');

  let allContacts = [];
  let skip = 0;
  const pageSize = 300;
  let hasMore = true;

  while (hasMore) {
    const endpoint = `/Contacts?$select=Id,Name,Email,TypeId,Document,CityId&$top=${pageSize}&$skip=${skip}`;

    try {
      const contacts = await fetchFromPloomes(endpoint);

      if (contacts.length > 0) {
        allContacts = [...allContacts, ...contacts];
        console.log(`✅ Fetched ${contacts.length} contacts (total: ${allContacts.length})`);

        if (contacts.length < pageSize) {
          hasMore = false;
        } else {
          skip += pageSize;
        }
      } else {
        hasMore = false;
      }
    } catch (error) {
      console.error(`❌ Error fetching contacts at skip=${skip}:`, error);
      hasMore = false;
    }
  }

  console.log(`✅ Total contacts fetched: ${allContacts.length}`);
  return allContacts;
}

/**
 * Transform Ploomes deal to Supabase format
 */
function transformDeal(deal, contactsMap) {
  const contact = deal.PersonId ? contactsMap.get(deal.PersonId) :
                  deal.CompanyId ? contactsMap.get(deal.CompanyId) : null;

  // Determine status based on StatusId
  let status = 'open';
  if (deal.StatusId === 2) status = 'won';
  else if (deal.StatusId === 3) status = 'lost';

  // Extract products if available
  let products = [];
  if (deal.Products && Array.isArray(deal.Products)) {
    products = deal.Products.map(p => ({
      product_id: p.ProductId,
      product_name: p.Name || 'Unknown',
      quantity: p.Quantity || 1,
      unit_price: p.UnitPrice || 0,
      total: (p.Quantity || 1) * (p.UnitPrice || 0)
    }));
  }

  return {
    deal_id: deal.Id,
    title: deal.Title || `Deal ${deal.Id}`,
    deal_value: deal.Amount || 0,
    customer_id: deal.PersonId || deal.CompanyId || null,
    customer_name: contact ? contact.Name : 'Unknown',
    status: status,
    stage_id: deal.StageId || null,
    products: products, // Store as JSONB
    created_at: deal.CreatedDate || new Date().toISOString(),
    expected_close_date: deal.ExpectedCloseDate || null,
    synced_at: new Date().toISOString()
  };
}

/**
 * Sync deals to Supabase
 */
async function syncToSupabase(deals, contacts) {
  console.log('💾 Syncing to Supabase...');

  // Create contacts map for quick lookup
  const contactsMap = new Map();
  contacts.forEach(c => contactsMap.set(c.Id, c));

  // Transform deals
  const transformedDeals = deals.map(d => transformDeal(d, contactsMap));

  // Clear existing sales table
  const { error: deleteError } = await supabase
    .from('sales')
    .delete()
    .neq('id', 0); // Delete all records

  if (deleteError) {
    console.error('❌ Error clearing sales table:', deleteError);
  } else {
    console.log('✅ Cleared existing sales data');
  }

  // Insert in batches of 100
  const batchSize = 100;
  for (let i = 0; i < transformedDeals.length; i += batchSize) {
    const batch = transformedDeals.slice(i, i + batchSize);

    const { error: insertError } = await supabase
      .from('sales')
      .insert(batch);

    if (insertError) {
      console.error(`❌ Error inserting batch ${i / batchSize + 1}:`, insertError);
    } else {
      console.log(`✅ Inserted batch ${i / batchSize + 1} (${batch.length} records)`);
    }
  }

  // Update customers count
  const { error: upsertError } = await supabase
    .from('dashboard_stats')
    .upsert({
      id: 1,
      total_customers: contacts.length,
      total_deals: deals.length,
      last_sync: new Date().toISOString()
    });

  if (upsertError) {
    console.error('❌ Error updating dashboard stats:', upsertError);
  }

  console.log('✅ Sync complete!');
  console.log(`📊 Summary:`);
  console.log(`   - Total deals: ${deals.length}`);
  console.log(`   - Total customers: ${contacts.length}`);
  console.log(`   - Won deals: ${transformedDeals.filter(d => d.status === 'won').length}`);
  console.log(`   - Total revenue: R$ ${transformedDeals.reduce((sum, d) => sum + d.deal_value, 0).toFixed(2)}`);
}

/**
 * Main sync function
 */
async function main() {
  console.log('🚀 Starting Ploomes → Supabase sync...');
  console.log('📍 Environment:', {
    SUPABASE_URL: process.env.SUPABASE_URL,
    PLOOMES_API: PLOOMES_BASE_URL,
    HAS_API_KEY: !!PLOOMES_API_KEY
  });

  try {
    // Fetch all data from Ploomes
    const [deals, contacts] = await Promise.all([
      fetchAllDeals(),
      fetchAllContacts()
    ]);

    // Sync to Supabase
    await syncToSupabase(deals, contacts);

    console.log('✅ Sync completed successfully!');
  } catch (error) {
    console.error('❌ Sync failed:', error);
    process.exit(1);
  }
}

// Run the sync
main().catch(console.error);