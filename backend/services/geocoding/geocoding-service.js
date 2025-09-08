const axios = require('axios');
const pLimit = require('p-limit');

class GeocodingService {
    constructor(database) {
        this.db = database;
        
        // Multiple geocoding providers for better accuracy
        this.providers = {
            // High-precision providers (prioritize these)
            googlemaps: {
                url: 'https://maps.googleapis.com/maps/api/geocode/json',
                rateLimiter: pLimit(50), // Google allows high rate
                delay: 50,
                priority: 1,
                requiresKey: true,
                accuracy: 'high'
            },
            mapbox: {
                url: 'https://api.mapbox.com/geocoding/v5/mapbox.places',
                rateLimiter: pLimit(10),
                delay: 100,
                priority: 2,
                requiresKey: true,
                accuracy: 'high'
            },
            positionstack: {
                url: 'http://api.positionstack.com/v1/forward',
                rateLimiter: pLimit(5),
                delay: 200,
                priority: 3,
                requiresKey: true,
                accuracy: 'medium'
            },
            // Brazilian CEP-specific providers
            opencep: {
                url: 'https://opencep.com/v1',
                rateLimiter: pLimit(5),
                delay: 200,
                priority: 4,
                requiresKey: false,
                accuracy: 'high',
                region: 'brazil'
            },
            awesomeapi: {
                url: 'https://cep.awesomeapi.com.br/json',
                rateLimiter: pLimit(3),
                delay: 300,
                priority: 5,
                requiresKey: false,
                accuracy: 'medium',
                region: 'brazil'
            },
            // Free providers as fallback
            nominatim: {
                url: 'https://nominatim.openstreetmap.org/search',
                rateLimiter: pLimit(1),
                delay: 1000,
                priority: 6,
                requiresKey: false,
                accuracy: 'medium'
            },
            brasilapi: {
                url: 'https://brasilapi.com.br/api/cep/v1',
                rateLimiter: pLimit(10),
                delay: 100,
                priority: 7,
                requiresKey: false,
                accuracy: 'low',
                region: 'brazil'
            },
            viacep: {
                url: 'https://viacep.com.br/ws',
                rateLimiter: pLimit(5),
                delay: 200,
                priority: 8,
                requiresKey: false,
                accuracy: 'low',
                region: 'brazil'
            },
            photon: {
                url: 'https://photon.komoot.io/api',
                rateLimiter: pLimit(2),
                delay: 500,
                priority: 9,
                requiresKey: false,
                accuracy: 'low'
            }
        };
        
        // Brazilian states coordinates for validation
        this.brazilianStates = {
            'AC': { name: 'Acre', bounds: { north: -7.0, south: -11.2, east: -66.6, west: -74.0 } },
            'AL': { name: 'Alagoas', bounds: { north: -8.8, south: -10.5, east: -35.1, west: -38.2 } },
            'AP': { name: 'Amapá', bounds: { north: 5.3, south: -4.4, east: -50.0, west: -54.9 } },
            'AM': { name: 'Amazonas', bounds: { north: 2.3, south: -9.8, east: -56.1, west: -73.8 } },
            'BA': { name: 'Bahia', bounds: { north: -8.5, south: -18.3, east: -37.3, west: -47.8 } },
            'CE': { name: 'Ceará', bounds: { north: -2.8, south: -7.9, east: -37.2, west: -41.4 } },
            'DF': { name: 'Distrito Federal', bounds: { north: -15.5, south: -16.1, east: -47.4, west: -48.3 } },
            'ES': { name: 'Espírito Santo', bounds: { north: -17.9, south: -21.3, east: -39.7, west: -41.9 } },
            'GO': { name: 'Goiás', bounds: { north: -12.4, south: -19.5, east: -45.9, west: -53.2 } },
            'MA': { name: 'Maranhão', bounds: { north: -1.0, south: -10.3, east: -41.8, west: -48.9 } },
            'MT': { name: 'Mato Grosso', bounds: { north: -7.3, south: -18.0, east: -50.2, west: -61.6 } },
            'MS': { name: 'Mato Grosso do Sul', bounds: { north: -17.9, south: -24.1, east: -50.9, west: -58.2 } },
            'MG': { name: 'Minas Gerais', bounds: { north: -14.2, south: -22.9, east: -39.9, west: -51.0 } },
            'PA': { name: 'Pará', bounds: { north: 2.6, south: -9.9, east: -46.0, west: -58.9 } },
            'PB': { name: 'Paraíba', bounds: { north: -6.0, south: -8.3, east: -34.8, west: -38.8 } },
            'PR': { name: 'Paraná', bounds: { north: -22.5, south: -26.7, east: -48.0, west: -54.6 } },
            'PE': { name: 'Pernambuco', bounds: { north: -7.3, south: -9.6, east: -34.8, west: -41.4 } },
            'PI': { name: 'Piauí', bounds: { north: -2.7, south: -10.9, east: -40.4, west: -45.9 } },
            'RJ': { name: 'Rio de Janeiro', bounds: { north: -20.8, south: -23.4, east: -40.9, west: -44.9 } },
            'RN': { name: 'Rio Grande do Norte', bounds: { north: -4.8, south: -6.9, east: -34.9, west: -38.6 } },
            'RS': { name: 'Rio Grande do Sul', bounds: { north: -27.1, south: -33.8, east: -49.7, west: -57.6 } },
            'RO': { name: 'Rondônia', bounds: { north: -7.9, south: -13.7, east: -60.0, west: -66.8 } },
            'RR': { name: 'Roraima', bounds: { north: 5.3, south: -1.0, east: -58.0, west: -64.8 } },
            'SC': { name: 'Santa Catarina', bounds: { north: -25.9, south: -29.4, east: -48.3, west: -53.8 } },
            'SP': { name: 'São Paulo', bounds: { north: -19.8, south: -25.3, east: -44.2, west: -53.1 } },
            'SE': { name: 'Sergipe', bounds: { north: -9.5, south: -11.6, east: -36.4, west: -38.6 } },
            'TO': { name: 'Tocantins', bounds: { north: -5.2, south: -13.5, east: -45.7, west: -50.7 } }
        };
        
        this.requestDelay = parseInt(process.env.GEOCODING_DELAY_MS) || 500;
        
        // API Keys configuration
        this.apiKeys = {
            googlemaps: process.env.GOOGLE_MAPS_API_KEY,
            mapbox: process.env.MAPBOX_API_KEY,
            positionstack: process.env.POSITIONSTACK_API_KEY
        };
        
        // Filter providers based on available API keys
        this.availableProviders = this.getAvailableProviders();
        
        // Log de inicialização
        console.log('GeocodingService initialized with providers:', Object.keys(this.providers));
        console.log('Available providers:', this.availableProviders.map(p => p.name));
        console.log('Brazilian states loaded:', Object.keys(this.brazilianStates).length);
    }

    // Filter providers based on available API keys
    getAvailableProviders() {
        const available = [];
        
        for (const [name, config] of Object.entries(this.providers)) {
            if (config.requiresKey) {
                if (this.apiKeys[name] && this.apiKeys[name].length > 0) {
                    available.push({ name, config, hasKey: true });
                } else {
                    console.log(`⚠️  ${name} provider skipped: No API key found`);
                }
            } else {
                available.push({ name, config, hasKey: false });
            }
        }
        
        // Sort by priority (lower number = higher priority)
        available.sort((a, b) => a.config.priority - b.config.priority);
        
        return available;
    }

    // Get high-accuracy providers for Brazilian addresses
    getHighAccuracyProviders(cep = null) {
        return this.availableProviders.filter(p => {
            const config = p.config;
            
            // For CEP-specific requests, prefer Brazilian and high-accuracy providers
            if (cep) {
                return (config.region === 'brazil' || config.accuracy === 'high') && 
                       config.priority <= 5;
            }
            
            // For general addresses, prefer high-accuracy providers
            return config.accuracy === 'high' && config.priority <= 3;
        });
    }

    async geocodeAddress(address, cep = null, city = null, state = null) {
        try {
            // Verificar cache primeiro
            const cached = await this.db.getCachedGeocoding(address);
            if (cached) {
                console.log(`Cache hit for: ${address.substring(0, 50)}...`);
                const cachedResult = {
                    lat: cached.latitude,
                    lng: cached.longitude,
                    provider: cached.provider,
                    cached: true
                };
                
                // Validar coordenadas do cache
                if (this.validateCoordinates(cachedResult.lat, cachedResult.lng, state)) {
                    return cachedResult;
                } else {
                    console.log('Cached coordinates invalid, re-geocoding...');
                }
            }

            // Normalizar endereço para melhor busca
            const normalizedAddress = this.normalizeAddress(address);
            
            // Estratégia de geocodificação baseada em múltiplos providers
            let result = null;
            
            // 1. Tentar com endereço completo usando múltiplos providers (priorizar precisão)
            result = await this.geocodeWithMultipleProviders(normalizedAddress, state, cep);
            
            // 2. Se falhar e tiver CEP, tentar geocodificação por CEP
            if (!result && cep) {
                console.log(`Address geocoding failed, trying CEP-based for: ${cep}`);
                result = await this.geocodeByCep(cep, state);
            }
            
            // 3. Se ainda falhar, tentar geocodificação por cidade/estado
            if (!result && city && state) {
                console.log(`CEP geocoding failed, trying city-based for: ${city}, ${state}`);
                result = await this.geocodeByCityState(city, state);
            }

            // Validar resultado final
            if (result && !this.validateCoordinates(result.lat, result.lng, state)) {
                console.log(`Invalid coordinates for state ${state}: ${result.lat}, ${result.lng}`);
                result = null;
            }

            // Salvar no cache se encontrou resultado válido
            if (result) {
                await this.db.saveGeocodingCache(
                    address,
                    result.lat,
                    result.lng,
                    result.provider
                );
            }

            return result;
        } catch (error) {
            console.error('Geocoding error:', error.message);
            return null;
        }
    }

    async geocodeWithNominatim(address, expectedState = null) {
        try {
            const params = new URLSearchParams({
                q: address,
                format: 'json',
                countrycodes: 'br',
                limit: 3, // Aumentar limite para ter mais opções
                addressdetails: 1,
                extratags: 1
            });

            console.log(`Geocoding with Nominatim: ${address.substring(0, 50)}...`);

            const response = await this.providers.nominatim.rateLimiter(() =>
                axios.get(`${this.providers.nominatim.url}?${params}`, {
                    headers: {
                        'User-Agent': 'SalesRouteOptimizer/1.0 (contact@example.com)',
                        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
                        'Accept': 'application/json'
                    },
                    timeout: 12000
                })
            );

            await this.delay(this.providers.nominatim.delay);

            if (response.data && response.data.length > 0) {
                // Tentar encontrar o melhor resultado
                for (const result of response.data) {
                    const lat = parseFloat(result.lat);
                    const lng = parseFloat(result.lon);
                    const importance = parseFloat(result.importance || 0);
                    
                    // Filtros de qualidade
                    if (importance < 0.25) {
                        console.log('Low importance result, skipping');
                        continue;
                    }
                    
                    // Validar se está no estado esperado
                    if (expectedState) {
                        const addressState = this.extractStateFromNominatimResult(result);
                        if (addressState && addressState !== expectedState) {
                            console.log(`State mismatch in Nominatim: expected ${expectedState}, got ${addressState}`);
                            continue;
                        }
                    }
                    
                    // Validar coordenadas
                    if (!this.validateCoordinates(lat, lng, expectedState)) {
                        console.log('Invalid coordinates from Nominatim');
                        continue;
                    }

                    return {
                        lat: lat,
                        lng: lng,
                        provider: 'nominatim',
                        displayName: result.display_name,
                        importance: importance,
                        type: result.type,
                        class: result.class
                    };
                }
            }

            return null;
        } catch (error) {
            console.error('Nominatim error:', error.message);
            return null;
        }
    }

    // Extrair estado do resultado do Nominatim
    extractStateFromNominatimResult(result) {
        if (result.address) {
            const address = result.address;
            
            // Tentar diferentes campos onde o estado pode estar
            const stateFields = ['state', 'region', 'county'];
            
            for (const field of stateFields) {
                if (address[field]) {
                    const stateValue = address[field].toUpperCase();
                    
                    // Tentar encontrar por nome ou sigla
                    for (const [code, data] of Object.entries(this.brazilianStates)) {
                        if (code === stateValue || data.name.toUpperCase() === stateValue) {
                            return code;
                        }
                    }
                }
            }
        }
        
        return null;
    }

    // High-accuracy provider: Google Maps Geocoding API
    async geocodeWithGoogleMaps(address, expectedState = null) {
        if (!this.apiKeys.googlemaps) {
            console.log('Google Maps API key not available');
            return null;
        }

        try {
            const params = new URLSearchParams({
                address: address,
                key: this.apiKeys.googlemaps,
                region: 'br', // Bias results to Brazil
                language: 'pt-BR'
            });

            console.log(`Geocoding with Google Maps: ${address.substring(0, 50)}...`);

            const response = await this.providers.googlemaps.rateLimiter(() =>
                axios.get(`${this.providers.googlemaps.url}?${params}`, {
                    headers: {
                        'User-Agent': 'SalesRouteOptimizer/1.0',
                        'Accept': 'application/json'
                    },
                    timeout: 10000
                })
            );

            await this.delay(this.providers.googlemaps.delay);

            if (response.data && response.data.status === 'OK' && response.data.results.length > 0) {
                const result = response.data.results[0];
                const location = result.geometry.location;
                
                const lat = parseFloat(location.lat);
                const lng = parseFloat(location.lng);
                
                // Validate coordinates
                if (!this.validateCoordinates(lat, lng, expectedState)) {
                    console.log('Invalid coordinates from Google Maps');
                    return null;
                }

                return {
                    lat: lat,
                    lng: lng,
                    provider: 'googlemaps',
                    displayName: result.formatted_address,
                    accuracy: result.geometry.location_type, // ROOFTOP, RANGE_INTERPOLATED, GEOMETRIC_CENTER, APPROXIMATE
                    placeId: result.place_id,
                    addressComponents: result.address_components
                };
            }

            return null;
        } catch (error) {
            console.error('Google Maps error:', error.message);
            return null;
        }
    }

    // High-accuracy provider: Mapbox Geocoding API
    async geocodeWithMapbox(address, expectedState = null) {
        if (!this.apiKeys.mapbox) {
            console.log('Mapbox API key not available');
            return null;
        }

        try {
            const encodedAddress = encodeURIComponent(address);
            const params = new URLSearchParams({
                access_token: this.apiKeys.mapbox,
                country: 'br', // Restrict to Brazil
                language: 'pt',
                limit: 1
            });

            const url = `${this.providers.mapbox.url}/${encodedAddress}.json?${params}`;
            
            console.log(`Geocoding with Mapbox: ${address.substring(0, 50)}...`);

            const response = await this.providers.mapbox.rateLimiter(() =>
                axios.get(url, {
                    headers: {
                        'User-Agent': 'SalesRouteOptimizer/1.0',
                        'Accept': 'application/json'
                    },
                    timeout: 10000
                })
            );

            await this.delay(this.providers.mapbox.delay);

            if (response.data && response.data.features && response.data.features.length > 0) {
                const feature = response.data.features[0];
                const coords = feature.geometry.coordinates; // [lng, lat]
                
                const lat = parseFloat(coords[1]);
                const lng = parseFloat(coords[0]);
                
                // Validate coordinates
                if (!this.validateCoordinates(lat, lng, expectedState)) {
                    console.log('Invalid coordinates from Mapbox');
                    return null;
                }

                return {
                    lat: lat,
                    lng: lng,
                    provider: 'mapbox',
                    displayName: feature.place_name,
                    relevance: feature.relevance,
                    placeType: feature.place_type,
                    context: feature.context
                };
            }

            return null;
        } catch (error) {
            console.error('Mapbox error:', error.message);
            return null;
        }
    }

    // Medium-accuracy provider: PositionStack API
    async geocodeWithPositionStack(address, expectedState = null) {
        if (!this.apiKeys.positionstack) {
            console.log('PositionStack API key not available');
            return null;
        }

        try {
            const params = new URLSearchParams({
                access_key: this.apiKeys.positionstack,
                query: address,
                country: 'BR',
                language: 'pt',
                limit: 1
            });

            console.log(`Geocoding with PositionStack: ${address.substring(0, 50)}...`);

            const response = await this.providers.positionstack.rateLimiter(() =>
                axios.get(`${this.providers.positionstack.url}?${params}`, {
                    headers: {
                        'User-Agent': 'SalesRouteOptimizer/1.0',
                        'Accept': 'application/json'
                    },
                    timeout: 10000
                })
            );

            await this.delay(this.providers.positionstack.delay);

            if (response.data && response.data.data && response.data.data.length > 0) {
                const result = response.data.data[0];
                
                const lat = parseFloat(result.latitude);
                const lng = parseFloat(result.longitude);
                
                // Validate coordinates
                if (!this.validateCoordinates(lat, lng, expectedState)) {
                    console.log('Invalid coordinates from PositionStack');
                    return null;
                }

                return {
                    lat: lat,
                    lng: lng,
                    provider: 'positionstack',
                    displayName: result.label,
                    confidence: result.confidence,
                    type: result.type,
                    region: result.region,
                    county: result.county
                };
            }

            return null;
        } catch (error) {
            console.error('PositionStack error:', error.message);
            return null;
        }
    }

    // Brazilian CEP provider: OpenCEP API
    async geocodeWithOpenCEP(cep, expectedState = null) {
        try {
            const cleanCep = cep.replace(/\D/g, '');
            const url = `${this.providers.opencep.url}/${cleanCep}`;
            
            console.log(`Trying OpenCEP for: ${cleanCep}`);

            const response = await this.providers.opencep.rateLimiter(() =>
                axios.get(url, {
                    headers: {
                        'User-Agent': 'SalesRouteOptimizer/1.0',
                        'Accept': 'application/json'
                    },
                    timeout: 8000
                })
            );

            await this.delay(this.providers.opencep.delay);

            if (response.data && response.data.status === 200) {
                const data = response.data.result;
                
                // Validate state if provided
                if (expectedState && data.state !== expectedState) {
                    console.log(`State mismatch: expected ${expectedState}, got ${data.state}`);
                    return null;
                }
                
                // If OpenCEP provides direct coordinates, use them
                if (data.lat && data.lng) {
                    const lat = parseFloat(data.lat);
                    const lng = parseFloat(data.lng);
                    
                    if (this.validateCoordinates(lat, lng, expectedState)) {
                        return {
                            lat: lat,
                            lng: lng,
                            provider: 'opencep',
                            address: data.address,
                            district: data.district,
                            city: data.city,
                            state: data.state
                        };
                    }
                }
                
                // Otherwise, build address and geocode with high-accuracy providers
                const address = this.buildNormalizedAddress(
                    data.address,
                    data.district,
                    data.city,
                    data.state
                );

                // Try high-accuracy providers first
                const highAccuracyProviders = [
                    () => this.geocodeWithGoogleMaps(address, data.state),
                    () => this.geocodeWithMapbox(address, data.state),
                    () => this.geocodeWithPositionStack(address, data.state)
                ];
                
                for (const provider of highAccuracyProviders) {
                    const result = await provider();
                    if (result && this.validateCoordinates(result.lat, result.lng, expectedState)) {
                        return {
                            ...result,
                            provider: 'opencep+' + result.provider,
                            cepData: {
                                logradouro: data.address,
                                bairro: data.district,
                                cidade: data.city,
                                estado: data.state
                            }
                        };
                    }
                }
            }

            return null;
        } catch (error) {
            console.error('OpenCEP error:', error.message);
            return null;
        }
    }

    // Novo provider: Photon (OpenStreetMap)
    async geocodeWithPhoton(address, expectedState = null) {
        try {
            const params = new URLSearchParams({
                q: address,
                limit: 1,
                osm_tag: 'place',
                lang: 'pt'
            });

            console.log(`Geocoding with Photon: ${address.substring(0, 50)}...`);

            const response = await this.providers.photon.rateLimiter(() =>
                axios.get(`${this.providers.photon.url}?${params}`, {
                    headers: {
                        'User-Agent': 'SalesRouteOptimizer/1.0',
                        'Accept': 'application/json'
                    },
                    timeout: 8000
                })
            );

            await this.delay(this.providers.photon.delay);

            if (response.data && response.data.features && response.data.features.length > 0) {
                const feature = response.data.features[0];
                const coords = feature.geometry.coordinates; // [lng, lat]
                
                const lat = parseFloat(coords[1]);
                const lng = parseFloat(coords[0]);
                
                // Verificar se as coordenadas estão no Brasil
                if (!this.isInBrazil(lat, lng)) {
                    console.log('Photon result outside Brazil bounds');
                    return null;
                }

                return {
                    lat: lat,
                    lng: lng,
                    provider: 'photon',
                    displayName: feature.properties.name,
                    confidence: feature.properties.confidence || 0.5
                };
            }

            return null;
        } catch (error) {
            console.error('Photon error:', error.message);
            return null;
        }
    }

    // Geocodificação com múltiplos providers
    // Geocodificação com múltiplos providers - Estratégia inteligente baseada em precisão
    async geocodeWithMultipleProviders(address, expectedState = null, cep = null) {
        // Get available providers in order of priority and accuracy
        const availableProviders = this.getHighAccuracyProviders(cep);
        
        // Add fallback providers if no high-accuracy providers are available
        const fallbackProviders = this.availableProviders.filter(p => 
            !availableProviders.includes(p) && p.config.accuracy !== 'low'
        );
        
        const allProviders = [...availableProviders, ...fallbackProviders];
        
        console.log(`Trying ${allProviders.length} providers for: ${address.substring(0, 50)}...`);
        
        for (const providerInfo of allProviders) {
            const { name, config } = providerInfo;
            
            try {
                let result = null;
                
                // Call the appropriate provider method
                switch (name) {
                    case 'googlemaps':
                        result = await this.geocodeWithGoogleMaps(address, expectedState);
                        break;
                    case 'mapbox':
                        result = await this.geocodeWithMapbox(address, expectedState);
                        break;
                    case 'positionstack':
                        result = await this.geocodeWithPositionStack(address, expectedState);
                        break;
                    case 'opencep':
                        if (cep) result = await this.geocodeWithOpenCEP(cep, expectedState);
                        break;
                    case 'awesomeapi':
                        if (cep) result = await this.geocodeWithAwesomeApi(cep.replace(/\D/g, ''), expectedState);
                        else result = null; // AwesomeAPI is CEP-specific
                        break;
                    case 'nominatim':
                        result = await this.geocodeWithNominatim(address, expectedState);
                        break;
                    case 'brasilapi':
                        if (cep) result = await this.geocodeWithBrasilApi(cep.replace(/\D/g, ''), expectedState);
                        else result = null; // BrasilAPI is CEP-specific
                        break;
                    case 'viacep':
                        if (cep) result = await this.geocodeWithViaCep(cep.replace(/\D/g, ''), expectedState);
                        else result = null; // ViaCEP is CEP-specific
                        break;
                    case 'photon':
                        result = await this.geocodeWithPhoton(address, expectedState);
                        break;
                }
                
                if (result && this.validateCoordinates(result.lat, result.lng, expectedState)) {
                    console.log(`✅ Success with ${name} (accuracy: ${config.accuracy})`);
                    return result;
                }
                
                // Short delay between providers to respect rate limits
                if (config.delay > 100) {
                    await this.delay(Math.min(config.delay / 2, 200));
                }
                
            } catch (error) {
                console.error(`Provider ${name} error: ${error.message}`);
                continue;
            }
        }

        return null;
    }

    async geocodeByCep(cep, expectedState = null) {
        if (!cep) return null;

        // Limpar CEP
        const cleanCep = cep.replace(/\D/g, '');
        if (cleanCep.length !== 8) {
            console.log(`Invalid CEP format: ${cep}`);
            return null;
        }

        // Tentar múltiplos providers de CEP em ordem de prioridade (incluindo novos providers)
        const cepProviders = [
            () => this.geocodeWithOpenCEP(cleanCep, expectedState),
            () => this.geocodeWithAwesomeApi(cleanCep, expectedState),
            () => this.geocodeWithBrasilApi(cleanCep, expectedState),
            () => this.geocodeWithViaCep(cleanCep, expectedState)
        ];

        for (const provider of cepProviders) {
            try {
                const result = await provider();
                if (result && this.validateCoordinates(result.lat, result.lng, expectedState)) {
                    return result;
                }
            } catch (error) {
                console.error(`CEP provider error: ${error.message}`);
                continue;
            }
        }

        return null;
    }

    // Novo provider: BrasilAPI
    async geocodeWithBrasilApi(cep, expectedState = null) {
        try {
            const url = `${this.providers.brasilapi.url}/${cep}`;
            console.log(`Trying BrasilAPI for: ${cep}`);

            const response = await this.providers.brasilapi.rateLimiter(() =>
                axios.get(url, { 
                    timeout: 5000,
                    headers: {
                        'User-Agent': 'SalesRouteOptimizer/1.0',
                        'Accept': 'application/json'
                    }
                })
            );

            await this.delay(this.providers.brasilapi.delay);

            if (response.data && response.data.city && response.data.state) {
                const data = response.data;
                
                // Validar estado se fornecido
                if (expectedState && data.state !== expectedState) {
                    console.log(`State mismatch: expected ${expectedState}, got ${data.state}`);
                    return null;
                }
                
                const address = this.buildNormalizedAddress(
                    data.street,
                    data.neighborhood,
                    data.city,
                    data.state
                );

                // Tentar geocodificação do endereço completo
                const coords = await this.geocodeWithMultipleProviders(address, data.state);
                
                if (coords) {
                    return {
                        ...coords,
                        provider: 'brasilapi+geocoding',
                        address: address,
                        cepData: {
                            logradouro: data.street,
                            bairro: data.neighborhood,
                            cidade: data.city,
                            estado: data.state
                        }
                    };
                }

                // Fallback para cidade
                const cityCoords = await this.getCityCoordinates(data.city, data.state);
                if (cityCoords) {
                    return {
                        ...cityCoords,
                        provider: 'brasilapi+city',
                        approximate: true,
                        address: `${data.city}, ${data.state}, Brasil`
                    };
                }
            }

            return null;
        } catch (error) {
            console.error('BrasilAPI error:', error.message);
            return null;
        }
    }

    async geocodeWithViaCep(cep, expectedState = null) {
        try {
            const url = `${this.providers.viacep.url}/${cep}/json/`;
            console.log(`Trying ViaCEP for: ${cep}`);

            const response = await this.providers.viacep.rateLimiter(() =>
                axios.get(url, { 
                    timeout: 8000,
                    headers: {
                        'User-Agent': 'SalesRouteOptimizer/1.0',
                        'Accept': 'application/json'
                    }
                })
            );

            await this.delay(this.providers.viacep.delay);

            if (response.data && !response.data.erro) {
                const data = response.data;
                
                // Validar estado se fornecido
                if (expectedState && data.uf !== expectedState) {
                    console.log(`State mismatch: expected ${expectedState}, got ${data.uf}`);
                    return null;
                }
                
                // Construir endereço normalizado
                const address = this.buildNormalizedAddress(
                    data.logradouro,
                    data.bairro,
                    data.localidade,
                    data.uf
                );

                // Tentar obter coordenadas precisas do endereço
                const coords = await this.geocodeWithMultipleProviders(address, data.uf);
                
                if (coords) {
                    return {
                        ...coords,
                        provider: 'viacep+geocoding',
                        address: address,
                        cepData: {
                            logradouro: data.logradouro,
                            bairro: data.bairro,
                            cidade: data.localidade,
                            estado: data.uf
                        }
                    };
                }

                // Fallback para coordenadas da cidade
                const cityCoords = await this.getCityCoordinates(data.localidade, data.uf);
                if (cityCoords) {
                    return {
                        ...cityCoords,
                        provider: 'viacep+city',
                        approximate: true,
                        address: `${data.localidade}, ${data.uf}, Brasil`
                    };
                }
            }

            return null;
        } catch (error) {
            console.error('ViaCEP error:', error.message);
            return null;
        }
    }

    async geocodeWithAwesomeApi(cep, expectedState = null) {
        try {
            const url = `${this.providers.awesomeapi.url}/${cep}`;
            console.log(`Trying AwesomeAPI for: ${cep}`);

            const response = await this.providers.awesomeapi.rateLimiter(() =>
                axios.get(url, { 
                    timeout: 8000,
                    headers: {
                        'User-Agent': 'SalesRouteOptimizer/1.0',
                        'Accept': 'application/json'
                    }
                })
            );

            await this.delay(this.providers.awesomeapi.delay);

            if (response.data && response.data.lat && response.data.lng) {
                const lat = parseFloat(response.data.lat);
                const lng = parseFloat(response.data.lng);
                
                // Validar coordenadas
                if (!this.validateCoordinates(lat, lng, expectedState)) {
                    console.log(`Invalid coordinates from AwesomeAPI: ${lat}, ${lng}`);
                    return null;
                }
                
                return {
                    lat: lat,
                    lng: lng,
                    provider: 'awesomeapi',
                    address: response.data.address || response.data.address_name,
                    city: response.data.city,
                    state: response.data.state
                };
            }

            // Se não tiver coordenadas diretas mas tiver endereço
            if (response.data && (response.data.address || response.data.city)) {
                const fullAddress = this.buildNormalizedAddress(
                    response.data.address,
                    response.data.district,
                    response.data.city,
                    response.data.state
                );

                return await this.geocodeWithMultipleProviders(fullAddress, expectedState);
            }

            return null;
        } catch (error) {
            console.error('AwesomeAPI error:', error.message);
            return null;
        }
    }

    // Geocodificação por cidade/estado
    async geocodeByCityState(city, state) {
        if (!city || !state) return null;

        const address = `${city}, ${state}, Brasil`;
        return await this.getCityCoordinates(city, state);
    }

    async getCityCoordinates(city, state) {
        if (!city || !state) return null;

        const address = `${city}, ${state}, Brasil`;
        
        try {
            // Tentar geocodificação precisa da cidade
            const result = await this.geocodeWithMultipleProviders(address, state);
            if (result) {
                return {
                    ...result,
                    approximate: true
                };
            }
        } catch (error) {
            console.error('City geocoding error:', error.message);
        }

        // Fallback para coordenadas aproximadas de cidades conhecidas
        return this.getCapitalCoordinates(city, state);
    }

    getCapitalCoordinates(city, state) {
        // Coordenadas corrigidas das principais cidades brasileiras
        const capitals = {
            'São Paulo,SP': { lat: -23.5505, lng: -46.6333 },
            'Rio de Janeiro,RJ': { lat: -22.9068, lng: -43.1729 },
            'Belo Horizonte,MG': { lat: -19.9167, lng: -43.9345 },
            'Porto Alegre,RS': { lat: -30.0346, lng: -51.2177 },
            'Brasília,DF': { lat: -15.7801, lng: -47.9292 },
            'Salvador,BA': { lat: -12.9714, lng: -38.5014 },
            'Fortaleza,CE': { lat: -3.7327, lng: -38.5270 }, // Coordenadas corrigidas
            'Curitiba,PR': { lat: -25.4284, lng: -49.2733 },
            'Recife,PE': { lat: -8.0476, lng: -34.8770 },
            'Manaus,AM': { lat: -3.1190, lng: -60.0217 },
            'Belém,PA': { lat: -1.4558, lng: -48.4902 },
            'Goiânia,GO': { lat: -16.6869, lng: -49.2648 },
            'Guarulhos,SP': { lat: -23.4538, lng: -46.5333 },
            'Campinas,SP': { lat: -22.9099, lng: -47.0626 },
            'São Luís,MA': { lat: -2.5297, lng: -44.3028 },
            'Maceió,AL': { lat: -9.6658, lng: -35.7353 },
            'Campo Grande,MS': { lat: -20.4697, lng: -54.6201 },
            'Natal,RN': { lat: -5.7945, lng: -35.2110 },
            'Teresina,PI': { lat: -5.0892, lng: -42.8019 },
            'João Pessoa,PB': { lat: -7.1195, lng: -34.8450 },
            'Cuiabá,MT': { lat: -15.5989, lng: -56.0949 },
            'Aracaju,SE': { lat: -10.9472, lng: -37.0731 },
            'Florianópolis,SC': { lat: -27.5954, lng: -48.5480 },
            'Porto Velho,RO': { lat: -8.7619, lng: -63.9039 },
            'Macapá,AP': { lat: 0.0355, lng: -51.0705 },
            'Boa Vista,RR': { lat: 2.8235, lng: -60.6758 },
            'Rio Branco,AC': { lat: -9.9754, lng: -67.8249 },
            'Palmas,TO': { lat: -10.2491, lng: -48.3243 },
            'Vitória,ES': { lat: -20.3155, lng: -40.3128 },
            // Adicionar mais cidades importantes
            'Feira de Santana,BA': { lat: -12.2662, lng: -38.9667 },
            'Joinville,SC': { lat: -26.3044, lng: -48.8456 },
            'Ribeirão Preto,SP': { lat: -21.1797, lng: -47.8103 },
            'Uberlândia,MG': { lat: -18.9113, lng: -48.2622 },
            'Sorocaba,SP': { lat: -23.5015, lng: -47.4526 },
            'Contagem,MG': { lat: -19.9317, lng: -44.0536 },
            'São José dos Campos,SP': { lat: -23.2237, lng: -45.9009 },
            'Londrina,PR': { lat: -23.3045, lng: -51.1696 }
        };

        const key = `${city},${state}`;
        if (capitals[key]) {
            return {
                ...capitals[key],
                provider: 'fallback',
                approximate: true
            };
        }

        return null;
    }

    // Normalização de endereço
    normalizeAddress(address) {
        if (!address) return '';
        
        return address
            .toLowerCase()
            .replace(/\s+/g, ' ')
            .replace(/[,]{2,}/g, ',')
            .replace(/^,+|,+$/g, '')
            .trim();
    }

    // Construir endereço normalizado
    buildNormalizedAddress(street, neighborhood, city, state) {
        const parts = [street, neighborhood, city, state, 'Brasil']
            .filter(Boolean)
            .map(part => part.trim());
        
        return parts.join(', ');
    }

    // Validação de coordenadas
    validateCoordinates(lat, lng, state = null) {
        if (!lat || !lng) return false;
        
        const latitude = parseFloat(lat);
        const longitude = parseFloat(lng);
        
        // Verificar se está no Brasil
        if (!this.isInBrazil(latitude, longitude)) {
            return false;
        }
        
        // Se um estado foi fornecido, verificar se está dentro dos limites
        if (state && this.brazilianStates[state]) {
            const bounds = this.brazilianStates[state].bounds;
            return latitude >= bounds.south && latitude <= bounds.north &&
                   longitude >= bounds.west && longitude <= bounds.east;
        }
        
        return true;
    }

    // Verificar se as coordenadas estão no Brasil
    isInBrazil(lat, lng) {
        // Limites aproximados do Brasil
        const brazilBounds = {
            north: 5.3,
            south: -33.8,
            east: -28.8,
            west: -73.8
        };
        
        return lat >= brazilBounds.south && lat <= brazilBounds.north &&
               lng >= brazilBounds.west && lng <= brazilBounds.east;
    }

    async geocodeCustomersBatch(customers, onProgress) {
        const results = [];
        let successCount = 0;
        let failCount = 0;
        let improvedCount = 0; // Contabilizar melhorias

        for (let i = 0; i < customers.length; i++) {
            const customer = customers[i];
            
            try {
                // Tentar geocodificar com informações mais completas
                const coords = await this.geocodeAddress(
                    customer.full_address || customer.fullAddress,
                    customer.cep,
                    customer.city,
                    customer.state
                );

                if (coords) {
                    // Verificar se é uma melhoria (tinha coordenadas ruins antes)
                    const wasImproved = customer.latitude && customer.longitude && 
                        !this.validateCoordinates(customer.latitude, customer.longitude, customer.state);
                    
                    if (wasImproved) {
                        improvedCount++;
                        console.log(`Improved coordinates for customer ${customer.id}`);
                    }
                    
                    // Atualizar no banco
                    await this.db.updateCustomerCoordinates(
                        customer.id,
                        coords.lat,
                        coords.lng,
                        'completed'
                    );
                    
                    successCount++;
                    results.push({
                        ...customer,
                        latitude: coords.lat,
                        longitude: coords.lng,
                        geocoding_provider: coords.provider,
                        geocoding_improved: wasImproved,
                        geocoding_approximate: coords.approximate || false
                    });
                } else {
                    // Marcar como falha
                    await this.db.updateCustomerCoordinates(
                        customer.id,
                        null,
                        null,
                        'failed'
                    );
                    
                    failCount++;
                    console.log(`Failed to geocode customer ${customer.id}: ${customer.full_address || customer.fullAddress}`);
                }

                // Callback de progresso
                if (onProgress) {
                    onProgress({
                        current: i + 1,
                        total: customers.length,
                        successCount,
                        failCount,
                        improvedCount,
                        percentage: Math.round(((i + 1) / customers.length) * 100)
                    });
                }

                // Pausa adaptativa baseada no provider usado
                const delay = coords?.provider?.includes('nominatim') ? 1000 : 200;
                if (i < customers.length - 1) {
                    await this.delay(delay);
                }

            } catch (error) {
                console.error(`Error geocoding customer ${customer.id}:`, error.message);
                failCount++;
            }
        }

        return {
            results,
            summary: {
                total: customers.length,
                success: successCount,
                failed: failCount,
                improved: improvedCount,
                successRate: (successCount / customers.length * 100).toFixed(2),
                improvementRate: (improvedCount / customers.length * 100).toFixed(2)
            }
        };
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    calculateDistance(lat1, lng1, lat2, lng2) {
        // Fórmula de Haversine
        const R = 6371; // Raio da Terra em km
        const dLat = this.toRad(lat2 - lat1);
        const dLng = this.toRad(lng2 - lng1);
        
        const a = 
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
        
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = R * c;
        
        return distance;
    }

    toRad(deg) {
        return deg * (Math.PI / 180);
    }

    // Método para diagnóstico de problemas de geocodificação
    async diagnoseGeocoding(address, cep = null, city = null, state = null) {
        console.log(`\n=== Diagnosing geocoding for: ${address} ===`);
        
        const results = {};
        
        // Testar cada provider individualmente
        if (cep) {
            console.log('Testing CEP providers...');
            results.brasilapi = await this.geocodeWithBrasilApi(cep, state).catch(e => ({ error: e.message }));
            results.viacep = await this.geocodeWithViaCep(cep, state).catch(e => ({ error: e.message }));
            results.awesomeapi = await this.geocodeWithAwesomeApi(cep, state).catch(e => ({ error: e.message }));
        }
        
        console.log('Testing address providers...');
        const normalizedAddress = this.normalizeAddress(address);
        results.nominatim = await this.geocodeWithNominatim(normalizedAddress, state).catch(e => ({ error: e.message }));
        results.photon = await this.geocodeWithPhoton(normalizedAddress, state).catch(e => ({ error: e.message }));
        
        if (city && state) {
            console.log('Testing city fallback...');
            results.cityFallback = await this.getCityCoordinates(city, state).catch(e => ({ error: e.message }));
        }
        
        // Análise dos resultados
        console.log('\n=== Results Analysis ===');
        for (const [provider, result] of Object.entries(results)) {
            if (result?.error) {
                console.log(`${provider}: ERROR - ${result.error}`);
            } else if (result?.lat && result?.lng) {
                const valid = this.validateCoordinates(result.lat, result.lng, state);
                console.log(`${provider}: ${result.lat}, ${result.lng} - ${valid ? 'VALID' : 'INVALID'}`);
            } else {
                console.log(`${provider}: No result`);
            }
        }
        
        return results;
    }

    // Método para validar e corrigir coordenadas existentes
    async validateAndFixCoordinates(customers) {
        const invalidCustomers = customers.filter(customer => 
            customer.latitude && customer.longitude && 
            !this.validateCoordinates(customer.latitude, customer.longitude, customer.state)
        );
        
        console.log(`Found ${invalidCustomers.length} customers with invalid coordinates`);
        
        if (invalidCustomers.length > 0) {
            return await this.geocodeCustomersBatch(invalidCustomers);
        }
        
        return { results: [], summary: { total: 0, success: 0, failed: 0, improved: 0 } };
    }
}

module.exports = GeocodingService;