import { apiClient } from './apiClient';
import {
  StaffMember,
  StaffAttendance,
  StaffPayout,
  StaffSummary,
  DailySheetItem,
  AttendanceStatus,
} from '../types';

export interface CreateStaffPayload {
  user?: string | null;
  full_name: string;
  phone_number?: string;
  role_type?: 'STAFF' | 'MEMBER';
  designation?: string;
  joined_date?: string;
  wage_type?: 'DEFAULT_SLAB' | 'CUSTOM';
  custom_daily_wage?: string | null;
  proof_document?: File | null;
  notes?: string;
  is_active?: boolean;
}

export const staffService = {
  async getStaff(params?: {
    is_active?: boolean;
    has_login?: boolean;
    role_type?: 'STAFF' | 'MEMBER';
    search?: string;
  }): Promise<StaffMember[]> {
    const data = await apiClient.get<{ results?: StaffMember[] } | StaffMember[]>('/staff/', params);
    return Array.isArray(data) ? data : data.results || [];
  },

  async getStaffMember(id: string): Promise<StaffMember> {
    return apiClient.get<StaffMember>(`/staff/${id}/`);
  },

  async createStaff(payload: CreateStaffPayload): Promise<StaffMember> {
    const form = new FormData();
    if (payload.user) form.append('user', payload.user);
    form.append('full_name', payload.full_name);
    if (payload.phone_number) form.append('phone_number', payload.phone_number);
    if (payload.role_type) form.append('role_type', payload.role_type);
    if (payload.designation) form.append('designation', payload.designation);
    if (payload.joined_date) form.append('joined_date', payload.joined_date);
    if (payload.wage_type) form.append('wage_type', payload.wage_type);
    if (payload.custom_daily_wage !== undefined && payload.custom_daily_wage !== null && payload.custom_daily_wage !== '') {
      form.append('custom_daily_wage', payload.custom_daily_wage);
    }
    if (payload.proof_document) {
      form.append('proof_document', payload.proof_document);
    }
    if (payload.notes) form.append('notes', payload.notes);
    form.append('is_active', payload.is_active !== undefined ? String(payload.is_active) : 'true');

    return apiClient.post<StaffMember>('/staff/', form);
  },

  async updateStaff(id: string, payload: Partial<CreateStaffPayload>): Promise<StaffMember> {
    const form = new FormData();
    if (payload.user !== undefined) form.append('user', payload.user || '');
    if (payload.full_name) form.append('full_name', payload.full_name);
    if (payload.phone_number !== undefined) form.append('phone_number', payload.phone_number || '');
    if (payload.role_type) form.append('role_type', payload.role_type);
    if (payload.designation) form.append('designation', payload.designation);
    if (payload.joined_date) form.append('joined_date', payload.joined_date);
    if (payload.wage_type) form.append('wage_type', payload.wage_type);
    if (payload.custom_daily_wage !== undefined) {
      form.append('custom_daily_wage', payload.custom_daily_wage || '');
    }
    if (payload.proof_document) {
      form.append('proof_document', payload.proof_document);
    }
    if (payload.notes !== undefined) form.append('notes', payload.notes || '');
    if (payload.is_active !== undefined) form.append('is_active', String(payload.is_active));

    return apiClient.patch<StaffMember>(`/staff/${id}/`, form);
  },

  async deleteStaff(id: string): Promise<void> {
    return apiClient.delete(`/staff/${id}/`);
  },

  async getStaffLedger(id: string): Promise<{
    staff: StaffMember;
    total_earned: string;
    total_paid: string;
    balance_due: string;
    recent_attendances: StaffAttendance[];
    recent_payouts: StaffPayout[];
  }> {
    return apiClient.get(`/staff/${id}/ledger/`);
  },

  async getStaffSummary(): Promise<StaffSummary> {
    return apiClient.get<StaffSummary>('/staff/summary/');
  },

  // Attendance Endpoints
  async getDailySheet(date?: string): Promise<{
    date: string;
    sheet: DailySheetItem[];
    marked_count: number;
    total_staff: number;
  }> {
    const params = date ? { date } : undefined;
    return apiClient.get('/staff-attendance/daily-sheet/', params);
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
    return apiClient.post('/staff-attendance/bulk-save/', payload);
  },

  async getAttendances(params?: {
    date?: string;
    staff?: string;
    month?: string;
    status?: string;
  }): Promise<StaffAttendance[]> {
    const data = await apiClient.get<{ results?: StaffAttendance[] } | StaffAttendance[]>('/staff-attendance/', params);
    return Array.isArray(data) ? data : data.results || [];
  },

  // Payout Endpoints
  async getPayouts(params?: {
    staff?: string;
    date?: string;
    payout_type?: string;
    payment_method?: string;
  }): Promise<StaffPayout[]> {
    const data = await apiClient.get<{ results?: StaffPayout[] } | StaffPayout[]>('/staff-payouts/', params);
    return Array.isArray(data) ? data : data.results || [];
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
    return apiClient.post<StaffPayout>('/staff-payouts/', payload);
  },

  async deletePayout(id: string): Promise<void> {
    return apiClient.delete(`/staff-payouts/${id}/`);
  },
};
