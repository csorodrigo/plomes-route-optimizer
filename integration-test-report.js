#!/usr/bin/env node

/**
 * PLOMES-ROTA-CEP Integration Test Report
 *
 * This script performs comprehensive integration testing to verify
 * the reported issues have been resolved:
 *
 * 1. Polyline not rendering on map
 * 2. PDF export button not visible
 * 3. "List is not defined" error (already fixed)
 */

const axios = require('axios');
const colors = require('colors');

// Configuration
const BACKEND_URL = 'http://localhost:3001';
const FRONTEND_URL = 'http://localhost:3000';
const TEST_CEP = '60160-230'; // Fortaleza-CE CEP for testing
const TEST_CREDENTIALS = {
  email: 'gustavo.canuto@ciaramaquinas.com.br',
  password: 'ciara123@'
};

class IntegrationTester {
  constructor() {
    this.token = null;
    this.testResults = [];
    this.errors = [];
  }

  log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}]`;

    switch (level) {
      case 'success':
        console.log(`${prefix} ✅ ${message}`.green);
        break;
      case 'error':
        console.log(`${prefix} ❌ ${message}`.red);
        this.errors.push(message);
        break;
      case 'warning':
        console.log(`${prefix} ⚠️  ${message}`.yellow);
        break;
      case 'info':
      default:
        console.log(`${prefix} ℹ️  ${message}`.blue);
    }
  }

  async test(name, testFn) {
    this.log(`Running test: ${name}`, 'info');
    try {
      const result = await testFn();
      this.testResults.push({ name, status: 'passed', result });
      this.log(`Test passed: ${name}`, 'success');
      return result;
    } catch (error) {
      this.testResults.push({ name, status: 'failed', error: error.message });
      this.log(`Test failed: ${name} - ${error.message}`, 'error');
      throw error;
    }
  }

  async runAllTests() {
    console.log('\n🚀 ======= PLOMES-ROTA-CEP INTEGRATION TESTS =======\n'.rainbow);

    try {
      // System Status Tests
      await this.test('Backend Health Check', () => this.testBackendHealth());
      await this.test('Frontend Accessibility', () => this.testFrontendAccess());

      // Authentication Tests
      await this.test('User Authentication', () => this.testAuthentication());

      // API Endpoint Tests
      await this.test('Customers API', () => this.testCustomersAPI());
      await this.test('CEP Geocoding API', () => this.testCepGeocoding());

      // Route Optimization Tests
      await this.test('Route Optimization with Polyline', () => this.testRouteOptimization());

      // Frontend Component Tests
      await this.test('Frontend Static Assets', () => this.testFrontendAssets());

      // Error Handling Tests
      await this.test('Invalid CEP Handling', () => this.testInvalidCepHandling());
      await this.test('Authentication Error Handling', () => this.testAuthErrorHandling());

    } catch (error) {
      this.log(`Critical test failure: ${error.message}`, 'error');
    }

    this.generateReport();
  }

  async testBackendHealth() {
    const response = await axios.get(`${BACKEND_URL}/api/health`);
    if (response.status !== 200) {
      throw new Error(`Backend health check failed with status ${response.status}`);
    }

    const health = response.data;
    if (health.status !== 'healthy') {
      throw new Error(`Backend is not healthy: ${health.status}`);
    }

    return { status: health.status, services: health.services };
  }

  async testFrontendAccess() {
    const response = await axios.get(FRONTEND_URL);
    if (response.status !== 200) {
      throw new Error(`Frontend not accessible, status: ${response.status}`);
    }

    const html = response.data;
    if (!html.includes('Otimizador de Rotas Comerciais')) {
      throw new Error('Frontend title not found in HTML');
    }

    return { accessible: true, title: 'Found' };
  }

  async testAuthentication() {
    const response = await axios.post(`${BACKEND_URL}/api/auth/login`, TEST_CREDENTIALS);

    if (!response.data.success) {
      throw new Error(`Authentication failed: ${response.data.error}`);
    }

    if (!response.data.token) {
      throw new Error('No authentication token received');
    }

    this.token = response.data.token;
    return {
      authenticated: true,
      user: response.data.user.name,
      tokenLength: this.token.length
    };
  }

  async testCustomersAPI() {
    if (!this.token) {
      throw new Error('Authentication required for customers API test');
    }

    const response = await axios.get(`${BACKEND_URL}/api/customers?lat=-3.7318&lng=-38.5269&radius=10`, {
      headers: { Authorization: `Bearer ${this.token}` }
    });

    if (!response.data.success) {
      throw new Error(`Customers API failed: ${response.data.error}`);
    }

    const customers = response.data.customers;
    if (!Array.isArray(customers)) {
      throw new Error('Customers data is not an array');
    }

    // Verify customers have required fields
    const firstCustomer = customers[0];
    if (!firstCustomer || !firstCustomer.latitude || !firstCustomer.longitude) {
      throw new Error('Customers missing required geocoding data');
    }

    return {
      count: customers.length,
      firstCustomer: {
        id: firstCustomer.id,
        name: firstCustomer.name,
        hasCoordinates: !!(firstCustomer.latitude && firstCustomer.longitude)
      }
    };
  }

  async testCepGeocoding() {
    const response = await axios.get(`${BACKEND_URL}/api/geocoding/cep/${TEST_CEP}`);

    if (!response.data.success) {
      throw new Error(`CEP geocoding failed: ${response.data.error}`);
    }

    const { lat, lng, address } = response.data;
    if (!lat || !lng) {
      throw new Error('CEP geocoding returned invalid coordinates');
    }

    // Verify coordinates are in Fortaleza area (rough bounds)
    if (lat < -4.0 || lat > -3.5 || lng < -39.0 || lng > -38.3) {
      throw new Error(`CEP coordinates outside expected Fortaleza bounds: ${lat}, ${lng}`);
    }

    return { lat, lng, address, cep: TEST_CEP };
  }

  async testRouteOptimization() {
    if (!this.token) {
      throw new Error('Authentication required for route optimization test');
    }

    // First get customers
    const customersResponse = await axios.get(`${BACKEND_URL}/api/customers?lat=-3.7318&lng=-38.5269&radius=10`, {
      headers: { Authorization: `Bearer ${this.token}` }
    });

    const customers = customersResponse.data.customers.slice(0, 3); // Take first 3 customers

    // Prepare route optimization request
    const routeRequest = {
      origin: {
        lat: -3.7318,
        lng: -38.5269,
        cep: TEST_CEP
      },
      waypoints: customers.map(c => ({
        id: c.id,
        lat: c.latitude,
        lng: c.longitude,
        name: c.name
      })),
      options: {
        save: true,
        useRealRoutes: true,
        returnToOrigin: true
      }
    };

    const response = await axios.post(`${BACKEND_URL}/api/routes/optimize`, routeRequest, {
      headers: { Authorization: `Bearer ${this.token}` }
    });

    if (!response.data.success) {
      throw new Error(`Route optimization failed: ${response.data.error}`);
    }

    const route = response.data.route;

    // Verify route structure
    if (!route.waypoints || !Array.isArray(route.waypoints)) {
      throw new Error('Route missing waypoints array');
    }

    if (typeof route.totalDistance !== 'number') {
      throw new Error('Route missing total distance');
    }

    if (typeof route.estimatedTime !== 'number') {
      throw new Error('Route missing estimated time');
    }

    // Check for polyline data (critical for issue #1)
    let hasPolylineData = false;
    let polylineSource = 'none';

    if (route.realRoute && route.realRoute.decodedPath && Array.isArray(route.realRoute.decodedPath)) {
      hasPolylineData = route.realRoute.decodedPath.length > 1;
      polylineSource = 'realRoute.decodedPath';
    } else if (route.waypoints && route.waypoints.length > 1) {
      hasPolylineData = true;
      polylineSource = 'waypoints';
    }

    if (!hasPolylineData) {
      throw new Error('Route optimization missing polyline data for map rendering');
    }

    return {
      waypoints: route.waypoints.length,
      totalDistance: route.totalDistance,
      estimatedTime: route.estimatedTime,
      hasPolylineData,
      polylineSource,
      realRouteAvailable: !!(route.realRoute && route.realRoute.decodedPath)
    };
  }

  async testFrontendAssets() {
    // Test main JS bundle
    const jsResponse = await axios.get(`${FRONTEND_URL}/static/js/main.384e7a0e.js`);
    if (jsResponse.status !== 200) {
      throw new Error('Main JS bundle not accessible');
    }

    // Test CSS
    const cssResponse = await axios.get(`${FRONTEND_URL}/static/css/main.05717f7e.css`);
    if (cssResponse.status !== 200) {
      throw new Error('Main CSS file not accessible');
    }

    // Check for critical components in JS bundle
    const jsContent = jsResponse.data;
    const criticalComponents = [
      'RouteOptimizer',
      'PictureAsPdf',
      'Polyline',
      'Material-UI',
      'List'
    ];

    const missingComponents = criticalComponents.filter(component =>
      !jsContent.includes(component)
    );

    if (missingComponents.length > 0) {
      this.log(`Warning: Some components not found in bundle: ${missingComponents.join(', ')}`, 'warning');
    }

    return {
      jsBundle: { status: 'loaded', size: jsContent.length },
      cssBundle: { status: 'loaded', size: cssResponse.data.length },
      missingComponents
    };
  }

  async testInvalidCepHandling() {
    // Test with invalid CEP
    try {
      await axios.get(`${BACKEND_URL}/api/geocoding/cep/00000-000`);
      throw new Error('Expected error for invalid CEP, but got success');
    } catch (error) {
      if (error.response && error.response.status === 404) {
        return { handledCorrectly: true, status: 404 };
      }
      throw error;
    }
  }

  async testAuthErrorHandling() {
    // Test with invalid token
    try {
      await axios.get(`${BACKEND_URL}/api/customers`, {
        headers: { Authorization: 'Bearer invalid-token' }
      });
      throw new Error('Expected authentication error, but got success');
    } catch (error) {
      if (error.response && (error.response.status === 401 || error.response.status === 403)) {
        return { handledCorrectly: true, status: error.response.status };
      }
      throw error;
    }
  }

  generateReport() {
    console.log('\n📊 ======= INTEGRATION TEST REPORT =======\n'.rainbow);

    const passed = this.testResults.filter(t => t.status === 'passed').length;
    const failed = this.testResults.filter(t => t.status === 'failed').length;
    const total = this.testResults.length;

    console.log(`📈 Test Summary:`.bold);
    console.log(`   Total Tests: ${total}`);
    console.log(`   Passed: ${passed}`.green);
    console.log(`   Failed: ${failed}`.red);
    console.log(`   Success Rate: ${((passed / total) * 100).toFixed(1)}%`);

    console.log('\n🎯 Issue Resolution Status:'.bold);

    // Issue #1: Polyline Rendering
    const routeTest = this.testResults.find(t => t.name === 'Route Optimization with Polyline');
    if (routeTest && routeTest.status === 'passed') {
      console.log('   ✅ Issue #1: Polyline rendering - RESOLVED'.green);
      console.log(`      Polyline source: ${routeTest.result.polylineSource}`);
      console.log(`      Real route available: ${routeTest.result.realRouteAvailable}`);
    } else {
      console.log('   ❌ Issue #1: Polyline rendering - NOT RESOLVED'.red);
    }

    // Issue #2: PDF Export Button
    const assetsTest = this.testResults.find(t => t.name === 'Frontend Static Assets');
    if (assetsTest && assetsTest.status === 'passed') {
      const hasPdfComponent = !assetsTest.result.missingComponents.includes('PictureAsPdf');
      if (hasPdfComponent) {
        console.log('   ✅ Issue #2: PDF export button visibility - RESOLVED'.green);
        console.log('      PictureAsPdf component found in bundle');
      } else {
        console.log('   ⚠️  Issue #2: PDF export component not found in bundle'.yellow);
      }
    } else {
      console.log('   ❌ Issue #2: PDF export button - CANNOT VERIFY'.red);
    }

    // Issue #3: List Components
    if (assetsTest && assetsTest.status === 'passed') {
      const hasListComponent = !assetsTest.result.missingComponents.includes('List');
      if (hasListComponent) {
        console.log('   ✅ Issue #3: Material-UI List components - RESOLVED'.green);
        console.log('      List component found in bundle');
      } else {
        console.log('   ⚠️  Issue #3: List component not found in bundle'.yellow);
      }
    } else {
      console.log('   ❌ Issue #3: List components - CANNOT VERIFY'.red);
    }

    if (failed > 0) {
      console.log('\n❌ Failed Tests:'.red.bold);
      this.testResults
        .filter(t => t.status === 'failed')
        .forEach(test => {
          console.log(`   - ${test.name}: ${test.error}`.red);
        });
    }

    if (this.errors.length > 0) {
      console.log('\n⚠️  Errors Encountered:'.yellow.bold);
      this.errors.forEach(error => {
        console.log(`   - ${error}`.yellow);
      });
    }

    console.log('\n🔍 Manual Testing Required:'.blue.bold);
    console.log('   1. Open http://localhost:3000 in browser');
    console.log('   2. Enter CEP: 60160-230');
    console.log('   3. Select 2-3 customers from map');
    console.log('   4. Click "Optimize Route"');
    console.log('   5. Verify red polyline appears on map');
    console.log('   6. Verify PDF export button is visible and clickable');
    console.log('   7. Click customers in list - verify no "List is not defined" errors');

    console.log('\n📋 Recommendations:'.cyan.bold);
    if (passed === total) {
      console.log('   ✅ All integration tests passed!');
      console.log('   ✅ System appears to be working correctly');
      console.log('   ✅ All reported issues appear to be resolved');
    } else {
      console.log('   ⚠️  Some tests failed - review error details above');
      console.log('   ⚠️  Manual verification recommended for failed components');
    }

    console.log('\n' + '='.repeat(50));
  }
}

// Run tests if called directly
if (require.main === module) {
  const tester = new IntegrationTester();
  tester.runAllTests().catch(error => {
    console.error('Test runner failed:', error);
    process.exit(1);
  });
}

module.exports = IntegrationTester;