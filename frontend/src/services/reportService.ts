import { apiClient } from './apiClient';
import { 
  DashboardSummary, 
  DriverPerformanceReport, 
  DriverDetailReport, 
  DatePreset,
  CollectionReportResponse,
  DriverCollectionReportResponse,
  DailyFinancialSummaryResponse 
} from '../types';

export type { 
  CollectionReportResponse,
  DriverCollectionReportResponse,
  DailyFinancialSummaryResponse 
};

export interface OutstandingShopReport {
  customer_id: string;
  customer_name: string;
  owner_name: string;
  phone: string;
  route_name: string;
  current_balance: string;
  credit_limit: string;
  is_exceeded: boolean;
  last_payment?: {
    payment_number: string;
    date: string;
    amount: string;
    method: string;
  } | null;
  last_order?: {
    order_number: string;
    date: string;
    amount: string;
  } | null;
  days_outstanding: number;
  aging_bucket: string;
}

export interface OutstandingCreditReport {
  total_outstanding: string;
  customer_count: number;
  aging_summary?: {
    "0_to_7_days": string;
    "8_to_15_days": string;
    "16_to_30_days": string;
    "30_plus_days": string;
  };
  customers: OutstandingShopReport[];
}

export interface DateFilterParams extends Record<string, string | number | boolean | undefined> {
  date_preset?: DatePreset;
  start_date?: string;
  end_date?: string;
}

export interface DriverPerformanceParams extends Record<string, string | number | boolean | undefined> {
  date_preset?: DatePreset;
  start_date?: string;
  end_date?: string;
  driver?: string;
  route?: string;
}

export interface DailyClosingFigures {
  opening_cash?: string;
  expected_cash_in_hand?: string;
  total_orders: number;
  total_sales: string;
  total_shop_expense?: string;
  total_collected: string;
  cash_collected: string;
  upi_collected: string;
  credit_generated: string;
  today_order_collected: string;
  previous_credit_collected: string;
  driver_expenses: string;
  staff_cash_paid?: string;
  staff_gpay_paid?: string;
  total_staff_payouts?: string;
  net_collection: string;
  total_deliveries: number;
  delivered_count: number;
  pending_deliveries: number;
  not_delivered_count: number;
}

export interface DayOpeningRecord {
  is_opened: boolean;
  opened_by_name: string;
  opened_at: string;
  opening_cash: string;
  opening_notes?: string;
}

export interface DailyClosingResponse {
  date: string;
  is_opened: boolean;
  opening_record?: DayOpeningRecord | null;
  is_closed: boolean;
  closing_record: {
    id: string;
    date: string;
    is_closed: boolean;
    closed_by_name: string;
    closed_at: string;
    reopened_by_name?: string | null;
    reopened_at?: string | null;
    reopen_reason?: string;
    notes?: string;
    snapshot?: Record<string, unknown>;
  } | null;
  figures: DailyClosingFigures;
}

export const reportService = {
  async getDashboardSummary(params?: DateFilterParams): Promise<DashboardSummary> {
    return apiClient.get<DashboardSummary>('/reports/dashboard/', params);
  },

  async getDriverPerformance(params?: DriverPerformanceParams): Promise<DriverPerformanceReport> {
    return apiClient.get<DriverPerformanceReport>('/reports/driver-performance/', params);
  },

  async getDriverDetail(driverId: string, params?: DateFilterParams): Promise<DriverDetailReport> {
    return apiClient.get<DriverDetailReport>(`/reports/driver-performance/${driverId}/`, params);
  },

  async getOutstandingCreditReport(params?: { route?: string; aging_bucket?: string; search?: string }): Promise<OutstandingCreditReport> {
    return apiClient.get<OutstandingCreditReport>('/reports/outstanding-credit/', params);
  },

  async getCollectionReport(params?: Record<string, string | undefined>): Promise<CollectionReportResponse> {
    return apiClient.get<CollectionReportResponse>('/reports/collections/', params);
  },

  async getDriverCollectionReport(params?: Record<string, string | undefined>): Promise<DriverCollectionReportResponse> {
    return apiClient.get<DriverCollectionReportResponse>('/reports/driver-collections/', params);
  },

  async getDailyFinancialSummary(params?: Record<string, string | undefined>): Promise<DailyFinancialSummaryResponse> {
    return apiClient.get<DailyFinancialSummaryResponse>('/reports/financial-summary/', params);
  },

  async getDailyClosing(date?: string): Promise<DailyClosingResponse> {
    const params = date ? { date } : undefined;
    return apiClient.get<DailyClosingResponse>('/reports/daily-closing/', params);
  },

  async openDay(payload: { date?: string; opening_cash: string; notes?: string }): Promise<{ message: string; date: string; is_opened: boolean; opening_cash: string }> {
    return apiClient.post('/reports/daily-open/', payload);
  },

  async submitDailyClosing(payload: { date?: string; notes?: string }): Promise<{ message: string; date: string; is_closed: boolean }> {
    return apiClient.post('/reports/daily-closing/', payload);
  },

  async reopenDailyClosing(payload: { date?: string; reason: string }): Promise<{ message: string; date: string; is_closed: boolean }> {
    return apiClient.post('/reports/daily-closing/reopen/', payload);
  },
};


