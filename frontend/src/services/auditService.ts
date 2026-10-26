import { apiClient } from './apiClient';
import { ActivityLog, ActivityActionType, ActivityEntityType, DatePreset } from '../types';

export interface ActivityFilterParams extends Record<string, string | number | boolean | undefined> {
  date_preset?: DatePreset;
  start_date?: string;
  end_date?: string;
  user_role?: string;
  action_type?: ActivityActionType;
  entity_type?: ActivityEntityType;
  search?: string;
}

export const auditService = {
  async getActivityLogs(params?: ActivityFilterParams): Promise<ActivityLog[]> {
    const res = await apiClient.get<any>('/activity-logs/', params);
    // Handle either direct array or DRF paginated { results: [...] }
    if (res && Array.isArray(res.results)) {
      return res.results;
    }
    return Array.isArray(res) ? res : [];
  },
};
