/**
 * Geocoding Queue Service - Manages batch geocoding operations
 * Handles background processing of customer addresses with progress tracking
 */

const EventEmitter = require('events');

class GeocodingQueue extends EventEmitter {
    constructor(geocodingService, database) {
        super();
        this.geocodingService = geocodingService;
        this.db = database;
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
        this.batchSize = 10; // Process in small batches to avoid overwhelming APIs
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

            const duration = Math.round((this.progress.endTime - this.progress.startTime) / 1000);
            console.log(`✅ Geocoding completed! Processed ${this.progress.successful} successfully, ${this.progress.errors} errors in ${duration}s`);

            this.emit('completed', this.progress);

        } catch (error) {
            console.error('❌ Error in geocoding queue:', error);
            this.processing = false;
            this.emit('error', error);
            throw error;
        }
    }

    /**
     * Process a batch of customers
     */
    async processBatch(customers) {
        const promises = customers.map(customer => this.processCustomer(customer));
        await Promise.allSettled(promises);
    }

    /**
     * Process a single customer's geocoding
     */
    async processCustomer(customer) {
        try {
            if (!customer.address || !customer.cep) {
                console.log(`⚠️  Customer ${customer.id} missing address or CEP`);
                this.progress.errors++;
                return;
            }

            // Try to geocode the customer's address
            const result = await this.geocodingService.geocodeCustomer(customer);

            if (result && result.latitude && result.longitude) {
                this.progress.successful++;
                console.log(`✅ Geocoded customer ${customer.id}: ${customer.name}`);
            } else {
                this.progress.errors++;
                console.log(`❌ Failed to geocode customer ${customer.id}: ${customer.name}`);
            }

        } catch (error) {
            this.progress.errors++;
            console.error(`❌ Error geocoding customer ${customer.id}:`, error.message);
        }
    }

    /**
     * Get customers that need geocoding
     */
    async getCustomersNeedingGeocoding() {
        try {
            const query = `
                SELECT
                    id,
                    name,
                    address,
                    neighborhood,
                    city,
                    state,
                    cep,
                    latitude,
                    longitude
                FROM customers
                WHERE (latitude IS NULL OR longitude IS NULL OR latitude = 0 OR longitude = 0)
                AND address IS NOT NULL
                AND address != ''
                AND cep IS NOT NULL
                AND cep != ''
                ORDER BY id
            `;

            const result = await this.db.query(query);
            return result.rows || [];

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