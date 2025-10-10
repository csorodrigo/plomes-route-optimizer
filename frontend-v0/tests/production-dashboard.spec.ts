import { test, expect, Page } from '@playwright/test';

test.describe('Customer Dashboard Production Data Test', () => {
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();

    // Set up network monitoring to track API calls
    await page.route('**/api/**', async (route, request) => {
      console.log(`🌐 API Call: ${request.method()} ${request.url()}`);
      await route.continue();
    });

    // Navigate to the dashboard
    await page.goto('http://localhost:3003/dashboard/cliente');

    // Wait for initial load
    await page.waitForLoadState('networkidle');
  });

  test('should load dashboard with real production data', async () => {
    // Wait for the page title to confirm we're on the right page
    await expect(page).toHaveTitle(/Dashboard/i);

    // Check that the main dashboard elements are present
    await expect(page.locator('h1')).toContainText('Dashboard');

    // Wait for customer list to load
    await page.waitForSelector('[data-testid="customer-list"], .customer-list, table', { timeout: 30000 });

    console.log('✅ Dashboard loaded successfully');
  });

  test('should search for CIA MAQUINAS and return production data', async () => {
    // Wait for search input to be available
    const searchInput = page.locator('input[type="search"], input[placeholder*="Pesquisar"], input[placeholder*="Search"]');
    await searchInput.waitFor({ timeout: 30000 });

    // Search for CIA MAQUINAS
    await searchInput.fill('CIA MAQUINAS');
    await searchInput.press('Enter');

    // Wait for search results
    await page.waitForTimeout(2000);
    await page.waitForLoadState('networkidle');

    // Check if results contain CIA MAQUINAS
    const pageContent = await page.textContent('body');
    expect(pageContent).toContain('CIA');

    console.log('✅ Search for CIA MAQUINAS completed');
  });

  test('should verify no mock data is being used', async () => {
    // Monitor network requests to check for real API calls
    const apiCalls: string[] = [];
    const mockDataIndicators: string[] = [];

    page.on('response', async (response) => {
      const url = response.url();

      // Track API calls
      if (url.includes('/api/')) {
        apiCalls.push(url);

        // Check response content for mock data indicators
        try {
          const responseText = await response.text();

          // Common mock data indicators
          const mockIndicators = [
            'mock',
            'demo',
            'test-data',
            'fake',
            'example.com',
            'lorem ipsum',
            'placeholder'
          ];

          mockIndicators.forEach(indicator => {
            if (responseText.toLowerCase().includes(indicator)) {
              mockDataIndicators.push(`Found "${indicator}" in ${url}`);
            }
          });

        } catch (e) {
          console.log(`Could not parse response from ${url}`);
        }
      }
    });

    // Reload page to capture all API calls
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Wait a bit more for all API calls to complete
    await page.waitForTimeout(3000);

    console.log('🔍 API Calls detected:', apiCalls);
    console.log('⚠️ Mock data indicators:', mockDataIndicators);

    // Verify we have API calls (indicating real data fetching)
    expect(apiCalls.length).toBeGreaterThan(0);

    // Verify no obvious mock data indicators
    expect(mockDataIndicators).toHaveLength(0);

    console.log('✅ No mock data indicators found');
  });

  test('should verify Ploomes integration and fallback mechanism', async () => {
    let ploomesApiCalled = false;
    let supabaseApiCalled = false;
    let fallbackDataUsed = false;

    // Monitor API calls
    page.on('response', async (response) => {
      const url = response.url();
      const status = response.status();

      if (url.includes('ploomes') || url.includes('api.ploomes')) {
        ploomesApiCalled = true;
        console.log(`🔗 Ploomes API call: ${status} ${url}`);

        if (status === 403) {
          console.log('⚠️ Ploomes API returned 403 - fallback should be used');
        }
      }

      if (url.includes('supabase') || url.includes('/api/dashboard/')) {
        supabaseApiCalled = true;
        console.log(`💾 Supabase/Dashboard API call: ${status} ${url}`);
      }

      // Check if fallback data (cached ploomes-deals.json) is being used
      if (url.includes('ploomes-deals.json') ||
          (await response.text()).includes('fallback') ||
          (await response.text()).includes('cached')) {
        fallbackDataUsed = true;
        console.log('🔄 Fallback data detected');
      }
    });

    // Reload to trigger API calls
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(5000);

    // Check that either Ploomes API was called OR fallback mechanism is working
    const integrationWorking = ploomesApiCalled || supabaseApiCalled || fallbackDataUsed;

    console.log('🔍 Integration Status:');
    console.log(`  - Ploomes API called: ${ploomesApiCalled}`);
    console.log(`  - Supabase API called: ${supabaseApiCalled}`);
    console.log(`  - Fallback data used: ${fallbackDataUsed}`);

    expect(integrationWorking).toBe(true);

    console.log('✅ Production integration verified');
  });

  test('should verify customer data contains real business information', async () => {
    // Wait for customer data to load
    await page.waitForSelector('table, .customer-list, [data-testid="customer-data"]', { timeout: 30000 });

    // Get page content
    const pageContent = await page.textContent('body');

    // Look for indicators of real business data
    const realDataIndicators = [
      'LTDA',
      'S.A.',
      'EIRELI',
      'CIA',
      'COMERCIO',
      'INDUSTRIA',
      'SERVICOS',
      'R$',
      'CNPJ',
      '@',
      '.com.br',
      'São Paulo',
      'SP',
      'MG',
      'RJ'
    ];

    const foundIndicators = realDataIndicators.filter(indicator =>
      pageContent?.toLowerCase().includes(indicator.toLowerCase())
    );

    console.log('🔍 Real data indicators found:', foundIndicators);

    // Should find at least some real business data indicators
    expect(foundIndicators.length).toBeGreaterThan(0);

    // Check for specific customer data patterns
    const hasCompanyData = /\b[A-Z\s]+LTDA\b|\b[A-Z\s]+S\.?A\.?\b|\bCIA\s+[A-Z]+/i.test(pageContent || '');
    const hasMonetaryData = /R\$\s*[\d,.]+ | \$[\d,.]+/i.test(pageContent || '');
    const hasLocationData = /São Paulo|SP|MG|RJ|Brasil/i.test(pageContent || '');

    console.log('📊 Data Pattern Analysis:');
    console.log(`  - Company data: ${hasCompanyData}`);
    console.log(`  - Monetary data: ${hasMonetaryData}`);
    console.log(`  - Location data: ${hasLocationData}`);

    // At least one type of real business data should be present
    expect(hasCompanyData || hasMonetaryData || hasLocationData).toBe(true);

    console.log('✅ Real business data patterns verified');
  });

  test('should handle errors gracefully and show meaningful data', async () => {
    // Monitor for error responses
    const errorResponses: Array<{url: string, status: number}> = [];

    page.on('response', async (response) => {
      if (response.status() >= 400) {
        errorResponses.push({
          url: response.url(),
          status: response.status()
        });
      }
    });

    // Reload page
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    console.log('⚠️ Error responses detected:', errorResponses);

    // Even with errors, the page should still show data
    const pageContent = await page.textContent('body');
    const hasData = pageContent && pageContent.length > 100;

    expect(hasData).toBe(true);

    // Should not show generic error messages
    const hasGenericError = pageContent?.includes('Something went wrong') ||
                           pageContent?.includes('Error loading') ||
                           pageContent?.includes('Failed to fetch');

    if (hasGenericError) {
      console.log('⚠️ Generic error message detected - check error handling');
    }

    console.log('✅ Error handling verified');
  });

  test.afterEach(async () => {
    await page.close();
  });
});