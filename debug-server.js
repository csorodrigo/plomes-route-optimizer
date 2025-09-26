require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

console.log('1. Starting server initialization...');
console.log('   PORT:', process.env.PORT);

// Services
const DatabaseService = require('./backend/services/sync/database-service');
const PloomeService = require('./backend/services/sync/ploome-service');
const GeocodingService = require('./backend/services/geocoding/geocoding-service');
const GeocodingQueue = require('./backend/services/geocoding/geocoding-queue');
const RouteOptimizer = require('./backend/services/route/route-optimizer');

// Initialize Express
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'frontend/build')));

// Initialize services
let db, ploomeService, geocodingService, geocodingQueue, routeOptimizer;

async function initializeServices() {
    try {
        console.log('2. Initializing services...');
        
        // Database
        console.log('3. Initializing database...');
        db = new DatabaseService();
        await db.ensureInitialized();
        console.log('✅ Database initialized');

        // Ploome Service
        console.log('4. Initializing Ploome service...');
        ploomeService = new PloomeService(process.env.PLOOME_API_KEY);
        const connectionTest = await ploomeService.testConnection();
        if (!connectionTest) {
            console.warn('⚠️  Ploome connection test failed - check API key');
        } else {
            console.log('✅ Ploome service initialized');
        }

        // Geocoding Service
        console.log('5. Initializing Geocoding service...');
        geocodingService = new GeocodingService(db);
        console.log('✅ Geocoding service initialized');

        // Geocoding Queue
        console.log('6. Initializing Geocoding queue...');
        geocodingQueue = new GeocodingQueue(geocodingService, db);
        console.log('✅ Geocoding queue initialized');

        // Route Optimizer
        console.log('7. Initializing Route optimizer...');
        routeOptimizer = new RouteOptimizer();
        console.log('✅ Route optimizer initialized');

        return true;
    } catch (error) {
        console.error('❌ Service initialization failed:', error);
        console.error('Stack:', error.stack);
        throw error;
    }
}

// API Routes
app.get('/api/test-connection', async (req, res) => {
    res.json({ 
        message: 'API is running',
        services: {
            database: !!db,
            ploome: !!ploomeService,
            geocoding: !!geocodingService,
            routeOptimizer: !!routeOptimizer
        }
    });
});

app.get('/api/customers', async (req, res) => {
    try {
        const customers = await db.getAllCustomers();
        res.json(customers);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/geocode/progress', async (req, res) => {
    try {
        const progress = await geocodingQueue.getProgress();
        res.json(progress);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Start server
async function startServer() {
    try {
        console.log('8. Starting server initialization process...');
        await initializeServices();
        
        console.log('9. Starting Express server...');
        app.listen(PORT, () => {
            console.log(`✅ Server running on http://localhost:${PORT}`);
            console.log('🚀 All systems operational!');
        });
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

startServer();
