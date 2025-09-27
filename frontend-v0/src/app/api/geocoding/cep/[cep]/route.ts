import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-please-change-this-in-production';

// Configurações das APIs de geocoding
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || 'AIzaSyBKyuYzhwmPsk0tEk2N4qnELPFV-7nuvHk';
const POSITIONSTACK_API_KEY = process.env.POSITIONSTACK_API_KEY || 'af855cf79ef4194561e7ee8faf3f9dc4O';

// Interface para resposta de geocoding
interface GeocodeResponse {
  lat: number;
  lng: number;
  latitude?: number;
  longitude?: number;
  address?: string;
  city?: string;
  state?: string;
  cep?: string;
  provider?: string;
  success?: boolean;
}

// Função para verificar token
function verifyToken(request: NextRequest): { valid: boolean; error?: string } {
  const authHeader = request.headers.get('authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { valid: false, error: 'Token de autorização não fornecido' };
  }

  const token = authHeader.substring(7);

  try {
    jwt.verify(token, JWT_SECRET);
    return { valid: true };
  } catch (error) {
    return { valid: false, error: 'Token inválido ou expirado' };
  }
}

// Função para validar CEP
function isValidCEP(cep: string): boolean {
  const cleanCep = cep.replace(/\D/g, '');
  return cleanCep.length === 8 && /^\d{8}$/.test(cleanCep);
}

// Função para geocoding via ViaCEP + Google Maps
async function geocodeViaViaCEP(cep: string): Promise<GeocodeResponse> {
  try {
    // 1. Buscar endereço no ViaCEP
    const viaCepResponse = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    const viaCepData = await viaCepResponse.json();

    if (viaCepData.erro) {
      throw new Error('CEP não encontrado no ViaCEP');
    }

    const address = `${viaCepData.logradouro}, ${viaCepData.bairro}, ${viaCepData.localidade}, ${viaCepData.uf}, Brazil`;

    // 2. Geocodificar endereço no Google Maps
    const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_MAPS_API_KEY}`;

    const googleResponse = await fetch(geocodeUrl);
    const googleData = await googleResponse.json();

    if (googleData.status !== 'OK' || !googleData.results[0]) {
      throw new Error('Erro na geocodificação Google Maps');
    }

    const location = googleData.results[0].geometry.location;

    return {
      lat: location.lat,
      lng: location.lng,
      latitude: location.lat,
      longitude: location.lng,
      address: viaCepData.logradouro,
      city: viaCepData.localidade,
      state: viaCepData.uf,
      cep: cep,
      provider: 'ViaCEP + Google Maps',
      success: true
    };

  } catch (error) {
    throw error;
  }
}

// Função para geocoding via PositionStack (fallback)
async function geocodeViaPositionStack(cep: string): Promise<GeocodeResponse> {
  try {
    const url = `http://api.positionstack.com/v1/forward?access_key=${POSITIONSTACK_API_KEY}&query=${cep}&country=BR&limit=1`;

    const response = await fetch(url);
    const data = await response.json();

    if (!data.data || data.data.length === 0) {
      throw new Error('CEP não encontrado no PositionStack');
    }

    const result = data.data[0];

    return {
      lat: result.latitude,
      lng: result.longitude,
      latitude: result.latitude,
      longitude: result.longitude,
      address: result.name || result.label,
      city: result.locality,
      state: result.region,
      cep: cep,
      provider: 'PositionStack',
      success: true
    };

  } catch (error) {
    throw error;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ cep: string }> }
) {
  try {
    // Enable CORS
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Content-Type': 'application/json',
    };

    // Verificar token
    const tokenCheck = verifyToken(request);
    if (!tokenCheck.valid) {
      return NextResponse.json(
        {
          success: false,
          message: tokenCheck.error
        },
        { status: 401, headers }
      );
    }

    const { cep } = await params;

    // Validar CEP
    if (!isValidCEP(cep)) {
      return NextResponse.json(
        {
          success: false,
          message: 'CEP inválido. Deve conter 8 dígitos numéricos.'
        },
        { status: 400, headers }
      );
    }

    const cleanCep = cep.replace(/\D/g, '');

    let geocodeResult: GeocodeResponse;

    try {
      // Tentar primeiro com ViaCEP + Google Maps
      geocodeResult = await geocodeViaViaCEP(cleanCep);
    } catch (error) {
      console.warn('⚠️ ViaCEP falhou, tentando PositionStack:', error);

      try {
        // Fallback para PositionStack
        geocodeResult = await geocodeViaPositionStack(cleanCep);
      } catch (fallbackError) {
        console.error('❌ Ambos os provedores falharam:', fallbackError);

        return NextResponse.json(
          {
            success: false,
            message: 'CEP não encontrado em nenhum provedor de geocoding'
          },
          { status: 404, headers }
        );
      }
    }

    return NextResponse.json(geocodeResult, { status: 200, headers });

  } catch (error) {
    console.error('❌ Erro na API de geocoding:', error);

    return NextResponse.json(
      {
        success: false,
        message: 'Erro interno do servidor'
      },
      {
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        }
      }
    );
  }
}

// Handle preflight OPTIONS request
export async function OPTIONS() {
  return NextResponse.json({}, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}