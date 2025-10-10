#!/usr/bin/env node

/**
 * Full Ploomes Product Synchronization Script
 * Syncs all 11,793 products from Ploomes to Supabase
 */

const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');
require('dotenv').config({ path: '../.env.local' });

// Supabase configuration
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://oezdnozdebjqrmehyjkr.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9lemRub3pkZWJqcXJtZWh5amtyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjMxNTUzNTYsImV4cCI6MjAzODczMTM1Nn0.y5xJZvs-uyVMXEO-r9erZ7etI8FLfhIcRbv0TIgI8FY'
);

// Ploomes API configuration
const PLOOMES_API_KEY = process.env.PLOOMES_API_KEY || '62CDD47F18154F92BABDD45FA6CBD1EE5E4BEC84139E4078BDC4F7AA6BC3D92F';
const PLOOMES_API_URL = 'https://api2.ploomes.com';

// Progress tracking
let stats = {
  total: 0,
  synced: 0,
  errors: 0,
  services: 0,
  rentals: 0,
  atlas: 0,
  ingersoll: 0,
  omie: 0,
  startTime: new Date()
};

/**
 * Detect product type based on code
 */
function detectProductType(code, name = '') {
  if (!code) return 'product';

  const upperCode = code.toUpperCase();
  const upperName = name.toUpperCase();

  if (upperCode.startsWith('CIA_LOC_')) return 'rental';
  if (upperCode.startsWith('CIA_')) return 'service';
  if (upperCode.includes('_MÃO') || upperCode.includes('_MAO')) return 'service';
  if (upperCode.includes('_SERV')) return 'service';

  if (upperName.includes('COMPRESSOR')) return 'equipment';
  if (upperName.includes('FILTRO')) return 'component';
  if (upperName.includes('VÁLVULA') || upperName.includes('VALVULA')) return 'component';

  return 'product';
}

/**
 * Detect product brand
 */
function detectBrand(code, name = '') {
  const text = `${code} ${name}`.toUpperCase();

  if (text.includes('ATLAS')) return 'ATLAS';
  if (text.includes('INGERSOLL')) return 'INGERSOLL';
  if (text.includes('DANFOSS')) return 'DANFOSS';
  if (text.includes('CHICAGO')) return 'CHICAGO';
  if (text.includes('KAESER')) return 'KAESER';
  if (text.includes('SCHULZ')) return 'SCHULZ';
  if (text.includes('WORTHINGTON')) return 'WORTHINGTON';

  return 'OTHER';
}

/**
 * Detect product category
 */
function detectCategory(code, name = '') {
  const text = `${code} ${name}`.toUpperCase();

  if (text.includes('COMPRESSOR')) return 'compressors';
  if (text.includes('FILTRO')) return 'filters';
  if (text.includes('VÁLVULA') || text.includes('VALVULA')) return 'valves';
  if (text.includes('ÓLEO') || text.includes('OLEO')) return 'oils';
  if (text.includes('MANUTENÇÃO') || text.includes('MANUTENCAO')) return 'maintenance';
  if (text.includes('PEÇA') || text.includes('PECA')) return 'parts';
  if (text.includes('KIT')) return 'kits';
  if (text.includes('SENSOR')) return 'sensors';
  if (text.includes('MOTOR')) return 'motors';

  return 'general';
}

/**
 * Detect product creator
 */
function detectCreator(product) {
  // Check if product was created via Omie integration
  if (product.OtherProperties?.IntegrationId?.includes('omie')) {
    return 'Omie';
  }
  if (product.CreateDate && new Date(product.CreateDate) < new Date('2023-01-01')) {
    return 'Legacy';
  }
  return 'Ploomes';
}

/**
 * Fetch products from Ploomes API
 */
async function fetchPloomeProducts(offset = 0, limit = 100) {
  try {
    const response = await fetch(`${PLOOMES_API_URL}/Products?$offset=${offset}&$top=${limit}&$expand=OtherProperties`, {
      headers: {
        'User-Key': PLOOMES_API_KEY
      }
    });

    if (!response.ok) {
      throw new Error(`Ploomes API error: ${response.status}`);
    }

    const data = await response.json();
    return data.value || [];
  } catch (error) {
    console.error(`Error fetching products (offset: ${offset}):`, error.message);
    return [];
  }
}

/**
 * Transform Ploomes product to our schema
 */
function transformProduct(ploomesProduct) {
  const code = ploomesProduct.Code || ploomesProduct.Id?.toString() || '';
  const name = ploomesProduct.Name || '';
  const unitPrice = parseFloat(ploomesProduct.UnitPrice || 0);

  return {
    ploomes_id: ploomesProduct.Id,
    product_code: code,
    product_name: name,
    product_type: detectProductType(code, name),
    brand: detectBrand(code, name),
    category: detectCategory(code, name),
    unit_price: unitPrice,
    currency: ploomesProduct.Currency?.Code || 'BRL',
    creator: detectCreator(ploomesProduct),
    active: ploomesProduct.Active !== false,
    created_at: ploomesProduct.CreateDate || new Date().toISOString(),
    updated_at: ploomesProduct.UpdateDate || new Date().toISOString(),
    raw_data: ploomesProduct
  };
}

/**
 * Batch insert products into Supabase
 */
async function batchInsertProducts(products) {
  const batchSize = 100;
  const batches = [];

  for (let i = 0; i < products.length; i += batchSize) {
    batches.push(products.slice(i, i + batchSize));
  }

  let inserted = 0;
  let errors = 0;

  for (const batch of batches) {
    try {
      const { data, error } = await supabase
        .from('products_enhanced')
        .upsert(batch, {
          onConflict: 'ploomes_id',
          ignoreDuplicates: false
        })
        .select();

      if (error) {
        console.error('Batch insert error:', error);
        errors += batch.length;
      } else {
        inserted += data.length;

        // Update stats
        data.forEach(product => {
          if (product.product_type === 'service') stats.services++;
          if (product.product_type === 'rental') stats.rentals++;
          if (product.brand === 'ATLAS') stats.atlas++;
          if (product.brand === 'INGERSOLL') stats.ingersoll++;
          if (product.creator === 'Omie') stats.omie++;
        });
      }
    } catch (err) {
      console.error('Batch error:', err);
      errors += batch.length;
    }
  }

  return { inserted, errors };
}

/**
 * Main sync function
 */
async function syncAllProducts() {
  console.log('🚀 Starting full Ploomes product synchronization...');
  console.log('━'.repeat(60));

  const limit = 100;
  let offset = 0;
  let hasMore = true;

  // Clear existing products (optional)
  const clearExisting = process.argv.includes('--clear');
  if (clearExisting) {
    console.log('🗑️  Clearing existing products...');
    await supabase.from('products_enhanced').delete().neq('id', 0);
  }

  while (hasMore) {
    console.log(`\n📦 Fetching products ${offset + 1} to ${offset + limit}...`);

    const products = await fetchPloomeProducts(offset, limit);

    if (products.length === 0) {
      hasMore = false;
      break;
    }

    stats.total += products.length;

    // Transform products
    const transformedProducts = products.map(transformProduct);

    // Insert into database
    const { inserted, errors } = await batchInsertProducts(transformedProducts);

    stats.synced += inserted;
    stats.errors += errors;

    // Progress update
    const progress = ((stats.synced / 11793) * 100).toFixed(1);
    console.log(`✅ Synced: ${stats.synced} | ❌ Errors: ${stats.errors} | Progress: ${progress}%`);
    console.log(`   Services: ${stats.services} | Rentals: ${stats.rentals}`);
    console.log(`   Atlas: ${stats.atlas} | Ingersoll: ${stats.ingersoll} | Omie: ${stats.omie}`);

    offset += limit;

    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));

    // Stop at expected total
    if (stats.total >= 11793) {
      hasMore = false;
    }
  }

  // Final statistics
  const elapsed = Math.round((new Date() - stats.startTime) / 1000);
  console.log('\n' + '═'.repeat(60));
  console.log('📊 SYNCHRONIZATION COMPLETE');
  console.log('═'.repeat(60));
  console.log(`Total Products: ${stats.total}`);
  console.log(`Successfully Synced: ${stats.synced}`);
  console.log(`Errors: ${stats.errors}`);
  console.log(`\nBreakdown:`);
  console.log(`  - Services (CIA_*): ${stats.services}`);
  console.log(`  - Rentals (CIA_LOC_*): ${stats.rentals}`);
  console.log(`  - Atlas Products: ${stats.atlas}`);
  console.log(`  - Ingersoll Products: ${stats.ingersoll}`);
  console.log(`  - Omie Created: ${stats.omie}`);
  console.log(`\nTime Elapsed: ${elapsed} seconds`);
  console.log(`Rate: ${(stats.synced / elapsed).toFixed(1)} products/second`);

  // Update sync status
  await supabase.from('sync_status').insert({
    sync_type: 'full',
    entity_type: 'products',
    status: 'completed',
    records_processed: stats.synced,
    records_failed: stats.errors,
    metadata: stats
  });

  console.log('\n✅ Sync status updated in database');
}

// Run the sync
syncAllProducts()
  .then(() => {
    console.log('\n🎉 Full synchronization completed successfully!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Synchronization failed:', error);
    process.exit(1);
  });