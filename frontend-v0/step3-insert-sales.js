#!/usr/bin/env node

/**
 * STEP 3: Insert individual sales into Supabase sales table
 * Loads deals from ploomes-deals.json and inserts each as a sale
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Supabase Configuration
const SUPABASE_URL = 'https://yxwokryybudwygtemfmu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4d29rcnl5YnVkd3lndGVtZm11Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3NDE2ODEsImV4cCI6MjA3NDMxNzY4MX0.ALgRRp1FivPIQ7TltZF7HPDS2d12RNAxTnc_BfRmJUg';
const BATCH_SIZE = 500;

async function main() {
  const startTime = Date.now();
  console.log('💾 [STEP 3] Inserting individual sales into Supabase...\n');

  // STEP 1: Load deals from JSON file
  console.log('📂 [STEP 1] Loading deals from file...');
  const dealsFile = 'ploomes-deals.json';

  if (!fs.existsSync(dealsFile)) {
    throw new Error(`File not found: ${dealsFile}. Run step1-fetch-ploomes.js first!`);
  }

  const allDeals = JSON.parse(fs.readFileSync(dealsFile, 'utf8'));
  console.log(`✅ [STEP 1] Loaded ${allDeals.length} deals\n`);

  // STEP 2: Get valid customer IDs from Supabase
  console.log('📊 [STEP 2] Fetching valid customer IDs from Supabase...');
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // Fetch ALL customers with pagination
  let allCustomerIds = new Set();
  let page = 0;
  const PAGE_SIZE = 1000;

  while (true) {
    const { data: pageData, error: pageError } = await supabase
      .from('customers')
      .select('id')
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (pageError) {
      throw new Error(`Supabase error: ${pageError.message}`);
    }

    if (!pageData || pageData.length === 0) {
      break;
    }

    pageData.forEach(c => allCustomerIds.add(c.id));

    if (pageData.length < PAGE_SIZE) {
      break;
    }

    page++;
  }

  console.log(`✅ [STEP 2] Fetched ${allCustomerIds.size} valid customer IDs\n`);

  // STEP 3: Transform deals to sales format
  console.log('🔄 [STEP 3] Transforming deals to sales format...');

  const salesData = allDeals
    .filter(deal => deal.ContactId && allCustomerIds.has(String(deal.ContactId))) // Only valid customers
    .map(deal => {
      // Map products from Ploomes format to our schema
      const products = (deal.Products || []).map(p => ({
        product_id: p.ProductId?.toString() || p.Id?.toString() || null,
        product_name: p.ProductName || p.Name || 'Unknown Product',
        quantity: p.Quantity || 0,
        unit_price: p.UnitPrice || p.Price || 0,
        total: p.Total || (p.Quantity * (p.UnitPrice || p.Price || 0)) || 0,
        category: p.Category || null
      }));

      return {
        ploomes_deal_id: String(deal.Id),
        customer_id: String(deal.ContactId),
        deal_value: deal.Amount || 0,
        deal_stage: '0', // Default stage (unknown)
        probability: null,
        expected_close_date: null,
        actual_close_date: deal.LastUpdateDate || null,
        status: 'won', // Since we only fetched StatusId=2 (won deals)
        products: products,
        created_at: deal.LastUpdateDate || new Date().toISOString(),
        updated_at: deal.LastUpdateDate || new Date().toISOString(),
        stage_id: String(deal.StatusId),
      };
    });

  console.log(`✅ [STEP 3] Prepared ${salesData.length} sales records\n`);

  // STEP 4: Clear existing sales data
  console.log('🗑️  [STEP 4] Clearing existing sales data...');
  const { error: deleteError } = await supabase
    .from('sales')
    .delete()
    .not('ploomes_deal_id', 'is', null); // Delete all records with deal IDs

  if (deleteError && !deleteError.message.includes('no rows')) {
    console.warn('⚠️  Warning during delete:', deleteError.message);
  }
  console.log(`✅ [STEP 4] Existing data cleared\n`);

  // STEP 5: Insert sales in batches
  console.log('💾 [STEP 5] Inserting sales to Supabase...');

  let totalInserted = 0;
  for (let i = 0; i < salesData.length; i += BATCH_SIZE) {
    const batch = salesData.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(salesData.length / BATCH_SIZE);

    const { error: upsertError } = await supabase
      .from('sales')
      .upsert(batch, { onConflict: 'ploomes_deal_id' });

    if (upsertError) {
      console.error(`❌ Batch ${batchNum} failed:`, upsertError.message);
      throw upsertError;
    }

    totalInserted += batch.length;
    console.log(`   ✅ Batch ${batchNum}/${totalBatches}: ${totalInserted}/${salesData.length} records`);
  }

  const totalTime = Date.now() - startTime;
  console.log(`\n🎉 [SUCCESS] Sync completed in ${(totalTime / 1000).toFixed(1)}s`);
  console.log(`   📊 Total sales synced: ${totalInserted}`);
  console.log(`   📦 Total deals processed: ${allDeals.length}\n`);
  console.log('✨ Step 3 complete!');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n💥 [ERROR]', error.message);
    process.exit(1);
  });
