import { NextRequest, NextResponse } from "next/server";
import { createClient } from '@supabase/supabase-js';
import https from 'https';

interface Deal {
  Id: number;
  ContactId?: number;
  Amount?: number;
  LastUpdateDate?: string;
  Title?: string;
  StageId?: number;
  Products?: Array<{
    ProductId?: number;
    Quantity?: number;
    Price?: number;
  }>;
  Win?: boolean;
  Lose?: boolean;
}

interface SupabaseCustomer {
  id: number;
  name: string;
  cnpj: string | null;
  cpf: string | null;
}

// Helper to make HTTPS requests with native Node.js (bypassing Next.js fetch)
function httpsGet(url: string, headers: Record<string, string>): Promise<any> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const options = {
      hostname: parsedUrl.hostname,
      port: 443,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers
    };

    console.log(`🔧 [HTTPS] Requesting: ${parsedUrl.hostname}${parsedUrl.pathname}${parsedUrl.search}`);
    console.log(`🔧 [HTTPS] Headers:`, headers);

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        console.log(`🔧 [HTTPS] Response status: ${res.statusCode}`);
        console.log(`🔧 [HTTPS] Response headers:`, res.headers);
        console.log(`🔧 [HTTPS] Response body length: ${data.length}`);

        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const parsed = JSON.parse(data);
            resolve({ ok: true, status: res.statusCode, data: parsed });
          } catch (err) {
            console.error(`🔧 [HTTPS] Failed to parse JSON:`, err);
            reject({ ok: false, status: res.statusCode, error: 'JSON parse error', rawData: data.substring(0, 200) });
          }
        } else {
          console.error(`🔧 [HTTPS] HTTP error: ${res.statusCode}`);
          console.error(`🔧 [HTTPS] Response body:`, data.substring(0, 500));
          reject({ ok: false, status: res.statusCode, data });
        }
      });
    });

    req.on('error', (error) => {
      console.error(`🔧 [HTTPS] Request error:`, error);
      reject({ ok: false, error: error.message });
    });

    req.end();
  });
}

/**
 * CRON Job: Sync Customer Sales Data
 *
 * This endpoint aggregates sales data from Ploomes and stores it in Supabase
 * for fast dashboard queries. Should be called every 6 hours via Vercel Cron.
 *
 * Vercel Cron: https://vercel.com/docs/cron-jobs
 * Schedule: "0 star-slash-6 star star star" (every 6 hours)
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Verify CRON secret to prevent unauthorized access
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET || 'dev-secret-change-in-production';

    if (authHeader !== `Bearer ${cronSecret}`) {
      console.error('🚫 [CRON] Unauthorized access attempt');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('🔄 [CRON] Starting customer sales sync...');

    // Initialize Supabase - use anon key since service role key from vercel.json is invalid
    const SUPABASE_URL = 'https://yxwokryybudwygtemfmu.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4d29rcnl5YnVkd3lndGVtZm11Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3NDE2ODEsImV4cCI6MjA3NDMxNzY4MX0.ALgRRp1FivPIQ7TltZF7HPDS2d12RNAxTnc_BfRmJUg';

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // STEP 1: Get ALL customers from Supabase
    console.log('📊 [STEP 1] Fetching customers from Supabase...');
    const { data: customers, error: customersError } = await supabase
      .from('customers')
      .select('id, name, cnpj, cpf');

    if (customersError) {
      throw new Error(`Supabase error: ${customersError.message}`);
    }

    console.log(`✅ [STEP 1] Fetched ${customers?.length || 0} customers`);

    // STEP 2: Fetch ALL deals from Ploomes
    console.log('📦 [STEP 2] Fetching deals from Ploomes...');

    const PLOOMES_API_KEY = process.env.PLOOMES_API_KEY || process.env.NEXT_PUBLIC_PLOOMES_API_KEY;
    const PLOOMES_BASE_URL = 'https://public-api2.ploomes.com';

    console.log(`🔑 API Key present: ${PLOOMES_API_KEY ? 'YES (length: ' + PLOOMES_API_KEY.length + ')' : 'NO'}`);
    console.log(`🔑 API Key first 20 chars: ${PLOOMES_API_KEY?.substring(0, 20)}...`);
    console.log(`🔑 API Key last 10 chars: ...${PLOOMES_API_KEY?.substring(PLOOMES_API_KEY.length - 10)}`);

    if (!PLOOMES_API_KEY) {
      throw new Error('Missing PLOOMES_API_KEY');
    }

    const allDeals: Deal[] = [];
    let skip = 0;
    const PAGE_SIZE = 50; // Reduzido para 50 (bem conservador)
    const MAX_PAGES = 200; // Fetch ALL deals (up to 10k)
    const DELAY_BETWEEN_REQUESTS = 1000; // 1 segundo = 60 req/min (METADE do limite de 120/min)

    // Helper para aguardar entre requisições (rate limit: 120 req/min)
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    // Aguardar 2 segundos antes de começar (dar tempo para rate limit resetar)
    console.log('⏳ Aguardando 2s para respeitar rate limit...');
    await delay(2000);

    for (let page = 0; page < MAX_PAGES; page++) {
      const url = `${PLOOMES_BASE_URL}/Deals?$select=Id,ContactId,Amount,LastUpdateDate,Title,StageId,Products,Win,Lose&$top=${PAGE_SIZE}&$skip=${skip}`;

      console.log(`🌐 Requesting URL: ${url}`);

      try {
        // Use native Node.js HTTPS instead of Next.js fetch to avoid polyfill issues
        const response = await httpsGet(url, {
          'User-Key': PLOOMES_API_KEY,
          'Content-Type': 'application/json'
        });

        console.log(`📥 Response status: ${response.status}`);
        console.log(`✅ Response OK: ${response.ok}`);

        const deals = response.data.value || [];
        if (deals.length === 0) break;

        allDeals.push(...deals);
        console.log(`   ✅ Page ${page + 1}: ${allDeals.length} deals total`);

        if (deals.length < PAGE_SIZE) break;
        skip += PAGE_SIZE;

        // CRITICAL: Aguardar para respeitar rate limit (120 req/min)
        if (page < MAX_PAGES - 1) {
          await delay(DELAY_BETWEEN_REQUESTS);
        }
      } catch (error) {
        console.error(`❌ Request error:`, error);
        throw error;
      }
    }

    console.log(`✅ [STEP 2] Fetched ${allDeals.length} deals`);

    // STEP 3: Aggregate sales by customer
    console.log('🔄 [STEP 3] Aggregating sales data...');

    const salesByCustomer = new Map<number, {
      totalSales: number;
      totalDeals: number;
      wonDeals: number;
      openDeals: number;
      lostDeals: number;
      totalRevenue: number;
      firstPurchaseDate: string | null;
      lastPurchaseDate: string | null;
      productsPurchased: Set<number>;
    }>();

    for (const deal of allDeals) {
      if (!deal.ContactId) continue;

      const contactId = deal.ContactId;
      const date = deal.LastUpdateDate || new Date().toISOString();
      const amount = deal.Amount || 0;
      const isWon = deal.Win === true;
      const isLost = deal.Lose === true;
      const isOpen = !isWon && !isLost;

      const existing = salesByCustomer.get(contactId);

      if (existing) {
        existing.totalDeals += 1;
        if (isWon) {
          existing.wonDeals += 1;
          existing.totalSales += amount;
          existing.totalRevenue += amount;
        }
        if (isLost) existing.lostDeals += 1;
        if (isOpen) existing.openDeals += 1;

        if (!existing.firstPurchaseDate || date < existing.firstPurchaseDate) {
          existing.firstPurchaseDate = date;
        }
        if (!existing.lastPurchaseDate || date > existing.lastPurchaseDate) {
          existing.lastPurchaseDate = date;
        }

        // Track products
        if (deal.Products && Array.isArray(deal.Products)) {
          deal.Products.forEach(p => {
            if (p.ProductId) existing.productsPurchased.add(p.ProductId);
          });
        }
      } else {
        salesByCustomer.set(contactId, {
          totalSales: isWon ? amount : 0,
          totalDeals: 1,
          wonDeals: isWon ? 1 : 0,
          openDeals: isOpen ? 1 : 0,
          lostDeals: isLost ? 1 : 0,
          totalRevenue: isWon ? amount : 0,
          firstPurchaseDate: date,
          lastPurchaseDate: date,
          productsPurchased: new Set(
            deal.Products?.map(p => p.ProductId).filter(Boolean) as number[] || []
          ),
        });
      }
    }

    console.log(`✅ [STEP 3] Aggregated ${salesByCustomer.size} customers with sales`);

    // STEP 4: Prepare data for upsert
    console.log('💾 [STEP 4] Preparing data for database...');

    const customerSalesData = (customers || [])
      .map((customer: SupabaseCustomer) => {
        const sales = salesByCustomer.get(customer.id);

        if (!sales) return null; // Skip customers without sales

        const daysSinceLastPurchase = sales.lastPurchaseDate
          ? Math.floor((Date.now() - new Date(sales.lastPurchaseDate).getTime()) / (1000 * 60 * 60 * 24))
          : null;

        const productsArray = Array.from(sales.productsPurchased);

        return {
          customer_id: customer.id,
          customer_name: customer.name || 'Unknown',
          customer_cnpj: customer.cnpj || customer.cpf || null,
          total_sales: sales.totalSales,
          total_deals: sales.totalDeals,
          won_deals: sales.wonDeals,
          open_deals: sales.openDeals,
          lost_deals: sales.lostDeals,
          total_revenue: sales.totalRevenue,
          average_deal_value: sales.wonDeals > 0 ? sales.totalRevenue / sales.wonDeals : 0,
          products_purchased: productsArray,
          total_products: productsArray.length,
          first_purchase_date: sales.firstPurchaseDate,
          last_purchase_date: sales.lastPurchaseDate,
          days_since_last_purchase: daysSinceLastPurchase,
          has_custom_pricing: false, // Will be updated by pricing sync
          pricing_history_count: 0, // Will be updated by pricing sync
        };
      })
      .filter(item => item !== null);

    console.log(`✅ [STEP 4] Prepared ${customerSalesData.length} records`);

    // STEP 5: Upsert to Supabase (batch upsert for performance)
    console.log('💾 [STEP 5] Upserting to Supabase...');

    const BATCH_SIZE = 500;
    let totalUpserted = 0;

    for (let i = 0; i < customerSalesData.length; i += BATCH_SIZE) {
      const batch = customerSalesData.slice(i, i + BATCH_SIZE);

      const { error: upsertError } = await supabase
        .from('customer_sales')
        .upsert(batch, {
          onConflict: 'customer_id',
          ignoreDuplicates: false,
        });

      if (upsertError) {
        console.error(`⚠️ Batch ${Math.floor(i / BATCH_SIZE) + 1} error:`, upsertError);
        throw new Error(`Upsert error: ${upsertError.message}`);
      }

      totalUpserted += batch.length;
      console.log(`   ✅ Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${totalUpserted}/${customerSalesData.length} records`);
    }

    const totalTime = Date.now() - startTime;
    console.log(`🎉 [SUCCESS] Sync completed in ${totalTime}ms`);
    console.log(`   📊 Total customers synced: ${totalUpserted}`);
    console.log(`   📦 Total deals processed: ${allDeals.length}`);

    return NextResponse.json({
      success: true,
      message: 'Customer sales data synced successfully',
      stats: {
        customersProcessed: customers?.length || 0,
        dealsProcessed: allDeals.length,
        customersSynced: totalUpserted,
        customersWithSales: salesByCustomer.size,
        executionTime: totalTime,
        timestamp: new Date().toISOString(),
      },
    });

  } catch (error: unknown) {
    const errorTime = Date.now() - startTime;
    console.error(`💥 [ERROR] Sync failed after ${errorTime}ms:`, error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime: errorTime,
      },
      { status: 500 }
    );
  }
}

// Configure for Edge Runtime (optional, for faster cold starts)
export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes max execution time (Vercel Pro)
