import { NextRequest, NextResponse } from 'next/server';

// Mock data para estatísticas
const MOCK_STATISTICS = {
  totalCustomers: 2,
  geocodedCustomers: 2,
  unGeocodedCustomers: 0,
  lastSync: new Date().toISOString()
};

export async function GET(request: NextRequest) {
  try {
    // Simular delay
    await new Promise(resolve => setTimeout(resolve, 300));

    console.log('📊 Statistics requested');

    return NextResponse.json(MOCK_STATISTICS);

  } catch (error) {
    console.error('Statistics API error:', error);
    return NextResponse.json(
      { success: false, error: 'Erro ao buscar estatísticas' },
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