import { apiClient } from './apiClient';

export interface WhatsAppMessageItem {
  id: string;
  whatsapp_message_id: string;
  direction: 'inbound' | 'outbound';
  message_type: 'text' | 'image' | 'document' | 'audio' | 'voice' | 'video' | 'other';
  text: string;
  media_id?: string;
  media_url?: string;
  timestamp: string;
  created_at: string;
}

export interface WhatsAppConversationItem {
  id: string;
  shop: string;
  whatsapp_phone: string;
  last_message: string;
  last_message_at: string | null;
  unread_count: number;
  contact_name: string;
  customer?: {
    id: string;
    name: string;
    owner_name?: string;
    phone?: string;
    route_name?: string;
    current_balance?: string;
  } | null;
  created_at: string;
  messages?: WhatsAppMessageItem[];
}

export const whatsappService = {
  /**
   * Fetches real incoming WhatsApp conversations for the current shop/tenant.
   * Supports search query filtering by shop name, owner, phone, or message text.
   */
  async getConversations(searchQuery?: string): Promise<WhatsAppConversationItem[]> {
    const params: Record<string, string | number | boolean | undefined> = {};
    if (searchQuery && searchQuery.trim()) {
      params.q = searchQuery.trim();
    }
    const response = await apiClient.get<any>('/whatsapp/conversations/', params);
    if (Array.isArray(response)) {
      return response;
    }
    if (response && Array.isArray(response.results)) {
      return response.results;
    }
    return [];
  },

  /**
   * Fetches details and messages for a single WhatsApp conversation thread.
   */
  async getConversationDetail(id: string): Promise<WhatsAppConversationItem> {
    return apiClient.get<WhatsAppConversationItem>(`/whatsapp/conversations/${id}/`);
  },

  /**
   * Fetches all chronological messages for a conversation thread.
   */
  async getMessages(conversationId: string): Promise<WhatsAppMessageItem[]> {
    const response = await apiClient.get<any>(`/whatsapp/conversations/${conversationId}/messages/`);
    if (Array.isArray(response)) {
      return response;
    }
    if (response && Array.isArray(response.results)) {
      return response.results;
    }
    return [];
  },

  /**
   * Gets or initializes an active WhatsApp conversation for a specific Zamzam customer ID.
   * Guarantees 2-way seamless customer/shop search -> WhatsApp chat navigation.
   */
  async getCustomerConversation(customerId: string): Promise<WhatsAppConversationItem> {
    return apiClient.get<WhatsAppConversationItem>(`/whatsapp/customer/${customerId}/`);
  },
};
