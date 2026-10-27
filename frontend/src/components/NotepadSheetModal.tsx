import React, { useState, useEffect, useRef } from 'react';
import {
  FileSpreadsheet,
  FileText,
  Plus,
  Trash2,
  Copy,
  Check,
  Download,
  Share2,
  X,
  Maximize2,
  Minimize2,
  Search,
  RotateCcw,
  Printer,
  BookOpen,
  Database,
  RefreshCw,
  Sparkles,
  ChevronDown,
  CheckSquare,
  List,
} from 'lucide-react';
import { sendWhatsAppTextMessageViaBridge } from '../utils/whatsappBridgeUtils';
import { notepadSheetService } from '../services/notepadSheetService';

interface NoteItem {
  id: string;
  title: string;
  content: string;
  updatedAt: string;
}

interface SheetRow {
  id: string;
  [key: string]: string;
}

interface SheetColumn {
  key: string;
  name: string;
  isNumeric?: boolean;
}

export type SheetMode = 'SALES' | 'EXPENSE';

const SALES_COLUMNS: SheetColumn[] = [
  { key: 'colA', name: 'Item / Shop Name' },
  { key: 'colB', name: 'Details / Route' },
  { key: 'colC', name: 'Quantity', isNumeric: true },
  { key: 'colD', name: 'Rate (₹)', isNumeric: true },
  { key: 'colE', name: 'Total (₹)', isNumeric: true },
];

const EXPENSE_COLUMNS: SheetColumn[] = [
  { key: 'colA', name: 'Date' },
  { key: 'colB', name: 'Expense Category' },
  { key: 'colC', name: 'Paid To / Remarks' },
  { key: 'colD', name: 'Payment Mode' },
  { key: 'colE', name: 'Amount (₹)', isNumeric: true },
];

const INITIAL_ROWS: SheetRow[] = [
  { id: '1', colA: 'Chappathi (Regular)', colB: '10 pcs packet', colC: '50', colD: '40', colE: '2000' },
  { id: '2', colA: 'Porotta (Special)', colB: '5 pcs packet', colC: '30', colD: '50', colE: '1500' },
  { id: '3', colA: 'Wheat Paratha', colB: 'Packet', colC: '20', colD: '45', colE: '900' },
  { id: '4', colA: '', colB: '', colC: '', colD: '', colE: '' },
  { id: '5', colA: '', colB: '', colC: '', colD: '', colE: '' },
];

const INITIAL_EXPENSE_ROWS: SheetRow[] = [
  { id: '1', colA: new Date().toLocaleDateString('en-IN'), colB: 'Flour & Wheat Stock', colC: '10 bags flour from wholesaler', colD: 'Cash', colE: '3200' },
  { id: '2', colA: new Date().toLocaleDateString('en-IN'), colB: 'Cooking Oil & Butter', colC: '20L oil tin', colD: 'UPI', colE: '2200' },
  { id: '3', colA: new Date().toLocaleDateString('en-IN'), colB: 'Vehicle Fuel & Diesel', colC: 'Route 1 Van diesel', colD: 'Cash', colE: '950' },
  { id: '4', colA: new Date().toLocaleDateString('en-IN'), colB: 'Packaging Bags', colC: '500 packaging packets', colD: 'Cash', colE: '450' },
  { id: '5', colA: new Date().toLocaleDateString('en-IN'), colB: 'Staff Tea & Snacks', colC: 'Evening kitchen tea', colD: 'Cash', colE: '140' },
];

export interface SampleTemplate {
  id: string;
  name: string;
  category: 'SALES' | 'EXPENSE' | 'NOTES';
  badge: string;
  description: string;
  title: string;
  rows?: SheetRow[];
  content?: string;
}

export const SAMPLE_TEMPLATES: SampleTemplate[] = [
  {
    id: 'tpl-bread-sales',
    name: '🍞 Bread & Porotta Wholesale Sales',
    category: 'SALES',
    badge: 'Wholesale Sales',
    description: 'Pre-filled standard bakery batch items, quantities, wholesale rates & auto-totals',
    title: 'Daily Bread & Porotta Wholesale Sales Sheet',
    rows: [
      { id: '1', colA: 'Chappathi (Regular 10s)', colB: 'Fresh Kitchen Batch', colC: '80', colD: '40', colE: '3200' },
      { id: '2', colA: 'Porotta (Special 5s)', colB: 'Layered Kerala Style', colC: '60', colD: '50', colE: '3000' },
      { id: '3', colA: 'Wheat Paratha (Packet)', colB: '100% Atta Batch', colC: '40', colD: '45', colE: '1800' },
      { id: '4', colA: 'Burger Bun (6 pcs packet)', colB: 'Sesame Seed Topping', colC: '35', colD: '35', colE: '1225' },
      { id: '5', colA: 'White Sliced Bread (Large)', colB: '400g Premium Loaf', colC: '50', colD: '38', colE: '1900' },
      { id: '6', colA: 'Sweet Cream Bun (Single)', colB: 'Vanilla Cream Filled', colC: '30', colD: '20', colE: '600' },
    ],
  },
  {
    id: 'tpl-route-delivery',
    name: '🚐 Route 1 Delivery & Cash Collection',
    category: 'SALES',
    badge: 'Route Distribution',
    description: 'Track shop deliveries, crates count, unit rates and total cash to collect',
    title: 'Route 1 Shop Deliveries & Daily Collection',
    rows: [
      { id: '1', colA: 'Al Madina Supermarket', colB: 'Route 1 - Main Bazaar', colC: '45', colD: '40', colE: '1800' },
      { id: '2', colA: 'Golden Bakery & Cool Bar', colB: 'Route 1 - Bus Stand', colC: '30', colD: '45', colE: '1350' },
      { id: '3', colA: 'Kairali General Store', colB: 'Route 1 - East Gate', colC: '25', colD: '50', colE: '1250' },
      { id: '4', colA: 'City Hypermarket', colB: 'Route 1 - Market Road', colC: '60', colD: '40', colE: '2400' },
      { id: '5', colA: 'Metro Food Court', colB: 'Route 1 - Junction', colC: '35', colD: '35', colE: '1225' },
    ],
  },
  {
    id: 'tpl-raw-materials',
    name: '📦 Raw Material Stock & Purchase',
    category: 'SALES',
    badge: 'Raw Stock',
    description: 'Track flour, atta, oil, yeast and packaging purchase bags, rates & costs',
    title: 'Bakery Raw Material Purchase & Stock Log',
    rows: [
      { id: '1', colA: 'Chakki Fresh Atta', colB: '50kg Jute Bag (Ashirwad)', colC: '10', colD: '380', colE: '3800' },
      { id: '2', colA: 'Maida All-Purpose Flour', colB: '50kg Bag (Premium)', colC: '15', colD: '410', colE: '6150' },
      { id: '3', colA: 'Refined Sunflower Oil', colB: '15 Litre Tin', colC: '4', colD: '1650', colE: '6600' },
      { id: '4', colA: 'Pure Vanaspati Ghee', colB: '15kg Tin', colC: '3', colD: '1450', colE: '4350' },
      { id: '5', colA: 'Active Dry Baking Yeast', colB: '500g Vacuum Pack', colC: '8', colD: '220', colE: '1760' },
      { id: '6', colA: 'Printed Poly Packaging Bags', colB: '1000 Pcs Bundle', colC: '5', colD: '450', colE: '2250' },
    ],
  },
  {
    id: 'tpl-daily-expenses',
    name: '💸 Daily Bakery Expenses & Fuel',
    category: 'EXPENSE',
    badge: 'Daily Expenses',
    description: 'Daily operational expenses including flour, cooking oil, van diesel and staff snacks',
    title: 'Zamzam Daily Business Expenses Sheet',
    rows: [
      { id: '1', colA: new Date().toLocaleDateString('en-IN'), colB: 'Flour & Wheat Stock', colC: '5 bags flour from wholesaler', colD: 'Cash', colE: '3200' },
      { id: '2', colA: new Date().toLocaleDateString('en-IN'), colB: 'Cooking Oil & Butter', colC: '20L oil tin for kitchen', colD: 'UPI', colE: '2200' },
      { id: '3', colA: new Date().toLocaleDateString('en-IN'), colB: 'Vehicle Fuel & Diesel', colC: 'Route 1 Delivery Van diesel', colD: 'Cash', colE: '950' },
      { id: '4', colA: new Date().toLocaleDateString('en-IN'), colB: 'Packaging Bags', colC: '500 food grade polybags', colD: 'Cash', colE: '450' },
      { id: '5', colA: new Date().toLocaleDateString('en-IN'), colB: 'Daily Wages & Labour', colC: 'Kitchen helper overtime', colD: 'Cash', colE: '700' },
      { id: '6', colA: new Date().toLocaleDateString('en-IN'), colB: 'Staff Tea & Snacks', colC: 'Morning and evening tea', colD: 'Cash', colE: '160' },
    ],
  },
  {
    id: 'tpl-vehicle-log',
    name: '⛽ Van Maintenance & Driver Allowance',
    category: 'EXPENSE',
    badge: 'Fleet & Fuel',
    description: 'Vehicle diesel, puncture repair, Fastag recharge and driver daily allowances',
    title: 'Delivery Fleet Maintenance & Fuel Sheet',
    rows: [
      { id: '1', colA: new Date().toLocaleDateString('en-IN'), colB: 'Vehicle Fuel & Diesel', colC: 'Route 1 Van Full Tank Diesel', colD: 'Cash', colE: '1850' },
      { id: '2', colA: new Date().toLocaleDateString('en-IN'), colB: 'Vehicle Maintenance', colC: 'Tyre puncture & air pressure check', colD: 'Cash', colE: '120' },
      { id: '3', colA: new Date().toLocaleDateString('en-IN'), colB: 'Toll & Parking', colC: 'Highway toll fastag recharge', colD: 'UPI', colE: '400' },
      { id: '4', colA: new Date().toLocaleDateString('en-IN'), colB: 'Driver Allowance', colC: 'Driver lunch & tea allowance', colD: 'Cash', colE: '150' },
    ],
  },
  {
    id: 'tpl-note-checklist',
    name: '📋 Morning Kitchen & Dispatch Checklist',
    category: 'NOTES',
    badge: 'Daily Checklist',
    description: 'Step-by-step checklist for oven heating, baking, packing, crates count & van dispatch',
    title: 'Morning Kitchen & Dispatch Checklist',
    content: `MORNING PRODUCTION & DISPATCH CHECKLIST
Date: ${new Date().toLocaleDateString('en-IN')}

☐ 04:30 AM - Oven pre-heating (220°C) & dough mixer check
☐ 05:00 AM - Chappathi & Porotta dough kneading completed
☐ 05:45 AM - First batch bread baking completed & cooling on racks
☐ 06:15 AM - Quality & heat-seal packaging inspection
☐ 06:45 AM - Route 1 crate counts verified against loading bill
☐ 07:00 AM - Delivery van loading completed & invoice bill book handed
☐ 07:15 AM - Driver cash float handed over (₹500 small change)
☐ 07:20 AM - Delivery vehicle departed on time`,
  },
  {
    id: 'tpl-note-suppliers',
    name: '📞 Wholesaler & Supplier Rate Card',
    category: 'NOTES',
    badge: 'Contacts Directory',
    description: 'Directory of verified flour mills, oil wholesalers, packaging suppliers & mechanics',
    title: 'Key Supplier Contacts & Purchase Rates',
    content: `ZAMZAM FOODS - KEY SUPPLIERS & CONTACT DIRECTORY

🌾 FLOUR & ATTA MILLS:
• Sri Venkateswara Flour Mills - 98470 12345 (Rate: ₹34/kg)
• Malabar Milling Co. - 97451 23456 (Atta: ₹38/kg)

🛢️ COOKING OIL & GHEE:
• Royal Wholesale Traders - 98765 43210 (15L Tin: ₹1,650)
• Ghee Wholesaler (Ramesh) - 94471 99887 (Vanaspati: ₹1,450/tin)

📦 PACKAGING & POLYBAGS:
• Modern Plastics & Paper - 98460 55443 (₹145/bundle 500s)
• Brand Label Printing Press - 99462 88771

⛽ VEHICLE & EMERGENCY:
• Highway IndianOil Fuel Pump - 0495 2345678 (Customer Acct #42)
• Van Mechanic (Salim Workshop) - 98461 12233
• Battery & Electric Auto Work - 97455 33221`,
  },
  {
    id: 'tpl-note-closing',
    name: '💰 Daily Cash Reconciliation & Drawer Closing',
    category: 'NOTES',
    badge: 'Cash Handover',
    description: 'Daily cash handover note for driver collection, counter sales, deductions & net drawer cash',
    title: 'Daily Cash Reconciliation & Handover',
    content: `═══════════════════════════════════════════════
ZAMZAM FOODS - DAILY CASH RECONCILIATION
Date: ${new Date().toLocaleDateString('en-IN')}
═══════════════════════════════════════════════

1. TOTAL CASH INFLOW:
• Route 1 Driver Cash Collection:   ₹ 14,500
• Counter Direct Cash Sales:        ₹  3,800
-----------------------------------------------
TOTAL CASH RECEIVED:                ₹ 18,300

2. DEDUCT CASH EXPENSES:
• Van Diesel Fuel:                - ₹    950
• Kitchen Helper Daily Wages:     - ₹  1,400
• Evening Staff Tea & Snacks:     - ₹    150
-----------------------------------------------
TOTAL CASH DEDUCTIONS:            - ₹  2,500

3. NET DRAWER CASH:
═══════════════════════════════════════════════
FINAL NET CASH IN HAND:             ₹ 15,800
═══════════════════════════════════════════════
Handed over by: Manager
Received by: Owner / Cash Drawer Verified ✓`,
  },
  {
    id: 'tpl-note-credit-reminders',
    name: '⚠️ Shop Credit & Payment Follow-up List',
    category: 'NOTES',
    badge: 'Follow-ups',
    description: 'Payment reminders and follow-up tracker for shops with pending balances',
    title: 'Shop Credit Follow-up & Collection Tasks',
    content: `TODAY'S SHOP PAYMENT FOLLOW-UP LIST
Priority calls for outstanding credit collection:

☐ City Hypermarket: ₹ 4,200
  → Call Manager at 11 AM (Promise made last Thursday)
☐ Golden Bakery & Cool Bar: ₹ 2,150
  → Promised GPay payment by 2 PM
☐ Metro Food Court: ₹ 3,400
  → Driver to collect cash during evening return route
☐ New Kerala Store: ₹ 1,850
  → Cheque to be collected tomorrow morning
☐ Highway Restaurant: ₹ 5,600
  → Call owner directly regarding overdue invoice #1042`,
  },
];

export const NotepadSheetModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
}> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'SHEET' | 'NOTES'>('SHEET');
  const [isFullScreen, setIsFullScreen] = useState(false);

  // --- NOTES STATE ---
  const [notes, setNotes] = useState<NoteItem[]>(() => {
    try {
      const saved = localStorage.getItem('zamzam_user_notes');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return [
      {
        id: '1',
        title: 'Daily Business Reminders',
        content: '1. Check flour and wheat stock delivery at 2 PM\n2. Follow up on Route 1 pending payments\n3. Service delivery van next Monday',
        updatedAt: new Date().toLocaleDateString('en-IN'),
      },
      {
        id: '2',
        title: 'Supplier Contacts & Price Rates',
        content: 'Flour Supplier: 9847012345 (₹32/kg)\nOil Wholesaler: 9876543210 (₹110/ltr)\nPackaging Bags: 9745123456 (₹140/bundle)',
        updatedAt: new Date().toLocaleDateString('en-IN'),
      },
    ];
  });

  const [activeNoteId, setActiveNoteId] = useState<string>(() => notes[0]?.id || '1');
  const [noteSearch, setNoteSearch] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);
  const [waStatus, setWaStatus] = useState<string | null>(null);
  type PaperTheme = 'RULED' | 'LEGAL' | 'GRID' | 'PLAIN';
  const [paperTheme, setPaperTheme] = useState<PaperTheme>(() => {
    return (localStorage.getItem('zamzam_note_paper_theme') as PaperTheme) || 'RULED';
  });
  const [fontSizeMode, setFontSizeMode] = useState<'NORMAL' | 'LARGE'>(() => {
    return (localStorage.getItem('zamzam_note_font_size') as 'NORMAL' | 'LARGE') || 'NORMAL';
  });
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    localStorage.setItem('zamzam_note_paper_theme', paperTheme);
  }, [paperTheme]);

  useEffect(() => {
    localStorage.setItem('zamzam_note_font_size', fontSizeMode);
  }, [fontSizeMode]);

  // --- SPREADSHEET STATE (Supports both SALES & EXPENSES modes) ---
  const [sheetMode, setSheetMode] = useState<SheetMode>(() => {
    return (localStorage.getItem('zamzam_sheet_active_mode') as SheetMode) || 'SALES';
  });

  const [salesRows, setSalesRows] = useState<SheetRow[]>(() => {
    try {
      const saved = localStorage.getItem('zamzam_sheet_rows');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return INITIAL_ROWS;
  });

  const [expenseRows, setExpenseRows] = useState<SheetRow[]>(() => {
    try {
      const saved = localStorage.getItem('zamzam_sheet_expense_rows');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return INITIAL_EXPENSE_ROWS;
  });

  const [salesTitle, setSalesTitle] = useState(() => {
    return localStorage.getItem('zamzam_sheet_title') || 'Zamzam Wholesale Sales & Calculation Sheet';
  });

  const [expenseTitle, setExpenseTitle] = useState(() => {
    return localStorage.getItem('zamzam_sheet_expense_title') || 'Zamzam Daily Business Expenses Sheet';
  });

  const columns = sheetMode === 'EXPENSE' ? EXPENSE_COLUMNS : SALES_COLUMNS;
  const rows = sheetMode === 'EXPENSE' ? expenseRows : salesRows;
  const setRows = (updater: React.SetStateAction<SheetRow[]>) => {
    if (sheetMode === 'EXPENSE') {
      setExpenseRows(updater);
    } else {
      setSalesRows(updater);
    }
  };
  const sheetTitle = sheetMode === 'EXPENSE' ? expenseTitle : salesTitle;
  const setSheetTitle = (val: string) => {
    if (sheetMode === 'EXPENSE') {
      setExpenseTitle(val);
    } else {
      setSalesTitle(val);
    }
  };

  // --- DATABASE SYNC STATE ---
  const [dbSyncStatus, setDbSyncStatus] = useState<'SYNCED' | 'SAVING' | 'ERROR' | 'IDLE' | 'LOADING'>('IDLE');
  const isInitialLoadRef = useRef(true);
  const saveDebounceTimerRef = useRef<any>(null);

  // 1. Load dynamic data from PostgreSQL / SQLite Database
  const loadFromDatabase = async () => {
    try {
      setDbSyncStatus('LOADING');
      const res = await notepadSheetService.getData();
      if (res && res.status === 'success') {
        if (res.notes && res.notes.length > 0) {
          setNotes(res.notes);
          try {
            localStorage.setItem('zamzam_user_notes', JSON.stringify(res.notes));
          } catch (_) {}
        }
        if (res.sales_sheet) {
          setSalesRows(res.sales_sheet.rows);
          setSalesTitle(res.sales_sheet.title);
          try {
            localStorage.setItem('zamzam_sheet_rows', JSON.stringify(res.sales_sheet.rows));
            localStorage.setItem('zamzam_sheet_title', res.sales_sheet.title);
          } catch (_) {}
        }
        if (res.expense_sheet) {
          setExpenseRows(res.expense_sheet.rows);
          setExpenseTitle(res.expense_sheet.title);
          try {
            localStorage.setItem('zamzam_sheet_expense_rows', JSON.stringify(res.expense_sheet.rows));
            localStorage.setItem('zamzam_sheet_expense_title', res.expense_sheet.title);
          } catch (_) {}
        }
        setDbSyncStatus('SYNCED');
      }
    } catch (err) {
      console.warn('Could not connect to database for Notepad & Sheet, fallback to local storage cache', err);
      setDbSyncStatus('IDLE');
    } finally {
      setTimeout(() => {
        isInitialLoadRef.current = false;
      }, 400);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadFromDatabase();
    } else {
      isInitialLoadRef.current = true;
    }
  }, [isOpen]);

  // 2. Auto-Save to LocalStorage (Instant local fallback)
  useEffect(() => {
    try {
      localStorage.setItem('zamzam_user_notes', JSON.stringify(notes));
    } catch (e) {
      console.error(e);
    }
  }, [notes]);

  useEffect(() => {
    localStorage.setItem('zamzam_sheet_active_mode', sheetMode);
  }, [sheetMode]);

  useEffect(() => {
    try {
      localStorage.setItem('zamzam_sheet_rows', JSON.stringify(salesRows));
      localStorage.setItem('zamzam_sheet_title', salesTitle);
    } catch (e) {
      console.error(e);
    }
  }, [salesRows, salesTitle]);

  useEffect(() => {
    try {
      localStorage.setItem('zamzam_sheet_expense_rows', JSON.stringify(expenseRows));
      localStorage.setItem('zamzam_sheet_expense_title', expenseTitle);
    } catch (e) {
      console.error(e);
    }
  }, [expenseRows, expenseTitle]);

  // 3. Debounced Auto-Save to Central Database (PostgreSQL / SQLite)
  useEffect(() => {
    if (isInitialLoadRef.current) return;
    if (saveDebounceTimerRef.current) clearTimeout(saveDebounceTimerRef.current);

    setDbSyncStatus('SAVING');
    saveDebounceTimerRef.current = setTimeout(async () => {
      try {
        await notepadSheetService.saveData({
          notes,
          sales_sheet: { title: salesTitle, rows: salesRows },
          expense_sheet: { title: expenseTitle, rows: expenseRows },
        });
        setDbSyncStatus('SYNCED');
      } catch (err) {
        console.error('Failed to sync Notepad & Sheet to central database', err);
        setDbSyncStatus('ERROR');
      }
    }, 700);

    return () => {
      if (saveDebounceTimerRef.current) clearTimeout(saveDebounceTimerRef.current);
    };
  }, [notes, salesRows, expenseRows, salesTitle, expenseTitle]);

  if (!isOpen) return null;

  const currentNote = notes.find((n) => n.id === activeNoteId) || notes[0];

  // --- TEMPLATE & SIMPLIFIED UI STATE ---
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [templateFilter, setTemplateFilter] = useState<'ALL' | 'SALES' | 'EXPENSE' | 'NOTES'>('ALL');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleApplyTemplate = (tpl: SampleTemplate) => {
    if (tpl.category === 'SALES') {
      setActiveTab('SHEET');
      setSheetMode('SALES');
      setSalesTitle(tpl.title);
      setSalesRows(tpl.rows ? tpl.rows.map((r, i) => ({ ...r, id: (i + 1).toString() })) : []);
      showToast(`⚡ Loaded "${tpl.name}" into Sales Sheet!`);
    } else if (tpl.category === 'EXPENSE') {
      setActiveTab('SHEET');
      setSheetMode('EXPENSE');
      setExpenseTitle(tpl.title);
      setExpenseRows(tpl.rows ? tpl.rows.map((r, i) => ({ ...r, id: (i + 1).toString() })) : []);
      showToast(`⚡ Loaded "${tpl.name}" into Expenses Sheet!`);
    } else if (tpl.category === 'NOTES') {
      setActiveTab('NOTES');
      const newNoteId = Date.now().toString();
      const newNote: NoteItem = {
        id: newNoteId,
        title: tpl.title,
        content: tpl.content || '',
        updatedAt: new Date().toLocaleDateString('en-IN'),
      };
      setNotes((prev) => [newNote, ...prev]);
      setActiveNoteId(newNoteId);
      showToast(`⚡ Added "${tpl.name}" to your Notepad!`);
    }
    setIsTemplateModalOpen(false);
  };

  // Note Handlers
  const handleCreateNote = () => {
    const newNote: NoteItem = {
      id: Date.now().toString(),
      title: 'New Note',
      content: '',
      updatedAt: new Date().toLocaleDateString('en-IN'),
    };
    setNotes([newNote, ...notes]);
    setActiveNoteId(newNote.id);
  };

  const handleDeleteNote = (id: string) => {
    if (notes.length <= 1) {
      alert('You must keep at least one note.');
      return;
    }
    const filtered = notes.filter((n) => n.id !== id);
    setNotes(filtered);
    if (activeNoteId === id) {
      setActiveNoteId(filtered[0]?.id || '');
    }
  };

  const handleUpdateCurrentNote = (title: string, content: string) => {
    setNotes((prev) =>
      prev.map((n) =>
        n.id === activeNoteId
          ? { ...n, title: title.trim() || 'Untitled Note', content, updatedAt: new Date().toLocaleDateString('en-IN') }
          : n
      )
    );
  };

  const handleCopyNote = () => {
    if (!currentNote) return;
    navigator.clipboard.writeText(`${currentNote.title}\n\n${currentNote.content}`);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const handleInsertText = (snippet: string) => {
    if (!currentNote || !textareaRef.current) return;
    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = currentNote.content;
    const before = text.substring(0, start);
    const after = text.substring(end);
    
    // Add newline if needed
    const needsNewline = before.length > 0 && !before.endsWith('\n');
    const fullSnippet = (needsNewline ? '\n' : '') + snippet;
    const newText = before + fullSnippet + after;

    handleUpdateCurrentNote(currentNote.title, newText);
    setTimeout(() => {
      textarea.focus();
      const newPos = start + fullSnippet.length;
      textarea.setSelectionRange(newPos, newPos);
    }, 10);
  };

  const handleSendNoteWhatsApp = async () => {
    if (!currentNote) return;
    const phone = window.prompt('Enter mobile number to send this note on WhatsApp (e.g. 9876543210):');
    if (!phone) return;

    setWaStatus('Sending via WhatsApp...');
    const message = `*${currentNote.title.toUpperCase()}*\n\n${currentNote.content}\n\n_— Shared from Zamzam Foods Workspace_`;
    const res = await sendWhatsAppTextMessageViaBridge({ phone, message });
    if (res.success) {
      setWaStatus('✅ Note sent on WhatsApp!');
      setTimeout(() => setWaStatus(null), 3000);
    } else {
      setWaStatus('❌ ' + (res.error || 'Failed to send'));
      setTimeout(() => setWaStatus(null), 4000);
    }
  };

  const handlePrintNote = () => {
    if (!currentNote) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>${currentNote.title} - Zamzam Foods</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 40px; color: #1e293b; }
            h1 { font-size: 24px; border-bottom: 2px solid #b91c1c; padding-bottom: 8px; margin-bottom: 16px; }
            .meta { font-size: 13px; color: #64748b; margin-bottom: 24px; }
            .content { font-size: 15px; line-height: 28px; white-space: pre-wrap; }
          </style>
        </head>
        <body>
          <h1>${currentNote.title}</h1>
          <div class="meta">Zamzam Foods Workspace • Last Updated: ${currentNote.updatedAt}</div>
          <div class="content">${currentNote.content}</div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  // Smart Checklist and Bullet point auto-continuation on Enter
  const handleNoteKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      const textarea = textareaRef.current;
      if (!textarea || !currentNote) return;
      const start = textarea.selectionStart;
      const text = currentNote.content;

      // Find current line start
      const lastNewline = text.lastIndexOf('\n', start - 1);
      const lineStart = lastNewline === -1 ? 0 : lastNewline + 1;
      const currentLine = text.substring(lineStart, start);

      if (currentLine.startsWith('☐ ')) {
        e.preventDefault();
        if (currentLine.trim() === '☐') {
          // Remove empty checkbox
          const newText = text.substring(0, lineStart) + text.substring(start);
          handleUpdateCurrentNote(currentNote.title, newText);
          setTimeout(() => {
            textarea.setSelectionRange(lineStart, lineStart);
          }, 0);
        } else {
          // Add next checkbox
          const before = text.substring(0, start);
          const after = text.substring(start);
          const newText = before + '\n☐ ' + after;
          handleUpdateCurrentNote(currentNote.title, newText);
          setTimeout(() => {
            textarea.setSelectionRange(start + 3, start + 3);
          }, 0);
        }
      } else if (currentLine.startsWith('• ')) {
        e.preventDefault();
        if (currentLine.trim() === '•') {
          // Remove empty bullet
          const newText = text.substring(0, lineStart) + text.substring(start);
          handleUpdateCurrentNote(currentNote.title, newText);
          setTimeout(() => {
            textarea.setSelectionRange(lineStart, lineStart);
          }, 0);
        } else {
          // Add next bullet
          const before = text.substring(0, start);
          const after = text.substring(start);
          const newText = before + '\n• ' + after;
          handleUpdateCurrentNote(currentNote.title, newText);
          setTimeout(() => {
            textarea.setSelectionRange(start + 3, start + 3);
          }, 0);
        }
      }
    }
  };

  const focusCell = (row: number, col: number) => {
    setTimeout(() => {
      const el = document.getElementById(`sheet-cell-${row}-${col}`) as HTMLInputElement | null;
      if (el) {
        el.focus();
        el.select();
      }
    }, 30);
  };

  // Sheet Handlers: Clean cell update with auto multiplication for Quantity * Rate = Total
  const handleCellChange = (rowId: string, colKey: string, value: string) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r;
        const updated = { ...r, [colKey]: value };

        // Auto multiply Rate * Quantity if both present and editing colC or colD
        if (colKey === 'colC' || colKey === 'colD') {
          const qty = parseFloat(colKey === 'colC' ? value : r.colC);
          const rate = parseFloat(colKey === 'colD' ? value : r.colD);
          if (!isNaN(qty) && !isNaN(rate)) {
            updated.colE = (qty * rate).toFixed(2);
          }
        }
        return updated;
      })
    );
  };

  // Rapid Entry Navigation: Enter & Tab advance to NEXT COLUMN, wrap to next row at end
  const handleCellKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    rowIdx: number,
    colIdx: number
  ) => {
    // 1. ENTER KEY: Advance to NEXT COLUMN on same row; at end of row, move to next row column 0
    if (e.key === 'Enter') {
      e.preventDefault();
      // If at colD (Rate, colIdx 3) or colE (Total, colIdx 4), advance to Column 0 of next row
      if (colIdx >= 3) {
        if (rowIdx === rows.length - 1) {
          // At the last row: append a fresh row and focus column 0 of that new row
          handleAddRow();
          focusCell(rowIdx + 1, 0);
        } else {
          // Move to next row, column 0 (Item Name)
          focusCell(rowIdx + 1, 0);
        }
      } else {
        // Move to NEXT COLUMN on the same row!
        focusCell(rowIdx, colIdx + 1);
      }
    }
    // 2. TAB KEY: Advance to NEXT COLUMN, wrap to next row at end
    else if (e.key === 'Tab') {
      if (!e.shiftKey) {
        // Forward Tab
        if (colIdx >= 3) {
          e.preventDefault();
          if (rowIdx === rows.length - 1) {
            handleAddRow();
            focusCell(rowIdx + 1, 0);
          } else {
            focusCell(rowIdx + 1, 0);
          }
        } else {
          e.preventDefault();
          focusCell(rowIdx, colIdx + 1);
        }
      } else {
        // Shift + Tab: Move to PREVIOUS COLUMN
        if (colIdx > 0) {
          e.preventDefault();
          focusCell(rowIdx, colIdx - 1);
        } else if (rowIdx > 0) {
          e.preventDefault();
          focusCell(rowIdx - 1, 3);
        }
      }
    }
    // 3. ARROW DOWN: Move down one row in same column
    else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (rowIdx === rows.length - 1) {
        handleAddRow();
        focusCell(rowIdx + 1, colIdx);
      } else {
        focusCell(rowIdx + 1, colIdx);
      }
    }
    // 4. ARROW UP: Move up one row in same column
    else if (e.key === 'ArrowUp') {
      if (rowIdx > 0) {
        e.preventDefault();
        focusCell(rowIdx - 1, colIdx);
      }
    }
  };

  const handleAddRow = () => {
    const newId = String(Date.now() + Math.random());
    const newRow: SheetRow = { id: newId };
    columns.forEach((c) => {
      newRow[c.key] = '';
    });
    if (sheetMode === 'EXPENSE') {
      newRow.colA = new Date().toLocaleDateString('en-IN');
      newRow.colD = 'Cash';
    }
    setRows((prev) => [...prev, newRow]);
  };

  const handleAddQuickExpense = (category: string) => {
    const newId = String(Date.now() + Math.random());
    const newRow: SheetRow = {
      id: newId,
      colA: new Date().toLocaleDateString('en-IN'),
      colB: category,
      colC: '',
      colD: 'Cash',
      colE: '',
    };
    setRows((prev) => [...prev, newRow]);
    setTimeout(() => {
      const nextIdx = rows.length;
      focusCell(nextIdx, 2); // focus Remarks / Description
    }, 40);
  };

  const handleDeleteRow = (index: number) => {
    if (rows.length <= 1) return;
    setRows(rows.filter((_, idx) => idx !== index));
  };

  const handleClearSheet = () => {
    if (!window.confirm(`Clear all data from this ${sheetMode === 'EXPENSE' ? 'Expense' : 'Sales'} spreadsheet?`)) return;
    if (sheetMode === 'EXPENSE') {
      setExpenseRows([
        { id: '1', colA: new Date().toLocaleDateString('en-IN'), colB: '', colC: '', colD: 'Cash', colE: '' },
      ]);
    } else {
      setSalesRows(INITIAL_ROWS.map((r, i) => ({ ...r, id: (i + 1).toString(), colA: '', colB: '', colC: '', colD: '', colE: '' })));
    }
  };

  const handleSendExpenseWhatsApp = async () => {
    const validRows = rows.filter((r) => r.colB && r.colE);
    if (validRows.length === 0) {
      alert('Please enter at least one expense with Category and Amount.');
      return;
    }
    const phone = window.prompt('Enter mobile number to send Expense Summary on WhatsApp (e.g. 9876543210):');
    if (!phone) return;

    const total = calculateColumnSum('colE');
    let message = `*ZAMZAM FOODS - DAILY EXPENSES REPORT*\n`;
    message += `📅 Date: ${new Date().toLocaleDateString('en-IN')}\n`;
    message += `--------------------------------------\n`;
    validRows.forEach((r, idx) => {
      message += `${idx + 1}. *${r.colB}*: ₹${r.colE} (${r.colC || 'No remark'} • ${r.colD || 'Cash'})\n`;
    });
    message += `--------------------------------------\n`;
    message += `*TOTAL EXPENSES: ₹${total}*\n`;
    message += `_— Sent from Zamzam Foods Workspace_`;

    const res = await sendWhatsAppTextMessageViaBridge({ phone, message });
    if (res.success) {
      alert('✅ Expense summary sent on WhatsApp!');
    } else {
      alert('❌ Failed: ' + (res.error || 'Check WhatsApp Bridge connection'));
    }
  };

  // Compute column sums for numeric columns
  const calculateColumnSum = (colKey: string) => {
    let sum = 0;
    let hasNumber = false;
    rows.forEach((r) => {
      const val = parseFloat(r[colKey]);
      if (!isNaN(val)) {
        sum += val;
        hasNumber = true;
      }
    });
    return hasNumber ? sum.toFixed(2) : '-';
  };

  // Export Sheet to CSV
  const handleExportCSV = () => {
    const headerRow = columns.map((c) => `"${c.name}"`).join(',');
    const bodyRows = rows.map((r) => columns.map((c) => `"${(r[c.key] || '').replace(/"/g, '""')}"`).join(','));
    const csvContent = 'data:text/csv;charset=utf-8,' + [headerRow, ...bodyRows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${sheetTitle.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1100,
        padding: isFullScreen ? '0' : '1rem',
      }}
    >
      <div
        className="card"
        style={{
          width: isFullScreen ? '100vw' : '96vw',
          maxWidth: isFullScreen ? '100vw' : '1100px',
          height: isFullScreen ? '100vh' : '88vh',
          backgroundColor: '#ffffff',
          borderRadius: isFullScreen ? '0' : '16px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
          overflow: 'hidden',
          border: '1px solid #cbd5e1',
        }}
      >
        {/* Top Header */}
        <div
          style={{
            padding: '0.75rem 1.25rem',
            backgroundColor: '#0f172a',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #334155',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  backgroundColor: '#b91c1c',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {activeTab === 'SHEET' ? <FileSpreadsheet size={18} color="#fff" /> : <FileText size={18} color="#fff" />}
              </div>
              <div>
                <span style={{ fontSize: '0.98rem', fontWeight: 800, letterSpacing: '-0.01em' }}>
                  Zamzam Workspace Notepad & Sheets
                </span>
                <span style={{ fontSize: '0.68rem', color: '#94a3b8', display: 'block', lineHeight: 1 }}>
                  Auto-saved locally • Works 100% offline
                </span>
              </div>
            </div>

            {/* Mode Switch Tabs */}
            <div style={{ display: 'flex', backgroundColor: '#1e293b', borderRadius: '8px', padding: '3px' }}>
              <button
                type="button"
                onClick={() => setActiveTab('SHEET')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '5px 14px',
                  borderRadius: '6px',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: activeTab === 'SHEET' ? '#059669' : 'transparent',
                  color: activeTab === 'SHEET' ? '#ffffff' : '#94a3b8',
                  transition: 'all 0.15s ease',
                }}
              >
                <FileSpreadsheet size={15} />
                <span>Google Sheet Mode</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('NOTES')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '5px 14px',
                  borderRadius: '6px',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: activeTab === 'NOTES' ? '#b91c1c' : 'transparent',
                  color: activeTab === 'NOTES' ? '#ffffff' : '#94a3b8',
                  transition: 'all 0.15s ease',
                }}
              >
                <FileText size={15} />
                <span>Quick Notepad</span>
              </button>
            </div>

            {/* 1-Click Sample Business Templates Button */}
            <button
              type="button"
              onClick={() => setIsTemplateModalOpen(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '5px 12px',
                borderRadius: '8px',
                fontSize: '0.76rem',
                fontWeight: 800,
                backgroundColor: 'rgba(245, 158, 11, 0.18)',
                color: '#fbbf24',
                border: '1px solid rgba(245, 158, 11, 0.4)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              title="Open pre-filled business templates for sales, expenses & notes"
            >
              <Sparkles size={13} color="#fbbf24" />
              <span>⚡ Sample Templates</span>
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {/* Database Live Sync Badge */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '4px 9px',
                borderRadius: '6px',
                fontSize: '0.72rem',
                fontWeight: 700,
                background:
                  dbSyncStatus === 'SYNCED'
                    ? 'rgba(16, 185, 129, 0.15)'
                    : dbSyncStatus === 'SAVING' || dbSyncStatus === 'LOADING'
                    ? 'rgba(245, 158, 11, 0.15)'
                    : dbSyncStatus === 'ERROR'
                    ? 'rgba(239, 68, 68, 0.15)'
                    : 'rgba(148, 163, 184, 0.12)',
                color:
                  dbSyncStatus === 'SYNCED'
                    ? '#34d399'
                    : dbSyncStatus === 'SAVING' || dbSyncStatus === 'LOADING'
                    ? '#fbbf24'
                    : dbSyncStatus === 'ERROR'
                    ? '#f87171'
                    : '#cbd5e1',
                border: `1px solid ${
                  dbSyncStatus === 'SYNCED'
                    ? 'rgba(16, 185, 129, 0.35)'
                    : dbSyncStatus === 'SAVING' || dbSyncStatus === 'LOADING'
                    ? 'rgba(245, 158, 11, 0.35)'
                    : dbSyncStatus === 'ERROR'
                    ? 'rgba(239, 68, 68, 0.35)'
                    : 'rgba(148, 163, 184, 0.2)'
                }`,
              }}
              title="Notepad & Sheet are fully connected to PostgreSQL / SQLite database"
            >
              <Database size={13} />
              <span>
                {dbSyncStatus === 'SYNCED'
                  ? 'Database Live'
                  : dbSyncStatus === 'SAVING'
                  ? 'Saving to DB...'
                  : dbSyncStatus === 'LOADING'
                  ? 'Loading DB...'
                  : dbSyncStatus === 'ERROR'
                  ? 'Saved Locally'
                  : 'Database Ready'}
              </span>
            </div>

            {/* Manual Sync Button */}
            <button
              type="button"
              onClick={loadFromDatabase}
              title="Fetch latest notes & sheets from database"
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.18)',
                color: '#e2e8f0',
                padding: '5px 9px',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
                fontSize: '0.72rem',
                fontWeight: 600,
              }}
            >
              <RefreshCw size={12} className={dbSyncStatus === 'LOADING' ? 'animate-spin' : ''} />
              <span>Sync</span>
            </button>

            <button
              type="button"
              onClick={() => setIsFullScreen(!isFullScreen)}
              title={isFullScreen ? 'Exit Full Screen' : 'Full Screen'}
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                border: 'none',
                color: '#ffffff',
                padding: '6px',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
            >
              {isFullScreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
            <button
              type="button"
              onClick={onClose}
              title="Close (Esc)"
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                border: 'none',
                color: '#ffffff',
                padding: '6px',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* ============================================================== */}
        {/* TAB 1: SPREADSHEET / GOOGLE SHEET MODE */}
        {/* ============================================================== */}
        {activeTab === 'SHEET' && (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
            {/* Sheet Toolbar with Sales & Expense Switcher */}
            <div
              style={{
                padding: '0.6rem 1.25rem',
                backgroundColor: '#f8fafc',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '0.6rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
                {/* Mode Selector Pill: Sales Sheet vs Daily Expense Sheet */}
                <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#e2e8f0', padding: '3px', borderRadius: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setSheetMode('SALES')}
                    style={{
                      padding: '4px 12px',
                      fontSize: '0.78rem',
                      fontWeight: 800,
                      borderRadius: '6px',
                      border: 'none',
                      cursor: 'pointer',
                      backgroundColor: sheetMode === 'SALES' ? '#ffffff' : 'transparent',
                      color: sheetMode === 'SALES' ? '#b91c1c' : '#475569',
                      boxShadow: sheetMode === 'SALES' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    }}
                  >
                    🛒 Sales & Stock Sheet
                  </button>
                  <button
                    type="button"
                    onClick={() => setSheetMode('EXPENSE')}
                    style={{
                      padding: '4px 12px',
                      fontSize: '0.78rem',
                      fontWeight: 800,
                      borderRadius: '6px',
                      border: 'none',
                      cursor: 'pointer',
                      backgroundColor: sheetMode === 'EXPENSE' ? '#ffffff' : 'transparent',
                      color: sheetMode === 'EXPENSE' ? '#b91c1c' : '#475569',
                      boxShadow: sheetMode === 'EXPENSE' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    }}
                  >
                    💸 Daily Expenses Sheet
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setTemplateFilter(sheetMode === 'EXPENSE' ? 'EXPENSE' : 'SALES');
                    setIsTemplateModalOpen(true);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    backgroundColor: '#fffbeb',
                    color: '#b45309',
                    border: '1px solid #fde68a',
                    cursor: 'pointer',
                  }}
                  title="Load pre-filled sample sheet template"
                >
                  <Sparkles size={13} color="#d97706" />
                  <span>⚡ Templates</span>
                </button>

                <input
                  type="text"
                  value={sheetTitle}
                  onChange={(e) => setSheetTitle(e.target.value)}
                  style={{
                    fontSize: '0.92rem',
                    fontWeight: 800,
                    color: '#0f172a',
                    border: '1px solid transparent',
                    backgroundColor: 'transparent',
                    padding: '4px 8px',
                    borderRadius: '6px',
                    minWidth: '260px',
                  }}
                  onFocus={(e) => (e.target.style.borderColor = '#94a3b8')}
                  onBlur={(e) => (e.target.style.borderColor = 'transparent')}
                  title="Click to rename spreadsheet"
                />

                <span
                  style={{
                    fontSize: '0.72rem',
                    color: sheetMode === 'EXPENSE' ? '#b45309' : '#059669',
                    fontWeight: 700,
                    backgroundColor: sheetMode === 'EXPENSE' ? '#fef3c7' : '#ecfdf5',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    border: sheetMode === 'EXPENSE' ? '1px solid #fde68a' : '1px solid #a7f3d0',
                  }}
                >
                  {sheetMode === 'EXPENSE' ? 'Auto-Sum (Total Expenses)' : 'Auto-Sum (Qty × Rate = Total)'}
                </span>

                <span style={{ fontSize: '0.72rem', color: '#2563eb', fontWeight: 700, backgroundColor: '#eff6ff', padding: '2px 8px', borderRadius: '4px', border: '1px solid #bfdbfe' }}>
                  Enter key = Next Column ➔
                </span>

                {/* Instant Live Grand Total Pill */}
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    padding: '3px 10px',
                    borderRadius: '6px',
                    backgroundColor: sheetMode === 'EXPENSE' ? '#fef2f2' : '#ecfdf5',
                    border: `1px solid ${sheetMode === 'EXPENSE' ? '#fecaca' : '#a7f3d0'}`,
                  }}
                  title="Live auto-calculated grand total of this sheet"
                >
                  <span style={{ fontSize: '0.72rem', fontWeight: 800, color: sheetMode === 'EXPENSE' ? '#b91c1c' : '#047857' }}>
                    {sheetMode === 'EXPENSE' ? 'TOTAL EXPENSES:' : 'TOTAL AMOUNT:'}
                  </span>
                  <span style={{ fontSize: '0.88rem', fontWeight: 900, color: sheetMode === 'EXPENSE' ? '#dc2626' : '#059669', fontFamily: 'monospace' }}>
                    ₹{calculateColumnSum('colE')}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <button
                  type="button"
                  onClick={handleAddRow}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    padding: '5px 12px',
                    backgroundColor: sheetMode === 'EXPENSE' ? '#b91c1c' : '#059669',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  <Plus size={15} />
                  <span>{sheetMode === 'EXPENSE' ? '+ Add Expense' : '+ Add Row'}</span>
                </button>

                {sheetMode === 'EXPENSE' && (
                  <button
                    type="button"
                    onClick={handleSendExpenseWhatsApp}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      padding: '5px 12px',
                      backgroundColor: '#059669',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                    title="Send Expense Summary via WhatsApp"
                  >
                    <Share2 size={13} />
                    <span>WhatsApp</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleExportCSV}
                  title="Export to Excel / CSV"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    padding: '5px 12px',
                    backgroundColor: '#ffffff',
                    color: '#334155',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  <Download size={14} />
                  <span>Export CSV</span>
                </button>
                <button
                  type="button"
                  onClick={handleClearSheet}
                  title="Clear all rows"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    padding: '5px 8px',
                    backgroundColor: '#ffffff',
                    color: '#94a3b8',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                  }}
                >
                  <RotateCcw size={13} />
                </button>
              </div>
            </div>

            {/* Quick Expense Categories Sub-Toolbar (When Expense mode is active) */}
            {sheetMode === 'EXPENSE' && (
              <div
                style={{
                  padding: '0.4rem 1.25rem',
                  backgroundColor: '#fffbeb',
                  borderBottom: '1px solid #fef3c7',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  flexWrap: 'wrap',
                }}
              >
                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#92400e' }}>
                  Quick Expense Add:
                </span>
                {[
                  '🌾 Flour & Wheat',
                  '🛢️ Cooking Oil',
                  '⛽ Fuel & Diesel',
                  '🚐 Van Repair',
                  '📦 Packaging Bags',
                  '☕ Tea & Snacks',
                  '👥 Wages & Labour',
                  '💡 Rent & Bills',
                  '⚡ Miscellaneous',
                ].map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => handleAddQuickExpense(cat)}
                    style={{
                      padding: '2px 8px',
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      backgroundColor: '#ffffff',
                      color: '#78350f',
                      border: '1px solid #fde68a',
                      borderRadius: '4px',
                      cursor: 'pointer',
                    }}
                  >
                    + {cat}
                  </button>
                ))}
              </div>
            )}

            {/* Grid Table Container */}
            <div style={{ flex: 1, overflow: 'auto', backgroundColor: '#ffffff' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f1f5f9', color: '#475569', textAlign: 'left', position: 'sticky', top: 0, zIndex: 10 }}>
                    <th style={{ width: '42px', padding: '8px 6px', textAlign: 'center', borderRight: '1px solid #e2e8f0', borderBottom: '2px solid #cbd5e1', fontSize: '0.72rem', color: '#64748b' }}>
                      #
                    </th>
                    {columns.map((col) => (
                      <th
                        key={col.key}
                        style={{
                          padding: '8px 12px',
                          borderRight: '1px solid #e2e8f0',
                          borderBottom: '2px solid #cbd5e1',
                          fontWeight: 800,
                          color: '#1e293b',
                          textAlign: col.isNumeric ? 'right' : 'left',
                        }}
                      >
                        {col.name}
                      </th>
                    ))}
                    <th style={{ width: '40px', borderBottom: '2px solid #cbd5e1', padding: '8px 4px' }} />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, rowIdx) => (
                    <tr
                      key={row.id}
                      style={{
                        borderBottom: '1px solid #e2e8f0',
                        backgroundColor: rowIdx % 2 === 0 ? '#ffffff' : '#fafafa',
                      }}
                    >
                      <td style={{ textAlign: 'center', padding: '6px', color: '#94a3b8', fontWeight: 600, borderRight: '1px solid #e2e8f0', backgroundColor: '#f8fafc', fontSize: '0.72rem' }}>
                        {rowIdx + 1}
                      </td>
                      {columns.map((col, colIdx) => (
                        <td key={col.key} style={{ padding: 0, borderRight: '1px solid #e2e8f0' }}>
                          <input
                            id={`sheet-cell-${rowIdx}-${colIdx}`}
                            type={col.isNumeric ? 'number' : 'text'}
                            value={row[col.key] || ''}
                            onChange={(e) => handleCellChange(row.id, col.key, e.target.value)}
                            onKeyDown={(e) => handleCellKeyDown(e, rowIdx, colIdx)}
                            placeholder={col.isNumeric ? '0' : 'Type here...'}
                            style={{
                              width: '100%',
                              padding: '8px 12px',
                              border: 'none',
                              outline: 'none',
                              backgroundColor: 'transparent',
                              fontSize: '0.84rem',
                              fontWeight: col.key === 'colE' ? 800 : 500,
                              color: col.key === 'colE' ? '#059669' : '#0f172a',
                              textAlign: col.isNumeric ? 'right' : 'left',
                              boxSizing: 'border-box',
                            }}
                            onFocus={(e) => (e.target.style.backgroundColor = '#ecfdf5')}
                            onBlur={(e) => (e.target.style.backgroundColor = 'transparent')}
                          />
                        </td>
                      ))}
                      <td style={{ textAlign: 'center', padding: '2px' }}>
                        <button
                          type="button"
                          onClick={() => handleDeleteRow(rowIdx)}
                          title="Delete Row"
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#cbd5e1',
                            cursor: 'pointer',
                            padding: '4px',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
                          onMouseLeave={(e) => (e.currentTarget.style.color = '#cbd5e1')}
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                {/* Auto Calculated Sum Footer */}
                <tfoot>
                  <tr style={{ backgroundColor: '#f8fafc', borderTop: '2px solid #cbd5e1', fontWeight: 900 }}>
                    <td style={{ textAlign: 'center', padding: '10px 6px', fontSize: '0.74rem', color: '#64748b', borderRight: '1px solid #e2e8f0' }}>
                      Σ
                    </td>
                    <td style={{ padding: '10px 12px', color: '#0f172a', borderRight: '1px solid #e2e8f0' }}>
                      {sheetMode === 'EXPENSE' ? 'TOTAL DAILY EXPENSES' : 'TOTAL SUMMARY'}
                    </td>
                    <td style={{ padding: '10px 12px', color: '#64748b', borderRight: '1px solid #e2e8f0' }}>
                      {sheetMode === 'EXPENSE'
                        ? `${rows.filter((r) => r.colB && r.colE).length} Expense Items`
                        : `${rows.filter((r) => r.colA).length} Items Listed`}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: '#1e293b', borderRight: '1px solid #e2e8f0', fontFamily: 'monospace' }}>
                      {sheetMode === 'EXPENSE' ? '—' : calculateColumnSum('colC')}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: '#64748b', borderRight: '1px solid #e2e8f0' }}>
                      —
                    </td>
                    <td
                      style={{
                        padding: '10px 12px',
                        textAlign: 'right',
                        color: sheetMode === 'EXPENSE' ? '#b91c1c' : '#059669',
                        fontSize: '1rem',
                        fontWeight: 900,
                        borderRight: '1px solid #e2e8f0',
                        fontFamily: 'monospace',
                      }}
                    >
                      ₹{calculateColumnSum('colE')}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 2: QUICK NOTEPAD MODE (Authentic Notebook Paper & Alignment) */}
        {/* ============================================================== */}
        {activeTab === 'NOTES' && (() => {
          const isLarge = fontSizeMode === 'LARGE';
          const fontSize = isLarge ? '18px' : '15px';
          const lineHeight = isLarge ? '44px' : '36px';
          const linePitch = isLarge ? 44 : 36;
          const paddingTop = isLarge ? '12px' : '10px';

          let paperBgColor = '#ffffff';
          let paperBgImage = 'none';
          let paperBgSize = 'auto';
          let paperPadding = `${paddingTop} 24px 20px 24px`;

          if (paperTheme === 'RULED') {
            paperBgColor = '#ffffff';
            const marginPos = isLarge ? 54 : 48;
            paperBgImage = `linear-gradient(to right, transparent ${marginPos}px, #fca5a5 ${marginPos}px, #fca5a5 ${marginPos + 2}px, transparent ${marginPos + 2}px), linear-gradient(to bottom, transparent ${linePitch - 1}px, #e2e8f0 ${linePitch}px)`;
            paperBgSize = `100% 100%, 100% ${linePitch}px`;
            paperPadding = `${paddingTop} 24px 20px ${isLarge ? 70 : 64}px`;
          } else if (paperTheme === 'LEGAL') {
            paperBgColor = '#fefce8';
            const marginPos = isLarge ? 54 : 48;
            paperBgImage = `linear-gradient(to right, transparent ${marginPos}px, #f87171 ${marginPos}px, #f87171 ${marginPos + 2}px, transparent ${marginPos + 2}px), linear-gradient(to bottom, transparent ${linePitch - 1}px, #cbd5e1 ${linePitch}px)`;
            paperBgSize = `100% 100%, 100% ${linePitch}px`;
            paperPadding = `${paddingTop} 24px 20px ${isLarge ? 70 : 64}px`;
          } else if (paperTheme === 'GRID') {
            paperBgColor = '#ffffff';
            paperBgImage = `linear-gradient(to right, #f1f5f9 1px, transparent 1px), linear-gradient(to bottom, #f1f5f9 1px, transparent 1px)`;
            paperBgSize = `${linePitch}px ${linePitch}px`;
            paperPadding = `${paddingTop} 24px 20px 24px`;
          } else {
            paperBgColor = '#ffffff';
            paperBgImage = 'none';
            paperPadding = isLarge ? '20px 32px' : '18px 26px';
          }

          const filteredNotes = notes.filter(
            (n) => n.title.toLowerCase().includes(noteSearch.toLowerCase()) || n.content.toLowerCase().includes(noteSearch.toLowerCase())
          );

          return (
            <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
              {/* Notes Sidebar List (Roomy 310px width so titles never truncate) */}
              <div
                style={{
                  width: '310px',
                  borderRight: '1px solid #e2e8f0',
                  backgroundColor: '#f8fafc',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                {/* Note Search & Create Button */}
                <div style={{ padding: '0.75rem', borderBottom: '1px solid #e2e8f0', display: 'flex', gap: '0.5rem' }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <Search size={14} style={{ position: 'absolute', left: '9px', top: '9px', color: '#94a3b8' }} />
                    <input
                      type="text"
                      placeholder="Search notes..."
                      value={noteSearch}
                      onChange={(e) => setNoteSearch(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '6px 26px 6px 28px',
                        fontSize: '0.8rem',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        boxSizing: 'border-box',
                        outline: 'none',
                      }}
                    />
                    {noteSearch && (
                      <button
                        type="button"
                        onClick={() => setNoteSearch('')}
                        style={{
                          position: 'absolute',
                          right: '6px',
                          top: '7px',
                          background: 'none',
                          border: 'none',
                          color: '#94a3b8',
                          cursor: 'pointer',
                          padding: '2px',
                        }}
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleCreateNote}
                    style={{
                      backgroundColor: '#b91c1c',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '0 10px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                    }}
                    title="Create New Blank Note"
                  >
                    <Plus size={14} />
                    <span>New</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setTemplateFilter('NOTES');
                      setIsTemplateModalOpen(true);
                    }}
                    style={{
                      backgroundColor: '#fffbeb',
                      color: '#b45309',
                      border: '1px solid #fde68a',
                      borderRadius: '6px',
                      padding: '0 8px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '0.76rem',
                      fontWeight: 700,
                    }}
                    title="Load sample business checklist or note template"
                  >
                    <Sparkles size={13} color="#d97706" />
                    <span>Samples</span>
                  </button>
                </div>

                {/* Notes List Cards */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '0.6rem' }}>
                  {filteredNotes.length === 0 ? (
                    <div style={{ padding: '2rem 1rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.82rem' }}>
                      No notes found.
                      {noteSearch && (
                        <div style={{ marginTop: '0.5rem' }}>
                          <button
                            type="button"
                            onClick={() => setNoteSearch('')}
                            style={{ background: 'none', border: 'none', color: '#b91c1c', fontWeight: 700, cursor: 'pointer', fontSize: '0.78rem' }}
                          >
                            Clear search
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    filteredNotes.map((note) => {
                      const isSelected = note.id === activeNoteId;
                      const checkCount = (note.content.match(/☐/g) || []).length;
                      const lineCount = note.content.split('\n').filter(Boolean).length;
                      return (
                        <div
                          key={note.id}
                          onClick={() => setActiveNoteId(note.id)}
                          style={{
                            padding: '0.75rem 0.85rem',
                            borderRadius: '8px',
                            backgroundColor: isSelected ? '#ffffff' : 'transparent',
                            border: isSelected ? '1px solid #cbd5e1' : '1px solid transparent',
                            borderLeft: isSelected ? '4px solid #b91c1c' : '1px solid transparent',
                            boxShadow: isSelected ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
                            marginBottom: '0.45rem',
                            cursor: 'pointer',
                            transition: 'all 0.12s ease',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '3px' }}>
                            <span
                              style={{
                                fontSize: '0.88rem',
                                fontWeight: 800,
                                color: isSelected ? '#b91c1c' : '#0f172a',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                flex: 1,
                              }}
                            >
                              {note.title || 'Untitled Note'}
                            </span>
                            {notes.length > 1 && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteNote(note.id);
                                }}
                                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '2px', flexShrink: 0 }}
                                title="Delete Note"
                                onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
                                onMouseLeave={(e) => (e.currentTarget.style.color = '#94a3b8')}
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.4 }}>
                            {note.content.replace(/\n/g, ' ').slice(0, 52) || 'Empty note...'}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px', fontSize: '0.68rem', color: '#94a3b8' }}>
                            <span>📅 {note.updatedAt}</span>
                            <span>{checkCount > 0 ? `☑ ${checkCount} items` : `${lineCount} lines`}</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Note Editor Area */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#ffffff' }}>
                {currentNote && (
                  <>
                    {/* Note Title Header & Action Buttons */}
                    <div
                      style={{
                        padding: '0.85rem 1.5rem',
                        borderBottom: '1px solid #f1f5f9',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '1rem',
                        backgroundColor: '#ffffff',
                      }}
                    >
                      <input
                        type="text"
                        value={currentNote.title}
                        onChange={(e) => handleUpdateCurrentNote(e.target.value, currentNote.content)}
                        placeholder="Note Title..."
                        style={{
                          fontSize: '1.25rem',
                          fontWeight: 900,
                          color: '#0f172a',
                          border: 'none',
                          outline: 'none',
                          width: '100%',
                          backgroundColor: 'transparent',
                        }}
                      />

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                        {waStatus && (
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#059669' }}>
                            {waStatus}
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={handleCopyNote}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            padding: '6px 12px',
                            backgroundColor: '#f8fafc',
                            border: '1px solid #cbd5e1',
                            borderRadius: '6px',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            color: '#334155',
                            cursor: 'pointer',
                          }}
                        >
                          {copySuccess ? <Check size={14} color="#059669" /> : <Copy size={14} />}
                          <span>{copySuccess ? 'Copied!' : 'Copy'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={handlePrintNote}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            padding: '6px 12px',
                            backgroundColor: '#f8fafc',
                            border: '1px solid #cbd5e1',
                            borderRadius: '6px',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            color: '#334155',
                            cursor: 'pointer',
                          }}
                          title="Print Note / Save as PDF"
                        >
                          <Printer size={14} />
                          <span>Print</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleSendNoteWhatsApp}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            padding: '6px 14px',
                            backgroundColor: '#059669',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '0.78rem',
                            fontWeight: 800,
                            color: '#ffffff',
                            cursor: 'pointer',
                          }}
                          title="Send this note to any mobile number via WhatsApp"
                        >
                          <Share2 size={14} />
                          <span>Send on WhatsApp</span>
                        </button>
                      </div>
                    </div>

                    {/* Notebook Paper Quick Tools Bar (Themes, Line Alignment, Checklists) */}
                    <div
                      style={{
                        padding: '0.45rem 1.5rem',
                        backgroundColor: '#f8fafc',
                        borderBottom: '1px solid #e2e8f0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '0.5rem',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                        {/* Paper Style Theme Selector */}
                        <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#e2e8f0', borderRadius: '6px', padding: '2px' }}>
                          <button
                            type="button"
                            onClick={() => setPaperTheme('RULED')}
                            style={{
                              padding: '3px 8px',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              backgroundColor: paperTheme === 'RULED' ? '#ffffff' : 'transparent',
                              color: paperTheme === 'RULED' ? '#b91c1c' : '#475569',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              boxShadow: paperTheme === 'RULED' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                            }}
                            title="Ruled Notebook Lines with Red Margin"
                          >
                            📏 Ruled Notebook
                          </button>
                          <button
                            type="button"
                            onClick={() => setPaperTheme('LEGAL')}
                            style={{
                              padding: '3px 8px',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              backgroundColor: paperTheme === 'LEGAL' ? '#ffffff' : 'transparent',
                              color: paperTheme === 'LEGAL' ? '#b45309' : '#475569',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              boxShadow: paperTheme === 'LEGAL' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                            }}
                            title="Yellow Legal Memo Pad"
                          >
                            📒 Legal Pad
                          </button>
                          <button
                            type="button"
                            onClick={() => setPaperTheme('GRID')}
                            style={{
                              padding: '3px 8px',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              backgroundColor: paperTheme === 'GRID' ? '#ffffff' : 'transparent',
                              color: paperTheme === 'GRID' ? '#0f172a' : '#475569',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              boxShadow: paperTheme === 'GRID' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                            }}
                            title="Graph / Grid Paper"
                          >
                            🔲 Grid
                          </button>
                          <button
                            type="button"
                            onClick={() => setPaperTheme('PLAIN')}
                            style={{
                              padding: '3px 8px',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              backgroundColor: paperTheme === 'PLAIN' ? '#ffffff' : 'transparent',
                              color: paperTheme === 'PLAIN' ? '#0f172a' : '#475569',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              boxShadow: paperTheme === 'PLAIN' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                            }}
                            title="Blank Clean Paper"
                          >
                            📄 Blank
                          </button>
                        </div>

                        {/* Font Size Toggle */}
                        <button
                          type="button"
                          onClick={() => setFontSizeMode(fontSizeMode === 'NORMAL' ? 'LARGE' : 'NORMAL')}
                          style={{
                            padding: '3px 8px',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            backgroundColor: '#ffffff',
                            color: '#334155',
                            border: '1px solid #cbd5e1',
                            borderRadius: '4px',
                            cursor: 'pointer',
                          }}
                          title="Toggle Text & Line Size"
                        >
                          {fontSizeMode === 'NORMAL' ? '📐 Line Size: Normal (36px)' : '📐 Line Size: Large (44px)'}
                        </button>

                        {/* Quick Insert Snippet Buttons */}
                        <button
                          type="button"
                          onClick={() => handleInsertText('☐ ')}
                          style={{
                            padding: '3px 8px',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            backgroundColor: '#ffffff',
                            color: '#334155',
                            border: '1px solid #cbd5e1',
                            borderRadius: '4px',
                            cursor: 'pointer',
                          }}
                          title="Insert Checklist Checkbox (Press Enter on line to continue checklist)"
                        >
                          + ☐ Checkbox
                        </button>

                        <button
                          type="button"
                          onClick={() => handleInsertText('• ')}
                          style={{
                            padding: '3px 8px',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            backgroundColor: '#ffffff',
                            color: '#334155',
                            border: '1px solid #cbd5e1',
                            borderRadius: '4px',
                            cursor: 'pointer',
                          }}
                          title="Insert Bullet Point (Press Enter on line to continue bullet)"
                        >
                          + • Bullet
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            const now = new Date();
                            const timeStr = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) + ' ' + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                            handleInsertText(`[${timeStr}] `);
                          }}
                          style={{
                            padding: '3px 8px',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            backgroundColor: '#ffffff',
                            color: '#334155',
                            border: '1px solid #cbd5e1',
                            borderRadius: '4px',
                            cursor: 'pointer',
                          }}
                          title="Insert Date & Time stamp"
                        >
                          + 🕒 Timestamp
                        </button>

                        <button
                          type="button"
                          onClick={() => handleInsertText('₹ ')}
                          style={{
                            padding: '3px 8px',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            backgroundColor: '#ffffff',
                            color: '#334155',
                            border: '1px solid #cbd5e1',
                            borderRadius: '4px',
                            cursor: 'pointer',
                          }}
                          title="Insert Rupee symbol"
                        >
                          + 💵 ₹
                        </button>

                        <button
                          type="button"
                          onClick={() => handleInsertText('──────────────────────────────')}
                          style={{
                            padding: '3px 8px',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            backgroundColor: '#ffffff',
                            color: '#334155',
                            border: '1px solid #cbd5e1',
                            borderRadius: '4px',
                            cursor: 'pointer',
                          }}
                          title="Insert Divider Line"
                        >
                          + ── Line
                        </button>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.72rem' }}>
                        <span style={{ color: '#059669', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ display: 'inline-block', width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#059669' }} />
                          Auto-Saved
                        </span>
                      </div>
                    </div>

                    {/* Notebook Body Textarea with 100% Precise Math Ruled Line Alignment */}
                    <div style={{ flex: 1, position: 'relative', overflow: 'hidden', display: 'flex', backgroundColor: paperBgColor }}>
                      <textarea
                        ref={textareaRef}
                        value={currentNote.content}
                        onChange={(e) => handleUpdateCurrentNote(currentNote.title, e.target.value)}
                        onKeyDown={handleNoteKeyDown}
                        placeholder="Type your notes here... Every line aligns seamlessly with the ruled guide lines."
                        style={{
                          flex: 1,
                          padding: paperPadding,
                          fontSize: fontSize,
                          lineHeight: lineHeight,
                          border: 'none',
                          outline: 'none',
                          resize: 'none',
                          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                          color: '#0f172a',
                          backgroundColor: paperBgColor,
                          backgroundImage: paperBgImage,
                          backgroundSize: paperBgSize,
                          backgroundAttachment: 'local, local',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>

                    {/* Note Status Footer */}
                    <div
                      style={{
                        padding: '0.45rem 1.25rem',
                        backgroundColor: '#f8fafc',
                        borderTop: '1px solid #f1f5f9',
                        fontSize: '0.72rem',
                        color: '#64748b',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div style={{ display: 'flex', gap: '1rem' }}>
                        <span>{currentNote.content.length} characters</span>
                        <span>{currentNote.content.split(/\s+/).filter(Boolean).length} words</span>
                        <span>{currentNote.content.split('\n').length} lines</span>
                        <span>
                          {((currentNote.content.match(/☐/g) || []).length > 0) &&
                            `☑ ${(currentNote.content.match(/☑|✓/g) || []).length} / ${(currentNote.content.match(/☐/g) || []).length} tasks`}
                        </span>
                      </div>
                      <span style={{ color: '#94a3b8' }}>Last updated: {currentNote.updatedAt}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })()}

        {/* ============================================================== */}
        {/* SAMPLE BUSINESS TEMPLATES MODAL (1-Click Ready-to-Use) */}
        {/* ============================================================== */}
        {isTemplateModalOpen && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.75)',
              backdropFilter: 'blur(5px)',
              zIndex: 1200,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1rem',
            }}
            onClick={() => setIsTemplateModalOpen(false)}
          >
            <div
              style={{
                width: '92vw',
                maxWidth: '820px',
                maxHeight: '85vh',
                backgroundColor: '#ffffff',
                borderRadius: '16px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                border: '1px solid #cbd5e1',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div
                style={{
                  padding: '1rem 1.35rem',
                  backgroundColor: '#0f172a',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderBottom: '1px solid #334155',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '8px',
                      backgroundColor: 'rgba(245, 158, 11, 0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Sparkles size={20} color="#fbbf24" />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 900, letterSpacing: '-0.01em', color: '#ffffff' }}>
                      Zamzam Business Sample Templates
                    </h3>
                    <span style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
                      1-Click pre-filled ready-to-use templates for bakery sales, expenses, checklists & supplier records
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsTemplateModalOpen(false)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.1)',
                    border: 'none',
                    color: '#ffffff',
                    padding: '6px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                  }}
                  title="Close Modal"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Category Filter Pills */}
              <div
                style={{
                  padding: '0.75rem 1.35rem',
                  backgroundColor: '#f8fafc',
                  borderBottom: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  flexWrap: 'wrap',
                }}
              >
                <button
                  type="button"
                  onClick={() => setTemplateFilter('ALL')}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    border: 'none',
                    cursor: 'pointer',
                    backgroundColor: templateFilter === 'ALL' ? '#0f172a' : '#e2e8f0',
                    color: templateFilter === 'ALL' ? '#ffffff' : '#475569',
                    transition: 'all 0.15s ease',
                  }}
                >
                  🌟 All Templates ({SAMPLE_TEMPLATES.length})
                </button>
                <button
                  type="button"
                  onClick={() => setTemplateFilter('SALES')}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    border: 'none',
                    cursor: 'pointer',
                    backgroundColor: templateFilter === 'SALES' ? '#059669' : '#e2e8f0',
                    color: templateFilter === 'SALES' ? '#ffffff' : '#475569',
                    transition: 'all 0.15s ease',
                  }}
                >
                  🛒 Sales & Stock ({SAMPLE_TEMPLATES.filter((t) => t.category === 'SALES').length})
                </button>
                <button
                  type="button"
                  onClick={() => setTemplateFilter('EXPENSE')}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    border: 'none',
                    cursor: 'pointer',
                    backgroundColor: templateFilter === 'EXPENSE' ? '#dc2626' : '#e2e8f0',
                    color: templateFilter === 'EXPENSE' ? '#ffffff' : '#475569',
                    transition: 'all 0.15s ease',
                  }}
                >
                  💸 Daily Expenses ({SAMPLE_TEMPLATES.filter((t) => t.category === 'EXPENSE').length})
                </button>
                <button
                  type="button"
                  onClick={() => setTemplateFilter('NOTES')}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    border: 'none',
                    cursor: 'pointer',
                    backgroundColor: templateFilter === 'NOTES' ? '#b45309' : '#e2e8f0',
                    color: templateFilter === 'NOTES' ? '#ffffff' : '#475569',
                    transition: 'all 0.15s ease',
                  }}
                >
                  📝 Notes & Checklists ({SAMPLE_TEMPLATES.filter((t) => t.category === 'NOTES').length})
                </button>
              </div>

              {/* Templates Cards Grid */}
              <div
                style={{
                  padding: '1.25rem',
                  overflowY: 'auto',
                  flex: 1,
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
                  gap: '0.9rem',
                }}
              >
                {SAMPLE_TEMPLATES.filter((tpl) => templateFilter === 'ALL' || tpl.category === templateFilter).map((tpl) => (
                  <div
                    key={tpl.id}
                    style={{
                      border: '1px solid #cbd5e1',
                      borderRadius: '10px',
                      padding: '1.1rem',
                      backgroundColor: '#ffffff',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.03)',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLDivElement).style.borderColor = '#059669';
                      (e.currentTarget as HTMLDivElement).style.boxShadow = '0 6px 14px -2px rgba(0,0,0,0.08)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLDivElement).style.borderColor = '#cbd5e1';
                      (e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 4px rgba(0,0,0,0.03)';
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                        <span
                          style={{
                            fontSize: '0.7rem',
                            fontWeight: 800,
                            padding: '2px 8px',
                            borderRadius: '4px',
                            backgroundColor:
                              tpl.category === 'SALES' ? '#ecfdf5' : tpl.category === 'EXPENSE' ? '#fef2f2' : '#fef3c7',
                            color:
                              tpl.category === 'SALES' ? '#047857' : tpl.category === 'EXPENSE' ? '#b91c1c' : '#b45309',
                            border: `1px solid ${
                              tpl.category === 'SALES' ? '#a7f3d0' : tpl.category === 'EXPENSE' ? '#fecaca' : '#fde68a'
                            }`,
                          }}
                        >
                          {tpl.badge}
                        </span>
                        <span style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 600 }}>
                          {tpl.category === 'NOTES' ? 'Notepad Template' : 'Spreadsheet Mode'}
                        </span>
                      </div>
                      <h4 style={{ margin: '0 0 0.4rem 0', fontSize: '0.98rem', fontWeight: 800, color: '#0f172a' }}>
                        {tpl.name}
                      </h4>
                      <p style={{ margin: '0 0 0.85rem 0', fontSize: '0.8rem', color: '#64748b', lineHeight: 1.45 }}>
                        {tpl.description}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleApplyTemplate(tpl)}
                      style={{
                        width: '100%',
                        padding: '8px 14px',
                        backgroundColor:
                          tpl.category === 'SALES' ? '#059669' : tpl.category === 'EXPENSE' ? '#b91c1c' : '#b45309',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '0.8rem',
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.45rem',
                        transition: 'opacity 0.15s ease',
                      }}
                      onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.opacity = '0.9')}
                      onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.opacity = '1')}
                    >
                      <Sparkles size={14} />
                      <span>1-Click Load Template</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Floating Toast Notification */}
        {toastMessage && (
          <div
            style={{
              position: 'fixed',
              bottom: '24px',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 1300,
              backgroundColor: '#0f172a',
              color: '#ffffff',
              padding: '9px 20px',
              borderRadius: '8px',
              fontSize: '0.82rem',
              fontWeight: 700,
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.4)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.55rem',
              border: '1px solid #334155',
            }}
          >
            <Sparkles size={15} color="#fbbf24" />
            <span>{toastMessage}</span>
          </div>
        )}
      </div>
    </div>
  );
};
