import { apiClient } from './apiClient';
import { Product } from '../types';

export const productService = {
  async getProducts(): Promise<Product[]> {
    const data = await apiClient.get<{ results?: Product[] } | Product[]>('/products/', { all: 'true', page_size: '1000' });
    return Array.isArray(data) ? data : data.results || [];
  },

  async updateProductPrice(id: string, unit_price: string): Promise<Product> {
    return apiClient.patch<Product>(`/products/${id}/`, { unit_price });
  },

  async updateProduct(id: string, updates: Partial<{
    name: string;
    code: string;
    description: string;
    unit_price: string;
    packet_size: string;
    order_number?: number;
    skip_in_entry?: boolean;
    is_active: boolean;
  }>): Promise<Product> {
    return apiClient.patch<Product>(`/products/${id}/`, updates);
  },

  async deleteProduct(id: string): Promise<void> {
    return apiClient.delete(`/products/${id}/`);
  },

  async createProduct(product: {
    name: string;
    code: string;
    description: string;
    unit_price: string;
    packet_size: string;
    order_number?: number;
    skip_in_entry?: boolean;
    is_active?: boolean;
  }): Promise<Product> {
    return apiClient.post<Product>('/products/', product);
  },
};
