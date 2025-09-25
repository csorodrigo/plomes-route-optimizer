#!/usr/bin/env node

/**
 * Clears all customer data and performs a clean sync from Ploome, keeping only
 * contacts tagged as "Cliente". Useful when historical data polluted the
 * database before tag filtering was fixed.
 */

require('dotenv').config();
const DatabaseService = require('./services/sync/database-service');
const PloomeService = require('./services/sync/ploome-service');

async function clearAndResync() {
    console.log('\n🚨 CRITICAL FIX: Clearing database and re-syncing with proper filtering...\n');

    const db = new DatabaseService();

    try {
        const isProduction = process.env.NODE_ENV === 'production';
        if (isProduction) {
            console.log('⚠️  PRODUCTION MODE DETECTED - ALL CUSTOMER DATA WILL BE REMOVED');
            console.log('Press Ctrl+C within 10 seconds to cancel...\n');
            for (let i = 10; i > 0; i--) {
                process.stdout.write(`\rStarting in ${i} seconds...`);
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            process.stdout.write('\n');
        }

        await db.ensureInitialized();

        const currentStats = await db.getStatistics();
        console.log('📊 CURRENT DATABASE STATE:');
        console.log(`   • Total customers: ${currentStats.totalCustomers}`);
        console.log(`   • Geocoded customers: ${currentStats.geocodedCustomers}`);
        console.log(`   • Pending geocoding: ${currentStats.pendingGeocoding}\n`);

        console.log('🗑️  Clearing customer, route and sync data...');
        await db.deleteAllRoutes();
        await db.deleteAllSyncLogs();
        await db.deleteAllGeocodingCache();
        await db.deleteAllCustomers();
        console.log('✅ Database cleared\n');

        const ploomeService = new PloomeService(process.env.PLOOME_API_KEY);
        if (!await ploomeService.testConnection()) {
            throw new Error('Cannot connect to Ploome API. Check the PLOOME_API_KEY variable.');
        }

        await ploomeService.fetchTags();
        console.log(`✅ ${ploomeService.tagCache.size} tags cached`);

        const clientTagName = ploomeService.tagCache.get(ploomeService.CLIENT_TAG_ID);
        console.log(`🎯 CLIENT_TAG_ID ${ploomeService.CLIENT_TAG_ID} → ${clientTagName || 'unknown tag'}\n`);

        console.log('📥 Syncing "Cliente" contacts from Ploome...');
        const syncStartedAt = new Date().toISOString();
        const customers = await ploomeService.fetchAllContacts((progress) => {
            process.stdout.write(`\r  📈 Progress: ${progress.fetched} customers imported...`);
        });
        process.stdout.write('\n');
        console.log(`✅ ${customers.length} customers imported`);

        let result = { successCount: 0, errorCount: 0 };
        if (customers.length > 0) {
            console.log('💾 Saving customers to Supabase...');
            result = await db.upsertCustomersBatch(customers);
            console.log(`✅ ${result.successCount} customers saved`);
            if (result.errorCount > 0) {
                console.log(`⚠️  ${result.errorCount} customers failed during save`);
            }
        }

        const finalStats = await db.getStatistics();
        const durationSeconds = Math.round((Date.now() - new Date(syncStartedAt).getTime()) / 1000);
        console.log('\n📊 FINAL RESULTS:');
        console.log(`   • Total customers: ${finalStats.totalCustomers}`);
        console.log(`   • Geocoded customers: ${finalStats.geocodedCustomers}`);
        console.log(`   • Pending geocoding: ${finalStats.pendingGeocoding}`);
        console.log(`   • Sync duration: ${durationSeconds}s\n`);

        await db.logSync({
            type: 'clear-and-resync',
            fetched: customers.length,
            updated: result.successCount,
            errors: result.errorCount,
            startedAt: syncStartedAt,
            completedAt: new Date().toISOString(),
            status: result.errorCount > 0 ? 'partial' : 'success',
            errorMessage: result.errorCount > 0 ? 'Errors while saving customers during clear-and-resync' : null
        });

        console.log('🎉 SUCCESS! Database cleared and re-synced with proper filtering.');
        console.log(`   Before: ${currentStats.totalCustomers} customers (may include non-client contacts)`);
        console.log(`   After:  ${finalStats.totalCustomers} customers ("Cliente" tag only)\n`);

    } catch (error) {
        console.error('\n❌ CRITICAL ERROR during clear and re-sync:', error.message);
        console.error(error);

        try {
            await db.logSync({
                type: 'clear-and-resync-error',
                fetched: 0,
                updated: 0,
                errors: 1,
                startedAt: new Date().toISOString(),
                completedAt: new Date().toISOString(),
                status: 'error',
                errorMessage: error.message
            });
        } catch (logError) {
            console.error('⚠️  Failed to log sync error:', logError.message);
        }

        process.exit(1);
    } finally {
        await db.close();
    }
}

if (require.main === module) {
    clearAndResync();
}

module.exports = clearAndResync;
