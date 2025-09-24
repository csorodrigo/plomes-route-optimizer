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
        console.log('🚨 Vercel Serverless Statistics API called - Real Data Integration');

        // Get Ploome credentials from environment
        const PLOOMES_API_KEY = process.env.PLOOMES_API_KEY;
        const PLOOMES_BASE_URL = process.env.PLOOMES_BASE_URL;

        let ploomeConnection = {
            status: 'disconnected',
            lastCheck: new Date().toISOString(),
            message: 'Ploome credentials not configured'
        };

        let totalCustomers = 0;
        let geocodedCustomers = 0;

        // Test Ploome connection and get real statistics
        if (PLOOMES_API_KEY && PLOOMES_BASE_URL) {
            try {
                const ploomeUrl = `${PLOOMES_BASE_URL}/Contacts?$top=1&$count=true`;
                const ploomeResponse = await fetch(ploomeUrl, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'User-Key': PLOOMES_API_KEY
                    }
                });

                if (ploomeResponse.ok) {
                    const ploomeData = await ploomeResponse.json();
                    totalCustomers = ploomeData['@odata.count'] || 0;

                    ploomeConnection = {
                        status: 'connected',
                        lastCheck: new Date().toISOString(),
                        message: 'Successfully connected to Ploome API'
                    };

                    // For geocoded customers, we'll count those with addresses
                    const detailedUrl = `${PLOOMES_BASE_URL}/Contacts?$top=50`;
                    const detailedResponse = await fetch(detailedUrl, {
                        method: 'GET',
                        headers: {
                            'Content-Type': 'application/json',
                            'User-Key': PLOOMES_API_KEY
                        }
                    });

                    if (detailedResponse.ok) {
                        const detailedData = await detailedResponse.json();
                        const contacts = detailedData.value || [];

                        geocodedCustomers = contacts.filter(contact =>
                            contact.Address &&
                            (contact.Address.Street || contact.Address.City)
                        ).length;
                    }

                } else {
                    ploomeConnection = {
                        status: 'error',
                        lastCheck: new Date().toISOString(),
                        message: `Ploome API error: ${ploomeResponse.status} ${ploomeResponse.statusText}`
                    };
                }
            } catch (ploomeError) {
                console.error('Ploome connection error:', ploomeError);
                ploomeConnection = {
                    status: 'error',
                    lastCheck: new Date().toISOString(),
                    message: `Connection failed: ${ploomeError.message}`
                };
            }
        }

        const realStats = {
            success: true,
            statistics: {
                totalCustomers: totalCustomers,
                geocodedCustomers: geocodedCustomers,
                routesGenerated: 0, // This would come from route tracking
                lastSync: new Date().toISOString(),
                ploomeConnection: ploomeConnection
            },
            cache: {
                customers: totalCustomers,
                routes: 0,
                geocoding: geocodedCustomers
            },
            source: 'real_ploome_data'
        };

        console.log('✅ Returning real statistics from Ploome');
        return res.status(200).json(realStats);

    } catch (error) {
        console.error('💥 Serverless statistics error:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
}