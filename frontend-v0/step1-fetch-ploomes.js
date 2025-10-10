#!/usr/bin/env node

/**
 * STEP 1: Fetch Ploomes data (NO Supabase import to avoid fetch polyfill)
 * Saves deals to deals.json
 */

const https = require('https');
const fs = require('fs');

const PLOOMES_API_KEY = 'A7EEF49A41433800AFDF42AE5BBF22755D1FC4B863C9B70A87F4CE300F38164058CD54A3E8590E78CDBF986FC8C0F9F4E7FF32884F3D37D58178DD8749EFA1D3';
const PLOOMES_BASE_URL = 'https://public-api2.ploomes.com';
const PAGE_SIZE = 50;
const DELAY_BETWEEN_REQUESTS = 1000;

// StatusId: 1=Em aberto, 2=Ganha, 3=Perdida
const STATUS_WON = 2; // Only fetch won/closed deals

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

async function main() {
  const startTime = Date.now();
  console.log('📦 [STEP 1] Fetching WON deals from Ploomes...\n');
  console.log('ℹ️  Filter: StatusId = 2 (Ganha/Fechada)\n');

  const allDeals = [];
  let skip = 0;
  let page = 0;
  let isLastPage = false;

  console.log('⏳ Waiting 2s before starting...');
  await delay(2000);

  while (!isLastPage) {
    page++;
    // Filter by StatusId=2 (won/closed deals) and expand Products to get product details
    const url = `${PLOOMES_BASE_URL}/Deals?$select=Id,ContactId,Amount,LastUpdateDate,Title,StatusId&$expand=Products&$filter=StatusId eq ${STATUS_WON}&$top=${PAGE_SIZE}&$skip=${skip}`;

    console.log(`🌐 Page ${page}: Fetching ${PAGE_SIZE} won deals with products (skip=${skip})...`);

    let retries = 0;
    const MAX_RETRIES = 3;
    let success = false;

    while (retries < MAX_RETRIES && !success) {
      try {
        const data = await httpsGet(url, {
          'User-Key': PLOOMES_API_KEY,
          'Content-Type': 'application/json'
        });

        const deals = data.value || [];

        if (deals.length === 0) {
          console.log('   ℹ️  No more deals to fetch');
          success = true;
          isLastPage = true;
          break;
        }

        allDeals.push(...deals);
        console.log(`   ✅ Fetched ${deals.length} deals (total: ${allDeals.length})`);

        if (deals.length < PAGE_SIZE) {
          console.log('   ℹ️  Last page reached (less than PAGE_SIZE results)');
          success = true;
          isLastPage = true;
          break;
        }

        skip += PAGE_SIZE;
        success = true;
      } catch (error) {
        retries++;
        console.error(`   ⚠️  Error on page ${page} (attempt ${retries}/${MAX_RETRIES}):`, error.message);

        if (retries < MAX_RETRIES) {
          const waitTime = retries * 3000; // Exponential backoff: 3s, 6s, 9s
          console.log(`   ⏳ Waiting ${waitTime / 1000}s before retry...`);
          await delay(waitTime);
        } else {
          console.error(`   ❌ Failed after ${MAX_RETRIES} retries, continuing to next page...`);
          skip += PAGE_SIZE; // Skip this page to avoid infinite loop
        }
      }
    }

    if (retries >= MAX_RETRIES) {
      // If max retries reached and still on same page, break to avoid infinite loop
      break;
    }

    if (success && allDeals.length > 0 && allDeals.length % (PAGE_SIZE * 10) === 0) {
      // Save checkpoint every 500 deals (10 pages)
      console.log(`   💾 Checkpoint: Saving ${allDeals.length} deals to ploomes-deals-checkpoint.json`);
      fs.writeFileSync('ploomes-deals-checkpoint.json', JSON.stringify(allDeals, null, 2));
    }

    await delay(DELAY_BETWEEN_REQUESTS);
  }

  const totalTime = Date.now() - startTime;
  console.log(`\n✅ [STEP 1] Fetched ${allDeals.length} deals in ${(totalTime / 1000).toFixed(1)}s`);

  // Save to file
  const outputFile = 'ploomes-deals.json';
  fs.writeFileSync(outputFile, JSON.stringify(allDeals, null, 2));
  console.log(`💾 Saved to ${outputFile}\n`);
}

main()
  .then(() => {
    console.log('✨ Step 1 complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 [ERROR]:', error.message);
    process.exit(1);
  });
