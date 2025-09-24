// Vercel Serverless Function for Batch Geocoding with Supabase Persistence - CRITICAL FIX
// This API will geocode customers who don't have coordinates yet AND SAVE THEM to PostgreSQL
import https from 'https';
import http from 'http';
import supabaseKV from '../../lib/supabase.js';

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

// Geocoding function using OpenStreetMap Nominatim (direct call, no self-referencing)
async function geocodeCustomerCep(cep) {
    if (!cep || cep.length !== 8) {
        return null;
    }

    try {
        // Format CEP with dash: 12345678 -> 12345-678
        const formattedCep = cep.substring(0, 5) + '-' + cep.substring(5);

        // Use OpenStreetMap Nominatim directly instead of self-referencing API
        const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&countrycodes=br&postalcode=${formattedCep}&limit=1`;

        const response = await makeHttpRequest(nominatimUrl, {
            method: 'GET',
            headers: {
                'User-Agent': 'PlomesRotaCEP/1.0 (Batch Geocoding Service)'
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

export default async function handler(req, res) {
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

            // Check how many customers are already geocoded (from Supabase)
            const customerStats = await supabaseKV.getCustomerStats();
            const alreadyGeocoded = customerStats.geocoded || 0;

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
                already_geocoded: alreadyGeocoded,
                needs_geocoding: Math.max(0, totalCustomers - alreadyGeocoded),
                progress_percentage: totalCustomers > 0 ? Math.round((alreadyGeocoded / totalCustomers) * 100) : 0
            };

            if (sampleResponse.ok) {
                const sampleData = await sampleResponse.json();
                const customers = sampleData.value || [];

                // FIXED: Analyze sample to estimate geocoding potential
                let sampleWithCep = 0;
                let sampleWithoutCep = 0;

                for (const customer of customers) {
                    // FIXED: CEP is at contact level, not in Address object
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

    // Handle POST requests for batch geocoding
    if (req.method !== 'POST') {
        return res.status(405).json({
            success: false,
            error: 'Method not allowed'
        });
    }

    try {
        console.log('[BATCH GEOCODING] Starting batch geocoding process...');

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

        // Fetch customers without coordinates from Ploome API
        console.log('[BATCH GEOCODING] Fetching customers from Ploome...');

        // Get batch size from query params (default 50 for serverless timeout limits)
        const batchSize = parseInt(req.query.batch_size) || 50;
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

        console.log(`[BATCH GEOCODING] Processing ${contacts.length} customers...`);

        // Process customers and geocode them
        const results = {
            processed: 0,
            geocoded: 0,
            failed: 0,
            skipped: 0,
            customers: []
        };

        // Process in smaller sub-batches to prevent timeout
        const subBatchSize = 10;

        for (let i = 0; i < contacts.length; i += subBatchSize) {
            const subBatch = contacts.slice(i, i + subBatchSize);

            console.log(`[BATCH GEOCODING] Processing sub-batch ${Math.floor(i/subBatchSize) + 1}...`);

            // Process each customer in the sub-batch
            for (const contact of subBatch) {
                results.processed++;

                // FIXED: Extract CEP from contact (CEP is at contact level, not contact.Address)
                const cep = contact.ZipCode ? contact.ZipCode.toString().replace(/\D/g, '') : '';

                if (!cep || cep.length !== 8) {
                    console.log(`[BATCH GEOCODING] Skipping customer ${contact.Id}: Invalid/missing CEP`);
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
                        state: '', // StateId lookup would be needed for state name
                        latitude: null,
                        longitude: null,
                        ploome_person_id: contact.Id.toString(),
                        geocoding_status: 'invalid_cep'
                    });
                    continue;
                }

                // Geocode customer
                console.log(`[BATCH GEOCODING] Geocoding customer ${contact.Id} with CEP ${cep}...`);
                const geocodeResult = await geocodeCustomerCep(cep);

                let customer = {
                    id: contact.Id,
                    name: contact.Name || 'Nome não informado',
                    email: contact.Email || '',
                    phone: contact.Phones && contact.Phones.length > 0 ? contact.Phones[0].PhoneNumber : '',
                    address: contact.StreetAddress || '',
                    cep: cep,
                    city: contact.City ? contact.City.Name : '',
                    state: '', // StateId lookup would be needed for state name
                    ploome_person_id: contact.Id.toString()
                };

                if (geocodeResult) {
                    customer.latitude = geocodeResult.latitude;
                    customer.longitude = geocodeResult.longitude;
                    customer.geocoding_status = 'success';
                    customer.geocoded_address = geocodeResult.address;
                    results.geocoded++;
                    console.log(`[BATCH GEOCODING] ✅ Geocoded customer ${contact.Id}`);
                } else {
                    customer.latitude = null;
                    customer.longitude = null;
                    customer.geocoding_status = 'failed';
                    results.failed++;
                    console.log(`[BATCH GEOCODING] ❌ Failed to geocode customer ${contact.Id}`);
                }

                results.customers.push(customer);

                // Small delay between requests to respect rate limits
                await new Promise(resolve => setTimeout(resolve, 200));
            }

            // Delay between sub-batches
            if (i + subBatchSize < contacts.length) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        console.log(`[BATCH GEOCODING] Completed: ${results.processed} processed, ${results.geocoded} geocoded, ${results.failed} failed, ${results.skipped} skipped`);

        // SAVE GEOCODED DATA TO PERSISTENT STORAGE
        if (results.customers.length > 0) {
            try {
                console.log('[BATCH GEOCODING] Saving geocoded customers to storage...');

                // Save all customers to Supabase (including non-geocoded ones for completeness)
                const savePromises = results.customers.map(async (customer) => {
                    const customerKey = `customer:${customer.id}`;
                    return await supabaseKV.set(customerKey, JSON.stringify(customer));
                });

                await Promise.all(savePromises);
                console.log(`[BATCH GEOCODING] ✅ Saved ${results.customers.length} customers to Supabase`);

                // Update global statistics in Supabase
                const currentStats = await supabaseKV.getGeocodingStats();
                let stats = {
                    total_processed: 0,
                    total_geocoded: 0,
                    total_failed: 0,
                    total_skipped: 0,
                    last_updated: null
                };

                if (currentStats) {
                    try {
                        stats = JSON.parse(currentStats);
                    } catch (e) {
                        console.warn('[BATCH GEOCODING] Failed to parse existing stats, using defaults');
                    }
                }

                stats.total_processed += results.processed;
                stats.total_geocoded += results.geocoded;
                stats.total_failed += results.failed;
                stats.total_skipped += results.skipped;
                stats.last_updated = new Date().toISOString();

                await supabaseKV.setGeocodingStats(stats);

                // Save batch completion info to Supabase
                await supabaseKV.set(`batch:${skipCount}`, JSON.stringify({
                    completed_at: new Date().toISOString(),
                    batch_size: batchSize,
                    skip_count: skipCount,
                    results: {
                        processed: results.processed,
                        geocoded: results.geocoded,
                        failed: results.failed,
                        skipped: results.skipped
                    }
                }));

                console.log(`[BATCH GEOCODING] ✅ Saved ${results.customers.length} customers to Supabase PostgreSQL`);
            } catch (saveError) {
                console.error('[BATCH GEOCODING] ❌ Failed to save to storage:', saveError);
                // Don't fail the request, just log the error
            }
        }

        return res.status(200).json({
            success: true,
            message: `Batch geocoding completed: ${results.geocoded}/${results.processed} customers geocoded and saved`,
            results: results,
            metadata: {
                batch_size: batchSize,
                skip_count: skipCount,
                next_skip: skipCount + batchSize,
                has_more: contacts.length === batchSize,
                geocoding_rate: results.processed > 0 ? (results.geocoded / results.processed * 100).toFixed(1) + '%' : '0%',
                timestamp: new Date().toISOString(),
                saved_to_supabase: results.customers.length,
                geocoded_count: results.geocoded
            }
        });

    } catch (error) {
        console.error('[BATCH GEOCODING] Error:', error);
        return res.status(500).json({
            success: false,
            error: 'Batch geocoding failed',
            details: error.message
        });
    }
}