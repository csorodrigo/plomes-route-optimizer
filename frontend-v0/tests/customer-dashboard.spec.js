const { test, expect } = require('@playwright/test');

test.describe('Customer Dashboard Tests', () => {
  test('should load customer dashboard and test functionality', async ({ page }) => {
    const testResults = {
      navigation: null,
      pageLoad: null,
      errors: [],
      searchFunctionality: null,
      searchTests: [],
      screenshots: []
    };

    try {
      // Navigate to the customer dashboard
      console.log('🔍 Navigating to customer dashboard...');
      await page.goto('http://localhost:3003/dashboard/cliente', {
        waitUntil: 'networkidle',
        timeout: 30000
      });
      testResults.navigation = 'SUCCESS';
      console.log('✅ Navigation successful');

      // Take initial screenshot
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const screenshotPath = `test-results/dashboard-${timestamp}.png`;
      await page.screenshot({
        path: screenshotPath,
        fullPage: true
      });
      testResults.screenshots.push(screenshotPath);
      console.log(`📸 Screenshot saved: ${screenshotPath}`);

      // Check for JavaScript errors
      page.on('console', msg => {
        if (msg.type() === 'error') {
          testResults.errors.push(`Console error: ${msg.text()}`);
          console.log(`❌ Console error: ${msg.text()}`);
        }
      });

      page.on('pageerror', error => {
        testResults.errors.push(`Page error: ${error.message}`);
        console.log(`❌ Page error: ${error.message}`);
      });

      // Wait for page to be fully loaded
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(3000); // Allow time for any async operations

      // Check if page loaded successfully
      const title = await page.title();
      console.log(`📄 Page title: ${title}`);

      // Verify basic page elements
      const bodyContent = await page.textContent('body');
      if (bodyContent && bodyContent.trim().length > 0) {
        testResults.pageLoad = 'SUCCESS';
        console.log('✅ Page loaded with content');
      } else {
        testResults.pageLoad = 'FAILED - No content';
        testResults.errors.push('Page has no visible content');
      }

      // Look for search functionality
      console.log('🔍 Looking for search functionality...');

      // Try different possible search selectors
      const searchSelectors = [
        'input[placeholder*="Digite o nome ou código do cliente" i]',
        'input[placeholder*="cliente" i]',
        'input[type="search"]',
        'input[placeholder*="search" i]',
        'input[placeholder*="buscar" i]',
        'input[placeholder*="pesquisar" i]',
        '.search-input',
        '#search',
        '[data-testid="search"]',
        'input[name="search"]',
        'input[type="text"]'
      ];

      let searchInput = null;
      for (const selector of searchSelectors) {
        try {
          const element = await page.$(selector);
          if (element) {
            searchInput = element;
            console.log(`✅ Found search input with selector: ${selector}`);
            break;
          }
        } catch (e) {
          // Continue to next selector
        }
      }

      if (searchInput) {
        testResults.searchFunctionality = 'FOUND';

        // Test search with "CIARA"
        console.log('🔍 Testing search with "CIARA"...');
        await searchInput.fill('CIARA');
        await page.waitForTimeout(2000); // Wait for any filtering/results

        // Take screenshot after search
        const searchScreenshot1 = `test-results/search-ciara-${timestamp}.png`;
        await page.screenshot({
          path: searchScreenshot1,
          fullPage: true
        });
        testResults.screenshots.push(searchScreenshot1);

        // Check for results
        const pageContentAfterSearch1 = await page.textContent('body');
        const hasResults1 = pageContentAfterSearch1.toLowerCase().includes('ciara');
        testResults.searchTests.push({
          term: 'CIARA',
          hasResults: hasResults1,
          screenshot: searchScreenshot1
        });
        console.log(`📊 Search for "CIARA" - Results found: ${hasResults1}`);

        // Clear and test search with "CIA MAQUINAS"
        await searchInput.fill('');
        await page.waitForTimeout(1000);

        console.log('🔍 Testing search with "CIA MAQUINAS"...');
        await searchInput.fill('CIA MAQUINAS');
        await page.waitForTimeout(2000);

        // Take screenshot after second search
        const searchScreenshot2 = `test-results/search-cia-maquinas-${timestamp}.png`;
        await page.screenshot({
          path: searchScreenshot2,
          fullPage: true
        });
        testResults.screenshots.push(searchScreenshot2);

        // Check for results
        const pageContentAfterSearch2 = await page.textContent('body');
        const hasResults2 = pageContentAfterSearch2.toLowerCase().includes('cia') ||
                           pageContentAfterSearch2.toLowerCase().includes('maquinas');
        testResults.searchTests.push({
          term: 'CIA MAQUINAS',
          hasResults: hasResults2,
          screenshot: searchScreenshot2
        });
        console.log(`📊 Search for "CIA MAQUINAS" - Results found: ${hasResults2}`);

      } else {
        testResults.searchFunctionality = 'NOT_FOUND';
        console.log('❌ No search input found on the page');

        // Let's check what elements are actually on the page
        const allInputs = await page.$$eval('input', inputs =>
          inputs.map(input => ({
            type: input.type,
            placeholder: input.placeholder,
            name: input.name,
            id: input.id,
            className: input.className
          }))
        );
        console.log('📝 All input elements found:', allInputs);
      }

      // Final summary screenshot
      const finalScreenshot = `test-results/dashboard-final-${timestamp}.png`;
      await page.screenshot({
        path: finalScreenshot,
        fullPage: true
      });
      testResults.screenshots.push(finalScreenshot);

    } catch (error) {
      testResults.errors.push(`Test execution error: ${error.message}`);
      console.log(`❌ Test execution error: ${error.message}`);
    }

    // Generate test report
    console.log('\n📋 TEST RESULTS SUMMARY:');
    console.log('='.repeat(50));
    console.log(`Navigation: ${testResults.navigation || 'FAILED'}`);
    console.log(`Page Load: ${testResults.pageLoad || 'FAILED'}`);
    console.log(`Search Functionality: ${testResults.searchFunctionality || 'NOT_TESTED'}`);
    console.log(`Errors Found: ${testResults.errors.length}`);

    if (testResults.errors.length > 0) {
      console.log('\n❌ ERRORS:');
      testResults.errors.forEach((error, index) => {
        console.log(`${index + 1}. ${error}`);
      });
    }

    if (testResults.searchTests.length > 0) {
      console.log('\n🔍 SEARCH TESTS:');
      testResults.searchTests.forEach(test => {
        console.log(`- "${test.term}": ${test.hasResults ? 'Results found' : 'No results'}`);
      });
    }

    console.log('\n📸 SCREENSHOTS:');
    testResults.screenshots.forEach(screenshot => {
      console.log(`- ${screenshot}`);
    });

    // Write detailed report to file
    const reportTimestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportContent = JSON.stringify(testResults, null, 2);
    require('fs').writeFileSync(`test-results/dashboard-test-report-${reportTimestamp}.json`, reportContent);
    console.log(`\n📄 Detailed report saved: test-results/dashboard-test-report-${reportTimestamp}.json`);

    // Basic assertions for test framework
    expect(testResults.navigation).toBe('SUCCESS');
    expect(testResults.pageLoad).toBe('SUCCESS');
  });
});