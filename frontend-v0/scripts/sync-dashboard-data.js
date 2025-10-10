#!/usr/bin/env node

/**
 * Dashboard Data Sync Script
 *
 * Syncs products and sales data from Ploomes to Supabase
 * for dashboard analytics.
 *
 * Usage:
 *   node scripts/sync-dashboard-data.js
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

// Validate environment variables
if (!PLOOMES_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing required environment variables');
  console.error('Required: PLOOMES_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY');
  process.exit(1);
}

// Create API clients
const ploomesApi = axios.create({
  baseURL: PLOOMES_BASE_URL,
  headers: {
    'User-Key': PLOOMES_API_KEY,
    'Content-Type': 'application/json',
  },
  timeout: 60000,
});

const supabaseApi = axios.create({
  baseURL: `${SUPABASE_URL}/rest/v1`,
  headers: {
    'apikey': SUPABASE_SERVICE_KEY,
    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=minimal',
  },
  timeout: 60000,
});

/**
 * Fetch products from Ploomes
 */
async function fetchPloomesProducts() {
  console.log('📦 Fetching products from Ploomes...');

  try {
    const response = await ploomesApi.get('/Products', {
      params: {
        $select: 'Id,Name,Code,Price,IsActive',
        $top: 1000,
      },
    });

    const products = response.data.value || [];
    console.log(`✅ Fetched ${products.length} products from Ploomes`);
    return products;
  } catch (error) {
    console.error('❌ Error fetching products:', error.message);
    throw error;
  }
}

/**
 * Fetch deals (sales) from Ploomes
 */
async function fetchPloomesDeals() {
  console.log('💰 Fetching deals from Ploomes...');

  try {
    const response = await ploomesApi.get('/Deals', {
      params: {
        $select: 'Id,Title,Amount,StageId,ContactId,CreateDate,LastStageUpdate',
        $expand: 'Products($select=ProductId,Quantity,Price,Total)',
        $filter: 'StageId eq 3', // Only won deals
        $top: 5000,
        $orderby: 'CreateDate desc',
      },
    });

    const deals = response.data.value || [];
    console.log(`✅ Fetched ${deals.length} deals from Ploomes`);
    return deals;
  } catch (error) {
    console.error('❌ Error fetching deals:', error.message);
    throw error;
  }
}

/**
 * Sync products to Supabase
 */
async function syncProducts(products) {
  console.log('🔄 Syncing products to Supabase...');

  const transformedProducts = products.map((product) => ({
    ploomes_product_id: product.Id?.toString(),
    name: product.Name || 'Unknown Product',
    code: product.Code || null,
    price: product.Price || 0,
    is_active: product.IsActive || false,
    synced_at: new Date().toISOString(),
  }));

  try {
    // Upsert products (insert or update)
    await supabaseApi.post('/products', transformedProducts, {
      headers: {
        'Prefer': 'resolution=merge-duplicates',
      },
    });

    console.log(`✅ Synced ${transformedProducts.length} products to Supabase`);
  } catch (error) {
    console.error('❌ Error syncing products:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Sync sales to Supabase
 */
async function syncSales(deals) {
  console.log('🔄 Syncing sales to Supabase...');

  const salesData = [];

  // Process each deal and its products
  for (const deal of deals) {
    if (!deal.Products || deal.Products.length === 0) continue;

    for (const product of deal.Products) {
      salesData.push({
        ploomes_deal_id: deal.Id?.toString(),
        ploomes_product_id: product.ProductId?.toString(),
        ploomes_customer_id: deal.ContactId?.toString(),
        quantity: product.Quantity || 0,
        unit_price: product.Price || 0,
        total_amount: product.Total || 0,
        sale_date: deal.LastStageUpdate || deal.CreateDate,
        synced_at: new Date().toISOString(),
      });
    }
  }

  if (salesData.length === 0) {
    console.log('⚠️  No sales data to sync');
    return;
  }

  try {
    // Batch insert sales (chunks of 500)
    const chunkSize = 500;
    for (let i = 0; i < salesData.length; i += chunkSize) {
      const chunk = salesData.slice(i, i + chunkSize);
      await supabaseApi.post('/sales', chunk);
      console.log(`✅ Synced ${i + chunk.length}/${salesData.length} sales records`);
    }

    console.log(`✅ Total sales records synced: ${salesData.length}`);
  } catch (error) {
    console.error('❌ Error syncing sales:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Main sync function
 */
async function main() {
  console.log('🚀 Starting dashboard data sync...\n');

  const startTime = Date.now();

  try {
    // Fetch data from Ploomes
    const [products, deals] = await Promise.all([
      fetchPloomesProducts(),
      fetchPloomesDeals(),
    ]);

    // Sync to Supabase
    await syncProducts(products);
    await syncSales(deals);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n✅ Sync completed successfully in ${duration}s`);
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Sync failed:', error.message);
    process.exit(1);
  }
}

// Run the script
main();