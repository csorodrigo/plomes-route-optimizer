// Vercel Serverless Function for Route Optimization
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key-for-demo';
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const OPENROUTE_API_KEY = process.env.OPENROUTE_API_KEY;

function verifyToken(req) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('No token provided');
  }

  const token = authHeader.substring(7);
  return jwt.verify(token, JWT_SECRET);
}

// Simple distance calculation using Haversine formula (fallback only)
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

// Get actual road distance and duration using Google Maps Directions API
async function getGoogleMapsRoute(origin, destination) {
  if (!GOOGLE_MAPS_API_KEY) {
    throw new Error('Google Maps API key not configured');
  }

  const url = `https://maps.googleapis.com/maps/api/directions/json?` +
    `origin=${origin.lat},${origin.lng}&` +
    `destination=${destination.lat},${destination.lng}&` +
    `mode=driving&` +
    `key=${GOOGLE_MAPS_API_KEY}`;

  const response = await fetch(url);
  const data = await response.json();

  if (data.status === 'OK' && data.routes && data.routes.length > 0) {
    const route = data.routes[0];
    const leg = route.legs[0];

    return {
      distance: leg.distance.value / 1000, // Convert meters to km
      duration: leg.duration.value / 60, // Convert seconds to minutes
      polyline: route.overview_polyline.points,
      steps: leg.steps.map(step => ({
        instruction: step.html_instructions.replace(/<[^>]*>/g, ''), // Remove HTML tags
        distance: step.distance.text,
        duration: step.duration.text
      }))
    };
  } else {
    throw new Error(`Google Maps API error: ${data.status}`);
  }
}

// Fallback to OpenRoute Service
async function getOpenRouteRoute(origin, destination) {
  if (!OPENROUTE_API_KEY) {
    throw new Error('OpenRoute API key not configured');
  }

  const url = `https://api.openrouteservice.org/v2/directions/driving-car`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': OPENROUTE_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      coordinates: [
        [origin.lng, origin.lat],
        [destination.lng, destination.lat]
      ],
      format: 'json',
      instructions: true
    })
  });

  const data = await response.json();

  if (data.routes && data.routes.length > 0) {
    const route = data.routes[0];
    const summary = route.summary;

    return {
      distance: summary.distance / 1000, // Convert meters to km
      duration: summary.duration / 60, // Convert seconds to minutes
      polyline: route.geometry,
      steps: route.segments?.[0]?.steps?.map(step => ({
        instruction: step.instruction,
        distance: `${(step.distance / 1000).toFixed(1)} km`,
        duration: `${Math.round(step.duration / 60)} min`
      })) || []
    };
  } else {
    throw new Error('OpenRoute API error');
  }
}

// Get route with actual road data (Google Maps primary, OpenRoute fallback)
async function getRealRoute(origin, destination) {
  try {
    console.log(`Getting route from (${origin.lat}, ${origin.lng}) to (${destination.lat}, ${destination.lng})`);

    // Try Google Maps first
    if (GOOGLE_MAPS_API_KEY) {
      try {
        const route = await getGoogleMapsRoute(origin, destination);
        console.log(`✅ Google Maps route: ${route.distance.toFixed(2)}km, ${route.duration.toFixed(0)}min`);
        return route;
      } catch (error) {
        console.warn(`Google Maps failed: ${error.message}, trying OpenRoute...`);
      }
    }

    // Fallback to OpenRoute
    if (OPENROUTE_API_KEY) {
      try {
        const route = await getOpenRouteRoute(origin, destination);
        console.log(`✅ OpenRoute route: ${route.distance.toFixed(2)}km, ${route.duration.toFixed(0)}min`);
        return route;
      } catch (error) {
        console.warn(`OpenRoute failed: ${error.message}, using straight line...`);
      }
    }

    // Final fallback to straight line
    console.warn(`⚠️ Falling back to straight line between waypoints`);
    const distance = calculateDistance(origin.lat, origin.lng, destination.lat, destination.lng);
    return {
      distance,
      duration: distance * 2, // Rough estimate: 2 minutes per km
      polyline: null,
      steps: []
    };
  } catch (error) {
    console.error(`Route calculation error: ${error.message}`);
    const distance = calculateDistance(origin.lat, origin.lng, destination.lat, destination.lng);
    return {
      distance,
      duration: distance * 2,
      polyline: null,
      steps: []
    };
  }
}

// Enhanced nearest neighbor TSP approximation with real road data
async function optimizeRoute(waypoints, origin) {
  if (waypoints.length <= 1) {
    return {
      totalDistance: 0,
      estimatedTime: 0,
      waypoints: [origin, ...waypoints],
      optimizedOrder: [0, ...waypoints.map((_, i) => i + 1)],
      routes: [],
      polylines: [],
      instructions: []
    };
  }

  console.log(`Optimizing route for ${waypoints.length} waypoints...`);

  const unvisited = [...waypoints];
  const route = [origin];
  let current = origin;
  let totalDistance = 0;
  let totalTime = 0;
  const routes = [];
  const polylines = [];
  const instructions = [];

  while (unvisited.length > 0) {
    let nearestIndex = 0;
    let nearestDistance = Infinity;
    let nearestRoute = null;

    // Find nearest unvisited waypoint using real road data
    for (let i = 0; i < unvisited.length; i++) {
      try {
        const routeData = await getRealRoute(current, unvisited[i]);

        if (routeData.distance < nearestDistance) {
          nearestDistance = routeData.distance;
          nearestIndex = i;
          nearestRoute = routeData;
        }
      } catch (error) {
        console.warn(`Failed to get route data for waypoint ${i}: ${error.message}`);
        // Fallback to straight line distance
        const straightLineDistance = calculateDistance(
          current.lat, current.lng,
          unvisited[i].lat, unvisited[i].lng
        );

        if (straightLineDistance < nearestDistance) {
          nearestDistance = straightLineDistance;
          nearestIndex = i;
          nearestRoute = {
            distance: straightLineDistance,
            duration: straightLineDistance * 2,
            polyline: null,
            steps: []
          };
        }
      }
    }

    // Move to nearest waypoint
    const nearest = unvisited.splice(nearestIndex, 1)[0];
    route.push(nearest);

    if (nearestRoute) {
      totalDistance += nearestRoute.distance;
      totalTime += nearestRoute.duration;
      routes.push(nearestRoute);

      if (nearestRoute.polyline) {
        polylines.push(nearestRoute.polyline);
      }

      if (nearestRoute.steps && nearestRoute.steps.length > 0) {
        instructions.push({
          from: current,
          to: nearest,
          steps: nearestRoute.steps
        });
      }
    }

    current = nearest;

    console.log(`Added waypoint: ${route.length - 1}/${waypoints.length + 1}, Distance: ${totalDistance.toFixed(2)}km`);
  }

  console.log(`✅ Route optimization completed: ${totalDistance.toFixed(2)}km, ${totalTime.toFixed(0)}min`);

  return {
    totalDistance: Math.round(totalDistance * 100) / 100,
    estimatedTime: Math.round(totalTime),
    waypoints: route,
    optimizedOrder: route.map((_, i) => i),
    routes: routes,
    polylines: polylines,
    instructions: instructions
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

    // Optimize the route with real road data
    console.log(`Starting route optimization with ${waypoints.length} waypoints`);
    const optimizedRoute = await optimizeRoute(waypoints, origin);

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