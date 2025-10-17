import { NextRequest, NextResponse } from 'next/server';
import { ploomesClient } from '@/lib/ploomes-client';
import { ploomesApi, PloomesAPIUtils } from '@/lib/ploomes-safe-api';

/**
 * GET /api/ploomes/customers
 * Fetch all customers directly from Ploomes API
 * Real-time data, no Supabase caching
 */
export async function GET(request: NextRequest) {
  try {
    console.log('[API] Fetching customers directly from Ploomes API...');

    // Get query parameters for filtering
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const limit = parseInt(searchParams.get('limit') || '50');
    const active = searchParams.get('active') !== 'false'; // Default to active only

    // Build filter for Ploomes API
    let filter = '';
    const filters: string[] = [];

    // Only active contacts by default
    if (active) {
      filters.push('StatusId eq 1'); // 1 = Active
    }

    // Search by name if provided
    if (search && search.trim()) {
      const searchTerm = search.trim();
      filters.push(`contains(Name,'${searchTerm}')`);
    }

    if (filters.length > 0) {
      filter = filters.join(' and ');
    }

    // Fetch customers from Ploomes using SAFE API
    console.log(`[API] 🛡️ Using SAFE API with filter: ${filter || 'none'}`);

    let customers;
    if (filter && (filter.includes(' and ') || filter.includes('contains('))) {
      // Complex filter detected - use safe API with memory filtering
      console.log(`[API] ⚠️ Complex filter detected, using safe fallback strategies`);
      customers = await ploomesApi.getContactsSafe({
        top: Math.max(limit * 3, 300), // Get more to filter in memory
        select: ['Id', 'Name', 'Document', 'Email', 'TypeId', 'StatusId', 'StreetAddress', 'CityId']
      });

      // Apply filters in memory to avoid 403 errors
      if (active) {
        customers = customers.filter(c => c.StatusId === 1);
      }
      if (search && search.trim()) {
        const searchLower = search.trim().toLowerCase();
        customers = customers.filter(c =>
          c.Name?.toLowerCase().includes(searchLower) ||
          c.Document?.toLowerCase().includes(searchLower) ||
          c.Email?.toLowerCase().includes(searchLower)
        );
      }
      customers = customers.slice(0, limit);
    } else {
      // Simple or no filter - try direct API first, fall back to safe API
      try {
        // Check if the filter pattern is safe
        if (!filter || PloomesAPIUtils.isPatternSafe(filter)) {
          customers = await ploomesClient.getContacts({
            select: [
              'Id',
              'Name',
              'Document', // CPF/CNPJ
              'Email',
              'TypeId',
              'StatusId',
              'StreetAddress',
              'CityId'
            ],
            filter: filter || undefined,
            top: limit
          });
        } else {
          throw new Error('Unsafe filter pattern detected');
        }
      } catch (error) {
        console.log(`[API] ⚠️ Direct API failed, falling back to safe API:`, error);
        customers = await ploomesApi.getContactsSafe({
          top: limit,
          select: ['Id', 'Name', 'Document', 'Email', 'TypeId', 'StatusId', 'StreetAddress', 'CityId']
        });

        // Apply filters in memory
        if (active) {
          customers = customers.filter(c => c.StatusId === 1);
        }
        if (search && search.trim()) {
          const searchLower = search.trim().toLowerCase();
          customers = customers.filter(c =>
            c.Name?.toLowerCase().includes(searchLower) ||
            c.Document?.toLowerCase().includes(searchLower) ||
            c.Email?.toLowerCase().includes(searchLower)
          );
        }
      }
    }

    console.log(`[API] ✅ Fetched ${customers.length} customers from Ploomes`);

    // Transform to expected format
    const transformedCustomers = customers.map(customer => ({
      id: customer.Id.toString(),
      name: customer.Name || 'Sem nome',
      document: customer.Document || '',
      email: customer.Email || '',
      type: customer.TypeId === 1 ? 'company' : 'person',
      status: customer.StatusId === 1 ? 'active' : 'inactive',
      address: customer.StreetAddress || '',
      cityId: customer.CityId,
      // Additional Ploomes-specific data
      ploomes: {
        id: customer.Id,
        typeId: customer.TypeId,
        statusId: customer.StatusId
      }
    }));

    return NextResponse.json({
      success: true,
      data: transformedCustomers,
      total: transformedCustomers.length,
      source: 'ploomes_realtime',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[API] Error fetching Ploomes customers:', error);

    return NextResponse.json({
      success: false,
      error: 'Failed to fetch customers from Ploomes API',
      details: error instanceof Error ? error.message : 'Unknown error',
      source: 'ploomes_realtime'
    }, { status: 500 });
  }
}