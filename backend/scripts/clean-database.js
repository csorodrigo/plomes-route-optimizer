const DatabaseService = require('../services/sync/database-service');
require('dotenv').config();

async function cleanDatabase() {
    console.log('🧹 Cleaning database of non-customer contacts...\n');
    
    const dbService = new DatabaseService();
    await dbService.init();
    
    try {
        // Verificar total de contatos antes da limpeza
        const totalBefore = await dbService.db.get(
            'SELECT COUNT(*) as count FROM customers'
        );
        console.log(`📊 Total contacts before cleaning: ${totalBefore.count}`);
        
        // Contar contatos sem tag "Cliente"
        const nonCustomers = await dbService.db.get(
            `SELECT COUNT(*) as count FROM customers 
             WHERE tags IS NULL 
             OR tags = '' 
             OR tags NOT LIKE '%"Cliente"%'`
        );
        console.log(`🚫 Non-customer contacts found: ${nonCustomers.count}`);
        
        if (nonCustomers.count > 0) {
            // Listar alguns exemplos antes de deletar
            const examples = await dbService.db.all(
                `SELECT id, name, tags FROM customers 
                 WHERE tags IS NULL 
                 OR tags = '' 
                 OR tags NOT LIKE '%"Cliente"%'
                 LIMIT 10`
            );
            
            console.log('\n📋 Examples of contacts to be removed:');
            examples.forEach(contact => {
                const tags = contact.tags ? JSON.parse(contact.tags) : [];
                console.log(`   • ${contact.name} - Tags: [${tags.join(', ')}]`);
            });
            
            // Deletar contatos não-clientes
            console.log('\n🗑️  Removing non-customer contacts...');
            const result = await dbService.db.run(
                `DELETE FROM customers 
                 WHERE tags IS NULL 
                 OR tags = '' 
                 OR tags NOT LIKE '%"Cliente"%'`
            );
            
            console.log(`✅ Removed ${result.changes} non-customer contacts`);
            
            // Verificar total após limpeza
            const totalAfter = await dbService.db.get(
                'SELECT COUNT(*) as count FROM customers'
            );
            console.log(`\n📊 Total contacts after cleaning: ${totalAfter.count}`);
            
            // Listar estatísticas de tags dos contatos restantes
            const remainingWithTags = await dbService.db.all(
                `SELECT tags FROM customers WHERE tags IS NOT NULL AND tags != ''`
            );
            
            const tagStats = {};
            remainingWithTags.forEach(row => {
                try {
                    const tags = JSON.parse(row.tags);
                    tags.forEach(tag => {
                        tagStats[tag] = (tagStats[tag] || 0) + 1;
                    });
                } catch (e) {
                    // Ignore parsing errors
                }
            });
            
            console.log('\n🏷️  Tag statistics for remaining contacts:');
            Object.entries(tagStats).forEach(([tag, count]) => {
                console.log(`   • ${tag}: ${count} contacts`);
            });
            
        } else {
            console.log('\n✅ Database is already clean - all contacts have "Cliente" tag');
        }
        
        // Otimizar banco de dados
        console.log('\n🔧 Optimizing database...');
        await dbService.db.run('VACUUM');
        console.log('✅ Database optimized');
        
    } catch (error) {
        console.error('❌ Error cleaning database:', error.message);
        process.exit(1);
    } finally {
        await dbService.close();
    }
}

// Run the cleanup
cleanDatabase()
    .then(() => {
        console.log('\n🎉 Database cleanup completed successfully!');
        process.exit(0);
    })
    .catch(error => {
        console.error('\n❌ Database cleanup failed:', error);
        process.exit(1);
    });