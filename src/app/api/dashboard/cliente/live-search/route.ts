import { NextRequest, NextResponse } from "next/server";
import { ploomesClient } from '@/lib/ploomes-client';

/**
 * LIVE CUSTOMER SEARCH - DIRECTLY FROM PLOOMES API
 * NO SUPABASE CACHE - ALWAYS CURRENT DATA
 */
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

    console.log(`🔥 [LIVE SEARCH] Searching for customer LIVE in Ploomes: ${query}`);

    // Search customers directly in Ploomes API
    // Using simplified approach - get all contacts and filter in memory
    // since complex contains() filters are causing 403 errors

    const customers = await ploomesClient.getContacts({
      select: ['Id', 'Name', 'Document', 'Email', 'Phone'],
      top: 500  // Get more contacts to filter locally
    });

    // Filter locally for search term
    const filteredCustomers = customers.filter(customer => {
      const name = (customer.Name || '').toLowerCase();
      const doc = (customer.Document || '').toLowerCase();
      const searchLower = query.toLowerCase();
      return name.includes(searchLower) || doc.includes(searchLower);
    }).slice(0, 10); // Take top 10 matches

    if (!filteredCustomers || filteredCustomers.length === 0) {
      return NextResponse.json(
        { error: "Cliente não encontrado" },
        { status: 404 }
      );
    }

    const customer = filteredCustomers[0];
    console.log(`🔥 [LIVE SEARCH] Found customer: ${customer.Name} (ID: ${customer.Id})`);

    // Get deals for this customer directly from Ploomes
    console.log(`🔥 [LIVE SEARCH] Fetching deals for customer ${customer.Id}...`);
    const deals = await ploomesClient.getDealsForContact(customer.Id, 10);

    // Transform deals to expected format
    const formattedDeals = await Promise.all(deals.map(async (deal: any) => {
      let products: any[] = [];

      // Try to get products for this deal
      try {
        console.log(`🔥 [LIVE SEARCH] Fetching products for deal ${deal.Id}...`);
        products = await ploomesClient.getDealProducts(deal.Id);
      } catch (error) {
        console.log(`⚠️ [LIVE SEARCH] Could not fetch products for deal ${deal.Id}:`, error);
        products = [];
      }

      return {
        deal_id: deal.Id.toString(),
        title: deal.Title || `Deal #${deal.Id}`,
        deal_value: deal.Amount || 0,
        created_date: deal.CreatedDate || new Date().toISOString(),
        close_date: deal.FinishDate || deal.CreatedDate || new Date().toISOString(),
        stage_name: deal.StatusId === 2 ? 'Ganho' : 'Em Andamento',
        products: products.map((p: any) => ({
          product_id: p.Product?.Id || p.Id,
          product_name: p.Product?.Name || p.Name || 'Produto',
          quantity: p.Quantity || 1,
          unit_price: p.UnitPrice || p.Product?.Price || 0,
          total: (p.UnitPrice || p.Product?.Price || 0) * (p.Quantity || 1)
        }))
      };
    }));

    console.log(`🔥 [LIVE SEARCH] Found ${formattedDeals.length} deals for customer ${customer.Name}`);

    // Format response to match expected structure
    const response = {
      customer: {
        id: customer.Id.toString(),
        name: customer.Name || 'Sem nome',
        email: customer.Email || null,
        phone: customer.Phone || null,
        cnpj: customer.Document || null
      },
      deals: formattedDeals,
      metadata: {
        source: 'ploomes_live_api',
        timestamp: new Date().toISOString(),
        query: query,
        total_deals: formattedDeals.length,
        total_revenue: formattedDeals.reduce((sum, deal) => sum + deal.deal_value, 0)
      }
    };

    console.log(`🔥 [LIVE SEARCH] ✅ SUCCESS - Live data for ${customer.Name}: ${response.metadata.total_deals} deals, R$ ${response.metadata.total_revenue}`);

    return NextResponse.json(response);

  } catch (error) {
    console.error('💥 [LIVE SEARCH] Error:', error);

    return NextResponse.json(
      {
        error: 'Erro ao buscar cliente na API do Ploomes',
        details: error instanceof Error ? error.message : 'Erro desconhecido',
        source: 'ploomes_live_api_error'
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

// Force dynamic rendering for live data
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';