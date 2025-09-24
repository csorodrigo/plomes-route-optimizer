// Debug Ploome API to find where address/CEP data is actually stored
import https from 'https';
import http from 'http';
import dotenv from 'dotenv';

dotenv.config();

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

        const req = client.request(reqOptions, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => resolve({
                ok: res.statusCode >= 200 && res.statusCode < 300,
                status: res.statusCode,
                json: async () => JSON.parse(data)
            }));
        });

        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });

        if (options.body) req.write(options.body);
        req.end();
    });
}

async function analyzeData() {
    const PLOOMES_API_KEY = process.env.PLOOMES_API_KEY;
    const PLOOMES_BASE_URL = process.env.PLOOMES_BASE_URL || 'https://public-api2.ploomes.com';
    const CLIENT_TAG_ID = process.env.CLIENT_TAG_ID ? parseInt(process.env.CLIENT_TAG_ID) : 40006184;

    console.log('🔍 DETAILED PLOOME DATA STRUCTURE ANALYSIS');
    console.log('==========================================');

    try {
        // Get contact with ALL possible expansions
        let ploomeUrl = `${PLOOMES_BASE_URL}/Contacts?$top=3`;
        ploomeUrl += `&$expand=City,Tags,Addresses,CustomFields,Tasks,Notes,Products,Deals`;
        ploomeUrl += `&$filter=Tags/any(t: t/TagId eq ${CLIENT_TAG_ID})`;

        console.log('🔗 Testing with full $expand:', ploomeUrl);

        const response = await makeHttpRequest(ploomeUrl, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'User-Key': PLOOMES_API_KEY
            }
        });

        if (!response.ok) {
            console.log('❌ Full expand failed, trying basic contact structure...');

            // Try without expansions to see basic structure
            const basicUrl = `${PLOOMES_BASE_URL}/Contacts?$top=3&$filter=Tags/any(t: t/TagId eq ${CLIENT_TAG_ID})`;
            const basicResponse = await makeHttpRequest(basicUrl, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'User-Key': PLOOMES_API_KEY
                }
            });

            if (basicResponse.ok) {
                const data = await basicResponse.json();
                console.log('✅ Basic contact structure retrieved');
                console.log('📊 Full contact object structure:');
                console.log(JSON.stringify(data.value[0], null, 2));
            }
            return;
        }

        const data = await response.json();
        const contacts = data.value || [];

        console.log(`✅ Retrieved ${contacts.length} contacts with full expansion`);

        if (contacts.length > 0) {
            const contact = contacts[0];
            console.log('\n📋 COMPLETE CONTACT STRUCTURE:');
            console.log('==============================');

            // Show all top-level fields
            console.log('🔍 Top-level fields:');
            for (const [key, value] of Object.entries(contact)) {
                const type = Array.isArray(value) ? `array[${value.length}]` : typeof value;
                const preview = type === 'string' ? `"${value.substring(0, 50)}..."` : type;
                console.log(`   ${key}: ${preview}`);
            }

            // Check for address-related fields
            console.log('\n🏠 ADDRESS-RELATED FIELDS:');
            const addressFields = ['Address', 'Addresses', 'address', 'addresses', 'Street', 'ZipCode', 'CEP', 'Cep'];
            for (const field of addressFields) {
                if (contact.hasOwnProperty(field)) {
                    console.log(`✅ Found ${field}:`, contact[field]);
                } else {
                    console.log(`❌ Missing ${field}`);
                }
            }

            // Check City expansion
            if (contact.City) {
                console.log('\n🏙️  CITY OBJECT:');
                console.log(JSON.stringify(contact.City, null, 2));
            }

            // Check if there are any fields containing ZIP/CEP data
            console.log('\n🔍 SEARCHING FOR ZIP/CEP PATTERNS:');
            function searchForCep(obj, path = '') {
                for (const [key, value] of Object.entries(obj || {})) {
                    const currentPath = path ? `${path}.${key}` : key;

                    if (typeof value === 'string' && /\d{5}-?\d{3}|\d{8}/.test(value)) {
                        console.log(`🎯 POTENTIAL CEP found at ${currentPath}: "${value}"`);
                    } else if (key.toLowerCase().includes('zip') || key.toLowerCase().includes('cep') || key.toLowerCase().includes('postal')) {
                        console.log(`🔍 Address-related field ${currentPath}:`, value);
                    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                        searchForCep(value, currentPath);
                    }
                }
            }

            searchForCep(contact);
        }

        // Test different API endpoints that might have address data
        console.log('\n🧪 TESTING ALTERNATIVE ENDPOINTS');
        console.log('=================================');

        // Try to get a contact by ID with specific address expansion
        if (contacts.length > 0) {
            const contactId = contacts[0].Id;
            const contactUrl = `${PLOOMES_BASE_URL}/Contacts(${contactId})`;

            console.log(`🔗 Testing single contact endpoint: ${contactUrl}`);

            const contactResponse = await makeHttpRequest(contactUrl, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'User-Key': PLOOMES_API_KEY
                }
            });

            if (contactResponse.ok) {
                const contactData = await contactResponse.json();
                console.log('✅ Single contact data received');

                // Look for different address structure
                if (contactData.Address) {
                    console.log('📍 Single contact Address:', JSON.stringify(contactData.Address, null, 2));
                }
            }
        }

    } catch (error) {
        console.error('💥 Analysis error:', error.message);
    }

    // Test the People endpoint as an alternative
    console.log('\n🧪 TESTING PEOPLE ENDPOINT (Alternative to Contacts)');
    console.log('====================================================');

    try {
        const peopleUrl = `${PLOOMES_BASE_URL}/People?$top=3`;
        console.log('🔗 Testing People endpoint:', peopleUrl);

        const peopleResponse = await makeHttpRequest(peopleUrl, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'User-Key': PLOOMES_API_KEY
            }
        });

        if (peopleResponse.ok) {
            const peopleData = await peopleResponse.json();
            console.log('✅ People endpoint accessible');
            console.log(`📊 People count: ${(peopleData.value || []).length}`);

            if ((peopleData.value || []).length > 0) {
                const person = peopleData.value[0];
                console.log('\n👤 PERSON STRUCTURE:');

                for (const [key, value] of Object.entries(person)) {
                    if (key.toLowerCase().includes('address') || key.toLowerCase().includes('zip') || key.toLowerCase().includes('cep')) {
                        console.log(`🔍 ${key}:`, value);
                    }
                }

                // Search for CEP patterns in Person object
                function searchPersonForCep(obj, path = '') {
                    for (const [key, value] of Object.entries(obj || {})) {
                        const currentPath = path ? `${path}.${key}` : key;

                        if (typeof value === 'string' && /\d{5}-?\d{3}|\d{8}/.test(value)) {
                            console.log(`🎯 POTENTIAL CEP in People at ${currentPath}: "${value}"`);
                        }
                    }
                }

                searchPersonForCep(person);
            }
        } else {
            console.log('❌ People endpoint not accessible or no data');
        }

    } catch (error) {
        console.log('⚠️  People endpoint test failed:', error.message);
    }
}

analyzeData();