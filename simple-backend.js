#!/usr/bin/env node

// Simple backend server without complex dependencies
const http = require('http');
const url = require('url');

const PORT = process.env.PORT || 3001;

// Simple response helper
function sendJSON(res, statusCode, data) {
    res.writeHead(statusCode, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': 'http://localhost:3000',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Credentials': 'true'
    });
    res.end(JSON.stringify(data, null, 2));
}

// Handle CORS preflight
function handleCORS(req, res) {
    if (req.method === 'OPTIONS') {
        res.writeHead(200, {
            'Access-Control-Allow-Origin': 'http://localhost:3000',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Allow-Credentials': 'true'
        });
        res.end();
        return true;
    }
    return false;
}

// Parse request body
function parseBody(req) {
    return new Promise((resolve) => {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
                resolve(body ? JSON.parse(body) : {});
            } catch (error) {
                resolve({});
            }
        });
    });
}

// Routes handler
async function handleRequest(req, res) {
    // Handle CORS
    if (handleCORS(req, res)) return;

    const parsedUrl = url.parse(req.url, true);
    const path = parsedUrl.pathname;
    const method = req.method;

    console.log(`${method} ${path}`);

    try {
        // Health check
        if (path === '/api/health' && method === 'GET') {
            return sendJSON(res, 200, {
                status: 'OK',
                message: 'Backend is running',
                timestamp: new Date().toISOString(),
                version: '2.1.4-pt-br',
                environment: process.env.NODE_ENV || 'development',
                uptime: process.uptime(),
                memory: {
                    used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
                    total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
                },
                services: {
                    database: 'Ready',
                    ploome: 'Ready',
                    authentication: 'Ready'
                }
            });
        }

        // Test connection
        if (path === '/api/test-connection' && method === 'GET') {
            return sendJSON(res, 200, {
                status: 'OK',
                message: 'Backend connection successful',
                timestamp: new Date().toISOString(),
                ploome_api_url: process.env.PLOOME_API_URL || 'Not configured',
                ploome_api_key_configured: !!process.env.PLOOME_API_KEY
            });
        }

        // Simple login
        if (path === '/api/auth/login' && method === 'POST') {
            const body = await parseBody(req);

            console.log('📧 Login attempt for:', body.email);

            // Basic validation
            if (!body.email || !body.password) {
                return sendJSON(res, 400, {
                    success: false,
                    error: 'Email and password are required'
                });
            }

            // For demo purposes, accept any email/password combination
            // In production, this would validate against a real database
            const userEmail = body.email.toLowerCase();
            const userName = userEmail.split('@')[0]; // Extract name from email

            return sendJSON(res, 200, {
                success: true,
                token: 'dummy-token-for-testing',
                user: {
                    id: 1,
                    name: userName.charAt(0).toUpperCase() + userName.slice(1), // Capitalize first letter
                    email: userEmail
                }
            });
        }

        // List customers
        if (path === '/api/customers' && method === 'GET') {
            const customers = [
                {
                    id: 1,
                    name: "Cliente Teste 1",
                    email: "cliente1@test.com",
                    city: "São Paulo",
                    state: "SP",
                    address: "Rua das Flores, 123",
                    phone: "(11) 99999-1111",
                    created_at: "2024-01-15T10:30:00.000Z"
                },
                {
                    id: 2,
                    name: "Cliente Teste 2",
                    email: "cliente2@test.com",
                    city: "Rio de Janeiro",
                    state: "RJ",
                    address: "Av. Copacabana, 456",
                    phone: "(21) 99999-2222",
                    created_at: "2024-01-20T14:15:00.000Z"
                },
                {
                    id: 3,
                    name: "Cliente Teste 3",
                    email: "cliente3@test.com",
                    city: "Belo Horizonte",
                    state: "MG",
                    address: "Rua da Liberdade, 789",
                    phone: "(31) 99999-3333",
                    created_at: "2024-02-01T09:45:00.000Z"
                }
            ];

            return sendJSON(res, 200, {
                success: true,
                data: customers,
                total: customers.length,
                timestamp: new Date().toISOString()
            });
        }

        // Statistics
        if (path === '/api/statistics' && method === 'GET') {
            const stats = {
                totalCustomers: 10,
                totalRoutes: 5,
                lastSync: "2024-01-01T12:00:00.000Z",
                activeUsers: 3,
                completedDeliveries: 47,
                pendingDeliveries: 12,
                totalDistance: 1250.5,
                averageDeliveryTime: 45,
                successRate: 94.2,
                monthlyGrowth: 15.3
            };

            return sendJSON(res, 200, {
                success: true,
                data: stats,
                timestamp: new Date().toISOString()
            });
        }

        // CEP Geocoding
        if (path === '/api/geocoding/cep' && method === 'POST') {
            const body = await parseBody(req);
            const { cep } = body;

            if (!cep) {
                return sendJSON(res, 400, {
                    error: 'CEP is required',
                    timestamp: new Date().toISOString()
                });
            }

            // Mock geocoding data
            return sendJSON(res, 200, {
                success: true,
                data: {
                    cep: cep,
                    lat: -23.5505,
                    lng: -46.6333,
                    address: `CEP ${cep}, São Paulo - SP`,
                    city: "São Paulo",
                    state: "SP",
                    district: "Centro"
                },
                timestamp: new Date().toISOString()
            });
        }

        // Default 404
        return sendJSON(res, 404, {
            error: 'Route not found',
            path: path,
            method: method,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error:', error);
        return sendJSON(res, 500, {
            error: 'Internal server error',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
}

// Create server
const server = http.createServer(handleRequest);

// Start server
server.listen(PORT, (err) => {
    if (err) {
        console.error('❌ Failed to start server:', err);
        process.exit(1);
    }

    console.log('\n🎉 ======= SIMPLE BACKEND READY =======');
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📅 Started at: ${new Date().toISOString()}`);
    console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`💾 Memory: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
    console.log('=====================================\n');

    console.log('📝 Available endpoints:');
    console.log(`   GET  /api/health           - Health check`);
    console.log(`   GET  /api/test-connection  - Test connection`);
    console.log(`   POST /api/auth/login       - Simple login`);
    console.log(`   GET  /api/customers        - List customers`);
    console.log(`   GET  /api/statistics       - System statistics`);
    console.log(`   POST /api/geocoding/cep    - Geocode CEP`);
    console.log('');
});

// Graceful shutdown
const gracefulShutdown = () => {
    console.log('\n🔄 Shutting down gracefully...');
    server.close(() => {
        console.log('✅ Server closed gracefully');
        process.exit(0);
    });
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

module.exports = server;