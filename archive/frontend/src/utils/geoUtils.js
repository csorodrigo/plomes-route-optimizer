/**
 * Geospatial utilities for consistent distance calculations
 */

/**
 * Calculate the great circle distance between two points using the Haversine formula
 * @param {number} lat1 - Latitude of first point (degrees)
 * @param {number} lon1 - Longitude of first point (degrees)
 * @param {number} lat2 - Latitude of second point (degrees)
 * @param {number} lon2 - Longitude of second point (degrees)
 * @returns {number} Distance in kilometers
 */
export const calculateDistance = (lat1, lon1, lat2, lon2) => {
  // Validate inputs
  if (typeof lat1 !== 'number' || typeof lon1 !== 'number' || 
      typeof lat2 !== 'number' || typeof lon2 !== 'number') {
    console.warn('calculateDistance: Invalid coordinates provided', { lat1, lon1, lat2, lon2 });
    return Infinity;
  }

  // Earth's radius in kilometers
  const R = 6371;
  
  // Convert degrees to radians
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const lat1Rad = lat1 * Math.PI / 180;
  const lat2Rad = lat2 * Math.PI / 180;

  // Haversine formula
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c;

  return distance;
};

/**
 * Filter customers within a radius from an origin point
 * @param {Array} customers - Array of customer objects with latitude/longitude
 * @param {Object} origin - Origin point with lat/lng properties
 * @param {number} radiusKm - Radius in kilometers
 * @returns {Array} Filtered customers within radius
 */
export const filterCustomersInRadius = (customers, origin, radiusKm) => {
  console.log('🔍 filterCustomersInRadius called with:', { 
    customersLength: customers.length, 
    origin: origin, 
    radiusKm: radiusKm,
    timestamp: new Date().toISOString()
  });
  
  if (!origin || typeof radiusKm !== 'number' || radiusKm <= 0) {
    console.warn('filterCustomersInRadius: Invalid parameters', { origin, radiusKm });
    return [];
  }

  let includedCount = 0;
  
  const filtered = customers.filter(customer => {
    if (!customer.latitude || !customer.longitude) {
      return false;
    }
    
    const distance = calculateDistance(
      origin.lat, origin.lng,
      customer.latitude, customer.longitude
    );
    
    const isWithinRadius = distance <= radiusKm;
    
    // Log customers near the boundary for debugging
    if (process.env.NODE_ENV === 'development' && Math.abs(distance - radiusKm) < 1) {
      const customerInfo = {
        id: customer.id,
        name: customer.name?.substring(0, 20),
        distance: distance.toFixed(6),
        radiusKm,
        isWithinRadius,
        coordinates: [customer.latitude, customer.longitude]
      };
      
      if (isWithinRadius) {
        console.log(`✅ Customer ${customer.id} INCLUDED (near boundary):`, customerInfo);
      } else {
        console.log(`❌ Customer ${customer.id} EXCLUDED (near boundary):`, customerInfo);
      }
    }
    
    if (isWithinRadius) {
      includedCount++;
    }
    
    return isWithinRadius;
  });

  console.log(`🎯 FILTERING SUMMARY: ${includedCount} customers within ${radiusKm}km`);
  console.log(`   Filtered customer IDs: [${filtered.map(c => c.id).join(', ')}]`);

  return filtered;
};

/**
 * Validate coordinates are within Brazil bounds
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {boolean} True if coordinates are within Brazil
 */
export const isValidBrazilCoordinates = (lat, lng) => {
  return lat && lng &&
         lat !== 0 && lng !== 0 &&
         lat >= -35 && lat <= 5 &&
         lng >= -75 && lng <= -30;
};

/**
 * Convert kilometers to meters
 * @param {number} km - Distance in kilometers
 * @returns {number} Distance in meters
 */
export const kmToMeters = (km) => km * 1000;

/**
 * Convert meters to kilometers
 * @param {number} meters - Distance in meters
 * @returns {number} Distance in kilometers
 */
export const metersToKm = (meters) => meters / 1000;