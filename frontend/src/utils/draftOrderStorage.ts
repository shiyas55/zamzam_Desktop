/**
 * Zamzam Foods — Browser Storage Utility
 *
 * Local Chrome storage of order drafts and dates has been fully removed.
 * All order data, quantities, amounts, and payments are stored directly in the database.
 * This prevents stale Chrome drafts from overriding real database values on page reloads.
 */

export interface OrderDraft {
  customerId: string;
  orderDate: string;
  kubbusQty?: string;
  romaliQty?: string;
  productQuantities?: Record<string, string>;
  cashAmount: string;
  gpayAmount: string;
  discountAmount?: string;
  updatedAt: number;
}

const DRAFT_PREFIX = 'zamzam_order_draft_';

export const draftOrderStorage = {
  getDraft(_date: string, _customerId: string): OrderDraft | null {
    return null;
  },

  getAllDraftsForDate(_date: string): Record<string, OrderDraft> {
    return {};
  },

  saveDraft(_draft: OrderDraft): void {
    // Drafts are intentionally NOT stored in Chrome's localStorage.
    // Database is the single authoritative source of truth.
  },

  clearDraft(date: string, customerId: string): void {
    try {
      localStorage.removeItem(`${DRAFT_PREFIX}${date}_${customerId}`);
    } catch {
      // Ignore
    }
  },

  clearAllDraftsForDate(date: string): void {
    try {
      const toRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(`${DRAFT_PREFIX}${date}_`)) {
          toRemove.push(key);
        }
      }
      toRemove.forEach((k) => localStorage.removeItem(k));
    } catch {
      // Ignore
    }
  },

  /**
   * Purges all stale order drafts, stored dates, and cached data from Chrome localStorage.
   */
  clearAllChromeStorage(): void {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (
          key &&
          (key.startsWith(DRAFT_PREFIX) ||
            key === 'zamzam_selected_order_date' ||
            key === 'zamzam_pricing_cache')
        ) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
    } catch {
      // Ignore
    }
  },
};
