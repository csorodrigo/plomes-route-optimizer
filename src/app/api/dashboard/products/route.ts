import { NextRequest, NextResponse } from "next/server";
import { ploomesClient } from '@/lib/ploomes-client';
import type { PloomesDeal, PloomesProduct } from '@/lib/ploomes-client';

interface ProductData {
  id: string;
  name: string;
  code: string;
  category: string;
  price: number;
  revenue: number;
  unitsSold: number;
  dealCount: number;
  lastSaleDate: string;
}

/**
 * PRODUCTS ENDPOINT - REAL DATA FROM PLOOMES API
 * Fetches products with aggregated sales data DIRECTLY from Ploomes
 * Uses intelligent rate limiting and retry with exponential backoff
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    console.log('📦 [PRODUCTS] Fetching real product data from Ploomes API...');

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const category = searchParams.get('category');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Get all won deals with products from Ploomes API
    console.log(`📦 [PRODUCTS] Fetching deals with search: "${search}", category: "${category}", limit: ${limit}, offset: ${offset}`);

    let deals: PloomesDeal[] = [];
    try {
      deals = await ploomesClient.getDeals({
        filter: 'StatusId eq 2', // Won deals only
        expand: ['DealProducts($expand=Product)', 'Contact'],
        select: ['Id', 'Title', 'Amount', 'CreatedDate', 'ContactId', 'StatusId'],
        orderby: 'CreatedDate desc'
      });
    } catch (error) {
      console.error('💥 [PRODUCTS] Ploomes API error:', error);
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
          message: 'No products found',
          search: search || null,
          category: category || null,
          pagination: { limit, offset, total: 0 }
        }
      });
    }

    // Process deals to extract and aggregate product data
    const productMap = new Map<string, ProductData>();

    for (const deal of deals) {
      try {
        // Get deal products from Ploomes API
        const dealProducts = await ploomesClient.getDealProducts(deal.Id);

        for (const dealProduct of dealProducts) {
          const product = dealProduct.Product || dealProduct;
          if (!product.Id || !product.Name) continue;

          const productId = product.Id.toString();
          const productName = product.Name;
          const productCode = product.Code || '';

          // Apply search filter if provided
          if (search && search.trim() && !productName.toLowerCase().includes(search.toLowerCase())) {
            continue;
          }

          // Apply category filter if provided
          if (category && category.trim() && !productName.toLowerCase().includes(category.toLowerCase())) {
            continue;
          }

          const quantity = dealProduct.Quantity || dealProduct.quantity || 1;
          const unitPrice = dealProduct.UnitPrice || dealProduct.unitPrice || product.Price || 0;
          const total = dealProduct.Total || dealProduct.total || (quantity * unitPrice);

          // Get or create product entry
          let productData = productMap.get(productId);
          if (!productData) {
            productData = {
              id: productId,
              name: productName,
              code: productCode,
              category: 'Geral', // Could be enhanced with actual category from Ploomes
              price: unitPrice,
              revenue: 0,
              unitsSold: 0,
              dealCount: 0,
              lastSaleDate: deal.CreatedDate || new Date().toISOString()
            };
            productMap.set(productId, productData);
          }

          // Update aggregated data
          productData.revenue += total;
          productData.unitsSold += quantity;
          productData.dealCount += 1;
          productData.price = (productData.price + unitPrice) / 2; // Average price

          // Update last sale date if this deal is more recent
          if (deal.CreatedDate && new Date(deal.CreatedDate) > new Date(productData.lastSaleDate)) {
            productData.lastSaleDate = deal.CreatedDate;
          }
        }
      } catch (dealError) {
        console.warn(`⚠️ [PRODUCTS] Error processing deal ${deal.Id}:`, dealError);
        continue;
      }
    }

    // Convert to array and apply pagination
    const allProducts = Array.from(productMap.values())
      .filter(product => product.revenue > 0)
      .sort((a, b) => b.revenue - a.revenue);

    const totalProducts = allProducts.length;
    const products = allProducts.slice(offset, offset + limit);

    const responseTime = Date.now() - startTime;

    console.log(`📦 [PRODUCTS] ✅ SUCCESS: Found ${products.length} products (${responseTime}ms)`);

    // Log top products for debugging
    const top5 = products.slice(0, 5);
    console.log('🏆 [TOP PRODUCTS]:');
    top5.forEach((p, i) => {
      console.log(`  ${i + 1}. ${p.name}: R$ ${p.revenue.toFixed(2)} (${p.unitsSold} units, ${p.dealCount} deals)`);
    });

    // Pagination metadata
    const hasNext = offset + products.length < totalProducts;

    return NextResponse.json({
      success: true,
      data: products,
      metadata: {
        source: 'ploomes_api_real_data',
        timestamp: new Date().toISOString(),
        responseTime,
        search: search || null,
        category: category || null,
        pagination: {
          limit,
          offset,
          total: totalProducts,
          hasNext
        },
        summary: {
          totalProducts: products.length,
          totalRevenue: products.reduce((sum, p) => sum + p.revenue, 0),
          totalUnitsSold: products.reduce((sum, p) => sum + p.unitsSold, 0),
          totalDeals: products.reduce((sum, p) => sum + p.dealCount, 0),
          avgRevenuePerProduct: products.length > 0 ?
            products.reduce((sum, p) => sum + p.revenue, 0) / products.length : 0
        },
        note: "📦 REAL PRODUCT DATA FROM PLOOMES API!"
      }
    });

  } catch (error: unknown) {
    const responseTime = Date.now() - startTime;
    console.error('💥 [PRODUCTS] Error:', error);

    return NextResponse.json(
      {
        success: false,
        message: 'Server error in products API',
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