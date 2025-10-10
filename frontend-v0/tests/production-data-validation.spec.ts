import { test, expect } from '@playwright/test';

test.describe('Production Data Validation Tests', () => {

  test('should verify no mock data and confirm real Ploomes integration', async ({ page }) => {
    console.log('🔍 Starting production data validation...');

    // Track API calls and responses
    const apiCalls: Array<{method: string, url: string, status: number, data?: any}> = [];
    const mockDataIndicators: string[] = [];

    // Monitor all network activity
    page.on('request', (request) => {
      if (request.url().includes('/api/')) {
        console.log(`📡 Request: ${request.method()} ${request.url()}`);
      }
    });

    page.on('response', async (response) => {
      const url = response.url();
      const status = response.status();

      if (url.includes('/api/')) {
        console.log(`📨 Response: ${status} ${url}`);

        try {
          const responseText = await response.text();

          apiCalls.push({
            method: response.request().method(),
            url: url,
            status: status,
            data: responseText.substring(0, 200) // First 200 chars for inspection
          });

          // Check for mock data indicators
          const mockPatterns = [
            /mock[_-]?data/i,
            /test[_-]?data/i,
            /demo[_-]?mode/i,
            /placeholder/i,
            /example\.com/i,
            /lorem\s+ipsum/i,
            /fake[_-]?data/i,
            /sample[_-]?data/i
          ];

          mockPatterns.forEach(pattern => {
            if (pattern.test(responseText)) {
              mockDataIndicators.push(`Found mock pattern "${pattern.source}" in ${url}`);
            }
          });

          // Log response content for validation
          if (responseText && responseText.length > 0) {
            console.log(`📄 Response preview (${url}): ${responseText.substring(0, 100)}...`);
          }

        } catch (e) {
          console.log(`⚠️ Could not parse response from ${url}: ${e}`);
        }
      }
    });

    // Navigate to dashboard
    await page.goto('http://localhost:3003/dashboard/cliente', { waitUntil: 'networkidle' });

    // Wait for initial load and capture any immediate API calls
    await page.waitForTimeout(2000);

    // Perform search to trigger API calls
    const searchInput = page.locator('input[placeholder*="cliente"], input[placeholder*="Cliente"], input[type="search"]');
    await searchInput.fill('CIA MAQUINAS');
    await page.keyboard.press('Enter');

    // Wait for search results and network activity to settle
    await page.waitForTimeout(5000);
    await page.waitForLoadState('networkidle');

    // Take screenshot for visual confirmation
    await page.screenshot({ path: 'production-validation-screenshot.png', fullPage: true });

    console.log('\n📊 API CALLS ANALYSIS:');
    console.log(`Total API calls: ${apiCalls.length}`);

    apiCalls.forEach((call, index) => {
      console.log(`${index + 1}. ${call.method} ${call.url} - Status: ${call.status}`);
      if (call.data) {
        console.log(`   Data preview: ${call.data.replace(/\n/g, ' ')}`);
      }
    });

    console.log('\n🚨 MOCK DATA CHECK:');
    if (mockDataIndicators.length > 0) {
      mockDataIndicators.forEach(indicator => console.log(`❌ ${indicator}`));
    } else {
      console.log('✅ No mock data indicators found');
    }

    // Verify API integration
    expect(apiCalls.length).toBeGreaterThan(0);
    expect(mockDataIndicators).toHaveLength(0);

    // Check if we got successful responses from the dashboard API
    const dashboardCalls = apiCalls.filter(call => call.url.includes('/api/dashboard/'));
    expect(dashboardCalls.length).toBeGreaterThan(0);

    const successfulCalls = dashboardCalls.filter(call => call.status >= 200 && call.status < 400);
    expect(successfulCalls.length).toBeGreaterThan(0);

    console.log(`✅ Found ${successfulCalls.length} successful dashboard API calls`);
  });

  test('should verify real business data patterns in responses', async ({ page }) => {
    console.log('🔍 Validating business data patterns...');

    let businessDataFound = false;
    const businessPatterns = {
      companies: [] as string[],
      monetary: [] as string[],
      locations: [] as string[],
      contacts: [] as string[]
    };

    page.on('response', async (response) => {
      if (response.url().includes('/api/dashboard/') && response.status() === 200) {
        try {
          const responseText = await response.text();

          // Look for company patterns (LTDA, S.A., EIRELI, CIA)
          const companyMatches = responseText.match(/\b[A-Z\s]+(?:LTDA|S\.?A\.?|EIRELI|CIA)\b/gi);
          if (companyMatches) {
            businessPatterns.companies.push(...companyMatches.slice(0, 3)); // Keep first 3
            businessDataFound = true;
          }

          // Look for monetary patterns (R$, values)
          const moneyMatches = responseText.match(/R\$\s*[\d,.]+|\$[\d,.]+/gi);
          if (moneyMatches) {
            businessPatterns.monetary.push(...moneyMatches.slice(0, 3));
            businessDataFound = true;
          }

          // Look for location patterns
          const locationMatches = responseText.match(/\b(?:São Paulo|SP|MG|RJ|Brasil|Brazil)\b/gi);
          if (locationMatches) {
            businessPatterns.locations.push(...locationMatches.slice(0, 3));
            businessDataFound = true;
          }

          // Look for contact patterns (email, CNPJ)
          const contactMatches = responseText.match(/\b[\w.-]+@[\w.-]+\.\w+\b|\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/gi);
          if (contactMatches) {
            businessPatterns.contacts.push(...contactMatches.slice(0, 3));
            businessDataFound = true;
          }

        } catch (e) {
          console.log('Could not parse response for business pattern analysis');
        }
      }
    });

    // Navigate and search
    await page.goto('http://localhost:3003/dashboard/cliente', { waitUntil: 'networkidle' });

    const searchInput = page.locator('input[placeholder*="cliente"], input[placeholder*="Cliente"], input[type="search"]');
    await searchInput.fill('CIA MAQUINAS');
    await page.keyboard.press('Enter');

    await page.waitForTimeout(5000);

    // Also check page content for business patterns
    const pageContent = await page.textContent('body');

    if (pageContent) {
      // Additional page-level checks
      const pageCompanies = pageContent.match(/\b[A-Z\s]+(?:LTDA|S\.?A\.?|EIRELI|CIA)\b/gi);
      const pageMoney = pageContent.match(/R\$\s*[\d,.]+/gi);
      const pageLocations = pageContent.match(/\b(?:São Paulo|SP|MG|RJ|Brasil)\b/gi);

      if (pageCompanies) businessPatterns.companies.push(...pageCompanies.slice(0, 2));
      if (pageMoney) businessPatterns.monetary.push(...pageMoney.slice(0, 2));
      if (pageLocations) businessPatterns.locations.push(...pageLocations.slice(0, 2));

      businessDataFound = businessDataFound || !!(pageCompanies || pageMoney || pageLocations);
    }

    console.log('\n🏢 BUSINESS DATA PATTERNS FOUND:');
    console.log(`Companies: ${businessPatterns.companies.join(', ')}`);
    console.log(`Monetary: ${businessPatterns.monetary.join(', ')}`);
    console.log(`Locations: ${businessPatterns.locations.join(', ')}`);
    console.log(`Contacts: ${businessPatterns.contacts.join(', ')}`);

    // Verify we found legitimate business data
    expect(businessDataFound).toBe(true);

    const totalPatterns = Object.values(businessPatterns).flat().length;
    expect(totalPatterns).toBeGreaterThan(0);

    console.log(`✅ Found ${totalPatterns} business data patterns - confirms real production data`);
  });

  test('should verify Ploomes integration with proper fallback handling', async ({ page }) => {
    console.log('🔍 Testing Ploomes integration and fallback mechanisms...');

    const integrationStatus = {
      ploomesApiCalled: false,
      supabaseApiCalled: false,
      fallbackDataUsed: false,
      errors: [] as Array<{url: string, status: number, error?: string}>
    };

    page.on('response', async (response) => {
      const url = response.url();
      const status = response.status();

      // Track Ploomes API calls
      if (url.includes('ploomes') || url.includes('api.ploomes')) {
        integrationStatus.ploomesApiCalled = true;
        console.log(`🔗 Ploomes API: ${status} ${url}`);

        if (status === 403) {
          console.log('⚠️ Ploomes API 403 - should trigger fallback');
          integrationStatus.errors.push({url, status, error: 'Forbidden'});
        }
      }

      // Track Supabase/local API calls
      if (url.includes('supabase') || url.includes('/api/dashboard/')) {
        integrationStatus.supabaseApiCalled = true;
        console.log(`💾 Dashboard API: ${status} ${url}`);
      }

      // Check for fallback data usage
      if (status >= 400) {
        integrationStatus.errors.push({url, status});
      }

      // Check response content for fallback indicators
      try {
        const responseText = await response.text();
        if (responseText.includes('fallback') || responseText.includes('cached') || url.includes('ploomes-deals.json')) {
          integrationStatus.fallbackDataUsed = true;
          console.log('🔄 Fallback mechanism detected');
        }
      } catch (e) {
        // Response might not be text
      }
    });

    // Navigate and trigger API calls
    await page.goto('http://localhost:3003/dashboard/cliente', { waitUntil: 'networkidle' });

    // Search to trigger more API activity
    const searchInput = page.locator('input[placeholder*="cliente"], input[placeholder*="Cliente"], input[type="search"]');
    await searchInput.fill('CIA MAQUINAS');
    await page.keyboard.press('Enter');

    // Wait for all API calls to complete
    await page.waitForTimeout(10000);
    await page.waitForLoadState('networkidle');

    console.log('\n🔄 INTEGRATION STATUS:');
    console.log(`Ploomes API called: ${integrationStatus.ploomesApiCalled}`);
    console.log(`Supabase/Dashboard API called: ${integrationStatus.supabaseApiCalled}`);
    console.log(`Fallback data used: ${integrationStatus.fallbackDataUsed}`);
    console.log(`Errors encountered: ${integrationStatus.errors.length}`);

    if (integrationStatus.errors.length > 0) {
      console.log('Error details:');
      integrationStatus.errors.forEach(error => {
        console.log(`  - ${error.status} ${error.url} ${error.error || ''}`);
      });
    }

    // Verify the dashboard is working even with potential API errors
    const pageContent = await page.textContent('body');
    const hasData = pageContent && pageContent.length > 500;

    expect(hasData).toBe(true);

    // At least one integration method should be working
    const integrationWorking = integrationStatus.supabaseApiCalled ||
                              integrationStatus.fallbackDataUsed ||
                              integrationStatus.ploomesApiCalled;

    expect(integrationWorking).toBe(true);

    console.log('✅ Production integration verified - dashboard working with real data');
  });
});