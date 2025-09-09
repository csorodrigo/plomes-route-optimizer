const PloomeService = require('./services/sync/ploome-service');
const axios = require('axios');
require('dotenv').config();

async function investigateTagNames() {
    console.log('🏷️  Investigating Ploomes tag names...\n');
    
    const apiKey = process.env.PLOOME_API_KEY;
    if (!apiKey) {
        console.error('❌ PLOOME_API_KEY not found in environment variables');
        process.exit(1);
    }
    
    const baseUrl = process.env.PLOOME_API_URL || 'https://public-api2.ploomes.com';
    
    try {
        // First, let's try to get all available tags
        console.log('🔍 Fetching all available tags from Ploomes...');
        
        // According to the API guide, we can get tag information from various endpoints
        // Let's try the Fields endpoint to see if we can get tag definitions
        const fieldsResponse = await axios.get(`${baseUrl}/Fields`, {
            headers: {
                'User-Key': apiKey,
                'Content-Type': 'application/json; charset=utf-8'
            }
        });
        
        console.log(`📋 Found ${fieldsResponse.data.value?.length || 0} fields in total`);
        
        // Look for tag-related fields
        const tagFields = fieldsResponse.data.value?.filter(field => 
            field.Name?.toLowerCase().includes('tag') || 
            field.Key?.toLowerCase().includes('tag')
        ) || [];
        
        console.log(`🏷️  Found ${tagFields.length} tag-related fields:`);
        tagFields.forEach(field => {
            console.log(`   • ${field.Name} (Key: ${field.Key}, Type: ${field.TypeId})`);
        });
        
        // Try to get tag options tables
        console.log('\n🔍 Searching for tag option tables...');
        const optionTablesResponse = await axios.get(`${baseUrl}/Fields@OptionsTables`, {
            headers: {
                'User-Key': apiKey,
                'Content-Type': 'application/json; charset=utf-8'
            }
        });
        
        console.log(`📋 Found ${optionTablesResponse.data.value?.length || 0} option tables`);
        
        // Look for tag-related option tables
        const tagOptionTables = optionTablesResponse.data.value?.filter(table => 
            table.Name?.toLowerCase().includes('tag')
        ) || [];
        
        if (tagOptionTables.length > 0) {
            console.log('\n🏷️  Tag option tables found:');
            for (const table of tagOptionTables) {
                console.log(`\n   📋 Table: ${table.Name} (ID: ${table.Id})`);
                
                // Get options for this table
                try {
                    const optionsResponse = await axios.get(`${baseUrl}/Fields@OptionsTables?$filter=Id eq ${table.Id}&$expand=Options`, {
                        headers: {
                            'User-Key': apiKey,
                            'Content-Type': 'application/json; charset=utf-8'
                        }
                    });
                    
                    const tableWithOptions = optionsResponse.data.value?.[0];
                    if (tableWithOptions?.Options) {
                        console.log(`      Options (${tableWithOptions.Options.length}):`);
                        tableWithOptions.Options.forEach(option => {
                            console.log(`         • ${option.Name} (ID: ${option.Id})`);
                        });
                    }
                } catch (error) {
                    console.log(`      ⚠️  Could not fetch options: ${error.message}`);
                }
            }
        }
        
        // Now let's try a different approach - check if there's a Tags endpoint
        console.log('\n🔍 Trying direct Tags endpoint...');
        try {
            const tagsResponse = await axios.get(`${baseUrl}/Tags`, {
                headers: {
                    'User-Key': apiKey,
                    'Content-Type': 'application/json; charset=utf-8'
                }
            });
            
            console.log(`✅ Direct Tags endpoint works! Found ${tagsResponse.data.value?.length || 0} tags:`);
            if (tagsResponse.data.value) {
                tagsResponse.data.value.slice(0, 20).forEach(tag => {
                    console.log(`   • ${tag.Name || tag.Value || 'Unnamed'} (ID: ${tag.Id})`);
                });
                
                if (tagsResponse.data.value.length > 20) {
                    console.log(`   ... and ${tagsResponse.data.value.length - 20} more`);
                }
                
                // Look for customer-related tags
                const customerTags = tagsResponse.data.value.filter(tag => {
                    const name = tag.Name || tag.Value || '';
                    return name.toLowerCase().includes('client') || 
                           name.toLowerCase().includes('customer') ||
                           name.toLowerCase().includes('cliente');
                });
                
                if (customerTags.length > 0) {
                    console.log('\n🎯 Found potential customer tags:');
                    customerTags.forEach(tag => {
                        console.log(`   • "${tag.Name || tag.Value}" (ID: ${tag.Id})`);
                    });
                } else {
                    console.log('\n⚠️  No customer-related tags found in tag names');
                }
            }
            
        } catch (error) {
            console.log(`❌ Direct Tags endpoint failed: ${error.response?.status} ${error.response?.statusText}`);
        }
        
        // Let's also try Contacts@Tags pattern
        console.log('\n🔍 Trying Contacts@Tags endpoint...');
        try {
            const contactTagsResponse = await axios.get(`${baseUrl}/Contacts@Tags`, {
                headers: {
                    'User-Key': apiKey,
                    'Content-Type': 'application/json; charset=utf-8'
                }
            });
            
            console.log(`✅ Contacts@Tags endpoint works! Found ${contactTagsResponse.data.value?.length || 0} tag definitions`);
            if (contactTagsResponse.data.value) {
                contactTagsResponse.data.value.slice(0, 20).forEach(tag => {
                    console.log(`   • ${tag.Name || tag.Value || 'Unnamed'} (ID: ${tag.Id})`);
                });
            }
            
        } catch (error) {
            console.log(`❌ Contacts@Tags endpoint failed: ${error.response?.status} ${error.response?.statusText}`);
        }
        
        // Based on what we found, let's get some actual contacts and correlate TagIds
        console.log('\n🔍 Correlating TagIds from actual contacts...');
        const service = new PloomeService(apiKey);
        const result = await service.fetchContacts({ skip: 0, top: 5 });
        
        const uniqueTagIds = new Set();
        if (result.value) {
            result.value.forEach(contact => {
                if (contact.Tags && Array.isArray(contact.Tags)) {
                    contact.Tags.forEach(tag => {
                        if (tag.TagId) {
                            uniqueTagIds.add(tag.TagId);
                        }
                    });
                }
            });
        }
        
        console.log(`🏷️  Found ${uniqueTagIds.size} unique TagIds in contacts:`);
        Array.from(uniqueTagIds).forEach(tagId => {
            console.log(`   • TagId: ${tagId}`);
        });
        
        // Final recommendation
        console.log('\n' + '=' .repeat(80));
        console.log('💡 ANALYSIS AND RECOMMENDATIONS:\n');
        
        console.log('🔍 ROOT CAUSE:');
        console.log('   • Tags in contacts only contain TagId references, not actual names');
        console.log('   • The current code expects tags to have Name/Value properties');
        console.log('   • No direct tag name lookup is being performed');
        
        console.log('\n🛠️  SOLUTION OPTIONS:');
        console.log('   1. Remove tag-based filtering entirely (sync all contacts)');
        console.log('   2. Use contact TypeId (1=Company, 2=Person) for classification');
        console.log('   3. Use other contact properties like Status or Classification');
        console.log('   4. Implement tag name lookup using TagId references');
        
        console.log('\n🚀 IMMEDIATE FIX:');
        console.log('   • Modify isValidContact() to remove tag filtering');
        console.log('   • Add alternative filtering criteria if needed');
        console.log('   • This will allow all contacts with address data to sync');
        
    } catch (error) {
        console.error('❌ Error during tag investigation:', error.message);
        if (error.response) {
            console.error('   Status:', error.response.status);
            console.error('   Response:', error.response.data);
        }
    }
}

// Run the investigation
investigateTagNames()
    .then(() => {
        console.log('\n🎯 Tag investigation complete!');
        process.exit(0);
    })
    .catch(error => {
        console.error('\n❌ Tag investigation failed:', error);
        process.exit(1);
    });