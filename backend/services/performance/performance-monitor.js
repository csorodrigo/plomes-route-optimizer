/**
 * Performance Monitor Service
 * Tracks memory usage, database performance, and geocoding metrics
 */

const EventEmitter = require('events');
const { performance } = require('perf_hooks');

class PerformanceMonitor extends EventEmitter {
    constructor() {
        super();
        this.metrics = {
            memory: {
                heapUsed: 0,
                heapTotal: 0,
                external: 0,
                arrayBuffers: 0,
                rss: 0
            },
            operations: {
                geocodingRequests: 0,
                databaseQueries: 0,
                cacheHits: 0,
                cacheMisses: 0,
                batchOperations: 0
            },
            performance: {
                avgGeocodingTime: 0,
                avgDatabaseTime: 0,
                maxMemoryUsage: 0,
                startTime: performance.now()
            },
            alerts: []
        };

        this.isMonitoring = false;
        this.monitoringInterval = null;
        this.performanceData = [];

        // Memory thresholds (in MB)
        this.memoryThresholds = {
            warning: 512,  // 512 MB
            critical: 1024 // 1 GB
        };
    }

    /**
     * Start monitoring system performance
     */
    startMonitoring(intervalMs = 5000) {
        if (this.isMonitoring) return;

        this.isMonitoring = true;
        this.metrics.performance.startTime = performance.now();
        console.log('🔍 Performance monitoring started');

        this.monitoringInterval = setInterval(() => {
            this.collectMetrics();
            this.checkThresholds();
            this.emit('metrics', this.getMetrics());
        }, intervalMs);
    }

    /**
     * Stop monitoring
     */
    stopMonitoring() {
        if (!this.isMonitoring) return;

        this.isMonitoring = false;
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }
        console.log('🔍 Performance monitoring stopped');
    }

    /**
     * Collect current system metrics
     */
    collectMetrics() {
        const memUsage = process.memoryUsage();

        this.metrics.memory = {
            heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
            heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
            external: Math.round(memUsage.external / 1024 / 1024), // MB
            arrayBuffers: Math.round(memUsage.arrayBuffers / 1024 / 1024), // MB
            rss: Math.round(memUsage.rss / 1024 / 1024) // MB
        };

        // Track maximum memory usage
        if (this.metrics.memory.heapUsed > this.metrics.performance.maxMemoryUsage) {
            this.metrics.performance.maxMemoryUsage = this.metrics.memory.heapUsed;
        }

        // Store performance data for trend analysis
        this.performanceData.push({
            timestamp: Date.now(),
            memory: { ...this.metrics.memory },
            operations: { ...this.metrics.operations }
        });

        // Keep only last 100 data points
        if (this.performanceData.length > 100) {
            this.performanceData = this.performanceData.slice(-100);
        }
    }

    /**
     * Check memory and performance thresholds
     */
    checkThresholds() {
        const { heapUsed } = this.metrics.memory;

        // Clear old alerts
        this.metrics.alerts = this.metrics.alerts.filter(alert =>
            Date.now() - alert.timestamp < 60000 // Keep alerts for 1 minute
        );

        // Memory warnings
        if (heapUsed > this.memoryThresholds.critical) {
            this.addAlert('CRITICAL', `Memory usage critical: ${heapUsed}MB`);
            this.emit('alert', {
                level: 'critical',
                message: `Memory usage critical: ${heapUsed}MB`,
                suggestion: 'Consider restarting the geocoding process'
            });
        } else if (heapUsed > this.memoryThresholds.warning) {
            this.addAlert('WARNING', `Memory usage high: ${heapUsed}MB`);
            this.emit('alert', {
                level: 'warning',
                message: `Memory usage high: ${heapUsed}MB`,
                suggestion: 'Monitor closely, consider reducing batch size'
            });
        }

        // Check for memory leaks (increasing trend)
        if (this.performanceData.length >= 10) {
            const recent = this.performanceData.slice(-10);
            const trend = this.calculateMemoryTrend(recent);

            if (trend > 5) { // More than 5MB increase per measurement
                this.addAlert('WARNING', `Potential memory leak detected (trend: +${trend.toFixed(1)}MB)`);
            }
        }
    }

    /**
     * Calculate memory usage trend
     */
    calculateMemoryTrend(dataPoints) {
        if (dataPoints.length < 2) return 0;

        const start = dataPoints[0].memory.heapUsed;
        const end = dataPoints[dataPoints.length - 1].memory.heapUsed;

        return (end - start) / dataPoints.length;
    }

    /**
     * Add performance alert
     */
    addAlert(level, message) {
        this.metrics.alerts.push({
            level,
            message,
            timestamp: Date.now()
        });

        console.log(`⚠️  [${level}] ${message}`);
    }

    /**
     * Track geocoding operation performance
     */
    trackGeocodingOperation(startTime, success = true) {
        const duration = performance.now() - startTime;
        this.metrics.operations.geocodingRequests++;

        // Update average geocoding time
        const currentAvg = this.metrics.performance.avgGeocodingTime;
        const count = this.metrics.operations.geocodingRequests;
        this.metrics.performance.avgGeocodingTime =
            (currentAvg * (count - 1) + duration) / count;

        if (!success) {
            this.addAlert('INFO', `Geocoding operation failed (${duration.toFixed(2)}ms)`);
        }

        return duration;
    }

    /**
     * Track database operation performance
     */
    trackDatabaseOperation(startTime, operationType = 'query') {
        const duration = performance.now() - startTime;
        this.metrics.operations.databaseQueries++;

        if (operationType === 'batch') {
            this.metrics.operations.batchOperations++;
        }

        // Update average database time
        const currentAvg = this.metrics.performance.avgDatabaseTime;
        const count = this.metrics.operations.databaseQueries;
        this.metrics.performance.avgDatabaseTime =
            (currentAvg * (count - 1) + duration) / count;

        return duration;
    }

    /**
     * Track cache hit/miss
     */
    trackCacheOperation(hit = true) {
        if (hit) {
            this.metrics.operations.cacheHits++;
        } else {
            this.metrics.operations.cacheMisses++;
        }
    }

    /**
     * Get current metrics
     */
    getMetrics() {
        const uptime = Math.round((performance.now() - this.metrics.performance.startTime) / 1000);
        const cacheHitRate = this.metrics.operations.cacheHits + this.metrics.operations.cacheMisses > 0
            ? (this.metrics.operations.cacheHits / (this.metrics.operations.cacheHits + this.metrics.operations.cacheMisses) * 100).toFixed(1)
            : 0;

        return {
            ...this.metrics,
            uptime,
            cacheHitRate: `${cacheHitRate}%`,
            isHealthy: this.metrics.memory.heapUsed < this.memoryThresholds.warning && this.metrics.alerts.length === 0
        };
    }

    /**
     * Get performance summary for reporting
     */
    getPerformanceSummary() {
        const metrics = this.getMetrics();

        return {
            summary: {
                uptime: metrics.uptime,
                memoryUsage: `${metrics.memory.heapUsed}MB / ${metrics.memory.heapTotal}MB`,
                maxMemoryUsage: `${metrics.performance.maxMemoryUsage}MB`,
                totalOperations: metrics.operations.geocodingRequests + metrics.operations.databaseQueries,
                cacheHitRate: metrics.cacheHitRate,
                avgGeocodingTime: `${metrics.performance.avgGeocodingTime.toFixed(2)}ms`,
                avgDatabaseTime: `${metrics.performance.avgDatabaseTime.toFixed(2)}ms`
            },
            alerts: metrics.alerts,
            isHealthy: metrics.isHealthy
        };
    }

    /**
     * Force garbage collection if available
     */
    forceGarbageCollection() {
        if (global.gc) {
            console.log('🗑️  Forcing garbage collection...');
            global.gc();
            this.collectMetrics();
            console.log(`💾 Memory after GC: ${this.metrics.memory.heapUsed}MB`);
        } else {
            console.log('⚠️  Garbage collection not exposed (use --expose-gc flag)');
        }
    }

    /**
     * Reset metrics
     */
    reset() {
        this.metrics.operations = {
            geocodingRequests: 0,
            databaseQueries: 0,
            cacheHits: 0,
            cacheMisses: 0,
            batchOperations: 0
        };
        this.metrics.performance.startTime = performance.now();
        this.performanceData = [];
        this.metrics.alerts = [];
        console.log('📊 Performance metrics reset');
    }
}

module.exports = PerformanceMonitor;