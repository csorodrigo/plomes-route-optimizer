import { NextRequest, NextResponse } from "next/server";
import { ploomesClient } from '@/lib/ploomes-client';
import type { PloomesDeal, PloomesProduct } from '@/lib/ploomes-client';

interface ProductPerformanceData {
  productId: string;
  productName: string;
  code: string;
  revenue: number;
  unitsSold: number;
  avgPrice: number;
  dealCount: number;
  deals: Array<{
    dealId: string;
    dealTitle: string;
    quantity: number;
    unitPrice: number;
    total: number;
    date: string;
    customerId?: string;
    customerName?: string;
  }>;
}

/**
 * PRODUCT PERFORMANCE ENDPOINT - REAL DATA FROM PLOOMES API
 * Fetches actual product sales from deals and calculates performance metrics
 * Uses intelligent rate limiting and retry with exponential backoff
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    console.log('🔥 [PRODUCT PERFORMANCE] Fetching real product performance from Ploomes API...');

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const category = searchParams.get('category');

    // Build filters for Ploomes API
    let dealFilters: string[] = ['StatusId eq 2']; // Won deals only

    if (startDate) {
      dealFilters.push(`CreatedDate ge ${startDate}T00:00:00Z`);
    }
    if (endDate) {
      dealFilters.push(`CreatedDate le ${endDate}T23:59:59Z`);
    }

    const filterString = dealFilters.join(' and ');
    console.log(`🔥 [PRODUCT PERFORMANCE] Fetching deals with filter: ${filterString}`);

    // Get won deals from Ploomes API
    let deals: PloomesDeal[] = [];
    try {
      deals = await ploomesClient.getDeals({
        filter: filterString,
        expand: ['DealProducts($expand=Product)', 'Contact'],
        select: ['Id', 'Title', 'Amount', 'CreatedDate', 'ContactId', 'StatusId'],
        orderby: 'CreatedDate desc'
      });
    } catch (error) {
      console.error('💥 [PRODUCT PERFORMANCE] Ploomes API error:', error);
      return NextResponse.json(
        {
          success: false,
          message: 'Error fetching deals from Ploomes API',
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        },
        { status: 500 }
      );
    }

    if (!deals || deals.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        metadata: {
          source: 'ploomes_api_real_data',
          timestamp: new Date().toISOString(),
          message: 'No deals found in the specified period',
          filters: { startDate, endDate, category }
        }
      });
    }

    console.log(`🔥 [PRODUCT PERFORMANCE] Found ${deals.length} deals in Ploomes API`);

    // Process deals to accumulate product performance data
    const productPerformanceMap = new Map<string, ProductPerformanceData>();
    let processedDeals = 0;

    for (const deal of deals) {
      try {
        console.log(`🔍 [PRODUCT PERFORMANCE] Processing deal ${deal.Id}: ${deal.Title} (Amount: R$ ${deal.Amount})`);

        // Get deal products from Ploomes API
        let dealProducts: any[] = [];
        try {
          dealProducts = await ploomesClient.getDealProducts(deal.Id);
        } catch (productError) {
          console.warn(`⚠️ [PRODUCT PERFORMANCE] Error fetching products for deal ${deal.Id}:`, productError);
        }

        // If no products found but deal has amount, create a generic service item
        if (dealProducts.length === 0 && deal.Amount > 0) {
          console.log(`🔧 [GENERIC SERVICE] No products found, creating generic service for deal ${deal.Id}`);
          dealProducts = [{
            Product: {
              Id: `service_${deal.Id}`,
              Name: 'Serviço/Produto (Deal)',
              Code: 'SVC'
            },
            Quantity: 1,
            UnitPrice: deal.Amount,
            Total: deal.Amount
          }];
        }

        // Process each product in the deal
        for (const dealProduct of dealProducts) {
          const product = dealProduct.Product || dealProduct;

          if (!product.Id && !product.Name) continue;

          const productId = product.Id?.toString() || `unknown_${Date.now()}`;
          const productName = product.Name || 'Unknown Product';
          const productCode = product.Code || '';

          // Apply category filter if specified
          if (category && !productName.toLowerCase().includes(category.toLowerCase())) {
            continue;
          }

          const quantity = dealProduct.Quantity || dealProduct.quantity || 1;
          const unitPrice = dealProduct.UnitPrice || dealProduct.unitPrice || product.Price || 0;
          const total = dealProduct.Total || dealProduct.total || (quantity * unitPrice);

          // Skip if no meaningful data
          if (quantity === 0 && unitPrice === 0 && total === 0) continue;

          // Get or create product performance entry
          let productPerf = productPerformanceMap.get(productId);
          if (!productPerf) {
            productPerf = {
              productId,
              productName,
              code: productCode,
              revenue: 0,
              unitsSold: 0,
              avgPrice: 0,
              dealCount: 0,
              deals: []
            };
            productPerformanceMap.set(productId, productPerf);
          }

          // Update performance metrics
          productPerf.revenue += total;
          productPerf.unitsSold += quantity;
          productPerf.dealCount += 1;
          productPerf.avgPrice = productPerf.revenue / productPerf.unitsSold;

          // Add deal details
          productPerf.deals.push({
            dealId: deal.Id.toString(),
            dealTitle: deal.Title || 'Unknown Deal',
            quantity,
            unitPrice,
            total,
            date: deal.CreatedDate || new Date().toISOString(),
            customerId: deal.ContactId?.toString(),
            customerName: '' // Will be populated if needed
          });

          console.log(`📦 [PRODUCT PERFORMANCE] ${productName}: +${quantity} units, +R$ ${total.toFixed(2)}`);
        }

        processedDeals++;
      } catch (dealError) {
        console.warn(`⚠️ [PRODUCT PERFORMANCE] Error processing deal ${deal.Id}:`, dealError);
        continue;
      }
    }

    console.log(`🔥 [PRODUCT PERFORMANCE] Processed ${processedDeals} sales with ${productPerformanceMap.size} unique products`);

    // Convert map to array and sort by revenue
    const productPerformance = Array.from(productPerformanceMap.values())
      .map(product => ({
        ...product,
        // Ensure no NaN values
        revenue: isNaN(product.revenue) ? 0 : product.revenue,
        unitsSold: isNaN(product.unitsSold) ? 0 : product.unitsSold,
        avgPrice: isNaN(product.avgPrice) ? 0 : product.avgPrice,
        dealCount: isNaN(product.dealCount) ? 0 : product.dealCount,
        deals: product.deals.map(deal => ({
          ...deal,
          quantity: isNaN(deal.quantity) ? 0 : deal.quantity,
          unitPrice: isNaN(deal.unitPrice) ? 0 : deal.unitPrice,
          total: isNaN(deal.total) ? 0 : deal.total
        }))
      }))
      .filter(product => product.revenue > 0) // Only include products with actual revenue
      .sort((a, b) => b.revenue - a.revenue);

    const responseTime = Date.now() - startTime;

    console.log(`🔥 [PRODUCT PERFORMANCE] ✅ SUCCESS: Found ${productPerformance.length} products from ${processedDeals} deals (${responseTime}ms)`);

    // Log top 5 products for debugging
    const top5 = productPerformance.slice(0, 5);
    console.log('🏆 [TOP PRODUCTS]:');
    top5.forEach((p, i) => {
      console.log(`  ${i + 1}. ${p.productName}: R$ ${p.revenue.toFixed(2)} (${p.unitsSold} units, ${p.dealCount} deals)`);
    });

    return NextResponse.json({
      success: true,
      data: productPerformance,
      metadata: {
        source: 'ploomes_api_real_data',
        timestamp: new Date().toISOString(),
        responseTime,
        filters: {
          startDate: startDate || null,
          endDate: endDate || null,
          category: category || null
        },
        summary: {
          totalProducts: productPerformance.length,
          totalDealsProcessed: processedDeals,
          totalRevenue: productPerformance.reduce((sum, p) => sum + p.revenue, 0),
          totalUnits: productPerformance.reduce((sum, p) => sum + p.unitsSold, 0),
          totalSalesAnalyzed: deals.length
        },
        note: "🔥 REAL PRODUCT PERFORMANCE DATA FROM PLOOMES API!"
      }
    });

  } catch (error: unknown) {
    const responseTime = Date.now() - startTime;
    console.error('💥 [PRODUCT PERFORMANCE] Error:', error);

    return NextResponse.json(
      {
        success: false,
        message: 'Server error in product performance API',
        error: error instanceof Error ? error.message : 'Unknown error',
        responseTime,
        source: 'ploomes_api_error',
        timestamp: new Date().toISOString()
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