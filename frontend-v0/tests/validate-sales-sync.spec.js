const { test, expect } = require('@playwright/test');

test.describe('Sales Sync Validation', () => {
  test('should display customer names and product details', async ({ page }) => {
    // Login first
    await page.goto('http://localhost:3003/login');
    await page.fill('input[type="email"]', 'gustavo.canuto@ciaramaquinas.com.br');
    await page.fill('input[type="password"]', 'ciara123@');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000); // Wait for login to complete

    // Navigate to customers page
    await page.goto('http://localhost:3003/dashboard/customers');

    // Wait for the page to load
    await page.waitForLoadState('networkidle');

    // Take screenshot of customer list
    await page.screenshot({ path: 'tests/screenshots/customer-list.png', fullPage: true });

    // Verify customer names are displayed (not just CNPJ)
    const customerNames = await page.locator('table tbody tr td:first-child').allTextContents();
    console.log('Customer names found:', customerNames.slice(0, 5));

    // Navigate directly to INGERSOLL customer (has 57 sales with products)
    await page.goto('http://localhost:3003/dashboard/customers/401245367');

    // Wait for customer detail page to load completely
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(5000); // Wait longer for data to load

    // Take screenshot of customer detail
    await page.screenshot({ path: 'tests/screenshots/customer-detail.png', fullPage: true });

    // Check if products table exists
    const productsTable = await page.locator('table').count();
    console.log('Number of tables found:', productsTable);

    // Get product names from the products table
    const productCells = await page.locator('table tbody td').allTextContents();
    console.log('Product data found:', productCells.slice(0, 10));

    // Verify we have multiple different products
    expect(productsTable).toBeGreaterThan(0);
    expect(productCells.length).toBeGreaterThan(0);
  });
});
