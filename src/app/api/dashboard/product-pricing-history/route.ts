import { NextRequest, NextResponse } from "next/server";
import { createClient } from '@supabase/supabase-js';

/**
 * Get pricing history for a specific product and customer
 */
export async function GET(request: NextRequest) {
  try {
    console.log('📊 Product Pricing History API called');

    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');
    const productId = searchParams.get('productId');

    console.log('[PRODUCT PRICING] Params:', { customerId, productId });

    if (!customerId || !productId) {
      return NextResponse.json(
        { success: false, message: 'Customer ID and Product ID are required' },
        { status: 400 }
      );
    }

    // Initialize Supabase - use server env vars first, fallback to public
    const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    console.log('[PRODUCT PRICING] Using Supabase URL:', SUPABASE_URL ? 'OK' : 'MISSING');
    console.log('[PRODUCT PRICING] Using Supabase Key:', SUPABASE_KEY ? 'OK' : 'MISSING');

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    // Get all sales containing this product for this customer
    const { data: allSales, error: salesError } = await supabase
      .from('sales')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });

    if (salesError) {
      console.error('[PRICING HISTORY API] Error:', salesError);
      throw salesError;
    }

    // Extract pricing history from sales JSONB
    const pricingHistory: Array<{
      date: string;
      price: number;
      quantity: number;
      total: number;
      deal_id: number;
    }> = [];

    console.log('[PRODUCT PRICING] Found', allSales?.length, 'sales for customer');

    // Extract product name from unknown_ prefix if present
    const extractedProductName = productId.startsWith('unknown_')
      ? productId.substring(8) // Remove "unknown_" prefix
      : null;

    console.log('[PRODUCT PRICING] Looking for product:', { productId, extractedProductName });

    allSales?.forEach((sale: any) => {
      if (sale.products && Array.isArray(sale.products)) {
        sale.products.forEach((prod: any) => {
          // Match by product_id or product_name if product_id is null (for unknown products)
          let matchesProduct = false;

          if (prod.product_id && prod.product_id.toString() === productId) {
            // Direct ID match
            matchesProduct = true;
          } else if (extractedProductName && prod.product_name) {
            // Flexible name matching: normalize and compare
            const normalizedProdName = prod.product_name.trim().toLowerCase();
            const normalizedSearchName = extractedProductName.trim().toLowerCase();
            matchesProduct = normalizedProdName === normalizedSearchName;
          }

          console.log('[PRODUCT PRICING] Checking product:', {
            prod_id: prod.product_id,
            prod_name: prod.product_name,
            expected_id: productId,
            extracted_name: extractedProductName,
            matches: matchesProduct
          });

          if (matchesProduct) {
            pricingHistory.push({
              date: sale.created_at,
              price: parseFloat(prod.unit_price) || 0,
              quantity: prod.quantity || 0,
              total: parseFloat(prod.total) || 0,
              deal_id: parseInt(sale.ploomes_deal_id) || 0
            });
          }
        });
      }
    });

    // Calculate statistics
    const prices = pricingHistory.map(h => h.price);
    const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
    const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;
    const avgPrice = prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;
    const currentPrice = prices.length > 0 ? prices[0] : 0; // Most recent

    console.log(`[PRICING HISTORY API] ✅ Found ${pricingHistory.length} price records`);

    return NextResponse.json({
      success: true,
      data: {
        history: pricingHistory,
        stats: {
          minPrice,
          maxPrice,
          avgPrice,
          currentPrice
        }
      },
      metadata: {
        timestamp: new Date().toISOString(),
        recordCount: pricingHistory.length
      }
    });

  } catch (error: unknown) {
    console.error('💥 Product Pricing History API error:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Server error in pricing history API',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
