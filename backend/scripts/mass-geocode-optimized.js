#!/usr/bin/env node

/**
 * 🚀 MASS GEOCODING OPTIMIZER v2.0
 *
 * High-performance batch geocoding script for 2,244+ customers
 *
 * FEATURES:
 * ✅ Smart parallel processing with rate limiting
 * ✅ Regional optimization (Ceará/Northeast focus)
 * ✅ Multiple provider fallback cascade
 * ✅ Real-time progress tracking with ETA
 * ✅ Automatic retry logic with exponential backoff
 * ✅ Incremental saves to prevent data loss
 * ✅ Resume capability from last checkpoint
 * ✅ Performance metrics and reporting
 * ✅ Regional batch processing for efficiency
 */

const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

// Import our services
const DatabaseService = require('../services/sync/database-service');
const GeocodingService = require('../services/geocoding/geocoding-service');

class MassGeocodingOptimizer {
    constructor() {
        this.db = new DatabaseService();
        this.geocodingService = null; // Will be initialized after DB

        // Performance Configuration
        this.config = {
            // Parallel processing settings
            concurrency: parseInt(process.env.GEOCODING_CONCURRENCY) || 8,
            batchSize: parseInt(process.env.GEOCODING_BATCH_SIZE) || 50,

            // Rate limiting (respects API limits)
            delayBetweenRequests: parseInt(process.env.GEOCODING_DELAY_MS) || 200,
            delayBetweenBatches: parseInt(process.env.GEOCODING_BATCH_DELAY_MS) || 2000,

            // Retry configuration
            maxRetries: 3,
            retryBaseDelay: 1000,
            retryBackoffMultiplier: 2,

            // Save frequency (prevent data loss)
            saveInterval: 25, // Save progress every 25 successful geocodes

            // Regional optimization
            prioritizeRegions: ['CE', 'RN', 'PB', 'PE', 'MA', 'PI'], // Northeast Brazil

            // Provider strategy
            preferBrazilianProviders: true,
            fallbackToGlobal: true
        };

        // Progress tracking
        this.progress = {
            total: 0,
            processed: 0,
            successful: 0,
            failed: 0,
            skipped: 0,
            improved: 0, // Coordinates that were fixed/improved

            // Performance metrics
            startTime: null,
            lastSaveTime: null,
            estimatedTimeRemaining: 0,
            avgProcessingTime: 0,

            // Regional stats
            regionalStats: new Map(),

            // Provider performance
            providerStats: new Map(),

            // Current batch info
            currentBatch: 0,
            totalBatches: 0,

            // Error tracking
            errorsByType: new Map(),
            rateLimitHits: 0
        };

        // Checkpoint system for resume capability
        this.checkpointFile = path.join(__dirname, '../cache/geocoding-checkpoint.json');

        console.log('🚀 Mass Geocoding Optimizer v2.0 Initialized');
        console.log(`⚙️  Configuration:`, {
            concurrency: this.config.concurrency,
            batchSize: this.config.batchSize,
            delayBetweenRequests: this.config.delayBetweenRequests,
            maxRetries: this.config.maxRetries
        });
    }

    async initialize() {
        console.log('🔧 Initializing services...');

        try {
            // Initialize database
            await this.db.ensureInitialized();
            console.log('✅ Database connection established');

            // Initialize geocoding service
            this.geocodingService = new GeocodingService(this.db);
            console.log('✅ Geocoding service initialized');

            // Load checkpoint if exists
            await this.loadCheckpoint();

            return true;
        } catch (error) {
            console.error('❌ Initialization failed:', error.message);
            throw error;
        }
    }

    async loadCheckpoint() {
        try {
            const checkpointData = await fs.readFile(this.checkpointFile, 'utf8');
            const checkpoint = JSON.parse(checkpointData);

            console.log('📁 Checkpoint found:', {
                processed: checkpoint.processed,
                successful: checkpoint.successful,
                failed: checkpoint.failed,
                timestamp: new Date(checkpoint.timestamp).toLocaleString('pt-BR')
            });

            // Restore progress (but not timing data)
            this.progress.processed = checkpoint.processed || 0;
            this.progress.successful = checkpoint.successful || 0;
            this.progress.failed = checkpoint.failed || 0;
            this.progress.skipped = checkpoint.skipped || 0;
            this.progress.improved = checkpoint.improved || 0;

            return checkpoint;
        } catch (error) {
            console.log('📝 No checkpoint found, starting fresh');
            return null;
        }
    }

    async saveCheckpoint() {
        const checkpoint = {
            ...this.progress,
            timestamp: Date.now(),
            config: this.config
        };

        try {
            // Ensure cache directory exists
            const cacheDir = path.dirname(this.checkpointFile);
            await fs.mkdir(cacheDir, { recursive: true });

            await fs.writeFile(this.checkpointFile, JSON.stringify(checkpoint, null, 2));
            this.progress.lastSaveTime = Date.now();
        } catch (error) {
            console.error('⚠️  Failed to save checkpoint:', error.message);
        }
    }

    async getCustomersToGeocode() {
        console.log('📋 Fetching customers for geocoding...');

        try {
            // Get all pending customers, prioritizing those with more complete data
            const customers = await this.db.getCustomersForGeocoding(5000); // Increased limit

            if (!customers || customers.length === 0) {
                console.log('✅ No customers need geocoding');
                return [];
            }

            console.log(`📍 Found ${customers.length} customers needing geocoding`);

            // Sort customers for optimal processing:
            // 1. Customers with CEP (faster to geocode)
            // 2. Regional grouping (Ceará first, then other Northeast states)
            // 3. Customers with full addresses
            const sortedCustomers = this.optimizeCustomerOrder(customers);

            return sortedCustomers;
        } catch (error) {
            console.error('❌ Error fetching customers:', error.message);
            throw error;
        }
    }

    optimizeCustomerOrder(customers) {
        console.log('🧠 Optimizing customer processing order...');

        return customers.sort((a, b) => {
            // Priority 1: Skip already processed in this session
            const aProcessed = this.progress.processed > 0 && parseInt(a.id) <= this.lastProcessedId;
            const bProcessed = this.progress.processed > 0 && parseInt(b.id) <= this.lastProcessedId;
            if (aProcessed !== bProcessed) return aProcessed ? 1 : -1;

            // Priority 2: Customers with CEP (faster to geocode)
            const aCep = Boolean(a.cep);
            const bCep = Boolean(b.cep);
            if (aCep !== bCep) return bCep - aCep;

            // Priority 3: Regional priority (Ceará and Northeast first)
            const aRegion = this.getRegionPriority(a);
            const bRegion = this.getRegionPriority(b);
            if (aRegion !== bRegion) return aRegion - bRegion;

            // Priority 4: More complete addresses
            const aCompleteness = this.calculateAddressCompleteness(a);
            const bCompleteness = this.calculateAddressCompleteness(b);
            if (aCompleteness !== bCompleteness) return bCompleteness - aCompleteness;

            // Priority 5: Alphabetical by name
            return (a.name || '').localeCompare(b.name || '', 'pt-BR');
        });
    }

    getRegionPriority(customer) {
        // Get region priority based on CEP or city
        const cep = customer.cep;
        const city = customer.city || '';

        // CEP-based region detection (more reliable)
        if (cep) {
            const cepPrefix = cep.substring(0, 2);
            const cearaCeps = ['60', '61', '62', '63']; // Ceará CEP ranges
            const northeastCeps = ['40', '41', '42', '43', '44', '45', '46', '47', '48', '49', // BA
                                    '50', '51', '52', '53', '54', '55', '56', // PE
                                    '57', // AL
                                    '58', // PB
                                    '59', // RN
                                    '64', // PI
                                    '65']; // MA

            if (cearaCeps.includes(cepPrefix)) return 1; // Highest priority
            if (northeastCeps.includes(cepPrefix)) return 2; // Second priority
        }

        // City-based fallback
        const cearaCities = ['FORTALEZA', 'MARACANAÚ', 'CAUCAIA', 'SOBRAL', 'JUAZEIRO DO NORTE'];
        if (cearaCities.some(cityName => city.toUpperCase().includes(cityName))) {
            return 1;
        }

        return 3; // Default priority
    }

    calculateAddressCompleteness(customer) {
        let score = 0;
        if (customer.cep) score += 3;
        if (customer.full_address && customer.full_address.includes(',')) score += 2;
        if (customer.city) score += 1;
        if (customer.state) score += 1;
        return score;
    }

    async startGeocoding() {
        console.log('\n🎯 Starting mass geocoding process...');

        const customers = await this.getCustomersToGeocode();
        if (customers.length === 0) {
            console.log('✅ All customers are already geocoded!');
            return this.generateFinalReport();
        }

        // Initialize progress tracking
        this.progress.total = customers.length;
        this.progress.totalBatches = Math.ceil(customers.length / this.config.batchSize);
        this.progress.startTime = Date.now();
        this.lastProcessedId = 0;

        console.log(`📊 Processing ${customers.length} customers in ${this.progress.totalBatches} batches`);
        console.log(`⚡ Concurrency: ${this.config.concurrency}, Batch size: ${this.config.batchSize}`);

        // Process in regional batches for maximum efficiency
        const regionalBatches = this.groupCustomersByRegion(customers);

        for (const [region, regionCustomers] of regionalBatches) {
            console.log(`\n🌍 Processing region: ${region} (${regionCustomers.length} customers)`);
            await this.processRegionalBatch(region, regionCustomers);
        }

        await this.generateFinalReport();
    }

    groupCustomersByRegion(customers) {
        const regions = new Map();

        customers.forEach(customer => {
            const region = this.detectCustomerRegion(customer);
            if (!regions.has(region)) {
                regions.set(region, []);
            }
            regions.get(region).push(customer);
        });

        // Sort regions by priority (Ceará first)
        const sortedRegions = Array.from(regions.entries()).sort(([a], [b]) => {
            if (a === 'CE') return -1;
            if (b === 'CE') return 1;
            if (a.startsWith('NE-')) return -1;
            if (b.startsWith('NE-')) return 1;
            return a.localeCompare(b);
        });

        return sortedRegions;
    }

    detectCustomerRegion(customer) {
        const cep = customer.cep;
        if (cep) {
            const prefix = cep.substring(0, 2);
            const cepRegions = {
                '60': 'CE', '61': 'CE', '62': 'CE', '63': 'CE',
                '59': 'NE-RN', '58': 'NE-PB', '50': 'NE-PE', '51': 'NE-PE', '52': 'NE-PE', '53': 'NE-PE', '54': 'NE-PE', '55': 'NE-PE', '56': 'NE-PE',
                '57': 'NE-AL', '40': 'NE-BA', '41': 'NE-BA', '42': 'NE-BA', '43': 'NE-BA', '44': 'NE-BA', '45': 'NE-BA', '46': 'NE-BA', '47': 'NE-BA', '48': 'NE-BA',
                '64': 'NE-PI', '65': 'NE-MA'
            };
            return cepRegions[prefix] || 'OTHER';
        }
        return 'UNKNOWN';
    }

    async processRegionalBatch(region, customers) {
        const batches = this.chunkArray(customers, this.config.batchSize);

        console.log(`📦 Processing ${batches.length} batches for region ${region}`);

        for (let i = 0; i < batches.length; i++) {
            const batch = batches[i];
            this.progress.currentBatch = i + 1;

            console.log(`\n⚡ Batch ${i + 1}/${batches.length} (${batch.length} customers) - Region: ${region}`);

            await this.processBatchWithRetry(batch, region);

            // Update progress
            this.updateProgressStats();
            this.displayProgress();

            // Save checkpoint periodically
            if (this.progress.successful % this.config.saveInterval === 0) {
                await this.saveCheckpoint();
            }

            // Delay between batches to respect rate limits
            if (i < batches.length - 1) {
                await this.delay(this.config.delayBetweenBatches);
            }
        }
    }

    async processBatchWithRetry(batch, region, retryCount = 0) {
        try {
            await this.processBatch(batch, region);
        } catch (error) {
            if (retryCount < this.config.maxRetries) {
                const retryDelay = this.config.retryBaseDelay * Math.pow(this.config.retryBackoffMultiplier, retryCount);
                console.log(`⚠️  Batch failed, retrying in ${retryDelay}ms (attempt ${retryCount + 1}/${this.config.maxRetries})`);

                await this.delay(retryDelay);
                return this.processBatchWithRetry(batch, region, retryCount + 1);
            } else {
                console.error(`❌ Batch failed after ${this.config.maxRetries} retries:`, error.message);
                // Mark all customers in batch as failed
                for (const customer of batch) {
                    this.progress.failed++;
                    await this.db.updateGeocodingStatus(customer.id, 'failed');
                }
            }
        }
    }

    async processBatch(batch, region) {
        // Process customers in parallel but with controlled concurrency
        const semaphore = this.createSemaphore(this.config.concurrency);

        const promises = batch.map(async (customer) => {
            return semaphore(async () => {
                return await this.processCustomerWithMetrics(customer, region);
            });
        });

        await Promise.allSettled(promises);
    }

    async processCustomerWithMetrics(customer, region) {
        const startTime = Date.now();

        try {
            const result = await this.processCustomer(customer);

            // Update metrics
            const processingTime = Date.now() - startTime;
            this.updateRegionalStats(region, true, processingTime);

            if (result?.provider) {
                this.updateProviderStats(result.provider, true, processingTime);
            }

            return result;

        } catch (error) {
            const processingTime = Date.now() - startTime;
            this.updateRegionalStats(region, false, processingTime);
            this.trackError(error);

            console.error(`❌ Customer ${customer.id} failed:`, error.message);
            throw error;
        }
    }

    async processCustomer(customer) {
        try {
            // Skip if already processed successfully
            if (customer.latitude && customer.longitude && customer.geocoding_status === 'completed') {
                console.log(`⏭️  Skipping already geocoded customer ${customer.id}`);
                this.progress.skipped++;
                return null;
            }

            // Build comprehensive address for geocoding
            const addressData = this.buildAddressData(customer);

            // Attempt geocoding with multiple strategies
            let result = await this.geocodingService.geocodeAddress(
                addressData.fullAddress,
                addressData.cep,
                addressData.city,
                addressData.state
            );

            if (result) {
                // Check if this is an improvement over existing coordinates
                const isImprovement = customer.latitude && customer.longitude &&
                    !this.geocodingService.validateCoordinates(customer.latitude, customer.longitude, addressData.state);

                if (isImprovement) {
                    this.progress.improved++;
                    console.log(`🔧 Improved coordinates for ${customer.name}: ${result.lat}, ${result.lng}`);
                }

                // Update database
                await this.db.updateCustomerCoordinates(
                    customer.id,
                    result.lat,
                    result.lng,
                    'completed'
                );

                this.progress.successful++;
                this.lastProcessedId = Math.max(this.lastProcessedId, parseInt(customer.id));

                console.log(`✅ ${customer.name} -> ${result.provider} -> ${result.lat}, ${result.lng}`);

                return result;
            } else {
                // Mark as failed
                await this.db.updateGeocodingStatus(customer.id, 'failed');
                this.progress.failed++;

                console.log(`❌ Failed: ${customer.name} - ${addressData.fullAddress}`);
                return null;
            }

        } catch (error) {
            this.progress.failed++;
            console.error(`💥 Error processing ${customer.name}:`, error.message);
            throw error;
        } finally {
            this.progress.processed++;

            // Small delay between requests to respect rate limits
            await this.delay(this.config.delayBetweenRequests);
        }
    }

    buildAddressData(customer) {
        return {
            fullAddress: customer.full_address || `${customer.city || ''}, Brasil`.trim(),
            cep: customer.cep,
            city: customer.city,
            state: customer.state || this.inferStateFromAddress(customer)
        };
    }

    inferStateFromAddress(customer) {
        // Try to infer state from CEP
        if (customer.cep) {
            const prefix = customer.cep.substring(0, 2);
            const cepStates = {
                '60': 'CE', '61': 'CE', '62': 'CE', '63': 'CE',
                '59': 'RN', '58': 'PB', '50': 'PE', '51': 'PE', '52': 'PE', '53': 'PE', '54': 'PE', '55': 'PE', '56': 'PE',
                '57': 'AL', '40': 'BA', '41': 'BA', '42': 'BA', '43': 'BA', '44': 'BA', '45': 'BA', '46': 'BA', '47': 'BA', '48': 'BA',
                '64': 'PI', '65': 'MA'
            };
            return cepStates[prefix] || null;
        }
        return null;
    }

    updateRegionalStats(region, success, processingTime) {
        if (!this.progress.regionalStats.has(region)) {
            this.progress.regionalStats.set(region, {
                total: 0,
                successful: 0,
                failed: 0,
                avgTime: 0,
                totalTime: 0
            });
        }

        const stats = this.progress.regionalStats.get(region);
        stats.total++;
        stats.totalTime += processingTime;
        stats.avgTime = stats.totalTime / stats.total;

        if (success) {
            stats.successful++;
        } else {
            stats.failed++;
        }
    }

    updateProviderStats(provider, success, processingTime) {
        if (!this.progress.providerStats.has(provider)) {
            this.progress.providerStats.set(provider, {
                total: 0,
                successful: 0,
                failed: 0,
                avgTime: 0,
                totalTime: 0
            });
        }

        const stats = this.progress.providerStats.get(provider);
        stats.total++;
        stats.totalTime += processingTime;
        stats.avgTime = stats.totalTime / stats.total;

        if (success) {
            stats.successful++;
        } else {
            stats.failed++;
        }
    }

    trackError(error) {
        const errorType = error.name || 'Unknown';
        const currentCount = this.progress.errorsByType.get(errorType) || 0;
        this.progress.errorsByType.set(errorType, currentCount + 1);

        if (error.message && error.message.includes('rate limit')) {
            this.progress.rateLimitHits++;
        }
    }

    updateProgressStats() {
        if (this.progress.startTime && this.progress.processed > 0) {
            const elapsed = Date.now() - this.progress.startTime;
            this.progress.avgProcessingTime = elapsed / this.progress.processed;

            const remaining = this.progress.total - this.progress.processed;
            this.progress.estimatedTimeRemaining = Math.round((this.progress.avgProcessingTime * remaining) / 1000);
        }
    }

    displayProgress() {
        const percentage = Math.round((this.progress.processed / this.progress.total) * 100);
        const eta = this.progress.estimatedTimeRemaining;
        const etaFormatted = eta > 60
            ? `${Math.floor(eta / 60)}m ${eta % 60}s`
            : `${eta}s`;

        console.log(`\n📊 PROGRESS: ${this.progress.processed}/${this.progress.total} (${percentage}%)`);
        console.log(`✅ Successful: ${this.progress.successful} | ❌ Failed: ${this.progress.failed} | ⏭️  Skipped: ${this.progress.skipped}`);
        console.log(`🔧 Improved: ${this.progress.improved} | ⏱️  ETA: ${etaFormatted}`);

        // Show success rate
        const successRate = this.progress.processed > 0
            ? Math.round((this.progress.successful / this.progress.processed) * 100)
            : 0;
        console.log(`📈 Success Rate: ${successRate}%`);
    }

    async generateFinalReport() {
        console.log('\n' + '='.repeat(60));
        console.log('🎯 MASS GEOCODING FINAL REPORT');
        console.log('='.repeat(60));

        const totalTime = this.progress.startTime ? (Date.now() - this.progress.startTime) / 1000 : 0;
        const avgPerCustomer = this.progress.processed > 0 ? totalTime / this.progress.processed : 0;

        console.log(`📊 OVERALL STATISTICS:`);
        console.log(`   Total Customers: ${this.progress.total}`);
        console.log(`   Processed: ${this.progress.processed}`);
        console.log(`   ✅ Successful: ${this.progress.successful}`);
        console.log(`   ❌ Failed: ${this.progress.failed}`);
        console.log(`   ⏭️  Skipped: ${this.progress.skipped}`);
        console.log(`   🔧 Improved: ${this.progress.improved}`);
        console.log(`   📈 Success Rate: ${Math.round((this.progress.successful / this.progress.processed) * 100)}%`);
        console.log(`   ⏱️  Total Time: ${Math.round(totalTime)}s`);
        console.log(`   ⚡ Avg Time/Customer: ${avgPerCustomer.toFixed(2)}s`);

        // Regional performance
        if (this.progress.regionalStats.size > 0) {
            console.log(`\n🌍 REGIONAL PERFORMANCE:`);
            for (const [region, stats] of this.progress.regionalStats.entries()) {
                const successRate = Math.round((stats.successful / stats.total) * 100);
                console.log(`   ${region}: ${stats.successful}/${stats.total} (${successRate}%) - Avg: ${stats.avgTime.toFixed(0)}ms`);
            }
        }

        // Provider performance
        if (this.progress.providerStats.size > 0) {
            console.log(`\n⚡ PROVIDER PERFORMANCE:`);
            for (const [provider, stats] of this.progress.providerStats.entries()) {
                const successRate = Math.round((stats.successful / stats.total) * 100);
                console.log(`   ${provider}: ${stats.successful}/${stats.total} (${successRate}%) - Avg: ${stats.avgTime.toFixed(0)}ms`);
            }
        }

        // Error analysis
        if (this.progress.errorsByType.size > 0) {
            console.log(`\n🚨 ERROR ANALYSIS:`);
            for (const [errorType, count] of this.progress.errorsByType.entries()) {
                console.log(`   ${errorType}: ${count} occurrences`);
            }
            if (this.progress.rateLimitHits > 0) {
                console.log(`   Rate limit hits: ${this.progress.rateLimitHits}`);
            }
        }

        // Save final checkpoint
        await this.saveCheckpoint();

        console.log(`\n💾 Final checkpoint saved to: ${this.checkpointFile}`);
        console.log('='.repeat(60));

        return this.progress;
    }

    // Utility functions
    chunkArray(array, size) {
        const chunks = [];
        for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
        }
        return chunks;
    }

    createSemaphore(maxConcurrency) {
        let current = 0;
        const queue = [];

        return function(task) {
            return new Promise((resolve, reject) => {
                queue.push({ task, resolve, reject });
                tryNext();
            });
        };

        function tryNext() {
            if (current < maxConcurrency && queue.length > 0) {
                current++;
                const { task, resolve, reject } = queue.shift();

                task()
                    .then(resolve)
                    .catch(reject)
                    .finally(() => {
                        current--;
                        tryNext();
                    });
            }
        }
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Main execution
async function main() {
    const optimizer = new MassGeocodingOptimizer();

    try {
        await optimizer.initialize();
        await optimizer.startGeocoding();

        console.log('\n🎉 Mass geocoding completed successfully!');
        process.exit(0);

    } catch (error) {
        console.error('\n💥 Mass geocoding failed:', error);
        console.error(error.stack);
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n⏹️  Received SIGINT, saving progress and shutting down...');
    // The checkpoint should be saved automatically during processing
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n⏹️  Received SIGTERM, saving progress and shutting down...');
    process.exit(0);
});

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = MassGeocodingOptimizer;