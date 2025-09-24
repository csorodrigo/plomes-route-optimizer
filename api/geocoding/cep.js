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

    // Only allow POST method
    if (req.method !== 'POST') {
        return res.status(405).json({
            success: false,
            message: 'Method not allowed. Use POST.'
        });
    }

    try {
        console.log('🚨 Vercel Serverless CEP Geocoding called');
        const { cep } = req.body;

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

            // Mock coordinates for São Paulo region (you can enhance this with real geocoding)
            const mockCoordinates = {
                '01310100': { lat: -23.561684, lng: -46.625378 }, // Centro SP
                '01310200': { lat: -23.563720, lng: -46.653256 }, // Paulista
                '01310300': { lat: -23.555771, lng: -46.662188 }, // Augusta
            };

            const coords = mockCoordinates[cleanCEP] || {
                lat: -23.550520 + (Math.random() - 0.5) * 0.1, // Random around SP center
                lng: -46.633308 + (Math.random() - 0.5) * 0.1
            };

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
                source: 'viacep_mock_coords'
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