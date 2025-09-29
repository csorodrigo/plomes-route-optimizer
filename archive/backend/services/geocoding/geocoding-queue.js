/**
 * Geocoding Queue Service - Manages batch geocoding operations
 * Handles background processing of customer addresses with progress tracking
 * Includes performance monitoring and memory management
 */

const EventEmitter = require('events');
const PerformanceMonitor = require('../performance/performance-monitor');

class GeocodingQueue extends EventEmitter {
    constructor(geocodingService, database) {
        super();
        this.geocodingService = geocodingService;
        this.db = database;
        this.performanceMonitor = new PerformanceMonitor();
        this.processing = false;
        this.progress = {
            total: 0,
            processed: 0,
            errors: 0,
            successful: 0,
            percentage: 0,
            startTime: null,
            endTime: null,
            estimatedTimeRemaining: 0
        };
        this.queue = [];
        this.currentBatch = null;
        this.batchSize = 25; // Optimized batch size for geocoding APIs
        this.maxConcurrency = 3; // Maximum concurrent geocoding requests
    }

    /**
     * Start processing the geocoding queue
     */
    async startProcessing() {
        if (this.processing) {
            console.log('Geocoding queue already processing...');
            return;
        }

        try {
            console.log('🚀 Starting geocoding queue processing...');
            this.processing = true;
            this.progress.startTime = new Date();
            this.progress.endTime = null;

            // Start performance monitoring
            this.performanceMonitor.startMonitoring(3000); // Monitor every 3 seconds
            this.performanceMonitor.on('alert', (alert) => {
                console.log(`⚠️  Performance Alert [${alert.level}]: ${alert.message}`);
                if (alert.suggestion) {
                    console.log(`💡 Suggestion: ${alert.suggestion}`);
                }
            });

            // Get all customers that need geocoding
            const customers = await this.getCustomersNeedingGeocoding();

            if (!customers || customers.length === 0) {
                console.log('✅ No customers need geocoding');
                this.processing = false;
                this.progress.total = 0;
                this.progress.processed = 0;
                this.progress.percentage = 100;
                return;
            }

            this.progress.total = customers.length;
            this.progress.processed = 0;
            this.progress.errors = 0;
            this.progress.successful = 0;

            console.log(`📍 Processing geocoding for ${customers.length} customers...`);

            // Process customers in batches
            for (let i = 0; i < customers.length; i += this.batchSize) {
                const batch = customers.slice(i, i + this.batchSize);
                await this.processBatch(batch);

                // Update progress
                this.progress.processed = Math.min(i + this.batchSize, customers.length);
                this.progress.percentage = Math.round((this.progress.processed / this.progress.total) * 100);

                // Calculate estimated time remaining
                const elapsed = Date.now() - this.progress.startTime.getTime();
                const avgTimePerItem = elapsed / this.progress.processed;
                const remaining = this.progress.total - this.progress.processed;
                this.progress.estimatedTimeRemaining = Math.round((avgTimePerItem * remaining) / 1000); // in seconds

                // Emit progress event
                this.emit('progress', this.progress);

                // Small delay between batches to be respectful to APIs
                await this.delay(1000);
            }

            this.progress.endTime = new Date();
            this.processing = false;

            // Stop performance monitoring
            this.performanceMonitor.stopMonitoring();

            const duration = Math.round((this.progress.endTime - this.progress.startTime) / 1000);
            console.log(`✅ Geocoding completed! Processed ${this.progress.successful} successfully, ${this.progress.errors} errors in ${duration}s`);

            // Log performance summary
            const perfSummary = this.performanceMonitor.getPerformanceSummary();
            console.log('📊 Performance Summary:', JSON.stringify(perfSummary, null, 2));

            // Force garbage collection if memory usage is high
            if (perfSummary.summary.maxMemoryUsage > '400MB') {
                this.performanceMonitor.forceGarbageCollection();
            }

            this.emit('completed', {
                ...this.progress,
                performance: perfSummary
            });

        } catch (error) {
            console.error('❌ Error in geocoding queue:', error);
            this.processing = false;
            this.emit('error', error);
            throw error;
        }
    }

    /**
     * Process a batch of customers with controlled concurrency
     */
    async processBatch(customers) {
        const updates = [];

        // Process with controlled concurrency to prevent overwhelming APIs
        for (let i = 0; i < customers.length; i += this.maxConcurrency) {
            const batch = customers.slice(i, i + this.maxConcurrency);
            const promises = batch.map(customer => this.processCustomer(customer));
            const results = await Promise.allSettled(promises);

            // Collect successful updates for batch database update
            results.forEach((result, idx) => {
                if (result.status === 'fulfilled' && result.value) {
                    updates.push(result.value);
                }
            });

            // Small delay between concurrent batches
            if (i + this.maxConcurrency < customers.length) {
                await this.delay(200);
            }
        }

        // Batch update database with all successful geocoding results
        if (updates.length > 0) {
            try {
                const dbStartTime = performance.now();
                await this.db.batchUpdateCustomerCoordinates(updates);
                this.performanceMonitor.trackDatabaseOperation(dbStartTime, 'batch');
                console.log(`📊 Batch database update completed: ${updates.length} customers`);
            } catch (error) {
                console.error('❌ Batch database update failed:', error.message);
            }
        }
    }

    /**
     * Process a single customer's geocoding - returns update data for batch operation
     */
    async processCustomer(customer) {
        const geocodingStartTime = performance.now();

        try {
            if (!customer.address && !customer.cep && !customer.full_address) {
                console.log(`⚠️  Customer ${customer.id} missing address or CEP`);
                this.progress.errors++;
                return null;
            }

            // Try to geocode the customer's address
            const result = await this.geocodingService.geocodeCustomer(customer);
            const geocodingDuration = this.performanceMonitor.trackGeocodingOperation(geocodingStartTime, !!result);

            if (result && result.latitude && result.longitude) {
                this.progress.successful++;
                console.log(`✅ Geocoded customer ${customer.id}: ${customer.name}`);

                // Return update data for batch database operation
                return {
                    customerId: customer.id,
                    lat: result.latitude,
                    lng: result.longitude,
                    status: 'completed',
                    geocoded_address: result.geocoded_address || result.address
                };
            } else {
                this.progress.errors++;
                console.log(`❌ Failed to geocode customer ${customer.id}: ${customer.name}`);

                // Return failed status update
                return {
                    customerId: customer.id,
                    lat: null,
                    lng: null,
                    status: 'failed',
                    geocoded_address: null
                };
            }

        } catch (error) {
            this.progress.errors++;
            console.error(`❌ Error geocoding customer ${customer.id}:`, error.message);

            // Return error status update
            return {
                customerId: customer.id,
                lat: null,
                lng: null,
                status: 'error',
                geocoded_address: null
            };
        }
    }

    /**
     * Get customers that need geocoding
     */
    async getCustomersNeedingGeocoding() {
        try {
            const customers = await this.db.getCustomersForGeocoding(500);
            return customers;
        } catch (error) {
            console.error('Error getting customers needing geocoding:', error);
            return [];
        }
    }

    /**
     * Get current progress
     */
    getProgress() {
        return { ...this.progress };
    }

    /**
     * Stop processing
     */
    stop() {
        this.processing = false;
        this.emit('stopped', this.progress);
    }

    /**
     * Reset progress
     */
    reset() {
        this.processing = false;
        this.progress = {
            total: 0,
            processed: 0,
            errors: 0,
            successful: 0,
            percentage: 0,
            startTime: null,
            endTime: null,
            estimatedTimeRemaining: 0
        };
        this.queue = [];
        this.currentBatch = null;
    }

    /**
     * Utility function for delays
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Get queue status
     */
    getStatus() {
        return {
            processing: this.processing,
            progress: this.progress,
            queueLength: this.queue.length,
            batchSize: this.batchSize
        };
    }
}

module.exports = GeocodingQueue;
