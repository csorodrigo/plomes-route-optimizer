import { NextRequest, NextResponse } from 'next/server';
import { ploomesClient } from '@/lib/ploomes-client';

/**
 * GET /api/ploomes/metrics
 * Calculate dashboard metrics directly from Ploomes API
 * Real-time calculations without Supabase caching
 */
export async function GET(request: NextRequest) {
  try {
    console.log('[API] Calculating metrics directly from Ploomes API...');

    // Get query parameters for date filtering
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const period = searchParams.get('period') || '30'; // days

    // Calculate date range if not provided
    let dateFilter = '';
    if (startDate && endDate) {
      dateFilter = `CreatedDate ge ${startDate}T00:00:00Z and CreatedDate le ${endDate}T23:59:59Z`;
    } else if (period) {
      const days = parseInt(period);
      const endDateCalc = new Date();
      const startDateCalc = new Date();
      startDateCalc.setDate(endDateCalc.getDate() - days);

      dateFilter = `CreatedDate ge ${startDateCalc.toISOString()} and CreatedDate le ${endDateCalc.toISOString()}`;
    }

    console.log('[API] Fetching data for metrics calculation...');

    // Fetch data in parallel for better performance
    const [wonDeals, allDeals, activeCustomers, activeProducts] = await Promise.all([
      // Won deals for revenue calculation
      ploomesClient.getDeals({
        filter: dateFilter ? `StatusId eq 2 and ${dateFilter}` : 'StatusId eq 2',
        select: ['Id', 'Amount', 'CreatedDate', 'ContactId'],
        top: 1000
      }),

      // All deals in period for deal count
      ploomesClient.getDeals({
        filter: dateFilter || undefined,
        select: ['Id', 'Amount', 'CreatedDate', 'ContactId', 'StatusId'],
        top: 1000
      }),

      // Active customers
      ploomesClient.getContacts({
        filter: 'StatusId eq 1', // Active only
        select: ['Id'],
        top: 500
      }),

      // Active products
      ploomesClient.getProducts({
        filter: 'Active eq true',
        select: ['Id'],
        top: 500
      })
    ]);

    console.log(`[API] Data fetched: ${wonDeals.length} won deals, ${allDeals.length} total deals, ${activeCustomers.length} customers, ${activeProducts.length} products`);

    // Calculate metrics
    const totalRevenue = wonDeals.reduce((sum, deal) => sum + (deal.Amount || 0), 0);
    const dealCount = wonDeals.length;
    const avgDeal = dealCount > 0 ? totalRevenue / dealCount : 0;
    const totalCustomers = activeCustomers.length;
    const activeProductsCount = activeProducts.length;

    // Calculate revenue per customer (if has deals)
    const customersWithDeals = new Set(wonDeals.map(deal => deal.ContactId).filter(Boolean));
    const revenuePerCustomer = customersWithDeals.size > 0 ? totalRevenue / customersWithDeals.size : 0;

    // Calculate period-over-period growth (if possible)
    let revenueChange = 0;
    let dealChange = 0;

    // For growth calculation, fetch previous period data
    if (period) {
      try {
        const days = parseInt(period);
        const prevEndDate = new Date();
        prevEndDate.setDate(prevEndDate.getDate() - days);
        const prevStartDate = new Date();
        prevStartDate.setDate(prevEndDate.getDate() - days);

        const prevDateFilter = `CreatedDate ge ${prevStartDate.toISOString()} and CreatedDate le ${prevEndDate.toISOString()}`;

        const prevWonDeals = await ploomesClient.getDeals({
          filter: `StatusId eq 2 and ${prevDateFilter}`,
          select: ['Id', 'Amount'],
          top: 1000
        });

        const prevRevenue = prevWonDeals.reduce((sum, deal) => sum + (deal.Amount || 0), 0);
        const prevDealCount = prevWonDeals.length;

        if (prevRevenue > 0) {
          revenueChange = ((totalRevenue - prevRevenue) / prevRevenue) * 100;
        }
        if (prevDealCount > 0) {
          dealChange = ((dealCount - prevDealCount) / prevDealCount) * 100;
        }

        console.log(`[API] Growth calculation: Current revenue ${totalRevenue}, Previous ${prevRevenue}, Change ${revenueChange.toFixed(1)}%`);
      } catch (error) {
        console.log('[API] Could not calculate growth metrics:', error);
      }
    }

    const metrics = {
      totalRevenue,
      revenueChange,
      avgDeal,
      avgDealChange: dealChange, // Using deal count change as proxy
      activeProducts: activeProductsCount,
      productsChange: 0, // Would need historical data
      totalCustomers,
      customersChange: 0, // Would need historical data
      // Additional metrics
      dealCount,
      customersWithDeals: customersWithDeals.size,
      revenuePerCustomer,
      period: period ? `${period} days` : 'custom range',
      dateRange: {
        start: startDate || 'auto',
        end: endDate || 'auto'
      }
    };

    console.log('[API] ✅ Metrics calculated:', {
      totalRevenue: metrics.totalRevenue,
      avgDeal: metrics.avgDeal,
      dealCount: metrics.dealCount,
      customers: metrics.totalCustomers,
      products: metrics.activeProducts
    });

    return NextResponse.json({
      success: true,
      data: metrics,
      source: 'ploomes_realtime',
      timestamp: new Date().toISOString(),
      calculatedFrom: {
        wonDeals: wonDeals.length,
        totalDeals: allDeals.length,
        customers: activeCustomers.length,
        products: activeProducts.length
      }
    });

  } catch (error) {
    console.error('[API] Error calculating Ploomes metrics:', error);

    return NextResponse.json({
      success: false,
      error: 'Failed to calculate metrics from Ploomes API',
      details: error instanceof Error ? error.message : 'Unknown error',
      source: 'ploomes_realtime'
    }, { status: 500 });
  }
}