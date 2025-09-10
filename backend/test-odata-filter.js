// Test script to verify OData filter for Cliente tag
require('dotenv').config({ path: '../.env' });
const axios = require('axios');

const CLIENT_TAG_ID = 40006184;
const API_KEY = process.env.PLOOME_API_KEY;

async function testODataFilter() {
    console.log('🧪 Testing OData filter for Cliente tag...\n');
    
    // Test 1: Fetch with OData filter (should return only Cliente contacts)
    const urlWithFilter = `https://public-api2.ploomes.com/Contacts?$top=10&$skip=0&$expand=City,Tags&$filter=Tags/any(t: t/TagId eq ${CLIENT_TAG_ID})`;
    
    console.log('📍 URL with OData filter:');
    console.log(urlWithFilter);
    console.log('\n');
    
    try {
        const response = await axios.get(urlWithFilter, {
            headers: {
                'User-Key': API_KEY,
                'Content-Type': 'application/json; charset=utf-8'
            }
        });
        
        console.log(`✅ Response received: ${response.data.value.length} contacts\n`);
        
        // Analyze results
        let contactsWithClienteTag = 0;
        let contactsWithoutClienteTag = 0;
        
        for (const contact of response.data.value) {
            const hasClienteTag = contact.Tags && contact.Tags.some(t => t.TagId === CLIENT_TAG_ID);
            
            if (hasClienteTag) {
                contactsWithClienteTag++;
                console.log(`✅ ${contact.Name} - HAS Cliente tag`);
            } else {
                contactsWithoutClienteTag++;
                console.log(`❌ ${contact.Name} - MISSING Cliente tag (should not happen!)`);
            }
        }
        
        console.log('\n📊 Summary:');
        console.log(`   Contacts WITH Cliente tag: ${contactsWithClienteTag}`);
        console.log(`   Contacts WITHOUT Cliente tag: ${contactsWithoutClienteTag}`);
        
        if (contactsWithoutClienteTag > 0) {
            console.log('\n⚠️  WARNING: OData filter is not working correctly!');
        } else {
            console.log('\n✅ SUCCESS: OData filter is working perfectly!');
        }
        
    } catch (error) {
        console.error('❌ Error:', error.response?.data || error.message);
        
        if (error.response?.status === 400) {
            console.log('\n⚠️  The OData filter syntax might not be supported.');
            console.log('    Falling back to client-side filtering will be necessary.');
        }
    }
}

// Run test
testODataFilter().catch(console.error);