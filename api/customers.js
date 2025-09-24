// Vercel Serverless Function for Customers API
export default async function handler(req, res) {
    // Configure CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Handle preflight OPTIONS request
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Only allow GET method for now
    if (req.method !== 'GET') {
        return res.status(405).json({
            success: false,
            message: 'Method not allowed. Use GET.'
        });
    }

    try {
        console.log('🚨 Vercel Serverless Customers API called');

        // Mock customers data for testing
        const mockCustomers = [
            {
                id: 1,
                name: "João Silva",
                email: "joao.silva@empresa.com",
                phone: "(11) 99999-1111",
                address: "Rua das Flores, 123, São Paulo, SP",
                cep: "01310-100",
                city: "São Paulo",
                state: "SP",
                latitude: -23.561684,
                longitude: -46.625378,
                ploome_person_id: "123456"
            },
            {
                id: 2,
                name: "Maria Santos",
                email: "maria.santos@empresa.com",
                phone: "(11) 99999-2222",
                address: "Av. Paulista, 456, São Paulo, SP",
                cep: "01310-200",
                city: "São Paulo",
                state: "SP",
                latitude: -23.563720,
                longitude: -46.653256,
                ploome_person_id: "789012"
            },
            {
                id: 3,
                name: "Pedro Oliveira",
                email: "pedro.oliveira@empresa.com",
                phone: "(11) 99999-3333",
                address: "Rua Augusta, 789, São Paulo, SP",
                cep: "01310-300",
                city: "São Paulo",
                state: "SP",
                latitude: -23.555771,
                longitude: -46.662188,
                ploome_person_id: "345678"
            }
        ];

        console.log('✅ Returning mock customers data');
        return res.status(200).json({
            success: true,
            customers: mockCustomers,
            total: mockCustomers.length,
            source: 'mock_data',
            message: 'Mock customers data (Vercel serverless)'
        });

    } catch (error) {
        console.error('💥 Serverless customers error:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
}