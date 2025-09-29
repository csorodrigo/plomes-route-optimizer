import { NextResponse } from "next/server";
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  const results = {
    timestamp: new Date().toISOString(),
    tests: {} as Record<string, unknown>
  };

  // Get environment variables directly
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  console.log('🔧 Direct test - URL exists:', !!supabaseUrl);
  console.log('🔧 Direct test - Service key exists:', !!supabaseServiceKey);
  console.log('🔧 Direct test - Anon key exists:', !!supabaseAnonKey);

  if (!supabaseUrl) {
    results.tests.direct = { status: 'error', error: 'No SUPABASE_URL' };
    return NextResponse.json(results);
  }

  // Test 1: Try with Service Role Key
  if (supabaseServiceKey) {
    try {
      console.log('🔍 Testing with service role key...');
      const supabaseService = createClient(supabaseUrl, supabaseServiceKey);

      // Try simplest possible query
      const { data, error } = await supabaseService
        .from('customers')
        .select('id')
        .limit(1);

      console.log('Service key result:', { data, error });

      results.tests.service_key = {
        status: error ? 'error' : 'success',
        error: error?.message || null,
        errorCode: error?.code || null,
        dataCount: data ? data.length : 0,
        rawError: error ? JSON.stringify(error, null, 2) : null
      };

    } catch (err) {
      console.log('Service key exception:', err);
      results.tests.service_key = {
        status: 'exception',
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : null
      };
    }
  }

  // Test 2: Try with Anon Key
  if (supabaseAnonKey) {
    try {
      console.log('🔍 Testing with anon key...');
      const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey);

      // Test if we can get all customers with coordinates
      const { data, error } = await supabaseAnon
        .from('customers')
        .select('id, name, latitude, longitude')
        .not('latitude', 'is', null)
        .not('longitude', 'is', null)
        .limit(10);

      console.log('Anon key result:', { data, error });

      results.tests.anon_key = {
        status: error ? 'error' : 'success',
        error: error?.message || null,
        errorCode: error?.code || null,
        dataCount: data ? data.length : 0,
        rawError: error ? JSON.stringify(error, null, 2) : null
      };

    } catch (err) {
      console.log('Anon key exception:', err);
      results.tests.anon_key = {
        status: 'exception',
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : null
      };
    }
  }

  // Test 3: Simple ping test
  try {
    console.log('🔍 Testing basic connectivity...');
    const response = await fetch(`${supabaseUrl}/rest/v1/`, {
      headers: {
        'apikey': supabaseServiceKey || supabaseAnonKey || '',
        'Authorization': `Bearer ${supabaseServiceKey || supabaseAnonKey || ''}`
      }
    });

    console.log('Fetch test result:', response.status, response.statusText);

    results.tests.direct_fetch = {
      status: response.ok ? 'success' : 'error',
      httpStatus: response.status,
      statusText: response.statusText
    };

  } catch (err) {
    console.log('Fetch test exception:', err);
    results.tests.direct_fetch = {
      status: 'exception',
      error: err instanceof Error ? err.message : String(err)
    };
  }

  console.log('🧪 Final test results:', JSON.stringify(results, null, 2));

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