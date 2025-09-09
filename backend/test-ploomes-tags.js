const PloomeService = require('./services/sync/ploome-service');
require('dotenv').config();

async function investigatePloomesContactTags() {
    console.log('🔍 Investigating Ploomes contact tags...\n');
    
    // Check environment variables
    const apiKey = process.env.PLOOME_API_KEY;
    if (!apiKey) {
        console.error('❌ PLOOME_API_KEY not found in environment variables');
        process.exit(1);
    }
    
    const service = new PloomeService(apiKey);
    
    // Test connection first
    console.log('🔗 Testing connection to Ploomes API...');
    const connectionTest = await service.testConnection();
    if (!connectionTest) {
        console.error('❌ Failed to connect to Ploomes API');
        process.exit(1);
    }
    console.log('✅ Connection successful\n');
    
    try {
        // Fetch first batch of contacts with detailed logging
        console.log('📥 Fetching first 10 contacts to analyze tags...');
        const result = await service.fetchContacts({ 
            skip: 0, 
            top: 10,
            includeAddress: true 
        });
        
        if (!result.value || !Array.isArray(result.value)) {
            console.error('❌ Invalid response format from Ploomes API');
            console.log('Response:', JSON.stringify(result, null, 2));
            process.exit(1);
        }
        
        console.log(`📊 Received ${result.value.length} contacts from API\n`);
        
        // Analyze each contact's tags
        const tagAnalysis = {
            allTags: new Set(),
            contactsWithTags: 0,
            contactsWithoutTags: 0,
            tagStructures: []
        };
        
        console.log('🏷️  CONTACT TAG ANALYSIS:\n');
        console.log('=' .repeat(80));
        
        result.value.forEach((contact, index) => {
            console.log(`\n📋 Contact ${index + 1}: ${contact.Name || 'No Name'} (ID: ${contact.Id})`);
            console.log(`   Email: ${contact.Email || 'No email'}`);
            console.log(`   Type: ${contact.TypeId === 1 ? 'Company' : contact.TypeId === 2 ? 'Person' : 'Unknown'}`);
            
            if (contact.Tags && Array.isArray(contact.Tags)) {
                if (contact.Tags.length > 0) {
                    tagAnalysis.contactsWithTags++;
                    console.log(`   🏷️  Tags (${contact.Tags.length}):`);
                    
                    contact.Tags.forEach((tag, tagIndex) => {
                        console.log(`      Tag ${tagIndex + 1}:`, JSON.stringify(tag, null, 8));
                        
                        // Extract tag name/value to analyze structure
                        let tagName = null;
                        if (typeof tag === 'string') {
                            tagName = tag;
                        } else if (tag && tag.Name) {
                            tagName = tag.Name;
                        } else if (tag && tag.Value) {
                            tagName = tag.Value;
                        }
                        
                        if (tagName) {
                            tagAnalysis.allTags.add(tagName);
                        }
                        
                        // Store tag structure for analysis
                        tagAnalysis.tagStructures.push({
                            contactId: contact.Id,
                            contactName: contact.Name,
                            tagIndex,
                            rawTag: tag,
                            extractedName: tagName
                        });
                    });
                } else {
                    tagAnalysis.contactsWithoutTags++;
                    console.log('   🏷️  Tags: Empty array');
                }
            } else {
                tagAnalysis.contactsWithoutTags++;
                console.log('   🏷️  Tags: Not present or not an array');
                if (contact.Tags) {
                    console.log('      Raw Tags value:', JSON.stringify(contact.Tags, null, 8));
                }
            }
        });
        
        console.log('\n' + '=' .repeat(80));
        console.log('📊 SUMMARY:\n');
        
        console.log(`📈 Statistics:`);
        console.log(`   • Total contacts analyzed: ${result.value.length}`);
        console.log(`   • Contacts with tags: ${tagAnalysis.contactsWithTags}`);
        console.log(`   • Contacts without tags: ${tagAnalysis.contactsWithoutTags}`);
        console.log(`   • Unique tags found: ${tagAnalysis.allTags.size}`);
        
        console.log(`\n🏷️  All unique tag names found:`);
        if (tagAnalysis.allTags.size > 0) {
            Array.from(tagAnalysis.allTags).sort().forEach(tagName => {
                console.log(`   • "${tagName}"`);
            });
        } else {
            console.log('   • No tags found in any contact');
        }
        
        // Check for customer-related tags
        console.log(`\n🔍 Customer tag analysis:`);
        const customerTags = Array.from(tagAnalysis.allTags).filter(tag => 
            tag.toLowerCase().includes('client') || 
            tag.toLowerCase().includes('customer') ||
            tag.toLowerCase().includes('cliente')
        );
        
        if (customerTags.length > 0) {
            console.log('   🎯 Found potential customer tags:');
            customerTags.forEach(tag => {
                console.log(`      • "${tag}"`);
            });
        } else {
            console.log('   ⚠️  No customer-related tags found');
            console.log('   💡 Suggestion: Check if customers are identified by:');
            console.log('      - Different tag names (e.g., "Clientes", "Customer", etc.)');
            console.log('      - Contact type (TypeId)');
            console.log('      - Status or classification fields');
            console.log('      - Custom fields (OtherProperties)');
        }
        
        // Test current filter logic
        console.log(`\n🧪 Testing current filter logic with "Cliente" tag:`);
        let passesCurrentFilter = 0;
        result.value.forEach(contact => {
            const hasClienteTag = contact.Tags && Array.isArray(contact.Tags) && contact.Tags.some(tag => 
                tag && (
                    tag.Name === 'Cliente' || 
                    tag.Value === 'Cliente' ||
                    (typeof tag === 'string' && tag === 'Cliente')
                )
            );
            
            if (hasClienteTag) {
                passesCurrentFilter++;
                console.log(`   ✅ "${contact.Name}" passes current filter`);
            }
        });
        
        console.log(`   📊 Contacts passing current filter: ${passesCurrentFilter}/${result.value.length}`);
        
        if (passesCurrentFilter === 0) {
            console.log('\n⚠️  ROOT CAUSE IDENTIFIED:');
            console.log('   No contacts have the exact tag "Cliente"');
            console.log('   This explains why the sync is not finding any customers!');
            
            console.log('\n💡 RECOMMENDATIONS:');
            if (tagAnalysis.allTags.size === 0) {
                console.log('   1. Contacts don\'t use tags - consider using TypeId or other fields');
                console.log('   2. Remove tag filtering entirely if all contacts should be synced');
                console.log('   3. Use contact status or classification fields instead');
            } else {
                console.log('   1. Update the tag filter to match actual tag names found above');
                console.log('   2. Use case-insensitive matching for tag comparison');
                console.log('   3. Consider using multiple tag variations');
            }
        }
        
        console.log('\n' + '=' .repeat(80));
        
    } catch (error) {
        console.error('❌ Error during analysis:', error.message);
        if (error.response) {
            console.error('   Status:', error.response.status);
            console.error('   Response:', error.response.data);
        }
    }
}

// Run the investigation
investigatePloomesContactTags()
    .then(() => {
        console.log('\n🎯 Investigation complete!');
        process.exit(0);
    })
    .catch(error => {
        console.error('\n❌ Investigation failed:', error);
        process.exit(1);
    });