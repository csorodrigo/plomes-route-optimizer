/**
 * Debug script to test the route optimization API response structure
 * This will help us understand why the polyline is not rendering
 */

const RouteOptimizer = require('./backend/services/route/route-optimizer');

async function debugRouteResponse() {
    console.log('🔍 Debugging route optimization response structure...\n');

    const routeOptimizer = new RouteOptimizer();

    // Test data similar to what might be used in the frontend
    const origin = {
        lat: -23.5505,
        lng: -46.6333,
        name: 'Origem São Paulo'
    };

    const waypoints = [
        {
            lat: -23.5489,
            lng: -46.6388,
            name: 'Cliente 1',
            id: 1
        },
        {
            lat: -23.5515,
            lng: -46.6250,
            name: 'Cliente 2',
            id: 2
        },
        {
            lat: -23.5475,
            lng: -46.6420,
            name: 'Cliente 3',
            id: 3
        }
    ];

    const options = {
        returnToOrigin: false,
        algorithm: 'nearest-neighbor-2opt',
        useRealRoutes: true
    };

    try {
        console.log('📍 Test parameters:');
        console.log('   Origin:', origin);
        console.log('   Waypoints:', waypoints.length);
        console.log('   Options:', options);
        console.log('');

        const result = await routeOptimizer.optimize(waypoints, origin, options);

        console.log('✅ Route optimization completed!');
        console.log('');
        console.log('📊 Response structure analysis:');
        console.log('   Has waypoints:', !!result.waypoints);
        console.log('   Waypoints count:', result.waypoints?.length || 0);
        console.log('   Has realRoute:', !!result.realRoute);
        console.log('   Has realRoute.decodedPath:', !!result.realRoute?.decodedPath);
        console.log('   DecodedPath length:', result.realRoute?.decodedPath?.length || 0);
        console.log('');

        if (result.realRoute) {
            console.log('🗺️ Real route data:');
            console.log('   Distance:', result.realRoute.distance);
            console.log('   Duration:', result.realRoute.duration);
            console.log('   Has polyline:', !!result.realRoute.polyline);
            console.log('   Polyline type:', typeof result.realRoute.polyline);
            console.log('   Has decodedPath:', !!result.realRoute.decodedPath);
            console.log('   DecodedPath type:', typeof result.realRoute.decodedPath);
            console.log('   DecodedPath is Array:', Array.isArray(result.realRoute.decodedPath));

            if (result.realRoute.decodedPath && Array.isArray(result.realRoute.decodedPath)) {
                console.log('   DecodedPath sample (first 3 points):');
                result.realRoute.decodedPath.slice(0, 3).forEach((point, index) => {
                    console.log(`     Point ${index}:`, point);
                });
                console.log(`   Total decodedPath points: ${result.realRoute.decodedPath.length}`);
            }
        } else {
            console.log('❌ No realRoute data found');
        }

        console.log('');
        console.log('📋 Full response structure:');
        console.log(JSON.stringify(result, null, 2));

        console.log('');
        console.log('🔍 Frontend polyline logic analysis:');
        console.log('   Looking for route.realRoute.decodedPath...');

        if (result && result.realRoute && result.realRoute.decodedPath && Array.isArray(result.realRoute.decodedPath) && result.realRoute.decodedPath.length > 0) {
            const pathCoordinates = result.realRoute.decodedPath.map(p => [p.lat, p.lng]);
            console.log('   ✅ Polyline data would be available');
            console.log('   ✅ Path coordinates format valid');
            console.log('   ✅ Sample coordinates:', pathCoordinates.slice(0, 3));
            console.log('   ✅ Total polyline points:', pathCoordinates.length);
        } else {
            console.log('   ❌ Polyline data NOT available - checking fallback to waypoints...');

            if (result.waypoints && Array.isArray(result.waypoints) && result.waypoints.length > 1) {
                const pathCoordinates = result.waypoints.map(w => [w.lat, w.lng]);
                console.log('   ⚠️ Would fall back to waypoint straight lines');
                console.log('   ⚠️ Waypoint coordinates:', pathCoordinates);
            } else {
                console.log('   ❌ NO polyline data available at all');
            }
        }

    } catch (error) {
        console.error('❌ Route optimization failed:', error.message);
        console.error('   Stack:', error.stack);
    }
}

// Run the debug script
debugRouteResponse().catch(console.error);