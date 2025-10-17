import { NextResponse } from 'next/server';
import { PloomesSyncService } from '@/lib/ploomes-sync';
import { PloomesSyncOptions } from '@/lib/ploomes-types';

export async function POST(request: Request) {
  try {
    const options: PloomesSyncOptions = await request.json();

    const syncStatus = await PloomesSyncService.startFullProductSync(options);

    return NextResponse.json(syncStatus, { status: 200 });
  } catch (error) {
    console.error('Product sync API error:', error);
    return NextResponse.json(
      {
        error: 'Product sync failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    // Placeholder for getting last sync status
    const lastSyncStatus = await PloomesSyncService.getLastSyncStatus();
    return NextResponse.json(lastSyncStatus, { status: 200 });
  } catch (error) {
    console.error('Get sync status error:', error);
    return NextResponse.json(
      {
        error: 'Could not retrieve sync status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}