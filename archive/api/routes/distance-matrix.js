// Vercel Serverless Function for Distance Matrix: /api/routes/distance-matrix
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
                ...options.headers
            },
            timeout: options.timeout || 8000
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

        req.end();
    });
}

// Haversine distance calculation
function calculateHaversineDistance(lat1, lng1, lat2, lng2) {
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

// Get distance matrix using Google Distance Matrix API
async function getGoogleDistanceMatrix(origins, destinations) {
    const googleApiKey = process.env.GOOGLE_MAPS_API_KEY;

    if (!googleApiKey) {
        throw new Error('Google Maps API key not available');
    }

    const originsStr = origins.map(o => `${o.lat},${o.lng}`).join('|');
    const destinationsStr = destinations.map(d => `${d.lat},${d.lng}`).join('|');

    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(originsStr)}&destinations=${encodeURIComponent(destinationsStr)}&key=${googleApiKey}&units=metric&language=pt-BR&region=BR&mode=driving&traffic_model=best_guess`;

    const response = await makeHttpRequest(url);

    if (!response.ok) {
        throw new Error('Google Distance Matrix API request failed');
    }

    const data = await response.json();

    if (data.status !== 'OK') {
        throw new Error(`Google Distance Matrix API error: ${data.status}`);
    }

    return data;
}

// Generate fallback distance matrix using Haversine formula
function generateFallbackDistanceMatrix(origins, destinations) {
    const rows = origins.map((origin, originIndex) => {
        const elements = destinations.map((destination, destIndex) => {
            const distance = calculateHaversineDistance(
                origin.lat, origin.lng,
                destination.lat, destination.lng
            );
            const duration = estimateTime(distance);

            return {
                distance: {
                    text: `${distance.toFixed(1)} km`,
                    value: Math.round(distance * 1000) // meters
                },
                duration,
                status: 'OK'
            };
        });

        return { elements };
    });

    return {
        destination_addresses: destinations.map((d, i) => `Destino ${i + 1}`),
        origin_addresses: origins.map((o, i) => `Origem ${i + 1}`),
        rows,
        status: 'OK',
        fallback: true,
        provider: 'haversine'
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
        const { origins, destinations, options = {} } = req.body;

        if (!origins || !destinations || !Array.isArray(origins) || !Array.isArray(destinations)) {
            return res.status(400).json({
                success: false,
                error: 'Origins and destinations arrays are required'
            });
        }

        if (origins.length === 0 || destinations.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'At least one origin and destination are required'
            });
        }

        // Validate coordinates
        const allPoints = [...origins, ...destinations];
        for (const point of allPoints) {
            if (!point.lat || !point.lng) {
                return res.status(400).json({
                    success: false,
                    error: 'All points must have lat and lng properties'
                });
            }
        }

        // Check limits
        if (origins.length > 25 || destinations.length > 25) {
            return res.status(400).json({
                success: false,
                error: 'Maximum 25 origins and 25 destinations allowed'
            });
        }

        console.log(`[Distance Matrix] Processing ${origins.length} origins x ${destinations.length} destinations`);

        const { useRealDistances = true } = options;
        let result = null;

        // Try Google Distance Matrix API first
        if (useRealDistances) {
            try {
                console.log('[Distance Matrix] Trying Google Distance Matrix API...');
                result = await getGoogleDistanceMatrix(origins, destinations);
                result.provider = 'google_distance_matrix';
                result.fallback = false;
                console.log('[Distance Matrix] Success with Google Distance Matrix API');
            } catch (error) {
                console.log(`[Distance Matrix] Google API failed: ${error.message}`);
            }
        }

        // Fall back to Haversine calculation
        if (!result) {
            console.log('[Distance Matrix] Using Haversine fallback calculation...');
            result = generateFallbackDistanceMatrix(origins, destinations);
        }

        return res.status(200).json({
            success: true,
            matrix: result,
            totalCalculations: origins.length * destinations.length
        });

    } catch (error) {
        console.error('[Distance Matrix] Unexpected error:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error.message
        });
    }
};