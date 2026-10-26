import { apiClient } from './apiClient';
import { Delivery } from '../types';

export const deliveryService = {
  async getDeliveries(params?: {
    route?: string;
    status?: string;
    date?: string;
    all?: string;
    page_size?: string;
  }): Promise<Delivery[]> {
    const queryParams: Record<string, string | undefined> = { all: 'true', page_size: '2000', ...params };
    const data = await apiClient.get<{ results?: Delivery[]; next?: string | null } | Delivery[]>('/deliveries/', queryParams);
    let items = Array.isArray(data) ? data : data.results || [];
    let nextUrl = !Array.isArray(data) ? data.next : null;
    while (nextUrl) {
      try {
        const parsed = new URL(nextUrl, window.location.origin);
        const endpoint = parsed.pathname.replace(/^\/api\/v1/, '') + parsed.search;
        const pageRes: any = await apiClient.get(endpoint);
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

  async getDelivery(id: string): Promise<Delivery> {
    return apiClient.get<Delivery>(`/deliveries/${id}/`);
  },

  async completeDelivery(id: string, payload: {
    recipient_name?: string;
    notes?: string;
  }): Promise<Delivery> {
    return apiClient.post<Delivery>(`/deliveries/${id}/complete/`, payload);
  },

  async markNotDelivered(id: string, payload: {
    failed_reason: string;
    notes?: string;
  }): Promise<Delivery> {
    return apiClient.post<Delivery>(`/deliveries/${id}/mark-not-delivered/`, payload);
  },

  async assignDriver(id: string, payload: {
    driver_id: string;
    allow_cross_route?: boolean;
    notes?: string;
  }): Promise<Delivery> {
    return apiClient.post<Delivery>(`/deliveries/${id}/assign-driver/`, payload);
  },
};

