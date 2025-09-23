const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

/**
 * Comprehensive Playwright test for Route Optimization and Map Visualization
 * Tests the complete flow from login to route optimization with visual verification
 */

async function runRouteOptimizationTest() {
    console.log('🚀 Starting Route Optimization and Map Visualization Test');

    const browser = await chromium.launch({
        headless: false,  // Show browser for visual verification
        slowMo: 1000     // Add delay between actions for better observation
    });

    const context = await browser.newContext({
        viewport: { width: 1920, height: 1080 }
    });

    const page = await context.newPage();

    // Capture console messages and network requests
    const consoleMessages = [];
    const networkRequests = [];

    page.on('console', msg => {
        consoleMessages.push({
            type: msg.type(),
            text: msg.text(),
            timestamp: new Date().toISOString()
        });
        console.log(`📋 Console [${msg.type()}]: ${msg.text()}`);
    });

    page.on('request', request => {
        networkRequests.push({
            url: request.url(),
            method: request.method(),
            timestamp: new Date().toISOString()
        });
        if (request.url().includes('/api/')) {
            console.log(`🌐 API Request: ${request.method()} ${request.url()}`);
        }
    });

    page.on('response', response => {
        if (response.url().includes('/api/')) {
            console.log(`📡 API Response: ${response.status()} ${response.url()}`);
        }
    });

    const testResults = {
        timestamp: new Date().toISOString(),
        success: false,
        steps: [],
        screenshots: [],
        consoleErrors: [],
        apiCalls: [],
        visualVerification: {}
    };

    try {
        // Step 1: Navigate to the application
        console.log('\n📍 Step 1: Navigating to http://localhost:3000');
        await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

        testResults.steps.push({
            step: 1,
            description: 'Navigate to application',
            success: true,
            timestamp: new Date().toISOString()
        });

        // Step 2: Perform login
        console.log('\n🔐 Step 2: Performing login with test/test credentials');

        // Wait for login form
        await page.waitForSelector('input[name="username"], input[type="text"]', { timeout: 10000 });
        await page.waitForSelector('input[name="password"], input[type="password"]', { timeout: 10000 });

        // Fill login credentials
        await page.fill('input[name="username"], input[type="text"]', 'test');
        await page.fill('input[name="password"], input[type="password"]', 'test');

        // Click login button
        await page.click('button[type="submit"], button:has-text("Entrar"), button:has-text("Login")');

        // Wait for successful login (dashboard should load)
        await page.waitForSelector('.customer-list, [data-testid="customer-list"], .customers', { timeout: 15000 });

        testResults.steps.push({
            step: 2,
            description: 'Login successful',
            success: true,
            timestamp: new Date().toISOString()
        });

        console.log('✅ Login successful - Dashboard loaded');

        // Step 3: Take screenshot before route optimization
        console.log('\n📸 Step 3: Taking screenshot before route optimization');
        const beforeScreenshot = 'test-screenshots/before-route-optimization.png';
        await page.screenshot({
            path: beforeScreenshot,
            fullPage: true
        });
        testResults.screenshots.push({
            name: 'before-route-optimization',
            path: beforeScreenshot,
            description: 'Map view before route optimization - should show only customer markers'
        });

        // Step 4: Wait for customers to load and select multiple customers
        console.log('\n👥 Step 4: Selecting multiple customers from the list');

        // Wait for customer list to be populated
        await page.waitForTimeout(3000);

        // Find and select customers (try different selectors)
        const customerSelectors = [
            '.customer-item input[type="checkbox"]',
            '[data-testid="customer-checkbox"]',
            '.customer-checkbox',
            'input[type="checkbox"]'
        ];

        let customersSelected = 0;

        for (const selector of customerSelectors) {
            try {
                const checkboxes = await page.locator(selector).all();
                console.log(`Found ${checkboxes.length} checkboxes with selector: ${selector}`);

                if (checkboxes.length >= 3) {
                    // Select first 4 customers
                    for (let i = 0; i < Math.min(4, checkboxes.length); i++) {
                        await checkboxes[i].check();
                        customersSelected++;
                        console.log(`✅ Selected customer ${i + 1}`);
                        await page.waitForTimeout(500);
                    }
                    break;
                }
            } catch (error) {
                console.log(`Selector ${selector} not found, trying next...`);
            }
        }

        if (customersSelected === 0) {
            // Alternative: try clicking on customer rows to select them
            const customerRows = await page.locator('.customer-item, .customer-row, [data-testid="customer-row"]').all();
            console.log(`Found ${customerRows.length} customer rows`);

            for (let i = 0; i < Math.min(4, customerRows.length); i++) {
                await customerRows[i].click();
                customersSelected++;
                console.log(`✅ Selected customer row ${i + 1}`);
                await page.waitForTimeout(500);
            }
        }

        console.log(`📊 Total customers selected: ${customersSelected}`);

        testResults.steps.push({
            step: 4,
            description: `Selected ${customersSelected} customers`,
            success: customersSelected >= 3,
            timestamp: new Date().toISOString()
        });

        if (customersSelected < 3) {
            throw new Error('Could not select sufficient customers for route optimization');
        }

        // Step 5: Click "Otimizar Rota" button
        console.log('\n🎯 Step 5: Clicking "Otimizar Rota" button');

        const optimizeButtonSelectors = [
            'button:has-text("Otimizar Rota")',
            '[data-testid="optimize-route"]',
            '.optimize-button',
            'button:has-text("Optimize")'
        ];

        let buttonClicked = false;

        for (const selector of optimizeButtonSelectors) {
            try {
                const button = page.locator(selector);
                if (await button.isVisible()) {
                    await button.click();
                    buttonClicked = true;
                    console.log(`✅ Clicked optimize button with selector: ${selector}`);
                    break;
                }
            } catch (error) {
                console.log(`Button selector ${selector} not found, trying next...`);
            }
        }

        if (!buttonClicked) {
            throw new Error('Could not find or click the "Otimizar Rota" button');
        }

        // Step 6: Monitor API call and wait for route optimization
        console.log('\n⏳ Step 6: Waiting for route optimization API call and response');

        // Wait for the optimize API call
        const optimizeRequest = await page.waitForRequest(
            request => request.url().includes('/api/routes/optimize'),
            { timeout: 10000 }
        );

        console.log('📡 Route optimization API request detected');

        // Wait for the response
        const optimizeResponse = await page.waitForResponse(
            response => response.url().includes('/api/routes/optimize'),
            { timeout: 30000 }
        );

        const responseStatus = optimizeResponse.status();
        console.log(`📊 API Response Status: ${responseStatus}`);

        testResults.apiCalls.push({
            url: '/api/routes/optimize',
            status: responseStatus,
            success: responseStatus === 200,
            timestamp: new Date().toISOString()
        });

        if (responseStatus !== 200) {
            throw new Error(`Route optimization API failed with status: ${responseStatus}`);
        }

        // Get response data
        const responseData = await optimizeResponse.json();
        console.log('📋 Route optimization response received');

        testResults.steps.push({
            step: 6,
            description: 'Route optimization API call successful',
            success: true,
            timestamp: new Date().toISOString(),
            data: { responseStatus, hasRouteData: !!responseData.route }
        });

        // Step 7: Wait for map to update with route visualization
        console.log('\n🗺️  Step 7: Waiting for map visualization to update');

        // Wait for potential map updates
        await page.waitForTimeout(5000);

        // Step 8: Take screenshot after route optimization
        console.log('\n📸 Step 8: Taking screenshot after route optimization');
        const afterScreenshot = 'test-screenshots/after-route-optimization.png';
        await page.screenshot({
            path: afterScreenshot,
            fullPage: true
        });
        testResults.screenshots.push({
            name: 'after-route-optimization',
            path: afterScreenshot,
            description: 'Map view after route optimization - should show polylines and connected markers'
        });

        // Step 9: Verify visual elements on the map
        console.log('\n🔍 Step 9: Verifying map visualization elements');

        const visualElements = {
            markers: false,
            polylines: false,
            connections: false
        };

        // Check for map container
        const mapContainer = await page.locator('#map, .map-container, [data-testid="map"]').first();
        if (await mapContainer.isVisible()) {
            console.log('✅ Map container is visible');
            visualElements.mapContainer = true;
        }

        // Check for SVG elements (polylines are usually rendered as SVG)
        const svgElements = await page.locator('svg').count();
        console.log(`📊 Found ${svgElements} SVG elements on page`);
        visualElements.svgElements = svgElements;

        // Check for polyline or path elements
        const polylineElements = await page.locator('polyline, path[stroke]').count();
        console.log(`📊 Found ${polylineElements} polyline/path elements`);
        visualElements.polylines = polylineElements > 0;

        testResults.visualVerification = visualElements;

        // Step 10: Check console for translation errors
        console.log('\n🔍 Step 10: Checking console for translation errors');

        const translationErrors = consoleMessages.filter(msg =>
            msg.text.includes('route.orderUpdated') ||
            msg.text.includes('translation') ||
            msg.type === 'error'
        );

        testResults.consoleErrors = translationErrors;

        if (translationErrors.length === 0) {
            console.log('✅ No translation errors found in console');
        } else {
            console.log(`⚠️  Found ${translationErrors.length} potential translation errors:`);
            translationErrors.forEach(error => {
                console.log(`   - ${error.type}: ${error.text}`);
            });
        }

        testResults.steps.push({
            step: 10,
            description: 'Console error check completed',
            success: translationErrors.length === 0,
            timestamp: new Date().toISOString(),
            errors: translationErrors
        });

        // Test completed successfully
        testResults.success = true;
        console.log('\n🎉 Route optimization test completed successfully!');

    } catch (error) {
        console.error('\n❌ Test failed:', error.message);

        // Take error screenshot
        const errorScreenshot = 'test-screenshots/error-screenshot.png';
        try {
            await page.screenshot({
                path: errorScreenshot,
                fullPage: true
            });
            testResults.screenshots.push({
                name: 'error-screenshot',
                path: errorScreenshot,
                description: 'Screenshot taken when test failed'
            });
        } catch (screenshotError) {
            console.error('Failed to take error screenshot:', screenshotError.message);
        }

        testResults.error = error.message;
    } finally {
        // Step 11: Generate test report
        console.log('\n📊 Generating test report...');

        const reportPath = 'route-optimization-test-report.json';
        fs.writeFileSync(reportPath, JSON.stringify(testResults, null, 2));

        // Generate HTML report
        const htmlReport = generateHTMLReport(testResults);
        fs.writeFileSync('route-optimization-test-report.html', htmlReport);

        console.log(`📋 Test report saved to: ${reportPath}`);
        console.log(`🌐 HTML report saved to: route-optimization-test-report.html`);

        await browser.close();
    }

    return testResults;
}

function generateHTMLReport(results) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Route Optimization Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }
        .header { background: #f4f4f4; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .success { color: #27ae60; }
        .failure { color: #e74c3c; }
        .warning { color: #f39c12; }
        .step { margin: 15px 0; padding: 15px; border-left: 4px solid #3498db; background: #f8f9fa; }
        .step.success { border-left-color: #27ae60; }
        .step.failure { border-left-color: #e74c3c; }
        .screenshot { margin: 10px 0; }
        .screenshot img { max-width: 100%; border: 1px solid #ddd; border-radius: 4px; }
        .console-error { background: #fff5f5; padding: 10px; border-left: 4px solid #e74c3c; margin: 5px 0; }
        pre { background: #f4f4f4; padding: 10px; border-radius: 4px; overflow-x: auto; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Route Optimization & Map Visualization Test Report</h1>
        <p><strong>Test Date:</strong> ${results.timestamp}</p>
        <p><strong>Overall Result:</strong> <span class="${results.success ? 'success' : 'failure'}">${results.success ? 'PASSED' : 'FAILED'}</span></p>
    </div>

    <h2>Test Steps</h2>
    ${results.steps.map(step => `
    <div class="step ${step.success ? 'success' : 'failure'}">
        <h3>Step ${step.step}: ${step.description}</h3>
        <p><strong>Status:</strong> <span class="${step.success ? 'success' : 'failure'}">${step.success ? 'PASSED' : 'FAILED'}</span></p>
        <p><strong>Timestamp:</strong> ${step.timestamp}</p>
        ${step.data ? `<pre>${JSON.stringify(step.data, null, 2)}</pre>` : ''}
        ${step.errors && step.errors.length > 0 ? `
        <h4>Errors:</h4>
        ${step.errors.map(error => `<div class="console-error">${error.type}: ${error.text}</div>`).join('')}
        ` : ''}
    </div>
    `).join('')}

    <h2>API Calls</h2>
    ${results.apiCalls.length > 0 ? results.apiCalls.map(call => `
    <div class="step ${call.success ? 'success' : 'failure'}">
        <h3>${call.url}</h3>
        <p><strong>Status:</strong> ${call.status}</p>
        <p><strong>Timestamp:</strong> ${call.timestamp}</p>
    </div>
    `).join('') : '<p>No API calls recorded</p>'}

    <h2>Visual Verification</h2>
    <div class="step">
        <pre>${JSON.stringify(results.visualVerification, null, 2)}</pre>
    </div>

    <h2>Screenshots</h2>
    ${results.screenshots.map(screenshot => `
    <div class="screenshot">
        <h3>${screenshot.name}</h3>
        <p>${screenshot.description}</p>
        <img src="${screenshot.path}" alt="${screenshot.name}" onclick="window.open(this.src, '_blank')" style="cursor: pointer;" />
    </div>
    `).join('')}

    <h2>Console Messages</h2>
    ${results.consoleErrors.length > 0 ? `
    <h3>Errors and Warnings</h3>
    ${results.consoleErrors.map(error => `
    <div class="console-error">
        <strong>${error.type}:</strong> ${error.text}
        <br><small>${error.timestamp}</small>
    </div>
    `).join('')}
    ` : '<p class="success">No console errors detected</p>'}

    ${results.error ? `
    <h2>Test Error</h2>
    <div class="step failure">
        <p><strong>Error:</strong> ${results.error}</p>
    </div>
    ` : ''}
</body>
</html>
    `;
}

// Run the test
if (require.main === module) {
    runRouteOptimizationTest()
        .then(results => {
            console.log('\n📋 Test Summary:');
            console.log(`- Overall Success: ${results.success}`);
            console.log(`- Steps Completed: ${results.steps.length}`);
            console.log(`- Screenshots Taken: ${results.screenshots.length}`);
            console.log(`- API Calls: ${results.apiCalls.length}`);
            console.log(`- Console Errors: ${results.consoleErrors.length}`);

            process.exit(results.success ? 0 : 1);
        })
        .catch(error => {
            console.error('Fatal error:', error);
            process.exit(1);
        });
}

module.exports = { runRouteOptimizationTest };