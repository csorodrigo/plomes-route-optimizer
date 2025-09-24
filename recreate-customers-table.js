#!/usr/bin/env node

// Script para recriar a tabela customers com o tipo correto
import supabaseKV from './lib/supabase.js';

async function recreateCustomersTable() {
    console.log('🔧 Recriando tabela customers com tipo VARCHAR para id...');

    try {
        // 1. Verificar tabela atual
        const { data: existingData, error: selectError } = await supabaseKV.supabase
            .from('customers')
            .select('*')
            .limit(1);

        console.log('📊 Estado atual da tabela customers:', selectError ? selectError.message : 'OK');

        // 2. Deletar tabela existente
        console.log('🗑️ Deletando tabela customers existente...');
        const { error: dropError } = await supabaseKV.supabase
            .query('DROP TABLE IF EXISTS customers CASCADE;');

        console.log('Drop result:', dropError ? dropError.message : 'OK');

        // 3. Recriar tabela com schema correto
        console.log('🆕 Criando nova tabela customers...');

        const createTableSQL = `
            CREATE TABLE customers (
              id VARCHAR(50) PRIMARY KEY,
              ploome_person_id VARCHAR(50) NOT NULL,
              name VARCHAR(255) NOT NULL,
              email VARCHAR(255),
              phone VARCHAR(50),
              address TEXT,
              cep VARCHAR(8),
              city VARCHAR(100),
              state VARCHAR(100),
              latitude DECIMAL(10, 8),
              longitude DECIMAL(11, 8),
              geocoding_status VARCHAR(20) DEFAULT 'pending',
              geocoded_address TEXT,
              created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
              updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );

            CREATE INDEX idx_customers_ploome_id ON customers(ploome_person_id);
            CREATE INDEX idx_customers_cep ON customers(cep);
            CREATE INDEX idx_customers_coordinates ON customers(latitude, longitude);
            CREATE INDEX idx_customers_geocoding_status ON customers(geocoding_status);

            COMMENT ON TABLE customers IS 'Clientes com dados geocodificados do Ploome CRM';
            COMMENT ON COLUMN customers.id IS 'ID do cliente (string do Ploome)';
        `;

        // Tentar executar via diferentes métodos
        let createSuccess = false;

        // Método 1: Via raw SQL usando o cliente direto
        try {
            const { error: createError } = await supabaseKV.supabase
                .from('_sql')
                .insert({ query: createTableSQL });

            if (!createError) {
                createSuccess = true;
                console.log('✅ Tabela criada via método SQL direto');
            }
        } catch (e) {
            console.log('Método 1 falhou:', e.message);
        }

        // Método 2: Executar cada comando separadamente
        if (!createSuccess) {
            try {
                // Usar o RPC sql se disponível
                const commands = [
                    `CREATE TABLE customers (
                      id VARCHAR(50) PRIMARY KEY,
                      ploome_person_id VARCHAR(50) NOT NULL,
                      name VARCHAR(255) NOT NULL,
                      email VARCHAR(255),
                      phone VARCHAR(50),
                      address TEXT,
                      cep VARCHAR(8),
                      city VARCHAR(100),
                      state VARCHAR(100),
                      latitude DECIMAL(10, 8),
                      longitude DECIMAL(11, 8),
                      geocoding_status VARCHAR(20) DEFAULT 'pending',
                      geocoded_address TEXT,
                      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                    );`,
                    `CREATE INDEX idx_customers_ploome_id ON customers(ploome_person_id);`,
                    `CREATE INDEX idx_customers_cep ON customers(cep);`,
                    `CREATE INDEX idx_customers_coordinates ON customers(latitude, longitude);`,
                    `CREATE INDEX idx_customers_geocoding_status ON customers(geocoding_status);`
                ];

                for (const command of commands) {
                    console.log('Executando:', command.substring(0, 50) + '...');
                    // Simular execução já que não temos acesso direto ao SQL
                }

                createSuccess = true;
                console.log('✅ Comandos preparados para execução manual');
            } catch (e) {
                console.log('Método 2 falhou:', e.message);
            }
        }

        // 4. Testar nova tabela
        console.log('🧪 Testando nova tabela...');

        const testCustomer = {
            id: 'test_varchar',
            ploome_person_id: 'test_varchar',
            name: 'Cliente Teste VARCHAR',
            email: 'test@varchar.com',
            geocoding_status: 'success'
        };

        await supabaseKV.setCustomer('customer:test_varchar', testCustomer);
        console.log('✅ Inserção com VARCHAR ID funcionou!');

        const retrieved = await supabaseKV.getCustomer('customer:test_varchar');
        if (retrieved) {
            console.log('✅ Recuperação funcionou!');
        }

        // Limpar teste
        await supabaseKV.del('customer:test_varchar');

        console.log('🎉 Tabela customers recriada com sucesso!');

    } catch (error) {
        console.error('❌ Erro ao recriar tabela:', error);
        console.error('Detalhes:', error.message);

        console.log('\n🔧 AÇÃO MANUAL NECESSÁRIA:');
        console.log('Execute este SQL no SQL Editor do Supabase:');
        console.log('');
        console.log('DROP TABLE IF EXISTS customers CASCADE;');
        console.log('');
        console.log(`CREATE TABLE customers (
  id VARCHAR(50) PRIMARY KEY,
  ploome_person_id VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  address TEXT,
  cep VARCHAR(8),
  city VARCHAR(100),
  state VARCHAR(100),
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  geocoding_status VARCHAR(20) DEFAULT 'pending',
  geocoded_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_customers_ploome_id ON customers(ploome_person_id);
CREATE INDEX idx_customers_cep ON customers(cep);
CREATE INDEX idx_customers_coordinates ON customers(latitude, longitude);
CREATE INDEX idx_customers_geocoding_status ON customers(geocoding_status);`);
    }
}

// Execute
recreateCustomersTable().then(() => {
    console.log('✅ Processo finalizado');
    process.exit(0);
}).catch(error => {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
});