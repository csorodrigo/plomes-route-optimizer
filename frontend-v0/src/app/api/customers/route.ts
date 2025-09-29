import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env.server";
import { getSupabaseClient, hasSupabase } from '@/lib/supabase';
import https from 'https';
import http from 'http';
import type { Customer, PloomeResponse } from "@/types/api";

interface PloomeContact {
  Id: number;
  Name: string;
  Email?: string;
  Phones?: Array<{ PhoneNumber: string }>;
  StreetAddress?: string;
  StreetAddressNumber?: string;
  StreetAddressLine2?: string;
  Neighborhood?: string;
  ZipCode?: string | number;
  City?: { Name: string };
  CreateDate?: string;
  LastInteractionDate?: string;
}

interface HttpRequestOptions {
  method?: string;
  headers?: Record<string, string>;
  timeout?: number;
  body?: string;
}

interface HttpResponse {
  ok: boolean;
  status: number;
  statusText: string;
  json: () => Promise<unknown>;
  text: () => Promise<string>;
}

// HTTP request utility for serverless compatibility
function makeHttpRequest(url: string, options: HttpRequestOptions = {}): Promise<HttpResponse> {
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
      timeout: options.timeout || 15000
    };

    const req = client.request(reqOptions, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        resolve({
          ok: (res.statusCode ?? 500) >= 200 && (res.statusCode ?? 500) < 300,
          status: res.statusCode ?? 500,
          statusText: res.statusMessage ?? 'Unknown Error',
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

export async function GET(request: NextRequest) {
  try {
    console.log('🚨 Next.js API Route - Customers API called');

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const page = parseInt(searchParams.get('page') || '0');
    const limit = parseInt(searchParams.get('limit') || '25');
    const geocodedOnly = searchParams.get('geocoded_only') === 'true';

    // Try to get customers from Supabase first
    if (hasSupabase()) {
      try {
        console.log('[CUSTOMERS API] Checking Supabase PostgreSQL for customers...');

        const supabase = getSupabaseClient();
        if (!supabase) {
          throw new Error('Failed to initialize Supabase client');
        }

        let query = supabase
          .from('customers')
          .select('*', { count: 'exact' });

      // Apply search filter
      if (search) {
        query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,address.ilike.%${search}%`);
      }

      // Apply geocoding filter
      if (geocodedOnly) {
        query = query.not('latitude', 'is', null).not('longitude', 'is', null);
      }

      // Apply pagination
      const from = page * limit;
      const to = from + limit - 1;
      query = query.range(from, to);

      const { data: customers, error, count } = await query;

      if (error) {
        console.error('[CUSTOMERS API] Supabase error:', error);
        throw error;
      }

      if (customers && customers.length > 0) {
        console.log(`[CUSTOMERS API] ✅ Found ${customers.length} customers in Supabase`);

        return NextResponse.json({
          success: true,
          data: customers,
          customers: customers, // Backward compatibility
          pagination: {
            page: page,
            limit: limit,
            total: count || 0,
            totalPages: Math.ceil((count || 0) / limit),
            hasNext: (page + 1) * limit < (count || 0),
            hasPrev: page > 0
          },
          total: customers.length,
          metadata: {
            source: 'supabase_postgresql',
            timestamp: new Date().toISOString(),
            filters: {
              search: search || null,
              geocoded_only: geocodedOnly
            }
          }
        });
        }

        console.log('[CUSTOMERS API] No data in Supabase, falling back to Ploome...');
      } catch (storageError) {
        console.error('[CUSTOMERS API] Supabase error, falling back to Ploome:', storageError);
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

    // Fetch from Ploome API
    const ploomeUrl = `${PLOOME_BASE_URL}/Contacts?$top=1000&$expand=City,Tags&$filter=Tags/any(t: t/TagId eq ${CLIENT_TAG_ID})`;

    console.log('🔄 Fetching from Ploome API...');

    const ploomeResponse = await makeHttpRequest(ploomeUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Key': PLOOME_API_KEY
      },
      timeout: 12000
    });

    if (!ploomeResponse.ok) {
      const errorText = await ploomeResponse.text().catch(() => 'No error details');
      console.error('❌ Ploome API error:', ploomeResponse.status, errorText);
      return NextResponse.json(
        {
          success: false,
          message: `Ploome API error: ${ploomeResponse.status}`,
          details: errorText
        },
        { status: 500 }
      );
    }

    const ploomeData = await ploomeResponse.json() as PloomeResponse;
    const contacts = ploomeData.value || [];

    // Transform Ploome data
    const customers: Customer[] = contacts.map((contact: PloomeContact) => {
      let address = '';
      let cep = '';
      let city = '';

      // Build address from contact fields
      address = contact.StreetAddress || '';
      cep = contact.ZipCode ? contact.ZipCode.toString().replace(/\D/g, '') : '';
      city = contact.City ? contact.City.Name : '';

      if (contact.StreetAddressNumber) {
        address += `, ${contact.StreetAddressNumber}`;
      }
      if (contact.StreetAddressLine2) {
        address += `, ${contact.StreetAddressLine2}`;
      }
      if (contact.Neighborhood) {
        address += `, ${contact.Neighborhood}`;
      }
      if (city) {
        address += `, ${city}`;
      }

      return {
        id: contact.Id.toString(),
        name: contact.Name || 'Nome não informado',
        email: contact.Email || '',
        phone: contact.Phones && contact.Phones.length > 0 ? contact.Phones[0].PhoneNumber : '',
        address: address,
        cep: cep,
        city: city,
        state: '',
        latitude: undefined,
        longitude: undefined,
        ploome_person_id: contact.Id.toString(),
        created_date: contact.CreateDate,
        last_interaction: contact.LastInteractionDate
      };
    });

    // Apply search filter to transformed data
    let filteredCustomers = customers;
    if (search) {
      const searchLower = search.toLowerCase();
      filteredCustomers = customers.filter(customer =>
        customer.name.toLowerCase().includes(searchLower) ||
        customer.email?.toLowerCase().includes(searchLower) ||
        customer.address?.toLowerCase().includes(searchLower)
      );
    }

    // Apply geocoding filter
    if (geocodedOnly) {
      filteredCustomers = filteredCustomers.filter(customer =>
        customer.latitude !== null && customer.longitude !== null
      );
    }

    // Apply pagination
    const startIndex = page * limit;
    const paginatedCustomers = filteredCustomers.slice(startIndex, startIndex + limit);

    console.log(`✅ Successfully processed ${paginatedCustomers.length} customers from Ploome`);

    return NextResponse.json({
      success: true,
      customers: paginatedCustomers,
      data: paginatedCustomers,
      total: paginatedCustomers.length,
      pagination: {
        page: page,
        limit: limit,
        total: filteredCustomers.length,
        totalPages: Math.ceil(filteredCustomers.length / limit),
        hasNext: (page + 1) * limit < filteredCustomers.length,
        hasPrev: page > 0
      },
      source: 'ploome_api_real_data',
      metadata: {
        total_in_ploome: contacts.length,
        filtered_by_client_tag: CLIENT_TAG_ID,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error: unknown) {
    console.error('💥 Customers API error:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Server error in customers API',
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