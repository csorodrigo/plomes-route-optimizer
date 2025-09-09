const GoogleDirectionsService = require('./services/route/google-directions-service');
require('dotenv').config();

async function testGoogleRoute() {
    console.log('🔍 Testing Google Maps Directions API...\n');
    
    // Check API key
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
        console.error('❌ GOOGLE_MAPS_API_KEY not found in environment variables');
        process.exit(1);
    }
    
    console.log(`✅ API Key found: ${apiKey.substring(0, 10)}...`);
    
    const service = new GoogleDirectionsService();
    
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
        console.log('\n🚗 Getting directions from Google Maps...');
        const result = await service.getDirections(testWaypoints);
        
        if (result.success) {
            console.log('\n✅ SUCCESS! Google Directions API is working!');
            console.log('\n📊 Route details:');
            console.log(`   • Total distance: ${result.route.distance.text} (${result.route.distance.value} meters)`);
            console.log(`   • Estimated time: ${result.route.duration.text} (${result.route.duration.value} seconds)`);
            console.log(`   • Route points: ${result.route.decodedPath.length} coordinates`);
            console.log(`   • Number of steps: ${result.route.steps.length}`);
            
            console.log('\n🗺️  First 5 decoded path points:');
            result.route.decodedPath.slice(0, 5).forEach((point, i) => {
                console.log(`      ${i + 1}. lat: ${point.lat.toFixed(6)}, lng: ${point.lng.toFixed(6)}`);
            });
            
            console.log('\n📝 First 3 driving steps:');
            result.route.steps.slice(0, 3).forEach((step, i) => {
                console.log(`      ${i + 1}. ${step.instructions} (${step.distance})`);
            });
            
            console.log('\n🎉 The Google Maps API is properly configured and working!');
            console.log('   Routes will follow real streets instead of straight lines.');
            
        } else {
            console.error('\n❌ Google Directions API returned an error:');
            console.error(result.error);
            
            console.log('\n💡 Possible causes:');
            console.log('   1. Invalid API key');
            console.log('   2. API key doesn\'t have Directions API enabled');
            console.log('   3. Billing not configured on Google Cloud');
            console.log('   4. API quota exceeded');
        }
        
    } catch (error) {
        console.error('\n❌ Error testing Google Directions:', error.message);
        if (error.response) {
            console.error('   Status:', error.response.status);
            console.error('   Data:', JSON.stringify(error.response.data, null, 2));
        }
        
        console.log('\n💡 Debug information:');
        console.log('   • Check if the API key is valid');
        console.log('   • Verify Directions API is enabled in Google Cloud Console');
        console.log('   • Ensure billing is set up for the project');
    }
}

// Run the test
testGoogleRoute()
    .then(() => {
        console.log('\n✅ Test completed!');
        process.exit(0);
    })
    .catch(error => {
        console.error('\n❌ Test failed:', error);
        process.exit(1);
    });