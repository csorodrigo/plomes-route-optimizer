#!/usr/bin/env node

/**
 * Debug script to test the route optimization API and examine the polyline data structure
 * This will help us understand why polylines are not rendering on the map
 */

const RouteOptimizer = require('./backend/services/route/route-optimizer');

async function debugPolylineResponse() {
    console.log('🗺️ Debug: Testing Route Optimization API Response');
    console.log('=' .repeat(60));

    // Create a test scenario similar to the frontend
    const origin = {
        lat: -3.7319,
        lng: -38.5267,
        address: "Centro, Fortaleza - CE"
    };

    const waypoints = [
        {
            lat: -3.7400,
            lng: -38.5300,
            name: "Cliente 1",
            id: "test1"
        },
        {
            lat: -3.7500,
            lng: -38.5400,
            name: "Cliente 2",
            id: "test2"
        },
        {
            lat: -3.7350,
            lng: -38.5200,
            name: "Cliente 3",
            id: "test3"
        }
    ];

    const options = {
        returnToOrigin: true,
        useRealRoutes: true,
        algorithm: 'nearest-neighbor-2opt'
    };

    try {
        console.log('🚀 Calling RouteOptimizer.optimize()...');
        const optimizer = new RouteOptimizer();
        const result = await optimizer.optimize(waypoints, origin, options);

        console.log('\n📊 Route Optimization Result:');
        console.log('=' .repeat(60));
        console.log('✅ Success:', !!result);
        console.log('📍 Waypoints count:', result.waypoints?.length || 0);
        console.log('📏 Total distance:', result.totalDistance);
        console.log('⏱️ Estimated time:', result.estimatedTime);
        console.log('🔄 Algorithm:', result.algorithm);

        console.log('\n🗺️ Real Route Analysis:');
        console.log('=' .repeat(60));
        console.log('✅ Has realRoute:', !!result.realRoute);

        if (result.realRoute) {
            console.log('📍 Has decodedPath:', !!result.realRoute.decodedPath);
            console.log('📍 DecodedPath length:', result.realRoute.decodedPath?.length || 0);
            console.log('📍 Has polyline:', !!result.realRoute.polyline);
            console.log('📏 Distance:', result.realRoute.distance);
            console.log('⏱️ Duration:', result.realRoute.duration);

            if (result.realRoute.decodedPath && result.realRoute.decodedPath.length > 0) {
                console.log('\n📊 DecodedPath Sample (first 5 points):');
                console.log(JSON.stringify(result.realRoute.decodedPath.slice(0, 5), null, 2));

                console.log('\n📊 DecodedPath Sample (last 3 points):');
                console.log(JSON.stringify(result.realRoute.decodedPath.slice(-3), null, 2));

                // Validate coordinate format
                const firstPoint = result.realRoute.decodedPath[0];
                console.log('\n🔍 Coordinate Validation:');
                console.log('First point structure:', typeof firstPoint, firstPoint);
                console.log('Has lat property:', 'lat' in firstPoint);
                console.log('Has lng property:', 'lng' in firstPoint);
                console.log('Lat is number:', typeof firstPoint?.lat === 'number');
                console.log('Lng is number:', typeof firstPoint?.lng === 'number');
            } else {
                console.log('❌ No decodedPath data available');
            }
        } else {
            console.log('❌ No realRoute data available');
        }

        console.log('\n🔧 Frontend Condition Check:');
        console.log('=' .repeat(60));

        // Simulate the frontend conditional check
        const conditionResult = !!(result && result.realRoute && result.realRoute.decodedPath);
        console.log('✅ optimizedRoute exists:', !!result);
        console.log('✅ optimizedRoute.realRoute exists:', !!result.realRoute);
        console.log('✅ optimizedRoute.realRoute.decodedPath exists:', !!result.realRoute?.decodedPath);
        console.log('🎯 Overall condition result:', conditionResult);

        if (conditionResult) {
            const positions = result.realRoute.decodedPath.map(p => [p.lat, p.lng]);
            console.log('✅ Positions would be generated for Polyline');
            console.log('📍 Positions count:', positions.length);
            console.log('📍 First position:', positions[0]);
            console.log('📍 Last position:', positions[positions.length - 1]);
        } else {
            console.log('❌ Polyline would NOT render - condition failed');
        }

        console.log('\n📋 Complete Route Structure (truncated):');
        console.log('=' .repeat(60));

        // Create a truncated version for display
        const displayResult = {
            ...result,
            realRoute: result.realRoute ? {
                ...result.realRoute,
                decodedPath: result.realRoute.decodedPath ?
                    `[${result.realRoute.decodedPath.length} coordinates - showing first: ${JSON.stringify(result.realRoute.decodedPath[0])}]` :
                    'null'
            } : null
        };

        console.log(JSON.stringify(displayResult, null, 2));

    } catch (error) {
        console.error('❌ Error during route optimization:', error);
        console.error(error.stack);
    }
}

// Run the debug test
debugPolylineResponse().then(() => {
    console.log('\n🏁 Debug test completed');
    process.exit(0);
}).catch(error => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
});