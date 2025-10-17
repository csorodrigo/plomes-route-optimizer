import { NextRequest, NextResponse } from 'next/server';
import { ploomesClient } from '@/lib/ploomes-client';

/**
 * GET /api/ploomes/pricing-history
 * Get pricing history for products directly from Ploomes API
 * Analyzes deal products to show price variations over time
 */
export async function GET(request: NextRequest) {
  try {
    console.log('[API] Calculating pricing history directly from Ploomes API...');

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');
    const customerId = searchParams.get('customerId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const limit = parseInt(searchParams.get('limit') || '100');

    // Build date filter
    let dateFilter = '';
    if (startDate && endDate) {
      dateFilter = `CreatedDate ge ${startDate}T00:00:00Z and CreatedDate le ${endDate}T23:59:59Z`;
    } else {
      // Default to last 6 months
      const endDateCalc = new Date();
      const startDateCalc = new Date();
      startDateCalc.setMonth(endDateCalc.getMonth() - 6);

      dateFilter = `CreatedDate ge ${startDateCalc.toISOString()}`;
    }

    console.log('[API] Fetching deals with products...');

    // Get deals in the time period
    let dealFilter = `StatusId eq 2 and ${dateFilter}`; // Won deals only
    if (customerId) {
      dealFilter += ` and ContactId eq ${customerId}`;
    }

    const deals = await ploomesClient.getDeals({
      filter: dealFilter,
      select: ['Id', 'Title', 'Amount', 'ContactId', 'CreatedDate', 'LastInteractionDate'],
      top: limit,
      orderby: 'CreatedDate desc'
    });

    console.log(`[API] Fetched ${deals.length} deals, now getting products...`);

    // Get products for each deal
    const pricingHistory: any[] = [];
    const productMap = new Map(); // Cache product details

    for (const deal of deals) {
      try {
        const dealProducts = await ploomesClient.getDealProducts(deal.Id);

        for (const dealProduct of dealProducts) {
          const product = dealProduct.Product || dealProduct;
          if (!product || !product.Id) continue;

          // Filter by specific product if requested
          if (productId && product.Id.toString() !== productId) continue;

          // Cache product details
          if (!productMap.has(product.Id)) {
            productMap.set(product.Id, {
              id: product.Id,
              name: product.Name || 'Produto sem nome',
              code: product.Code || ''
            });
          }

          const quantity = dealProduct.Quantity || 1;
          const unitPrice = dealProduct.UnitPrice || product.Price || 0;
          const totalPrice = dealProduct.TotalPrice || (unitPrice * quantity);

          pricingHistory.push({
            product_id: product.Id.toString(),
            product_name: product.Name || 'Produto sem nome',
            product_code: product.Code || '',
            deal_id: deal.Id.toString(),
            deal_title: deal.Title || 'Negócio sem título',
            customer_id: deal.ContactId?.toString() || '',
            date: deal.CreatedDate || deal.LastInteractionDate || new Date().toISOString(),
            unit_price: unitPrice,
            quantity: quantity,
            total_price: totalPrice,
            // Ploomes-specific data
            ploomes: {
              dealId: deal.Id,
              productId: product.Id,
              customerId: deal.ContactId,
              dealProductId: dealProduct.Id
            }
          });
        }
      } catch (error) {
        console.log(`[API] Failed to get products for deal ${deal.Id}:`, error);
        continue;
      }
    }

    console.log(`[API] ✅ Found ${pricingHistory.length} pricing records`);

    // Sort by date descending
    pricingHistory.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Calculate pricing statistics by product
    const productStats = new Map();
    pricingHistory.forEach(record => {
      const productId = record.product_id;
      const existing = productStats.get(productId);

      if (existing) {
        existing.prices.push(record.unit_price);
        existing.totalRevenue += record.total_price;
        existing.totalQuantity += record.quantity;
        existing.dealCount += 1;
        existing.lastSaleDate = record.date > existing.lastSaleDate ? record.date : existing.lastSaleDate;
      } else {
        productStats.set(productId, {
          product_id: productId,
          product_name: record.product_name,
          product_code: record.product_code,
          prices: [record.unit_price],
          totalRevenue: record.total_price,
          totalQuantity: record.quantity,
          dealCount: 1,
          lastSaleDate: record.date
        });
      }
    });

    // Calculate min, max, avg prices for each product
    const productSummary = Array.from(productStats.values()).map(stats => {
      const prices = stats.prices.sort((a, b) => a - b);
      return {
        ...stats,
        min_price: Math.min(...prices),
        max_price: Math.max(...prices),
        avg_price: prices.reduce((sum, price) => sum + price, 0) / prices.length,
        price_variance: Math.max(...prices) - Math.min(...prices),
        avg_deal_value: stats.totalRevenue / stats.dealCount
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        pricing_history: pricingHistory,
        product_summary: productSummary,
        total_records: pricingHistory.length,
        unique_products: productStats.size,
        date_range: {
          start: startDate || 'auto (6 months ago)',
          end: endDate || 'now'
        }
      },
      source: 'ploomes_realtime',
      filters: {
        productId,
        customerId,
        startDate,
        endDate,
        limit
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[API] Error calculating pricing history:', error);

    return NextResponse.json({
      success: false,
      error: 'Failed to calculate pricing history from Ploomes API',
      details: error instanceof Error ? error.message : 'Unknown error',
      source: 'ploomes_realtime'
    }, { status: 500 });
  }
}