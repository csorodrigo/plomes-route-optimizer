#!/usr/bin/env node
/**
 * Manual trigger for customer sales sync
 * Usage: node scripts/run-customer-sales-sync.js
 */

const axios = require('axios');

const CRON_URL = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}/api/cron/sync-customer-sales`
  : 'http://localhost:3000/api/cron/sync-customer-sales';

const CRON_SECRET = 'customer-sales-sync-cron-secret-2025';

async function runSync() {
  console.log('🔄 Starting manual customer sales sync...');
  console.log(`📍 Endpoint: ${CRON_URL}\n`);

  const startTime = Date.now();

  try {
    const response = await axios.get(CRON_URL, {
      headers: {
        'Authorization': `Bearer ${CRON_SECRET}`,
        'Content-Type': 'application/json'
      },
      timeout: 300000 // 5 minutes
    });

    const duration = Date.now() - startTime;

    if (response.data.success) {
      console.log('✅ Sync completed successfully!');
      console.log(`⏱️  Duration: ${(duration / 1000).toFixed(1)}s\n`);
      console.log('📊 Statistics:');
      console.log(JSON.stringify(response.data.stats, null, 2));
    } else {
      console.error('❌ Sync failed:', response.data.message);
    }

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`💥 Error after ${(duration / 1000).toFixed(1)}s:`);

    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error('Response:', error.response.data);
    } else if (error.request) {
      console.error('No response received. Is the server running?');
      console.error('Tried:', CRON_URL);
    } else {
      console.error(error.message);
    }

    process.exit(1);
  }
}

runSync();
