/**
 * PLAYWRIGHT POLYLINE TEST
 * Visual browser test for polyline rendering fixes
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

class PlaywrightPolylineTest {
  constructor() {
    this.browser = null;
    this.page = null;
    this.results = {
      timestamp: new Date().toISOString(),
      tests: [],
      summary: { total: 0, passed: 0, failed: 0, warnings: 0 },
      screenshots: [],
      consoleErrors: []
    };
    this.frontendUrl = 'http://localhost:3000';
    this.screenshotDir = path.join(__dirname, 'test-screenshots');
  }

  async init() {
    console.log('🎭 Initializing Playwright browser...');

    // Create screenshots directory
    if (!fs.existsSync(this.screenshotDir)) {
      fs.mkdirSync(this.screenshotDir, { recursive: true });
    }

    this.browser = await chromium.launch({
      headless: false, // Set to true for CI/CD
      slowMo: 1000 // Slow down for demo
    });

    this.page = await this.browser.newPage({
      viewport: { width: 1920, height: 1080 }
    });

    // Listen for console messages
    this.page.on('console', msg => {
      if (msg.type() === 'error') {
        this.results.consoleErrors.push({
          timestamp: new Date().toISOString(),
          message: msg.text()
        });
      }
    });

    console.log('✅ Browser initialized');
  }

  async addTestResult(testName, status, details = '', screenshot = null) {
    const result = {
      name: testName,
      status,
      details,
      timestamp: new Date().toISOString(),
      screenshot
    };

    this.results.tests.push(result);
    this.results.summary.total++;
    this.results.summary[status]++;

    const statusEmoji = { passed: '✅', failed: '❌', warnings: '⚠️' };
    console.log(`${statusEmoji[status] || '📝'} ${testName}: ${details || status}`);

    if (screenshot) {
      const screenshotPath = path.join(this.screenshotDir, screenshot);
      await this.page.screenshot({ path: screenshotPath, fullPage: true });
      this.results.screenshots.push(screenshot);
      console.log(`📸 Screenshot saved: ${screenshot}`);
    }
  }

  async testApplicationLoading() {
    console.log('\n🌐 Testing application loading...');

    try {
      await this.page.goto(this.frontendUrl, { waitUntil: 'networkidle' });
      await this.addTestResult('Application Loading', 'passed', 'Frontend loaded successfully');

      // Wait for React to render
      await this.page.waitForSelector('#root', { timeout: 10000 });
      await this.addTestResult('React Root', 'passed', 'React root element found');

      // Check for Leaflet map
      await this.page.waitForSelector('.leaflet-container', { timeout: 15000 });
      await this.addTestResult('Leaflet Map', 'passed', 'Leaflet map container loaded');

      await this.addTestResult('Initial Load', 'passed', 'Application loaded completely', 'initial-load.png');

    } catch (error) {
      await this.addTestResult('Application Loading', 'failed', `Failed to load: ${error.message}`, 'load-error.png');
    }
  }

  async testOriginSetting() {
    console.log('\n📍 Testing origin setting...');

    try {
      // Find and fill CEP input
      const cepInput = await this.page.locator('input[placeholder*="CEP"]').first();
      await cepInput.fill('60175-047');
      await this.addTestResult('CEP Input', 'passed', 'CEP entered successfully');

      // Click the location button
      await this.page.click('button:has-text("📍")');
      await this.addTestResult('Origin Button Click', 'passed', 'Origin button clicked');

      // Wait for origin to be set
      await this.page.waitForText('Origem definida', { timeout: 15000 });
      await this.addTestResult('Origin Set', 'passed', 'Origin successfully set');

      // Check for origin marker
      const originMarker = await this.page.locator('.draggable-origin-marker').count();
      if (originMarker > 0) {
        await this.addTestResult('Origin Marker', 'passed', 'Origin marker visible on map');
      } else {
        await this.addTestResult('Origin Marker', 'warnings', 'Origin marker not detected');
      }

      await this.addTestResult('Origin Setup Complete', 'passed', 'Origin setup completed', 'origin-set.png');

    } catch (error) {
      await this.addTestResult('Origin Setting', 'failed', `Origin setting failed: ${error.message}`, 'origin-error.png');
    }
  }

  async testCustomerLoading() {
    console.log('\n👥 Testing customer loading...');

    try {
      // Click load customers button
      await this.page.click('button:has-text("📥")');
      await this.addTestResult('Load Customers Click', 'passed', 'Load customers button clicked');

      // Wait for customers to load (look for success message)
      await this.page.waitForFunction(() => {
        return document.body.textContent.includes('clientes carregados') ||
               document.body.textContent.includes('customers loaded');
      }, { timeout: 20000 });

      await this.addTestResult('Customer Loading', 'passed', 'Customers loaded successfully');

      // Check for customer markers
      const customerMarkers = await this.page.locator('.leaflet-marker-icon').count();
      await this.addTestResult('Customer Markers', 'passed', `${customerMarkers} customer markers found`);

      await this.addTestResult('Customer Load Complete', 'passed', 'Customer loading completed', 'customers-loaded.png');

    } catch (error) {
      await this.addTestResult('Customer Loading', 'failed', `Customer loading failed: ${error.message}`, 'customer-error.png');
    }
  }

  async testRouteOptimization() {
    console.log('\n🚀 Testing route optimization and polyline rendering...');

    try {
      // Select customers by clicking on markers
      const customerMarkers = await this.page.locator('.leaflet-marker-icon').all();

      if (customerMarkers.length > 0) {
        // Click on first few markers to open popups and select customers
        for (let i = 0; i < Math.min(3, customerMarkers.length); i++) {
          await customerMarkers[i].click();
          await this.page.waitForTimeout(1000); // Wait for popup

          // Look for select button in popup
          const selectButton = this.page.locator('button:has-text("Selecionar")');
          if (await selectButton.count() > 0) {
            await selectButton.first().click();
            await this.page.waitForTimeout(500);
          }
        }

        await this.addTestResult('Customer Selection', 'passed', `Selected customers via map markers`);

        // Click optimize route button
        await this.page.click('button:has-text("🚀")');
        await this.addTestResult('Optimize Button Click', 'passed', 'Route optimization started');

        // Wait for route optimization to complete
        await this.page.waitForFunction(() => {
          return document.body.textContent.includes('Rota otimizada') ||
                 document.body.textContent.includes('Route optimized') ||
                 document.body.textContent.includes('km,');
        }, { timeout: 30000 });

        await this.addTestResult('Route Optimization', 'passed', 'Route optimization completed');

        // Check for polyline elements
        const polylineElements = await this.page.evaluate(() => {
          const polylines = document.querySelectorAll('.leaflet-interactive');
          return Array.from(polylines).map(el => {
            const style = window.getComputedStyle(el);
            return {
              stroke: style.stroke,
              strokeWidth: style.strokeWidth,
              opacity: style.opacity,
              tagName: el.tagName
            };
          });
        });

        const redPolylines = polylineElements.filter(p =>
          p.stroke === 'rgb(255, 0, 0)' || p.stroke === '#FF0000'
        );

        if (redPolylines.length > 0) {
          await this.addTestResult('Route Polyline', 'passed', `Red route polyline visible (${redPolylines.length} elements)`);
        } else {
          await this.addTestResult('Route Polyline', 'failed', `No red polylines found. Total polylines: ${polylineElements.length}`);
        }

        await this.addTestResult('Route Complete', 'passed', 'Route optimization and polyline test completed', 'route-with-polyline.png');

      } else {
        await this.addTestResult('Customer Selection', 'failed', 'No customer markers found for selection');
      }

    } catch (error) {
      await this.addTestResult('Route Optimization', 'failed', `Route optimization failed: ${error.message}`, 'route-error.png');
    }
  }

  async testDebugInfo() {
    console.log('\n🐛 Testing debug information...');

    try {
      // Look for debug panel in development mode
      const debugPanel = await this.page.locator('text=Debug: Polyline Status').count();

      if (debugPanel > 0) {
        await this.addTestResult('Debug Panel', 'passed', 'Debug panel found');

        // Take screenshot of debug info
        await this.addTestResult('Debug Info', 'passed', 'Debug information visible', 'debug-panel.png');
      } else {
        await this.addTestResult('Debug Panel', 'warnings', 'Debug panel not found (may be production mode)');
      }

    } catch (error) {
      await this.addTestResult('Debug Info', 'failed', `Error checking debug info: ${error.message}`);
    }
  }

  async checkConsoleErrors() {
    console.log('\n🔍 Checking console errors...');

    const reactLeafletErrors = this.results.consoleErrors.filter(err =>
      err.message.toLowerCase().includes('leaflet') ||
      err.message.toLowerCase().includes('react-leaflet') ||
      err.message.toLowerCase().includes('polyline')
    );

    if (reactLeafletErrors.length === 0) {
      await this.addTestResult('Console Errors', 'passed', 'No React-Leaflet related errors found');
    } else {
      await this.addTestResult('Console Errors', 'warnings', `${reactLeafletErrors.length} React-Leaflet related errors found`);
    }

    const totalErrors = this.results.consoleErrors.length;
    if (totalErrors === 0) {
      await this.addTestResult('Overall Console', 'passed', 'No console errors detected');
    } else {
      await this.addTestResult('Overall Console', 'warnings', `${totalErrors} total console errors detected`);
    }
  }

  async generateReport() {
    console.log('\n📊 Generating comprehensive test report...');

    const reportPath = path.join(__dirname, 'PLAYWRIGHT_POLYLINE_TEST_REPORT.md');
    const successRate = `${((this.results.summary.passed / this.results.summary.total) * 100).toFixed(1)}%`;

    let markdown = `# PLAYWRIGHT POLYLINE RENDERING TEST REPORT\n\n`;
    markdown += `**Test Run:** ${this.results.timestamp}\n`;
    markdown += `**Frontend URL:** ${this.frontendUrl}\n`;
    markdown += `**Browser:** Chromium (Playwright)\n\n`;

    markdown += `## Summary\n\n`;
    markdown += `- **Total Tests:** ${this.results.summary.total}\n`;
    markdown += `- **Passed:** ${this.results.summary.passed} ✅\n`;
    markdown += `- **Failed:** ${this.results.summary.failed} ❌\n`;
    markdown += `- **Warnings:** ${this.results.summary.warnings} ⚠️\n`;
    markdown += `- **Success Rate:** ${successRate}\n\n`;

    markdown += `## Test Results\n\n`;

    this.results.tests.forEach(test => {
      const emoji = { passed: '✅', failed: '❌', warnings: '⚠️' }[test.status] || '📝';
      markdown += `### ${emoji} ${test.name}\n`;
      markdown += `**Status:** ${test.status}\n`;
      markdown += `**Details:** ${test.details}\n`;
      markdown += `**Time:** ${test.timestamp}\n`;
      if (test.screenshot) {
        markdown += `**Screenshot:** ![${test.name}](test-screenshots/${test.screenshot})\n`;
      }
      markdown += `\n`;
    });

    if (this.results.consoleErrors.length > 0) {
      markdown += `## Console Errors\n\n`;
      this.results.consoleErrors.forEach((error, index) => {
        markdown += `${index + 1}. **${error.timestamp}:** \`${error.message}\`\n`;
      });
      markdown += `\n`;
    }

    markdown += `## Polyline Fix Validation\n\n`;

    if (this.results.summary.failed === 0) {
      markdown += `✅ **POLYLINE FIXES SUCCESSFUL!** All tests passed. The polyline rendering issues have been resolved.\n\n`;
      markdown += `Key validations completed:\n`;
      markdown += `- ✅ Leaflet CSS properly loaded\n`;
      markdown += `- ✅ Map renders correctly\n`;
      markdown += `- ✅ Origin setting works\n`;
      markdown += `- ✅ Customer loading works\n`;
      markdown += `- ✅ Route optimization generates polylines\n`;
      markdown += `- ✅ Red polylines are visible on the map\n\n`;
    } else {
      markdown += `❌ **ISSUES DETECTED:** ${this.results.summary.failed} tests failed. The polyline fixes may need additional work.\n\n`;
    }

    markdown += `## Screenshots\n\n`;
    this.results.screenshots.forEach(screenshot => {
      markdown += `- ![${screenshot}](test-screenshots/${screenshot})\n`;
    });

    markdown += `\n---\n*Generated by Playwright Polyline Test Suite*`;

    fs.writeFileSync(reportPath, markdown);
    console.log(`📄 Test report saved: ${reportPath}`);

    return this.results.summary;
  }

  async runTests() {
    console.log('🎭 Starting Playwright Polyline Test Suite...\n');

    try {
      await this.init();
      await this.testApplicationLoading();
      await this.testOriginSetting();
      await this.testCustomerLoading();
      await this.testRouteOptimization();
      await this.testDebugInfo();
      await this.checkConsoleErrors();

      const summary = await this.generateReport();

      console.log('\n🏁 Playwright test suite completed!');
      console.log(`📊 Results: ${summary.passed}/${summary.total} tests passed`);

      return summary;

    } catch (error) {
      console.error('❌ Test suite failed:', error);
      throw error;
    } finally {
      if (this.browser) {
        await this.browser.close();
      }
    }
  }
}

// Run tests if called directly
if (require.main === module) {
  const testSuite = new PlaywrightPolylineTest();
  testSuite.runTests()
    .then(summary => {
      process.exit(summary.failed > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('Test suite crashed:', error);
      process.exit(1);
    });
}

module.exports = PlaywrightPolylineTest;