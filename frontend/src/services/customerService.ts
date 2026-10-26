import { apiClient } from './apiClient';
import { Customer } from '../types';

export const customerService = {
  async getCustomers(routeId?: string, search?: string, all: boolean = true): Promise<Customer[]> {
    const params: Record<string, string | undefined> = {};
    if (routeId) params.route = routeId;
    if (search) params.search = search;
    if (all) {
      params.all = 'true';
      params.page_size = '2000';
    }
    const data = await apiClient.get<{ results?: Customer[]; next?: string | null } | Customer[]>('/customers/', params);
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

  async getCustomer(id: string): Promise<Customer> {
    return apiClient.get<Customer>(`/customers/${id}/`);
  },

  async createCustomer(customer: {
    name: string;
    owner_name?: string;
    phone: string;
    alternative_phone?: string;
    address: string;
    landmark?: string;
    route: string;
    credit_limit?: string;
    opening_balance?: string;
    notes?: string;
    product_prices?: Array<{ product_id: string; price: string }>;
  }): Promise<Customer> {
    return apiClient.post<Customer>('/customers/', customer);
  },

  async updateCustomer(id: string, updates: Partial<Customer>): Promise<Customer> {
    return apiClient.patch<Customer>(`/customers/${id}/`, updates);
  },

  async deleteCustomer(id: string): Promise<void> {
    return apiClient.delete<void>(`/customers/${id}/`);
  },

  async setBalance(id: string, balance: string, date?: string, notes?: string): Promise<{ id: string; name: string; current_balance: string }> {
    return apiClient.post<{ id: string; name: string; current_balance: string }>(`/customers/${id}/set-balance/`, { balance, date, notes });
  },

  async getCustomerPricing(id: string): Promise<import('../types').CustomerPricingOverviewItem[]> {
    return apiClient.get<import('../types').CustomerPricingOverviewItem[]>(`/customers/${id}/pricing/`);
  },

  async setCustomerPricing(
    id: string,
    payload: { product_id: string; price: string; is_active?: boolean }
  ): Promise<import('../types').CustomerProductPrice> {
    return apiClient.post<import('../types').CustomerProductPrice>(`/customers/${id}/pricing/`, payload);
  },

  async getCustomerSummary(id: string): Promise<import('../types').CustomerDetailSummary> {
    return apiClient.get<import('../types').CustomerDetailSummary>(`/customers/${id}/summary/`);
  },

  async getBalancesForDate(date: string): Promise<Record<string, string>> {
    return apiClient.get<Record<string, string>>('/customers/balances-for-date/', { date });
  },
};
