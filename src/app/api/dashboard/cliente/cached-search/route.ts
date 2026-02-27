import { NextRequest, NextResponse } from "next/server";
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import { env } from "@/lib/env.server";

type JwtPayload = {
  userId: number;
  email: string;
  name?: string;
  role?: string;
  ploomesPersonId?: number | null;
};

function normalizeRole(role: string | null | undefined) {
  if (role === 'user' || role === 'usuario') return 'usuario_padrao';
  return role ?? null;
}

async function getRequesterContext(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice(7);
  const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret-key-for-development-only";

  // Step 1: verify JWT — only this step makes the token "invalid"
  let decoded: JwtPayload;
  try {
    decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    return { invalid: true as const };
  }

  // Step 2: enrich with DB role — failures fall back to JWT claims
  try {
    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || env.SUPABASE_URL;
    const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    let dbUser: any = null;

    const primaryQuery = await supabase
      .from('users')
      .select('role, ploomes_person_id')
      .eq('id', decoded.userId)
      .single();

    if (primaryQuery.error?.code === '42703' || primaryQuery.error?.code === 'PGRST204') {
      const fallbackQuery = await supabase
        .from('users')
        .select('role')
        .eq('id', decoded.userId)
        .single();
      dbUser = fallbackQuery.data ? { ...fallbackQuery.data, ploomes_person_id: null } : null;
    } else {
      dbUser = primaryQuery.data;
    }

    return {
      userId: decoded.userId,
      role: normalizeRole(dbUser?.role ?? decoded.role ?? null),
      ploomesPersonId: dbUser?.ploomes_person_id ?? decoded.ploomesPersonId ?? null,
    };
  } catch {
    // DB unavailable — fall back to claims from the JWT itself
    return {
      userId: decoded.userId,
      role: normalizeRole(decoded.role ?? null),
      ploomesPersonId: decoded.ploomesPersonId ?? null,
    };
  }
}

/**
 * Get customer details using cached/synced data from Supabase
 * This is much faster and more reliable than hitting Ploomes API directly
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query');
    const requester = await getRequesterContext(request);

    if (requester && 'invalid' in requester) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }
    const authUser = requester ?? null;

    if (query === null) {
      return NextResponse.json(
        { error: "Query parameter is required" },
        { status: 400 }
      );
    }

    console.log(`🔍 [CACHED SEARCH] Searching for customer: ${query}`);

    // Initialize Supabase - use server env vars first, fallback to public
    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!;
    const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY!;

    console.log('🔧 [CACHED SEARCH] Using Supabase URL:', SUPABASE_URL ? 'OK' : 'MISSING');
    console.log('🔧 [CACHED SEARCH] Using Supabase Key:', SUPABASE_KEY ? 'OK' : 'MISSING');
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    let sellerCustomerIds: number[] | null = null;
    if (authUser?.role === 'usuario_vendedor') {
      if (!authUser.ploomesPersonId) {
        return NextResponse.json(
          { error: 'Usuário vendedor sem vínculo Ploomes configurado' },
          { status: 403 }
        );
      }

      const { data: sellerSales, error: sellerSalesError } = await supabase
        .from('sales')
        .select('customer_id')
        .eq('owner_id', authUser.ploomesPersonId);

      if (sellerSalesError) {
        if ((sellerSalesError as any).code === '42703' || (sellerSalesError as any).code === 'PGRST204') {
          return NextResponse.json(
            { error: 'Migration pendente: coluna sales.owner_id não existe' },
            { status: 503 }
          );
        }
        console.error('[CACHED SEARCH] Seller sales filter error:', sellerSalesError);
        return NextResponse.json(
          { error: 'Erro ao filtrar clientes do vendedor' },
          { status: 500 }
        );
      }

      sellerCustomerIds = Array.from(
        new Set(
          (sellerSales || [])
            .map((sale: any) => Number(sale.customer_id))
            .filter((id) => Number.isInteger(id))
        )
      );

      // Vendor has no sales yet (backfill pending or no customers assigned)
      if (sellerCustomerIds.length === 0) {
        return NextResponse.json({
          customers: [],
          query,
          total: 0,
          summary: { totalCustomers: 0, totalDeals: 0, totalValue: 0, avgCustomerValue: 0 }
        });
      }
    }

    // Search customers in Supabase (much faster than Ploomes)
    // Empty query = bulk load for route optimizer (up to 5000 customers)
    // Non-empty query = targeted search (limit to 10 results)
    let customerQuery = supabase
      .from('customers')
      .select('id, name, cnpj, cpf, email, phone, tags, address, city, state, latitude, longitude')
      .or(`name.ilike.%${query}%,cnpj.ilike.%${query}%,cpf.ilike.%${query}%`)
      .limit(query.length > 0 ? 10 : 5000);

    if (sellerCustomerIds) {
      customerQuery = customerQuery.in('id', sellerCustomerIds);
    }

    const { data: customersData, error: customerError } = await customerQuery;

    if (customerError) {
      console.error('[CACHED SEARCH] Customer search error:', customerError);
      console.error('[CACHED SEARCH] Error details:', JSON.stringify(customerError, null, 2));

      return NextResponse.json(
        {
          error: 'Erro ao conectar com banco de dados',
          details: customerError.message || 'Database connection failed',
          code: customerError.code || 'DB_ERROR'
        },
        { status: 500 }
      );
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

    // Fast path: bulk load (empty query) — skip sales queries, map only needs basic geo data
    if (query.length === 0) {
      const customersBasic = customers.map((customer: any) => ({
        customer: {
          id: customer.id.toString(),
          name: customer.name || 'Sem nome',
          email: customer.email || null,
          phone: customer.phone || null,
          cnpj: customer.cnpj || customer.cpf || null,
          address: customer.address || null,
          city: customer.city || null,
          state: customer.state || null,
          latitude: customer.latitude ?? null,
          longitude: customer.longitude ?? null,
        },
        deals: [],
        summary: { totalDeals: 0, totalValue: 0, avgDealValue: 0 }
      }));

      return NextResponse.json({
        customers: customersBasic,
        query,
        total: customersBasic.length,
        summary: { totalCustomers: customersBasic.length, totalDeals: 0, totalValue: 0, avgCustomerValue: 0 }
      });
    }

    // Detailed path: targeted search — fetch sales/deals per customer
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
            cnpj: customer.cnpj || customer.cpf || null,
            address: customer.address || null,
            city: customer.city || null,
            state: customer.state || null,
            latitude: customer.latitude ?? null,
            longitude: customer.longitude ?? null,
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
            cnpj: customer.cnpj || customer.cpf || null,
            address: customer.address || null,
            city: customer.city || null,
            state: customer.state || null,
            latitude: customer.latitude ?? null,
            longitude: customer.longitude ?? null,
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
