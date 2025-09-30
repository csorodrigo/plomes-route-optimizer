const { chromium } = require('playwright');

async function testVercelLogin() {
  console.log('🚀 Starting Vercel deployment login test...\n');

  // Test configuration
  const VERCEL_URL = 'https://plomes-rota-system-onaaiocqe-csorodrigo-2569s-projects.vercel.app';
  const LOGIN_CREDENTIALS = {
    email: 'gustavo.canuto@ciaramaquinas.com.br',
    password: 'ciara123@'
  };

  const browser = await chromium.launch({
    headless: false, // Show browser for visual debugging
    slowMo: 500     // Slow down actions for better observation
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });

  const page = await context.newPage();

  // Enable request/response monitoring
  const requests = [];
  const responses = [];
  const consoleMessages = [];
  const errors = [];

  page.on('request', request => {
    requests.push({
      url: request.url(),
      method: request.method(),
      headers: request.headers(),
      timestamp: new Date().toISOString()
    });
  });

  page.on('response', response => {
    responses.push({
      url: response.url(),
      status: response.status(),
      statusText: response.statusText(),
      headers: response.headers(),
      timestamp: new Date().toISOString()
    });
  });

  page.on('console', message => {
    consoleMessages.push({
      type: message.type(),
      text: message.text(),
      timestamp: new Date().toISOString()
    });
  });

  page.on('pageerror', error => {
    errors.push({
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
  });

  try {
    console.log('📋 TASK 1: Testing application accessibility and loading...');

    // Navigate to Vercel deployment
    console.log(`🌐 Navigating to: ${VERCEL_URL}`);
    const response = await page.goto(VERCEL_URL, { waitUntil: 'networkidle' });

    console.log(`✅ Page loaded with status: ${response.status()}`);

    // Take screenshot of initial page
    await page.screenshot({ path: 'vercel-page-loaded.png', fullPage: true });
    console.log('📸 Screenshot saved: vercel-page-loaded.png');

    // Check if Vercel authentication is blocking access
    const isVercelAuthBlocked = await page.locator('text=Vercel Authentication').isVisible().catch(() => false);
    const isVercelLoginRequired = await page.locator('text=Sign in to continue').isVisible().catch(() => false);

    if (isVercelAuthBlocked || isVercelLoginRequired) {
      console.log('❌ Vercel authentication is blocking access to the app');
      throw new Error('Vercel authentication required - app is not publicly accessible');
    } else {
      console.log('✅ No Vercel authentication blocking - app is publicly accessible');
    }

    console.log('\n📋 TASK 2: Verifying login form accessibility...');

    // Check if we're redirected to login page or if login form is present
    const currentUrl = page.url();
    console.log(`📍 Current URL: ${currentUrl}`);

    // Look for login form elements
    const emailInput = await page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i]').first();
    const passwordInput = await page.locator('input[type="password"], input[name="password"], input[placeholder*="password" i]').first();
    const loginButton = await page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Entrar"), button:has-text("Sign in")').first();

    const emailVisible = await emailInput.isVisible().catch(() => false);
    const passwordVisible = await passwordInput.isVisible().catch(() => false);
    const buttonVisible = await loginButton.isVisible().catch(() => false);

    console.log(`📧 Email input visible: ${emailVisible}`);
    console.log(`🔐 Password input visible: ${passwordVisible}`);
    console.log(`🔘 Login button visible: ${buttonVisible}`);

    if (!emailVisible || !passwordVisible || !buttonVisible) {
      // Maybe we need to navigate to login page
      const loginLinks = await page.locator('a:has-text("Login"), a:has-text("Entrar"), a:has-text("Sign in"), a[href*="login"]').count();
      if (loginLinks > 0) {
        console.log('🔗 Found login link, clicking to navigate to login page...');
        await page.locator('a:has-text("Login"), a:has-text("Entrar"), a:has-text("Sign in"), a[href*="login"]').first().click();
        await page.waitForLoadState('networkidle');

        // Re-check for form elements
        const emailVisible2 = await emailInput.isVisible().catch(() => false);
        const passwordVisible2 = await passwordInput.isVisible().catch(() => false);
        const buttonVisible2 = await loginButton.isVisible().catch(() => false);

        console.log(`📧 Email input visible after navigation: ${emailVisible2}`);
        console.log(`🔐 Password input visible after navigation: ${passwordVisible2}`);
        console.log(`🔘 Login button visible after navigation: ${buttonVisible2}`);
      }
    }

    // Take screenshot of login page
    await page.screenshot({ path: 'vercel-login-form.png', fullPage: true });
    console.log('📸 Screenshot saved: vercel-login-form.png');

    console.log('\n📋 TASK 3: Testing authentication with provided credentials...');

    // Clear and fill email
    await emailInput.click();
    await emailInput.clear();
    await emailInput.fill(LOGIN_CREDENTIALS.email);
    console.log(`📧 Email filled: ${LOGIN_CREDENTIALS.email}`);

    // Clear and fill password
    await passwordInput.click();
    await passwordInput.clear();
    await passwordInput.fill(LOGIN_CREDENTIALS.password);
    console.log('🔐 Password filled');

    // Take screenshot before login attempt
    await page.screenshot({ path: 'vercel-before-login.png', fullPage: true });
    console.log('📸 Screenshot saved: vercel-before-login.png');

    // Clear request/response arrays to focus on login requests
    requests.length = 0;
    responses.length = 0;

    // Click login button and wait for navigation/response
    console.log('🔘 Clicking login button...');
    await Promise.all([
      page.waitForResponse(response =>
        response.url().includes('/api/auth/login') ||
        response.url().includes('/login') ||
        response.url().includes('/auth'), { timeout: 10000 }
      ).catch(() => null), // Don't fail if no auth response
      loginButton.click()
    ]);

    // Wait for potential navigation or loading
    await page.waitForTimeout(3000);

    console.log('\n📋 TASK 4: Analyzing network requests and API responses...');

    // Analyze authentication requests
    const authRequests = requests.filter(req =>
      req.url.includes('/api/auth') ||
      req.url.includes('/login') ||
      req.url.includes('/auth')
    );

    const authResponses = responses.filter(res =>
      res.url.includes('/api/auth') ||
      res.url.includes('/login') ||
      res.url.includes('/auth')
    );

    console.log(`🔍 Authentication requests found: ${authRequests.length}`);
    authRequests.forEach((req, index) => {
      console.log(`  ${index + 1}. ${req.method} ${req.url}`);
    });

    console.log(`📡 Authentication responses found: ${authResponses.length}`);
    authResponses.forEach((res, index) => {
      console.log(`  ${index + 1}. ${res.status} ${res.statusText} - ${res.url}`);
    });

    // Check for specific errors
    const errorResponses = responses.filter(res => res.status >= 400);
    console.log(`❌ Error responses: ${errorResponses.length}`);
    errorResponses.forEach((res, index) => {
      console.log(`  ${index + 1}. ${res.status} ${res.statusText} - ${res.url}`);
    });

    // Check current URL after login attempt
    const postLoginUrl = page.url();
    console.log(`📍 URL after login attempt: ${postLoginUrl}`);

    // Take screenshot after login attempt
    await page.screenshot({ path: 'vercel-after-login.png', fullPage: true });
    console.log('📸 Screenshot saved: vercel-after-login.png');

    console.log('\n📋 TASK 5: Capturing console errors and authentication flow issues...');

    // Log console messages
    console.log(`💬 Console messages: ${consoleMessages.length}`);
    consoleMessages.forEach((msg, index) => {
      if (msg.type === 'error' || msg.text.toLowerCase().includes('error')) {
        console.log(`  ❌ ${msg.type}: ${msg.text}`);
      } else if (msg.type === 'warning' || msg.text.toLowerCase().includes('warn')) {
        console.log(`  ⚠️  ${msg.type}: ${msg.text}`);
      }
    });

    // Log page errors
    console.log(`🚨 JavaScript errors: ${errors.length}`);
    errors.forEach((error, index) => {
      console.log(`  ${index + 1}. ${error.message}`);
      if (error.stack) {
        console.log(`     Stack: ${error.stack.split('\n')[0]}`);
      }
    });

    console.log('\n📋 TASK 6: Verifying authentication state and environment...');

    // Check for success indicators
    const isLoggedIn = await page.locator('text=Dashboard, text=Logout, text=Sair, [data-testid="user-menu"]').isVisible().catch(() => false);
    const hasAuthToken = await page.evaluate(() => {
      return localStorage.getItem('token') || sessionStorage.getItem('token') || document.cookie.includes('token');
    }).catch(() => false);

    console.log(`🔐 Appears to be logged in: ${isLoggedIn}`);
    console.log(`🎟️  Has auth token: ${hasAuthToken}`);

    // Check for specific error messages
    const hasNetworkError = consoleMessages.some(msg =>
      msg.text.toLowerCase().includes('network') ||
      msg.text.toLowerCase().includes('connection refused') ||
      msg.text.toLowerCase().includes('err_connection_refused')
    );

    const hasTableError = consoleMessages.some(msg =>
      msg.text.toLowerCase().includes('legacy_users') ||
      msg.text.toLowerCase().includes('table') ||
      msg.text.toLowerCase().includes('relation')
    );

    const has401Error = errorResponses.some(res => res.status === 401);
    const has500Error = errorResponses.some(res => res.status === 500);

    console.log(`🌐 Network/connection errors: ${hasNetworkError}`);
    console.log(`📊 Database/table errors: ${hasTableError}`);
    console.log(`🚫 401 Unauthorized errors: ${has401Error}`);
    console.log(`💥 500 Server errors: ${has500Error}`);

    // Final assessment
    console.log('\n📊 FINAL ASSESSMENT:');

    if (isLoggedIn && hasAuthToken) {
      console.log('✅ LOGIN SUCCESS: Authentication appears to be working correctly');
    } else if (has401Error || has500Error) {
      console.log('❌ LOGIN FAILED: Server-side authentication errors detected');
    } else if (hasNetworkError) {
      console.log('❌ LOGIN FAILED: Network connectivity issues detected');
    } else if (hasTableError) {
      console.log('❌ LOGIN FAILED: Database table/schema issues detected');
    } else {
      console.log('⚠️  LOGIN STATUS UNCLEAR: Authentication flow completed but status uncertain');
    }

    // Save detailed report
    const report = {
      timestamp: new Date().toISOString(),
      vercelUrl: VERCEL_URL,
      testResults: {
        pageAccessible: response.status() === 200,
        vercelAuthBlocked: isVercelAuthBlocked || isVercelLoginRequired,
        loginFormFound: emailVisible && passwordVisible && buttonVisible,
        credentialsTested: true,
        loginAppeared: isLoggedIn,
        authTokenFound: hasAuthToken
      },
      networkAnalysis: {
        totalRequests: requests.length,
        authRequests: authRequests.length,
        errorResponses: errorResponses.length,
        specificErrors: {
          network: hasNetworkError,
          database: hasTableError,
          unauthorized: has401Error,
          serverError: has500Error
        }
      },
      consoleMessages: consoleMessages,
      errors: errors,
      screenshots: [
        'vercel-page-loaded.png',
        'vercel-login-form.png',
        'vercel-before-login.png',
        'vercel-after-login.png'
      ]
    };

    // Save report as JSON
    const fs = require('fs');
    fs.writeFileSync('vercel-login-test-report.json', JSON.stringify(report, null, 2));
    console.log('📄 Detailed report saved: vercel-login-test-report.json');

  } catch (error) {
    console.error('💥 Test failed with error:', error.message);
    await page.screenshot({ path: 'vercel-test-error.png', fullPage: true });
    console.log('📸 Error screenshot saved: vercel-test-error.png');
  } finally {
    await browser.close();
    console.log('\n🏁 Test completed. Review screenshots and report for detailed analysis.');
  }
}

// Run the test
testVercelLogin().catch(console.error);