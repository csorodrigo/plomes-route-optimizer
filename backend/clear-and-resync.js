#!/usr/bin/env node

/**
 * CRITICAL FIX: Clear database and re-sync with proper Cliente tag filtering
 * 
 * This script fixes the production issue where the database contains 4251 customers
 * instead of the expected ~2400 customers with "Cliente" tag only.
 * 
 * Root cause: Old data from previous syncs when filtering was broken
 * Solution: Clear database and re-sync with working tag filter
 */

require('dotenv').config();
const DatabaseService = require('./services/sync/database-service');
const PloomeService = require('./services/sync/ploome-service');
const fs = require('fs');
const path = require('path');

async function clearAndResync() {
    console.log('\n🚨 CRITICAL FIX: Clearing database and re-syncing with proper filtering...\n');
    
    let db;
    
    try {
        // Check if this is a production environment
        const isProduction = process.env.NODE_ENV === 'production';
        if (isProduction) {
            console.log('⚠️  PRODUCTION MODE DETECTED - This will clear ALL customer data!');
            console.log('Press Ctrl+C within 10 seconds to cancel...\n');
            
            // Wait 10 seconds in production as safety measure
            for (let i = 10; i > 0; i--) {
                process.stdout.write(`\rStarting in ${i} seconds...`);
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            console.log('\n');
        }

        // Initialize database service
        db = new DatabaseService();
        await db.connect();
        console.log('✅ Connected to database');

        // Backup existing database (safety measure)
        const dbPath = db.dbPath;
        const backupPath = dbPath + '.backup-' + Date.now();
        if (fs.existsSync(dbPath)) {
            fs.copyFileSync(dbPath, backupPath);
            console.log(`✅ Database backed up to: ${backupPath}`);
        }

        // Get current count before clearing
        const currentStats = await db.getStatistics();
        console.log(`📊 Current database state:`);
        console.log(`   • Total customers: ${currentStats.totalCustomers}`);
        console.log(`   • Geocoded customers: ${currentStats.geocodedCustomers}\n`);

        // Clear ALL customer-related data
        console.log('🗑️  Clearing customer data...');
        await db.run('DELETE FROM customers');
        await db.run('DELETE FROM sync_logs');
        await db.run('DELETE FROM routes'); // Routes depend on customers, so clear them too
        console.log('✅ Database cleared\n');

        // Initialize fresh database structure
        await db.createTables();
        await db.runMigrations();
        await db.createIndexes();
        console.log('✅ Database structure recreated\n');

        // Initialize Ploome service
        const ploomeService = new PloomeService(process.env.PLOOME_API_KEY);
        
        // Test connection
        const connectionOk = await ploomeService.testConnection();
        if (!connectionOk) {
            throw new Error('Cannot connect to Ploome API. Check API key.');
        }
        console.log('✅ Ploome API connection verified\n');

        // Fetch and cache tags
        console.log('🏷️  Fetching tag definitions...');
        await ploomeService.fetchTags();
        console.log(`✅ ${ploomeService.tagCache.size} tags cached\n`);

        // Verify CLIENT_TAG_ID is in the cache
        const clientTagName = ploomeService.tagCache.get(ploomeService.CLIENT_TAG_ID);
        if (clientTagName === 'Cliente') {
            console.log(`✅ CLIENT_TAG_ID (${ploomeService.CLIENT_TAG_ID}) correctly maps to "Cliente" tag\n`);
        } else {
            console.log(`⚠️  CLIENT_TAG_ID (${ploomeService.CLIENT_TAG_ID}) maps to "${clientTagName}" - this may be incorrect\n`);
        }

        // Sync customers with proper filtering
        console.log('📥 Syncing customers with "Cliente" tag filtering...');
        const startTime = Date.now();
        
        const customers = await ploomeService.fetchAllContacts((progress) => {
            process.stdout.write(`\r  📈 Progress: ${progress.fetched} "Cliente" customers imported...`);
        });
        
        console.log(`\n✅ ${customers.length} "Cliente" customers imported\n`);

        // Verify filtering worked
        if (customers.length > 3000) {
            console.log(`⚠️  WARNING: ${customers.length} customers seems too high for "Cliente" tag only`);
            console.log('   Expected: ~2400 customers. Please verify tag filtering is working.\n');
        } else if (customers.length < 1000) {
            console.log(`⚠️  WARNING: ${customers.length} customers seems too low`);
            console.log('   This might indicate an issue with tag filtering or API access.\n');
        } else {
            console.log(`✅ Customer count (${customers.length}) looks reasonable for "Cliente" tag filtering\n`);
        }

        // Save to database
        if (customers.length > 0) {
            console.log('💾 Saving customers to database...');
            const result = await db.upsertCustomersBatch(customers);
            console.log(`✅ ${result.successCount} customers saved successfully`);
            
            if (result.errorCount > 0) {
                console.log(`⚠️  ${result.errorCount} customers had errors while saving`);
            }
        }

        // Final statistics
        const finalStats = await db.getStatistics();
        const duration = (Date.now() - startTime) / 1000;
        
        console.log('\n📊 Final Results:');
        console.log(`   • Total customers in database: ${finalStats.totalCustomers}`);
        console.log(`   • Customers geocodified: ${finalStats.geocodedCustomers}`);
        console.log(`   • Pending geocoding: ${finalStats.pendingGeocoding}`);
        console.log(`   • Sync duration: ${duration.toFixed(2)} seconds\n`);

        // Success summary
        console.log('🎉 SUCCESS! Database cleared and re-synced with proper filtering.');
        console.log(`   Before: ${currentStats.totalCustomers} customers (included non-Clientes)`);
        console.log(`   After:  ${finalStats.totalCustomers} customers (Cliente tag only)`);
        console.log('\n   The production application should now show the correct customer count.\n');

        // Log the successful sync
        await db.logSync('success', finalStats.totalCustomers, `Cleared database and re-synced with proper "Cliente" tag filtering`);

    } catch (error) {
        console.error('\n❌ CRITICAL ERROR during clear and re-sync:', error.message);
        console.error('\nDetails:', error);
        
        if (db) {
            try {
                await db.logSync('error', 0, error.message);
            } catch (logError) {
                console.error('Error logging sync failure:', logError);
            }
        }
        
        process.exit(1);
    } finally {
        if (db) {
            await db.close();
        }
    }
}

// Show warning and run
if (require.main === module) {
    console.log('🚨 CRITICAL FIX: Database Clear and Re-sync');
    console.log('=====================================');
    console.log('This script will:');
    console.log('1. Clear ALL customer data from the database');
    console.log('2. Re-import only customers with "Cliente" tag');
    console.log('3. Fix the customer count mismatch in production\n');
    
    clearAndResync();
}

module.exports = clearAndResync;