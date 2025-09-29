// Vercel Serverless Function for Authentication
module.exports = async function handler(req, res) {
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
        console.log('🚨 Vercel Serverless Login Function called');
        const { email, password } = req.body;

        console.log('📧 Login attempt for:', email);

        // Basic hardcoded check for testing
        if (email === 'gustavo.canuto@ciaramaquinas.com.br' && password === 'ciara123@') {
            console.log('✅ Serverless login success');
            return res.status(200).json({
                success: true,
                message: 'Login successful (serverless route)',
                user: {
                    email: email,
                    name: 'Gustavo Canuto',
                    role: 'admin'
                },
                token: 'serverless-token-abc123'
            });
        } else {
            console.log('❌ Serverless login failed - invalid credentials');
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }
    } catch (error) {
        console.error('💥 Serverless login error:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
}