#!/usr/bin/env node

/**
 * Standalone script to sync Ploomes data to Supabase
 * Uses native Node.js https module to avoid Supabase fetch polyfill issues
 *
 * Run with: node sync-ploomes-data.js
 */

const { createClient } = require('@supabase/supabase-js');
const https = require('https');

// Configuration
const PLOOMES_API_KEY = 'A7EEF49A41433800AFDF42AE5BBF22755D1FC4B863C9B70A87F4CE300F38164058CD54A3E8590E78CDBF986FC8C0F9F4E7FF32884F3D37D58178DD8749EFA1D3';
const PLOOMES_BASE_URL = 'https://public-api2.ploomes.com';
const SUPABASE_URL = 'https://yxwokryybudwygtemfmu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4d29rcnl5YnVkd3lndGVtZm11Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3NDE2ODEsImV4cCI6MjA3NDMxNzY4MX0.ALgRRp1FivPIQ7TltZF7HPDS2d12RNAxTnc_BfRmJUg';

const PAGE_SIZE = 50;
const MAX_PAGES = 200;
const DELAY_BETWEEN_REQUESTS = 1000; // 1 second = 60 req/min

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Helper to make HTTPS requests with native Node.js (avoid Supabase fetch polyfill)
function httpsGet(url, headers) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const options = {
      hostname: parsedUrl.hostname,
      port: 443,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch (err) {
            reject(new Error(`JSON parse error: ${err.message}`));
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.end();
  });
}

async function main() {
  const startTime = Date.now();

  console.log('🔄 Starting Ploomes → Supabase sync...\n');

  // Initialize Supabase
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // STEP 1: Get customers
  console.log('📊 [STEP 1] Fetching customers from Supabase...');
  const { data: customers, error: customersError } = await supabase
    .from('customers')
    .select('id, name, cnpj, cpf');

  if (customersError) {
    throw new Error(`Supabase error: ${customersError.message}`);
  }

  console.log(`✅ [STEP 1] Fetched ${customers?.length || 0} customers\n`);

  // STEP 2: Fetch deals from Ploomes
  console.log('📦 [STEP 2] Fetching deals from Ploomes...');

  const allDeals = [];
  let skip = 0;

  console.log('⏳ Waiting 2s before starting...');
  await delay(2000);

  for (let page = 0; page < MAX_PAGES; page++) {
    const url = `${PLOOMES_BASE_URL}/Deals?$select=Id,ContactId,Amount,LastUpdateDate,Title,StageId,Products,Win,Lose&$top=${PAGE_SIZE}&$skip=${skip}`;

    console.log(`🌐 Page ${page + 1}: Fetching ${PAGE_SIZE} deals (skip=${skip})...`);

    try {
      // Use native https module instead of fetch (Supabase polyfills fetch and breaks it)
      const data = await httpsGet(url, {
        'User-Key': PLOOMES_API_KEY,
        'Content-Type': 'application/json'
      });

      const deals = data.value || [];

      if (deals.length === 0) {
        console.log('   ℹ️  No more deals to fetch');
        break;
      }

      allDeals.push(...deals);
      console.log(`   ✅ Fetched ${deals.length} deals (total: ${allDeals.length})`);

      if (deals.length < PAGE_SIZE) break;
      skip += PAGE_SIZE;

      // Rate limiting
      if (page < MAX_PAGES - 1) {
        await delay(DELAY_BETWEEN_REQUESTS);
      }
    } catch (error) {
      console.error(`   ❌ Error on page ${page + 1}:`, error.message);
      throw error;
    }
  }

  console.log(`✅ [STEP 2] Total deals fetched: ${allDeals.length}\n`);

  // STEP 3: Aggregate sales by customer
  console.log('🔄 [STEP 3] Aggregating sales data...');

  const salesByCustomer = new Map();

  for (const deal of allDeals) {
    if (!deal.ContactId) continue;

    const contactId = deal.ContactId;
    const date = deal.LastUpdateDate || new Date().toISOString();
    const amount = deal.Amount || 0;
    const isWon = deal.Win === true;
    const isLost = deal.Lose === true;
    const isOpen = !isWon && !isLost;

    const existing = salesByCustomer.get(contactId);

    if (existing) {
      existing.totalDeals += 1;
      if (isWon) {
        existing.wonDeals += 1;
        existing.totalSales += amount;
        existing.totalRevenue += amount;
      }
      if (isLost) existing.lostDeals += 1;
      if (isOpen) existing.openDeals += 1;

      if (!existing.firstPurchaseDate || date < existing.firstPurchaseDate) {
        existing.firstPurchaseDate = date;
      }
      if (!existing.lastPurchaseDate || date > existing.lastPurchaseDate) {
        existing.lastPurchaseDate = date;
      }

      // Track products
      if (deal.Products && Array.isArray(deal.Products)) {
        deal.Products.forEach(p => {
          if (p.ProductId) existing.productsPurchased.add(p.ProductId);
        });
      }
    } else {
      salesByCustomer.set(contactId, {
        totalSales: isWon ? amount : 0,
        totalDeals: 1,
        wonDeals: isWon ? 1 : 0,
        openDeals: isOpen ? 1 : 0,
        lostDeals: isLost ? 1 : 0,
        totalRevenue: isWon ? amount : 0,
        firstPurchaseDate: date,
        lastPurchaseDate: date,
        productsPurchased: new Set(
          deal.Products?.map(p => p.ProductId).filter(Boolean) || []
        ),
      });
    }
  }

  console.log(`✅ [STEP 3] Aggregated ${salesByCustomer.size} customers with sales\n`);

  // STEP 4: Prepare data for upsert
  console.log('💾 [STEP 4] Preparing data for database...');

  const customerSalesData = (customers || [])
    .map((customer) => {
      const sales = salesByCustomer.get(customer.id);

      if (!sales) return null;

      const daysSinceLastPurchase = sales.lastPurchaseDate
        ? Math.floor((Date.now() - new Date(sales.lastPurchaseDate).getTime()) / (1000 * 60 * 60 * 24))
        : null;

      const productsArray = Array.from(sales.productsPurchased);

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
        products_purchased: productsArray,
        total_products: productsArray.length,
        first_purchase_date: sales.firstPurchaseDate,
        last_purchase_date: sales.lastPurchaseDate,
        days_since_last_purchase: daysSinceLastPurchase,
        has_custom_pricing: false,
        pricing_history_count: 0,
      };
    })
    .filter(item => item !== null);

  console.log(`✅ [STEP 4] Prepared ${customerSalesData.length} records\n`);

  // STEP 5: Upsert to Supabase
  console.log('💾 [STEP 5] Upserting to Supabase...');

  const BATCH_SIZE = 500;
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
  console.log(`\n🎉 [SUCCESS] Sync completed in ${(totalTime / 1000).toFixed(1)}s`);
  console.log(`   📊 Total customers synced: ${totalUpserted}`);
  console.log(`   📦 Total deals processed: ${allDeals.length}`);
  console.log(`   ⏱️  Average time per request: ${(totalTime / (skip / PAGE_SIZE)).toFixed(0)}ms\n`);
}

main()
  .then(() => {
    console.log('✨ Sync complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 [ERROR] Sync failed:', error.message);
    console.error(error);
    process.exit(1);
  });
