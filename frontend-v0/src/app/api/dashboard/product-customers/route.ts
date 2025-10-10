import { NextRequest, NextResponse } from "next/server";
import { ploomesClient } from '@/lib/ploomes-client';

interface ProductCustomerData {
  customerId: string;
  customerName: string;
  totalPurchases: number;
  totalValue: number;
  firstPurchase: string;
  lastPurchase: string;
  deals: Array<{
    dealId: string;
    dealTitle: string;
    dealValue: number;
    dealDate: string;
    quantity: number;
    unitPrice: number;
  }>;
}

/**
 * PRODUCT CUSTOMERS ENDPOINT - Busca clientes que compraram um produto específico via Ploomes API
 * Retorna lista de clientes que compraram o produto pesquisado
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    console.log('🔍 [PRODUCT CUSTOMERS] Searching customers who bought specific product from Ploomes API...');

    const { searchParams } = new URL(request.url);
    const productQuery = searchParams.get('product');

    if (!productQuery?.trim()) {
      return NextResponse.json(
        {
          success: false,
          message: 'Product search query is required',
          timestamp: new Date().toISOString()
        },
        { status: 400 }
      );
    }

    console.log(`🔍 [PRODUCT CUSTOMERS] Searching for product: "${productQuery}" in Ploomes API`);

    const productQueryLower = productQuery.toLowerCase();

    // Step 1: Get all deals with products expanded
    console.log('🔍 [PRODUCT CUSTOMERS] Fetching deals from Ploomes...');
    const deals = await ploomesClient.getDeals({
      select: ['Id', 'Title', 'Amount', 'ContactId', 'StatusId', 'CreatedDate', 'FinishDate'],
      expand: ['DealProducts($expand=Product($select=Id,Name,Code,Price))'],
      filter: 'StatusId eq 2', // Only won deals
      top: 1000
    });

    if (!deals || deals.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        metadata: {
          source: 'ploomes_api_real_data',
          timestamp: new Date().toISOString(),
          message: 'No won deals found in Ploomes',
          searchQuery: productQuery
        }
      });
    }

    console.log(`🔍 [PRODUCT CUSTOMERS] Found ${deals.length} won deals from Ploomes`);

    // Step 2: Filter deals that contain the searched product
    const matchingDeals: any[] = [];

    for (const deal of deals) {
      try {
        const dealProducts = (deal as any).DealProducts?.value || [];

        if (!dealProducts || dealProducts.length === 0) continue;

        // Check if any product in this deal matches the search query
        const hasMatchingProduct = dealProducts.some((dealProduct: any) => {
          const product = dealProduct.Product;
          if (!product) return false;

          const productName = (product.Name || '').toLowerCase();
          const productCode = (product.Code || '').toLowerCase();

          return productName.includes(productQueryLower) ||
                 productCode.includes(productQueryLower) ||
                 productQueryLower.includes(productName) ||
                 productQueryLower.includes(productCode);
        });

        if (hasMatchingProduct) {
          // Get customer name if available
          let customerName = `Cliente ${deal.ContactId}`;

          try {
            if (deal.ContactId) {
              const contact = await ploomesClient.getContactById(deal.ContactId);
              if (contact && contact.Name) {
                customerName = contact.Name;
              }
            }
          } catch (contactError) {
            console.warn(`⚠️ [PRODUCT CUSTOMERS] Could not fetch contact ${deal.ContactId}:`, contactError);
          }

          matchingDeals.push({
            Id: deal.Id,
            Title: deal.Title,
            Amount: deal.Amount,
            ContactId: deal.ContactId,
            CustomerName: customerName,
            CreatedDate: deal.CreatedDate || deal.FinishDate,
            Products: dealProducts.map((dp: any) => ({
              product_name: dp.Product?.Name,
              product_code: dp.Product?.Code,
              quantity: dp.Quantity || 1,
              unit_price: dp.Product?.Price || dp.UnitPrice || 0,
              total: dp.TotalPrice || (dp.Quantity || 1) * (dp.Product?.Price || dp.UnitPrice || 0)
            }))
          });
        }
      } catch (parseError) {
        console.warn(`⚠️ [PRODUCT CUSTOMERS] Error processing deal ${deal.Id}:`, parseError);
        continue;
      }
    }

    console.log(`🔍 [PRODUCT CUSTOMERS] Found ${matchingDeals.length} deals with matching products`);

    if (matchingDeals.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        metadata: {
          source: 'ploomes_api_real_data',
          timestamp: new Date().toISOString(),
          message: 'No customers found who bought this product',
          searchQuery: productQuery
        }
      });
    }

    // Group sales by customer and calculate aggregated data
    const customerMap = new Map<string, ProductCustomerData>();

    for (const deal of matchingDeals) {
      if (!deal.ContactId) continue;

      const customerId = deal.ContactId.toString();
      const customerName = deal.CustomerName || `Cliente ${customerId}`;

      // Get matching products from this deal
      const matchingProducts = deal.Products.filter((product: any) => {
        const productName = (product.product_name || product.name || '').toLowerCase();
        const productCode = (product.product_code || product.code || '').toLowerCase();

        return productName.includes(productQueryLower) ||
               productCode.includes(productQueryLower) ||
               productQueryLower.includes(productName) ||
               productQueryLower.includes(productCode);
      });

      if (matchingProducts.length === 0) continue;

      // Calculate deal value for matching products
      let dealProductValue = 0;
      let totalQuantity = 0;
      let avgUnitPrice = 0;

      for (const product of matchingProducts) {
        const quantity = product.quantity || 1;
        const unitPrice = product.unit_price || product.unitPrice || 0;
        const total = product.total || (quantity * unitPrice);

        dealProductValue += total;
        totalQuantity += quantity;
        avgUnitPrice += unitPrice;
      }

      if (matchingProducts.length > 0) {
        avgUnitPrice = avgUnitPrice / matchingProducts.length;
      }

      // Get or create customer data
      let customerData = customerMap.get(customerId);
      if (!customerData) {
        customerData = {
          customerId,
          customerName,
          totalPurchases: 0,
          totalValue: 0,
          firstPurchase: deal.CreatedDate || new Date().toISOString(),
          lastPurchase: deal.CreatedDate || new Date().toISOString(),
          deals: []
        };
        customerMap.set(customerId, customerData);
      }

      // Update customer aggregated data
      customerData.totalPurchases += 1;
      customerData.totalValue += dealProductValue;

      // Update date ranges
      const dealDate = deal.CreatedDate || new Date().toISOString();
      if (new Date(dealDate) < new Date(customerData.firstPurchase)) {
        customerData.firstPurchase = dealDate;
      }
      if (new Date(dealDate) > new Date(customerData.lastPurchase)) {
        customerData.lastPurchase = dealDate;
      }

      // Add deal details
      customerData.deals.push({
        dealId: deal.Id.toString(),
        dealTitle: deal.Title || 'Unknown Deal',
        dealValue: deal.Amount || 0,
        dealDate: dealDate,
        quantity: totalQuantity,
        unitPrice: avgUnitPrice
      });

      console.log(`👤 [PRODUCT CUSTOMERS] Customer ${customerId}: +R$ ${dealProductValue.toFixed(2)} (${totalQuantity} units)`);
    }

    // Convert to array and sort by total value
    const customersData = Array.from(customerMap.values())
      .map(customer => ({
        ...customer,
        // Ensure no NaN values
        totalValue: isNaN(customer.totalValue) ? 0 : customer.totalValue,
        totalPurchases: isNaN(customer.totalPurchases) ? 0 : customer.totalPurchases,
        deals: customer.deals.map(deal => ({
          ...deal,
          dealValue: isNaN(deal.dealValue) ? 0 : deal.dealValue,
          quantity: isNaN(deal.quantity) ? 0 : deal.quantity,
          unitPrice: isNaN(deal.unitPrice) ? 0 : deal.unitPrice
        }))
      }))
      .filter(customer => customer.totalValue > 0)
      .sort((a, b) => b.totalValue - a.totalValue);

    const responseTime = Date.now() - startTime;

    console.log(`🔍 [PRODUCT CUSTOMERS] ✅ SUCCESS: Found ${customersData.length} customers who bought "${productQuery}" (${responseTime}ms)`);

    // Log top customers for debugging
    const top5 = customersData.slice(0, 5);
    console.log('🏆 [TOP CUSTOMERS]:');
    top5.forEach((c, i) => {
      console.log(`  ${i + 1}. ${c.customerName}: R$ ${c.totalValue.toFixed(2)} (${c.totalPurchases} compras)`);
    });

    return NextResponse.json({
      success: true,
      data: customersData,
      metadata: {
        source: 'ploomes_api_real_data',
        timestamp: new Date().toISOString(),
        responseTime,
        searchQuery: productQuery,
        summary: {
          totalCustomers: customersData.length,
          totalDealsProcessed: matchingDeals.length,
          totalRevenue: customersData.reduce((sum, c) => sum + c.totalValue, 0),
          totalPurchases: customersData.reduce((sum, c) => sum + c.totalPurchases, 0)
        },
        note: "🔍 CUSTOMERS WHO BOUGHT SPECIFIC PRODUCT (Real Ploomes Data)"
      }
    });

  } catch (error: unknown) {
    const responseTime = Date.now() - startTime;
    console.error('💥 [PRODUCT CUSTOMERS] Error:', error);

    return NextResponse.json(
      {
        success: false,
        message: 'Server error in product customers API',
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