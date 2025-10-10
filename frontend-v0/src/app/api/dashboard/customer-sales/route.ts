import { NextRequest, NextResponse } from "next/server";
import { ploomesClient } from '@/lib/ploomes-client';

/**
 * Get sales history for a specific customer - LIVE PLOOMES DATA
 * Fetches deals and contact information directly from Ploomes API
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    console.log('💰 [CUSTOMER SALES API] Fetching customer sales from Ploomes...');

    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!customerId) {
      return NextResponse.json(
        { success: false, message: 'Customer ID is required' },
        { status: 400 }
      );
    }

    const customerIdNum = parseInt(customerId);
    if (isNaN(customerIdNum)) {
      return NextResponse.json(
        { success: false, message: 'Invalid customer ID format' },
        { status: 400 }
      );
    }

    // Get customer info from Ploomes
    console.log(`💰 [CUSTOMER SALES] Fetching customer ${customerIdNum} from Ploomes...`);
    const customer = await ploomesClient.getContactById(customerIdNum);

    if (!customer) {
      return NextResponse.json(
        {
          success: false,
          message: `Customer with ID ${customerId} not found in Ploomes`,
          timestamp: new Date().toISOString()
        },
        { status: 404 }
      );
    }

    console.log(`💰 [CUSTOMER SALES] Found customer: ${customer.Name}`);

    // Get deals for this customer from Ploomes
    console.log(`💰 [CUSTOMER SALES] Fetching deals for customer ${customerIdNum}...`);
    const customerDeals = await ploomesClient.getDealsForContact(customerIdNum, 50);

    if (!customerDeals || customerDeals.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          customer: {
            id: customer.Id,
            name: customer.Name,
            document: customer.Document || '',
            email: customer.Email || '',
          },
          sales: [],
          summary: {
            totalSales: 0,
            totalRevenue: 0,
            averageDeal: 0,
            lastSaleDate: null
          }
        },
        metadata: {
          source: 'ploomes_api_live',
          timestamp: new Date().toISOString(),
          responseTime: Date.now() - startTime,
          customerId: customerIdNum,
          message: 'Customer found but no sales history'
        }
      });
    }

    console.log(`💰 [CUSTOMER SALES] Found ${customerDeals.length} deals for customer`);

    // Filter deals by date if provided
    let filteredDeals = customerDeals;
    if (startDate || endDate) {
      filteredDeals = customerDeals.filter(deal => {
        const dealDate = new Date(deal.CreatedDate || deal.FinishDate || Date.now());

        if (startDate && dealDate < new Date(startDate)) return false;
        if (endDate && dealDate > new Date(endDate)) return false;

        return true;
      });

      console.log(`💰 [CUSTOMER SALES] Filtered to ${filteredDeals.length} deals by date range`);
    }

    // Convert deals to sales format
    const sales = filteredDeals.map(deal => ({
      id: deal.Id,
      title: deal.Title || `Deal ${deal.Id}`,
      amount: deal.Amount || 0,
      date: deal.FinishDate || deal.CreatedDate || new Date().toISOString(),
      status: 'won', // These are already won deals
      products: deal.Products || [],
      dealId: deal.Id,
      stageId: deal.StageId
    }));

    // Calculate summary
    const totalRevenue = sales.reduce((sum, sale) => sum + (sale.amount || 0), 0);
    const totalSales = sales.length;
    const averageDeal = totalSales > 0 ? totalRevenue / totalSales : 0;
    const lastSaleDate = sales.length > 0 ?
      sales.map(s => s.date).sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] : null;

    const responseTime = Date.now() - startTime;

    console.log(`✅ [CUSTOMER SALES] Processed ${totalSales} sales for ${customer.Name} in ${responseTime}ms`);
    console.log(`   💰 Total Revenue: R$ ${totalRevenue.toFixed(2)}`);
    console.log(`   📊 Average Deal: R$ ${averageDeal.toFixed(2)}`);
    console.log(`   📅 Last Sale: ${lastSaleDate || 'N/A'}`);

    return NextResponse.json({
      success: true,
      data: {
        customer: {
          id: customer.Id,
          name: customer.Name,
          document: customer.Document || '',
          email: customer.Email || '',
        },
        sales: sales.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
        summary: {
          totalSales,
          totalRevenue,
          averageDeal,
          lastSaleDate
        }
      },
      metadata: {
        source: 'ploomes_api_live',
        timestamp: new Date().toISOString(),
        responseTime,
        customerId: customerIdNum,
        dateFilter: {
          startDate: startDate || null,
          endDate: endDate || null,
          appliedFilter: !!(startDate || endDate)
        },
        note: "💰 CUSTOMER SALES HISTORY (Live Ploomes Data)"
      }
    });

  } catch (error: unknown) {
    const responseTime = Date.now() - startTime;
    console.error('💥 [CUSTOMER SALES API] Error:', error);

    return NextResponse.json(
      {
        success: false,
        message: 'Server error in customer sales API',
        error: error instanceof Error ? error.message : 'Unknown error',
        responseTime,
        source: 'ploomes_api_error',
        timestamp: new Date().toISOString(),
        customerId: searchParams.get('customerId')
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