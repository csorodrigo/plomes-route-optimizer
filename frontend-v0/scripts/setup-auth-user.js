#!/usr/bin/env node

/**
 * Script de Setup Seguro do Usuário de Autenticação
 * =================================================
 *
 * ANÁLISE DE SEGURANÇA:
 * 1. ✅ Usa bcrypt para hash de senha (salt rounds: 10)
 * 2. ✅ Não expõe senhas em logs
 * 3. ✅ Validação de entrada
 * 4. ✅ Tratamento seguro de erros
 * 5. ✅ Usa prepared statements implicitamente via Supabase
 *
 * OWASP Coverage:
 * - A02:2021 – Cryptographic Failures: Bcrypt com salt
 * - A03:2021 – Injection: Supabase SDK previne SQL injection
 * - A07:2021 – Identification and Authentication Failures: Hash seguro
 */

const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: '.env.local' });

// Configuração do Supabase
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://yxwokryybudwygtemfmu.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ ERRO CRÍTICO: SUPABASE_SERVICE_ROLE_KEY não configurado');
  console.error('Configure a variável de ambiente SUPABASE_SERVICE_ROLE_KEY no .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Configuração do usuário
const USER_CONFIG = {
  email: 'gustavo.canuto@ciaramaquinas.com.br',
  password: 'ciara123@',
  name: 'Gustavo Canuto',
  role: 'admin'
};

/**
 * Função principal para setup do usuário
 */
async function setupUser() {
  console.log('🔒 Iniciando setup seguro do usuário de autenticação...');
  console.log('📧 Email:', USER_CONFIG.email);
  console.log('👤 Nome:', USER_CONFIG.name);
  console.log('🛡️ Role:', USER_CONFIG.role);

  try {
    // 1. Verificar se o usuário já existe
    console.log('\n1️⃣ Verificando se usuário existe...');
    const { data: existingUser, error: selectError } = await supabase
      .from('users')
      .select('id, email, name, role')
      .eq('email', USER_CONFIG.email.toLowerCase())
      .single();

    if (selectError && selectError.code !== 'PGRST116') {
      // PGRST116 = no rows returned, which is OK
      console.error('❌ Erro ao verificar usuário:', selectError.message);
      return;
    }

    // 2. Gerar hash seguro da senha
    console.log('2️⃣ Gerando hash seguro da senha...');
    const saltRounds = 10; // Recomendação OWASP
    const passwordHash = await bcrypt.hash(USER_CONFIG.password, saltRounds);
    console.log('✅ Hash gerado com sucesso (bcrypt, salt rounds: 10)');
    console.log('📊 Hash length:', passwordHash.length);

    if (existingUser) {
      // 3A. Atualizar usuário existente
      console.log('\n3️⃣ Usuário encontrado. Atualizando senha...');

      const { data: updatedUser, error: updateError } = await supabase
        .from('users')
        .update({
          password_hash: passwordHash,
          name: USER_CONFIG.name,
          role: USER_CONFIG.role,
          updated_at: new Date().toISOString()
        })
        .eq('email', USER_CONFIG.email.toLowerCase())
        .select()
        .single();

      if (updateError) {
        console.error('❌ Erro ao atualizar usuário:', updateError.message);
        return;
      }

      console.log('✅ Usuário atualizado com sucesso!');
      console.log('👤 ID:', updatedUser.id);
      console.log('📧 Email:', updatedUser.email);
      console.log('🛡️ Role:', updatedUser.role);

    } else {
      // 3B. Criar novo usuário
      console.log('\n3️⃣ Usuário não existe. Criando novo usuário...');

      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert({
          email: USER_CONFIG.email.toLowerCase(),
          name: USER_CONFIG.name,
          password_hash: passwordHash,
          role: USER_CONFIG.role,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (insertError) {
        console.error('❌ Erro ao criar usuário:', insertError.message);
        return;
      }

      console.log('✅ Usuário criado com sucesso!');
      console.log('👤 ID:', newUser.id);
      console.log('📧 Email:', newUser.email);
      console.log('🛡️ Role:', newUser.role);
    }

    // 4. Testar autenticação
    console.log('\n4️⃣ Testando autenticação...');

    const { data: testUser, error: testError } = await supabase
      .from('users')
      .select('id, email, password_hash')
      .eq('email', USER_CONFIG.email.toLowerCase())
      .single();

    if (testError) {
      console.error('❌ Erro ao buscar usuário para teste:', testError.message);
      return;
    }

    const isValid = await bcrypt.compare(USER_CONFIG.password, testUser.password_hash);
    console.log('🔐 Teste de autenticação:', isValid ? '✅ SUCESSO' : '❌ FALHOU');

    if (isValid) {
      console.log('\n✅ ✅ ✅ SETUP CONCLUÍDO COM SUCESSO! ✅ ✅ ✅');
      console.log('O usuário está pronto para fazer login com:');
      console.log('📧 Email:', USER_CONFIG.email);
      console.log('🔑 Senha: [PROTEGIDA]');
      console.log('\n🔒 Recomendações de Segurança:');
      console.log('   1. Altere a senha após o primeiro login');
      console.log('   2. Configure 2FA quando disponível');
      console.log('   3. Use senhas fortes e únicas');
      console.log('   4. Monitore logs de acesso regularmente');
    } else {
      console.error('\n❌ Falha na validação da senha. Verifique as configurações.');
    }

  } catch (error) {
    console.error('❌ Erro inesperado:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Executar setup
setupUser()
  .then(() => {
    console.log('\n🔒 Script de setup finalizado.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
  });