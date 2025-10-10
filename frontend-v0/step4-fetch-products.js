#!/usr/bin/env node

/**
 * STEP 4: Fetch products for each deal from Ploomes and update sales table
 * Uses DealProducts endpoint to get product details
 */

const { createClient } = require('@supabase/supabase-js');
const https = require('https');

const PLOOMES_API_KEY = 'A7EEF49A41433800AFDF42AE5BBF22755D1FC4B863C9B70A87F4CE300F38164058CD54A3E8590E78CDBF986FC8C0F9F4E7FF32884F3D37D58178DD8749EFA1D3';
const PLOOMES_BASE_URL = 'https://public-api2.ploomes.com';
const SUPABASE_URL = 'https://yxwokryybudwygtemfmu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4d29rcnl5YnVkd3lndGVtZm11Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3NDE2ODEsImV4cCI6MjA3NDMxNzY4MX0.ALgRRp1FivPIQ7TltZF7HPDS2d12RNAxTnc_BfRmJUg';

const DELAY_BETWEEN_REQUESTS = 1000;
const BATCH_SIZE = 100;

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function httpsGet(url, headers, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const options = {
      hostname: parsedUrl.hostname,
      port: 443,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers,
      timeout: timeoutMs
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

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    req.end();
  });
}

async function fetchDealProducts(dealId) {
  const url = `${PLOOMES_BASE_URL}/DealProducts?$filter=DealId eq ${dealId}&$expand=Product`;

  try {
    const data = await httpsGet(url, {
      'User-Key': PLOOMES_API_KEY,
      'Content-Type': 'application/json'
    });

    const products = (data.value || []).map(item => ({
      product_id: item.Product?.Id?.toString() || null,
      product_name: item.Product?.Name || item.Name || 'Unknown Product',
      quantity: item.Quantity || 0,
      unit_price: item.UnitPrice || 0,
      total: item.Total || (item.Quantity * item.UnitPrice) || 0,
      category: item.Product?.Category || null
    }));

    return products;
  } catch (error) {
    console.error(`   ⚠️  Error fetching products for deal ${dealId}:`, error.message);
    return [];
  }
}

async function main() {
  const startTime = Date.now();
  console.log('📦 [STEP 4] Fetching products for deals from Ploomes...\n');

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // STEP 1: Get all sales without products
  console.log('📊 [STEP 1] Fetching sales from Supabase...');
  const { data: sales, error: salesError } = await supabase
    .from('sales')
    .select('id, ploomes_deal_id, customer_id, products')
    .order('id');

  if (salesError) {
    throw new Error(`Supabase error: ${salesError.message}`);
  }

  const salesWithoutProducts = sales.filter(s => !s.products || s.products.length === 0);
  console.log(`✅ [STEP 1] Found ${sales.length} total sales, ${salesWithoutProducts.length} without products\n`);

  if (salesWithoutProducts.length === 0) {
    console.log('✨ All sales already have products!');
    return;
  }

  // STEP 2: Fetch products for each deal
  console.log('🔄 [STEP 2] Fetching products from Ploomes API...');
  let processed = 0;
  let withProducts = 0;
  const updates = [];

  for (const sale of salesWithoutProducts) {
    processed++;

    if (processed % 10 === 0) {
      console.log(`   ⏳ Progress: ${processed}/${salesWithoutProducts.length} deals processed...`);
    }

    const products = await fetchDealProducts(sale.ploomes_deal_id);

    if (products.length > 0) {
      withProducts++;
      updates.push({
        id: sale.id,
        products: products
      });
    }

    // Respect rate limits
    if (processed % 50 === 0) {
      console.log(`   ⏸️  Rate limit pause (50 requests)...`);
      await delay(5000);
    } else {
      await delay(DELAY_BETWEEN_REQUESTS);
    }
  }

  console.log(`✅ [STEP 2] Fetched products for ${withProducts}/${salesWithoutProducts.length} deals\n`);

  // STEP 3: Update sales in batches
  if (updates.length === 0) {
    console.log('ℹ️  No products found to update');
    return;
  }

  console.log('💾 [STEP 3] Updating sales with products...');
  let totalUpdated = 0;

  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const batch = updates.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(updates.length / BATCH_SIZE);

    for (const update of batch) {
      const { error: updateError } = await supabase
        .from('sales')
        .update({ products: update.products })
        .eq('id', update.id);

      if (updateError) {
        console.error(`   ⚠️  Error updating sale ${update.id}:`, updateError.message);
      } else {
        totalUpdated++;
      }
    }

    console.log(`   ✅ Batch ${batchNum}/${totalBatches}: ${totalUpdated}/${updates.length} records updated`);
  }

  const totalTime = Date.now() - startTime;
  console.log(`\n🎉 [SUCCESS] Products sync completed in ${(totalTime / 1000).toFixed(1)}s`);
  console.log(`   📊 Total sales updated: ${totalUpdated}`);
  console.log(`   📦 Sales with products: ${withProducts}`);
  console.log(`   📦 Sales without products: ${salesWithoutProducts.length - withProducts}\n`);
  console.log('✨ Step 4 complete!');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n💥 [ERROR]', error.message);
    process.exit(1);
  });
