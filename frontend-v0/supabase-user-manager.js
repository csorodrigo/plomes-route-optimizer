/**
 * 🔐 SUPABASE USER MANAGER
 * Script para verificar e criar usuários no Supabase usando conexão direta PostgreSQL
 */

const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const SUPABASE_URL = 'https://yxwokryybudwygtemfmu.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4d29rcnl5YnVkd3lndGVtZm11Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODc0MTY4MSwiZXhwIjoyMDc0MzE3NjgxfQ.dzEfWIgdftQiwXJdod_bIy4pUl42WwlS-VWYaKvqEKg';

// Extract project ref from Supabase URL
const dbUrl = SUPABASE_URL.replace('https://', '');
const projectRef = dbUrl.split('.')[0]; // yxwokryybudwygtemfmu

// Direct PostgreSQL connection
const connectionString = `postgresql://postgres.${projectRef}:${SUPABASE_SERVICE_ROLE_KEY}@aws-0-us-east-1.pooler.supabase.com:5432/postgres`;

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

async function verifyUserExists(email) {
  console.log(`🔍 Verificando usuário: ${email}`);

  try {
    const query = 'SELECT id, email, name, role, created_at FROM users WHERE email = $1';
    const result = await pool.query(query, [email.toLowerCase()]);

    if (result.rows.length > 0) {
      const user = result.rows[0];
      console.log('✅ Usuário encontrado:', {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        created_at: user.created_at
      });
      return user;
    } else {
      console.log('❌ Usuário não encontrado');
      return null;
    }
  } catch (error) {
    console.error('❌ Erro na verificação:', error);
    return null;
  }
}

async function createUser(email, password, name = 'Gustavo Canuto') {
  console.log(`🔨 Criando usuário: ${email}`);

  try {
    // Hash da senha
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    console.log(`🔐 Password hash gerado (${passwordHash.length} chars)`);

    const query = `
      INSERT INTO users (email, name, password_hash, role, created_at)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, email, name, role, created_at
    `;

    const values = [
      email.toLowerCase(),
      name,
      passwordHash,
      'admin',
      new Date().toISOString()
    ];

    const result = await pool.query(query, values);

    if (result.rows.length > 0) {
      const user = result.rows[0];
      console.log('✅ Usuário criado com sucesso:', {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      });
      return user;
    } else {
      console.error('❌ Falha na criação do usuário');
      return null;
    }
  } catch (error) {
    console.error('❌ Erro na criação:', error);
    return null;
  }
}

async function testLogin(email, password) {
  console.log(`🧪 Testando login: ${email}`);

  try {
    const query = 'SELECT id, email, name, password_hash, role FROM users WHERE email = $1';
    const result = await pool.query(query, [email.toLowerCase()]);

    if (result.rows.length === 0) {
      console.log('❌ Usuário não encontrado para teste');
      return false;
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (validPassword) {
      console.log('✅ Login teste OK - credenciais válidas');
      return true;
    } else {
      console.log('❌ Login teste FALHOU - senha inválida');
      return false;
    }
  } catch (error) {
    console.error('❌ Erro no teste de login:', error);
    return false;
  }
}

async function listAllUsers() {
  console.log('📋 Listando todos os usuários...');

  try {
    const query = 'SELECT id, email, name, role, created_at FROM users ORDER BY created_at DESC';
    const result = await pool.query(query);

    const users = result.rows;
    console.log(`📊 Total de usuários: ${users.length}`);

    users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.email} (${user.name}) - ${user.role} - ${user.created_at}`);
    });

    return users;
  } catch (error) {
    console.error('❌ Erro na listagem:', error);
    return [];
  }
}

async function main() {
  console.log('🚀 INICIANDO VERIFICAÇÃO SUPABASE USERS\n');

  const targetEmail = 'gustavo.canuto@ciaramaquinas.com.br';
  const targetPassword = 'ciara123@';

  // 1. Listar todos os usuários
  await listAllUsers();
  console.log('\n');

  // 2. Verificar se usuário específico existe
  const existingUser = await verifyUserExists(targetEmail);
  console.log('\n');

  // 3. Criar usuário se não existir
  if (!existingUser) {
    const newUser = await createUser(targetEmail, targetPassword);
    if (!newUser) {
      console.log('❌ FALHA: Não foi possível criar o usuário');
      return;
    }
    console.log('\n');
  }

  // 4. Testar login
  const loginSuccess = await testLogin(targetEmail, targetPassword);
  console.log('\n');

  // 5. Resultado final
  if (loginSuccess) {
    console.log('🎉 SUCESSO: Credenciais funcionais confirmadas!');
    console.log(`📧 Email: ${targetEmail}`);
    console.log(`🔑 Senha: ${targetPassword}`);
    console.log('✅ Login no Vercel deve funcionar agora!');
  } else {
    console.log('❌ PROBLEMA: Credenciais não funcionaram');
  }
}

// Executar o script
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  verifyUserExists,
  createUser,
  testLogin,
  listAllUsers
};