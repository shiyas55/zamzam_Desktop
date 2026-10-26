import { api } from './client';
import { Order } from '../types';

export interface OrderItemInput {
  product_id: string;
  quantity: number;
  unit_price?: string;
}

export interface CreateOrderPayload {
  customer_id: string;
  driver_id?: string | null;
  order_date?: string;
  order_number?: string;
  shop_expense?: string;
  shop_expense_notes?: string;
  notes?: string;
  items: OrderItemInput[];
}

export interface UpdateOrderPayload {
  customer_id?: string;
  order_date?: string;
  order_number?: string;
  items?: OrderItemInput[];
  driver_id?: string | null;
  route_id?: string | null;
  shop_expense?: string;
  shop_expense_notes?: string;
  notes?: string;
}

export interface OrderFilterParams {
  route?: string;
  status?: string;
  date?: string;
  customer?: string;
  search?: string;
  all?: boolean;
}

export const ordersApi = {
  async getOrders(params?: OrderFilterParams): Promise<Order[]> {
    const queryParams: Record<string, string | boolean | undefined> = {
      all: 'true',
      page_size: '2000',
      route: params?.route,
      status: params?.status,
      date: params?.date,
      customer: params?.customer,
      search: params?.search,
    };

    const data = await api.get<{ results?: Order[]; next?: string | null } | Order[]>('/orders/', queryParams);
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

  async getOrder(id: string): Promise<Order> {
    return api.get<Order>(`/orders/${id}/`);
  },

  async createOrder(payload: CreateOrderPayload): Promise<Order> {
    return api.post<Order>('/orders/', payload);
  },

  async updateOrder(id: string, payload: UpdateOrderPayload): Promise<Order> {
    return api.patch<Order>(`/orders/${id}/`, payload);
  },

  async updateOrderStatus(id: string, status: string): Promise<Order> {
    return api.patch<Order>(`/orders/${id}/`, { status });
  },

  async reopenOrder(id: string, reason: string): Promise<Order> {
    return api.post<Order>(`/orders/${id}/reopen/`, { reason });
  },

  async deleteOrder(id: string): Promise<void> {
    return api.delete<void>(`/orders/${id}/`);
  },
};
