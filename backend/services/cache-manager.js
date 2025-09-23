const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

class CacheManager {
    constructor() {
        this.layers = {
            memory: new Map(),
            sqlite: null
        };
        
        this.initSQLite();
    }

    initSQLite() {
        try {
            // Criar diretório se não existir
            const cacheDir = path.join(process.cwd(), 'cache');
            if (!fs.existsSync(cacheDir)) {
                fs.mkdirSync(cacheDir, { recursive: true });
            }

            // Inicializar banco persistente
            this.layers.sqlite = new Database(path.join(cacheDir, 'persistent.db'));
            
            // Criar tabelas
            this.layers.sqlite.exec(`
                CREATE TABLE IF NOT EXISTS customers_cache (
                    id INTEGER PRIMARY KEY,
                    data TEXT NOT NULL,
                    geocoded INTEGER DEFAULT 0,
                    latitude REAL,
                    longitude REAL,
                    last_sync TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                
                CREATE TABLE IF NOT EXISTS sync_state (
                    key TEXT PRIMARY KEY,
                    value TEXT,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                
                CREATE TABLE IF NOT EXISTS geocoding_cache (
                    address TEXT PRIMARY KEY,
                    latitude REAL,
                    longitude REAL,
                    provider TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                
                CREATE TABLE IF NOT EXISTS routes_cache (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    origin TEXT NOT NULL,
                    waypoints TEXT NOT NULL,
                    total_distance REAL,
                    estimated_time INTEGER,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                
                CREATE INDEX IF NOT EXISTS idx_geocoded ON customers_cache(geocoded);
                CREATE INDEX IF NOT EXISTS idx_coords ON customers_cache(latitude, longitude);
                CREATE INDEX IF NOT EXISTS idx_sync ON customers_cache(last_sync);
            `);
            
            console.log('✅ Cache SQLite initialized at', path.join(cacheDir, 'persistent.db'));
        } catch (error) {
            console.error('❌ Error initializing SQLite cache:', error);
        }
    }

    // Salvar com estratégia de fallback
    async save(key, data, options = {}) {
        const timestamp = Date.now();
        const record = { data, timestamp, ...options };

        // Camada 1: Memória (mais rápida)
        this.layers.memory.set(key, record);

        // Camada 2: SQLite (persistente)
        if (this.layers.sqlite && options.permanent !== false) {
            try {
                if (key === 'customers' && Array.isArray(data)) {
                    // Salvar clientes em batch
                    const stmt = this.layers.sqlite.prepare(`
                        INSERT OR REPLACE INTO customers_cache 
                        (id, data, geocoded, latitude, longitude, last_sync) 
                        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                    `);
                    
                    const insertMany = this.layers.sqlite.transaction((items) => {
                        for (const item of items) {
                            const geocoded = item.latitude && item.longitude ? 1 : 0;
                            stmt.run(
                                item.id, 
                                JSON.stringify(item), 
                                geocoded,
                                item.latitude,
                                item.longitude
                            );
                        }
                    });
                    
                    insertMany(data);
                    console.log(`💾 Saved ${data.length} customers to persistent cache`);
                    
                } else if (key === 'route' && options.route) {
                    // Salvar rota
                    const stmt = this.layers.sqlite.prepare(`
                        INSERT INTO routes_cache 
                        (origin, waypoints, total_distance, estimated_time) 
                        VALUES (?, ?, ?, ?)
                    `);
                    
                    stmt.run(
                        JSON.stringify(options.route.origin),
                        JSON.stringify(options.route.waypoints),
                        options.route.totalDistance,
                        options.route.estimatedTime
                    );
                    
                } else {
                    // Salvar estado genérico
                    const stmt = this.layers.sqlite.prepare(`
                        INSERT OR REPLACE INTO sync_state (key, value, updated_at) 
                        VALUES (?, ?, CURRENT_TIMESTAMP)
                    `);
                    
                    stmt.run(key, JSON.stringify(data));
                }
            } catch (error) {
                console.error('Error saving to SQLite:', error);
            }
        }

        return true;
    }

    // Carregar com estratégia de fallback
    async load(key, options = {}) {
        // Tentar memória primeiro
        if (this.layers.memory.has(key)) {
            const cached = this.layers.memory.get(key);
            const age = Date.now() - cached.timestamp;
            const ttl = options.ttl || 3600000; // 1 hora padrão
            
            if (age < ttl) {
                console.log(`📦 Loaded ${key} from memory cache`);
                return cached.data;
            }
        }

        // Tentar SQLite
        if (this.layers.sqlite) {
            try {
                if (key === 'customers') {
                    const rows = this.layers.sqlite.prepare(`
                        SELECT data FROM customers_cache 
                        ORDER BY last_sync DESC
                    `).all();
                    
                    if (rows.length > 0) {
                        const customers = rows.map(r => JSON.parse(r.data));
                        
                        // Salvar na memória para acesso rápido
                        this.layers.memory.set(key, { 
                            data: customers, 
                            timestamp: Date.now() 
                        });
                        
                        console.log(`📦 Loaded ${customers.length} customers from SQLite cache`);
                        return customers;
                    }
                    
                } else if (key === 'routes') {
                    const rows = this.layers.sqlite.prepare(`
                        SELECT * FROM routes_cache 
                        ORDER BY created_at DESC 
                        LIMIT 10
                    `).all();
                    
                    return rows.map(r => ({
                        id: r.id,
                        origin: JSON.parse(r.origin),
                        waypoints: JSON.parse(r.waypoints),
                        totalDistance: r.total_distance,
                        estimatedTime: r.estimated_time,
                        createdAt: r.created_at
                    }));
                    
                } else {
                    const row = this.layers.sqlite.prepare(`
                        SELECT value FROM sync_state WHERE key = ?
                    `).get(key);
                    
                    if (row) {
                        const data = JSON.parse(row.value);
                        this.layers.memory.set(key, { 
                            data, 
                            timestamp: Date.now() 
                        });
                        return data;
                    }
                }
            } catch (error) {
                console.error('Error loading from SQLite:', error);
            }
        }

        return null;
    }

    // Obter status de sincronização
    async getSyncStatus() {
        if (this.layers.sqlite) {
            try {
                const stats = this.layers.sqlite.prepare(`
                    SELECT 
                        COUNT(*) as total,
                        COUNT(CASE WHEN geocoded = 1 THEN 1 END) as geocoded,
                        MAX(last_sync) as lastSync
                    FROM customers_cache
                `).get();
                
                const routes = this.layers.sqlite.prepare(`
                    SELECT COUNT(*) as count FROM routes_cache
                `).get();
                
                return {
                    customers: {
                        total: stats.total || 0,
                        geocoded: stats.geocoded || 0,
                        lastSync: stats.lastSync
                    },
                    routes: routes.count || 0,
                    cacheSize: this.getCacheSize()
                };
            } catch (error) {
                console.error('Error getting sync status:', error);
            }
        }
        
        return {
            customers: { total: 0, geocoded: 0, lastSync: null },
            routes: 0,
            cacheSize: 0
        };
    }

    // Obter tamanho do cache
    getCacheSize() {
        try {
            const dbPath = path.join(process.cwd(), 'cache', 'persistent.db');
            if (fs.existsSync(dbPath)) {
                const stats = fs.statSync(dbPath);
                return Math.round(stats.size / 1024); // KB
            }
        } catch (error) {
            console.error('Error getting cache size:', error);
        }
        return 0;
    }

    // Buscar clientes por proximidade
    async getCustomersNearby(lat, lng, radiusKm = 50) {
        if (this.layers.sqlite) {
            try {
                // Usar fórmula Haversine simplificada para SQLite
                const customers = this.layers.sqlite.prepare(`
                    SELECT 
                        data,
                        latitude,
                        longitude,
                        (6371 * acos(
                            cos(radians(?)) * cos(radians(latitude)) * 
                            cos(radians(longitude) - radians(?)) + 
                            sin(radians(?)) * sin(radians(latitude))
                        )) as distance
                    FROM customers_cache
                    WHERE latitude IS NOT NULL 
                    AND longitude IS NOT NULL
                    AND distance <= ?
                    ORDER BY distance
                `).all(lat, lng, lat, radiusKm);
                
                return customers.map(c => ({
                    ...JSON.parse(c.data),
                    distance: c.distance
                }));
            } catch (error) {
                console.error('Error getting nearby customers:', error);
            }
        }
        
        return [];
    }

    // Salvar resultado de geocodificação
    async saveGeocodingResult(address, lat, lng, provider = 'nominatim') {
        if (this.layers.sqlite) {
            try {
                const stmt = this.layers.sqlite.prepare(`
                    INSERT OR REPLACE INTO geocoding_cache 
                    (address, latitude, longitude, provider) 
                    VALUES (?, ?, ?, ?)
                `);
                
                stmt.run(address, lat, lng, provider);
            } catch (error) {
                console.error('Error saving geocoding result:', error);
            }
        }
    }

    // Buscar geocodificação em cache
    async getGeocodingFromCache(address) {
        if (this.layers.sqlite) {
            try {
                const row = this.layers.sqlite.prepare(`
                    SELECT latitude, longitude, provider 
                    FROM geocoding_cache 
                    WHERE address = ?
                `).get(address);
                
                if (row) {
                    return {
                        lat: row.latitude,
                        lng: row.longitude,
                        provider: row.provider,
                        cached: true
                    };
                }
            } catch (error) {
                console.error('Error getting geocoding from cache:', error);
            }
        }
        
        return null;
    }

    // Limpar cache específico ou todos
    async clear(layer = 'all') {
        if (layer === 'all' || layer === 'memory') {
            this.layers.memory.clear();
            console.log('🗑️ Memory cache cleared');
        }
        
        if ((layer === 'all' || layer === 'sqlite') && this.layers.sqlite) {
            try {
                if (layer === 'all') {
                    this.layers.sqlite.prepare('DELETE FROM customers_cache').run();
                    this.layers.sqlite.prepare('DELETE FROM sync_state').run();
                    this.layers.sqlite.prepare('DELETE FROM geocoding_cache').run();
                    this.layers.sqlite.prepare('DELETE FROM routes_cache').run();
                    console.log('🗑️ SQLite cache cleared');
                } else if (layer === 'customers') {
                    this.layers.sqlite.prepare('DELETE FROM customers_cache').run();
                    console.log('🗑️ Customers cache cleared');
                } else if (layer === 'routes') {
                    this.layers.sqlite.prepare('DELETE FROM routes_cache').run();
                    console.log('🗑️ Routes cache cleared');
                }
            } catch (error) {
                console.error('Error clearing SQLite cache:', error);
            }
        }
    }

    // Exportar dados para backup
    async exportData() {
        const data = {
            customers: await this.load('customers') || [],
            syncStatus: await this.getSyncStatus(),
            exportDate: new Date().toISOString()
        };
        
        return data;
    }

    // Importar dados de backup
    async importData(data) {
        if (data.customers && Array.isArray(data.customers)) {
            await this.save('customers', data.customers, { permanent: true });
            console.log(`✅ Imported ${data.customers.length} customers`);
            return true;
        }
        
        return false;
    }
}

// Singleton
module.exports = new CacheManager();