import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env.server";
import https from 'https';
import type {
  CepRouteParams,
  GeocodeResponse,
  GoogleGeocodingResponse,
  ViaCepResponse,
  NominatimResult,
  PositionstackResponse
} from "@/types/api";

interface HttpsRequestOptions {
  method?: string;
  headers?: Record<string, string>;
  timeout?: number;
  body?: string;
}

interface HttpsResponse {
  ok: boolean;
  status: number;
  statusText: string;
  json: () => Promise<unknown>;
  text: () => Promise<string>;
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

export async function GET(
  request: NextRequest,
  context: CepRouteParams
) {
  let cep = '';

  try {
    const { cep: rawCep } = await context.params;
    cep = rawCep.replace(/\D/g, '');

    if (!cep || cep.length !== 8) {
      return NextResponse.json(
        {
          success: false,
          error: "CEP must be 8 digits"
        },
        { status: 400 }
      );
    }

    console.log(`🔍 Geocoding CEP: ${cep}`);

    // Strategy 1: Try Google Maps Geocoding API (most accurate)
    if (env.GOOGLE_MAPS_API_KEY) {
      try {
        const googleUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${cep},Brazil&key=${env.GOOGLE_MAPS_API_KEY}`;

        const googleResponse = await makeHttpsRequest(googleUrl, { timeout: 8000 });

        if (googleResponse.ok) {
          const googleData = await googleResponse.json() as GoogleGeocodingResponse;

          if (googleData.status === 'OK' && googleData.results && googleData.results.length > 0) {
            const result = googleData.results[0];
            const location = result.geometry.location;

            // Extract address components
            let city = '';
            let state = '';
            const address = result.formatted_address;

            for (const component of result.address_components) {
              if (component.types.includes('administrative_area_level_2')) {
                city = component.long_name;
              }
              if (component.types.includes('administrative_area_level_1')) {
                state = component.short_name;
              }
            }

            console.log(`✅ Google Maps geocoding successful for CEP ${cep}`);

            const response: GeocodeResponse = {
              lat: location.lat,
              lng: location.lng,
              latitude: location.lat,
              longitude: location.lng,
              address,
              city,
              state,
              cep,
              provider: 'google_maps',
              success: true
            };

            return NextResponse.json(response);
          }
        }
      } catch (googleError: unknown) {
        console.warn(`⚠️ Google Maps geocoding failed for CEP ${cep}:`, googleError instanceof Error ? googleError.message : 'Unknown error');
      }
    }

    // Strategy 2: Try ViaCEP + Nominatim combination
    try {
      // First get address from ViaCEP
      const viaCepUrl = `https://viacep.com.br/ws/${cep}/json/`;
      const viaCepResponse = await makeHttpsRequest(viaCepUrl, { timeout: 5000 });

      if (viaCepResponse.ok) {
        const viaCepData = await viaCepResponse.json() as ViaCepResponse;

        if (!viaCepData.erro) {
          // Build full address for Nominatim
          const fullAddress = `${viaCepData.logradouro}, ${viaCepData.bairro}, ${viaCepData.localidade}, ${viaCepData.uf}, Brazil`;

          // Now geocode with Nominatim
          const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fullAddress)}&limit=1`;

          const nominatimResponse = await makeHttpsRequest(nominatimUrl, {
            timeout: 5000,
            headers: {
              'User-Agent': 'PlomesRotaCEP/1.0 (geocoding service)',
              'Accept': 'application/json'
            }
          });

          if (nominatimResponse.ok) {
            const nominatimData = await nominatimResponse.json() as NominatimResult[];

            if (nominatimData && nominatimData.length > 0) {
              const result = nominatimData[0];

              console.log(`✅ ViaCEP + Nominatim geocoding successful for CEP ${cep}`);

              const response: GeocodeResponse = {
                lat: parseFloat(result.lat),
                lng: parseFloat(result.lon),
                latitude: parseFloat(result.lat),
                longitude: parseFloat(result.lon),
                address: `${viaCepData.logradouro}, ${viaCepData.bairro}`,
                city: viaCepData.localidade,
                state: viaCepData.uf,
                cep,
                provider: 'viacep_nominatim',
                success: true
              };

              return NextResponse.json(response);
            }
          }
        }
      }
    } catch (viaCepError: unknown) {
      console.warn(`⚠️ ViaCEP + Nominatim geocoding failed for CEP ${cep}:`, viaCepError instanceof Error ? viaCepError.message : 'Unknown error');
    }

    // Strategy 3: Try Positionstack API (if available)
    if (env.POSITIONSTACK_API_KEY) {
      try {
        const positionstackUrl = `https://api.positionstack.com/v1/forward?access_key=${env.POSITIONSTACK_API_KEY}&query=${cep},Brazil&limit=1`;

        const positionstackResponse = await makeHttpsRequest(positionstackUrl, { timeout: 5000 });

        if (positionstackResponse.ok) {
          const positionstackData = await positionstackResponse.json() as PositionstackResponse;

          if (positionstackData.data && positionstackData.data.length > 0) {
            const result = positionstackData.data[0];

            console.log(`✅ Positionstack geocoding successful for CEP ${cep}`);

            const response: GeocodeResponse = {
              lat: result.latitude,
              lng: result.longitude,
              latitude: result.latitude,
              longitude: result.longitude,
              address: result.name || result.label,
              city: result.locality || result.administrative_area,
              state: result.region,
              cep,
              provider: 'positionstack',
              success: true
            };

            return NextResponse.json(response);
          }
        }
      } catch (positionstackError: unknown) {
        console.warn(`⚠️ Positionstack geocoding failed for CEP ${cep}:`, positionstackError instanceof Error ? positionstackError.message : 'Unknown error');
      }
    }

    // All strategies failed
    console.log(`❌ All geocoding strategies failed for CEP ${cep}`);

    return NextResponse.json(
      {
        success: false,
        error: "Could not geocode this CEP",
        cep,
        attempted_providers: [
          env.GOOGLE_MAPS_API_KEY ? 'google_maps' : null,
          'viacep_nominatim',
          env.POSITIONSTACK_API_KEY ? 'positionstack' : null
        ].filter(Boolean),
        timestamp: new Date().toISOString()
      },
      { status: 404 }
    );

  } catch (error: unknown) {
    console.error(`💥 Geocoding error for CEP ${cep}:`, error);

    return NextResponse.json(
      {
        success: false,
        error: "Server error during geocoding",
        cep,
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