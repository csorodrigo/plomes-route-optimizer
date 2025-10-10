#!/usr/bin/env node

/**
 * Execute all SQL batches via Supabase MCP
 * This reads each batch file and executes the SQL statements
 */

const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://yxwokryybudwygtemfmu.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4d29rcnl5YnVkd3lndGVtZm11Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODc0MTY4MSwiZXhwIjoyMDc0MzE3NjgxfQ.dzEfWIgdftQiwXJdod_bIy4pUl42WwlS-VWYaKvqEKg';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function executeBatch(batchNumber) {
  const filename = `update-batch-${batchNumber}.sql`;

  if (!fs.existsSync(filename)) {
    console.log(`⚠️  Batch ${batchNumber} not found: ${filename}`);
    return { success: 0, failed: 0 };
  }

  const sql = fs.readFileSync(filename, 'utf8');
  const statements = sql.split(';').filter(s => s.trim().length > 0);

  console.log(`\n📦 Batch ${batchNumber}: ${statements.length} statements`);

  let success = 0;
  let failed = 0;

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i].trim();
    if (!stmt) continue;

    try {
      // Extract ploomes_deal_id for progress tracking
      const match = stmt.match(/ploomes_deal_id = '(\d+)'/);
      const dealId = match ? match[1] : '?';

      const { error } = await supabase.rpc('exec', { query: stmt });

      if (error) {
        console.error(`   ❌ Deal ${dealId}: ${error.message}`);
        failed++;
      } else {
        success++;
        if (success % 10 === 0) {
          console.log(`   ✅ Progress: ${success}/${statements.length}`);
        }
      }
    } catch (err) {
      console.error(`   💥 Exception: ${err.message}`);
      failed++;
    }
  }

  console.log(`   Summary: ✅ ${success} succeeded, ❌ ${failed} failed`);
  return { success, failed };
}

async function main() {
  console.log('🚀 Executing SQL batches via Supabase MCP\n');
  console.log('='.repeat(70));

  const totalBatches = 17;
  let totalSuccess = 0;
  let totalFailed = 0;

  for (let i = 1; i <= totalBatches; i++) {
    const result = await executeBatch(i);
    totalSuccess += result.success;
    totalFailed += result.failed;
  }

  console.log('\n' + '='.repeat(70));
  console.log('📊 FINAL RESULTS:');
  console.log(`   Total Updates: ${totalSuccess + totalFailed}`);
  console.log(`   ✅ Successful: ${totalSuccess}`);
  console.log(`   ❌ Failed: ${totalFailed}`);
  console.log('='.repeat(70));

  if (totalFailed === 0) {
    console.log('\n✅ All batches completed successfully!');
    console.log('🎯 Next: Verify dashboard displays products correctly\n');
  } else {
    console.log(`\n⚠️  ${totalFailed} updates failed - review errors above\n`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n💥 ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  });
