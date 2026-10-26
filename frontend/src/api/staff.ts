import { api } from './client';
import {
  StaffMember,
  StaffAttendance,
  StaffPayout,
  StaffSummary,
  DailySheetItem,
  AttendanceStatus,
} from '../types';
import { staffService, CreateStaffPayload } from '../services/staffService';

export type { CreateStaffPayload };

export const staffApi = {
  async getStaff(params?: {
    is_active?: boolean;
    has_login?: boolean;
    role_type?: 'STAFF' | 'MEMBER';
    search?: string;
  }): Promise<StaffMember[]> {
    return staffService.getStaff(params);
  },

  async getStaffMember(id: string): Promise<StaffMember> {
    return api.get<StaffMember>(`/staff/${id}/`);
  },

  async createStaff(payload: CreateStaffPayload): Promise<StaffMember> {
    return staffService.createStaff(payload);
  },

  async updateStaff(id: string, payload: Partial<CreateStaffPayload>): Promise<StaffMember> {
    return staffService.updateStaff(id, payload);
  },

  async deleteStaff(id: string): Promise<void> {
    return api.delete<void>(`/staff/${id}/`);
  },

  async getStaffLedger(id: string): Promise<{
    staff: StaffMember;
    total_earned: string;
    total_paid: string;
    balance_due: string;
    recent_attendances: StaffAttendance[];
    recent_payouts: StaffPayout[];
  }> {
    return api.get(`/staff/${id}/ledger/`);
  },

  async getStaffSummary(): Promise<StaffSummary> {
    return api.get<StaffSummary>('/staff/summary/');
  },

  async getDailySheet(date?: string): Promise<{
    date: string;
    sheet: DailySheetItem[];
    marked_count: number;
    total_staff: number;
  }> {
    return staffService.getDailySheet(date);
  },

  async bulkSaveAttendance(payload: {
    date: string;
    attendances: {
      staff_id: string;
      status: AttendanceStatus;
      notes?: string;
      cash_paid?: string;
      gpay_paid?: string;
    }[];
  }): Promise<{ message: string; count: number }> {
    return api.post('/staff-attendance/bulk-save/', payload);
  },

  async getAttendances(params?: {
    date?: string;
    staff?: string;
    month?: string;
    status?: string;
  }): Promise<StaffAttendance[]> {
    return staffService.getAttendances(params);
  },

  async getPayouts(params?: {
    staff?: string;
    date?: string;
    payout_type?: string;
    payment_method?: string;
  }): Promise<StaffPayout[]> {
    return staffService.getPayouts(params);
  },

  async createPayout(payload: {
    staff: string;
    amount: string;
    payout_type: string;
    payment_method: string;
    date?: string;
    reference?: string;
    notes?: string;
  }): Promise<StaffPayout> {
    return api.post<StaffPayout>('/staff-payouts/', payload);
  },

  async deletePayout(id: string): Promise<void> {
    return api.delete<void>(`/staff-payouts/${id}/`);
  },
};
