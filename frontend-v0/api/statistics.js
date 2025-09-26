// Vercel Serverless Function for Statistics API
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

    // Get real statistics from Supabase using batched queries
    let allCustomers = [];
    let hasMore = true;
    let offset = 0;
    const batchSize = 1000;

    while (hasMore) {
      const { data: batchData, error: batchError } = await supabase
        .from('customers')
        .select('id, latitude, longitude, geocoding_status, updated_at')
        .range(offset, offset + batchSize - 1)
        .order('updated_at', { ascending: false });

      if (batchError) {
        console.error('Supabase batch query error:', batchError);
        throw new Error(`Database query failed: ${batchError.message}`);
      }

      if (batchData && batchData.length > 0) {
        allCustomers = allCustomers.concat(batchData);
        offset += batchSize;

        // If we got less than the batch size, we've reached the end
        if (batchData.length < batchSize) {
          hasMore = false;
        }
      } else {
        hasMore = false;
      }
    }

    const customersData = allCustomers;

    const customers = customersData || [];
    const totalCustomers = customers.length;
    const geocodedCustomers = customers.filter(c => c.latitude && c.longitude).length;
    const unGeocodedCustomers = totalCustomers - geocodedCustomers;

    // Get the most recent update timestamp
    const lastSync = customers.length > 0 ? customers[0].updated_at : new Date().toISOString();

    // Calculate some route statistics (you can enhance this based on your actual route data)
    const routesGenerated = Math.floor(geocodedCustomers / 10); // Assuming 10 customers per route
    const averageRouteDistance = geocodedCustomers > 0 ? (geocodedCustomers * 0.8) : 0; // Rough estimate
    const totalDistanceOptimized = routesGenerated * averageRouteDistance;

    const statistics = {
      totalCustomers,
      geocodedCustomers,
      unGeocodedCustomers,
      lastSync,
      routesGenerated,
      averageRouteDistance: parseFloat(averageRouteDistance.toFixed(1)),
      totalDistanceOptimized: parseFloat(totalDistanceOptimized.toFixed(1))
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