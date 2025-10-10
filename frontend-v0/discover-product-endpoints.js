#!/usr/bin/env node

/**
 * Discover which product-related endpoints actually exist in Ploomes API
 */

const https = require('https');

const PLOOMES_API_KEY = 'A7EEF49A41433800AFDF42AE5BBF22755D1FC4B863C9B70A87F4CE300F38164058CD54A3E8590E78CDBF986FC8C0F9F4E7FF32884F3D37D58178DD8749EFA1D3';
const PLOOMES_BASE_URL = 'https://public-api2.ploomes.com';

function httpsGet(url, headers) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const options = {
      hostname: parsedUrl.hostname,
      port: 443,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers,
      timeout: 10000
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          data: res.statusCode >= 200 && res.statusCode < 300 ? JSON.parse(data) : data
        });
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Timeout'));
    });
    req.end();
  });
}

async function testEndpoint(name, url) {
  try {
    const result = await httpsGet(url, {
      'User-Key': PLOOMES_API_KEY,
      'Content-Type': 'application/json'
    });

    if (result.status === 200) {
      const count = result.data.value?.length || 0;
      console.log(`✅ ${name.padEnd(30)} - ${count} records`);
      if (count > 0) {
        console.log(`   Sample: ${JSON.stringify(result.data.value[0]).substring(0, 100)}...`);
      }
      return true;
    } else if (result.status === 404) {
      console.log(`❌ ${name.padEnd(30)} - NOT FOUND (404)`);
      return false;
    } else {
      console.log(`⚠️  ${name.padEnd(30)} - HTTP ${result.status}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ ${name.padEnd(30)} - ERROR: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('🔍 Discovering product-related endpoints in Ploomes API\n');
  console.log('='.repeat(70) + '\n');

  const endpoints = [
    ['Products', `${PLOOMES_BASE_URL}/Products?$top=1`],
    ['ProposalProducts', `${PLOOMES_BASE_URL}/ProposalProducts?$top=1`],
    ['SaleProducts', `${PLOOMES_BASE_URL}/SaleProducts?$top=1`],
    ['QuoteProducts', `${PLOOMES_BASE_URL}/QuoteProducts?$top=1`],
    ['OrderProducts', `${PLOOMES_BASE_URL}/OrderProducts?$top=1`],
    ['DealProducts', `${PLOOMES_BASE_URL}/DealProducts?$top=1`],
    ['Quotes', `${PLOOMES_BASE_URL}/Quotes?$top=1`],
    ['Orders', `${PLOOMES_BASE_URL}/Orders?$top=1`],
    ['Deals', `${PLOOMES_BASE_URL}/Deals?$top=1`],
  ];

  console.log('📊 Testing endpoints:\n');

  for (const [name, url] of endpoints) {
    await testEndpoint(name, url);
  }

  console.log('\n' + '='.repeat(70));
  console.log('\n🎯 RECOMMENDATION:');
  console.log('Based on the results above, the working product endpoints are marked with ✅');
  console.log('Use ONLY those endpoints in your sync scripts.\n');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n💥 Fatal error:', error);
    process.exit(1);
  });
