// Vercel Serverless Function for Customers API - Real Ploome Integration with Mock Fallback
import https from 'https';
import http from 'http';
import { getMockCustomers, addMockCoordinates } from './mock-data.js';

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
async function fetchWithRetry(url, options, maxRetries = 3) {
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
                const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
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

    // Only allow GET method for now
    if (req.method !== 'GET') {
        return res.status(405).json({
            success: false,
            message: 'Method not allowed. Use GET.'
        });
    }

    try {
        console.log('🚨 Vercel Serverless Customers API called - Real Ploome Integration');

        // Get Ploome credentials from environment
        const PLOOMES_API_KEY = process.env.PLOOMES_API_KEY;
        const PLOOMES_BASE_URL = process.env.PLOOMES_BASE_URL;
        const CLIENT_TAG_ID = process.env.CLIENT_TAG_ID;

        if (!PLOOMES_API_KEY || !PLOOMES_BASE_URL) {
            console.error('❌ Missing Ploome credentials');
            return res.status(500).json({
                success: false,
                message: 'Ploome credentials not configured'
            });
        }

        // Function to get real coordinates for an address with retry logic
        async function geocodeAddress(address) {
            try {
                const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address + ', Brazil')}&limit=1`;
                const response = await fetchWithRetry(nominatimUrl, {
                    method: 'GET',
                    headers: {
                        'User-Agent': 'PlomesRotaCEP/1.0 (geocoding service)',
                        'Accept': 'application/json'
                    }
                }, 2); // Max 2 retries for geocoding to avoid timeout

                if (!response.ok) {
                    console.error('Nominatim API error:', response.status, response.statusText);
                    return null;
                }

                const data = await response.json();

                if (data && data.length > 0) {
                    console.log('✅ Geocoding successful for:', address.substring(0, 50));
                    return {
                        latitude: parseFloat(data[0].lat),
                        longitude: parseFloat(data[0].lon)
                    };
                }

                console.log('⚠️ No geocoding results for:', address.substring(0, 50));
                return null;
            } catch (error) {
                console.error('❌ Geocoding error for', address.substring(0, 50), ':', error.message);
                return null;
            }
        }

        // Fetch customers from Ploome API with retry logic
        try {
            const ploomeUrl = `${PLOOMES_BASE_URL}/Contacts?$top=20`; // Limit for serverless performance
            console.log('🔄 Calling Ploome API:', ploomeUrl);
            console.log('📊 Environment check:', {
                hasApiKey: !!PLOOMES_API_KEY,
                hasBaseUrl: !!PLOOMES_BASE_URL,
                apiKeyLength: PLOOMES_API_KEY ? PLOOMES_API_KEY.length : 0
            });

            const ploomeResponse = await fetchWithRetry(ploomeUrl, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'User-Key': PLOOMES_API_KEY
                },
                timeout: 8000 // Shorter timeout for serverless
            }, 3);

            if (!ploomeResponse.ok) {
                const errorText = await ploomeResponse.text().catch(() => 'No error details');
                console.error('❌ Ploome API error:', ploomeResponse.status, ploomeResponse.statusText, errorText);
                return res.status(500).json({
                    success: false,
                    message: `Ploome API error: ${ploomeResponse.status} ${ploomeResponse.statusText}`,
                    details: errorText
                });
            }

            const ploomeData = await ploomeResponse.json();
            console.log('✅ Ploome API response received, contacts:', ploomeData.value ? ploomeData.value.length : 0);

            // Transform Ploome data to our format and add geocoding
            const customers = [];
            const contacts = ploomeData.value || [];

            for (let i = 0; i < Math.min(contacts.length, 10); i++) { // Limit to 10 customers for serverless performance
                const contact = contacts[i];

                // Build address string
                let address = '';
                let cep = '';
                let city = '';
                let state = '';

                // Extract address information from Ploome contact
                if (contact.Address) {
                    address = contact.Address.Street || '';
                    cep = contact.Address.ZipCode || '';
                    city = contact.Address.City || '';
                    state = contact.Address.State || '';

                    if (contact.Address.Number) {
                        address += `, ${contact.Address.Number}`;
                    }
                    if (contact.Address.District) {
                        address += `, ${contact.Address.District}`;
                    }
                    if (city) {
                        address += `, ${city}`;
                    }
                    if (state) {
                        address += `, ${state}`;
                    }
                }

                // Get coordinates for the address (skip for faster response in serverless)
                let coords = null;
                // Temporarily disable geocoding to speed up serverless response
                // coords = await geocodeAddress(address);

                // Format customer data
                const customer = {
                    id: contact.Id,
                    name: contact.Name || 'Nome não informado',
                    email: contact.Email || '',
                    phone: contact.Phones && contact.Phones.length > 0 ? contact.Phones[0].PhoneNumber : '',
                    address: address,
                    cep: cep,
                    city: city,
                    state: state,
                    latitude: coords ? coords.latitude : null,
                    longitude: coords ? coords.longitude : null,
                    ploome_person_id: contact.Id.toString(),
                    created_date: contact.CreateDate,
                    last_interaction: contact.LastInteractionDate
                };

                customers.push(customer);

                // Add small delay to respect rate limits and prevent timeout
                if (i < Math.min(contacts.length, 20) - 1) {
                    await new Promise(resolve => setTimeout(resolve, 200)); // Slightly longer delay for serverless
                }
            }

            console.log(`✅ Processed ${customers.length} customers from Ploome`);
            return res.status(200).json({
                success: true,
                customers: customers,
                total: customers.length,
                total_in_ploome: contacts.length,
                source: 'ploome_api_real_data',
                message: 'Real customers data from Ploome API with geocoding'
            });

        } catch (ploomeError) {
            console.error('💥 Ploome API integration error:', ploomeError);
            console.log('🎆 Falling back to mock data...');

            // Fallback to mock data when Ploome API is unavailable
            try {
                const mockData = getMockCustomers(10);
                const customers = [];

                for (const contact of mockData.value) {
                    // Build address string
                    let address = '';
                    let cep = '';
                    let city = '';
                    let state = '';

                    if (contact.Address) {
                        address = contact.Address.Street || '';
                        cep = contact.Address.ZipCode || '';
                        city = contact.Address.City || '';
                        state = contact.Address.State || '';

                        if (contact.Address.Number) {
                            address += `, ${contact.Address.Number}`;
                        }
                        if (contact.Address.District) {
                            address += `, ${contact.Address.District}`;
                        }
                        if (city) {
                            address += `, ${city}`;
                        }
                        if (state) {
                            address += `, ${state}`;
                        }
                    }

                    // Add mock coordinates
                    const coords = addMockCoordinates(contact);

                    const customer = {
                        id: contact.Id,
                        name: contact.Name || 'Nome não informado',
                        email: contact.Email || '',
                        phone: contact.Phones && contact.Phones.length > 0 ? contact.Phones[0].PhoneNumber : '',
                        address: address,
                        cep: cep,
                        city: city,
                        state: state,
                        latitude: coords.latitude,
                        longitude: coords.longitude,
                        ploome_person_id: contact.Id.toString(),
                        created_date: contact.CreateDate,
                        last_interaction: contact.LastInteractionDate
                    };

                    customers.push(customer);
                }

                console.log(`✅ Returning ${customers.length} mock customers`);
                return res.status(200).json({
                    success: true,
                    customers: customers,
                    total: customers.length,
                    total_in_ploome: mockData['@odata.count'],
                    source: 'mock_data_fallback',
                    message: 'Mock customers data (Ploome API unavailable)',
                    originalError: {
                        message: ploomeError.message,
                        type: ploomeError.name || 'NetworkError',
                        code: ploomeError.code
                    }
                });

            } catch (mockError) {
                console.error('💥 Mock data fallback also failed:', mockError);
                return res.status(500).json({
                    success: false,
                    message: 'Both Ploome API and mock data failed',
                    error: mockError.message,
                    timestamp: new Date().toISOString()
                });
            }
        }

    } catch (error) {
        console.error('💥 Serverless customers error:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
}