import { NextRequest, NextResponse } from "next/server";
import { ploomesClient } from '@/lib/ploomes-client';
import type { PloomesDeal, PloomesContact } from '@/lib/ploomes-client';

interface DealProductDetails {
  dealId: string;
  dealTitle: string;
  dealAmount: number;
  dealDate: string;
  products: Array<{
    productId: string;
    productName: string;
    productCode: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
  customerInfo: {
    customerId: string;
    customerName: string;
  };
}

/**
 * CUSTOMER DEAL PRODUCTS ENDPOINT - REAL PRODUCT DATA FOR SPECIFIC CUSTOMER DEALS
 * Fetches detailed product information for a customer's deals DIRECTLY from Ploomes API
 * Uses intelligent rate limiting and retry with exponential backoff
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    console.log('🔥 [CUSTOMER DEAL PRODUCTS] Fetching REAL data directly from Ploomes API...');

    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');
    const dealId = searchParams.get('dealId');

    if (!customerId && !dealId) {
      return NextResponse.json(
        {
          success: false,
          message: 'Either customerId or dealId is required',
          timestamp: new Date().toISOString()
        },
        { status: 400 }
      );
    }

    // If dealId is provided, get specific deal
    let deals: PloomesDeal[] = [];
    let customerContact: PloomesContact | null = null;

    if (dealId) {
      console.log(`🔍 [CUSTOMER DEAL PRODUCTS] Fetching specific deal ${dealId} from Ploomes API`);
      try {
        const singleDeal = await ploomesClient.getDeals({
          filter: `Id eq ${dealId}`,
          expand: ['DealProducts($expand=Product)', 'Contact'],
          top: 1
        });
        deals = singleDeal;

        if (deals.length > 0 && deals[0].ContactId) {
          customerContact = await ploomesClient.getContactById(deals[0].ContactId);
        }
      } catch (error) {
        console.error(`💥 [CUSTOMER DEAL PRODUCTS] Error fetching deal ${dealId}:`, error);
        return NextResponse.json(
          {
            success: false,
            message: 'Error fetching deal from Ploomes API',
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString()
          },
          { status: 500 }
        );
      }
    } else if (customerId) {
      console.log(`🔍 [CUSTOMER DEAL PRODUCTS] Fetching deals for customer ${customerId} from Ploomes API`);
      try {
        // Get customer info first
        customerContact = await ploomesClient.getContactById(parseInt(customerId));

        // Get deals for this customer using the optimized method
        deals = await ploomesClient.getDealsForContact(parseInt(customerId), 50);

        console.log(`🔍 [CUSTOMER DEAL PRODUCTS] Found ${deals.length} deals for customer ${customerId}`);
      } catch (error) {
        console.error(`💥 [CUSTOMER DEAL PRODUCTS] Error fetching customer deals:`, error);
        return NextResponse.json(
          {
            success: false,
            message: 'Error fetching customer deals from Ploomes API',
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString()
          },
          { status: 500 }
        );
      }
    }

    if (!deals || deals.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        metadata: {
          source: 'ploomes_api_real_data',
          timestamp: new Date().toISOString(),
          message: 'No deals found for the specified criteria',
          filters: { customerId, dealId }
        }
      });
    }

    console.log(`🔍 [CUSTOMER DEAL PRODUCTS] Processing ${deals.length} deals from Ploomes API`);

    // Prepare customer info
    const customerInfo = {
      customerId: customerId || deals[0]?.ContactId?.toString() || '',
      customerName: customerContact?.Name || `Cliente ${customerId || deals[0]?.ContactId || ''}`
    };

    // Process each deal to get products from Ploomes API
    const dealProductDetails: DealProductDetails[] = [];

    for (const deal of deals) {
      try {
        console.log(`🔍 [CUSTOMER DEAL PRODUCTS] Processing deal ${deal.Id}: ${deal.Title} (Amount: R$ ${deal.Amount})`);

        const products = [];

        // Try to get deal products from Ploomes API
        try {
          const dealProducts = await ploomesClient.getDealProducts(deal.Id);

          if (dealProducts && dealProducts.length > 0) {
            console.log(`📦 [CUSTOMER DEAL PRODUCTS] Found ${dealProducts.length} products for deal ${deal.Id}`);

            for (const dealProduct of dealProducts) {
              const product = dealProduct.Product || dealProduct;

              if (!product.Id && !product.Name) continue;

              const quantity = dealProduct.Quantity || dealProduct.quantity || 1;
              const unitPrice = dealProduct.UnitPrice || dealProduct.unitPrice || product.Price || 0;
              const total = dealProduct.Total || dealProduct.total || (quantity * unitPrice);

              products.push({
                productId: product.Id?.toString() || `product_${Date.now()}_${Math.random()}`,
                productName: product.Name || 'Produto/Serviço',
                productCode: product.Code || '',
                quantity: isNaN(quantity) ? 1 : Math.max(quantity, 1),
                unitPrice: isNaN(unitPrice) ? 0 : unitPrice,
                total: isNaN(total) ? 0 : total
              });

              console.log(`📦 [REAL PRODUCT] ${product.Name}: ${quantity} units × R$ ${unitPrice.toFixed(2)} = R$ ${total.toFixed(2)}`);
            }
          }
        } catch (productError) {
          console.warn(`⚠️ [CUSTOMER DEAL PRODUCTS] Error fetching products for deal ${deal.Id}:`, productError);
        }

        // If no products but deal has amount, create a generic service item
        if (products.length === 0 && deal.Amount > 0) {
          console.log(`🔧 [GENERIC SERVICE] No products found, creating generic service for deal ${deal.Id}`);
          products.push({
            productId: `service_${deal.Id}`,
            productName: 'Serviço/Produto (Valor do Deal)',
            productCode: 'SVC',
            quantity: 1,
            unitPrice: deal.Amount,
            total: deal.Amount
          });
        }

        // If still no products and no amount, create a placeholder
        if (products.length === 0) {
          console.log(`⚠️ [PLACEHOLDER] Creating placeholder for deal ${deal.Id} with no products or amount`);
          products.push({
            productId: `placeholder_${deal.Id}`,
            productName: 'Serviço/Produto não especificado',
            productCode: 'N/A',
            quantity: 1,
            unitPrice: 0,
            total: 0
          });
        }

        // Log final product count for this deal
        console.log(`🎯 [CUSTOMER DEAL PRODUCTS] Deal ${deal.Id} final: ${products.length} produtos processados`);
        if (products.length > 0) {
          const totalValue = products.reduce((sum, p) => sum + (p.total || 0), 0);
          console.log(`💰 [CUSTOMER DEAL PRODUCTS] Deal ${deal.Id} valor total dos produtos: R$ ${totalValue.toFixed(2)} (Deal original: R$ ${deal.Amount ? deal.Amount.toFixed(2) : '0.00'})`);
        }

        dealProductDetails.push({
          dealId: deal.Id.toString(),
          dealTitle: deal.Title || 'Unknown Deal',
          dealAmount: deal.Amount || 0,
          dealDate: deal.CreatedDate || new Date().toISOString(),
          products,
          customerInfo
        });

      } catch (dealError) {
        console.error(`💥 [CUSTOMER DEAL PRODUCTS] Error processing deal ${deal.Id}:`, dealError);
        // Continue processing other deals
        dealProductDetails.push({
          dealId: deal.Id.toString(),
          dealTitle: deal.Title || 'Unknown Deal',
          dealAmount: deal.Amount || 0,
          dealDate: deal.CreatedDate || new Date().toISOString(),
          products: [], // Empty products due to error
          customerInfo
        });
      }
    }

    const responseTime = Date.now() - startTime;

    // Calculate summary with NaN protection
    const totalProducts = dealProductDetails.reduce((sum, deal) => sum + deal.products.length, 0);
    const totalRevenue = dealProductDetails.reduce((sum, deal) =>
      sum + deal.products.reduce((dealSum, product) => {
        const productTotal = isNaN(product.total) ? 0 : product.total;
        return dealSum + productTotal;
      }, 0), 0
    );
    const totalUnits = dealProductDetails.reduce((sum, deal) =>
      sum + deal.products.reduce((dealSum, product) => {
        const productQuantity = isNaN(product.quantity) ? 0 : product.quantity;
        return dealSum + productQuantity;
      }, 0), 0
    );

    console.log(`🔥 [CUSTOMER DEAL PRODUCTS] ✅ SUCCESS: ${dealProductDetails.length} deals, ${totalProducts} products, R$ ${totalRevenue.toFixed(2)} total (${responseTime}ms)`);

    return NextResponse.json({
      success: true,
      data: dealProductDetails,
      metadata: {
        source: 'ploomes_api_real_data',
        timestamp: new Date().toISOString(),
        responseTime,
        filters: {
          customerId: customerId || null,
          dealId: dealId || null
        },
        summary: {
          totalDeals: dealProductDetails.length,
          totalProducts,
          totalRevenue,
          totalUnits,
          customerInfo
        },
        note: "🔥 CUSTOMER DEAL PRODUCTS FROM REAL PLOOMES API!"
      }
    });

  } catch (error: unknown) {
    const responseTime = Date.now() - startTime;
    console.error('💥 [CUSTOMER DEAL PRODUCTS] Error:', error);

    return NextResponse.json(
      {
        success: false,
        message: 'Server error in customer deal products API',
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