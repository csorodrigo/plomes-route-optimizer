#!/usr/bin/env node

/**
 * Script para forçar a migração de hashes bcrypt para SHA256 no Railway
 * Este script deve ser executado no ambiente de produção para corrigir
 * usuários com hashes bcrypt antigos
 */

const path = require('path');

// Garantir que o diretório de trabalho está correto
process.chdir(path.join(__dirname, '..'));

const DatabaseService = require('../services/sync/database-service');
const AuthService = require('../services/auth/auth-service');

async function fixPasswordHashes() {
    console.log('🔧 Iniciando correção de hashes de senha...');
    console.log('📍 Working directory:', process.cwd());
    console.log('🌍 Environment:', process.env.NODE_ENV || 'development');
    
    const db = new DatabaseService();
    const auth = new AuthService(db);
    
    try {
        // Inicializar base de dados
        console.log('🔄 Inicializando banco de dados...');
        await db.initialize();
        
        console.log('🔄 Inicializando serviço de autenticação...');
        await auth.initialize();
        
        // Verificar usuários existentes
        console.log('🔍 Verificando usuários na base de dados...');
        const users = await db.all('SELECT id, email, password_hash FROM users');
        console.log(`📊 Encontrados ${users.length} usuários`);
        
        let updatedCount = 0;
        
        for (const user of users) {
            // Verificar se o hash é bcrypt (não contém ':')
            if (!user.password_hash.includes(':')) {
                console.log(`🔄 Usuário ${user.email} tem hash bcrypt antigo - atualizando...`);
                
                // Senha padrão conhecida para o usuário padrão
                const defaultPassword = user.email === 'gustavo.canuto@ciaramaquinas.com.br' ? 'ciara123@' : null;
                
                if (defaultPassword) {
                    const newHash = await auth.hashPassword(defaultPassword);
                    
                    await db.run(
                        'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                        [newHash, user.id]
                    );
                    
                    console.log(`✅ Hash atualizado para usuário ${user.email}`);
                    updatedCount++;
                } else {
                    console.log(`⚠️  Usuário ${user.email} tem hash bcrypt mas senha desconhecida`);
                }
            } else {
                console.log(`✅ Usuário ${user.email} já tem hash SHA256`);
            }
        }
        
        // Estatísticas finais
        console.log(`\n📊 RESUMO:`);
        console.log(`- Total de usuários: ${users.length}`);
        console.log(`- Usuários atualizados: ${updatedCount}`);
        
        // Limpar sessões expiradas
        console.log('🧹 Limpando sessões expiradas...');
        const cleanedSessions = await auth.cleanupExpiredSessions();
        console.log(`🧹 ${cleanedSessions} sessões expiradas removidas`);
        
        // Estatísticas do sistema
        const stats = await auth.getUserStats();
        console.log(`📈 Usuários ativos: ${stats.totalUsers}`);
        console.log(`📈 Sessões ativas: ${stats.activeSessions}`);
        
        console.log('\n🎉 Correção de hashes concluída com sucesso!');
        
    } catch (error) {
        console.error('❌ Erro durante a correção:', error);
        process.exit(1);
    } finally {
        // Fechar conexão com banco
        try {
            await db.close();
            console.log('🔌 Conexão com banco de dados fechada');
        } catch (error) {
            console.error('⚠️  Erro ao fechar conexão:', error);
        }
    }
}

// Executar apenas se chamado diretamente
if (require.main === module) {
    fixPasswordHashes()
        .then(() => {
            console.log('✨ Script executado com sucesso!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('💥 Erro fatal:', error);
            process.exit(1);
        });
}

module.exports = { fixPasswordHashes };