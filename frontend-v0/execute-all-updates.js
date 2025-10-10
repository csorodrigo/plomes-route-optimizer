#!/usr/bin/env node

/**
 * Execute all product updates in FINAL-UPDATE-ALL.sql
 * This script reads the SQL file and executes it via Supabase
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Read SQL file
const sqlFile = path.join(__dirname, 'FINAL-UPDATE-ALL.sql');
const sql = fs.readFileSync(sqlFile, 'utf8');

// Get Supabase credentials from environment or MCP config
// The Supabase MCP is already configured, so we'll use its credentials
const supabaseUrl = process.env.SUPABASE_URL || 'https://iwwujqwkigrxqqsxobyz.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if (!supabaseKey) {
  console.error('ERROR: SUPABASE_KEY or SUPABASE_SERVICE_ROLE_KEY not found in environment');
  console.error('The Supabase MCP must be configured with credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function executeUpdates() {
  console.log('Starting SQL execution...');
  console.log(`File: ${sqlFile}`);
  console.log(`Total SQL length: ${sql.length} characters`);

  try {
    // Execute the entire SQL file as a single transaction
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
      console.error('ERROR executing SQL:', error);
      process.exit(1);
    }

    console.log('SUCCESS: All updates executed');
    console.log('Result:', data);

    // Now run verification
    const verifyQuery = `
      SELECT
        COUNT(*) as total_com_produtos,
        COUNT(DISTINCT customer_id) as clientes_unicos
      FROM sales
      WHERE products IS NOT NULL
        AND jsonb_array_length(products) > 0;
    `;

    const { data: verifyData, error: verifyError } = await supabase.rpc('exec_sql', { sql_query: verifyQuery });

    if (verifyError) {
      console.error('ERROR in verification:', verifyError);
    } else {
      console.log('\nVERIFICATION RESULTS:');
      console.log(verifyData);
    }

  } catch (err) {
    console.error('EXCEPTION:', err);
    process.exit(1);
  }
}

executeUpdates();
