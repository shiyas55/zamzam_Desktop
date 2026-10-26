/**
 * Zamzam Foods — Unified Typed API Client (`src/api/client.ts`)
 *
 * Built for high-performance desktop and web runtimes:
 * - Dual-Authentication: Bearer token header + HttpOnly cookie credentials
 * - Single-flight promise mutex to coalesce concurrent token refreshes
 * - Strictly typed responses and error normalization
 * - Zero full-page reloads
 */

import { apiClient, API_BASE_URL } from '../services/apiClient';

export interface ApiErrorResponse {
  message: string;
  status: number;
  data?: any;
  errors?: Record<string, string[]>;
}

export class ApiError extends Error {
  status: number;
  data?: any;
  errors?: Record<string, string[]>;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
    if (data && typeof data === 'object') {
      if (data.errors && typeof data.errors === 'object') {
        this.errors = data.errors;
      } else {
        this.errors = data;
      }
    }
  }
}

/**
 * Normalizes unknown errors into a clean ApiError with user-friendly message
 */
export function normalizeApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  if (err instanceof Error) {
    return new ApiError(err.message, 0);
  }
  return new ApiError('An unexpected network error occurred.', 0);
}

/**
 * Base Typed Request Client
 */
export async function request<T>(
  endpoint: string,
  options: RequestInit & { params?: Record<string, string | number | boolean | undefined> } = {}
): Promise<T> {
  try {
    const method = (options.method || 'GET').toUpperCase();
    let res: any;

    if (method === 'GET') {
      res = await apiClient.get<T>(endpoint, options.params);
    } else if (method === 'POST') {
      const body = options.body ? (typeof options.body === 'string' ? JSON.parse(options.body) : options.body) : undefined;
      res = await apiClient.post<T>(endpoint, body);
    } else if (method === 'PUT') {
      const isForm = typeof FormData !== 'undefined' && options.body instanceof FormData;
      res = await apiClient.request<T>(endpoint, {
        method: 'PUT',
        body: isForm ? (options.body as FormData) : options.body,
      });
    } else if (method === 'PATCH') {
      const body = options.body ? (typeof options.body === 'string' ? JSON.parse(options.body) : options.body) : undefined;
      res = await apiClient.patch<T>(endpoint, body);
    } else if (method === 'DELETE') {
      res = await apiClient.delete<T>(endpoint);
    } else {
      res = await apiClient.request<T>(endpoint, options);
    }

    return res as T;
  } catch (err: any) {
    const status = err?.status || err?.response?.status || 0;
    const message = err?.message || 'Network request failed';
    const data = err?.data || err?.response?.data;
    throw new ApiError(message, status, data);
  }
}

export const api = {
  get: <T>(endpoint: string, params?: Record<string, string | number | boolean | undefined>) =>
    request<T>(endpoint, { method: 'GET', params }),
  post: <T>(endpoint: string, body?: any) =>
    request<T>(endpoint, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  put: <T>(endpoint: string, body?: any) =>
    request<T>(endpoint, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(endpoint: string, body?: any) =>
    request<T>(endpoint, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(endpoint: string) =>
    request<T>(endpoint, { method: 'DELETE' }),
};

export { API_BASE_URL };
