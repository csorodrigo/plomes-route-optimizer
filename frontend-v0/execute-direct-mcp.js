#!/usr/bin/env node

/**
 * Execute products update directly via Supabase client
 * Using correct credentials from .env.local
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🔧 Using Supabase URL:', SUPABASE_URL);
console.log('🔧 Service key present:', !!SUPABASE_SERVICE_KEY, '\n');

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

async function executeAllUpdates() {
  console.log('📦 Loading deals with products...\n');

  const dealsFile = 'ploomes-deals-with-products.json';
  const allDeals = JSON.parse(fs.readFileSync(dealsFile, 'utf8'));
  const dealsWithProducts = allDeals.filter(d => d.Products && d.Products.length > 0);

  console.log(`✅ Found ${dealsWithProducts.length} deals with products\n`);
  console.log('🔄 Executing updates in batches of 50...\n');

  let success = 0;
  let failed = 0;
  let notFound = 0;

  const BATCH_SIZE = 50;

  for (let i = 0; i < dealsWithProducts.length; i += BATCH_SIZE) {
    const batch = dealsWithProducts.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(dealsWithProducts.length / BATCH_SIZE);

    console.log(`📦 Batch ${batchNum}/${totalBatches} (${batch.length} updates)...`);

    for (const deal of batch) {
      const dealId = String(deal.Id);
      const products = deal.Products || [];

      try {
        const { data, error } = await supabase
          .from('sales')
          .update({ products: products })
          .eq('ploomes_deal_id', dealId)
          .select();

        if (error) {
          console.error(`   ❌ Deal ${dealId}: ${error.message}`);
          failed++;
        } else if (!data || data.length === 0) {
          notFound++;
        } else {
          success++;
        }
      } catch (err) {
        console.error(`   💥 Deal ${dealId}: ${err.message}`);
        failed++;
      }
    }

    // Progress update
    console.log(`   Progress: ${success} ✅ | ${failed} ❌ | ${notFound} ⚠️\n`);

    // Small delay to avoid rate limiting
    if (i + BATCH_SIZE < dealsWithProducts.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  console.log('='.repeat(70));
  console.log('📊 FINAL RESULTS:');
  console.log(`   Attempted: ${dealsWithProducts.length}`);
  console.log(`   ✅ Success: ${success}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   ⚠️  Not Found: ${notFound}`);
  console.log('='.repeat(70) + '\n');

  // Verification
  console.log('🔍 Verifying updates...\n');

  const { data: verification, error: verifyError } = await supabase
    .from('sales')
    .select('id, customer_id, products', { count: 'exact' })
    .not('products', 'is', null);

  if (verifyError) {
    console.error('❌ Verification error:', verifyError);
  } else {
    console.log(`✅ Total sales with products: ${verification.length}`);

    if (verification.length >= success) {
      console.log('🎉 SUCCESS! Products synced to Supabase!\n');
    } else {
      console.log(`⚠️  Expected ${success}, found ${verification.length}\n`);
    }
  }
}

executeAllUpdates()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n💥 ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  });
