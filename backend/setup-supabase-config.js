#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Script para configurar credenciais Supabase
 *
 * Instruções para obter as credenciais:
 * 1. Acesse https://supabase.com/dashboard
 * 2. Selecione seu projeto
 * 3. Vá em Settings > API
 * 4. Copie: URL do projeto, anon/public key, e service_role key
 */

console.log('🔧 CONFIGURAÇÃO SUPABASE');
console.log('========================\n');

console.log('❗ INFORMAÇÕES NECESSÁRIAS:');
console.log('');
console.log('Para configurar o Supabase, você precisa das seguintes informações:');
console.log('');
console.log('1. 📍 URL do Projeto (formato: https://xxxxx.supabase.co)');
console.log('2. 🔑 Anon/Public Key (chave longa começando com "eyJ...")');
console.log('3. 🔐 Service Role Key (chave longa começando com "eyJ...")');
console.log('');
console.log('🌐 Como obter essas informações:');
console.log('');
console.log('1. Acesse: https://supabase.com/dashboard');
console.log('2. Selecione seu projeto');
console.log('3. Vá em: Settings → API');
console.log('4. Copie as informações da seção "Project API keys"');
console.log('');

// Verificar configuração atual
const envPath = path.join(__dirname, '..', '.env');
console.log('📋 CONFIGURAÇÃO ATUAL (.env):');

try {
    const envContent = fs.readFileSync(envPath, 'utf8');

    const supabaseUrl = envContent.match(/SUPABASE_URL=(.+)/)?.[1] || 'NÃO CONFIGURADO';
    const supabaseAnonKey = envContent.match(/SUPABASE_ANON_KEY=(.+)/)?.[1] || 'NÃO CONFIGURADO';
    const supabaseServiceKey = envContent.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)?.[1] || 'NÃO CONFIGURADO';

    console.log(`URL: ${supabaseUrl}`);
    console.log(`Anon Key: ${supabaseAnonKey.substring(0, 20)}...`);
    console.log(`Service Key: ${supabaseServiceKey.substring(0, 20)}...`);
    console.log('');

    // Validar formato
    let hasErrors = false;

    if (!supabaseUrl.includes('supabase.co')) {
        console.log('❌ URL parece inválida (deve terminar com .supabase.co)');
        hasErrors = true;
    }

    if (!supabaseAnonKey.startsWith('eyJ')) {
        console.log('❌ Anon Key parece inválida (deve começar com "eyJ")');
        hasErrors = true;
    }

    if (!supabaseServiceKey.startsWith('eyJ')) {
        console.log('❌ Service Key parece inválida (deve começar com "eyJ")');
        hasErrors = true;
    }

    if (supabaseAnonKey.length < 100) {
        console.log('❌ Anon Key muito curta (deve ter mais de 100 caracteres)');
        hasErrors = true;
    }

    if (hasErrors) {
        console.log('');
        console.log('🚨 PROBLEMAS DETECTADOS NA CONFIGURAÇÃO!');
        console.log('');
        console.log('📝 Para corrigir:');
        console.log('');
        console.log('1. Abra o arquivo .env');
        console.log('2. Substitua os valores SUPABASE_* pelos corretos');
        console.log('3. Execute novamente: node backend/test-supabase.js');
        console.log('');
        console.log('💡 EXEMPLO de configuração correta:');
        console.log('');
        console.log('SUPABASE_URL=https://xxyyzz.supabase.co');
        console.log('SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzd...');
        console.log('SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzd...');
        console.log('');
    } else {
        console.log('✅ Configuração parece correta!');
        console.log('');
        console.log('🧪 Próximo passo: Execute o teste');
        console.log('node backend/test-supabase.js');
    }

} catch (error) {
    console.error('❌ Erro ao ler arquivo .env:', error.message);
}

console.log('');
console.log('🔗 Links úteis:');
console.log('');
console.log('• Dashboard Supabase: https://supabase.com/dashboard');
console.log('• Documentação API: https://supabase.com/docs/guides/api');
console.log('• Guia de configuração: https://supabase.com/docs/guides/getting-started');
console.log('');