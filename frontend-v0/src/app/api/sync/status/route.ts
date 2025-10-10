import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { PloomesSyncStatus } from '@/lib/ploomes-types';

export async function GET() {
  try {
    const { data, error } = await supabaseServer.query<PloomesSyncStatus>(
      'sync_status',
      {
        select: '*',
        orderBy: { column: 'started_at', ascending: false },
        limit: 1,
        single: true
      }
    );

    if (error) throw error;

    return NextResponse.json(data as PloomesSyncStatus, { status: 200 });
  } catch (error) {
    console.error('Sync status retrieval error:', error);
    return NextResponse.json(
      {
        error: 'Could not retrieve sync status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}