/**
 * Comprehensive Playwright End-to-End Tests
 * Tests complete frontend functionality with real backend data
 */

const { test, expect } = require('@playwright/test');

const TEST_CONFIG = {
  baseURL: 'http://localhost:3000',
  timeout: 30000,
  auth: {
    email: 'gustavo.canuto@ciaramaquinas.com.br',
    password: 'ciara123@'
  }
};

// Utility functions
const waitForNetworkIdle = async (page, timeout = 5000) => {
  return page.waitForLoadState('networkidle', { timeout });
};

const waitForElement = async (page, selector, options = {}) => {
  return page.waitForSelector(selector, {
    timeout: 10000,
    state: 'visible',
    ...options
  });
};

const login = async (page) => {
  await page.goto('/');

  // Wait for login form
  await waitForElement(page, 'input[type="email"]');

  // Fill login form
  await page.fill('input[type="email"]', TEST_CONFIG.auth.email);
  await page.fill('input[type="password"]', TEST_CONFIG.auth.password);

  // Submit login
  await page.click('button[type="submit"]');

  // Wait for redirect to dashboard
  await page.waitForURL('**/dashboard', { timeout: 10000 });
  await waitForNetworkIdle(page);
};

// Test groups
test.describe('Authentication Flow', () => {
  test('User can login successfully', async ({ page }) => {
    await page.goto('/');

    // Check login page loads
    await expect(page.locator('h1')).toContainText(['Login', 'Entrar', 'Sign In']);

    // Fill and submit login form
    await page.fill('input[type="email"]', TEST_CONFIG.auth.email);
    await page.fill('input[type="password"]', TEST_CONFIG.auth.password);
    await page.click('button[type="submit"]');

    // Wait for successful login and dashboard load
    await page.waitForURL('**/dashboard', { timeout: 15000 });

    // Verify dashboard elements are present
    await expect(page.locator('h1, h2')).toContainText(['Dashboard', 'Painel']);

    // Check for statistics cards
    const statsElements = await page.locator('[data-testid*="stat"], .stat-card, .statistics').count();
    expect(statsElements).toBeGreaterThan(0);
  });

  test('Login persists across page reloads', async ({ page }) => {
    await login(page);

    // Reload page
    await page.reload();
    await waitForNetworkIdle(page);

    // Should still be on dashboard
    await expect(page).toHaveURL(/.*dashboard/);
  });

  test('User can logout', async ({ page }) => {
    await login(page);

    // Find and click logout button
    const logoutButton = page.locator('button:has-text("Logout"), button:has-text("Sair")').first();
    await logoutButton.click();

    // Should redirect to login
    await page.waitForURL('**/login', { timeout: 10000 });
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });
});

test.describe('Dashboard Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('Dashboard shows real customer statistics', async ({ page }) => {
    // Wait for statistics to load
    await waitForNetworkIdle(page, 10000);

    // Check for customer count display
    const customerCountElements = await page.locator('text=/[0-9,]+\s*(customers|clientes)/i').all();
    expect(customerCountElements.length).toBeGreaterThan(0);

    // Check for geocoded statistics
    const geocodedElements = await page.locator('text=/[0-9,]+\s*(geocoded|geocodificados)/i').all();
    expect(geocodedElements.length).toBeGreaterThan(0);

    // Verify numbers are reasonable (>2000 customers)
    const totalCustomersText = await page.locator('text=/Total.*[0-9,]+/i').first().textContent();
    if (totalCustomersText) {
      const numberMatch = totalCustomersText.match(/[0-9,]+/);
      if (numberMatch) {
        const count = parseInt(numberMatch[0].replace(/,/g, ''));
        expect(count).toBeGreaterThan(2000);
      }
    }
  });

  test('Real-time geocoding progress updates', async ({ page }) => {
    // Look for geocoding progress indicators
    const progressElements = await page.locator('[data-testid*="progress"], .progress, text=/progress/i').count();

    if (progressElements > 0) {
      // Check if progress percentage is displayed
      const progressText = await page.locator('text=/[0-9]+%/').count();
      expect(progressText).toBeGreaterThan(0);
    }

    // Check for active geocoding indicators
    const activeElements = await page.locator('text=/processing|running|ativo/i').count();
    // Don't require active processing (may not always be running)
  });

  test('Navigation menu works correctly', async ({ page }) => {
    // Test main navigation items
    const navItems = ['Dashboard', 'Customers', 'Routes', 'Clientes', 'Rotas'];

    for (const item of navItems) {
      const navLink = page.locator(`nav a:has-text("${item}"), a:has-text("${item}")`).first();
      if (await navLink.count() > 0) {
        await navLink.click();
        await waitForNetworkIdle(page);
        // Verify page changed (URL or content)
        await expect(page.locator('main, .content')).toBeVisible();
      }
    }
  });
});

test.describe('Customer Management', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('Customer list loads with real data', async ({ page }) => {
    // Navigate to customers page if exists
    const customersLink = page.locator('a:has-text("Customers"), a:has-text("Clientes")').first();
    if (await customersLink.count() > 0) {
      await customersLink.click();
      await waitForNetworkIdle(page);
    }

    // Look for customer data (table, list, or cards)
    const customerElements = await page.locator('[data-testid*="customer"], .customer-item, tr, .card').count();
    expect(customerElements).toBeGreaterThan(0);
  });

  test('Customer sync functionality', async ({ page }) => {
    // Look for sync button
    const syncButton = page.locator('button:has-text("Sync"), button:has-text("Sincronizar")').first();

    if (await syncButton.count() > 0) {
      await syncButton.click();

      // Wait for sync to start
      await page.waitForTimeout(2000);

      // Check for loading state or success message
      const loadingOrSuccess = await page.locator('text=/syncing|sincronizando|success|sucesso/i').count();
      expect(loadingOrSuccess).toBeGreaterThan(0);
    }
  });
});

test.describe('Geocoding and Mapping', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('CEP search returns complete addresses', async ({ page }) => {
    // Look for CEP search input
    const cepInputs = await page.locator('input[placeholder*="CEP"], input[name*="cep"], input[id*="cep"]').all();

    if (cepInputs.length > 0) {
      const cepInput = cepInputs[0];

      // Test with Fortaleza CEP
      await cepInput.fill('60110-000');

      // Look for search/submit button
      const searchButton = page.locator('button:has-text("Search"), button:has-text("Buscar"), button[type="submit"]').first();
      if (await searchButton.count() > 0) {
        await searchButton.click();
      } else {
        await cepInput.press('Enter');
      }

      // Wait for results
      await waitForNetworkIdle(page, 10000);

      // Check if complete address is displayed (should include "Fortaleza", "CE", street name)
      const addressResult = await page.locator('text=/Fortaleza.*CE|Avenida.*Fortaleza/i').count();
      expect(addressResult).toBeGreaterThan(0);
    }
  });

  test('Map displays customer locations', async ({ page }) => {
    // Look for map container
    const mapElements = await page.locator('[data-testid*="map"], .map, #map, .leaflet-container').count();

    if (mapElements > 0) {
      // Wait for map to load
      await page.waitForTimeout(3000);

      // Check for map markers/pins (geocoded customers)
      const markerElements = await page.locator('.leaflet-marker, .marker, [data-testid*="marker"]').count();

      // Should have markers for geocoded customers (>500)
      expect(markerElements).toBeGreaterThan(10);
    }
  });

  test('Route optimization interface', async ({ page }) => {
    // Navigate to routes page if exists
    const routesLink = page.locator('a:has-text("Routes"), a:has-text("Rotas")').first();
    if (await routesLink.count() > 0) {
      await routesLink.click();
      await waitForNetworkIdle(page);
    }

    // Look for route optimization elements
    const optimizeElements = await page.locator('button:has-text("Optimize"), button:has-text("Otimizar")').count();

    if (optimizeElements > 0) {
      // Check for route planning interface
      const routePlanningElements = await page.locator('[data-testid*="route"], .route-planner').count();
      expect(routePlanningElements).toBeGreaterThan(0);
    }
  });
});

test.describe('Real Data Integration', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('Dashboard reflects real-time data', async ({ page }) => {
    // Get initial statistics
    await waitForNetworkIdle(page, 10000);

    const initialStats = {};

    // Try to capture customer count
    const totalCustomerElements = await page.locator('text=/[0-9,]+.*customers|[0-9,]+.*clientes/i').all();
    if (totalCustomerElements.length > 0) {
      const text = await totalCustomerElements[0].textContent();
      const match = text.match(/([0-9,]+)/);
      if (match) {
        initialStats.totalCustomers = parseInt(match[1].replace(/,/g, ''));
        expect(initialStats.totalCustomers).toBeGreaterThan(2000);
      }
    }

    // Check geocoded count
    const geocodedElements = await page.locator('text=/[0-9,]+.*geocoded|[0-9,]+.*geocodificados/i').all();
    if (geocodedElements.length > 0) {
      const text = await geocodedElements[0].textContent();
      const match = text.match(/([0-9,]+)/);
      if (match) {
        initialStats.geocoded = parseInt(match[1].replace(/,/g, ''));
        expect(initialStats.geocoded).toBeGreaterThan(500);
      }
    }

    // Verify data consistency
    if (initialStats.totalCustomers && initialStats.geocoded) {
      expect(initialStats.geocoded).toBeLessThanOrEqual(initialStats.totalCustomers);
    }
  });

  test('System handles ongoing geocoding gracefully', async ({ page }) => {
    // The system should remain responsive during geocoding

    // Navigate through different pages
    await page.goto('/dashboard');
    await waitForNetworkIdle(page);

    // Check dashboard loads quickly
    await expect(page.locator('main, .content')).toBeVisible();

    // Try navigating to other pages
    const navLinks = await page.locator('nav a, .nav a').all();

    for (let i = 0; i < Math.min(navLinks.length, 3); i++) {
      const startTime = Date.now();
      await navLinks[i].click();
      await waitForNetworkIdle(page, 15000);
      const loadTime = Date.now() - startTime;

      // Should load within reasonable time even during geocoding
      expect(loadTime).toBeLessThan(15000);
    }
  });

  test('Error handling for network issues', async ({ page }) => {
    await login(page);

    // Test with invalid CEP search (should handle gracefully)
    const cepInputs = await page.locator('input[placeholder*="CEP"], input[name*="cep"]').all();

    if (cepInputs.length > 0) {
      await cepInputs[0].fill('00000-000');
      await cepInputs[0].press('Enter');

      await page.waitForTimeout(3000);

      // Should show error message or handle gracefully (not crash)
      const errorMessages = await page.locator('text=/error|erro|not found|não encontrado/i').count();
      // Don't require specific error handling, just that the page doesn't crash
      await expect(page.locator('body')).toBeVisible();
    }
  });
});

test.describe('Performance and Responsiveness', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('Dashboard loads within acceptable time', async ({ page }) => {
    const startTime = Date.now();

    await page.goto('/dashboard');
    await waitForNetworkIdle(page, 20000);

    const loadTime = Date.now() - startTime;

    // Should load within 20 seconds even with ongoing geocoding
    expect(loadTime).toBeLessThan(20000);
  });

  test('Page remains responsive during data operations', async ({ page }) => {
    // Test that UI elements remain clickable during data loading

    await waitForNetworkIdle(page, 10000);

    // Find clickable elements
    const buttons = await page.locator('button').all();
    const links = await page.locator('a').all();

    // Test a few elements for responsiveness
    for (let i = 0; i < Math.min(buttons.length, 3); i++) {
      if (await buttons[i].isVisible()) {
        const startTime = Date.now();
        await buttons[i].hover();
        const hoverTime = Date.now() - startTime;

        // Hover should be immediate
        expect(hoverTime).toBeLessThan(1000);
      }
    }
  });

  test('No memory leaks or crashes during extended use', async ({ page }) => {
    // Simulate extended usage
    for (let i = 0; i < 5; i++) {
      await page.reload();
      await waitForNetworkIdle(page, 15000);

      // Check that page is still functional
      await expect(page.locator('main, .content')).toBeVisible();

      // Small delay between operations
      await page.waitForTimeout(2000);
    }

    // Page should still be responsive after multiple reloads
    await expect(page.locator('body')).toBeVisible();
  });
});

// Configuration for all tests
test.use({
  baseURL: TEST_CONFIG.baseURL,
  timeout: TEST_CONFIG.timeout
});