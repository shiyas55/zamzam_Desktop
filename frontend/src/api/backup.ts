import { api } from './client';
import { databaseService, DatabaseStats, BackupRequest, RestoreResult, ClearAllResult } from '../services/databaseService';

export type { DatabaseStats, BackupRequest, RestoreResult, ClearAllResult };

export const backupApi = {
  async getStats(): Promise<DatabaseStats> {
    return api.get<DatabaseStats>('/database/stats/');
  },

  async downloadBackup(payload: BackupRequest): Promise<void> {
    return databaseService.downloadBackup(payload);
  },

  async restoreDatabase(file: File, format?: 'sql' | 'json'): Promise<RestoreResult> {
    return databaseService.restoreDatabase(file, format);
  },

  async clearAllData(pin: string, confirmation: string): Promise<ClearAllResult> {
    return api.post<ClearAllResult>('/database/clear-all/', { pin, confirmation });
  },
};
