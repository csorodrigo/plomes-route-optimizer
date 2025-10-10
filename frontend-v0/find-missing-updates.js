#!/usr/bin/env node
/**
 * Find which 2 of 1,641 deal updates are missing in Supabase
 */

const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function findMissing() {
  console.log('🔍 Finding missing updates...\n');

  // Load all deals with products from JSON
  const allDeals = JSON.parse(fs.readFileSync('ploomes-deals-with-products.json', 'utf8'));

  // Filter deals that have products in JSON
  const dealsWithProducts = allDeals.filter(deal =>
    deal.Products && deal.Products.length > 0
  );

  console.log(`📊 Deals with products in JSON: ${dealsWithProducts.length}`);

  // Get all deal IDs that should have products
  const expectedDealIds = dealsWithProducts.map(d => d.Id.toString());
  console.log(`✅ Expected updates: ${expectedDealIds.length}\n`);

  // Query Supabase for sales that DON'T have products
  const { data: salesWithoutProducts, error } = await supabase
    .from('sales')
    .select('ploomes_deal_id, id')
    .in('ploomes_deal_id', expectedDealIds)
    .or('products.is.null,products.eq.[]');

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log(`❌ Sales WITHOUT products in DB: ${salesWithoutProducts.length}\n`);

  if (salesWithoutProducts.length > 0) {
    console.log('Missing deals:');
    salesWithoutProducts.forEach(sale => {
      const deal = dealsWithProducts.find(d => d.Id.toString() === sale.ploomes_deal_id);
      console.log(`  - Deal ID: ${sale.ploomes_deal_id}`);
      console.log(`    Title: ${deal?.Title || 'Unknown'}`);
      console.log(`    Products in JSON: ${deal?.Products.length || 0}`);
      console.log(`    DB sales.id: ${sale.id}\n`);
    });

    // Generate UPDATE statements for missing deals
    console.log('\n📝 SQL to fix missing updates:\n');
    salesWithoutProducts.forEach(sale => {
      const deal = dealsWithProducts.find(d => d.Id.toString() === sale.ploomes_deal_id);
      if (deal && deal.Products.length > 0) {
        const productsJson = JSON.stringify(deal.Products).replace(/'/g, "''");
        console.log(`UPDATE sales SET products = '${productsJson}'::jsonb WHERE ploomes_deal_id = '${sale.ploomes_deal_id}';`);
      }
    });
  } else {
    console.log('✅ All expected deals have products in database!');
  }
}

findMissing().catch(console.error);
