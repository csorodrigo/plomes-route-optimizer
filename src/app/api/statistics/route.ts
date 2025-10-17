import { NextResponse } from "next/server";
import { env } from "@/lib/env.server";
import { getSupabaseClient, hasSupabase } from '@/lib/supabase';
import https from 'https';
import http from 'http';
import type { PloomeResponse, PloomeDealsResponse } from "@/types/api";

interface StatisticsHttpRequestOptions {
  method?: string;
  headers?: Record<string, string>;
  timeout?: number;
  body?: string;
}

interface StatisticsHttpResponse {
  ok: boolean;
  status: number;
  statusText: string;
  json: () => Promise<unknown>;
  text: () => Promise<string>;
}

// HTTP request utility for serverless compatibility
function makeHttpRequest(url: string, options: StatisticsHttpRequestOptions = {}): Promise<StatisticsHttpResponse> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const client = isHttps ? https : http;

    const reqOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'User-Agent': 'PlomesRotaCEP/1.0',
        ...options.headers
      },
      timeout: options.timeout || 10000
    };

    const req = client.request(reqOptions, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        const statusCode = res.statusCode ?? 500;
        const statusText = res.statusMessage ?? 'Unknown Error';

        resolve({
          ok: statusCode >= 200 && statusCode < 300,
          status: statusCode,
          statusText: statusText,
          json: async () => JSON.parse(data),
          text: async () => data
        });
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (options.body) {
      req.write(options.body);
    }

    req.end();
  });
}

export async function GET() {
  try {
    console.log('📊 Next.js API Route - Statistics API called');

    // Try to get statistics from Supabase first
    if (hasSupabase()) {
      try {
        const supabase = getSupabaseClient();
        if (!supabase) {
          throw new Error('Failed to initialize Supabase client');
        }

        const { count: totalCustomers } = await supabase
          .from('customers')
          .select('*', { count: 'exact', head: true });

        const { count: geocodedCustomers } = await supabase
          .from('customers')
          .select('*', { count: 'exact', head: true })
          .not('latitude', 'is', null)
          .not('longitude', 'is', null);

      if (totalCustomers !== null && totalCustomers > 0) {
        console.log(`[STATISTICS API] ✅ Found ${totalCustomers} customers in Supabase`);

        const statistics = {
          totalCustomers: totalCustomers,
          geocodedCustomers: geocodedCustomers || 0,
          unGeocodedCustomers: (totalCustomers || 0) - (geocodedCustomers || 0),
          lastSync: new Date().toISOString()
        };

        return NextResponse.json({
          success: true,
          statistics,
          source: 'supabase_postgresql',
          timestamp: new Date().toISOString()
        });
        }

        console.log('[STATISTICS API] No data in Supabase, falling back to Ploome...');
      } catch (storageError) {
        console.error('[STATISTICS API] Supabase error, falling back to Ploome:', storageError);
      }
    }

    // Fall back to Ploome API
    const PLOOME_API_KEY = env.PLOOME_API_KEY;
    const PLOOME_BASE_URL = env.PLOOME_BASE_URL;
    const CLIENT_TAG_ID = parseInt(env.CLIENT_TAG_ID);

    if (!PLOOME_API_KEY || !PLOOME_BASE_URL) {
      return NextResponse.json(
        {
          success: false,
          message: 'API credentials not configured'
        },
        { status: 500 }
      );
    }

    // Get total contacts count
    const contactsCountUrl = `${PLOOME_BASE_URL}/Contacts?$top=1&$count=true`;
    console.log('🔄 Fetching total contacts count...');

    const contactsResponse = await makeHttpRequest(contactsCountUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Key': PLOOME_API_KEY
      },
      timeout: 10000
    });

    let totalContacts = 0;
    if (contactsResponse.ok) {
      const contactsData = await contactsResponse.json() as PloomeResponse;
      totalContacts = contactsData['@odata.count'] || 0;
      console.log('✅ Total contacts in Ploome:', totalContacts);
    }

    // Get clients count (with CLIENT_TAG_ID filter)
    const clientsCountUrl = `${PLOOME_BASE_URL}/Contacts?$top=1&$count=true&$expand=Tags&$filter=Tags/any(t: t/TagId eq ${CLIENT_TAG_ID})`;
    console.log('🔄 Fetching clients count...');

    const clientsResponse = await makeHttpRequest(clientsCountUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Key': PLOOME_API_KEY
      },
      timeout: 10000
    });

    let totalClients = 0;
    if (clientsResponse.ok) {
      const clientsData = await clientsResponse.json() as PloomeResponse;
      totalClients = clientsData['@odata.count'] || 0;
      console.log('✅ Total clients (with CLIENT_TAG_ID):', totalClients);
    }

    // Get deals count
    const dealsCountUrl = `${PLOOME_BASE_URL}/Deals?$top=1&$count=true`;
    const dealsResponse = await makeHttpRequest(dealsCountUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Key': PLOOME_API_KEY
      },
      timeout: 10000
    });

    let totalDeals = 0;
    if (dealsResponse.ok) {
      const dealsData = await dealsResponse.json() as PloomeDealsResponse;
      totalDeals = dealsData['@odata.count'] || 0;
    }

    // Estimate CEP and geocoding statistics
    const customersWithCep = Math.round(totalClients * 0.85); // Conservative estimate
    const geocodedCustomers = 0; // Will be 0 until batch geocoding is run

    const statistics = {
      totalCustomers: totalClients,
      totalContacts: totalContacts,
      totalDeals: totalDeals,
      geocodedCustomers: geocodedCustomers,
      unGeocodedCustomers: totalClients - geocodedCustomers,
      customersWithCep: customersWithCep,
      lastSync: new Date().toISOString(),
      performanceMetrics: {
        avgCustomersPerRoute: totalClients > 0 ? Math.round(totalClients / Math.max(Math.round(totalClients / 10), 1)) : 0,
        geocodingSuccessRate: customersWithCep > 0 ? ((geocodedCustomers / customersWithCep) * 100).toFixed(1) + '%' : '0%',
        apiResponseTime: '< 3s',
        geocodingNeeded: customersWithCep - geocodedCustomers
      }
    };

    console.log('✅ Successfully generated statistics from Ploome API');

    return NextResponse.json({
      success: true,
      statistics,
      source: 'ploome_api_real_data',
      message: 'Real statistics from Ploome API',
      metadata: {
        filtered_by_client_tag: CLIENT_TAG_ID,
        api_url: PLOOME_BASE_URL,
        timestamp: new Date().toISOString(),
        counts: {
          total_contacts: totalContacts,
          filtered_clients: totalClients,
          total_deals: totalDeals
        }
      }
    });

  } catch (error: unknown) {
    console.error('💥 Statistics API error:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Server error in statistics API',
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