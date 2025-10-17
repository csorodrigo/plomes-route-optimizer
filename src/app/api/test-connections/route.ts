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

  // Test 1: Supabase Connection - Test both keys
  console.log('🧪 Testing Supabase connection...');
  console.log('🔧 Supabase URL:', env.SUPABASE_URL ? `${env.SUPABASE_URL.substring(0, 20)}...` : 'MISSING');
  console.log('🔧 Service Key:', env.SUPABASE_SERVICE_ROLE_KEY ? `${env.SUPABASE_SERVICE_ROLE_KEY.substring(0, 20)}...` : 'MISSING');
  console.log('🔧 Anon Key:', env.SUPABASE_ANON_KEY ? `${env.SUPABASE_ANON_KEY.substring(0, 20)}...` : 'MISSING');

  try {
    if (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
      // Import Supabase client directly
      const { createClient } = await import('@supabase/supabase-js');

      // Test with SERVICE_ROLE_KEY first
      console.log('🔍 Testing with SERVICE_ROLE_KEY...');
      const supabaseService = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

      const { data: serviceData, error: serviceError } = await supabaseService
        .from('customers')
        .select('count(*)', { count: 'exact', head: true });

      if (serviceError) {
        console.log('❌ Service key failed:', serviceError);

        // Try with ANON_KEY
        if (env.SUPABASE_ANON_KEY) {
          console.log('🔍 Trying with ANON_KEY...');
          const supabaseAnon = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);

          const { data: anonData, error: anonError } = await supabaseAnon
            .from('customers')
            .select('count(*)', { count: 'exact', head: true });

          if (anonError) {
            console.log('❌ Anon key also failed:', anonError);
          } else {
            console.log('✅ Anon key worked!', anonData);
          }
        }
      } else {
        console.log('✅ Service key worked!', serviceData);
      }

      const { data, error } = serviceData && !serviceError ?
        { data: serviceData, error: serviceError } :
        { data: null, error: serviceError || new Error('Both keys failed') };

      if (error) {
        results.tests.supabase = {
          status: 'error',
          error: error.message || 'Unknown Supabase error',
          code: error.code || 'NO_CODE',
          hint: error.hint || 'No hint available',
          details: error.details || 'Query failed',
          rawError: JSON.stringify(error, null, 2),
          errorType: typeof error,
          errorKeys: Object.keys(error || {})
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
        error: 'Missing Supabase configuration',
        details: 'Environment variables not set'
      };
    }
  } catch (supabaseError) {
    results.tests.supabase = {
      status: 'error',
      error: supabaseError instanceof Error ? supabaseError.message : 'Unknown error',
      details: 'Exception during test',
      exceptionType: typeof supabaseError,
      exceptionString: String(supabaseError),
      stackTrace: supabaseError instanceof Error ? supabaseError.stack : 'No stack trace'
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