import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env.server";
import https from 'https';

interface HttpsRequestOptions {
  method?: string;
  headers?: Record<string, string>;
  timeout?: number;
}

interface HttpsResponse {
  ok: boolean;
  status: number;
  statusText: string;
  json: () => Promise<unknown>;
  text: () => Promise<string>;
}

interface ReverseGeocodeResponse {
  cep?: string;
  address: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
  provider: string;
  success: boolean;
}

interface GoogleReverseGeocodingResponse {
  status: string;
  results: Array<{
    formatted_address: string;
    address_components: Array<{
      long_name: string;
      short_name: string;
      types: string[];
    }>;
    geometry: {
      location: {
        lat: number;
        lng: number;
      };
    };
  }>;
}

interface NominatimReverseResult {
  display_name: string;
  address: {
    postcode?: string;
    city?: string;
    town?: string;
    village?: string;
    state?: string;
    road?: string;
    suburb?: string;
  };
  lat: string;
  lon: string;
}

// HTTP request utility for HTTPS requests
function makeHttpsRequest(url: string, options: HttpsRequestOptions = {}): Promise<HttpsResponse> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);

    const reqOptions = {
      hostname: urlObj.hostname,
      port: 443,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'User-Agent': 'PlomesRotaCEP/1.0',
        ...options.headers
      },
      timeout: options.timeout || 10000
    };

    const req = https.request(reqOptions, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        const statusCode = res.statusCode ?? 500;
        const statusText = res.statusMessage ?? 'Unknown Error';

        resolve({
          ok: statusCode >= 200 && statusCode < 300,
          status: statusCode,
          statusText: statusText,
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

    req.end();
  });
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const lat = searchParams.get('lat');
    const lng = searchParams.get('lng');

    if (!lat || !lng) {
      return NextResponse.json(
        {
          success: false,
          error: "Latitude and longitude are required"
        },
        { status: 400 }
      );
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);

    if (isNaN(latitude) || isNaN(longitude)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid coordinates"
        },
        { status: 400 }
      );
    }

    // Validate Brazilian coordinates
    if (latitude < -35 || latitude > 5 || longitude < -75 || longitude > -30) {
      return NextResponse.json(
        {
          success: false,
          error: "Coordinates outside Brazil bounds"
        },
        { status: 400 }
      );
    }

    console.log(`🔍 Reverse geocoding: ${latitude}, ${longitude}`);

    // Strategy 1: Try Google Maps Reverse Geocoding API (most accurate, includes CEP)
    if (env.GOOGLE_MAPS_API_KEY) {
      try {
        const googleUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${env.GOOGLE_MAPS_API_KEY}`;

        const googleResponse = await makeHttpsRequest(googleUrl, { timeout: 8000 });

        if (googleResponse.ok) {
          const googleData = await googleResponse.json() as GoogleReverseGeocodingResponse;

          if (googleData.status === 'OK' && googleData.results && googleData.results.length > 0) {
            const result = googleData.results[0];

            // Extract CEP, city, and state
            let cep = '';
            let city = '';
            let state = '';
            const address = result.formatted_address;

            for (const component of result.address_components) {
              if (component.types.includes('postal_code')) {
                cep = component.long_name.replace(/\D/g, '');
              }
              if (component.types.includes('administrative_area_level_2')) {
                city = component.long_name;
              }
              if (component.types.includes('administrative_area_level_1')) {
                state = component.short_name;
              }
            }

            console.log(`✅ Google Maps reverse geocoding successful: ${cep || 'no CEP'}`);

            const response: ReverseGeocodeResponse = {
              cep: cep || undefined,
              address,
              city,
              state,
              lat: latitude,
              lng: longitude,
              provider: 'google_maps',
              success: true
            };

            return NextResponse.json(response);
          }
        }
      } catch (googleError: unknown) {
        console.warn(`⚠️ Google Maps reverse geocoding failed:`, googleError instanceof Error ? googleError.message : 'Unknown error');
      }
    }

    // Strategy 2: Try Nominatim (OpenStreetMap) - Free but no CEP
    try {
      const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`;

      const nominatimResponse = await makeHttpsRequest(nominatimUrl, {
        timeout: 5000,
        headers: {
          'User-Agent': 'PlomesRotaCEP/1.0 (reverse geocoding service)',
          'Accept': 'application/json'
        }
      });

      if (nominatimResponse.ok) {
        const nominatimData = await nominatimResponse.json() as NominatimReverseResult;

        if (nominatimData && nominatimData.address) {
          const address = nominatimData.display_name;
          const city = nominatimData.address.city || nominatimData.address.town || nominatimData.address.village || '';
          const state = nominatimData.address.state || '';
          const cep = nominatimData.address.postcode?.replace(/\D/g, '');

          console.log(`✅ Nominatim reverse geocoding successful: ${cep || 'no CEP'}`);

          const response: ReverseGeocodeResponse = {
            cep: cep || undefined,
            address,
            city,
            state,
            lat: latitude,
            lng: longitude,
            provider: 'nominatim',
            success: true
          };

          return NextResponse.json(response);
        }
      }
    } catch (nominatimError: unknown) {
      console.warn(`⚠️ Nominatim reverse geocoding failed:`, nominatimError instanceof Error ? nominatimError.message : 'Unknown error');
    }

    // All strategies failed
    console.log(`❌ All reverse geocoding strategies failed for ${latitude}, ${longitude}`);

    return NextResponse.json(
      {
        success: false,
        error: "Could not reverse geocode these coordinates",
        lat: latitude,
        lng: longitude,
        attempted_providers: [
          env.GOOGLE_MAPS_API_KEY ? 'google_maps' : null,
          'nominatim'
        ].filter(Boolean),
        timestamp: new Date().toISOString()
      },
      { status: 404 }
    );

  } catch (error: unknown) {
    console.error(`💥 Reverse geocoding error:`, error);

    return NextResponse.json(
      {
        success: false,
        error: "Server error during reverse geocoding",
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
