// Vercel Serverless Function for Geocoding Progress Status
import https from 'https';
import http from 'http';

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
            timeout: options.timeout || 10000
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

        if (options.body) {
            req.write(options.body);
        }

        req.end();
    });
}

export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
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
        console.log('[GEOCODING PROGRESS] Checking geocoding progress...');

        // Get Ploome credentials from environment
        const PLOOMES_API_KEY = process.env.PLOOMES_API_KEY;
        const PLOOMES_BASE_URL = process.env.PLOOMES_BASE_URL || 'https://public-api2.ploomes.com';
        const CLIENT_TAG_ID = process.env.CLIENT_TAG_ID ? parseInt(process.env.CLIENT_TAG_ID) : 40006184;

        if (!PLOOMES_API_KEY || !PLOOMES_BASE_URL) {
            return res.status(500).json({
                success: false,
                error: 'Ploome credentials not configured'
            });
        }

        // Get total customer count (for progress calculation)
        const totalCountUrl = `${PLOOMES_BASE_URL}/Contacts?$top=1&$count=true&$expand=Tags&$filter=Tags/any(t: t/TagId eq ${CLIENT_TAG_ID})`;

        const totalCountResponse = await makeHttpRequest(totalCountUrl, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'User-Key': PLOOMES_API_KEY
            }
        });

        let totalCustomers = 0;
        if (totalCountResponse.ok) {
            const data = await totalCountResponse.json();
            totalCustomers = data['@odata.count'] || 0;
        }

        // Get sample of customers to check geocoding status
        const sampleUrl = `${PLOOMES_BASE_URL}/Contacts?$top=100&$expand=Tags&$filter=Tags/any(t: t/TagId eq ${CLIENT_TAG_ID})`;

        const sampleResponse = await makeHttpRequest(sampleUrl, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'User-Key': PLOOMES_API_KEY
            }
        });

        let geocodingProgress = {
            total: totalCustomers,
            with_cep: 0,
            without_cep: 0,
            estimated_geocodable: 0,
            needs_geocoding: totalCustomers,  // Since our current system has no geocoded customers
            progress_percentage: 0
        };

        if (sampleResponse.ok) {
            const sampleData = await sampleResponse.json();
            const customers = sampleData.value || [];

            // Analyze sample to estimate geocoding potential
            let sampleWithCep = 0;
            let sampleWithoutCep = 0;

            for (const customer of customers) {
                const cep = customer.Address?.ZipCode?.replace(/\D/g, '');
                if (cep && cep.length === 8) {
                    sampleWithCep++;
                } else {
                    sampleWithoutCep++;
                }
            }

            // Extrapolate from sample
            const sampleSize = customers.length;
            if (sampleSize > 0) {
                const cepRate = sampleWithCep / sampleSize;
                geocodingProgress.estimated_geocodable = Math.round(totalCustomers * cepRate);
                geocodingProgress.with_cep = geocodingProgress.estimated_geocodable;
                geocodingProgress.without_cep = totalCustomers - geocodingProgress.estimated_geocodable;
            }
        }

        return res.status(200).json({
            success: true,
            geocoding_progress: geocodingProgress,
            status: 'pending',  // All customers need geocoding since none are geocoded yet
            message: `${totalCustomers} customers need geocoding. Estimated ${geocodingProgress.estimated_geocodable} can be geocoded based on CEP availability.`,
            recommendations: {
                batch_size: 50,
                estimated_time: Math.ceil(geocodingProgress.estimated_geocodable / 50) + ' minutes',
                suggested_action: 'Run batch geocoding to process all customers with valid CEPs'
            },
            metadata: {
                client_tag_id: CLIENT_TAG_ID,
                timestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('[GEOCODING PROGRESS] Error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to get geocoding progress',
            details: error.message
        });
    }
}