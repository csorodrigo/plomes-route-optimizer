import { NextRequest, NextResponse } from "next/server";
import { ploomesClient } from '@/lib/ploomes-client';

interface DashboardMetrics {
  totalRevenue: number;
  avgDeal: number;
  activeProducts: number;
  totalCustomers: number;
  dealCount: number;
  customersWithDeals: number;
  revenuePerCustomer: number;
}

/**
 * Dashboard Metrics API - LIVE PLOOMES DATA
 *
 * Fetches current data directly from Ploomes API
 * This provides REAL current data in real-time
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    console.log('📊 [METRICS API] Calculating from live Ploomes API data...');

    // Get all won deals (sales) from Ploomes
    console.log('📊 [METRICS] Fetching won deals from Ploomes...');
    const wonDeals = await ploomesClient.getDeals({
      select: ['Id', 'Title', 'Amount', 'ContactId', 'CreatedDate', 'FinishDate'],
      filter: 'StatusId eq 2', // Won deals only
      top: 2000 // Get recent deals for metrics
    });

    // Get all contacts (customers) from Ploomes
    console.log('📊 [METRICS] Fetching contacts from Ploomes...');
    const allContacts = await ploomesClient.getContacts({
      select: ['Id', 'Name', 'Document', 'TypeId'],
      top: 1000 // Sample for counting
    });

    // Get all products from Ploomes
    console.log('📊 [METRICS] Fetching products from Ploomes...');
    const allProducts = await ploomesClient.getProducts({
      select: ['Id', 'Name', 'Active'],
      filter: 'Active eq true',
      top: 500
    });

    // Calculate metrics from Ploomes data
    const totalDeals = wonDeals?.length || 0;
    const totalRevenue = wonDeals?.reduce((sum, deal) => {
      return sum + (deal.Amount || 0);
    }, 0) || 0;

    // Get unique customers with deals
    const uniqueCustomerIds = new Set(
      wonDeals?.filter(deal => deal.ContactId).map(deal => deal.ContactId)
    );
    const customersWithSales = uniqueCustomerIds.size;

    const avgDeal = totalDeals > 0 ? totalRevenue / totalDeals : 0;
    const totalCustomers = allContacts?.length || customersWithSales;
    const revenuePerCustomer = customersWithSales > 0 ? totalRevenue / customersWithSales : 0;
    const activeProducts = allProducts?.length || 0;

    const metrics: DashboardMetrics = {
      totalRevenue,
      avgDeal,
      activeProducts,
      totalCustomers,
      dealCount: totalDeals,
      customersWithDeals: customersWithSales,
      revenuePerCustomer,
    };

    const totalTime = Date.now() - startTime;
    console.log(`✅ [METRICS API] Calculated metrics in ${totalTime}ms:`);
    console.log(`   💰 Total Revenue: R$ ${totalRevenue.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
    console.log(`   📊 Average Deal: R$ ${avgDeal.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
    console.log(`   👥 Total Customers: ${totalCustomers}`);
    console.log(`   🛒 Customers with Sales: ${customersWithSales}`);
    console.log(`   📦 Active Products: ${activeProducts}`);
    console.log(`   🎯 Total Deals: ${totalDeals}`);

    // Current time as data freshness
    const lastSync = new Date().toISOString();

    return NextResponse.json({
      success: true,
      data: metrics,
      metadata: {
        source: 'ploomes_api_live',
        timestamp: new Date().toISOString(),
        lastSyncAt: lastSync || null,
        responseTime: totalTime,
        dataQuality: {
          customersWithSales,
          totalCustomersInDB: totalCustomers,
          dataFreshness: lastSync ? new Date(lastSync).toISOString() : null,
        },
      },
    }, {
      headers: {
        // Cache for 5 minutes since data is synced every 6 hours
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });

  } catch (error: unknown) {
    const errorTime = Date.now() - startTime;
    console.error(`💥 [ERROR] Metrics API failed after ${errorTime}ms:`, error);

    return NextResponse.json(
      {
        success: false,
        message: 'Server error in dashboard metrics API',
        error: error instanceof Error ? error.message : 'Unknown error',
        responseTime: errorTime,
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