#!/usr/bin/env node

/**
 * AUTO-FIX DATABASE ON STARTUP
 * This script runs automatically when the server starts
 * It checks if the database has corrupted data and fixes it
 */

require('dotenv').config();
const DatabaseService = require('./services/sync/database-service');
const PloomeService = require('./services/sync/ploome-service');

async function checkAndFixDatabase() {
    console.log('\n🔍 Checking database integrity...\n');

    // SKIP AUTO-FIX FOR DEVELOPMENT AND RAILWAY DEPLOYMENTS
    if (process.env.NODE_ENV === 'development') {
        console.log('🚀 Development mode - skipping database auto-fix');
        return;
    }

    // SKIP AUTO-FIX FOR RAILWAY ENVIRONMENT (use lazy loading instead)
    if (process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_GIT_COMMIT_SHA) {
        console.log('🚂 Railway environment detected - skipping auto-fix for faster startup');
        console.log('   Database will be initialized on first API call');
        return;
    }
    
    // Check for FORCE_DB_RESET environment variable
    const forceReset = process.env.FORCE_DB_RESET === 'TRUE';
    if (forceReset) {
        console.log('🔴 FORCE_DB_RESET is TRUE - Database will be cleaned!');
    }
    
    let db;
    
    try {
        // Initialize database
        db = new DatabaseService();
        await db.ensureInitialized();
        
        // Check current customer count
        const stats = await db.getStatistics();
        console.log(`📊 Current customer count: ${stats.totalCustomers}`);
        
        // If we have more than 3000 customers OR force reset is enabled, database needs cleanup
        if (stats.totalCustomers > 3000 || forceReset) {
            if (forceReset) {
                console.log('\n🔴 FORCE RESET REQUESTED!');
                console.log(`   Current: ${stats.totalCustomers} customers`);
                console.log('   Forcing complete database cleanup and re-sync...');
            } else {
                console.log('\n⚠️  DATABASE CORRUPTION DETECTED!');
                console.log(`   Found ${stats.totalCustomers} customers (expected ~2200)`);
                console.log('   Database contains non-customer contacts (FORNECEDORES, etc.)');
            }
            console.log('\n🚨 STARTING AUTOMATIC FIX...\n');
            
            // Clear corrupted data
            console.log('🗑️  Clearing corrupted data...');
            await db.deleteAllRoutes();
            await db.deleteAllSyncLogs();
            await db.deleteAllGeocodingCache();
            await db.deleteAllCustomers();
            console.log('✅ Database cleared\n');
            
            // Re-sync with proper filtering
            const ploomeService = new PloomeService(process.env.PLOOME_API_KEY);
            
            // Test connection
            const connectionOk = await ploomeService.testConnection();
            if (!connectionOk) {
                throw new Error('Cannot connect to Ploome API');
            }
            
            // Fetch tags
            console.log('🏷️  Loading tag definitions...');
            await ploomeService.fetchTags();
            console.log(`✅ ${ploomeService.tagCache.size} tags loaded\n`);
            
            const syncStartedAt = new Date().toISOString();

            // Sync only customers with "Cliente" tag
            console.log('📥 Importing customers with "Cliente" tag only...');
            const customers = await ploomeService.fetchAllContacts((progress) => {
                process.stdout.write(`\r  📈 Progress: ${progress.fetched} customers imported...`);
            });
            
            console.log(`\n✅ ${customers.length} customers imported\n`);
            
            // Save to database
            let result = { successCount: 0, errorCount: 0 };
            if (customers.length > 0) {
                console.log('💾 Saving to database...');
                result = await db.upsertCustomersBatch(customers);
                console.log(`✅ ${result.successCount} customers saved\n`);
            }
            
            // Final stats
            const finalStats = await db.getStatistics();
            console.log('🎉 DATABASE FIXED SUCCESSFULLY!');
            console.log(`   Before: ${stats.totalCustomers} customers (corrupted)`);
            console.log(`   After:  ${finalStats.totalCustomers} customers (clean)`);
            console.log('\n✅ Database is now clean and ready!\n');
            
            // Log success
            await db.logSync({
                type: 'auto-fix',
                fetched: customers.length,
                updated: result.successCount,
                errors: result.errorCount,
                startedAt: syncStartedAt,
                completedAt: new Date().toISOString(),
                status: result.errorCount > 0 ? 'partial' : 'success',
                errorMessage: result.errorCount > 0 ? 'Errors while updating customers during auto fix' : null
            });
            
        } else if (stats.totalCustomers === 0) {
            console.log('\n📭 Database is empty. Running initial sync...\n');
            
            // Initial sync
            const ploomeService = new PloomeService(process.env.PLOOME_API_KEY);
            await ploomeService.testConnection();
            await ploomeService.fetchTags();
            
            const initialStartedAt = new Date().toISOString();
            const customers = await ploomeService.fetchAllContacts((progress) => {
                process.stdout.write(`\r  📈 Progress: ${progress.fetched} customers imported...`);
            });
            
            console.log(`\n✅ ${customers.length} customers imported\n`);
            
            let result = { successCount: 0, errorCount: 0 };
            if (customers.length > 0) {
                result = await db.upsertCustomersBatch(customers);
                console.log(`✅ ${result.successCount} customers saved\n`);
            }
            
            await db.logSync({
                type: 'initial-sync',
                fetched: customers.length,
                updated: result.successCount,
                errors: result.errorCount,
                startedAt: initialStartedAt,
                completedAt: new Date().toISOString(),
                status: result.errorCount > 0 ? 'partial' : 'success',
                errorMessage: result.errorCount > 0 ? 'Errors while saving customers during initial sync' : null
            });
            
        } else {
            console.log(`✅ Database is healthy (${stats.totalCustomers} customers)\n`);
        }
        
    } catch (error) {
        console.error('❌ Error during database check:', error.message);
        console.error('   Stack:', error.stack);

        if (db && db.isInitialized) {
            try {
                await db.logSync({
                    type: 'auto-fix-error',
                    fetched: 0,
                    updated: 0,
                    errors: 1,
                    startedAt: new Date().toISOString(),
                    completedAt: new Date().toISOString(),
                    status: 'error',
                    errorMessage: error.message
                });
            } catch (logError) {
                console.error('⚠️  Failed to log auto-fix error:', logError.message);
            }
        }
        
        // In production with FORCE_DB_RESET, this is critical
        if (process.env.NODE_ENV === 'production' && forceReset) {
            console.error('🔴 CRITICAL: Force reset failed in production!');
            console.error('   This may cause incorrect data to persist.');
            console.error('   Please check logs and manually run cleanup if needed.');
        }
        
        // Don't crash the server, but log detailed error
        // In Railway/production, return gracefully to allow server startup
        if (process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_GIT_COMMIT_SHA) {
            console.log('⚠️  Database check failed but allowing startup in Railway environment');
            console.log('   Database will be initialized lazily on first request');
            return;
        }
    } finally {
        if (db) {
            await db.close();
        }
    }
}

// Export for use in server.js
module.exports = checkAndFixDatabase;

// Run if called directly
if (require.main === module) {
    checkAndFixDatabase().then(() => {
        console.log('✅ Database check complete');
        process.exit(0);
    }).catch(error => {
        console.error('❌ Database check failed:', error);
        process.exit(1);
    });
}
