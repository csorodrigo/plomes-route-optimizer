import polyline from 'polyline';
import axios from 'axios';

import haversineDistance from 'haversine-distance';

interface Waypoint {
  lat: number;
  lng: number;
  name?: string;
  id?: string;
  address?: string;
}

interface RouteResult {
  waypoints: Waypoint[];
  totalDistance: number;
  estimatedTime: number;
  polyline?: string;
  realRoute?: {
    distance?: { text: string; value: number };
    duration?: { text: string; value: number };
    coordinates?: Array<[number, number]>;
    decodedPath?: Array<{ lat: number; lng: number }>;
    polyline?: string;
    fallback?: boolean;
    legs?: Array<{
      distance: { text: string; value: number };
      duration: { text: string; value: number };
      start_location: { lat: number; lng: number };
      end_location: { lat: number; lng: number };
    }>;
  } | null;
}

interface OptimizationOptions {
  returnToOrigin?: boolean;
  algorithm?: string;
  useRealRoutes?: boolean;
}

export class RouteOptimizer {
  private maxIterations: number = 1000;

  constructor() {
    console.log('🚀 RouteOptimizer initialized');
  }

  /**
   * Optimize route using nearest neighbor + 2-opt algorithm
   */
  async optimize(waypoints: Waypoint[], origin: Waypoint, options: OptimizationOptions = {}): Promise<RouteResult> {
    const {
      returnToOrigin = false,
      algorithm = 'nearest-neighbor-2opt',
      useRealRoutes = true
    } = options;

    if (!waypoints || waypoints.length === 0) {
      return {
        waypoints: [origin],
        totalDistance: 0,
        estimatedTime: 0
      };
    }

    console.log(`🔄 Optimizing route with ${waypoints.length} waypoints using ${algorithm}`);

    // Add origin at the beginning
    const points = [origin, ...waypoints];

    let optimizedRoute;

    switch (algorithm) {
      case 'nearest-neighbor':
        optimizedRoute = this.nearestNeighbor(points, returnToOrigin);
        break;
      case '2-opt':
        optimizedRoute = this.twoOpt(points, returnToOrigin);
        break;
      case 'nearest-neighbor-2opt':
      default:
        // Use nearest neighbor first, then improve with 2-opt
        const nnRoute = this.nearestNeighbor(points, returnToOrigin);
        optimizedRoute = this.twoOptImprovement(nnRoute.order, points, returnToOrigin);
        break;
    }

    // Calculate total distance and estimated time
    const totalDistance = this.calculateTotalDistance(optimizedRoute.order, points);
    const estimatedTime = this.estimateTime(totalDistance);

    // Get optimized waypoints
    const optimizedWaypoints = optimizedRoute.order.map((idx, i) => {
      const point = points[idx];
      // If this is the last point and returnToOrigin is true, mark it as return point
      if (returnToOrigin && i === optimizedRoute.order.length - 1 && idx === 0) {
        return { ...point, name: 'Origem (Retorno)', isReturn: true };
      }
      return point;
    });

    // Get real routes if enabled
    let realRoute = null;
    if (useRealRoutes && optimizedWaypoints.length >= 2) {
      realRoute = await this.getRealRoute(optimizedWaypoints, totalDistance, estimatedTime);
    }

    return {
      waypoints: optimizedWaypoints,
      totalDistance,
      estimatedTime,
      realRoute
    };
  }

  /**
   * Get real route from external APIs or generate fallback
   */
  private async getRealRoute(waypoints: Waypoint[], totalDistance: number, estimatedTime: number) {
    // Try Google Maps first
    const googleRoute = await this.tryGoogleMaps(waypoints);
    if (googleRoute) {
      console.log('✅ Using Google Maps route');
      return googleRoute;
    }

    // Try OpenRouteService as fallback
    const openRoute = await this.tryOpenRouteService(waypoints);
    if (openRoute) {
      console.log('✅ Using OpenRouteService route');
      return openRoute;
    }

    // Generate fallback route with polyline
    console.log('🔄 Generating fallback route with straight-line polyline');
    return this.generateFallbackRoute(waypoints, totalDistance, estimatedTime);
  }

  /**
   * Try Google Maps Directions API
   */
  private async tryGoogleMaps(waypoints: Waypoint[]) {
    const googleApiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!googleApiKey) {
      console.log('⚠️ Google Maps API key not available');
      return null;
    }

    try {
      const origin = waypoints[0];
      const destination = waypoints[waypoints.length - 1];
      const intermediateWaypoints = waypoints.slice(1, -1);

      const params = new URLSearchParams({
        origin: `${origin.lat},${origin.lng}`,
        destination: `${destination.lat},${destination.lng}`,
        key: googleApiKey,
        mode: 'driving',
        language: 'pt-BR',
        region: 'br'
      });

      if (intermediateWaypoints.length > 0) {
        const waypointsStr = intermediateWaypoints
          .map(wp => `${wp.lat},${wp.lng}`)
          .join('|');
        params.set('waypoints', `optimize:true|${waypointsStr}`);
      }

      const response = await axios.get(
        `https://maps.googleapis.com/maps/api/directions/json?${params.toString()}`,
        { timeout: 15000 }
      );

      if (response.data.status === 'OK' && response.data.routes.length > 0) {
        const route = response.data.routes[0];
        const leg = route.legs[0];

        return {
          distance: leg.distance,
          duration: leg.duration,
          polyline: route.overview_polyline.points,
          decodedPath: polyline.decode(route.overview_polyline.points).map(([lat, lng]) => ({ lat, lng })),
          legs: route.legs,
          fallback: false
        };
      }
    } catch (error) {
      console.warn('⚠️ Google Maps API failed:', error instanceof Error ? error.message : 'Unknown error');
    }

    return null;
  }

  /**
   * Try OpenRouteService API
   */
  private async tryOpenRouteService(waypoints: Waypoint[]) {
    const openRouteApiKey = process.env.OPENROUTE_API_KEY ||
      'eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjkwNGUyY2U5NmY3MDRkYzA4OTZlODliYzRlNDgzMTRhIiwiaCI6Im11cm11cjY0In0=';

    try {
      const coordinates = waypoints.map(wp => [wp.lng, wp.lat]);

      const response = await axios.post(
        'https://api.openrouteservice.org/v2/directions/driving-car',
        {
          coordinates,
          language: 'pt',
          units: 'km',
          geometry: true,
          instructions: true
        },
        {
          headers: {
            'Authorization': openRouteApiKey,
            'Content-Type': 'application/json'
          },
          timeout: 15000
        }
      );

      if (response.data?.routes?.length > 0) {
        const route = response.data.routes[0];
        const summary = route.summary;

        // Decode the polyline (OpenRouteService uses precision 5)
        let decodedPath: Array<{ lat: number; lng: number }> = [];
        if (route.geometry) {
          try {
            const decoded = polyline.decode(route.geometry, 5);
            decodedPath = decoded.map(([lat, lng]) => ({ lat, lng }));
          } catch (error) {
            console.warn('Failed to decode OpenRouteService polyline:', error);
          }
        }

        return {
          distance: {
            text: `${(summary.distance).toFixed(1)} km`,
            value: summary.distance * 1000
          },
          duration: {
            text: `${Math.round(summary.duration / 60)} min`,
            value: summary.duration
          },
          polyline: route.geometry,
          decodedPath,
          legs: route.segments?.map((segment: { distance: number; duration: number }) => ({
            distance: {
              text: `${(segment.distance).toFixed(1)} km`,
              value: segment.distance * 1000
            },
            duration: {
              text: `${Math.round(segment.duration / 60)} min`,
              value: segment.duration
            },
            start_location: { lat: 0, lng: 0 }, // Simplified
            end_location: { lat: 0, lng: 0 }
          })) || [],
          fallback: false
        };
      }
    } catch (error) {
      console.warn('⚠️ OpenRouteService API failed:', error instanceof Error ? error.message : 'Unknown error');
    }

    return null;
  }

  /**
   * Generate fallback route with straight-line polyline
   */
  private generateFallbackRoute(waypoints: Waypoint[], totalDistance: number, estimatedTime: number) {
    try {
      // Generate polyline from waypoints
      const coordinates = waypoints.map(point => [point.lat, point.lng]);
      const polylineString = polyline.encode(coordinates);

      return {
        distance: {
          text: `${totalDistance.toFixed(1)} km`,
          value: totalDistance * 1000 // Convert to meters
        },
        duration: {
          text: `${estimatedTime} min`,
          value: estimatedTime * 60 // Convert to seconds
        },
        polyline: polylineString,
        decodedPath: waypoints.map(point => ({ lat: point.lat, lng: point.lng })),
        legs: waypoints.slice(0, -1).map((point, index) => {
          const nextPoint = waypoints[index + 1];
          const legDistance = this.getDistance(point, nextPoint) * 1000; // Convert to meters
          const legDuration = Math.round(legDistance / 1000 * 1.5 * 60); // Estimate 1.5 min per km

          return {
            distance: {
              text: `${(legDistance / 1000).toFixed(1)} km`,
              value: legDistance
            },
            duration: {
              text: `${Math.round(legDuration / 60)} min`,
              value: legDuration
            },
            start_location: point,
            end_location: nextPoint
          };
        }),
        fallback: true
      };
    } catch (error) {
      console.error('Error generating fallback route:', error);
      return {
        distance: { text: `${totalDistance.toFixed(1)} km`, value: totalDistance * 1000 },
        duration: { text: `${estimatedTime} min`, value: estimatedTime * 60 },
        polyline: '',
        decodedPath: waypoints.map(point => ({ lat: point.lat, lng: point.lng })),
        fallback: true
      };
    }
  }

  /**
   * Nearest Neighbor algorithm
   */
  private nearestNeighbor(points: Waypoint[], returnToOrigin = false) {
    const n = points.length;
    const visited = new Array(n).fill(false);
    const route = [];

    // Start from origin (index 0)
    let current = 0;
    route.push(current);
    visited[current] = true;

    // Visit all points
    while (route.length < n) {
      let nearest = -1;
      let minDistance = Infinity;

      // Find nearest unvisited point
      for (let i = 0; i < n; i++) {
        if (!visited[i]) {
          const distance = this.getDistance(points[current], points[i]);
          if (distance < minDistance) {
            minDistance = distance;
            nearest = i;
          }
        }
      }

      if (nearest !== -1) {
        route.push(nearest);
        visited[nearest] = true;
        current = nearest;
      }
    }

    // Return to origin if needed
    if (returnToOrigin) {
      route.push(0);
    }

    return {
      order: route,
      distance: this.calculateTotalDistance(route, points)
    };
  }

  /**
   * 2-opt algorithm
   */
  private twoOpt(points: Waypoint[], returnToOrigin = false) {
    // Start with sequential route
    const initialRoute = Array.from({ length: points.length }, (_, i) => i);
    if (returnToOrigin) {
      initialRoute.push(0);
    }

    return this.twoOptImprovement(initialRoute, points, returnToOrigin);
  }

  /**
   * 2-opt improvement
   */
  private twoOptImprovement(route: number[], points: Waypoint[], returnToOrigin = false) {
    let improved = true;
    let bestRoute = [...route];
    let bestDistance = this.calculateTotalDistance(bestRoute, points);
    let iterations = 0;

    const effectiveLength = returnToOrigin ? bestRoute.length - 1 : bestRoute.length;

    while (improved && iterations < this.maxIterations) {
      improved = false;
      iterations++;

      for (let i = 1; i < effectiveLength - 1; i++) {
        for (let j = i + 1; j < effectiveLength; j++) {
          if (j - i === 1) continue;

          const newRoute = this.twoOptSwap(bestRoute, i, j, returnToOrigin);
          const newDistance = this.calculateTotalDistance(newRoute, points);

          if (newDistance < bestDistance) {
            bestRoute = newRoute;
            bestDistance = newDistance;
            improved = true;
            console.log(`2-opt improvement: ${(bestDistance - newDistance).toFixed(2)} km (iteration ${iterations})`);
          }
        }
      }
    }

    return {
      order: bestRoute,
      distance: bestDistance,
      iterations
    };
  }

  /**
   * Perform 2-opt swap
   */
  private twoOptSwap(route: number[], i: number, j: number, returnToOrigin = false) {
    const newRoute = [...route];
    const lastElement = returnToOrigin ? newRoute[newRoute.length - 1] : null;

    // Reverse section between i and j
    while (i < j) {
      [newRoute[i], newRoute[j]] = [newRoute[j], newRoute[i]];
      i++;
      j--;
    }

    // Restore last element if return to origin
    if (returnToOrigin && lastElement !== null) {
      newRoute[newRoute.length - 1] = lastElement;
    }

    return newRoute;
  }

  /**
   * Calculate total distance of a route
   */
  private calculateTotalDistance(route: number[], points: Waypoint[]): number {
    let totalDistance = 0;

    for (let i = 0; i < route.length - 1; i++) {
      const from = points[route[i]];
      const to = points[route[i + 1]];
      totalDistance += this.getDistance(from, to);
    }

    return totalDistance;
  }

  /**
   * Calculate distance between two points using haversine formula
   */
  private getDistance(point1: Waypoint, point2: Waypoint): number {
    if (!point1 || !point2) return 0;

    const p1 = { latitude: point1.lat, longitude: point1.lng };
    const p2 = { latitude: point2.lat, longitude: point2.lng };

    // Returns distance in kilometers
    return haversineDistance(p1, p2) / 1000;
  }

  /**
   * Estimate travel time based on distance
   */
  private estimateTime(distanceKm: number): number {
    // Assume average speed of 40 km/h in urban area
    const avgSpeedKmh = 40;
    const timeHours = distanceKm / avgSpeedKmh;
    const timeMinutes = Math.round(timeHours * 60);

    // Add extra time for stops (5 minutes per point)
    const stops = 5; // minutes per stop

    return timeMinutes + (stops * Math.max(0, distanceKm / 10)); // Rough estimate
  }
}