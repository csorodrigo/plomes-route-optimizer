import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient, hasSupabase } from '@/lib/supabase';

interface PricingHistoryRecord {
  customerId: string;
  customerName: string;
  productId: string;
  productName: string;
  price: number;
  validFrom: string;
  validTo?: string;
  minPriceEver: number;
  maxPriceEver: number;
  currentPrice: boolean;
  warning?: string;
}

export async function GET(request: NextRequest) {
  try {
    console.log('📊 Pricing History API called');

    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');
    const customerId = searchParams.get('customerId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Validate required parameters
    if (!productId) {
      return NextResponse.json(
        {
          success: false,
          message: 'productId parameter is required'
        },
        { status: 400 }
      );
    }

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

    // Build query for pricing history with date filtering
    let pricingQuery = supabase
      .from('pricing_history')
      .select(`
        id,
        product_id,
        customer_id,
        price,
        valid_from,
        valid_to,
        created_at,
        products(id, name),
        customers(id, name)
      `)
      .eq('product_id', productId)
      .order('valid_from', { ascending: false });

    // Apply customer filter if provided
    if (customerId) {
      pricingQuery = pricingQuery.eq('customer_id', customerId);
    }

    // Apply date filters if provided (filter by valid_from date)
    if (startDate) {
      pricingQuery = pricingQuery.gte('valid_from', startDate);
    }
    if (endDate) {
      pricingQuery = pricingQuery.lte('valid_from', endDate);
    }

    const { data: pricingHistory, error: pricingError } = await pricingQuery;

    if (pricingError) {
      console.error('[PRICING HISTORY API] Error fetching pricing history:', pricingError);
      throw pricingError;
    }

    if (!pricingHistory || pricingHistory.length === 0) {
      console.log('[PRICING HISTORY API] No pricing history found');
      return NextResponse.json({
        success: true,
        data: [],
        message: 'No pricing history found for the specified product',
        metadata: {
          source: 'supabase_postgresql',
          timestamp: new Date().toISOString(),
          filters: { productId, customerId: customerId || null }
        }
      });
    }

    // Calculate min and max prices across all history
    const allPrices = pricingHistory.map(p => p.price);
    const globalMinPrice = Math.min(...allPrices);
    const globalMaxPrice = Math.max(...allPrices);

    // Transform pricing history with warnings
    const currentDate = new Date().toISOString();
    const pricingRecords: PricingHistoryRecord[] = pricingHistory.map(record => {
      const productData = record.products as any;
      const customerData = record.customers as any;

      // Determine if this is the current price (valid_to is null or in future)
      const currentPrice = !record.valid_to || record.valid_to > currentDate;

      // Add warning if current price is below minimum
      let warning: string | undefined;
      if (currentPrice && record.price < globalMinPrice * 1.05) {
        warning = `Price is at or near historical minimum (${globalMinPrice})`;
      }

      return {
        customerId: record.customer_id,
        customerName: customerData?.name || 'Unknown Customer',
        productId: record.product_id,
        productName: productData?.name || 'Unknown Product',
        price: record.price,
        validFrom: record.valid_from,
        validTo: record.valid_to || undefined,
        minPriceEver: globalMinPrice,
        maxPriceEver: globalMaxPrice,
        currentPrice,
        warning
      };
    });

    // Calculate pricing statistics
    const avgPrice = allPrices.reduce((sum, price) => sum + price, 0) / allPrices.length;
    const priceVariance = globalMaxPrice - globalMinPrice;
    const priceVolatility = priceVariance / avgPrice;

    // Group by customer for summary
    const customerPricingMap = new Map<string, {
      customerName: string;
      avgPrice: number;
      minPrice: number;
      maxPrice: number;
      priceChanges: number;
    }>();

    pricingRecords.forEach(record => {
      const existing = customerPricingMap.get(record.customerId) || {
        customerName: record.customerName,
        avgPrice: 0,
        minPrice: Infinity,
        maxPrice: -Infinity,
        priceChanges: 0
      };

      const prices = pricingRecords
        .filter(r => r.customerId === record.customerId)
        .map(r => r.price);

      existing.avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;
      existing.minPrice = Math.min(...prices);
      existing.maxPrice = Math.max(...prices);
      existing.priceChanges = prices.length - 1;

      customerPricingMap.set(record.customerId, existing);
    });

    const customerSummary = Array.from(customerPricingMap.entries()).map(([customerId, data]) => ({
      customerId,
      ...data
    }));

    console.log(`[PRICING HISTORY API] ✅ Found ${pricingRecords.length} pricing records`);

    return NextResponse.json({
      success: true,
      data: pricingRecords,
      summary: {
        totalRecords: pricingRecords.length,
        uniqueCustomers: customerPricingMap.size,
        priceRange: {
          min: globalMinPrice,
          max: globalMaxPrice,
          avg: avgPrice,
          variance: priceVariance,
          volatility: priceVolatility
        },
        customerSummary
      },
      metadata: {
        source: 'supabase_postgresql',
        timestamp: new Date().toISOString(),
        filters: {
          productId,
          customerId: customerId || null
        }
      }
    });

  } catch (error: unknown) {
    console.error('💥 Pricing History API error:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Server error in pricing history API',
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