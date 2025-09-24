// Migrate existing KV data to Supabase PostgreSQL
// This script will transfer all geocoded customer data from the temporary KV system to permanent Supabase storage

import kvStorage from '../lib/kv.js';
import supabaseKV from '../lib/supabase.js';

async function migrateData() {
    try {
        console.log('🚀 Starting migration from KV to Supabase PostgreSQL...');

        // Get all customer keys from KV storage
        const customerKeys = await kvStorage.keys('customer:*');
        console.log(`📊 Found ${customerKeys.length} customers in KV storage to migrate`);

        if (customerKeys.length === 0) {
            console.log('ℹ️  No customer data found in KV storage. Migration not needed.');
            return;
        }

        let migratedCount = 0;
        let errorCount = 0;

        // Migrate customers in batches
        const batchSize = 10;
        for (let i = 0; i < customerKeys.length; i += batchSize) {
            const batch = customerKeys.slice(i, i + batchSize);
            console.log(`📦 Processing batch ${Math.floor(i/batchSize) + 1} (${batch.length} customers)...`);

            for (const customerKey of batch) {
                try {
                    // Get customer data from KV
                    const customerData = await kvStorage.get(customerKey);

                    if (customerData) {
                        // Save to Supabase
                        await supabaseKV.set(customerKey, customerData);
                        migratedCount++;

                        const customer = JSON.parse(customerData);
                        console.log(`  ✅ Migrated: ${customer.name} (${customer.cep})`);
                    }
                } catch (customerError) {
                    errorCount++;
                    console.error(`  ❌ Failed to migrate ${customerKey}:`, customerError.message);
                }

                // Small delay to avoid overwhelming the database
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            // Delay between batches
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        // Migrate geocoding stats
        try {
            console.log('📊 Migrating geocoding statistics...');
            const stats = await kvStorage.get('geocoding_stats');

            if (stats) {
                await supabaseKV.setGeocodingStats(JSON.parse(stats));
                console.log('✅ Geocoding stats migrated successfully');
            } else {
                console.log('ℹ️  No geocoding stats found in KV storage');
            }
        } catch (statsError) {
            console.error('❌ Failed to migrate geocoding stats:', statsError.message);
        }

        // Migrate batch logs
        try {
            console.log('📋 Migrating batch logs...');
            const batchKeys = await kvStorage.keys('batch:*');

            let batchLogCount = 0;
            for (const batchKey of batchKeys) {
                try {
                    const batchData = await kvStorage.get(batchKey);
                    if (batchData) {
                        await supabaseKV.set(batchKey, batchData);
                        batchLogCount++;
                    }
                } catch (batchError) {
                    console.error(`❌ Failed to migrate ${batchKey}:`, batchError.message);
                }
            }

            console.log(`✅ Migrated ${batchLogCount} batch logs`);
        } catch (batchError) {
            console.error('❌ Failed to migrate batch logs:', batchError.message);
        }

        // Migration summary
        console.log('\n🎉 Migration completed!');
        console.log(`✅ Successfully migrated: ${migratedCount} customers`);
        console.log(`❌ Failed migrations: ${errorCount} customers`);

        // Verify migration by checking Supabase
        console.log('\n🔍 Verifying migration...');
        const supabaseStats = await supabaseKV.getCustomerStats();
        console.log('📊 Supabase customer statistics:', supabaseStats);

        if (supabaseStats.total >= migratedCount) {
            console.log('✅ Migration verification successful!');
            console.log('\n⚠️  IMPORTANT: You can now safely remove the old KV storage system');
            console.log('   - The lib/kv.js file can be replaced with lib/supabase.js');
            console.log('   - All data is now permanently stored in Supabase PostgreSQL');
        } else {
            console.log('⚠️  Migration verification shows data mismatch');
            console.log('   Please verify manually before removing KV system');
        }

    } catch (error) {
        console.error('💥 Migration failed:', error);
        process.exit(1);
    }
}

// Run migration if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    await migrateData();
}