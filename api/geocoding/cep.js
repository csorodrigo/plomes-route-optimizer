// Vercel Serverless Function for CEP Geocoding
export default async function handler(req, res) {
    // Configure CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Handle preflight OPTIONS request
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Allow both GET and POST methods
    if (req.method !== 'POST' && req.method !== 'GET') {
        return res.status(405).json({
            success: false,
            message: 'Method not allowed. Use GET or POST.'
        });
    }

    try {
        console.log('🚨 Vercel Serverless CEP Geocoding called');

        // Get CEP from body (POST) or URL parameter (GET)
        let cep;
        if (req.method === 'POST') {
            cep = req.body?.cep;
        } else if (req.method === 'GET') {
            // Extract CEP from URL path /api/geocoding/cep/[cep]
            const urlParts = req.url.split('/');
            const lastPart = urlParts[urlParts.length - 1];
            // Check if URL has CEP parameter or query string
            if (lastPart && lastPart !== 'cep' && !lastPart.includes('?')) {
                cep = lastPart;
            } else {
                // Try to get from query parameters
                const url = new URL(req.url, `https://${req.headers.host}`);
                cep = url.searchParams.get('cep');
            }
        }

        if (!cep) {
            return res.status(400).json({
                success: false,
                message: 'CEP is required'
            });
        }

        // Clean CEP (remove non-numeric characters)
        const cleanCEP = cep.replace(/\D/g, '');

        if (cleanCEP.length !== 8) {
            return res.status(400).json({
                success: false,
                message: 'CEP deve ter 8 dígitos'
            });
        }

        // Call ViaCEP API for address details
        try {
            const viaCepResponse = await fetch(`https://viacep.com.br/ws/${cleanCEP}/json/`);
            const addressData = await viaCepResponse.json();

            if (addressData.erro) {
                return res.status(404).json({
                    success: false,
                    message: 'CEP não encontrado'
                });
            }

            // Real geocoding using OpenStreetMap Nominatim (free alternative)
            const fullAddress = `${addressData.logradouro}, ${addressData.bairro}, ${addressData.localidade}, ${addressData.uf}, Brazil`;
            let coords = null;

            try {
                // Try OpenStreetMap Nominatim first (free)
                const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fullAddress)}&limit=1&addressdetails=1`;
                const nominatimResponse = await fetch(nominatimUrl, {
                    headers: {
                        'User-Agent': 'PlomesRotaCEP/1.0 (geocoding service)'
                    }
                });
                const nominatimData = await nominatimResponse.json();

                if (nominatimData && nominatimData.length > 0) {
                    coords = {
                        lat: parseFloat(nominatimData[0].lat),
                        lng: parseFloat(nominatimData[0].lon)
                    };
                    console.log('✅ Geocoding successful via Nominatim');
                } else {
                    // Fallback: try simpler address without street number
                    const simpleAddress = `${addressData.bairro}, ${addressData.localidade}, ${addressData.uf}, Brazil`;
                    const fallbackUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(simpleAddress)}&limit=1`;
                    const fallbackResponse = await fetch(fallbackUrl, {
                        headers: {
                            'User-Agent': 'PlomesRotaCEP/1.0 (geocoding service)'
                        }
                    });
                    const fallbackData = await fallbackResponse.json();

                    if (fallbackData && fallbackData.length > 0) {
                        coords = {
                            lat: parseFloat(fallbackData[0].lat),
                            lng: parseFloat(fallbackData[0].lon)
                        };
                        console.log('✅ Geocoding successful via Nominatim fallback');
                    }
                }
            } catch (geocodingError) {
                console.error('⚠️ Geocoding error:', geocodingError);
            }

            // Final fallback: If geocoding failed, use approximate coordinates based on city
            if (!coords) {
                console.log('⚠️ Using city-based coordinates as fallback');
                const cityCoordinates = {
                    'São Paulo': { lat: -23.550520, lng: -46.633308 },
                    'Rio de Janeiro': { lat: -22.906847, lng: -43.172896 },
                    'Belo Horizonte': { lat: -19.919502, lng: -43.938533 },
                    'Salvador': { lat: -12.971398, lng: -38.501583 },
                    'Brasília': { lat: -15.794229, lng: -47.882166 },
                    'Fortaleza': { lat: -3.731862, lng: -38.526669 },
                    'Manaus': { lat: -3.119028, lng: -60.021731 },
                    'Curitiba': { lat: -25.441105, lng: -49.276855 },
                    'Recife': { lat: -8.047562, lng: -34.877003 },
                    'Porto Alegre': { lat: -30.034647, lng: -51.217658 }
                };

                coords = cityCoordinates[addressData.localidade] ||
                        cityCoordinates['São Paulo']; // Default to São Paulo
            }

            const result = {
                success: true,
                cep: cleanCEP,
                address: {
                    street: addressData.logradouro || '',
                    district: addressData.bairro || '',
                    city: addressData.localidade || '',
                    state: addressData.uf || '',
                    full_address: `${addressData.logradouro}, ${addressData.bairro}, ${addressData.localidade}, ${addressData.uf}`
                },
                coordinates: coords,
                source: coords ? 'viacep_nominatim_geocoding' : 'viacep_city_fallback'
            };

            console.log('✅ CEP geocoding successful');
            return res.status(200).json(result);

        } catch (error) {
            console.error('Error calling ViaCEP:', error);
            return res.status(500).json({
                success: false,
                message: 'Erro ao consultar CEP'
            });
        }

    } catch (error) {
        console.error('💥 Serverless CEP error:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
}