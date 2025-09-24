const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

/**
 * Comprehensive E2E Test Suite for PLOMES-ROTA-CEP Geocoding Functionality
 *
 * Tests the complete geocoding implementation including:
 * 1. Login flow
 * 2. Dashboard statistics (showing real 0% geocoded initially)
 * 3. Geocodificação menu access
 * 4. GeocodingManager component
 * 5. Batch geocoding process
 * 6. Map visualization
 * 7. CEP search functionality
 */

class GeocodingTestSuite {
    constructor() {
        this.browser = null;
        this.context = null;
        this.page = null;
        this.testResults = {
            timestamp: new Date().toISOString(),
            success: false,
            testSuite: 'PLOMES-ROTA-CEP Geocoding E2E Tests',
            environment: 'Production',
            steps: [],
            screenshots: [],
            consoleErrors: [],
            apiCalls: [],
            metrics: {
                totalTests: 0,
                passedTests: 0,
                failedTests: 0,
                duration: null
            }
        };
        this.startTime = Date.now();
    }

    async setup() {
        console.log('🚀 Setting up E2E test environment...');

        // Create test screenshots directory
        const screenshotsDir = 'test-screenshots';
        if (!fs.existsSync(screenshotsDir)) {
            fs.mkdirSync(screenshotsDir, { recursive: true });
        }

        this.browser = await chromium.launch({
            headless: false,
            slowMo: 800,
            args: ['--disable-web-security', '--disable-features=VizDisplayCompositor']
        });

        this.context = await this.browser.newContext({
            viewport: { width: 1920, height: 1080 },
            permissions: ['geolocation']
        });

        this.page = await this.context.newPage();

        // Setup event listeners
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Console monitoring
        this.page.on('console', msg => {
            const logEntry = {
                type: msg.type(),
                text: msg.text(),
                timestamp: new Date().toISOString()
            };

            if (msg.type() === 'error' || msg.type() === 'warn') {
                this.testResults.consoleErrors.push(logEntry);
            }

            console.log(`📋 Console [${msg.type()}]: ${msg.text()}`);
        });

        // Network monitoring
        this.page.on('request', request => {
            if (request.url().includes('/api/')) {
                console.log(`🌐 API Request: ${request.method()} ${request.url()}`);
            }
        });

        this.page.on('response', response => {
            if (response.url().includes('/api/')) {
                const apiCall = {
                    url: response.url(),
                    method: response.request().method(),
                    status: response.status(),
                    timestamp: new Date().toISOString()
                };

                this.testResults.apiCalls.push(apiCall);
                console.log(`📡 API Response: ${response.status()} ${response.url()}`);
            }
        });

        // Error handling
        this.page.on('pageerror', error => {
            console.error('🚨 Page Error:', error.message);
            this.testResults.consoleErrors.push({
                type: 'pageerror',
                text: error.message,
                timestamp: new Date().toISOString()
            });
        });
    }

    async takeScreenshot(name, description) {
        const filename = `test-screenshots/${name}.png`;
        await this.page.screenshot({
            path: filename,
            fullPage: true
        });

        this.testResults.screenshots.push({
            name,
            path: filename,
            description,
            timestamp: new Date().toISOString()
        });

        console.log(`📸 Screenshot taken: ${name}`);
        return filename;
    }

    async recordTestStep(stepNumber, description, success, data = null, error = null) {
        const step = {
            step: stepNumber,
            description,
            success,
            timestamp: new Date().toISOString(),
            data,
            error
        };

        this.testResults.steps.push(step);
        this.testResults.metrics.totalTests++;

        if (success) {
            this.testResults.metrics.passedTests++;
            console.log(`✅ Step ${stepNumber}: ${description}`);
        } else {
            this.testResults.metrics.failedTests++;
            console.log(`❌ Step ${stepNumber}: ${description} - ${error}`);
        }

        return step;
    }

    async testLogin() {
        console.log('\n🔐 Testing Login Flow...');

        const productionUrls = [
            'https://plomes-rota-b5h7zvqee-csorodrigo-2569s-projects.vercel.app',
            'https://plomes-rota-cep.vercel.app'
        ];

        let loginSuccessful = false;
        let workingUrl = null;

        for (const url of productionUrls) {
            try {
                console.log(`\n📍 Attempting to access: ${url}`);
                await this.page.goto(url, {
                    waitUntil: 'networkidle',
                    timeout: 30000
                });

                await this.takeScreenshot(`01-landing-${url.includes('b5h7') ? 'primary' : 'alternative'}`,
                    `Landing page for ${url}`);

                // Wait for login form
                await this.page.waitForSelector('input[name="username"], input[type="text"]', { timeout: 10000 });
                await this.page.waitForSelector('input[name="password"], input[type="password"]', { timeout: 10000 });

                // Fill credentials
                await this.page.fill('input[name="username"], input[type="text"]', 'test');
                await this.page.fill('input[name="password"], input[type="password"]', 'test');

                await this.takeScreenshot('02-login-form-filled', 'Login form with credentials filled');

                // Click login
                await this.page.click('button[type="submit"], button:has-text("Entrar"), button:has-text("Login")');

                // Wait for dashboard
                await this.page.waitForSelector('.dashboard, .customer-list, [data-testid="dashboard"]', { timeout: 15000 });

                workingUrl = url;
                loginSuccessful = true;
                break;

            } catch (error) {
                console.log(`❌ Failed to login via ${url}: ${error.message}`);
                continue;
            }
        }

        if (!loginSuccessful) {
            throw new Error('Failed to login to any of the production URLs');
        }

        await this.recordTestStep(1, `Login successful via ${workingUrl}`, true, { url: workingUrl });
        await this.takeScreenshot('03-login-success-dashboard', 'Dashboard after successful login');

        return workingUrl;
    }

    async testDashboardStatistics() {
        console.log('\n📊 Testing Dashboard Statistics (Real Geocoding Status)...');

        try {
            // Look for statistics displays
            const statsSelectors = [
                '[data-testid="geocoding-stats"]',
                '.stats-container',
                '.dashboard-stats',
                '.geocoding-percentage'
            ];

            let statsFound = false;
            let geocodingPercentage = null;

            for (const selector of statsSelectors) {
                try {
                    const elements = await this.page.locator(selector);
                    if (await elements.count() > 0) {
                        const text = await elements.first().textContent();
                        console.log(`📋 Found stats with selector ${selector}: ${text}`);

                        // Look for percentage indicators
                        const percentageMatch = text.match(/(\d+)%/);
                        if (percentageMatch) {
                            geocodingPercentage = parseInt(percentageMatch[1]);
                            statsFound = true;
                            break;
                        }
                    }
                } catch (e) {
                    // Continue to next selector
                }
            }

            // Alternative: look for any text containing geocoding info
            if (!statsFound) {
                const pageText = await this.page.textContent('body');
                const geocodingMatches = pageText.match(/geocodificad[ao]s?[:\s]*(\d+)[%]?/i);
                if (geocodingMatches) {
                    geocodingPercentage = parseInt(geocodingMatches[1]);
                    statsFound = true;
                }
            }

            await this.takeScreenshot('04-dashboard-statistics', 'Dashboard showing geocoding statistics');

            const expectedLowPercentage = geocodingPercentage !== null && geocodingPercentage <= 5; // Should be 0% or very low initially
            await this.recordTestStep(2, 'Dashboard shows real geocoding status (0% initially)',
                expectedLowPercentage,
                { geocodingPercentage, statsFound });

            return geocodingPercentage;

        } catch (error) {
            await this.recordTestStep(2, 'Dashboard statistics check', false, null, error.message);
            throw error;
        }
    }

    async testGeocodingMenuAccess() {
        console.log('\n🗂️ Testing Geocodificação Menu Access...');

        try {
            // Look for the Geocodificação menu item
            const menuSelectors = [
                'a:has-text("Geocodificação")',
                '[data-testid="geocoding-menu"]',
                'nav a[href*="geocoding"]',
                '.menu-item:has-text("Geocodificação")',
                'button:has-text("Geocodificação")'
            ];

            let menuFound = false;
            let menuSelector = null;

            for (const selector of menuSelectors) {
                try {
                    const element = this.page.locator(selector);
                    if (await element.count() > 0 && await element.first().isVisible()) {
                        menuSelector = selector;
                        menuFound = true;
                        console.log(`✅ Found Geocodificação menu with selector: ${selector}`);

                        // Click the menu item
                        await element.first().click();
                        break;
                    }
                } catch (e) {
                    // Continue to next selector
                }
            }

            if (!menuFound) {
                // Try to find it by text content scanning
                const allLinks = await this.page.locator('a, button').all();
                for (const link of allLinks) {
                    const text = await link.textContent();
                    if (text && text.toLowerCase().includes('geocod')) {
                        await link.click();
                        menuFound = true;
                        menuSelector = 'text-based-search';
                        break;
                    }
                }
            }

            await this.takeScreenshot('05-geocoding-menu-access', 'Geocodificação menu accessed');

            await this.recordTestStep(3, 'Geocodificação menu item accessible', menuFound, { menuSelector });

            if (menuFound) {
                // Wait for the geocoding page to load
                await this.page.waitForTimeout(2000);
                await this.takeScreenshot('06-geocoding-page-loaded', 'Geocoding management page loaded');
            }

            return menuFound;

        } catch (error) {
            await this.recordTestStep(3, 'Geocodificação menu access', false, null, error.message);
            throw error;
        }
    }

    async testGeocodingManager() {
        console.log('\n🏗️ Testing GeocodingManager Component...');

        try {
            // Look for GeocodingManager elements
            const managerSelectors = [
                '[data-testid="geocoding-manager"]',
                '.geocoding-manager',
                '.geocoding-container',
                '.batch-geocoding'
            ];

            let managerFound = false;
            let customerCount = null;

            for (const selector of managerSelectors) {
                try {
                    const element = this.page.locator(selector);
                    if (await element.count() > 0) {
                        managerFound = true;
                        console.log(`✅ Found GeocodingManager with selector: ${selector}`);
                        break;
                    }
                } catch (e) {
                    // Continue
                }
            }

            // Look for customer count indicators
            const pageText = await this.page.textContent('body');
            const customerCountMatches = pageText.match(/(\d+)\s*clientes?|(\d+)\s*customers?/i);
            if (customerCountMatches) {
                customerCount = parseInt(customerCountMatches[1] || customerCountMatches[2]);
                console.log(`📊 Found customer count: ${customerCount}`);
            }

            await this.takeScreenshot('07-geocoding-manager', 'GeocodingManager component view');

            const expectedCustomerCount = customerCount >= 2000; // Should show ~2252 customers
            await this.recordTestStep(4, 'GeocodingManager shows customer count (~2252)',
                expectedCustomerCount,
                { managerFound, customerCount });

            return { managerFound, customerCount };

        } catch (error) {
            await this.recordTestStep(4, 'GeocodingManager component test', false, null, error.message);
            throw error;
        }
    }

    async testBatchGeocoding() {
        console.log('\n⚡ Testing Batch Geocoding Functionality...');

        try {
            // Look for batch geocoding controls
            const batchSelectors = [
                'button:has-text("Iniciar")',
                'button:has-text("Start")',
                '[data-testid="start-geocoding"]',
                '.start-geocoding-btn',
                'button:has-text("Geocodificar")'
            ];

            let batchButtonFound = false;
            let startButton = null;

            for (const selector of batchSelectors) {
                try {
                    const element = this.page.locator(selector);
                    if (await element.count() > 0 && await element.first().isVisible()) {
                        startButton = element.first();
                        batchButtonFound = true;
                        console.log(`✅ Found batch geocoding button: ${selector}`);
                        break;
                    }
                } catch (e) {
                    // Continue
                }
            }

            await this.takeScreenshot('08-before-batch-geocoding', 'Before starting batch geocoding');

            if (batchButtonFound) {
                // Click the start button
                await startButton.click();
                console.log('🚀 Started batch geocoding process');

                // Wait for API call to batch geocoding endpoint
                try {
                    const batchRequest = await this.page.waitForRequest(
                        request => request.url().includes('/api/geocoding/batch'),
                        { timeout: 10000 }
                    );
                    console.log('📡 Batch geocoding API request detected');

                    // Wait for response
                    const batchResponse = await this.page.waitForResponse(
                        response => response.url().includes('/api/geocoding/batch'),
                        { timeout: 30000 }
                    );

                    const responseStatus = batchResponse.status();
                    console.log(`📊 Batch geocoding API response: ${responseStatus}`);

                    // Wait for progress updates
                    await this.page.waitForTimeout(5000);

                    await this.takeScreenshot('09-batch-geocoding-in-progress', 'Batch geocoding in progress');

                    const batchSuccess = responseStatus === 200;
                    await this.recordTestStep(5, 'Batch geocoding process initiated', batchSuccess,
                        { responseStatus, apiCalled: true });

                } catch (apiError) {
                    console.log('⚠️ API call timeout or error:', apiError.message);
                    await this.recordTestStep(5, 'Batch geocoding API call', false, null, apiError.message);
                }
            } else {
                await this.recordTestStep(5, 'Batch geocoding button found', false, null, 'Button not found');
            }

            return batchButtonFound;

        } catch (error) {
            await this.recordTestStep(5, 'Batch geocoding test', false, null, error.message);
            throw error;
        }
    }

    async testCustomerSync() {
        console.log('\n🔄 Testing Customer Sync Process...');

        try {
            // Look for sync functionality
            const syncSelectors = [
                'button:has-text("Sincronizar")',
                'button:has-text("Sync")',
                '[data-testid="sync-customers"]',
                '.sync-button'
            ];

            let syncButtonFound = false;

            for (const selector of syncSelectors) {
                try {
                    const element = this.page.locator(selector);
                    if (await element.count() > 0 && await element.first().isVisible()) {
                        syncButtonFound = true;
                        console.log(`✅ Found sync button: ${selector}`);

                        // Optionally click sync (but be careful not to overload the API)
                        // await element.first().click();
                        break;
                    }
                } catch (e) {
                    // Continue
                }
            }

            await this.takeScreenshot('10-customer-sync-interface', 'Customer sync interface');

            await this.recordTestStep(6, 'Customer sync functionality available', syncButtonFound);

            return syncButtonFound;

        } catch (error) {
            await this.recordTestStep(6, 'Customer sync test', false, null, error.message);
            throw error;
        }
    }

    async testMapDisplay() {
        console.log('\n🗺️ Testing Map Display...');

        try {
            // Navigate to map view if not already there
            const mapSelectors = [
                '#map',
                '[data-testid="map"]',
                '.map-container',
                '.leaflet-container'
            ];

            let mapFound = false;
            let mapSelector = null;

            for (const selector of mapSelectors) {
                try {
                    const element = this.page.locator(selector);
                    if (await element.count() > 0) {
                        mapFound = true;
                        mapSelector = selector;
                        console.log(`✅ Found map with selector: ${selector}`);
                        break;
                    }
                } catch (e) {
                    // Continue
                }
            }

            // Look for map navigation/menu
            if (!mapFound) {
                const mapNavSelectors = [
                    'a:has-text("Mapa")',
                    'a:has-text("Map")',
                    '[data-testid="map-nav"]'
                ];

                for (const selector of mapNavSelectors) {
                    try {
                        const element = this.page.locator(selector);
                        if (await element.count() > 0) {
                            await element.first().click();
                            await this.page.waitForTimeout(3000);

                            // Check for map again
                            for (const mapSelector of mapSelectors) {
                                const mapElement = this.page.locator(mapSelector);
                                if (await mapElement.count() > 0) {
                                    mapFound = true;
                                    break;
                                }
                            }
                            break;
                        }
                    } catch (e) {
                        // Continue
                    }
                }
            }

            await this.takeScreenshot('11-map-display', 'Map display view');

            // Check for markers or other map elements
            let markersFound = 0;
            const markerSelectors = ['.leaflet-marker-icon', '.marker', '[data-testid="marker"]'];

            for (const selector of markerSelectors) {
                try {
                    markersFound += await this.page.locator(selector).count();
                } catch (e) {
                    // Continue
                }
            }

            console.log(`📍 Found ${markersFound} map markers`);

            await this.recordTestStep(7, 'Map display functionality', mapFound,
                { mapSelector, markersFound });

            return { mapFound, markersFound };

        } catch (error) {
            await this.recordTestStep(7, 'Map display test', false, null, error.message);
            throw error;
        }
    }

    async testCEPSearch() {
        console.log('\n🔍 Testing CEP Search Functionality...');

        try {
            // Look for CEP search input
            const cepSelectors = [
                'input[placeholder*="CEP"]',
                'input[name="cep"]',
                '[data-testid="cep-search"]',
                'input[type="text"][placeholder*="cep"]'
            ];

            let cepInputFound = false;
            let cepInput = null;

            for (const selector of cepSelectors) {
                try {
                    const element = this.page.locator(selector);
                    if (await element.count() > 0 && await element.first().isVisible()) {
                        cepInput = element.first();
                        cepInputFound = true;
                        console.log(`✅ Found CEP input: ${selector}`);
                        break;
                    }
                } catch (e) {
                    // Continue
                }
            }

            if (cepInputFound) {
                // Test CEP search with a valid CEP
                const testCEP = '01310-100'; // Av. Paulista, São Paulo

                await cepInput.fill(testCEP);
                await this.page.waitForTimeout(1000);

                // Look for search button or trigger
                const searchSelectors = [
                    'button:has-text("Buscar")',
                    'button:has-text("Search")',
                    '[data-testid="cep-search-btn"]'
                ];

                for (const selector of searchSelectors) {
                    try {
                        const button = this.page.locator(selector);
                        if (await button.count() > 0) {
                            await button.first().click();
                            break;
                        }
                    } catch (e) {
                        // Try pressing Enter instead
                        await cepInput.press('Enter');
                        break;
                    }
                }

                // Wait for potential API response
                await this.page.waitForTimeout(2000);

                await this.takeScreenshot('12-cep-search-test', `CEP search test with ${testCEP}`);

                // Check for results or error messages
                const pageText = await this.page.textContent('body');
                const hasResults = pageText.includes('São Paulo') || pageText.includes('Paulista');
                const hasError = pageText.includes('erro') || pageText.includes('error');

                await this.recordTestStep(8, 'CEP search functionality', cepInputFound && !hasError,
                    { testCEP, hasResults, hasError });

            } else {
                await this.recordTestStep(8, 'CEP search input found', false, null, 'CEP input not found');
            }

            return cepInputFound;

        } catch (error) {
            await this.recordTestStep(8, 'CEP search test', false, null, error.message);
            throw error;
        }
    }

    async generateReport() {
        console.log('\n📊 Generating comprehensive test report...');

        this.testResults.metrics.duration = Date.now() - this.startTime;
        this.testResults.success = this.testResults.metrics.failedTests === 0;

        // Save JSON report
        const jsonReportPath = 'geocoding-e2e-test-report.json';
        fs.writeFileSync(jsonReportPath, JSON.stringify(this.testResults, null, 2));

        // Generate HTML report
        const htmlReport = this.generateHTMLReport();
        fs.writeFileSync('geocoding-e2e-test-report.html', htmlReport);

        console.log(`📋 JSON report saved: ${jsonReportPath}`);
        console.log(`🌐 HTML report saved: geocoding-e2e-test-report.html`);

        return this.testResults;
    }

    generateHTMLReport() {
        const { testResults } = this;

        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PLOMES-ROTA-CEP Geocoding E2E Test Report</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; background: #f5f6fa; }
        .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); overflow: hidden; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 2.5rem; }
        .header p { margin: 10px 0 0 0; opacity: 0.9; }
        .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; padding: 30px; background: #f8f9fa; }
        .metric { text-align: center; padding: 20px; background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .metric-value { font-size: 2rem; font-weight: bold; color: #2c3e50; }
        .metric-label { color: #7f8c8d; font-size: 0.9rem; margin-top: 5px; }
        .success { color: #27ae60; }
        .failure { color: #e74c3c; }
        .warning { color: #f39c12; }
        .content { padding: 30px; }
        .step { margin: 20px 0; padding: 20px; border-left: 4px solid #3498db; background: #f8f9fa; border-radius: 0 8px 8px 0; }
        .step.success { border-left-color: #27ae60; background: #f8fff8; }
        .step.failure { border-left-color: #e74c3c; background: #fff5f5; }
        .step-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
        .step-title { font-size: 1.2rem; font-weight: 600; }
        .step-status { padding: 4px 12px; border-radius: 16px; font-size: 0.8rem; font-weight: bold; text-transform: uppercase; }
        .step-status.success { background: #27ae60; color: white; }
        .step-status.failure { background: #e74c3c; color: white; }
        .step-data { background: #f4f4f4; padding: 15px; border-radius: 6px; margin-top: 10px; font-family: monospace; font-size: 0.9rem; }
        .screenshots { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px; margin-top: 30px; }
        .screenshot { background: white; border-radius: 8px; padding: 15px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .screenshot img { width: 100%; border-radius: 6px; cursor: pointer; transition: transform 0.2s; }
        .screenshot img:hover { transform: scale(1.05); }
        .api-calls { margin-top: 30px; }
        .api-call { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; margin: 8px 0; border-radius: 6px; }
        .api-call.success { background: #f8fff8; border: 1px solid #27ae60; }
        .api-call.failure { background: #fff5f5; border: 1px solid #e74c3c; }
        .console-errors { margin-top: 20px; }
        .console-error { background: #fff5f5; padding: 12px; border-left: 4px solid #e74c3c; margin: 8px 0; border-radius: 0 6px 6px 0; }
        .summary { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-top: 30px; }
        .summary-card { background: white; padding: 25px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        @media (max-width: 768px) {
            .metrics { grid-template-columns: 1fr; }
            .summary { grid-template-columns: 1fr; }
            .screenshots { grid-template-columns: 1fr; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🧪 PLOMES-ROTA-CEP</h1>
            <h2>Geocoding E2E Test Report</h2>
            <p>Comprehensive testing of production geocoding implementation</p>
            <p><strong>Test Date:</strong> ${testResults.timestamp}</p>
        </div>

        <div class="metrics">
            <div class="metric">
                <div class="metric-value ${testResults.success ? 'success' : 'failure'}">${testResults.success ? 'PASSED' : 'FAILED'}</div>
                <div class="metric-label">Overall Result</div>
            </div>
            <div class="metric">
                <div class="metric-value">${testResults.metrics.totalTests}</div>
                <div class="metric-label">Total Tests</div>
            </div>
            <div class="metric">
                <div class="metric-value success">${testResults.metrics.passedTests}</div>
                <div class="metric-label">Passed</div>
            </div>
            <div class="metric">
                <div class="metric-value ${testResults.metrics.failedTests > 0 ? 'failure' : 'success'}">${testResults.metrics.failedTests}</div>
                <div class="metric-label">Failed</div>
            </div>
            <div class="metric">
                <div class="metric-value">${Math.round(testResults.metrics.duration / 1000)}s</div>
                <div class="metric-label">Duration</div>
            </div>
        </div>

        <div class="content">
            <h2>🧪 Test Steps</h2>
            ${testResults.steps.map(step => `
            <div class="step ${step.success ? 'success' : 'failure'}">
                <div class="step-header">
                    <div class="step-title">Step ${step.step}: ${step.description}</div>
                    <div class="step-status ${step.success ? 'success' : 'failure'}">${step.success ? 'PASSED' : 'FAILED'}</div>
                </div>
                <p><strong>Timestamp:</strong> ${step.timestamp}</p>
                ${step.data ? `<div class="step-data">${JSON.stringify(step.data, null, 2)}</div>` : ''}
                ${step.error ? `<div style="color: #e74c3c; margin-top: 10px;"><strong>Error:</strong> ${step.error}</div>` : ''}
            </div>
            `).join('')}

            <h2>🌐 API Calls</h2>
            <div class="api-calls">
                ${testResults.apiCalls.length > 0 ? testResults.apiCalls.map(call => `
                <div class="api-call ${call.status >= 200 && call.status < 300 ? 'success' : 'failure'}">
                    <span><strong>${call.method}</strong> ${call.url}</span>
                    <span><strong>Status:</strong> ${call.status}</span>
                </div>
                `).join('') : '<p>No API calls recorded</p>'}
            </div>

            <h2>📸 Screenshots</h2>
            <div class="screenshots">
                ${testResults.screenshots.map(screenshot => `
                <div class="screenshot">
                    <h3>${screenshot.name}</h3>
                    <p>${screenshot.description}</p>
                    <img src="${screenshot.path}" alt="${screenshot.name}" onclick="window.open(this.src, '_blank')" />
                    <p><small>Taken at: ${screenshot.timestamp}</small></p>
                </div>
                `).join('')}
            </div>

            ${testResults.consoleErrors.length > 0 ? `
            <h2>🚨 Console Errors</h2>
            <div class="console-errors">
                ${testResults.consoleErrors.map(error => `
                <div class="console-error">
                    <strong>${error.type}:</strong> ${error.text}
                    <br><small>${error.timestamp}</small>
                </div>
                `).join('')}
            </div>
            ` : '<h2 class="success">✅ No Console Errors Detected</h2>'}
        </div>
    </div>

    <script>
        // Add click handlers for screenshot popups
        document.querySelectorAll('.screenshot img').forEach(img => {
            img.addEventListener('click', () => {
                window.open(img.src, '_blank', 'width=1200,height=800,scrollbars=yes');
            });
        });
    </script>
</body>
</html>`;
    }

    async cleanup() {
        if (this.browser) {
            await this.browser.close();
        }
    }

    async runFullTestSuite() {
        console.log('🚀 Starting PLOMES-ROTA-CEP Geocoding E2E Test Suite');

        try {
            await this.setup();

            // Execute test sequence
            await this.testLogin();
            await this.testDashboardStatistics();
            await this.testGeocodingMenuAccess();
            await this.testGeocodingManager();
            await this.testBatchGeocoding();
            await this.testCustomerSync();
            await this.testMapDisplay();
            await this.testCEPSearch();

            // Generate final report
            const finalReport = await this.generateReport();

            console.log('\n🎉 Test suite completed!');
            console.log(`📊 Results: ${finalReport.metrics.passedTests}/${finalReport.metrics.totalTests} tests passed`);

            return finalReport;

        } catch (error) {
            console.error('💥 Test suite failed:', error.message);
            await this.takeScreenshot('final-error', 'Final error state');
            throw error;
        } finally {
            await this.cleanup();
        }
    }
}

// Execute test suite if run directly
if (require.main === module) {
    const testSuite = new GeocodingTestSuite();

    testSuite.runFullTestSuite()
        .then(results => {
            console.log('\n✅ E2E Test Suite Summary:');
            console.log(`- Overall Success: ${results.success}`);
            console.log(`- Tests Passed: ${results.metrics.passedTests}/${results.metrics.totalTests}`);
            console.log(`- Duration: ${Math.round(results.metrics.duration / 1000)}s`);
            console.log(`- Screenshots: ${results.screenshots.length}`);
            console.log(`- API Calls: ${results.apiCalls.length}`);
            console.log(`- Console Errors: ${results.consoleErrors.length}`);

            process.exit(results.success ? 0 : 1);
        })
        .catch(error => {
            console.error('💥 Fatal error in test suite:', error);
            process.exit(1);
        });
}

module.exports = { GeocodingTestSuite };