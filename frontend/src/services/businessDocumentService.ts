import { apiClient } from './apiClient';

export type BusinessDocumentType =
  | 'FSSAI_LICENSE'
  | 'GST_CERTIFICATE'
  | 'TRADE_LICENSE'
  | 'SHOP_ACT'
  | 'FIRE_NOC'
  | 'POLLUTION_NOC'
  | 'BANK_DOCUMENT'
  | 'INSURANCE'
  | 'RENT_AGREEMENT'
  | 'PAN_CARD'
  | 'UDYAM'
  | 'HALAL_CERT'
  | 'QUALITY_CERT'
  | 'OTHER';

export interface BusinessDocument {
  id: string;
  title: string;
  document_type: BusinessDocumentType;
  document_type_display?: string;
  file: string;
  file_url: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  document_number?: string;
  issuing_authority?: string;
  issue_date?: string | null;
  expiry_date?: string | null;
  notes?: string;
  is_active: boolean;
  uploaded_by?: string | null;
  uploaded_by_name?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface BusinessDocumentBatchPayload {
  document_type: BusinessDocumentType;
  title?: string;
  document_number?: string;
  issuing_authority?: string;
  issue_date?: string;
  expiry_date?: string;
  notes?: string;
  is_active?: boolean;
  files: File[];
}

export const businessDocumentService = {
  async getDocuments(params?: {
    document_type?: string;
    is_expired?: string;
    is_active?: string;
    search?: string;
  }): Promise<BusinessDocument[]> {
    const query: Record<string, string | undefined> = {
      page_size: '2000',
      ...params,
    };
    const data = await apiClient.get<{ results?: BusinessDocument[] } | BusinessDocument[]>(
      '/business-documents/',
      query
    );
    return Array.isArray(data) ? data : data.results || [];
  },

  async batchUpload(payload: BusinessDocumentBatchPayload): Promise<BusinessDocument[]> {
    const formData = new FormData();
    formData.append('document_type', payload.document_type);
    if (payload.title) formData.append('title', payload.title);
    if (payload.document_number) formData.append('document_number', payload.document_number);
    if (payload.issuing_authority) formData.append('issuing_authority', payload.issuing_authority);
    if (payload.issue_date) formData.append('issue_date', payload.issue_date);
    if (payload.expiry_date) formData.append('expiry_date', payload.expiry_date);
    if (payload.notes) formData.append('notes', payload.notes);
    formData.append('is_active', payload.is_active === false ? 'false' : 'true');
    payload.files.forEach((file) => formData.append('files', file));
    return apiClient.post<BusinessDocument[]>('/business-documents/batch-upload/', formData);
  },

  async updateDocument(id: string, updates: Partial<BusinessDocument>): Promise<BusinessDocument> {
    return apiClient.patch<BusinessDocument>(`/business-documents/${id}/`, updates);
  },

  async deleteDocument(id: string): Promise<void> {
    return apiClient.delete<void>(`/business-documents/${id}/`);
  },
};
