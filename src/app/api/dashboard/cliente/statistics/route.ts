import { NextRequest, NextResponse } from "next/server";
import { ploomesClient } from "@/lib/ploomes-client";
import fs from 'fs';
import path from 'path';

// Cache for the pre-processed deals data to avoid re-reading and re-processing
let cacheData: {
  allDeals: any[];
  dealsByContact: Record<string, any>;
  ranking: any[];
  lastUpdated: number;
} | null = null;

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const contactId = searchParams.get('contactId');

    if (!contactId) {
      return NextResponse.json(
        { error: "ContactId parameter is required" },
        { status: 400 }
      );
    }

    console.log(`📊 Getting statistics for contact ${contactId}`);

    // Check if we need to load/refresh cache
    const now = Date.now();
    if (!cacheData || (now - cacheData.lastUpdated) > CACHE_TTL) {
      console.log('🔄 Loading/refreshing cache...');

      // Load cached deals to get complete statistics
      let allDeals: any[] = [];

      try {
        // Try loading the enhanced file with products
        let cachedDealsPath = path.join(process.cwd(), 'ploomes-deals-with-products.json');

        if (!fs.existsSync(cachedDealsPath)) {
          cachedDealsPath = path.join(process.cwd(), 'ploomes-deals.json');
        }

        if (fs.existsSync(cachedDealsPath)) {
          const cachedDataStr = fs.readFileSync(cachedDealsPath, 'utf8');
          allDeals = JSON.parse(cachedDataStr);
          console.log(`📊 Loaded ${allDeals.length} total deals for statistics`);
        }
      } catch (error) {
        console.error('Error loading deals for statistics:', error);
        return NextResponse.json(
          { error: 'Failed to load deals data' },
          { status: 500 }
        );
      }

      // Pre-process data for faster subsequent requests
      const dealsByContact = allDeals.reduce((acc: any, deal: any) => {
        if (!acc[deal.ContactId]) {
          acc[deal.ContactId] = {
            count: 0,
            totalValue: 0,
            contactName: deal.ContactName || `Contact ${deal.ContactId}`,
            deals: []
          };
        }
        acc[deal.ContactId].count++;
        acc[deal.ContactId].totalValue += deal.Amount || 0;
        acc[deal.ContactId].deals.push(deal);
        return acc;
      }, {});

      const ranking = Object.entries(dealsByContact)
        .map(([id, data]: any) => ({
          contactId: parseInt(id),
          contactName: data.contactName,
          dealCount: data.count,
          totalValue: data.totalValue
        }))
        .sort((a, b) => b.dealCount - a.dealCount);

      cacheData = {
        allDeals,
        dealsByContact,
        ranking,
        lastUpdated: now
      };

      console.log(`✅ Cache refreshed with ${allDeals.length} deals, ${ranking.length} customers`);
    } else {
      console.log('🚀 Using cached data');
    }

    // Use cached data
    const { allDeals, dealsByContact, ranking } = cacheData;
    const contactIdNum = parseInt(contactId);
    const contactData = dealsByContact[contactIdNum];

    if (!contactData) {
      return NextResponse.json(
        { error: `Customer with ID ${contactId} not found` },
        { status: 404 }
      );
    }

    const contactDeals = contactData.deals;

    // Find current customer position (optimized: use cached ranking)
    const customerRank = ranking.findIndex(r => r.contactId === contactIdNum) + 1;

    // Get top customers
    const topCustomers = ranking.slice(0, 10);

    // Product statistics for this customer
    const productStats: any = {};
    contactDeals.forEach(deal => {
      if (deal.Products && Array.isArray(deal.Products)) {
        deal.Products.forEach((product: any) => {
          const productName = product.ProductName || product.Product?.Name || 'Unknown Product';
          if (!productStats[productName]) {
            productStats[productName] = {
              name: productName,
              count: 0,
              totalQuantity: 0,
              totalValue: 0
            };
          }
          productStats[productName].count++;

          // Safe numeric conversion to avoid NaN
          const quantity = Number(product.Quantity) || 1;
          const total = Number(product.Total) || Number(product.Amount) || 0;

          productStats[productName].totalQuantity += quantity;
          productStats[productName].totalValue += total;
        });
      }
    });

    const topProducts = Object.values(productStats)
      .map((product: any) => ({
        product_name: product.name,
        total_quantity: product.totalQuantity,
        total_value: isNaN(product.totalValue) ? 0 : product.totalValue, // Ensure no NaN values
        deal_count: product.count
      }))
      .filter((product: any) => product.total_value > 0) // Only include products with valid revenue
      .sort((a: any, b: any) => b.total_value - a.total_value)
      .slice(0, 5);

    // Time-based statistics
    const dealsByMonth: any = {};
    contactDeals.forEach(deal => {
      const date = new Date(deal.CreatedDate || deal.LastUpdateDate);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!dealsByMonth[monthKey]) {
        dealsByMonth[monthKey] = {
          month: monthKey,
          count: 0,
          value: 0
        };
      }
      dealsByMonth[monthKey].count++;
      dealsByMonth[monthKey].value += deal.Amount || 0;
    });

    const monthlyTrend = Object.values(dealsByMonth)
      .sort((a: any, b: any) => a.month.localeCompare(b.month))
      .slice(-12); // Last 12 months

    const statistics = {
      customer: {
        contactId: contactIdNum,
        totalDeals: contactData.count,
        totalValue: contactData.totalValue,
        ranking: customerRank,
        totalCustomers: ranking.length,
        percentile: Math.round((1 - customerRank / ranking.length) * 100)
      },
      topCustomers,
      topProducts,
      monthlyTrend,
      systemTotal: {
        totalDeals: allDeals.length,
        totalCustomers: ranking.length,
        totalValue: ranking.reduce((sum, customer) => sum + customer.totalValue, 0)
      }
    };

    console.log(`✅ Statistics generated for contact ${contactId}`);
    return NextResponse.json(statistics);

  } catch (error) {
    console.error('❌ Error generating statistics:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate statistics',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}