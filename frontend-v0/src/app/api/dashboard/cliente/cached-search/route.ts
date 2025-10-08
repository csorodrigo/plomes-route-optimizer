import { NextRequest, NextResponse } from "next/server";
import { createClient } from '@supabase/supabase-js';

/**
 * Get customer details using cached/synced data from Supabase
 * This is much faster and more reliable than hitting Ploomes API directly
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

    console.log(`🔍 [CACHED SEARCH] Searching for customer: ${query}`);

    // Initialize Supabase
    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    // Search customers in Supabase (much faster than Ploomes)
    const { data: customersData, error: customerError } = await supabase
      .from('customers')
      .select('id, name, cnpj, cpf, email, phone, tags')
      .or(`name.ilike.%${query}%,cnpj.ilike.%${query}%,cpf.ilike.%${query}%`)
      .limit(10);

    if (customerError) {
      console.error('[CACHED SEARCH] Customer search error:', customerError);
      throw customerError;
    }

    if (!customersData || customersData.length === 0) {
      return NextResponse.json(
        { error: "Cliente não encontrado" },
        { status: 404 }
      );
    }

    // Filter only actual customers (not suppliers)
    const customers = customersData.filter((customer: any) => {
      const tags = customer.tags || [];
      return tags.includes('Cliente') && !tags.includes('Fornecedor');
    });

    if (customers.length === 0) {
      return NextResponse.json(
        { error: "Cliente não encontrado" },
        { status: 404 }
      );
    }

    console.log(`✅ [CACHED SEARCH] Found ${customers.length} matching customers`);

    // Process all customers found
    const customersWithDeals = await Promise.all(customers.map(async (customer: any) => {
      try {
        console.log(`🔍 [CACHED SEARCH] Processing customer: ${customer.name} (ID: ${customer.id})`);

        // Get sales data for this customer
        const { data: sales, error: salesError } = await supabase
          .from('sales')
          .select('*')
          .eq('customer_id', customer.id)
          .order('created_at', { ascending: false });

        if (salesError) {
          console.error('[CACHED SEARCH] Sales error:', salesError);
          // Don't throw, just return empty sales
        }

        // Get customer sales summary data (pre-calculated aggregates)
        const { data: customerSales, error: customerSalesError } = await supabase
          .from('customer_sales')
          .select('*')
          .eq('customer_id', customer.id)
          .single();

        if (customerSalesError) {
          console.log('[CACHED SEARCH] No customer sales summary found');
        }

        let deals: any[] = [];

        // If we have detailed sales records, use them
        if (sales && sales.length > 0) {
          deals = sales.map((sale: any) => ({
            deal_id: sale.deal_id || sale.id.toString(),
            title: sale.deal_title || `Venda #${sale.id}`,
            deal_value: parseFloat(sale.deal_value) || 0,
            created_date: sale.created_at,
            close_date: sale.closed_at,
            stage_name: sale.stage_name || 'Concluído',
            products: sale.products || []
          }));
        }
        // If no detailed sales but we have summary data, create a synthetic deal
        else if (customerSales && customerSales.total_deals > 0) {
          console.log(`[CACHED SEARCH] Using summary data for ${customer.name}: ${customerSales.total_deals} deals, R$ ${customerSales.total_revenue}`);

          deals = [{
            deal_id: `summary_${customer.id}`,
            title: `Histórico de Vendas (${customerSales.total_deals} ${customerSales.total_deals === 1 ? 'pedido' : 'pedidos'})`,
            deal_value: parseFloat(customerSales.total_revenue) || 0,
            created_date: customerSales.last_purchase_date || new Date().toISOString(),
            close_date: customerSales.last_purchase_date || new Date().toISOString(),
            stage_name: 'Concluído',
            products: [] // Will be empty for summary deals
          }];
        }

        console.log(`✅ [CACHED SEARCH] Found ${deals.length} deals for customer ${customer.name}`);

        // Calculate summary for this customer
        const totalValue = deals.reduce((sum, deal) => sum + deal.deal_value, 0);
        const avgDealValue = deals.length > 0 ? totalValue / deals.length : 0;

        return {
          customer: {
            id: customer.id.toString(),
            name: customer.name || 'Sem nome',
            email: customer.email || null,
            phone: customer.phone || null,
            cnpj: customer.cnpj || customer.cpf || null
          },
          deals: deals,
          summary: {
            totalDeals: deals.length,
            totalValue: totalValue,
            avgDealValue: avgDealValue
          }
        };

      } catch (error) {
        console.error(`❌ [CACHED SEARCH] Error processing customer ${customer.name}:`, error);

        // Return customer without deals in case of error
        return {
          customer: {
            id: customer.id.toString(),
            name: customer.name || 'Sem nome',
            email: customer.email || null,
            phone: customer.phone || null,
            cnpj: customer.cnpj || customer.cpf || null
          },
          deals: [],
          summary: {
            totalDeals: 0,
            totalValue: 0,
            avgDealValue: 0
          }
        };
      }
    }));

    // Format response with all customers found
    const response = {
      customers: customersWithDeals,
      query: query,
      total: customersWithDeals.length,
      summary: {
        totalCustomers: customersWithDeals.length,
        totalDeals: customersWithDeals.reduce((sum, c) => sum + c.summary.totalDeals, 0),
        totalValue: customersWithDeals.reduce((sum, c) => sum + c.summary.totalValue, 0),
        avgCustomerValue: customersWithDeals.length > 0 ?
          customersWithDeals.reduce((sum, c) => sum + c.summary.totalValue, 0) / customersWithDeals.length : 0
      }
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('❌ [CACHED SEARCH] Error:', error);

    return NextResponse.json(
      {
        error: 'Erro ao buscar cliente',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
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