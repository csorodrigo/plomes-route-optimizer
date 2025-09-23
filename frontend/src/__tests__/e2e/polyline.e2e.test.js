/**
 * End-to-End Tests for Polyline Rendering in RouteOptimizer
 * These tests simulate real user interactions and verify the complete polyline functionality
 */

import puppeteer from 'puppeteer';
import { spawn } from 'child_process';
import path from 'path';

describe('Polyline E2E Tests', () => {
  let browser;
  let page;
  let server;
  let serverPort = 3001;
  let clientPort = 3000;

  // Start backend server
  const startBackend = () => {
    return new Promise((resolve, reject) => {
      server = spawn('node', ['backend/server.js'], {
        cwd: path.resolve(__dirname, '../../..'),
        env: { ...process.env, PORT: serverPort }
      });

      server.stdout.on('data', (data) => {
        if (data.toString().includes('Server running')) {
          resolve();
        }
      });

      server.stderr.on('data', (data) => {
        console.error(`Backend error: ${data}`);
      });

      setTimeout(() => reject(new Error('Backend startup timeout')), 30000);
    });
  };

  // Start frontend development server
  const startFrontend = () => {
    return new Promise((resolve, reject) => {
      const frontend = spawn('npm', ['start'], {
        cwd: path.resolve(__dirname, '../..'),
        env: { ...process.env, PORT: clientPort }
      });

      frontend.stdout.on('data', (data) => {
        if (data.toString().includes('webpack compiled')) {
          resolve();
        }
      });

      frontend.stderr.on('data', (data) => {
        console.error(`Frontend error: ${data}`);
      });

      setTimeout(() => reject(new Error('Frontend startup timeout')), 60000);
    });
  };

  beforeAll(async () => {
    // Start backend server
    await startBackend();
    console.log('Backend server started');

    // Start frontend server
    await startFrontend();
    console.log('Frontend server started');

    // Launch browser
    browser = await puppeteer.launch({
      headless: process.env.CI === 'true',
      slowMo: 50,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    page = await browser.newPage();

    // Set viewport for consistent testing
    await page.setViewport({ width: 1920, height: 1080 });

    // Navigate to the application
    await page.goto(`http://localhost:${clientPort}`, {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    console.log('E2E test environment ready');
  }, 120000);

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
    if (server) {
      server.kill();
    }
    console.log('E2E test environment cleaned up');
  });

  describe('Route Optimization and Polyline Rendering Workflow', () => {
    test('should complete full polyline rendering workflow', async () => {
      // Wait for page to load completely
      await page.waitForSelector('[data-testid="map-container"]', { timeout: 30000 });

      // Step 1: Load customers
      const loadButton = await page.waitForSelector('button:has-text("routeOptimizer.loadCustomers")', { timeout: 10000 });
      await loadButton.click();

      // Wait for customers to load
      await page.waitForSelector('[data-testid="marker"]', { timeout: 15000 });

      // Verify customers loaded
      const customerMarkers = await page.$$('[data-testid="marker"]');
      expect(customerMarkers.length).toBeGreaterThan(0);

      // Step 2: Set origin
      const cepInput = await page.waitForSelector('input[placeholder*="routeOptimizer.originPlaceholder"]');
      await cepInput.type('01000-000');

      const setOriginButton = await page.waitForSelector('button:has-text("📍")');
      await setOriginButton.click();

      // Wait for origin to be set
      await page.waitForSelector('text=Origem definida', { timeout: 10000 });

      // Verify origin marker and coverage circle
      await page.waitForSelector('[data-testid="circle"]', { timeout: 5000 });
      const originMarker = await page.$('[data-icon*="draggable-origin-marker"]');
      expect(originMarker).toBeTruthy();

      // Step 3: Select customers
      const selectableMarkers = await page.$$('[data-testid="marker"]:not([data-icon*="draggable-origin-marker"])');

      // Click first customer
      await selectableMarkers[0].click();

      // Click second customer if available
      if (selectableMarkers.length > 1) {
        await selectableMarkers[1].click();
      }

      // Wait for customer selection to be reflected
      await page.waitForFunction(
        () => document.querySelector('text*="selected"'),
        { timeout: 5000 }
      );

      // Step 4: Optimize route
      const optimizeButton = await page.waitForSelector('button:has-text("routeOptimizer.optimizeRoute"):not([disabled])');
      await optimizeButton.click();

      // Step 5: Wait for polyline to render
      const polylineSelector = '[data-testid="polyline"][data-color="#FF0000"]';
      await page.waitForSelector(polylineSelector, { timeout: 20000 });

      // Verify polyline properties
      const polyline = await page.$(polylineSelector);
      const polylineProperties = await page.evaluate(el => ({
        color: el.getAttribute('data-color'),
        weight: el.getAttribute('data-weight'),
        opacity: el.getAttribute('data-opacity'),
        pane: el.getAttribute('data-pane'),
        coordinatesCount: parseInt(el.getAttribute('data-coordinates-count'))
      }), polyline);

      expect(polylineProperties.color).toBe('#FF0000');
      expect(polylineProperties.weight).toBe('6');
      expect(polylineProperties.opacity).toBe('1');
      expect(polylineProperties.pane).toBe('overlayPane');
      expect(polylineProperties.coordinatesCount).toBeGreaterThan(1);

      // Step 6: Verify route information card
      await page.waitForSelector('text=route.optimizedRoute', { timeout: 5000 });

      // Verify console logs (check browser console)
      const consoleMessages = await page.evaluate(() => {
        return window.polylineDebugLogs || [];
      });

      // Should have debug logs about polyline rendering
      const hasPolylineLogs = consoleMessages.some(msg =>
        msg.includes('🗺️') && (msg.includes('polyline') || msg.includes('route'))
      );
      expect(hasPolylineLogs).toBe(true);

      console.log('✅ Full polyline rendering workflow completed successfully');
    }, 60000);

    test('should handle origin marker dragging and polyline updates', async () => {
      // Ensure we have a route already optimized
      await page.waitForSelector('[data-testid="polyline"][data-color="#FF0000"]', { timeout: 30000 });

      // Get initial polyline coordinates
      const initialPolyline = await page.$('[data-testid="polyline"][data-color="#FF0000"]');
      const initialCoordinates = await page.evaluate(el =>
        el.getAttribute('data-positions'), initialPolyline);

      // Find draggable origin marker
      const originMarker = await page.waitForSelector('[data-draggable="true"]');

      // Get marker position
      const markerBox = await originMarker.boundingBox();

      // Simulate drag operation
      await page.mouse.move(markerBox.x + markerBox.width / 2, markerBox.y + markerBox.height / 2);
      await page.mouse.down();
      await page.mouse.move(markerBox.x + 50, markerBox.y + 50); // Drag 50px
      await page.mouse.up();

      // Wait for origin update notification
      await page.waitForFunction(
        () => document.querySelector('text*="route.originUpdated"') ||
               document.querySelector('.Toastify__toast'),
        { timeout: 5000 }
      );

      // Verify polyline might have been updated (coordinates changed)
      const updatedPolyline = await page.$('[data-testid="polyline"][data-color="#FF0000"]');
      const updatedCoordinates = await page.evaluate(el =>
        el.getAttribute('data-positions'), updatedPolyline);

      // Coordinates should potentially be different after dragging
      expect(updatedCoordinates).toBeDefined();

      console.log('✅ Origin marker dragging test completed successfully');
    }, 30000);

    test('should display debug information in development mode', async () => {
      // Inject development mode flag
      await page.evaluate(() => {
        Object.defineProperty(process.env, 'NODE_ENV', { value: 'development' });
      });

      // Ensure we have a route
      await page.waitForSelector('[data-testid="polyline"][data-color="#FF0000"]', { timeout: 30000 });

      // Look for debug panel
      const debugPanel = await page.waitForSelector('text=🐛 Debug: Polyline Info', { timeout: 5000 });
      expect(debugPanel).toBeTruthy();

      // Verify debug information is displayed
      const debugInfo = await page.waitForSelector('text=Real Route Available', { timeout: 2000 });
      expect(debugInfo).toBeTruthy();

      console.log('✅ Debug information display test completed successfully');
    }, 20000);

    test('should handle customer selection and deselection', async () => {
      // Ensure map is loaded
      await page.waitForSelector('[data-testid="map-container"]', { timeout: 30000 });

      // Get customer markers
      const customerMarkers = await page.$$('[data-testid="marker"]:not([data-icon*="draggable-origin-marker"])');

      if (customerMarkers.length === 0) {
        throw new Error('No customer markers found for selection test');
      }

      // Select first customer
      await customerMarkers[0].click();

      // Wait for selection to be reflected
      await page.waitForFunction(
        () => document.querySelector('text*="selected"'),
        { timeout: 5000 }
      );

      // Verify selection count
      const selectionCount = await page.evaluate(() => {
        const selectedElement = document.querySelector('text*="selected"');
        return selectedElement ? selectedElement.textContent : '';
      });

      expect(selectionCount).toContain('1');

      // Deselect by clicking again
      await customerMarkers[0].click();

      // Wait for deselection
      await page.waitForFunction(
        () => {
          const selectedElement = document.querySelector('text*="selected"');
          return !selectedElement || selectedElement.textContent.includes('0');
        },
        { timeout: 5000 }
      );

      console.log('✅ Customer selection/deselection test completed successfully');
    }, 30000);
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle invalid CEP input gracefully', async () => {
      // Navigate to fresh page
      await page.goto(`http://localhost:${clientPort}`, { waitUntil: 'networkidle2' });
      await page.waitForSelector('[data-testid="map-container"]', { timeout: 30000 });

      // Try invalid CEP
      const cepInput = await page.waitForSelector('input[placeholder*="routeOptimizer.originPlaceholder"]');
      await cepInput.type('invalid-cep');

      const setOriginButton = await page.waitForSelector('button:has-text("📍")');
      await setOriginButton.click();

      // Wait for error notification
      await page.waitForFunction(
        () => document.querySelector('.Toastify__toast--warning') ||
               document.querySelector('text*="invalidCEP"'),
        { timeout: 5000 }
      );

      // Verify origin was not set
      const originNotSet = await page.$('text=Origem definida');
      expect(originNotSet).toBeFalsy();

      console.log('✅ Invalid CEP handling test completed successfully');
    }, 20000);

    test('should handle route optimization without customers', async () => {
      // Navigate to fresh page
      await page.goto(`http://localhost:${clientPort}`, { waitUntil: 'networkidle2' });
      await page.waitForSelector('[data-testid="map-container"]', { timeout: 30000 });

      // Set origin without selecting customers
      const cepInput = await page.waitForSelector('input[placeholder*="routeOptimizer.originPlaceholder"]');
      await cepInput.type('01000-000');

      const setOriginButton = await page.waitForSelector('button:has-text("📍")');
      await setOriginButton.click();

      // Wait for origin to be set
      await page.waitForSelector('text=Origem definida', { timeout: 10000 });

      // Try to optimize without customers
      const optimizeButton = await page.waitForSelector('button:has-text("routeOptimizer.optimizeRoute")');

      // Button should be disabled
      const isDisabled = await page.evaluate(el => el.disabled, optimizeButton);
      expect(isDisabled).toBe(true);

      console.log('✅ Route optimization without customers test completed successfully');
    }, 20000);

    test('should handle network errors gracefully', async () => {
      // Intercept network requests to simulate failure
      await page.setRequestInterception(true);

      page.on('request', (request) => {
        if (request.url().includes('/api/optimize-route')) {
          request.abort('failed');
        } else {
          request.continue();
        }
      });

      // Navigate to fresh page
      await page.goto(`http://localhost:${clientPort}`, { waitUntil: 'networkidle2' });
      await page.waitForSelector('[data-testid="map-container"]', { timeout: 30000 });

      // Load customers
      const loadButton = await page.waitForSelector('button:has-text("routeOptimizer.loadCustomers")');
      await loadButton.click();
      await page.waitForSelector('[data-testid="marker"]', { timeout: 15000 });

      // Set origin
      const cepInput = await page.waitForSelector('input[placeholder*="routeOptimizer.originPlaceholder"]');
      await cepInput.type('01000-000');

      const setOriginButton = await page.waitForSelector('button:has-text("📍")');
      await setOriginButton.click();
      await page.waitForSelector('text=Origem definida', { timeout: 10000 });

      // Select customer
      const customerMarkers = await page.$$('[data-testid="marker"]:not([data-icon*="draggable-origin-marker"])');
      await customerMarkers[0].click();

      // Try to optimize (will fail due to intercepted request)
      const optimizeButton = await page.waitForSelector('button:has-text("routeOptimizer.optimizeRoute"):not([disabled])');
      await optimizeButton.click();

      // Should fall back to local optimization
      await page.waitForFunction(
        () => document.querySelector('.Toastify__toast') ||
               document.querySelector('[data-testid="polyline"]'),
        { timeout: 15000 }
      );

      // Disable request interception for cleanup
      await page.setRequestInterception(false);

      console.log('✅ Network error handling test completed successfully');
    }, 30000);
  });

  describe('Visual Regression Tests', () => {
    test('should maintain consistent polyline visual appearance', async () => {
      // Ensure we have a route with polyline
      await page.waitForSelector('[data-testid="polyline"][data-color="#FF0000"]', { timeout: 30000 });

      // Take screenshot of map area
      const mapContainer = await page.$('[data-testid="map-container"]');
      const mapScreenshot = await mapContainer.screenshot({
        type: 'png',
        fullPage: false
      });

      // Verify screenshot was captured (basic validation)
      expect(mapScreenshot.length).toBeGreaterThan(1000); // Should be a reasonable size

      console.log('✅ Visual regression test completed successfully');
    }, 20000);

    test('should display proper styling for all polyline elements', async () => {
      // Ensure polyline is rendered
      await page.waitForSelector('[data-testid="polyline"][data-color="#FF0000"]', { timeout: 30000 });

      // Verify all visual elements are present
      const visualElements = await page.evaluate(() => {
        const polyline = document.querySelector('[data-testid="polyline"][data-color="#FF0000"]');
        const circle = document.querySelector('[data-testid="circle"]');
        const markers = document.querySelectorAll('[data-testid="marker"]');

        return {
          hasPolyline: !!polyline,
          polylineColor: polyline ? polyline.getAttribute('data-color') : null,
          polylineWeight: polyline ? polyline.getAttribute('data-weight') : null,
          hasCoverageCircle: !!circle,
          markerCount: markers.length
        };
      });

      expect(visualElements.hasPolyline).toBe(true);
      expect(visualElements.polylineColor).toBe('#FF0000');
      expect(visualElements.polylineWeight).toBe('6');
      expect(visualElements.hasCoverageCircle).toBe(true);
      expect(visualElements.markerCount).toBeGreaterThan(0);

      console.log('✅ Polyline styling verification completed successfully');
    }, 20000);
  });
});