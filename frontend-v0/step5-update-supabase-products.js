#!/usr/bin/env node

/**
 * STEP 5: Update Supabase sales table with products data
 *
 * Reads ploomes-deals-with-products.json and updates sales.products field
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

// Use correct Supabase credentials from .env.local
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://yxwokryybudwygtemfmu.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4d29rcnl5YnVkd3lndGVtZm11Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODc0MTY4MSwiZXhwIjoyMDc0MzE3NjgxfQ.dzEfWIgdftQiwXJdod_bIy4pUl42WwlS-VWYaKvqEKg';

console.log('🔧 Supabase URL:', SUPABASE_URL);
console.log('🔧 Service Key:', SUPABASE_SERVICE_KEY.substring(0, 30) + '...\n');

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function main() {
  console.log('📦 [STEP 5] Updating Supabase sales with products...\n');
  console.log('='.repeat(70) + '\n');

  // Load deals with products
  const dealsFile = 'ploomes-deals-with-products.json';
  if (!fs.existsSync(dealsFile)) {
    throw new Error(`File not found: ${dealsFile}. Run step4-fetch-products-ALL.js first!`);
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

  for (const deal of dealsWithProducts) {
    try {
      const dealId = String(deal.Id);
      const products = deal.Products || [];

      // Update sale by ploomes_deal_id
      const { data, error } = await supabase
        .from('sales')
        .update({ products: products })
        .eq('ploomes_deal_id', dealId);

      if (error) {
        console.error(`   ❌ Error updating deal ${dealId}: ${error.message}`);
        errors++;
      } else {
        updated++;
        if (updated % 100 === 0) {
          console.log(`   ✅ Updated ${updated} sales...`);
        }
      }

    } catch (error) {
      console.error(`   ❌ Exception for deal ${deal.Id}: ${error.message}`);
      errors++;
    }
  }

  console.log(`\n${'='.repeat(70)}`);
  console.log(`📊 UPDATE RESULTS:`);
  console.log(`   Attempted: ${dealsWithProducts.length}`);
  console.log(`   Updated: ${updated}`);
  console.log(`   Errors: ${errors}`);
  console.log(`${'='.repeat(70)}\n`);

  // Verify update
  console.log('🔍 Verifying updates...\n');

  const { data: salesWithProducts, error: verifyError } = await supabase
    .from('sales')
    .select('id, customer_id, products')
    .not('products', 'eq', '[]')
    .limit(5);

  if (verifyError) {
    console.error('❌ Verification error:', verifyError);
  } else {
    console.log(`✅ Found ${salesWithProducts?.length || 0} sales with products in database`);

    if (salesWithProducts && salesWithProducts.length > 0) {
      console.log('\nSample sales with products:');
      salesWithProducts.forEach(sale => {
        const products = sale.products || [];
        console.log(`   Sale ${sale.id}: ${products.length} products`);
        if (products.length > 0) {
          console.log(`      First: ${products[0].product_name}`);
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
