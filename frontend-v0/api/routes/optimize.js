// Vercel Serverless Function for Route Optimization
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key-for-demo';

function verifyToken(req) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('No token provided');
  }

  const token = authHeader.substring(7);
  return jwt.verify(token, JWT_SECRET);
}

// Simple distance calculation using Haversine formula
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Simple nearest neighbor TSP approximation
function optimizeRoute(waypoints, origin) {
  if (waypoints.length <= 1) {
    return {
      totalDistance: 0,
      estimatedTime: 0,
      waypoints: [origin, ...waypoints],
      optimizedOrder: [0, ...waypoints.map((_, i) => i + 1)]
    };
  }

  const unvisited = [...waypoints];
  const route = [origin];
  let current = origin;
  let totalDistance = 0;

  while (unvisited.length > 0) {
    let nearestIndex = 0;
    let nearestDistance = Infinity;

    // Find nearest unvisited waypoint
    for (let i = 0; i < unvisited.length; i++) {
      const distance = calculateDistance(
        current.lat, current.lng,
        unvisited[i].lat, unvisited[i].lng
      );

      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = i;
      }
    }

    // Move to nearest waypoint
    const nearest = unvisited.splice(nearestIndex, 1)[0];
    route.push(nearest);
    totalDistance += nearestDistance;
    current = nearest;
  }

  const estimatedTime = totalDistance * 2; // Rough estimate: 2 minutes per km

  return {
    totalDistance: Math.round(totalDistance * 100) / 100,
    estimatedTime: Math.round(estimatedTime),
    waypoints: route,
    optimizedOrder: route.map((_, i) => i)
  };
}

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
  }

  try {
    // Note: Auth is optional for route optimization in the original code
    // You can uncomment the line below to require authentication
    // verifyToken(req);

    const { origin, waypoints, options = {} } = req.body;

    if (!origin || !waypoints) {
      return res.status(400).json({
        success: false,
        error: 'Origin and waypoints required'
      });
    }

    if (!origin.lat || !origin.lng) {
      return res.status(400).json({
        success: false,
        error: 'Origin must have lat and lng coordinates'
      });
    }

    if (!Array.isArray(waypoints) || waypoints.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Waypoints must be a non-empty array'
      });
    }

    // Validate waypoints
    for (let i = 0; i < waypoints.length; i++) {
      const waypoint = waypoints[i];
      if (!waypoint.lat || !waypoint.lng) {
        return res.status(400).json({
          success: false,
          error: `Waypoint ${i + 1} must have lat and lng coordinates`
        });
      }
    }

    // Optimize the route
    const optimizedRoute = optimizeRoute(waypoints, origin);

    return res.status(200).json({
      success: true,
      route: optimizedRoute
    });

  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired token'
      });
    }

    console.error('Route optimization error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}