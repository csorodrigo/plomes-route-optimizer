#!/usr/bin/env node

/**
 * EMERGENCY DATABASE CLEANUP
 *
 * Forces a complete wipe of customer data followed by a fresh sync that only
 * keeps contacts tagged as "Cliente". Use this when automatic recovery fails.
 */

require('dotenv').config();
const DatabaseService = require('./services/sync/database-service');
const PloomeService = require('./services/sync/ploome-service');

async function emergencyCleanup() {
    const db = new DatabaseService();
    let ploomeService;

    try {
        console.log('\n🚨 EMERGENCY DATABASE CLEANUP\n');
        await db.ensureInitialized();

        const beforeStats = await db.getStatistics();
        console.log('📊 BEFORE CLEANUP:');
        console.log(`   • Total customers: ${beforeStats.totalCustomers}`);
        console.log(`   • With coordinates: ${beforeStats.withCoordinates}`);
        console.log(`   • Without coordinates: ${beforeStats.withoutCoordinates}\n`);

        console.log('🗑️  Removing existing data...');
        await db.deleteAllRoutes();
        await db.deleteAllSyncLogs();
        await db.deleteAllGeocodingCache();
        await db.deleteAllCustomers();
        console.log('✅ Data cleared\n');

        console.log('🔌 Connecting to Ploome API...');
        ploomeService = new PloomeService(process.env.PLOOME_API_KEY);
        if (!await ploomeService.testConnection()) {
            throw new Error('Cannot connect to Ploome API. Check the PLOOME_API_KEY variable.');
        }

        await ploomeService.fetchTags();
        console.log(`✅ Loaded ${ploomeService.tagCache.size} tags\n`);
        console.log('📥 Importing contacts tagged as "Cliente"...');

        const syncStartedAt = new Date().toISOString();
        let progressCount = 0;
        const customers = await ploomeService.fetchAllContacts((progress) => {
            progressCount++;
            if (progressCount % 10 === 0) {
                process.stdout.write(`\r   📈 Progress: ${progress.fetched} customers fetched...`);
            }
        });
        process.stdout.write('\n');
        console.log(`✅ ${customers.length} customers imported\n`);

        let result = { successCount: 0, errorCount: 0 };
        if (customers.length > 0) {
            console.log('💾 Saving customers to Supabase...');
            result = await db.upsertCustomersBatch(customers);
            console.log(`✅ ${result.successCount} customers saved`);
            if (result.errorCount > 0) {
                console.log(`⚠️  ${result.errorCount} customers failed to save`);
            }
        }

        const afterStats = await db.getStatistics();
        console.log('\n📊 AFTER CLEANUP:');
        console.log(`   • Total customers: ${afterStats.totalCustomers}`);
        console.log(`   • With coordinates: ${afterStats.withCoordinates}`);
        console.log(`   • Without coordinates: ${afterStats.withoutCoordinates}`);

        await db.logSync({
            type: 'emergency-cleanup',
            fetched: customers.length,
            updated: result.successCount,
            errors: result.errorCount,
            startedAt: syncStartedAt,
            completedAt: new Date().toISOString(),
            status: result.errorCount > 0 ? 'partial' : 'success',
            errorMessage: result.errorCount > 0 ? 'Some customers failed during emergency cleanup' : null
        });

        console.log(`
╔══════════════════════════════════════════════════════════╗
║              ✅ CLEANUP COMPLETED SUCCESSFULLY             ║
║                                                            ║
║  Before: ${String(beforeStats.totalCustomers).padEnd(6)} customers                              ║
║  After:  ${String(afterStats.totalCustomers).padEnd(6)} customers ("Cliente" tag only)     ║
║                                                            ║
║  Database is now clean and ready!                         ║
╚══════════════════════════════════════════════════════════╝
        `);

    } catch (error) {
        console.error('\n❌ EMERGENCY CLEANUP FAILED!');
        console.error('   Error:', error.message);
        console.error('   Stack:', error.stack);

        try {
            await db.logSync({
                type: 'emergency-cleanup-error',
                fetched: 0,
                updated: 0,
                errors: 1,
                startedAt: new Date().toISOString(),
                completedAt: new Date().toISOString(),
                status: 'error',
                errorMessage: error.message
            });
        } catch (logError) {
            console.error('⚠️  Failed to log cleanup error:', logError.message);
        }

        process.exit(1);
    } finally {
        await db.close();
    }
}

if (require.main === module) {
    emergencyCleanup().then(() => {
        console.log('\n✅ Emergency cleanup complete');
        process.exit(0);
    }).catch((err) => {
        console.error('\n❌ Emergency cleanup failed:', err);
        process.exit(1);
    });
}

module.exports = emergencyCleanup;
