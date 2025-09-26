// Vercel Serverless Function for Customers API
import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key-for-demo';

// Supabase configuration
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Initialize Supabase client with service role key for server-side operations
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

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

    // Check Supabase configuration
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      throw new Error('Supabase configuration is missing');
    }

    const { lat, lng, radius } = req.query;

    // Base query to get all geocoded customers (only customers with valid lat/lng)
    let query = supabase
      .from('customers')
      .select(`
        id,
        name,
        email,
        phone,
        address,
        cep,
        city,
        state,
        latitude,
        longitude,
        geocoded_address,
        geocoding_status
      `)
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)
      .order('name', { ascending: true });

    // Execute the query
    const { data: customersData, error: queryError } = await query;

    if (queryError) {
      console.error('Supabase query error:', queryError);
      throw new Error(`Database query failed: ${queryError.message}`);
    }

    let customers = customersData || [];

    // Transform data to include both latitude/longitude and lat/lng for compatibility
    customers = customers.map(customer => ({
      ...customer,
      lat: customer.latitude,
      lng: customer.longitude,
      // Construct full_address if not available
      full_address: customer.geocoded_address || customer.address
    }));

    // Filter by radius if coordinates provided
    if (lat && lng && radius && customers.length > 0) {
      const centerLat = parseFloat(lat);
      const centerLng = parseFloat(lng);
      const maxRadius = parseFloat(radius);

      customers = customers.filter(customer => {
        if (!customer.latitude || !customer.longitude) return false;

        // Simple distance calculation (Haversine formula)
        const R = 6371; // Earth's radius in km
        const dLat = (customer.latitude - centerLat) * Math.PI / 180;
        const dLng = (customer.longitude - centerLng) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(centerLat * Math.PI / 180) * Math.cos(customer.latitude * Math.PI / 180) *
                  Math.sin(dLng/2) * Math.sin(dLng/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const distance = R * c;

        return distance <= maxRadius;
      });
    }

    return res.status(200).json({
      success: true,
      count: customers.length,
      customers
    });

  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired token'
      });
    }

    console.error('Customers API error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
}