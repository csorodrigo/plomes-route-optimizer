// Simple Geocoding API - Production Ready Without Supabase Dependencies
// This API will geocode customers directly without requiring persistent storage setup
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

        if (options.body) {
            req.write(options.body);
        }

        req.end();
    });
}

// Geocoding function using OpenStreetMap Nominatim
async function geocodeCustomerCep(cep) {
    if (!cep || cep.length !== 8) {
        return null;
    }

    try {
        // Format CEP with dash: 12345678 -> 12345-678
        const formattedCep = cep.substring(0, 5) + '-' + cep.substring(5);

        // Use OpenStreetMap Nominatim
        const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&countrycodes=br&postalcode=${formattedCep}&limit=1`;

        const response = await makeHttpRequest(nominatimUrl, {
            method: 'GET',
            headers: {
                'User-Agent': 'PlomesRotaCEP/1.0 (Simple Geocoding Service)'
            },
            timeout: 6000
        });

        if (!response.ok) {
            return null;
        }

        const data = await response.json();
        if (data && Array.isArray(data) && data.length > 0) {
            const result = data[0];
            return {
                latitude: parseFloat(result.lat),
                longitude: parseFloat(result.lon),
                address: result.display_name
            };
        }

        return null;
    } catch (error) {
        console.error(`Geocoding failed for CEP ${cep}:`, error.message);
        return null;
    }
}

module.exports = async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Handle GET requests for progress status
    if (req.method === 'GET') {
        try {
            console.log('[SIMPLE GEOCODING] Checking geocoding progress...');

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

            // Get total customer count
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

            // Get sample to analyze geocoding potential
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
                already_geocoded: 0, // Always 0 for simple version
                needs_geocoding: totalCustomers,
                progress_percentage: 0 // Always 0 for simple version
            };

            if (sampleResponse.ok) {
                const sampleData = await sampleResponse.json();
                const customers = sampleData.value || [];

                // Analyze sample to estimate geocoding potential
                let sampleWithCep = 0;
                let sampleWithoutCep = 0;

                for (const customer of customers) {
                    const cep = customer.ZipCode ? customer.ZipCode.toString().replace(/\D/g, '') : '';
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
                status: 'ready',
                message: `${totalCustomers} customers ready for geocoding. Estimated ${geocodingProgress.estimated_geocodable} can be geocoded based on CEP availability.`,
                recommendations: {
                    batch_size: 25, // Smaller batches for simple version
                    estimated_time: Math.ceil(geocodingProgress.estimated_geocodable / 25) + ' minutes',
                    suggested_action: 'Run batch geocoding to process customers with valid CEPs'
                },
                metadata: {
                    client_tag_id: CLIENT_TAG_ID,
                    timestamp: new Date().toISOString(),
                    version: 'simple',
                    persistence: 'disabled'
                }
            });

        } catch (error) {
            console.error('[SIMPLE GEOCODING] Error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to get geocoding progress',
                details: error.message
            });
        }
    }

    // Handle POST requests for batch geocoding
    if (req.method !== 'POST') {
        return res.status(405).json({
            success: false,
            error: 'Method not allowed'
        });
    }

    try {
        console.log('[SIMPLE BATCH GEOCODING] Starting simple batch geocoding process...');

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

        // Get batch size from query params (smaller for simple version)
        const batchSize = Math.min(parseInt(req.query.batch_size) || 25, 25); // Max 25 for timeout safety
        const skipCount = parseInt(req.query.skip) || 0;

        let ploomeUrl = `${PLOOMES_BASE_URL}/Contacts?$top=${batchSize}&$skip=${skipCount}`;
        ploomeUrl += `&$expand=City,Tags`;
        ploomeUrl += `&$filter=Tags/any(t: t/TagId eq ${CLIENT_TAG_ID})`;

        const ploomeResponse = await makeHttpRequest(ploomeUrl, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'User-Key': PLOOMES_API_KEY
            },
            timeout: 12000
        });

        if (!ploomeResponse.ok) {
            throw new Error(`Ploome API error: ${ploomeResponse.status} ${ploomeResponse.statusText}`);
        }

        const ploomeData = await ploomeResponse.json();
        const contacts = ploomeData.value || [];

        console.log(`[SIMPLE BATCH GEOCODING] Processing ${contacts.length} customers...`);

        // Process customers and geocode them
        const results = {
            processed: 0,
            geocoded: 0,
            failed: 0,
            skipped: 0,
            customers: []
        };

        // Process each customer
        for (const contact of contacts) {
            results.processed++;

            // Extract CEP from contact
            const cep = contact.ZipCode ? contact.ZipCode.toString().replace(/\D/g, '') : '';

            if (!cep || cep.length !== 8) {
                console.log(`[SIMPLE BATCH GEOCODING] Skipping customer ${contact.Id}: Invalid/missing CEP`);
                results.skipped++;

                // Add customer without coordinates
                results.customers.push({
                    id: contact.Id,
                    name: contact.Name || 'Nome não informado',
                    email: contact.Email || '',
                    phone: contact.Phones && contact.Phones.length > 0 ? contact.Phones[0].PhoneNumber : '',
                    address: contact.StreetAddress || '',
                    cep: cep || '',
                    city: contact.City ? contact.City.Name : '',
                    state: '',
                    latitude: null,
                    longitude: null,
                    ploome_person_id: contact.Id.toString(),
                    geocoding_status: 'invalid_cep'
                });
                continue;
            }

            // Geocode customer
            console.log(`[SIMPLE BATCH GEOCODING] Geocoding customer ${contact.Id} with CEP ${cep}...`);
            const geocodeResult = await geocodeCustomerCep(cep);

            let customer = {
                id: contact.Id,
                name: contact.Name || 'Nome não informado',
                email: contact.Email || '',
                phone: contact.Phones && contact.Phones.length > 0 ? contact.Phones[0].PhoneNumber : '',
                address: contact.StreetAddress || '',
                cep: cep,
                city: contact.City ? contact.City.Name : '',
                state: '',
                ploome_person_id: contact.Id.toString()
            };

            if (geocodeResult) {
                customer.latitude = geocodeResult.latitude;
                customer.longitude = geocodeResult.longitude;
                customer.geocoding_status = 'success';
                customer.geocoded_address = geocodeResult.address;
                results.geocoded++;
                console.log(`[SIMPLE BATCH GEOCODING] ✅ Geocoded customer ${contact.Id}`);
            } else {
                customer.latitude = null;
                customer.longitude = null;
                customer.geocoding_status = 'failed';
                results.failed++;
                console.log(`[SIMPLE BATCH GEOCODING] ❌ Failed to geocode customer ${contact.Id}`);
            }

            results.customers.push(customer);

            // Small delay between requests to respect rate limits
            await new Promise(resolve => setTimeout(resolve, 300));
        }

        console.log(`[SIMPLE BATCH GEOCODING] Completed: ${results.processed} processed, ${results.geocoded} geocoded, ${results.failed} failed, ${results.skipped} skipped`);

        return res.status(200).json({
            success: true,
            message: `Simple batch geocoding completed: ${results.geocoded}/${results.processed} customers geocoded (no persistence)`,
            results: results,
            metadata: {
                batch_size: batchSize,
                skip_count: skipCount,
                next_skip: skipCount + batchSize,
                has_more: contacts.length === batchSize,
                geocoding_rate: results.processed > 0 ? (results.geocoded / results.processed * 100).toFixed(1) + '%' : '0%',
                timestamp: new Date().toISOString(),
                geocoded_count: results.geocoded,
                version: 'simple',
                persistence: 'disabled',
                note: 'Data not saved - use for testing geocoding functionality'
            }
        });

    } catch (error) {
        console.error('[SIMPLE BATCH GEOCODING] Error:', error);
        return res.status(500).json({
            success: false,
            error: 'Simple batch geocoding failed',
            details: error.message
        });
    }
}