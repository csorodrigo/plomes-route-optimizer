#!/usr/bin/env node

/**
 * 📊 GEOCODING MONITOR & CONTROLLER
 *
 * Real-time monitoring and control for mass geocoding operations
 *
 * FEATURES:
 * ✅ Real-time progress monitoring
 * ✅ Performance metrics dashboard
 * ✅ Process control (start/stop/pause)
 * ✅ Error analysis and reporting
 * ✅ Estimated completion times
 */

const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');
require('dotenv').config();

const DatabaseService = require('../services/sync/database-service');

class GeocodingMonitor {
    constructor() {
        this.db = new DatabaseService();
        this.checkpointFile = path.join(__dirname, '../cache/geocoding-checkpoint.json');
        this.logFile = path.join(__dirname, '../cache/geocoding-monitor.log');
        this.isRunning = false;
        this.childProcess = null;
    }

    async initialize() {
        await this.db.ensureInitialized();
        console.log('📊 Geocoding Monitor initialized');
    }

    async showStatus() {
        console.log('\n' + '='.repeat(60));
        console.log('📊 GEOCODING STATUS DASHBOARD');
        console.log('='.repeat(60));

        try {
            // Get current database stats
            const stats = await this.db.getGeocodingStats();
            const totalCustomers = Object.values(stats).reduce((sum, count) => sum + count, 0);

            console.log(`📈 DATABASE STATISTICS:`);
            console.log(`   Total Customers: ${totalCustomers.toLocaleString()}`);
            console.log(`   ✅ Completed: ${stats.completed.toLocaleString()} (${Math.round(stats.completed/totalCustomers*100)}%)`);
            console.log(`   ⏳ Pending: ${stats.pending.toLocaleString()} (${Math.round(stats.pending/totalCustomers*100)}%)`);
            console.log(`   ❌ Failed: ${stats.failed.toLocaleString()} (${Math.round(stats.failed/totalCustomers*100)}%)`);
            console.log(`   🚨 Error: ${stats.error.toLocaleString()} (${Math.round(stats.error/totalCustomers*100)}%)`);

            // Load checkpoint if exists
            const checkpoint = await this.loadCheckpoint();
            if (checkpoint) {
                console.log(`\n🔄 LAST SESSION:`);
                console.log(`   Processed: ${checkpoint.processed.toLocaleString()}`);
                console.log(`   Success Rate: ${Math.round(checkpoint.successful/checkpoint.processed*100)}%`);
                console.log(`   Improved: ${checkpoint.improved.toLocaleString()}`);
                console.log(`   Last Run: ${new Date(checkpoint.timestamp).toLocaleString('pt-BR')}`);

                // Show provider performance from last session
                if (checkpoint.providerStats) {
                    console.log(`\n⚡ PROVIDER PERFORMANCE (Last Session):`);
                    const providers = Object.entries(checkpoint.providerStats || {});
                    providers.forEach(([provider, stats]) => {
                        const successRate = Math.round((stats.successful / stats.total) * 100);
                        console.log(`   ${provider}: ${stats.successful}/${stats.total} (${successRate}%) - Avg: ${stats.avgTime?.toFixed(0) || 0}ms`);
                    });
                }
            }

            // Show recommendations
            await this.showRecommendations(stats);

        } catch (error) {
            console.error('❌ Error getting status:', error.message);
        }

        console.log('='.repeat(60));
    }

    async showRecommendations(stats) {
        console.log(`\n💡 RECOMMENDATIONS:`);

        if (stats.pending > 1000) {
            console.log(`   🚀 High volume detected (${stats.pending.toLocaleString()} pending)`);
            console.log(`   ⚡ Consider using high concurrency (8-12 concurrent requests)`);
            console.log(`   🎯 Estimated time: ${this.estimateTime(stats.pending)} hours`);
        }

        if (stats.failed > stats.completed * 0.1) {
            console.log(`   ⚠️  High failure rate detected (${Math.round(stats.failed/(stats.completed+stats.failed)*100)}%)`);
            console.log(`   🔧 Consider reviewing address data quality`);
            console.log(`   🌐 Check API key availability and quotas`);
        }

        if (stats.pending < 100) {
            console.log(`   ✨ Low volume (${stats.pending} pending) - Use standard processing`);
            console.log(`   🎯 Estimated time: ${this.estimateTime(stats.pending)} minutes`);
        }
    }

    estimateTime(pendingCount) {
        // Conservative estimate: 1 customer per second on average
        const secondsPerCustomer = 1;
        const totalSeconds = pendingCount * secondsPerCustomer;

        if (totalSeconds < 3600) {
            return Math.round(totalSeconds / 60);
        } else {
            return (totalSeconds / 3600).toFixed(1);
        }
    }

    async loadCheckpoint() {
        try {
            const data = await fs.readFile(this.checkpointFile, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            return null;
        }
    }

    async startGeocoding(options = {}) {
        if (this.isRunning) {
            console.log('⚠️  Geocoding process is already running!');
            return;
        }

        console.log('🚀 Starting mass geocoding process...');

        const scriptPath = path.join(__dirname, 'mass-geocode-optimized.js');
        const env = { ...process.env };

        // Apply configuration options
        if (options.concurrency) {
            env.GEOCODING_CONCURRENCY = options.concurrency.toString();
        }
        if (options.batchSize) {
            env.GEOCODING_BATCH_SIZE = options.batchSize.toString();
        }
        if (options.delay) {
            env.GEOCODING_DELAY_MS = options.delay.toString();
        }

        this.childProcess = spawn('node', [scriptPath], {
            env,
            stdio: ['pipe', 'pipe', 'pipe']
        });

        this.isRunning = true;

        // Handle output
        this.childProcess.stdout.on('data', (data) => {
            const output = data.toString();
            process.stdout.write(output);
            this.logToFile(output);
        });

        this.childProcess.stderr.on('data', (data) => {
            const output = data.toString();
            process.stderr.write(output);
            this.logToFile(`ERROR: ${output}`);
        });

        this.childProcess.on('close', (code) => {
            this.isRunning = false;
            const message = `\n🏁 Geocoding process finished with code ${code}\n`;
            console.log(message);
            this.logToFile(message);
        });

        this.childProcess.on('error', (error) => {
            this.isRunning = false;
            const message = `💥 Process error: ${error.message}\n`;
            console.error(message);
            this.logToFile(message);
        });
    }

    async stopGeocoding() {
        if (!this.isRunning || !this.childProcess) {
            console.log('⚠️  No geocoding process is running');
            return;
        }

        console.log('⏹️  Stopping geocoding process...');
        this.childProcess.kill('SIGINT');

        // Wait a bit for graceful shutdown
        setTimeout(() => {
            if (this.isRunning) {
                console.log('🔪 Force killing process...');
                this.childProcess.kill('SIGKILL');
            }
        }, 5000);
    }

    async logToFile(message) {
        try {
            const timestamp = new Date().toISOString();
            const logEntry = `[${timestamp}] ${message}`;
            await fs.appendFile(this.logFile, logEntry);
        } catch (error) {
            // Ignore logging errors
        }
    }

    async analyzeErrors() {
        console.log('\n🔍 ANALYZING GEOCODING ERRORS...');

        try {
            // Get failed customers with details
            const { data: failedCustomers } = await this.db.client
                .from('customers')
                .select('id, name, cep, full_address, city, geocoding_attempts, last_geocoding_attempt')
                .eq('geocoding_status', 'failed')
                .order('geocoding_attempts', { ascending: false })
                .limit(20);

            if (!failedCustomers || failedCustomers.length === 0) {
                console.log('✅ No failed geocoding attempts found!');
                return;
            }

            console.log(`\n❌ TOP FAILED CUSTOMERS (${failedCustomers.length} shown):`);
            console.log('-'.repeat(100));
            console.log('ID'.padEnd(12) + 'NAME'.padEnd(25) + 'CEP'.padEnd(12) + 'ATTEMPTS'.padEnd(10) + 'LAST_TRY');
            console.log('-'.repeat(100));

            failedCustomers.forEach(customer => {
                const id = customer.id.substring(0, 11).padEnd(12);
                const name = (customer.name || 'N/A').substring(0, 24).padEnd(25);
                const cep = (customer.cep || 'N/A').padEnd(12);
                const attempts = customer.geocoding_attempts.toString().padEnd(10);
                const lastTry = customer.last_geocoding_attempt
                    ? new Date(customer.last_geocoding_attempt).toLocaleDateString('pt-BR')
                    : 'N/A';

                console.log(`${id}${name}${cep}${attempts}${lastTry}`);
            });

            // Analyze failure patterns
            console.log(`\n🔬 FAILURE ANALYSIS:`);

            const withoutCep = failedCustomers.filter(c => !c.cep).length;
            const withCep = failedCustomers.filter(c => c.cep).length;
            const multipleAttempts = failedCustomers.filter(c => c.geocoding_attempts > 1).length;

            console.log(`   Without CEP: ${withoutCep} (${Math.round(withoutCep/failedCustomers.length*100)}%)`);
            console.log(`   With CEP: ${withCep} (${Math.round(withCep/failedCustomers.length*100)}%)`);
            console.log(`   Multiple attempts: ${multipleAttempts} (${Math.round(multipleAttempts/failedCustomers.length*100)}%)`);

        } catch (error) {
            console.error('❌ Error analyzing failures:', error.message);
        }
    }

    async resetFailedCustomers() {
        console.log('🔄 Resetting failed customers to pending status...');

        try {
            const { count } = await this.db.client
                .from('customers')
                .update({
                    geocoding_status: 'pending',
                    geocoding_attempts: 0,
                    last_geocoding_attempt: null
                })
                .eq('geocoding_status', 'failed');

            console.log(`✅ Reset ${count} failed customers to pending status`);

        } catch (error) {
            console.error('❌ Error resetting customers:', error.message);
        }
    }

    async testSingleCustomer(customerId) {
        console.log(`🧪 Testing geocoding for customer ${customerId}...`);

        try {
            const { data: customer } = await this.db.client
                .from('customers')
                .select('*')
                .eq('id', customerId)
                .single();

            if (!customer) {
                console.log('❌ Customer not found');
                return;
            }

            console.log(`📋 Customer: ${customer.name}`);
            console.log(`📍 Address: ${customer.full_address}`);
            console.log(`📮 CEP: ${customer.cep || 'N/A'}`);
            console.log(`🏙️  City: ${customer.city || 'N/A'}`);

            // Initialize geocoding service
            const GeocodingService = require('../services/geocoding/geocoding-service');
            const geocodingService = new GeocodingService(this.db);

            // Test geocoding
            const result = await geocodingService.geocodeAddress(
                customer.full_address,
                customer.cep,
                customer.city,
                customer.state
            );

            if (result) {
                console.log(`✅ SUCCESS: ${result.lat}, ${result.lng} (${result.provider})`);
                console.log(`🗺️  https://www.google.com/maps?q=${result.lat},${result.lng}`);
            } else {
                console.log(`❌ FAILED: Could not geocode address`);

                // Try diagnostic
                await geocodingService.diagnoseGeocoding(
                    customer.full_address,
                    customer.cep,
                    customer.city,
                    customer.state
                );
            }

        } catch (error) {
            console.error('❌ Test failed:', error.message);
        }
    }

    async showHelp() {
        console.log(`
📊 GEOCODING MONITOR COMMANDS:

   status              Show current geocoding status and statistics
   start               Start mass geocoding process
   stop                Stop running geocoding process
   errors              Analyze failed geocoding attempts
   reset-failed        Reset failed customers to pending status
   test <customer_id>  Test geocoding for a specific customer
   help                Show this help message

EXAMPLES:
   node geocoding-monitor.js status
   node geocoding-monitor.js start
   node geocoding-monitor.js test 401245505
   node geocoding-monitor.js errors

ADVANCED OPTIONS:
   --concurrency N     Set concurrent requests (default: 8)
   --batch-size N      Set batch size (default: 50)
   --delay N           Set delay between requests in ms (default: 200)

EXAMPLES WITH OPTIONS:
   node geocoding-monitor.js start --concurrency 12 --batch-size 100
   node geocoding-monitor.js start --delay 100
`);
    }
}

// Command line interface
async function main() {
    const monitor = new GeocodingMonitor();
    await monitor.initialize();

    const command = process.argv[2];
    const args = process.argv.slice(3);

    // Parse options
    const options = {};
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--concurrency') {
            options.concurrency = parseInt(args[i + 1]);
            i++;
        } else if (args[i] === '--batch-size') {
            options.batchSize = parseInt(args[i + 1]);
            i++;
        } else if (args[i] === '--delay') {
            options.delay = parseInt(args[i + 1]);
            i++;
        }
    }

    switch (command) {
        case 'status':
            await monitor.showStatus();
            break;

        case 'start':
            await monitor.startGeocoding(options);
            break;

        case 'stop':
            await monitor.stopGeocoding();
            break;

        case 'errors':
            await monitor.analyzeErrors();
            break;

        case 'reset-failed':
            await monitor.resetFailedCustomers();
            break;

        case 'test':
            const customerId = args.find(arg => !arg.startsWith('--'));
            if (!customerId) {
                console.log('❌ Please provide a customer ID');
                console.log('Usage: node geocoding-monitor.js test <customer_id>');
                break;
            }
            await monitor.testSingleCustomer(customerId);
            break;

        case 'help':
        default:
            await monitor.showHelp();
            break;
    }

    process.exit(0);
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n👋 Shutting down monitor...');
    process.exit(0);
});

if (require.main === module) {
    main().catch(console.error);
}

module.exports = GeocodingMonitor;