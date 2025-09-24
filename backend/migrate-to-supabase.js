#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const customerService = require('./database/customer-service');
const { testConnection } = require('./database/supabase');

/**
 * Script para migrar dados existentes para Supabase
 *
 * Este script:
 * 1. Carrega dados do cache local/SQLite
 * 2. Migra para Supabase preservando geocodificação
 * 3. Mantém histórico de migração
 */

async function migrateToSupabase() {
    console.log('🚀 MIGRAÇÃO PARA SUPABASE');
    console.log('=========================\n');

    try {
        // 1. Testar conexão Supabase
        console.log('📡 1. Testando conexão Supabase...');
        const connected = await testConnection();

        if (!connected) {
            console.error('❌ Conexão Supabase falhou. Configure as credenciais corretas no .env');
            console.error('💡 Execute: node backend/setup-supabase-config.js');
            return false;
        }

        // 2. Buscar dados existentes
        console.log('📊 2. Buscando dados para migração...');

        let customersToMigrate = [];

        // Tentar carregar do cache em diferentes formatos
        const cacheFiles = [
            './backend/cache/customers.json',
            './backend/cache/geocoded-customers.json',
            './backend/cache/ploome-customers.json',
            './backend/database.sqlite'
        ];

        for (const cacheFile of cacheFiles) {
            const fullPath = path.resolve(cacheFile);

            if (fs.existsSync(fullPath)) {
                console.log(`   📁 Encontrado: ${cacheFile}`);

                if (cacheFile.endsWith('.json')) {
                    try {
                        const data = JSON.parse(fs.readFileSync(fullPath, 'utf8'));

                        if (Array.isArray(data)) {
                            customersToMigrate = customersToMigrate.concat(data);
                        } else if (data.customers) {
                            customersToMigrate = customersToMigrate.concat(data.customers);
                        } else if (data.data) {
                            customersToMigrate = customersToMigrate.concat(data.data);
                        }
                    } catch (error) {
                        console.warn(`   ⚠️ Erro ao ler ${cacheFile}:`, error.message);
                    }
                } else if (cacheFile.endsWith('.sqlite')) {
                    console.log(`   💾 SQLite encontrado, mas requer implementação específica`);
                    // TODO: Implementar leitura do SQLite se necessário
                }
            }
        }

        // Remover duplicatas por ploome_id
        const uniqueCustomers = [];
        const seenIds = new Set();

        for (const customer of customersToMigrate) {
            const ploomeId = customer.ploome_id || customer.id || customer.Id;
            if (ploomeId && !seenIds.has(ploomeId)) {
                seenIds.add(ploomeId);
                uniqueCustomers.push(customer);
            }
        }

        console.log(`   📈 Total encontrado: ${customersToMigrate.length}`);
        console.log(`   🎯 Únicos para migrar: ${uniqueCustomers.length}`);

        if (uniqueCustomers.length === 0) {
            console.log('   ℹ️  Nenhum dado encontrado para migração');
            console.log('   💡 Dados podem estar em formato diferente ou em outro local');

            // Mostrar exemplo de como carregar dados manualmente
            console.log('\n📝 EXEMPLO - Carregamento manual:');
            console.log(`
const customersData = [
    {
        ploome_id: 123456,
        name: "Cliente Exemplo",
        email: "cliente@exemplo.com",
        cep: "01310-100",
        address: "Av. Paulista, 1000",
        city: "São Paulo",
        state: "SP",
        latitude: -23.5613,
        longitude: -46.6565
    }
    // ... mais clientes
];

// Salvar no arquivo para migração
fs.writeFileSync('./backend/cache/customers-para-migrar.json', JSON.stringify(customersData, null, 2));
            `);

            return false;
        }

        // 3. Analisar dados para migração
        console.log('\n📊 3. Analisando dados...');

        let geocodedCount = 0;
        let notGeocodedCount = 0;

        for (const customer of uniqueCustomers) {
            const hasCoordinates = (customer.latitude || customer.lat) &&
                                   (customer.longitude || customer.lng);

            if (hasCoordinates) {
                geocodedCount++;
            } else {
                notGeocodedCount++;
            }
        }

        console.log(`   🎯 Com coordenadas: ${geocodedCount}`);
        console.log(`   📍 Sem coordenadas: ${notGeocodedCount}`);
        console.log(`   📊 Taxa de geocodificação: ${((geocodedCount / uniqueCustomers.length) * 100).toFixed(1)}%`);

        // 4. Confirmar migração
        console.log('\n❓ 4. Prosseguir com migração?');
        console.log(`   - ${uniqueCustomers.length} clientes serão migrados`);
        console.log(`   - ${geocodedCount} já possuem coordenadas`);
        console.log('');
        console.log('   💾 Esta migração preservará todos os dados de geocodificação');

        // Para automação, vamos prosseguir automaticamente
        // Em produção, poderia pedir confirmação do usuário

        // 5. Executar migração
        console.log('\n🚀 5. Iniciando migração...');

        const results = await customerService.bulkUpsertCustomers(uniqueCustomers);

        console.log('\n📊 RESULTADOS DA MIGRAÇÃO:');
        console.log('===========================');
        console.log(`✅ Criados: ${results.created}`);
        console.log(`🔄 Atualizados: ${results.updated}`);
        console.log(`❌ Erros: ${results.errors.length}`);

        if (results.errors.length > 0) {
            console.log('\n❌ Erros detalhados:');
            results.errors.slice(0, 5).forEach((error, index) => {
                console.log(`   ${index + 1}. Cliente ${error.customer}: ${error.error}`);
            });

            if (results.errors.length > 5) {
                console.log(`   ... e mais ${results.errors.length - 5} erros`);
            }
        }

        // 6. Verificar estatísticas finais
        console.log('\n📈 6. Estatísticas finais...');
        const finalStats = await customerService.getCustomerStats();

        console.log('\n🎉 MIGRAÇÃO CONCLUÍDA!');
        console.log('======================');
        console.log(`📊 Total no Supabase: ${finalStats.total}`);
        console.log(`🎯 Geocodificados: ${finalStats.geocoded} (${finalStats.percentage}%)`);
        console.log(`📍 Não geocodificados: ${finalStats.notGeocoded}`);

        // 7. Criar backup dos dados migrados
        const backupData = {
            migrated_at: new Date().toISOString(),
            total_migrated: uniqueCustomers.length,
            results: results,
            final_stats: finalStats
        };

        fs.writeFileSync(
            './backend/cache/migration-backup.json',
            JSON.stringify(backupData, null, 2)
        );

        console.log('\n💾 Backup da migração salvo em: ./backend/cache/migration-backup.json');
        console.log('✅ Sistema pronto para uso com Supabase!');

        return true;

    } catch (error) {
        console.error('\n💥 ERRO NA MIGRAÇÃO:', error);

        // Salvar log de erro
        const errorLog = {
            error_at: new Date().toISOString(),
            error: error.message,
            stack: error.stack
        };

        fs.writeFileSync(
            './backend/cache/migration-error.json',
            JSON.stringify(errorLog, null, 2)
        );

        console.error('📋 Log de erro salvo em: ./backend/cache/migration-error.json');
        return false;
    }
}

// Executar se chamado diretamente
if (require.main === module) {
    migrateToSupabase()
        .then((success) => {
            process.exit(success ? 0 : 1);
        })
        .catch((error) => {
            console.error('💥 Falha crítica:', error);
            process.exit(1);
        });
}

module.exports = { migrateToSupabase };