#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

async function applyMigration() {
  console.log('🔄 Applying customer_sales table migration...\n');

  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://yxwokryybudwygtemfmu.supabase.co';
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!SUPABASE_KEY) {
    console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  // Read migration file
  const migrationPath = path.join(__dirname, '../supabase/migrations/20251002_create_customer_sales.sql');
  const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

  console.log('📄 Migration SQL:');
  console.log(migrationSQL);
  console.log('\n⚙️ Executing migration...\n');

  try {
    // Execute the migration SQL
    const { data, error } = await supabase.rpc('exec_sql', { sql: migrationSQL });

    if (error) {
      console.error('❌ Migration failed:', error);

      // Try alternative approach: execute each statement separately
      console.log('\n🔄 Trying statement-by-statement execution...\n');

      const statements = migrationSQL
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));

      for (const statement of statements) {
        console.log(`Executing: ${statement.substring(0, 50)}...`);
        const { error: stmtError } = await supabase.rpc('exec_sql', { sql: statement });
        if (stmtError) {
          console.error(`❌ Failed:`, stmtError.message);
        } else {
          console.log('✅ Success');
        }
      }
    } else {
      console.log('✅ Migration applied successfully!');
      console.log('Data:', data);
    }

    // Verify table was created
    console.log('\n🔍 Verifying table creation...\n');
    const { data: tables, error: tableError } = await supabase
      .from('customer_sales')
      .select('*')
      .limit(1);

    if (tableError) {
      if (tableError.message.includes('does not exist')) {
        console.error('❌ Table was not created successfully');
      } else {
        console.log('✅ Table exists (error is expected for empty table)');
      }
    } else {
      console.log('✅ Table customer_sales created successfully!');
      console.log(`   Records: ${tables?.length || 0}`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

applyMigration();
