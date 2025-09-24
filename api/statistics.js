// Vercel Serverless Function for Statistics API
export default async function handler(req, res) {
    // Configure CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Handle preflight OPTIONS request
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Only allow GET method
    if (req.method !== 'GET') {
        return res.status(405).json({
            success: false,
            message: 'Method not allowed. Use GET.'
        });
    }

    try {
        console.log('🚨 Vercel Serverless Statistics API called');

        // Mock statistics data
        const mockStats = {
            success: true,
            statistics: {
                totalCustomers: 3,
                geocodedCustomers: 3,
                routesGenerated: 0,
                lastSync: new Date().toISOString(),
                ploomeConnection: {
                    status: 'disconnected',
                    lastCheck: new Date().toISOString(),
                    message: 'Mock data - Ploome not connected in serverless'
                }
            },
            cache: {
                customers: 3,
                routes: 0,
                geocoding: 3
            },
            source: 'mock_data'
        };

        console.log('✅ Returning mock statistics');
        return res.status(200).json(mockStats);

    } catch (error) {
        console.error('💥 Serverless statistics error:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
}