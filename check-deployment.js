#!/usr/bin/env node

const https = require('https');
const http = require('http');

const PROJECT_ID = "799c5228-83f4-4c93-ba9e-9794f1f169be";
const SERVICE_ID = "f2b3dfb0-c206-4405-9317-53dffad8bf4c";

const possibleUrls = [
    `https://${PROJECT_ID}.up.railway.app`,
    `https://${SERVICE_ID}.up.railway.app`,
    `https://web-${SERVICE_ID}.up.railway.app`,
    `https://plomes-route-optimizer.up.railway.app`,
    `https://plomes-route-optimizer-${PROJECT_ID}.up.railway.app`,
    `https://${PROJECT_ID}-${SERVICE_ID}.up.railway.app`
];

function checkUrl(url) {
    return new Promise((resolve) => {
        const req = https.get(url, { timeout: 5000 }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    resolve({ url, status: 'SUCCESS', statusCode: res.statusCode });
                } else {
                    resolve({ url, status: 'FAILED', statusCode: res.statusCode, data: data.substring(0, 100) });
                }
            });
        });
        
        req.on('timeout', () => {
            req.abort();
            resolve({ url, status: 'TIMEOUT' });
        });
        
        req.on('error', (err) => {
            resolve({ url, status: 'ERROR', error: err.message });
        });
    });
}

async function checkAllUrls() {
    console.log('Checking Railway deployment URLs...');
    console.log(`Project ID: ${PROJECT_ID}`);
    console.log(`Service ID: ${SERVICE_ID}`);
    console.log('---');
    
    for (let i = 0; i < possibleUrls.length; i++) {
        const result = await checkUrl(possibleUrls[i]);
        console.log(`${i + 1}. ${result.url}`);
        console.log(`   Status: ${result.status}`);
        if (result.statusCode) console.log(`   HTTP: ${result.statusCode}`);
        if (result.data) console.log(`   Response: ${result.data}...`);
        if (result.error) console.log(`   Error: ${result.error}`);
        
        if (result.status === 'SUCCESS') {
            console.log('\\n🎉 DEPLOYMENT FOUND!');
            console.log(`   URL: ${result.url}`);
            process.exit(0);
        }
        console.log('');
    }
    
    console.log('❌ No working deployment found yet. Railway might still be building...');
    console.log('💡 Try again in a few minutes, or check the Railway dashboard for build logs.');
}

checkAllUrls().catch(console.error);