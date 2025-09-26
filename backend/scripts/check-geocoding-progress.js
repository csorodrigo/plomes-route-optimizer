#!/usr/bin/env node

/**
 * Geocoding Progress Checker
 *
 * This script checks the current progress of geocoding operations
 * and provides detailed statistics about the geocoding status.
 */

const DatabaseService = require('../services/sync/database-service');
const fs = require('fs').promises;
const path = require('path');

class GeocodingProgressChecker {
    constructor() {
        this.db = new DatabaseService();
    }

    async initialize() {
        await this.db.ensureInitialized();
    }

    async getGeocodingStatistics() {
        console.log('📊 Fetching geocoding statistics...\n');

        try {
            // Get overall statistics
            const stats = await this.db.getStatistics();
            const geocodingStats = await this.db.getGeocodingStats();

            // Get customers with coordinates
            const geocodedCustomers = await this.db.getGeocodedCustomers(10);

            // Calculate percentages
            const totalCustomers = stats.totalCustomers;
            const geocodedCount = stats.geocodedCustomers;
            const pendingCount = geocodingStats.pending;
            const failedCount = geocodingStats.failed + geocodingStats.error;

            const geocodedPercentage = totalCustomers > 0 ?
                ((geocodedCount / totalCustomers) * 100).toFixed(2) : '0.00';
            const pendingPercentage = totalCustomers > 0 ?
                ((pendingCount / totalCustomers) * 100).toFixed(2) : '0.00';
            const failedPercentage = totalCustomers > 0 ?
                ((failedCount / totalCustomers) * 100).toFixed(2) : '0.00';

            // Display results
            console.log('🎯 GEOCODING OVERVIEW');
            console.log('=' .repeat(50));
            console.log(`📈 Total Customers: ${totalCustomers}`);
            console.log(`✅ Geocoded: ${geocodedCount} (${geocodedPercentage}%)`);
            console.log(`⏳ Pending: ${pendingCount} (${pendingPercentage}%)`);
            console.log(`❌ Failed: ${failedCount} (${failedPercentage}%)`);
            console.log();

            // Detailed breakdown
            console.log('📋 DETAILED BREAKDOWN');
            console.log('=' .repeat(50));
            console.log(`✅ Completed: ${geocodingStats.completed}`);
            console.log(`⏳ Pending: ${geocodingStats.pending}`);
            console.log(`❌ Failed: ${geocodingStats.failed}`);
            console.log(`💥 Error: ${geocodingStats.error}`);
            console.log();

            // Recent geocoded examples
            if (geocodedCustomers.length > 0) {
                console.log('🌍 RECENT GEOCODED CUSTOMERS');
                console.log('=' .repeat(50));
                geocodedCustomers.slice(0, 5).forEach((customer, index) => {
                    const lat = parseFloat(customer.latitude).toFixed(6);
                    const lng = parseFloat(customer.longitude).toFixed(6);
                    console.log(`${index + 1}. ${customer.name} - (${lat}, ${lng})`);
                    if (customer.city && customer.state) {
                        console.log(`   📍 ${customer.city}, ${customer.state}`);
                    }
                });
                console.log();
            }

            return {
                totalCustomers,
                geocodedCount,
                pendingCount,
                failedCount,
                geocodedPercentage: parseFloat(geocodedPercentage),
                pendingPercentage: parseFloat(pendingPercentage),
                failedPercentage: parseFloat(failedPercentage),
                detailedStats: geocodingStats
            };

        } catch (error) {
            console.error('❌ Error fetching statistics:', error.message);
            throw error;
        }
    }

    async checkCheckpointStatus() {
        const checkpointFile = path.join(__dirname, '../logs/geocoding-checkpoint.json');

        try {
            const checkpointData = await fs.readFile(checkpointFile, 'utf8');
            const checkpoint = JSON.parse(checkpointData);

            console.log('🔄 CHECKPOINT STATUS');
            console.log('=' .repeat(50));
            console.log(`📅 Last Update: ${new Date(checkpoint.timestamp).toLocaleString()}`);
            console.log(`📊 Processed: ${checkpoint.processedCount}`);
            console.log(`✅ Success: ${checkpoint.successCount}`);
            console.log(`❌ Errors: ${checkpoint.errorCount}`);

            if (checkpoint.estimatedTimeRemaining) {
                const eta = checkpoint.estimatedTimeRemaining;
                const etaFormatted = eta > 60 ?
                    `${Math.round(eta / 60)} minutes` :
                    `${eta} seconds`;
                console.log(`⏱️  ETA: ${etaFormatted}`);
            }
            console.log();

            return checkpoint;
        } catch (error) {
            console.log('📝 No active checkpoint found');
            console.log();
            return null;
        }
    }

    async checkRecentLogs() {
        const logsDir = path.join(__dirname, '../logs');

        try {
            const files = await fs.readdir(logsDir);
            const logFiles = files
                .filter(file => file.startsWith('mass-geocoding-') && file.endsWith('.log'))
                .sort()
                .reverse(); // Most recent first

            if (logFiles.length === 0) {
                console.log('📝 No recent geocoding logs found');
                console.log();
                return;
            }

            console.log('📋 RECENT GEOCODING LOGS');
            console.log('=' .repeat(50));

            // Show last 3 log files
            const recentLogs = logFiles.slice(0, 3);
            for (const logFile of recentLogs) {
                const logPath = path.join(logsDir, logFile);
                const stats = await fs.stat(logPath);
                const size = (stats.size / 1024).toFixed(2);

                console.log(`📄 ${logFile}`);
                console.log(`   Size: ${size} KB | Modified: ${stats.mtime.toLocaleString()}`);
            }
            console.log();

            // Show recent backup info
            const backupFile = path.join(logsDir, 'geocoding-backup.json');
            try {
                const backupData = await fs.readFile(backupFile, 'utf8');
                const backup = JSON.parse(backupData);

                console.log('💾 BACKUP STATUS');
                console.log('=' .repeat(50));
                console.log(`📅 Last Backup: ${new Date(backup.timestamp).toLocaleString()}`);
                console.log(`📊 Results Backed Up: ${backup.totalResults}`);
                console.log(`✅ Success Rate: ${((backup.summary.successCount / backup.summary.processedCount) * 100).toFixed(2)}%`);
                console.log();
            } catch (backupError) {
                console.log('💾 No backup file found');
                console.log();
            }

        } catch (error) {
            console.log('📝 Unable to read logs directory');
            console.log();
        }
    }

    async generateProgressReport() {
        console.clear();
        console.log('🚀 GEOCODING PROGRESS REPORT');
        console.log('=' .repeat(80));
        console.log(`Generated: ${new Date().toLocaleString()}`);
        console.log('=' .repeat(80));
        console.log();

        try {
            // Get main statistics
            const stats = await this.getGeocodingStatistics();

            // Check checkpoint status
            await this.checkCheckpointStatus();

            // Check recent logs
            await this.checkRecentLogs();

            // Provide recommendations
            console.log('💡 RECOMMENDATIONS');
            console.log('=' .repeat(50));

            if (stats.pendingCount > 0) {
                console.log('📍 You have customers pending geocoding.');
                console.log('   Run: ./run-mass-geocode.sh');
            } else {
                console.log('✅ All customers have been processed for geocoding!');
            }

            if (stats.failedCount > 0) {
                const failedPercentage = stats.failedPercentage;
                if (failedPercentage > 10) {
                    console.log('⚠️  High failure rate detected. Consider:');
                    console.log('   - Checking API keys and rate limits');
                    console.log('   - Reviewing customer address quality');
                    console.log('   - Running diagnostic mode');
                } else {
                    console.log(`ℹ️  ${stats.failedCount} customers failed geocoding (normal for incomplete addresses)`);
                }
            }

            console.log();
            console.log('🔄 To re-run this report: node backend/scripts/check-geocoding-progress.js');
            console.log('=' .repeat(80));

        } catch (error) {
            console.error('❌ Error generating progress report:', error.message);
        }
    }

    async run() {
        try {
            await this.initialize();
            await this.generateProgressReport();
        } catch (error) {
            console.error('Fatal error:', error.message);
            process.exit(1);
        }
    }
}

// Script execution
async function main() {
    const checker = new GeocodingProgressChecker();
    await checker.run();
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = GeocodingProgressChecker;