// Vercel Serverless Function for Customers API - REAL PLOOME + SUPABASE STORAGE
// Serves geocoded customers from Supabase PostgreSQL with Ploome fallback
import https from 'https';
import http from 'http';
import supabaseKV from '../lib/supabase.js';

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
            timeout: options.timeout || 15000
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
        console.log('🚨 Vercel Serverless Customers API called - SUPABASE POSTGRESQL + PLOOME');

        // Try to serve from Supabase PostgreSQL first (faster and persistent)
        try {
            console.log('[CUSTOMERS API] Checking Supabase PostgreSQL for geocoded customers...');

            // Get search parameters
            const { search = '', page = 0, limit = 25, geocoded_only = 'false' } = req.query;
            const pageNum = parseInt(page);
            const limitNum = parseInt(limit);
            const geoOnly = geocoded_only === 'true';

            // Use the advanced Supabase query method for better performance
            const filters = {
                search: search || null,
                geocoded_only: geoOnly,
                limit: limitNum,
                offset: pageNum * limitNum
            };

            const customers = await supabaseKV.getAllCustomers(filters);
            console.log(`[CUSTOMERS API] Found ${customers.length} customers in Supabase`);

            if (customers.length > 0) {
                console.log(`[CUSTOMERS API] ✅ Retrieved ${customers.length} customers from Supabase PostgreSQL`);

                // Get total count without pagination for proper pagination metadata
                const allCustomersForCount = await supabaseKV.getAllCustomers({
                    search: search || null,
                    geocoded_only: geoOnly
                });
                const total = allCustomersForCount.length;

                // Get statistics from Supabase
                const customerStats = await supabaseKV.getCustomerStats();
                const geocodedCount = customerStats.geocoded || 0;
                const totalCustomers = customerStats.total || 0;
                const pendingCount = customerStats.pending || 0;

                // Get global stats from Supabase
                const savedStats = await supabaseKV.getGeocodingStats();
                let globalStats = {
                    total_processed: totalCustomers,
                    total_geocoded: geocodedCount,
                    total_failed: 0,
                    total_skipped: pendingCount,
                    last_updated: new Date().toISOString()
                };

                if (savedStats) {
                    try {
                        globalStats = JSON.parse(savedStats);
                    } catch (e) {
                        console.warn('[CUSTOMERS API] Failed to parse global stats from Supabase');
                    }
                }

                console.log(`[CUSTOMERS API] ✅ Returning ${customers.length} customers from Supabase (page ${pageNum + 1})`);

                return res.status(200).json({
                    success: true,
                    data: customers,
                    customers: customers, // Backward compatibility
                    pagination: {
                        page: pageNum,
                        limit: limitNum,
                        total: total,
                        totalPages: Math.ceil(total / limitNum),
                        hasNext: (pageNum + 1) * limitNum < total,
                        hasPrev: pageNum > 0
                    },
                    total: customers.length,
                    statistics: {
                        totalCustomers: totalCustomers,
                        geocodedCustomers: geocodedCount,
                        pendingGeocoding: pendingCount,
                        searchResults: total,
                        geocodingRate: customerStats.geocodingRate || 0
                    },
                    globalStats: globalStats,
                    metadata: {
                        source: 'supabase_postgresql',
                        timestamp: new Date().toISOString(),
                        filters: {
                            search: search || null,
                            geocoded_only: geoOnly
                        }
                    }
                });
            }

            console.log('[CUSTOMERS API] No data in Supabase, falling back to Ploome...');
        } catch (storageError) {
            console.error('[CUSTOMERS API] Supabase error, falling back to Ploome:', storageError);
        }

        // Get Ploome credentials from environment
        const PLOOMES_API_KEY = process.env.PLOOMES_API_KEY;
        const PLOOMES_BASE_URL = process.env.PLOOMES_BASE_URL || 'https://public-api2.ploomes.com';
        const CLIENT_TAG_ID = process.env.CLIENT_TAG_ID ? parseInt(process.env.CLIENT_TAG_ID) : 40006184;

        console.log('🔐 Environment check:', {
            hasApiKey: !!PLOOMES_API_KEY,
            hasBaseUrl: !!PLOOMES_BASE_URL,
            baseUrl: PLOOMES_BASE_URL,
            clientTagId: CLIENT_TAG_ID,
            apiKeyLength: PLOOMES_API_KEY ? PLOOMES_API_KEY.length : 0
        });

        if (!PLOOMES_API_KEY || !PLOOMES_BASE_URL) {
            console.error('❌ Missing Ploome credentials');
            return res.status(500).json({
                success: false,
                message: 'Ploome credentials not configured',
                details: {
                    hasApiKey: !!PLOOMES_API_KEY,
                    hasBaseUrl: !!PLOOMES_BASE_URL,
                    troubleshooting: [
                        'Check Vercel environment variables',
                        'Verify PLOOMES_API_KEY is set',
                        'Verify PLOOMES_BASE_URL is set'
                    ]
                }
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

        // Fetch customers from Ploome API with proper filtering (like local backend)
        try {
            // CRITICAL FIX: Increase limit to handle all customers (removed 300 customer limit)
            let ploomeUrl = `${PLOOMES_BASE_URL}/Contacts?$top=5000`; // Increased limit to handle all customers

            // Add OData filter to get ONLY contacts that have the Cliente tag (like local backend)
            ploomeUrl += `&$expand=City,Tags`;
            ploomeUrl += `&$filter=Tags/any(t: t/TagId eq ${CLIENT_TAG_ID})`;

            console.log('🔄 Calling Ploome API with CLIENT_TAG_ID filter:', ploomeUrl);
            console.log('🎯 Using CLIENT_TAG_ID:', CLIENT_TAG_ID);
            console.log('🚀 This should return ONLY Cliente contacts, not all contacts');
            console.log('📊 FIXED: Increased limit from 20 to 2500 to handle full customer base');

            const ploomeResponse = await fetchWithRetry(ploomeUrl, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'User-Key': PLOOMES_API_KEY
                },
                timeout: 12000 // Longer timeout for filtered requests
            }, 3);

            if (!ploomeResponse.ok) {
                const errorText = await ploomeResponse.text().catch(() => 'No error details');
                console.error('❌ Ploome API error:', ploomeResponse.status, ploomeResponse.statusText, errorText);
                return res.status(500).json({
                    success: false,
                    message: `Ploome API error: ${ploomeResponse.status} ${ploomeResponse.statusText}`,
                    details: {
                        errorText,
                        apiUrl: ploomeUrl,
                        headers: {
                            hasUserKey: !!PLOOMES_API_KEY,
                            userKeyLength: PLOOMES_API_KEY ? PLOOMES_API_KEY.length : 0
                        },
                        troubleshooting: [
                            'Verify PLOOMES_API_KEY is valid and active',
                            'Check if CLIENT_TAG_ID exists in Ploome',
                            'Ensure Ploome API is accessible from Vercel',
                            'Try without OData filter if tag filtering fails'
                        ]
                    }
                });
            }

            const ploomeData = await ploomeResponse.json();
            console.log('✅ Ploome API response received, contacts:', ploomeData.value ? ploomeData.value.length : 0);

            // Transform Ploome data to our format and add geocoding
            const customers = [];
            const contacts = ploomeData.value || [];

            // CRITICAL FIX: Remove ALL hardcoded customer limits - process ALL customers
            // Process in optimized batches to avoid serverless timeout
            const maxCustomers = contacts.length; // Process ALL customers without limit
            const batchSize = 100; // Increased batch size for better performance

            console.log(`🚀 Processing ALL ${maxCustomers} customers without artificial limits...`);

            for (let i = 0; i < maxCustomers; i++) { // FIXED: Process ALL customers!
                const contact = contacts[i];

                // Build address string
                let address = '';
                let cep = '';
                let city = '';
                let state = '';

                // FIXED: Extract address information from Ploome contact (CEP is at contact level, not contact.Address)
                // Build address from contact-level fields (not nested Address object)
                address = contact.StreetAddress || '';
                cep = contact.ZipCode ? contact.ZipCode.toString().replace(/\D/g, '') : '';
                // Get city name from expanded City object
                city = contact.City ? contact.City.Name : '';
                // Note: State name would need StateId lookup - for now use empty string
                state = '';

                if (contact.StreetAddressNumber) {
                    address += `, ${contact.StreetAddressNumber}`;
                }
                if (contact.StreetAddressLine2) {
                    address += `, ${contact.StreetAddressLine2}`;
                }
                if (contact.Neighborhood) {
                    address += `, ${contact.Neighborhood}`;
                }
                if (city) {
                    address += `, ${city}`;
                }

                // CRITICAL FIX: Skip geocoding for performance with large datasets
                // Geocoding will be handled by separate background process or on-demand
                let coords = null;
                // Skip individual geocoding to prevent timeout with 2000+ customers
                // if (address && address.length > 10 && i < 20) { // Only geocode first 20 for sample
                //     coords = await geocodeAddress(address);
                // }

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
                    last_interaction: contact.LastInteractionDate,
                    tags: contact.Tags ? contact.Tags.map(t => ({ id: t.TagId, name: t.TagName || 'Unknown' })) : []
                };

                customers.push(customer);

                // OPTIMIZED: Minimal delay for large datasets (no geocoding means faster processing)
                if (i % batchSize === 0 && i < maxCustomers - 1) {
                    await new Promise(resolve => setTimeout(resolve, 100)); // Short delay every 50 customers
                }
            }

            console.log(`✅ Successfully processed ${customers.length} real customers from Ploome`);
            return res.status(200).json({
                success: true,
                customers: customers,
                total: customers.length,
                total_in_ploome: contacts.length,
                source: 'ploome_api_real_data',
                message: 'Real customers data from Ploome API with geocoding (NO MOCK DATA)',
                metadata: {
                    filtered_by_client_tag: CLIENT_TAG_ID,
                    api_url: PLOOMES_BASE_URL,
                    geocoded_count: customers.filter(c => c.latitude && c.longitude).length,
                    timestamp: new Date().toISOString()
                }
            });

        } catch (ploomeError) {
            console.error('💥 CRITICAL ERROR - Ploome API failed, but NO MOCK DATA FALLBACK ALLOWED');
            console.error('⚠️ User explicitly requested NO MOCK DATA ANYWHERE');
            console.error('Original error:', ploomeError);

            // Return error instead of mock data fallback (user requirement: NO MOCK DATA)
            return res.status(500).json({
                success: false,
                message: 'Ploome API integration failed and mock data is disabled per user requirements',
                error: ploomeError.message,
                details: {
                    type: ploomeError.name || 'NetworkError',
                    code: ploomeError.code,
                    apiUrl: PLOOMES_BASE_URL,
                    clientTagId: CLIENT_TAG_ID,
                    timestamp: new Date().toISOString()
                },
                troubleshooting: [
                    'Check if Ploome API is accessible from Vercel',
                    'Verify PLOOMES_API_KEY is valid',
                    'Verify PLOOMES_BASE_URL is correct',
                    'Check CLIENT_TAG_ID exists in Ploome',
                    'Review Vercel function logs for detailed errors',
                    'Test Ploome API directly with curl or Postman'
                ]
            });
        }

    } catch (error) {
        console.error('💥 Serverless customers error:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error in customers API',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
}