#!/usr/bin/env node

/**
 * Geocoding Failed Saves Recovery Script
 *
 * This script attempts to recover and retry geocoding results that were
 * successfully geocoded but failed to save to the database.
 */

const path = require('path');
const fs = require('fs').promises;
const DatabaseService = require('../services/sync/database-service');

class FailedSavesRecovery {
    constructor() {
        this.db = new DatabaseService();
        this.config = {
            reportFiles: [
                path.join(__dirname, '../logs/mass-geocoding-backup.json'),
                path.join(__dirname, '../logs/geocoding-backup.json')
            ],
            maxRetries: 5,
            retryDelay: 2000
        };
    }

    async initialize() {
        console.log('🔧 Initializing Failed Saves Recovery...');
        await this.db.ensureInitialized();
    }

    async findFailedSaves() {
        const failedSaves = [];

        for (const filePath of this.config.reportFiles) {
            try {
                console.log(`🔍 Checking: ${path.basename(filePath)}`);

                const data = await fs.readFile(filePath, 'utf8');
                const parsed = JSON.parse(data);

                // Look for failed saves in report data
                if (parsed.failedSaves && Array.isArray(parsed.failedSaves)) {
                    failedSaves.push(...parsed.failedSaves);
                    console.log(`   Found ${parsed.failedSaves.length} failed saves`);
                }

                // Also check backup results for geocoded but not saved
                if (parsed.results && Array.isArray(parsed.results)) {
                    console.log(`   Found ${parsed.results.length} geocoded results to verify`);

                    // Check if these results are actually saved in database
                    for (const result of parsed.results) {
                        if (result.latitude && result.longitude) {
                            const customer = await this.getCustomerFromDatabase(result.id);

                            if (!customer || !customer.latitude || !customer.longitude) {
                                failedSaves.push({
                                    customer: result,
                                    coordinates: {
                                        lat: result.latitude,
                                        lng: result.longitude
                                    },
                                    error: 'Geocoded but not saved to database',
                                    source: 'backup_verification'
                                });
                            }
                        }
                    }
                }

            } catch (error) {
                console.log(`   ⚠️  Could not read ${path.basename(filePath)}: ${error.message}`);
            }
        }

        // Remove duplicates based on customer ID
        const uniqueFailedSaves = failedSaves.reduce((acc, current) => {
            const customerId = current.customer.id;
            if (!acc.find(item => item.customer.id === customerId)) {
                acc.push(current);
            }
            return acc;
        }, []);

        console.log(`\n📊 Found ${uniqueFailedSaves.length} unique failed saves to recover`);
        return uniqueFailedSaves;
    }

    async getCustomerFromDatabase(customerId) {
        try {
            const customers = await this.db.listCustomers();
            return customers.find(c => c.id === customerId);
        } catch (error) {
            console.error(`Error fetching customer ${customerId}:`, error.message);
            return null;
        }
    }

    async retryFailedSave(failedSave, attempt = 1) {
        const { customer, coordinates } = failedSave;
        const maxAttempts = this.config.maxRetries;

        try {
            console.log(`🔄 Retry ${attempt}/${maxAttempts}: ${customer.name} (${customer.id})`);

            // Attempt to save coordinates
            await this.db.updateCustomerCoordinates(
                customer.id,
                coordinates.lat,
                coordinates.lng,
                'completed'
            );

            // Verify save worked
            const savedCustomer = await this.getCustomerFromDatabase(customer.id);
            if (savedCustomer && savedCustomer.latitude && savedCustomer.longitude) {
                const savedLat = parseFloat(savedCustomer.latitude);
                const savedLng = parseFloat(savedCustomer.longitude);
                const expectedLat = parseFloat(coordinates.lat);
                const expectedLng = parseFloat(coordinates.lng);

                if (Math.abs(savedLat - expectedLat) < 0.000001 && Math.abs(savedLng - expectedLng) < 0.000001) {
                    console.log(`   ✅ Successfully recovered: ${customer.name}`);
                    return { success: true, customer, coordinates };
                }
            }

            throw new Error('Save verification failed');

        } catch (error) {
            console.log(`   ❌ Attempt ${attempt} failed: ${error.message}`);

            if (attempt < maxAttempts) {
                console.log(`   ⏳ Waiting ${this.config.retryDelay}ms before retry...`);
                await this.delay(this.config.retryDelay);
                return await this.retryFailedSave(failedSave, attempt + 1);
            } else {
                console.log(`   💥 All attempts failed for: ${customer.name}`);
                return { success: false, customer, coordinates, error: error.message };
            }
        }
    }

    async recoverAllFailedSaves() {
        const failedSaves = await this.findFailedSaves();

        if (failedSaves.length === 0) {
            console.log('✅ No failed saves found to recover');
            return { recovered: 0, stillFailed: 0 };
        }

        console.log(`\n🚀 Starting recovery of ${failedSaves.length} failed saves...`);

        const results = {
            recovered: 0,
            stillFailed: 0,
            recoveredCustomers: [],
            stillFailedCustomers: []
        };

        for (let i = 0; i < failedSaves.length; i++) {
            const failedSave = failedSaves[i];

            console.log(`\n[${i + 1}/${failedSaves.length}] Processing: ${failedSave.customer.name}`);

            const result = await this.retryFailedSave(failedSave);

            if (result.success) {
                results.recovered++;
                results.recoveredCustomers.push(result);
            } else {
                results.stillFailed++;
                results.stillFailedCustomers.push(result);
            }

            // Small delay between recoveries
            if (i < failedSaves.length - 1) {
                await this.delay(500);
            }
        }

        return results;
    }

    async generateRecoveryReport(results) {
        const report = {
            timestamp: new Date().toISOString(),
            summary: {
                totalAttempted: results.recovered + results.stillFailed,
                recovered: results.recovered,
                stillFailed: results.stillFailed,
                recoveryRate: results.recovered + results.stillFailed > 0 ?
                    ((results.recovered / (results.recovered + results.stillFailed)) * 100).toFixed(2) : 0
            },
            recoveredCustomers: results.recoveredCustomers.map(r => ({
                id: r.customer.id,
                name: r.customer.name,
                coordinates: r.coordinates
            })),
            stillFailedCustomers: results.stillFailedCustomers.map(r => ({
                id: r.customer.id,
                name: r.customer.name,
                coordinates: r.coordinates,
                error: r.error
            }))
        };

        // Save report
        const reportFile = path.join(__dirname, '../logs/recovery-report.json');
        await fs.writeFile(reportFile, JSON.stringify(report, null, 2));

        // Display summary
        console.log('\n' + '='.repeat(60));
        console.log('🎯 RECOVERY SUMMARY');
        console.log('='.repeat(60));
        console.log(`📊 Total Attempted: ${report.summary.totalAttempted}`);
        console.log(`✅ Recovered: ${report.summary.recovered}`);
        console.log(`❌ Still Failed: ${report.summary.stillFailed}`);
        console.log(`📈 Recovery Rate: ${report.summary.recoveryRate}%`);
        console.log(`📁 Report Saved: ${reportFile}`);
        console.log('='.repeat(60));

        if (results.stillFailed > 0) {
            console.log(`\n⚠️  ${results.stillFailed} customers still failed recovery.`);
            console.log('   These may require manual intervention or data correction.');
        }

        return reportFile;
    }

    async run() {
        try {
            await this.initialize();

            console.log('🔧 GEOCODING FAILED SAVES RECOVERY');
            console.log('='.repeat(60));

            const results = await this.recoverAllFailedSaves();
            await this.generateRecoveryReport(results);

        } catch (error) {
            console.error('\n❌ Fatal error in recovery process:', error.message);
            console.error('Stack trace:', error.stack);
            process.exit(1);
        }
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Script execution
async function main() {
    const recovery = new FailedSavesRecovery();
    await recovery.run();
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = FailedSavesRecovery;