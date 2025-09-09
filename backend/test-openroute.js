const OpenRouteService = require('./services/route/openroute-service');
require('dotenv').config();

async function testOpenRoute() {
    console.log('🗺️  Testing OpenRouteService API...\n');
    
    const service = new OpenRouteService();
    
    // Test waypoints in Brazil (Fortaleza area)
    const testWaypoints = [
        { lat: -3.7319, lng: -38.5267, name: 'Fortaleza Centro' },     // Fortaleza center
        { lat: -3.7172, lng: -38.5433, name: 'Praia de Iracema' },     // Beach area
        { lat: -3.7700, lng: -38.4800, name: 'Praia do Futuro' },      // Another beach
        { lat: -3.7900, lng: -38.5900, name: 'Aeroporto' }             // Airport area
    ];
    
    console.log('📍 Test waypoints:');
    testWaypoints.forEach((wp, i) => {
        console.log(`   ${i + 1}. ${wp.name}: ${wp.lat}, ${wp.lng}`);
    });
    
    try {
        console.log('\n🚗 Getting directions from OpenRouteService...');
        const result = await service.getDirections(testWaypoints);
        
        if (result.success) {
            console.log('\n✅ SUCCESS! OpenRouteService API is working!');
            console.log('\n📊 Route details:');
            console.log(`   • Total distance: ${result.route.distance.text}`);
            console.log(`   • Estimated time: ${result.route.duration.text}`);
            console.log(`   • Route points: ${result.route.decodedPath.length} coordinates`);
            console.log(`   • Number of steps: ${result.route.steps.length}`);
            
            console.log('\n🗺️  First 5 decoded path points:');
            result.route.decodedPath.slice(0, 5).forEach((point, i) => {
                console.log(`      ${i + 1}. lat: ${point.lat.toFixed(6)}, lng: ${point.lng.toFixed(6)}`);
            });
            
            console.log('\n📝 First 3 driving steps:');
            result.route.steps.slice(0, 3).forEach((step, i) => {
                console.log(`      ${i + 1}. ${step.instruction} (${step.distance})`);
            });
            
            console.log('\n🎉 OpenRouteService is properly configured and working!');
            console.log('   Routes will follow real streets (FREE API!)');
            console.log('   Daily limit: 2,500 requests');
            
        } else {
            console.error('\n❌ OpenRouteService API returned an error');
        }
        
    } catch (error) {
        console.error('\n❌ Error testing OpenRouteService:', error.message);
        if (error.response) {
            console.error('   Status:', error.response.status);
            console.error('   Data:', JSON.stringify(error.response.data, null, 2));
        }
        
        console.log('\n💡 Debug information:');
        console.log('   • Check if the API key is valid');
        console.log('   • API key should be in .env as OPENROUTE_API_KEY');
        console.log('   • Free tier allows 2,500 requests/day');
    }
}

// Run the test
testOpenRoute()
    .then(() => {
        console.log('\n✅ Test completed!');
        process.exit(0);
    })
    .catch(error => {
        console.error('\n❌ Test failed:', error);
        process.exit(1);
    });