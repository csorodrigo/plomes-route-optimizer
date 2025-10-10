#!/usr/bin/env node

/**
 * Execute product updates efficiently via Supabase
 * Processes FINAL-UPDATE-ALL.sql in optimized batches
 */

const fs = require('fs');
const readline = require('readline');
const { createClient } = require('@supabase/supabase-js');

// Supabase configuration - using the public project
const SUPABASE_URL = 'https://iwwujqwkigrxqqsxobyz.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_KEY) {
  console.error('ERROR: No Supabase key found in environment');
  console.error('Set SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Configuration
const BATCH_SIZE = 50; // Process 50 statements at a time
const SQL_FILE = './FINAL-UPDATE-ALL.sql';

async function executeBatch(statements) {
  const batchSQL = statements.join('\n');

  try {
    const { data, error } = await supabase.rpc('exec_sql', { query: batchSQL });

    if (error) {
      console.error(`ERROR in batch:`, error.message);
      return { success: 0, failed: statements.length };
    }

    return { success: statements.length, failed: 0 };
  } catch (err) {
    console.error(`EXCEPTION in batch:`, err.message);
    return { success: 0, failed: statements.length };
  }
}

async function main() {
  console.log('===  PRODUCTS UPDATE EXECUTION ===');
  console.log(`File: ${SQL_FILE}`);
  console.log(`Batch size: ${BATCH_SIZE} statements`);
  console.log('');

  const statements = [];
  let totalProcessed = 0;
  let totalSuccess = 0;
  let totalFailed = 0;
  let batchNumber = 1;

  // Read file line by line
  const fileStream = fs.createReadStream(SQL_FILE);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('--')) {
      statements.push(trimmed);

      if (statements.length >= BATCH_SIZE) {
        process.stdout.write(`\rBatch ${batchNumber}: Processing ${statements.length} statements...`);

        const result = await executeBatch(statements);
        totalSuccess += result.success;
        totalFailed += result.failed;
        totalProcessed += statements.length;

        process.stdout.write(` ${result.success} OK, ${result.failed} failed`);
        console.log('');

        statements.length = 0; // Clear array
        batchNumber++;
      }
    }
  }

  // Process remaining statements
  if (statements.length > 0) {
    process.stdout.write(`\rBatch ${batchNumber}: Processing ${statements.length} statements...`);

    const result = await executeBatch(statements);
    totalSuccess += result.success;
    totalFailed += result.failed;
    totalProcessed += statements.length;

    process.stdout.write(` ${result.success} OK, ${result.failed} failed`);
    console.log('');
  }

  console.log('');
  console.log('=== EXECUTION SUMMARY ===');
  console.log(`Total processed: ${totalProcessed}`);
  console.log(`Successful: ${totalSuccess}`);
  console.log(`Failed: ${totalFailed}`);

  // Verification query
  console.log('');
  console.log('=== VERIFICATION ===');

  try {
    const { data, error } = await supabase
      .from('sales')
      .select('*', { count: 'exact', head: false })
      .not('products', 'is', null)
      .filter('products', 'neq', '[]');

    if (error) {
      console.error('Verification error:', error.message);
    } else {
      console.log(`Records with products: ${data.length}`);

      // Count unique customers
      const uniqueCustomers = new Set(data.map(r => r.customer_id)).size;
      console.log(`Unique customers: ${uniqueCustomers}`);
    }
  } catch (err) {
    console.error('Verification exception:', err.message);
  }

  console.log('');
  console.log('=== COMPLETE ===');
}

main().catch(console.error);
