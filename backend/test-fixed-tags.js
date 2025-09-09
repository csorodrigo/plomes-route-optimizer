const PloomeService = require('./services/sync/ploome-service');
require('dotenv').config();

async function testFixedTagFiltering() {
    console.log('🧪 Testing fixed tag filtering...\n');
    
    const apiKey = process.env.PLOOME_API_KEY;
    if (!apiKey) {
        console.error('❌ PLOOME_API_KEY not found in environment variables');
        process.exit(1);
    }
    
    const service = new PloomeService(apiKey);
    
    try {
        // Test connection
        console.log('🔗 Testing connection...');
        const connectionTest = await service.testConnection();
        if (!connectionTest) {
            console.error('❌ Connection failed');
            process.exit(1);
        }
        console.log('✅ Connection successful\n');
        
        // Test tag fetching
        console.log('🏷️  Testing tag fetching and caching...');
        const tags = await service.fetchTags();
        console.log(`✅ Fetched and cached ${tags.size} tags\n`);
        
        // List some important tags
        console.log('🎯 Important tags found:');
        const importantTags = ['Cliente', 'Fornecedor', 'Ativo'];
        importantTags.forEach(tagName => {
            const tagId = Array.from(tags.entries()).find(([id, name]) => name === tagName)?.[0];
            if (tagId) {
                console.log(`   • ${tagName} (ID: ${tagId})`);
            } else {
                console.log(`   • ${tagName} - NOT FOUND`);
            }
        });
        
        // Test contact fetching with new filtering
        console.log('\n📥 Testing contact fetching with fixed tag filtering...');
        const result = await service.fetchContacts({ skip: 0, top: 10 });
        
        if (!result.value || !Array.isArray(result.value)) {
            console.error('❌ Invalid response format');
            process.exit(1);
        }
        
        console.log(`📊 Fetched ${result.value.length} contacts from API\n`);
        
        // Test each contact individually
        let validCount = 0;
        let customerCount = 0;
        
        console.log('🔍 Testing each contact:');
        console.log('-' .repeat(80));
        
        for (let i = 0; i < result.value.length; i++) {
            const contact = result.value[i];
            console.log(`\n📋 Contact ${i + 1}: ${contact.Name} (ID: ${contact.Id})`);
            
            // Check tags
            if (contact.Tags && Array.isArray(contact.Tags) && contact.Tags.length > 0) {
                console.log(`   🏷️  Raw tags (${contact.Tags.length}):`);
                contact.Tags.forEach((tag, idx) => {
                    const tagName = tags.get(tag.TagId) || `Unknown_${tag.TagId}`;
                    console.log(`      ${idx + 1}. TagId: ${tag.TagId} → "${tagName}"`);
                });
                
                // Test hasClientTag
                const hasClientTag = await service.hasClientTag(contact);
                if (hasClientTag) {
                    customerCount++;
                    console.log(`   ✅ HAS "Cliente" tag`);
                } else {
                    console.log(`   ❌ No "Cliente" tag`);
                }
            } else {
                console.log(`   🏷️  No tags`);
            }
            
            // Test full validation
            const isValid = await service.isValidContact(contact);
            if (isValid) {
                validCount++;
                console.log(`   ✅ PASSES validation (customer with address)`);
                
                // Test mapping
                const mapped = await service.mapContact(contact);
                console.log(`   📍 Mapped tags: [${mapped.tags.join(', ')}]`);
            } else {
                console.log(`   ❌ FAILS validation`);
            }
        }
        
        console.log('\n' + '=' .repeat(80));
        console.log('📊 FINAL RESULTS:\n');
        
        console.log(`📈 Statistics:`);
        console.log(`   • Total contacts analyzed: ${result.value.length}`);
        console.log(`   • Contacts with "Cliente" tag: ${customerCount}`);
        console.log(`   • Contacts passing full validation: ${validCount}`);
        console.log(`   • Success rate: ${((validCount / result.value.length) * 100).toFixed(1)}%`);
        
        if (validCount > 0) {
            console.log('\n🎉 SUCCESS! The fix is working:');
            console.log(`   ✅ Tag lookup is functioning correctly`);
            console.log(`   ✅ Customer filtering now works`);
            console.log(`   ✅ ${validCount} contacts would be synced`);
            
            console.log('\n🚀 Next steps:');
            console.log('   1. The Ploomes sync should now find customer contacts');
            console.log('   2. Run the full sync to import all customers');
            console.log('   3. Verify the imported data in the application');
        } else {
            console.log('\n⚠️  No contacts passed validation. Possible causes:');
            console.log('   1. No contacts have the "Cliente" tag');
            console.log('   2. Contacts with "Cliente" tag have no address data');
            console.log('   3. The tag ID might be different than expected');
        }
        
        console.log('\n' + '=' .repeat(80));
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        if (error.response) {
            console.error('   Status:', error.response.status);
            console.error('   Response:', error.response.data);
        }
        process.exit(1);
    }
}

// Run the test
testFixedTagFiltering()
    .then(() => {
        console.log('\n🎯 Test completed successfully!');
        process.exit(0);
    })
    .catch(error => {
        console.error('\n❌ Test failed with error:', error);
        process.exit(1);
    });