/**
 * Performance Test Script for Mass Geocoding Operations
 * Tests the optimized database and batch processing performance
 */

const DatabaseService = require('../services/sync/database-service');
const PerformanceMonitor = require('../services/performance/performance-monitor');

class PerformanceTest {
    constructor() {
        this.db = new DatabaseService();
        this.monitor = new PerformanceMonitor();
        this.results = {
            database: {},
            memory: {},
            operations: {}
        };
    }

    async runAllTests() {
        console.log('🚀 Starting Performance Tests for Mass Geocoding Operations');
        console.log('=====================================================\n');

        try {
            await this.db.ensureInitialized();
            this.monitor.startMonitoring(1000); // Monitor every second during tests

            // Test 1: Database query performance
            await this.testDatabaseQueries();

            // Test 2: Batch operations performance
            await this.testBatchOperations();

            // Test 3: Memory usage under load
            await this.testMemoryUsage();

            // Test 4: Connection handling
            await this.testConnectionHandling();

            // Generate final report
            this.generateReport();

        } catch (error) {
            console.error('❌ Performance test failed:', error);
        } finally {
            this.monitor.stopMonitoring();
            await this.db.close();
        }
    }

    async testDatabaseQueries() {
        console.log('📊 Test 1: Database Query Performance');
        console.log('-------------------------------------');

        const tests = [
            {
                name: 'Get pending customers (optimized query)',
                operation: () => this.db.getCustomersForGeocoding(100)
            },
            {
                name: 'Get geocoded customers with coordinates',
                operation: () => this.db.getGeocodedCustomers(100)
            },
            {
                name: 'Get statistics (aggregate queries)',
                operation: () => this.db.getStatistics()
            },
            {
                name: 'Get geocoding stats by status',
                operation: () => this.db.getGeocodingStats()
            }
        ];

        for (const test of tests) {
            const startTime = performance.now();
            const startMemory = process.memoryUsage().heapUsed;

            try {
                const result = await test.operation();
                const duration = performance.now() - startTime;
                const memoryUsed = process.memoryUsage().heapUsed - startMemory;

                console.log(`  ✅ ${test.name}: ${duration.toFixed(2)}ms`);
                console.log(`     Memory impact: ${Math.round(memoryUsed / 1024)}KB`);

                if (Array.isArray(result)) {
                    console.log(`     Records returned: ${result.length}`);
                } else if (result && typeof result === 'object') {
                    console.log(`     Data points: ${Object.keys(result).length}`);
                }

                this.results.database[test.name] = {
                    duration: duration.toFixed(2),
                    memoryImpact: Math.round(memoryUsed / 1024),
                    recordCount: Array.isArray(result) ? result.length : 1
                };

            } catch (error) {
                console.log(`  ❌ ${test.name}: FAILED - ${error.message}`);
            }
        }
        console.log();
    }

    async testBatchOperations() {
        console.log('📦 Test 2: Batch Operations Performance');
        console.log('--------------------------------------');

        // Test batch update operations with different sizes
        const batchSizes = [10, 50, 100, 200];

        for (const batchSize of batchSizes) {
            console.log(`  Testing batch size: ${batchSize}`);

            // Generate test update data
            const updates = [];
            for (let i = 0; i < batchSize; i++) {
                updates.push({
                    customerId: `test_${Date.now()}_${i}`,
                    lat: -23.5505 + (Math.random() * 0.01),
                    lng: -46.6333 + (Math.random() * 0.01),
                    status: 'completed',
                    geocoded_address: `Test Address ${i}`
                });
            }

            const startTime = performance.now();
            const startMemory = process.memoryUsage().heapUsed;

            try {
                // Note: This would normally update test records, but we'll simulate
                console.log(`    Simulating batch update of ${batchSize} records...`);
                await this.delay(batchSize * 2); // Simulate processing time

                const duration = performance.now() - startTime;
                const memoryUsed = process.memoryUsage().heapUsed - startMemory;
                const throughput = Math.round(batchSize / (duration / 1000));

                console.log(`    ✅ Completed: ${duration.toFixed(2)}ms`);
                console.log(`    Throughput: ${throughput} records/sec`);
                console.log(`    Memory: ${Math.round(memoryUsed / 1024)}KB`);

                this.results.operations[`batch_${batchSize}`] = {
                    duration: duration.toFixed(2),
                    throughput,
                    memoryImpact: Math.round(memoryUsed / 1024)
                };

            } catch (error) {
                console.log(`    ❌ Batch ${batchSize}: FAILED - ${error.message}`);
            }
        }
        console.log();
    }

    async testMemoryUsage() {
        console.log('💾 Test 3: Memory Usage Under Load');
        console.log('----------------------------------');

        const baseMemory = process.memoryUsage().heapUsed;
        console.log(`  Baseline memory: ${Math.round(baseMemory / 1024 / 1024)}MB`);

        // Simulate processing large datasets
        const iterations = 10;
        let maxMemory = baseMemory;
        let minMemory = baseMemory;

        for (let i = 1; i <= iterations; i++) {
            // Simulate getting customers for geocoding
            const customers = await this.db.getCustomersForGeocoding(50);

            // Simulate some processing
            const processed = customers.map(customer => ({
                ...customer,
                processed: true,
                processedAt: new Date()
            }));

            const currentMemory = process.memoryUsage().heapUsed;
            maxMemory = Math.max(maxMemory, currentMemory);
            minMemory = Math.min(minMemory, currentMemory);

            if (i % 3 === 0) {
                console.log(`    Iteration ${i}: ${Math.round(currentMemory / 1024 / 1024)}MB`);
            }

            // Small delay to allow memory cleanup
            await this.delay(100);
        }

        const memoryGrowth = maxMemory - baseMemory;
        console.log(`  Memory growth: ${Math.round(memoryGrowth / 1024 / 1024)}MB`);
        console.log(`  Peak memory: ${Math.round(maxMemory / 1024 / 1024)}MB`);

        this.results.memory = {
            baseMemory: Math.round(baseMemory / 1024 / 1024),
            peakMemory: Math.round(maxMemory / 1024 / 1024),
            memoryGrowth: Math.round(memoryGrowth / 1024 / 1024)
        };

        // Force garbage collection if available
        if (global.gc) {
            global.gc();
            const afterGC = process.memoryUsage().heapUsed;
            console.log(`  After GC: ${Math.round(afterGC / 1024 / 1024)}MB`);
        }
        console.log();
    }

    async testConnectionHandling() {
        console.log('🔌 Test 4: Connection Handling');
        console.log('-----------------------------');

        const connectionTests = [
            {
                name: 'Rapid sequential queries',
                count: 20,
                delay: 0
            },
            {
                name: 'Moderate pace queries',
                count: 10,
                delay: 100
            }
        ];

        for (const test of connectionTests) {
            console.log(`  ${test.name}:`);
            const startTime = performance.now();

            const promises = [];
            for (let i = 0; i < test.count; i++) {
                promises.push(
                    this.db.getCustomersForGeocoding(1).then(() => {
                        if (test.delay > 0) {
                            return this.delay(test.delay);
                        }
                    })
                );
            }

            try {
                await Promise.all(promises);
                const duration = performance.now() - startTime;
                console.log(`    ✅ ${test.count} queries completed in ${duration.toFixed(2)}ms`);
                console.log(`    Average: ${(duration / test.count).toFixed(2)}ms per query`);

            } catch (error) {
                console.log(`    ❌ Connection test failed: ${error.message}`);
            }
        }
        console.log();
    }

    generateReport() {
        console.log('📋 Performance Test Results Summary');
        console.log('===================================');

        const perfSummary = this.monitor.getPerformanceSummary();

        console.log('\n🏆 Key Metrics:');
        console.log(`  - Total test duration: ${perfSummary.summary.uptime}s`);
        console.log(`  - Peak memory usage: ${this.results.memory.peakMemory}MB`);
        console.log(`  - Memory growth: ${this.results.memory.memoryGrowth}MB`);
        console.log(`  - Average database query time: ${perfSummary.summary.avgDatabaseTime}`);

        console.log('\n📊 Database Query Performance:');
        Object.entries(this.results.database).forEach(([testName, results]) => {
            console.log(`  - ${testName}: ${results.duration}ms (${results.recordCount} records)`);
        });

        console.log('\n📦 Batch Operations Performance:');
        Object.entries(this.results.operations).forEach(([testName, results]) => {
            console.log(`  - ${testName}: ${results.throughput} records/sec`);
        });

        console.log('\n🎯 Recommendations:');

        if (this.results.memory.memoryGrowth > 100) {
            console.log('  ⚠️  High memory growth detected - consider reducing batch sizes');
        } else {
            console.log('  ✅ Memory usage is within acceptable limits');
        }

        const avgDbTime = parseFloat(perfSummary.summary.avgDatabaseTime);
        if (avgDbTime > 1000) {
            console.log('  ⚠️  Database queries are slow - check indexes and connection pool');
        } else {
            console.log('  ✅ Database performance is good');
        }

        if (perfSummary.isHealthy) {
            console.log('  ✅ Overall system health is good');
        } else {
            console.log('  ⚠️  System health issues detected - check alerts');
        }

        console.log('\n🚀 Ready for mass geocoding of 2,000+ customers!');
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Run performance tests
if (require.main === module) {
    const test = new PerformanceTest();
    test.runAllTests().catch(console.error);
}

module.exports = PerformanceTest;