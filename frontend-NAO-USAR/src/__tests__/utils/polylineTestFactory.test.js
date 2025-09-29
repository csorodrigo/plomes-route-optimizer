import PolylineTestFactory from './polylineTestFactory';

describe('PolylineTestFactory', () => {
  describe('Factory Methods', () => {
    test('should create mock customers with valid data', () => {
      const customers = PolylineTestFactory.createMockCustomers(3);

      expect(customers).toHaveLength(3);
      expect(customers[0]).toHaveProperty('id');
      expect(customers[0]).toHaveProperty('name');
      expect(customers[0]).toHaveProperty('latitude');
      expect(customers[0]).toHaveProperty('longitude');
      expect(typeof customers[0].latitude).toBe('number');
      expect(typeof customers[0].longitude).toBe('number');
    });

    test('should create mock origin with valid coordinates', () => {
      const origin = PolylineTestFactory.createMockOrigin();

      expect(origin).toHaveProperty('lat');
      expect(origin).toHaveProperty('lng');
      expect(origin).toHaveProperty('address');
      expect(typeof origin.lat).toBe('number');
      expect(typeof origin.lng).toBe('number');
    });

    test('should create route with real data', () => {
      const route = PolylineTestFactory.createRouteWithRealData();

      expect(route).toHaveProperty('waypoints');
      expect(route).toHaveProperty('realRoute');
      expect(route.realRoute).toHaveProperty('decodedPath');
      expect(Array.isArray(route.realRoute.decodedPath)).toBe(true);
      expect(route.realRoute.decodedPath.length).toBeGreaterThan(0);
    });

    test('should validate coordinate format correctly', () => {
      const validCoords = [[1, 2], [3, 4]];
      const invalidCoords = [['invalid', 2], [3, 'invalid']];

      expect(PolylineTestFactory.validateCoordinateFormat(validCoords)).toBe(true);
      expect(PolylineTestFactory.validateCoordinateFormat(invalidCoords)).toBe(false);
    });
  });
});