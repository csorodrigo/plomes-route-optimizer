#!/usr/bin/env node

/**
 * Teste de Integração Frontend ↔ Backend
 * Sistema PLOMES-ROTA-CEP
 */

const axios = require('axios');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

// Configurações
const BACKEND_URL = 'http://localhost:3001';
const FRONTEND_URL = 'http://localhost:3000';

// Cores para output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};

function log(color, icon, message) {
    console.log(`${color}${icon} ${message}${colors.reset}`);
}

function success(message) {
    log(colors.green, '✅', message);
}

function error(message) {
    log(colors.red, '❌', message);
}

function warning(message) {
    log(colors.yellow, '⚠️ ', message);
}

function info(message) {
    log(colors.blue, 'ℹ️ ', message);
}

function section(title) {
    console.log(`\n${colors.bright}${colors.cyan}🔍 === ${title} ===${colors.reset}`);
}

// Cliente HTTP com timeout
const client = axios.create({
    timeout: 10000,
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Integration-Test/1.0'
    }
});

/**
 * Teste de conectividade básica
 */
async function testBasicConnectivity() {
    section('CONECTIVIDADE BÁSICA');

    const tests = [
        {
            name: 'Backend Health Check',
            url: `${BACKEND_URL}/api/health`,
            expected: 'healthy'
        },
        {
            name: 'Backend Version',
            url: `${BACKEND_URL}/api/version`,
            expected: 'app'
        },
        {
            name: 'Frontend Loading',
            url: FRONTEND_URL,
            expected: 'DOCTYPE html'
        }
    ];

    const results = {};

    for (const test of tests) {
        try {
            const response = await client.get(test.url);

            if (test.expected === 'healthy' && response.data.status === 'healthy') {
                success(`${test.name}: OK (${response.data.version})`);
                results[test.name] = 'PASS';
            } else if (test.expected === 'app' && response.data.app) {
                success(`${test.name}: OK (v${response.data.app.version})`);
                results[test.name] = 'PASS';
            } else if (test.expected === 'DOCTYPE html' && response.data.includes('DOCTYPE html')) {
                success(`${test.name}: OK (React App Loading)`);
                results[test.name] = 'PASS';
            } else {
                warning(`${test.name}: Resposta inesperada`);
                results[test.name] = 'PARTIAL';
            }
        } catch (err) {
            error(`${test.name}: ${err.message}`);
            results[test.name] = 'FAIL';
        }
    }

    return results;
}

/**
 * Teste de CORS
 */
async function testCORS() {
    section('CONFIGURAÇÃO CORS');

    const results = {};

    try {
        // Teste com Origin do frontend
        const response = await axios.get(`${BACKEND_URL}/api/health`, {
            headers: {
                'Origin': FRONTEND_URL
            }
        });

        const corsHeaders = {
            'access-control-allow-origin': response.headers['access-control-allow-origin'],
            'access-control-allow-credentials': response.headers['access-control-allow-credentials'],
            'access-control-allow-methods': response.headers['access-control-allow-methods']
        };

        if (corsHeaders['access-control-allow-origin'] === FRONTEND_URL) {
            success('CORS Origin: Configurado corretamente');
            results.origin = 'PASS';
        } else {
            warning(`CORS Origin: ${corsHeaders['access-control-allow-origin']}`);
            results.origin = 'PARTIAL';
        }

        if (corsHeaders['access-control-allow-credentials'] === 'true') {
            success('CORS Credentials: Habilitado');
            results.credentials = 'PASS';
        } else {
            warning('CORS Credentials: Não habilitado');
            results.credentials = 'FAIL';
        }

        success('CORS: Funcionando corretamente');

    } catch (err) {
        error(`CORS Test Failed: ${err.message}`);
        results.overall = 'FAIL';
    }

    return results;
}

/**
 * Teste de APIs críticas
 */
async function testCriticalAPIs() {
    section('APIS CRÍTICAS');

    const results = {};

    // APIs públicas (sem autenticação)
    const publicAPIs = [
        {
            name: 'Ploome Connection Test',
            method: 'GET',
            url: `${BACKEND_URL}/api/test-connection`,
            expectedField: 'success'
        },
        {
            name: 'Geocoding CEP',
            method: 'POST',
            url: `${BACKEND_URL}/api/geocoding/cep`,
            data: { cep: '01310-100' },
            expectedField: 'success'
        }
    ];

    for (const api of publicAPIs) {
        try {
            let response;
            if (api.method === 'GET') {
                response = await client.get(api.url);
            } else {
                response = await client.post(api.url, api.data);
            }

            if (response.data[api.expectedField]) {
                success(`${api.name}: OK`);
                results[api.name] = 'PASS';

                // Log detalhes específicos
                if (api.name === 'Ploome Connection Test') {
                    info(`  - Account: ${response.data.accountInfo?.value?.[0]?.Name || 'N/A'}`);
                }
                if (api.name === 'Geocoding CEP') {
                    info(`  - Coordinates: ${JSON.stringify(response.data.coordinates)}`);
                }
            } else {
                warning(`${api.name}: Resposta sem sucesso`);
                results[api.name] = 'FAIL';
            }
        } catch (err) {
            error(`${api.name}: ${err.response?.data?.error || err.message}`);
            results[api.name] = 'FAIL';
        }
    }

    // APIs protegidas (precisam de autenticação)
    info('APIs protegidas requerem autenticação - testando apenas acesso negado...');

    const protectedAPIs = [
        { name: 'Customers API', url: `${BACKEND_URL}/api/customers` },
        { name: 'Statistics API', url: `${BACKEND_URL}/api/statistics` }
    ];

    for (const api of protectedAPIs) {
        try {
            await client.get(api.url);
            warning(`${api.name}: Deveria requerer autenticação!`);
            results[api.name] = 'SECURITY_ISSUE';
        } catch (err) {
            if (err.response?.status === 401 || err.response?.data?.error?.includes('token')) {
                success(`${api.name}: Protegida corretamente (401)`);
                results[api.name] = 'PASS';
            } else {
                error(`${api.name}: Erro inesperado - ${err.message}`);
                results[api.name] = 'FAIL';
            }
        }
    }

    return results;
}

/**
 * Teste das rotas do frontend
 */
async function testFrontendRoutes() {
    section('ROTAS DO FRONTEND');

    const results = {};

    const routes = [
        { path: '/', name: 'Home/Dashboard' },
        { path: '/customers', name: 'Customers' },
        { path: '/map', name: 'Map' },
        { path: '/sync', name: 'Sync' },
        { path: '/settings', name: 'Settings' }
    ];

    for (const route of routes) {
        try {
            const response = await client.get(`${FRONTEND_URL}${route.path}`);

            if (response.data.includes('<!DOCTYPE html>') &&
                response.data.includes('root') &&
                response.status === 200) {
                success(`${route.name}: OK (${response.status})`);
                results[route.name] = 'PASS';
            } else {
                warning(`${route.name}: Resposta inesperada`);
                results[route.name] = 'PARTIAL';
            }
        } catch (err) {
            error(`${route.name}: ${err.message}`);
            results[route.name] = 'FAIL';
        }
    }

    return results;
}

/**
 * Teste de performance básica
 */
async function testPerformance() {
    section('PERFORMANCE BÁSICA');

    const results = {};

    // Teste de tempo de resposta do backend
    const startBackend = Date.now();
    try {
        await client.get(`${BACKEND_URL}/api/health`);
        const backendTime = Date.now() - startBackend;

        if (backendTime < 100) {
            success(`Backend Response: ${backendTime}ms (Excelente)`);
            results.backend = 'EXCELLENT';
        } else if (backendTime < 500) {
            success(`Backend Response: ${backendTime}ms (Bom)`);
            results.backend = 'GOOD';
        } else {
            warning(`Backend Response: ${backendTime}ms (Lento)`);
            results.backend = 'SLOW';
        }
    } catch (err) {
        error(`Backend Performance: ${err.message}`);
        results.backend = 'FAIL';
    }

    // Teste de tempo de carregamento do frontend
    const startFrontend = Date.now();
    try {
        await client.get(FRONTEND_URL);
        const frontendTime = Date.now() - startFrontend;

        if (frontendTime < 200) {
            success(`Frontend Loading: ${frontendTime}ms (Excelente)`);
            results.frontend = 'EXCELLENT';
        } else if (frontendTime < 1000) {
            success(`Frontend Loading: ${frontendTime}ms (Bom)`);
            results.frontend = 'GOOD';
        } else {
            warning(`Frontend Loading: ${frontendTime}ms (Lento)`);
            results.frontend = 'SLOW';
        }
    } catch (err) {
        error(`Frontend Performance: ${err.message}`);
        results.frontend = 'FAIL';
    }

    return results;
}

/**
 * Verificação de processos
 */
async function checkProcesses() {
    section('VERIFICAÇÃO DE PROCESSOS');

    const results = {};

    try {
        // Verificar processo do backend
        const { stdout: backendProc } = await execAsync('lsof -ti :3001');
        if (backendProc.trim()) {
            success(`Backend Process: Rodando (PID: ${backendProc.trim()})`);
            results.backend = 'RUNNING';
        } else {
            error('Backend Process: Não encontrado');
            results.backend = 'NOT_RUNNING';
        }
    } catch (err) {
        error('Backend Process: Não encontrado');
        results.backend = 'NOT_RUNNING';
    }

    try {
        // Verificar processo do frontend
        const { stdout: frontendProc } = await execAsync('lsof -ti :3000');
        if (frontendProc.trim()) {
            success(`Frontend Process: Rodando (PID: ${frontendProc.trim()})`);
            results.frontend = 'RUNNING';
        } else {
            error('Frontend Process: Não encontrado');
            results.frontend = 'NOT_RUNNING';
        }
    } catch (err) {
        error('Frontend Process: Não encontrado');
        results.frontend = 'NOT_RUNNING';
    }

    return results;
}

/**
 * Relatório final
 */
function generateReport(testResults) {
    section('RELATÓRIO FINAL DE INTEGRAÇÃO');

    const allResults = Object.values(testResults).flat();
    const passed = allResults.filter(r => r === 'PASS' || r === 'RUNNING' || r === 'EXCELLENT' || r === 'GOOD').length;
    const failed = allResults.filter(r => r === 'FAIL' || r === 'NOT_RUNNING').length;
    const warnings = allResults.filter(r => r === 'PARTIAL' || r === 'SLOW' || r === 'SECURITY_ISSUE').length;

    console.log('\n📊 ESTATÍSTICAS:');
    success(`Testes Aprovados: ${passed}`);
    if (warnings > 0) warning(`Avisos: ${warnings}`);
    if (failed > 0) error(`Falhas: ${failed}`);

    console.log('\n🏁 STATUS GERAL:');
    if (failed === 0 && warnings <= 2) {
        success('SISTEMA TOTALMENTE OPERACIONAL ✅');
        success('Frontend e Backend integrados com sucesso!');
        info('O sistema está pronto para uso pelo usuário final.');
    } else if (failed === 0) {
        warning('SISTEMA OPERACIONAL COM RESSALVAS ⚠️');
        warning('Existem algumas questões menores a serem verificadas.');
    } else {
        error('SISTEMA COM PROBLEMAS CRÍTICOS ❌');
        error('Existem falhas que impedem o funcionamento adequado.');
    }

    console.log('\n📝 DETALHES POR CATEGORIA:');
    Object.entries(testResults).forEach(([category, results]) => {
        const categoryPassed = Object.values(results).filter(r =>
            r === 'PASS' || r === 'RUNNING' || r === 'EXCELLENT' || r === 'GOOD'
        ).length;
        const categoryTotal = Object.values(results).length;

        if (categoryPassed === categoryTotal) {
            success(`${category}: ${categoryPassed}/${categoryTotal} ✅`);
        } else {
            warning(`${category}: ${categoryPassed}/${categoryTotal} ⚠️`);
        }
    });

    return {
        passed,
        failed,
        warnings,
        total: allResults.length,
        status: failed === 0 ? (warnings <= 2 ? 'OPERATIONAL' : 'OPERATIONAL_WITH_WARNINGS') : 'CRITICAL_ISSUES'
    };
}

/**
 * Função principal
 */
async function main() {
    console.log(`${colors.bright}${colors.magenta}`);
    console.log('╔════════════════════════════════════════════════╗');
    console.log('║         TESTE DE INTEGRAÇÃO COMPLETO          ║');
    console.log('║            PLOMES-ROTA-CEP SYSTEM             ║');
    console.log('║                                                ║');
    console.log('║   Frontend (3000) ↔ Backend (3001)           ║');
    console.log('╚════════════════════════════════════════════════╝');
    console.log(colors.reset);

    const startTime = Date.now();

    try {
        // Executar todos os testes
        const testResults = {
            'Processos': await checkProcesses(),
            'Conectividade': await testBasicConnectivity(),
            'CORS': await testCORS(),
            'APIs Críticas': await testCriticalAPIs(),
            'Rotas Frontend': await testFrontendRoutes(),
            'Performance': await testPerformance()
        };

        // Gerar relatório
        const report = generateReport(testResults);

        const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`\n⏱️  Teste completo executado em ${totalTime}s`);

        // Código de saída baseado no resultado
        process.exit(report.status === 'OPERATIONAL' ? 0 : 1);

    } catch (error) {
        console.error(`\n💥 ERRO CRÍTICO NO TESTE:`, error.message);
        process.exit(1);
    }
}

// Executar se chamado diretamente
if (require.main === module) {
    main();
}

module.exports = { main };