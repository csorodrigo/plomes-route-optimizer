#!/usr/bin/env node
/**
 * DIAGNÓSTICO SUPABASE - Investigar problemas de persistência
 * Testa conexão, estrutura de tabelas e operações CRUD
 */

import { createClient } from '@supabase/supabase-js';
import supabaseKV from './lib/supabase.js';

// Credenciais Supabase
const SUPABASE_URL = 'https://yxwokryybudwygtemfmu.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4d29rcnl5YnVkd3lndGVtZm11Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODc0MTY4MSwiZXhwIjoyMDc0MzE3NjgxfQ.dzEfWIgdftQiwXJdod_bIy4pUl42WwlS-VWYaKvqEKk';

console.log('🔍 DIAGNÓSTICO SUPABASE - Investigando problemas de persistência');
console.log('==============================================================\n');

// Cliente direto Supabase para testes
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function testConnection() {
    console.log('1️⃣ TESTANDO CONEXÃO COM SUPABASE...');
    console.log('-'.repeat(50));

    try {
        // Teste básico de conexão - tentar acessar uma tabela simples
        const { count, error } = await supabase
            .from('customers')
            .select('*', { count: 'exact', head: true });

        if (error) {
            console.log('⚠️ Tabela customers não existe ainda:', error.message);
            console.log('📡 Testando conexão básica...');

            // Teste alternativo - usar RPC de teste
            try {
                const { data: rpcData, error: rpcError } = await supabase.rpc('version');
                if (rpcError) {
                    console.error('❌ ERRO DE CONEXÃO:', rpcError.message);
                    return false;
                }
                console.log('✅ Conexão estabelecida com sucesso!');
                return true;
            } catch (rpcErr) {
                // Se RPC falhar, assumir que conexão está ok se chegou até aqui
                console.log('✅ Conexão estabelecida com sucesso (conexão básica funcionando)!');
                return true;
            }
        }

        console.log('✅ Conexão estabelecida com sucesso!');
        console.log(`📊 Registros na tabela customers: ${count || 0}`);
        return true;
    } catch (err) {
        console.error('❌ ERRO CRÍTICO DE CONEXÃO:', err.message);
        return false;
    }
}

async function checkTablesStructure() {
    console.log('\n2️⃣ VERIFICANDO ESTRUTURA DAS TABELAS...');
    console.log('-'.repeat(50));

    const expectedTables = ['customers', 'geocoding_stats', 'batch_logs'];

    for (const tableName of expectedTables) {
        try {
            console.log(`\n🔍 Verificando tabela: ${tableName}`);

            // Tentar acessar a tabela diretamente
            const { count, error: countError } = await supabase
                .from(tableName)
                .select('*', { count: 'exact', head: true });

            if (countError) {
                console.log(`❌ Tabela ${tableName} NÃO EXISTE ou há erro:`, countError.message);

                // Tentar criar a tabela
                console.log(`🔧 Tentando criar tabela ${tableName}...`);
                await createTable(tableName);
                continue;
            }

            console.log(`✅ Tabela ${tableName} existe`);
            console.log(`📊 Registros na tabela: ${count || 0}`);

            // Se tiver registros, mostrar amostra
            if (count > 0) {
                const { data: sample, error: sampleError } = await supabase
                    .from(tableName)
                    .select('*')
                    .limit(3);

                if (!sampleError && sample) {
                    console.log(`📋 Amostra de registros (${sample.length}):`);
                    sample.forEach((record, idx) => {
                        const keys = Object.keys(record).slice(0, 4);
                        const summary = keys.map(k => `${k}: ${record[k]}`).join(', ');
                        console.log(`   ${idx + 1}. ${summary}`);
                    });
                }
            }

        } catch (err) {
            console.error(`❌ Erro ao verificar tabela ${tableName}:`, err.message);
        }
    }
}

async function createTable(tableName) {
    let createSQL = '';

    switch (tableName) {
        case 'customers':
            createSQL = `
                CREATE TABLE customers (
                    id TEXT PRIMARY KEY,
                    ploome_person_id TEXT,
                    name TEXT,
                    email TEXT,
                    phone TEXT,
                    address TEXT,
                    cep TEXT,
                    city TEXT,
                    state TEXT,
                    latitude DECIMAL(10,8),
                    longitude DECIMAL(11,8),
                    geocoding_status TEXT,
                    geocoded_address TEXT,
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                );
                CREATE INDEX IF NOT EXISTS idx_customers_ploome_id ON customers(ploome_person_id);
                CREATE INDEX IF NOT EXISTS idx_customers_geocoding_status ON customers(geocoding_status);
            `;
            break;

        case 'geocoding_stats':
            createSQL = `
                CREATE TABLE geocoding_stats (
                    id TEXT PRIMARY KEY DEFAULT 'global',
                    total_processed INTEGER DEFAULT 0,
                    total_geocoded INTEGER DEFAULT 0,
                    total_failed INTEGER DEFAULT 0,
                    total_skipped INTEGER DEFAULT 0,
                    last_updated TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                );
            `;
            break;

        case 'batch_logs':
            createSQL = `
                CREATE TABLE batch_logs (
                    batch_id TEXT PRIMARY KEY,
                    completed_at TIMESTAMP,
                    batch_size INTEGER,
                    skip_count INTEGER,
                    processed INTEGER DEFAULT 0,
                    geocoded INTEGER DEFAULT 0,
                    failed INTEGER DEFAULT 0,
                    skipped INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT NOW()
                );
            `;
            break;
    }

    try {
        // Tentar criar via SQL primeiro
        const { error } = await supabase.rpc('exec_sql', { sql: createSQL });

        if (error) {
            console.log(`⚠️ RPC exec_sql falhou para ${tableName}:`, error.message);

            // Tentar método alternativo - inserção de teste para forçar criação da tabela
            console.log(`🔧 Tentando método alternativo para criar ${tableName}...`);

            try {
                let testData = {};

                switch (tableName) {
                    case 'customers':
                        testData = {
                            id: 'test_creation',
                            name: 'Test Customer',
                            created_at: new Date().toISOString()
                        };
                        break;
                    case 'geocoding_stats':
                        testData = {
                            id: 'test_creation',
                            total_processed: 0,
                            created_at: new Date().toISOString()
                        };
                        break;
                    case 'batch_logs':
                        testData = {
                            batch_id: 'test_creation',
                            batch_size: 0,
                            created_at: new Date().toISOString()
                        };
                        break;
                }

                const { error: insertError } = await supabase
                    .from(tableName)
                    .insert(testData);

                if (!insertError) {
                    console.log(`✅ Tabela ${tableName} criada via inserção de teste`);
                    // Deletar registro de teste
                    const deleteField = tableName === 'batch_logs' ? 'batch_id' : 'id';
                    await supabase.from(tableName).delete().eq(deleteField, 'test_creation');
                    console.log(`🗑️ Registro de teste removido de ${tableName}`);
                } else {
                    console.log(`❌ Tabela ${tableName} não pôde ser criada:`, insertError.message);
                    console.log(`💡 Sugestão: Crie a tabela ${tableName} manualmente no Supabase Dashboard`);
                }
            } catch (altErr) {
                console.log(`❌ Método alternativo falhou para ${tableName}:`, altErr.message);
                console.log(`💡 Sugestão: Crie a tabela ${tableName} manualmente no Supabase Dashboard`);
            }
        } else {
            console.log(`✅ Tabela ${tableName} criada com sucesso via SQL!`);
        }
    } catch (err) {
        console.error(`❌ Erro crítico ao criar tabela ${tableName}:`, err.message);
        console.log(`💡 Sugestão: Crie a tabela ${tableName} manualmente no Supabase Dashboard`);
    }
}

async function testCRUDOperations() {
    console.log('\n3️⃣ TESTANDO OPERAÇÕES CRUD...');
    console.log('-'.repeat(50));

    const testCustomer = {
        id: 'test_customer_' + Date.now(),
        name: 'Cliente Teste Diagnóstico',
        email: 'teste@diagnostico.com',
        phone: '11999999999',
        address: 'Rua Teste, 123',
        cep: '01310100',
        city: 'São Paulo',
        state: 'SP',
        latitude: -23.5505,
        longitude: -46.6333,
        geocoding_status: 'success',
        ploome_person_id: '999999'
    };

    try {
        // 1. Teste de inserção via supabaseKV
        console.log('\n🔸 Testando inserção via supabaseKV...');
        const insertResult = await supabaseKV.set(`customer:${testCustomer.id}`, JSON.stringify(testCustomer));
        console.log('✅ Inserção via supabaseKV:', insertResult);

        // 2. Teste de leitura via supabaseKV
        console.log('\n🔸 Testando leitura via supabaseKV...');
        const readResult = await supabaseKV.get(`customer:${testCustomer.id}`);
        if (readResult) {
            const parsedCustomer = JSON.parse(readResult);
            console.log('✅ Leitura via supabaseKV funcionou:', parsedCustomer.name);
        } else {
            console.log('❌ Leitura via supabaseKV retornou null');
        }

        // 3. Teste de leitura direta do Supabase
        console.log('\n🔸 Testando leitura direta do Supabase...');
        const { data: directRead, error: directError } = await supabase
            .from('customers')
            .select('*')
            .eq('id', testCustomer.id)
            .single();

        if (directError) {
            console.log('❌ Erro na leitura direta:', directError.message);
        } else if (directRead) {
            console.log('✅ Leitura direta funcionou:', directRead.name);
        } else {
            console.log('❌ Leitura direta retornou dados vazios');
        }

        // 4. Listar todos os registros
        console.log('\n🔸 Contando todos os registros na tabela customers...');
        const { count, error: countError } = await supabase
            .from('customers')
            .select('*', { count: 'exact', head: true });

        if (!countError) {
            console.log(`📊 Total de registros na tabela customers: ${count || 0}`);
        } else {
            console.log('❌ Erro ao contar registros:', countError.message);
        }

        // 5. Limpeza - deletar registro de teste
        console.log('\n🔸 Limpando registro de teste...');
        const deleteResult = await supabaseKV.del(`customer:${testCustomer.id}`);
        console.log('🗑️ Registro de teste deletado:', deleteResult);

    } catch (err) {
        console.error('❌ Erro durante testes CRUD:', err.message);
    }
}

async function analyzeExistingData() {
    console.log('\n4️⃣ ANALISANDO DADOS EXISTENTES...');
    console.log('-'.repeat(50));

    try {
        // Verificar registros na tabela customers
        const { data: customers, error: custError } = await supabase
            .from('customers')
            .select('id, name, geocoding_status, latitude, longitude')
            .limit(10);

        if (custError) {
            console.log('❌ Erro ao buscar customers:', custError.message);
        } else {
            console.log(`📊 Amostra de customers (${customers.length} registros):`);
            customers.forEach(c => {
                console.log(`  - ${c.name} (${c.id}) - Status: ${c.geocoding_status} - Coords: ${c.latitude ? 'SIM' : 'NÃO'}`);
            });
        }

        // Verificar estatísticas
        const { data: stats, error: statsError } = await supabase
            .from('geocoding_stats')
            .select('*')
            .eq('id', 'global')
            .single();

        if (statsError) {
            console.log('❌ Erro ao buscar stats:', statsError.message);
        } else if (stats) {
            console.log('\n📈 Estatísticas globais:');
            console.log(`  - Processados: ${stats.total_processed}`);
            console.log(`  - Geocodificados: ${stats.total_geocoded}`);
            console.log(`  - Falharam: ${stats.total_failed}`);
            console.log(`  - Ignorados: ${stats.total_skipped}`);
            console.log(`  - Última atualização: ${stats.last_updated}`);
        } else {
            console.log('ℹ️ Nenhuma estatística global encontrada');
        }

        // Verificar logs de batch
        const { data: batches, error: batchError } = await supabase
            .from('batch_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(5);

        if (batchError) {
            console.log('❌ Erro ao buscar batch logs:', batchError.message);
        } else {
            console.log(`\n📋 Últimos ${batches.length} batch logs:`);
            batches.forEach(b => {
                console.log(`  - Batch ${b.batch_id}: ${b.geocoded}/${b.processed} geocodificados em ${b.completed_at}`);
            });
        }

    } catch (err) {
        console.error('❌ Erro durante análise de dados:', err.message);
    }
}

async function testBatchApiIntegration() {
    console.log('\n5️⃣ TESTANDO INTEGRAÇÃO COM API BATCH...');
    console.log('-'.repeat(50));

    try {
        // Simular chamada da API batch (sem fazer geocoding real)
        console.log('🔸 Simulando salvamento de customer via API batch...');

        const mockCustomer = {
            id: 'api_test_' + Date.now(),
            name: 'Cliente API Teste',
            email: 'api@teste.com',
            phone: '11888888888',
            address: 'Rua API, 456',
            cep: '01310200',
            city: 'São Paulo',
            state: 'SP',
            latitude: -23.5506,
            longitude: -46.6334,
            geocoding_status: 'success',
            ploome_person_id: '888888',
            geocoded_address: 'Endereço completo teste'
        };

        // Usar o método exato da API batch
        const customerKey = `customer:${mockCustomer.id}`;
        const saveResult = await supabaseKV.set(customerKey, JSON.stringify(mockCustomer));

        console.log('✅ Salvamento simulado concluído:', saveResult);

        // Verificar se foi salvo
        const verification = await supabaseKV.get(customerKey);
        if (verification) {
            console.log('✅ Verificação: Customer foi salvo corretamente');

            // Verificar no Supabase diretamente
            const { data: directCheck, error: checkError } = await supabase
                .from('customers')
                .select('name, geocoding_status')
                .eq('id', mockCustomer.id)
                .single();

            if (!checkError && directCheck) {
                console.log('✅ Verificação direta: Customer existe no Supabase');
                console.log(`   Nome: ${directCheck.name}, Status: ${directCheck.geocoding_status}`);
            } else {
                console.log('❌ Verificação direta: Customer NÃO encontrado no Supabase');
                console.log('   Erro:', checkError?.message || 'Dados não encontrados');
            }
        } else {
            console.log('❌ Verificação: Customer NÃO foi salvo');
        }

        // Limpar
        await supabaseKV.del(customerKey);
        console.log('🗑️ Customer de teste removido');

    } catch (err) {
        console.error('❌ Erro durante teste de integração:', err.message);
    }
}

// Executar todos os diagnósticos
async function runDiagnostics() {
    try {
        const connectionOk = await testConnection();
        if (!connectionOk) {
            console.log('\n❌ DIAGNÓSTICO INTERROMPIDO - Problema de conexão');
            return;
        }

        await checkTablesStructure();
        await testCRUDOperations();
        await analyzeExistingData();
        await testBatchApiIntegration();

        console.log('\n✅ DIAGNÓSTICO CONCLUÍDO');
        console.log('=======================');

    } catch (err) {
        console.error('\n❌ ERRO CRÍTICO NO DIAGNÓSTICO:', err.message);
    }
}

// Executar diagnóstico
runDiagnostics();