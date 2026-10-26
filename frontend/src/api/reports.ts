import { api } from './client';
import {
  DashboardSummary,
  DriverPerformanceReport,
  DriverDetailReport,
} from '../types';
import {
  DateFilterParams,
  DriverPerformanceParams,
  OutstandingCreditReport,
  CollectionReportResponse,
  DriverCollectionReportResponse,
  DailyFinancialSummaryResponse,
  DailyClosingResponse,
} from '../services/reportService';

export type {
  DailyClosingResponse,
  OutstandingCreditReport,
  CollectionReportResponse,
  DriverCollectionReportResponse,
  DailyFinancialSummaryResponse,
};

export const reportsApi = {
  async getDashboardSummary(params?: DateFilterParams): Promise<DashboardSummary> {
    return api.get<DashboardSummary>('/reports/dashboard/', params);
  },

  async getDriverPerformance(params?: DriverPerformanceParams): Promise<DriverPerformanceReport> {
    return api.get<DriverPerformanceReport>('/reports/driver-performance/', params);
  },

  async getDriverDetail(driverId: string, params?: DateFilterParams): Promise<DriverDetailReport> {
    return api.get<DriverDetailReport>(`/reports/driver-performance/${driverId}/`, params);
  },

  async getOutstandingCreditReport(params?: { route?: string; aging_bucket?: string; search?: string }): Promise<OutstandingCreditReport> {
    return api.get<OutstandingCreditReport>('/reports/outstanding-credit/', params);
  },

  async getCollectionReport(params?: Record<string, string | number | boolean | undefined>): Promise<CollectionReportResponse> {
    return api.get<CollectionReportResponse>('/reports/collections/', params);
  },

  async getDriverCollectionReport(params?: Record<string, string | number | boolean | undefined>): Promise<DriverCollectionReportResponse> {
    return api.get<DriverCollectionReportResponse>('/reports/driver-collections/', params);
  },

  async getDailyFinancialSummary(params?: Record<string, string | number | boolean | undefined>): Promise<DailyFinancialSummaryResponse> {
    return api.get<DailyFinancialSummaryResponse>('/reports/financial-summary/', params);
  },

  async getDailyClosing(date?: string): Promise<DailyClosingResponse> {
    const params = date ? { date } : undefined;
    return api.get<DailyClosingResponse>('/reports/daily-closing/', params);
  },

  async openDay(payload: { date?: string; opening_cash: string; notes?: string }): Promise<{ message: string; date: string; is_opened: boolean; opening_cash: string }> {
    return api.post('/reports/daily-open/', payload);
  },

  async submitDailyClosing(payload: { date?: string; notes?: string }): Promise<{ message: string; date: string; is_closed: boolean }> {
    return api.post('/reports/daily-closing/', payload);
  },

  async reopenDailyClosing(payload: { date?: string; reason: string }): Promise<{ message: string; date: string; is_closed: boolean }> {
    return api.post('/reports/daily-closing/reopen/', payload);
  },
};
