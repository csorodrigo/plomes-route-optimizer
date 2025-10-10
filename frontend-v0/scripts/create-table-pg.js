#!/usr/bin/env node

const { Client } = require('pg');

async function createTable() {
  console.log('🔄 Creating customer_sales table via PostgreSQL direct connection...\n');

  // Supabase connection string format:
  // postgresql://postgres:[YOUR-PASSWORD]@db.yxwokryybudwygtemfmu.supabase.co:5432/postgres

  // We need to use the service role key as password for direct PostgreSQL connection
  const connectionString = 'postgresql://postgres.yxwokryybudwygtemfmu:eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4d29rcnl5YnVkd3lndGVtZm11Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODc0MTY4MSwiZXhwIjoyMDc0MzE3NjgxfQ.dzEfWIgdftQiwXJdod_bIy4pUl42WwlS-VWYaKvqEKg@aws-0-us-east-1.pooler.supabase.com:6543/postgres';

  const client = new Client({ connectionString });

  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL\n');

    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS customer_sales (
        customer_id INTEGER PRIMARY KEY,
        customer_name TEXT NOT NULL,
        cnpj TEXT,
        total_revenue DECIMAL(15, 2) DEFAULT 0,
        deal_count INTEGER DEFAULT 0,
        avg_deal_size DECIMAL(15, 2) DEFAULT 0,
        last_purchase_date TIMESTAMPTZ,
        last_sync_at TIMESTAMPTZ DEFAULT NOW(),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;

    console.log('📝 Executing CREATE TABLE...');
    await client.query(createTableSQL);
    console.log('✅ Table created successfully!\n');

    console.log('📝 Creating indexes...');
    await client.query('CREATE INDEX IF NOT EXISTS idx_customer_sales_revenue ON customer_sales(total_revenue DESC);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_customer_sales_customer_name ON customer_sales(customer_name);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_customer_sales_last_sync ON customer_sales(last_sync_at);');
    console.log('✅ Indexes created successfully!\n');

    console.log('🔍 Verifying table exists...');
    const result = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name = 'customer_sales';
    `);

    if (result.rows.length > 0) {
      console.log('✅ Table customer_sales verified in database!\n');
    } else {
      console.log('❌ Table not found after creation\n');
    }

  } catch (error) {
    console.error('💥 Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    await client.end();
    console.log('👋 Connection closed');
  }
}

createTable();
