import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

/**
 * GET /api/ploomes-cached/customer-sales
 * Calculate customer sales from cached data for testing purposes
 */
export async function GET(request: NextRequest) {
  try {
    console.log('[API] Calculating customer sales from cached data...');

    // Get query parameters for filtering
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const limit = parseInt(searchParams.get('limit') || '50');
    const minRevenue = parseFloat(searchParams.get('minRevenue') || '0');

    // Load cached deals data
    const cachedDealsPath = path.join(process.cwd(), 'ploomes-deals-checkpoint.json');

    if (!fs.existsSync(cachedDealsPath)) {
      throw new Error('Cached deals file not found');
    }

    const cachedData = fs.readFileSync(cachedDealsPath, 'utf8');
    const allDeals = JSON.parse(cachedData);

    // Filter for won deals (StatusId = 2)
    let deals = allDeals.filter((deal: any) => deal.StatusId === 2);

    // Apply date filter if provided
    if (startDate || endDate) {
      deals = deals.filter((deal: any) => {
        const dealDate = new Date(deal.CreatedDate || deal.LastUpdateDate);
        if (startDate && dealDate < new Date(startDate)) return false;
        if (endDate && dealDate > new Date(endDate)) return false;
        return true;
      });
    }

    console.log(`[API] Processing ${deals.length} won deals from cache`);

    // Group deals by customer and calculate metrics
    const customerSalesMap = new Map();

    deals.forEach((deal: any) => {
      const contactId = deal.ContactId;
      if (!contactId) return;

      const customerName = deal.Contact?.Name || `Cliente ${contactId}`;
      const customerDocument = deal.Contact?.Document || '';
      const customerEmail = deal.Contact?.Email || '';
      const customerType = customerDocument.length === 14 ? 'company' : 'person';

      const dealAmount = deal.Amount || 0;
      const dealDate = deal.CreatedDate || deal.LastUpdateDate || '';

      const existing = customerSalesMap.get(contactId);

      if (existing) {
        existing.deals.push({
          id: deal.Id,
          amount: dealAmount,
          createdDate: dealDate
        });
        existing.total_revenue += dealAmount;
        existing.deal_count += 1;
        existing.avg_deal_value = existing.total_revenue / existing.deal_count;

        // Update last deal date if this deal is more recent
        if (dealDate && dealDate > existing.last_deal_date) {
          existing.last_deal_date = dealDate;
        }
      } else {
        customerSalesMap.set(contactId, {
          customer_id: contactId.toString(),
          customer_name: customerName,
          customer_document: customerDocument,
          customer_email: customerEmail,
          customer_type: customerType,
          total_revenue: dealAmount,
          deal_count: 1,
          avg_deal_value: dealAmount,
          last_deal_date: dealDate,
          deals: [{
            id: deal.Id,
            amount: dealAmount,
            createdDate: dealDate
          }],
          ploomes: {
            customerId: contactId,
            dealIds: [deal.Id]
          }
        });
      }
    });

    // Convert to array and filter by minimum revenue
    let customerSales = Array.from(customerSalesMap.values())
      .filter(cs => cs.total_revenue >= minRevenue)
      .sort((a, b) => b.total_revenue - a.total_revenue) // Sort by revenue descending
      .slice(0, limit);

    console.log(`[API] ✅ Calculated sales for ${customerSales.length} customers from cache`);

    // Calculate summary statistics
    const totalRevenue = customerSales.reduce((sum, cs) => sum + cs.total_revenue, 0);
    const totalDeals = customerSales.reduce((sum, cs) => sum + cs.deal_count, 0);
    const avgRevenuePerCustomer = customerSales.length > 0 ? totalRevenue / customerSales.length : 0;

    return NextResponse.json({
      success: true,
      data: {
        customers: customerSales,
        summary: {
          totalCustomers: customerSales.length,
          totalRevenue,
          totalDeals,
          avgRevenuePerCustomer,
          periodDays: 365 // Approximation for cached data
        }
      },
      total: customerSales.length,
      source: 'ploomes_cached',
      filters: {
        startDate,
        endDate,
        minRevenue,
        limit
      },
      timestamp: new Date().toISOString(),
      note: 'This data is from cached files and may not reflect the latest changes in Ploomes'
    });

  } catch (error) {
    console.error('[API] Error calculating customer sales from cache:', error);

    return NextResponse.json({
      success: false,
      error: 'Failed to calculate customer sales from cached data',
      details: error instanceof Error ? error.message : 'Unknown error',
      source: 'ploomes_cached'
    }, { status: 500 });
  }
}