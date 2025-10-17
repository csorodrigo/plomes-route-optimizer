import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

/**
 * GET /api/ploomes-cached/customers
 * Fetch customers from cached data for testing purposes
 * This endpoint uses cached JSON data as a fallback when Ploomes API is not accessible
 */
export async function GET(request: NextRequest) {
  try {
    console.log('[API] Fetching customers from cached data...');

    // Get query parameters for filtering
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const limit = parseInt(searchParams.get('limit') || '50');

    // Load cached deals data
    const cachedDealsPath = path.join(process.cwd(), 'ploomes-deals-checkpoint.json');

    if (!fs.existsSync(cachedDealsPath)) {
      throw new Error('Cached deals file not found');
    }

    const cachedData = fs.readFileSync(cachedDealsPath, 'utf8');
    const deals = JSON.parse(cachedData);

    console.log(`[API] Loaded ${deals.length} cached deals`);

    // Extract unique customers from deals data
    const customerMap = new Map();

    deals.forEach((deal: any) => {
      const contactId = deal.ContactId;
      if (!contactId) return;

      const customerName = deal.Contact?.Name || `Cliente ${contactId}`;
      const customerDocument = deal.Contact?.Document || '';
      const customerEmail = deal.Contact?.Email || '';

      if (!customerMap.has(contactId)) {
        customerMap.set(contactId, {
          id: contactId.toString(),
          name: customerName,
          document: customerDocument,
          email: customerEmail,
          type: customerDocument.length === 14 ? 'company' : 'person',
          status: 'active',
          address: deal.Contact?.Address || '',
          // Ploomes-specific data
          ploomes: {
            id: contactId,
            typeId: customerDocument.length === 14 ? 1 : 2,
            statusId: 1
          }
        });
      }
    });

    let customers = Array.from(customerMap.values());

    // Apply search filter if provided
    if (search && search.trim()) {
      const searchTerm = search.toLowerCase();
      customers = customers.filter(customer =>
        (customer.name && customer.name.toLowerCase().includes(searchTerm)) ||
        (customer.document && customer.document.toLowerCase().includes(searchTerm)) ||
        (customer.email && customer.email.toLowerCase().includes(searchTerm))
      );
    }

    // Apply limit
    customers = customers.slice(0, limit);

    console.log(`[API] ✅ Returning ${customers.length} customers from cache`);

    return NextResponse.json({
      success: true,
      data: customers,
      total: customers.length,
      source: 'ploomes_cached',
      timestamp: new Date().toISOString(),
      note: 'This data is from cached files and may not reflect the latest changes in Ploomes'
    });

  } catch (error) {
    console.error('[API] Error loading cached customers:', error);

    return NextResponse.json({
      success: false,
      error: 'Failed to load customers from cached data',
      details: error instanceof Error ? error.message : 'Unknown error',
      source: 'ploomes_cached'
    }, { status: 500 });
  }
}