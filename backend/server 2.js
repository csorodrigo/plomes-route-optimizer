require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const packageJson = require('../package.json');

// Version and deployment info logging
console.log('\n🚀 ========================================');
console.log(`📌 App Version: ${packageJson.version}`);
console.log(`📅 Build Date: ${new Date().toISOString()}`);
console.log(`🔨 Environment: ${process.env.NODE_ENV}`);
console.log(`🔖 Git Commit: ${process.env.RAILWAY_GIT_COMMIT_SHA || 'local-dev'}`);
console.log(`🆔 Deployment ID: ${process.env.RAILWAY_DEPLOYMENT_ID || 'local'}`);
console.log(`🌐 Railway Domain: ${process.env.RAILWAY_PUBLIC_DOMAIN || 'localhost'}`);
console.log('🚀 ========================================\n');

// Auto-fix database on startup
const checkAndFixDatabase = require('./auto-fix-database');

// Services
const DatabaseService = require('./services/sync/database-service');
const PloomeService = require('./services/sync/ploome-service');
const GeocodingService = require('./services/geocoding/geocoding-service');
const GeocodingQueue = require('./services/geocoding/geocoding-queue');
const RouteOptimizer = require('./services/route/route-optimizer');

// Auth Services
const AuthService = require('./services/auth/auth-service');
const AuthMiddleware = require('./middleware/auth-middleware');
const AuthRoutes = require('./routes/auth-routes');

// Initialize Express
const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));

// Auth middleware setup (will be initialized after services)
const setupAuthMiddleware = () => {
    if (authMiddleware) {
        app.use(authMiddleware.securityHeaders);
        app.use(authMiddleware.applyGeneralRateLimit());
    }
};

// CORS configuration - corrigido para produção
app.use(cors({
    origin: function (origin, callback) {
        console.log('🌐 CORS Origin check:', origin);
        
        // Em produção, permitir a própria aplicação e requisições same-origin
        if (process.env.NODE_ENV === 'production') {
            // Lista de origens permitidas em produção
            const allowedProductionOrigins = [
                'https://plomes-route-app-production.up.railway.app',
                'https://plomes-rota-cep-production.up.railway.app', // Caso o nome seja diferente
                'https://web-production-*.up.railway.app' // Pattern do Railway
            ];
            
            // Permitir requisições sem origin (same-origin, server-to-server, mobile apps)
            if (!origin) {
                console.log('✅ CORS: No origin (same-origin request)');
                callback(null, true);
                return;
            }
            
            // Verificar se é uma origem permitida ou qualquer HTTPS do Railway
            if (allowedProductionOrigins.some(allowed => origin === allowed) || 
                origin.includes('.up.railway.app') ||
                origin.startsWith('https://')) {
                console.log('✅ CORS: Production origin allowed:', origin);
                callback(null, true);
            } else {
                console.log('❌ CORS: Production origin rejected:', origin);
                callback(new Error('Not allowed by CORS'));
            }
        } else {
            // Em desenvolvimento
            const allowedOrigins = [
                'http://localhost:3000',
                'http://localhost:3001',
                'http://127.0.0.1:3000',
                'http://127.0.0.1:3001'
            ];
            
            if (!origin || allowedOrigins.indexOf(origin) !== -1) {
                console.log('✅ CORS: Development origin allowed:', origin);
                callback(null, true);
            } else {
                console.log('❌ CORS: Development origin rejected:', origin);
                callback(new Error('Not allowed by CORS'));
            }
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Origin', 'Accept']
}))

// CRITICAL: Serve static assets FIRST, before everything else
const buildPath = path.join(__dirname, '../frontend/build');
console.log('📁 Setting up static files from:', buildPath);

// Serve static assets with highest priority - MUST come first
app.use('/static', express.static(path.join(buildPath, 'static'), {
    maxAge: '1y',
    etag: true,
    lastModified: true,
    setHeaders: (res, filePath) => {
        // Strong cache-busting for JS and CSS files (hashed filenames)
        if (filePath.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript');
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        } else if (filePath.endsWith('.css')) {
            res.setHeader('Content-Type', 'text/css');
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
        // Add build timestamp for debugging
        res.setHeader('X-Build-Time', new Date().toISOString());
    }
}));

// Serve favicon and other assets
app.use(express.static(buildPath, {
    index: false,
    maxAge: process.env.NODE_ENV === 'production' ? '1h' : '0',
    etag: true,
    lastModified: true,
    setHeaders: (res) => {
        if (process.env.NODE_ENV === 'production') {
            res.setHeader('Cache-Control', 'public, max-age=3600');
        } else {
            res.setHeader('Cache-Control', 'no-cache');
        }
    }
}));

app.use(express.json({ limit: '10mb' }));

// Initialize services
let db, ploomeService, geocodingService, geocodingQueue, routeOptimizer, authService, authMiddleware;

async function initializeServices() {
    try {
        // Database
        db = new DatabaseService();
        await db.initialize();
        console.log('✅ Database initialized');

        // Ploome Service
        ploomeService = new PloomeService(process.env.PLOOME_API_KEY);
        const connectionTest = await ploomeService.testConnection();
        if (!connectionTest) {
            console.warn('⚠️  Ploome connection test failed - check API key');
        }

        // Geocoding Service
        geocodingService = new GeocodingService(db);
        console.log('✅ Geocoding service initialized');

        // Geocoding Queue
        geocodingQueue = new GeocodingQueue(geocodingService, db);
        console.log('✅ Geocoding queue initialized');

        // Route Optimizer
        routeOptimizer = new RouteOptimizer();
        console.log('✅ Route optimizer initialized');

        // Auth Service
        authService = new AuthService(db);
        await authService.initialize();
        console.log('✅ Auth service initialized');

        // Auth Middleware
        authMiddleware = new AuthMiddleware(authService);
        console.log('✅ Auth middleware initialized');

        return true;
    } catch (error) {
        console.error('Failed to initialize services:', error);
        return false;
    }
}

// ===== API ROUTES =====

// Setup auth routes after services are initialized
const setupAuthRoutes = () => {
    if (authService && authMiddleware) {
        const authRoutes = new AuthRoutes(authService, authMiddleware);
        app.use('/api/auth', authRoutes.getRouter());
        console.log('✅ Auth routes configured');
    }
};

// Public routes (no authentication required)

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
            database: db ? 'connected' : 'disconnected',
            ploome: ploomeService ? 'initialized' : 'not initialized',
            auth: authService ? 'initialized' : 'not initialized'
        }
    });
});

// Test Ploome connection - endpoint específico para validar API key
app.get('/api/test-connection', async (req, res) => {
    try {
        console.log('\n=== Testing Ploome API Connection ===');
        
        if (!process.env.PLOOME_API_KEY) {
            return res.status(500).json({
                success: false,
                error: 'PLOOME_API_KEY not found in environment variables',
                solution: 'Verifique se o arquivo .env existe e contém PLOOME_API_KEY'
            });
        }
        
        // Validar formato da API key
        const apiKeyLength = process.env.PLOOME_API_KEY.length;
        console.log(`API Key length: ${apiKeyLength} characters`);
        
        if (apiKeyLength < 50) {
            return res.status(400).json({
                success: false,
                error: 'API key seems too short',
                keyLength: apiKeyLength,
                solution: 'Verifique se a API key está completa no arquivo .env'
            });
        }
        
        // Testar com endpoint Account
        const testResult = await ploomeService.testAccountEndpoint();
        
        if (testResult.success) {
            res.json({
                success: true,
                message: 'Ploome API connection successful',
                accountInfo: testResult.data,
                apiUrl: process.env.PLOOME_API_URL
            });
        } else {
            const errorInfo = {
                success: false,
                error: 'Failed to connect to Ploome API',
                details: testResult.error,
                apiUrl: process.env.PLOOME_API_URL,
                keyPreview: `${process.env.PLOOME_API_KEY.substring(0, 10)}...`,
                solutions: []
            };
            
            // Adicionar soluções baseadas no erro
            if (testResult.error.status === 403) {
                errorInfo.solutions = [
                    '1. Verifique se a API key está correta no arquivo .env',
                    '2. Confirme que o usuário de integração tem permissões adequadas no Ploome',
                    '3. Acesse: Ploome → Administração → Usuários de Integração',
                    '4. Verifique se o usuário está ativo e tem perfil com permissões'
                ];
            } else if (testResult.error.status === 401) {
                errorInfo.solutions = [
                    '1. API key não reconhecida pelo Ploome',
                    '2. Gere uma nova chave no Ploome',
                    '3. Copie a chave completa para o arquivo .env'
                ];
            }
            
            res.status(testResult.error.status || 500).json(errorInfo);
        }
    } catch (error) {
        console.error('Test connection error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// ===== PROTECTED ROUTES (Authentication Required) =====

// Sync customers from Ploome
app.post('/api/sync/customers', 
    (req, res, next) => authMiddleware ? authMiddleware.authenticate(req, res, next) : next(),
    async (req, res) => {
    try {
        console.log('Starting customer sync from Ploome...');
        
        const startTime = Date.now();
        const syncLog = {
            type: 'customer_sync',
            startedAt: new Date().toISOString(),
            fetched: 0,
            updated: 0,
            errors: 0
        };

        // Fetch all customers from Ploome
        const customers = await ploomeService.fetchAllContacts((progress) => {
            console.log(`Progress: ${progress.fetched} customers fetched`);
        });

        syncLog.fetched = customers.length;

        // Save to database
        if (customers.length > 0) {
            const result = await db.upsertCustomersBatch(customers);
            syncLog.updated = result.successCount;
            syncLog.errors = result.errorCount;
        }

        syncLog.completedAt = new Date().toISOString();
        syncLog.status = syncLog.errors === 0 ? 'success' : 'partial';
        
        // Log sync
        await db.logSync(syncLog);

        const duration = (Date.now() - startTime) / 1000;
        
        res.json({
            success: true,
            message: `Synced ${syncLog.updated} customers in ${duration.toFixed(2)}s`,
            details: syncLog
        });
    } catch (error) {
        console.error('Sync error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get all customers
app.get('/api/customers',
    (req, res, next) => authMiddleware ? authMiddleware.authenticate(req, res, next) : next(),
    async (req, res) => {
    try {
        const { lat, lng, radius, status } = req.query;
        
        let customers;
        
        if (lat && lng && radius) {
            // Get customers within radius
            customers = await db.getCustomersByDistance(
                parseFloat(lat),
                parseFloat(lng),
                parseFloat(radius)
            );
        } else {
            // Get customers with coordinates prioritized and filter by "Cliente" tag
            const query = status 
                ? `SELECT * FROM customers WHERE geocoding_status = ? AND tags LIKE '%"Cliente"%'`
                : `SELECT * FROM customers WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND tags LIKE '%"Cliente"%'`;
            
            const rawCustomers = await db.all(query, status ? [status] : []);
            customers = db.parseTags(rawCustomers);
        }

        res.json({
            success: true,
            count: customers.length,
            customers
        });
    } catch (error) {
        console.error('Error fetching customers:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Geocode customers
app.post('/api/geocode/batch',
    (req, res, next) => authMiddleware ? authMiddleware.authenticate(req, res, next) : next(),
    async (req, res) => {
    try {
        const { limit = 100 } = req.body;
        
        // Get customers needing geocoding
        const customers = await db.getCustomersForGeocoding(limit);
        
        if (customers.length === 0) {
            return res.json({
                success: true,
                message: 'No customers need geocoding',
                summary: { total: 0, success: 0, failed: 0 }
            });
        }

        console.log(`Starting geocoding for ${customers.length} customers...`);

        // Geocode in batches
        const result = await geocodingService.geocodeCustomersBatch(
            customers,
            (progress) => {
                console.log(`Geocoding progress: ${progress.current}/${progress.total} (${progress.percentage}%)`);
            }
        );

        res.json({
            success: true,
            message: `Geocoded ${result.summary.success} of ${result.summary.total} customers`,
            summary: result.summary
        });
    } catch (error) {
        console.error('Geocoding error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Start geocoding queue
app.post('/api/geocode/start', async (req, res) => {
    try {
        if (geocodingQueue.processing) {
            return res.json({
                success: true,
                message: 'Geocoding already in progress',
                progress: geocodingQueue.getProgress()
            });
        }

        // Start processing in background
        geocodingQueue.startProcessing().catch(err => {
            console.error('Geocoding queue error:', err);
        });

        res.json({
            success: true,
            message: 'Geocoding started',
            progress: geocodingQueue.getProgress()
        });
    } catch (error) {
        console.error('Error starting geocoding:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get geocoding progress
app.get('/api/geocode/progress', async (req, res) => {
    try {
        const progress = geocodingQueue.getProgress();
        const stats = await db.getGeocodingStats();
        
        res.json({
            success: true,
            processing: geocodingQueue.processing,
            progress,
            stats
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Geocode single address
app.post('/api/geocode/address', async (req, res) => {
    try {
        const { address, cep } = req.body;
        
        if (!address && !cep) {
            return res.status(400).json({
                success: false,
                error: 'Address or CEP required'
            });
        }

        let result;
        let addressInfo = {};
        
        // Detectar se é apenas um CEP
        const input = address || cep;
        const cleanInput = input ? input.replace(/\D/g, '') : '';
        const isCepOnly = cleanInput.length === 8 && /^\d{8}$/.test(cleanInput);
        
        if (isCepOnly) {
            console.log(`Detected CEP: ${cleanInput}`);
            // Usar geocodeByCep para CEPs
            result = await geocodingService.geocodeByCep(cleanInput);
            
            // Buscar informações do endereço
            if (result) {
                const axios = require('axios');
                try {
                    const viacepResponse = await axios.get(`https://viacep.com.br/ws/${cleanInput}/json/`);
                    if (viacepResponse.data && !viacepResponse.data.erro) {
                        addressInfo = {
                            address: [
                                viacepResponse.data.logradouro,
                                viacepResponse.data.bairro,
                                viacepResponse.data.localidade,
                                viacepResponse.data.uf
                            ].filter(Boolean).join(', ')
                        };
                    }
                } catch (e) {
                    console.error('Error fetching address info:', e.message);
                }
            }
        } else {
            // Usar geocodeAddress para endereços completos
            result = await geocodingService.geocodeAddress(address || cep, cep);
        }
        
        if (result) {
            res.json({
                success: true,
                coordinates: result,
                ...addressInfo
            });
        } else {
            res.status(404).json({
                success: false,
                error: 'Could not geocode address'
            });
        }
    } catch (error) {
        console.error('Geocoding error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Geocode CEP endpoint
app.post('/api/geocoding/cep', async (req, res) => {
  try {
    const { cep } = req.body;
    
    if (!cep) {
      return res.status(400).json({
        success: false,
        error: 'CEP required'
      });
    }

    const result = await geocodingService.geocodeByCep(cep);
    
    if (result) {
      // Buscar endereço completo do ViaCEP
      const cepClean = cep.replace(/\D/g, '');
      try {
        const axios = require('axios');
        const viacepResponse = await axios.get(`https://viacep.com.br/ws/${cepClean}/json/`);
        if (viacepResponse.data && !viacepResponse.data.erro) {
          const address = `${viacepResponse.data.logradouro || ''}, ${viacepResponse.data.bairro || ''}, ${viacepResponse.data.localidade} - ${viacepResponse.data.uf}`;
          res.json({
            success: true,
            coordinates: result,
            address: address.trim()
          });
          return;
        }
      } catch (e) {
        // Ignorar erro e retornar apenas coordenadas
      }
      
      res.json({
        success: true,
        coordinates: result,
        address: `CEP ${cep}`
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Could not geocode CEP'
      });
    }
  } catch (error) {
    console.error('CEP geocoding error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Optimize route
app.post('/api/routes/optimize',
    (req, res, next) => authMiddleware ? authMiddleware.authenticate(req, res, next) : next(),
    async (req, res) => {
    try {
        const { origin, waypoints, options = {} } = req.body;
        
        if (!origin || !waypoints) {
            return res.status(400).json({
                success: false,
                error: 'Origin and waypoints required'
            });
        }

        // Optimize the route
        const optimizedRoute = await routeOptimizer.optimize(waypoints, origin, options);
        
        // Save route to database if requested
        if (options.save) {
            await db.saveRoute({
                originCep: origin.cep || null,
                originLat: origin.lat,
                originLng: origin.lng,
                waypoints: waypoints,
                optimizedOrder: optimizedRoute.optimizedOrder,
                totalDistance: optimizedRoute.totalDistance,
                estimatedTime: optimizedRoute.estimatedTime
            });
        }

        res.json({
            success: true,
            route: optimizedRoute
        });
    } catch (error) {
        console.error('Route optimization error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get saved routes
app.get('/api/routes',
    (req, res, next) => authMiddleware ? authMiddleware.authenticate(req, res, next) : next(),
    async (req, res) => {
    try {
        const routes = await db.getRoutes();
        
        res.json({
            success: true,
            count: routes.length,
            routes
        });
    } catch (error) {
        console.error('Error fetching routes:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Debug endpoint for raw Ploome API response
app.get('/api/debug/ploome-raw', async (req, res) => {
    try {
        console.log('🔍 DEBUG: Fetching raw Ploome API data for debugging...');
        
        // Fetch exactly 3 contacts as requested
        const result = await ploomeService.fetchContacts({ 
            skip: 0, 
            top: 3,
            includeAddress: true 
        });
        
        console.log('📋 DEBUG: Raw API Response Structure:');
        console.log('- Total contacts received:', result.value?.length || 0);
        console.log('- Response keys:', Object.keys(result));
        
        if (result.value && result.value.length > 0) {
            const firstContact = result.value[0];
            console.log('📍 DEBUG: First contact all fields:');
            console.log(JSON.stringify(firstContact, null, 2));
            
            // Check specifically for address-related fields
            const addressFields = {};
            Object.keys(firstContact).forEach(key => {
                const lowerKey = key.toLowerCase();
                if (lowerKey.includes('address') || 
                    lowerKey.includes('street') || 
                    lowerKey.includes('zip') || 
                    lowerKey.includes('cep') || 
                    lowerKey.includes('city') || 
                    lowerKey.includes('state') || 
                    lowerKey.includes('neighborhood')) {
                    addressFields[key] = firstContact[key];
                }
            });
            
            console.log('🏠 DEBUG: Address-related fields found:');
            console.log(JSON.stringify(addressFields, null, 2));
        }
        
        res.json({
            success: true,
            message: 'Raw Ploome API response for debugging',
            debugInfo: {
                totalReceived: result.value?.length || 0,
                responseKeys: Object.keys(result),
                requestUrl: `${ploomeService.baseUrl}/Contacts?$top=3&$skip=0&$expand=City`
            },
            rawContacts: result.value || [],
            fullApiResponse: result
        });
        
    } catch (error) {
        console.error('❌ DEBUG: Error fetching raw Ploome data:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// Get statistics
// Debug endpoint to examine raw Ploome API response
app.get('/api/debug/ploome-contacts', async (req, res) => {
    try {
        const ploomeService = new PloomeService(process.env.PLOOME_API_KEY);
        
        // Get skip and top from query params
        const skip = parseInt(req.query.skip) || 0;
        const top = parseInt(req.query.top) || 20;
        
        // Fetch contacts for examination
        const result = await ploomeService.fetchContacts({ skip, top });
        
        // Filter to show contacts with address data if requested
        const showOnlyWithAddresses = req.query.withAddresses === 'true';
        let contactsToShow = result.value || [];
        
        if (showOnlyWithAddresses) {
            contactsToShow = contactsToShow.filter(contact => 
                contact.ZipCode || contact.StreetAddress || contact.City
            );
        }

        res.json({
            success: true,
            message: 'Raw Ploome API response',
            totalReceived: result.value?.length || 0,
            withAddressData: contactsToShow.length,
            contacts: contactsToShow.map(contact => ({
                Id: contact.Id,
                Name: contact.Name,
                ZipCode: contact.ZipCode,
                StreetAddress: contact.StreetAddress,
                StreetAddressNumber: contact.StreetAddressNumber,
                Neighborhood: contact.Neighborhood,
                City: contact.City,
                CityId: contact.CityId,
                State: contact.State,
                StateId: contact.StateId
            })),
            sampleStructure: result.value?.[0] ? {
                fields: Object.keys(result.value[0]).sort(),
                addressFields: {
                    ZipCode: result.value[0].ZipCode,
                    StreetAddress: result.value[0].StreetAddress,
                    StreetAddressNumber: result.value[0].StreetAddressNumber,
                    Neighborhood: result.value[0].Neighborhood,
                    City: result.value[0].City,
                    CityId: result.value[0].CityId,
                    State: result.value[0].State,
                    StateId: result.value[0].StateId
                }
            } : null
        });
    } catch (error) {
        console.error('Debug error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.get('/api/statistics', async (req, res) => {
    try {
        const stats = await db.getStatistics();
        
        res.json({
            success: true,
            statistics: stats
        });
    } catch (error) {
        console.error('Error fetching statistics:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Calculate distance between two points
app.post('/api/distance', (req, res) => {
    try {
        const { from, to } = req.body;
        
        if (!from || !to) {
            return res.status(400).json({
                success: false,
                error: 'From and to coordinates required'
            });
        }

        const distance = geocodingService.calculateDistance(
            from.lat, from.lng,
            to.lat, to.lng
        );

        res.json({
            success: true,
            distance: distance,
            unit: 'km'
        });
    } catch (error) {
        console.error('Distance calculation error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Serve React app for all other routes
app.get('*', (req, res) => {
    // Não servir index.html para rotas da API
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ error: 'API endpoint not found' });
    }
    
    const indexPath = path.join(__dirname, '../frontend/build', 'index.html');
    if (require('fs').existsSync(indexPath)) {
        // Always force fresh index.html to ensure latest build
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.setHeader('X-Build-Hash', process.env.RAILWAY_GIT_COMMIT_SHA || 'local');
        res.setHeader('X-Build-Time', new Date().toISOString());
        res.sendFile(indexPath);
    } else {
        // Em desenvolvimento, instruir a iniciar o frontend
        if (process.env.NODE_ENV !== 'production') {
            res.status(404).json({
                error: 'Frontend not running. Please run: cd frontend && npm start'
            });
        } else {
            // Em produção, erro se não encontrar o build
            res.status(404).json({
                error: 'Frontend build not found',
                message: 'Run "cd frontend && npm run build" to build the frontend',
                mode: process.env.NODE_ENV || 'development'
            });
        }
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({
        success: false,
        error: 'Internal server error'
    });
});

// Start server
async function startServer() {
    // Run database auto-fix BEFORE initializing services
    console.log('🔧 Running database integrity check...');
    await checkAndFixDatabase();
    
    const initialized = await initializeServices();
    
    if (!initialized) {
        console.error('Failed to initialize services. Server not started.');
        process.exit(1);
    }

    // Setup auth routes after services are initialized
    setupAuthRoutes();
    setupAuthMiddleware();

    // Schedule cleanup of expired sessions every hour
    if (authService) {
        const cron = require('node-cron');
        cron.schedule('0 * * * *', async () => {
            await authService.cleanupExpiredSessions();
        });
        console.log('✅ Session cleanup scheduled');
    }

    app.listen(PORT, () => {
        console.log(`\n🚀 Server running on http://localhost:${PORT}`);
        console.log(`\n📋 Mode: ${process.env.NODE_ENV || 'development'}`);
        console.log('\n📝 Available endpoints:');
        console.log('   🔐 Authentication:');
        console.log('      POST /api/auth/login - Login user');
        console.log('      POST /api/auth/register - Register new user');
        console.log('      POST /api/auth/logout - Logout user');
        console.log('      GET  /api/auth/verify - Verify token');
        console.log('      GET  /api/auth/profile - Get user profile');
        console.log('      PUT  /api/auth/profile - Update user profile');
        console.log('      PUT  /api/auth/password - Change password');
        console.log('   🌐 Public:');
        console.log('      GET  /api/test-connection - Test Ploome API connection');
        console.log('      GET  /api/health - System health check');
        console.log('      POST /api/geocode/address - Geocode single address');
        console.log('   🔒 Protected (requires authentication):');
        console.log('      POST /api/sync/customers - Sync customers from Ploome');
        console.log('      GET  /api/customers - Get all customers');
        console.log('      POST /api/geocode/batch - Geocode customers in batch');
        console.log('      POST /api/routes/optimize - Optimize route');
        console.log('      GET  /api/routes - Get saved routes');
        console.log('      GET  /api/statistics - Get system statistics');
        console.log('      POST /api/distance - Calculate distance between points');
        console.log('\n🔧 Quick commands:');
        console.log('   Test API: curl http://localhost:3001/api/test-connection');
        console.log('   Frontend: cd frontend && npm start (run in new terminal)');
        console.log('   Sync data: npm run sync:ploome');
    });
}

startServer();