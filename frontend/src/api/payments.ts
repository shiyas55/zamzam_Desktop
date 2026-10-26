import { api } from './client';
import { Payment } from '../types';

export interface RecordPaymentPayload {
  customer_id: string;
  amount: string;
  payment_method: 'CASH' | 'GPAY_UPI';
  order_id?: string | null;
  payment_type?: 'ORDER_PAYMENT' | 'PREVIOUS_CREDIT';
  staff_member_id?: string | null;
  reference_number?: string;
  received_at?: string;
  notes?: string;
}

export interface SyncDailyPaymentPayload {
  customer_id: string;
  date: string;
  cash_amount: string;
  gpay_amount: string;
  order_id?: string | null;
}

export interface SyncDailyPaymentResponse {
  status: string;
  customer_id: string;
  customer_name: string;
  current_balance: string;
  date: string;
  cash_amount: string;
  gpay_amount: string;
}

export interface PaymentFilterParams {
  customer?: string;
  route?: string;
  driver?: string;
  method?: string;
  status?: string;
  payment_type?: string;
  date?: string;
  start_date?: string;
  end_date?: string;
}

export const paymentsApi = {
  async getPayments(params?: PaymentFilterParams): Promise<Payment[]> {
    const queryParams: Record<string, string | boolean | undefined> = {
      all: 'true',
      page_size: '2000',
      ...params,
    };

    const data = await api.get<{ results?: Payment[]; next?: string | null } | Payment[]>('/payments/', queryParams);
    let items = Array.isArray(data) ? data : data.results || [];
    let nextUrl = !Array.isArray(data) ? data.next : null;

    while (nextUrl) {
      try {
        const parsed = new URL(nextUrl, window.location.origin);
        const endpoint = parsed.pathname.replace(/^\/api\/v1/, '') + parsed.search;
        const pageRes: any = await api.get(endpoint);
        if (Array.isArray(pageRes)) {
          items = items.concat(pageRes);
          break;
        } else if (pageRes?.results) {
          items = items.concat(pageRes.results);
          nextUrl = pageRes.next;
        } else {
          break;
        }
      } catch {
        break;
      }
    }
    return items;
  },

  async recordPayment(payload: RecordPaymentPayload): Promise<Payment> {
    return api.post<Payment>('/payments/', payload);
  },

  async reversePayment(paymentId: string, reason: string): Promise<Payment> {
    return api.post<Payment>(`/payments/${paymentId}/reverse/`, { reason });
  },

  async syncDailyPayment(payload: SyncDailyPaymentPayload): Promise<SyncDailyPaymentResponse> {
    return api.post<SyncDailyPaymentResponse>('/payments/sync-daily-payment/', payload);
  },

  async getDailySummary(date?: string): Promise<{
    date: string;
    total_collected: string;
    cash_total: string;
    upi_total: string;
    count: number;
  }> {
    return api.get('/payments/daily_summary/', date ? { date } : undefined);
  },
};
