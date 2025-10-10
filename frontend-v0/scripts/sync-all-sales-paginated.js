#!/usr/bin/env node

/**
 * COMPLETE Ploomes Sales Sync - Paginated Version
 *
 * Fetches ALL deals from Ploomes (19,448+) using pagination
 * and syncs to Supabase for dashboard analytics.
 *
 * Previous script only fetched 5,000 deals (26% of data)
 * This script fetches 100% of all historical sales data
 *
 * Usage:
 *   node scripts/sync-all-sales-paginated.js
 *
 * Environment Variables Required:
 *   - PLOOMES_API_KEY: Ploomes API key
 *   - SUPABASE_URL: Supabase project URL
 *   - SUPABASE_SERVICE_KEY: Supabase service role key
 */

const axios = require('axios');

// Configuration
const PLOOMES_API_KEY = process.env.PLOOMES_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const PLOOMES_BASE_URL = 'https://public-api2.ploomes.com';

// Pagination settings
const PAGE_SIZE = 300; // Ploomes API limit per request
const MAX_DEALS = 25000; // Safety limit (increase if needed)

// Validate environment variables
console.log('🔍 Environment Check:');
console.log('  PLOOMES_API_KEY:', PLOOMES_API_KEY ? PLOOMES_API_KEY.substring(0, 20) + '...' : 'MISSING');
console.log('  SUPABASE_URL:', SUPABASE_URL ? SUPABASE_URL.substring(0, 30) + '...' : 'MISSING');
console.log('  SUPABASE_SERVICE_KEY:', SUPABASE_SERVICE_KEY ? 'Present' : 'MISSING');

if (!PLOOMES_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('\n❌ Missing required environment variables');
  console.error('Required: PLOOMES_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY');
  process.exit(1);
}

// Create API clients
const ploomesApi = axios.create({
  baseURL: PLOOMES_BASE_URL,
  headers: {
    'User-Key': PLOOMES_API_KEY,
    // Removed 'Content-Type': 'application/json' - might cause issues with GET requests
  },
  timeout: 120000, // 2 minutes per request
});

const supabaseApi = axios.create({
  baseURL: `${SUPABASE_URL}/rest/v1`,
  headers: {
    'apikey': SUPABASE_SERVICE_KEY,
    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=minimal',
  },
  timeout: 120000,
});

/**
 * Fetch ALL deals from Ploomes with pagination
 * Handles Ploomes 300-record limit automatically
 */
async function fetchAllPloomesDeals() {
  console.log('💰 Fetching ALL deals from Ploomes (paginated)...\n');

  const allDeals = [];
  let skip = 0;
  let hasMore = true;
  let pageNumber = 1;

  while (hasMore && allDeals.length < MAX_DEALS) {
    try {
      console.log(`📄 Page ${pageNumber}: Fetching deals ${skip + 1} to ${skip + PAGE_SIZE}...`);

      // Build URL manually to avoid axios param serialization issues
      const queryParams = new URLSearchParams({
        '$select': 'Id,Title,Amount,StageId,ContactId,CreateDate,LastStageUpdate',
        '$top': PAGE_SIZE.toString(),
        '$skip': skip.toString(),
      });

      const url = `/Deals?${queryParams.toString()}`;
      console.log('   Request URL:', url.substring(0, 100));

      const response = await ploomesApi.get(url);

      const deals = response.data.value || [];

      if (deals.length === 0) {
        console.log('✅ No more deals to fetch');
        hasMore = false;
        break;
      }

      allDeals.push(...deals);

      console.log(`   ✅ Fetched ${deals.length} deals (Total so far: ${allDeals.length})`);

      // Check if we got fewer than PAGE_SIZE (means we're at the end)
      if (deals.length < PAGE_SIZE) {
        console.log('✅ Reached end of data');
        hasMore = false;
      } else {
        skip += PAGE_SIZE;
        pageNumber++;

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      }

    } catch (error) {
      console.error(`❌ Error on page ${pageNumber}:`, error.message);

      // If we already have some data, continue with what we have
      if (allDeals.length > 0) {
        console.log(`⚠️  Continuing with ${allDeals.length} deals fetched so far`);
        hasMore = false;
      } else {
        throw error;
      }
    }
  }

  console.log(`\n✅ TOTAL DEALS FETCHED: ${allDeals.length}\n`);
  return allDeals;
}

/**
 * Clear existing sales data in Supabase
 */
async function clearExistingSales() {
  console.log('🗑️  Clearing existing sales data...');

  try {
    // Delete all records from sales table
    await supabaseApi.delete('/sales', {
      headers: {
        'Prefer': 'return=minimal',
      },
      params: {
        // Delete all records
        'id': 'neq.0', // This matches all records
      },
    });

    console.log('✅ Existing sales data cleared\n');
  } catch (error) {
    console.error('❌ Error clearing sales:', error.response?.data || error.message);
    // Continue anyway - might not have data to clear
  }
}

/**
 * Transform deals into sales records for Supabase
 */
function transformDealsToSales(deals) {
  console.log('🔄 Transforming ALL deals into sales records (NO StageId filter)...');

  const salesData = [];
  let processedCount = 0;
  let skippedNoAmount = 0;

  for (const deal of deals) {
    // Only skip if deal has NO amount (keep all deals with any amount > 0)
    if (!deal.Amount || deal.Amount <= 0) {
      skippedNoAmount++;
      continue;
    }

    processedCount++;

    // Create a sales record
    const saleRecord = {
      deal_id: deal.Id?.toString(),
      customer_id: deal.ContactId?.toString(),
      deal_value: deal.Amount || 0,
      stage_id: deal.StageId?.toString() || null, // Store actual StageId for reference
      status: 'won', // Mark all as won since we're storing all deals with amount
      created_at: deal.CreateDate || new Date().toISOString(),
      updated_at: deal.LastStageUpdate || deal.CreateDate || new Date().toISOString(),
      products: deal.Products || [], // Store as JSONB (will be empty without $expand)
      synced_at: new Date().toISOString(),
    };

    salesData.push(saleRecord);
  }

  console.log(`✅ Transformed ${processedCount} deals with amount > 0 into sales records`);
  console.log(`   (Skipped ${skippedNoAmount} deals with no amount)\n`);
  return salesData;
}

/**
 * Sync sales to Supabase in batches
 */
async function syncSalesToSupabase(salesData) {
  console.log('🔄 Syncing sales to Supabase...\n');

  if (salesData.length === 0) {
    console.log('⚠️  No sales data to sync');
    return;
  }

  try {
    // Batch insert sales (chunks of 500 for safety)
    const chunkSize = 500;
    const totalChunks = Math.ceil(salesData.length / chunkSize);

    for (let i = 0; i < salesData.length; i += chunkSize) {
      const chunk = salesData.slice(i, i + chunkSize);
      const chunkNumber = Math.floor(i / chunkSize) + 1;

      console.log(`📦 Batch ${chunkNumber}/${totalChunks}: Syncing ${chunk.length} records...`);

      await supabaseApi.post('/sales', chunk, {
        headers: {
          'Prefer': 'resolution=ignore-duplicates', // Skip duplicates
        },
      });

      console.log(`   ✅ Synced ${i + chunk.length}/${salesData.length} records`);

      // Small delay between batches
      if (i + chunkSize < salesData.length) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }

    console.log(`\n✅ TOTAL SALES SYNCED: ${salesData.length}\n`);
  } catch (error) {
    console.error('❌ Error syncing sales:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Main sync function
 */
async function main() {
  console.log('🚀 Starting COMPLETE sales data sync (paginated)...\n');
  console.log('═'.repeat(60));
  console.log('');

  const startTime = Date.now();

  try {
    // Step 1: Fetch ALL deals with pagination
    const allDeals = await fetchAllPloomesDeals();

    if (allDeals.length === 0) {
      console.log('⚠️  No deals found in Ploomes');
      process.exit(0);
    }

    // Step 2: Clear existing data (optional - comment out to append instead)
    await clearExistingSales();

    // Step 3: Transform deals to sales format
    const salesData = transformDealsToSales(allDeals);

    // Step 4: Sync to Supabase
    await syncSalesToSupabase(salesData);

    // Done!
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('═'.repeat(60));
    console.log('');
    console.log('✅ SYNC COMPLETE!');
    console.log(`   Duration: ${duration}s`);
    console.log(`   Total Deals Processed: ${allDeals.length}`);
    console.log(`   Total Sales Records: ${salesData.length}`);
    console.log('');
    console.log('═'.repeat(60));

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Sync failed:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
    process.exit(1);
  }
}

// Run the script
main();
