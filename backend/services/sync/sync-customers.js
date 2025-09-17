#!/usr/bin/env node

require('dotenv').config();
const DatabaseService = require('./database-service');
const PloomeService = require('./ploome-service');
const GeocodingService = require('../geocoding/geocoding-service');

async function syncCustomers() {
    console.log('\n🚀 Iniciando sincronização de clientes do Ploome...\n');
    
    let db;
    
    try {
        // Inicializar banco de dados
        db = new DatabaseService();
        await db.initialize();
        console.log('✅ Banco de dados inicializado');

        // Inicializar serviço Ploome
        const ploomeService = new PloomeService(process.env.PLOOME_API_KEY);
        
        // Testar conexão
        const connectionOk = await ploomeService.testConnection();
        if (!connectionOk) {
            throw new Error('Não foi possível conectar à API do Ploome. Verifique a chave API.');
        }

        // Buscar e cachear tags antes de processar contatos
        console.log('\n🏷️  Buscando definições de tags...');
        await ploomeService.fetchTags();
        console.log(`✅ ${ploomeService.tagCache.size} tags cacheadas`);

        // Buscar todos os clientes
        console.log('\n📥 Buscando clientes do Ploome...');
        const startTime = Date.now();
        
        const customers = await ploomeService.fetchAllContacts((progress) => {
            process.stdout.write(`\r  Progresso: ${progress.fetched} clientes baixados...`);
        });
        
        console.log(`\n✅ ${customers.length} clientes encontrados\n`);

        // Salvar no banco
        if (customers.length > 0) {
            console.log('💾 Salvando clientes no banco de dados...');
            const result = await db.upsertCustomersBatch(customers);
            console.log(`✅ ${result.successCount} clientes salvos com sucesso`);
            
            if (result.errorCount > 0) {
                console.log(`⚠️  ${result.errorCount} clientes com erro ao salvar`);
            }
        }

        // Estatísticas
        const duration = (Date.now() - startTime) / 1000;
        const stats = await db.getStatistics();
        
        console.log('\n📊 Estatísticas:');
        console.log(`  • Total de clientes: ${stats.totalCustomers}`);
        console.log(`  • Clientes geocodificados: ${stats.geocodedCustomers}`);
        console.log(`  • Pendentes de geocodificação: ${stats.pendingGeocoding}`);
        console.log(`  • Tempo de sincronização: ${duration.toFixed(2)}s`);

        // Iniciar geocodificação se houver pendentes
        if (stats.pendingGeocoding > 0) {
            console.log('\n🗺️  Iniciando geocodificação de endereços...');
            
            const geocodingService = new GeocodingService(db);
            const customersToGeocode = await db.getCustomersForGeocoding(50);
            
            const geoResult = await geocodingService.geocodeCustomersBatch(
                customersToGeocode,
                (progress) => {
                    process.stdout.write(`\r  Geocodificando: ${progress.current}/${progress.total} (${progress.percentage}%) - Sucesso: ${progress.successCount}, Falha: ${progress.failCount}`);
                }
            );
            
            console.log('\n✅ Geocodificação concluída');
            console.log(`  • Taxa de sucesso: ${geoResult.summary.successRate}%`);
        }

        console.log('\n✨ Sincronização concluída com sucesso!\n');

    } catch (error) {
        console.error('\n❌ Erro na sincronização:', error.message);
        process.exit(1);
    } finally {
        if (db) {
            await db.close();
        }
    }
}

// Executar se chamado diretamente
if (require.main === module) {
    syncCustomers();
}

module.exports = syncCustomers;