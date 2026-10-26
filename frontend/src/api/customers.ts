import { api } from './client';
import { Customer, CustomerPricingOverviewItem, CustomerProductPrice, CustomerDetailSummary } from '../types';

export interface CreateCustomerPayload {
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
}

export interface CustomerFilterParams {
  route?: string;
  search?: string;
  all?: boolean;
}

export const customersApi = {
  async getCustomers(params?: CustomerFilterParams): Promise<Customer[]> {
    const queryParams: Record<string, string | boolean | undefined> = {
      route: params?.route,
      search: params?.search,
      all: params?.all ?? true,
      page_size: '2000',
    };

    const data = await api.get<{ results?: Customer[]; next?: string | null } | Customer[]>('/customers/', queryParams);
    let items = Array.isArray(data) ? data : data.results || [];
    let nextUrl = !Array.isArray(data) ? data.next : null;

    while (nextUrl) {
      try {
        const parsed = new URL(nextUrl, window.location.origin);
        const endpoint = parsed.pathname.replace(/^\/api\/v1/, '') + parsed.search;
        const pageRes: any = await api.get(endpoint);
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
    return api.get<Customer>(`/customers/${id}/`);
  },

  async createCustomer(payload: CreateCustomerPayload): Promise<Customer> {
    return api.post<Customer>('/customers/', payload);
  },

  async updateCustomer(id: string, updates: Partial<Customer>): Promise<Customer> {
    return api.patch<Customer>(`/customers/${id}/`, updates);
  },

  async deleteCustomer(id: string): Promise<void> {
    return api.delete<void>(`/customers/${id}/`);
  },

  async setBalance(id: string, balance: string, date?: string, notes?: string): Promise<{ id: string; name: string; current_balance: string }> {
    return api.post<{ id: string; name: string; current_balance: string }>(`/customers/${id}/set-balance/`, { balance, date, notes });
  },

  async getCustomerPricing(id: string): Promise<CustomerPricingOverviewItem[]> {
    return api.get<CustomerPricingOverviewItem[]>(`/customers/${id}/pricing/`);
  },

  async setCustomerPricing(
    id: string,
    payload: { product_id: string; price: string; is_active?: boolean }
  ): Promise<CustomerProductPrice> {
    return api.post<CustomerProductPrice>(`/customers/${id}/pricing/`, payload);
  },

  async getCustomerSummary(id: string): Promise<CustomerDetailSummary> {
    return api.get<CustomerDetailSummary>(`/customers/${id}/summary/`);
  },

  async getBalancesForDate(date: string): Promise<Record<string, string>> {
    return api.get<Record<string, string>>('/customers/balances-for-date/', { date });
  },
};
