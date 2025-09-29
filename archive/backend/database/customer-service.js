const { supabase } = require('./supabase');

/**
 * Service para gerenciar operações com customers no Supabase
 */
class CustomerService {

    /**
     * Busca todos os customers com filtros opcionais
     */
    async getAllCustomers(options = {}) {
        try {
            let query = supabase.from('customers').select('*');

            // Aplicar filtros
            if (options.limit) {
                query = query.limit(options.limit);
            }

            if (options.offset) {
                query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
            }

            if (options.orderBy) {
                query = query.order(options.orderBy, { ascending: options.ascending || false });
            } else {
                query = query.order('updated_at', { ascending: false });
            }

            // Filtros específicos
            if (options.geocoded === true) {
                query = query.not('latitude', 'is', null).not('longitude', 'is', null);
            } else if (options.geocoded === false) {
                query = query.or('latitude.is.null,longitude.is.null');
            }

            if (options.city) {
                query = query.ilike('city', `%${options.city}%`);
            }

            if (options.state) {
                query = query.eq('state', options.state);
            }

            const { data, error } = await query;

            if (error) {
                throw error;
            }

            return data || [];
        } catch (error) {
            console.error('Erro ao buscar customers:', error);
            throw error;
        }
    }

    /**
     * Busca customer por Ploome ID
     */
    async getCustomerByPloomeId(ploomeId) {
        try {
            const { data, error } = await supabase
                .from('customers')
                .select('*')
                .eq('ploome_id', ploomeId)
                .single();

            if (error && error.code !== 'PGRST116') {
                throw error;
            }

            return data;
        } catch (error) {
            console.error(`Erro ao buscar customer ${ploomeId}:`, error);
            throw error;
        }
    }

    /**
     * Cria um novo customer
     */
    async createCustomer(customerData) {
        try {
            const customer = {
                ploome_id: customerData.ploome_id || customerData.id,
                name: customerData.name || customerData.Nome,
                email: customerData.email || customerData.Email,
                cep: customerData.cep || customerData.CEP,
                address: customerData.address || customerData.Endereco,
                city: customerData.city || customerData.Cidade,
                state: customerData.state || customerData.Estado,
                latitude: customerData.latitude || customerData.lat,
                longitude: customerData.longitude || customerData.lng,
                geocoded_at: (customerData.latitude || customerData.lat) ? new Date().toISOString() : null
            };

            const { data, error } = await supabase
                .from('customers')
                .insert(customer)
                .select()
                .single();

            if (error) {
                throw error;
            }

            return data;
        } catch (error) {
            console.error('Erro ao criar customer:', error);
            throw error;
        }
    }

    /**
     * Atualiza customer existente
     */
    async updateCustomer(ploomeId, updates) {
        try {
            const updateData = {
                ...updates,
                updated_at: new Date().toISOString()
            };

            // Se está atualizando coordenadas, marcar quando foi geocodificado
            if ((updates.latitude || updates.longitude) && !updates.geocoded_at) {
                updateData.geocoded_at = new Date().toISOString();
            }

            const { data, error } = await supabase
                .from('customers')
                .update(updateData)
                .eq('ploome_id', ploomeId)
                .select()
                .single();

            if (error) {
                throw error;
            }

            return data;
        } catch (error) {
            console.error(`Erro ao atualizar customer ${ploomeId}:`, error);
            throw error;
        }
    }

    /**
     * Upsert (insert ou update) customer
     */
    async upsertCustomer(customerData) {
        try {
            const existing = await this.getCustomerByPloomeId(
                customerData.ploome_id || customerData.id
            );

            if (existing) {
                return await this.updateCustomer(existing.ploome_id, customerData);
            } else {
                return await this.createCustomer(customerData);
            }
        } catch (error) {
            console.error('Erro no upsert customer:', error);
            throw error;
        }
    }

    /**
     * Bulk upsert de múltiplos customers
     */
    async bulkUpsertCustomers(customers) {
        try {
            const results = {
                created: 0,
                updated: 0,
                errors: []
            };

            // Processar em lotes para evitar timeout
            const batchSize = 50;
            for (let i = 0; i < customers.length; i += batchSize) {
                const batch = customers.slice(i, i + batchSize);

                for (const customer of batch) {
                    try {
                        const result = await this.upsertCustomer(customer);
                        if (result.created_at === result.updated_at) {
                            results.created++;
                        } else {
                            results.updated++;
                        }
                    } catch (error) {
                        results.errors.push({
                            customer: customer.ploome_id || customer.id,
                            error: error.message
                        });
                    }
                }

                // Pequena pausa entre lotes
                if (i + batchSize < customers.length) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }

            return results;
        } catch (error) {
            console.error('Erro no bulk upsert:', error);
            throw error;
        }
    }

    /**
     * Busca customers não geocodificados
     */
    async getCustomersToGeocode(limit = 100) {
        try {
            const { data, error } = await supabase
                .from('customers')
                .select('*')
                .or('latitude.is.null,longitude.is.null')
                .not('cep', 'is', null)
                .limit(limit)
                .order('created_at', { ascending: true });

            if (error) {
                throw error;
            }

            return data || [];
        } catch (error) {
            console.error('Erro ao buscar customers para geocodificação:', error);
            throw error;
        }
    }

    /**
     * Atualiza coordenadas de um customer
     */
    async updateCustomerCoordinates(ploomeId, latitude, longitude) {
        try {
            return await this.updateCustomer(ploomeId, {
                latitude,
                longitude,
                geocoded_at: new Date().toISOString()
            });
        } catch (error) {
            console.error(`Erro ao atualizar coordenadas do customer ${ploomeId}:`, error);
            throw error;
        }
    }

    /**
     * Conta customers por status de geocodificação
     */
    async getCustomerStats() {
        try {
            const { count: total } = await supabase
                .from('customers')
                .select('*', { count: 'exact', head: true });

            const { count: geocoded } = await supabase
                .from('customers')
                .select('*', { count: 'exact', head: true })
                .not('latitude', 'is', null)
                .not('longitude', 'is', null);

            return {
                total: total || 0,
                geocoded: geocoded || 0,
                notGeocoded: (total || 0) - (geocoded || 0),
                percentage: total ? ((geocoded || 0) / total * 100).toFixed(2) : 0
            };
        } catch (error) {
            console.error('Erro ao obter estatísticas:', error);
            throw error;
        }
    }
}

module.exports = new CustomerService();