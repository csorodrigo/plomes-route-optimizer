/**
 * SIMPLE POLYLINE TEST SUITE
 * Basic connectivity and API tests for polyline rendering fixes
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

class SimplePolylineTest {
  constructor() {
    this.frontendUrl = 'http://localhost:3000';
    this.backendUrl = 'http://localhost:3001';
    this.results = {
      timestamp: new Date().toISOString(),
      tests: [],
      summary: { total: 0, passed: 0, failed: 0 }
    };
  }

  async addTestResult(testName, status, details) {
    const result = { testName, status, details, timestamp: new Date().toISOString() };
    this.results.tests.push(result);
    this.results.summary.total++;
    this.results.summary[status]++;

    const emoji = status === 'passed' ? '✅' : '❌';
    console.log(`${emoji} ${testName}: ${details}`);
  }

  async testHttpRequest(url, testName) {
    return new Promise((resolve) => {
      const urlObj = new URL(url);
      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port,
        path: urlObj.pathname + urlObj.search,
        method: 'GET',
        timeout: 10000
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode === 200) {
            this.addTestResult(testName, 'passed', `HTTP ${res.statusCode} - Response received`);
            resolve({ success: true, data, statusCode: res.statusCode });
          } else {
            this.addTestResult(testName, 'failed', `HTTP ${res.statusCode} - Unexpected status`);
            resolve({ success: false, statusCode: res.statusCode });
          }
        });
      });

      req.on('error', (err) => {
        this.addTestResult(testName, 'failed', `Connection failed: ${err.message}`);
        resolve({ success: false, error: err.message });
      });

      req.on('timeout', () => {
        req.destroy();
        this.addTestResult(testName, 'failed', 'Request timeout');
        resolve({ success: false, error: 'timeout' });
      });

      req.end();
    });
  }

  async testFileModifications() {
    console.log('\n📁 Testing file modifications...');

    const filesToCheck = [
      {
        path: '/Users/rodrigooliveira/Documents/workspace 2/Claude-code/PLOMES-ROTA-CEP/frontend/src/index.js',
        name: 'Leaflet CSS Import in index.js',
        expectedContent: 'import \'leaflet/dist/leaflet.css\';'
      },
      {
        path: '/Users/rodrigooliveira/Documents/workspace 2/Claude-code/PLOMES-ROTA-CEP/frontend/src/components/RouteOptimizer.jsx',
        name: 'Polyline Simplification in RouteOptimizer.jsx',
        expectedContent: 'color="#FF0000"'
      }
    ];

    for (const file of filesToCheck) {
      try {
        if (fs.existsSync(file.path)) {
          const content = fs.readFileSync(file.path, 'utf8');
          if (content.includes(file.expectedContent)) {
            await this.addTestResult(file.name, 'passed', 'Expected modification found');
          } else {
            await this.addTestResult(file.name, 'failed', 'Expected modification not found');
          }
        } else {
          await this.addTestResult(file.name, 'failed', 'File not found');
        }
      } catch (error) {
        await this.addTestResult(file.name, 'failed', `Error reading file: ${error.message}`);
      }
    }
  }

  async testBackendAPIs() {
    console.log('\n🔗 Testing backend APIs...');

    const apiTests = [
      { url: `${this.backendUrl}/api/health`, name: 'Health Check' },
      { url: `${this.backendUrl}/api/customers`, name: 'Customers API' },
      { url: `${this.backendUrl}/api/geocode/60175-047`, name: 'Geocoding API' }
    ];

    for (const test of apiTests) {
      await this.testHttpRequest(test.url, test.name);
    }
  }

  async testFrontend() {
    console.log('\n🌐 Testing frontend...');
    const result = await this.testHttpRequest(this.frontendUrl, 'Frontend Loading');

    if (result.success && result.data) {
      // Check for React and Leaflet in HTML
      if (result.data.includes('root')) {
        await this.addTestResult('React Root Element', 'passed', 'React root div found');
      } else {
        await this.addTestResult('React Root Element', 'failed', 'React root div not found');
      }

      if (result.data.includes('leaflet') || result.data.includes('Leaflet')) {
        await this.addTestResult('Leaflet References', 'passed', 'Leaflet references found in HTML');
      } else {
        await this.addTestResult('Leaflet References', 'failed', 'No Leaflet references in HTML');
      }
    }
  }

  async analyzeRouteOptimizerCode() {
    console.log('\n🔍 Analyzing RouteOptimizer.jsx for polyline fixes...');

    try {
      const filePath = '/Users/rodrigooliveira/Documents/workspace 2/Claude-code/PLOMES-ROTA-CEP/frontend/src/components/RouteOptimizer.jsx';
      const content = fs.readFileSync(filePath, 'utf8');

      // Check for key polyline fixes
      const checks = [
        {
          name: 'Polyline Import',
          pattern: /import.*Polyline.*from.*react-leaflet/,
          description: 'Polyline component import'
        },
        {
          name: 'Red Polyline Color',
          pattern: /color="#FF0000"/,
          description: 'Red polyline color (#FF0000)'
        },
        {
          name: 'Polyline Weight',
          pattern: /weight={8}/,
          description: 'Polyline weight set to 8'
        },
        {
          name: 'Polyline Opacity',
          pattern: /opacity={0\.9}/,
          description: 'Polyline opacity set to 0.9'
        },
        {
          name: 'No Pane Props',
          pattern: /pane=/,
          description: 'Pane props removed (should not be found)',
          shouldNotFind: true
        },
        {
          name: 'Debug Test Polyline',
          pattern: /color="#00FF00"/,
          description: 'Green debug test polyline'
        },
        {
          name: 'Route Polyline Rendering Logic',
          pattern: /Route Polyline Rendering/,
          description: 'Polyline rendering section'
        }
      ];

      for (const check of checks) {
        const found = check.pattern.test(content);
        const expected = !check.shouldNotFind;

        if (found === expected) {
          await this.addTestResult(check.name, 'passed', check.description);
        } else {
          const status = check.shouldNotFind ? 'failed' : 'failed';
          await this.addTestResult(check.name, status, `${check.description} - ${found ? 'found' : 'not found'}`);
        }
      }

    } catch (error) {
      await this.addTestResult('Code Analysis', 'failed', `Error analyzing code: ${error.message}`);
    }
  }

  async generateReport() {
    console.log('\n📊 Generating test report...');

    const reportPath = path.join(__dirname, 'SIMPLE_POLYLINE_TEST_REPORT.md');
    const successRate = `${((this.results.summary.passed / this.results.summary.total) * 100).toFixed(1)}%`;

    let markdown = `# SIMPLE POLYLINE TEST REPORT\n\n`;
    markdown += `**Test Run:** ${this.results.timestamp}\n`;
    markdown += `**Frontend URL:** ${this.frontendUrl}\n`;
    markdown += `**Backend URL:** ${this.backendUrl}\n\n`;

    markdown += `## Summary\n\n`;
    markdown += `- **Total Tests:** ${this.results.summary.total}\n`;
    markdown += `- **Passed:** ${this.results.summary.passed} ✅\n`;
    markdown += `- **Failed:** ${this.results.summary.failed} ❌\n`;
    markdown += `- **Success Rate:** ${successRate}\n\n`;

    markdown += `## Test Results\n\n`;

    this.results.tests.forEach(test => {
      const emoji = test.status === 'passed' ? '✅' : '❌';
      markdown += `### ${emoji} ${test.testName}\n`;
      markdown += `**Details:** ${test.details}\n`;
      markdown += `**Time:** ${test.timestamp}\n\n`;
    });

    markdown += `## Analysis\n\n`;

    if (this.results.summary.failed === 0) {
      markdown += `✅ **ALL TESTS PASSED!** The polyline rendering fixes appear to be correctly implemented.\n\n`;
    } else {
      markdown += `❌ **${this.results.summary.failed} TESTS FAILED.** Review the failed tests above.\n\n`;
    }

    markdown += `## Manual Testing Required\n\n`;
    markdown += `To complete the validation:\n\n`;
    markdown += `1. Open ${this.frontendUrl} in a browser\n`;
    markdown += `2. Set an origin using CEP (e.g., 60175-047)\n`;
    markdown += `3. Load customers and select a few\n`;
    markdown += `4. Optimize route and check for visible red polylines\n`;
    markdown += `5. Check browser console for errors\n`;
    markdown += `6. Test PDF export functionality\n\n`;

    markdown += `---\n*Generated by Simple Polyline Test Suite*`;

    fs.writeFileSync(reportPath, markdown);
    console.log(`📄 Test report saved: ${reportPath}`);

    return { successRate, ...this.results.summary };
  }

  async runTests() {
    console.log('🚀 Starting Simple Polyline Test Suite...\n');

    try {
      await this.testFileModifications();
      await this.testBackendAPIs();
      await this.testFrontend();
      await this.analyzeRouteOptimizerCode();

      const summary = await this.generateReport();

      console.log('\n🏁 Test suite completed!');
      console.log(`📊 Results: ${summary.passed}/${summary.total} tests passed (${summary.successRate})`);

      return summary;

    } catch (error) {
      console.error('❌ Test suite failed:', error);
      throw error;
    }
  }
}

// Run tests if called directly
if (require.main === module) {
  const testSuite = new SimplePolylineTest();
  testSuite.runTests()
    .then(summary => {
      process.exit(summary.failed > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('Test suite crashed:', error);
      process.exit(1);
    });
}

module.exports = SimplePolylineTest;