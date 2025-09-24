// Dynamic Vercel Serverless Function for CEP Geocoding: /api/geocoding/cep/[cep]
import https from 'https';
import http from 'http';

// Node.js HTTP request utility for Vercel serverless compatibility
function makeHttpRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const isHttps = urlObj.protocol === 'https:';
        const client = isHttps ? https : http;

        const reqOptions = {
            hostname: urlObj.hostname,
            port: urlObj.port || (isHttps ? 443 : 80),
            path: urlObj.pathname + urlObj.search,
            method: options.method || 'GET',
            headers: {
                'User-Agent': 'PlomesRotaCEP/1.0',
                ...options.headers
            },
            timeout: options.timeout || 6000
        };

        const req = client.request(reqOptions, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                resolve({
                    ok: res.statusCode >= 200 && res.statusCode < 300,
                    status: res.statusCode,
                    statusText: res.statusMessage,
                    json: async () => JSON.parse(data),
                    text: async () => data
                });
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });

        if (options.body) {
            req.write(options.body);
        }

        req.end();
    });
}

// Multiple geocoding providers for redundancy
const geocodingProviders = [
    {
        name: 'viacep_nominatim_geocoding',
        geocode: async (cep) => {
            // Step 1: Get address from ViaCEP
            const viacepResponse = await makeHttpRequest(`https://viacep.com.br/ws/${cep}/json/`);

            if (!viacepResponse.ok) {
                throw new Error('ViaCEP request failed');
            }

            const viacepData = await viacepResponse.json();
            if (viacepData.erro) {
                throw new Error('CEP not found in ViaCEP');
            }

            // Step 2: Geocode address using Nominatim
            const addressQuery = `${viacepData.logradouro}, ${viacepData.bairro}, ${viacepData.localidade}, ${viacepData.uf}, Brasil`;
            const encodedAddress = encodeURIComponent(addressQuery);
            const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&limit=1&countrycodes=br`;

            const nominatimResponse = await makeHttpRequest(nominatimUrl);

            if (!nominatimResponse.ok) {
                throw new Error('Nominatim request failed');
            }

            const nominatimData = await nominatimResponse.json();
            if (!nominatimData || nominatimData.length === 0) {
                throw new Error('Address not found in Nominatim');
            }

            const result = nominatimData[0];
            return {
                lat: parseFloat(result.lat),
                lng: parseFloat(result.lon),
                address: {
                    cep: cep,
                    logradouro: viacepData.logradouro || '',
                    bairro: viacepData.bairro || '',
                    localidade: viacepData.localidade || '',
                    uf: viacepData.uf || '',
                    formatted: `${viacepData.logradouro || ''}, ${viacepData.bairro || ''}, ${viacepData.localidade} - ${viacepData.uf}`.replace(/^,\s*/, '').replace(/,\s*,/g, ',').trim()
                },
                provider: 'viacep_nominatim_geocoding'
            };
        }
    },
    {
        name: 'awesomeapi',
        geocode: async (cep) => {
            const response = await makeHttpRequest(`https://cep.awesomeapi.com.br/json/${cep}`);

            if (!response.ok) {
                throw new Error('AwesomeAPI request failed');
            }

            const data = await response.json();
            if (!data.lat || !data.lng) {
                throw new Error('No coordinates in AwesomeAPI response');
            }

            return {
                lat: parseFloat(data.lat),
                lng: parseFloat(data.lng),
                address: {
                    cep: cep,
                    logradouro: data.address || '',
                    bairro: data.district || '',
                    localidade: data.city || '',
                    uf: data.state || '',
                    formatted: `${data.address || ''}, ${data.district || ''}, ${data.city} - ${data.state}`.replace(/^,\s*/, '').replace(/,\s*,/g, ',').trim()
                },
                provider: 'awesomeapi'
            };
        }
    },
    {
        name: 'brasilapi',
        geocode: async (cep) => {
            const response = await makeHttpRequest(`https://brasilapi.com.br/api/cep/v2/${cep}`);

            if (!response.ok) {
                throw new Error('BrasilAPI request failed');
            }

            const data = await response.json();

            // BrasilAPI doesn't provide coordinates, so we use Nominatim for geocoding
            const addressQuery = `${data.street}, ${data.neighborhood}, ${data.city}, ${data.state}, Brasil`;
            const encodedAddress = encodeURIComponent(addressQuery);
            const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&limit=1&countrycodes=br`;

            const nominatimResponse = await makeHttpRequest(nominatimUrl);

            if (!nominatimResponse.ok) {
                throw new Error('Nominatim geocoding failed');
            }

            const nominatimData = await nominatimResponse.json();
            if (!nominatimData || nominatimData.length === 0) {
                throw new Error('Address not found in Nominatim');
            }

            const result = nominatimData[0];
            return {
                lat: parseFloat(result.lat),
                lng: parseFloat(result.lon),
                address: {
                    cep: cep,
                    logradouro: data.street || '',
                    bairro: data.neighborhood || '',
                    localidade: data.city || '',
                    uf: data.state || '',
                    formatted: `${data.street || ''}, ${data.neighborhood || ''}, ${data.city} - ${data.state}`.replace(/^,\s*/, '').replace(/,\s*,/g, ',').trim()
                },
                provider: 'brasilapi'
            };
        }
    }
];

// Main serverless function handler
export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Only allow GET requests
    if (req.method !== 'GET') {
        return res.status(405).json({
            success: false,
            error: 'Method not allowed'
        });
    }

    try {
        // Get CEP from dynamic route parameter
        const { cep } = req.query;

        if (!cep) {
            return res.status(400).json({
                success: false,
                error: 'CEP is required'
            });
        }

        // Clean and validate CEP
        const cleanCep = cep.toString().replace(/\D/g, '');
        if (cleanCep.length !== 8) {
            return res.status(400).json({
                success: false,
                error: 'CEP must have 8 digits'
            });
        }

        console.log(`[CEP API] Geocoding CEP: ${cleanCep}`);

        let lastError;
        let result;

        // Try each provider until one succeeds
        for (const provider of geocodingProviders) {
            try {
                console.log(`[CEP API] Trying provider: ${provider.name}`);
                result = await provider.geocode(cleanCep);
                console.log(`[CEP API] Success with ${provider.name}: lat=${result.lat}, lng=${result.lng}`);
                break;
            } catch (error) {
                console.log(`[CEP API] Provider ${provider.name} failed: ${error.message}`);
                lastError = error;
                continue;
            }
        }

        if (!result) {
            console.error(`[CEP API] All providers failed. Last error: ${lastError?.message}`);
            return res.status(404).json({
                success: false,
                error: 'Could not geocode CEP',
                cep: cleanCep,
                details: lastError?.message
            });
        }

        // Return result in format expected by frontend
        return res.status(200).json({
            success: true,
            cep: cleanCep,
            address: result.address,
            coordinates: {
                lat: result.lat,
                lng: result.lng
            },
            lat: result.lat,  // For backward compatibility
            lng: result.lng,  // For backward compatibility
            provider: result.provider,
            source: result.provider
        });

    } catch (error) {
        console.error('[CEP API] Unexpected error:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error.message
        });
    }
}