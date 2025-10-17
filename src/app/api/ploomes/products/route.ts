import { NextRequest, NextResponse } from 'next/server';
import { ploomesClient } from '@/lib/ploomes-client';

/**
 * GET /api/ploomes/products
 * Fetch all products directly from Ploomes API
 * Supports filtering by active status and search
 */
export async function GET(request: NextRequest) {
  try {
    console.log('[API] Fetching products directly from Ploomes API...');

    // Get query parameters for filtering
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const active = searchParams.get('active') !== 'false'; // Default to active only
    const limit = parseInt(searchParams.get('limit') || '300');

    // Build filter for Ploomes API
    const filters: string[] = [];

    // Only active products by default
    if (active) {
      filters.push('Active eq true');
    }

    // Search by name or code if provided
    if (search && search.trim()) {
      const searchTerm = search.trim();
      filters.push(`(contains(Name,'${searchTerm}') or contains(Code,'${searchTerm}'))`);
    }

    const filter = filters.length > 0 ? filters.join(' and ') : undefined;

    // Fetch products from Ploomes
    const products = await ploomesClient.getProducts({
      select: [
        'Id',
        'Name',
        'Code',
        'Price',
        'Active',
        'GroupId',
        'FamilyId'
      ],
      filter,
      top: limit
    });

    console.log(`[API] ✅ Fetched ${products.length} products from Ploomes`);

    // Transform to expected format
    const transformedProducts = products.map(product => ({
      id: product.Id.toString(),
      name: product.Name || 'Produto sem nome',
      code: product.Code || '',
      price: product.Price || 0,
      active: product.Active || false,
      groupId: product.GroupId,
      familyId: product.FamilyId,
      // Additional Ploomes-specific data
      ploomes: {
        id: product.Id,
        groupId: product.GroupId,
        familyId: product.FamilyId
      }
    }));

    return NextResponse.json({
      success: true,
      data: transformedProducts,
      total: transformedProducts.length,
      source: 'ploomes_realtime',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[API] Error fetching Ploomes products:', error);

    return NextResponse.json({
      success: false,
      error: 'Failed to fetch products from Ploomes API',
      details: error instanceof Error ? error.message : 'Unknown error',
      source: 'ploomes_realtime'
    }, { status: 500 });
  }
}