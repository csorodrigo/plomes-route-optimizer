import { PloomesSyncService } from './ploomes-sync';
import { PloomesSyncOptions, PloomesSyncStatus } from './ploomes-types';
import { supabaseServer } from './supabase-server';

export class SyncManager {
  private static MAX_RETRY_ATTEMPTS = 3;
  private static RETRY_DELAY_MS = 5000; // 5 seconds

  static async startSync(
    options: PloomesSyncOptions = {}
  ): Promise<PloomesSyncStatus> {
    let retryCount = 0;
    let syncStatus: PloomesSyncStatus;

    while (retryCount < this.MAX_RETRY_ATTEMPTS) {
      try {
        // Start sync
        syncStatus = await PloomesSyncService.startFullProductSync(options);

        // Save sync status to Supabase
        await this.recordSyncStatus(syncStatus);

        // Webhook notification (optional)
        if (process.env.SYNC_WEBHOOK_URL) {
          await this.sendWebhookNotification(syncStatus);
        }

        return syncStatus;
      } catch (error) {
        console.error(`Sync attempt ${retryCount + 1} failed:`, error);

        retryCount++;

        if (retryCount >= this.MAX_RETRY_ATTEMPTS) {
          const failedStatus: PloomesSyncStatus = {
            total_products: 0,
            processed_products: 0,
            status: 'FAILED',
            started_at: new Date(),
            error: error instanceof Error ? error.message : 'Sync failed after max retries',
            progress_percentage: 0
          };

          await this.recordSyncStatus(failedStatus);
          throw error;
        }

        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY_MS));
      }
    }

    throw new Error('Sync failed after maximum retry attempts');
  }

  private static async recordSyncStatus(
    status: PloomesSyncStatus
  ): Promise<void> {
    const { error } = await supabase.from('sync_status').insert(status);

    if (error) {
      console.error('Failed to record sync status:', error);
    }
  }

  private static async sendWebhookNotification(
    status: PloomesSyncStatus
  ): Promise<void> {
    try {
      const response = await fetch(process.env.SYNC_WEBHOOK_URL!, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.WEBHOOK_SECRET}`
        },
        body: JSON.stringify(status)
      });

      if (!response.ok) {
        console.error('Webhook notification failed:', response.statusText);
      }
    } catch (error) {
      console.error('Webhook notification error:', error);
    }
  }

  static async getLatestSyncStatus(): Promise<PloomesSyncStatus | null> {
    const { data, error } = await supabase
      .from('sync_status')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      console.error('Error fetching latest sync status:', error);
      return null;
    }

    return data;
  }

  static async resumeInterruptedSync(): Promise<PloomesSyncStatus | null> {
    const latestStatus = await this.getLatestSyncStatus();

    if (
      latestStatus &&
      (latestStatus.status === 'PENDING' || latestStatus.status === 'IN_PROGRESS')
    ) {
      // Resume interrupted sync with the last known status
      return this.startSync({
        batch_size: 500,
        force_full_sync: false
      });
    }

    return null;
  }
}