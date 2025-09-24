const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Validação das variáveis de ambiente
if (!process.env.SUPABASE_URL) {
    throw new Error('SUPABASE_URL is required');
}

if (!process.env.SUPABASE_ANON_KEY) {
    throw new Error('SUPABASE_ANON_KEY is required');
}

// Configuração do cliente Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

// Cliente principal (para uso geral)
const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        persistSession: false, // Desabilitado para uso server-side
        autoRefreshToken: false
    }
});

// Cliente com Service Role (para operações administrativas)
const supabaseAdmin = process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: {
            persistSession: false,
            autoRefreshToken: false
        }
    })
    : supabase;

/**
 * Testa a conexão com o Supabase
 * @returns {Promise<boolean>} - true se conectado com sucesso
 */
async function testConnection() {
    try {
        const { data, error } = await supabase.from('customers').select('id').limit(1);

        if (error && error.code === 'PGRST116') {
            // Tabela não existe ainda - isso é esperado na primeira execução
            console.log('✅ Conexão Supabase OK (tabelas ainda não criadas)');
            return true;
        }

        if (error) {
            console.error('❌ Erro na conexão Supabase:', error);
            return false;
        }

        console.log('✅ Conexão Supabase OK');
        return true;
    } catch (err) {
        console.error('❌ Erro crítico na conexão Supabase:', err);
        return false;
    }
}

/**
 * Obtém informações do projeto Supabase
 */
async function getProjectInfo() {
    try {
        const { data, error } = await supabaseAdmin.rpc('version');

        if (error) {
            console.error('Erro ao obter informações do projeto:', error);
            return null;
        }

        return {
            connected: true,
            version: data || 'N/A',
            url: supabaseUrl
        };
    } catch (err) {
        console.error('Erro ao conectar:', err);
        return {
            connected: false,
            error: err.message
        };
    }
}

module.exports = {
    supabase,
    supabaseAdmin,
    testConnection,
    getProjectInfo
};