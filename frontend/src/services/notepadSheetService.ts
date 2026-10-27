import { apiClient } from './apiClient';

export interface NoteItem {
  id: string;
  title: string;
  content: string;
  updatedAt: string;
}

export interface SheetRow {
  id: string;
  [key: string]: string;
}

export interface NotepadSheetDataResponse {
  status: string;
  notes: NoteItem[];
  sales_sheet: {
    title: string;
    rows: SheetRow[];
    updated_at?: string;
  };
  expense_sheet: {
    title: string;
    rows: SheetRow[];
    updated_at?: string;
  };
}

export interface NotepadSheetSavePayload {
  notes?: NoteItem[];
  sales_sheet?: {
    title: string;
    rows: SheetRow[];
  };
  expense_sheet?: {
    title: string;
    rows: SheetRow[];
  };
}

export const notepadSheetService = {
  async getData(): Promise<NotepadSheetDataResponse> {
    return apiClient.get<NotepadSheetDataResponse>('/notepad-sheet/');
  },

  async saveData(payload: NotepadSheetSavePayload): Promise<{ status: string; message: string; saved_at?: string }> {
    return apiClient.post('/notepad-sheet/', payload);
  },
};
