import { NextRequest, NextResponse } from "next/server";
import { ploomesClient } from '@/lib/ploomes-client';

interface CustomerSale {
  customer_id: string;
  customer_name: string;
  cnpj: string;
  total_revenue: number;
  deal_count: number;
  avg_deal_value: number;
  last_deal_date: string;
}

/**
 * LIVE CUSTOMERS ENDPOINT - DIRECTLY FROM PLOOMES API
 * NO SUPABASE CACHE - ALWAYS CURRENT DATA
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    console.log('🔥 [LIVE CUSTOMERS] Fetching customers directly from Ploomes API...');

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');

    // Build filter for contacts
    let contactFilter = "StatusId eq 1"; // Active contacts only
    if (search) {
      const searchFilter = `contains(Name,'${search}') or contains(Document,'${search}')`;
      contactFilter = `(${contactFilter}) and (${searchFilter})`;
    }

    console.log(`🔥 [LIVE CUSTOMERS] Fetching contacts with filter: ${contactFilter}`);

    // Fetch active contacts from Ploomes
    const contacts = await ploomesClient.getContacts({
      select: ['Id', 'Name', 'Document', 'Email', 'TypeId'],
      filter: contactFilter,
      top: 100 // Limit for performance
    });

    console.log(`🔥 [LIVE CUSTOMERS] Found ${contacts.length} contacts`);

    const customers: CustomerSale[] = [];

    // For each contact, get their deals (process in batches for performance)
    const batchSize = 10;
    for (let i = 0; i < Math.min(contacts.length, 50); i += batchSize) {
      const batch = contacts.slice(i, i + batchSize);

      await Promise.all(batch.map(async (contact) => {
        try {
          console.log(`🔥 [LIVE CUSTOMERS] Getting deals for contact ${contact.Id}: ${contact.Name}`);

          const deals = await ploomesClient.getDealsForContact(contact.Id, 20);

          if (deals.length > 0) {
            const totalRevenue = deals.reduce((sum, deal) => sum + (deal.Amount || 0), 0);
            const avgDealValue = totalRevenue / deals.length;
            const lastDeal = deals.sort((a, b) =>
              new Date(b.CreatedDate || 0).getTime() - new Date(a.CreatedDate || 0).getTime()
            )[0];

            customers.push({
              customer_id: contact.Id.toString(),
              customer_name: contact.Name || 'Unknown',
              cnpj: contact.Document || '',
              total_revenue: totalRevenue,
              deal_count: deals.length,
              avg_deal_value: avgDealValue,
              last_deal_date: lastDeal?.CreatedDate || new Date().toISOString(),
            });

            console.log(`🔥 [LIVE CUSTOMERS] ${contact.Name}: ${deals.length} deals, R$ ${totalRevenue.toLocaleString('pt-BR')}`);
          } else {
            // Include customers without deals for completeness
            customers.push({
              customer_id: contact.Id.toString(),
              customer_name: contact.Name || 'Unknown',
              cnpj: contact.Document || '',
              total_revenue: 0,
              deal_count: 0,
              avg_deal_value: 0,
              last_deal_date: '',
            });
          }
        } catch (error) {
          console.error(`❌ Error fetching deals for contact ${contact.Id}:`, error);

          // Include customer even if deals fetch failed
          customers.push({
            customer_id: contact.Id.toString(),
            customer_name: contact.Name || 'Unknown',
            cnpj: contact.Document || '',
            total_revenue: 0,
            deal_count: 0,
            avg_deal_value: 0,
            last_deal_date: '',
          });
        }
      }));

      console.log(`🔥 [LIVE CUSTOMERS] Processed batch ${i / batchSize + 1}, total customers: ${customers.length}`);
    }

    // Sort customers by total revenue (highest first)
    customers.sort((a, b) => {
      // Customers with purchases first
      if (a.deal_count > 0 && b.deal_count === 0) return -1;
      if (a.deal_count === 0 && b.deal_count > 0) return 1;

      // Sort by revenue
      return b.total_revenue - a.total_revenue;
    });

    const totalTime = Date.now() - startTime;
    const totalRevenue = customers.reduce((sum, c) => sum + c.total_revenue, 0);
    const totalDeals = customers.reduce((sum, c) => sum + c.deal_count, 0);

    console.log(`🔥 [LIVE CUSTOMERS] ✅ SUCCESS: ${customers.length} customers, ${totalDeals} deals, R$ ${totalRevenue.toLocaleString('pt-BR')} (${totalTime}ms)`);

    return NextResponse.json({
      success: true,
      data: customers,
      metadata: {
        source: 'ploomes_live_api',
        responseTime: totalTime,
        timestamp: new Date().toISOString(),
        totalCustomers: customers.length,
        totalDeals: totalDeals,
        totalRevenue: totalRevenue,
        filters: {
          search: search || null,
        },
        note: "🔥 LIVE DATA FROM PLOOMES API - NO CACHE!"
      },
    }, {
      headers: {
        // Cache for 1 minute since it's live data
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
      },
    });

  } catch (error: unknown) {
    const errorTime = Date.now() - startTime;
    console.error(`💥 [LIVE CUSTOMERS] Error after ${errorTime}ms:`, error);

    return NextResponse.json(
      {
        success: false,
        message: 'Server error in live customers dashboard API',
        error: error instanceof Error ? error.message : 'Unknown error',
        responseTime: errorTime,
        source: 'ploomes_live_api_error',
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