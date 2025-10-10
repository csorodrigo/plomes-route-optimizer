import { NextRequest, NextResponse } from 'next/server';
import { ploomesClient } from '@/lib/ploomes-client';

/**
 * GET /api/ploomes/customer-sales
 * Get customer sales performance directly from Ploomes API
 * Aggregates deals by customer with revenue, deal count, and averages
 */
export async function GET(request: NextRequest) {
  try {
    console.log('[API] Calculating customer sales directly from Ploomes API...');

    // Get query parameters for filtering
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const limit = parseInt(searchParams.get('limit') || '50');
    const minRevenue = parseFloat(searchParams.get('minRevenue') || '0');

    // Build date filter
    let dateFilter = '';
    if (startDate && endDate) {
      dateFilter = `CreatedDate ge ${startDate}T00:00:00Z and CreatedDate le ${endDate}T23:59:59Z`;
    } else {
      // Default to last 12 months
      const endDateCalc = new Date();
      const startDateCalc = new Date();
      startDateCalc.setFullYear(endDateCalc.getFullYear() - 1);

      dateFilter = `CreatedDate ge ${startDateCalc.toISOString()}`;
    }

    console.log('[API] Fetching deals and customers...');

    // Fetch won deals and customers in parallel
    const [wonDeals, customers] = await Promise.all([
      // Get won deals (StatusId = 2) for the period
      ploomesClient.getDeals({
        filter: `StatusId eq 2 and ${dateFilter}`,
        select: ['Id', 'Amount', 'ContactId', 'CreatedDate', 'LastInteractionDate'],
        top: 2000 // Increased to capture more data
      }),

      // Get all active customers for name mapping
      ploomesClient.getContacts({
        filter: 'StatusId eq 1', // Active customers
        select: ['Id', 'Name', 'Document', 'Email', 'TypeId'],
        top: 1000
      })
    ]);

    console.log(`[API] Fetched ${wonDeals.length} won deals and ${customers.length} customers`);

    // Create customer lookup map
    const customerMap = new Map(
      customers.map(customer => [
        customer.Id,
        {
          id: customer.Id,
          name: customer.Name || 'Cliente sem nome',
          document: customer.Document || '',
          email: customer.Email || '',
          type: customer.TypeId === 1 ? 'company' : 'person'
        }
      ])
    );

    // Group deals by customer and calculate metrics
    const customerSalesMap = new Map<number, {
      customer: any;
      deals: any[];
      totalRevenue: number;
      dealCount: number;
      avgDealValue: number;
      lastDealDate: string;
    }>();

    wonDeals.forEach(deal => {
      if (!deal.ContactId) return;

      const customer = customerMap.get(deal.ContactId);
      if (!customer) return; // Skip deals for unknown customers

      const existing = customerSalesMap.get(deal.ContactId);
      const dealAmount = deal.Amount || 0;
      const dealDate = deal.CreatedDate || deal.LastInteractionDate || '';

      if (existing) {
        existing.deals.push(deal);
        existing.totalRevenue += dealAmount;
        existing.dealCount += 1;
        existing.avgDealValue = existing.totalRevenue / existing.dealCount;

        // Update last deal date if this deal is more recent
        if (dealDate && dealDate > existing.lastDealDate) {
          existing.lastDealDate = dealDate;
        }
      } else {
        customerSalesMap.set(deal.ContactId, {
          customer,
          deals: [deal],
          totalRevenue: dealAmount,
          dealCount: 1,
          avgDealValue: dealAmount,
          lastDealDate: dealDate
        });
      }
    });

    // Convert to array and filter by minimum revenue
    let customerSales = Array.from(customerSalesMap.values())
      .filter(cs => cs.totalRevenue >= minRevenue)
      .sort((a, b) => b.totalRevenue - a.totalRevenue) // Sort by revenue descending
      .slice(0, limit);

    console.log(`[API] ✅ Calculated sales for ${customerSales.length} customers`);

    // Transform to expected format
    const transformedCustomerSales = customerSales.map(cs => ({
      customer_id: cs.customer.id.toString(),
      customer_name: cs.customer.name,
      customer_document: cs.customer.document,
      customer_email: cs.customer.email,
      customer_type: cs.customer.type,
      total_revenue: cs.totalRevenue,
      deal_count: cs.dealCount,
      avg_deal_value: cs.avgDealValue,
      last_deal_date: cs.lastDealDate,
      // Additional data for detailed analysis
      deals: cs.deals.map(deal => ({
        id: deal.Id,
        amount: deal.Amount,
        createdDate: deal.CreatedDate
      })),
      // Ploomes-specific data
      ploomes: {
        customerId: cs.customer.id,
        dealIds: cs.deals.map(d => d.Id)
      }
    }));

    // Calculate summary statistics
    const totalRevenue = customerSales.reduce((sum, cs) => sum + cs.totalRevenue, 0);
    const totalDeals = customerSales.reduce((sum, cs) => sum + cs.dealCount, 0);
    const avgRevenuePerCustomer = customerSales.length > 0 ? totalRevenue / customerSales.length : 0;

    return NextResponse.json({
      success: true,
      data: {
        customers: transformedCustomerSales,
        summary: {
          totalCustomers: customerSales.length,
          totalRevenue,
          totalDeals,
          avgRevenuePerCustomer,
          periodDays: Math.ceil((new Date().getTime() - new Date(startDate || new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)).getTime()) / (24 * 60 * 60 * 1000))
        }
      },
      total: transformedCustomerSales.length,
      source: 'ploomes_realtime',
      filters: {
        startDate,
        endDate,
        minRevenue,
        limit
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[API] Error calculating customer sales:', error);

    return NextResponse.json({
      success: false,
      error: 'Failed to calculate customer sales from Ploomes API',
      details: error instanceof Error ? error.message : 'Unknown error',
      source: 'ploomes_realtime'
    }, { status: 500 });
  }
}