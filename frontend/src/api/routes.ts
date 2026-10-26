import { api } from './client';
import { Route, Driver } from '../types';

export interface CreateRoutePayload {
  name: string;
  code: string;
  description?: string;
  is_active?: boolean;
}

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

export const routesApi = {
  async getRoutes(): Promise<Route[]> {
    const data = await api.get<{ results?: Route[] } | Route[]>('/routes/', { all: 'true', page_size: '1000' });
    return Array.isArray(data) ? data : data.results || [];
  },

  async getDrivers(): Promise<Driver[]> {
    const data = await api.get<{ results?: Driver[] } | Driver[]>('/drivers/', { all: 'true', page_size: '1000' });
    return Array.isArray(data) ? data : data.results || [];
  },

  async getMyDriverProfile(): Promise<Driver> {
    return api.get<Driver>('/drivers/my_profile/');
  },

  async createRoute(payload: CreateRoutePayload): Promise<Route> {
    return api.post<Route>('/routes/', payload);
  },

  async updateRoute(id: string, updates: Partial<CreateRoutePayload>): Promise<Route> {
    return api.patch<Route>(`/routes/${id}/`, updates);
  },

  async deleteRoute(id: string): Promise<void> {
    return api.delete<void>(`/routes/${id}/`);
  },

  async createDriver(payload: CreateDriverPayload): Promise<Driver> {
    return api.post<Driver>('/drivers/', payload);
  },

  async updateDriver(id: string, updates: Partial<Driver | CreateDriverPayload>): Promise<Driver> {
    return api.patch<Driver>(`/drivers/${id}/`, updates);
  },

  async deleteDriver(id: string): Promise<void> {
    return api.delete<void>(`/drivers/${id}/`);
  },
};
