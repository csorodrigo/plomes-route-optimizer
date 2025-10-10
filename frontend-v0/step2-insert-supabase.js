#!/usr/bin/env node

/**
 * STEP 2: Insert Ploomes deals data into Supabase
 * Loads deals from ploomes-deals.json and aggregates sales by customer
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Supabase Configuration
const SUPABASE_URL = 'https://yxwokryybudwygtemfmu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4d29rcnl5YnVkd3lndGVtZm11Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3NDE2ODEsImV4cCI6MjA3NDMxNzY4MX0.ALgRRp1FivPIQ7TltZF7HPDS2d12RNAxTnc_BfRmJUg';
const BATCH_SIZE = 500;

async function main() {
  const startTime = Date.now();
  console.log('💾 [STEP 2] Inserting deals into Supabase...\\n');

  // STEP 1: Load deals from JSON file
  console.log('📂 [STEP 1] Loading deals from file...');
  const dealsFile = 'ploomes-deals.json';

  if (!fs.existsSync(dealsFile)) {
    throw new Error(`File not found: ${dealsFile}. Run step1-fetch-ploomes.js first!`);
  }

  const allDeals = JSON.parse(fs.readFileSync(dealsFile, 'utf8'));
  console.log(`✅ [STEP 1] Loaded ${allDeals.length} deals\\n`);

  // STEP 2: Get ALL customers from Supabase (with pagination)
  console.log('📊 [STEP 2] Fetching customers from Supabase...');
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  let allCustomers = [];
  let page = 0;
  const PAGE_SIZE = 1000;

  while (true) {
    const { data: pageData, error: pageError } = await supabase
      .from('customers')
      .select('id, name, cnpj, cpf')
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (pageError) {
      throw new Error(`Supabase error: ${pageError.message}`);
    }

    if (!pageData || pageData.length === 0) {
      break;
    }

    allCustomers.push(...pageData);

    if (pageData.length < PAGE_SIZE) {
      break; // Last page
    }

    page++;
  }

  const customers = allCustomers;
  console.log(`✅ [STEP 2] Fetched ${customers?.length || 0} customers\\n`);

  // STEP 3: Aggregate sales by customer
  console.log('🔄 [STEP 3] Aggregating sales data...');

  const salesByCustomer = new Map();

  for (const deal of allDeals) {
    if (!deal.ContactId) continue;

    // Convert to string to match Supabase customer.id type
    const contactId = String(deal.ContactId);
    const date = deal.LastUpdateDate || new Date().toISOString();
    const amount = deal.Amount || 0;

    // Since we don't have Win/Lose fields (permissions issue),
    // we'll consider all deals with amount > 0 as won deals
    const isWon = amount > 0;

    const existing = salesByCustomer.get(contactId);

    if (existing) {
      existing.totalDeals += 1;
      if (isWon) {
        existing.wonDeals += 1;
        existing.totalSales += amount;
        existing.totalRevenue += amount;
      }

      if (!existing.firstPurchaseDate || date < existing.firstPurchaseDate) {
        existing.firstPurchaseDate = date;
      }
      if (!existing.lastPurchaseDate || date > existing.lastPurchaseDate) {
        existing.lastPurchaseDate = date;
      }
    } else {
      salesByCustomer.set(contactId, {
        totalSales: isWon ? amount : 0,
        totalDeals: 1,
        wonDeals: isWon ? 1 : 0,
        openDeals: 0, // Can't determine without Win/Lose fields
        lostDeals: 0, // Can't determine without Win/Lose fields
        totalRevenue: isWon ? amount : 0,
        firstPurchaseDate: date,
        lastPurchaseDate: date,
        productsPurchased: new Set(), // No Products data available
      });
    }
  }

  console.log(`✅ [STEP 3] Aggregated ${salesByCustomer.size} customers with sales\\n`);

  // STEP 4: Prepare data for upsert
  console.log('💾 [STEP 4] Preparing data for database...');

  const customerSalesData = (customers || [])
    .map((customer) => {
      const sales = salesByCustomer.get(customer.id);

      if (!sales) return null;

      const daysSinceLastPurchase = sales.lastPurchaseDate
        ? Math.floor((Date.now() - new Date(sales.lastPurchaseDate).getTime()) / (1000 * 60 * 60 * 24))
        : null;

      return {
        customer_id: customer.id,
        customer_name: customer.name || 'Unknown',
        customer_cnpj: customer.cnpj || customer.cpf || null,
        total_sales: sales.totalSales,
        total_deals: sales.totalDeals,
        won_deals: sales.wonDeals,
        open_deals: sales.openDeals,
        lost_deals: sales.lostDeals,
        total_revenue: sales.totalRevenue,
        average_deal_value: sales.wonDeals > 0 ? sales.totalRevenue / sales.wonDeals : 0,
        products_purchased: [], // Empty - no Products data
        total_products: 0, // Empty - no Products data
        first_purchase_date: sales.firstPurchaseDate,
        last_purchase_date: sales.lastPurchaseDate,
        days_since_last_purchase: daysSinceLastPurchase,
        has_custom_pricing: false,
        pricing_history_count: 0,
      };
    })
    .filter(item => item !== null);

  console.log(`✅ [STEP 4] Prepared ${customerSalesData.length} records\\n`);

  // STEP 5: Upsert to Supabase
  console.log('💾 [STEP 5] Upserting to Supabase...');

  let totalUpserted = 0;

  for (let i = 0; i < customerSalesData.length; i += BATCH_SIZE) {
    const batch = customerSalesData.slice(i, i + BATCH_SIZE);

    const { error: upsertError } = await supabase
      .from('customer_sales')
      .upsert(batch, {
        onConflict: 'customer_id',
        ignoreDuplicates: false,
      });

    if (upsertError) {
      console.error(`⚠️ Batch ${Math.floor(i / BATCH_SIZE) + 1} error:`, upsertError);
      throw new Error(`Upsert error: ${upsertError.message}`);
    }

    totalUpserted += batch.length;
    console.log(`   ✅ Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${totalUpserted}/${customerSalesData.length} records`);
  }

  const totalTime = Date.now() - startTime;
  console.log(`\\n🎉 [SUCCESS] Sync completed in ${(totalTime / 1000).toFixed(1)}s`);
  console.log(`   📊 Total customers synced: ${totalUpserted}`);
  console.log(`   📦 Total deals processed: ${allDeals.length}\\n`);
}

main()
  .then(() => {
    console.log('✨ Step 2 complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\\n💥 [ERROR]:', error.message);
    console.error(error);
    process.exit(1);
  });
