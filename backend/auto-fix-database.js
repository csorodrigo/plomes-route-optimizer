#!/usr/bin/env node

/**
 * AUTO-FIX DATABASE ON STARTUP
 * This script runs automatically when the server starts
 * It checks if the database has corrupted data and fixes it
 */

require('dotenv').config();
const DatabaseService = require('./services/sync/database-service');
const PloomeService = require('./services/sync/ploome-service');
const fs = require('fs');

async function checkAndFixDatabase() {
    console.log('\n🔍 Checking database integrity...\n');
    
    let db;
    
    try {
        // Initialize database
        db = new DatabaseService();
        await db.connect();
        
        // Check current customer count
        const stats = await db.getStatistics();
        console.log(`📊 Current customer count: ${stats.totalCustomers}`);
        
        // If we have more than 3000 customers, database is corrupted
        if (stats.totalCustomers > 3000) {
            console.log('\n⚠️  DATABASE CORRUPTION DETECTED!');
            console.log(`   Found ${stats.totalCustomers} customers (expected ~2400)`);
            console.log('   Database contains non-customer contacts (FORNECEDORES, etc.)');
            console.log('\n🚨 STARTING AUTOMATIC FIX...\n');
            
            // Backup database
            const dbPath = db.dbPath;
            const backupPath = dbPath + '.backup-autofix-' + Date.now();
            if (fs.existsSync(dbPath)) {
                fs.copyFileSync(dbPath, backupPath);
                console.log(`✅ Database backed up to: ${backupPath}`);
            }
            
            // Clear corrupted data
            console.log('🗑️  Clearing corrupted data...');
            await db.run('DELETE FROM customers');
            await db.run('DELETE FROM sync_logs');
            await db.run('DELETE FROM routes');
            console.log('✅ Database cleared\n');
            
            // Recreate structure
            await db.createTables();
            await db.runMigrations();
            await db.createIndexes();
            console.log('✅ Database structure recreated\n');
            
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
            
            // Sync only customers with "Cliente" tag
            console.log('📥 Importing customers with "Cliente" tag only...');
            const customers = await ploomeService.fetchAllContacts((progress) => {
                process.stdout.write(`\r  📈 Progress: ${progress.fetched} customers imported...`);
            });
            
            console.log(`\n✅ ${customers.length} customers imported\n`);
            
            // Save to database
            if (customers.length > 0) {
                console.log('💾 Saving to database...');
                const result = await db.upsertCustomersBatch(customers);
                console.log(`✅ ${result.successCount} customers saved\n`);
            }
            
            // Final stats
            const finalStats = await db.getStatistics();
            console.log('🎉 DATABASE FIXED SUCCESSFULLY!');
            console.log(`   Before: ${stats.totalCustomers} customers (corrupted)`);
            console.log(`   After:  ${finalStats.totalCustomers} customers (clean)`);
            console.log('\n✅ Database is now clean and ready!\n');
            
            // Log success
            await db.logSync('auto-fix', finalStats.totalCustomers, 'Automatic database cleanup completed');
            
        } else if (stats.totalCustomers === 0) {
            console.log('\n📭 Database is empty. Running initial sync...\n');
            
            // Initial sync
            const ploomeService = new PloomeService(process.env.PLOOME_API_KEY);
            await ploomeService.testConnection();
            await ploomeService.fetchTags();
            
            const customers = await ploomeService.fetchAllContacts((progress) => {
                process.stdout.write(`\r  📈 Progress: ${progress.fetched} customers imported...`);
            });
            
            console.log(`\n✅ ${customers.length} customers imported\n`);
            
            if (customers.length > 0) {
                const result = await db.upsertCustomersBatch(customers);
                console.log(`✅ ${result.successCount} customers saved\n`);
            }
            
            await db.logSync('initial', customers.length, 'Initial database population');
            
        } else {
            console.log(`✅ Database is healthy (${stats.totalCustomers} customers)\n`);
        }
        
    } catch (error) {
        console.error('❌ Error during database check:', error.message);
        // Don't crash the server, just log the error
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