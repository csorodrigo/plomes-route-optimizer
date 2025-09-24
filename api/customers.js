// Vercel Serverless Function for Customers API - Real Ploome Integration
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
        console.log('🚨 Vercel Serverless Customers API called - Real Ploome Integration');

        // Get Ploome credentials from environment
        const PLOOMES_API_KEY = process.env.PLOOMES_API_KEY;
        const PLOOMES_BASE_URL = process.env.PLOOMES_BASE_URL;
        const CLIENT_TAG_ID = process.env.CLIENT_TAG_ID;

        if (!PLOOMES_API_KEY || !PLOOMES_BASE_URL) {
            console.error('❌ Missing Ploome credentials');
            return res.status(500).json({
                success: false,
                message: 'Ploome credentials not configured'
            });
        }

        // Function to get real coordinates for an address
        async function geocodeAddress(address) {
            try {
                const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address + ', Brazil')}&limit=1`;
                const response = await fetch(nominatimUrl, {
                    headers: {
                        'User-Agent': 'PlomesRotaCEP/1.0 (geocoding service)'
                    }
                });
                const data = await response.json();

                if (data && data.length > 0) {
                    return {
                        latitude: parseFloat(data[0].lat),
                        longitude: parseFloat(data[0].lon)
                    };
                }
                return null;
            } catch (error) {
                console.error('Geocoding error:', error);
                return null;
            }
        }

        // Fetch customers from Ploome API
        try {
            const ploomeUrl = `${PLOOMES_BASE_URL}/Contacts`;
            const ploomeResponse = await fetch(ploomeUrl, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'User-Key': PLOOMES_API_KEY
                }
            });

            if (!ploomeResponse.ok) {
                console.error('❌ Ploome API error:', ploomeResponse.status, ploomeResponse.statusText);
                return res.status(500).json({
                    success: false,
                    message: `Ploome API error: ${ploomeResponse.status}`
                });
            }

            const ploomeData = await ploomeResponse.json();
            console.log('✅ Ploome API response received');

            // Transform Ploome data to our format and add geocoding
            const customers = [];
            const contacts = ploomeData.value || [];

            for (let i = 0; i < Math.min(contacts.length, 50); i++) { // Limit to 50 customers for performance
                const contact = contacts[i];

                // Build address string
                let address = '';
                let cep = '';
                let city = '';
                let state = '';

                // Extract address information from Ploome contact
                if (contact.Address) {
                    address = contact.Address.Street || '';
                    cep = contact.Address.ZipCode || '';
                    city = contact.Address.City || '';
                    state = contact.Address.State || '';

                    if (contact.Address.Number) {
                        address += `, ${contact.Address.Number}`;
                    }
                    if (contact.Address.District) {
                        address += `, ${contact.Address.District}`;
                    }
                    if (city) {
                        address += `, ${city}`;
                    }
                    if (state) {
                        address += `, ${state}`;
                    }
                }

                // Get coordinates for the address
                const coords = await geocodeAddress(address);

                // Format customer data
                const customer = {
                    id: contact.Id,
                    name: contact.Name || 'Nome não informado',
                    email: contact.Email || '',
                    phone: contact.Phones && contact.Phones.length > 0 ? contact.Phones[0].PhoneNumber : '',
                    address: address,
                    cep: cep,
                    city: city,
                    state: state,
                    latitude: coords ? coords.latitude : null,
                    longitude: coords ? coords.longitude : null,
                    ploome_person_id: contact.Id.toString(),
                    created_date: contact.CreateDate,
                    last_interaction: contact.LastInteractionDate
                };

                customers.push(customer);

                // Add small delay to respect rate limits
                if (i < contacts.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }

            console.log(`✅ Processed ${customers.length} customers from Ploome`);
            return res.status(200).json({
                success: true,
                customers: customers,
                total: customers.length,
                total_in_ploome: contacts.length,
                source: 'ploome_api_real_data',
                message: 'Real customers data from Ploome API with geocoding'
            });

        } catch (ploomeError) {
            console.error('💥 Ploome API integration error:', ploomeError);
            return res.status(500).json({
                success: false,
                message: 'Error connecting to Ploome API',
                error: ploomeError.message
            });
        }

    } catch (error) {
        console.error('💥 Serverless customers error:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
}