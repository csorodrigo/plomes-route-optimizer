import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client for geocoding cache
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

let supabase = null;
if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { 'connection': 'keep-alive' } }
  });
}

// Brazilian states coordinates for validation
const brazilianStates = {
  'AC': { bounds: { north: -7.0, south: -11.2, east: -66.6, west: -74.0 } },
  'AL': { bounds: { north: -8.8, south: -10.5, east: -35.1, west: -38.2 } },
  'AP': { bounds: { north: 5.3, south: -4.4, east: -50.0, west: -54.9 } },
  'AM': { bounds: { north: 2.3, south: -9.8, east: -56.1, west: -73.8 } },
  'BA': { bounds: { north: -8.5, south: -18.3, east: -37.3, west: -47.8 } },
  'CE': { bounds: { north: -2.8, south: -7.9, east: -37.2, west: -41.4 } },
  'DF': { bounds: { north: -15.5, south: -16.1, east: -47.4, west: -48.3 } },
  'ES': { bounds: { north: -17.9, south: -21.3, east: -39.7, west: -41.9 } },
  'GO': { bounds: { north: -12.4, south: -19.5, east: -45.9, west: -53.2 } },
  'MA': { bounds: { north: -1.0, south: -10.3, east: -41.8, west: -48.9 } },
  'MT': { bounds: { north: -7.3, south: -18.0, east: -50.2, west: -61.6 } },
  'MS': { bounds: { north: -17.9, south: -24.1, east: -50.9, west: -58.2 } },
  'MG': { bounds: { north: -14.2, south: -22.9, east: -39.9, west: -51.0 } },
  'PA': { bounds: { north: 2.6, south: -9.9, east: -46.0, west: -58.9 } },
  'PB': { bounds: { north: -6.0, south: -8.3, east: -34.8, west: -38.8 } },
  'PR': { bounds: { north: -22.5, south: -26.7, east: -48.0, west: -54.6 } },
  'PE': { bounds: { north: -7.3, south: -9.6, east: -34.8, west: -41.4 } },
  'PI': { bounds: { north: -2.7, south: -10.9, east: -40.4, west: -45.9 } },
  'RJ': { bounds: { north: -20.8, south: -23.4, east: -40.9, west: -44.9 } },
  'RN': { bounds: { north: -4.8, south: -6.9, east: -34.9, west: -38.6 } },
  'RS': { bounds: { north: -27.1, south: -33.8, east: -49.7, west: -57.6 } },
  'RO': { bounds: { north: -7.9, south: -13.7, east: -60.0, west: -66.8 } },
  'RR': { bounds: { north: 5.3, south: -1.0, east: -58.0, west: -64.8 } },
  'SC': { bounds: { north: -25.9, south: -29.4, east: -48.3, west: -53.8 } },
  'SP': { bounds: { north: -19.8, south: -25.3, east: -44.2, west: -53.1 } },
  'SE': { bounds: { north: -9.5, south: -11.6, east: -36.4, west: -38.6 } },
  'TO': { bounds: { north: -5.2, south: -13.5, east: -45.7, west: -50.7 } }
};

// Utility functions
function isInBrazil(lat, lng) {
  const brazilBounds = { north: 5.3, south: -33.8, east: -28.8, west: -73.8 };
  return lat >= brazilBounds.south && lat <= brazilBounds.north &&
         lng >= brazilBounds.west && lng <= brazilBounds.east;
}

function validateCoordinates(lat, lng, state = null) {
  if (!lat || !lng || isNaN(lat) || isNaN(lng)) return false;

  if (!isInBrazil(lat, lng)) return false;

  if (state && brazilianStates[state]) {
    const bounds = brazilianStates[state].bounds;
    return lat >= bounds.south && lat <= bounds.north &&
           lng >= bounds.west && lng <= bounds.east;
  }

  return true;
}

// Get cached geocoding result
async function getCachedGeocoding(address) {
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('geocoding_cache')
      .select('latitude, longitude, provider, created_at')
      .eq('address', address)
      .single();

    if (error || !data) return null;

    // Cache is valid for 30 days
    const cacheAge = new Date() - new Date(data.created_at);
    const maxAge = 30 * 24 * 60 * 60 * 1000;

    if (cacheAge > maxAge) return null;

    return data;
  } catch (error) {
    console.error('Cache lookup error:', error);
    return null;
  }
}

// Save geocoding result to cache
async function saveGeocodingCache(address, lat, lng, provider) {
  if (!supabase) return;

  try {
    await supabase
      .from('geocoding_cache')
      .upsert({
        address,
        latitude: lat,
        longitude: lng,
        provider,
        updated_at: new Date().toISOString()
      });
  } catch (error) {
    console.error('Cache save error:', error);
  }
}

// Enhanced geocoding providers with better error handling
const providers = [
  {
    name: 'awesomeapi',
    url: (cep) => `https://cep.awesomeapi.com.br/json/${cep}`,
    priority: 1,
    transform: (data) => ({
      lat: parseFloat(data.lat),
      lng: parseFloat(data.lng),
      address: `${data.address || ''}, ${data.district || ''}, ${data.city} - ${data.state}`.replace(/^, /, ''),
      city: data.city,
      state: data.state,
      provider: 'awesomeapi'
    })
  },
  {
    name: 'brasilapi',
    url: (cep) => `https://brasilapi.com.br/api/cep/v1/${cep}`,
    priority: 2,
    transform: (data) => {
      // BrasilAPI doesn't provide coordinates, will need fallback geocoding
      return {
        lat: null,
        lng: null,
        address: `${data.street || ''}, ${data.neighborhood || ''}, ${data.city} - ${data.state}`.replace(/^, /, ''),
        city: data.city,
        state: data.state,
        provider: 'brasilapi',
        needsGeocode: true
      };
    }
  },
  {
    name: 'opencep',
    url: (cep) => `https://opencep.com/v1/${cep}`,
    priority: 3,
    transform: (data) => {
      if (data.status !== 200) throw new Error('CEP not found');
      const result = data.result;
      return {
        lat: result.lat ? parseFloat(result.lat) : null,
        lng: result.lng ? parseFloat(result.lng) : null,
        address: `${result.address || ''}, ${result.district || ''}, ${result.city} - ${result.state}`.replace(/^, /, ''),
        city: result.city,
        state: result.state,
        provider: 'opencep',
        needsGeocode: !result.lat || !result.lng
      };
    }
  },
  {
    name: 'viacep',
    url: (cep) => `https://viacep.com.br/ws/${cep}/json/`,
    priority: 4,
    transform: (data) => {
      if (data.erro) throw new Error('CEP not found');
      return {
        lat: null,
        lng: null,
        address: `${data.logradouro || ''}, ${data.bairro || ''}, ${data.localidade} - ${data.uf}`.replace(/^, /, ''),
        city: data.localidade,
        state: data.uf,
        provider: 'viacep',
        needsGeocode: true
      };
    }
  }
];

// Fallback geocoding using Nominatim
async function fallbackGeocode(address, state) {
  try {
    const params = new URLSearchParams({
      q: `${address}, Brasil`,
      format: 'json',
      countrycodes: 'br',
      limit: 1,
      addressdetails: 1
    });

    const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: {
        'User-Agent': 'PlomesRouteApp/1.0',
        'Accept': 'application/json'
      }
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    if (data && data.length > 0) {
      const result = data[0];
      const lat = parseFloat(result.lat);
      const lng = parseFloat(result.lon);

      if (validateCoordinates(lat, lng, state)) {
        return { lat, lng, provider: 'nominatim_fallback' };
      }
    }

    return null;
  } catch (error) {
    console.error('Fallback geocoding error:', error);
    return null;
  }
}

// Main handler
export default async function handler(req, res) {
  // Enable CORS - No authentication required for CEP lookup
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour

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
    const { cep } = req.query;

    if (!cep) {
      return res.status(400).json({
        success: false,
        error: 'CEP required'
      });
    }

    // Clean CEP (remove non-digits)
    const cleanCep = cep.replace(/\D/g, '');

    if (cleanCep.length !== 8) {
      return res.status(400).json({
        success: false,
        error: 'Invalid CEP format. Expected 8 digits.'
      });
    }

    // Check cache first
    const cacheKey = `CEP:${cleanCep}`;
    const cached = await getCachedGeocoding(cacheKey);

    if (cached && validateCoordinates(cached.latitude, cached.longitude)) {
      return res.status(200).json({
        lat: cached.latitude,
        lng: cached.longitude,
        address: cached.address || `CEP ${cleanCep}`,
        provider: cached.provider,
        success: true,
        cached: true
      });
    }

    // Try providers in priority order
    let result = null;
    let lastError = null;
    let addressInfo = null;

    for (const provider of providers) {
      try {
        const response = await fetch(provider.url(cleanCep), {
          timeout: 8000,
          headers: {
            'User-Agent': 'PlomesRouteApp/1.0',
            'Accept': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        const transformed = provider.transform(data);

        // Store address info for later use
        if (transformed.city && transformed.state) {
          addressInfo = transformed;
        }

        // If we have valid coordinates, use them
        if (transformed.lat && transformed.lng &&
            validateCoordinates(transformed.lat, transformed.lng, transformed.state)) {
          result = transformed;
          break;
        }

        // If this provider needs geocoding, store for fallback
        if (transformed.needsGeocode && !result && addressInfo) {
          addressInfo = transformed;
        }

      } catch (error) {
        console.warn(`Provider ${provider.name} failed:`, error.message);
        lastError = error;
        continue;
      }
    }

    // If no direct coordinates found, try fallback geocoding
    if (!result && addressInfo) {
      console.log(`Attempting fallback geocoding for: ${addressInfo.address}`);
      const fallbackResult = await fallbackGeocode(addressInfo.address, addressInfo.state);

      if (fallbackResult) {
        result = {
          lat: fallbackResult.lat,
          lng: fallbackResult.lng,
          address: addressInfo.address,
          city: addressInfo.city,
          state: addressInfo.state,
          provider: `${addressInfo.provider}+${fallbackResult.provider}`,
          approximate: true
        };
      }
    }

    if (!result || !result.lat || !result.lng) {
      return res.status(404).json({
        success: false,
        error: 'Could not geocode CEP',
        details: lastError?.message,
        cep: cleanCep
      });
    }

    // Save to cache
    await saveGeocodingCache(cacheKey, result.lat, result.lng, result.provider);

    return res.status(200).json({
      lat: result.lat,
      lng: result.lng,
      address: result.address.trim(),
      city: result.city,
      state: result.state,
      provider: result.provider,
      approximate: result.approximate || false,
      success: true,
      cached: false
    });

  } catch (error) {
    console.error('CEP geocoding error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
}