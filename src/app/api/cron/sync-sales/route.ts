import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const PLOOMES_BASE_URL = 'https://public-api2.ploomes.com';
const PAGE_SIZE = 300;
const DELAY_MS = 120;

interface PloomeDeal {
  Id: number;
  ContactId?: number;
  OwnerId?: number;
  Amount?: number;
  StageId?: number;
  LastUpdateDate?: string;
  Title?: string;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchAllPloomeDeals(apiKey: string): Promise<PloomeDeal[]> {
  const all: PloomeDeal[] = [];
  let skip = 0;

  while (true) {
    const url = `${PLOOMES_BASE_URL}/Deals?$select=Id,ContactId,OwnerId,Amount,StageId,LastUpdateDate,Title&$top=${PAGE_SIZE}&$skip=${skip}`;
    const res = await fetch(url, {
      headers: { 'User-Key': apiKey, 'Content-Type': 'application/json' },
    });

    if (!res.ok) {
      throw new Error(`Ploomes API error ${res.status}: ${await res.text()}`);
    }

    const data = await res.json();
    const deals: PloomeDeal[] = data.value || [];
    all.push(...deals);

    if (deals.length < PAGE_SIZE) break;
    skip += PAGE_SIZE;
    await sleep(DELAY_MS);
  }

  return all;
}

/**
 * CRON Job: Sync Ploomes deals → Supabase sales table
 *
 * Keeps sales.owner_id and sales.customer_id up to date so that
 * vendor users see the correct customers on the map.
 *
 * Schedule: every 6 hours ("0 *\/6 * * *")
 * Vercel: add to vercel.json crons section
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  // Verify cron secret (only if CRON_SECRET is explicitly configured)
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const PLOOMES_API_KEY = process.env.PLOOME_API_KEY;
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  if (!PLOOMES_API_KEY) {
    return NextResponse.json({ error: 'Missing PLOOMES_API_KEY' }, { status: 500 });
  }
  if (!SUPABASE_KEY) {
    return NextResponse.json({ error: 'Missing SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 });
  }

  console.log('[SYNC-SALES] Starting...');

  try {
    // Step 1: Fetch all deals from Ploomes
    console.log('[SYNC-SALES] Fetching deals from Ploomes...');
    const deals = await fetchAllPloomeDeals(PLOOMES_API_KEY);
    console.log(`[SYNC-SALES] Fetched ${deals.length} deals`);

    // Step 2: Filter out deals without a customer or owner
    const withBoth = deals.filter((d) => d.ContactId && d.OwnerId);
    console.log(`[SYNC-SALES] Deals with ContactId + OwnerId: ${withBoth.length}`);

    // Step 3: Load all customer IDs from Supabase to avoid FK violations
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    console.log('[SYNC-SALES] Loading customer IDs from Supabase...');
    const customerIds = new Set<string>();
    let cusOffset = 0;
    while (true) {
      const { data, error } = await supabase
        .from('customers')
        .select('id')
        .range(cusOffset, cusOffset + 999);
      if (error) throw new Error(`Customers fetch error: ${error.message}`);
      if (!data || data.length === 0) break;
      for (const row of data) customerIds.add(String(row.id));
      if (data.length < 1000) break;
      cusOffset += 1000;
    }
    console.log(`[SYNC-SALES] Found ${customerIds.size} customers in Supabase`);

    // Only upsert deals where the customer already exists in Supabase
    const valid = withBoth.filter((d) => customerIds.has(String(d.ContactId)));
    console.log(`[SYNC-SALES] Deals with matching customer: ${valid.length} (skipped ${withBoth.length - valid.length})`);

    // Step 4: Upsert into Supabase sales table
    const rows = valid.map((deal) => ({
      ploomes_deal_id: String(deal.Id),
      customer_id: String(deal.ContactId),
      owner_id: deal.OwnerId,
      person_id: deal.OwnerId,
      deal_value: deal.Amount || 0,
      stage_id: deal.StageId ? String(deal.StageId) : null,
      deal_stage: deal.StageId ? String(deal.StageId) : null,
      status: 'open' as const, // Win/Lose restricted by Ploomes API key scope
      products: [],
    }));

    let upserted = 0;
    let errors = 0;
    const BATCH = 500;

    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH);
      const { error } = await supabase
        .from('sales')
        .upsert(batch, { onConflict: 'ploomes_deal_id', ignoreDuplicates: false });

      if (error) {
        console.error(`[SYNC-SALES] Batch ${i}-${i + batch.length} error:`, error.message);
        errors += batch.length;
      } else {
        upserted += batch.length;
      }
    }

    const elapsed = Date.now() - startTime;
    console.log(`[SYNC-SALES] Done in ${elapsed}ms — upserted: ${upserted}, errors: ${errors}`);

    return NextResponse.json({
      success: true,
      stats: {
        dealsFetched: deals.length,
        dealsValid: valid.length,
        upserted,
        errors,
        elapsed,
      },
    });
  } catch (err) {
    const elapsed = Date.now() - startTime;
    console.error('[SYNC-SALES] Fatal error:', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Unknown', elapsed },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
export const maxDuration = 300;
