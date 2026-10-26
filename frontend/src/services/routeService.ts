import { apiClient } from './apiClient';
import { Route, Driver } from '../types';

export interface CreateDriverPayload {
  name: string;
  username?: string;
  password?: string;
  phone_number?: string;
  vehicle_number?: string;
  license_number?: string;
  assigned_route?: string | null;
  is_active?: boolean;
}

export const routeService = {
  async getRoutes(): Promise<Route[]> {
    const data = await apiClient.get<{ results?: Route[] } | Route[]>('/routes/', { all: 'true', page_size: '1000' });
    return Array.isArray(data) ? data : data.results || [];
  },

  async getDrivers(): Promise<Driver[]> {
    const data = await apiClient.get<{ results?: Driver[] } | Driver[]>('/drivers/', { all: 'true', page_size: '1000' });
    return Array.isArray(data) ? data : data.results || [];
  },

  async getMyDriverProfile(): Promise<Driver> {
    return apiClient.get<Driver>('/drivers/my_profile/');
  },

  async createRoute(route: { name: string; code: string; description?: string; is_active?: boolean }): Promise<Route> {
    return apiClient.post<Route>('/routes/', route);
  },

  async updateRoute(id: string, updates: Partial<{ name: string; code: string; description: string; is_active: boolean }>): Promise<Route> {
    return apiClient.patch<Route>(`/routes/${id}/`, updates);
  },

  async deleteRoute(id: string): Promise<void> {
    return apiClient.delete(`/routes/${id}/`);
  },

  async createDriver(payload: CreateDriverPayload): Promise<Driver> {
    return apiClient.post<Driver>('/drivers/', payload);
  },

  async updateDriver(id: string, updates: Partial<Driver | CreateDriverPayload>): Promise<Driver> {
    return apiClient.patch<Driver>(`/drivers/${id}/`, updates);
  },

  async deleteDriver(id: string): Promise<void> {
    return apiClient.delete(`/drivers/${id}/`);
  },
};
