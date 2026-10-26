import { api } from './client';
import { Product } from '../types';

export interface CreateProductPayload {
  name: string;
  code: string;
  description?: string;
  unit_price: string;
  packet_size?: string;
  order_number?: number;
  skip_in_entry?: boolean;
  is_active?: boolean;
}

export const productsApi = {
  async getProducts(): Promise<Product[]> {
    const data = await api.get<{ results?: Product[] } | Product[]>('/products/', { all: 'true', page_size: '1000' });
    const list = Array.isArray(data) ? data : data.results || [];
    return list.sort((a, b) => {
      const orderA = a.order_number ?? 999;
      const orderB = b.order_number ?? 999;
      if (orderA !== orderB) return orderA - orderB;
      return (a.created_at || '').localeCompare(b.created_at || '');
    });
  },

  async getProduct(id: string): Promise<Product> {
    return api.get<Product>(`/products/${id}/`);
  },

  async createProduct(payload: CreateProductPayload): Promise<Product> {
    return api.post<Product>('/products/', payload);
  },

  async updateProductPrice(id: string, unit_price: string): Promise<Product> {
    return api.patch<Product>(`/products/${id}/`, { unit_price });
  },

  async updateProduct(id: string, updates: Partial<CreateProductPayload>): Promise<Product> {
    return api.patch<Product>(`/products/${id}/`, updates);
  },

  async deleteProduct(id: string): Promise<void> {
    return api.delete<void>(`/products/${id}/`);
  },
};
