import { apiClient } from './apiClient';

export interface SystemSettings {
  id?: string;
  business_name: string;
  phone_number: string;
  gst_number: string;
  email: string;
  address: string;
  upi_id: string;
  invoice_footer_notes: string;
  is_whatsapp_enabled: boolean;
  is_self_order_enabled: boolean;
  is_order_discount_enabled?: boolean;
  is_driver_module_enabled?: boolean;
  is_maintenance_mode?: boolean;
  maintenance_message?: string;
  whatsapp_is_locked?: boolean;
  whatsapp_plan_name?: string;
  whatsapp_plan_expires_at?: string | null;
  whatsapp_license_key?: string;
  settings_pin_code?: string;
  created_at?: string;
  updated_at?: string;
}

export interface BackgroundServicesStatus {
  backend: {
    running: boolean;
    port: number;
    host: string;
  };
  whatsapp: {
    running: boolean;
    port: number;
    host: string;
    url: string;
  };
  autostart: {
    enabled: boolean;
    platform: string;
    method: string | null;
  };
  system: {
    platform: string;
    timestamp: string;
  };
}

export const settingsService = {
  async getSettings(): Promise<SystemSettings> {
    return apiClient.get<SystemSettings>('/settings/');
  },

  async updateSettings(payload: Partial<SystemSettings>): Promise<SystemSettings> {
    return apiClient.patch<SystemSettings>('/settings/', payload);
  },

  async verifyPin(pin: string): Promise<{ valid: boolean; message?: string }> {
    return apiClient.post<{ valid: boolean; message?: string }>('/settings/verify-pin/', { pin });
  },

  async resetPin(payload: { username: string; password: string; new_pin?: string }): Promise<{ success: boolean; message: string; pin?: string }> {
    return apiClient.post<{ success: boolean; message: string; pin?: string }>('/settings/reset-pin/', payload);
  },

  async getServicesStatus(): Promise<BackgroundServicesStatus> {
    return apiClient.get<BackgroundServicesStatus>('/services/status/');
  },

  async startBackgroundServices(action: 'start_services' | 'start_whatsapp' = 'start_services'): Promise<{ success: boolean; message: string; whatsapp_running: boolean }> {
    return apiClient.post<{ success: boolean; message: string; whatsapp_running: boolean }>('/services/manage/', { action });
  },

  async toggleAutostart(enable: boolean): Promise<{ success: boolean; message: string; autostart: BackgroundServicesStatus['autostart'] }> {
    return apiClient.post<{ success: boolean; message: string; autostart: BackgroundServicesStatus['autostart'] }>('/services/manage/', { action: 'toggle_autostart', enable });
  },
};
