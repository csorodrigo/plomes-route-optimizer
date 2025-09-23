#!/usr/bin/env node

/**
 * EMERGENCY DATABASE CLEANUP
 * 
 * This script forces a complete database cleanup and re-sync
 * Use this when auto-fix-database.js fails or doesn't trigger
 * 
 * Usage: node backend/emergency-cleanup.js
 */

require('dotenv').config();
const DatabaseService = require('./services/sync/database-service');
const PloomeService = require('./services/sync/ploome-service');
const fs = require('fs');

console.log(`
╔══════════════════════════════════════════════════════════╗
║         🚨 EMERGENCY DATABASE CLEANUP SCRIPT 🚨           ║
║                                                            ║
║  This will:                                                ║
║  1. Backup current database                                ║
║  2. DELETE ALL customer data                               ║
║  3. Re-sync ONLY customers with "Cliente" tag              ║
║                                                            ║
║  Environment: ${process.env.NODE_ENV || 'development'}                                    ║
╚══════════════════════════════════════════════════════════╝
`);

async function emergencyCleanup() {
    let db;
    
    try {
        // Step 1: Initialize database
        console.log('\n📂 Initializing database...');
        db = new DatabaseService();
        await db.initialize();
        
        // Step 2: Show current state
        const beforeStats = await db.getStatistics();
        console.log(`\n📊 BEFORE CLEANUP:`);
        console.log(`   Total customers: ${beforeStats.totalCustomers}`);
        console.log(`   With coordinates: ${beforeStats.withCoordinates}`);
        console.log(`   Without coordinates: ${beforeStats.withoutCoordinates}`);
        
        // Step 3: Backup database
        console.log('\n💾 Creating backup...');
        const dbPath = db.dbPath;
        const backupPath = dbPath + '.emergency-backup-' + Date.now();
        if (fs.existsSync(dbPath)) {
            fs.copyFileSync(dbPath, backupPath);
            console.log(`✅ Backup saved to: ${backupPath}`);
        }
        
        // Step 4: FORCE DELETE ALL DATA
        console.log('\n🗑️  DELETING ALL DATA...');
        await db.run('DELETE FROM customers');
        await db.run('DELETE FROM sync_logs');
        await db.run('DELETE FROM routes');
        console.log('✅ All data deleted');
        
        // Step 5: Recreate structure
        console.log('\n🏗️  Recreating database structure...');
        await db.createTables();
        await db.runMigrations();
        await db.createIndexes();
        console.log('✅ Database structure recreated');
        
        // Step 6: Connect to Ploome
        console.log('\n🔌 Connecting to Ploome API...');
        const ploomeService = new PloomeService(process.env.PLOOME_API_KEY);
        
        // Show which CLIENT_TAG_ID we're using
        console.log(`🎯 Using CLIENT_TAG_ID: ${ploomeService.CLIENT_TAG_ID}`);
        
        // Test connection
        const connectionOk = await ploomeService.testConnection();
        if (!connectionOk) {
            throw new Error('Cannot connect to Ploome API - check your API key');
        }
        console.log('✅ Connected to Ploome API');
        
        // Step 7: Fetch tags to ensure proper filtering
        console.log('\n🏷️  Loading tag definitions...');
        await ploomeService.fetchTags();
        console.log(`✅ ${ploomeService.tagCache.size} tags loaded`);
        
        // Find and display the "Cliente" tag
        let clienteTagFound = false;
        for (const [tagId, tagName] of ploomeService.tagCache) {
            if (tagName.toLowerCase().includes('cliente')) {
                console.log(`   Found: Tag "${tagName}" with ID ${tagId}`);
                if (tagId === ploomeService.CLIENT_TAG_ID) {
                    clienteTagFound = true;
                    console.log(`   ✅ This matches our CLIENT_TAG_ID!`);
                }
            }
        }
        
        if (!clienteTagFound) {
            console.log(`   ⚠️ WARNING: Tag ID ${ploomeService.CLIENT_TAG_ID} may not be "Cliente"`);
        }
        
        // Step 8: Sync ONLY customers with "Cliente" tag
        console.log('\n📥 Starting sync (ONLY "Cliente" tagged contacts)...');
        let progressCount = 0;
        const customers = await ploomeService.fetchAllContacts((progress) => {
            progressCount++;
            if (progressCount % 10 === 0) {
                process.stdout.write(`\r   📈 Progress: ${progress.fetched} customers imported...`);
            }
        });
        
        console.log(`\n✅ ${customers.length} customers with "Cliente" tag imported`);
        
        // Step 9: Save to database
        if (customers.length > 0) {
            console.log('\n💾 Saving to database...');
            const result = await db.upsertCustomersBatch(customers);
            console.log(`✅ ${result.successCount} customers saved`);
            if (result.errorCount > 0) {
                console.log(`⚠️  ${result.errorCount} errors during save`);
            }
        }
        
        // Step 10: Show final state
        const afterStats = await db.getStatistics();
        console.log(`\n📊 AFTER CLEANUP:`);
        console.log(`   Total customers: ${afterStats.totalCustomers}`);
        console.log(`   With coordinates: ${afterStats.withCoordinates}`);
        console.log(`   Without coordinates: ${afterStats.withoutCoordinates}`);
        
        // Step 11: Log the cleanup
        await db.logSync('emergency-cleanup', afterStats.totalCustomers, 'Emergency database cleanup completed');
        
        // Success summary
        console.log(`
╔══════════════════════════════════════════════════════════╗
║              ✅ CLEANUP COMPLETED SUCCESSFULLY             ║
║                                                            ║
║  Before: ${String(beforeStats.totalCustomers).padEnd(6)} customers                              ║
║  After:  ${String(afterStats.totalCustomers).padEnd(6)} customers (only "Cliente" tag)       ║
║                                                            ║
║  Database is now clean and ready!                         ║
╚══════════════════════════════════════════════════════════╝
        `);
        
    } catch (error) {
        console.error('\n❌ EMERGENCY CLEANUP FAILED!');
        console.error('   Error:', error.message);
        console.error('   Stack:', error.stack);
        process.exit(1);
    } finally {
        if (db) {
            await db.close();
        }
    }
}

// Run the cleanup
emergencyCleanup().then(() => {
    console.log('\n✅ Emergency cleanup complete');
    process.exit(0);
}).catch(error => {
    console.error('\n❌ Emergency cleanup failed:', error);
    process.exit(1);
});