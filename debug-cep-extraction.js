// Debug CEP extraction from real Ploome API data
// Test the actual data structure to find the CEP extraction issue

import https from 'https';
import http from 'http';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Node.js HTTP request utility
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

async function debugCepExtraction() {
    try {
        console.log('🔍 DEBUGGING CEP EXTRACTION ISSUE');
        console.log('==========================================');

        // Get Ploome credentials
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
            throw new Error('Missing Ploome credentials. Check .env file.');
        }

        // Test 1: Get a small sample of customers with full data structure
        console.log('\n📊 TEST 1: Fetching sample customers with full address data');
        console.log('================================================');

        let ploomeUrl = `${PLOOMES_BASE_URL}/Contacts?$top=5&$expand=City,Tags`;
        ploomeUrl += `&$filter=Tags/any(t: t/TagId eq ${CLIENT_TAG_ID})`;

        console.log('🔗 API URL:', ploomeUrl);

        const response = await makeHttpRequest(ploomeUrl, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'User-Key': PLOOMES_API_KEY
            },
            timeout: 15000
        });

        if (!response.ok) {
            const errorText = await response.text().catch(() => 'No error details');
            throw new Error(`Ploome API error: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const data = await response.json();
        const contacts = data.value || [];

        console.log(`✅ Retrieved ${contacts.length} contacts from Ploome API`);
        console.log(`📊 Total count in API response: ${data['@odata.count'] || 'Not provided'}`);

        if (contacts.length === 0) {
            console.log('⚠️  No contacts found with the specified CLIENT_TAG_ID');
            console.log('🔍 This might be the root cause of the issue.');

            // Test without tag filter to see if contacts exist
            console.log('\n🧪 Testing without tag filter to check if contacts exist...');
            const noFilterUrl = `${PLOOMES_BASE_URL}/Contacts?$top=5`;

            const noFilterResponse = await makeHttpRequest(noFilterUrl, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'User-Key': PLOOMES_API_KEY
                }
            });

            if (noFilterResponse.ok) {
                const noFilterData = await noFilterResponse.json();
                console.log(`📊 Total contacts without filter: ${(noFilterData.value || []).length}`);

                if ((noFilterData.value || []).length > 0) {
                    console.log('✅ Contacts exist in Ploome, but CLIENT_TAG_ID filter is too restrictive');
                    const firstContact = noFilterData.value[0];
                    console.log('🔍 Sample contact tags:', firstContact.Tags?.map(t => ({ id: t.TagId, name: t.TagName })) || 'No tags');
                }
            }
            return;
        }

        // Analyze first few contacts for CEP structure
        console.log('\n🔍 DETAILED ANALYSIS OF CONTACT ADDRESS STRUCTURE');
        console.log('===================================================');

        for (let i = 0; i < Math.min(3, contacts.length); i++) {
            const contact = contacts[i];
            console.log(`\n📋 Contact ${i + 1}: ${contact.Name || 'No name'} (ID: ${contact.Id})`);

            // Check if Address exists
            if (!contact.Address) {
                console.log('❌ No Address object found');
                continue;
            }

            console.log('📍 Address structure:');
            console.log(JSON.stringify(contact.Address, null, 2));

            // Test different possible CEP field paths
            const cepTests = [
                { path: 'contact.Address.ZipCode', value: contact.Address.ZipCode },
                { path: 'contact.Address.CEP', value: contact.Address.CEP },
                { path: 'contact.Address.PostalCode', value: contact.Address.PostalCode },
                { path: 'contact.Address.Zip', value: contact.Address.Zip },
                { path: 'contact.Address.zipCode', value: contact.Address.zipCode },
                { path: 'contact.Address.cep', value: contact.Address.cep }
            ];

            console.log('\n🧪 CEP Field Tests:');
            let foundCep = false;
            for (const test of cepTests) {
                if (test.value !== undefined && test.value !== null && test.value !== '') {
                    console.log(`✅ ${test.path}: "${test.value}"`);
                    foundCep = true;
                } else {
                    console.log(`❌ ${test.path}: ${test.value}`);
                }
            }

            if (!foundCep) {
                console.log('⚠️  NO CEP FOUND in any expected field!');

                // Show all fields in Address to identify the correct one
                console.log('\n🔍 All Address fields:');
                for (const [key, value] of Object.entries(contact.Address || {})) {
                    console.log(`   ${key}: "${value}"`);
                }
            }

            // Show tags for context
            if (contact.Tags && contact.Tags.length > 0) {
                console.log('\n🏷️  Tags:');
                for (const tag of contact.Tags) {
                    console.log(`   - ${tag.TagName || 'Unknown'} (ID: ${tag.TagId})`);
                }
            }

            console.log('\n' + '='.repeat(60));
        }

        // Test 2: Statistics about CEP availability
        console.log('\n📊 TEST 2: CEP AVAILABILITY STATISTICS');
        console.log('======================================');

        // Get more contacts for statistical analysis
        const statsUrl = `${PLOOMES_BASE_URL}/Contacts?$top=50&$expand=Tags&$filter=Tags/any(t: t/TagId eq ${CLIENT_TAG_ID})`;
        const statsResponse = await makeHttpRequest(statsUrl, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'User-Key': PLOOMES_API_KEY
            }
        });

        let stats = {
            total: 0,
            hasAddress: 0,
            hasZipCode: 0,
            hasValidCep: 0,
            cepExamples: []
        };

        if (statsResponse.ok) {
            const statsData = await statsResponse.json();
            const statsContacts = statsData.value || [];
            stats.total = statsContacts.length;

            for (const contact of statsContacts) {
                if (contact.Address) {
                    stats.hasAddress++;

                    if (contact.Address.ZipCode) {
                        stats.hasZipCode++;

                        const cleanCep = contact.Address.ZipCode.toString().replace(/\D/g, '');
                        if (cleanCep && cleanCep.length === 8) {
                            stats.hasValidCep++;
                            if (stats.cepExamples.length < 5) {
                                stats.cepExamples.push(cleanCep);
                            }
                        }
                    }
                }
            }
        }

        console.log('📊 CEP Statistics:');
        console.log(`   Total contacts: ${stats.total}`);
        console.log(`   Has Address: ${stats.hasAddress} (${stats.total > 0 ? (stats.hasAddress/stats.total*100).toFixed(1) : 0}%)`);
        console.log(`   Has ZipCode: ${stats.hasZipCode} (${stats.total > 0 ? (stats.hasZipCode/stats.total*100).toFixed(1) : 0}%)`);
        console.log(`   Valid CEPs: ${stats.hasValidCep} (${stats.total > 0 ? (stats.hasValidCep/stats.total*100).toFixed(1) : 0}%)`);

        if (stats.cepExamples.length > 0) {
            console.log(`   CEP Examples: ${stats.cepExamples.join(', ')}`);
        }

        // Conclusion
        console.log('\n🎯 DIAGNOSIS');
        console.log('=============');

        if (contacts.length === 0) {
            console.log('❌ ROOT CAUSE: CLIENT_TAG_ID filter returns no contacts');
            console.log(`   - Current CLIENT_TAG_ID: ${CLIENT_TAG_ID}`);
            console.log('   - Solution: Check if the tag ID exists in Ploome or adjust the filter');
        } else if (stats.hasValidCep === 0) {
            console.log('❌ ROOT CAUSE: No valid CEPs found in contact Address.ZipCode field');
            console.log('   - Check if CEP data exists in a different field');
            console.log('   - Verify CEP data format in Ploome system');
        } else {
            console.log('✅ CEP extraction should be working');
            console.log(`   - Found ${stats.hasValidCep} contacts with valid CEPs`);
            console.log('   - Issue might be in the frontend display or geocoding logic');
        }

    } catch (error) {
        console.error('💥 Debug script error:', error.message);
        console.error('Stack trace:', error.stack);
    }
}

// Run the debug script
debugCepExtraction();