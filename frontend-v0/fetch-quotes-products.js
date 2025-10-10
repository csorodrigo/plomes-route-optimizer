#!/usr/bin/env node

/**
 * Fetch Products from Ploomes QUOTES endpoint
 * Research descobriu que produtos estão em Quotes, não diretamente em Deals
 */

const https = require('https');
const fs = require('fs');

const PLOOMES_API_KEY = 'A7EEF49A41433800AFDF42AE5BBF22755D1FC4B863C9B70A87F4CE300F38164058CD54A3E8590E78CDBF986FC8C0F9F4E7FF32884F3D37D58178DD8749EFA1D3';
const PLOOMES_BASE_URL = 'https://public-api2.ploomes.com';
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

async function fetchQuotesForDeal(dealId) {
  const url = `${PLOOMES_BASE_URL}/Quotes?$filter=Deal/Id eq ${dealId}&$expand=Products($expand=Product($select=Id,Name,Code))&$select=Id,QuoteNumber,Amount,Date`;

  try {
    const data = await httpsGet(url, {
      'User-Key': PLOOMES_API_KEY,
      'Content-Type': 'application/json'
    });

    return data.value || [];
  } catch (error) {
    console.error(`   ❌ Error fetching quotes for deal ${dealId}:`, error.message);
    return [];
  }
}

async function main() {
  console.log('🔍 Fetching Products from Ploomes QUOTES endpoint...\n');

  // Load deals without products
  const deals = JSON.parse(fs.readFileSync('ploomes-deals-with-products.json', 'utf8'));

  // Filter deals that show "Products: 0"
  const dealsWithoutProducts = deals.filter(d => !d.Products || d.Products.length === 0);

  console.log(`📊 Found ${dealsWithoutProducts.length} deals without products`);
  console.log(`🎯 Testing with first 5 deals...\n`);

  const testDeals = dealsWithoutProducts.slice(0, 5);
  const results = [];

  for (const deal of testDeals) {
    console.log(`\n📦 Deal ${deal.Id}: ${deal.Title}`);
    console.log(`   🔍 Fetching quotes...`);

    const quotes = await fetchQuotesForDeal(deal.Id);

    if (quotes.length > 0) {
      console.log(`   ✅ Found ${quotes.length} quote(s)`);

      quotes.forEach((quote, idx) => {
        console.log(`   \n   📝 Quote ${idx + 1}:`);
        console.log(`      ID: ${quote.Id}`);
        console.log(`      Number: ${quote.QuoteNumber || 'N/A'}`);
        console.log(`      Amount: R$ ${quote.Amount || 0}`);

        if (quote.Products && quote.Products.length > 0) {
          console.log(`      Products: ${quote.Products.length}`);
          quote.Products.forEach((item, i) => {
            if (item.Product) {
              console.log(`        ${i + 1}. ${item.Product.Name || 'Unnamed'} (ID: ${item.Product.Id})`);
              console.log(`           Code: ${item.Product.Code || 'N/A'}`);
              console.log(`           Qty: ${item.Quantity || 0}`);
            }
          });
        } else {
          console.log(`      Products: 0 (Quote sem produtos)`);
        }
      });

      results.push({
        dealId: deal.Id,
        dealTitle: deal.Title,
        quotesCount: quotes.length,
        quotes: quotes
      });
    } else {
      console.log(`   ⚠️  No quotes found for this deal`);
    }

    await delay(DELAY_BETWEEN_REQUESTS);
  }

  // Save results
  fs.writeFileSync('quotes-test-results.json', JSON.stringify(results, null, 2));
  console.log(`\n\n💾 Results saved to quotes-test-results.json`);

  // Summary
  const dealsWithQuotes = results.filter(r => r.quotesCount > 0);
  const totalProducts = results.reduce((sum, r) => {
    return sum + r.quotes.reduce((qSum, q) => {
      return qSum + (q.Products ? q.Products.length : 0);
    }, 0);
  }, 0);

  console.log(`\n📊 SUMMARY:`);
  console.log(`   Deals tested: ${results.length}`);
  console.log(`   Deals with quotes: ${dealsWithQuotes.length}`);
  console.log(`   Total products found: ${totalProducts}`);

  if (totalProducts > 0) {
    console.log(`\n✅ SUCCESS! Products ARE in Quotes endpoint!`);
    console.log(`   Next: Create full sync script to fetch all quotes`);
  } else {
    console.log(`\n⚠️  No products found in quotes - need to investigate further`);
  }
}

main()
  .then(() => {
    console.log('\n✨ Test complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 [ERROR]:', error.message);
    console.error(error.stack);
    process.exit(1);
  });
