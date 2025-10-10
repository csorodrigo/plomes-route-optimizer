#!/usr/bin/env node

/**
 * STEP 1 CORRECTED: Fetch deals WITH products via Quotes and Orders
 * Products are NOT in deals directly - they come from:
 * - ProposalProducts (via Quotes)
 * - SaleProducts (via Orders)
 */

const https = require('https');
const fs = require('fs');

const PLOOMES_API_KEY = 'A7EEF49A41433800AFDF42AE5BBF22755D1FC4B863C9B70A87F4CE300F38164058CD54A3E8590E78CDBF986FC8C0F9F4E7FF32884F3D37D58178DD8749EFA1D3';
const PLOOMES_BASE_URL = 'https://public-api2.ploomes.com';
const STATUS_WON = 2;
const PAGE_SIZE = 50;
const DELAY_BETWEEN_REQUESTS = 1000;

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
    // Strategy 1: Get products from Quotes (Proposals)
    const quotesUrl = `${PLOOMES_BASE_URL}/Quotes?$filter=DealId eq ${dealId}`;
    const quotesData = await httpsGet(quotesUrl, {
      'User-Key': PLOOMES_API_KEY,
      'Content-Type': 'application/json'
    });

    if (quotesData.value && quotesData.value.length > 0) {
      for (const quote of quotesData.value) {
        await delay(DELAY_BETWEEN_REQUESTS);

        const productsUrl = `${PLOOMES_BASE_URL}/ProposalProducts?$filter=QuoteId eq ${quote.Id}`;
        const productsData = await httpsGet(productsUrl, {
          'User-Key': PLOOMES_API_KEY,
          'Content-Type': 'application/json'
        });

        if (productsData.value && productsData.value.length > 0) {
          const quoteProducts = productsData.value.map(p => ({
            product_id: (p.ProductId || p.Id)?.toString(),
            product_name: p.ProductName || p.Name || 'Unknown Product',
            quantity: p.Quantity || 0,
            unit_price: p.UnitPrice || 0,
            total: p.Total || (p.Quantity * p.UnitPrice) || 0,
            discount: p.Discount || 0,
            source: 'quote'
          }));

          allProducts.push(...quoteProducts);
        }
      }
    }

    // Strategy 2: Get products from Orders (Sales)
    await delay(DELAY_BETWEEN_REQUESTS);
    const ordersUrl = `${PLOOMES_BASE_URL}/Orders?$filter=DealId eq ${dealId}`;
    const ordersData = await httpsGet(ordersUrl, {
      'User-Key': PLOOMES_API_KEY,
      'Content-Type': 'application/json'
    });

    if (ordersData.value && ordersData.value.length > 0) {
      for (const order of ordersData.value) {
        await delay(DELAY_BETWEEN_REQUESTS);

        const productsUrl = `${PLOOMES_BASE_URL}/SaleProducts?$filter=OrderId eq ${order.Id}`;
        const productsData = await httpsGet(productsUrl, {
          'User-Key': PLOOMES_API_KEY,
          'Content-Type': 'application/json'
        });

        if (productsData.value && productsData.value.length > 0) {
          const orderProducts = productsData.value.map(p => ({
            product_id: (p.ProductId || p.Id)?.toString(),
            product_name: p.ProductName || p.Name || 'Unknown Product',
            quantity: p.Quantity || 0,
            unit_price: p.UnitPrice || 0,
            total: p.Total || (p.Quantity * p.UnitPrice) || 0,
            discount: p.Discount || 0,
            source: 'order'
          }));

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
  console.log('📦 [STEP 1 CORRECTED] Fetching deals WITH products...\n');
  console.log('ℹ️  Strategy: Deals → Quotes → ProposalProducts + Orders → SaleProducts\n');

  // Step 1: Load existing deals
  const dealsFile = 'ploomes-deals.json';
  if (!fs.existsSync(dealsFile)) {
    throw new Error(`File not found: ${dealsFile}. Run step1-fetch-ploomes.js first!`);
  }

  const allDeals = JSON.parse(fs.readFileSync(dealsFile, 'utf8'));
  console.log(`✅ Loaded ${allDeals.length} deals\n`);

  // Step 2: Fetch products for SAMPLE of deals first (testing)
  const SAMPLE_SIZE = 10;
  console.log(`🧪 Testing with ${SAMPLE_SIZE} deals first...\n`);

  let dealsWithProducts = 0;
  let totalProducts = 0;

  for (let i = 0; i < Math.min(SAMPLE_SIZE, allDeals.length); i++) {
    const deal = allDeals[i];
    console.log(`\n📋 [${i + 1}/${SAMPLE_SIZE}] Deal ${deal.Id}: ${deal.Title || 'No title'}`);

    const products = await fetchProductsForDeal(deal.Id);

    if (products.length > 0) {
      dealsWithProducts++;
      totalProducts += products.length;
      deal.Products = products;

      console.log(`   ✅ Found ${products.length} products`);
      console.log(`      From quotes: ${products.filter(p => p.source === 'quote').length}`);
      console.log(`      From orders: ${products.filter(p => p.source === 'order').length}`);
    } else {
      deal.Products = [];
      console.log(`   ℹ️  No products found`);
    }

    await delay(DELAY_BETWEEN_REQUESTS);
  }

  const totalTime = Date.now() - startTime;

  console.log(`\n\n${'='.repeat(60)}`);
  console.log(`📊 SAMPLE TEST RESULTS:`);
  console.log(`   Deals tested: ${SAMPLE_SIZE}`);
  console.log(`   Deals with products: ${dealsWithProducts} (${((dealsWithProducts/SAMPLE_SIZE)*100).toFixed(1)}%)`);
  console.log(`   Total products found: ${totalProducts}`);
  console.log(`   Average products per deal: ${(totalProducts/SAMPLE_SIZE).toFixed(2)}`);
  console.log(`   Time elapsed: ${(totalTime/1000).toFixed(1)}s`);
  console.log(`${'='.repeat(60)}\n`);

  // Save sample results
  const sampleFile = 'ploomes-deals-sample.json';
  fs.writeFileSync(sampleFile, JSON.stringify(allDeals.slice(0, SAMPLE_SIZE), null, 2));
  console.log(`💾 Sample saved to ${sampleFile}\n`);

  if (dealsWithProducts > 0) {
    console.log('✅ SUCCESS! Products are being fetched correctly.');
    console.log('🎯 Next step: Run full sync for all 10,228 deals.');
    console.log('   Command: node step1-fetch-all-products.js');
  } else {
    console.log('⚠️  WARNING: No products found in sample.');
    console.log('   This could mean:');
    console.log('   - No quotes or orders exist for these deals');
    console.log('   - Products are stored differently in your Ploomes instance');
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n💥 [ERROR]:', error.message);
    process.exit(1);
  });
