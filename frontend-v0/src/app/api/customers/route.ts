import { NextRequest, NextResponse } from 'next/server';

// Mock data para customers
const MOCK_CUSTOMERS = [
  {
    id: "1",
    name: "Cliente Exemplo 1",
    email: "cliente1@exemplo.com",
    phone: "(11) 99999-9999",
    address: "Rua Exemplo, 123",
    cep: "01234-567",
    city: "São Paulo",
    state: "SP",
    latitude: -23.5505,
    longitude: -46.6333,
    lat: -23.5505,
    lng: -46.6333,
    ploome_person_id: "123456"
  },
  {
    id: "2",
    name: "Cliente Exemplo 2",
    email: "cliente2@exemplo.com",
    phone: "(11) 88888-8888",
    address: "Av Exemplo, 456",
    cep: "01234-890",
    city: "São Paulo",
    state: "SP",
    latitude: -23.5515,
    longitude: -46.6343,
    lat: -23.5515,
    lng: -46.6343,
    ploome_person_id: "123457"
  }
];

export async function GET(request: NextRequest) {
  try {
    // Simular delay para parecer real
    await new Promise(resolve => setTimeout(resolve, 500));

    const url = new URL(request.url);
    const limit = url.searchParams.get('limit');
    const offset = url.searchParams.get('offset');

    let customers = [...MOCK_CUSTOMERS];

    // Aplicar paginação se especificada
    if (offset) {
      const offsetNum = parseInt(offset, 10);
      customers = customers.slice(offsetNum);
    }

    if (limit) {
      const limitNum = parseInt(limit, 10);
      customers = customers.slice(0, limitNum);
    }

    console.log(`📦 Returning ${customers.length} customers`);

    return NextResponse.json({
      success: true,
      count: customers.length,
      customers
    });

  } catch (error) {
    console.error('Customers API error:', error);
    return NextResponse.json(
      { success: false, error: 'Erro ao buscar clientes' },
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