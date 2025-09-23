#!/usr/bin/env node

const puppeteer = require('puppeteer');
const path = require('path');

const FRONTEND_URL = 'http://localhost:3000';
const BACKEND_URL = 'http://localhost:3001';

// Default login credentials
const LOGIN_CREDENTIALS = {
    email: 'gustavo.canuto@ciaramaquinas.com.br',
    password: 'ciara123@'
};

class FrontendIntegrationTest {
    constructor() {
        this.browser = null;
        this.page = null;
        this.testResults = [];
    }

    async init() {
        console.log('🚀 Starting Frontend Integration Test...\n');

        this.browser = await puppeteer.launch({
            headless: false, // Set to true for CI/CD
            devtools: false,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        this.page = await this.browser.newPage();
        await this.page.setViewport({ width: 1366, height: 768 });

        // Listen for console errors
        this.page.on('console', msg => {
            if (msg.type() === 'error') {
                console.log(`🔍 Browser Console Error: ${msg.text()}`);
            }
        });

        // Listen for page errors
        this.page.on('pageerror', error => {
            console.log(`🔍 Page Error: ${error.message}`);
        });
    }

    async cleanup() {
        if (this.browser) {
            await this.browser.close();
        }
    }

    addResult(testName, success, details = '') {
        this.testResults.push({
            test: testName,
            success,
            details,
            timestamp: new Date().toISOString()
        });

        const status = success ? '✅' : '❌';
        console.log(`${status} ${testName}: ${details}`);
    }

    async testFrontendAccessibility() {
        try {
            console.log('🔍 Testing frontend accessibility...');

            await this.page.goto(FRONTEND_URL, { waitUntil: 'networkidle0', timeout: 10000 });

            // Check if page loads
            const title = await this.page.title();
            if (title.includes('Otimizador de Rotas')) {
                this.addResult('Frontend Accessibility', true, `Page loaded with title: ${title}`);
                return true;
            } else {
                this.addResult('Frontend Accessibility', false, `Unexpected title: ${title}`);
                return false;
            }
        } catch (error) {
            this.addResult('Frontend Accessibility', false, `Error: ${error.message}`);
            return false;
        }
    }

    async testLoginFunctionality() {
        try {
            console.log('🔐 Testing login functionality...');

            // Wait for and click login elements
            await this.page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 5000 });

            // Fill in credentials
            await this.page.type('input[type="email"], input[name="email"]', LOGIN_CREDENTIALS.email);
            await this.page.type('input[type="password"], input[name="password"]', LOGIN_CREDENTIALS.password);

            // Click login button
            await this.page.click('button[type="submit"], button:contains("Entrar"), button:contains("Login")');

            // Wait for successful login (look for main app elements)
            await this.page.waitForSelector('[data-testid="main-app"], .main-content, h1, h2', { timeout: 10000 });

            // Check if we're in the main app
            const url = this.page.url();
            const hasMainContent = await this.page.$('[data-testid="main-app"], .main-content') !== null;

            if (hasMainContent || !url.includes('login')) {
                this.addResult('Login Functionality', true, 'Login successful, main app loaded');
                return true;
            } else {
                this.addResult('Login Functionality', false, 'Login failed - still on login page');
                return false;
            }
        } catch (error) {
            this.addResult('Login Functionality', false, `Error: ${error.message}`);
            return false;
        }
    }

    async testMapRendering() {
        try {
            console.log('🗺️ Testing map rendering...');

            // Wait for map container
            await this.page.waitForSelector('.leaflet-container', { timeout: 10000 });

            // Check if map tiles are loaded
            const mapTiles = await this.page.$$('.leaflet-tile');
            const hasMapTiles = mapTiles.length > 0;

            if (hasMapTiles) {
                this.addResult('Map Rendering', true, `Map loaded with ${mapTiles.length} tiles`);
                return true;
            } else {
                this.addResult('Map Rendering', false, 'Map container found but no tiles loaded');
                return false;
            }
        } catch (error) {
            this.addResult('Map Rendering', false, `Error: ${error.message}`);
            return false;
        }
    }

    async testCEPGeocoding() {
        try {
            console.log('📍 Testing CEP geocoding...');

            // Look for CEP input field
            const cepInput = await this.page.$('input[placeholder*="CEP"], input[label*="CEP"], input[name*="cep"]');

            if (cepInput) {
                // Test CEP geocoding
                await cepInput.click();
                await cepInput.type('01310-100'); // Avenida Paulista

                // Look for geocode button or auto-trigger
                const geocodeButton = await this.page.$('button:contains("Buscar"), button:contains("Geocodificar")');
                if (geocodeButton) {
                    await geocodeButton.click();
                }

                // Wait for result
                await this.page.waitForTimeout(3000);

                // Check if coordinates appeared or map moved
                const hasCoordinates = await this.page.evaluate(() => {
                    return document.body.innerText.includes('-23.') || document.body.innerText.includes('Paulista');
                });

                if (hasCoordinates) {
                    this.addResult('CEP Geocoding', true, 'CEP successfully geocoded');
                    return true;
                } else {
                    this.addResult('CEP Geocoding', false, 'CEP geocoding did not return expected results');
                    return false;
                }
            } else {
                this.addResult('CEP Geocoding', false, 'CEP input field not found');
                return false;
            }
        } catch (error) {
            this.addResult('CEP Geocoding', false, `Error: ${error.message}`);
            return false;
        }
    }

    async testPDFButtonVisibility() {
        try {
            console.log('📄 Testing PDF export button visibility...');

            // Look for PDF export button
            const pdfButton = await this.page.$('button:contains("PDF"), button[title*="PDF"], button:contains("Exportar")');

            if (pdfButton) {
                const isVisible = await pdfButton.isIntersectingViewport();
                const buttonText = await this.page.evaluate(el => el.textContent, pdfButton);

                this.addResult('PDF Button Visibility', true, `PDF button found and ${isVisible ? 'visible' : 'hidden'}: "${buttonText}"`);
                return true;
            } else {
                this.addResult('PDF Button Visibility', false, 'PDF export button not found in DOM');
                return false;
            }
        } catch (error) {
            this.addResult('PDF Button Visibility', false, `Error: ${error.message}`);
            return false;
        }
    }

    async testListComponentError() {
        try {
            console.log('📝 Testing for List component errors...');

            // Check console for List-related errors
            const consoleLogs = [];
            this.page.on('console', msg => {
                if (msg.text().toLowerCase().includes('list') && msg.type() === 'error') {
                    consoleLogs.push(msg.text());
                }
            });

            // Wait and check if any List errors occurred
            await this.page.waitForTimeout(2000);

            if (consoleLogs.length === 0) {
                this.addResult('List Component Error Check', true, 'No List component errors detected');
                return true;
            } else {
                this.addResult('List Component Error Check', false, `List errors found: ${consoleLogs.join(', ')}`);
                return false;
            }
        } catch (error) {
            this.addResult('List Component Error Check', false, `Error: ${error.message}`);
            return false;
        }
    }

    async testRouteOptimization() {
        try {
            console.log('🎯 Testing route optimization flow...');

            // This is a complex test - we'll check if the optimization UI is available
            // Look for customer selection or route optimization elements
            const hasCustomerList = await this.page.$('[data-testid="customer-list"], .customer-item') !== null;
            const hasOptimizeButton = await this.page.$('button:contains("Otimizar"), button:contains("Optimize")') !== null;

            if (hasCustomerList || hasOptimizeButton) {
                this.addResult('Route Optimization UI', true, 'Route optimization interface elements found');
                return true;
            } else {
                this.addResult('Route Optimization UI', false, 'Route optimization interface not found');
                return false;
            }
        } catch (error) {
            this.addResult('Route Optimization UI', false, `Error: ${error.message}`);
            return false;
        }
    }

    async testPolylineRendering() {
        try {
            console.log('🗺️ Testing polyline rendering capabilities...');

            // Check if polyline-related classes or SVG elements exist
            const hasPolylineElements = await this.page.evaluate(() => {
                // Look for Leaflet polyline elements
                const polylines = document.querySelectorAll('.leaflet-interactive, svg path');
                return polylines.length > 0;
            });

            if (hasPolylineElements) {
                this.addResult('Polyline Rendering Setup', true, 'Polyline rendering elements detected in DOM');
                return true;
            } else {
                this.addResult('Polyline Rendering Setup', false, 'No polyline rendering elements found');
                return false;
            }
        } catch (error) {
            this.addResult('Polyline Rendering Setup', false, `Error: ${error.message}`);
            return false;
        }
    }

    async generateReport() {
        console.log('\n📊 ========== FRONTEND INTEGRATION TEST REPORT ==========\n');

        const passedTests = this.testResults.filter(r => r.success).length;
        const totalTests = this.testResults.length;
        const passRate = ((passedTests / totalTests) * 100).toFixed(1);

        console.log(`📈 Overall Score: ${passedTests}/${totalTests} tests passed (${passRate}%)\n`);

        console.log('📋 Detailed Results:');
        this.testResults.forEach((result, index) => {
            const status = result.success ? '✅ PASS' : '❌ FAIL';
            console.log(`${index + 1}. ${status} - ${result.test}`);
            if (result.details) {
                console.log(`   Details: ${result.details}`);
            }
        });

        console.log('\n🔍 Critical Issues Summary:');
        const failedTests = this.testResults.filter(r => !r.success);
        if (failedTests.length === 0) {
            console.log('🎉 No critical issues found! All tests passed.');
        } else {
            failedTests.forEach(test => {
                console.log(`❌ ${test.test}: ${test.details}`);
            });
        }

        console.log('\n✅ Tests Completed Successfully:');
        const passedTestsList = this.testResults.filter(r => r.success);
        passedTestsList.forEach(test => {
            console.log(`✅ ${test.test}`);
        });

        console.log('\n========================================================\n');

        return {
            totalTests,
            passedTests,
            failedTests: failedTests.length,
            passRate: parseFloat(passRate),
            results: this.testResults
        };
    }

    async runAllTests() {
        try {
            await this.init();

            // Run tests in sequence
            await this.testFrontendAccessibility();
            await this.testLoginFunctionality();
            await this.testMapRendering();
            await this.testCEPGeocoding();
            await this.testPDFButtonVisibility();
            await this.testListComponentError();
            await this.testRouteOptimization();
            await this.testPolylineRendering();

            return await this.generateReport();
        } catch (error) {
            console.error('❌ Test suite failed:', error.message);
            return null;
        } finally {
            await this.cleanup();
        }
    }
}

// Run tests if called directly
if (require.main === module) {
    const test = new FrontendIntegrationTest();
    test.runAllTests()
        .then(results => {
            if (results) {
                process.exit(results.passRate >= 70 ? 0 : 1); // Exit with error if less than 70% pass rate
            } else {
                process.exit(1);
            }
        })
        .catch(error => {
            console.error('Test runner failed:', error);
            process.exit(1);
        });
}

module.exports = FrontendIntegrationTest;