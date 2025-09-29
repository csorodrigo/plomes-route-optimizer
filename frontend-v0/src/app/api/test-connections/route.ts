import { NextResponse } from "next/server";
import { env } from "@/lib/env.server";
import { getSupabaseClient, hasSupabase } from '@/lib/supabase';
import https from 'https';

export async function GET() {
  const results = {
    timestamp: new Date().toISOString(),
    environment: {
      NODE_ENV: env.NODE_ENV,
      hasSupabaseConfig: hasSupabase(),
      hasPloomeConfig: !!(env.PLOOME_API_KEY && env.PLOOME_BASE_URL),
      hasJWTSecret: !!env.JWT_SECRET
    },
    tests: {} as Record<string, unknown>
  };

  // Test 1: Supabase Connection
  console.log('🧪 Testing Supabase connection...');
  try {
    if (hasSupabase()) {
      const supabase = getSupabaseClient();
      if (supabase) {
        // Try a simple query
        const { data, error } = await supabase
          .from('customers')
          .select('count(*)', { count: 'exact', head: true });

        if (error) {
          results.tests.supabase = {
            status: 'error',
            error: error.message,
            details: 'Query failed'
          };
        } else {
          results.tests.supabase = {
            status: 'success',
            count: data || 0,
            details: 'Connection successful'
          };
        }
      } else {
        results.tests.supabase = {
          status: 'error',
          error: 'Failed to create Supabase client',
          details: 'Client initialization failed'
        };
      }
    } else {
      results.tests.supabase = {
        status: 'error',
        error: 'Missing Supabase configuration',
        details: 'Environment variables not set'
      };
    }
  } catch (supabaseError) {
    results.tests.supabase = {
      status: 'error',
      error: supabaseError instanceof Error ? supabaseError.message : 'Unknown error',
      details: 'Exception during test'
    };
  }

  // Test 2: Ploomes API Connection
  console.log('🧪 Testing Ploomes API connection...');
  try {
    if (env.PLOOME_API_KEY && env.PLOOME_BASE_URL) {

      const response = await new Promise<{ok: boolean, status: number, data: Record<string, unknown>}>((resolve, reject) => {
        const options = {
          hostname: 'public-api2.ploomes.com',
          path: '/Contacts?$top=1&$select=Id,Name',
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Key': env.PLOOME_API_KEY
          },
          timeout: 10000
        };

        const req = https.request(options, (res) => {
          let data = '';
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => {
            try {
              const parsed = JSON.parse(data);
              resolve({
                ok: (res.statusCode || 500) >= 200 && (res.statusCode || 500) < 300,
                status: res.statusCode || 500,
                data: parsed
              });
            } catch {
              resolve({
                ok: false,
                status: res.statusCode || 500,
                data: { error: 'Failed to parse response', raw: data } as Record<string, unknown>
              });
            }
          });
        });

        req.on('error', (error) => reject(error));
        req.on('timeout', () => {
          req.destroy();
          reject(new Error('Request timeout'));
        });
        req.end();
      });

      if (response.ok) {
        results.tests.ploomes = {
          status: 'success',
          details: 'API connection successful',
          sampleData: response.data.value ? (response.data.value as unknown[]).length : 0
        };
      } else {
        results.tests.ploomes = {
          status: 'error',
          error: `HTTP ${response.status}`,
          details: response.data
        };
      }
    } else {
      results.tests.ploomes = {
        status: 'error',
        error: 'Missing Ploomes API configuration',
        details: {
          hasApiKey: !!env.PLOOME_API_KEY,
          hasBaseUrl: !!env.PLOOME_BASE_URL,
          hasClientTag: !!env.CLIENT_TAG_ID
        }
      };
    }
  } catch (ploomeError) {
    results.tests.ploomes = {
      status: 'error',
      error: ploomeError instanceof Error ? ploomeError.message : 'Unknown error',
      details: 'Exception during test'
    };
  }

  // Test 3: Environment Variables Check
  results.tests.environment = {
    variables: {
      SUPABASE_URL: !!env.SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: !!env.SUPABASE_SERVICE_ROLE_KEY,
      PLOOME_API_KEY: !!env.PLOOME_API_KEY,
      PLOOME_BASE_URL: !!env.PLOOME_BASE_URL,
      CLIENT_TAG_ID: !!env.CLIENT_TAG_ID,
      JWT_SECRET: !!env.JWT_SECRET,
      GOOGLE_MAPS_API_KEY: !!env.GOOGLE_MAPS_API_KEY
    }
  };

  console.log('🧪 Test results:', JSON.stringify(results, null, 2));

  return NextResponse.json(results);
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