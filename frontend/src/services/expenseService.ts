import { apiClient } from './apiClient';
import { DriverExpense, DriverExpenseCategory, DriverExpenseSummary } from '../types';

export interface CreateExpensePayload {
  driver?: string | null;
  category: DriverExpenseCategory | string;
  custom_category?: string;
  amount: string;
  date?: string;
  notes?: string;
  receipt_reference?: string;
  receipt_url?: string;
}

export const expenseService = {
  async getExpenses(params?: {
    driver?: string;
    route?: string;
    category?: string;
    date?: string;
    start_date?: string;
    end_date?: string;
    status?: string;
  }): Promise<DriverExpense[]> {
    const data = await apiClient.get<{ results?: DriverExpense[] } | DriverExpense[]>('/driver-expenses/', params);
    return Array.isArray(data) ? data : data.results || [];
  },

  async getExpenseSummary(driverId?: string): Promise<DriverExpenseSummary> {
    const params = driverId ? { driver_id: driverId } : undefined;
    return apiClient.get<DriverExpenseSummary>('/driver-expenses/summary/', params);
  },

  async createExpense(payload: CreateExpensePayload): Promise<DriverExpense> {
    return apiClient.post<DriverExpense>('/driver-expenses/', payload);
  },

  async getExpense(id: string): Promise<DriverExpense> {
    return apiClient.get<DriverExpense>(`/driver-expenses/${id}/`);
  },

  async updateExpense(id: string, updates: Partial<CreateExpensePayload>): Promise<DriverExpense> {
    return apiClient.patch<DriverExpense>(`/driver-expenses/${id}/`, updates);
  },

  async deleteExpense(id: string): Promise<void> {
    return apiClient.delete(`/driver-expenses/${id}/`);
  },
};
