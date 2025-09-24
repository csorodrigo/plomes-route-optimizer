// Vercel Serverless Function for testing Ploome API connection
export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Only allow GET requests
    if (req.method !== 'GET') {
        return res.status(405).json({
            success: false,
            error: 'Method not allowed'
        });
    }

    try {
        const PLOOME_API_KEY = process.env.PLOOME_API_KEY || process.env.PLOOMES_API_KEY;

        if (!PLOOME_API_KEY) {
            return res.status(500).json({
                success: false,
                error: 'PLOOME_API_KEY not found in environment variables',
                solution: 'Configure PLOOME_API_KEY in Vercel environment variables'
            });
        }

        // Test Ploome API connection
        const testUrl = 'https://public-api2.ploomes.com/Account';
        const response = await fetch(testUrl, {
            method: 'GET',
            headers: {
                'User-Key': PLOOME_API_KEY,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            const data = await response.json();
            return res.status(200).json({
                success: true,
                message: 'Ploome API connection successful',
                accountInfo: data,
                apiUrl: 'https://public-api2.ploomes.com'
            });
        } else {
            const errorData = await response.text();
            return res.status(response.status).json({
                success: false,
                error: 'Failed to connect to Ploome API',
                status: response.status,
                statusText: response.statusText,
                details: errorData,
                apiUrl: 'https://public-api2.ploomes.com',
                keyPreview: `${PLOOME_API_KEY.substring(0, 10)}...`
            });
        }

    } catch (error) {
        console.error('Test connection error:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
}