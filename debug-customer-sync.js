#!/usr/bin/env node

/**
 * CRITICAL DEBUGGING - Customer Sync API Issues
 *
 * Testing both customer APIs to identify why regular API returns only 15
 * customers while sync API returns 2000+ customers correctly.
 */

const https = require('https');
const http = require('http');

// Simulate the exact API call that the frontend makes
async function makeHttpRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const isHttps = urlObj.protocol === 'https:';
        const client = isHttps ? https : http;

        const reqOptions = {
            hostname: urlObj.hostname,
            port: urlObj.port || (isHttps ? 443 : 80),
            path: urlObj.pathname + urlObj.search,
            method: options.method || 'GET',
            headers: {
                'User-Agent': 'PlomesRotaCEP/1.0-Debug',
                'Content-Type': 'application/json',
                ...options.headers
            },
            timeout: options.timeout || 30000
        };

        const req = client.request(reqOptions, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                resolve({
                    ok: res.statusCode >= 200 && res.statusCode < 300,
                    status: res.statusCode,
                    statusText: res.statusMessage,
                    data: data,
                    json: () => JSON.parse(data)
                });
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });

        if (options.body) {
            req.write(options.body);
        }

        req.end();
    });
}

// Test both customer APIs
async function testCustomerAPIs() {
    console.log('🔍 DEBUGGING CUSTOMER API DISCREPANCY');
    console.log('=' * 60);

    const baseUrl = 'https://plomes-rota-cep.vercel.app';

    console.log('\n📊 TESTING REGULAR CUSTOMERS API (/api/customers)');
    console.log('-' * 50);

    try {
        const response = await makeHttpRequest(`${baseUrl}/api/customers`);
        const data = response.json();

        console.log('✅ Regular API Status:', response.status);
        console.log('📦 Response Summary:');
        console.log(`   - Success: ${data.success}`);
        console.log(`   - Total customers: ${data.total}`);
        console.log(`   - Total in Ploome: ${data.total_in_ploome}`);
        console.log(`   - Source: ${data.source}`);

        console.log('\n🔍 CRITICAL ANALYSIS:');
        if (data.total <= 15) {
            console.log('❌ PROBLEM CONFIRMED: Regular API returns only 15 customers');
            console.log('   This suggests a hardcoded limit in the API code');
        }

        if (data.customers && data.customers.length > 0) {
            console.log(`📋 Customer sample (showing first 3 of ${data.customers.length}):`);
            data.customers.slice(0, 3).forEach((customer, i) => {
                console.log(`   ${i + 1}. ${customer.name} (ID: ${customer.id})`);
                console.log(`      Address: ${customer.address}`);
                console.log(`      Coords: ${customer.latitude}, ${customer.longitude}`);
            });
        }

    } catch (error) {
        console.log('❌ Regular API Error:', error.message);
    }

    console.log('\n📊 TESTING SYNC CUSTOMERS API (/api/sync/customers)');
    console.log('-' * 50);

    try {
        const response = await makeHttpRequest(`${baseUrl}/api/sync/customers`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
            timeout: 60000 // Longer timeout for sync
        });
        const data = response.json();

        console.log('✅ Sync API Status:', response.status);
        console.log('📦 Response Summary:');
        console.log(`   - Success: ${data.success}`);
        console.log(`   - Total customers: ${data.details?.total_customers || 0}`);
        console.log(`   - Fetched: ${data.details?.fetched || 0}`);
        console.log(`   - Processed: ${data.details?.processed || 0}`);
        console.log(`   - Duration: ${data.details?.duration || 0}s`);
        console.log(`   - Source: ${data.metadata?.source}`);

        console.log('\n🔍 CRITICAL ANALYSIS:');
        if (data.details?.total_customers > 2000) {
            console.log('✅ SYNC API WORKS: Returns 2000+ customers correctly');
            console.log('   This confirms Ploome API integration is working');
        } else if (data.details?.total_customers > 15) {
            console.log(`⚠️  PARTIAL SUCCESS: Returns ${data.details.total_customers} customers (more than 15)`);
        } else {
            console.log('❌ SYNC API ALSO LIMITED: Returns same low number');
        }

        if (data.details?.customers_preview) {
            console.log(`📋 Sync preview (showing first 3):`);
            data.details.customers_preview.forEach((customer, i) => {
                console.log(`   ${i + 1}. ${customer.name} (ID: ${customer.id})`);
                console.log(`      Address: ${customer.address}`);
                console.log(`      Tags: ${customer.tags?.length || 0} tags`);
            });
        }

    } catch (error) {
        console.log('❌ Sync API Error:', error.message);
    }
}

// Analyze the root cause of the discrepancy
async function analyzeDiscrepancy() {
    console.log('\n🚨 ROOT CAUSE ANALYSIS');
    console.log('=' * 60);

    console.log(`
SUSPECTED CAUSES OF 15-CUSTOMER LIMIT:

1. HARDCODED LIMIT in /api/customers.js
   - Line ~232: for (let i = 0; i < Math.min(contacts.length, 15); i++)
   - This artificially limits customers to 15 for "serverless performance"

2. GEOCODING BOTTLENECK in /api/customers.js
   - Each customer requires individual geocoding API call
   - 300ms delay between each customer for rate limiting
   - Total time: 15 customers × 300ms = 4.5 seconds minimum

3. SERVERLESS TIMEOUT CONCERNS
   - Regular API includes geocoding (slow)
   - Sync API skips geocoding (fast, allows 2000+ customers)

4. DIFFERENT PROCESSING STRATEGIES:
   - /api/customers.js: Real-time geocoding + hardcoded limit
   - /api/sync/customers.js: No geocoding + large batch processing

SOLUTION APPROACH:
1. Remove hardcoded 15-customer limit from /api/customers.js
2. Make geocoding optional or background process
3. Allow larger customer batches in regular API
4. Consider pagination for large datasets
    `);
}

// Main debugging execution
async function main() {
    console.log('🔧 CRITICAL PRODUCTION DEBUGGING');
    console.log('Customer Sync API Discrepancy Analysis');
    console.log('=' * 60);

    await testCustomerAPIs();
    await analyzeDiscrepancy();

    console.log('\n📋 IMMEDIATE ACTIONS NEEDED:');
    console.log('1. Fix hardcoded 15-customer limit in /api/customers.js');
    console.log('2. Make geocoding optional or asynchronous');
    console.log('3. Implement pagination for large customer lists');
    console.log('4. Test with production Ploome data');
    console.log('5. Ensure both APIs return consistent customer counts');
}

// Run the debugging
main().catch(console.error);