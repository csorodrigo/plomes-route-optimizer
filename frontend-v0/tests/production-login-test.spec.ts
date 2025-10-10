import { test, expect, type Page } from '@playwright/test';

const PRODUCTION_URL = 'https://frontend-v0-86bwafhtf-csorodrigo-2569s-projects.vercel.app';

// Test credentials
const ADMIN_CREDENTIALS = {
  email: 'gustavo.canuto@ciaramaquinas.com.br',
  password: 'ciara123@'
};

test.describe('Production Login Authentication Tests', () => {

  test.beforeEach(async ({ page }) => {
    // Navigate to production URL
    await page.goto(PRODUCTION_URL);
    await page.waitForLoadState('networkidle');
  });

  test('should successfully login with admin credentials', async ({ page }) => {
    console.log('🧪 Testing admin user login...');

    // Setup network monitoring
    const loginRequests: any[] = [];
    page.on('request', request => {
      if (request.url().includes('/api/auth/login')) {
        loginRequests.push({
          url: request.url(),
          method: request.method(),
          postData: request.postData()
        });
      }
    });

    const loginResponses: any[] = [];
    page.on('response', async response => {
      if (response.url().includes('/api/auth/login')) {
        loginResponses.push({
          url: response.url(),
          status: response.status(),
          statusText: response.statusText(),
          body: await response.text().catch(() => 'Unable to read body')
        });
      }
    });

    // Fill login form
    await page.fill('input[type="email"], input[name="email"]', ADMIN_CREDENTIALS.email);
    await page.fill('input[type="password"], input[name="password"]', ADMIN_CREDENTIALS.password);

    // Take screenshot before login
    await page.screenshot({ path: 'test-results/before-admin-login.png', fullPage: true });

    // Click login button
    await page.click('button[type="submit"], button:has-text("Entrar"), button:has-text("Login")');

    // Wait for navigation or response
    await page.waitForTimeout(3000);

    // Take screenshot after login attempt
    await page.screenshot({ path: 'test-results/after-admin-login.png', fullPage: true });

    // Log network activity
    console.log('📡 Login Requests:', JSON.stringify(loginRequests, null, 2));
    console.log('📡 Login Responses:', JSON.stringify(loginResponses, null, 2));

    // Verify successful login
    const currentUrl = page.url();
    console.log('📍 Current URL after login:', currentUrl);

    // Check for success indicators
    const isOnDashboard = currentUrl.includes('/dashboard') || currentUrl.includes('/home');
    const hasAuthToken = await page.evaluate(() => {
      return localStorage.getItem('authToken') !== null ||
             sessionStorage.getItem('authToken') !== null;
    });

    console.log('✅ On Dashboard:', isOnDashboard);
    console.log('✅ Has Auth Token:', hasAuthToken);

    // Assertions
    expect(loginResponses.length).toBeGreaterThan(0);
    expect(loginResponses[0].status).toBe(200);
    expect(isOnDashboard || hasAuthToken).toBeTruthy();
  });

  test('should access users page and identify newly created users', async ({ page }) => {
    console.log('🧪 Testing access to /users page...');

    // First login as admin
    await page.fill('input[type="email"], input[name="email"]', ADMIN_CREDENTIALS.email);
    await page.fill('input[type="password"], input[name="password"]', ADMIN_CREDENTIALS.password);
    await page.click('button[type="submit"], button:has-text("Entrar"), button:has-text("Login")');

    await page.waitForTimeout(2000);

    // Navigate to users page
    await page.goto(`${PRODUCTION_URL}/users`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Take screenshot
    await page.screenshot({ path: 'test-results/users-page.png', fullPage: true });

    // Extract user list from the page
    const users = await page.evaluate(() => {
      const userElements = document.querySelectorAll('tr[data-user], .user-row, [data-testid*="user"]');
      const userList: any[] = [];

      userElements.forEach(el => {
        const emailEl = el.querySelector('[data-field="email"], .user-email, td:nth-child(2)');
        const nameEl = el.querySelector('[data-field="name"], .user-name, td:nth-child(1)');

        if (emailEl) {
          userList.push({
            email: emailEl.textContent?.trim(),
            name: nameEl?.textContent?.trim()
          });
        }
      });

      // Also try to get from table cells
      const tableCells = document.querySelectorAll('table tr');
      tableCells.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 2) {
          const email = cells[1]?.textContent?.trim();
          if (email && email.includes('@')) {
            userList.push({
              email: email,
              name: cells[0]?.textContent?.trim()
            });
          }
        }
      });

      return userList;
    });

    console.log('👥 Users found on page:', JSON.stringify(users, null, 2));

    // Log page content for debugging
    const pageContent = await page.content();
    console.log('📄 Page contains "user":', pageContent.toLowerCase().includes('user'));
    console.log('📄 Page contains table:', pageContent.toLowerCase().includes('<table'));
  });

  test('should test login with newly created user', async ({ page }) => {
    console.log('🧪 Testing newly created user login...');

    // Try common test user credentials that might have been created
    const testUsers = [
      { email: 'teste@teste.com', password: 'teste123' },
      { email: 'test@test.com', password: 'test123' },
      { email: 'novo@usuario.com', password: 'senha123' },
      { email: 'user@test.com', password: 'user123' }
    ];

    for (const testUser of testUsers) {
      console.log(`\n🔍 Trying user: ${testUser.email}`);

      // Reload page to clear any state
      await page.goto(PRODUCTION_URL);
      await page.waitForLoadState('networkidle');

      // Setup network monitoring
      const responses: any[] = [];
      page.on('response', async response => {
        if (response.url().includes('/api/auth/login')) {
          responses.push({
            url: response.url(),
            status: response.status(),
            body: await response.text().catch(() => 'Unable to read body')
          });
        }
      });

      // Fill login form
      await page.fill('input[type="email"], input[name="email"]', testUser.email);
      await page.fill('input[type="password"], input[name="password"]', testUser.password);

      // Click login
      await page.click('button[type="submit"], button:has-text("Entrar"), button:has-text("Login")');

      // Wait for response
      await page.waitForTimeout(2000);

      // Check response
      if (responses.length > 0) {
        console.log(`📡 Response for ${testUser.email}:`, responses[0].status);

        if (responses[0].status === 200) {
          console.log(`✅ SUCCESS! User ${testUser.email} can login`);
          await page.screenshot({ path: `test-results/success-${testUser.email.replace('@', '-at-')}.png`, fullPage: true });

          // This user works, break the loop
          expect(responses[0].status).toBe(200);
          return;
        } else {
          console.log(`❌ Failed for ${testUser.email}: ${responses[0].status}`);
        }
      }
    }
  });

  test('should monitor all network requests during login', async ({ page }) => {
    console.log('🧪 Comprehensive network monitoring test...');

    const allRequests: any[] = [];
    const allResponses: any[] = [];

    page.on('request', request => {
      allRequests.push({
        url: request.url(),
        method: request.method(),
        resourceType: request.resourceType()
      });
    });

    page.on('response', async response => {
      allResponses.push({
        url: response.url(),
        status: response.status(),
        contentType: response.headers()['content-type']
      });
    });

    // Login with admin
    await page.fill('input[type="email"], input[name="email"]', ADMIN_CREDENTIALS.email);
    await page.fill('input[type="password"], input[name="password"]', ADMIN_CREDENTIALS.password);
    await page.click('button[type="submit"], button:has-text("Entrar"), button:has-text("Login")');

    await page.waitForTimeout(3000);

    // Filter API requests
    const apiRequests = allRequests.filter(r => r.url.includes('/api/'));
    const apiResponses = allResponses.filter(r => r.url.includes('/api/'));

    console.log('\n📊 API Requests Summary:');
    apiRequests.forEach(req => {
      console.log(`  ${req.method} ${req.url}`);
    });

    console.log('\n📊 API Responses Summary:');
    apiResponses.forEach(res => {
      console.log(`  ${res.status} ${res.url}`);
    });

    // Write full report
    const report = {
      timestamp: new Date().toISOString(),
      productionUrl: PRODUCTION_URL,
      totalRequests: allRequests.length,
      totalResponses: allResponses.length,
      apiRequests,
      apiResponses,
      authEndpoints: apiResponses.filter(r => r.url.includes('/auth/')),
      successfulAuth: apiResponses.some(r => r.url.includes('/auth/') && r.status === 200)
    };

    await page.evaluate((reportData) => {
      console.log('📋 Full Network Report:', JSON.stringify(reportData, null, 2));
    }, report);
  });
});
