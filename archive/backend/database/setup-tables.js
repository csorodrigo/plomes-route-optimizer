const { supabaseAdmin } = require('./supabase');

/**
 * SQL para criar as tabelas necessárias
 */
const CREATE_CUSTOMERS_TABLE = `
    CREATE TABLE IF NOT EXISTS customers (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        ploome_id INTEGER UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255),
        cep VARCHAR(10),
        address TEXT,
        city VARCHAR(100),
        state VARCHAR(2),
        latitude DECIMAL(10,8),
        longitude DECIMAL(11,8),
        geocoded_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
`;

const CREATE_GEOCODING_STATS_TABLE = `
    CREATE TABLE IF NOT EXISTS geocoding_stats (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        total_processed INTEGER DEFAULT 0,
        total_geocoded INTEGER DEFAULT 0,
        success_rate DECIMAL(5,2),
        last_sync_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
`;

// Índices para performance
const CREATE_INDEXES = [
    `CREATE INDEX IF NOT EXISTS idx_customers_ploome_id ON customers(ploome_id);`,
    `CREATE INDEX IF NOT EXISTS idx_customers_cep ON customers(cep);`,
    `CREATE INDEX IF NOT EXISTS idx_customers_city_state ON customers(city, state);`,
    `CREATE INDEX IF NOT EXISTS idx_customers_geocoded ON customers(latitude, longitude);`,
    `CREATE INDEX IF NOT EXISTS idx_customers_updated_at ON customers(updated_at);`
];

// Trigger para atualizar updated_at automaticamente
const UPDATE_TRIGGER = `
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS update_customers_updated_at ON customers;
    CREATE TRIGGER update_customers_updated_at
        BEFORE UPDATE ON customers
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();

    DROP TRIGGER IF EXISTS update_geocoding_stats_updated_at ON geocoding_stats;
    CREATE TRIGGER update_geocoding_stats_updated_at
        BEFORE UPDATE ON geocoding_stats
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
`;

// Row Level Security (RLS) policies
const RLS_POLICIES = `
    -- Habilitar RLS
    ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
    ALTER TABLE geocoding_stats ENABLE ROW LEVEL SECURITY;

    -- Política para permitir todas as operações (ajustar conforme necessário)
    DROP POLICY IF EXISTS "Enable all operations for service role" ON customers;
    CREATE POLICY "Enable all operations for service role"
        ON customers FOR ALL
        USING (true)
        WITH CHECK (true);

    DROP POLICY IF EXISTS "Enable all operations for service role" ON geocoding_stats;
    CREATE POLICY "Enable all operations for service role"
        ON geocoding_stats FOR ALL
        USING (true)
        WITH CHECK (true);
`;

/**
 * Configura todas as tabelas e estruturas necessárias
 */
async function setupTables() {
    console.log('🔧 Configurando tabelas Supabase...');

    try {
        // Criar tabela customers
        console.log('📊 Criando tabela customers...');
        const { error: customersError } = await supabaseAdmin.rpc('exec_sql', {
            sql: CREATE_CUSTOMERS_TABLE
        });

        if (customersError) {
            console.error('❌ Erro ao criar tabela customers:', customersError);
            throw customersError;
        }

        // Criar tabela geocoding_stats
        console.log('📈 Criando tabela geocoding_stats...');
        const { error: statsError } = await supabaseAdmin.rpc('exec_sql', {
            sql: CREATE_GEOCODING_STATS_TABLE
        });

        if (statsError) {
            console.error('❌ Erro ao criar tabela geocoding_stats:', statsError);
            throw statsError;
        }

        // Criar índices
        console.log('⚡ Criando índices para performance...');
        for (const indexSQL of CREATE_INDEXES) {
            const { error: indexError } = await supabaseAdmin.rpc('exec_sql', {
                sql: indexSQL
            });

            if (indexError && !indexError.message.includes('already exists')) {
                console.warn('⚠️ Aviso ao criar índice:', indexError);
            }
        }

        // Criar triggers
        console.log('🔄 Configurando triggers...');
        const { error: triggerError } = await supabaseAdmin.rpc('exec_sql', {
            sql: UPDATE_TRIGGER
        });

        if (triggerError) {
            console.warn('⚠️ Aviso ao criar triggers:', triggerError);
        }

        // Configurar RLS
        console.log('🔒 Configurando Row Level Security...');
        const { error: rlsError } = await supabaseAdmin.rpc('exec_sql', {
            sql: RLS_POLICIES
        });

        if (rlsError) {
            console.warn('⚠️ Aviso ao configurar RLS:', rlsError);
        }

        // Inserir estatística inicial se não existir
        console.log('📊 Configurando estatísticas iniciais...');
        const { data: existingStats } = await supabaseAdmin
            .from('geocoding_stats')
            .select('id')
            .limit(1);

        if (!existingStats || existingStats.length === 0) {
            const { error: insertError } = await supabaseAdmin
                .from('geocoding_stats')
                .insert({
                    total_processed: 0,
                    total_geocoded: 0,
                    success_rate: 0.00
                });

            if (insertError) {
                console.warn('⚠️ Aviso ao inserir estatísticas iniciais:', insertError);
            }
        }

        console.log('✅ Configuração das tabelas concluída com sucesso!');
        return true;

    } catch (error) {
        console.error('❌ Erro na configuração das tabelas:', error);
        throw error;
    }
}

/**
 * Verifica se as tabelas existem
 */
async function checkTables() {
    try {
        const { data: customers, error: customersError } = await supabaseAdmin
            .from('customers')
            .select('count', { count: 'exact', head: true });

        const { data: stats, error: statsError } = await supabaseAdmin
            .from('geocoding_stats')
            .select('count', { count: 'exact', head: true });

        return {
            customers: !customersError,
            geocoding_stats: !statsError,
            customers_count: customers?.length || 0,
            stats_count: stats?.length || 0
        };
    } catch (error) {
        console.error('Erro ao verificar tabelas:', error);
        return {
            customers: false,
            geocoding_stats: false,
            error: error.message
        };
    }
}

// Executar se chamado diretamente
if (require.main === module) {
    setupTables()
        .then(() => {
            console.log('🎉 Setup concluído!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('💥 Falha no setup:', error);
            process.exit(1);
        });
}

module.exports = {
    setupTables,
    checkTables
};