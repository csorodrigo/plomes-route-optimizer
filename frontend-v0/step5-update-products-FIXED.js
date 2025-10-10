#!/usr/bin/env node

/**
 * STEP 5 FIXED: Update Supabase sales table with products data
 * Using correct Supabase update method with JSONB
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🔧 Supabase URL:', SUPABASE_URL);
console.log('🔧 Using service key:', SUPABASE_SERVICE_KEY ? 'Yes ✅' : 'No ❌');
console.log('');

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing environment variables!');
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', SUPABASE_URL);
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', SUPABASE_SERVICE_KEY ? 'Present' : 'Missing');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

async function main() {
  console.log('📦 [STEP 5 FIXED] Updating Supabase sales with products...\n');
  console.log('='.repeat(70) + '\n');

  // Load deals with products
  const dealsFile = 'ploomes-deals-with-products.json';
  if (!fs.existsSync(dealsFile)) {
    throw new Error(`File not found: ${dealsFile}`);
  }

  const allDeals = JSON.parse(fs.readFileSync(dealsFile, 'utf8'));
  console.log(`✅ Loaded ${allDeals.length} deals\n`);

  const dealsWithProducts = allDeals.filter(d => d.Products && d.Products.length > 0);
  console.log(`📊 Deals with products: ${dealsWithProducts.length}\n`);

  if (dealsWithProducts.length === 0) {
    console.log('⚠️  No deals with products to update.');
    return;
  }

  console.log('🔄 Updating sales in Supabase...\n');

  let updated = 0;
  let notFound = 0;
  let errors = 0;

  // Process in smaller batches to avoid rate limits
  const BATCH_SIZE = 10;
  for (let i = 0; i < dealsWithProducts.length; i += BATCH_SIZE) {
    const batch = dealsWithProducts.slice(i, i + BATCH_SIZE);

    console.log(`   Processing batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(dealsWithProducts.length/BATCH_SIZE)}...`);

    for (const deal of batch) {
      try {
        const dealId = String(deal.Id);
        const products = deal.Products || [];

        // Update using .from().update() method - CORRECT Supabase approach
        const { data, error, count } = await supabase
          .from('sales')
          .update({ products: products })  // JSONB is handled automatically
          .eq('ploomes_deal_id', dealId)
          .select();

        if (error) {
          console.error(`   ❌ Error updating deal ${dealId}: ${error.message}`);
          errors++;
        } else if (!data || data.length === 0) {
          notFound++;
        } else {
          updated++;
        }

      } catch (error) {
        console.error(`   💥 Exception for deal ${deal.Id}: ${error.message}`);
        errors++;
      }
    }

    // Small delay between batches to avoid rate limiting
    if (i + BATCH_SIZE < dealsWithProducts.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  console.log(`\n${'='.repeat(70)}`);
  console.log(`📊 UPDATE RESULTS:`);
  console.log(`   Attempted: ${dealsWithProducts.length}`);
  console.log(`   Updated: ${updated}`);
  console.log(`   Not Found: ${notFound}`);
  console.log(`   Errors: ${errors}`);
  console.log(`${'='.repeat(70)}\n`);

  // Verify update
  console.log('🔍 Verifying updates...\n');

  const { data: salesWithProducts, error: verifyError } = await supabase
    .from('sales')
    .select('id, customer_id, products')
    .not('products', 'is', null)
    .limit(5);

  if (verifyError) {
    console.error('❌ Verification error:', verifyError);
  } else {
    console.log(`✅ Found ${salesWithProducts?.length || 0} sales with products in database`);

    if (salesWithProducts && salesWithProducts.length > 0) {
      console.log('\nSample sales with products:');
      salesWithProducts.forEach(sale => {
        const products = sale.products || [];
        const productsArray = Array.isArray(products) ? products : [];
        console.log(`   Sale ${sale.id}: ${productsArray.length} products`);
        if (productsArray.length > 0 && productsArray[0].product_name) {
          console.log(`      First: ${productsArray[0].product_name}`);
        }
      });
    }
  }

  console.log('\n✅ Supabase update complete!');
  console.log('🎯 Next: Verify dashboard displays products correctly\n');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n💥 ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  });
