const EventEmitter = require('events');

class GeocodingQueue extends EventEmitter {
    constructor(geocodingService, databaseService) {
        super();
        this.geocodingService = geocodingService;
        this.db = databaseService;
        this.processing = false;
        this.batchSize = 50; // Aumentado significativamente para processar muito mais rápido
        this.delayMs = 200; // Reduzido para acelerar o processo
        this.progress = { current: 0, total: 0 };
    }

    async startProcessing() {
        if (this.processing) {
            console.log('Geocoding already in progress');
            return;
        }

        this.processing = true;
        console.log('🚀 Starting geocoding queue processing...');

        try {
            // Contar total de pendentes
            const stats = await this.db.getGeocodingStats();
            this.progress.total = stats.pending;
            this.progress.current = 0;

            while (this.processing) {
                // Buscar clientes pendentes
                const pending = await this.db.getPendingGeocoding(this.batchSize);
                
                if (pending.length === 0) {
                    console.log('✅ No more customers to geocode');
                    break;
                }

                console.log(`Processing batch of ${pending.length} customers...`);

                for (const customer of pending) {
                    if (!this.processing) break;

                    try {
                        // Tentar geocodificar
                        const result = await this.geocodeCustomer(customer);
                        
                        if (result) {
                            // Atualizar no banco
                            await this.db.updateCustomerCoordinates(
                                customer.id,
                                result.lat,
                                result.lng,
                                'completed'
                            );
                            
                            this.progress.current++;
                            console.log(`✅ Geocoded ${customer.name} (${this.progress.current}/${this.progress.total})`);
                        } else {
                            // Marcar como falha
                            await this.db.updateGeocodingStatus(customer.id, 'failed');
                            console.log(`❌ Failed to geocode ${customer.name}`);
                        }

                        // Emitir progresso
                        this.emit('progress', {
                            current: this.progress.current,
                            total: this.progress.total,
                            percentage: Math.round((this.progress.current / this.progress.total) * 100)
                        });

                        // Delay entre requisições
                        await this.delay(this.delayMs);
                        
                    } catch (error) {
                        console.error(`Error geocoding customer ${customer.id}:`, error.message);
                        await this.db.updateGeocodingStatus(customer.id, 'error');
                    }
                }
            }
        } catch (error) {
            console.error('Geocoding queue error:', error);
        } finally {
            this.processing = false;
            this.emit('complete', this.progress);
            console.log(`🏁 Geocoding complete: ${this.progress.current}/${this.progress.total}`);
        }
    }

    async geocodeCustomer(customer) {
        // Tentar diferentes estratégias
        let result = null;

        // 1. Tentar com endereço completo se disponível
        if (customer.full_address && customer.full_address !== 'Brasil') {
            result = await this.geocodingService.geocodeAddress(customer.full_address, customer.cep);
        }

        // 2. Tentar apenas com CEP se falhou
        if (!result && customer.cep) {
            result = await this.geocodingService.geocodeByCep(customer.cep);
        }

        // 3. Tentar com cidade + estado
        if (!result && customer.city && customer.state) {
            const cityAddress = `${customer.city}, ${customer.state}, Brasil`;
            result = await this.geocodingService.geocodeAddress(cityAddress);
        }

        return result;
    }

    stopProcessing() {
        this.processing = false;
        console.log('⏸️ Stopping geocoding queue...');
    }

    getProgress() {
        return this.progress;
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = GeocodingQueue;