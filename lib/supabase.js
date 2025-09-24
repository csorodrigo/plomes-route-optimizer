// Supabase Client for Vercel Serverless Functions
// Replaces temporary KV system with permanent PostgreSQL storage

import { createClient } from '@supabase/supabase-js';

// Supabase configuration from environment variables
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://yxwokryybudwygtemfmu.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4d29rcnl5YnVkd3lndGVtZm11Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODc0MTY4MSwiZXhwIjoyMDc0MzE3NjgxfQ.dzEfWIgdftQiwXJdod_bIy4pUl42WwlS-VWYaKvqEKk';

// Create Supabase client with service key for server-side operations
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Database schema for customers table
const CUSTOMERS_TABLE = 'customers';
const GEOCODING_STATS_TABLE = 'geocoding_stats';
const BATCH_LOGS_TABLE = 'batch_logs';

class SupabaseKV {
    constructor() {
        this.supabase = supabase;
        this.initialized = false;
    }

    // Initialize database tables if they don't exist
    async initialize() {
        if (this.initialized) return;

        try {
            // Create customers table if not exists
            await this.supabase.rpc('create_customers_table_if_not_exists', {});

            // Create geocoding_stats table if not exists
            await this.supabase.rpc('create_geocoding_stats_table_if_not_exists', {});

            // Create batch_logs table if not exists
            await this.supabase.rpc('create_batch_logs_table_if_not_exists', {});

            this.initialized = true;
            console.log('✅ [SUPABASE] Database initialized successfully');
        } catch (error) {
            console.warn('[SUPABASE] Database initialization warning:', error.message);
            // Continue anyway - tables might already exist
            this.initialized = true;
        }
    }

    // Generic key-value operations for backward compatibility
    async set(key, value, options = {}) {
        await this.initialize();

        try {
            // Handle different key patterns
            if (key.startsWith('customer:')) {
                return await this.setCustomer(key, value);
            } else if (key === 'geocoding_stats') {
                return await this.setGeocodingStats(value);
            } else if (key.startsWith('batch:')) {
                return await this.setBatchLog(key, value);
            } else {
                // Generic key-value storage (for backward compatibility)
                const { error } = await this.supabase
                    .from('key_value_store')
                    .upsert({
                        key: key,
                        value: typeof value === 'string' ? value : JSON.stringify(value),
                        created_at: new Date().toISOString(),
                        expires_at: options.ex ? new Date(Date.now() + options.ex * 1000).toISOString() : null
                    });

                if (error) throw error;
                return 'OK';
            }
        } catch (error) {
            console.error('[SUPABASE] Set error:', error);
            throw error;
        }
    }

    async get(key) {
        await this.initialize();

        try {
            if (key.startsWith('customer:')) {
                return await this.getCustomer(key);
            } else if (key === 'geocoding_stats') {
                return await this.getGeocodingStats();
            } else if (key.startsWith('batch:')) {
                return await this.getBatchLog(key);
            } else {
                // Generic key-value retrieval
                const { data, error } = await this.supabase
                    .from('key_value_store')
                    .select('value, expires_at')
                    .eq('key', key)
                    .single();

                if (error) {
                    if (error.code === 'PGRST116') return null; // Not found
                    throw error;
                }

                // Check expiration
                if (data.expires_at && new Date(data.expires_at) < new Date()) {
                    await this.del(key);
                    return null;
                }

                return data.value;
            }
        } catch (error) {
            console.error('[SUPABASE] Get error:', error);
            return null;
        }
    }

    // Customer-specific operations
    async setCustomer(key, value) {
        const customerId = key.replace('customer:', '');
        const customerData = typeof value === 'string' ? JSON.parse(value) : value;

        const { error } = await this.supabase
            .from(CUSTOMERS_TABLE)
            .upsert({
                id: customerId,
                ploome_person_id: customerData.ploome_person_id || customerId,
                name: customerData.name,
                email: customerData.email,
                phone: customerData.phone,
                address: customerData.address,
                cep: customerData.cep,
                city: customerData.city,
                state: customerData.state,
                latitude: customerData.latitude,
                longitude: customerData.longitude,
                geocoding_status: customerData.geocoding_status,
                geocoded_address: customerData.geocoded_address,
                created_at: customerData.created_date || new Date().toISOString(),
                updated_at: new Date().toISOString()
            }, { onConflict: 'id' });

        if (error) throw error;
        return 'OK';
    }

    async getCustomer(key) {
        const customerId = key.replace('customer:', '');

        const { data, error } = await this.supabase
            .from(CUSTOMERS_TABLE)
            .select('*')
            .eq('id', customerId)
            .single();

        if (error) {
            if (error.code === 'PGRST116') return null;
            throw error;
        }

        // Convert back to KV format for compatibility
        return JSON.stringify({
            id: data.id,
            name: data.name,
            email: data.email,
            phone: data.phone,
            address: data.address,
            cep: data.cep,
            city: data.city,
            state: data.state,
            latitude: data.latitude,
            longitude: data.longitude,
            ploome_person_id: data.ploome_person_id,
            geocoding_status: data.geocoding_status,
            geocoded_address: data.geocoded_address,
            created_date: data.created_at
        });
    }

    // Geocoding stats operations
    async setGeocodingStats(value) {
        const statsData = typeof value === 'string' ? JSON.parse(value) : value;

        const { error } = await this.supabase
            .from(GEOCODING_STATS_TABLE)
            .upsert({
                id: 'global',
                total_processed: statsData.total_processed,
                total_geocoded: statsData.total_geocoded,
                total_failed: statsData.total_failed,
                total_skipped: statsData.total_skipped,
                last_updated: statsData.last_updated || new Date().toISOString(),
                updated_at: new Date().toISOString()
            }, { onConflict: 'id' });

        if (error) throw error;
        return 'OK';
    }

    async getGeocodingStats() {
        const { data, error } = await this.supabase
            .from(GEOCODING_STATS_TABLE)
            .select('*')
            .eq('id', 'global')
            .single();

        if (error) {
            if (error.code === 'PGRST116') return null;
            throw error;
        }

        return JSON.stringify({
            total_processed: data.total_processed,
            total_geocoded: data.total_geocoded,
            total_failed: data.total_failed,
            total_skipped: data.total_skipped,
            last_updated: data.last_updated
        });
    }

    // Batch log operations
    async setBatchLog(key, value) {
        const batchId = key.replace('batch:', '');
        const logData = typeof value === 'string' ? JSON.parse(value) : value;

        const { error } = await this.supabase
            .from(BATCH_LOGS_TABLE)
            .upsert({
                batch_id: batchId,
                completed_at: logData.completed_at,
                batch_size: logData.batch_size,
                skip_count: logData.skip_count,
                processed: logData.results?.processed || 0,
                geocoded: logData.results?.geocoded || 0,
                failed: logData.results?.failed || 0,
                skipped: logData.results?.skipped || 0,
                created_at: new Date().toISOString()
            }, { onConflict: 'batch_id' });

        if (error) throw error;
        return 'OK';
    }

    async getBatchLog(key) {
        const batchId = key.replace('batch:', '');

        const { data, error } = await this.supabase
            .from(BATCH_LOGS_TABLE)
            .select('*')
            .eq('batch_id', batchId)
            .single();

        if (error) {
            if (error.code === 'PGRST116') return null;
            throw error;
        }

        return JSON.stringify({
            completed_at: data.completed_at,
            batch_size: data.batch_size,
            skip_count: data.skip_count,
            results: {
                processed: data.processed,
                geocoded: data.geocoded,
                failed: data.failed,
                skipped: data.skipped
            }
        });
    }

    // Bulk operations for efficiency
    async keys(pattern = '*') {
        await this.initialize();

        try {
            if (pattern === 'customer:*') {
                const { data, error } = await this.supabase
                    .from(CUSTOMERS_TABLE)
                    .select('id');

                if (error) throw error;
                return data.map(row => `customer:${row.id}`);
            }

            // Fallback to generic key-value store
            const { data, error } = await this.supabase
                .from('key_value_store')
                .select('key');

            if (error) throw error;

            const keys = data.map(row => row.key);

            if (pattern === '*') return keys;

            const regex = new RegExp(pattern.replace(/\*/g, '.*'));
            return keys.filter(key => regex.test(key));
        } catch (error) {
            console.error('[SUPABASE] Keys error:', error);
            return [];
        }
    }

    async mget(keys) {
        const results = [];
        for (const key of keys) {
            results.push(await this.get(key));
        }
        return results;
    }

    async del(key) {
        await this.initialize();

        try {
            if (key.startsWith('customer:')) {
                const customerId = key.replace('customer:', '');
                const { error } = await this.supabase
                    .from(CUSTOMERS_TABLE)
                    .delete()
                    .eq('id', customerId);

                if (error) throw error;
                return 1;
            } else {
                const { error } = await this.supabase
                    .from('key_value_store')
                    .delete()
                    .eq('key', key);

                if (error) throw error;
                return 1;
            }
        } catch (error) {
            console.error('[SUPABASE] Delete error:', error);
            return 0;
        }
    }

    // Advanced customer queries
    async getAllCustomers(filters = {}) {
        await this.initialize();

        let query = this.supabase
            .from(CUSTOMERS_TABLE)
            .select('*')
            .order('name', { ascending: true });

        // Apply filters
        if (filters.geocoded_only) {
            query = query.not('latitude', 'is', null);
            query = query.not('longitude', 'is', null);
        }

        if (filters.search) {
            const searchTerm = `%${filters.search.toLowerCase()}%`;
            query = query.or(`name.ilike.${searchTerm},email.ilike.${searchTerm},cep.ilike.%${filters.search}%,city.ilike.${searchTerm},address.ilike.${searchTerm}`);
        }

        // Pagination
        if (filters.limit) {
            query = query.limit(filters.limit);
        }

        if (filters.offset) {
            query = query.range(filters.offset, filters.offset + (filters.limit || 25) - 1);
        }

        const { data, error } = await query;

        if (error) throw error;
        return data || [];
    }

    async getCustomerStats() {
        await this.initialize();

        const { data, error } = await this.supabase
            .from(CUSTOMERS_TABLE)
            .select('latitude, longitude');

        if (error) throw error;

        const total = data.length;
        const geocoded = data.filter(c => c.latitude && c.longitude).length;

        return {
            total,
            geocoded,
            pending: total - geocoded,
            geocodingRate: total > 0 ? Math.round((geocoded / total) * 100) : 0
        };
    }

    // Cleanup expired keys
    async cleanup() {
        await this.initialize();

        const { error } = await this.supabase
            .from('key_value_store')
            .delete()
            .lt('expires_at', new Date().toISOString());

        if (error) {
            console.error('[SUPABASE] Cleanup error:', error);
        } else {
            console.log('[SUPABASE] Cleanup completed');
        }
    }
}

// Create singleton instance
const supabaseKV = new SupabaseKV();

export default supabaseKV;
export { supabaseKV, supabase };