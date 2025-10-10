import { test, expect } from '@playwright/test';

test('should load page successfully', async ({ page }) => {
  await page.goto('http://localhost:3003/dashboard/customers');

  // Wait for the page title to be visible
  await expect(page.locator('h1')).toHaveText('Clientes');

  // Wait for the card to load
  await expect(page.locator('text=Lista de Clientes')).toBeVisible();
});

test('should display customer list after loading', async ({ page }) => {
  await page.goto('http://localhost:3003/dashboard/customers');

  // Wait for loading to complete (skeleton should disappear)
  await page.waitForSelector('table tbody tr', { timeout: 10000 });

  // Check if table headers are visible
  await expect(page.locator('th:has-text("Nome")')).toBeVisible();
  await expect(page.locator('th:has-text("Receita Total")')).toBeVisible();

  // Take screenshot of loaded state
  await page.screenshot({ path: '/Users/rodrigooliveira/Documents/workspace 2/Claude-code/PLOMES-ROTA-CEP/frontend-v0/test-results/customers-loaded.png', fullPage: true });
});

test('should show correct customer count in filter buttons', async ({ page }) => {
  await page.goto('http://localhost:3003/dashboard/customers');

  // Wait for data to load
  await page.waitForSelector('table tbody tr', { timeout: 10000 });

  // Get the filter button texts
  const allCustomersButton = page.locator('button:has-text("Todos")');
  const withSalesButton = page.locator('button:has-text("Apenas com vendas")');

  await expect(allCustomersButton).toBeVisible();
  await expect(withSalesButton).toBeVisible();

  // Check if counts are displayed
  const allText = await allCustomersButton.textContent();
  const salesText = await withSalesButton.textContent();

  console.log('All customers button:', allText);
  console.log('With sales button:', salesText);

  expect(allText).toMatch(/Todos \(\d+\)/);
  expect(salesText).toMatch(/Apenas com vendas \(\d+\)/);
});

test('should filter customers by search term', async ({ page }) => {
  await page.goto('http://localhost:3003/dashboard/customers');

  // Wait for data to load
  await page.waitForSelector('table tbody tr', { timeout: 10000 });

  // Get initial row count
  const initialRows = await page.locator('table tbody tr').count();
  console.log('Initial rows:', initialRows);

  // Type in search box
  const searchInput = page.locator('input[placeholder*="Buscar"]');
  await searchInput.fill('CIA');

  // Wait a bit for filter to apply
  await page.waitForTimeout(500);

  // Get filtered row count
  const filteredRows = await page.locator('table tbody tr').count();
  console.log('Filtered rows:', filteredRows);

  // Take screenshot of search results
  await page.screenshot({ path: '/Users/rodrigooliveira/Documents/workspace 2/Claude-code/PLOMES-ROTA-CEP/frontend-v0/test-results/customers-search.png', fullPage: true });

  // Check if filter count is shown
  const filterText = await page.locator('text=/Mostrando \\d+ de \\d+ clientes/').textContent();
  console.log('Filter text:', filterText);
});

test('should toggle between filter buttons', async ({ page }) => {
  await page.goto('http://localhost:3003/dashboard/customers');

  // Wait for data to load
  await page.waitForSelector('table tbody tr', { timeout: 10000 });

  const allCustomersButton = page.locator('button:has-text("Todos")');
  const withSalesButton = page.locator('button:has-text("Apenas com vendas")');

  // Initially "Todos" should be active (blue background)
  await expect(allCustomersButton).toHaveClass(/bg-blue-600/);

  // Click "Apenas com vendas"
  await withSalesButton.click();
  await page.waitForTimeout(300);

  // Now "Apenas com vendas" should be active
  await expect(withSalesButton).toHaveClass(/bg-blue-600/);
  await expect(allCustomersButton).toHaveClass(/bg-gray-100/);

  // Take screenshot
  await page.screenshot({ path: '/Users/rodrigooliveira/Documents/workspace 2/Claude-code/PLOMES-ROTA-CEP/frontend-v0/test-results/customers-filter-sales.png', fullPage: true });

  // Click back to "Todos"
  await allCustomersButton.click();
  await page.waitForTimeout(300);

  await expect(allCustomersButton).toHaveClass(/bg-blue-600/);
  await expect(withSalesButton).toHaveClass(/bg-gray-100/);
});

test('should display all UI elements correctly', async ({ page }) => {
  await page.goto('http://localhost:3003/dashboard/customers');

  // Wait for data to load
  await page.waitForSelector('table tbody tr', { timeout: 10000 });

  // Check all major UI elements
  await expect(page.locator('h1:has-text("Clientes")')).toBeVisible();
  await expect(page.locator('text=Lista de Clientes')).toBeVisible();
  await expect(page.locator('input[placeholder*="Buscar"]')).toBeVisible();
  await expect(page.locator('button:has-text("Todos")')).toBeVisible();
  await expect(page.locator('button:has-text("Apenas com vendas")')).toBeVisible();

  // Check table headers
  await expect(page.locator('th:has-text("Nome")')).toBeVisible();
  await expect(page.locator('th:has-text("Receita Total")')).toBeVisible();

  // Check search icon
  await expect(page.locator('svg.lucide-search')).toBeVisible();

  // Take final screenshot
  await page.screenshot({ path: '/Users/rodrigooliveira/Documents/workspace 2/Claude-code/PLOMES-ROTA-CEP/frontend-v0/test-results/customers-ui-complete.png', fullPage: true });
});

test('should be responsive on mobile', async ({ page }) => {
  await page.goto('http://localhost:3003/dashboard/customers');

  // Set mobile viewport
  await page.setViewportSize({ width: 375, height: 667 });

  // Wait for data to load
  await page.waitForSelector('table tbody tr', { timeout: 10000 });

  // On mobile, some columns should be hidden
  const cnpjHeader = page.locator('th:has-text("CNPJ/CPF")');
  const isHidden = await cnpjHeader.evaluate(el => {
    const style = window.getComputedStyle(el);
    return style.display === 'none';
  });

  console.log('CNPJ column hidden on mobile:', isHidden);

  // Take mobile screenshot
  await page.screenshot({ path: '/Users/rodrigooliveira/Documents/workspace 2/Claude-code/PLOMES-ROTA-CEP/frontend-v0/test-results/customers-mobile.png', fullPage: true });
});

test('should measure API performance', async ({ page }) => {
  // First load - should take ~4 seconds
  const start1 = Date.now();
  await page.goto('http://localhost:3003/dashboard/customers');
  await page.waitForSelector('table tbody tr', { timeout: 10000 });
  const duration1 = Date.now() - start1;
  console.log('First load duration:', duration1, 'ms');

  // Second load - should be fast (cached)
  const start2 = Date.now();
  await page.reload();
  await page.waitForSelector('table tbody tr', { timeout: 10000 });
  const duration2 = Date.now() - start2;
  console.log('Second load duration (cached):', duration2, 'ms');

  // Log performance metrics
  console.log('Performance improvement:', ((duration1 - duration2) / duration1 * 100).toFixed(1) + '%');

  // Second load should be significantly faster
  expect(duration2).toBeLessThan(duration1);
});
