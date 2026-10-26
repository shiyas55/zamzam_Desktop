import { apiClient } from './apiClient';
import { CustomerDocument, CustomerDocumentBatchUploadPayload } from '../types';

export const customerDocumentService = {
  async getDocuments(params?: {
    customer?: string;
    route?: string;
    document_type?: string;
    is_expired?: string;
    search?: string;
    all?: string;
  }): Promise<CustomerDocument[]> {
    const query: Record<string, string | undefined> = {
      all: 'true',
      page_size: '2000',
      ...params,
    };
    const data = await apiClient.get<{ results?: CustomerDocument[]; next?: string | null } | CustomerDocument[]>(
      '/customer-documents/',
      query
    );
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

  async getDocument(id: string): Promise<CustomerDocument> {
    return apiClient.get<CustomerDocument>(`/customer-documents/${id}/`);
  },

  async createDocument(formData: FormData): Promise<CustomerDocument> {
    return apiClient.post<CustomerDocument>('/customer-documents/', formData);
  },

  async batchUpload(payload: CustomerDocumentBatchUploadPayload): Promise<CustomerDocument[]> {
    const formData = new FormData();
    formData.append('customer', payload.customer);
    if (payload.document_type) formData.append('document_type', payload.document_type);
    if (payload.title) formData.append('title', payload.title);
    if (payload.document_number) formData.append('document_number', payload.document_number);
    if (payload.expiry_date) formData.append('expiry_date', payload.expiry_date);
    if (payload.notes) formData.append('notes', payload.notes);

    payload.files.forEach((file) => {
      formData.append('files', file);
    });

    return apiClient.post<CustomerDocument[]>('/customer-documents/batch-upload/', formData);
  },

  async updateDocument(id: string, updates: Partial<CustomerDocument>): Promise<CustomerDocument> {
    return apiClient.patch<CustomerDocument>(`/customer-documents/${id}/`, updates);
  },

  async deleteDocument(id: string): Promise<void> {
    return apiClient.delete<void>(`/customer-documents/${id}/`);
  },
};
