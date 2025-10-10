#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');

async function createTable() {
  console.log('🔄 Creating customer_sales table...\n');

  const SUPABASE_URL = 'https://yxwokryybudwygtemfmu.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4d29rcnl5YnVkd3lndGVtZm11Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3NDE2ODEsImV4cCI6MjA3NDMxNzY4MX0.ALgRRp1FivPIQ7TltZF7HPDS2d12RNAxTnc_BfRmJUg';

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // Try to insert a test record - if table doesn't exist, we'll get an error
  const testData = {
    customer_id: 999999,
    customer_name: '__TEST_RECORD__',
    cnpj: '00.000.000/0000-00',
    total_revenue: 0,
    deal_count: 0,
    avg_deal_size: 0,
    last_purchase_date: new Date().toISOString(),
    last_sync_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('customer_sales')
    .insert(testData)
    .select();

  if (error) {
    console.error('❌ Error:', error.message);
    console.log('\n⚠️  The table needs to be created manually in Supabase Dashboard');
    console.log('\nGo to: https://supabase.com/dashboard/project/yxwokryybudwygtemfmu/editor');
    console.log('\nSQL to run:');
    console.log(`
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

CREATE INDEX IF NOT EXISTS idx_customer_sales_revenue ON customer_sales(total_revenue DESC);
CREATE INDEX IF NOT EXISTS idx_customer_sales_customer_name ON customer_sales(customer_name);
CREATE INDEX IF NOT EXISTS idx_customer_sales_last_sync ON customer_sales(last_sync_at);
`);
  } else {
    console.log('✅ Table exists! Test record created successfully');
    console.log('Data:', data);

    // Clean up test record
    await supabase
      .from('customer_sales')
      .delete()
      .eq('customer_id', 999999);
    console.log('\n🧹 Test record removed');
  }
}

createTable();
