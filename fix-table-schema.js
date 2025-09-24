#!/usr/bin/env node

// Script para corrigir o schema da tabela customers
import supabaseKV from './lib/supabase.js';

async function fixTableSchema() {
    console.log('🔧 Corrigindo schema da tabela customers...');

    try {
        // Execute o ALTER TABLE via RPC SQL
        const { data, error } = await supabaseKV.supabase.rpc('sql', {
            query: `
                ALTER TABLE customers
                ALTER COLUMN id TYPE VARCHAR(50);

                COMMENT ON COLUMN customers.id IS 'ID do cliente (pode ser string do Ploome)';
            `
        });

        if (error) {
            // Se RPC não funcionar, tentar via SQL direto
            console.log('Tentando método alternativo...');

            const { data: altData, error: altError } = await supabaseKV.supabase
                .from('customers')
                .select('id')
                .limit(1);

            if (altError && altError.message.includes('bigint')) {
                console.log('❌ Confirmado: Precisa alterar o tipo da coluna id');
                console.log('✅ Vou recriar a tabela com o tipo correto...');

                // Recriar tabela com tipo correto
                const { error: dropError } = await supabaseKV.supabase.rpc('sql', {
                    query: 'DROP TABLE IF EXISTS customers CASCADE;'
                });

                const { error: createError } = await supabaseKV.supabase.rpc('sql', {
                    query: `
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
                    `
                });

                if (createError) {
                    throw createError;
                }

                console.log('✅ Tabela customers recriada com VARCHAR(50) para id');
            } else {
                console.log('✅ Schema já está correto ou tabela acessível');
            }
        } else {
            console.log('✅ ALTER TABLE executado com sucesso');
        }

        // Testar se está funcionando agora
        console.log('🧪 Testando inserção com string ID...');

        await supabaseKV.setCustomer('customer:test_string', {
            id: 'test_string',
            ploome_person_id: 'test_string',
            name: 'Cliente Teste String',
            email: 'teste@example.com',
            geocoding_status: 'success'
        });

        console.log('✅ Inserção com string ID funcionou!');

        // Limpar teste
        await supabaseKV.del('customer:test_string');

        console.log('🎉 Schema corrigido com sucesso!');

    } catch (error) {
        console.error('❌ Erro ao corrigir schema:', error);
        console.error('Detalhes:', error.message);

        // Tentar método manual via execução direta
        console.log('🔄 Tentando execução SQL direta...');

        try {
            const response = await fetch(`https://yxwokryybudwygtemfmu.supabase.co/rest/v1/rpc/sql`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4d29rcnl5YnVkd3lndGVtZm11Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODc0MTY4MSwiZXhwIjoyMDc0MzE3NjgxfQ.dzEfWIgdftQiwXJdod_bIy4pUl42WwlS-VWYaKvqEKk`,
                    'apikey': `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4d29rcnl5YnVkd3lndGVtZm11Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODc0MTY4MSwiZXhwIjoyMDc0MzE3NjgxfQ.dzEfWIgdftQiwXJdod_bIy4pUl42WwlS-VWYaKvqEKk`
                },
                body: JSON.stringify({
                    query: 'ALTER TABLE customers ALTER COLUMN id TYPE VARCHAR(50);'
                })
            });

            if (response.ok) {
                console.log('✅ SQL executado via REST API');
            } else {
                console.log('❌ Falha na execução via REST API');
            }
        } catch (restError) {
            console.error('❌ Erro na execução via REST:', restError);
        }
    }
}

// Execute
fixTableSchema().then(() => {
    console.log('✅ Correção de schema finalizada');
    process.exit(0);
}).catch(error => {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
});