import { api } from './client';
import { CreditTransaction } from '../types';

export interface CreditFilterParams extends Record<string, string | number | boolean | undefined> {
  customer?: string;
  type?: string;
}

export interface CreditAdjustmentPayload {
  customer_id: string;
  amount: string;
  notes: string;
}

export const creditsApi = {
  async getLedgerEntries(params?: CreditFilterParams): Promise<CreditTransaction[]> {
    const data = await api.get<{ results?: CreditTransaction[] } | CreditTransaction[]>('/credits/', params);
    return Array.isArray(data) ? data : data.results || [];
  },

  async recordAdjustment(payload: CreditAdjustmentPayload): Promise<CreditTransaction> {
    return api.post<CreditTransaction>('/credits/adjust/', payload);
  },
};
