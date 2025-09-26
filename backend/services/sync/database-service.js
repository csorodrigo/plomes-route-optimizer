const { supabase, supabaseAdmin } = require('../../database/supabase');
const crypto = require('crypto');

const client = supabaseAdmin || supabase;

function chunkArray(items, size) {
    if (!Array.isArray(items) || items.length === 0) {
        return [];
    }
    const chunks = [];
    for (let i = 0; i < items.length; i += size) {
        chunks.push(items.slice(i, i + size));
    }
    return chunks;
}

function normalizeTags(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed)) return parsed;
        } catch (_) {
            const parts = value.split(',').map(part => part.trim()).filter(Boolean);
            if (parts.length > 0) return parts;
        }
    }
    return [];
}

function toIso(value) {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
        return null;
    }
    return date.toISOString();
}

function toNumber(value) {
    if (value === null || value === undefined || value === '') return null;
    const result = Number(value);
    return Number.isFinite(result) ? result : null;
}

function generateId() {
    const timestamp = Date.now();
    const randomPart = Math.floor(Math.random() * 1000);
    return Number(`${timestamp}${randomPart.toString().padStart(3, '0')}`);
}

class DatabaseService {
    constructor() {
        this.client = client;
        this.publicClient = supabase;
        this.isInitialized = false;
        this.initializationPromise = null;
    }

    async ensureInitialized() {
        if (this.isInitialized) return;
        if (!this.initializationPromise) {
            this.initializationPromise = this.initialize();
        }
        return this.initializationPromise;
    }

    async initialize() {
        if (this.isInitialized) return;

        try {
            try {
                await this.client.rpc('create_customers_table_if_not_exists', {});
            } catch (_) {}

            try {
                await this.client.rpc('create_geocoding_stats_table_if_not_exists', {});
            } catch (_) {}

            try {
                await this.client.rpc('create_batch_logs_table_if_not_exists', {});
            } catch (_) {}

            // Simple connectivity check
            await this.client
                .from('customers')
                .select('id')
                .limit(1);

            this.isInitialized = true;
        } catch (error) {
            this.initializationPromise = null;
            throw error;
        }
    }

    async createTables() {
        return Promise.resolve();
    }

    async runMigrations() {
        return Promise.resolve();
    }

    async createIndexes() {
        return Promise.resolve();
    }

    mapCustomerInput(customer) {
        if (!customer) return null;

        const id = (customer.id ?? customer.ploome_id ?? customer.ploomeId ?? customer.ploomePersonId);
        if (!id) {
            throw new Error('Customer id is required');
        }

        const normalizedTags = normalizeTags(customer.tags);
        const streetAddress = customer.street_address || customer.streetAddress || customer.address || null;
        const fullAddress = customer.full_address || customer.fullAddress || customer.geocoded_address || customer.geocodedAddress || streetAddress;

        return {
            id: String(id),
            ploome_person_id: String(customer.ploome_person_id || customer.ploomeId || customer.ploomePersonId || id),
            name: customer.name || null,
            cnpj: customer.cnpj || null,
            cpf: customer.cpf || null,
            email: customer.email || null,
            phone: customer.phone || null,
            cep: customer.cep || null,
            street_address: streetAddress || null,
            street_number: customer.street_number || customer.streetNumber || null,
            street_complement: customer.street_complement || customer.streetComplement || null,
            neighborhood: customer.neighborhood || null,
            city: customer.city || null,
            state: customer.state || null,
            address: streetAddress || null,
            full_address: fullAddress || null,
            geocoded_address: customer.geocoded_address || customer.geocodedAddress || fullAddress || null,
            tags: normalizedTags.length ? normalizedTags : null,
            latitude: toNumber(customer.latitude),
            longitude: toNumber(customer.longitude),
            geocoding_status: customer.geocoding_status || customer.geocodingStatus || 'pending',
            geocoding_attempts: toNumber(customer.geocoding_attempts || customer.geocodingAttempts) || 0,
            last_geocoding_attempt: toIso(customer.last_geocoding_attempt || customer.lastGeocodingAttempt),
            geocoded_at: toIso(customer.geocoded_at || customer.geocodedAt),
            created_at: toIso(customer.created_at || customer.createdAt) || new Date().toISOString(),
            updated_at: toIso(customer.updated_at || customer.updatedAt) || new Date().toISOString()
        };
    }

    mapCustomerOutput(row) {
        if (!row) return null;
        return {
            ...row,
            tags: normalizeTags(row.tags),
            latitude: toNumber(row.latitude),
            longitude: toNumber(row.longitude)
        };
    }

    async upsertCustomer(customer) {
        await this.ensureInitialized();
        const payload = this.mapCustomerInput(customer);
        const { error } = await this.client
            .from('customers')
            .upsert(payload, { onConflict: 'id' });

        if (error) throw error;
        return { successCount: 1, errorCount: 0 };
    }

    async upsertCustomersBatch(customers) {
        await this.ensureInitialized();
        if (!Array.isArray(customers) || customers.length === 0) {
            return { successCount: 0, errorCount: 0 };
        }

        // Optimized batch size for mass operations
        const batches = chunkArray(customers, 100);
        let successCount = 0;
        let errorCount = 0;
        const startTime = performance.now();

        console.log(`🚀 Starting batch upsert: ${customers.length} customers in ${batches.length} batches`);

        // Process batches with controlled concurrency
        const maxConcurrentBatches = 3;
        for (let i = 0; i < batches.length; i += maxConcurrentBatches) {
            const batchGroup = batches.slice(i, i + maxConcurrentBatches);

            const promises = batchGroup.map(async (batch, batchIndex) => {
                try {
                    const payload = batch.map((item) => this.mapCustomerInput(item));
                    const { error } = await this.client
                        .from('customers')
                        .upsert(payload, {
                            onConflict: 'id',
                            ignoreDuplicates: false
                        });

                    if (error) {
                        console.error(`❌ Batch ${i + batchIndex + 1} failed:`, error.message);
                        return { success: 0, errors: batch.length };
                    } else {
                        console.log(`✅ Batch ${i + batchIndex + 1}/${batches.length} completed: ${batch.length} customers`);
                        return { success: batch.length, errors: 0 };
                    }
                } catch (err) {
                    console.error(`💥 Batch ${i + batchIndex + 1} error:`, err.message);
                    return { success: 0, errors: batch.length };
                }
            });

            const results = await Promise.allSettled(promises);

            results.forEach(result => {
                if (result.status === 'fulfilled') {
                    successCount += result.value.success;
                    errorCount += result.value.errors;
                } else {
                    errorCount += 100; // Default batch size
                }
            });

            // Small delay between batch groups to prevent overwhelming
            if (i + maxConcurrentBatches < batches.length) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        const duration = performance.now() - startTime;
        const rate = Math.round(customers.length / (duration / 1000));
        console.log(`📊 Batch operation completed: ${successCount} success, ${errorCount} errors in ${Math.round(duration)}ms (${rate} records/sec)`);

        return { successCount, errorCount };
    }

    async listCustomers(options = {}) {
        await this.ensureInitialized();
        const { status, tag = 'Cliente' } = options;

        const pageSize = 1000;
        let page = 0;
        const rows = [];

        while (true) {
            const from = page * pageSize;
            const to = from + pageSize - 1;

            let query = this.client
                .from('customers')
                .select('*')
                .range(from, to);

            if (status) {
                query = query.eq('geocoding_status', status);
            }

            const { data, error } = await query;
            if (error) throw error;

            if (!data || data.length === 0) {
                break;
            }

            rows.push(...data);

            if (data.length < pageSize) {
                break;
            }

            page += 1;
        }

        let customers = rows.map((row) => this.mapCustomerOutput(row));

        if (tag) {
            const needle = tag.toLowerCase();
            customers = customers.filter((customer) => {
                const tagList = normalizeTags(customer.tags).map((t) => t.toLowerCase());
                return tagList.includes(needle);
            });
        }

        customers.sort((a, b) => {
            const aGeo = a.latitude && a.longitude ? 0 : 1;
            const bGeo = b.latitude && b.longitude ? 0 : 1;
            if (aGeo !== bGeo) return aGeo - bGeo;
            return (a.name || '').localeCompare(b.name || '', 'pt-BR', { sensitivity: 'base' });
        });
        return customers;
    }

    async getCustomersByDistance(originLat, originLng, maxDistanceKm) {
        await this.ensureInitialized();

        const pageSize = 1000;
        let page = 0;
        const rows = [];

        while (true) {
            const from = page * pageSize;
            const to = from + pageSize - 1;

            const { data, error } = await this.client
                .from('customers')
                .select('*')
                .not('latitude', 'is', null)
                .not('longitude', 'is', null)
                .range(from, to);

            if (error) throw error;

            if (!data || data.length === 0) {
                break;
            }

            rows.push(...data);

            if (data.length < pageSize) {
                break;
            }

            page += 1;
        }

        const toRad = (deg) => deg * (Math.PI / 180);
        const earthRadiusKm = 6371;

        const customers = rows.map((row) => {
            const customer = this.mapCustomerOutput(row);
            const lat1 = toNumber(customer.latitude);
            const lon1 = toNumber(customer.longitude);
            const lat2 = toNumber(originLat);
            const lon2 = toNumber(originLng);

            if (lat1 === null || lon1 === null || lat2 === null || lon2 === null) {
                return { ...customer, distance_km: Infinity };
            }

            const dLat = toRad(lat2 - lat1);
            const dLon = toRad(lon2 - lon1);
            const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            const distance = earthRadiusKm * c;

            return { ...customer, distance_km: distance };
        });

        return customers
            .filter((customer) => {
                if (!Number.isFinite(customer.distance_km) || customer.distance_km > maxDistanceKm) {
                    return false;
                }
                const tags = normalizeTags(customer.tags);
                return tags.includes('Cliente');
            })
            .sort((a, b) => a.distance_km - b.distance_km);
    }

    async getCustomersForGeocoding(limit = 100) {
        await this.ensureInitialized();
        const effectiveLimit = Math.max(limit, 1);

        const { data, error } = await this.client
            .from('customers')
            .select('*')
            .eq('geocoding_status', 'pending')
            .order('updated_at', { ascending: false })
            .limit(effectiveLimit * 3);

        if (error) throw error;

        const candidates = (data || []).map((row) => this.mapCustomerOutput(row));
        const filtered = candidates.filter((customer) => {
            const attempts = toNumber(customer.geocoding_attempts) || 0;
            const hasAddress = Boolean(customer.cep) || Boolean(customer.full_address);
            return attempts < 3 && hasAddress;
        });

        return filtered.slice(0, effectiveLimit);
    }

    async updateCustomerCoordinates(customerId, lat, lng, status = 'completed') {
        await this.ensureInitialized();

        const { data: existing } = await this.client
            .from('customers')
            .select('geocoding_attempts')
            .eq('id', String(customerId))
            .maybeSingle();

        const attempts = toNumber(existing?.geocoding_attempts) || 0;
        const updateData = {
            latitude: toNumber(lat),
            longitude: toNumber(lng),
            geocoding_status: status,
            geocoding_attempts: attempts + 1,
            last_geocoding_attempt: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        if (status === 'completed' && updateData.latitude !== null && updateData.longitude !== null) {
            updateData.geocoded_at = new Date().toISOString();
        }

        const { error } = await this.client
            .from('customers')
            .update(updateData)
            .eq('id', String(customerId));

        if (error) throw error;
        return { success: true };
    }

    /**
     * Batch update customer coordinates for mass geocoding operations
     * Much more efficient than individual updates
     */
    async batchUpdateCustomerCoordinates(updates) {
        await this.ensureInitialized();
        if (!Array.isArray(updates) || updates.length === 0) {
            return { successCount: 0, errorCount: 0 };
        }

        const startTime = performance.now();
        console.log(`🔄 Starting batch coordinate updates: ${updates.length} customers`);

        const batches = chunkArray(updates, 50);
        let successCount = 0;
        let errorCount = 0;

        // Process batches sequentially to avoid overwhelming database
        for (let i = 0; i < batches.length; i++) {
            const batch = batches[i];

            try {
                // Prepare update data for each customer in batch
                const updatePromises = batch.map(async ({ customerId, lat, lng, status = 'completed', geocoded_address = null }) => {
                    const now = new Date().toISOString();
                    const updateData = {
                        latitude: toNumber(lat),
                        longitude: toNumber(lng),
                        geocoding_status: status,
                        geocoding_attempts: 1, // Will be updated properly in production
                        last_geocoding_attempt: now,
                        updated_at: now
                    };

                    if (status === 'completed' && updateData.latitude !== null && updateData.longitude !== null) {
                        updateData.geocoded_at = now;
                    }

                    if (geocoded_address) {
                        updateData.geocoded_address = geocoded_address;
                    }

                    return this.client
                        .from('customers')
                        .update(updateData)
                        .eq('id', String(customerId));
                });

                const results = await Promise.allSettled(updatePromises);

                let batchSuccess = 0;
                let batchErrors = 0;

                results.forEach((result, idx) => {
                    if (result.status === 'fulfilled' && !result.value.error) {
                        batchSuccess++;
                    } else {
                        batchErrors++;
                        if (result.status === 'rejected') {
                            console.error(`❌ Customer ${batch[idx].customerId} update failed:`, result.reason.message);
                        } else if (result.value.error) {
                            console.error(`❌ Customer ${batch[idx].customerId} update failed:`, result.value.error.message);
                        }
                    }
                });

                successCount += batchSuccess;
                errorCount += batchErrors;

                console.log(`✅ Batch ${i + 1}/${batches.length} completed: ${batchSuccess} success, ${batchErrors} errors`);

                // Small delay between batches
                if (i < batches.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 50));
                }

            } catch (error) {
                console.error(`💥 Batch ${i + 1} failed:`, error.message);
                errorCount += batch.length;
            }
        }

        const duration = performance.now() - startTime;
        const rate = Math.round(updates.length / (duration / 1000));
        console.log(`📊 Batch coordinate updates completed: ${successCount} success, ${errorCount} errors in ${Math.round(duration)}ms (${rate} updates/sec)`);

        return { successCount, errorCount };
    }

    async updateGeocodingStatus(customerId, status) {
        await this.ensureInitialized();

        const { data: existing } = await this.client
            .from('customers')
            .select('geocoding_attempts')
            .eq('id', String(customerId))
            .maybeSingle();

        const attempts = toNumber(existing?.geocoding_attempts) || 0;
        const updateData = {
            geocoding_status: status,
            geocoding_attempts: attempts + 1,
            last_geocoding_attempt: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        const { error } = await this.client
            .from('customers')
            .update(updateData)
            .eq('id', String(customerId));

        if (error) throw error;
        return { success: true };
    }

    async getCachedGeocoding(address) {
        await this.ensureInitialized();
        if (!address) return null;

        const { data, error } = await this.client
            .from('geocoding_cache')
            .select('*')
            .eq('address', address)
            .limit(1)
            .maybeSingle();

        if (error && error.code !== 'PGRST116') throw error;
        if (!data) return null;

        if (data.expires_at && new Date(data.expires_at) <= new Date()) {
            await this.client
                .from('geocoding_cache')
                .delete()
                .eq('id', data.id);
            return null;
        }

        return data;
    }

    async saveGeocodingCache(address, lat, lng, provider = 'nominatim', ttlDays = 30) {
        await this.ensureInitialized();
        if (!address) return;

        const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000).toISOString();

        const payload = {
            id: generateId(),
            address,
            latitude: toNumber(lat),
            longitude: toNumber(lng),
            provider,
            accuracy: null,
            created_at: new Date().toISOString(),
            expires_at: expiresAt
        };

        const { error } = await this.client
            .from('geocoding_cache')
            .upsert(payload, { onConflict: 'address' });

        if (error) throw error;
    }

    async saveRoute(route) {
        await this.ensureInitialized();
        const routeId = route.id || generateId();

        const payload = {
            id: routeId,
            name: route.name || `Rota ${new Date().toLocaleDateString('pt-BR')}`,
            origin_cep: route.originCep || route.origin_cep || null,
            origin_lat: toNumber(route.originLat || route.origin_lat),
            origin_lng: toNumber(route.originLng || route.origin_lng),
            waypoints: route.waypoints || [],
            optimized_order: route.optimizedOrder || route.optimized_order || [],
            total_distance: toNumber(route.totalDistance || route.total_distance),
            estimated_time: toNumber(route.estimatedTime || route.estimated_time),
            created_at: new Date().toISOString()
        };

        const { error } = await this.client
            .from('routes')
            .upsert(payload, { onConflict: 'id' });

        if (error) throw error;
        return { id: routeId };
    }

    async getRoutes(limit = 50) {
        await this.ensureInitialized();
        const { data, error } = await this.client
            .from('routes')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return (data || []).map((row) => ({
            ...row,
            waypoints: Array.isArray(row.waypoints) ? row.waypoints : [],
            optimized_order: Array.isArray(row.optimized_order) ? row.optimized_order : []
        }));
    }

    async logSync(logData) {
        await this.ensureInitialized();
        const payload = {
            id: generateId(),
            sync_type: logData.type || null,
            records_fetched: toNumber(logData.fetched) || 0,
            records_updated: toNumber(logData.updated) || 0,
            errors: toNumber(logData.errors) || 0,
            started_at: toIso(logData.startedAt) || new Date().toISOString(),
            completed_at: toIso(logData.completedAt) || new Date().toISOString(),
            status: logData.status || null,
            error_message: logData.errorMessage || null
        };

        const { error } = await this.client
            .from('sync_logs')
            .upsert(payload, { onConflict: 'id' });

        if (error) throw error;
        return payload;
    }

    async getStatistics() {
        await this.ensureInitialized();

        const [totalRes, geocodedRes, pendingRes, withCepRes, routesRes, lastSyncData] = await Promise.all([
            this.client.from('customers').select('*', { count: 'exact', head: true }),
            this.client.from('customers').select('*', { count: 'exact', head: true }).not('latitude', 'is', null).not('longitude', 'is', null),
            this.client.from('customers').select('*', { count: 'exact', head: true }).eq('geocoding_status', 'pending'),
            this.client.from('customers').select('*', { count: 'exact', head: true }).not('cep', 'is', null),
            this.client.from('routes').select('*', { count: 'exact', head: true }),
            this.client
                .from('sync_logs')
                .select('*')
                .eq('status', 'success')
                .order('completed_at', { ascending: false })
                .limit(1)
                .maybeSingle()
        ]);

        const totalCustomers = totalRes?.count || 0;
        const geocodedCustomers = geocodedRes?.count || 0;
        const pendingGeocoding = pendingRes?.count || 0;
        const customersWithCep = withCepRes?.count || 0;
        const totalRoutes = routesRes?.count || 0;

        return {
            totalCustomers,
            geocodedCustomers,
            pendingGeocoding,
            customersWithCep,
            totalRoutes,
            lastSync: lastSyncData || null,
            withCoordinates: geocodedCustomers,
            withoutCoordinates: Math.max(totalCustomers - geocodedCustomers, 0)
        };
    }

    async getGeocodingStats() {
        await this.ensureInitialized();
        const { data, error } = await this.client
            .from('customers')
            .select('geocoding_status');

        if (error) throw error;

        const stats = { pending: 0, completed: 0, failed: 0, error: 0 };
        (data || []).forEach((row) => {
            const status = row.geocoding_status || 'pending';
            if (stats[status] !== undefined) {
                stats[status] += 1;
            }
        });
        return stats;
    }

    async getPendingGeocoding(limit = 10) {
        return this.getCustomersForGeocoding(limit);
    }

    async getGeocodedCustomers(limit = 1000) {
        await this.ensureInitialized();
        const { data, error } = await this.client
            .from('customers')
            .select('*')
            .not('latitude', 'is', null)
            .not('longitude', 'is', null)
            .order('updated_at', { ascending: false })
            .limit(limit * 2);

        if (error) throw error;
        return (data || [])
            .map((row) => this.mapCustomerOutput(row))
            .filter((customer) => normalizeTags(customer.tags).includes('Cliente'))
            .slice(0, limit);
    }

    async close() {
        return Promise.resolve();
    }

    async deleteEntireTable(table, column = 'id') {
        await this.ensureInitialized();
        const { error } = await this.client
            .from(table)
            .delete()
            .not(column, 'is', null);
        if (error) throw error;
    }

    async deleteAllCustomers() {
        await this.deleteEntireTable('customers');
    }

    async deleteAllSyncLogs() {
        await this.deleteEntireTable('sync_logs');
    }

    async deleteAllRoutes() {
        await this.deleteEntireTable('routes');
    }

    async deleteAllGeocodingCache() {
        await this.deleteEntireTable('geocoding_cache');
    }

    // Deprecated methods retained for backward compatibility. They now throw
    // explicit errors to highlight the need to use Supabase-specific helpers.
    async run() {
        throw new Error('DatabaseService.run is not supported with the Supabase backend. Use dedicated helper methods.');
    }

    async get() {
        throw new Error('DatabaseService.get is not supported with the Supabase backend. Use dedicated helper methods.');
    }

    async all() {
        throw new Error('DatabaseService.all is not supported with the Supabase backend. Use dedicated helper methods.');
    }

    async ensureDefaultUser() {
        const defaultEmail = 'gustavo.canuto@ciaramaquinas.com.br';
        const defaultPassword = 'ciara123@';
        const defaultName = 'Gustavo Canuto';

        const existing = await this.getUserByEmail(defaultEmail);
        if (existing) {
            return existing;
        }

        const salt = crypto.randomBytes(32).toString('hex');
        const hash = crypto.createHash('sha256').update(defaultPassword + salt).digest('hex');
        const passwordHash = `${salt}:${hash}`;

        return this.createUser({ email: defaultEmail, name: defaultName, passwordHash });
    }

    async getUserByEmail(email) {
        await this.ensureInitialized();
        if (!email) return null;

        const { data, error } = await this.client
            .from('legacy_users')
            .select('*')
            .eq('email', email.toLowerCase())
            .maybeSingle();

        if (error && error.code !== 'PGRST116') throw error;
        return data || null;
    }

    async getUserById(id, options = {}) {
        await this.ensureInitialized();
        if (!id) return null;

        const columns = options.includePassword
            ? '*'
            : 'id, email, name, is_active, created_at, updated_at, last_login';

        const { data, error } = await this.client
            .from('legacy_users')
            .select(columns)
            .eq('id', id)
            .maybeSingle();

        if (error && error.code !== 'PGRST116') throw error;
        return data || null;
    }

    async createUser({ email, name, passwordHash }) {
        await this.ensureInitialized();
        const now = new Date().toISOString();
        const payload = {
            id: generateId(),
            email: email.toLowerCase(),
            name: name.trim(),
            password_hash: passwordHash,
            is_active: true,
            created_at: now,
            updated_at: now
        };

        const { data, error } = await this.client
            .from('legacy_users')
            .insert(payload)
            .select()
            .maybeSingle();

        if (error) throw error;
        return data;
    }

    async updateUserLogin(id) {
        await this.ensureInitialized();
        const now = new Date().toISOString();
        const { error } = await this.client
            .from('legacy_users')
            .update({ last_login: now, updated_at: now })
            .eq('id', id);
        if (error) throw error;
    }

    async updateUserName(id, name) {
        await this.ensureInitialized();
        const { error } = await this.client
            .from('legacy_users')
            .update({ name: name.trim(), updated_at: new Date().toISOString() })
            .eq('id', id);
        if (error) throw error;
    }

    async updateUserPassword(id, passwordHash) {
        await this.ensureInitialized();
        const { error } = await this.client
            .from('legacy_users')
            .update({ password_hash: passwordHash, updated_at: new Date().toISOString() })
            .eq('id', id);
        if (error) throw error;
    }

    async createSession({ userId, tokenHash, expiresAt, userAgent, ipAddress }) {
        await this.ensureInitialized();
        const payload = {
            id: generateId(),
            user_id: userId,
            token_hash: tokenHash,
            expires_at: toIso(expiresAt) || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            created_at: new Date().toISOString(),
            user_agent: userAgent || null,
            ip_address: ipAddress || null
        };

        const { error } = await this.client
            .from('legacy_user_sessions')
            .insert(payload);

        if (error) throw error;
        return payload;
    }

    async deleteSession(userId, tokenHash) {
        await this.ensureInitialized();
        const { error } = await this.client
            .from('legacy_user_sessions')
            .delete()
            .eq('user_id', userId)
            .eq('token_hash', tokenHash);
        if (error) throw error;
    }

    async deleteSessionsByUser(userId) {
        await this.ensureInitialized();
        const { error } = await this.client
            .from('legacy_user_sessions')
            .delete()
            .eq('user_id', userId);
        if (error) throw error;
    }

    async cleanupExpiredSessions() {
        await this.ensureInitialized();
        const now = new Date().toISOString();
        const { data, error } = await this.client
            .from('legacy_user_sessions')
            .delete()
            .lte('expires_at', now)
            .select('id');
        if (error) throw error;
        return data ? data.length : 0;
    }

    async getUserStatsSummary() {
        await this.ensureInitialized();
        const [{ count: totalUsers }, { count: activeSessions }] = await Promise.all([
            this.client.from('legacy_users').select('*', { count: 'exact', head: true }).eq('is_active', true),
            this.client.from('legacy_user_sessions').select('*', { count: 'exact', head: true }).gt('expires_at', new Date().toISOString())
        ]);

        return {
            totalUsers: totalUsers || 0,
            activeSessions: activeSessions || 0
        };
    }
}

module.exports = DatabaseService;
module.exports.normalizeTags = normalizeTags;
