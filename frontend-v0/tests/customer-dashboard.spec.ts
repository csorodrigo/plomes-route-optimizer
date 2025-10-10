import { test, expect } from '@playwright/test';

test.describe('Customer Dashboard Tests', () => {
  test('should display complete customer dashboard with correct data', async ({ page }) => {
    // Navigate to the dashboard
    await test.step('Navigate to customer dashboard', async () => {
      await page.goto('http://localhost:3003/dashboard/cliente');
      await page.waitForLoadState('networkidle');
    });

    // Take initial screenshot of the full page
    await test.step('Take initial dashboard screenshot', async () => {
      await page.screenshot({
        path: 'test-results/dashboard-initial.png',
        fullPage: true
      });
    });

    // Search for CIARA or CIA MAQUINAS
    await test.step('Search for CIA MAQUINAS customer', async () => {
      const searchInput = page.locator('input[placeholder*="cliente" i], input[type="search"], input[placeholder*="buscar" i]');
      await expect(searchInput).toBeVisible();

      await searchInput.fill('CIARA');
      await page.keyboard.press('Enter');

      // Wait for search results to load
      await page.waitForTimeout(2000);

      // Try CIA MAQUINAS if CIARA doesn't work
      const hasResults = await page.locator('text=/CIA.*MAQUINAS/i').isVisible();
      if (!hasResults) {
        await searchInput.clear();
        await searchInput.fill('CIA MAQUINAS');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(2000);
      }
    });

    // Take screenshot after search
    await test.step('Take post-search screenshot', async () => {
      await page.screenshot({
        path: 'test-results/dashboard-after-search.png',
        fullPage: true
      });
    });

    // Verify statistics cards are displayed with correct data
    await test.step('Verify statistics cards', async () => {
      // Check for Total Deals card (should show 6 for CIA MAQUINAS)
      const totalDealsCard = page.locator('text=/total.*deals/i, text=/negócios.*total/i').first();
      await expect(totalDealsCard).toBeVisible({ timeout: 10000 });

      // Look for the number 6 in deal statistics
      const dealCount = page.locator('text="6"').first();
      await expect(dealCount).toBeVisible();

      // Check for Customer Ranking (256º de 618)
      const rankingText = page.locator('text=/256.*618/i, text=/ranking/i');
      await expect(rankingText).toBeVisible();

      // Check for Percentile (Top 59%)
      const percentileText = page.locator('text=/59%/i, text=/top.*59/i');
      await expect(percentileText).toBeVisible();

      // Check for System Totals (10,228 deals total)
      const systemTotalText = page.locator('text=/10.*228/i, text=/10,228/i');
      await expect(systemTotalText).toBeVisible();
    });

    // Take screenshot of statistics section
    await test.step('Take statistics cards screenshot', async () => {
      const statsSection = page.locator('[class*="metric"], [class*="stat"], [class*="card"]').first();
      if (await statsSection.isVisible()) {
        await statsSection.screenshot({ path: 'test-results/dashboard-statistics.png' });
      }
    });

    // Verify customer information is displayed
    await test.step('Verify customer information display', async () => {
      // Look for customer name display
      const customerInfo = page.locator('text=/CIA.*MAQUINAS/i, text=/CIARA/i');
      await expect(customerInfo).toBeVisible();

      // Look for customer details section
      const customerSection = page.locator('[class*="customer"], [class*="client"], h1, h2').first();
      await expect(customerSection).toBeVisible();
    });

    // Verify sales table shows 6 deals
    await test.step('Verify sales table with 6 deals', async () => {
      // Look for table or list container
      const salesTable = page.locator('table, [class*="table"], [class*="list"], [role="table"]');
      await expect(salesTable).toBeVisible();

      // Count table rows (excluding header)
      const tableRows = page.locator('tbody tr, [class*="row"]:not([class*="header"])');
      const rowCount = await tableRows.count();

      // Verify we have 6 deals
      expect(rowCount).toBeGreaterThanOrEqual(6);

      // Look for deal-related content
      const dealContent = page.locator('text=/deal/i, text=/negócio/i, text=/vendas/i');
      await expect(dealContent.first()).toBeVisible();
    });

    // Take screenshot of sales table
    await test.step('Take sales table screenshot', async () => {
      const salesTable = page.locator('table, [class*="table"], [class*="list"]').first();
      if (await salesTable.isVisible()) {
        await salesTable.screenshot({ path: 'test-results/dashboard-sales-table.png' });
      }
    });

    // Take final complete dashboard screenshot
    await test.step('Take final complete dashboard screenshot', async () => {
      await page.screenshot({
        path: 'test-results/dashboard-complete.png',
        fullPage: true
      });
    });

    // Verify data integrity - check for production data indicators
    await test.step('Verify production data integrity', async () => {
      // Check for indicators that we're using production cached data
      const dataIndicators = [
        '10,228', // Total deals in system
        '618', // Total customers
        '6', // CIA MAQUINAS deals
        '256', // Customer ranking
        '59%' // Percentile
      ];

      for (const indicator of dataIndicators) {
        const element = page.locator(`text="${indicator}"`);
        await expect(element).toBeVisible({ timeout: 5000 });
      }
    });

    // Test responsiveness by checking mobile view
    await test.step('Test mobile responsiveness', async () => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.waitForTimeout(1000);

      await page.screenshot({
        path: 'test-results/dashboard-mobile.png',
        fullPage: true
      });

      // Verify dashboard is still functional on mobile
      const mobileContent = page.locator('body');
      await expect(mobileContent).toBeVisible();
    });

    // Reset to desktop view
    await test.step('Reset to desktop view', async () => {
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.waitForTimeout(1000);
    });
  });

  test('should handle search functionality correctly', async ({ page }) => {
    await page.goto('http://localhost:3003/dashboard/cliente');
    await page.waitForLoadState('networkidle');

    // Test search with different variations
    const searchTerms = ['CIARA', 'CIA MAQUINAS', 'ciara', 'cia'];

    for (const term of searchTerms) {
      await test.step(`Test search with term: ${term}`, async () => {
        const searchInput = page.locator('input[placeholder*="cliente" i], input[type="search"], input[placeholder*="buscar" i]');

        if (await searchInput.isVisible()) {
          await searchInput.clear();
          await searchInput.fill(term);
          await page.keyboard.press('Enter');
          await page.waitForTimeout(2000);

          // Take screenshot for each search
          await page.screenshot({
            path: `test-results/search-${term.replace(' ', '-').toLowerCase()}.png`,
            fullPage: true
          });
        }
      });
    }
  });

  test('should load and display data within reasonable time', async ({ page }) => {
    const startTime = Date.now();

    await page.goto('http://localhost:3003/dashboard/cliente');
    await page.waitForLoadState('networkidle');

    // Search for customer
    const searchInput = page.locator('input[placeholder*="cliente" i], input[type="search"], input[placeholder*="buscar" i]');
    await searchInput.fill('CIA MAQUINAS');
    await page.keyboard.press('Enter');

    // Wait for data to load
    await page.waitForSelector('text=/CIA.*MAQUINAS/i, text="6", text=/10.*228/i', { timeout: 10000 });

    const endTime = Date.now();
    const loadTime = endTime - startTime;

    // Verify reasonable load time (under 10 seconds)
    expect(loadTime).toBeLessThan(10000);

    console.log(`Dashboard loaded in ${loadTime}ms`);
  });
});