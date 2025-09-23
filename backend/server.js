// Initialize Express with error handling
let app, server;

// Enhanced error handling and process monitoring
process.on('uncaughtException', (error) => {
    console.error('\n❌ CRITICAL: Uncaught Exception:', error.message);
    console.error('Stack:', error.stack);
    console.error('Process will restart in 3 seconds...');
    setTimeout(() => process.exit(1), 3000);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('\n⚠️  WARNING: Unhandled Promise Rejection:', reason);
    console.error('Promise:', promise);
    // Don't exit for unhandled rejections, but log them
});

process.on('SIGTERM', () => {
    console.log('\n🔄 SIGTERM received, shutting down gracefully...');
    if (server) {
        server.close(() => {
            console.log('✅ Server closed gracefully');
            process.exit(0);
        });
    } else {
        process.exit(0);
    }
});

process.on('SIGINT', () => {
    console.log('\n🔄 SIGINT received, shutting down gracefully...');
    if (server) {
        server.close(() => {
            console.log('✅ Server closed gracefully');
            process.exit(0);
        });
    } else {
        process.exit(0);
    }
});

// Load environment variables with error handling - optional for Railway deployment
try {
    const path = require('path');
    const fs = require('fs');
    const envPath = path.join(__dirname, '../.env');

    if (fs.existsSync(envPath)) {
        require('dotenv').config({ path: envPath });
        console.log('✅ Environment variables loaded from .env file');
    } else {
        console.log('ℹ️  No .env file found - using environment variables directly (Railway mode)');
    }
} catch (error) {
    console.warn('⚠️  Failed to load .env file:', error.message);
    console.log('ℹ️  Continuing with environment variables (Railway deployment mode)');
}

// Validate critical environment variables
function validateEnvironmentVariables() {
    const required = ['PLOOME_API_KEY', 'JWT_SECRET'];
    const warnings = [];
    const missing = [];

    // Check required variables
    for (const envVar of required) {
        if (!process.env[envVar]) {
            missing.push(envVar);
        }
    }

    // Check important but optional variables
    const optional = ['DATABASE_PATH', 'GOOGLE_MAPS_API_KEY', 'POSITIONSTACK_API_KEY'];
    for (const envVar of optional) {
        if (!process.env[envVar]) {
            warnings.push(envVar);
        }
    }

    // Set defaults for Railway
    if (!process.env.NODE_ENV) {
        process.env.NODE_ENV = 'production';
        console.log('ℹ️  NODE_ENV not set, defaulting to production (Railway)');
    }

    if (!process.env.PORT) {
        process.env.PORT = '3001';
        console.log('ℹ️  PORT not set, defaulting to 3001');
    }

    if (!process.env.DATABASE_PATH) {
        // Optimize database path for Railway environment
        if (process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_GIT_COMMIT_SHA) {
            process.env.DATABASE_PATH = '/tmp/customers.db';
            console.log('ℹ️  DATABASE_PATH not set, using Railway optimized path: /tmp/customers.db');
        } else {
            process.env.DATABASE_PATH = './backend/cache/customers.db';
            console.log('ℹ️  DATABASE_PATH not set, using default');
        }
    }

    // Generate JWT secret if missing (for Railway)
    if (!process.env.JWT_SECRET) {
        process.env.JWT_SECRET = require('crypto').randomBytes(64).toString('hex');
        console.log('ℹ️  JWT_SECRET generated automatically for Railway deployment');
    }

    // Log results
    if (missing.length > 0) {
        console.error('❌ Missing critical environment variables:', missing.join(', '));
        console.error('   Set these in Railway dashboard under Variables section');
        return false;
    }

    if (warnings.length > 0) {
        console.warn('⚠️  Optional environment variables not set:', warnings.join(', '));
        console.warn('   Consider setting these for full functionality');
    }

    console.log('✅ Environment validation passed');
    return true;
}

// Validate environment before proceeding
if (!validateEnvironmentVariables()) {
    console.error('\n💀 Environment validation failed!');
    console.error('Please set the required environment variables in Railway dashboard');
    process.exit(1);
}
// Import modules with error handling
let express, cors, path, helmet, packageJson;
try {
    express = require('express');
    cors = require('cors');
    path = require('path');
    helmet = require('helmet');
    packageJson = require('../package.json');
    console.log('✅ Core modules loaded successfully');
} catch (error) {
    console.error('❌ CRITICAL: Failed to load core modules:', error.message);
    console.error('This usually indicates corrupted node_modules. Run:');
    console.error('  rm -rf node_modules package-lock.json');
    console.error('  npm install');
    process.exit(1);
}

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

// Initialize Express with error handling
try {
    app = express();
    console.log('✅ Express app initialized');
} catch (error) {
    console.error('❌ CRITICAL: Failed to initialize Express:', error.message);
    process.exit(1);
}

// CRITICAL: Configure Express trust proxy properly for Railway's proxy setup
if (process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_GIT_COMMIT_SHA) {
    // Railway uses a specific proxy setup - trust only the first proxy
    app.set('trust proxy', 1);
    console.log('✅ Express trust proxy configured for Railway (trust proxy: 1)');
} else {
    // For local development, trust localhost reverse proxies
    app.set('trust proxy', ['loopback', 'linklocal', 'uniquelocal']);
    console.log('✅ Express trust proxy configured for development');
}

const PORT = process.env.PORT || 3001;

// Validate port
if (isNaN(PORT) || PORT < 1 || PORT > 65535) {
    console.error(`❌ CRITICAL: Invalid port ${PORT}`);
    process.exit(1);
}

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
            // Em desenvolvimento - allow all ports from 3000-3010
            const allowedOrigins = [
                'http://localhost:3000',
                'http://localhost:3001',
                'http://localhost:3002',
                'http://localhost:3003',
                'http://localhost:3004',
                'http://localhost:3005',
                'http://localhost:3006',
                'http://localhost:3007',
                'http://localhost:3008',
                'http://localhost:3009',
                'http://localhost:3010',
                'http://127.0.0.1:3000',
                'http://127.0.0.1:3001',
                'http://127.0.0.1:3002',
                'http://127.0.0.1:3003',
                'http://127.0.0.1:3004',
                'http://127.0.0.1:3005',
                'http://127.0.0.1:3006',
                'http://127.0.0.1:3007',
                'http://127.0.0.1:3008',
                'http://127.0.0.1:3009',
                'http://127.0.0.1:3010'
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
const fs = require('fs');

// Check if build folder exists and list contents
if (fs.existsSync(buildPath)) {
    const buildFiles = fs.readdirSync(buildPath);
    console.log('✅ Frontend build found at:', buildPath);
    console.log('   Files:', buildFiles.join(', '));
    
    // Check for static folder
    const staticPath = path.join(buildPath, 'static');
    if (fs.existsSync(staticPath)) {
        const jsPath = path.join(staticPath, 'js');
        if (fs.existsSync(jsPath)) {
            const jsFiles = fs.readdirSync(jsPath).filter(f => f.endsWith('.js'));
            console.log(`   JS bundles: ${jsFiles.length} files`);
        }
    }
} else {
    console.error('❌ CRITICAL: Frontend build not found at', buildPath);
    console.error('   The frontend will not work! Run: cd frontend && npm run build');
}

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

// Initialize services with comprehensive error handling
let db, ploomeService, geocodingService, geocodingQueue, routeOptimizer, authService, authMiddleware;
let authRoutesConfigured = false;

// Lazy initialization for Railway
let isLazyInitialized = false;
let lazyInitPromise = null;

// Lazy database initialization for Railway
async function ensureDatabaseInitialized() {
    if (isLazyInitialized) {
        return;
    }

    if (lazyInitPromise) {
        return lazyInitPromise;
    }

    lazyInitPromise = _initializeDatabaseLazily();
    return lazyInitPromise;
}

// Make ensureDatabaseInitialized available globally for auth routes
global.ensureDatabaseInitialized = ensureDatabaseInitialized;

async function _initializeDatabaseLazily() {
    try {
        console.log('🚀 Lazy initializing database for Railway...');

        if (!db) {
            db = new DatabaseService();
        }

        await db.initialize();
        console.log('✅ Database lazy initialization completed');

        // CRITICAL: Initialize auth service if not already available
        if (!authService && db) {
            console.log('🔐 Lazy initializing auth service...');
            authService = new AuthService(db);
            await authService.initialize();
            console.log('✅ Auth service lazy initialization completed');

            // Also initialize auth middleware if not available
            if (!authMiddleware) {
                authMiddleware = new AuthMiddleware(authService);
                console.log('✅ Auth middleware lazy initialization completed');
            }
        } else if (authService && !authService.isInitialized) {
            await authService.initialize();
            console.log('✅ Auth service lazy initialization completed');
        }

        // Initialize services that depend on database
        if (!geocodingService && db) {
            geocodingService = new GeocodingService(db);
            console.log('✅ Geocoding service initialized');
        }

        if (!geocodingQueue && geocodingService && db) {
            geocodingQueue = new GeocodingQueue(geocodingService, db);
            console.log('✅ Geocoding queue initialized');
        }

        isLazyInitialized = true;

    } catch (error) {
        console.error('❌ Lazy initialization failed:', error);
        lazyInitPromise = null;
        throw error;
    }
}

async function initializeServices() {
    const startTime = Date.now();
    console.log('🔄 Initializing services...');

    try {
        // Skip full database initialization for Railway (lazy loading)
        if (process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_GIT_COMMIT_SHA) {
            console.log('🚂 Railway mode: Database will be initialized lazily');
            // Just create the service instance, don't initialize
            db = new DatabaseService();
        } else {
            // Database with retry logic for local/other environments
            console.log('📊 Initializing database service...');
            db = new DatabaseService();

            let dbRetries = 3;
            while (dbRetries > 0) {
                try {
                    await db.initialize();
                    console.log('✅ Database initialized successfully');
                    break;
                } catch (dbError) {
                    dbRetries--;
                    console.warn(`⚠️  Database init failed, retries left: ${dbRetries}`, dbError.message);
                    if (dbRetries === 0) throw dbError;
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }
            console.log('✅ Database initialization completed');
        }

        // Ploome Service with validation (skip connection test for Railway)
        console.log('🔗 Initializing Ploome service...');
        if (!process.env.PLOOME_API_KEY) {
            console.warn('⚠️  PLOOME_API_KEY not found - Ploome features will be limited');
            ploomeService = null;
        } else {
            try {
                ploomeService = new PloomeService(process.env.PLOOME_API_KEY);

                // Skip connection test for Railway to speed up startup
                if (process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_GIT_COMMIT_SHA) {
                    console.log('🚂 Railway mode: Ploome service created, connection test skipped for faster startup');
                } else {
                    const connectionTest = await Promise.race([
                        ploomeService.testConnection(),
                        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 10000))
                    ]);

                    if (connectionTest) {
                        console.log('✅ Ploome service initialized and connected');
                    } else {
                        console.warn('⚠️  Ploome connection test failed - check API key');
                    }
                }
            } catch (ploomeError) {
                console.warn('⚠️  Ploome service initialization failed:', ploomeError.message);
                ploomeService = null;
            }
        }

        // Initialize geocoding services only if database is available
        if (process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_GIT_COMMIT_SHA) {
            console.log('🚂 Railway mode: Skipping geocoding services (will initialize lazily)');
        } else if (db) {
            // Geocoding Service
            console.log('🌍 Initializing geocoding service...');
            try {
                geocodingService = new GeocodingService(db);
                console.log('✅ Geocoding service initialized');
            } catch (geoError) {
                console.error('❌ Geocoding service failed:', geoError.message);
                throw geoError;
            }

            // Geocoding Queue
            console.log('📋 Initializing geocoding queue...');
            try {
                geocodingQueue = new GeocodingQueue(geocodingService, db);
                console.log('✅ Geocoding queue initialized');
            } catch (queueError) {
                console.error('❌ Geocoding queue failed:', queueError.message);
                throw queueError;
            }
        } else {
            console.log('⚠️  Database not available - skipping geocoding services initialization');
        }

        // Route Optimizer
        console.log('🗺️  Initializing route optimizer...');
        try {
            routeOptimizer = new RouteOptimizer();
            console.log('✅ Route optimizer initialized');
        } catch (routeError) {
            console.error('❌ Route optimizer failed:', routeError.message);
            throw routeError;
        }

        // Auth Service (only if database is available and initialized)
        if (db && (db.isInitialized || process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_GIT_COMMIT_SHA)) {
            console.log('🔐 Initializing auth service...');
            try {
                // For Railway, ensure database is initialized before creating auth service
                if (process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_GIT_COMMIT_SHA) {
                    if (!db.isInitialized) {
                        console.log('🚂 Railway: Initializing database for auth service...');
                        await db.initialize();
                    }
                }

                authService = new AuthService(db);

                // Skip auth initialization for Railway to speed up startup
                if (process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_GIT_COMMIT_SHA) {
                    console.log('🚂 Railway mode: Auth service created, will initialize with database');
                } else {
                    await authService.initialize();
                }
                console.log('✅ Auth service initialized');
            } catch (authError) {
                console.error('❌ Auth service failed:', authError.message);
                throw authError;
            }
        } else {
            console.error('❌ CRITICAL: Cannot initialize Auth service - database not available');
            console.error('   This will cause authentication to fail!');
            // Don't throw error here to allow server to start for debugging
        }

        // Auth Middleware (only if auth service is available)
        if (authService) {
            console.log('🛡️  Initializing auth middleware...');
            try {
                authMiddleware = new AuthMiddleware(authService);
                console.log('✅ Auth middleware initialized');
            } catch (middlewareError) {
                console.error('❌ Auth middleware failed:', middlewareError.message);
                throw middlewareError;
            }
        } else {
            console.warn('⚠️  Auth middleware not initialized - auth service not available');
            console.warn('   Protected routes will not work properly!');
        }

        // Setup auth routes immediately after services are initialized
        console.log('🔐 Configuring authentication routes...');
        setupAuthRoutes();
        setupAuthMiddleware();

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`🎉 All services initialized successfully in ${duration}s`);
        return true;

    } catch (error) {
        console.error('\n❌ CRITICAL: Service initialization failed!');
        console.error('Error:', error.message);
        console.error('Stack:', error.stack);
        console.error('\n🔧 Troubleshooting steps:');
        console.error('1. Check database file permissions');
        console.error('2. Verify .env file exists and is readable');
        console.error('3. Ensure all npm dependencies are installed');
        console.error('4. Check available disk space');
        console.error('5. Review log files for specific errors\n');
        return false;
    }
}

// ===== API ROUTES =====

// Setup auth routes after services are initialized
const setupAuthRoutes = () => {
    console.log('🔍 setupAuthRoutes called');
    console.log('🔍 authService exists:', !!authService);
    console.log('🔍 authMiddleware exists:', !!authMiddleware);
    console.log('🔍 app exists:', !!app);
    console.log('🔍 authRoutesConfigured:', authRoutesConfigured);

    if (authService && authMiddleware && !authRoutesConfigured) {
        console.log('🔍 Creating AuthRoutes instance...');
        const authRoutes = new AuthRoutes(authService, authMiddleware);
        console.log('🔍 AuthRoutes instance created');

        const router = authRoutes.getRouter();
        console.log('🔍 Router obtained:', !!router);

        app.use('/api/auth', router);
        authRoutesConfigured = true;
        console.log('✅ Auth routes configured and mounted to /api/auth');

        // List registered routes for debugging
        console.log('🔍 Registered routes:');
        router.stack.forEach((middleware, index) => {
            if (middleware.route) {
                console.log(`   ${Object.keys(middleware.route.methods).join(', ').toUpperCase()} /api/auth${middleware.route.path}`);
            }
        });
    } else {
        console.log('❌ Auth routes NOT configured - missing dependencies');
        console.log('   authService:', !!authService);
        console.log('   authMiddleware:', !!authMiddleware);
        console.log('   authRoutesConfigured:', authRoutesConfigured);
    }
};

// Public routes (no authentication required)

// Health check
app.get('/api/health', async (req, res) => {
    try {
        const health = {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            version: packageJson.version || '1.0.0',
            uptime: process.uptime(),
            environment: process.env.NODE_ENV || 'development',
            services: {
                database: 'unknown',
                ploome: ploomeService ? 'initialized' : 'not initialized',
                auth: authService ? 'initialized' : 'not initialized'
            }
        };

        // Check database status with timeout
        if (db) {
            try {
                // Quick database check with timeout
                await Promise.race([
                    new Promise(async (resolve) => {
                        if (db.isInitialized) {
                            health.services.database = 'connected';
                        } else {
                            health.services.database = 'initializing';
                        }
                        resolve();
                    }),
                    new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('Database health check timeout')), 2000)
                    )
                ]);
            } catch (dbError) {
                health.services.database = 'error';
                health.database_error = dbError.message;
            }
        } else {
            health.services.database = 'not initialized';
        }

        // Always return 200 for health endpoint (Railway requires this)
        res.status(200).json(health);

    } catch (error) {
        // Even on error, return 200 with error details for Railway
        res.status(200).json({
            status: 'degraded',
            timestamp: new Date().toISOString(),
            error: error.message,
            uptime: process.uptime(),
            services: {
                database: 'error',
                ploome: 'unknown',
                auth: 'unknown'
            }
        });
    }
});

// Version and diagnostics endpoint
app.get('/api/version', (req, res) => {
    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);
    
    res.json({
        app: {
            name: packageJson.name,
            version: packageJson.version,
            description: packageJson.description
        },
        deployment: {
            buildDate: new Date().toISOString(),
            environment: process.env.NODE_ENV,
            nodeVersion: process.version,
            uptime: `${hours}h ${minutes}m ${seconds}s`,
            uptimeSeconds: uptime
        },
        railway: {
            gitCommit: process.env.RAILWAY_GIT_COMMIT_SHA || 'not-available',
            gitBranch: process.env.RAILWAY_GIT_BRANCH || 'not-available',
            deploymentId: process.env.RAILWAY_DEPLOYMENT_ID || 'local',
            projectId: process.env.RAILWAY_PROJECT_ID || 'local',
            serviceId: process.env.RAILWAY_SERVICE_ID || 'local',
            environmentId: process.env.RAILWAY_ENVIRONMENT_ID || 'local',
            domain: process.env.RAILWAY_PUBLIC_DOMAIN || 'localhost'
        },
        features: {
            odataFilter: 'ENABLED v2.1',
            clientTagId: process.env.CLIENT_TAG_ID || '40006184',
            disableOdataFilter: process.env.DISABLE_ODATA_FILTER || 'false'
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
        // Ensure database is initialized for Railway
        await ensureDatabaseInitialized();

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
        // Ensure database is initialized for Railway
        await ensureDatabaseInitialized();

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

// Final attempt to setup auth routes if not already configured
setupAuthRoutes();

// Serve React app for all other routes (but NOT API routes)
app.get('*', (req, res, next) => {
    // Skip this handler for API routes completely - let them 404 naturally if not found
    if (req.path.startsWith('/api/')) {
        return next();
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

// Enhanced error handling middleware
app.use((err, req, res, next) => {
    const timestamp = new Date().toISOString();
    const errorId = Math.random().toString(36).substr(2, 9);

    // Log error with context
    console.error(`\n🚨 ERROR [${errorId}] at ${timestamp}`);
    console.error('Path:', req.path);
    console.error('Method:', req.method);
    console.error('IP:', req.ip || 'unknown');
    console.error('User-Agent:', req.get('User-Agent') || 'unknown');
    console.error('Error:', err.message);
    console.error('Stack:', err.stack);

    // Determine error type and response
    let statusCode = 500;
    let errorMessage = 'Internal server error';
    let shouldRestart = false;

    if (err.code === 'ENOENT') {
        statusCode = 404;
        errorMessage = 'Resource not found';
    } else if (err.code === 'EACCES') {
        statusCode = 403;
        errorMessage = 'Access denied';
    } else if (err.name === 'ValidationError') {
        statusCode = 400;
        errorMessage = 'Validation error';
    } else if (err.name === 'UnauthorizedError') {
        statusCode = 401;
        errorMessage = 'Unauthorized';
    } else if (err.code === 'SQLITE_CORRUPT' || err.message.includes('database')) {
        statusCode = 503;
        errorMessage = 'Database error';
        shouldRestart = true;
    } else if (err.code === 'EMFILE' || err.code === 'ENOMEM') {
        statusCode = 503;
        errorMessage = 'Server resource exhaustion';
        shouldRestart = true;
    }

    // Send response
    res.status(statusCode).json({
        success: false,
        error: errorMessage,
        errorId: errorId,
        timestamp: timestamp,
        ...(process.env.NODE_ENV === 'development' && {
            details: err.message,
            stack: err.stack
        })
    });

    // Schedule restart for critical errors
    if (shouldRestart) {
        console.error(`💀 CRITICAL ERROR - Scheduling server restart in 5 seconds...`);
        setTimeout(() => {
            console.error('🔄 Restarting server due to critical error...');
            process.exit(1);
        }, 5000);
    }
});

// NOTE: Removed API catch-all handler that was intercepting auth routes
// Let individual routes handle 404s naturally

// Enhanced server startup with comprehensive error handling
async function startServer() {
    const serverStartTime = Date.now();
    console.log('\n🚀 ======= SERVER STARTUP SEQUENCE =======');
    console.log(`📅 Startup Time: ${new Date().toISOString()}`);
    console.log(`📍 Working Directory: ${process.cwd()}`);
    console.log(`🔧 Node Version: ${process.version}`);
    console.log(`💾 Memory Usage: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
    console.log('=========================================\n');

    try {
        // Pre-flight checks
        console.log('🔍 Running pre-flight checks...');

        // Check port availability
        const { exec } = require('child_process');
        const portCheck = await new Promise((resolve) => {
            exec(`lsof -ti :${PORT}`, (error, stdout) => {
                if (stdout) {
                    console.warn(`⚠️  Port ${PORT} is already in use by PID: ${stdout.trim()}`);
                    resolve(false);
                } else {
                    console.log(`✅ Port ${PORT} is available`);
                    resolve(true);
                }
            });
        });

        if (!portCheck) {
            console.log('🔄 Attempting to free up the port...');
            await new Promise((resolve) => {
                exec(`lsof -ti :${PORT} | xargs kill -9`, () => {
                    setTimeout(resolve, 2000); // Wait 2s after killing processes
                });
            });
        }

        // Check critical files
        const fs = require('fs');
        const criticalFiles = [
            '../package.json',
            './auto-fix-database.js'
        ];

        // Check for .env file separately (optional for Railway)
        const envPath = require('path').join(__dirname, '../.env');
        if (fs.existsSync(envPath)) {
            console.log('✅ .env file found');
        } else {
            console.log('ℹ️  .env file not found - using Railway environment variables');
        }

        for (const file of criticalFiles) {
            const filePath = require('path').join(__dirname, file);
            if (!fs.existsSync(filePath)) {
                throw new Error(`Critical file missing: ${filePath}`);
            }
        }
        console.log('✅ Critical files check passed');

        // Run database auto-fix with timeout (skip for Railway)
        if (process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_GIT_COMMIT_SHA) {
            console.log('🚂 Railway environment - skipping database auto-fix for faster startup');
            console.log('   Database will be initialized lazily on first request');
        } else {
            console.log('🔧 Running database integrity check...');
            try {
                await Promise.race([
                    checkAndFixDatabase(),
                    new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('Database check timeout')), 30000)
                    )
                ]);
                console.log('✅ Database integrity check completed');
            } catch (dbCheckError) {
                console.warn('⚠️  Database integrity check failed:', dbCheckError.message);
                console.warn('   Continuing startup - database issues may be resolved during initialization');
            }
        }

        // Initialize services with timeout
        console.log('⚙️  Initializing services...');
        const initialized = await Promise.race([
            initializeServices(),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Service initialization timeout')), 60000)
            )
        ]);

        if (!initialized) {
            throw new Error('Service initialization failed');
        }

        // Auth routes configured during service initialization
        console.log('✅ Authentication already configured');

        // Schedule maintenance tasks
        if (authService) {
            const cron = require('node-cron');

            // Cleanup expired sessions every hour
            cron.schedule('0 * * * *', async () => {
                try {
                    await authService.cleanupExpiredSessions();
                    console.log('🧹 Session cleanup completed');
                } catch (error) {
                    console.error('❌ Session cleanup failed:', error.message);
                }
            });

            // Health check every 5 minutes
            cron.schedule('*/5 * * * *', async () => {
                try {
                    const memUsage = process.memoryUsage();
                    const heapMB = Math.round(memUsage.heapUsed / 1024 / 1024);
                    const totalMB = Math.round(memUsage.rss / 1024 / 1024);

                    if (heapMB > 500) { // 500MB threshold
                        console.warn(`⚠️  High memory usage: ${heapMB}MB heap, ${totalMB}MB total`);
                    }

                    // Force garbage collection if available
                    if (global.gc) {
                        global.gc();
                    }
                } catch (error) {
                    console.error('❌ Health check failed:', error.message);
                }
            });

            console.log('✅ Maintenance tasks scheduled');
        }

        // Start HTTP server with error handling
        console.log(`🌐 Starting HTTP server on port ${PORT}...`);

        server = await new Promise((resolve, reject) => {
            const httpServer = app.listen(PORT, (error) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(httpServer);
                }
            });

            httpServer.on('error', (error) => {
                if (error.code === 'EADDRINUSE') {
                    reject(new Error(`Port ${PORT} is already in use`));
                } else {
                    reject(error);
                }
            });
        });

        // Server started successfully
        const startupDuration = ((Date.now() - serverStartTime) / 1000).toFixed(2);
        const pkg = require('../package.json');

        console.log('\n🎉 ======= SERVER STARTED SUCCESSFULLY =======');
        console.log(`🚀 PLOMES-ROUTE-OPTIMIZER v${pkg.version}`);
        console.log(`⏱️  Startup Time: ${startupDuration}s`);
        console.log(`🏃 Mode: ${process.env.NODE_ENV || 'development'}`);
        console.log(`🎯 ODATA FILTER: ACTIVE (Tag ID: 40006184)`);
        console.log(`🗂️  Filtering ~2200 "Cliente" contacts`);
        console.log(`🌐 Server: http://localhost:${PORT}`);
        console.log(`💾 Memory: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
        console.log('===========================================\n');

        console.log('📝 API Endpoints:');
        console.log('🔐 Authentication:');
        console.log('   POST /api/auth/login    - Login user');
        console.log('   POST /api/auth/register - Register new user');
        console.log('   POST /api/auth/logout   - Logout user');
        console.log('   GET  /api/auth/verify   - Verify token');
        console.log('   GET  /api/auth/profile  - Get user profile');
        console.log('🌐 Public:');
        console.log('   GET  /api/health           - System health');
        console.log('   GET  /api/test-connection  - Test Ploome API');
        console.log('   POST /api/geocode/address  - Geocode address');
        console.log('🔒 Protected:');
        console.log('   POST /api/sync/customers   - Sync from Ploome');
        console.log('   GET  /api/customers        - Get customers');
        console.log('   POST /api/geocode/batch    - Batch geocoding');
        console.log('   POST /api/routes/optimize  - Optimize route');
        console.log('   GET  /api/statistics       - Get statistics');

        console.log('\n🛠️  Quick Commands:');
        console.log(`   Health: curl http://localhost:${PORT}/api/health`);
        console.log(`   Test:   curl http://localhost:${PORT}/api/test-connection`);
        console.log('   Frontend: cd frontend && npm start');
        console.log('   Monitor: node process-monitor.js');
        console.log('');

        // Send startup notification
        process.stdout.write('\x07'); // Bell sound

        return server;

    } catch (error) {
        console.error('\n💀 ======= SERVER STARTUP FAILED =======');
        console.error(`❌ Error: ${error.message}`);
        console.error(`📍 Code: ${error.code || 'UNKNOWN'}`);
        console.error(`⏱️  Failed after: ${((Date.now() - serverStartTime) / 1000).toFixed(2)}s`);

        if (error.stack) {
            console.error('\n📋 Stack Trace:');
            console.error(error.stack);
        }

        console.error('\n🔧 Troubleshooting:');
        console.error('1. Check if port is available: lsof -ti :3001');
        console.error('2. Verify dependencies: npm install');
        console.error('3. Check .env file exists and is readable');
        console.error('4. Ensure database directory is writable');
        console.error('5. Try process monitor: node process-monitor.js');
        console.error('==========================================\n');

        // Cleanup on failure
        if (server) {
            try {
                server.close();
            } catch (closeError) {
                console.error('Failed to close server:', closeError.message);
            }
        }

        process.exit(1);
    }
}

startServer();