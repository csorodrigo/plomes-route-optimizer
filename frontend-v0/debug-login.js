/**
 * 🔍 DEBUG LOGIN
 * Script para debugar problemas de login
 */

const TARGET_EMAIL = 'gustavo.canuto@ciaramaquinas.com.br';
const TARGET_PASSWORD = 'ciara123@';
const BASE_URL = 'https://frontend-v0-g5danx55f-csorodrigo-2569s-projects.vercel.app';

async function debugLogin() {
  console.log('🔍 DEBUGGING LOGIN');
  console.log(`📧 Email: ${TARGET_EMAIL}`);
  console.log(`🔑 Senha: ${TARGET_PASSWORD}`);
  console.log(`🌐 URL: ${BASE_URL}`);
  console.log('='.repeat(50));

  try {
    const response = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: TARGET_EMAIL,
        password: TARGET_PASSWORD
      })
    });

    console.log(`📊 Status: ${response.status}`);
    console.log(`📋 Headers:`, Object.fromEntries(response.headers.entries()));

    const contentType = response.headers.get('content-type');
    let result;

    if (contentType && contentType.includes('application/json')) {
      result = await response.json();
      console.log('📦 JSON Response:', JSON.stringify(result, null, 2));
    } else {
      const text = await response.text();
      console.log('📄 Text Response:', text);
    }

    if (response.ok) {
      console.log('✅ LOGIN BEM-SUCEDIDO!');
      if (result && result.token) {
        console.log(`🎫 Token: ${result.token.substring(0, 20)}...`);
      }
    } else {
      console.log('❌ LOGIN FALHOU');
      console.log(`🚨 Erro: ${result?.error || 'Erro desconhecido'}`);
    }

  } catch (error) {
    console.error('💥 Erro de rede:', error.message);
  }
}

async function testEndpointExists() {
  console.log('\n🔧 Testando se endpoints existem...');

  const endpoints = [
    '/api/auth/login',
    '/api/admin/create-user',
    '/api/health'
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`${BASE_URL}${endpoint}`, {
        method: 'GET'
      });

      console.log(`${endpoint}: ${response.status} (${response.ok ? 'OK' : 'ERRO'})`);
    } catch (error) {
      console.log(`${endpoint}: ERRO - ${error.message}`);
    }
  }
}

async function main() {
  await debugLogin();
  await testEndpointExists();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { debugLogin, testEndpointExists };