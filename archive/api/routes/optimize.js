// Vercel Serverless Function for Route Optimization: /api/routes/optimize
const https = require('https');
const http = require('http');

// Node.js HTTP request utility for Vercel serverless compatibility
function makeHttpRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const isHttps = urlObj.protocol === 'https:';
        const client = isHttps ? https : http;

        const reqOptions = {
            hostname: urlObj.hostname,
            port: urlObj.port || (isHttps ? 443 : 80),
            path: urlObj.pathname + urlObj.search,
            method: options.method || 'GET',
            headers: {
                'User-Agent': 'PlomesRotaCEP/1.0',
                'Content-Type': 'application/json',
                ...options.headers
            },
            timeout: options.timeout || 10000
        };

        const req = client.request(reqOptions, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                resolve({
                    ok: res.statusCode >= 200 && res.statusCode < 300,
                    status: res.statusCode,
                    statusText: res.statusMessage,
                    json: async () => JSON.parse(data),
                    text: async () => data
                });
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });

        if (options.body) {
            req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
        }

        req.end();
    });
}

// Haversine distance calculation
function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// Nearest Neighbor algorithm for route optimization
function nearestNeighborOptimization(points, returnToOrigin = false) {
    if (points.length <= 2) return points;

    const n = points.length;
    const visited = new Array(n).fill(false);
    const route = [];

    // Start from origin (index 0)
    let current = 0;
    route.push(points[current]);
    visited[current] = true;

    // Visit all remaining points
    while (route.length < n) {
        let nearest = -1;
        let minDistance = Infinity;

        for (let i = 0; i < n; i++) {
            if (!visited[i]) {
                const distance = calculateDistance(
                    points[current].lat, points[current].lng,
                    points[i].lat, points[i].lng
                );
                if (distance < minDistance) {
                    minDistance = distance;
                    nearest = i;
                }
            }
        }

        if (nearest !== -1) {
            route.push(points[nearest]);
            visited[nearest] = true;
            current = nearest;
        }
    }

    // Add return to origin if requested
    if (returnToOrigin && route.length > 1) {
        route.push(points[0]);
    }

    return route;
}

// 2-opt improvement algorithm
function twoOptImprovement(route, maxIterations = 100) {
    let improved = true;
    let iterations = 0;
    let bestRoute = [...route];
    let bestDistance = calculateTotalDistance(bestRoute);

    while (improved && iterations < maxIterations) {
        improved = false;
        iterations++;

        for (let i = 1; i < bestRoute.length - 2; i++) {
            for (let j = i + 1; j < bestRoute.length - 1; j++) {
                if (j - i === 1) continue; // Skip adjacent edges

                const newRoute = twoOptSwap(bestRoute, i, j);
                const newDistance = calculateTotalDistance(newRoute);

                if (newDistance < bestDistance) {
                    bestRoute = newRoute;
                    bestDistance = newDistance;
                    improved = true;
                }
            }
        }
    }

    return { route: bestRoute, distance: bestDistance, iterations };
}

// 2-opt swap operation
function twoOptSwap(route, i, j) {
    const newRoute = [...route];

    // Reverse the segment between i and j
    while (i < j) {
        [newRoute[i], newRoute[j]] = [newRoute[j], newRoute[i]];
        i++;
        j--;
    }

    return newRoute;
}

// Calculate total distance of a route
function calculateTotalDistance(route) {
    let totalDistance = 0;

    for (let i = 0; i < route.length - 1; i++) {
        totalDistance += calculateDistance(
            route[i].lat, route[i].lng,
            route[i + 1].lat, route[i + 1].lng
        );
    }

    return totalDistance;
}

// Generate a fallback polyline from waypoints
function generateFallbackPolyline(waypoints) {
    // Simple polyline encoding for straight lines between points
    const coordinates = waypoints.map(point => [point.lat, point.lng]);

    // Very basic polyline encoding (for visualization purposes)
    let polyline = '';
    coordinates.forEach((coord, index) => {
        if (index > 0) {
            polyline += `|${coord[0].toFixed(6)},${coord[1].toFixed(6)}`;
        } else {
            polyline += `${coord[0].toFixed(6)},${coord[1].toFixed(6)}`;
        }
    });

    return polyline;
}

// Estimate travel time based on distance
function estimateTime(distanceKm) {
    const avgSpeedKmh = 40; // Urban average speed
    const timeHours = distanceKm / avgSpeedKmh;
    const timeMinutes = Math.round(timeHours * 60);

    return {
        text: `${timeMinutes} min`,
        value: timeMinutes * 60 // seconds
    };
}

// Route optimization using Google Directions API (with fallback)
async function getOptimizedRouteWithDirections(waypoints) {
    const googleApiKey = process.env.GOOGLE_MAPS_API_KEY;

    if (!googleApiKey || waypoints.length < 2) {
        return null;
    }

    try {
        const origin = waypoints[0];
        const destination = waypoints[waypoints.length - 1];
        const intermediateWaypoints = waypoints.slice(1, -1);

        let url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}&key=${googleApiKey}&units=metric&language=pt-BR&region=BR`;

        if (intermediateWaypoints.length > 0) {
            const waypointStr = intermediateWaypoints
                .map(wp => `${wp.lat},${wp.lng}`)
                .join('|');
            url += `&waypoints=optimize:true|${waypointStr}`;
        }

        const response = await makeHttpRequest(url);

        if (!response.ok) {
            throw new Error('Google Directions API request failed');
        }

        const data = await response.json();

        if (data.status === 'OK' && data.routes.length > 0) {
            const route = data.routes[0];

            // Calculate total distance and duration
            let totalDistance = 0;
            let totalDuration = 0;

            route.legs.forEach(leg => {
                totalDistance += leg.distance ? leg.distance.value : 0;
                totalDuration += leg.duration ? leg.duration.value : 0;
            });

            return {
                distance: {
                    text: `${(totalDistance / 1000).toFixed(1)} km`,
                    value: totalDistance
                },
                duration: {
                    text: `${Math.round(totalDuration / 60)} min`,
                    value: totalDuration
                },
                polyline: route.overview_polyline ? route.overview_polyline.points : '',
                bounds: route.bounds,
                waypoint_order: route.waypoint_order || [],
                legs: route.legs,
                fallback: false,
                provider: 'google_directions'
            };
        }

        throw new Error('No routes found in Google Directions response');
    } catch (error) {
        console.log(`Google Directions failed: ${error.message}`);
        return null;
    }
}

// OpenRouteService fallback
async function getOptimizedRouteWithOpenRoute(waypoints) {
    const openRouteApiKey = process.env.OPENROUTE_API_KEY;

    if (!openRouteApiKey || waypoints.length < 2) {
        return null;
    }

    try {
        const coordinates = waypoints.map(wp => [wp.lng, wp.lat]); // OpenRoute uses [lng, lat]

        const requestBody = {
            coordinates,
            language: 'pt',
            units: 'km',
            geometry: true,
            instructions: false
        };

        const response = await makeHttpRequest('https://api.openrouteservice.org/v2/directions/driving-car', {
            method: 'POST',
            headers: {
                'Authorization': openRouteApiKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody),
            timeout: 15000
        });

        if (!response.ok) {
            throw new Error('OpenRouteService request failed');
        }

        const data = await response.json();

        if (data.routes && data.routes.length > 0) {
            const route = data.routes[0];
            const summary = route.summary;

            return {
                distance: {
                    text: `${(summary.distance).toFixed(1)} km`,
                    value: summary.distance * 1000 // Convert to meters
                },
                duration: {
                    text: `${Math.round(summary.duration / 60)} min`,
                    value: summary.duration
                },
                polyline: route.geometry,
                fallback: false,
                provider: 'openroute'
            };
        }

        throw new Error('No routes found in OpenRouteService response');
    } catch (error) {
        console.log(`OpenRouteService failed: ${error.message}`);
        return null;
    }
}

// Generate fallback route with straight-line optimization
function generateFallbackRoute(waypoints, returnToOrigin = false) {
    console.log('Generating fallback route with algorithm optimization...');

    // Step 1: Optimize waypoint order using nearest neighbor + 2-opt
    const optimizedRoute = nearestNeighborOptimization(waypoints, returnToOrigin);
    const improvedResult = twoOptImprovement(optimizedRoute);

    const finalRoute = improvedResult.route;
    const totalDistance = improvedResult.distance;
    const estimatedTime = estimateTime(totalDistance);

    // Step 2: Generate basic polyline for visualization
    const polyline = generateFallbackPolyline(finalRoute);

    // Step 3: Calculate bounds
    const lats = finalRoute.map(p => p.lat);
    const lngs = finalRoute.map(p => p.lng);
    const bounds = {
        northeast: {
            lat: Math.max(...lats),
            lng: Math.max(...lngs)
        },
        southwest: {
            lat: Math.min(...lats),
            lng: Math.min(...lngs)
        }
    };

    return {
        waypoints: finalRoute,
        totalDistance,
        estimatedTime: estimatedTime.value / 60, // minutes
        distance: {
            text: `${totalDistance.toFixed(1)} km`,
            value: totalDistance * 1000 // meters
        },
        duration: estimatedTime,
        polyline,
        bounds,
        fallback: true,
        provider: 'fallback_algorithm',
        algorithm: 'nearest_neighbor_2opt',
        iterations: improvedResult.iterations
    };
}

// Main serverless function handler
module.exports = async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({
            success: false,
            error: 'Method not allowed'
        });
    }

    try {
        const { origin, waypoints, options = {} } = req.body;

        if (!origin || !waypoints || !Array.isArray(waypoints)) {
            return res.status(400).json({
                success: false,
                error: 'Origin and waypoints array are required'
            });
        }

        if (waypoints.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'At least one waypoint is required'
            });
        }

        // Validate waypoints have required properties
        const allPoints = [origin, ...waypoints];
        for (const point of allPoints) {
            if (!point.lat || !point.lng) {
                return res.status(400).json({
                    success: false,
                    error: 'All waypoints must have lat and lng properties'
                });
            }
        }

        console.log(`[Route Optimization] Processing ${waypoints.length} waypoints`);

        const {
            returnToOrigin = false,
            useRealRoutes = true,
            algorithm = 'nearest-neighbor-2opt'
        } = options;

        let realRoute = null;

        // Step 1: Try to get real routes from mapping services
        if (useRealRoutes && allPoints.length >= 2) {
            // Try Google Directions first
            console.log('[Route Optimization] Trying Google Directions API...');
            realRoute = await getOptimizedRouteWithDirections(allPoints);

            // Fall back to OpenRouteService if Google fails
            if (!realRoute) {
                console.log('[Route Optimization] Trying OpenRouteService API...');
                realRoute = await getOptimizedRouteWithOpenRoute(allPoints);
            }
        }

        // Step 2: Generate algorithmic optimization (always available as fallback)
        console.log('[Route Optimization] Generating algorithmic optimization...');
        const fallbackResult = generateFallbackRoute(allPoints, returnToOrigin);

        // Step 3: Prepare final response
        const response = {
            success: true,
            route: {
                waypoints: fallbackResult.waypoints,
                totalDistance: fallbackResult.totalDistance,
                estimatedTime: fallbackResult.estimatedTime,
                algorithm: fallbackResult.algorithm,
                optimized: true
            }
        };

        // If we have real route data, use it; otherwise use fallback
        if (realRoute) {
            console.log(`[Route Optimization] Using real route from ${realRoute.provider}`);
            response.route.distance = realRoute.distance;
            response.route.duration = realRoute.duration;
            response.route.polyline = realRoute.polyline;
            response.route.bounds = realRoute.bounds;
            response.route.provider = realRoute.provider;
            response.route.fallback = false;

            if (realRoute.waypoint_order) {
                response.route.waypoint_order = realRoute.waypoint_order;
            }
        } else {
            console.log('[Route Optimization] Using fallback algorithmic route');
            response.route.distance = fallbackResult.distance;
            response.route.duration = fallbackResult.duration;
            response.route.polyline = fallbackResult.polyline;
            response.route.bounds = fallbackResult.bounds;
            response.route.provider = fallbackResult.provider;
            response.route.fallback = true;
            response.route.iterations = fallbackResult.iterations;
        }

        return res.status(200).json(response);

    } catch (error) {
        console.error('[Route Optimization] Unexpected error:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error.message
        });
    }
};