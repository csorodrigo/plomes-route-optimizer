#!/usr/bin/env node

/**
 * CONTINUATION SCRIPT: Mass Geocoding from Offset 972
 *
 * CRITICAL: This script continues geocoding from where the original script stopped.
 * - Original script successfully geocoded 972 customers
 * - This script processes remaining 1,275 customers (offset 972)
 * - Uses same proven approach as mass-geocode-with-persistence.js
 * - Direct database approach with guaranteed persistence
 *
 * STATUS: 972/2247 customers completed (43.3%) - RESUMING NOW
 */

const path = require('path');
const fs = require('fs').promises;
const DatabaseService = require('../services/sync/database-service');
const GeocodingService = require('../services/geocoding/geocoding-service');

class ContinueGeocodingFrom972 {
    constructor() {
        this.db = new DatabaseService();
        this.geocodingService = new GeocodingService(this.db);

        // Configuration optimized for continuation
        this.config = {
            startOffset: 972,         // START FROM WHERE WE LEFT OFF
            batchSize: 20,            // Same as working script
            saveInterval: 10,         // Save to DB every N successful geocodes
            maxRetries: 3,            // Max retries for failed database saves
            progressReportInterval: 50, // Report progress every 50 customers
            backupFile: path.join(__dirname, '../logs/geocoding-continuation-backup.json'),
            checkpointFile: path.join(__dirname, '../logs/geocoding-continuation-checkpoint.json'),
            logFile: path.join(__dirname, '../logs/geocoding-continuation.log'),
            delayBetweenRequests: 250 // Same delay as working script
        };

        // State tracking
        this.state = {
            totalCustomersInDb: 2247,
            alreadyProcessed: 972,
            remainingToProcess: 1275,
            currentProcessedCount: 0,
            successCount: 0,
            errorCount: 0,
            persistenceRetries: 0,
            startTime: null,
            geocodedResults: [],
            failedSaves: []
        };

        this.logStream = null;
    }

    async initialize() {
        console.log('🚀 CONTINUING Mass Geocoding from Customer 972...');
        console.log(`📊 Status: 972/2247 customers completed (${((972/2247)*100).toFixed(1)}%)`);
        console.log(`🎯 Target: Process remaining 1,275 customers`);

        // Ensure logs directory exists
        const logsDir = path.dirname(this.config.logFile);
        await fs.mkdir(logsDir, { recursive: true });

        // Initialize database
        await this.db.ensureInitialized();

        // Initialize logging
        await this.initializeLogging();

        this.log('info', '='.repeat(80));
        this.log('info', 'CONTINUING MASS GEOCODING FROM OFFSET 972');
        this.log('info', `Already processed: ${this.state.alreadyProcessed}`);
        this.log('info', `Remaining to process: ${this.state.remainingToProcess}`);
        this.log('info', `Start Time: ${new Date().toISOString()}`);
        this.log('info', `Configuration: ${JSON.stringify(this.config, null, 2)}`);
        this.log('info', '='.repeat(80));

        console.log('✅ Continuation initialization complete');
    }

    async initializeLogging() {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const logFileName = `geocoding-continuation-${timestamp}.log`;
        this.config.logFile = path.join(path.dirname(this.config.logFile), logFileName);
        console.log(`📝 Log file: ${this.config.logFile}`);
    }

    async log(level, message, data = null) {
        const timestamp = new Date().toISOString();
        const logLine = `[${timestamp}] ${level.toUpperCase()}: ${message}${data ? ' | ' + JSON.stringify(data) : ''}\n`;

        try {
            await fs.appendFile(this.config.logFile, logLine);
        } catch (error) {
            console.error('Failed to write to log file:', error.message);
        }

        // Console log for important messages
        if (['error', 'warn', 'info'].includes(level)) {
            console.log(`[${level.toUpperCase()}] ${message}`);
        }
    }

    async getCustomersForContinuationGeocoding() {
        this.log('info', `Fetching customers for continuation geocoding (starting from offset ${this.config.startOffset})...`);

        try {
            // Get ALL customers to find those that still need geocoding
            const allCustomers = await this.db.getCustomersForGeocoding(5000);

            // Filter out already geocoded customers (those with valid lat/lng)
            const unGeocodedCustomers = allCustomers.filter(customer =>
                !customer.latitude || !customer.longitude ||
                customer.latitude === null || customer.longitude === null ||
                customer.latitude === 0 || customer.longitude === 0
            );

            this.log('info', `Found ${allCustomers.length} total customers`);
            this.log('info', `Found ${unGeocodedCustomers.length} customers that still need geocoding`);

            // Verify the count matches our expectation
            if (unGeocodedCustomers.length !== this.state.remainingToProcess) {
                this.log('warn', `Expected ${this.state.remainingToProcess} ungecoded customers, found ${unGeocodedCustomers.length}`);
                this.state.remainingToProcess = unGeocodedCustomers.length;
            }

            return unGeocodedCustomers;

        } catch (error) {
            this.log('error', 'Failed to fetch customers for continuation', { error: error.message });
            throw error;
        }
    }

    async validateDatabaseSave(customerId, expectedLat, expectedLng) {
        try {
            const customers = await this.db.listCustomers();
            const customer = customers.find(c => c.id === customerId);

            if (!customer) {
                this.log('error', 'Customer not found after save attempt', { customerId });
                return false;
            }

            const savedLat = parseFloat(customer.latitude);
            const savedLng = parseFloat(customer.longitude);
            const expectedLatNum = parseFloat(expectedLat);
            const expectedLngNum = parseFloat(expectedLng);

            const latMatch = Math.abs(savedLat - expectedLatNum) < 0.000001;
            const lngMatch = Math.abs(savedLng - expectedLngNum) < 0.000001;

            if (latMatch && lngMatch) {
                this.log('debug', 'Database save validated successfully', {
                    customerId,
                    expected: { lat: expectedLatNum, lng: expectedLngNum },
                    saved: { lat: savedLat, lng: savedLng }
                });
                return true;
            } else {
                this.log('error', 'Database save validation failed - coordinates mismatch', {
                    customerId,
                    expected: { lat: expectedLatNum, lng: expectedLngNum },
                    saved: { lat: savedLat, lng: savedLng }
                });
                return false;
            }
        } catch (error) {
            this.log('error', 'Database validation error', { customerId, error: error.message });
            return false;
        }
    }

    async retryDatabaseSave(customer, coordinates, attempt = 1) {
        const maxAttempts = this.config.maxRetries;

        try {
            this.log('debug', `Attempting database save (attempt ${attempt}/${maxAttempts})`, {
                customerId: customer.id,
                coordinates: coordinates,
                customerName: customer.name
            });

            await this.db.updateCustomerCoordinates(
                customer.id,
                coordinates.lat,
                coordinates.lng,
                'completed'
            );

            const isValid = await this.validateDatabaseSave(customer.id, coordinates.lat, coordinates.lng);

            if (isValid) {
                this.log('info', `✅ Database save successful for customer ${customer.id}`, {
                    customer: customer.name,
                    coordinates: coordinates,
                    attempt: attempt
                });
                return true;
            } else {
                throw new Error('Database save validation failed');
            }

        } catch (error) {
            this.log('error', `Database save attempt ${attempt} failed`, {
                customerId: customer.id,
                error: error.message,
                attempt: attempt
            });

            if (attempt < maxAttempts) {
                this.log('warn', `Retrying database save in 2 seconds... (attempt ${attempt + 1}/${maxAttempts})`);
                await this.delay(2000);
                return await this.retryDatabaseSave(customer, coordinates, attempt + 1);
            } else {
                this.log('error', `All database save attempts failed for customer ${customer.id}`, {
                    customerId: customer.id,
                    customerName: customer.name,
                    coordinates: coordinates,
                    maxAttemptsReached: true
                });

                this.state.failedSaves.push({
                    customer: customer,
                    coordinates: coordinates,
                    error: error.message,
                    attempts: maxAttempts,
                    timestamp: new Date().toISOString()
                });

                this.state.persistenceRetries += maxAttempts;
                return false;
            }
        }
    }

    async processCustomer(customer) {
        try {
            this.log('debug', `Processing customer ${customer.id}: ${customer.name}`);

            if (!customer.cep && !customer.full_address && !customer.address) {
                this.log('warn', `Customer ${customer.id} has no address or CEP, skipping`);
                this.state.errorCount++;
                return null;
            }

            const address = customer.full_address || customer.address || `CEP: ${customer.cep}`;
            const coordinates = await this.geocodingService.geocodeAddress(
                address,
                customer.cep,
                customer.city,
                customer.state
            );

            if (coordinates && coordinates.lat && coordinates.lng) {
                this.log('info', `🌍 Geocoded customer ${customer.id}: ${customer.name}`, {
                    coordinates: coordinates,
                    provider: coordinates.provider,
                    cached: coordinates.cached
                });

                const saveSuccess = await this.retryDatabaseSave(customer, coordinates);

                if (saveSuccess) {
                    const result = {
                        ...customer,
                        latitude: coordinates.lat,
                        longitude: coordinates.lng,
                        geocoding_status: 'completed',
                        geocoding_provider: coordinates.provider,
                        geocoded_at: new Date().toISOString(),
                        geocoding_cached: coordinates.cached || false
                    };

                    this.state.geocodedResults.push(result);
                    this.state.successCount++;

                    return result;
                } else {
                    this.log('error', `Failed to persist coordinates for customer ${customer.id}`);
                    this.state.errorCount++;
                    return null;
                }
            } else {
                this.log('warn', `Failed to geocode customer ${customer.id}: ${customer.name}`);

                try {
                    await this.db.updateGeocodingStatus(customer.id, 'failed');
                } catch (error) {
                    this.log('error', `Failed to update geocoding status to failed for customer ${customer.id}`, {
                        error: error.message
                    });
                }

                this.state.errorCount++;
                return null;
            }

        } catch (error) {
            this.log('error', `Error processing customer ${customer.id}`, {
                error: error.message,
                stack: error.stack
            });
            this.state.errorCount++;
            return null;
        }
    }

    async processBatch(customers) {
        this.log('info', `Processing batch of ${customers.length} customers`);

        const batchResults = [];

        for (const customer of customers) {
            const result = await this.processCustomer(customer);

            if (result) {
                batchResults.push(result);
            }

            this.state.currentProcessedCount++;

            // Calculate overall progress (including already processed)
            const totalOverallProgress = this.state.alreadyProcessed + this.state.currentProcessedCount;
            const overallPercentage = Math.round((totalOverallProgress / this.state.totalCustomersInDb) * 100);
            const continuationPercentage = Math.round((this.state.currentProcessedCount / this.state.remainingToProcess) * 100);

            // Progress reporting every 50 customers or every 10 successful ones
            if (this.state.currentProcessedCount % this.config.progressReportInterval === 0 ||
                this.state.successCount > 0 && this.state.successCount % 10 === 0) {

                console.log(`📊 PROGRESS REPORT:`);
                console.log(`   Overall: ${totalOverallProgress}/${this.state.totalCustomersInDb} (${overallPercentage}%)`);
                console.log(`   Continuation: ${this.state.currentProcessedCount}/${this.state.remainingToProcess} (${continuationPercentage}%)`);
                console.log(`   Success: ${this.state.successCount}, Errors: ${this.state.errorCount}`);
                console.log(`   ETA: ${this.calculateETA()}`);

                this.log('info', `Progress - Overall: ${totalOverallProgress}/${this.state.totalCustomersInDb} (${overallPercentage}%) | Continuation: ${this.state.currentProcessedCount}/${this.state.remainingToProcess} (${continuationPercentage}%) - Success: ${this.state.successCount}, Errors: ${this.state.errorCount}`);
            }

            // Save backup periodically
            if (this.state.currentProcessedCount % this.config.progressReportInterval === 0) {
                await this.saveBackup();
            }

            // Delay between requests
            if (this.state.currentProcessedCount < this.state.remainingToProcess) {
                await this.delay(this.config.delayBetweenRequests);
            }
        }

        return batchResults;
    }

    async saveBackup() {
        const backup = {
            timestamp: new Date().toISOString(),
            startOffset: this.config.startOffset,
            totalResults: this.state.geocodedResults.length,
            summary: {
                totalCustomersInDb: this.state.totalCustomersInDb,
                alreadyProcessed: this.state.alreadyProcessed,
                currentProcessedCount: this.state.currentProcessedCount,
                totalProcessedSoFar: this.state.alreadyProcessed + this.state.currentProcessedCount,
                successCount: this.state.successCount,
                errorCount: this.state.errorCount,
                remainingToProcess: this.state.remainingToProcess - this.state.currentProcessedCount
            },
            results: this.state.geocodedResults
        };

        try {
            await fs.writeFile(this.config.backupFile, JSON.stringify(backup, null, 2));
            this.log('info', `Backup saved with ${backup.totalResults} results`);
        } catch (error) {
            this.log('error', 'Failed to save backup', { error: error.message });
        }
    }

    async run() {
        try {
            await this.initialize();

            const customers = await this.getCustomersForContinuationGeocoding();

            if (customers.length === 0) {
                console.log('✅ All customers are already geocoded!');
                this.log('info', '✅ No customers need geocoding - all done!');
                return;
            }

            this.state.startTime = new Date();
            this.state.remainingToProcess = customers.length;

            console.log(`📍 STARTING CONTINUATION GEOCODING`);
            console.log(`   Processing ${customers.length} remaining customers`);
            console.log(`   Batch size: ${this.config.batchSize}`);
            console.log(`   Progress reports every: ${this.config.progressReportInterval} customers`);

            this.log('info', `Starting continuation geocoding of ${customers.length} remaining customers`);

            // Process customers in batches
            for (let i = 0; i < customers.length; i += this.config.batchSize) {
                const batchStart = i;
                const batchEnd = Math.min(i + this.config.batchSize, customers.length);
                const batch = customers.slice(batchStart, batchEnd);

                this.log('info', `Processing batch ${Math.floor(i / this.config.batchSize) + 1} (customers ${batchStart + 1} to ${batchEnd})`);

                await this.processBatch(batch);

                // Save backup after each batch
                await this.saveBackup();
            }

            // Final save and summary
            await this.saveBackup();
            await this.generateFinalReport();

        } catch (error) {
            this.log('error', 'Fatal error in continuation geocoding', {
                error: error.message,
                stack: error.stack
            });
            throw error;
        }
    }

    async generateFinalReport() {
        const endTime = new Date();
        const duration = Math.round((endTime - this.state.startTime) / 1000);
        const successRate = this.state.remainingToProcess > 0 ?
            (this.state.successCount / this.state.remainingToProcess * 100).toFixed(2) : 0;

        // Final status check
        const finalTotal = this.state.alreadyProcessed + this.state.successCount;
        const finalPercentage = ((finalTotal / this.state.totalCustomersInDb) * 100).toFixed(2);

        const report = {
            continuation: {
                startOffset: this.config.startOffset,
                alreadyProcessed: this.state.alreadyProcessed,
                targetToProcess: this.state.remainingToProcess,
                actuallyProcessed: this.state.currentProcessedCount,
                successCount: this.state.successCount,
                errorCount: this.state.errorCount,
                successRate: `${successRate}%`,
                duration: `${duration} seconds`
            },
            overall: {
                totalCustomersInDb: this.state.totalCustomersInDb,
                totalGeocoded: finalTotal,
                overallCompletionRate: `${finalPercentage}%`,
                customersRemaining: this.state.totalCustomersInDb - finalTotal
            },
            performance: {
                persistenceRetries: this.state.persistenceRetries,
                failedSaves: this.state.failedSaves.length,
                avgTimePerCustomer: this.state.currentProcessedCount > 0 ?
                    `${(duration / this.state.currentProcessedCount).toFixed(2)} seconds` : 'N/A'
            },
            files: {
                backupFile: this.config.backupFile,
                logFile: this.config.logFile
            },
            failedSaves: this.state.failedSaves
        };

        // Save report
        const reportFile = this.config.logFile.replace('.log', '-report.json');
        await fs.writeFile(reportFile, JSON.stringify(report, null, 2));

        this.log('info', '='.repeat(80));
        this.log('info', 'CONTINUATION GEOCODING COMPLETED');
        this.log('info', `Final Report: ${reportFile}`);
        this.log('info', `Summary: ${JSON.stringify(report, null, 2)}`);
        this.log('info', '='.repeat(80));

        console.log('\n' + '='.repeat(80));
        console.log('🎉 CONTINUATION GEOCODING COMPLETED');
        console.log('='.repeat(80));
        console.log(`📊 CONTINUATION RESULTS:`);
        console.log(`   Target to Process: ${report.continuation.targetToProcess}`);
        console.log(`   Successfully Processed: ${report.continuation.successCount}`);
        console.log(`   Errors: ${report.continuation.errorCount}`);
        console.log(`   Success Rate: ${report.continuation.successRate}`);
        console.log(`   Duration: ${report.continuation.duration}`);
        console.log(`\n📊 OVERALL RESULTS:`);
        console.log(`   Total Customers in DB: ${report.overall.totalCustomersInDb}`);
        console.log(`   Total Geocoded: ${report.overall.totalGeocoded}`);
        console.log(`   Overall Completion: ${report.overall.overallCompletionRate}`);
        console.log(`   Still Remaining: ${report.overall.customersRemaining}`);

        if (report.overall.customersRemaining === 0) {
            console.log(`\n🎯 SUCCESS! ALL ${report.overall.totalCustomersInDb} CUSTOMERS ARE NOW GEOCODED!`);
        } else {
            console.log(`\n⚠️  ${report.overall.customersRemaining} customers still need geocoding.`);
        }

        console.log(`\n📁 Files Generated:`);
        console.log(`   Backup: ${this.config.backupFile}`);
        console.log(`   Log: ${this.config.logFile}`);
        console.log(`   Report: ${reportFile}`);

        if (this.state.failedSaves.length > 0) {
            console.log(`\n⚠️  ${this.state.failedSaves.length} customers had geocoding success but database save failures.`);
            console.log(`   Check the report file for details.`);
        }

        console.log('='.repeat(80));
    }

    calculateETA() {
        if (!this.state.startTime || this.state.currentProcessedCount === 0) {
            return 'Calculating...';
        }

        const elapsed = Date.now() - this.state.startTime.getTime();
        const avgTimePerCustomer = elapsed / this.state.currentProcessedCount;
        const remaining = this.state.remainingToProcess - this.state.currentProcessedCount;
        const etaMs = remaining * avgTimePerCustomer;
        const etaMinutes = Math.round(etaMs / 60000);

        return `~${etaMinutes} minutes`;
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Script execution
async function main() {
    const geocoder = new ContinueGeocodingFrom972();

    try {
        console.log('🚀 URGENT: Continuing geocoding for remaining 1,275 customers...');
        await geocoder.run();
        console.log('✅ Geocoding continuation completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('\n❌ FATAL ERROR:', error.message);
        console.error('Stack trace:', error.stack);
        process.exit(1);
    }
}

// Handle process termination gracefully
process.on('SIGINT', async () => {
    console.log('\n🛑 Process interrupted. Data will be backed up...');
    process.exit(1);
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 Process terminated. Data will be backed up...');
    process.exit(1);
});

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = ContinueGeocodingFrom972;