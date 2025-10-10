import { test, expect } from '@playwright/test';

test('Customer Dashboard Basic Test', async ({ page }) => {
  console.log('Starting customer dashboard test...');

  // Navigate to the dashboard
  await page.goto('http://localhost:3003/dashboard/cliente');
  console.log('Navigated to dashboard page');

  // Wait for page to load
  await page.waitForLoadState('networkidle');
  console.log('Page loaded');

  // Take initial screenshot
  await page.screenshot({
    path: 'test-results/dashboard-loaded.png',
    fullPage: true
  });
  console.log('Initial screenshot taken');

  // Check if page loads without errors
  const title = await page.title();
  console.log('Page title:', title);

  // Look for any search input
  const searchInput = page.locator('input');
  if (await searchInput.count() > 0) {
    console.log('Found search input');
    await searchInput.first().fill('CIA MAQUINAS');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(3000);

    // Take screenshot after search
    await page.screenshot({
      path: 'test-results/dashboard-search-result.png',
      fullPage: true
    });
    console.log('Search screenshot taken');
  }

  // Look for any data indicators
  const bodyText = await page.textContent('body');
  console.log('Page contains data:', {
    hasCiara: bodyText?.includes('CIA') || bodyText?.includes('CIARA'),
    hasNumbers: /\d+/.test(bodyText || ''),
    has618: bodyText?.includes('618'),
    has10228: bodyText?.includes('10228') || bodyText?.includes('10,228')
  });

  // Basic assertion that page loaded
  await expect(page.locator('body')).toBeVisible();
});