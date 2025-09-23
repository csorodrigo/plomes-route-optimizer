#!/usr/bin/env node

/**
 * Debug script to test frontend route processing
 * This will simulate the exact data flow from backend to frontend
 */

const axios = require('axios');

const BACKEND_URL = 'http://localhost:3001';
const TEST_CREDENTIALS = {
    email: 'teste@teste.com',
    password: 'teste123'
};

async function testFrontendRouteProcessing() {
    console.log('🧪 TESTE DE PROCESSAMENTO DE ROTAS NO FRONTEND');
    console.log('==============================================');

    try {
        // Login and get route data
        console.log('1️⃣ Fazendo login...');
        const loginResponse = await axios.post(`${BACKEND_URL}/api/auth/login`, TEST_CREDENTIALS);
        const token = loginResponse.data.token;
        console.log('✅ Login realizado');

        // Get a real route optimization
        console.log('2️⃣ Obtendo rota real do backend...');
        const routePayload = {
            origin: { lat: -3.7327, lng: -38.5270, address: 'Teste' },
            waypoints: [
                { lat: -3.7350, lng: -38.5280, name: 'Cliente 1', id: 'test1' },
                { lat: -3.7400, lng: -38.5300, name: 'Cliente 2', id: 'test2' },
                { lat: -3.7450, lng: -38.5250, name: 'Cliente 3', id: 'test3' }
            ],
            options: { save: true, useRealRoutes: true, returnToOrigin: true }
        };

        const routeResponse = await axios.post(
            `${BACKEND_URL}/api/routes/optimize`,
            routePayload,
            { headers: { 'Authorization': `Bearer ${token}` } }
        );

        const route = routeResponse.data.route;
        console.log('✅ Rota obtida do backend');

        // Now simulate what the frontend does
        console.log('3️⃣ Simulando processamento do frontend...');

        // This is the exact logic from RouteOptimizer.jsx lines 1687-1784
        console.log('🔍 Verificando estrutura de dados recebida...');
        console.log(`   route exists: ${!!route}`);
        console.log(`   route.waypoints exists: ${!!(route && route.waypoints)}`);
        console.log(`   waypoints length: ${route?.waypoints?.length || 0}`);
        console.log(`   route.realRoute exists: ${!!(route && route.realRoute)}`);
        console.log(`   realRoute.decodedPath exists: ${!!(route?.realRoute?.decodedPath)}`);
        console.log(`   decodedPath length: ${route?.realRoute?.decodedPath?.length || 0}`);

        if (!route || !route.waypoints || route.waypoints.length === 0) {
            console.log('❌ PROBLEMA: Estrutura de rota inválida');
            return;
        }

        let pathCoordinates = [];
        let pathSource = 'none';

        // Priority 1: Use real route decoded path if available
        if (route.realRoute && route.realRoute.decodedPath && Array.isArray(route.realRoute.decodedPath) && route.realRoute.decodedPath.length > 0) {
            pathCoordinates = route.realRoute.decodedPath.map(p => [p.lat, p.lng]);
            pathSource = 'real-route';
            console.log(`✅ Usando rota real com ${pathCoordinates.length} pontos decodificados`);
        }
        // Priority 2: Fallback to waypoints for straight lines
        else if (route.waypoints && Array.isArray(route.waypoints) && route.waypoints.length > 1) {
            pathCoordinates = route.waypoints.map(w => [w.lat, w.lng]);
            pathSource = 'waypoints';
            console.log(`⚠️ Fallback para waypoints com ${pathCoordinates.length} pontos`);
        }

        console.log(`🗺️ Fonte dos pontos: ${pathSource}`);
        console.log(`📊 Total de coordenadas: ${pathCoordinates.length}`);

        if (pathCoordinates.length > 1) {
            // Validate coordinates
            const validCoordinates = pathCoordinates.filter(coord => {
                if (!Array.isArray(coord) || coord.length !== 2) return false;
                const [lat, lng] = coord;
                if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) return false;
                if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return false;
                return true;
            });

            console.log(`✅ Coordenadas válidas: ${validCoordinates.length}/${pathCoordinates.length}`);

            if (validCoordinates.length < 2) {
                console.log('❌ PROBLEMA: Coordenadas insuficientes após validação');
                console.log('   Primeiras coordenadas inválidas:', pathCoordinates.slice(0, 3));
            } else {
                console.log('✅ Polyline pode ser renderizada!');
                console.log(`   Primeiro ponto: [${validCoordinates[0][0]}, ${validCoordinates[0][1]}]`);
                console.log(`   Último ponto: [${validCoordinates[validCoordinates.length-1][0]}, ${validCoordinates[validCoordinates.length-1][1]}]`);

                // Test if this would work with Leaflet Polyline component
                console.log('4️⃣ Teste de compatibilidade com Leaflet...');

                // Simulate Leaflet Polyline props
                const polylineProps = {
                    positions: validCoordinates,
                    color: "#FF0000",
                    weight: 8,
                    opacity: 0.9
                };

                console.log('✅ Props do Polyline:');
                console.log(`   positions: Array(${polylineProps.positions.length})`);
                console.log(`   color: ${polylineProps.color}`);
                console.log(`   weight: ${polylineProps.weight}`);
                console.log(`   opacity: ${polylineProps.opacity}`);

                console.log('');
                console.log('🎉 DIAGNÓSTICO: BACKEND E PROCESSAMENTO OK!');
                console.log('');
                console.log('Se a rota não está aparecendo no frontend, pode ser:');
                console.log('1. ❌ Frontend não está fazendo a requisição de otimização');
                console.log('2. ❌ Estado do React não está sendo atualizado corretamente');
                console.log('3. ❌ Componente Polyline não está sendo renderizado');
                console.log('4. ❌ CSS ou z-index impedindo visualização');
                console.log('5. ❌ MapContainer não está atualizando com os dados');

                console.log('');
                console.log('✅ Para debugging adicional no frontend:');
                console.log('1. Abra DevTools → Console');
                console.log('2. Procure por logs: "🗺️ Route optimization response:"');
                console.log('3. Procure por logs: "🗺️ Using real route polyline with X decoded points"');
                console.log('4. Procure por logs: "🗺️ Rendering polyline with X valid points"');
                console.log('5. Verifique se o componente <Polyline> está sendo renderizado');
            }
        } else {
            console.log('❌ PROBLEMA: Coordenadas insuficientes para gerar polyline');
        }

    } catch (error) {
        console.error('❌ Erro no teste:', error.message);
        if (error.response) {
            console.error('Response:', error.response.data);
        }
    }
}

// Run the test
testFrontendRouteProcessing().catch(console.error);