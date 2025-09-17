const axios = require('axios');
const pLimit = require('p-limit');

class PloomeService {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.baseUrl = process.env.PLOOME_API_URL || 'https://public-api2.ploomes.com';
        this.rateLimiter = pLimit(1);
        this.requestDelay = 500; // ms entre requisições
        this.tagCache = null; // Cache for tag name lookups
        
        // Allow CLIENT_TAG_ID to be configured via environment
        this.CLIENT_TAG_ID = process.env.CLIENT_TAG_ID ? 
            parseInt(process.env.CLIENT_TAG_ID) : 
            40006184; // Known ID for "Cliente" tag from investigation
            
        console.log(`🎯 Using CLIENT_TAG_ID: ${this.CLIENT_TAG_ID}`);
    }

    async fetchContacts(filters = {}) {
        const {
            skip = 0,
            top = 100,
            includeAddress = true
        } = filters;

        try {
            // Base URL with pagination
            let url = `${this.baseUrl}/Contacts?$top=${top}&$skip=${skip}`;
            
            // CRITICAL: Expand Tags to get tag information AND filter by Cliente tag
            // This filters at the API level to only get contacts with the "Cliente" tag
            url += `&$expand=City,Tags`;
            
            // Add OData filter to get ONLY contacts that have the Cliente tag
            // Can be disabled with DISABLE_ODATA_FILTER=true environment variable
            const useODataFilter = process.env.DISABLE_ODATA_FILTER !== 'true';
            
            if (useODataFilter) {
                url += `&$filter=Tags/any(t: t/TagId eq ${this.CLIENT_TAG_ID})`;
                console.log(`\n🚀 [ODATA-FILTER-ACTIVE] Version 2.1`);
                console.log(`🔍 Fetching ONLY Cliente contacts with OData filter:`);
                console.log(`   Full URL: ${url}`);
                console.log(`   🎯 CLIENT_TAG_ID filter: ${this.CLIENT_TAG_ID}`);
                console.log(`   📊 Pagination: skip=${skip}, top=${top}`);
                console.log(`   ✅ This should return ONLY ~2200 Cliente contacts, not 4000+\n`);
            } else {
                console.log(`\n⚠️  [ODATA-FILTER-DISABLED] Fetching ALL contacts`);
                console.log(`   URL: ${url}`);
                console.log(`   Will filter locally for CLIENT_TAG_ID: ${this.CLIENT_TAG_ID}\n`);
            }
            
            const response = await this.rateLimiter(() => 
                axios.get(url, {
                    headers: {
                        'User-Key': this.apiKey,
                        'Content-Type': 'application/json; charset=utf-8'
                    },
                    timeout: 60000 // Increased to 60 seconds per request
                })
            );

            // Aguardar antes da próxima requisição
            await this.delay(this.requestDelay);

            return response.data;
        } catch (error) {
            console.error('Error fetching contacts:', error.response?.data || error.message);
            
            // Se for erro de rate limit, aguardar mais tempo
            if (error.response?.status === 429) {
                console.log('Rate limit hit, waiting 5 seconds...');
                await this.delay(5000);
                throw new Error('RATE_LIMIT');
            }
            
            throw error;
        }
    }

    async fetchAllContacts(onProgress) {
        const allContacts = [];
        let skip = 0;
        const top = 50; // Reduced batch size for faster individual requests
        let hasMore = true;
        let retryCount = 0;
        const maxRetries = 3;
        const MAX_CONTACTS = 10000; // Aumentar limite para pegar mais dados

        while (hasMore) {
            try {
                const result = await this.fetchContacts({ skip, top });
                
                if (result.value && Array.isArray(result.value)) {
                    console.log(`📥 Received ${result.value.length} contacts from API`);
                    
                    // ULTRA-DETAILED sample analysis for first batch
                    if (result.value.length > 0 && skip === 0) {
                        const sample = result.value[0];
                        console.log(`\n📋 ULTRA-DETAILED Sample contact structure:`);
                        console.log(`   Basic: Id=${sample.Id}, Name=${sample.Name}`);
                        console.log(`   Tags field exists: ${sample.Tags !== undefined}`);
                        console.log(`   Tags is array: ${Array.isArray(sample.Tags)}`);
                        console.log(`   Tags count: ${sample.Tags ? sample.Tags.length : 0}`);
                        console.log(`   Tags raw: ${JSON.stringify(sample.Tags)}`);
                        
                        // Check if ANY contact in first batch has tags
                        let contactsWithTags = 0;
                        let totalTags = 0;
                        for (const c of result.value.slice(0, 10)) {
                            if (c.Tags && c.Tags.length > 0) {
                                contactsWithTags++;
                                totalTags += c.Tags.length;
                            }
                        }
                        console.log(`   📊 First 10 contacts: ${contactsWithTags} have tags, total ${totalTags} tags`);
                        console.log(`   Address: ZipCode=${sample.ZipCode}, Street=${sample.Street}`);
                    }
                    
                    // Filtrar e mapear contatos com informações relevantes (async)
                    const filteredContacts = [];
                    for (const contact of result.value) {
                        if (await this.isValidContact(contact)) {
                            filteredContacts.push(await this.mapContact(contact));
                        }
                    }
                    const validContacts = filteredContacts;
                    
                    console.log(`✅ Valid contacts after filter: ${validContacts.length} / ${result.value.length}`);
                    allContacts.push(...validContacts);
                    
                    // Callback de progresso
                    if (onProgress) {
                        onProgress({
                            fetched: allContacts.length,
                            current: validContacts.length,
                            skip
                        });
                    }
                    
                    // Verificar se há mais registros (limitado a MAX_CONTACTS)
                    hasMore = result.value.length === 50 && allContacts.length < MAX_CONTACTS;
                    skip += top;
                    
                    // Reset retry count on success
                    retryCount = 0;
                } else {
                    hasMore = false;
                }
            } catch (error) {
                if (error.message === 'RATE_LIMIT' && retryCount < maxRetries) {
                    retryCount++;
                    console.log(`Retrying (${retryCount}/${maxRetries})...`);
                    continue;
                }
                
                console.error('Failed to fetch contacts:', error);
                break;
            }
        }

        return allContacts;
    }

    async isValidContact(contact) {
        // Validações básicas
        if (!contact || !contact.Id || !contact.Name) {
            return false;
        }
        
        // Since we're now filtering at the API level with OData,
        // contacts without the Cliente tag shouldn't even arrive here.
        // But we'll still verify as a safety check.
        
        // Verificar tag Cliente (deve sempre passar agora com filtro OData)
        const hasClientTag = await this.hasClientTag(contact);
        
        if (!hasClientTag) {
            // This should rarely happen now with API-level filtering
            console.log(`⚠️  WARNING: Contact ${contact.Name} passed API filter but lacks Cliente tag locally`);
            console.log(`   Tags: ${JSON.stringify(contact.Tags)}`);
            return false;
        }
        
        // Filtrar contatos sem dados de endereço úteis
        const hasUsefulAddressData = (
            contact.ZipCode || 
            contact.InternationalZipCode ||
            contact.StreetAddress || 
            contact.Street ||
            contact.Address ||
            (contact.City && (contact.City.Name || typeof contact.City === 'string'))
        );
        
        if (!hasUsefulAddressData) {
            console.log(`🚫 Skipping contact ${contact.Name} - No useful address data`);
            return false;
        }
        
        return true;
    }

    async mapContact(contact) {
        // Mapear campos do Ploome para nosso formato com tratamento completo de endereços
        const mappedContact = {
            id: contact.Id,
            name: contact.Name || 'Sem nome',
            cnpj: this.cleanDocument(contact.CNPJ || contact.Document),
            cpf: this.cleanDocument(contact.CPF || (contact.TypeId === 2 ? contact.Document : null)),
            email: contact.Email || null,
            phone: this.extractPhone(contact),
            
            // Endereço - tratamento completo de todos os campos possíveis
            cep: this.formatCep(contact.ZipCode || contact.InternationalZipCode),
            streetAddress: this.buildStreetAddress(contact),
            streetNumber: contact.StreetNumber || contact.StreetAddressNumber || '',
            streetComplement: contact.StreetComplement || contact.StreetAddressLine2 || '',
            neighborhood: contact.Neighborhood || '',
            city: this.extractCityName(contact),
            state: this.extractStateName(contact),
            
            // Endereço completo para geocodificação
            fullAddress: this.buildFullAddress(contact),
            
            // Tags para classificação (async)
            tags: await this.extractTags(contact),
            
            // Metadados
            needsGeocoding: this.hasValidAddressForGeocoding(contact),
            lastUpdated: new Date().toISOString()
        };
        
        console.log(`📍 Mapped contact: ${mappedContact.name} - CEP: ${mappedContact.cep} - Tags: [${mappedContact.tags.join(', ')}]`);
        return mappedContact;
    }

    formatCep(cep) {
        if (!cep) return null;
        
        // Converter para string se for número
        const cepStr = String(cep).trim();
        if (!cepStr) return null;
        
        // Remover caracteres não numéricos
        const cleaned = cepStr.replace(/\D/g, '');
        
        // Validar se tem 8 dígitos
        if (cleaned.length === 8) {
            return `${cleaned.substr(0, 5)}-${cleaned.substr(5, 3)}`;
        }
        
        // Se tem 7 dígitos, adicionar zero à esquerda
        if (cleaned.length === 7) {
            const padded = '0' + cleaned;
            return `${padded.substr(0, 5)}-${padded.substr(5, 3)}`;
        }
        
        // Se tem 6 dígitos, adicionar dois zeros à esquerda
        if (cleaned.length === 6) {
            const padded = '00' + cleaned;
            return `${padded.substr(0, 5)}-${padded.substr(5, 3)}`;
        }
        
        // Se tem 5 dígitos, adicionar zeros para formar CEP completo (assumir formato 00000-000)
        if (cleaned.length === 5) {
            const padded = cleaned + '000';
            return `${padded.substr(0, 5)}-${padded.substr(5, 3)}`;
        }
        
        // Para outros casos, retornar null se não conseguir formar CEP válido
        console.log(`⚠️ Invalid CEP format: ${cepStr} (cleaned: ${cleaned}, length: ${cleaned.length})`);
        return null;
    }

    buildFullAddress(contact) {
        const parts = [];
        
        // Construir endereço de rua completo
        const streetAddress = this.buildStreetAddress(contact);
        if (streetAddress) {
            parts.push(streetAddress);
        }
        
        // Adicionar bairro
        if (contact.Neighborhood) {
            parts.push(contact.Neighborhood);
        }
        
        // Adicionar cidade
        const cityName = this.extractCityName(contact);
        if (cityName) {
            parts.push(cityName);
        }
        
        // Adicionar estado
        const stateName = this.extractStateName(contact);
        if (stateName) {
            parts.push(stateName);
        }
        
        // Adicionar CEP formatado
        const cep = this.formatCep(contact.ZipCode || contact.InternationalZipCode);
        if (cep) {
            parts.push(cep);
        }
        
        parts.push('Brasil');
        
        return parts.filter(Boolean).join(', ');
    }

    buildStreetAddress(contact) {
        // Tentar diferentes combinações de campos de endereço
        let streetAddress = '';
        
        // Primeira opção: campo StreetAddress já completo
        if (contact.StreetAddress && contact.StreetAddress.trim()) {
            streetAddress = contact.StreetAddress.trim();
        }
        // Segunda opção: construir a partir do campo Street
        else if (contact.Street && contact.Street.trim()) {
            streetAddress = contact.Street.trim();
        }
        // Terceira opção: usar qualquer campo que pareça um endereço
        else if (contact.Address && contact.Address.trim()) {
            streetAddress = contact.Address.trim();
        }
        
        // Adicionar número se existir e não estiver já incluído
        const streetNumber = contact.StreetNumber || contact.StreetAddressNumber || '';
        if (streetNumber && streetNumber.trim() && !streetAddress.includes(streetNumber.trim())) {
            streetAddress += `, ${streetNumber.trim()}`;
        }
        
        return streetAddress;
    }

    extractCityName(contact) {
        // Tentar extrair nome da cidade de diferentes formas
        if (contact.City) {
            if (typeof contact.City === 'object' && contact.City.Name) {
                return contact.City.Name;
            } else if (typeof contact.City === 'string') {
                return contact.City;
            }
        }
        
        // Fallback para outros campos possíveis
        return contact.CityName || '';
    }

    extractStateName(contact) {
        // Tentar extrair estado de diferentes formas
        if (contact.State) {
            if (typeof contact.State === 'object') {
                return contact.State.Short || contact.State.Name || contact.State.Abbreviation || '';
            } else if (typeof contact.State === 'string') {
                return contact.State;
            }
        }
        
        // Tentar outros campos
        if (contact.City && typeof contact.City === 'object' && contact.City.State) {
            const state = contact.City.State;
            return state.Short || state.Name || state.Abbreviation || '';
        }
        
        return contact.StateName || '';
    }

    extractPhone(contact) {
        // Tentar extrair telefone de diferentes formas
        if (contact.Phone && contact.Phone.trim()) {
            return contact.Phone.trim();
        }
        
        // Se existe array de telefones, pegar o primeiro
        if (contact.Phones && Array.isArray(contact.Phones) && contact.Phones.length > 0) {
            return contact.Phones[0].PhoneNumber || '';
        }
        
        return null;
    }

    cleanDocument(document) {
        if (!document) return null;
        
        // Remover caracteres não numéricos
        const cleaned = String(document).replace(/\D/g, '');
        
        // Verificar se tem tamanho válido para CPF (11) ou CNPJ (14)
        if (cleaned.length === 11 || cleaned.length === 14) {
            return cleaned;
        }
        
        return cleaned || null;
    }

    hasValidAddressForGeocoding(contact) {
        // Verificar se tem dados suficientes para geocodificação
        const hasStreetAddress = this.buildStreetAddress(contact).trim().length > 0;
        const hasCep = this.formatCep(contact.ZipCode || contact.InternationalZipCode) !== null;
        const hasCity = this.extractCityName(contact).trim().length > 0;
        
        // Precisa de pelo menos CEP OU (endereço E cidade)
        return hasCep || (hasStreetAddress && hasCity);
    }

    async fetchTags() {
        // Fetch and cache tag definitions from Ploomes
        if (this.tagCache) {
            return this.tagCache;
        }
        
        try {
            console.log('🏷️  Fetching tag definitions from Ploomes...');
            const response = await this.rateLimiter(() => 
                axios.get(`${this.baseUrl}/Tags`, {
                    headers: {
                        'User-Key': this.apiKey,
                        'Content-Type': 'application/json; charset=utf-8'
                    },
                    timeout: 30000
                })
            );
            
            // Create a map of TagId -> TagName
            this.tagCache = new Map();
            if (response.data.value && Array.isArray(response.data.value)) {
                response.data.value.forEach(tag => {
                    if (tag.Id && tag.Name) {
                        this.tagCache.set(tag.Id, tag.Name);
                    }
                });
                console.log(`✅ Cached ${this.tagCache.size} tag definitions`);
            }
            
            return this.tagCache;
        } catch (error) {
            console.error('⚠️  Failed to fetch tags, using fallback method:', error.message);
            // Return empty cache to prevent repeated failures
            this.tagCache = new Map();
            return this.tagCache;
        }
    }

    async hasClientTag(contact) {
        // Check if contact has the "Cliente" tag using TagId lookup
        if (!contact.Tags || !Array.isArray(contact.Tags) || contact.Tags.length === 0) {
            return false;
        }
        
        // Method 1: Direct TagId check (most efficient)
        const hasClienteTagId = contact.Tags.some(tag => 
            tag && tag.TagId === this.CLIENT_TAG_ID
        );
        
        if (hasClienteTagId) {
            return true;
        }
        
        // Method 2: Try tag name lookup (fallback)
        try {
            await this.fetchTags(); // Ensure tags are cached
            
            const hasClienteTagName = contact.Tags.some(tag => {
                if (!tag || !tag.TagId) return false;
                const tagName = this.tagCache.get(tag.TagId);
                return tagName === 'Cliente';
            });
            
            return hasClienteTagName;
        } catch (error) {
            console.error('⚠️  Tag name lookup failed:', error.message);
            return false;
        }
    }

    async extractTags(contact) {
        // Extrair e normalizar tags do contato usando TagId lookup
        if (!contact.Tags || !Array.isArray(contact.Tags)) {
            return [];
        }
        
        try {
            await this.fetchTags(); // Ensure tags are cached
            
            return contact.Tags.map(tag => {
                if (typeof tag === 'string') {
                    return tag;
                } else if (tag && tag.Name) {
                    return tag.Name;
                } else if (tag && tag.Value) {
                    return tag.Value;
                } else if (tag && tag.TagId) {
                    // Use TagId lookup
                    const tagName = this.tagCache.get(tag.TagId);
                    return tagName || `Tag_${tag.TagId}`;
                }
                return null;
            }).filter(Boolean);
        } catch (error) {
            console.error('⚠️  Error extracting tags:', error.message);
            // Return TagIds as fallback
            return contact.Tags.map(tag => 
                tag && tag.TagId ? `Tag_${tag.TagId}` : null
            ).filter(Boolean);
        }
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async testConnection() {
        try {
            console.log('Testing Ploome API connection...');
            console.log('API URL:', this.baseUrl);
            console.log('API Key format check:', this.apiKey ? `${this.apiKey.substring(0, 10)}...` : 'NOT SET');
            
            // Tentar endpoint mais simples primeiro - Account
            const testUrl = `${this.baseUrl}/Account`;
            console.log('Testing with endpoint:', testUrl);
            
            const response = await axios.get(testUrl, {
                headers: {
                    'User-Key': this.apiKey,
                    'Content-Type': 'application/json; charset=utf-8'
                },
                timeout: 30000 // 30 seconds for test connection
            });
            
            console.log('✅ Ploome API connection successful');
            console.log('Account info received:', response.data ? 'Yes' : 'No');
            return true;
            
        } catch (error) {
            console.error('❌ Ploome API connection failed');
            
            if (error.response) {
                console.error('Response Status:', error.response.status);
                console.error('Response Status Text:', error.response.statusText);
                console.error('Response Headers:', error.response.headers);
                console.error('Response Data:', error.response.data);
                
                if (error.response.status === 403) {
                    console.error('⚠️  403 Forbidden - Possíveis causas:');
                    console.error('   1. API Key inválida ou expirada');
                    console.error('   2. Usuário sem permissões adequadas');
                    console.error('   3. API Key não está no formato correto');
                    console.error('   Verifique no Ploome: Administração → Usuários de Integração');
                } else if (error.response.status === 401) {
                    console.error('⚠️  401 Unauthorized - API Key não reconhecida');
                }
            } else if (error.request) {
                console.error('No response received:', error.message);
                console.error('⚠️  Possível problema de rede ou URL incorreta');
            } else {
                console.error('Error details:', error.message);
            }
            
            return false;
        }
    }
    
    async testAccountEndpoint() {
        try {
            const url = `${this.baseUrl}/Account`;
            console.log('Testing Account endpoint:', url);
            
            const response = await axios.get(url, {
                headers: {
                    'User-Key': this.apiKey,
                    'Content-Type': 'application/json; charset=utf-8'
                },
                timeout: 30000 // 30 seconds for test connection
            });
            
            return {
                success: true,
                data: response.data
            };
        } catch (error) {
            return {
                success: false,
                error: {
                    status: error.response?.status,
                    statusText: error.response?.statusText,
                    data: error.response?.data,
                    message: error.message
                }
            };
        }
    }
}

module.exports = PloomeService;