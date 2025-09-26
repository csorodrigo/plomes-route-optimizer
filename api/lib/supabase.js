// Supabase client for Vercel serverless functions
// Using CommonJS for better Vercel compatibility
const { createClient } = require('@supabase/supabase-js');

// Validação das variáveis de ambiente
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY are required');
}

// Cliente principal (para uso geral) - Optimized for serverless
const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        persistSession: false, // Desabilitado para uso server-side
        autoRefreshToken: false
    },
    global: {
        headers: {
            'connection': 'keep-alive'
        }
    },
    db: {
        schema: 'public'
    }
});

// Cliente com Service Role (para operações administrativas)
const supabaseAdmin = supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false
        },
        global: {
            headers: {
                'connection': 'keep-alive',
                'prefer': 'return=minimal'
            }
        },
        db: {
            schema: 'public'
        }
    })
    : supabase;

/**
 * Supabase Key-Value storage interface for serverless functions
 * Provides optimized methods for common database operations
 */
class SupabaseKV {
    constructor(client = supabase, adminClient = supabaseAdmin) {
        this.client = client;
        this.admin = adminClient;
    }

    /**
     * Get all customers with filters
     * @param {Object} filters - Filter options
     * @param {string} filters.search - Search term
     * @param {boolean} filters.geocoded_only - Only geocoded customers
     * @param {number} filters.limit - Limit results
     * @param {number} filters.offset - Offset for pagination
     */
    async getAllCustomers(filters = {}) {
        try {
            let query = this.client.from('customers').select('*');

            // Apply search filter
            if (filters.search) {
                query = query.or(`name.ilike.%${filters.search}%,email.ilike.%${filters.search}%,city.ilike.%${filters.search}%`);
            }

            // Apply geocoded filter
            if (filters.geocoded_only) {
                query = query.not('latitude', 'is', null).not('longitude', 'is', null);
            }

            // Apply pagination
            if (filters.limit) {
                query = query.limit(filters.limit);
            }
            if (filters.offset) {
                query = query.range(filters.offset, filters.offset + (filters.limit || 25) - 1);
            }

            // Order by name
            query = query.order('name', { ascending: true });

            const { data, error } = await query;

            if (error) {
                console.error('Error fetching customers:', error);
                return [];
            }

            return data || [];
        } catch (err) {
            console.error('Critical error fetching customers:', err);
            return [];
        }
    }

    /**
     * Get customer statistics
     */
    async getCustomerStats() {
        try {
            // Get total count
            const { count: total, error: totalError } = await this.client
                .from('customers')
                .select('*', { count: 'exact', head: true });

            if (totalError) {
                console.error('Error getting total count:', totalError);
                return { total: 0, geocoded: 0, pending: 0 };
            }

            // Get geocoded count
            const { count: geocoded, error: geocodedError } = await this.client
                .from('customers')
                .select('*', { count: 'exact', head: true })
                .not('latitude', 'is', null)
                .not('longitude', 'is', null);

            if (geocodedError) {
                console.error('Error getting geocoded count:', geocodedError);
            }

            const geocodedCount = geocoded || 0;
            const totalCount = total || 0;
            const pending = totalCount - geocodedCount;

            return {
                total: totalCount,
                geocoded: geocodedCount,
                pending: pending,
                geocodingRate: totalCount > 0 ? ((geocodedCount / totalCount) * 100).toFixed(1) : '0'
            };
        } catch (err) {
            console.error('Critical error getting customer stats:', err);
            return { total: 0, geocoded: 0, pending: 0 };
        }
    }

    /**
     * Get geocoding statistics from cache
     */
    async getGeocodingStats() {
        try {
            const { data, error } = await this.client
                .from('cache')
                .select('value')
                .eq('key', 'geocoding_stats')
                .single();

            if (error && error.code !== 'PGRST116') {
                console.error('Error getting geocoding stats:', error);
                return null;
            }

            return data?.value || null;
        } catch (err) {
            console.error('Critical error getting geocoding stats:', err);
            return null;
        }
    }

    /**
     * Store geocoding statistics in cache
     */
    async setGeocodingStats(stats) {
        try {
            const statsJson = typeof stats === 'string' ? stats : JSON.stringify(stats);

            const { error } = await this.client
                .from('cache')
                .upsert(
                    {
                        key: 'geocoding_stats',
                        value: statsJson,
                        updated_at: new Date().toISOString()
                    },
                    { onConflict: 'key' }
                );

            if (error) {
                console.error('Error setting geocoding stats:', error);
                return false;
            }

            return true;
        } catch (err) {
            console.error('Critical error setting geocoding stats:', err);
            return false;
        }
    }

    /**
     * Store customer data in Supabase
     */
    async storeCustomers(customers) {
        try {
            if (!Array.isArray(customers) || customers.length === 0) {
                console.log('No customers to store');
                return true;
            }

            // Process in batches to avoid payload limits
            const batchSize = 100;
            const batches = [];

            for (let i = 0; i < customers.length; i += batchSize) {
                batches.push(customers.slice(i, i + batchSize));
            }

            console.log(`Storing ${customers.length} customers in ${batches.length} batches...`);

            for (let i = 0; i < batches.length; i++) {
                const batch = batches[i];
                console.log(`Processing batch ${i + 1}/${batches.length} (${batch.length} customers)...`);

                const { error } = await this.admin
                    .from('customers')
                    .upsert(batch, {
                        onConflict: 'ploome_person_id',
                        ignoreDuplicates: false
                    });

                if (error) {
                    console.error(`Error storing batch ${i + 1}:`, error);
                    return false;
                }

                // Small delay between batches to avoid rate limits
                if (i < batches.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }

            console.log(`✅ Successfully stored ${customers.length} customers in Supabase`);
            return true;
        } catch (err) {
            console.error('Critical error storing customers:', err);
            return false;
        }
    }

    /**
     * Test connection to Supabase
     */
    async testConnection() {
        try {
            const { data, error } = await this.client.from('customers').select('id').limit(1);

            if (error && error.code === 'PGRST116') {
                // Table doesn't exist yet - this is expected on first run
                console.log('✅ Supabase connection OK (tables not created yet)');
                return true;
            }

            if (error) {
                console.error('❌ Supabase connection error:', error);
                return false;
            }

            console.log('✅ Supabase connection OK');
            return true;
        } catch (err) {
            console.error('❌ Critical Supabase connection error:', err);
            return false;
        }
    }
}

// Create singleton instance
const supabaseKV = new SupabaseKV(supabase, supabaseAdmin);

module.exports = supabaseKV;
module.exports.supabase = supabase;
module.exports.supabaseAdmin = supabaseAdmin;
module.exports.SupabaseKV = SupabaseKV;