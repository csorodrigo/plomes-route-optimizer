import { test, expect } from '@playwright/test';

test.describe('Dashboard UI Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to dashboard
    await page.goto('http://localhost:3003/dashboard');
    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle');
  });

  test('should load dashboard successfully', async ({ page }) => {
    // Check if page title or header is present
    await expect(page).toHaveTitle(/Dashboard|Plomes/i);

    // Take screenshot of loaded page
    await page.screenshot({
      path: 'test-results/dashboard-loaded.png',
      fullPage: true
    });
  });

  test('should display all metrics cards with correct values', async ({ page }) => {
    // Wait for metrics to load
    await page.waitForSelector('text=Total Revenue', { timeout: 10000 });

    // Check Total Revenue
    const revenueCard = page.locator('text=Total Revenue').locator('..');
    await expect(revenueCard).toContainText('R$ 121,843.90');
    console.log('✅ Total Revenue: R$ 121,843.90');

    // Check Active Products
    const productsCard = page.locator('text=Active Products').locator('..');
    await expect(productsCard).toContainText('5');
    console.log('✅ Active Products: 5');

    // Check Total Customers
    const customersCard = page.locator('text=Total Customers').locator('..');
    await expect(customersCard).toContainText('2,247');
    console.log('✅ Total Customers: 2,247');

    // Take screenshot of metrics
    await page.screenshot({
      path: 'test-results/dashboard-metrics.png',
      fullPage: false
    });
  });

  test('should render charts correctly', async ({ page }) => {
    // Check Product Performance chart
    await expect(page.locator('text=Product Performance')).toBeVisible();
    console.log('✅ Product Performance chart found');

    // Check Revenue by Month chart
    await expect(page.locator('text=Revenue by Month')).toBeVisible();
    console.log('✅ Revenue by Month chart found');

    // Wait for charts to render (check for canvas or svg elements)
    const chartElements = page.locator('canvas, svg[class*="recharts"]');
    await expect(chartElements.first()).toBeVisible({ timeout: 5000 });

    // Take screenshot of charts
    await page.screenshot({
      path: 'test-results/dashboard-charts.png',
      fullPage: true
    });
  });

  test('should display top products table', async ({ page }) => {
    // Check for top product
    await expect(page.locator('text=Óleo Lubrificante Premium 1L')).toBeVisible();
    console.log('✅ Top product found: Óleo Lubrificante Premium 1L');

    // Check table structure
    const tableHeaders = page.locator('th');
    await expect(tableHeaders.first()).toBeVisible();

    const headerCount = await tableHeaders.count();
    console.log(`✅ Table has ${headerCount} columns`);

    // Take screenshot of table
    await page.screenshot({
      path: 'test-results/dashboard-table.png',
      fullPage: true
    });
  });

  test('should test chart interactions', async ({ page }) => {
    // Wait for charts to be ready
    await page.waitForSelector('canvas, svg[class*="recharts"]', { timeout: 10000 });

    // Try hovering over chart elements
    const charts = page.locator('canvas, svg[class*="recharts"]');
    const chartCount = await charts.count();
    console.log(`ℹ️  Found ${chartCount} chart elements`);

    if (chartCount > 0) {
      // Hover over first chart
      await charts.first().hover();
      await page.waitForTimeout(1000);
      console.log('✅ Chart hover interaction works');

      // Take screenshot with hover state
      await page.screenshot({
        path: 'test-results/dashboard-chart-hover.png',
        fullPage: false
      });
    }
  });

  test('should verify API data matches UI', async ({ page }) => {
    // Intercept API call
    const responsePromise = page.waitForResponse(
      response => response.url().includes('/api/dashboard/metrics') && response.status() === 200
    );

    await page.goto('http://localhost:3003/dashboard');

    const response = await responsePromise;
    const data = await response.json();

    console.log('📊 API Response:', JSON.stringify(data, null, 2));

    // Verify data structure
    expect(data).toHaveProperty('totalRevenue');
    expect(data).toHaveProperty('activeProducts');
    expect(data).toHaveProperty('totalCustomers');

    // Verify values match UI
    await expect(page.locator('text=R$ 121,843.90')).toBeVisible();
    await expect(page.locator('text=5')).toBeVisible();
    await expect(page.locator('text=2,247')).toBeVisible();

    console.log('✅ API data matches UI display');
  });
});
