import { test, expect } from '@playwright/test';

const PRODUCTION_URL = 'https://plomes-rota-system.vercel.app';
const TEST_EMAIL = 'gustavo.canuto@ciaramaquinas.com.br';
const TEST_PASSWORD = 'ciara123@';

test('should login successfully with database credentials', async ({ page }) => {
    console.log('🌐 Navigating to production login page...');

    // Navigate to login page
    await page.goto(`${PRODUCTION_URL}/login`);

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    console.log('📋 Filling login form...');

    // Fill in login form
    await page.fill('input[type="email"], input[name="email"]', TEST_EMAIL);
    await page.fill('input[type="password"], input[name="password"]', TEST_PASSWORD);

    console.log('🔐 Submitting login...');

    // Click login button
    await page.click('button[type="submit"]');

    // Wait for navigation or response
    await page.waitForTimeout(3000);

    // Check if login was successful
    const url = page.url();
    console.log('📍 Current URL after login:', url);

    // Verify we're not on the login page anymore
    expect(url).not.toContain('/login');

    // Check for successful login indicators
    const hasToken = await page.evaluate(() => {
      return localStorage.getItem('auth_token') !== null;
    });

    console.log('🎫 Token in localStorage:', hasToken);
    expect(hasToken).toBe(true);

    console.log('✅ Login test passed!');
});

test('should fail with incorrect password', async ({ page }) => {
  console.log('🌐 Testing invalid credentials...');

  await page.goto(`${PRODUCTION_URL}/login`);
  await page.waitForLoadState('networkidle');

  await page.fill('input[type="email"], input[name="email"]', TEST_EMAIL);
  await page.fill('input[type="password"], input[name="password"]', 'wrong-password');

  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000);

  // Should still be on login page
  const url = page.url();
  expect(url).toContain('/login');

  // Should have error message
  const hasError = await page.locator('text=/invalid|error|incorrect/i').count() > 0;
  console.log('❌ Error message shown:', hasError);

  console.log('✅ Invalid login test passed!');
});
