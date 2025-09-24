// Vercel Serverless Function for Statistics API with Mock Fallback
import https from 'https';
import http from 'http';
import { mockStatistics } from './mock-data.js';

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

        console.log(`🔄 Making ${reqOptions.method} request to: ${url}`);

        const req = client.request(reqOptions, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                console.log(`✅ HTTP ${res.statusCode} response received`);
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
            console.error('❌ HTTP request error:', error.message);
            reject(error);
        });

        req.on('timeout', () => {
            console.error('❌ HTTP request timeout');
            req.destroy();
            reject(new Error('Request timeout'));
        });

        if (options.body) {
            req.write(options.body);
        }

        req.end();
    });
}

// Retry utility for external API calls
async function fetchWithRetry(url, options, maxRetries = 2) {
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`🔄 HTTP attempt ${attempt}/${maxRetries} for: ${url}`);

            const response = await makeHttpRequest(url, options);
            console.log(`✅ HTTP successful on attempt ${attempt}`);
            return response;

        } catch (error) {
            lastError = error;
            console.error(`❌ HTTP attempt ${attempt} failed:`, error.message);

            if (attempt < maxRetries) {
                const delay = Math.pow(2, attempt) * 500; // Shorter backoff for statistics
                console.log(`⏳ Waiting ${delay}ms before retry...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    throw lastError;
}

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

        // Test Ploome connection and get real statistics with retry logic
        if (PLOOMES_API_KEY && PLOOMES_BASE_URL) {
            try {
                console.log('🔄 Testing Ploome API connection...');
                const ploomeUrl = `${PLOOMES_BASE_URL}/Contacts?$top=1&$count=true`;

                const ploomeResponse = await fetchWithRetry(ploomeUrl, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        'User-Key': PLOOMES_API_KEY
                    },
                    timeout: 6000 // Shorter timeout for statistics
                }, 2);

                if (ploomeResponse.ok) {
                    const ploomeData = await ploomeResponse.json();
                    totalCustomers = ploomeData['@odata.count'] || 0;
                    console.log('✅ Ploome connection successful, total customers:', totalCustomers);

                    ploomeConnection = {
                        status: 'connected',
                        lastCheck: new Date().toISOString(),
                        message: 'Successfully connected to Ploome API',
                        totalContacts: totalCustomers
                    };

                    // For geocoded customers, we'll count those with addresses
                    try {
                        const detailedUrl = `${PLOOMES_BASE_URL}/Contacts?$top=50`;
                        const detailedResponse = await fetchWithRetry(detailedUrl, {
                            method: 'GET',
                            headers: {
                                'Content-Type': 'application/json',
                                'Accept': 'application/json',
                                'User-Key': PLOOMES_API_KEY
                            }
                        }, 2);

                        if (detailedResponse.ok) {
                            const detailedData = await detailedResponse.json();
                            const contacts = detailedData.value || [];

                            geocodedCustomers = contacts.filter(contact =>
                                contact.Address &&
                                (contact.Address.Street || contact.Address.City)
                            ).length;

                            console.log('✅ Found', geocodedCustomers, 'customers with addresses out of', contacts.length);
                        }
                    } catch (detailedError) {
                        console.error('⚠️ Could not fetch detailed customer data:', detailedError.message);
                        // Continue with basic statistics even if detailed fetch fails
                    }

                } else {
                    const errorText = await ploomeResponse.text().catch(() => 'No error details');
                    console.error('❌ Ploome API error:', ploomeResponse.status, ploomeResponse.statusText, errorText);
                    ploomeConnection = {
                        status: 'error',
                        lastCheck: new Date().toISOString(),
                        message: `Ploome API error: ${ploomeResponse.status} ${ploomeResponse.statusText}`,
                        details: errorText
                    };
                }
            } catch (ploomeError) {
                console.error('❌ Ploome connection error:', ploomeError);
                console.log('🎆 Using mock statistics data...');

                // Use mock data when Ploome API is unavailable
                totalCustomers = mockStatistics.totalCustomers;
                geocodedCustomers = mockStatistics.geocodedCustomers;

                ploomeConnection = {
                    status: 'mock_data',
                    lastCheck: new Date().toISOString(),
                    message: 'Using mock data - Ploome API unavailable',
                    originalError: {
                        message: ploomeError.message,
                        type: ploomeError.name || 'NetworkError',
                        code: ploomeError.code || ploomeError.cause?.code
                    },
                    totalContacts: totalCustomers
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

        console.log('✅ Returning statistics - Connection:', ploomeConnection.status, 'Customers:', totalCustomers, 'Geocoded:', geocodedCustomers);
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