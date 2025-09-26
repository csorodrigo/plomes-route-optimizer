// Vercel Serverless Function for Statistics API
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key-for-demo';

function verifyToken(req) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('No token provided');
  }

  const token = authHeader.substring(7);
  return jwt.verify(token, JWT_SECRET);
}

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
  }

  try {
    // Verify authentication
    verifyToken(req);

    // Demo statistics - in production this would come from the database
    const statistics = {
      totalCustomers: 2,
      geocodedCustomers: 2,
      unGeocodedCustomers: 0,
      lastSync: new Date().toISOString(),
      routesGenerated: 5,
      averageRouteDistance: 12.5,
      totalDistanceOptimized: 62.3
    };

    return res.status(200).json({
      success: true,
      statistics
    });

  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired token'
      });
    }

    console.error('Statistics API error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}