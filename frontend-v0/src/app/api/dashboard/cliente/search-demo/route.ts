import { NextRequest, NextResponse } from "next/server";

// Demo data for CIARA customer with products and price history
const DEMO_DATA = {
  "CIARA": {
    customer: {
      id: "403145067",
      name: "CIA MAQUINAS E EQUIPAMENTOS COMERCIO",
      email: "contato@ciaramaquinas.com.br",
      phone: "(11) 3456-7890",
      cnpj: "12.345.678/0001-90"
    },
    deals: [
      {
        deal_id: "501",
        title: "Compressor Atlas Copco GA37+ - Venda Direta",
        deal_value: 125000,
        created_date: "2024-10-05T10:00:00Z",
        close_date: "2024-10-08T15:00:00Z",
        stage_name: "Ganho",
        products: [
          {
            product_id: "P001",
            product_name: "Compressor Atlas Copco GA37+ 50HP",
            quantity: 1,
            unit_price: 95000,
            total: 95000
          },
          {
            product_id: "P002",
            product_name: "Secador de Ar Atlas Copco FD380",
            quantity: 1,
            unit_price: 18000,
            total: 18000
          },
          {
            product_id: "S001",
            product_name: "Serviço de Instalação e Comissionamento",
            quantity: 1,
            unit_price: 12000,
            total: 12000
          }
        ]
      },
      {
        deal_id: "502",
        title: "Sistema de Ar Comprimido Ingersoll Rand",
        deal_value: 89500,
        created_date: "2024-09-20T14:30:00Z",
        close_date: "2024-09-25T16:00:00Z",
        stage_name: "Ganho",
        products: [
          {
            product_id: "P003",
            product_name: "Compressor Ingersoll Rand R37n",
            quantity: 1,
            unit_price: 72000,
            total: 72000
          },
          {
            product_id: "P004",
            product_name: "Filtro Coalescente IR FA600IG",
            quantity: 2,
            unit_price: 3500,
            total: 7000
          },
          {
            product_id: "P002",
            product_name: "Secador de Ar Atlas Copco FD380",
            quantity: 1,
            unit_price: 17500,
            total: 17500
          }
        ]
      },
      {
        deal_id: "503",
        title: "Manutenção Preventiva Anual - Atlas Copco",
        deal_value: 35000,
        created_date: "2024-09-10T09:00:00Z",
        close_date: "2024-09-12T17:00:00Z",
        stage_name: "Ganho",
        products: [
          {
            product_id: "S002",
            product_name: "Serviço de Manutenção Preventiva Completa",
            quantity: 1,
            unit_price: 15000,
            total: 15000
          },
          {
            product_id: "P005",
            product_name: "Kit de Filtros Atlas Copco Original",
            quantity: 4,
            unit_price: 2500,
            total: 10000
          },
          {
            product_id: "P006",
            product_name: "Óleo Roto-Inject Atlas Copco (20L)",
            quantity: 4,
            unit_price: 2500,
            total: 10000
          }
        ]
      },
      {
        deal_id: "504",
        title: "Compressor Portátil Atlas Copco XAS188",
        deal_value: 145000,
        created_date: "2024-08-15T11:00:00Z",
        close_date: "2024-08-20T14:00:00Z",
        stage_name: "Ganho",
        products: [
          {
            product_id: "P007",
            product_name: "Compressor Portátil Atlas Copco XAS188 Diesel",
            quantity: 1,
            unit_price: 135000,
            total: 135000
          },
          {
            product_id: "S001",
            product_name: "Serviço de Instalação e Comissionamento",
            quantity: 1,
            unit_price: 10000,
            total: 10000
          }
        ]
      },
      {
        deal_id: "505",
        title: "Peças de Reposição Ingersoll Rand",
        deal_value: 28500,
        created_date: "2024-08-01T13:00:00Z",
        close_date: "2024-08-05T15:00:00Z",
        stage_name: "Ganho",
        products: [
          {
            product_id: "P008",
            product_name: "Válvula de Admissão Ingersoll Rand",
            quantity: 2,
            unit_price: 8500,
            total: 17000
          },
          {
            product_id: "P009",
            product_name: "Elemento Separador IR 54749247",
            quantity: 1,
            unit_price: 6500,
            total: 6500
          },
          {
            product_id: "P005",
            product_name: "Kit de Filtros Atlas Copco Original",
            quantity: 2,
            unit_price: 2500,
            total: 5000
          }
        ]
      },
      {
        deal_id: "506",
        title: "Sistema Completo de Ar Comprimido",
        deal_value: 210000,
        created_date: "2024-07-20T10:00:00Z",
        close_date: "2024-07-28T16:00:00Z",
        stage_name: "Ganho",
        products: [
          {
            product_id: "P001",
            product_name: "Compressor Atlas Copco GA37+ 50HP",
            quantity: 2,
            unit_price: 93000,
            total: 186000
          },
          {
            product_id: "P002",
            product_name: "Secador de Ar Atlas Copco FD380",
            quantity: 1,
            unit_price: 16000,
            total: 16000
          },
          {
            product_id: "S003",
            product_name: "Projeto e Dimensionamento de Rede",
            quantity: 1,
            unit_price: 8000,
            total: 8000
          }
        ]
      },
      {
        deal_id: "507",
        title: "Retrofit de Sistema de Controle",
        deal_value: 42000,
        created_date: "2024-07-01T14:00:00Z",
        close_date: "2024-07-10T17:00:00Z",
        stage_name: "Ganho",
        products: [
          {
            product_id: "P010",
            product_name: "Controlador Elektronikon MkV Atlas Copco",
            quantity: 1,
            unit_price: 25000,
            total: 25000
          },
          {
            product_id: "S004",
            product_name: "Serviço de Retrofit e Programação",
            quantity: 1,
            unit_price: 17000,
            total: 17000
          }
        ]
      },
      {
        deal_id: "508",
        title: "Locação de Compressor Emergencial",
        deal_value: 15000,
        created_date: "2024-06-15T08:00:00Z",
        close_date: "2024-06-15T18:00:00Z",
        stage_name: "Ganho",
        products: [
          {
            product_id: "S005",
            product_name: "Locação Compressor 250PCM - 30 dias",
            quantity: 1,
            unit_price: 15000,
            total: 15000
          }
        ]
      },
      {
        deal_id: "509",
        title: "Compressor Ingersoll Rand UP6-10",
        deal_value: 68000,
        created_date: "2024-06-01T11:00:00Z",
        close_date: "2024-06-08T15:00:00Z",
        stage_name: "Ganho",
        products: [
          {
            product_id: "P011",
            product_name: "Compressor Ingersoll Rand UP6-10 10HP",
            quantity: 1,
            unit_price: 58000,
            total: 58000
          },
          {
            product_id: "P002",
            product_name: "Secador de Ar Atlas Copco FD380",
            quantity: 1,
            unit_price: 15500,
            total: 15500
          }
        ]
      },
      {
        deal_id: "510",
        title: "Manutenção Corretiva Emergencial",
        deal_value: 22000,
        created_date: "2024-05-20T07:00:00Z",
        close_date: "2024-05-21T19:00:00Z",
        stage_name: "Ganho",
        products: [
          {
            product_id: "S006",
            product_name: "Serviço de Manutenção Corretiva Emergencial",
            quantity: 1,
            unit_price: 12000,
            total: 12000
          },
          {
            product_id: "P008",
            product_name: "Válvula de Admissão Ingersoll Rand",
            quantity: 1,
            unit_price: 8000,
            total: 8000
          },
          {
            product_id: "P006",
            product_name: "Óleo Roto-Inject Atlas Copco (20L)",
            quantity: 1,
            unit_price: 2000,
            total: 2000
          }
        ]
      }
    ]
  }
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query');

    if (!query) {
      return NextResponse.json(
        { error: "Query parameter is required" },
        { status: 400 }
      );
    }

    console.log(`🔍 [DEMO MODE] Searching for customer: ${query}`);

    // Check if query matches any demo customer
    const matchingKey = Object.keys(DEMO_DATA).find(key =>
      query.toUpperCase().includes(key) ||
      key.includes(query.toUpperCase())
    );

    if (!matchingKey) {
      return NextResponse.json(
        { error: "Cliente não encontrado (Demo Mode)" },
        { status: 404 }
      );
    }

    const data = DEMO_DATA[matchingKey];

    console.log(`✅ [DEMO MODE] Found customer: ${data.customer.name}`);
    console.log(`📦 [DEMO MODE] Returning ${data.deals.length} deals with products`);

    return NextResponse.json(data);

  } catch (error) {
    console.error('❌ [DEMO MODE] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to search customer (Demo Mode)',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}