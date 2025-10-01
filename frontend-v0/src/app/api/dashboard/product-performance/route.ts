import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient, hasSupabase } from '@/lib/supabase';

interface ProductPerformance {
  productId: string;
  productName: string;
  category?: string;
  totalSold: number;
  revenue: number;
  dealCount: number;
  avgDealSize: number;
  uniqueCustomers: number;
  growthRate?: number;
  lastSaleDate?: string;
}

export async function GET(request: NextRequest) {
  try {
    console.log('📊 Product Performance API called');

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const category = searchParams.get('category');

    // Validate Supabase availability
    if (!hasSupabase()) {
      return NextResponse.json(
        {
          success: false,
          message: 'Database not configured'
        },
        { status: 503 }
      );
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      throw new Error('Failed to initialize Supabase client');
    }

    // Fetch products
    let productsQuery = supabase
      .from('products')
      .select('*');

    if (category) {
      productsQuery = productsQuery.eq('category', category);
    }

    const { data: products, error: productsError } = await productsQuery;

    if (productsError) {
      console.error('[PRODUCT PERFORMANCE API] Error fetching products:', productsError);
      throw productsError;
    }

    // Fetch all sales with product information
    const { data: sales, error: salesError } = await supabase
      .from('sales')
      .select(`
        id,
        product_id,
        customer_id,
        amount,
        quantity,
        created_at,
        closed_at,
        products(id, name, category)
      `);

    if (salesError) {
      console.error('[PRODUCT PERFORMANCE API] Error fetching sales:', salesError);
      throw salesError;
    }

    // Build performance metrics by product
    const productPerformanceMap = new Map<string, {
      name: string;
      category?: string;
      totalSold: number;
      revenue: number;
      dealCount: number;
      uniqueCustomers: Set<string>;
      lastSaleDate?: string;
    }>();

    sales?.forEach(sale => {
      if (sale.product_id && sale.products) {
        const productId = sale.product_id;
        const productData = sale.products as any;
        const existing = productPerformanceMap.get(productId) || {
          name: productData.name || 'Unknown Product',
          category: productData.category,
          totalSold: 0,
          revenue: 0,
          dealCount: 0,
          uniqueCustomers: new Set<string>(),
          lastSaleDate: undefined
        };

        existing.totalSold += sale.quantity || 1;
        existing.revenue += sale.amount || 0;
        existing.dealCount += 1;

        if (sale.customer_id) {
          existing.uniqueCustomers.add(sale.customer_id);
        }

        // Update last sale date
        const saleDate = sale.closed_at || sale.created_at;
        if (saleDate && (!existing.lastSaleDate || saleDate > existing.lastSaleDate)) {
          existing.lastSaleDate = saleDate;
        }

        productPerformanceMap.set(productId, existing);
      }
    });

    // Transform to array and calculate metrics
    const productPerformance: ProductPerformance[] = Array.from(productPerformanceMap.entries()).map(([productId, data]) => {
      const avgDealSize = data.dealCount > 0 ? data.revenue / data.dealCount : 0;

      return {
        productId,
        productName: data.name,
        category: data.category,
        totalSold: data.totalSold,
        revenue: data.revenue,
        dealCount: data.dealCount,
        avgDealSize,
        uniqueCustomers: data.uniqueCustomers.size,
        lastSaleDate: data.lastSaleDate
      };
    });

    // Sort by revenue (descending)
    productPerformance.sort((a, b) => b.revenue - a.revenue);

    // Apply limit
    const limitedResults = productPerformance.slice(0, limit);

    // Calculate summary statistics
    const totalProducts = productPerformance.length;
    const totalRevenue = productPerformance.reduce((sum, p) => sum + p.revenue, 0);
    const totalUnitsSold = productPerformance.reduce((sum, p) => sum + p.totalSold, 0);
    const avgRevenuePerProduct = totalProducts > 0 ? totalRevenue / totalProducts : 0;

    // Get category breakdown
    const categoryBreakdown = productPerformance.reduce((acc, product) => {
      const cat = product.category || 'Uncategorized';
      if (!acc[cat]) {
        acc[cat] = { count: 0, revenue: 0 };
      }
      acc[cat].count += 1;
      acc[cat].revenue += product.revenue;
      return acc;
    }, {} as Record<string, { count: number; revenue: number }>);

    console.log(`[PRODUCT PERFORMANCE API] ✅ Found ${limitedResults.length} products with sales`);

    return NextResponse.json({
      success: true,
      data: limitedResults,
      summary: {
        totalProducts,
        totalRevenue,
        totalUnitsSold,
        avgRevenuePerProduct,
        categoryBreakdown
      },
      metadata: {
        source: 'supabase_postgresql',
        timestamp: new Date().toISOString(),
        filters: {
          limit,
          category: category || null
        }
      }
    });

  } catch (error: unknown) {
    console.error('💥 Product Performance API error:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Server error in product performance API',
        error: error instanceof Error ? error.message : 'Unknown error',
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