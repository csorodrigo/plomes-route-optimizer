import { test, expect } from '@playwright/test';

test('Simple Production Dashboard Test', async ({ page }) => {
  console.log('🔍 Starting production dashboard test...');

  // Monitor network requests
  const apiRequests: string[] = [];

  page.on('request', (request) => {
    if (request.url().includes('/api/')) {
      apiRequests.push(`${request.method()} ${request.url()}`);
      console.log(`📡 API Request: ${request.method()} ${request.url()}`);
    }
  });

  page.on('response', (response) => {
    if (response.url().includes('/api/')) {
      console.log(`📨 API Response: ${response.status()} ${response.url()}`);
    }
  });

  // Navigate to dashboard
  console.log('🌐 Navigating to dashboard...');
  await page.goto('http://localhost:3003/dashboard/cliente', { waitUntil: 'networkidle' });

  // Take screenshot for verification
  await page.screenshot({ path: 'dashboard-test-screenshot.png', fullPage: true });
  console.log('📸 Screenshot saved: dashboard-test-screenshot.png');

  // Check page loaded
  await expect(page).toHaveTitle(/PLOMES/i);
  console.log('✅ Page title verified');

  // Look for search input
  const searchInput = page.locator('input[placeholder*="cliente"], input[placeholder*="Cliente"], input[type="search"]');
  await searchInput.waitFor({ timeout: 10000 });
  console.log('✅ Search input found');

  // Test search with "CIA MAQUINAS"
  console.log('🔍 Searching for "CIA MAQUINAS"...');
  await searchInput.fill('CIA MAQUINAS');
  await page.keyboard.press('Enter');

  // Wait a bit for search results
  await page.waitForTimeout(3000);

  // Check if there are API calls
  console.log(`📊 Total API requests: ${apiRequests.length}`);
  apiRequests.forEach(req => console.log(`  - ${req}`));

  // Check page content
  const content = await page.textContent('body');
  const hasData = content && content.length > 500;

  console.log(`📄 Page content length: ${content?.length || 0}`);
  console.log(`🔍 Contains "CIA": ${content?.includes('CIA') || false}`);
  console.log(`💾 Has meaningful data: ${hasData}`);

  // Basic assertions
  expect(hasData).toBeTruthy();
  expect(apiRequests.length).toBeGreaterThan(0);

  console.log('✅ Production dashboard test completed successfully!');
});