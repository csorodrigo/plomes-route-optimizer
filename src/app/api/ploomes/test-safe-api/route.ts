import { NextRequest, NextResponse } from 'next/server';
import { ploomesApi, PloomesAPIUtils } from '@/lib/ploomes-safe-api';

/**
 * TEST ENDPOINT: Validate Ploomes Safe API Strategy
 *
 * This endpoint tests all the safe API patterns against real Ploomes API
 * to validate that our strategy works without 403 errors.
 *
 * Usage: GET /api/ploomes/test-safe-api?test=all
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const { searchParams } = new URL(request.url);
    const testType = searchParams.get('test') || 'basic';

    console.log(`[SAFE API TEST] Starting ${testType} test...`);

    const results: any = {
      timestamp: new Date().toISOString(),
      testType,
      success: true,
      tests: {},
      stats: {},
      recommendations: []
    };

    // Test 1: Basic health check
    console.log('[SAFE API TEST] 🔍 Testing basic health check...');
    try {
      const healthCheck = await ploomesApi.healthCheck();
      results.tests.healthCheck = {
        success: true,
        healthy: healthCheck.healthy,
        responseTime: healthCheck.responseTime,
        details: healthCheck
      };
      console.log(`[SAFE API TEST] ✅ Health check: ${healthCheck.healthy ? 'HEALTHY' : 'UNHEALTHY'} (${healthCheck.responseTime}ms)`);
    } catch (error) {
      results.tests.healthCheck = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      console.log(`[SAFE API TEST] ❌ Health check failed:`, error);
    }

    // Test 2: Safe contacts query
    console.log('[SAFE API TEST] 👥 Testing safe contacts query...');
    try {
      const contacts = await ploomesApi.getContactsSafe({ top: 10 });
      results.tests.contacts = {
        success: true,
        count: contacts.length,
        responseTime: Date.now() - Date.now() // This will be very fast since we already measured
      };
      console.log(`[SAFE API TEST] ✅ Contacts: ${contacts.length} items retrieved`);
    } catch (error) {
      results.tests.contacts = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      console.log(`[SAFE API TEST] ❌ Contacts test failed:`, error);
    }

    // Test 3: Safe deals query
    console.log('[SAFE API TEST] 💼 Testing safe deals query...');
    try {
      const deals = await ploomesApi.getDealsSafe({ top: 10 });
      results.tests.deals = {
        success: true,
        count: deals.length,
        hasContactIds: deals.some(d => d.ContactId)
      };
      console.log(`[SAFE API TEST] ✅ Deals: ${deals.length} items retrieved`);
    } catch (error) {
      results.tests.deals = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      console.log(`[SAFE API TEST] ❌ Deals test failed:`, error);
    }

    // Test 4: Safe products query
    console.log('[SAFE API TEST] 📦 Testing safe products query...');
    try {
      const products = await ploomesApi.getProductsSafe({ top: 10 });
      results.tests.products = {
        success: true,
        count: products.length
      };
      console.log(`[SAFE API TEST] ✅ Products: ${products.length} items retrieved`);
    } catch (error) {
      results.tests.products = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      console.log(`[SAFE API TEST] ❌ Products test failed:`, error);
    }

    // Test 5: Contact deals lookup (most problematic query)
    if (testType === 'all' && results.tests.deals?.success && results.tests.contacts?.success) {
      console.log('[SAFE API TEST] 🔗 Testing contact deals lookup...');
      try {
        // Get the first contact that has deals
        const testContacts = await ploomesApi.getContactsSafe({ top: 50 });
        const testDeals = await ploomesApi.getDealsSafe({ top: 100 });

        // Find a contact with deals
        const contactWithDeals = testContacts.find(contact =>
          testDeals.some(deal => deal.ContactId === contact.Id)
        );

        if (contactWithDeals) {
          console.log(`[SAFE API TEST] 🎯 Testing deals for contact ${contactWithDeals.Id} (${contactWithDeals.Name})`);
          const contactDeals = await ploomesApi.getDealsForContactSafe(contactWithDeals.Id, 5);

          results.tests.contactDeals = {
            success: true,
            contactId: contactWithDeals.Id,
            contactName: contactWithDeals.Name,
            dealCount: contactDeals.length,
            hasProducts: contactDeals.some(d => (d as any).products?.length > 0)
          };
          console.log(`[SAFE API TEST] ✅ Contact deals: ${contactDeals.length} deals found for ${contactWithDeals.Name}`);

          // Test deal products if we have deals
          if (contactDeals.length > 0) {
            console.log('[SAFE API TEST] 🛒 Testing deal products...');
            try {
              const testDeal = contactDeals[0];
              const dealProducts = await ploomesApi.getDealProductsSafe(testDeal.Id);
              results.tests.dealProducts = {
                success: true,
                dealId: testDeal.Id,
                productCount: dealProducts.length
              };
              console.log(`[SAFE API TEST] ✅ Deal products: ${dealProducts.length} products found for deal ${testDeal.Id}`);
            } catch (error) {
              results.tests.dealProducts = {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
              };
              console.log(`[SAFE API TEST] ❌ Deal products test failed:`, error);
            }
          }
        } else {
          results.tests.contactDeals = {
            success: false,
            error: 'No contact with deals found in test data'
          };
        }
      } catch (error) {
        results.tests.contactDeals = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
        console.log(`[SAFE API TEST] ❌ Contact deals test failed:`, error);
      }
    }

    // Get final statistics
    const finalStats = ploomesApi.getStats();
    results.stats = finalStats;

    // Calculate success rate
    const testResults = Object.values(results.tests);
    const successfulTests = testResults.filter((test: any) => test.success).length;
    const totalTests = testResults.length;
    const successRate = totalTests > 0 ? successfulTests / totalTests : 0;

    results.summary = {
      totalTests,
      successfulTests,
      failedTests: totalTests - successfulTests,
      successRate: Math.round(successRate * 100),
      totalTime: Date.now() - startTime
    };

    // Generate recommendations
    const recommendations = [];
    if (successRate < 0.8) {
      recommendations.push('❌ Success rate below 80% - API may be blocked or unstable');
    } else if (successRate < 1.0) {
      recommendations.push('⚠️ Some tests failed - check specific errors');
    } else {
      recommendations.push('✅ All tests passed - Safe API strategy working correctly');
    }

    if (finalStats.patterns.successRate < 0.8) {
      recommendations.push('📊 Pattern success rate low - consider more conservative strategies');
    }

    if (finalStats.patterns.failed > 10) {
      recommendations.push('🚨 High number of failed patterns - API may be experiencing issues');
    }

    results.recommendations = recommendations;

    console.log(`[SAFE API TEST] 📊 Test Results Summary:`);
    console.log(`   Success Rate: ${results.summary.successRate}%`);
    console.log(`   Total Time: ${results.summary.totalTime}ms`);
    console.log(`   Pattern Success Rate: ${Math.round(finalStats.patterns.successRate * 100)}%`);

    return NextResponse.json({
      success: true,
      data: results
    });

  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`[SAFE API TEST] 💥 Test suite failed after ${totalTime}ms:`, error);

    return NextResponse.json({
      success: false,
      error: 'Test suite failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      totalTime
    }, { status: 500 });
  }
}

/**
 * POST /api/ploomes/test-safe-api
 * Reset safe API cache and patterns for fresh testing
 */
export async function POST(request: NextRequest) {
  try {
    const { action } = await request.json();

    if (action === 'reset') {
      ploomesApi.reset();
      console.log('[SAFE API TEST] 🧹 Cache and patterns reset');

      return NextResponse.json({
        success: true,
        message: 'Safe API cache and patterns reset successfully'
      });
    }

    return NextResponse.json({
      success: false,
      error: 'Invalid action. Use { "action": "reset" }'
    }, { status: 400 });

  } catch (error) {
    console.error('[SAFE API TEST] Error in POST:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to process request',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Add CORS headers
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}