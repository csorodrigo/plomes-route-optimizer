/**
 * Test data factories for polyline rendering scenarios
 * This module provides standardized test data for various polyline test cases
 */

export const PolylineTestFactory = {
  /**
   * Creates mock customer data for testing
   */
  createMockCustomers: (count = 3) => {
    const baseCustomers = [
      {
        id: '1',
        name: 'Customer Alpha',
        latitude: -23.5505,
        longitude: -46.6333,
        street_address: 'Rua Augusta, 123',
        city: 'São Paulo',
        cep: '01305-000'
      },
      {
        id: '2',
        name: 'Customer Beta',
        latitude: -23.5515,
        longitude: -46.6343,
        street_address: 'Av. Paulista, 456',
        city: 'São Paulo',
        cep: '01310-100'
      },
      {
        id: '3',
        name: 'Customer Gamma',
        latitude: -23.5525,
        longitude: -46.6353,
        street_address: 'Rua Oscar Freire, 789',
        city: 'São Paulo',
        cep: '01426-001'
      },
      {
        id: '4',
        name: 'Customer Delta',
        latitude: -23.5535,
        longitude: -46.6363,
        street_address: 'Rua Haddock Lobo, 321',
        city: 'São Paulo',
        cep: '01414-001'
      },
      {
        id: '5',
        name: 'Customer Epsilon',
        latitude: -23.5545,
        longitude: -46.6373,
        street_address: 'Alameda Santos, 654',
        city: 'São Paulo',
        cep: '01419-001'
      }
    ];

    return baseCustomers.slice(0, count);
  },

  /**
   * Creates mock origin point
   */
  createMockOrigin: () => ({
    lat: -23.5505,
    lng: -46.6333,
    address: 'CEP 01000-000 - Centro, São Paulo'
  }),

  /**
   * Creates route with real decoded path data (Google Maps/OpenRoute style)
   */
  createRouteWithRealData: (customers = null, origin = null) => {
    const testCustomers = customers || PolylineTestFactory.createMockCustomers(2);
    const testOrigin = origin || PolylineTestFactory.createMockOrigin();

    return {
      waypoints: [
        { ...testOrigin, name: 'Origem' },
        ...testCustomers.map(c => ({
          lat: c.latitude,
          lng: c.longitude,
          name: c.name,
          id: c.id
        })),
        { ...testOrigin, name: 'Origem' }
      ],
      totalDistance: 5.2,
      estimatedTime: 18,
      realRoute: {
        decodedPath: [
          { lat: testOrigin.lat, lng: testOrigin.lng },
          { lat: testOrigin.lat + 0.001, lng: testOrigin.lng + 0.001 },
          { lat: testOrigin.lat + 0.002, lng: testOrigin.lng + 0.002 },
          { lat: testCustomers[0].latitude - 0.001, lng: testCustomers[0].longitude - 0.001 },
          { lat: testCustomers[0].latitude, lng: testCustomers[0].longitude },
          { lat: testCustomers[0].latitude + 0.001, lng: testCustomers[0].longitude + 0.001 },
          { lat: testCustomers[1].latitude - 0.001, lng: testCustomers[1].longitude - 0.001 },
          { lat: testCustomers[1].latitude, lng: testCustomers[1].longitude },
          { lat: testCustomers[1].latitude - 0.002, lng: testCustomers[1].longitude - 0.001 },
          { lat: testOrigin.lat + 0.001, lng: testOrigin.lng + 0.002 },
          { lat: testOrigin.lat, lng: testOrigin.lng }
        ],
        duration: 1080, // seconds
        distance: 5200 // meters
      }
    };
  },

  /**
   * Creates route without real data (fallback to waypoints)
   */
  createRouteWithoutRealData: (customers = null, origin = null) => {
    const testCustomers = customers || PolylineTestFactory.createMockCustomers(2);
    const testOrigin = origin || PolylineTestFactory.createMockOrigin();

    return {
      waypoints: [
        { ...testOrigin, name: 'Origem' },
        ...testCustomers.map(c => ({
          lat: c.latitude,
          lng: c.longitude,
          name: c.name,
          id: c.id
        })),
        { ...testOrigin, name: 'Origem' }
      ],
      totalDistance: 4.1,
      estimatedTime: 15
    };
  },

  /**
   * Creates route with invalid coordinate data for error testing
   */
  createRouteWithInvalidCoordinates: () => ({
    waypoints: [
      { lat: 'invalid', lng: -46.6333, name: 'Invalid Origin' },
      { lat: -23.5515, lng: 'not-a-number', name: 'Invalid Customer A' },
      { lat: null, lng: undefined, name: 'Null Customer B' },
      { lat: NaN, lng: Infinity, name: 'NaN Customer C' }
    ],
    totalDistance: 0,
    estimatedTime: 0,
    realRoute: {
      decodedPath: [
        { lat: 'invalid', lng: -46.6333 },
        { lat: -23.5515, lng: 'not-a-number' },
        { lat: null, lng: undefined }
      ]
    }
  }),

  /**
   * Creates route with insufficient coordinates (single point)
   */
  createRouteWithInsufficientCoordinates: () => ({
    waypoints: [
      { lat: -23.5505, lng: -46.6333, name: 'Origem' }
    ],
    totalDistance: 0,
    estimatedTime: 0
  }),

  /**
   * Creates empty route for no-data scenarios
   */
  createEmptyRoute: () => ({
    waypoints: [],
    totalDistance: 0,
    estimatedTime: 0
  }),

  /**
   * Creates complex route with many waypoints for performance testing
   */
  createComplexRoute: (waypointCount = 20) => {
    const customers = PolylineTestFactory.createMockCustomers(5);
    const origin = PolylineTestFactory.createMockOrigin();

    // Generate waypoints in a spiral pattern
    const waypoints = [{ ...origin, name: 'Origem' }];

    for (let i = 0; i < waypointCount; i++) {
      const angle = (i / waypointCount) * 2 * Math.PI;
      const radius = 0.01 * (i + 1) / waypointCount; // Spiral outward

      waypoints.push({
        lat: origin.lat + radius * Math.cos(angle),
        lng: origin.lng + radius * Math.sin(angle),
        name: `Waypoint ${i + 1}`,
        id: `wp_${i + 1}`
      });
    }

    waypoints.push({ ...origin, name: 'Origem' }); // Return to origin

    // Generate detailed decoded path
    const decodedPath = [];
    for (let i = 0; i < waypoints.length - 1; i++) {
      const start = waypoints[i];
      const end = waypoints[i + 1];

      // Add intermediate points between waypoints
      for (let j = 0; j <= 5; j++) {
        const ratio = j / 5;
        decodedPath.push({
          lat: start.lat + (end.lat - start.lat) * ratio,
          lng: start.lng + (end.lng - start.lng) * ratio
        });
      }
    }

    return {
      waypoints,
      totalDistance: 25.8,
      estimatedTime: 90,
      realRoute: {
        decodedPath,
        duration: 5400, // 90 minutes
        distance: 25800 // meters
      }
    };
  },

  /**
   * Creates route with overlapping coordinates for testing marker clustering
   */
  createRouteWithOverlappingCoordinates: () => {
    const origin = PolylineTestFactory.createMockOrigin();
    const sameLocation = { lat: -23.5515, lng: -46.6343 };

    return {
      waypoints: [
        { ...origin, name: 'Origem' },
        { ...sameLocation, name: 'Customer A', id: '1' },
        { ...sameLocation, name: 'Customer B', id: '2' },
        { ...sameLocation, name: 'Customer C', id: '3' },
        { ...origin, name: 'Origem' }
      ],
      totalDistance: 1.2,
      estimatedTime: 8,
      realRoute: {
        decodedPath: [
          { lat: origin.lat, lng: origin.lng },
          { lat: sameLocation.lat, lng: sameLocation.lng },
          { lat: origin.lat, lng: origin.lng }
        ]
      }
    };
  },

  /**
   * Creates API response mock for successful route optimization
   */
  createSuccessfulOptimizationResponse: (route = null) => ({
    success: true,
    route: route || PolylineTestFactory.createRouteWithRealData()
  }),

  /**
   * Creates API response mock for failed route optimization
   */
  createFailedOptimizationResponse: (error = 'Route optimization failed') => ({
    success: false,
    error
  }),

  /**
   * Creates coordinates for testing Brazilian locations
   */
  createBrazilianCoordinates: () => ({
    saoPaulo: { lat: -23.5505, lng: -46.6333 },
    rioDeJaneiro: { lat: -22.9068, lng: -43.1729 },
    brasilia: { lat: -15.7942, lng: -47.8822 },
    fortaleza: { lat: -3.7319, lng: -38.5267 },
    recife: { lat: -8.0476, lng: -34.8770 },
    salvador: { lat: -12.9714, lng: -38.5014 },
    beloHorizonte: { lat: -19.9191, lng: -43.9386 },
    curitiba: { lat: -25.4296, lng: -49.2713 },
    portoAlegre: { lat: -30.0346, lng: -51.2177 },
    manaus: { lat: -3.1190, lng: -60.0217 }
  }),

  /**
   * Creates test coordinates outside Brazil for validation testing
   */
  createInvalidCoordinates: () => ({
    newYork: { lat: 40.7128, lng: -74.0060 },
    london: { lat: 51.5074, lng: -0.1278 },
    tokyo: { lat: 35.6762, lng: 139.6503 },
    antarctica: { lat: -90.0000, lng: 0.0000 },
    northPole: { lat: 90.0000, lng: 0.0000 }
  }),

  /**
   * Creates polyline style configurations for testing
   */
  createPolylineStyles: () => ({
    route: {
      color: '#FF0000',
      weight: 6,
      opacity: 1.0,
      pane: 'overlayPane'
    },
    testPolyline: {
      color: '#00FF00',
      weight: 3,
      opacity: 0.8,
      dashArray: '5, 10'
    },
    coverage: {
      fillColor: '#007bff',
      fillOpacity: 0.1,
      color: '#007bff',
      weight: 2
    }
  }),

  /**
   * Creates mock console output for testing logging
   */
  createExpectedConsoleOutput: () => ({
    noRoute: '🗺️ No route data available for polyline',
    realRoute: '🗺️ Using real route polyline with',
    waypoints: '🗺️ Using waypoint straight-line polyline with',
    invalidCoords: 'Invalid coordinate format detected',
    insufficientCoords: 'Insufficient coordinates for polyline',
    pathSource: '🗺️ Path source:',
    rendering: '🗺️ Rendering polyline with'
  }),

  /**
   * Validates that coordinates are in expected format
   */
  validateCoordinateFormat: (coordinates) => {
    if (!Array.isArray(coordinates)) return false;

    return coordinates.every(coord =>
      Array.isArray(coord) &&
      coord.length === 2 &&
      typeof coord[0] === 'number' &&
      typeof coord[1] === 'number' &&
      !isNaN(coord[0]) &&
      !isNaN(coord[1])
    );
  },

  /**
   * Creates performance benchmarks for polyline rendering
   */
  createPerformanceBenchmarks: () => ({
    maxRenderTime: 100, // milliseconds
    maxCoordinateCount: 1000,
    minCoordinateCount: 2,
    expectedMemoryUsage: 50 // MB
  })
};

export default PolylineTestFactory;