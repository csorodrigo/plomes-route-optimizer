const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

class DatabaseService {
    constructor(dbPath = null) {
        // Optimize database path for different environments
        if (process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_GIT_COMMIT_SHA) {
            // Railway: Use /tmp for ephemeral storage
            this.dbPath = dbPath || process.env.DATABASE_PATH || '/tmp/customers.db';
        } else {
            // Local/other: Use cache directory
            this.dbPath = dbPath || process.env.DATABASE_PATH || './cache/customers.db';
        }
        this.db = null;
        this.isInitialized = false;
        this.initializationPromise = null;
        this.ensureDirectoryExists();
    }

    ensureDirectoryExists() {
        const dir = path.dirname(this.dbPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }

    async connect() {
        return new Promise((resolve, reject) => {
            // Add timeout for Railway environment
            const timeout = setTimeout(() => {
                reject(new Error('Database connection timeout after 10 seconds'));
            }, 10000);

            try {
                // Check if database file exists and is valid
                const dbExists = fs.existsSync(this.dbPath);
                const dbStats = dbExists ? fs.statSync(this.dbPath) : null;

                if (dbExists && dbStats && dbStats.size === 0) {
                    console.log('⚠️  Database file is empty (0 bytes), removing...');
                    fs.unlinkSync(this.dbPath);
                }

                this.db = new sqlite3.Database(this.dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
                    clearTimeout(timeout);
                    if (err) {
                        console.error('Error opening database:', err);
                        reject(err);
                    } else {
                        console.log('✅ Connected to SQLite database:', this.dbPath);
                        // Enable WAL mode for better performance
                        this.db.run('PRAGMA journal_mode=WAL;');
                        resolve();
                    }
                });
            } catch (error) {
                clearTimeout(timeout);
                reject(error);
            }
        });
    }

    async initialize() {
        // Prevent multiple concurrent initializations
        if (this.isInitialized) {
            return;
        }

        if (this.initializationPromise) {
            return this.initializationPromise;
        }

        this.initializationPromise = this._doInitialize();
        return this.initializationPromise;
    }

    async _doInitialize() {
        try {
            await this.connect();
            await this.createTables();
            await this.runMigrations();
            await this.createIndexes();
            await this.createDefaultUser();
            this.isInitialized = true;
            console.log('✅ Database initialized successfully');
        } catch (error) {
            this.initializationPromise = null;
            throw error;
        }
    }

    async ensureInitialized() {
        if (!this.isInitialized) {
            await this.initialize();
        }
    }

    async createTables() {
        const queries = [
            // Tabela de clientes
            `CREATE TABLE IF NOT EXISTS customers (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                cnpj TEXT,
                cpf TEXT,
                email TEXT,
                phone TEXT,
                cep TEXT,
                street_address TEXT,
                street_number TEXT,
                street_complement TEXT,
                neighborhood TEXT,
                city TEXT,
                state TEXT,
                full_address TEXT,
                tags TEXT,
                latitude REAL,
                longitude REAL,
                geocoding_status TEXT DEFAULT 'pending',
                geocoding_attempts INTEGER DEFAULT 0,
                last_geocoding_attempt DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,

            // Tabela de usuários
            `CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                name TEXT NOT NULL,
                is_active INTEGER DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                last_login DATETIME
            )`,

            // Tabela de sessões de usuários
            `CREATE TABLE IF NOT EXISTS user_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                token_hash TEXT NOT NULL,
                expires_at DATETIME NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                user_agent TEXT,
                ip_address TEXT,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )`,

            // Tabela de cache de geocodifica��o
            `CREATE TABLE IF NOT EXISTS geocoding_cache (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                address TEXT UNIQUE,
                latitude REAL,
                longitude REAL,
                provider TEXT,
                accuracy TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                expires_at DATETIME
            )`,

            // Tabela de rotas otimizadas
            `CREATE TABLE IF NOT EXISTS routes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT,
                origin_cep TEXT,
                origin_lat REAL,
                origin_lng REAL,
                waypoints TEXT,
                optimized_order TEXT,
                total_distance REAL,
                estimated_time INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,

            // Tabela de logs de sincroniza��o
            `CREATE TABLE IF NOT EXISTS sync_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sync_type TEXT,
                records_fetched INTEGER,
                records_updated INTEGER,
                errors INTEGER,
                started_at DATETIME,
                completed_at DATETIME,
                status TEXT,
                error_message TEXT
            )`
        ];

        for (const query of queries) {
            await this.run(query);
        }
        
        console.log('✅ Database tables created successfully');
    }

    async runMigrations() {
        try {
            // Migration 1: Add tags column to customers table if it doesn't exist
            const tableInfo = await this.all("PRAGMA table_info(customers)");
            const hasTagsColumn = tableInfo.some(column => column.name === 'tags');
            
            if (!hasTagsColumn) {
                console.log('🔄 Adding tags column to customers table...');
                await this.run('ALTER TABLE customers ADD COLUMN tags TEXT');
                console.log('✅ Tags column added successfully');
            }
        } catch (error) {
            console.error('Migration error:', error);
            // Don't throw error to avoid breaking initialization
        }
    }

    async createIndexes() {
        const indexes = [
            'CREATE INDEX IF NOT EXISTS idx_customers_cep ON customers(cep)',
            'CREATE INDEX IF NOT EXISTS idx_customers_coords ON customers(latitude, longitude)',
            'CREATE INDEX IF NOT EXISTS idx_customers_city_state ON customers(city, state)',
            'CREATE INDEX IF NOT EXISTS idx_customers_geocoding_status ON customers(geocoding_status)',
            'CREATE INDEX IF NOT EXISTS idx_customers_tags ON customers(tags)',
            'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)',
            'CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id)',
            'CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(token_hash)',
            'CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions(expires_at)',
            'CREATE INDEX IF NOT EXISTS idx_geocoding_cache_address ON geocoding_cache(address)',
            'CREATE INDEX IF NOT EXISTS idx_geocoding_cache_expires ON geocoding_cache(expires_at)'
        ];

        for (const index of indexes) {
            await this.run(index);
        }
        
        console.log('✅ Database indexes created successfully');
    }

    // M�todos de Cliente
    async upsertCustomer(customer) {
        const query = `
            INSERT OR REPLACE INTO customers (
                id, name, cnpj, cpf, email, phone,
                cep, street_address, street_number, street_complement,
                neighborhood, city, state, full_address, tags,
                latitude, longitude, geocoding_status,
                updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `;

        const params = [
            customer.id,
            customer.name,
            customer.cnpj,
            customer.cpf,
            customer.email,
            customer.phone,
            customer.cep,
            customer.streetAddress,
            customer.streetNumber,
            customer.streetComplement,
            customer.neighborhood,
            customer.city,
            customer.state,
            customer.fullAddress,
            customer.tags ? JSON.stringify(customer.tags) : null,
            customer.latitude || null,
            customer.longitude || null,
            customer.geocoding_status || 'pending'
        ];

        return this.run(query, params);
    }

    async upsertCustomersBatch(customers) {
        const query = `
            INSERT OR REPLACE INTO customers (
                id, name, cnpj, cpf, email, phone,
                cep, street_address, street_number, street_complement,
                neighborhood, city, state, full_address, tags,
                geocoding_status, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `;

        return new Promise((resolve, reject) => {
            this.db.serialize(() => {
                this.db.run('BEGIN TRANSACTION', (err) => {
                    if (err) {
                        console.error('Error starting transaction:', err);
                        reject(err);
                        return;
                    }
                });
                
                let successCount = 0;
                let errorCount = 0;
                let processedCount = 0;
                const totalCount = customers.length;
                
                const stmt = this.db.prepare(query);

                const processNext = (index) => {
                    if (index >= totalCount) {
                        // All customers processed, finalize
                        stmt.finalize((finalizeErr) => {
                            if (finalizeErr) {
                                console.error('Error finalizing statement:', finalizeErr);
                                this.db.run('ROLLBACK');
                                reject(finalizeErr);
                            } else {
                                this.db.run('COMMIT', (commitErr) => {
                                    if (commitErr) {
                                        console.error('Error committing transaction:', commitErr);
                                        reject(commitErr);
                                    } else {
                                        resolve({ successCount, errorCount });
                                    }
                                });
                            }
                        });
                        return;
                    }
                    
                    const customer = customers[index];
                    stmt.run([
                        customer.id,
                        customer.name,
                        customer.cnpj,
                        customer.cpf,
                        customer.email,
                        customer.phone,
                        customer.cep,
                        customer.streetAddress,
                        customer.streetNumber,
                        customer.streetComplement,
                        customer.neighborhood,
                        customer.city,
                        customer.state,
                        customer.fullAddress,
                        customer.tags ? JSON.stringify(customer.tags) : null,
                        'pending'
                    ], (runErr) => {
                        processedCount++;
                        if (runErr) {
                            errorCount++;
                            console.error(`Error inserting customer ${customer.name}:`, runErr);
                        } else {
                            successCount++;
                        }
                        
                        // Process next customer
                        setImmediate(() => processNext(index + 1));
                    });
                };
                
                // Start processing
                processNext(0);
            });
        });
    }

    async getCustomersForGeocoding(limit = 100) {
        const query = `
            SELECT * FROM customers
            WHERE geocoding_status = 'pending'
            AND (geocoding_attempts < 3 OR geocoding_attempts IS NULL)
            AND (cep IS NOT NULL OR full_address IS NOT NULL)
            ORDER BY updated_at DESC
            LIMIT ?
        `;
        
        return this.all(query, [limit]);
    }

    async updateCustomerCoordinates(customerId, lat, lng, status = 'completed') {
        const query = `
            UPDATE customers
            SET latitude = ?, longitude = ?, 
                geocoding_status = ?,
                geocoding_attempts = geocoding_attempts + 1,
                last_geocoding_attempt = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `;
        
        return this.run(query, [lat, lng, status, customerId]);
    }

    async getCustomersByDistance(originLat, originLng, maxDistanceKm) {
        // Usando a fórmula de Haversine simplificada para SQLite
        // Aproximação: 111.12 km por grau
        const query = `
            SELECT *,
                (111.12 * 
                    SQRT(
                        POW(latitude - ?, 2) + 
                        POW((longitude - ?) * COS(RADIANS(?)), 2)
                    )
                ) as distance_km
            FROM customers
            WHERE latitude IS NOT NULL 
            AND longitude IS NOT NULL
            AND geocoding_status = 'completed'
            AND tags LIKE '%"Cliente"%'
            AND (111.12 * 
                    SQRT(
                        POW(latitude - ?, 2) + 
                        POW((longitude - ?) * COS(RADIANS(?)), 2)
                    )
                ) <= ?
            ORDER BY distance_km ASC
        `;
        
        const customers = await this.all(query, [originLat, originLng, originLat, originLat, originLng, originLat, maxDistanceKm]);
        return this.parseTags(customers);
    }

    // M�todos de Geocodifica��o
    async getCachedGeocoding(address) {
        const query = `
            SELECT * FROM geocoding_cache
            WHERE address = ?
            AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
            LIMIT 1
        `;
        
        return this.get(query, [address]);
    }

    async saveGeocodingCache(address, lat, lng, provider = 'nominatim', ttlDays = 30) {
        const query = `
            INSERT OR REPLACE INTO geocoding_cache (
                address, latitude, longitude, provider, 
                expires_at, created_at
            ) VALUES (?, ?, ?, ?, datetime('now', '+${ttlDays} days'), CURRENT_TIMESTAMP)
        `;
        
        return this.run(query, [address, lat, lng, provider]);
    }

    // M�todos de Rotas
    async saveRoute(route) {
        const query = `
            INSERT INTO routes (
                name, origin_cep, origin_lat, origin_lng,
                waypoints, optimized_order, total_distance, estimated_time
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        const params = [
            route.name || `Rota ${new Date().toLocaleDateString('pt-BR')}`,
            route.originCep,
            route.originLat,
            route.originLng,
            JSON.stringify(route.waypoints),
            JSON.stringify(route.optimizedOrder),
            route.totalDistance,
            route.estimatedTime
        ];
        
        return this.run(query, params);
    }

    async getRoutes(limit = 50) {
        const query = `
            SELECT * FROM routes
            ORDER BY created_at DESC
            LIMIT ?
        `;
        
        const routes = await this.all(query, [limit]);
        
        // Parse JSON fields
        return routes.map(route => ({
            ...route,
            waypoints: JSON.parse(route.waypoints || '[]'),
            optimized_order: JSON.parse(route.optimized_order || '[]')
        }));
    }

    // M�todos de Log
    async logSync(logData) {
        const query = `
            INSERT INTO sync_logs (
                sync_type, records_fetched, records_updated,
                errors, started_at, completed_at, status, error_message
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        const params = [
            logData.type,
            logData.fetched,
            logData.updated,
            logData.errors,
            logData.startedAt,
            logData.completedAt,
            logData.status,
            logData.errorMessage
        ];
        
        return this.run(query, params);
    }

    // Estat�sticas
    async getStatistics() {
        const stats = {};
        
        // Total de clientes
        const totalCustomers = await this.get('SELECT COUNT(*) as count FROM customers');
        stats.totalCustomers = totalCustomers.count;
        
        // Clientes geocodificados
        const geocoded = await this.get("SELECT COUNT(*) as count FROM customers WHERE geocoding_status = 'completed'");
        stats.geocodedCustomers = geocoded.count;
        
        // Clientes pendentes de geocodifica��o
        const pending = await this.get("SELECT COUNT(*) as count FROM customers WHERE geocoding_status = 'pending'");
        stats.pendingGeocoding = pending.count;
        
        // Total de rotas
        const routes = await this.get('SELECT COUNT(*) as count FROM routes');
        stats.totalRoutes = routes.count;
        
        // �ltima sincroniza��o
        const lastSync = await this.get("SELECT * FROM sync_logs WHERE status = 'success' ORDER BY completed_at DESC LIMIT 1");
        stats.lastSync = lastSync;
        
        return stats;
    }

    async getGeocodingStats() {
        const query = `
            SELECT 
                COUNT(CASE WHEN geocoding_status = 'pending' THEN 1 END) as pending,
                COUNT(CASE WHEN geocoding_status = 'completed' THEN 1 END) as completed,
                COUNT(CASE WHEN geocoding_status = 'failed' THEN 1 END) as failed,
                COUNT(CASE WHEN geocoding_status = 'error' THEN 1 END) as error
            FROM customers
        `;
        return this.get(query);
    }

    async getPendingGeocoding(limit = 10) {
        const query = `
            SELECT * FROM customers
            WHERE geocoding_status = 'pending'
            AND (geocoding_attempts < 3 OR geocoding_attempts IS NULL)
            ORDER BY updated_at DESC
            LIMIT ?
        `;
        return this.all(query, [limit]);
    }

    async updateGeocodingStatus(customerId, status) {
        const query = `
            UPDATE customers
            SET geocoding_status = ?,
                geocoding_attempts = COALESCE(geocoding_attempts, 0) + 1,
                last_geocoding_attempt = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `;
        return this.run(query, [status, customerId]);
    }

    async getGeocodedCustomers(limit = 1000) {
        const customers = await this.all(`
            SELECT * FROM customers 
            WHERE latitude IS NOT NULL 
            AND longitude IS NOT NULL
            AND tags LIKE '%"Cliente"%'
            ORDER BY updated_at DESC
            LIMIT ?
        `, [limit]);
        
        return this.parseTags(customers);
    }

    // Helper method to parse tags JSON for customer records
    parseTags(customers) {
        if (!Array.isArray(customers)) {
            return customers;
        }
        
        return customers.map(customer => ({
            ...customer,
            tags: customer.tags ? JSON.parse(customer.tags) : []
        }));
    }

    // M�todos auxiliares do SQLite
    async run(query, params = []) {
        // RAILWAY FIX: Skip recursive initialization during auth service setup
        if (!this.isInitialized && !this.initializationPromise) {
            await this.ensureInitialized();
        }

        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not initialized'));
                return;
            }

            // Add timeout for Railway environment
            const timeout = setTimeout(() => {
                reject(new Error('Database query timeout'));
            }, 10000);

            this.db.run(query, params, function(err) {
                clearTimeout(timeout);
                if (err) reject(err);
                else resolve({ id: this.lastID, changes: this.changes });
            });
        });
    }

    async get(query, params = []) {
        // RAILWAY FIX: Skip recursive initialization during auth service setup
        if (!this.isInitialized && !this.initializationPromise) {
            await this.ensureInitialized();
        }

        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not initialized'));
                return;
            }

            // Add timeout for Railway environment
            const timeout = setTimeout(() => {
                reject(new Error('Database query timeout'));
            }, 10000);

            this.db.get(query, params, (err, row) => {
                clearTimeout(timeout);
                if (err) reject(err);
                else resolve(row);
            });
        });
    }

    async all(query, params = []) {
        // RAILWAY FIX: Skip recursive initialization during auth service setup
        if (!this.isInitialized && !this.initializationPromise) {
            await this.ensureInitialized();
        }

        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not initialized'));
                return;
            }

            // Add timeout for Railway environment
            const timeout = setTimeout(() => {
                reject(new Error('Database query timeout'));
            }, 10000);

            this.db.all(query, params, (err, rows) => {
                clearTimeout(timeout);
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
    }

    close() {
        return new Promise((resolve, reject) => {
            this.db.close((err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    // Método para criar usuário padrão
    async createDefaultUser() {
        const crypto = require('crypto');
        
        try {
            const defaultEmail = 'gustavo.canuto@ciaramaquinas.com.br';
            const defaultPassword = 'ciara123@';
            const defaultName = 'Gustavo Canuto';

            // Check if default user already exists
            const existingUser = await this.get(
                'SELECT id FROM users WHERE email = ?',
                [defaultEmail]
            );

            if (existingUser) {
                console.log('✅ Default user already exists');
                return;
            }

            // Create password hash using SHA-256 with salt
            const salt = crypto.randomBytes(32).toString('hex');
            const hash = crypto.createHash('sha256').update(defaultPassword + salt).digest('hex');
            const passwordHash = salt + ':' + hash;

            // Create default user
            await this.run(
                'INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)',
                [defaultEmail, passwordHash, defaultName]
            );

            console.log('✅ Default user created:', defaultEmail);
        } catch (error) {
            console.error('❌ Error creating default user:', error);
        }
    }
}

module.exports = DatabaseService;