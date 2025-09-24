// Vercel Serverless Function for Customer Sync API - REAL PLOOME INTEGRATION ONLY
// NO MOCK DATA FALLBACKS PER USER REQUIREMENTS
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
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Handle preflight OPTIONS request
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Only allow POST method for sync operation
    if (req.method !== 'POST') {
        return res.status(405).json({
            success: false,
            message: 'Method not allowed. Use POST to sync customers.'
        });
    }

    try {
        console.log('🔄 Vercel Serverless Customer Sync API called - REAL PLOOME INTEGRATION ONLY');

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
            console.error('❌ Missing Ploome credentials for sync');
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

        const startTime = Date.now();
        const syncLog = {
            type: 'customer_sync_serverless',
            startedAt: new Date().toISOString(),
            fetched: 0,
            processed: 0,
            errors: 0,
            source: 'ploome_api_real_data'
        };

        // Function to fetch customers from Ploome in batches (like local backend)
        async function fetchCustomersBatch(skip = 0, top = 20) {
            try {
                // Build URL with proper filtering for CLIENT_TAG_ID (like local backend)
                let ploomeUrl = `${PLOOMES_BASE_URL}/Contacts?$top=${top}&$skip=${skip}`;

                // Add OData filter to get ONLY contacts that have the Cliente tag (like local backend)
                ploomeUrl += `&$expand=City,Tags`;
                ploomeUrl += `&$filter=Tags/any(t: t/TagId eq ${CLIENT_TAG_ID})`;

                console.log('🔄 Fetching batch from Ploome with CLIENT_TAG_ID filter:', ploomeUrl);
                console.log('🎯 Using CLIENT_TAG_ID:', CLIENT_TAG_ID);
                console.log('📊 Pagination: skip=' + skip + ', top=' + top);

                const ploomeResponse = await fetchWithRetry(ploomeUrl, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        'User-Key': PLOOMES_API_KEY
                    },
                    timeout: 12000 // Longer timeout for filtered requests
                }, 2); // Reduced retries for batch operations

                if (!ploomeResponse.ok) {
                    const errorText = await ploomeResponse.text().catch(() => 'No error details');
                    console.error('❌ Ploome API batch error:', ploomeResponse.status, ploomeResponse.statusText, errorText);
                    throw new Error(`Ploome API error: ${ploomeResponse.status} ${ploomeResponse.statusText}`);
                }

                const ploomeData = await ploomeResponse.json();
                const contacts = ploomeData.value || [];

                console.log(`✅ Batch received: ${contacts.length} contacts from Ploome`);

                return {
                    contacts: contacts,
                    hasMore: contacts.length === top, // If we got full batch, there might be more
                    total: ploomeData['@odata.count'] || null
                };

            } catch (error) {
                console.error('❌ Error fetching batch:', error.message);
                throw error;
            }
        }

        // Process customers in batches to respect serverless timeout limits
        let allCustomers = [];
        let skip = 0;
        const batchSize = 20; // Small batches for serverless performance
        let hasMore = true;
        let totalFetched = 0;
        const maxCustomers = 50; // Limit total customers for serverless timeout

        console.log('🚀 Starting customer sync with batch processing...');

        while (hasMore && totalFetched < maxCustomers) {
            try {
                const batch = await fetchCustomersBatch(skip, batchSize);

                if (batch.contacts.length === 0) {
                    console.log('📭 No more customers to fetch');
                    hasMore = false;
                    break;
                }

                // Process each contact in the batch
                for (const contact of batch.contacts) {
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

                    // Format customer data (no geocoding in sync for performance)
                    const customer = {
                        id: contact.Id,
                        name: contact.Name || 'Nome não informado',
                        email: contact.Email || '',
                        phone: contact.Phones && contact.Phones.length > 0 ? contact.Phones[0].PhoneNumber : '',
                        address: address,
                        cep: cep,
                        city: city,
                        state: state,
                        latitude: null, // No geocoding during sync
                        longitude: null, // No geocoding during sync
                        ploome_person_id: contact.Id.toString(),
                        created_date: contact.CreateDate,
                        last_interaction: contact.LastInteractionDate,
                        tags: contact.Tags ? contact.Tags.map(t => ({ id: t.TagId, name: t.TagName || 'Unknown' })) : []
                    };

                    allCustomers.push(customer);
                    syncLog.processed++;
                }

                totalFetched += batch.contacts.length;
                syncLog.fetched = totalFetched;
                skip += batchSize;

                // Check if we have more data
                hasMore = batch.hasMore && totalFetched < maxCustomers;

                console.log(`📊 Progress: ${totalFetched} customers fetched, ${syncLog.processed} processed`);

                // Add delay between batches to respect rate limits
                if (hasMore) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }

            } catch (error) {
                console.error('❌ Batch processing error:', error.message);
                syncLog.errors++;

                // Continue with next batch on error
                skip += batchSize;
                hasMore = skip < maxCustomers;
            }
        }

        syncLog.completedAt = new Date().toISOString();
        syncLog.status = syncLog.errors === 0 ? 'success' : 'partial';

        const duration = (Date.now() - startTime) / 1000;

        console.log(`✅ Customer sync completed: ${syncLog.processed} customers in ${duration.toFixed(2)}s`);

        // Return sync results (in serverless, we don't persist to database)
        return res.status(200).json({
            success: true,
            message: `Synced ${syncLog.processed} customers from Ploome in ${duration.toFixed(2)}s`,
            details: {
                ...syncLog,
                duration: duration,
                customers_preview: allCustomers.slice(0, 3), // Show first 3 customers as preview
                total_customers: allCustomers.length
            },
            metadata: {
                filtered_by_client_tag: CLIENT_TAG_ID,
                api_url: PLOOMES_BASE_URL,
                batch_size: batchSize,
                max_customers_limit: maxCustomers,
                source: 'ploome_api_real_data_sync',
                note: 'Serverless sync - customers are fetched but not persisted to database',
                timestamp: new Date().toISOString()
            },
            customers: allCustomers // Return all synced customers
        });

    } catch (error) {
        console.error('💥 Serverless customer sync error:', error);

        // Return error instead of mock data fallback (user requirement: NO MOCK DATA)
        return res.status(500).json({
            success: false,
            message: 'Customer sync failed and mock data is disabled per user requirements',
            error: error.message,
            details: {
                type: error.name || 'SyncError',
                code: error.code,
                timestamp: new Date().toISOString()
            },
            troubleshooting: [
                'Check if Ploome API is accessible from Vercel',
                'Verify PLOOMES_API_KEY is valid',
                'Verify PLOOMES_BASE_URL is correct',
                'Check CLIENT_TAG_ID exists in Ploome',
                'Review Vercel function logs for detailed errors',
                'Test Ploome API directly with curl or Postman',
                'Check Vercel function timeout limits'
            ]
        });
    }
}