import { NextRequest, NextResponse } from "next/server";
import { RouteOptimizer } from "@/lib/route-optimizer";

// Type definitions for route optimization
interface RouteOptimizationRequest {
  origin: { lat: number; lng: number; cep?: string };
  waypoints: Array<{ lat: number; lng: number; name?: string; id?: string }>;
  options?: {
    save?: boolean;
    useRealRoutes?: boolean;
    returnToOrigin?: boolean;
    algorithm?: string;
  };
}

interface RouteOptimizationResponse {
  totalDistance: number;
  estimatedTime: number;
  waypoints: Array<{
    id?: string;
    name: string;
    lat: number;
    lng: number;
    address?: string;
    isOrigin?: boolean;
  }>;
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
  };
}

export async function POST(request: NextRequest) {
  try {
    const body: RouteOptimizationRequest = await request.json();
    const { origin, waypoints, options = {} } = body;

    // Validate required fields
    if (!origin || typeof origin.lat !== 'number' || typeof origin.lng !== 'number') {
      return NextResponse.json(
        { success: false, message: "Valid origin coordinates are required" },
        { status: 400 }
      );
    }

    if (!waypoints || !Array.isArray(waypoints) || waypoints.length === 0) {
      return NextResponse.json(
        { success: false, message: "At least one waypoint is required" },
        { status: 400 }
      );
    }

    // Validate waypoints
    for (const waypoint of waypoints) {
      if (typeof waypoint.lat !== 'number' || typeof waypoint.lng !== 'number') {
        return NextResponse.json(
          { success: false, message: "All waypoints must have valid lat/lng coordinates" },
          { status: 400 }
        );
      }
    }

    // Initialize route optimizer
    const optimizer = new RouteOptimizer();

    console.log(`🔄 Optimizing route with ${waypoints.length} waypoints`);
    console.log(`📍 Origin: ${origin.lat}, ${origin.lng}`);
    console.log(`⚙️ Options:`, options);

    // Create waypoints array with proper format
    const formattedWaypoints = waypoints.map((wp, index) => ({
      lat: wp.lat,
      lng: wp.lng,
      name: wp.name || `Cliente ${index + 1}`,
      id: wp.id || `waypoint_${index}`
    }));

    // Create origin point
    const originPoint = {
      lat: origin.lat,
      lng: origin.lng,
      name: 'Origem',
      id: 'origin'
    };

    // Optimize the route
    const optimizationOptions = {
      returnToOrigin: options.returnToOrigin ?? true,
      algorithm: options.algorithm || 'nearest-neighbor-2opt',
      useRealRoutes: options.useRealRoutes ?? true
    };

    const optimizedRoute = await optimizer.optimize(
      formattedWaypoints,
      originPoint,
      optimizationOptions
    );

    console.log(`✅ Route optimized successfully`);
    console.log(`📏 Total distance: ${optimizedRoute.totalDistance.toFixed(1)} km`);
    console.log(`⏱️ Estimated time: ${optimizedRoute.estimatedTime} minutes`);

    // Format response to match expected interface
    const response: RouteOptimizationResponse = {
      totalDistance: optimizedRoute.totalDistance,
      estimatedTime: optimizedRoute.estimatedTime,
      waypoints: optimizedRoute.waypoints.map(wp => ({
        id: wp.id,
        name: wp.name || 'Ponto',
        lat: wp.lat,
        lng: wp.lng,
        address: wp.address,
        isOrigin: wp.name === 'Origem'
      })),
      realRoute: optimizedRoute.realRoute
    };

    // Add polyline from realRoute if available
    if (optimizedRoute.realRoute?.polyline) {
      response.polyline = optimizedRoute.realRoute.polyline;
    }

    return NextResponse.json({
      success: true,
      route: response
    });

  } catch (error) {
    console.error("❌ Route optimization error:", error);

    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to optimize route",
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}