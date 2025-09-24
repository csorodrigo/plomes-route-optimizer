#!/usr/bin/env node

/**
 * CRITICAL DEBUGGING - React Error #31 CEP Search Crash
 *
 * This script debugs the CEP search functionality that causes React to crash
 * by simulating the exact API call and response that triggers the error.
 */

const https = require('https');
const http = require('http');

// Simulate the exact API call that the frontend makes
async function makeHttpRequest(url, options = {}) {
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
                'User-Agent': 'PlomesRotaCEP/1.0-Debug',
                ...options.headers
            },
            timeout: options.timeout || 6000
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
                    data: data,
                    json: () => JSON.parse(data)
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

        req.end();
    });
}

// Test the exact same CEP that causes crashes
async function testCepApiResponse() {
    console.log('🔍 DEBUGGING CEP API RESPONSE STRUCTURE');
    console.log('=' * 60);

    const testCeps = ['01310-100', '04038-001', '20040-020']; // Common CEPs

    for (const cep of testCeps) {
        console.log(`\n📍 Testing CEP: ${cep}`);
        console.log('-' * 30);

        try {
            // Test the production API endpoint
            const response = await makeHttpRequest(`https://plomes-rota-cep.vercel.app/api/geocoding/cep/${cep.replace(/\D/g, '')}`);
            const data = response.json();

            console.log('✅ API Response Status:', response.status);
            console.log('📦 Response Data Structure:');
            console.log(JSON.stringify(data, null, 2));

            // Check for potential React crash causes
            console.log('\n🔍 POTENTIAL CRASH ANALYSIS:');

            // Check for undefined/null lat/lng
            if (data.lat === undefined || data.lng === undefined) {
                console.log('❌ CRITICAL: Missing lat/lng coordinates');
            } else {
                console.log('✅ Coordinates present:', data.lat, data.lng);
            }

            // Check for NaN values
            if (isNaN(parseFloat(data.lat)) || isNaN(parseFloat(data.lng))) {
                console.log('❌ CRITICAL: NaN coordinates detected');
            } else {
                console.log('✅ Coordinates are valid numbers');
            }

            // Check coordinates structure
            if (data.coordinates) {
                console.log('📍 Coordinates object:', data.coordinates);
                if (data.coordinates.lat !== data.lat || data.coordinates.lng !== data.lng) {
                    console.log('⚠️  WARNING: Coordinate mismatch between root and nested object');
                }
            }

            // Check address structure
            if (data.address) {
                console.log('🏠 Address object:', data.address);
                if (!data.address.formatted) {
                    console.log('⚠️  WARNING: Missing formatted address');
                }
            } else {
                console.log('❌ CRITICAL: Missing address object');
            }

            // Simulate React state update that might crash
            console.log('\n🧪 SIMULATING REACT STATE UPDATE:');
            const simulatedState = {
                origin: {
                    lat: parseFloat(data.lat),
                    lng: parseFloat(data.lng)
                },
                originAddress: data.address?.formatted || '',
                mapCenter: [parseFloat(data.lat), parseFloat(data.lng)],
                zoom: 14
            };
            console.log('State update simulation:', simulatedState);

            // Check for any properties that could cause React errors
            if (simulatedState.mapCenter.includes(NaN)) {
                console.log('❌ CRITICAL: NaN in mapCenter array - WILL CRASH REACT!');
            }

        } catch (error) {
            console.log('❌ API Error:', error.message);
        }

        console.log('\n' + '=' * 60);
    }
}

// Test for common React Error #31 causes
async function analyzeReactError31Causes() {
    console.log('\n🚨 REACT ERROR #31 ANALYSIS');
    console.log('=' * 60);

    console.log(`
React Error #31 commonly occurs due to:
1. Invalid props passed to React components
2. NaN values in numeric props (especially for map components)
3. Undefined/null values where objects are expected
4. Array state updates with invalid elements
5. Circular references in state objects

SUSPECTED CAUSES IN CEP SEARCH:
- parseFloat() returning NaN from invalid API response
- mapCenter array receiving NaN coordinates
- Leaflet map components getting invalid position props
- State updates with malformed objects
    `);
}

// Main debugging execution
async function main() {
    console.log('🔧 CRITICAL PRODUCTION DEBUGGING');
    console.log('React Error #31 - CEP Search Crash Analysis');
    console.log('=' * 60);

    await testCepApiResponse();
    await analyzeReactError31Causes();

    console.log('\n📋 NEXT STEPS:');
    console.log('1. Check console for NaN coordinate errors');
    console.log('2. Add input validation before parseFloat()');
    console.log('3. Add defensive checks in handleCepSearch()');
    console.log('4. Test map component with invalid coordinates');
    console.log('5. Add error boundaries around map components');
}

// Run the debugging
main().catch(console.error);