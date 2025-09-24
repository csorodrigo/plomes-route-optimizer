#!/usr/bin/env node

const https = require('https');

async function testCustomerAPI() {
    return new Promise((resolve, reject) => {
        const req = https.request('https://plomes-rota-cep.vercel.app/api/customers', {
            method: 'GET',
            timeout: 60000
        }, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    console.log('🔍 CUSTOMER API TEST RESULTS:');
                    console.log(`Status: ${res.statusCode}`);
                    console.log(`Total customers: ${result.total}`);
                    console.log(`Total in Ploome: ${result.total_in_ploome}`);
                    console.log(`Success: ${result.success}`);

                    if (result.total > 2000) {
                        console.log('✅ FIXED: Customer API now returns 2000+ customers!');
                    } else if (result.total > 15) {
                        console.log(`⚠️  PARTIAL: Returns ${result.total} customers (better than 15)`);
                    } else {
                        console.log('❌ STILL BROKEN: Only 15 customers (deployment issue?)');
                    }
                    resolve(result);
                } catch (e) {
                    reject(e);
                }
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

testCustomerAPI().catch(console.error);