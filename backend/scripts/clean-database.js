const DatabaseService = require('../services/sync/database-service');
const { normalizeTags } = require('../services/sync/database-service');
require('dotenv').config();

async function cleanDatabase() {
    console.log('🧹 Cleaning database of non-customer contacts...\n');

    const dbService = new DatabaseService();
    await dbService.ensureInitialized();

    try {
        const statsBefore = await dbService.getStatistics();
        console.log(`📊 Total contacts before cleaning: ${statsBefore.totalCustomers}`);

        const { data: customers, error } = await dbService.client
            .from('customers')
            .select('id, name, tags')
            .limit(10000);

        if (error) {
            throw error;
        }

        const nonCustomers = (customers || []).filter((customer) => {
            const tags = normalizeTags(customer.tags);
            return !tags.includes('Cliente');
        });

        console.log(`🚫 Non-customer contacts found: ${nonCustomers.length}`);

        if (nonCustomers.length === 0) {
            console.log('\n✅ Database is already clean - all contacts have "Cliente" tag');
        } else {
            console.log('\n📋 Examples of contacts to be removed:');
            nonCustomers.slice(0, 10).forEach((contact) => {
                const tags = normalizeTags(contact.tags);
                console.log(`   • ${contact.name} - Tags: [${tags.join(', ')}]`);
            });

            console.log('\n🗑️  Removing non-customer contacts...');
            const idsToDelete = nonCustomers.map((customer) => customer.id);
            const deleteResult = await dbService.client
                .from('customers')
                .delete()
                .in('id', idsToDelete);

            if (deleteResult.error) {
                throw deleteResult.error;
            }

            console.log(`✅ Removed ${idsToDelete.length} non-customer contacts`);
        }

        const statsAfter = await dbService.getStatistics();
        console.log(`\n📊 Total contacts after cleaning: ${statsAfter.totalCustomers}`);

        console.log('\n🏷️  Tag statistics for remaining contacts:');
        const tagCounts = {};
        (customers || []).forEach((customer) => {
            const tags = normalizeTags(customer.tags);
            if (tags.includes('Cliente')) {
                tags.forEach((tag) => {
                    tagCounts[tag] = (tagCounts[tag] || 0) + 1;
                });
            }
        });
        Object.entries(tagCounts).forEach(([tag, count]) => {
            console.log(`   • ${tag}: ${count} contacts`);
        });

    } catch (error) {
        console.error('❌ Error cleaning database:', error.message);
        process.exit(1);
    } finally {
        await dbService.close();
    }
}

cleanDatabase()
    .then(() => {
        console.log('\n🎉 Database cleanup completed successfully!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Database cleanup failed:', error);
        process.exit(1);
    });
