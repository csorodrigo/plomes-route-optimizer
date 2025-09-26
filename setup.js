#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Cores para output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function header(title) {
    console.log('\n' + '='.repeat(60));
    log(title, 'cyan');
    console.log('='.repeat(60));
}

function success(message) {
    log(`✅ ${message}`, 'green');
}

function error(message) {
    log(`❌ ${message}`, 'red');
}

function warning(message) {
    log(`⚠️  ${message}`, 'yellow');
}

function info(message) {
    log(`ℹ️  ${message}`, 'blue');
}

async function question(prompt) {
    return new Promise((resolve) => {
        rl.question(prompt, (answer) => {
            resolve(answer);
        });
    });
}

async function runCommand(command, description, options = {}) {
    try {
        info(description);
        execSync(command, { stdio: options.silent ? 'pipe' : 'inherit' });
        success(`${description} - Concluído`);
        return true;
    } catch (err) {
        error(`${description} - Falhou`);
        if (!options.silent) {
            console.error(err.message);
        }
        return false;
    }
}

async function checkPrerequisites() {
    header('Verificando Pré-requisitos');
    
    let allGood = true;
    
    // Verificar Node.js
    try {
        const nodeVersion = execSync('node --version', { encoding: 'utf8' }).trim();
        success(`Node.js instalado: ${nodeVersion}`);
    } catch {
        error('Node.js não encontrado. Instale Node.js 16+ primeiro.');
        allGood = false;
    }
    
    // Verificar NPM
    try {
        const npmVersion = execSync('npm --version', { encoding: 'utf8' }).trim();
        success(`NPM instalado: ${npmVersion}`);
    } catch {
        error('NPM não encontrado.');
        allGood = false;
    }
    
    return allGood;
}

async function checkEnvFile() {
    header('Configuração do Ambiente');
    
    const envPath = path.join(__dirname, '.env');
    
    if (!fs.existsSync(envPath)) {
        error('Arquivo .env não encontrado!');
        info('Criando arquivo .env de exemplo...');
        
        const envExample = `# Ploome API Configuration
PLOOME_API_KEY=SUA_CHAVE_API_AQUI
PLOOME_API_URL=https://public-api2.ploomes.com

# Server Configuration
PORT=3001
NODE_ENV=development

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-public-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Rate Limiting
API_RATE_LIMIT_PER_MINUTE=120
GEOCODING_DELAY_MS=1000

# Cache TTL (in seconds)
CACHE_TTL_CUSTOMERS=86400
CACHE_TTL_GEOCODING=2592000
CACHE_TTL_ROUTES=3600`;
        
        fs.writeFileSync(envPath, envExample);
        warning('Arquivo .env criado. Por favor, adicione sua PLOOME_API_KEY!');
        
        const answer = await question('\nDeseja adicionar a API key agora? (s/n): ');
        if (answer.toLowerCase() === 's') {
            const apiKey = await question('Cole sua API key do Ploome: ');
            const envContent = fs.readFileSync(envPath, 'utf8');
            const updatedEnv = envContent.replace('SUA_CHAVE_API_AQUI', apiKey.trim());
            fs.writeFileSync(envPath, updatedEnv);
            success('API key adicionada ao .env');
        }
    } else {
        success('Arquivo .env encontrado');
        
        // Verificar se tem API key
        const envContent = fs.readFileSync(envPath, 'utf8');
        if (envContent.includes('SUA_CHAVE_API_AQUI') || !envContent.includes('PLOOME_API_KEY=')) {
            warning('API key do Ploome não configurada no .env');
            const answer = await question('\nDeseja adicionar a API key agora? (s/n): ');
            if (answer.toLowerCase() === 's') {
                const apiKey = await question('Cole sua API key do Ploome: ');
                const updatedEnv = envContent.replace(/PLOOME_API_KEY=.*/g, `PLOOME_API_KEY=${apiKey.trim()}`);
                fs.writeFileSync(envPath, updatedEnv);
                success('API key atualizada no .env');
            }
        } else {
            success('API key configurada');
        }
    }
}

async function installDependencies() {
    header('Instalando Dependências');
    
    // Backend
    info('Instalando dependências do backend...');
    const backendSuccess = await runCommand('npm install', 'Dependências do backend');
    
    // Frontend
    info('\nInstalando dependências do frontend...');
    const frontendSuccess = await runCommand('cd frontend && npm install', 'Dependências do frontend');
    
    return backendSuccess && frontendSuccess;
}

async function createDatabase() {
    header('Configurando Banco de Dados');
    
    const dbDir = path.join(__dirname, 'backend', 'cache');
    if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
        success('Diretório do banco criado');
    } else {
        success('Diretório do banco já existe');
    }
    
    return true;
}

async function testPloomeConnection() {
    header('Testando Conexão com Ploome');
    
    try {
        // Carregar variáveis de ambiente
        require('dotenv').config();
        
        if (!process.env.PLOOME_API_KEY || process.env.PLOOME_API_KEY === 'SUA_CHAVE_API_AQUI') {
            warning('API key não configurada - pulando teste de conexão');
            info('Configure a API key no arquivo .env e execute: npm run test:connection');
            return false;
        }
        
        info('Testando conexão com a API do Ploome...');
        
        const axios = require('axios');
        const response = await axios.get('https://public-api2.ploomes.com/Account', {
            headers: {
                'User-Key': process.env.PLOOME_API_KEY,
                'Content-Type': 'application/json; charset=utf-8'
            },
            timeout: 10000
        });
        
        success('Conexão com Ploome estabelecida com sucesso!');
        info(`Conta: ${response.data.Name || 'Conectado'}`);
        return true;
        
    } catch (err) {
        if (err.response) {
            error(`Erro na conexão: ${err.response.status} - ${err.response.statusText}`);
            
            if (err.response.status === 403) {
                warning('API key inválida ou sem permissões');
                info('Verifique no Ploome:');
                info('1. Administração → Usuários de Integração');
                info('2. Confirme que o usuário está ativo');
                info('3. Verifique as permissões do perfil');
            } else if (err.response.status === 401) {
                warning('API key não reconhecida');
                info('Gere uma nova chave no Ploome');
            }
        } else {
            error(`Erro de conexão: ${err.message}`);
        }
        
        return false;
    }
}

async function showNextSteps() {
    header('Próximos Passos');
    
    console.log('\n📋 Para iniciar o sistema:\n');
    
    log('1. Iniciar o backend:', 'bright');
    console.log('   npm run dev:backend');
    
    log('\n2. Em outro terminal, iniciar o frontend:', 'bright');
    console.log('   cd frontend && npm start');
    
    log('\n3. Ou iniciar ambos juntos:', 'bright');
    console.log('   npm run dev');
    
    console.log('\n📝 Comandos úteis:\n');
    console.log('   npm run test:connection  - Testar conexão com Ploome');
    console.log('   npm run sync:ploome      - Sincronizar clientes do Ploome');
    console.log('   npm run build            - Build para produção');
    
    console.log('\n🌐 URLs:\n');
    console.log('   Backend API: http://localhost:3001');
    console.log('   Frontend:    http://localhost:3000');
    console.log('   Test API:    http://localhost:3001/api/test-connection');
}

async function main() {
    console.clear();
    log('🚀 SETUP - Sistema de Otimização de Rotas', 'bright');
    log('   Integração com Ploome CRM\n', 'cyan');
    
    // Verificar pré-requisitos
    if (!await checkPrerequisites()) {
        error('\nSetup interrompido. Instale os pré-requisitos primeiro.');
        process.exit(1);
    }
    
    // Configurar ambiente
    await checkEnvFile();
    
    // Instalar dependências
    const depsOk = await installDependencies();
    if (!depsOk) {
        warning('Algumas dependências falharam ao instalar');
    }
    
    // Criar banco de dados
    await createDatabase();
    
    // Testar conexão
    const connectionOk = await testPloomeConnection();
    
    // Mostrar próximos passos
    await showNextSteps();
    
    header('Setup Concluído!');
    
    if (connectionOk) {
        success('Sistema pronto para uso!');
    } else {
        warning('Sistema instalado, mas configure a API key para usar todas as funcionalidades');
    }
    
    rl.close();
}

// Executar setup
main().catch(err => {
    error('Erro durante o setup:');
    console.error(err);
    process.exit(1);
});
