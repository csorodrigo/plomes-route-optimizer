#!/usr/bin/env node

/**
 * CORRECTED APPROACH: Fetch products via Quotes and Orders with $expand=Products
 *
 * CORRECT METHOD DISCOVERED:
 * 1. Fetch Quotes for Deal: /Quotes?$filter=DealId eq {id}&$expand=Products
 * 2. Fetch Orders for Deal: /Orders?$filter=DealId eq {id}&$expand=Products
 * 3. Products come embedded in the Quote/Order response
 *
 * NOT NEEDED: ProposalProducts, SaleProducts endpoints (they don't exist)
 */

const https = require('https');
const fs = require('fs');

const PLOOMES_API_KEY = 'A7EEF49A41433800AFDF42AE5BBF22755D1FC4B863C9B70A87F4CE300F38164058CD54A3E8590E78CDBF986FC8C0F9F4E7FF32884F3D37D58178DD8749EFA1D3';
const PLOOMES_BASE_URL = 'https://public-api2.ploomes.com';
const DELAY_BETWEEN_REQUESTS = 500; // 500ms = 120 requests/minute

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
    // Strategy 1: Get products from Quotes with $expand=Products
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
          })).filter(p => p.product_id); // Only include products with valid ID

          allProducts.push(...quoteProducts);
        }
      }
    }

    await delay(DELAY_BETWEEN_REQUESTS);

    // Strategy 2: Get products from Orders with $expand=Products
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
          })).filter(p => p.product_id); // Only include products with valid ID

          allProducts.push(...orderProducts);
        }
      }
    }

  } catch (error) {
    console.error(`   ⚠️  Error fetching products for deal ${dealId}:`, error.message);
  }

  return allProducts;
}

async function main() {
  const startTime = Date.now();
  console.log('📦 [CORRECTED] Fetching products for deals...\n');
  console.log('ℹ️  Method: Deals → Quotes($expand=Products) + Orders($expand=Products)\n');
  console.log('='.repeat(70) + '\n');

  // Load existing deals
  const dealsFile = 'ploomes-deals.json';
  if (!fs.existsSync(dealsFile)) {
    throw new Error(`File not found: ${dealsFile}`);
  }

  const allDeals = JSON.parse(fs.readFileSync(dealsFile, 'utf8'));
  console.log(`✅ Loaded ${allDeals.length} deals\n`);

  // Test with SAMPLE first
  const SAMPLE_SIZE = 20;
  console.log(`🧪 Testing with ${SAMPLE_SIZE} deals first...\n`);

  let dealsWithProducts = 0;
  let totalProducts = 0;
  const productsBySource = { quote: 0, order: 0 };

  for (let i = 0; i < Math.min(SAMPLE_SIZE, allDeals.length); i++) {
    const deal = allDeals[i];
    console.log(`[${i + 1}/${SAMPLE_SIZE}] Deal ${deal.Id}: ${(deal.Title || 'No title').substring(0, 50)}`);

    const products = await fetchProductsForDeal(deal.Id);

    if (products.length > 0) {
      dealsWithProducts++;
      totalProducts += products.length;
      deal.Products = products;

      // Count by source
      products.forEach(p => {
        productsBySource[p.source]++;
      });

      console.log(`   ✅ ${products.length} products`);
      console.log(`      Quotes: ${products.filter(p => p.source === 'quote').length}`);
      console.log(`      Orders: ${products.filter(p => p.source === 'order').length}`);

      // Show first product
      if (products.length > 0) {
        const p = products[0];
        console.log(`      Sample: ${p.product_name} (${p.product_id})`);
      }
    } else {
      deal.Products = [];
      console.log(`   ℹ️  No products`);
    }

    await delay(DELAY_BETWEEN_REQUESTS);
  }

  const totalTime = Date.now() - startTime;

  console.log(`\n${'='.repeat(70)}`);
  console.log(`📊 SAMPLE TEST RESULTS:`);
  console.log(`   Deals tested: ${SAMPLE_SIZE}`);
  console.log(`   Deals with products: ${dealsWithProducts} (${((dealsWithProducts/SAMPLE_SIZE)*100).toFixed(1)}%)`);
  console.log(`   Total products: ${totalProducts}`);
  console.log(`   Products from quotes: ${productsBySource.quote}`);
  console.log(`   Products from orders: ${productsBySource.order}`);
  console.log(`   Average per deal: ${(totalProducts/SAMPLE_SIZE).toFixed(2)}`);
  console.log(`   Time: ${(totalTime/1000).toFixed(1)}s`);
  console.log(`${'='.repeat(70)}\n`);

  // Save sample
  const sampleFile = 'deals-with-products-sample.json';
  fs.writeFileSync(sampleFile, JSON.stringify(allDeals.slice(0, SAMPLE_SIZE), null, 2));
  console.log(`💾 Sample saved to ${sampleFile}\n`);

  if (dealsWithProducts > 0) {
    console.log('✅ SUCCESS! Products are being fetched correctly.');
    console.log(`\n🎯 NEXT STEP: Run full sync for all ${allDeals.length} deals?`);
    console.log('   Command: node step4-fetch-products-ALL.js\n');
  } else {
    console.log('⚠️  WARNING: No products found in sample.');
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n💥 ERROR:', error.message);
    process.exit(1);
  });
