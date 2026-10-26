import { apiClient } from './apiClient';
import { CreditTransaction } from '../types';

export const creditService = {
  async getLedgerEntries(params?: {
    customer?: string;
    type?: string;
  }): Promise<CreditTransaction[]> {
    const data = await apiClient.get<{ results?: CreditTransaction[] } | CreditTransaction[]>('/credits/', params);
    return Array.isArray(data) ? data : data.results || [];
  },

  async recordAdjustment(payload: {
    customer_id: string;
    amount: string;
    notes: string;
  }): Promise<CreditTransaction> {
    return apiClient.post<CreditTransaction>('/credits/adjust/', payload);
  },
};
