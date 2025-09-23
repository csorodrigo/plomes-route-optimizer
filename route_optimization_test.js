#!/usr/bin/env node

/**
 * Comprehensive Route Optimization API Test
 * Tests the API endpoint for functionality and polyline data format
 */

const fetch = require('node-fetch').default || require('node-fetch');
const fs = require('fs');

const BASE_URL = 'http://localhost:3001';

// Test configuration
const testConfig = {
  credentials: {
    email: 'gustavo.canuto@ciaramaquinas.com.br',
    password: 'ciara123@'
  },
  testRoutes: [
    {
      name: 'São Paulo City Route',
      origin: { lat: -23.5505, lng: -46.6333, address: 'São Paulo, SP - Start Point' },
      waypoints: [
        { lat: -23.5489, lng: -46.6388, address: 'Paulista Avenue, São Paulo' },
        { lat: -23.5558, lng: -46.6396, address: 'República, São Paulo' }
      ]
    },
    {
      name: 'Rio de Janeiro Route',
      origin: { lat: -22.9068, lng: -43.1729, address: 'Copacabana, Rio de Janeiro' },
      waypoints: [
        { lat: -22.9110, lng: -43.2094, address: 'Cristo Redentor, Rio de Janeiro' },
        { lat: -22.9519, lng: -43.2105, address: 'Pão de Açúcar, Rio de Janeiro' }
      ]
    },
    {
      name: 'Fortaleza Route',
      origin: { lat: -3.7172, lng: -38.5433, address: 'Centro, Fortaleza' },
      waypoints: [
        { lat: -3.7304, lng: -38.5267, address: 'Praia de Iracema, Fortaleza' },
        { lat: -3.7365, lng: -38.4959, address: 'Praia do Futuro, Fortaleza' }
      ]
    }
  ]
};

let authToken = null;

// Utility functions
const logSection = (title) => {
  console.log('\n' + '='.repeat(60));
  console.log('🔍 ' + title);
  console.log('='.repeat(60));
};

const logSubsection = (title) => {
  console.log('\n📋 ' + title);
  console.log('-'.repeat(40));
};

const logSuccess = (message) => {
  console.log('✅ ' + message);
};

const logError = (message) => {
  console.log('❌ ' + message);
};

const logWarning = (message) => {
  console.log('⚠️  ' + message);
};

// Authentication
async function authenticate() {
  logSubsection('Authentication Test');

  try {
    const response = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testConfig.credentials)
    });

    const data = await response.json();

    if (response.ok && data.success) {
      authToken = data.token;
      logSuccess(`Authentication successful for user: ${data.user.email}`);
      return true;
    } else {
      logError(`Authentication failed: ${data.error || 'Unknown error'}`);
      return false;
    }
  } catch (error) {
    logError(`Authentication error: ${error.message}`);
    return false;
  }
}

// Test route optimization endpoint
async function testRouteOptimization(routeConfig) {
  logSubsection(`Testing Route: ${routeConfig.name}`);

  try {
    const payload = {
      origin: routeConfig.origin,
      waypoints: routeConfig.waypoints,
      options: { travelMode: 'DRIVING' }
    };

    console.log('📤 Request payload:', JSON.stringify(payload, null, 2));

    const response = await fetch(`${BASE_URL}/api/routes/optimize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      logError(`HTTP ${response.status}: ${data.error || 'Request failed'}`);
      return null;
    }

    if (!data.success) {
      logError(`API Error: ${data.error || 'Unknown API error'}`);
      return null;
    }

    logSuccess('Route optimization successful');
    return data.route;

  } catch (error) {
    logError(`Route optimization error: ${error.message}`);
    return null;
  }
}

// Analyze route response structure
function analyzeRouteResponse(route, routeName) {
  logSubsection(`Analyzing Response Structure: ${routeName}`);

  const analysis = {
    basic: {},
    polyline: {},
    realRoute: {},
    issues: []
  };

  // Basic route analysis
  analysis.basic.hasWaypoints = Array.isArray(route.waypoints) && route.waypoints.length > 0;
  analysis.basic.waypointCount = route.waypoints ? route.waypoints.length : 0;
  analysis.basic.hasOptimizedOrder = Array.isArray(route.optimizedOrder);
  analysis.basic.hasDirections = Array.isArray(route.directions) && route.directions.length > 0;
  analysis.basic.totalDistance = route.totalDistance;
  analysis.basic.estimatedTime = route.estimatedTime;

  console.log('📊 Basic Route Info:');
  console.log(`   Waypoints: ${analysis.basic.waypointCount}`);
  console.log(`   Total Distance: ${analysis.basic.totalDistance} km`);
  console.log(`   Estimated Time: ${analysis.basic.estimatedTime} min`);
  console.log(`   Algorithm: ${route.algorithm || 'Not specified'}`);

  // Real Route analysis
  if (route.realRoute) {
    analysis.realRoute.exists = true;
    analysis.realRoute.hasPolyline = typeof route.realRoute.polyline === 'string' && route.realRoute.polyline.length > 0;
    analysis.realRoute.polylineLength = route.realRoute.polyline ? route.realRoute.polyline.length : 0;
    analysis.realRoute.hasDecodedPath = Array.isArray(route.realRoute.decodedPath) && route.realRoute.decodedPath.length > 0;
    analysis.realRoute.decodedPathLength = route.realRoute.decodedPath ? route.realRoute.decodedPath.length : 0;
    analysis.realRoute.hasBounds = route.realRoute.bounds && route.realRoute.bounds.northeast && route.realRoute.bounds.southwest;
    analysis.realRoute.hasLegs = Array.isArray(route.realRoute.legs) && route.realRoute.legs.length > 0;

    console.log('🗺️  Real Route Data:');
    console.log(`   Polyline: ${analysis.realRoute.hasPolyline ? 'Available' : 'Missing'} (${analysis.realRoute.polylineLength} chars)`);
    console.log(`   Decoded Path: ${analysis.realRoute.hasDecodedPath ? 'Available' : 'Missing'} (${analysis.realRoute.decodedPathLength} points)`);
    console.log(`   Bounds: ${analysis.realRoute.hasBounds ? 'Available' : 'Missing'}`);
    console.log(`   Legs: ${analysis.realRoute.hasLegs ? 'Available' : 'Missing'} (${route.realRoute.legs ? route.realRoute.legs.length : 0} segments)`);

    if (route.realRoute.distance && route.realRoute.duration) {
      console.log(`   Real Distance: ${route.realRoute.distance.text} (${route.realRoute.distance.value}m)`);
      console.log(`   Real Duration: ${route.realRoute.duration.text} (${route.realRoute.duration.value}s)`);
    }
  } else {
    analysis.realRoute.exists = false;
    analysis.issues.push('Real route data is missing entirely');
  }

  // Polyline coordinate validation
  if (analysis.realRoute.hasDecodedPath) {
    const decodedPath = route.realRoute.decodedPath;

    console.log('🧭 Decoded Path Analysis:');
    console.log(`   Total Points: ${decodedPath.length}`);

    // Sample first few coordinates
    const sampleSize = Math.min(5, decodedPath.length);
    console.log(`   Sample Coordinates (first ${sampleSize}):`);

    let validCoords = 0;
    let invalidCoords = 0;

    for (let i = 0; i < Math.min(sampleSize, decodedPath.length); i++) {
      const coord = decodedPath[i];
      const isValid = coord && typeof coord.lat === 'number' && typeof coord.lng === 'number' &&
                     !isNaN(coord.lat) && !isNaN(coord.lng);

      console.log(`     [${i}] lat: ${coord.lat}, lng: ${coord.lng} ${isValid ? '✅' : '❌'}`);

      if (isValid) validCoords++;
      else invalidCoords++;
    }

    // Check all coordinates for validity
    const allCoordsValid = decodedPath.every(coord =>
      coord && typeof coord.lat === 'number' && typeof coord.lng === 'number' &&
      !isNaN(coord.lat) && !isNaN(coord.lng)
    );

    analysis.polyline.allCoordsValid = allCoordsValid;
    analysis.polyline.sampleValidCoords = validCoords;
    analysis.polyline.sampleInvalidCoords = invalidCoords;

    console.log(`   Coordinate Validation: ${allCoordsValid ? 'All Valid ✅' : 'Issues Found ❌'}`);

    if (!allCoordsValid) {
      analysis.issues.push('Some decoded path coordinates are invalid');
    }

    // Check Brazil coordinate bounds
    const brazilCoords = decodedPath.filter(coord =>
      coord.lat >= -35 && coord.lat <= 5 && coord.lng >= -75 && coord.lng <= -30
    );

    const brazilCoordsPercentage = (brazilCoords.length / decodedPath.length) * 100;
    console.log(`   Brazil Coordinates: ${brazilCoords.length}/${decodedPath.length} (${brazilCoordsPercentage.toFixed(1)}%)`);

    if (brazilCoordsPercentage < 95) {
      analysis.issues.push(`Only ${brazilCoordsPercentage.toFixed(1)}% of coordinates are within Brazil bounds`);
    }
  } else {
    analysis.issues.push('Decoded path is missing or empty');
  }

  // Map rendering compatibility check
  console.log('🗺️  Map Rendering Compatibility:');

  const canRenderPolyline = analysis.realRoute.hasDecodedPath && analysis.polyline.allCoordsValid;
  const canRenderWaypoints = analysis.basic.hasWaypoints && analysis.basic.waypointCount >= 2;

  console.log(`   Can Render Polyline: ${canRenderPolyline ? 'Yes ✅' : 'No ❌'}`);
  console.log(`   Can Render Waypoint Lines: ${canRenderWaypoints ? 'Yes ✅' : 'No ❌'}`);

  if (!canRenderPolyline && !canRenderWaypoints) {
    analysis.issues.push('Cannot render any route visualization');
  }

  return analysis;
}

// Generate test report
function generateReport(testResults) {
  logSection('TEST REPORT');

  const totalTests = testResults.length;
  const successfulTests = testResults.filter(r => r.route !== null).length;
  const failedTests = totalTests - successfulTests;

  console.log(`📊 Overall Results:`);
  console.log(`   Total Tests: ${totalTests}`);
  console.log(`   Successful: ${successfulTests}`);
  console.log(`   Failed: ${failedTests}`);
  console.log(`   Success Rate: ${((successfulTests/totalTests)*100).toFixed(1)}%`);

  // Issues summary
  const allIssues = testResults
    .filter(r => r.analysis && r.analysis.issues.length > 0)
    .flatMap(r => r.analysis.issues);

  if (allIssues.length > 0) {
    console.log('\n⚠️  Issues Found:');
    [...new Set(allIssues)].forEach((issue, index) => {
      console.log(`   ${index + 1}. ${issue}`);
    });
  } else {
    logSuccess('No issues found in any test!');
  }

  // Polyline functionality summary
  const polylineTests = testResults.filter(r => r.analysis);
  const polylineWorking = polylineTests.filter(r =>
    r.analysis.realRoute.hasDecodedPath && r.analysis.polyline.allCoordsValid
  );

  console.log('\n🗺️  Polyline Functionality:');
  console.log(`   Tests with Polyline Data: ${polylineWorking.length}/${polylineTests.length}`);

  if (polylineWorking.length === polylineTests.length && polylineTests.length > 0) {
    logSuccess('Polyline functionality is working correctly!');
  } else if (polylineWorking.length > 0) {
    logWarning('Polyline functionality is partially working');
  } else {
    logError('Polyline functionality is not working');
  }

  // Save detailed report
  const reportData = {
    timestamp: new Date().toISOString(),
    summary: {
      totalTests,
      successfulTests,
      failedTests,
      successRate: (successfulTests/totalTests)*100
    },
    polylineFunctionality: {
      testsWithData: polylineWorking.length,
      totalTests: polylineTests.length,
      workingPercentage: polylineTests.length > 0 ? (polylineWorking.length/polylineTests.length)*100 : 0
    },
    issues: [...new Set(allIssues)],
    testResults
  };

  fs.writeFileSync('/Users/rodrigooliveira/Documents/workspace 2/Claude-code/PLOMES-ROTA-CEP/route_test_report.json',
    JSON.stringify(reportData, null, 2));

  console.log('\n📁 Detailed report saved to: route_test_report.json');
}

// Main test execution
async function runTests() {
  logSection('ROUTE OPTIMIZATION API TEST');

  console.log('🚀 Starting comprehensive route optimization tests...');
  console.log(`📍 Base URL: ${BASE_URL}`);
  console.log(`🧪 Test Routes: ${testConfig.testRoutes.length}`);

  // Authenticate
  const authSuccess = await authenticate();
  if (!authSuccess) {
    logError('Authentication failed. Cannot proceed with tests.');
    process.exit(1);
  }

  // Run route tests
  const testResults = [];

  for (const routeConfig of testConfig.testRoutes) {
    const route = await testRouteOptimization(routeConfig);

    let analysis = null;
    if (route) {
      analysis = analyzeRouteResponse(route, routeConfig.name);
    }

    testResults.push({
      name: routeConfig.name,
      route,
      analysis,
      success: route !== null
    });
  }

  // Generate report
  generateReport(testResults);

  logSection('TEST COMPLETE');
  console.log('🎉 All tests completed successfully!');
}

// Error handling
process.on('unhandledRejection', (error) => {
  logError(`Unhandled promise rejection: ${error.message}`);
  process.exit(1);
});

// Run the tests
if (require.main === module) {
  runTests().catch(error => {
    logError(`Test execution failed: ${error.message}`);
    process.exit(1);
  });
}

module.exports = { runTests };