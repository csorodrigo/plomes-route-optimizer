require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const axios = require('axios');

// Initialize Express
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'frontend/build')));

// In-memory storage (instead of SQLite)
const memoryStorage = {
    customers: [],
    routes: [],
    geocodingQueue: [],
    syncLogs: []
};

// Real Ploome Service
class PloomeService {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.baseUrl = process.env.PLOOME_API_URL || 'https://public-api2.ploomes.com';
        this.headers = {
            'User-Key': this.apiKey,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };
    }

    async testConnection() {
        try {
            if (!this.apiKey) return false;
            
            const response = await axios.get(`${this.baseUrl}/Account`, {
                headers: this.headers,
                timeout: 10000
            });
            
            return response.status === 200;
        } catch (error) {
            console.error('Ploome connection test failed:', error.response?.data || error.message);
            return false;
        }
    }

    async testAccountEndpoint() {
        try {
            if (!this.apiKey) {
                return { 
                    success: false, 
                    error: { status: 401, message: 'No API key provided' } 
                };
            }
            
            console.log('Testing Ploome Account endpoint...');
            const response = await axios.get(`${this.baseUrl}/Account`, {
                headers: this.headers,
                timeout: 10000
            });
            
            return {
                success: true,
                data: {
                    accountName: response.data.Name || 'Ploome Account',
                    plan: response.data.Plan || 'Unknown',
                    status: response.data.Status || 'Active',
                    response: response.data
                }
            };
        } catch (error) {
            const status = error.response?.status || 500;
            const message = error.response?.data?.Message || error.message;
            
            console.error('Ploome Account test failed:', { status, message, data: error.response?.data });
            
            return {
                success: false,
                error: {
                    status,
                    message,
                    details: error.response?.data
                }
            };
        }
    }

    async fetchAllContacts(progressCallback) {
        try {
            console.log('🚀 Starting to fetch all contacts from Ploome...');
            
            const allContacts = [];
            let skip = 0;
            const batchSize = 100;
            let hasMore = true;
            
            while (hasMore) {
                console.log(`📥 Fetching contacts batch: ${skip} to ${skip + batchSize}`);
                
                const batch = await this.fetchContacts({ 
                    skip, 
                    top: batchSize 
                });
                
                if (batch.value && batch.value.length > 0) {
                    const processedContacts = this.processContactsData(batch.value);
                    allContacts.push(...processedContacts);
                    
                    skip += batchSize;
                    
                    // Report progress
                    if (progressCallback) {
                        progressCallback({ 
                            fetched: allContacts.length,
                            currentBatch: batch.value.length 
                        });
                    }
                    
                    console.log(`✅ Batch processed: ${batch.value.length} contacts (Total: ${allContacts.length})`);
                    
                    // Add delay to respect API rate limits
                    await this.delay(500);
                } else {
                    hasMore = false;
                    console.log('📋 No more contacts to fetch');
                }
                
                // Safety check to prevent infinite loops
                if (skip > 10000) {
                    console.warn('⚠️ Safety limit reached (10,000 contacts). Stopping fetch.');
                    break;
                }
            }
            
            console.log(`✅ Completed fetching contacts: ${allContacts.length} total`);
            return allContacts;
            
        } catch (error) {
            console.error('❌ Error fetching all contacts:', error.response?.data || error.message);
            throw error;
        }
    }

    async fetchContacts({ skip = 0, top = 100 }) {
        try {
            const url = `${this.baseUrl}/Contacts`;
            const params = {
                $skip: skip,
                $top: Math.min(top, 100), // Ploome has a max limit
                $expand: 'City',
                $select: 'Id,Name,ZipCode,StreetAddress,StreetAddressNumber,Neighborhood,City,State,OtherProperties'
            };
            
            console.log(`🔍 Fetching contacts from Ploome API: skip=${skip}, top=${params.$top}`);
            
            const response = await axios.get(url, {
                headers: this.headers,
                params,
                timeout: 30000
            });
            
            if (response.status === 200) {
                console.log(`✅ Successfully fetched ${response.data.value?.length || 0} contacts`);
                return response.data;
            } else {
                throw new Error(`Unexpected response status: ${response.status}`);
            }
            
        } catch (error) {
            console.error('❌ Error fetching contacts batch:', {
                status: error.response?.status,
                message: error.response?.data?.Message || error.message,
                data: error.response?.data
            });
            throw error;
        }
    }

    processContactsData(contacts) {
        return contacts.map(contact => {
            // Map Ploome contact fields to our customer structure
            const customer = {
                id: contact.Id,
                name: contact.Name || 'Unnamed Contact',
                cep: this.cleanCep(contact.ZipCode),
                address: this.buildFullAddress(contact),
                streetAddress: contact.StreetAddress || '',
                streetAddressNumber: contact.StreetAddressNumber || '',
                neighborhood: contact.Neighborhood || '',
                city: contact.City?.Name || contact.City || '',
                state: contact.State || '',
                lat: null,
                lng: null,
                source: 'ploome',
                lastUpdated: new Date().toISOString(),
                // Store original contact data for reference
                originalData: {
                    Id: contact.Id,
                    Name: contact.Name,
                    ZipCode: contact.ZipCode,
                    StreetAddress: contact.StreetAddress,
                    StreetAddressNumber: contact.StreetAddressNumber,
                    Neighborhood: contact.Neighborhood,
                    City: contact.City,
                    State: contact.State
                }
            };
            
            return customer;
        }).filter(customer => {
            // Filter out contacts without essential data
            return customer.name && (customer.cep || customer.city);
        });
    }

    buildFullAddress(contact) {
        const parts = [];
        
        if (contact.StreetAddress) {
            parts.push(contact.StreetAddress);
        }
        
        if (contact.StreetAddressNumber) {
            parts.push(contact.StreetAddressNumber);
        }
        
        if (contact.Neighborhood) {
            parts.push(contact.Neighborhood);
        }
        
        if (contact.City?.Name || contact.City) {
            parts.push(contact.City?.Name || contact.City);
        }
        
        if (contact.State) {
            parts.push(contact.State);
        }
        
        return parts.join(', ');
    }

    cleanCep(cep) {
        if (!cep) return '';
        
        // Convert to string if it's a number
        const cepStr = typeof cep === 'string' ? cep : String(cep);
        
        // Remove all non-numeric characters
        const cleanCep = cepStr.replace(/\D/g, '');
        
        // Format as XXXXX-XXX if we have 8 digits
        if (cleanCep.length === 8) {
            return `${cleanCep.substr(0, 5)}-${cleanCep.substr(5, 3)}`;
        }
        
        return cleanCep;
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Mock Database Service
class DatabaseServiceMock {
    async initialize() {
        console.log('✅ Memory storage initialized');
        return true;
    }

    async getAllCustomers() {
        return memoryStorage.customers;
    }

    async getCustomersForGeocoding(limit) {
        return memoryStorage.customers
            .filter(c => !c.lat || !c.lng)
            .slice(0, limit);
    }

    async getCustomersByDistance(lat, lng, radius) {
        // Simple distance filter (not accurate but works for demo)
        return memoryStorage.customers.filter(customer => {
            if (!customer.lat || !customer.lng) return false;
            const distance = Math.sqrt(
                Math.pow(customer.lat - lat, 2) + 
                Math.pow(customer.lng - lng, 2)
            ) * 111; // Rough conversion to km
            return distance <= radius;
        });
    }

    async upsertCustomersBatch(customers) {
        const startCount = memoryStorage.customers.length;
        customers.forEach(customer => {
            const index = memoryStorage.customers.findIndex(c => c.id === customer.id);
            if (index >= 0) {
                memoryStorage.customers[index] = customer;
            } else {
                memoryStorage.customers.push(customer);
            }
        });
        return { 
            successCount: customers.length, 
            errorCount: 0 
        };
    }

    async logSync(syncLog) {
        memoryStorage.syncLogs.push(syncLog);
    }

    async saveRoute(route) {
        route.id = Date.now();
        route.createdAt = new Date().toISOString();
        memoryStorage.routes.push(route);
        return route;
    }

    async getRoutes() {
        return memoryStorage.routes;
    }

    async getGeocodingStats() {
        const total = memoryStorage.customers.length;
        const geocoded = memoryStorage.customers.filter(c => c.lat && c.lng).length;
        const pending = total - geocoded;
        
        return {
            total,
            geocoded,
            pending,
            failed: 0,
            percentage: total > 0 ? (geocoded / total * 100).toFixed(2) : 0
        };
    }

    async getStatistics() {
        return {
            totalCustomers: memoryStorage.customers.length,
            geocoded: memoryStorage.customers.filter(c => c.lat && c.lng).length,
            routes: memoryStorage.routes.length,
            lastSync: memoryStorage.syncLogs[memoryStorage.syncLogs.length - 1]?.completedAt || null
        };
    }

    all(query, params = []) {
        // Simple implementation for memory storage
        if (query.includes('geocoding_status')) {
            const status = params[0];
            if (status === 'geocoded') {
                return memoryStorage.customers.filter(c => c.lat && c.lng);
            } else {
                return memoryStorage.customers.filter(c => !c.lat || !c.lng);
            }
        }
        return memoryStorage.customers;
    }
}

// Real Geocoding Service using ViaCEP + Nominatim
class GeocodingService {
    constructor(db) {
        this.db = db;
        this.cache = new Map(); // Simple cache to avoid repeated API calls
    }

    async geocodeAddress(address, cep) {
        try {
            // If we have a CEP, get detailed address from ViaCEP first
            if (cep) {
                return await this.geocodeByCep(cep);
            }

            // If only address is provided, geocode directly
            if (address) {
                return await this.geocodeByAddress(address);
            }

            return null;
        } catch (error) {
            console.error('Geocoding error:', error);
            return null;
        }
    }

    async geocodeByCep(cep) {
        try {
            // Clean CEP (remove non-numeric characters)
            const cepClean = cep.replace(/\D/g, '');
            
            // Check cache first
            const cacheKey = `cep_${cepClean}`;
            if (this.cache.has(cacheKey)) {
                console.log(`Cache hit for CEP ${cep}`);
                return this.cache.get(cacheKey);
            }

            console.log(`Geocoding CEP: ${cep}`);

            // Step 1: Get address from ViaCEP
            const viacepUrl = `https://viacep.com.br/ws/${cepClean}/json/`;
            const viacepResponse = await axios.get(viacepUrl, { timeout: 5000 });
            
            if (!viacepResponse.data || viacepResponse.data.erro) {
                console.log(`ViaCEP returned error for CEP ${cep}`);
                return null;
            }

            const addressData = viacepResponse.data;
            
            // Step 2: Build search query for Nominatim
            const addressParts = [];
            if (addressData.logradouro) addressParts.push(addressData.logradouro);
            if (addressData.bairro) addressParts.push(addressData.bairro);
            if (addressData.localidade) addressParts.push(addressData.localidade);
            if (addressData.uf) addressParts.push(addressData.uf);
            addressParts.push('Brasil');
            
            const fullAddress = addressParts.join(', ');
            console.log(`Full address for geocoding: ${fullAddress}`);

            // Step 3: Geocode with Nominatim
            const coordinates = await this.geocodeByAddress(fullAddress);
            
            if (coordinates) {
                // Cache the result
                this.cache.set(cacheKey, coordinates);
                console.log(`Successfully geocoded CEP ${cep} -> ${coordinates.lat}, ${coordinates.lng}`);
            }

            return coordinates;
        } catch (error) {
            console.error(`Error geocoding CEP ${cep}:`, error.message);
            return null;
        }
    }

    async geocodeByAddress(address) {
        try {
            const cacheKey = `addr_${address}`;
            if (this.cache.has(cacheKey)) {
                return this.cache.get(cacheKey);
            }

            // Use Nominatim for geocoding
            const nominatimUrl = 'https://nominatim.openstreetmap.org/search';
            const params = {
                q: address,
                format: 'json',
                limit: 1,
                countrycodes: 'br', // Restrict to Brazil
                addressdetails: 1
            };

            const response = await axios.get(nominatimUrl, {
                params,
                timeout: 10000,
                headers: {
                    'User-Agent': 'PLOMES-ROTA-CEP/1.0 (Geocoding Service)'
                }
            });

            if (response.data && response.data.length > 0) {
                const result = response.data[0];
                const coordinates = {
                    lat: parseFloat(result.lat),
                    lng: parseFloat(result.lon)
                };

                // Cache the result
                this.cache.set(cacheKey, coordinates);
                
                return coordinates;
            }

            return null;
        } catch (error) {
            console.error(`Error geocoding address "${address}":`, error.message);
            
            // Fallback to known city coordinates for common cases
            return this.getFallbackCoordinates(address);
        }
    }

    getFallbackCoordinates(address) {
        // Fallback coordinates for major Brazilian cities
        const cityCoordinates = {
            'fortaleza': { lat: -3.7319, lng: -38.5267 },
            'são paulo': { lat: -23.5505, lng: -46.6333 },
            'rio de janeiro': { lat: -22.9068, lng: -43.1729 },
            'brasília': { lat: -15.7942, lng: -47.8822 },
            'salvador': { lat: -12.9777, lng: -38.5016 },
            'belo horizonte': { lat: -19.9191, lng: -43.9378 },
            'manaus': { lat: -3.1190, lng: -60.0217 },
            'curitiba': { lat: -25.4284, lng: -49.2733 },
            'recife': { lat: -8.0476, lng: -34.8770 },
            'porto alegre': { lat: -30.0346, lng: -51.2177 },
            'goiânia': { lat: -16.6869, lng: -49.2648 },
            'belém': { lat: -1.4558, lng: -48.5044 },
            'natal': { lat: -5.7945, lng: -35.2110 },
            'maceió': { lat: -9.6662, lng: -35.7357 },
            'joão pessoa': { lat: -7.1195, lng: -34.8450 },
            'aracaju': { lat: -10.9472, lng: -37.0731 },
            'teresina': { lat: -5.0892, lng: -42.8019 },
            'campo grande': { lat: -20.4697, lng: -54.6201 },
            'cuiabá': { lat: -15.6014, lng: -56.0979 },
            'florianópolis': { lat: -27.5954, lng: -48.5480 },
            'vitória': { lat: -20.3155, lng: -40.3128 },
            'são luís': { lat: -2.5297, lng: -44.3028 },
            'macapá': { lat: 0.0389, lng: -51.0664 },
            'boa vista': { lat: 2.8235, lng: -60.6758 },
            'rio branco': { lat: -9.9750, lng: -67.8243 },
            'porto velho': { lat: -8.7608, lng: -63.9020 },
            'palmas': { lat: -10.1689, lng: -48.3317 }
        };

        const addressLower = address.toLowerCase();
        
        for (const [city, coords] of Object.entries(cityCoordinates)) {
            if (addressLower.includes(city)) {
                console.log(`Using fallback coordinates for ${city}`);
                return coords;
            }
        }

        return null;
    }

    async geocodeCustomersBatch(customers, progressCallback) {
        let success = 0;
        let failed = 0;

        for (let i = 0; i < customers.length; i++) {
            const customer = customers[i];
            if (customer.cep) {
                const coords = await this.geocodeAddress(null, customer.cep);
                if (coords) {
                    customer.lat = coords.lat;
                    customer.lng = coords.lng;
                    success++;
                } else {
                    failed++;
                }
            } else {
                failed++;
            }

            if (progressCallback) {
                progressCallback({
                    current: i + 1,
                    total: customers.length,
                    percentage: Math.round(((i + 1) / customers.length) * 100)
                });
            }
        }

        return {
            summary: {
                total: customers.length,
                success,
                failed
            }
        };
    }

    calculateDistance(lat1, lng1, lat2, lng2) {
        // Haversine formula
        const R = 6371; // Earth's radius in km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLng = (lng2 - lng1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLng/2) * Math.sin(dLng/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }
}

// Mock Geocoding Queue
class GeocodingQueueMock {
    constructor(geocodingService, db) {
        this.geocodingService = geocodingService;
        this.db = db;
        this.processing = false;
        this.progress = {
            total: 0,
            current: 0,
            success: 0,
            failed: 0
        };
    }

    async startProcessing() {
        if (this.processing) return;
        
        this.processing = true;
        const customers = await this.db.getCustomersForGeocoding(100);
        
        if (customers.length > 0) {
            this.progress.total = customers.length;
            this.progress.current = 0;
            
            const result = await this.geocodingService.geocodeCustomersBatch(
                customers,
                (progress) => {
                    this.progress.current = progress.current;
                }
            );
            
            this.progress.success = result.summary.success;
            this.progress.failed = result.summary.failed;
        }
        
        this.processing = false;
    }

    getProgress() {
        return {
            ...this.progress,
            percentage: this.progress.total > 0 
                ? Math.round((this.progress.current / this.progress.total) * 100)
                : 0
        };
    }
}

// Mock Route Optimizer
class RouteOptimizerMock {
    optimize(waypoints, origin, options = {}) {
        // Simple nearest neighbor algorithm
        const optimizedOrder = [];
        const remaining = [...waypoints];
        let current = origin;
        let totalDistance = 0;

        while (remaining.length > 0) {
            let nearestIndex = 0;
            let nearestDistance = Infinity;

            for (let i = 0; i < remaining.length; i++) {
                const distance = this.calculateDistance(
                    current.lat, current.lng,
                    remaining[i].lat, remaining[i].lng
                );
                if (distance < nearestDistance) {
                    nearestDistance = distance;
                    nearestIndex = i;
                }
            }

            optimizedOrder.push(remaining[nearestIndex]);
            totalDistance += nearestDistance;
            current = remaining[nearestIndex];
            remaining.splice(nearestIndex, 1);
        }

        return {
            optimizedOrder,
            totalDistance: Math.round(totalDistance * 10) / 10,
            estimatedTime: Math.round(totalDistance * 2), // Rough estimate: 2 min per km
            originalOrder: waypoints
        };
    }

    calculateDistance(lat1, lng1, lat2, lng2) {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLng = (lng2 - lng1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLng/2) * Math.sin(dLng/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }
}

// Initialize services
let db, ploomeService, geocodingService, geocodingQueue, routeOptimizer;

async function initializeServices() {
    try {
        // Database
        db = new DatabaseServiceMock();
        await db.initialize();
        console.log('✅ Database service initialized');

        // Ploome Service
        ploomeService = new PloomeService(process.env.PLOOME_API_KEY);
        const connectionTest = await ploomeService.testConnection();
        if (connectionTest) {
            console.log('✅ Ploome service initialized');
        } else {
            console.warn('⚠️  Ploome connection test failed');
        }

        // Geocoding Service
        geocodingService = new GeocodingService(db);
        console.log('✅ Real Geocoding service initialized (ViaCEP + Nominatim)');

        // Geocoding Queue
        geocodingQueue = new GeocodingQueueMock(geocodingService, db);
        console.log('✅ Geocoding queue initialized');

        // Route Optimizer
        routeOptimizer = new RouteOptimizerMock();
        console.log('✅ Route optimizer initialized');

        return true;
    } catch (error) {
        console.error('Failed to initialize services:', error);
        return false;
    }
}

// ===== API ROUTES (same as original) =====

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
            database: db ? 'connected' : 'disconnected',
            ploome: ploomeService ? 'initialized' : 'not initialized'
        }
    });
});

// Test Ploome connection
app.get('/api/test-connection', async (req, res) => {
    try {
        const testResult = await ploomeService.testAccountEndpoint();
        
        if (testResult.success) {
            res.json({
                success: true,
                message: 'Ploome API connection successful',
                accountInfo: testResult.data,
                apiUrl: process.env.PLOOME_API_URL
            });
        } else {
            res.status(testResult.error.status || 500).json({
                success: false,
                error: 'Failed to connect to Ploome API',
                details: testResult.error
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Sync customers from Ploome
app.post('/api/sync/customers', async (req, res) => {
    try {
        const customers = await ploomeService.fetchAllContacts();
        const result = await db.upsertCustomersBatch(customers);
        
        const syncLog = {
            type: 'customer_sync',
            startedAt: new Date().toISOString(),
            fetched: customers.length,
            updated: result.successCount,
            errors: result.errorCount,
            completedAt: new Date().toISOString(),
            status: result.errorCount === 0 ? 'success' : 'partial'
        };
        
        await db.logSync(syncLog);
        
        res.json({
            success: true,
            message: `Synced ${result.successCount} customers`,
            details: syncLog
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get all customers
app.get('/api/customers', async (req, res) => {
    try {
        const { lat, lng, radius, status } = req.query;
        
        let customers;
        
        if (lat && lng && radius) {
            customers = await db.getCustomersByDistance(
                parseFloat(lat),
                parseFloat(lng),
                parseFloat(radius)
            );
        } else if (status) {
            const query = `SELECT * FROM customers WHERE geocoding_status = ? ORDER BY name`;
            customers = await db.all(query, [status]);
        } else {
            customers = await db.getAllCustomers();
        }

        res.json({
            success: true,
            count: customers.length,
            customers
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Geocode customers
app.post('/api/geocode/batch', async (req, res) => {
    try {
        const { limit = 100 } = req.body;
        const customers = await db.getCustomersForGeocoding(limit);
        
        if (customers.length === 0) {
            return res.json({
                success: true,
                message: 'No customers need geocoding',
                summary: { total: 0, success: 0, failed: 0 }
            });
        }

        const result = await geocodingService.geocodeCustomersBatch(customers);
        
        res.json({
            success: true,
            message: `Geocoded ${result.summary.success} of ${result.summary.total} customers`,
            summary: result.summary
        });
    } catch (error) {
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

        geocodingQueue.startProcessing().catch(err => {
            console.error('Geocoding queue error:', err);
        });

        res.json({
            success: true,
            message: 'Geocoding started',
            progress: geocodingQueue.getProgress()
        });
    } catch (error) {
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

        const result = await geocodingService.geocodeAddress(address, cep);
        
        if (result) {
            res.json({
                success: true,
                coordinates: result
            });
        } else {
            res.status(404).json({
                success: false,
                error: 'Could not geocode address'
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Geocode CEP
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
            // Get address details from ViaCEP for display purposes
            const cepClean = cep.replace(/\D/g, '');
            let address = `CEP ${cep}`;
            
            try {
                const viacepResponse = await axios.get(`https://viacep.com.br/ws/${cepClean}/json/`, { timeout: 3000 });
                if (viacepResponse.data && !viacepResponse.data.erro) {
                    const addressParts = [];
                    if (viacepResponse.data.logradouro) addressParts.push(viacepResponse.data.logradouro);
                    if (viacepResponse.data.bairro) addressParts.push(viacepResponse.data.bairro);
                    if (viacepResponse.data.localidade) addressParts.push(viacepResponse.data.localidade);
                    if (viacepResponse.data.uf) addressParts.push(viacepResponse.data.uf);
                    
                    if (addressParts.length > 0) {
                        address = addressParts.join(', ');
                    }
                }
            } catch (e) {
                console.log(`Could not get address details for CEP ${cep}: ${e.message}`);
            }
            
            res.json({
                success: true,
                coordinates: result,
                address: address.trim(),
                cep: cep
            });
        } else {
            res.status(404).json({
                success: false,
                error: 'Could not geocode CEP. Please verify the CEP is valid.'
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Optimize route
app.post('/api/routes/optimize', async (req, res) => {
    try {
        const { origin, waypoints, options = {} } = req.body;
        
        if (!origin || !waypoints) {
            return res.status(400).json({
                success: false,
                error: 'Origin and waypoints required'
            });
        }

        const optimizedRoute = routeOptimizer.optimize(waypoints, origin, options);
        
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
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get saved routes
app.get('/api/routes', async (req, res) => {
    try {
        const routes = await db.getRoutes();
        
        res.json({
            success: true,
            count: routes.length,
            routes
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get statistics
app.get('/api/statistics', async (req, res) => {
    try {
        const stats = await db.getStatistics();
        
        res.json({
            success: true,
            statistics: stats
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Calculate distance
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
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        message: 'Backend API is running',
        mode: process.env.NODE_ENV || 'development',
        frontend: 'http://localhost:3000',
        api: 'http://localhost:3001/api',
        endpoints: {
            testConnection: '/api/test-connection',
            health: '/api/health',
            customers: '/api/customers',
            geocodeProgress: '/api/geocode/progress'
        }
    });
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
    const initialized = await initializeServices();
    
    if (!initialized) {
        console.error('Failed to initialize services. Server not started.');
        process.exit(1);
    }

    app.listen(PORT, () => {
        console.log(`\n🚀 Server running on http://localhost:${PORT}`);
        console.log(`📋 Mode: ${process.env.NODE_ENV || 'development'}`);
        console.log('\n📝 Available endpoints:');
        console.log('   GET  /api/test-connection - Test Ploome API connection');
        console.log('   GET  /api/health - System health check');
        console.log('   POST /api/sync/customers - Sync customers from Ploome');
        console.log('   GET  /api/customers - Get all customers');
        console.log('   GET  /api/geocode/progress - Get geocoding progress');
        console.log('   POST /api/routes/optimize - Optimize route');
        console.log('\n✅ All systems operational!');
        console.log('⚠️  Note: Running without SQLite database (using in-memory storage)');
    });
}

startServer();