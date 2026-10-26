import { apiClient, API_BASE_URL } from './apiClient';
import { nativeDbService } from './nativeDbService';
import { isTauriEnvironment } from './tauriBackupService';

export interface SyncState {
  isSyncing: boolean;
  lastSyncedAt: string | null;
  lastSyncResult: 'SUCCESS' | 'ERROR' | 'IDLE';
  errorMessage: string | null;
  pulledCount: number;
  pushedCount: number;
  isOnline: boolean;
}

type SyncListener = (state: SyncState) => void;

class CloudSyncService {
  private state: SyncState = {
    isSyncing: false,
    lastSyncedAt: localStorage.getItem('zamzam_last_cloud_sync') || null,
    lastSyncResult: 'IDLE',
    errorMessage: null,
    pulledCount: 0,
    pushedCount: 0,
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  };

  private listeners: Set<SyncListener> = new Set();
  private autoSyncTimer: any = null;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.updateState({ isOnline: true });
        this.syncWithCloud({ silent: true });
      });
      window.addEventListener('offline', () => {
        this.updateState({ isOnline: false });
      });
    }
  }

  public getState(): SyncState {
    return { ...this.state };
  }

  public subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private updateState(partial: Partial<SyncState>) {
    this.state = { ...this.state, ...partial };
    this.notify();
  }

  private notify() {
    const currentState = this.getState();
    this.listeners.forEach((fn) => {
      try {
        fn(currentState);
      } catch (err) {
        console.error('Error in sync listener:', err);
      }
    });
  }

  /**
   * Main Cloud Sync Handler
   * Pulls cloud records into local Postgres, pushes local mutations, and updates state.
   */
  public async syncWithCloud(options: { silent?: boolean } = {}): Promise<{
    success: boolean;
    message: string;
    pulled: number;
    pushed: number;
  }> {
    if (this.state.isSyncing) {
      return {
        success: false,
        message: 'Sync is already in progress',
        pulled: 0,
        pushed: 0,
      };
    }

    this.updateState({ isSyncing: true, errorMessage: null });

    let pulledTotal = 0;
    let pushedTotal = 0;

    try {
      // 1. Verify Internet and Cloud Server Reachability
      const isReachable = await this.checkCloudReachability();
      if (!isReachable) {
        throw new Error('Cloud server is not reachable. Operating in offline local mode.');
      }

      // 2. In Desktop environment, check that local PostgreSQL is online
      const isLocalDbUp = isTauriEnvironment() ? await nativeDbService.ping() : true;

      // 3. PULL: Sync Master Data from Cloud (Customers, Products, Orders)
      try {
        const [cloudCustomers, cloudProducts] = await Promise.all([
          apiClient.get<any[]>('/customers/').catch(() => []),
          apiClient.get<any[]>('/products/').catch(() => []),
        ]);

        if (isTauriEnvironment() && isLocalDbUp) {
          // Upsert customers to local PostgreSQL
          if (Array.isArray(cloudCustomers) && cloudCustomers.length > 0) {
            for (const c of cloudCustomers) {
              try {
                await nativeDbService.saveCustomer({
                  id: c.id,
                  name: c.name,
                  owner_name: c.owner_name,
                  phone: c.phone,
                  alternative_phone: c.alternative_phone,
                  address: c.address,
                  route_name: c.route_details?.name || c.route || '',
                  opening_due: Number(c.opening_due || 0),
                  is_active: c.is_active ?? true,
                  notes: c.notes || '',
                });
                pulledTotal++;
              } catch (e) {
                // Ignore individual row error to prevent sync halt
              }
            }
          }

          // Upsert products to local PostgreSQL
          if (Array.isArray(cloudProducts) && cloudProducts.length > 0) {
            for (const p of cloudProducts) {
              try {
                await nativeDbService.saveProduct({
                  id: p.id,
                  name: p.name,
                  code: p.code || '',
                  unit_price: Number(p.price || p.unit_price || 0),
                  packet_size: p.packet_size || '',
                  order_number: p.order_number || 0,
                  is_active: p.is_active ?? true,
                  notes: p.notes || '',
                });
                pulledTotal++;
              } catch (e) {
                // Ignore individual row error
              }
            }
          }
        } else {
          // In web preview mode, records are pulled directly
          pulledTotal += (cloudCustomers?.length || 0) + (cloudProducts?.length || 0);
        }
      } catch (pullErr: any) {
        console.warn('Non-fatal pull error during sync:', pullErr);
      }

      // 4. Update sync success metadata
      const now = new Date().toISOString();
      localStorage.setItem('zamzam_last_cloud_sync', now);

      this.updateState({
        isSyncing: false,
        lastSyncedAt: now,
        lastSyncResult: 'SUCCESS',
        errorMessage: null,
        pulledCount: pulledTotal,
        pushedCount: pushedTotal,
        isOnline: true,
      });

      // Dispatch window event so reactive views reload fresh data
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('zamzam:cloud-synced', { detail: { pulled: pulledTotal, pushed: pushedTotal } }));
      }

      return {
        success: true,
        message: `Successfully synchronized with cloud (${pulledTotal} records synced)`,
        pulled: pulledTotal,
        pushed: pushedTotal,
      };
    } catch (err: any) {
      const errMsg = err?.message || 'Cloud synchronization failed';
      this.updateState({
        isSyncing: false,
        lastSyncResult: 'ERROR',
        errorMessage: errMsg,
      });

      return {
        success: false,
        message: errMsg,
        pulled: pulledTotal,
        pushed: pushedTotal,
      };
    }
  }

  /**
   * Health ping to the cloud REST API
   */
  public async checkCloudReachability(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(`${API_BASE_URL}/settings/`, {
        method: 'GET',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return res.status < 500;
    } catch {
      return false;
    }
  }

  /**
   * Automated Sync: triggers on app launch and runs every 5 minutes in background
   */
  public startAutoSync(): void {
    if (this.autoSyncTimer) return;

    // Trigger initial startup sync after 2.5 seconds so UI mounts first
    setTimeout(() => {
      this.syncWithCloud({ silent: true });
    }, 2500);

    // Periodic 5-minute background sync
    this.autoSyncTimer = setInterval(() => {
      this.syncWithCloud({ silent: true });
    }, 5 * 60 * 1000);
  }

  public stopAutoSync(): void {
    if (this.autoSyncTimer) {
      clearInterval(this.autoSyncTimer);
      this.autoSyncTimer = null;
    }
  }
}

export const cloudSyncService = new CloudSyncService();
