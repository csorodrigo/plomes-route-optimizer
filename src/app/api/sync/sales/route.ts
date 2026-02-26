import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env.server';

export async function POST(request: NextRequest) {
  try {
    console.log('📥 Sync Sales API called');

    const body = await request.json();
    const { sales } = body;

    if (!sales || !Array.isArray(sales)) {
      return NextResponse.json(
        { success: false, message: 'Sales array is required' },
        { status: 400 }
      );
    }

    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);

    let successCount = 0;
    let errorCount = 0;
    const errors: any[] = [];

    // Process sales in batches
    for (const sale of sales) {
      try {
        const normalizedSale = {
          ...sale,
          person_id: sale.person_id ?? sale.personId ?? null,
          owner_id: sale.owner_id ?? sale.ownerId ?? null,
        };

        let { error } = await supabase
          .from('sales')
          .upsert(normalizedSale, {
            onConflict: 'ploomes_deal_id'
          });

        if ((error as any)?.code === '42703' || (error as any)?.code === 'PGRST204') {
          const { person_id, owner_id, ...fallbackSale } = normalizedSale as any;
          const retry = await supabase
            .from('sales')
            .upsert(fallbackSale, {
              onConflict: 'ploomes_deal_id'
            });
          error = retry.error;
        }

        if (error) {
          errorCount++;
          errors.push({ sale: normalizedSale.ploomes_deal_id, error: error.message });
        } else {
          successCount++;
        }
      } catch (err) {
        errorCount++;
        errors.push({
          sale: sale.ploomes_deal_id,
          error: err instanceof Error ? err.message : 'Unknown error'
        });
      }
    }

    console.log(`✅ Sync complete: ${successCount} success, ${errorCount} errors`);

    return NextResponse.json({
      success: true,
      results: {
        success: successCount,
        errors: errorCount,
        errorDetails: errors.slice(0, 5) // Return first 5 errors only
      }
    });

  } catch (error: unknown) {
    console.error('💥 Sync Sales API error:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Server error in sync sales API',
        error: error instanceof Error ? error.message : 'Unknown error'
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
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
