#!/usr/bin/env node

/**
 * STEP 4: Fetch products for ALL 10,228 deals and update Supabase
 *
 * Correct method:
 * 1. For each deal, fetch Quotes with $expand=Products
 * 2. For each deal, fetch Orders with $expand=Products
 * 3. Update sales table in Supabase with products data
 */

const https = require('https');
const fs = require('fs');

const PLOOMES_API_KEY = 'A7EEF49A41433800AFDF42AE5BBF22755D1FC4B863C9B70A87F4CE300F38164058CD54A3E8590E78CDBF986FC8C0F9F4E7FF32884F3D37D58178DD8749EFA1D3';
const PLOOMES_BASE_URL = 'https://public-api2.ploomes.com';
const DELAY_BETWEEN_REQUESTS = 500; // 500ms = 120 requests/minute
const CHECKPOINT_INTERVAL = 100; // Save progress every 100 deals
const PROGRESS_FILE = 'products-fetch-progress.json';

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

async function fetchProductsForDeal(dealId) {
  const allProducts = [];

  try {
    // Get products from Quotes
    const quotesUrl = `${PLOOMES_BASE_URL}/Quotes?$filter=DealId eq ${dealId}&$expand=Products`;
    const quotesData = await httpsGet(quotesUrl, {
      'User-Key': PLOOMES_API_KEY,
      'Content-Type': 'application/json'
    });

    if (quotesData.value && quotesData.value.length > 0) {
      for (const quote of quotesData.value) {
        const products = quote.Products || [];
        if (products.length > 0) {
          const quoteProducts = products.map(p => ({
            product_id: p.ProductId?.toString() || null,
            product_name: p.ProductName || 'Unknown Product',
            quantity: p.Quantity || 0,
            unit_price: p.UnitPrice || 0,
            total: p.Total || 0,
            discount: p.Discount || 0,
            source: 'quote',
            quote_id: quote.Id
          })).filter(p => p.product_id);
          allProducts.push(...quoteProducts);
        }
      }
    }

    await delay(DELAY_BETWEEN_REQUESTS);

    // Get products from Orders
    const ordersUrl = `${PLOOMES_BASE_URL}/Orders?$filter=DealId eq ${dealId}&$expand=Products`;
    const ordersData = await httpsGet(ordersUrl, {
      'User-Key': PLOOMES_API_KEY,
      'Content-Type': 'application/json'
    });

    if (ordersData.value && ordersData.value.length > 0) {
      for (const order of ordersData.value) {
        const products = order.Products || [];
        if (products.length > 0) {
          const orderProducts = products.map(p => ({
            product_id: p.ProductId?.toString() || null,
            product_name: p.ProductName || 'Unknown Product',
            quantity: p.Quantity || 0,
            unit_price: p.UnitPrice || 0,
            total: p.Total || 0,
            discount: p.Discount || 0,
            source: 'order',
            order_id: order.Id
          })).filter(p => p.product_id);
          allProducts.push(...orderProducts);
        }
      }
    }

  } catch (error) {
    console.error(`   ⚠️  Error for deal ${dealId}: ${error.message}`);
  }

  return allProducts;
}

function loadProgress() {
  if (fs.existsSync(PROGRESS_FILE)) {
    return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
  }
  return { lastProcessedIndex: -1, stats: { total: 0, withProducts: 0, totalProducts: 0 } };
}

function saveProgress(index, stats) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify({ lastProcessedIndex: index, stats }, null, 2));
}

async function main() {
  const startTime = Date.now();
  console.log('📦 [FULL SYNC] Fetching products for ALL deals...\n');
  console.log('='.repeat(70) + '\n');

  // Load deals
  const dealsFile = 'ploomes-deals.json';
  if (!fs.existsSync(dealsFile)) {
    throw new Error(`File not found: ${dealsFile}`);
  }

  const allDeals = JSON.parse(fs.readFileSync(dealsFile, 'utf8'));
  console.log(`✅ Loaded ${allDeals.length} deals\n`);

  // Load progress
  const progress = loadProgress();
  const startIndex = progress.lastProcessedIndex + 1;
  const stats = progress.stats;

  if (startIndex > 0) {
    console.log(`📂 Resuming from deal ${startIndex + 1} (${allDeals.length - startIndex} remaining)\n`);
  }

  console.log(`🚀 Processing ${allDeals.length - startIndex} deals...\n`);

  // Process each deal
  for (let i = startIndex; i < allDeals.length; i++) {
    const deal = allDeals[i];

    // Progress indicator
    if (i % 100 === 0 || i === startIndex) {
      const pct = ((i / allDeals.length) * 100).toFixed(1);
      const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
      const eta = i > startIndex ? (((Date.now() - startTime) / (i - startIndex)) * (allDeals.length - i) / 1000 / 60).toFixed(1) : '?';

      console.log(`\n[${i + 1}/${allDeals.length}] ${pct}% | ${elapsed}min elapsed | ETA: ${eta}min`);
      console.log(`Stats: ${stats.withProducts} deals with products | ${stats.totalProducts} total products\n`);
    }

    const products = await fetchProductsForDeal(deal.Id);

    stats.total++;
    if (products.length > 0) {
      stats.withProducts++;
      stats.totalProducts += products.length;
      deal.Products = products;

      // Show progress for deals with products
      if (products.length > 5) {
        console.log(`   ✅ Deal ${deal.Id}: ${products.length} products`);
      }
    } else {
      deal.Products = [];
    }

    // Checkpoint
    if (i > 0 && i % CHECKPOINT_INTERVAL === 0) {
      saveProgress(i, stats);
      fs.writeFileSync('ploomes-deals-with-products.json', JSON.stringify(allDeals, null, 2));
      console.log(`   💾 Checkpoint saved (${i} deals processed)\n`);
    }

    await delay(DELAY_BETWEEN_REQUESTS);
  }

  const totalTime = Date.now() - startTime;

  // Final save
  fs.writeFileSync('ploomes-deals-with-products.json', JSON.stringify(allDeals, null, 2));
  saveProgress(allDeals.length - 1, stats);

  console.log(`\n${'='.repeat(70)}`);
  console.log(`📊 FINAL RESULTS:`);
  console.log(`   Total deals: ${stats.total}`);
  console.log(`   Deals with products: ${stats.withProducts} (${((stats.withProducts/stats.total)*100).toFixed(1)}%)`);
  console.log(`   Total products: ${stats.totalProducts}`);
  console.log(`   Average products per deal: ${(stats.totalProducts/stats.total).toFixed(2)}`);
  console.log(`   Time elapsed: ${(totalTime/1000/60).toFixed(1)} minutes`);
  console.log(`${'='.repeat(70)}\n`);

  console.log('💾 All deals saved to ploomes-deals-with-products.json\n');

  console.log('🎯 NEXT STEP: Update Supabase sales with products');
  console.log('   Command: node step5-update-sales-with-products.js\n');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n💥 ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  });
