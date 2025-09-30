#!/usr/bin/env node

/**
 * Script para configurar variáveis de ambiente na Vercel
 *
 * Este script automatiza a configuração das variáveis de ambiente
 * necessárias para o Supabase funcionar na Vercel
 */

const fs = require('fs');
const { execSync } = require('child_process');

async function deployVercelEnv() {
    console.log('🚀 CONFIGURAÇÃO VERCEL ENV');
    console.log('==========================\n');

    try {
        // 1. Verificar se Vercel CLI está instalado
        console.log('🔧 1. Verificando Vercel CLI...');
        try {
            execSync('vercel --version', { stdio: 'pipe' });
            console.log('   ✅ Vercel CLI encontrado');
        } catch (error) {
            console.log('   ❌ Vercel CLI não encontrado');
            console.log('   💡 Instale com: npm i -g vercel');
            console.log('   🔗 Ou acesse: https://vercel.com/cli');
            return false;
        }

        // 2. Verificar se está logado
        console.log('\n🔐 2. Verificando autenticação...');
        try {
            execSync('vercel whoami', { stdio: 'pipe' });
            console.log('   ✅ Autenticado na Vercel');
        } catch (error) {
            console.log('   ❌ Não autenticado');
            console.log('   💡 Execute: vercel login');
            return false;
        }

        // 3. Ler configurações do .env
        console.log('\n📋 3. Carregando configurações...');

        if (!fs.existsSync('.env')) {
            console.log('   ❌ Arquivo .env não encontrado');
            return false;
        }

        const envContent = fs.readFileSync('.env', 'utf8');
        const envVars = {};

        // Parsear variáveis
        envContent.split('\n').forEach(line => {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
                const [key, ...valueParts] = trimmed.split('=');
                const value = valueParts.join('=');
                envVars[key.trim()] = value.trim();
            }
        });

        // Variáveis críticas para Supabase + Ploomes
        const criticalVars = [
            'SUPABASE_URL',
            'SUPABASE_ANON_KEY',
            'SUPABASE_SERVICE_ROLE_KEY',
            'PLOOMES_API_KEY',
            'PLOOMES_BASE_URL',
            'CLIENT_TAG_ID',
            'JWT_SECRET',
            'GOOGLE_MAPS_API_KEY'
        ];

        console.log('   📊 Variáveis encontradas:');
        criticalVars.forEach(varName => {
            const value = envVars[varName];
            if (value) {
                const preview = value.length > 20 ? `${value.substring(0, 20)}...` : value;
                console.log(`   ✅ ${varName}: ${preview}`);
            } else {
                console.log(`   ❌ ${varName}: NÃO ENCONTRADA`);
            }
        });

        // 4. Verificar configurações Supabase
        console.log('\n🔍 4. Validando configurações Supabase...');

        const supabaseUrl = envVars['SUPABASE_URL'];
        const supabaseAnonKey = envVars['SUPABASE_ANON_KEY'];
        const supabaseServiceKey = envVars['SUPABASE_SERVICE_ROLE_KEY'];

        let hasSupabaseErrors = false;

        if (!supabaseUrl || !supabaseUrl.includes('supabase.co')) {
            console.log('   ❌ SUPABASE_URL inválida');
            hasSupabaseErrors = true;
        }

        if (!supabaseAnonKey || !supabaseAnonKey.startsWith('eyJ')) {
            console.log('   ❌ SUPABASE_ANON_KEY inválida (deve começar com "eyJ")');
            hasSupabaseErrors = true;
        }

        if (!supabaseServiceKey || !supabaseServiceKey.startsWith('eyJ')) {
            console.log('   ❌ SUPABASE_SERVICE_ROLE_KEY inválida (deve começar com "eyJ")');
            hasSupabaseErrors = true;
        }

        if (hasSupabaseErrors) {
            console.log('\n🚨 CONFIGURAÇÕES SUPABASE INVÁLIDAS!');
            console.log('');
            console.log('📝 Para corrigir:');
            console.log('1. Acesse https://supabase.com/dashboard');
            console.log('2. Selecione seu projeto');
            console.log('3. Vá em Settings → API');
            console.log('4. Copie as chaves corretas para o arquivo .env');
            console.log('5. Execute novamente este script');
            return false;
        }

        // 5. Configurar na Vercel
        console.log('\n🚀 5. Configurando variáveis na Vercel...');

        const commands = [];

        criticalVars.forEach(varName => {
            const value = envVars[varName];
            if (value) {
                // Adicionar para todos os ambientes (development, preview, production)
                commands.push(`vercel env add ${varName} development`);
                commands.push(`vercel env add ${varName} preview`);
                commands.push(`vercel env add ${varName} production`);
            }
        });

        console.log('   📋 Comandos a serem executados:');
        console.log('   (Você será solicitado a inserir os valores para cada variável)');
        console.log('');

        criticalVars.forEach(varName => {
            const value = envVars[varName];
            if (value) {
                console.log(`   ${varName}=${value}`);
                console.log('');
            }
        });

        console.log('⚡ EXECUÇÃO AUTOMÁTICA:');
        console.log('');
        console.log('Para configurar automaticamente, execute:');
        console.log('');

        criticalVars.forEach(varName => {
            const value = envVars[varName];
            if (value) {
                console.log(`echo "${value}" | vercel env add ${varName} production`);
            }
        });

        console.log('');
        console.log('📋 OU execute este arquivo de comandos:');

        // Criar script de comandos
        const scriptContent = criticalVars
            .filter(varName => envVars[varName])
            .map(varName => {
                const value = envVars[varName];
                return [
                    `echo "Configurando ${varName}..."`,
                    `echo "${value}" | vercel env add ${varName} production`,
                    `echo "${value}" | vercel env add ${varName} preview`,
                    `echo "${value}" | vercel env add ${varName} development`,
                    'echo ""'
                ].join('\n');
            })
            .join('\n\n');

        fs.writeFileSync('./deploy-env-to-vercel.sh', `#!/bin/bash\n\n${scriptContent}`);
        execSync('chmod +x ./deploy-env-to-vercel.sh');

        console.log('   💾 Script criado: ./deploy-env-to-vercel.sh');
        console.log('   ⚡ Execute: ./deploy-env-to-vercel.sh');

        console.log('\n✅ CONFIGURAÇÃO PREPARADA!');
        console.log('==========================');
        console.log('🎯 Próximos passos:');
        console.log('');
        console.log('1. Execute o script: ./deploy-env-to-vercel.sh');
        console.log('2. Ou configure manualmente via dashboard Vercel');
        console.log('3. Faça deploy: vercel --prod');
        console.log('4. Teste a aplicação em produção');

        return true;

    } catch (error) {
        console.error('\n💥 ERRO:', error);
        return false;
    }
}

// Executar se chamado diretamente
if (require.main === module) {
    deployVercelEnv()
        .then((success) => {
            process.exit(success ? 0 : 1);
        })
        .catch((error) => {
            console.error('💥 Falha crítica:', error);
            process.exit(1);
        });
}

module.exports = { deployVercelEnv };