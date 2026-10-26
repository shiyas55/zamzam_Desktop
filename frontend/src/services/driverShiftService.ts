import { apiClient } from './apiClient';

export interface DriverShiftMetrics {
  assigned_kubbus: number;
  assigned_romali: number;
  delivered_kubbus: number;
  delivered_romali: number;
  assigned_orders_count: number;
  delivered_orders_count: number;
  pending_orders_count: number;
  assigned_total_val: string;
  today_cash_collected: string;
  today_upi_collected: string;
  today_expenses: string;
  net_cash_in_hand: string;
}

export interface DriverShift {
  id: string;
  driver: string;
  driver_name: string;
  route_name?: string;
  date: string;
  is_opened: boolean;
  opened_at?: string;
  kubbus_loaded: number;
  romali_loaded: number;
  opening_notes?: string;
  is_closed: boolean;
  closed_at?: string;
  kubbus_returned: number;
  romali_returned: number;
  cash_collected: string;
  upi_collected: string;
  expenses_total: string;
  net_cash_handover: string;
  closing_notes?: string;
  metrics?: DriverShiftMetrics;
}

export interface OpenDriverShiftPayload {
  kubbus_loaded: number;
  romali_loaded: number;
  opening_notes?: string;
}

export interface CloseDriverShiftPayload {
  kubbus_returned: number;
  romali_returned: number;
  closing_notes?: string;
}

export const driverShiftService = {
  async getTodayShift(): Promise<DriverShift> {
    return apiClient.get<DriverShift>('/driver-shifts/today/');
  },

  async openDay(payload: OpenDriverShiftPayload): Promise<DriverShift> {
    return apiClient.post<DriverShift>('/driver-shifts/open_day/', payload);
  },

  async closeDay(payload: CloseDriverShiftPayload): Promise<DriverShift> {
    return apiClient.post<DriverShift>('/driver-shifts/close_day/', payload);
  },
};
