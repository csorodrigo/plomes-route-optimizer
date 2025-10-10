import { test, expect } from '@playwright/test';

test('Dashboard API Diagnostic Test', async ({ page }) => {
  console.log('🔍 Starting diagnostic test for dashboard API calls...');

  // Track all network activity
  const allRequests: Array<{method: string, url: string}> = [];
  const allResponses: Array<{status: number, url: string, body?: string}> = [];

  page.on('request', (request) => {
    allRequests.push({
      method: request.method(),
      url: request.url()
    });
    console.log(`➡️ REQUEST: ${request.method()} ${request.url()}`);
  });

  page.on('response', async (response) => {
    const responseData = {
      status: response.status(),
      url: response.url(),
      body: undefined as string | undefined
    };

    try {
      if (response.url().includes('/api/')) {
        responseData.body = await response.text();
        console.log(`⬅️ API RESPONSE: ${response.status()} ${response.url()}`);
        console.log(`📄 Body preview: ${responseData.body.substring(0, 150)}...`);
      }
    } catch (e) {
      console.log(`⬅️ RESPONSE: ${response.status()} ${response.url()} (could not read body)`);
    }

    allResponses.push(responseData);
  });

  // Navigate to dashboard
  console.log('🌐 Navigating to dashboard...');
  await page.goto('http://localhost:3003/dashboard/cliente');

  // Wait for initial load
  await page.waitForLoadState('networkidle', { timeout: 30000 });
  console.log('✅ Page loaded');

  // Look for search input
  console.log('🔍 Looking for search input...');
  const searchInput = page.locator('input').first();
  await searchInput.waitFor({ timeout: 10000 });

  // Fill and submit search
  console.log('📝 Filling search with "CIA MAQUINAS"...');
  await searchInput.fill('CIA MAQUINAS');
  await page.keyboard.press('Enter');

  // Wait for potential API calls
  console.log('⏳ Waiting for API responses...');
  await page.waitForTimeout(5000);

  // Check page content
  const content = await page.textContent('body');
  console.log(`📄 Final page content length: ${content?.length}`);
  console.log(`🔍 Contains "CIA": ${content?.includes('CIA')}`);

  // Log all network activity
  console.log('\n📊 COMPLETE NETWORK ACTIVITY:');
  console.log(`Total requests: ${allRequests.length}`);
  console.log(`Total responses: ${allResponses.length}`);

  console.log('\n📡 ALL REQUESTS:');
  allRequests.forEach((req, i) => {
    console.log(`${i + 1}. ${req.method} ${req.url}`);
  });

  console.log('\n📨 ALL RESPONSES:');
  allResponses.forEach((res, i) => {
    console.log(`${i + 1}. ${res.status} ${res.url}`);
  });

  // Filter API calls
  const apiRequests = allRequests.filter(req => req.url.includes('/api/'));
  const apiResponses = allResponses.filter(res => res.url.includes('/api/'));

  console.log(`\n🎯 API-specific activity:`);
  console.log(`API requests: ${apiRequests.length}`);
  console.log(`API responses: ${apiResponses.length}`);

  // Check for specific data indicators
  const hasRealData = content && (
    content.includes('LTDA') ||
    content.includes('CIA') ||
    content.includes('R$') ||
    content.length > 1000
  );

  console.log(`💾 Has real business data: ${hasRealData}`);

  // Basic validation
  expect(content).toBeTruthy();
  expect(content!.length).toBeGreaterThan(500);

  console.log('✅ Diagnostic test completed successfully!');
});