import { NextRequest, NextResponse } from "next/server";
import { ploomesClient } from '@/lib/ploomes-client';

interface CustomerSale {
  customerId: string;
  customerName: string;
  cnpj: string;
  totalRevenue: number;
  dealCount: number;
  avgDealSize: number;
  lastPurchaseDate: string;
}

/**
 * Get ALL customers with sales - LIVE PLOOMES DATA
 *
 * ✅ Fetches data directly from Ploomes API
 * ✅ Real-time data with customer names and documents
 * ✅ Supports search filtering
 * ✅ Shows ALL customers from Ploomes CRM
 *
 * Note: Live data from Ploomes API
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    console.log('📊 [CUSTOMERS API] Fetching from live Ploomes API...');

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');

    // Build filter for Ploomes API
    let filter = undefined;
    if (search) {
      const searchTerm = search.trim();
      // Search by name or document (CNPJ/CPF)
      filter = `contains(Name,'${searchTerm}') or contains(Document,'${searchTerm}')`;
    }

    // Fetch customers from Ploomes
    console.log('📊 [CUSTOMERS API] Fetching contacts from Ploomes...');
    const contacts = await ploomesClient.getContacts({
      select: ['Id', 'Name', 'Document', 'Email', 'TypeId'],
      filter: filter,
      top: search ? 100 : 1000 // Limit results when searching
    });

    if (!contacts || contacts.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        metadata: {
          source: 'ploomes_api_live',
          timestamp: new Date().toISOString(),
          message: search ? 'No customers found matching search' : 'No customers found'
        }
      });
    }

    console.log(`📊 [CUSTOMERS API] Found ${contacts.length} contacts from Ploomes`);

    // Get recent deals to calculate sales data for customers
    console.log('📊 [CUSTOMERS API] Fetching recent deals...');
    const recentDeals = await ploomesClient.getDeals({
      select: ['Id', 'Title', 'Amount', 'ContactId', 'CreatedDate', 'FinishDate'],
      filter: 'StatusId eq 2', // Won deals only
      top: 2000
    });

    // Group deals by customer
    const dealsByCustomer = new Map<number, any[]>();
    recentDeals?.forEach(deal => {
      if (deal.ContactId) {
        const existing = dealsByCustomer.get(deal.ContactId) || [];
        existing.push(deal);
        dealsByCustomer.set(deal.ContactId, existing);
      }
    });

    // Convert contacts to customer sales format
    const customersWithSales: CustomerSale[] = contacts.map(contact => {
      const customerDeals = dealsByCustomer.get(contact.Id) || [];
      const totalRevenue = customerDeals.reduce((sum, deal) => sum + (deal.Amount || 0), 0);
      const dealCount = customerDeals.length;
      const avgDealSize = dealCount > 0 ? totalRevenue / dealCount : 0;

      // Find most recent deal date
      const lastPurchaseDate = customerDeals.length > 0 ?
        customerDeals
          .map(deal => deal.FinishDate || deal.CreatedDate)
          .filter(date => date)
          .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] || 'N/A'
        : 'N/A';

      return {
        customerId: contact.Id.toString(),
        customerName: contact.Name || 'Cliente sem nome',
        cnpj: contact.Document || 'N/A',
        totalRevenue,
        dealCount,
        avgDealSize,
        lastPurchaseDate
      };
    });

    // Sort by total revenue (highest first)
    customersWithSales.sort((a, b) => {
      // Customers with purchases first
      if (a.dealCount > 0 && b.dealCount === 0) return -1;
      if (a.dealCount === 0 && b.dealCount > 0) return 1;

      // Both have purchases - sort by revenue
      if (a.dealCount > 0 && b.dealCount > 0) {
        return b.totalRevenue - a.totalRevenue;
      }

      // Both without purchases - sort by name
      return a.customerName.localeCompare(b.customerName);
    });

    const responseTime = Date.now() - startTime;

    console.log(`✅ [CUSTOMERS API] Processed ${customersWithSales.length} customers in ${responseTime}ms`);

    // Log top customers
    const topCustomers = customersWithSales.filter(c => c.dealCount > 0).slice(0, 5);
    console.log('🏆 [TOP CUSTOMERS]:');
    topCustomers.forEach((c, i) => {
      console.log(`  ${i + 1}. ${c.customerName}: R$ ${c.totalRevenue.toFixed(2)} (${c.dealCount} deals)`);
    });

    return NextResponse.json({
      success: true,
      data: customersWithSales,
      metadata: {
        source: 'ploomes_api_live',
        timestamp: new Date().toISOString(),
        responseTime,
        summary: {
          totalCustomers: customersWithSales.length,
          customersWithSales: customersWithSales.filter(c => c.dealCount > 0).length,
          totalRevenue: customersWithSales.reduce((sum, c) => sum + c.totalRevenue, 0),
          totalDeals: customersWithSales.reduce((sum, c) => sum + c.dealCount, 0),
        },
        note: "📊 CUSTOMERS WITH SALES DATA (Live Ploomes Data)",
        searchApplied: search || null
      }
    }, {
      headers: {
        // Cache for 5 minutes for better performance
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });

  } catch (error: unknown) {
    const responseTime = Date.now() - startTime;
    console.error('💥 [CUSTOMERS API] Error:', error);

    return NextResponse.json(
      {
        success: false,
        message: 'Server error in customers API',
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