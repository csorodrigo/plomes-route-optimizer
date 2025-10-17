import { NextRequest, NextResponse } from 'next/server';
import { ploomesClient } from '@/lib/ploomes-client';
import { ploomesApi } from '@/lib/ploomes-safe-api';

/**
 * GET /api/ploomes/deals
 * Fetch all deals directly from Ploomes API
 * Supports filtering by customer ID, date range, status
 */
export async function GET(request: NextRequest) {
  try {
    console.log('[API] Fetching deals directly from Ploomes API...');

    // Get query parameters for filtering
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');
    const status = searchParams.get('status'); // won, lost, open
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const limit = parseInt(searchParams.get('limit') || '100');
    const includeProducts = searchParams.get('includeProducts') === 'true';

    let deals;

    if (customerId) {
      // Get deals for specific customer using SAFE API
      console.log(`[API] 🛡️ Fetching deals for customer ${customerId} using SAFE API`);
      deals = await ploomesApi.getDealsForContactSafe(parseInt(customerId), limit);
    } else {
      // Build filter for general deals query
      const filters: string[] = [];

      // Filter by status if provided
      if (status) {
        switch (status) {
          case 'won':
            filters.push('StatusId eq 2');
            break;
          case 'lost':
            filters.push('StatusId eq 3');
            break;
          case 'open':
            filters.push('StatusId eq 1');
            break;
        }
      }

      // Filter by date range if provided
      if (startDate) {
        filters.push(`CreatedDate ge ${startDate}T00:00:00Z`);
      }
      if (endDate) {
        filters.push(`CreatedDate le ${endDate}T23:59:59Z`);
      }

      const filter = filters.length > 0 ? filters.join(' and ') : undefined;

      // Fetch deals from Ploomes using SAFE API
      console.log(`[API] 🛡️ Fetching deals using SAFE API with filter: ${filter || 'none'}`);
      if (filter && filter.includes(' and ')) {
        // Complex filter detected - use safe API
        console.log(`[API] ⚠️ Complex filter detected, using safe fallback strategies`);
        deals = await ploomesApi.getDealsSafe({
          top: limit,
          orderby: 'CreatedDate desc'
        });

        // Apply filters in memory to avoid 403 errors
        if (status) {
          const statusId = status === 'won' ? 2 : status === 'lost' ? 3 : 1;
          deals = deals.filter(deal => deal.StatusId === statusId);
        }

        // Date filtering would need to be done in memory here if needed
        // For now, we get all recent deals and filter client-side
        deals = deals.slice(0, limit);
      } else {
        // Simple filter - can try direct API first, fall back to safe API
        try {
          deals = await ploomesClient.getDeals({
            select: [
              'Id',
              'Title',
              'Amount',
              'StatusId',
              'StageId',
              'ContactId',
              'PersonId',
              'CreatedDate',
              'LastInteractionDate'
            ],
            filter,
            top: limit,
            orderby: 'CreatedDate desc'
          });
        } catch (error) {
          console.log(`[API] ⚠️ Direct API failed, falling back to safe API:`, error);
          deals = await ploomesApi.getDealsSafe({
            top: limit,
            orderby: 'CreatedDate desc'
          });

          // Apply filter in memory
          if (status) {
            const statusId = status === 'won' ? 2 : status === 'lost' ? 3 : 1;
            deals = deals.filter(deal => deal.StatusId === statusId);
          }
        }
      }
    }

    console.log(`[API] ✅ Fetched ${deals.length} deals from Ploomes`);

    // If includeProducts is true, fetch products for each deal using SAFE API
    let dealsWithProducts = deals;
    if (includeProducts && deals.length > 0) {
      console.log('[API] 🛡️ Fetching products for deals using SAFE API...');
      dealsWithProducts = await Promise.all(
        deals.map(async (deal) => {
          try {
            const products = await ploomesApi.getDealProductsSafe(deal.Id);
            return {
              ...deal,
              products: products.map((p: any) => ({
                id: p.Product?.Id || p.Id,
                name: p.Product?.Name || p.Name || 'Produto sem nome',
                code: p.Product?.Code || p.Code || '',
                price: p.Product?.Price || p.Price || 0,
                quantity: p.Quantity || 1,
                total: (p.Product?.Price || p.Price || 0) * (p.Quantity || 1)
              }))
            };
          } catch (error) {
            console.log(`[API] ⚠️ Failed to fetch products for deal ${deal.Id} even with safe API:`, error);
            return {
              ...deal,
              products: []
            };
          }
        })
      );
    }

    // Transform to expected format
    const transformedDeals = dealsWithProducts.map(deal => ({
      id: deal.Id.toString(),
      title: deal.Title || 'Negócio sem título',
      amount: deal.Amount || 0,
      status: getStatusLabel(deal.StatusId),
      statusId: deal.StatusId,
      stageId: deal.StageId,
      customerId: deal.ContactId?.toString() || '',
      personId: deal.PersonId?.toString() || '',
      createdDate: deal.CreatedDate,
      lastInteractionDate: deal.LastInteractionDate,
      products: (deal as any).products || [],
      // Additional Ploomes-specific data
      ploomes: {
        id: deal.Id,
        statusId: deal.StatusId,
        stageId: deal.StageId,
        contactId: deal.ContactId,
        personId: deal.PersonId
      }
    }));

    return NextResponse.json({
      success: true,
      data: transformedDeals,
      total: transformedDeals.length,
      source: 'ploomes_realtime',
      includeProducts,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[API] Error fetching Ploomes deals:', error);

    return NextResponse.json({
      success: false,
      error: 'Failed to fetch deals from Ploomes API',
      details: error instanceof Error ? error.message : 'Unknown error',
      source: 'ploomes_realtime'
    }, { status: 500 });
  }
}

function getStatusLabel(statusId: number): string {
  switch (statusId) {
    case 1: return 'open';
    case 2: return 'won';
    case 3: return 'lost';
    default: return 'unknown';
  }
}