import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { customerService } from '../../services/customerService';
import { productService } from '../../services/productService';
import { orderService } from '../../services/orderService';
import { routeService } from '../../services/routeService';
import { paymentService } from '../../services/paymentService';
import { reportService } from '../../services/reportService';
import { creditService } from '../../services/creditService';
import { Customer, Product, Route, Driver, Order, Payment } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import {
  Plus,
  AlertCircle,
  CheckCircle2,
  Save,
  Search,
  RotateCcw,
  Check,
  X,
  UserPlus,
  Store,
  Trash2,
  RefreshCw,
  Truck,
  CheckCheck,
  Sun,
  Sunrise,
  Lock,
  ExternalLink,
  Smartphone,
  Edit,
  Edit2,
  AlertTriangle,
  MessageCircle,
  Columns3,
  Table,
  Zap,
  Sparkles,
  Copy,
  Clock,
  Phone,
  MapPin,
  Printer,
  CreditCard,
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
  BarChart2,
  BellRing,
} from 'lucide-react';

const RealWhatsAppWebView = React.lazy(() =>
  import('../../components/RealWhatsAppWebView').then((m) => ({ default: m.RealWhatsAppWebView }))
);
const InvoiceModal = React.lazy(() =>
  import('../../components/InvoiceModal').then((m) => ({ default: m.InvoiceModal }))
);
import { UniversalDatePicker } from '../../components/UniversalDatePicker';
import { useSettings } from '../../context/SettingsContext';
import { draftOrderStorage } from '../../utils/draftOrderStorage';
import { BulkSendWhatsAppBillsModal, BulkBillItem } from '../../components/BulkSendWhatsAppBillsModal';
import { BulkSendWhatsAppReminderModal, PendingCustomerReminderItem } from '../../components/BulkSendWhatsAppReminderModal';

export interface WhatsAppCustomerContext {
  id: string;
  name: string;
  owner?: string;
  phone?: string;
  route?: string;
  balance?: string;
}

export interface OrderRow {
  rowId: string;
  customerId: string;
  customerName: string;
  customerOwner?: string;
  customerPhone?: string;
  customerRouteId?: string;
  customerRoute?: string;
  customerBalance?: string;
  driverId?: string;
  driverName?: string;
  kubbusQty: string;
  romaliQty: string;
  productQuantities?: Record<string, string>;
  cashAmount: string;
  gpayAmount: string;
  discountAmount: string;
  status: 'IDLE' | 'SAVING' | 'SAVED' | 'ERROR' | 'LOCKED';
  orderId?: string;
  orderNumber?: string;
  listOrder?: number;
  errorMessage?: string;
  isCustomRow?: boolean;
  isChangingCustomer?: boolean;
  orderSource?: string;
  enteredByName?: string;
  enteredByRole?: string;
  createdAt?: string;
  submittedAt?: string;
  customerCreatedAt?: string;
}

export const CreateOrderPage: React.FC = () => {
  const navigate = useNavigate();
  const { isWhatsAppEnabled, isSelfOrderEnabled, isOrderDiscountEnabled, isDriverModuleEnabled } = useSettings();

  // Master Data
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(false);
  const [lastUpdatedTime, setLastUpdatedTime] = useState<string>(() => {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  });

  // Date Option (Defaults to today YYYY-MM-DD or URL ?date= param — no stale Chrome storage persistence)
  const [orderDate, setOrderDate] = useState<string>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const urlDate = params.get('date');
      if (urlDate && /^\d{4}-\d{2}-\d{2}$/.test(urlDate)) return urlDate;
    } catch {
      // ignore
    }
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
  const activeDateRef = useRef<string>(orderDate);

  // Day Opening & Closing Status for current date
  const [dayStatus, setDayStatus] = useState<{ is_opened: boolean; is_closed: boolean; opening_cash?: string } | null>(null);

  // Day Opening Modal State (Blocks wholesale entry until opened)
  const [isOpenDayModalOpen, setIsOpenDayModalOpen] = useState(false);
  const [openingCashInput, setOpeningCashInput] = useState('500.00');
  const [openingNotesInput, setOpeningNotesInput] = useState('');
  const [submittingDayOpen, setSubmittingDayOpen] = useState(false);
  const [dayOpenError, setDayOpenError] = useState<string | null>(null);

  // Filter & Search Controls (Persisted to localStorage so reloads retain selected filters)
  const [routeFilter, setRouteFilter] = useState<string>(() => {
    return localStorage.getItem('zamzam_fast_order_route_filter') || 'ALL';
  });
  const [sourceFilter, setSourceFilter] = useState<'ALL' | 'CUSTOMER_LINK' | 'MANAGER'>(() => {
    const saved = localStorage.getItem('zamzam_fast_order_source_filter');
    if (saved === 'CUSTOMER_LINK' || saved === 'MANAGER' || saved === 'ALL') return saved;
    return 'ALL';
  });
  const [orderSort, setOrderSort] = useState<'SHOP_CREATE_ASC' | 'CUSTOM'>(() => {
    const saved = localStorage.getItem('zamzam_fast_order_sort');
    if (saved === 'CUSTOM' || saved === 'SHOP_CREATE_ASC') {
      return saved;
    }
    return 'SHOP_CREATE_ASC';
  });

  // Custom sort order: array of row IDs in user-defined order (drag & drop)
  const [customSortOrder, setCustomSortOrder] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('zamzam_fast_custom_sort_order');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  // Track unsaved custom sort changes and save success feedback
  const [hasUnsavedCustomOrder, setHasUnsavedCustomOrder] = useState<boolean>(false);
  const [saveCustomOrderSuccess, setSaveCustomOrderSuccess] = useState<boolean>(false);
  // Whether custom order is in edit mode (showing drag/move handles, edit, remove, and save button)
  const [isCustomEditing, setIsCustomEditing] = useState<boolean>(false);

  // Show only shops with orders placed for the current date
  const [showOrdersOnly, setShowOrdersOnly] = useState<boolean>(() => {
    return localStorage.getItem('zamzam_show_orders_only') === 'true';
  });

  // Manual toggle for downside product and collection summary (on All Routes)
  const [showDownsideSummary, setShowDownsideSummary] = useState<boolean>(false);

  // Drag-and-drop state
  const dragRowId = useRef<string | null>(null);
  const dragOverRowId = useRef<string | null>(null);
  const [isDragging, setIsDragging] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);

  // Auto-sync filter & sort preferences to localStorage on change
  useEffect(() => {
    localStorage.setItem('zamzam_fast_order_sort', orderSort);
  }, [orderSort]);

  useEffect(() => {
    localStorage.setItem('zamzam_fast_order_route_filter', routeFilter);
  }, [routeFilter]);

  useEffect(() => {
    localStorage.setItem('zamzam_fast_order_source_filter', sourceFilter);
  }, [sourceFilter]);

  useEffect(() => {
    localStorage.setItem('zamzam_show_orders_only', String(showOrdersOnly));
  }, [showOrdersOnly]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showSearchDropdown, setShowSearchDropdown] = useState<boolean>(false);
  const [searchSelectedIndex, setSearchSelectedIndex] = useState<number>(0);
  const [whatsAppNavToken, setWhatsAppNavToken] = useState<number>(0);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Global Keyboard Shortcuts (F2 or Ctrl+K / Cmd+K to instantly focus Customer Search)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === 'F2' ||
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k')
      ) {
        e.preventDefault();
        if (searchInputRef.current) {
          searchInputRef.current.focus();
          searchInputRef.current.select();
        }
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);
  const [invoiceModalOrder, setInvoiceModalOrder] = useState<{ order: Order; customer?: Customer | null } | null>(null);
  const [isBulkWhatsAppModalOpen, setIsBulkWhatsAppModalOpen] = useState(false);
  const [isPendingReminderModalOpen, setIsPendingReminderModalOpen] = useState(false);

  // Customer Details Edit Modal State
  const [isEditCustomerModalOpen, setIsEditCustomerModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [editCustName, setEditCustName] = useState('');
  const [editCustOwner, setEditCustOwner] = useState('');
  const [editCustPhone, setEditCustPhone] = useState('');
  const [editCustAltPhone, setEditCustAltPhone] = useState('');
  const [editCustAddress, setEditCustAddress] = useState('');
  const [editCustLandmark, setEditCustLandmark] = useState('');
  const [editCustRoute, setEditCustRoute] = useState('');
  const [editCustCreditLimit, setEditCustCreditLimit] = useState('5000.00');
  const [editCustIsActive, setEditCustIsActive] = useState(true);
  const [editCustNotes, setEditCustNotes] = useState('');
  const [editCustError, setEditCustError] = useState<string | null>(null);
  const [editCustSubmitting, setEditCustSubmitting] = useState(false);
  const [editCustProductPrices, setEditCustProductPrices] = useState<Record<string, string>>({});

  // Time format helper functions
  const formatOrderTime = (isoString?: string): string => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    } catch {
      return '';
    }
  };

  const formatOrderDateTime = (isoString?: string): string => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return '';
      const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
      const dateStr = d.toLocaleDateString([], { day: '2-digit', month: 'short' });
      return `${dateStr}, ${timeStr}`;
    } catch {
      return '';
    }
  };

  const handleOpenCustomerEdit = (customerId: string) => {
    const cust = customers.find((c) => c.id === customerId);
    if (!cust) return;
    setEditingCustomer(cust);
    setEditCustName(cust.name || '');
    setEditCustOwner(cust.owner_name || '');
    setEditCustPhone(cust.phone || '');
    setEditCustAltPhone(cust.alternative_phone || '');
    setEditCustAddress(cust.address || '');
    setEditCustLandmark(cust.landmark || '');
    const rId = typeof cust.route === 'string' ? cust.route : cust.route_details?.id || (routes[0]?.id ?? '');
    setEditCustRoute(rId);
    setEditCustCreditLimit(cust.credit_limit || '5000.00');
    setEditCustIsActive(cust.is_active ?? true);
    setEditCustNotes(cust.notes || '');
    setEditCustError(null);

    // Initialize custom wholesale product prices
    const initPrices: Record<string, string> = {};
    products.forEach((p) => {
      if (pricingCache[customerId]?.[p.id] !== undefined) {
        initPrices[p.id] = String(pricingCache[customerId][p.id]);
      } else if (cust.custom_prices?.[p.id] !== undefined) {
        initPrices[p.id] = cust.custom_prices[p.id];
      } else {
        initPrices[p.id] = p.unit_price;
      }
    });
    setEditCustProductPrices(initPrices);

    setIsEditCustomerModalOpen(true);
  };

  const handleSaveCustomerEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCustomer) return;
    if (!editCustName.trim()) {
      setEditCustError('Customer shop name is required.');
      return;
    }
    if (!editCustPhone.trim()) {
      setEditCustError('Phone number is required.');
      return;
    }

    try {
      setEditCustSubmitting(true);
      setEditCustError(null);

      // Collect product prices to persist to backend
      const product_prices: Array<{ product_id: string; price: string }> = [];
      const updatedCacheEntry: Record<string, number> & { kubbusPrice?: number; romaliPrice?: number } = {
        ...(pricingCache[editingCustomer.id] || {}),
      };
      const updatedCustomPricesDict: Record<string, string> = {
        ...(editingCustomer.custom_prices || {}),
      };

      products.forEach((prod) => {
        const val = editCustProductPrices[prod.id];
        if (val !== undefined && val !== null && String(val).trim() !== '') {
          const numVal = parseFloat(String(val).trim());
          if (!isNaN(numVal) && numVal > 0) {
            product_prices.push({ product_id: prod.id, price: numVal.toFixed(2) });
            updatedCacheEntry[prod.id] = numVal;
            updatedCustomPricesDict[prod.id] = numVal.toFixed(2);
            if (kubbusProduct && prod.id === kubbusProduct.id) updatedCacheEntry.kubbusPrice = numVal;
            if (romaliProduct && prod.id === romaliProduct.id) updatedCacheEntry.romaliPrice = numVal;
          } else if (!isNaN(numVal) && numVal === 0) {
            // Price set to 0 -> deactivate custom price
            product_prices.push({ product_id: prod.id, price: '0.00' });
            delete updatedCacheEntry[prod.id];
            delete updatedCustomPricesDict[prod.id];
            if (kubbusProduct && prod.id === kubbusProduct.id) delete updatedCacheEntry.kubbusPrice;
            if (romaliProduct && prod.id === romaliProduct.id) delete updatedCacheEntry.romaliPrice;
          }
        }
      });

      const updated = await customerService.updateCustomer(editingCustomer.id, {
        name: editCustName.trim(),
        owner_name: editCustOwner.trim(),
        phone: editCustPhone.trim(),
        alternative_phone: editCustAltPhone.trim(),
        address: editCustAddress.trim(),
        landmark: editCustLandmark.trim(),
        route: editCustRoute || undefined,
        credit_limit: editCustCreditLimit,
        is_active: editCustIsActive,
        notes: editCustNotes.trim(),
        product_prices: product_prices.length > 0 ? product_prices : undefined,
      });

      updated.custom_prices = updatedCustomPricesDict;

      // Update in-memory pricing cache and customers list
      setPricingCache((prev) => ({ ...prev, [editingCustomer.id]: updatedCacheEntry }));
      setCustomers((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));

      // Update in-memory order rows
      const routeObj = routes.find((r) => r.id === updated.route || r.id === (updated.route_details as any)?.id);
      setRows((prev) =>
        prev.map((r) =>
          r.customerId === updated.id
            ? {
                ...r,
                customerName: updated.name,
                customerOwner: updated.owner_name || '',
                customerRouteId: (typeof updated.route === 'string' ? updated.route : updated.route_details?.id) || r.customerRouteId,
                customerRoute: updated.route_details?.name || routeObj?.name || r.customerRoute,
              }
            : r
        )
      );

      setIsEditCustomerModalOpen(false);
      setSuccessBanner(`Updated details for shop "${updated.name}" successfully!`);
      setTimeout(() => setSuccessBanner(null), 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update customer details.';
      setEditCustError(msg);
    } finally {
      setEditCustSubmitting(false);
    }
  };

  // Edit Previous Due Modal State & Handlers
  const [isPrevDueModalOpen, setIsPrevDueModalOpen] = useState(false);
  const [prevDueRow, setPrevDueRow] = useState<OrderRow | null>(null);
  const [prevDueAmount, setPrevDueAmount] = useState('');
  const [prevDueError, setPrevDueError] = useState<string | null>(null);

  const handleOpenPrevDueModal = (row: OrderRow) => {
    setPrevDueRow(row);
    setPrevDueAmount(row.customerBalance || '0.00');
    setPrevDueError(null);
    setIsPrevDueModalOpen(true);
  };

  // Selected Customer and Row for Billing & WhatsApp Panel
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);

  // Workspace Mode: 'split' | 'billing_only' | 'whatsapp_only'
  const [workspaceMode, setWorkspaceMode] = useState<'split' | 'billing_only' | 'whatsapp_only'>(() => {
    const saved = localStorage.getItem('workspace_mode');
    if (saved === 'billing_only' || saved === 'whatsapp_only' || saved === 'split') return saved;
    return 'split';
  });

  // WhatsApp Panel Visible
  const [whatsappVisible, setWhatsappVisible] = useState<boolean>(() => {
    const saved = localStorage.getItem('whatsapp_visible');
    return saved !== 'false';
  });

  // Fixed WhatsApp Panel Width: 385px Phone Viewport
  const whatsappWidthPx = 385;

  // Mobile Tab & Modal State
  const [mobileTab, setMobileTab] = useState<'billing' | 'whatsapp'>('billing');
  const [mobileWhatsAppOpen, setMobileWhatsAppOpen] = useState(false);

  // Derived effective values respecting global isWhatsAppEnabled setting
  const showSplitWhatsAppPanel = isWhatsAppEnabled && whatsappVisible && workspaceMode === 'split';

  // Handle ?view=whatsapp query parameter from navigation
  useEffect(() => {
    if (!isWhatsAppEnabled) return;
    const params = new URLSearchParams(location.search);
    if (params.get('view') === 'whatsapp' || params.get('tab') === 'whatsapp') {
      setWorkspaceMode('whatsapp_only');
      setWhatsappVisible(true);
    }
  }, [location.search, isWhatsAppEnabled]);

  // Sync to localStorage
  useEffect(() => {
    localStorage.setItem('workspace_mode', workspaceMode);
  }, [workspaceMode]);

  useEffect(() => {
    localStorage.setItem('whatsapp_visible', String(whatsappVisible));
  }, [whatsappVisible]);

  // Option: Auto-Confirm & Dispatch to Route Driver on Submit
  const [autoConfirmDriver, setAutoConfirmDriver] = useState<boolean>(true);

  // Customer-Specific Pricing Cache: customerId -> { [productId]: price, kubbusPrice?: number, romaliPrice?: number } (in-memory)
  const [pricingCache, setPricingCache] = useState<Record<string, Record<string, number> & { kubbusPrice?: number; romaliPrice?: number }>>({});

  // Rows State (All shops pre-populated)
  const [rows, setRows] = useState<OrderRow[]>([]);

  // Submitting State
  const [isSubmittingAll, setIsSubmittingAll] = useState(false);
  const [submitProgress, setSubmitProgress] = useState<{ current: number; total: number } | null>(null);

  // Customer Self-Order Edit Confirmation Popup Modal State
  const [selfOrderModalRow, setSelfOrderModalRow] = useState<OrderRow | null>(null);
  const [selfOrderPendingField, setSelfOrderPendingField] = useState<string | null>(null);
  const [unlockedSelfOrderIds, setUnlockedSelfOrderIds] = useState<Set<string>>(new Set());

  // Auto Data Entry / Bulk Assistant Modal State
  const [isAutoEntryModalOpen, setIsAutoEntryModalOpen] = useState(false);
  const [autoKubbusQty, setAutoKubbusQty] = useState('10');
  const [autoRomaliQty, setAutoRomaliQty] = useState('5');
  const [autoProductQtys, setAutoProductQtys] = useState<Record<string, string>>({});
  const [autoTargetMode, setAutoTargetMode] = useState<'visible' | 'all' | 'empty'>('visible');
  const [isAutoLoading, setIsAutoLoading] = useState(false);

  // New Customer Modal
  const [isNewCustModalOpen, setIsNewCustModalOpen] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustOwner, setNewCustOwner] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustAddress, setNewCustAddress] = useState('');
  const [newCustRoute, setNewCustRoute] = useState('');
  const [newCustListOrder, setNewCustListOrder] = useState('');
  const [newCustOrderNumber, setNewCustOrderNumber] = useState('');
  const [newCustOpeningBalance, setNewCustOpeningBalance] = useState('');
  const [newCustProductPrices, setNewCustProductPrices] = useState<Record<string, string>>({});
  const [newCustProductQuantities, setNewCustProductQuantities] = useState<Record<string, string>>({});
  const [quickRouteName, setQuickRouteName] = useState('');
  const [isCreatingRoute, setIsCreatingRoute] = useState(false);
  const [newCustKubbusPrice, setNewCustKubbusPrice] = useState('');
  const [newCustRomaliPrice, setNewCustRomaliPrice] = useState('');
  const [newCustSubmitting, setNewCustSubmitting] = useState(false);
  const [newCustError, setNewCustError] = useState<string | null>(null);

  // Input references for keyboard navigation
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Timestamp of the last user typing/data entry to prevent any background reloads while entering orders
  const lastUserInputTimeRef = useRef<number>(0);

  // Products Identification (supports SKU codes KBS/KUB and PRI/ROM or name match)
  const kubbusProduct = products.find((p) => p.code === 'KBS' || p.code === 'KUB' || p.name.toLowerCase().includes('kubbus'));
  const romaliProduct = products.find((p) => p.code === 'PRI' || p.code === 'ROM' || p.name.toLowerCase().includes('romali'));

  const defaultKubbusPrice = parseFloat(kubbusProduct?.unit_price || '0');
  const defaultRomaliPrice = parseFloat(romaliProduct?.unit_price || '0');

  // Dynamic Product Pricing Helper (Strict Fallback: Valid Custom Rate > Customer Custom Prices Dict > Product Default Rate > 0)
  const getProductPriceForCustomer = useCallback((customerId: string, product: Product): number => {
    // 1. Check pricingCache for specific product ID (must be > 0 to be valid custom rate)
    const cached = pricingCache[customerId]?.[product.id];
    if (cached !== undefined && !isNaN(cached) && cached > 0) return cached;

    // 2. Check kubbus / romali aliases in pricingCache
    if (kubbusProduct && product.id === kubbusProduct.id && pricingCache[customerId]?.kubbusPrice !== undefined && pricingCache[customerId]?.kubbusPrice! > 0) {
      return pricingCache[customerId].kubbusPrice!;
    }
    if (romaliProduct && product.id === romaliProduct.id && pricingCache[customerId]?.romaliPrice !== undefined && pricingCache[customerId]?.romaliPrice! > 0) {
      return pricingCache[customerId].romaliPrice!;
    }

    // 3. Fallback directly to customer object's custom_prices if returned from API
    const cust = customers.find((c) => c.id === customerId);
    if (cust?.custom_prices && cust.custom_prices[product.id] !== undefined) {
      const pVal = parseFloat(cust.custom_prices[product.id]);
      if (!isNaN(pVal) && pVal > 0) return pVal;
    }

    // 4. Fallback to product standard unit_price from database
    return parseFloat(product.unit_price || '0');
  }, [pricingCache, kubbusProduct, romaliProduct, customers]);

  // Open New Customer Modal Initializer
  const handleOpenNewCustomerModal = () => {
    const initPrices: Record<string, string> = {};
    const initQtys: Record<string, string> = {};
    products.forEach((p) => {
      initPrices[p.id] = p.unit_price;
      initQtys[p.id] = '';
    });
    setNewCustProductPrices(initPrices);
    setNewCustProductQuantities(initQtys);
    setNewCustListOrder(String(rows.length + 1));
    setNewCustOrderNumber('');
    setNewCustError(null);
    setIsNewCustModalOpen(true);
  };

  // Load existing orders & payments from database for the selected date
  const loadOrdersForDate = useCallback(
    async (
      targetDate: string,
      currentCustomers: Customer[],
      currentDrivers: Driver[],
      isBackground = false,
      isDateChange = false,
      prefetchedData?: {
        existingOrders: Order[];
        payments: Payment[];
        closingRes: any;
        historicalBalances: Record<string, string>;
      }
    ) => {
      if (currentCustomers.length === 0) {
        setRows([]);
        return;
      }
      if (!isBackground) {
        setOrdersLoading(true);
      }
      setIsSyncing(true);
      setError(null);

      try {
        const [existingOrders, payments, closingRes, historicalBalances] = prefetchedData
          ? [
              prefetchedData.existingOrders,
              prefetchedData.payments,
              prefetchedData.closingRes,
              prefetchedData.historicalBalances,
            ]
          : await Promise.all([
              orderService.getOrders({ date: targetDate }),
              paymentService.getPayments({ date: targetDate }),
              reportService.getDailyClosing(targetDate).catch(() => null),
              customerService.getBalancesForDate(targetDate).catch(() => ({} as Record<string, string>)),
            ]);

        if (closingRes) {
          const isOpened = Boolean(closingRes.is_opened);
          const isClosed = Boolean(closingRes.is_closed);
          setDayStatus({
            is_opened: isOpened,
            is_closed: isClosed,
            opening_cash: closingRes.opening_record?.opening_cash,
          });
          // Removed auto popup of Open Day modal to prevent annoyance
        } else {
          setDayStatus({ is_opened: false, is_closed: false });
        }

        // Map customerId -> Order (newest order takes precedence)
        const orderMap = new Map<string, Order>();
        const sortedOrders = [...existingOrders].sort((a, b) => {
          const tA = new Date(a.submitted_at || a.created_at || 0).getTime();
          const tB = new Date(b.submitted_at || b.created_at || 0).getTime();
          return tB - tA;
        });
        sortedOrders.forEach((ord) => {
          const custId = typeof ord.customer === 'string' ? ord.customer : (ord.customer as any)?.id || ord.customer_details?.id;
          if (custId && !orderMap.has(custId)) {
            orderMap.set(custId, ord);
          }
        });

        // Map customerId -> Cash and GPay totals
        const cashMap = new Map<string, number>();
        const gpayMap = new Map<string, number>();
        payments.forEach((p) => {
          const custId = typeof p.customer === 'string' ? p.customer : (p.customer as any)?.id;
          if (custId) {
            const amt = parseFloat(p.amount) || 0;
            if (p.payment_method === 'CASH') {
              cashMap.set(custId, (cashMap.get(custId) || 0) + amt);
            } else if (p.payment_method === 'GPAY_UPI') {
              gpayMap.set(custId, (gpayMap.get(custId) || 0) + amt);
            }
          }
        });

        // Build spreadsheet rows populated from database and drafts
        const populatedRows: OrderRow[] = currentCustomers.map((cust) => {
          const existingOrder = orderMap.get(cust.id) || orderMap.get(String(cust.id));
          let kQty = '';
          let rQty = '';
          const productQuantities: Record<string, string> = {};

          if (existingOrder && existingOrder.items) {
            existingOrder.items.forEach((item) => {
              const pid = item.product || item.product_details?.id;
              if (pid && item.quantity > 0) {
                productQuantities[pid] = String(item.quantity);
              }
              const pCode = (item.product_details?.code || '').toUpperCase();
              const pName = (item.product_details?.name || '').toLowerCase();
              if (pCode === 'KBS' || pCode === 'KUB' || pName.includes('kubbus')) {
                kQty = item.quantity > 0 ? String(item.quantity) : '';
              }
              if (pCode === 'PRI' || pCode === 'ROM' || pName.includes('romali')) {
                rQty = item.quantity > 0 ? String(item.quantity) : '';
              }
            });
          }

          let cAmt = cashMap.get(cust.id);
          let gAmt = gpayMap.get(cust.id);
          let dAmt = existingOrder?.shop_expense ? parseFloat(existingOrder.shop_expense) : undefined;

          // Check if customer notes contain a stop number, e.g. [Stop #3]
          let parsedStopNumber: number | undefined;
          if (cust.notes) {
            const stopMatch = cust.notes.match(/\[(?:Stop|Order)\s*#?(\d+)\]/i);
            if (stopMatch && stopMatch[1]) {
              parsedStopNumber = parseInt(stopMatch[1], 10);
            }
          }

          const custRouteId = cust.route || cust.route_details?.id || '';
          const custRouteName = cust.route_details?.name || '';

          const routeDriver = currentDrivers.find(
            (d) =>
              (d.assigned_route === custRouteId ||
                d.assigned_route_details?.id === custRouteId ||
                (custRouteName && d.assigned_route_details?.name && d.assigned_route_details.name.toLowerCase() === custRouteName.toLowerCase())) &&
              d.is_active
          );

          const driverDisplay =
            existingOrder?.driver_name ||
            (routeDriver
              ? routeDriver.user_details?.first_name
                ? `${routeDriver.user_details.first_name} ${routeDriver.user_details.last_name || ''}`
                : routeDriver.driver_name
              : undefined);

          const isLocked = existingOrder && ['DELIVERED', 'COMPLETED', 'CANCELLED'].includes(existingOrder.status);

          // Calculate historical previous due prior to this order so balance carries forward chronologically
          let initialRowBalance = '0.00';
          if (historicalBalances?.[cust.id] !== undefined && historicalBalances?.[cust.id] !== null) {
            initialRowBalance = String(historicalBalances[cust.id]);
          } else if (existingOrder?.previous_balance !== undefined && existingOrder?.previous_balance !== null) {
            initialRowBalance = String(existingOrder.previous_balance);
          } else if (existingOrder?.total_amount) {
            const oTot = parseFloat(existingOrder.total_amount) || 0;
            const pPaid = (cAmt || 0) + (gAmt || 0);
            const currentTotalBal = parseFloat(cust.current_balance || '0');
            initialRowBalance = (currentTotalBal - oTot + pPaid).toFixed(2);
          } else {
            initialRowBalance = cust.current_balance || '0.00';
          }

          return {
            rowId: `shop_${cust.id}`,
            customerId: cust.id,
            customerName: cust.name,
            customerOwner: cust.owner_name || '',
            customerRouteId: custRouteId,
            customerRoute: custRouteName,
            customerBalance: initialRowBalance,
            driverId: existingOrder?.driver || routeDriver?.id,
            driverName: driverDisplay,
            kubbusQty: kQty,
            romaliQty: rQty,
            productQuantities,
            cashAmount: cAmt !== undefined ? cAmt.toFixed(2) : '',
            gpayAmount: gAmt !== undefined ? gAmt.toFixed(2) : '',
            discountAmount: dAmt !== undefined ? dAmt.toFixed(2) : '',
            status: isLocked ? 'LOCKED' : (existingOrder ? 'SAVED' : 'IDLE'),
            orderId: existingOrder?.id,
            orderNumber: existingOrder?.order_number,
            listOrder: parsedStopNumber,
            orderSource: existingOrder?.source,
            enteredByName: existingOrder?.entered_by_name,
            enteredByRole: existingOrder?.entered_by_role,
            createdAt: existingOrder?.created_at,
            submittedAt: existingOrder?.submitted_at,
            customerCreatedAt: cust.created_at,
          };
        });

        const isSwitchingDate = isDateChange || targetDate !== activeDateRef.current;
        activeDateRef.current = targetDate;

        setUnlockedSelfOrderIds(new Set());
        if (isSwitchingDate) {
          // Date switched: directly display the clean orders & drafts for the selected date!
          setRows(populatedRows);
        } else {
          setRows((prevRows) => {
            if (prevRows.length === 0) return populatedRows;
            const editingMap = new Map<string, OrderRow>();
            prevRows.forEach((r) => {
              const hasUserInput = Boolean(
                r.status === 'IDLE' ||
                r.status === 'SAVING' ||
                r.status === 'ERROR' ||
                (r.kubbusQty && r.kubbusQty !== '0') ||
                (r.romaliQty && r.romaliQty !== '0') ||
                (r.cashAmount && r.cashAmount !== '0') ||
                (r.gpayAmount && r.gpayAmount !== '0') ||
                (r.discountAmount && r.discountAmount !== '0') ||
                (r.productQuantities && Object.values(r.productQuantities).some((v) => v && v !== '0')) ||
                (r.customerId && Boolean(draftOrderStorage.getDraft(targetDate, r.customerId)))
              );
              if (hasUserInput && r.customerId) {
                editingMap.set(r.customerId, r);
              }
            });
            if (editingMap.size === 0) return populatedRows;
            return populatedRows.map((newRow) => {
              const editing = editingMap.get(newRow.customerId);
              if (editing) {
                return {
                  ...newRow,
                  productQuantities: editing.productQuantities || newRow.productQuantities,
                  kubbusQty: editing.kubbusQty,
                  romaliQty: editing.romaliQty,
                  cashAmount: editing.cashAmount,
                  gpayAmount: editing.gpayAmount,
                  discountAmount: editing.discountAmount,
                  status: editing.status,
                  errorMessage: editing.errorMessage,
                };
              }
              return newRow;
            });
          });
        }
      } catch (err: unknown) {
        console.error('Failed to load orders for date', targetDate, err);
        if (!isBackground) {
          setError(`Failed to load existing orders for date ${targetDate}.`);
        }
      } finally {
        setOrdersLoading(false);
        setIsSyncing(false);
        setLastUpdatedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      }
    },
    []
  );

  // Initial Data Load
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        setLoading(true);
        const [
          custList,
          prodList,
          routeList,
          driverList,
          existingOrders,
          payments,
          closingRes,
          historicalBalances,
        ] = await Promise.all([
          customerService.getCustomers(),
          productService.getProducts(),
          routeService.getRoutes(),
          routeService.getDrivers(),
          orderService.getOrders({ date: orderDate }),
          paymentService.getPayments({ date: orderDate }),
          reportService.getDailyClosing(orderDate).catch(() => null),
          customerService.getBalancesForDate(orderDate).catch(() => ({} as Record<string, string>)),
        ]);
        const sortedProducts = [...prodList].sort((a, b) => {
          const orderA = a.order_number ?? 999;
          const orderB = b.order_number ?? 999;
          if (orderA !== orderB) return orderA - orderB;
          return (a.created_at || '').localeCompare(b.created_at || '');
        });
        setCustomers(custList);
        setProducts(sortedProducts);
        setRoutes(routeList);
        setDrivers(driverList);

        if (routeList.length > 0) {
          setNewCustRoute(routeList[0].id);
        }

        const kProd = prodList.find((p) => p.code === 'KBS' || p.code === 'KUB' || p.name.toLowerCase().includes('kubbus'));
        const rProd = prodList.find((p) => p.code === 'PRI' || p.code === 'ROM' || p.name.toLowerCase().includes('romali'));
        if (kProd) setNewCustKubbusPrice(kProd.unit_price);
        if (rProd) setNewCustRomaliPrice(rProd.unit_price);

        // Pre-populate pricingCache for all customers immediately from database custom_prices
        const initialPricing: Record<string, Record<string, number> & { kubbusPrice?: number; romaliPrice?: number }> = {};
        custList.forEach((c) => {
          const entry: Record<string, number> & { kubbusPrice?: number; romaliPrice?: number } = {};
          if (c.custom_prices) {
            Object.entries(c.custom_prices).forEach(([prodId, priceStr]) => {
              const cpNum = parseFloat(priceStr);
              if (!isNaN(cpNum) && cpNum > 0) {
                entry[prodId] = cpNum;
                if (kProd && prodId === kProd.id) entry.kubbusPrice = cpNum;
                if (rProd && prodId === rProd.id) entry.romaliPrice = cpNum;
              }
            });
          }
          if (Object.keys(entry).length > 0) {
            initialPricing[c.id] = entry;
          }
        });
        setPricingCache((prev) => ({ ...prev, ...initialPricing }));

        const initialAutoQtys: Record<string, string> = {};
        prodList.forEach((p, idx) => {
          initialAutoQtys[p.id] = idx === 0 ? '10' : idx === 1 ? '5' : '0';
        });
        setAutoProductQtys(initialAutoQtys);

        // Purge any stale Chrome localStorage order drafts, cached dates, or pricing caches
        draftOrderStorage.clearAllChromeStorage();

        // Load existing orders from database for today's date using prefetched data (0 sequential wait!)
        await loadOrdersForDate(orderDate, custList, driverList, false, false, {
          existingOrders,
          payments,
          closingRes,
          historicalBalances,
        });
      } catch (err: unknown) {
        console.error(err);
        setError('Failed to load customers and product catalog.');
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();
  }, [loadOrdersForDate]);

  // When orderDate changes, automatically re-query database for that date!
  const handleDateChange = async (newDate: string) => {
    setOrderDate(newDate);
    setSuccessBanner(null);
    setUnlockedSelfOrderIds(new Set());

    // Fast path: If customers are already loaded, IMMEDIATELY load orders for the new date (0ms wait!)
    if (customers && customers.length > 0) {
      loadOrdersForDate(newDate, customers, drivers, false, true);
    } else {
      try {
        const freshCusts = await customerService.getCustomers(undefined, undefined, true);
        setCustomers(freshCusts);
        loadOrdersForDate(newDate, freshCusts, drivers, false, true);
      } catch {
        // fallback
      }
    }
  };

  // User-Controlled Auto-Sync (Disabled by default so order table remains 100% stable without unexpected reloads)
  useEffect(() => {
    if (!autoSyncEnabled) return;
    const timer = setInterval(() => {
      // 1. Never auto-sync/reload if user is actively focused on any input/textarea
      const isInputActive = Boolean(
        document.activeElement &&
        (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')
      );
      if (isInputActive) {
        return;
      }

      // 2. Never auto-sync/reload if user typed or entered anything in the last 60 seconds
      if (Date.now() - lastUserInputTimeRef.current < 60000) {
        return;
      }

      // 3. Never auto-sync/reload if currently submitting or no customers
      if (!isSubmittingAll && customers.length > 0) {
        loadOrdersForDate(orderDate, customers, drivers, true);
      }
    }, 60000);

    return () => clearInterval(timer);
  }, [autoSyncEnabled, orderDate, customers, drivers, isSubmittingAll, loadOrdersForDate]);

  // Open Business Day Handler
  const handleOpenDay = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmittingDayOpen(true);
      setDayOpenError(null);
      await reportService.openDay({
        date: orderDate,
        opening_cash: openingCashInput,
        notes: openingNotesInput,
      });
      setDayStatus({
        is_opened: true,
        is_closed: false,
        opening_cash: openingCashInput,
      });
      setIsOpenDayModalOpen(false);
      setSuccessBanner(`Business Day (${orderDate}) opened successfully with opening float of ₹${openingCashInput}! You can now enter wholesale orders.`);
      setTimeout(() => setSuccessBanner(null), 5000);
      // Auto-focus first input
      setTimeout(() => {
        if (rows.length > 0) {
          const firstCol = products.length > 0 ? `prod_${products[0].id}` : 'kubbus';
          focusCell(0, firstCol);
        }
      }, 150);
    } catch (err: unknown) {
      if (err instanceof Error) setDayOpenError(err.message);
      else setDayOpenError('Failed to open business day.');
    } finally {
      setSubmittingDayOpen(false);
    }
  };

  // Fetch and cache custom pricing for customer dynamically for all products
  const fetchCustomerPricing = useCallback(async (custId: string, forceRefresh = false) => {
    if (!custId) return;
    if (!forceRefresh && pricingCache[custId]) {
      return pricingCache[custId];
    }

    try {
      const pricingList = await customerService.getCustomerPricing(custId);
      const entry: Record<string, number> & { kubbusPrice?: number; romaliPrice?: number } = {};

      const currentCatalog = products.length > 0 ? products : [];
      currentCatalog.forEach((p) => {
        entry[p.id] = parseFloat(p.unit_price || '0');
      });

      pricingList.forEach((item) => {
        const effPrice = parseFloat(item.effective_price);
        if (!isNaN(effPrice)) {
          entry[item.product_id] = effPrice;
          if (kubbusProduct && item.product_id === kubbusProduct.id) {
            entry.kubbusPrice = effPrice;
          }
          if (romaliProduct && item.product_id === romaliProduct.id) {
            entry.romaliPrice = effPrice;
          }
        }
      });

      if (entry.kubbusPrice === undefined) entry.kubbusPrice = defaultKubbusPrice;
      if (entry.romaliPrice === undefined) entry.romaliPrice = defaultRomaliPrice;

      setPricingCache((prev) => ({ ...prev, [custId]: entry }));
      return entry;
    } catch {
      const cust = customers.find((c) => c.id === custId);
      const fallback: Record<string, number> & { kubbusPrice: number; romaliPrice: number } = {
        kubbusPrice: defaultKubbusPrice,
        romaliPrice: defaultRomaliPrice,
      };
      products.forEach((p) => {
        if (cust?.custom_prices && cust.custom_prices[p.id] !== undefined) {
          fallback[p.id] = parseFloat(cust.custom_prices[p.id]);
        } else {
          fallback[p.id] = parseFloat(p.unit_price || '0');
        }
      });
      if (kubbusProduct && fallback[kubbusProduct.id] !== undefined) {
        fallback.kubbusPrice = fallback[kubbusProduct.id];
      }
      if (romaliProduct && fallback[romaliProduct.id] !== undefined) {
        fallback.romaliPrice = fallback[romaliProduct.id];
      }
      setPricingCache((prev) => ({ ...prev, [custId]: fallback }));
      return fallback;
    }
  }, [products, kubbusProduct, romaliProduct, defaultKubbusPrice, defaultRomaliPrice, pricingCache, customers]);

  // Keyboard navigation helper
  const focusCell = (visibleIndex: number, col: string) => {
    const targetRow = visibleRows[visibleIndex];
    if (targetRow) {
      if (targetRow.customerId) setSelectedCustomerId(targetRow.customerId);
      setSelectedRowId(targetRow.rowId);
    }
    setTimeout(() => {
      let el = inputRefs.current[`${visibleIndex}_${col}`];
      if (!el && visibleRows[visibleIndex]?.customerId) {
        el = inputRefs.current[`cust_${visibleRows[visibleIndex].customerId}_${col}`];
      }
      if (!el && visibleRows[visibleIndex]) {
        const rowId = visibleRows[visibleIndex].customerId || visibleRows[visibleIndex].rowId;
        const rowEl = document.getElementById(`order-row-${rowId}`);
        if (rowEl) {
          el =
            rowEl.querySelector<HTMLInputElement>(`input[data-col="${col}"]`) ||
            rowEl.querySelector<HTMLInputElement>('input[type="number"]:not([readonly])');
        }
      }
      if (el) {
        el.focus();
        el.select();
        el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      }
    }, 25);
  };

  // Smart Search Relevance Scoring: Exact match > StartsWith > Word-Starts > Contains > Phone/Route
  const getCustomerSearchScore = useCallback(
    (
      name: string,
      owner?: string,
      route?: string,
      phone?: string,
      query: string = '',
      digitsQuery: string = ''
    ): number => {
      const q = query.toLowerCase().trim();
      if (!q) return 0;

      const n = (name || '').toLowerCase().trim();
      const o = (owner || '').toLowerCase().trim();
      const r = (route || '').toLowerCase().trim();
      const p = (phone || '').replace(/[^0-9]/g, '');

      let score = 0;

      // 1. Exact shop name match
      if (n === q) return 10000;

      // 2. Shop name starts with search query (e.g. "s" -> "Sha", "Star", "Super")
      if (n.startsWith(q)) {
        score += 5000 + (100 - Math.min(n.length, 100));
      }
      // 3. Any word in the shop name starts with search query (e.g. "Royal Star" -> "st")
      else if (new RegExp(`(^|\\s)${q.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}`, 'i').test(n)) {
        score += 3500;
      }
      // 4. Shop name contains search query
      else if (n.includes(q)) {
        score += 1800;
      }

      // 5. Owner name matches
      if (o === q) {
        score += 1500;
      } else if (o.startsWith(q)) {
        score += 1000;
      } else if (o.includes(q)) {
        score += 400;
      }

      // 6. Phone number matches (last digits or prefix)
      if (digitsQuery.length >= 2 && p) {
        if (p.endsWith(digitsQuery)) {
          score += 1200;
        } else if (p.startsWith(digitsQuery)) {
          score += 900;
        } else if (p.includes(digitsQuery)) {
          score += 600;
        }
      }

      // 7. Route name matches
      if (r.startsWith(q)) {
        score += 300;
      } else if (r.includes(q)) {
        score += 100;
      }

      return score;
    },
    []
  );

  // Bulletproof direct customer row & cell focus
  const focusCustomerCell = (customerId: string, col?: string) => {
    setSelectedCustomerId(customerId);
    const mRow = rows.find((r) => r.customerId === customerId);
    if (mRow) setSelectedRowId(mRow.rowId);
    const doFocus = () => {
      const pCols = products.length > 0 ? products.map((p) => `prod_${p.id}`) : ['kubbus', 'romali'];
      const targetCol = col || pCols[0] || 'kubbus';
      let el = inputRefs.current[`cust_${customerId}_${targetCol}`];
      const rowEl =
        document.getElementById(`order-row-${customerId}`) ||
        document.querySelector(`tr[data-customer-id="${customerId}"]`);
      if (rowEl) {
        rowEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        if (!el) {
          el =
            (targetCol ? rowEl.querySelector<HTMLInputElement>(`input[data-col="${targetCol}"]:not([readonly])`) : null) ||
            rowEl.querySelector<HTMLInputElement>('input[type="number"]:not([readonly])');
        }
      }
      if (!el) {
        const vIdx = visibleRows.findIndex((r) => r.customerId === customerId);
        if (vIdx !== -1) {
          el = inputRefs.current[`${vIdx}_${targetCol}`];
        }
      }
      if (el) {
        el.focus();
        el.select();
        return true;
      }
      return false;
    };

    if (!doFocus()) {
      setTimeout(doFocus, 35);
      setTimeout(doFocus, 90);
      setTimeout(doFocus, 220);
    }
  };

  const handleClearAllFilters = () => {
    setRouteFilter('ALL');
    setSearchQuery('');
    setShowOrdersOnly(false);
    setSourceFilter('ALL');
  };

  // Visible rows filtered by Route & Search Query
  const visibleRows = useMemo(() => {
    const filtered = rows.filter((row) => {
      if (routeFilter !== 'ALL') {
        const selectedRouteObj = routes.find((r) => r.id === routeFilter);
        const matchesRoute =
          row.customerRouteId === routeFilter ||
          (selectedRouteObj && row.customerRouteId === selectedRouteObj.id) ||
          (row.customerRoute &&
            selectedRouteObj?.name &&
            selectedRouteObj.name.toLowerCase() === row.customerRoute.toLowerCase());
        if (!matchesRoute && !row.isCustomRow) return false;
      }

      if (sourceFilter !== 'ALL') {
        if (sourceFilter === 'CUSTOMER_LINK' && row.orderSource !== 'CUSTOMER_LINK') return false;
        if (sourceFilter === 'MANAGER' && row.orderSource === 'CUSTOMER_LINK') return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const custObj = customers.find((c) => c.id === row.customerId);
        const matchesName = row.customerName.toLowerCase().includes(q);
        const matchesOwner = (row.customerOwner || '').toLowerCase().includes(q);
        const matchesRouteName = (row.customerRoute || '').toLowerCase().includes(q);
        const matchesPhone = Boolean(custObj?.phone && custObj.phone.replace(/[^0-9]/g, '').includes(q.replace(/[^0-9]/g, '')));
        if (!matchesName && !matchesOwner && !matchesRouteName && !matchesPhone) return false;
      }

      return true;
    });

    // Apply orders-only filter
    const afterOrderFilter = showOrdersOnly
      ? filtered.filter((r) => Boolean(r.orderId || r.submittedAt || r.createdAt || r.kubbusQty !== '0' || r.romaliQty !== '0'))
      : filtered;

    // When searching, sort strictly by best match relevance so best candidate is always row 0
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const digitsQ = q.replace(/[^0-9]/g, '');
      return [...afterOrderFilter].sort((a, b) => {
        const custA = customers.find((c) => c.id === a.customerId);
        const custB = customers.find((c) => c.id === b.customerId);
        const scoreA = getCustomerSearchScore(a.customerName, a.customerOwner, a.customerRoute, custA?.phone, q, digitsQ);
        const scoreB = getCustomerSearchScore(b.customerName, b.customerOwner, b.customerRoute, custB?.phone, q, digitsQ);
        if (scoreB !== scoreA) return scoreB - scoreA;
        return a.customerName.localeCompare(b.customerName);
      });
    }

    // Helper function for shop registered oldest first (Shop Registered: Oldest)
    const sortByShopRegisteredOldest = (a: OrderRow, b: OrderRow) => {
      const tA = new Date(a.customerCreatedAt || 0).getTime();
      const tB = new Date(b.customerCreatedAt || 0).getTime();
      if (tA !== 0 && tB !== 0 && tA !== tB) return tA - tB;
      if (tA !== 0 && tB === 0) return -1;
      if (tA === 0 && tB !== 0) return 1;
      return a.customerName.localeCompare(b.customerName);
    };

    // Apply custom sort if selected
    if (orderSort === 'CUSTOM' && customSortOrder.length > 0) {
      return [...afterOrderFilter].sort((a, b) => {
        const iA = customSortOrder.indexOf(a.rowId);
        const iB = customSortOrder.indexOf(b.rowId);
        if (iA !== -1 && iB !== -1) return iA - iB;
        if (iA !== -1) return -1;
        if (iB !== -1) return 1;
        return sortByShopRegisteredOldest(a, b);
      });
    }

    // Default & SHOP_CREATE_ASC: sort by Shop Registered (Oldest)
    return [...afterOrderFilter].sort(sortByShopRegisteredOldest);
  }, [rows, routeFilter, sourceFilter, searchQuery, orderSort, routes, customers, customSortOrder, showOrdersOnly, getCustomerSearchScore]);

  // Synchronize single shared search state: auto-highlight matching customer across billing and WhatsApp
  useEffect(() => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matched = visibleRows.find((r) => {
        const custObj = customers.find((c) => c.id === r.customerId);
        return (
          r.customerName.toLowerCase().includes(q) ||
          (r.customerOwner || '').toLowerCase().includes(q) ||
          Boolean(custObj?.phone && custObj.phone.replace(/[^0-9]/g, '').includes(q.replace(/[^0-9]/g, '')))
        );
      });
      if (matched) {
        if (matched.customerId) setSelectedCustomerId(matched.customerId);
        setSelectedRowId(matched.rowId);
      }
    }
  }, [searchQuery, visibleRows, customers]);

  // Count customer self-orders submitted online
  const selfOrdersCount = useMemo(() => {
    return rows.filter((r) => r.orderSource === 'CUSTOMER_LINK').length;
  }, [rows]);

  // Active Customer for WhatsApp Panel - Single Source of Truth from Billing Search & Table
  const activeCustomer: WhatsAppCustomerContext | null = useMemo(() => {
    // 1. If Billing search has text, find matching customer immediately
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchedRow = visibleRows.find(
        (r) =>
          r.customerName.toLowerCase().includes(q) ||
          (r.customerOwner || '').toLowerCase().includes(q)
      );
      if (matchedRow) {
        const custObj = customers.find((c) => c.id === matchedRow.customerId);
        return {
          id: matchedRow.customerId,
          name: matchedRow.customerName,
          owner: matchedRow.customerOwner || custObj?.owner_name || '',
          phone: custObj?.phone || 'No phone registered',
          route: matchedRow.customerRoute || custObj?.route_details?.name || '',
          balance: matchedRow.customerBalance || custObj?.current_balance || '0.00',
        };
      }
      const matchedCust = customers.find(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.owner_name || '').toLowerCase().includes(q) ||
          (c.phone && c.phone.includes(q))
      );
      if (matchedCust) {
        return {
          id: matchedCust.id,
          name: matchedCust.name,
          owner: matchedCust.owner_name || '',
          phone: matchedCust.phone || 'No phone registered',
          route: matchedCust.route_details?.name || '',
          balance: matchedCust.current_balance || '0.00',
        };
      }
      return null;
    }

    // 2. If no search text, use the customer selected by clicking or focusing a row
    if (selectedCustomerId) {
      const custObj = customers.find((c) => c.id === selectedCustomerId);
      const rowObj = rows.find((r) => r.customerId === selectedCustomerId);
      if (custObj || rowObj) {
        return {
          id: selectedCustomerId,
          name: rowObj?.customerName || custObj?.name || '',
          owner: rowObj?.customerOwner || custObj?.owner_name || '',
          phone: custObj?.phone || 'No phone registered',
          route: rowObj?.customerRoute || custObj?.route_details?.name || '',
          balance: rowObj?.customerBalance || custObj?.current_balance || '0.00',
        };
      }
    }

    return null;
  }, [searchQuery, visibleRows, selectedCustomerId, customers, rows]);

  // Handle cell value change (resets SAVED status to IDLE and persists in draft storage)
  const handleCellChange = (rowId: string, field: keyof OrderRow, value: string) => {
    const targetRow = rows.find((r) => r.rowId === rowId);
    if (targetRow && targetRow.orderSource === 'CUSTOMER_LINK' && !unlockedSelfOrderIds.has(rowId)) {
      setSelfOrderModalRow(targetRow);
      setSelfOrderPendingField(field === 'romaliQty' ? 'romali' : field === 'cashAmount' ? 'cash' : field === 'gpayAmount' ? 'gpay' : field === 'discountAmount' ? 'discount' : 'kubbus');
      return;
    }

    lastUserInputTimeRef.current = Date.now();
    setRows((prev) =>
      prev.map((r) => {
        if (r.rowId === rowId) {
          const updated = {
            ...r,
            [field]: value,
            // If user changes quantity on a saved row, mark as IDLE so it can be submitted and updated!
            status: 'IDLE' as const,
          };
          if (updated.customerId) {
            draftOrderStorage.saveDraft({
              customerId: updated.customerId,
              orderDate,
              kubbusQty: updated.kubbusQty,
              romaliQty: updated.romaliQty,
              productQuantities: updated.productQuantities,
              cashAmount: updated.cashAmount,
              gpayAmount: updated.gpayAmount,
              discountAmount: updated.discountAmount,
              updatedAt: Date.now(),
            });
          }
          return updated;
        }
        return r;
      })
    );
  };

  // Dynamic Product Quantity Change Handler
  const handleProductQtyChange = (rowId: string, productId: string, value: string) => {
    lastUserInputTimeRef.current = Date.now();
    const targetRow = rows.find((r) => r.rowId === rowId);
    if (targetRow && targetRow.orderSource === 'CUSTOMER_LINK' && !unlockedSelfOrderIds.has(rowId)) {
      setSelfOrderModalRow(targetRow);
      setSelfOrderPendingField(`prod_${productId}`);
      return;
    }

    setRows((prev) =>
      prev.map((r) => {
        if (r.rowId === rowId) {
          const updatedQuantities = {
            ...(r.productQuantities || {}),
            [productId]: value,
          };
          let kQty = r.kubbusQty;
          let rQty = r.romaliQty;
          if (kubbusProduct && productId === kubbusProduct.id) {
            kQty = value;
          }
          if (romaliProduct && productId === romaliProduct.id) {
            rQty = value;
          }

          const updated: OrderRow = {
            ...r,
            productQuantities: updatedQuantities,
            kubbusQty: kQty,
            romaliQty: rQty,
            status: 'IDLE' as const,
          };

          if (updated.customerId) {
            draftOrderStorage.saveDraft({
              customerId: updated.customerId,
              orderDate,
              kubbusQty: updated.kubbusQty,
              romaliQty: updated.romaliQty,
              productQuantities: updated.productQuantities,
              cashAmount: updated.cashAmount,
              gpayAmount: updated.gpayAmount,
              discountAmount: updated.discountAmount,
              updatedAt: Date.now(),
            });
          }
          return updated;
        }
        return r;
      })
    );
  };

  // Set Custom Order Number or Stop Order on an existing row
  const handleSetRowOrderDetails = (rowId: string, orderNum?: string, stopNum?: number) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.rowId === rowId) {
          return {
            ...r,
            orderNumber: orderNum !== undefined ? orderNum : r.orderNumber,
            listOrder: stopNum !== undefined ? stopNum : r.listOrder,
            status: 'IDLE' as const,
          };
        }
        return r;
      })
    );
  };

  // Apply quantities from WhatsApp chat directly into the billing row
  const handleApplyWhatsAppOrder = (customerId: string, kubbus: string, romali: string) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.customerId === customerId) {
          const updatedQuantities = { ...(r.productQuantities || {}) };
          if (kubbusProduct) updatedQuantities[kubbusProduct.id] = kubbus;
          if (romaliProduct) updatedQuantities[romaliProduct.id] = romali;

          const updated: OrderRow = {
            ...r,
            kubbusQty: kubbus || r.kubbusQty,
            romaliQty: romali || r.romaliQty,
            productQuantities: updatedQuantities,
            status: 'IDLE' as const,
          };
          draftOrderStorage.saveDraft({
            customerId: updated.customerId,
            orderDate,
            kubbusQty: updated.kubbusQty,
            romaliQty: updated.romaliQty,
            productQuantities: updated.productQuantities,
            cashAmount: updated.cashAmount,
            gpayAmount: updated.gpayAmount,
            discountAmount: updated.discountAmount,
            updatedAt: Date.now(),
          });
          return updated;
        }
        return r;
      })
    );
    setSelectedCustomerId(customerId);
  };

  // Calculate financials for a row dynamically across all products
  const getRowFinancials = (row: OrderRow) => {
    let rowTotal = 0;
    let hasOrder = false;
    let totalPieces = 0;
    const itemQuantities: Record<string, number> = {};

    const activeProducts = products.length > 0 ? products : [
      ...(kubbusProduct ? [kubbusProduct] : []),
      ...(romaliProduct ? [romaliProduct] : [])
    ];

    activeProducts.forEach((prod) => {
      let qStr = row.productQuantities?.[prod.id];
      if (qStr === undefined) {
        if (kubbusProduct && prod.id === kubbusProduct.id) qStr = row.kubbusQty;
        else if (romaliProduct && prod.id === romaliProduct.id) qStr = row.romaliQty;
        else qStr = '';
      }
      const qty = parseInt(qStr || '0', 10) || 0;
      itemQuantities[prod.id] = qty;
      if (qty > 0) {
        hasOrder = true;
        totalPieces += qty;
        const price = getProductPriceForCustomer(row.customerId, prod);
        rowTotal += qty * price;
      }
    });

    const kQty = itemQuantities[kubbusProduct?.id || ''] ?? (parseInt(row.kubbusQty, 10) || 0);
    const rQty = itemQuantities[romaliProduct?.id || ''] ?? (parseInt(row.romaliQty, 10) || 0);
    const kPrice = pricingCache[row.customerId]?.kubbusPrice ?? defaultKubbusPrice;
    const rPrice = pricingCache[row.customerId]?.romaliPrice ?? defaultRomaliPrice;
    if (activeProducts.length === 0) {
      rowTotal = kQty * kPrice + rQty * rPrice;
      hasOrder = kQty > 0 || rQty > 0;
      totalPieces = kQty + rQty;
    }

    const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
    const cash = round2(parseFloat(row.cashAmount) || 0);
    const gpay = round2(parseFloat(row.gpayAmount) || 0);
    const discount = round2(parseFloat(row.discountAmount) || 0);
    const rowPaid = round2(cash + gpay);
    const prevDue = round2(parseFloat(row.customerBalance || '0') || 0);
    const netBill = round2(Math.max(0, rowTotal - discount));
    const rowBalance = round2(prevDue + netBill - rowPaid);
    rowTotal = round2(rowTotal);

    return {
      kQty,
      rQty,
      kPrice,
      rPrice,
      rowTotal,
      netBill,
      cash,
      gpay,
      discount,
      rowPaid,
      prevDue,
      rowBalance,
      hasOrder,
      totalPieces,
      itemQuantities,
      isValid: Boolean(row.customerId) && (hasOrder || cash > 0 || gpay > 0 || discount > 0),
    };
  };

  const handleSavePrevDue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prevDueRow) return;

    const val = parseFloat(prevDueAmount.trim() || '0');
    if (isNaN(val) || val < 0) {
      setPrevDueError('Please enter a valid positive amount.');
      return;
    }

    const formattedAmount = val.toFixed(2);
    const targetRow = prevDueRow;
    const fin = getRowFinancials(targetRow);
    const todayUnpaid = targetRow.orderId ? Math.max(0, fin.netBill - fin.rowPaid) : 0;
    const targetTotalBalance = (val + todayUnpaid).toFixed(2);

    // 1. Update in rows state immediately so today's sheet, previous due, and balance due update dynamically live
    setRows((prev) =>
      prev.map((r) =>
        r.rowId === targetRow.rowId || (targetRow.customerId && r.customerId === targetRow.customerId)
          ? { ...r, customerBalance: formattedAmount }
          : r
      )
    );

    // 2. Also update in customers state for software display
    if (targetRow.customerId) {
      setCustomers((prev) =>
        prev.map((c) => (c.id === targetRow.customerId ? { ...c, current_balance: targetTotalBalance } : c))
      );
    }

    setSuccessBanner(`Previous Due for "${targetRow.customerName || 'shop'}" updated to ${formatCurrency(formattedAmount)}!`);
    setTimeout(() => setSuccessBanner(null), 3000);
    setIsPrevDueModalOpen(false);

    // 3. Persist date-aware previous due to backend database!
    if (targetRow.customerId) {
      try {
        await customerService.setBalance(
          targetRow.customerId,
          formattedAmount,
          orderDate,
          `Previous due on ${orderDate} set to ₹${formattedAmount} from Fast Wholesale Entry`
        );
      } catch (err) {
        console.error('Failed to persist previous due to database:', err);
      }
    }
  };

  // Select customer for a custom row or existing row
  const handleSelectCustomerForRow = (rowId: string, customerId: string) => {
    const cust = customers.find((c) => c.id === customerId);
    if (!cust) return;

    const custRouteId = cust.route || cust.route_details?.id || '';
    const custRouteName = cust.route_details?.name || routes.find((r) => r.id === custRouteId)?.name || '';
    const routeDriver = drivers.find(
      (d) =>
        (d.assigned_route === custRouteId ||
          d.assigned_route_details?.id === custRouteId ||
          (custRouteName && d.assigned_route_details?.name && d.assigned_route_details.name.toLowerCase() === custRouteName.toLowerCase())) &&
        d.is_active
    );

    setRows((prev) =>
      prev.map((r) =>
        r.rowId === rowId
          ? {
              ...r,
              customerId: cust.id,
              customerName: cust.name,
              customerOwner: cust.owner_name || '',
              customerRouteId: custRouteId,
              customerRoute: custRouteName,
              customerBalance: cust.current_balance,
              driverId: routeDriver?.id,
              driverName: routeDriver?.user_details?.first_name
                ? `${routeDriver.user_details.first_name} ${routeDriver.user_details.last_name || ''}`
                : routeDriver?.driver_name,
            }
          : r
      )
    );
    fetchCustomerPricing(cust.id);
  };

  // Save an individual row immediately to database
  const handleSaveSingleRow = async (rowId: string) => {
    const row = rows.find((r) => r.rowId === rowId);
    if (!row) return;
    const fin = getRowFinancials(row);
    if (!row.customerId) {
      setError('Please select a customer shop for this row before saving.');
      return;
    }
    if (!fin.hasOrder && fin.cash <= 0 && fin.gpay <= 0 && !row.orderId) {
      setError(`Please enter quantities or payment for ${row.customerName || 'the shop'} before saving.`);
      return;
    }

    try {
      setRows((prev) =>
        prev.map((r) => (r.rowId === rowId ? { ...r, status: 'SAVING', errorMessage: undefined } : r))
      );

      const cust = customers.find((c) => c.id === row.customerId);
      const routeDriver = drivers.find(
        (d) =>
          (d.assigned_route === cust?.route ||
            d.assigned_route_details?.id === cust?.route ||
            d.assigned_route_details?.name === cust?.route_details?.name) &&
          d.is_active
      );

      const assignedDriverId =
        (row.driverId && row.driverId.trim().length === 36 ? row.driverId.trim() : null) ||
        (routeDriver?.id && routeDriver.id.trim().length === 36 ? routeDriver.id.trim() : null);

      const items: Array<{ product_id: string; quantity: number; unit_price: string }> = [];
      const activeProducts = products.length > 0 ? products : [
        ...(kubbusProduct ? [kubbusProduct] : []),
        ...(romaliProduct ? [romaliProduct] : [])
      ];

      activeProducts.forEach((prod) => {
        let qStr = row.productQuantities?.[prod.id];
        if (qStr === undefined) {
          if (kubbusProduct && prod.id === kubbusProduct.id) qStr = row.kubbusQty;
          else if (romaliProduct && prod.id === romaliProduct.id) qStr = row.romaliQty;
          else qStr = '';
        }
        const qty = parseInt(qStr || '0', 10) || 0;
        if (qty > 0) {
          const price = getProductPriceForCustomer(row.customerId, prod);
          items.push({
            product_id: prod.id,
            quantity: qty,
            unit_price: price.toFixed(2),
          });
        }
      });

      // If an existing order has all quantities cleared or made zero:
      if (row.orderId && items.length === 0) {
        try {
          await orderService.deleteOrder(row.orderId);
        } catch (delErr) {
          console.warn('Failed to delete zeroed order:', delErr);
        }

        if (row.customerId) {
          await paymentService.syncDailyPayment({
            customer_id: row.customerId,
            date: orderDate,
            cash_amount: fin.cash > 0 ? fin.cash.toFixed(2) : '0.00',
            gpay_amount: fin.gpay > 0 ? fin.gpay.toFixed(2) : '0.00',
            order_id: undefined,
          });
        }

        setRows((prev) =>
          prev.map((r) =>
            r.rowId === rowId
              ? {
                  ...r,
                  status: 'SAVED',
                  orderId: undefined,
                  orderNumber: undefined,
                  kubbusQty: '',
                  romaliQty: '',
                  productQuantities: {},
                }
              : r
          )
        );

        if (row.customerId) {
          draftOrderStorage.clearDraft(orderDate, row.customerId);
          try {
            const updatedCust = await customerService.getCustomer(row.customerId);
            setCustomers((prev) => prev.map((c) => (c.id === updatedCust.id ? updatedCust : c)));
          } catch {}
        }

        setSuccessBanner(`Order for ${row.customerName} cleared and removed from database.`);
        setTimeout(() => setSuccessBanner(null), 3500);
        return;
      }

      let order: Order | undefined;

      if (items.length > 0) {
        if (row.orderId) {
          order = await orderService.updateOrder(row.orderId, {
            order_number: row.orderNumber?.trim() || undefined,
            items,
            driver_id: assignedDriverId || undefined,
            shop_expense: fin.discount > 0 ? fin.discount.toFixed(2) : '0.00',
            shop_expense_notes: fin.discount > 0 ? 'Discount / Deduction' : '',
            notes: 'Fast wholesale daily entry (updated)',
          });
        } else {
          order = await orderService.createOrder({
            customer_id: row.customerId,
            driver_id: assignedDriverId || undefined,
            order_date: orderDate,
            order_number: row.orderNumber?.trim() || undefined,
            items,
            shop_expense: fin.discount > 0 ? fin.discount.toFixed(2) : undefined,
            shop_expense_notes: fin.discount > 0 ? 'Discount / Deduction' : undefined,
            notes: 'Fast wholesale daily entry',
          });
        }
      }

      // Synchronize Cash and GPay collections seamlessly (handles new payments, edits like 8000->1000, and clears to 0!)
      let paymentRes: any;
      if (row.customerId) {
        paymentRes = await paymentService.syncDailyPayment({
          customer_id: row.customerId,
          date: orderDate,
          cash_amount: fin.cash > 0 ? fin.cash.toFixed(2) : '0.00',
          gpay_amount: fin.gpay > 0 ? fin.gpay.toFixed(2) : '0.00',
          order_id: order?.id || row.orderId,
        });
      }

      setRows((prev) =>
        prev.map((r) =>
          r.rowId === rowId
            ? {
                ...r,
                status: 'SAVED',
                // Keep customerBalance as Previous Due (do NOT overwrite with closing balance to prevent double-counting)
                customerBalance: r.customerBalance,
                orderId: order?.id || r.orderId,
                orderNumber: order?.order_number || r.orderNumber,
                driverId: order?.driver || assignedDriverId || r.driverId || undefined,
                driverName: order?.driver_name || routeDriver?.driver_name || r.driverName || undefined,
                createdAt: order?.created_at || r.createdAt,
                submittedAt: order?.submitted_at || r.submittedAt,
              }
            : r
        )
      );

      // Clear draft on successful database persistence
      if (row.customerId) {
        draftOrderStorage.clearDraft(orderDate, row.customerId);
        try {
          const updatedCust = await customerService.getCustomer(row.customerId);
          setCustomers((prev) => prev.map((c) => (c.id === updatedCust.id ? updatedCust : c)));
        } catch {
          // ignore background customer refresh failure
        }
      }

      setSuccessBanner(`Saved order for ${row.customerName} successfully!`);
      setTimeout(() => setSuccessBanner(null), 3500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Order creation failed';
      setError(`Failed to save order for ${row.customerName || 'shop'}: ${msg}`);
      setRows((prev) =>
        prev.map((r) =>
          r.rowId === rowId
            ? {
                ...r,
                status: 'ERROR',
                errorMessage: msg,
              }
            : r
        )
      );
    }
  };

  const handlePrintRowOrder = async (row: OrderRow) => {
    try {
      const cust = customers.find((c) => c.id === row.customerId) || null;
      if (row.orderId) {
        const fullOrder = await orderService.getOrder(row.orderId);
        setInvoiceModalOrder({ order: fullOrder, customer: cust || fullOrder.customer_details });
      } else {
        // If order hasn't been submitted yet today, open bill statement with customer's balance & info
        const mockOrder: any = {
          id: 'temp-' + (row.customerId || 'shop'),
          order_number: row.orderNumber || 'BILL-' + (cust?.phone?.slice(-4) || 'DUE'),
          order_date: orderDate,
          customer: row.customerId,
          customer_details: cust,
          items: [],
          total_amount: '0.00',
          paid_amount: '0.00',
          status: 'DELIVERED',
        };
        setInvoiceModalOrder({ order: mockOrder, customer: cust });
      }
    } catch (err) {
      console.error('Failed to load order for printing:', err);
    }
  };

  // Close search dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowSearchDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter and Rank matching customers for instant search dropdown (Best Result First)
  const matchingSearchCustomers = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    const digitsQ = q.replace(/[^0-9]/g, '');

    const scored = customers
      .map((c) => ({
        customer: c,
        score: getCustomerSearchScore(
          c.name,
          c.owner_name,
          c.route_details?.name,
          c.phone,
          q,
          digitsQ
        ),
      }))
      .filter((item) => item.score > 0);

    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.customer.name.localeCompare(b.customer.name);
    });

    return scored.slice(0, 10).map((item) => item.customer);
  }, [searchQuery, customers, getCustomerSearchScore]);

  // Click Customer/Shop from Search Result -> Immediately Open WhatsApp Chat
  const handleSelectCustomerForWhatsApp = (customerId: string) => {
    setSelectedCustomerId(customerId);
    setWhatsAppNavToken(Date.now());
    fetchCustomerPricing(customerId);
    setShowSearchDropdown(false);
    // Note: searchQuery is intentionally preserved so search state is never lost!
  };

  // Auto-Select or Pick Customer from Search Dropdown
  const handleSelectCustomerFromSearch = (cust: { id: string; name?: string }) => {
    const custId = cust.id;
    const custName = cust.name || customers.find((c) => c.id === custId)?.name || '';

    // If customer is not currently in rows, ensure they are added to rows
    const exists = rows.some((r) => r.customerId === custId);
    if (!exists) {
      const fullCust = customers.find((c) => c.id === custId);
      const newRow: OrderRow = {
        rowId: `row_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        customerId: custId,
        customerName: custName,
        customerOwner: fullCust?.owner_name || '',
        customerPhone: fullCust?.phone || '',
        customerRoute: fullCust?.route_details?.name || '',
        customerRouteId: fullCust?.route_details?.id || fullCust?.route,
        customerBalance: fullCust?.current_balance || '0.00',
        kubbusQty: '',
        romaliQty: '',
        productQuantities: {},
        cashAmount: '',
        gpayAmount: '',
        discountAmount: '',
        status: 'IDLE',
        isCustomRow: true,
      };
      setRows((prev) => [newRow, ...prev]);
    }

    // If route filter would hide this customer, reset routeFilter to 'ALL'
    if (routeFilter !== 'ALL') {
      const fullCust = customers.find((c) => c.id === custId);
      const custRouteId = fullCust?.route_details?.id || fullCust?.route;
      if (custRouteId && custRouteId !== routeFilter) {
        setRouteFilter('ALL');
      }
    }

    setShowSearchDropdown(false);
    setSelectedCustomerId(custId);
    const mRow = rows.find((r) => r.customerId === custId);
    if (mRow) setSelectedRowId(mRow.rowId);
    setSearchQuery(custName);

    // Fetch and ensure customer rates are loaded
    fetchCustomerPricing(custId);

    if (isWhatsAppEnabled) {
      handleSelectCustomerForWhatsApp(custId);
    }

    // Direct scroll & focus on the customer's first product quantity cell
    const targetCol = products.length > 0 ? `prod_${products[0].id}` : 'kubbus';
    focusCustomerCell(custId, targetCol);
  };

  // Change Customer via Arrow Buttons (Previous / Next Customer in sheet)
  const handleNavigateCustomer = (direction: 'PREV' | 'NEXT') => {
    if (visibleRows.length === 0) return;

    let currentIndex = visibleRows.findIndex((r) => r.customerId === selectedCustomerId);
    if (currentIndex === -1) currentIndex = 0;

    let targetIndex = direction === 'NEXT' ? currentIndex + 1 : currentIndex - 1;
    if (targetIndex >= visibleRows.length) targetIndex = 0;
    if (targetIndex < 0) targetIndex = visibleRows.length - 1;

    const targetRow = visibleRows[targetIndex];
    if (!targetRow) return;

    if (targetRow.customerId) {
      setSelectedCustomerId(targetRow.customerId);
      fetchCustomerPricing(targetRow.customerId);
      if (isWhatsAppEnabled) {
        handleSelectCustomerForWhatsApp(targetRow.customerId);
      }
      const targetCol = products.length > 0 ? `prod_${products[0].id}` : 'kubbus';
      focusCustomerCell(targetRow.customerId, targetCol);
    } else {
      const targetCol = products.length > 0 ? `prod_${products[0].id}` : 'kubbus';
      focusCell(targetIndex, targetCol);
    }
  };

  // Remove a specific row
  const handleRemoveRow = (rowId: string) => {
    setRows((prev) => prev.filter((r) => r.rowId !== rowId));
  };

  // Restore removed shops
  const handleRestoreAllShops = () => {
    const existingIds = new Set(rows.map((r) => r.customerId).filter(Boolean));
    const missing = customers.filter((c) => !existingIds.has(c.id));
    if (missing.length === 0) return;

    const restoredRows: OrderRow[] = missing.map((cust) => {
      const custRouteId = cust.route || cust.route_details?.id || '';
      const custRouteName = cust.route_details?.name || routes.find((r) => r.id === custRouteId)?.name || '';
      const routeDriver = drivers.find(
        (d) =>
          (d.assigned_route === custRouteId ||
            d.assigned_route_details?.id === custRouteId ||
            (custRouteName && d.assigned_route_details?.name && d.assigned_route_details.name.toLowerCase() === custRouteName.toLowerCase())) &&
          d.is_active
      );

      return {
        rowId: `shop_${cust.id}`,
        customerId: cust.id,
        customerName: cust.name,
        customerOwner: cust.owner_name || '',
        customerRouteId: custRouteId,
        customerRoute: custRouteName,
        customerBalance: cust.current_balance,
        driverId: routeDriver?.id,
        driverName: routeDriver?.user_details?.first_name
          ? `${routeDriver.user_details.first_name} ${routeDriver.user_details.last_name || ''}`
          : routeDriver?.driver_name,
        kubbusQty: '',
        romaliQty: '',
        cashAmount: '',
        gpayAmount: '',
        discountAmount: '',
        status: 'IDLE',
      };
    });

    setRows((prev) => [...prev, ...restoredRows]);
  };

  // KPI Summary Statistics
  const sheetStats = useMemo(() => {
    const productTotals: Record<string, number> = {};
    products.forEach((p) => {
      productTotals[p.id] = 0;
    });

    return rows.reduce(
      (acc, row) => {
        const fin = getRowFinancials(row);
        if (fin.hasOrder || fin.cash > 0 || fin.gpay > 0 || fin.discount > 0) {
          acc.validShopsCount += 1;
        }
        acc.totalKubbus += fin.kQty;
        acc.totalRomali += fin.rQty;
        acc.totalPieces += fin.totalPieces;
        products.forEach((p) => {
          acc.productTotals[p.id] = (acc.productTotals[p.id] || 0) + (fin.itemQuantities[p.id] || 0);
        });
        acc.totalBill += fin.rowTotal;
        acc.totalCash += fin.cash;
        acc.totalGPay += fin.gpay;
        acc.totalDiscount += fin.discount;
        acc.totalDue += fin.rowBalance;
        acc.totalPrevDue += fin.prevDue;
        return acc;
      },
      {
        validShopsCount: 0,
        totalKubbus: 0,
        totalRomali: 0,
        totalPieces: 0,
        productTotals,
        totalBill: 0,
        totalCash: 0,
        totalGPay: 0,
        totalDiscount: 0,
        totalDue: 0,
        totalPrevDue: 0,
      }
    );
  }, [rows, products, pricingCache, defaultKubbusPrice, defaultRomaliPrice, getProductPriceForCustomer]);

  // Downside Route & Filtered Statistics (calculates totals for current route / filtered view)
  const filteredStats = useMemo(() => {
    const productTotals: Record<string, number> = {};
    products.forEach((p) => {
      productTotals[p.id] = 0;
    });

    return visibleRows.reduce(
      (acc, row) => {
        const fin = getRowFinancials(row);
        if (fin.hasOrder || fin.cash > 0 || fin.gpay > 0 || fin.discount > 0) {
          acc.validShopsCount += 1;
        }
        acc.totalKubbus += fin.kQty;
        acc.totalRomali += fin.rQty;
        acc.totalPieces += fin.totalPieces;
        products.forEach((p) => {
          acc.productTotals[p.id] = (acc.productTotals[p.id] || 0) + (fin.itemQuantities[p.id] || 0);
        });
        acc.totalBill += fin.rowTotal;
        acc.totalCash += fin.cash;
        acc.totalGPay += fin.gpay;
        acc.totalDiscount += fin.discount;
        acc.totalDue += fin.rowBalance;
        acc.totalPrevDue += fin.prevDue;
        return acc;
      },
      {
        validShopsCount: 0,
        totalKubbus: 0,
        totalRomali: 0,
        totalPieces: 0,
        productTotals,
        totalBill: 0,
        totalCash: 0,
        totalGPay: 0,
        totalDiscount: 0,
        totalDue: 0,
        totalPrevDue: 0,
      }
    );
  }, [visibleRows, products, pricingCache, defaultKubbusPrice, defaultRomaliPrice, getProductPriceForCustomer]);

  const selectedRouteObj = useMemo(() => {
    if (routeFilter === 'ALL') return null;
    return routes.find((r) => r.id === routeFilter) || null;
  }, [routes, routeFilter]);

  const isFilterActive = routeFilter !== 'ALL' || Boolean(searchQuery.trim()) || sourceFilter !== 'ALL' || showOrdersOnly;
  const shouldShowDownside = routeFilter !== 'ALL' || isFilterActive || showDownsideSummary;
  const activeStats = isFilterActive ? filteredStats : sheetStats;

  // Helper to check if a row has pending changes ready for submission or re-submission
  const isRowPendingSubmit = useCallback((r: OrderRow): boolean => {
    if (r.status !== 'IDLE' && r.status !== 'SAVING') return false;
    const fin = getRowFinancials(r);
    // Has entered quantities or payments
    if (fin.hasOrder || fin.cash > 0 || fin.gpay > 0 || fin.discount > 0) return true;
    // An existing order was modified (even if quantities are 0 / cleared)
    if (Boolean(r.orderId)) return true;
    return false;
  }, [products, pricingCache, defaultKubbusPrice, defaultRomaliPrice, getProductPriceForCustomer]);

  // Count unsubmitted / modified orders ready to submit or re-submit
  const pendingOrdersCount = useMemo(() => {
    return rows.filter(isRowPendingSubmit).length;
  }, [rows, isRowPendingSubmit]);

  // Count existing orders that are being re-submitted
  const resubmitOrdersCount = useMemo(() => {
    return rows.filter((r) => Boolean(r.orderId) && isRowPendingSubmit(r)).length;
  }, [rows, isRowPendingSubmit]);

  // List of all customer bills ready for WhatsApp sending (Bulk Dispatcher)
  const bulkBillItems = useMemo((): BulkBillItem[] => {
    return rows
      .filter((row) => {
        const fin = getRowFinancials(row);
        return (fin.hasOrder || fin.rowTotal > 0 || Boolean(row.orderId)) && Boolean(row.customerId);
      })
      .map((row) => {
        const fin = getRowFinancials(row);
        const cust = customers.find((c) => c.id === row.customerId);

        const itemsParts: string[] = [];
        const lines: any[] = [];
        const activeProducts = products.length > 0 ? products : [
          ...(kubbusProduct ? [kubbusProduct] : []),
          ...(romaliProduct ? [romaliProduct] : []),
        ];

        activeProducts.forEach((prod) => {
          let qStr = row.productQuantities?.[prod.id];
          if (qStr === undefined) {
            if (kubbusProduct && prod.id === kubbusProduct.id) qStr = row.kubbusQty;
            else if (romaliProduct && prod.id === romaliProduct.id) qStr = row.romaliQty;
          }
          const qty = parseInt(qStr || '0', 10) || 0;
          if (qty > 0) {
            const price = getProductPriceForCustomer(row.customerId, prod);
            lines.push({
              id: prod.id,
              name: prod.name,
              quantity: qty,
              unitPrice: price,
              subtotal: qty * price,
              packetSize: prod.packet_size,
            });
            itemsParts.push(`${prod.name} x ${qty}`);
          }
        });

        if (lines.length === 0) {
          if (fin.kQty > 0) {
            lines.push({
              id: kubbusProduct?.id || 'kubbus',
              name: kubbusProduct?.name || 'Kubbus Normal',
              quantity: fin.kQty,
              unitPrice: fin.kPrice,
              subtotal: fin.kQty * fin.kPrice,
              packetSize: kubbusProduct?.packet_size,
            });
            itemsParts.push(`Kubbus x ${fin.kQty}`);
          }
          if (fin.rQty > 0) {
            lines.push({
              id: romaliProduct?.id || 'romali',
              name: romaliProduct?.name || 'Romali Roti',
              quantity: fin.rQty,
              unitPrice: fin.rPrice,
              subtotal: fin.rQty * fin.rPrice,
              packetSize: romaliProduct?.packet_size,
            });
            itemsParts.push(`Romali x ${fin.rQty}`);
          }
        }

        return {
          rowId: row.rowId,
          orderId: row.orderId,
          orderNumber: row.orderNumber,
          customerId: row.customerId,
          customerName: row.customerName || cust?.name || 'Customer Shop',
          customerPhone: row.customerPhone || cust?.phone || '',
          ownerName: row.customerOwner || cust?.owner_name || '',
          customerAddress: cust?.address || '',
          customerRoute: row.customerRoute || cust?.route_details?.name || '',
          driverName: row.driverName || '',
          itemsSummary: itemsParts.length > 0 ? itemsParts.join(', ') : 'Daily Wholesale Dispatch',
          lines,
          totalAmount: fin.rowTotal,
          prevDue: fin.prevDue,
          orderDate: orderDate,
          status: 'PENDING',
        };
      });
  }, [rows, customers, products, kubbusProduct, romaliProduct, orderDate, getRowFinancials, getProductPriceForCustomer]);

  // List of customers who have NO order entered yet for today (0 quantities, 0 bill, no saved orderId)
  const pendingCustomers = useMemo((): PendingCustomerReminderItem[] => {
    return rows
      .filter((row) => {
        if (!row.customerId) return false;
        const fin = getRowFinancials(row);
        const hasOrder = fin.hasOrder || fin.rowTotal > 0 || Boolean(row.orderId);
        return !hasOrder;
      })
      .map((row) => {
        const cust = customers.find((c) => c.id === row.customerId);
        return {
          rowId: row.rowId,
          customerId: row.customerId,
          customerName: row.customerName || cust?.name || 'Customer Shop',
          customerOwner: row.customerOwner || cust?.owner_name || '',
          customerPhone: row.customerPhone || cust?.phone || '',
          customerRoute: row.customerRoute || cust?.route_details?.name || '',
          customerAddress: cust?.address || '',
          status: 'PENDING' as const,
        };
      });
  }, [rows, customers, getRowFinancials]);

  // Count removed shops that could be restored
  const removedCount = useMemo(() => {
    const existingIds = new Set(rows.map((r) => r.customerId).filter(Boolean));
    return customers.filter((c) => !existingIds.has(c.id)).length;
  }, [rows, customers]);

  // Dynamic Product Column Sequence for Fast Order Entry
  const getProductCols = useCallback((): string[] => {
    return products.length > 0 ? products.map((p) => `prod_${p.id}`) : ['kubbus', 'romali'];
  }, [products]);

  // Dynamic Entry Product Columns (skips products marked skip_in_entry, e.g. Bun)
  const getEntryProductCols = useCallback((): string[] => {
    if (products.length > 0) {
      const activeEntryProds = products.filter((p) => {
        if (p.skip_in_entry !== undefined) return !p.skip_in_entry;
        const nameLower = (p.name || '').toLowerCase();
        const codeLower = (p.code || '').toLowerCase();
        return !nameLower.includes('bun') && !codeLower.includes('bun');
      });
      return activeEntryProds.length > 0
        ? activeEntryProds.map((p) => `prod_${p.id}`)
        : products.map((p) => `prod_${p.id}`);
    }
    return ['kubbus', 'romali'];
  }, [products]);

  // Dynamic Column Sequence for Keyboard Navigation
  const getColSequence = useCallback((): string[] => {
    const pCols = getProductCols();
    return isOrderDiscountEnabled
      ? [...pCols, 'cash', 'gpay', 'discount']
      : [...pCols, 'cash', 'gpay'];
  }, [getProductCols, isOrderDiscountEnabled]);

  /**
   * Full Keyboard Order Entry Navigation:
   * Enter key flow:
   *   - Kubbus -> Romali Roti -> (skips Bun/other skipped products) -> Cash -> GPay -> Next Shop's Kubbus!
   *   - At the bottom of the list or filtered view: jumps to Search Bar for next customer
   * Tab key:
   *   - Full sequential traversal through all columns (including Bun)
   * Shift + Tab:
   *   - Moves backwards between columns / shops
   * Arrow Up / Down:
   *   - Jumps vertically between shops on the same column
   *   - ArrowUp at row 0 jumps directly to Customer Search Bar
   * Escape / F2:
   *   - Immediately returns focus to Customer Search Bar
   */
  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    visibleIndex: number,
    col: string
  ) => {
    const prodCols = getProductCols();
    const isProdCol = prodCols.includes(col);
    const colSeq = getColSequence();
    const colIdx = colSeq.indexOf(col);

    // Escape or F2: Return focus directly to the Customer Search bar with text selected
    if (e.key === 'Escape' || e.key === 'F2') {
      e.preventDefault();
      if (searchInputRef.current) {
        searchInputRef.current.focus();
        searchInputRef.current.select();
      }
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      const entryProds = getEntryProductCols();
      const firstEntryCol = entryProds.length > 0 ? entryProds[0] : (prodCols[0] || 'kubbus');

      // 1. If user is on a product column:
      if (isProdCol) {
        const entryIdx = entryProds.indexOf(col);
        if (entryIdx >= 0 && entryIdx < entryProds.length - 1) {
          // Move to next entry product within the same shop: Kubbus -> Romali
          focusCell(visibleIndex, entryProds[entryIdx + 1]);
        } else {
          // On last active product (or skipped product like Bun): Jump directly to Cash!
          focusCell(visibleIndex, 'cash');
        }
        return;
      }

      // 2. If user is on cash: move to GPay
      if (col === 'cash') {
        focusCell(visibleIndex, 'gpay');
        return;
      }

      // 3. If user is on gpay: move to discount (if enabled) OR jump to NEXT SHOP's first product!
      if (col === 'gpay') {
        if (isOrderDiscountEnabled) {
          focusCell(visibleIndex, 'discount');
        } else if (visibleIndex < visibleRows.length - 1) {
          focusCell(visibleIndex + 1, firstEntryCol);
        } else if (searchInputRef.current) {
          searchInputRef.current.focus();
          searchInputRef.current.select();
        }
        return;
      }

      // 4. If user is on discount: jump to NEXT SHOP's first product!
      if (col === 'discount') {
        if (visibleIndex < visibleRows.length - 1) {
          focusCell(visibleIndex + 1, firstEntryCol);
        } else if (searchInputRef.current) {
          searchInputRef.current.focus();
          searchInputRef.current.select();
        }
        return;
      }
      return;
    }

    if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault();
      if (colIdx >= 0 && colIdx < colSeq.length - 1) {
        // Move to next column of the same shop: Kubbus -> Romali -> Cash -> GPay -> Disc
        focusCell(visibleIndex, colSeq[colIdx + 1]);
      } else if (colIdx === colSeq.length - 1) {
        // From end of current shop -> jump to NEXT SHOP's first product (Kubbus)!
        if (visibleIndex < visibleRows.length - 1) {
          focusCell(visibleIndex + 1, colSeq[0]);
        } else {
          // Reached bottom of list or single filtered shop -> jump back to Search bar for next customer
          if (searchInputRef.current) {
            searchInputRef.current.focus();
            searchInputRef.current.select();
          }
        }
      }
      return;
    }

    if (e.key === 'Tab' && e.shiftKey) {
      e.preventDefault();
      if (colIdx > 0) {
        // Move to previous column of the same shop: GPay -> Cash -> Romali -> Kubbus!
        focusCell(visibleIndex, colSeq[colIdx - 1]);
      } else if (colIdx === 0) {
        if (visibleIndex > 0) {
          // Previous shop's last column (GPay)
          focusCell(visibleIndex - 1, colSeq[colSeq.length - 1]);
        } else {
          // First cell of first row -> focus search bar
          if (searchInputRef.current) {
            searchInputRef.current.focus();
            searchInputRef.current.select();
          }
        }
      }
      return;
    }

    // ArrowDown: Move down to same column in row below
    if (e.key === 'ArrowDown') {
      if (visibleIndex < visibleRows.length - 1) {
        e.preventDefault();
        focusCell(visibleIndex + 1, col);
      }
      return;
    }

    // ArrowUp: Move up to same column in row above; if at row 0, jump to Search Bar
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (visibleIndex > 0) {
        focusCell(visibleIndex - 1, col);
      } else {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
          searchInputRef.current.select();
        }
      }
      return;
    }

    // ArrowRight: Move to next column horizontally
    if (e.key === 'ArrowRight') {
      if (colIdx >= 0 && colIdx < colSeq.length - 1) {
        e.preventDefault();
        focusCell(visibleIndex, colSeq[colIdx + 1]);
      } else if (colIdx === colSeq.length - 1 && visibleIndex < visibleRows.length - 1) {
        e.preventDefault();
        focusCell(visibleIndex + 1, colSeq[0]);
      }
      return;
    }

    // ArrowLeft: Move to previous column horizontally
    if (e.key === 'ArrowLeft') {
      if (colIdx > 0) {
        e.preventDefault();
        focusCell(visibleIndex, colSeq[colIdx - 1]);
      } else if (colIdx === 0 && visibleIndex > 0) {
        e.preventDefault();
        focusCell(visibleIndex - 1, colSeq[colSeq.length - 1]);
      }
      return;
    }
  };

  // Move row up or down in Custom Order
  const handleMoveCustomRow = (rowId: string, direction: 'UP' | 'DOWN') => {
    const currentOrder = customSortOrder.length > 0
      ? [...customSortOrder]
      : visibleRows.map((r) => r.rowId);

    visibleRows.forEach((r) => {
      if (!currentOrder.includes(r.rowId)) {
        currentOrder.push(r.rowId);
      }
    });

    const currentIndex = currentOrder.indexOf(rowId);
    if (currentIndex === -1) return;

    const targetIndex = direction === 'UP' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= currentOrder.length) return;

    const updated = [...currentOrder];
    const temp = updated[currentIndex];
    updated[currentIndex] = updated[targetIndex];
    updated[targetIndex] = temp;

    setCustomSortOrder(updated);
    localStorage.setItem('zamzam_fast_custom_sort_order', JSON.stringify(updated));
    setHasUnsavedCustomOrder(true);
  };

  // Set & Save Custom Order permanently and lock/hide edit options
  const handleSaveCustomOrder = () => {
    const currentOrder = visibleRows.map((r) => r.rowId);
    setCustomSortOrder(currentOrder);
    localStorage.setItem('zamzam_fast_custom_sort_order', JSON.stringify(currentOrder));
    setHasUnsavedCustomOrder(false);
    setSaveCustomOrderSuccess(true);
    setIsCustomEditing(false); // Hides edit options and remove buttons on save
    setSuccessBanner(`Custom shop order saved and locked successfully (${currentOrder.length} shops)! Edit options hidden.`);
    setTimeout(() => {
      setSaveCustomOrderSuccess(false);
    }, 2500);
  };

  // Reset Custom Order back to Shop Registered (Oldest)
  const handleResetToOldest = () => {
    const resetOrder = [...visibleRows].sort((a, b) => {
      const tA = new Date(a.customerCreatedAt || 0).getTime();
      const tB = new Date(b.customerCreatedAt || 0).getTime();
      if (tA !== 0 && tB !== 0 && tA !== tB) return tA - tB;
      if (tA !== 0 && tB === 0) return -1;
      if (tA === 0 && tB !== 0) return 1;
      return a.customerName.localeCompare(b.customerName);
    }).map((r) => r.rowId);
    setCustomSortOrder(resetOrder);
    localStorage.setItem('zamzam_fast_custom_sort_order', JSON.stringify(resetOrder));
    setHasUnsavedCustomOrder(false);
    setSuccessBanner('Reset custom order back to Shop Registered (Oldest).');
  };

  // Add 1 Custom Row
  const handleAddCustomRow = () => {
    const newRow: OrderRow = {
      rowId: `custom_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      customerId: '',
      customerName: '',
      customerRoute: 'Walk-in / Custom',
      kubbusQty: '',
      romaliQty: '',
      cashAmount: '',
      gpayAmount: '',
      discountAmount: '',
      status: 'IDLE',
      isCustomRow: true,
    };
    setRows((prev) => [newRow, ...prev]);
    setTimeout(() => {
      const firstCol = products.length > 0 ? `prod_${products[0].id}` : 'kubbus';
      focusCell(0, firstCol);
    }, 40);
  };

  // Reset inputs
  const handleResetInputs = () => {
    if (window.confirm('Clear all entered quantities and payments back to blank?')) {
      setRows((prev) =>
        prev.map((r) => ({
          ...r,
          kubbusQty: '',
          romaliQty: '',
          productQuantities: {},
          cashAmount: '',
          gpayAmount: '',
          discountAmount: '',
          status: 'IDLE',
          errorMessage: undefined,
        }))
      );
      setSuccessBanner('All quantities cleared. Click Submit / Re-submit Orders to save changes to the database.');
      setError(null);
    }
  };

  // Auto-Fill from Previous Orders (Smart 1-Click Historic Auto Data Entry)
  const handleAutoFillPreviousOrders = async () => {
    try {
      setIsAutoLoading(true);
      setError(null);
      const allOrders = await orderService.getOrders({ all: 'true' });
      const latestOrderMap: Record<
        string,
        { productQuantities: Record<string, string>; kubbusQty: number; romaliQty: number }
      > = {};
      
      const sorted = [...allOrders].sort((a, b) => new Date(b.order_date).getTime() - new Date(a.order_date).getTime());
      
      for (const ord of sorted) {
        if (!ord.customer || latestOrderMap[ord.customer]) continue;
        const prodQtys: Record<string, string> = {};
        let kQty = 0;
        let rQty = 0;
        for (const it of ord.items || []) {
          if (it.quantity > 0) {
            prodQtys[it.product] = String(it.quantity);
            const pName = (it.product_details?.name || '').toLowerCase();
            if (pName.includes('kubbus') || it.product === kubbusProduct?.id) {
              kQty += it.quantity;
            } else if (pName.includes('romali') || it.product === romaliProduct?.id) {
              rQty += it.quantity;
            }
          }
        }
        if (Object.keys(prodQtys).length > 0 || kQty > 0 || rQty > 0) {
          latestOrderMap[ord.customer] = { productQuantities: prodQtys, kubbusQty: kQty, romaliQty: rQty };
        }
      }

      let filledCount = 0;
      setRows((prev) =>
        prev.map((r) => {
          const match = r.customerId ? latestOrderMap[r.customerId] : null;
          if (match && r.customerId) {
            filledCount++;
            const nextKubbus = match.kubbusQty > 0 ? String(match.kubbusQty) : r.kubbusQty;
            const nextRomali = match.romaliQty > 0 ? String(match.romaliQty) : r.romaliQty;
            const nextProdQtys = { ...(r.productQuantities || {}), ...match.productQuantities };

            draftOrderStorage.saveDraft({
              customerId: r.customerId,
              orderDate,
              kubbusQty: nextKubbus,
              romaliQty: nextRomali,
              productQuantities: nextProdQtys,
              cashAmount: r.cashAmount,
              gpayAmount: r.gpayAmount,
              discountAmount: r.discountAmount,
              updatedAt: Date.now(),
            });

            return {
              ...r,
              kubbusQty: nextKubbus,
              romaliQty: nextRomali,
              productQuantities: nextProdQtys,
              status: 'IDLE',
            };
          }
          return r;
        })
      );

      setIsAutoEntryModalOpen(false);
      setSuccessBanner(`Auto-filled ${filledCount} shops with their previous order quantities!`);
      setTimeout(() => setSuccessBanner(null), 4000);
    } catch (err: unknown) {
      setError('Failed to fetch previous orders for auto data entry.');
    } finally {
      setIsAutoLoading(false);
    }
  };

  // Quick Bulk Fill Custom Fixed Quantities
  const handleQuickBulkApply = () => {
    const visibleRowIds = new Set(visibleRows.map((r) => r.rowId));

    let updatedCount = 0;
    setRows((prev) =>
      prev.map((r) => {
        const hasExistingOrder =
          Boolean(r.kubbusQty || r.romaliQty) ||
          Object.values(r.productQuantities || {}).some((q) => Boolean(q && q !== '0'));

        const isTarget =
          autoTargetMode === 'all'
            ? true
            : autoTargetMode === 'visible'
            ? visibleRowIds.has(r.rowId)
            : !hasExistingOrder;

        if (isTarget && r.customerId) {
          updatedCount++;
          const nextProdQtys = { ...(r.productQuantities || {}) };
          products.forEach((p) => {
            const v = (autoProductQtys[p.id] || '').trim();
            if (v !== '') nextProdQtys[p.id] = v;
          });
          const kVal = kubbusProduct && autoProductQtys[kubbusProduct.id] !== undefined
            ? autoProductQtys[kubbusProduct.id]
            : autoKubbusQty.trim();
          const rVal = romaliProduct && autoProductQtys[romaliProduct.id] !== undefined
            ? autoProductQtys[romaliProduct.id]
            : autoRomaliQty.trim();

          const finalKubbus = kVal !== '' ? kVal : r.kubbusQty;
          const finalRomali = rVal !== '' ? rVal : r.romaliQty;

          draftOrderStorage.saveDraft({
            customerId: r.customerId,
            orderDate,
            kubbusQty: finalKubbus,
            romaliQty: finalRomali,
            productQuantities: nextProdQtys,
            cashAmount: r.cashAmount,
            gpayAmount: r.gpayAmount,
            discountAmount: r.discountAmount,
            updatedAt: Date.now(),
          });

          return {
            ...r,
            productQuantities: nextProdQtys,
            kubbusQty: finalKubbus,
            romaliQty: finalRomali,
            status: 'IDLE',
          };
        }
        return r;
      })
    );

    setIsAutoEntryModalOpen(false);
    setSuccessBanner(`Auto-filled quantities across ${updatedCount} shops!`);
    setTimeout(() => setSuccessBanner(null), 3500);
  };

  // Sandbox Demo Simulation Auto Data Entry
  const handleAutoFillSandboxRandom = () => {
    const kPresets = [10, 15, 20, 25, 30, 40, 50];
    const rPresets = [5, 10, 15, 20, 25];

    let filledCount = 0;
    setRows((prev) =>
      prev.map((r) => {
        if (!r.customerId) return r;
        filledCount++;
        const randK = kPresets[Math.floor(Math.random() * kPresets.length)];
        const randR = rPresets[Math.floor(Math.random() * rPresets.length)];

        draftOrderStorage.saveDraft({
          customerId: r.customerId,
          orderDate,
          kubbusQty: String(randK),
          romaliQty: String(randR),
          productQuantities: r.productQuantities,
          cashAmount: r.cashAmount,
          gpayAmount: r.gpayAmount,
          discountAmount: r.discountAmount,
          updatedAt: Date.now(),
        });

        return {
          ...r,
          kubbusQty: String(randK),
          romaliQty: String(randR),
          status: 'IDLE',
        };
      })
    );

    setIsAutoEntryModalOpen(false);
    setSuccessBanner(`Sandbox Auto-Entry: Simulated wholesale quantities for ${filledCount} shops!`);
    setTimeout(() => setSuccessBanner(null), 3500);
  };

  // Submit All Orders (Creates new orders or updates existing ones, with auto-confirm to driver!)
  const handleSubmitAllOrders = async () => {
    const ordersToSubmit = rows
      .map((r) => ({ row: r, fin: getRowFinancials(r) }))
      .filter((item) => (item.fin.hasOrder || item.fin.cash > 0 || item.fin.gpay > 0 || item.fin.discount > 0 || Boolean(item.row.orderId)) && (item.row.status === 'IDLE' || item.row.status === 'SAVING'));

    if (ordersToSubmit.length === 0) {
      setError('No new or modified orders to submit. Type or adjust quantities first.');
      return;
    }

    setIsSubmittingAll(true);
    setError(null);
    setSuccessBanner(null);
    setSubmitProgress({ current: 0, total: ordersToSubmit.length });

    let successCount = 0;

    for (let i = 0; i < ordersToSubmit.length; i++) {
      const { row, fin } = ordersToSubmit[i];
      setSubmitProgress({ current: i + 1, total: ordersToSubmit.length });

      setRows((prev) =>
        prev.map((r) => (r.rowId === row.rowId ? { ...r, status: 'SAVING', errorMessage: undefined } : r))
      );

      try {
        if (!row.customerId) {
          setRows((prev) =>
            prev.map((r) =>
              r.rowId === row.rowId
                ? { ...r, status: 'ERROR', errorMessage: 'Please select a customer shop for this row.' }
                : r
            )
          );
          continue;
        }

        const cust = customers.find((c) => c.id === row.customerId);
        const routeDriver = drivers.find(
          (d) =>
            (d.assigned_route === cust?.route ||
              d.assigned_route_details?.id === cust?.route ||
              d.assigned_route_details?.name === cust?.route_details?.name) &&
            d.is_active
        );

        const assignedDriverId = autoConfirmDriver
          ? (row.driverId && row.driverId.trim().length === 36 ? row.driverId.trim() : null) ||
            (routeDriver?.id && routeDriver.id.trim().length === 36 ? routeDriver.id.trim() : null)
          : null;

        const items: Array<{ product_id: string; quantity: number; unit_price: string }> = [];
        const activeProducts = products.length > 0 ? products : [
          ...(kubbusProduct ? [kubbusProduct] : []),
          ...(romaliProduct ? [romaliProduct] : [])
        ];

        activeProducts.forEach((prod) => {
          let qStr = row.productQuantities?.[prod.id];
          if (qStr === undefined) {
            if (kubbusProduct && prod.id === kubbusProduct.id) qStr = row.kubbusQty;
            else if (romaliProduct && prod.id === romaliProduct.id) qStr = row.romaliQty;
            else qStr = '';
          }
          const qty = parseInt(qStr || '0', 10) || 0;
          if (qty > 0) {
            const price = getProductPriceForCustomer(row.customerId, prod);
            items.push({
              product_id: prod.id,
              quantity: qty,
              unit_price: price.toFixed(2),
            });
          }
        });

        // If an existing order has all quantities cleared or made zero:
        if (row.orderId && items.length === 0) {
          try {
            await orderService.deleteOrder(row.orderId);
          } catch (delErr) {
            console.warn('Could not delete zeroed order:', delErr);
          }

          if (row.customerId) {
            await paymentService.syncDailyPayment({
              customer_id: row.customerId,
              date: orderDate,
              cash_amount: fin.cash > 0 ? fin.cash.toFixed(2) : '0.00',
              gpay_amount: fin.gpay > 0 ? fin.gpay.toFixed(2) : '0.00',
              order_id: undefined,
            });
          }

          setRows((prev) =>
            prev.map((r) =>
              r.rowId === row.rowId
                ? {
                    ...r,
                    status: 'SAVED',
                    orderId: undefined,
                    orderNumber: undefined,
                    kubbusQty: '',
                    romaliQty: '',
                    productQuantities: {},
                  }
                : r
            )
          );

          if (row.customerId) {
            draftOrderStorage.clearDraft(orderDate, row.customerId);
            try {
              const updatedCust = await customerService.getCustomer(row.customerId);
              setCustomers((prev) => prev.map((c) => (c.id === updatedCust.id ? updatedCust : c)));
            } catch {}
          }

          successCount++;
          continue;
        }

        let order: Order | undefined;

        // Create or update order in database if line items exist
        if (items.length > 0) {
          if (row.orderId) {
            order = await orderService.updateOrder(row.orderId, {
              order_number: row.orderNumber?.trim() || undefined,
              items,
              driver_id: assignedDriverId || undefined,
              shop_expense: fin.discount > 0 ? fin.discount.toFixed(2) : '0.00',
              shop_expense_notes: fin.discount > 0 ? 'Discount / Deduction' : '',
              notes: 'Fast wholesale daily entry (updated)',
            });
          } else {
            order = await orderService.createOrder({
              customer_id: row.customerId,
              driver_id: assignedDriverId || undefined,
              order_date: orderDate,
              order_number: row.orderNumber?.trim() || undefined,
              items,
              shop_expense: fin.discount > 0 ? fin.discount.toFixed(2) : undefined,
              shop_expense_notes: fin.discount > 0 ? 'Discount / Deduction' : undefined,
              notes: 'Fast wholesale daily entry',
            });
          }
        }

        // Synchronize Cash and GPay collections seamlessly (handles new payments, edits like 8000->1000, and clears to 0!)
        let paymentRes: any;
        if (row.customerId) {
          paymentRes = await paymentService.syncDailyPayment({
            customer_id: row.customerId,
            date: orderDate,
            cash_amount: fin.cash > 0 ? fin.cash.toFixed(2) : '0.00',
            gpay_amount: fin.gpay > 0 ? fin.gpay.toFixed(2) : '0.00',
            order_id: order?.id || row.orderId,
          });
        }

        setRows((prev) =>
          prev.map((r) =>
            r.rowId === row.rowId
              ? {
                  ...r,
                  status: 'SAVED',
                  // Keep customerBalance as Previous Due (do NOT overwrite with closing balance to prevent double-counting)
                  customerBalance: r.customerBalance,
                  orderId: order?.id || r.orderId,
                  orderNumber: order?.order_number || r.orderNumber,
                  driverId: order?.driver || assignedDriverId || r.driverId || undefined,
                  driverName: order?.driver_name || routeDriver?.driver_name || r.driverName || undefined,
                  createdAt: order?.created_at || r.createdAt,
                  submittedAt: order?.submitted_at || r.submittedAt,
                }
              : r
          )
        );

        // Clear draft on successful order submission
        if (row.customerId) {
          draftOrderStorage.clearDraft(orderDate, row.customerId);
        }

        successCount++;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Order creation failed';
        if (!error) {
          setError(`Failed to save ${row.customerName || 'order'}: ${msg}`);
        }
        setRows((prev) =>
          prev.map((r) =>
            r.rowId === row.rowId
              ? {
                  ...r,
                  status: 'ERROR',
                  errorMessage: msg,
                }
              : r
          )
        );
      }
    }

    setIsSubmittingAll(false);
    setSubmitProgress(null);

    // Re-sync rows from the database source of truth with freshly calculated balances
    try {
      const refreshedCusts = await customerService.getCustomers(undefined, undefined, true);
      setCustomers(refreshedCusts);
      await loadOrdersForDate(orderDate, refreshedCusts, drivers);
    } catch {
      if (customers.length > 0) {
        await loadOrdersForDate(orderDate, customers, drivers);
      }
    }

    if (successCount > 0) {
      setSuccessBanner(
        `Successfully saved ${successCount} order(s) for ${orderDate}! ${
          autoConfirmDriver ? 'Confirmed & dispatched to route delivery drivers.' : ''
        }`
      );
      // Automatically open Bulk WhatsApp modal so user can dispatch PDF or Image bills to all customers
      setIsBulkWhatsAppModalOpen(true);
    }
  };

  // Quick Route Creation Handler
  const handleQuickCreateRoute = async () => {
    if (!quickRouteName.trim()) return;
    try {
      setIsCreatingRoute(true);
      const code = quickRouteName.trim().substring(0, 3).toUpperCase();
      const newRoute = await routeService.createRoute({
        name: quickRouteName.trim(),
        code,
        description: `Route for ${quickRouteName.trim()}`,
      });
      setRoutes((prev) => [...prev, newRoute]);
      setNewCustRoute(newRoute.id);
      setQuickRouteName('');
    } catch (err: unknown) {
      setNewCustError(err instanceof Error ? err.message : 'Failed to create route');
    } finally {
      setIsCreatingRoute(false);
    }
  };

  // Direct Customer Creation Handler with Dynamic Product Rates & Initial Order
  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustName || !newCustPhone || !newCustAddress || !newCustRoute) {
      setNewCustError('Please fill in shop name, phone, address, and select a route.');
      return;
    }

    try {
      setNewCustSubmitting(true);
      setNewCustError(null);

      const product_prices: Array<{ product_id: string; price: string }> = [];
      const initialProductQuantities: Record<string, string> = {};

      products.forEach((prod) => {
        const customPrice = newCustProductPrices[prod.id] || prod.unit_price;
        if (customPrice && String(customPrice).trim()) {
          product_prices.push({ product_id: prod.id, price: String(customPrice).trim() });
        }
        const initialQty = newCustProductQuantities[prod.id];
        if (initialQty && String(initialQty).trim()) {
          initialProductQuantities[prod.id] = String(initialQty).trim();
        }
      });

      const parsedListOrder = newCustListOrder.trim() ? parseInt(newCustListOrder.trim(), 10) : undefined;
      const parsedOpeningDue = parseFloat(newCustOpeningBalance.trim() || '0');
      const openingBalanceStr = !isNaN(parsedOpeningDue) && parsedOpeningDue > 0 ? parsedOpeningDue.toFixed(2) : undefined;

      const created = await customerService.createCustomer({
        name: newCustName.trim(),
        owner_name: newCustOwner.trim() || undefined,
        phone: newCustPhone.trim(),
        address: newCustAddress.trim(),
        route: newCustRoute,
        notes: parsedListOrder ? `[Stop #${parsedListOrder}]` : undefined,
        product_prices: product_prices.length > 0 ? product_prices : undefined,
        opening_balance: openingBalanceStr,
      });

      let initialBalance = created.current_balance || '0.00';
      if (openingBalanceStr) {
        initialBalance = openingBalanceStr;
        created.current_balance = initialBalance;
        // Ensure balance is committed to DB if not set during creation
        try {
          await customerService.setBalance(created.id, openingBalanceStr, 'Initial shop opening balance');
        } catch {
          // ignore if already set
        }
      }

      setCustomers((prev) => [created, ...prev]);

      // Cache custom wholesale prices for all products
      const priceMap: Record<string, number> & { kubbusPrice?: number; romaliPrice?: number } = {};
      const customPricesDict: Record<string, string> = {};
      products.forEach((prod) => {
        const pr = parseFloat(newCustProductPrices[prod.id] || prod.unit_price || '0');
        priceMap[prod.id] = pr;
        customPricesDict[prod.id] = pr.toFixed(2);
        if (kubbusProduct && prod.id === kubbusProduct.id) priceMap.kubbusPrice = pr;
        if (romaliProduct && prod.id === romaliProduct.id) priceMap.romaliPrice = pr;
      });
      created.custom_prices = customPricesDict;
      setPricingCache((prev) => ({ ...prev, [created.id]: priceMap }));

      const createdRouteId = created.route || created.route_details?.id || '';
      const createdRouteName = created.route_details?.name || routes.find((r) => r.id === createdRouteId)?.name || '';

      const routeDriver = drivers.find(
        (d) =>
          (d.assigned_route === createdRouteId ||
            d.assigned_route_details?.id === createdRouteId ||
            (createdRouteName && d.assigned_route_details?.name && d.assigned_route_details.name.toLowerCase() === createdRouteName.toLowerCase())) &&
          d.is_active
      );

      const driverDisplay =
        routeDriver?.user_details?.first_name
          ? `${routeDriver.user_details.first_name} ${routeDriver.user_details.last_name || ''}`
          : routeDriver?.driver_name;

      const kQty = kubbusProduct ? (initialProductQuantities[kubbusProduct.id] || '') : '';
      const rQty = romaliProduct ? (initialProductQuantities[romaliProduct.id] || '') : '';

      const newShopRow: OrderRow = {
        rowId: `shop_${created.id}`,
        customerId: created.id,
        customerName: created.name,
        customerOwner: created.owner_name || '',
        customerRouteId: createdRouteId,
        customerRoute: createdRouteName,
        customerBalance: initialBalance,
        driverId: routeDriver?.id,
        driverName: driverDisplay,
        kubbusQty: kQty,
        romaliQty: rQty,
        productQuantities: initialProductQuantities,
        cashAmount: '',
        gpayAmount: '',
        discountAmount: '',
        status: 'IDLE',
        orderNumber: newCustOrderNumber.trim() || undefined,
        listOrder: parsedListOrder,
        customerCreatedAt: created.created_at || new Date().toISOString(),
      };

      setRows((prev) => {
        if (parsedListOrder !== undefined && parsedListOrder > 0) {
          const insertIndex = Math.min(parsedListOrder - 1, prev.length);
          const copy = [...prev];
          copy.splice(insertIndex, 0, newShopRow);
          return copy;
        }
        return [newShopRow, ...prev];
      });

      // Save draft immediately if initial quantities were specified
      if (Object.values(initialProductQuantities).some((q) => parseInt(q, 10) > 0)) {
        draftOrderStorage.saveDraft({
          customerId: created.id,
          orderDate,
          kubbusQty: kQty,
          romaliQty: rQty,
          productQuantities: initialProductQuantities,
          cashAmount: '',
          gpayAmount: '',
          discountAmount: '',
          updatedAt: Date.now(),
        });
      }

      setIsNewCustModalOpen(false);
      setNewCustName('');
      setNewCustOwner('');
      setNewCustPhone('');
      setNewCustAddress('');
      setNewCustRoute('');
      setNewCustListOrder('');
      setNewCustOrderNumber('');
      setNewCustOpeningBalance('');
      setNewCustProductPrices({});
      setNewCustProductQuantities({});

      setSuccessBanner(`Shop "${created.name}" created with custom product prices and added to order sheet!`);
      setTimeout(() => setSuccessBanner(null), 4000);

      const targetCol = products.length > 0 ? `prod_${products[0].id}` : 'kubbus';
      setTimeout(() => {
        focusCell(0, targetCol);
      }, 50);
    } catch (err: unknown) {
      setNewCustError(err instanceof Error ? err.message : 'Failed to create customer');
    } finally {
      setNewCustSubmitting(false);
    }
  };

  return (
    <div
      className="billing-page-container"
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minHeight: 0,
        height: '100%',
      }}
    >
      {/* 1. Page Header (Ultra-compact single-line) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '0.15rem',
          flexShrink: 0,
          gap: '0.35rem',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <h2 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, lineHeight: 1.15 }}>
            Fast Wholesale Order Entry
          </h2>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', whiteSpace: 'nowrap' }}>
            {products.length > 0 ? products.map((p) => p.name).join(' → ') : 'Products'} → Next Shop
          </span>
          {ordersLoading && (
            <span style={{ fontSize: '0.68rem', color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
              <div className="spinner" style={{ width: 10, height: 10 }} />
              Loading...
            </span>
          )}
        </div>

        <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Driver Confirmation Toggle */}
          {isDriverModuleEnabled && (
            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
                cursor: 'pointer',
                fontSize: '0.76rem',
                fontWeight: 700,
                color: autoConfirmDriver ? '#dc2626' : 'var(--text-secondary)',
                background: autoConfirmDriver ? '#fee2e2' : 'var(--bg-card)',
                border: autoConfirmDriver ? '1.5px solid #dc2626' : '1px solid var(--border)',
                padding: '0 0.5rem',
                borderRadius: '6px',
                height: '28px',
                userSelect: 'none',
                transition: 'all 0.15s ease',
              }}
              title="Automatically assign and confirm orders to route drivers on submit"
            >
              <input
                type="checkbox"
                checked={autoConfirmDriver}
                onChange={(e) => setAutoConfirmDriver(e.target.checked)}
                style={{ accentColor: '#dc2626', width: '13px', height: '13px', cursor: 'pointer' }}
              />
              <Truck size={13} color={autoConfirmDriver ? '#dc2626' : 'var(--text-muted)'} />
              <span>Confirm to Driver</span>
            </label>
          )}

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setIsAutoEntryModalOpen(true)}
            style={{
              height: '28px',
              padding: '0 0.55rem',
              fontWeight: 700,
              fontSize: '0.76rem',
              background: '#fef3c7',
              color: '#b45309',
              borderColor: '#fde68a',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
            }}
            title="Auto-fill order quantities from yesterday's orders or bulk presets"
          >
            <Zap size={13} color="#d97706" />
            <span>Auto Entry</span>
          </button>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleOpenNewCustomerModal}
            style={{ height: '28px', padding: '0 0.55rem', fontSize: '0.76rem' }}
          >
            <UserPlus size={13} />
            <span>New Shop</span>
          </button>

          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={isSubmittingAll || pendingOrdersCount === 0}
            onClick={handleSubmitAllOrders}
            style={{ height: '28px', padding: '0 0.75rem', fontWeight: 800, fontSize: '0.78rem' }}
          >
            {resubmitOrdersCount > 0 ? <RefreshCw size={13} /> : <Save size={13} />}
            <span>
              {isSubmittingAll
                ? `Submitting (${submitProgress?.current}/${submitProgress?.total})...`
                : pendingOrdersCount > 0
                ? resubmitOrdersCount === pendingOrdersCount
                  ? `Re-submit Orders (${pendingOrdersCount}) • ${formatCurrency(sheetStats.totalBill)}`
                  : `Submit / Re-submit Orders (${pendingOrdersCount}) • ${formatCurrency(sheetStats.totalBill)}`
                : 'All Orders Saved'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setIsBulkWhatsAppModalOpen(true)}
            disabled={bulkBillItems.length === 0}
            style={{
              height: '28px',
              padding: '0 0.75rem',
              fontWeight: 800,
              fontSize: '0.78rem',
              background: bulkBillItems.length > 0 ? '#16a34a' : '#94a3b8',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              cursor: bulkBillItems.length > 0 ? 'pointer' : 'not-allowed',
              opacity: bulkBillItems.length > 0 ? 1 : 0.6,
              boxShadow: bulkBillItems.length > 0 ? '0 1px 3px rgba(22, 163, 74, 0.3)' : 'none',
            }}
            title="Send WhatsApp Bill (PDF or Image) to all customers"
          >
            <MessageCircle size={14} />
            <span>Send All WhatsApp Bills ({bulkBillItems.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setIsPendingReminderModalOpen(true)}
            disabled={pendingCustomers.length === 0}
            style={{
              height: '28px',
              padding: '0 0.75rem',
              fontWeight: 800,
              fontSize: '0.78rem',
              background: pendingCustomers.length > 0 ? '#d97706' : '#94a3b8',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              cursor: pendingCustomers.length > 0 ? 'pointer' : 'not-allowed',
              opacity: pendingCustomers.length > 0 ? 1 : 0.6,
              boxShadow: pendingCustomers.length > 0 ? '0 1px 3px rgba(217, 119, 6, 0.3)' : 'none',
            }}
            title="Send WhatsApp Order Reminder / Enquiry to customers with no orders entered for today"
          >
            <BellRing size={14} />
            <span>Ask Pending Orders ({pendingCustomers.length})</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="alert alert-error" style={{ marginBottom: '0.2rem', padding: '0.25rem 0.55rem', fontSize: '0.78rem', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}

      {successBanner && (
        <div className="alert alert-success" style={{ marginBottom: '0.25rem', padding: '0.3rem 0.65rem', fontSize: '0.8rem', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <CheckCircle2 size={14} />
          <span>{successBanner}</span>
        </div>
      )}

      {/* 2. Compact Operational KPI Bar (Single slim row to preserve 100vh viewport) */}
      <div
        className="billing-stat-strip"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.35rem',
          padding: '0.2rem 0.5rem',
          background: 'var(--bg-card)',
          borderRadius: '6px',
          border: '1px solid var(--border)',
          marginBottom: '0.25rem',
          flexShrink: 0,
          overflowX: 'auto',
          whiteSpace: 'nowrap',
          fontSize: '0.72rem',
          scrollbarWidth: 'none',
        }}
      >
        {/* Dispatch Orders Pill */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.12rem 0.45rem', background: '#fee2e2', borderRadius: '4px', color: '#991b1b', fontWeight: 800 }}>
          <span>📦 Orders:</span>
          <span style={{ color: '#dc2626' }}>{activeStats.validShopsCount} Shops</span>
          <span style={{ fontSize: '0.67rem', opacity: 0.9, fontWeight: 700 }}>({formatCurrency(activeStats.totalBill)})</span>
        </div>

        {/* Dynamic Product Totals Pills */}
        {products.length > 0 ? (
          products.map((p, idx) => {
            const colors = [
              { bg: '#fef3c7', text: '#b45309', border: '#fde68a' },
              { bg: '#e0f2fe', text: '#0369a1', border: '#bae6fd' },
              { bg: '#f3e8ff', text: '#7e22ce', border: '#e9d5ff' },
              { bg: '#dcfce7', text: '#15803d', border: '#bbf7d0' },
              { bg: '#ffedd5', text: '#c2410c', border: '#fed7aa' },
              { bg: '#ffe4e6', text: '#be123c', border: '#fecdd3' },
            ];
            const c = colors[idx % colors.length];
            const qty =
              activeStats.productTotals[p.id] ||
              (kubbusProduct && p.id === kubbusProduct.id
                ? activeStats.totalKubbus
                : romaliProduct && p.id === romaliProduct.id
                ? activeStats.totalRomali
                : 0);
            return (
              <div
                key={p.id}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.2rem',
                  padding: '0.12rem 0.4rem',
                  background: c.bg,
                  color: c.text,
                  border: `1px solid ${c.border}`,
                  borderRadius: '4px',
                  fontWeight: 700,
                }}
                title={`${p.name} (₹${parseFloat(p.unit_price).toFixed(2)}/ps)`}
              >
                <span>{p.name}:</span>
                <strong>{qty}</strong>
                <span style={{ fontSize: '0.64rem', opacity: 0.8 }}>ps</span>
              </div>
            );
          })
        ) : (
          <>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', padding: '0.12rem 0.4rem', background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a', borderRadius: '4px', fontWeight: 700 }}>
              <span>Kubbus:</span> <strong>{activeStats.totalKubbus}</strong> <span style={{ fontSize: '0.64rem' }}>ps</span>
            </div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', padding: '0.12rem 0.4rem', background: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '4px', fontWeight: 700 }}>
              <span>Romali:</span> <strong>{activeStats.totalRomali}</strong> <span style={{ fontSize: '0.64rem' }}>ps</span>
            </div>
          </>
        )}

        {/* Total Pieces */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', padding: '0.12rem 0.4rem', background: '#e0e7ff', color: '#3730a3', borderRadius: '4px', fontWeight: 800 }}>
          <span>Total:</span>
          <strong>{activeStats.totalPieces}</strong>
          <span style={{ fontSize: '0.64rem' }}>ps</span>
        </div>

        <div style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: '0.45rem', flexShrink: 0 }}>
          {/* Collections Pill */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.12rem 0.45rem', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '4px', color: '#065f46', fontWeight: 700 }}>
            <span>Collected:</span>
            <strong style={{ color: '#059669' }}>{formatCurrency(activeStats.totalCash + activeStats.totalGPay)}</strong>
            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
              (Cash: {formatCurrency(activeStats.totalCash)} • GPay: {formatCurrency(activeStats.totalGPay)})
            </span>
          </div>

          {/* Balance Due Pill */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.12rem 0.45rem', background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: '4px', color: '#991b1b', fontWeight: 800 }}>
            <span>Due:</span>
            <span style={{ color: '#dc2626' }}>{formatCurrency(activeStats.totalDue)}</span>
          </div>
        </div>
      </div>

      {/* 3. Compact Filter Bar - Ultra-clean responsive toolbar */}
      <div
        className="billing-filter-bar"
        style={{
          display: 'flex',
          gap: '0.25rem',
          alignItems: 'center',
          flexWrap: 'nowrap',
          overflowX: 'auto',
          scrollbarWidth: 'none',
          marginBottom: '0.22rem',
          flexShrink: 0,
          background: 'var(--bg-card)',
          padding: '0.2rem 0.45rem',
          borderRadius: '6px',
          border: '1px solid var(--border)',
        }}
      >
        {/* Route Select */}
        <select
          className="form-select"
          style={{ width: '122px', minWidth: '105px', flex: '0 0 auto', height: '26px', padding: '0 0.3rem', fontSize: '0.72rem' }}
          value={routeFilter}
          onChange={(e) => setRouteFilter(e.target.value)}
        >
          <option value="ALL">All Routes ({customers.length})</option>
          {routes.map((r) => {
            const count = customers.filter(
              (c) =>
                c.route === r.id ||
                c.route_details?.id === r.id ||
                (c.route_details?.name && c.route_details.name.toLowerCase() === r.name.toLowerCase())
            ).length;
            const displayName = r.name.charAt(0).toUpperCase() + r.name.slice(1);
            return (
              <option key={r.id} value={r.id}>
                {displayName} ({count})
              </option>
            );
          })}
        </select>

        {/* Date Selector - Guaranteed DD/MM/YYYY on all devices and locales */}
        <UniversalDatePicker
          value={orderDate}
          onChange={(newDate) => handleDateChange(newDate)}
          style={{ width: '110px', height: '26px' }}
          title="Dispatch Date (DD/MM/YYYY) — Changing this re-queries the database for that date"
        />

        {/* Order Sorting Dropdown - Small, side-by-side with Route and Date */}
        <select
          className="form-select"
          style={{ width: '118px', minWidth: '100px', flex: '0 0 auto', height: '26px', padding: '0 0.3rem', fontSize: '0.72rem' }}
          value={orderSort}
          onClick={() => {
            if (orderSort === 'CUSTOM' && !isCustomEditing) {
              setIsCustomEditing(true);
            }
          }}
          onChange={(e) => {
            const nextSort = e.target.value as 'SHOP_CREATE_ASC' | 'CUSTOM';
            if (nextSort === 'CUSTOM') {
              if (customSortOrder.length === 0) {
                // When custom is clicked, initialize custom order same as shop registered oldest
                const oldestOrder = [...visibleRows].sort((a, b) => {
                  const tA = new Date(a.customerCreatedAt || 0).getTime();
                  const tB = new Date(b.customerCreatedAt || 0).getTime();
                  if (tA !== 0 && tB !== 0 && tA !== tB) return tA - tB;
                  if (tA !== 0 && tB === 0) return -1;
                  if (tA === 0 && tB !== 0) return 1;
                  return a.customerName.localeCompare(b.customerName);
                }).map((r) => r.rowId);
                setCustomSortOrder(oldestOrder);
                localStorage.setItem('zamzam_fast_custom_sort_order', JSON.stringify(oldestOrder));
              }
              setIsCustomEditing(true); // When custom clicked, that time come!
            } else {
              setIsCustomEditing(false);
            }
            setOrderSort(nextSort);
          }}
          title="Sort order rows by shop registered date (oldest) or drag custom order"
        >
          <option value="SHOP_CREATE_ASC">Sort: Oldest</option>
          <option value="CUSTOM">
            {orderSort === 'CUSTOM' && !isCustomEditing
              ? '✋ Custom Order'
              : '✋ Custom (Drag)'}
          </option>
        </select>
        {orderSort === 'CUSTOM' && isCustomEditing && (
          <div style={{ display: 'inline-flex', gap: '0.2rem', alignItems: 'center', flexShrink: 0 }}>
            <button
              type="button"
              onClick={handleSaveCustomOrder}
              style={{
                height: '26px',
                padding: '0 0.45rem',
                background: saveCustomOrderSuccess ? '#16a34a' : '#15803d',
                color: '#fff',
                border: 'none',
                borderRadius: 'var(--radius)',
                fontSize: '0.72rem',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.2rem',
                whiteSpace: 'nowrap',
                boxShadow: '0 1px 3px rgba(21, 128, 61, 0.4)',
              }}
              title="Save custom order and hide all edit & remove options"
            >
              <Save size={11} />
              <span>{saveCustomOrderSuccess ? '✓ Saved' : '💾 Save'}</span>
            </button>
            <button
              type="button"
              onClick={handleResetToOldest}
              style={{
                height: '26px',
                padding: '0 0.3rem',
                background: '#f8fafc',
                color: '#475569',
                border: '1px solid #cbd5e1',
                borderRadius: 'var(--radius)',
                fontSize: '0.72rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.2rem',
                whiteSpace: 'nowrap',
              }}
              title="Reset order back to Shop Registered (Oldest)"
            >
              🔄 Reset
            </button>
          </div>
        )}

        {/* Action filter buttons */}
        <button
          type="button"
          onClick={() => setShowOrdersOnly((prev) => !prev)}
          style={{
            height: '26px',
            padding: '0 0.45rem',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.2rem',
            fontWeight: 700,
            fontSize: '0.72rem',
            borderRadius: 'var(--radius)',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            flex: '0 0 auto',
            background: showOrdersOnly ? '#1e40af' : '#f8fafc',
            color: showOrdersOnly ? '#fff' : '#64748b',
            border: showOrdersOnly ? '1.5px solid #1e40af' : '1px solid #e2e8f0',
            transition: 'all 0.15s ease',
          }}
          title={showOrdersOnly ? 'Showing only shops with orders — click to show all shops' : 'Click to show only shops with orders placed today'}
        >
          <span>📋</span>
          <span>{showOrdersOnly ? 'Orders Only ✓' : 'Orders Only'}</span>
        </button>

        {/* Refresh Orders Button with Last Updated indicator */}
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={async () => {
            try {
              const freshCusts = await customerService.getCustomers(undefined, undefined, true);
              setCustomers(freshCusts);
              await loadOrdersForDate(orderDate, freshCusts, drivers, false);
            } catch {
              await loadOrdersForDate(orderDate, customers, drivers, false);
            }
          }}
          disabled={ordersLoading || isSyncing}
          style={{ height: '26px', padding: '0 0.45rem', display: 'inline-flex', alignItems: 'center', gap: '0.2rem', fontWeight: 600, fontSize: '0.72rem', flex: '0 0 auto' }}
          title={`Click to refresh orders. Last refreshed: ${lastUpdatedTime}`}
        >
          <RefreshCw size={11} className={ordersLoading || isSyncing ? 'spinner' : ''} />
          <span>Refresh</span>
          <span style={{ fontSize: '0.66rem', opacity: 0.7, fontWeight: 'normal' }}>({lastUpdatedTime})</span>
        </button>

        {/* User-Controlled Auto-Sync Toggle */}
        <label
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.25rem',
            fontSize: '0.72rem',
            cursor: 'pointer',
            userSelect: 'none',
            color: autoSyncEnabled ? '#065f46' : '#64748b',
            fontWeight: 600,
            background: autoSyncEnabled ? '#ecfdf5' : '#f8fafc',
            border: autoSyncEnabled ? '1px solid #a7f3d0' : '1px solid #e2e8f0',
            borderRadius: '4px',
            padding: '0 0.35rem',
            height: '26px',
            flex: '0 0 auto',
          }}
          title="Auto-Sync is disabled by default to keep the order entry table completely stable without auto-reloading. Check to enable background sync every 60s."
        >
          <input
            type="checkbox"
            checked={autoSyncEnabled}
            onChange={(e) => setAutoSyncEnabled(e.target.checked)}
            style={{ cursor: 'pointer', accentColor: '#059669', width: '11px', height: '11px' }}
          />
          <span>Auto-Sync</span>
          {autoSyncEnabled && (
            <span
              style={{
                width: 5,
                height: 5,
                borderRadius: '50%',
                backgroundColor: isSyncing ? '#059669' : '#10b981',
                display: 'inline-block',
                boxShadow: isSyncing ? '0 0 0 2px rgba(16, 185, 129, 0.45)' : 'none',
              }}
            />
          )}
        </label>

        {/* Customer Self-Orders Quick Filter Pill */}
        <button
          type="button"
          onClick={() => {
            if (selfOrdersCount > 0 || sourceFilter === 'CUSTOMER_LINK') {
              setSourceFilter((prev) => (prev === 'CUSTOMER_LINK' ? 'ALL' : 'CUSTOMER_LINK'));
            }
          }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.2rem',
            height: '26px',
            padding: '0 0.4rem',
            borderRadius: 'var(--radius)',
            fontSize: '0.72rem',
            fontWeight: 800,
            cursor: selfOrdersCount > 0 || sourceFilter === 'CUSTOMER_LINK' ? 'pointer' : 'default',
            background: sourceFilter === 'CUSTOMER_LINK' ? '#059669' : selfOrdersCount > 0 ? '#ecfdf5' : '#f8fafc',
            color: sourceFilter === 'CUSTOMER_LINK' ? '#ffffff' : selfOrdersCount > 0 ? '#047857' : '#64748b',
            border: sourceFilter === 'CUSTOMER_LINK' ? '1.5px solid #059669' : selfOrdersCount > 0 ? '1.5px solid #10b981' : '1px solid #cbd5e1',
            boxShadow: sourceFilter === 'CUSTOMER_LINK' ? '0 2px 8px rgba(16, 185, 129, 0.35)' : '0 1px 3px rgba(0,0,0,0.05)',
            whiteSpace: 'nowrap',
            flex: '0 0 auto',
            transition: 'all 0.15s ease',
          }}
          title={selfOrdersCount > 0 ? "Click to filter table to Customer Self-Orders placed online" : "No self-orders placed online yet for this date"}
        >
          <Smartphone size={11} color={sourceFilter === 'CUSTOMER_LINK' ? '#ffffff' : selfOrdersCount > 0 ? '#059669' : '#94a3b8'} />
          <span>{selfOrdersCount} Self-Order{selfOrdersCount === 1 ? '' : 's'}</span>
          {sourceFilter === 'CUSTOMER_LINK' ? (
            <X size={11} />
          ) : selfOrdersCount > 0 ? (
            <span style={{ fontSize: '0.64rem', opacity: 0.85, background: '#10b981', color: '#fff', padding: '0.04rem 0.22rem', borderRadius: '3px' }}>Filter</span>
          ) : null}
        </button>

        {/* Customer/Shop Search Input with Connected WhatsApp Dropdown List & Auto-Selection */}
        <div ref={searchContainerRef} style={{ position: 'relative', flex: '1 1 180px', minWidth: '150px' }}>
          <Search
            size={12}
            style={{
              position: 'absolute',
              left: '7px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)',
              pointerEvents: 'none',
              zIndex: 2,
            }}
          />
          <input
            ref={searchInputRef}
            type="text"
            className="form-input"
            style={{ paddingLeft: '24px', height: '26px', paddingRight: '22px', fontSize: '0.76rem', width: '100%' }}
            placeholder="Search customer (Enter to select, ↑/↓ to navigate)..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowSearchDropdown(true);
              setSearchSelectedIndex(0);
            }}
            onFocus={() => {
              if (searchQuery.trim()) {
                setShowSearchDropdown(true);
                setSearchSelectedIndex(0);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (showSearchDropdown && matchingSearchCustomers.length > 0) {
                  setSearchSelectedIndex((prev) => (prev + 1) % matchingSearchCustomers.length);
                } else if (visibleRows.length > 0) {
                  const targetCol = getProductCols()[0] || 'kubbus';
                  focusCell(0, targetCol);
                } else {
                  handleNavigateCustomer('NEXT');
                }
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (showSearchDropdown && matchingSearchCustomers.length > 0) {
                  setSearchSelectedIndex((prev) => (prev - 1 + matchingSearchCustomers.length) % matchingSearchCustomers.length);
                } else {
                  handleNavigateCustomer('PREV');
                }
              } else if (e.key === 'Enter') {
                e.preventDefault();
                if (matchingSearchCustomers.length > 0) {
                  const sel = matchingSearchCustomers[searchSelectedIndex] || matchingSearchCustomers[0];
                  handleSelectCustomerFromSearch(sel);
                } else if (visibleRows.length > 0) {
                  const first = visibleRows[0];
                  if (first.customerId) {
                    handleSelectCustomerFromSearch({ id: first.customerId, name: first.customerName });
                  }
                }
              } else if (e.key === 'Tab' && !e.shiftKey) {
                if (matchingSearchCustomers.length > 0) {
                  e.preventDefault();
                  const sel = matchingSearchCustomers[searchSelectedIndex] || matchingSearchCustomers[0];
                  handleSelectCustomerFromSearch(sel);
                } else if (visibleRows.length > 0) {
                  e.preventDefault();
                  const targetCol = getProductCols()[0] || 'kubbus';
                  focusCell(0, targetCol);
                }
              } else if (e.key === 'Escape') {
                setShowSearchDropdown(false);
                setSearchQuery('');
              }
            }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setShowSearchDropdown(false);
              }}
              style={{
                position: 'absolute',
                right: '8px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '2px',
                display: 'flex',
                alignItems: 'center',
                zIndex: 2,
              }}
              title="Clear search"
            >
              <X size={14} />
            </button>
          )}

          {/* Search Result Dropdown List with Keyboard Navigation & Auto-Selection */}
          {showSearchDropdown && searchQuery.trim() && (
            <div
              className="card"
              style={{
                position: 'absolute',
                top: 'calc(100% + 4px)',
                left: 0,
                right: 0,
                minWidth: '320px',
                maxHeight: '360px',
                overflowY: 'auto',
                background: 'var(--bg-card)',
                border: '1.5px solid var(--border)',
                borderRadius: '8px',
                boxShadow: 'var(--shadow-lg)',
                zIndex: 100,
                padding: '0.35rem 0',
              }}
            >
              <div
                style={{
                  padding: '0.35rem 0.75rem',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  borderBottom: '1px solid var(--border)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span>Matching Shops ({matchingSearchCustomers.length})</span>
                <span style={{ fontSize: '0.67rem', color: '#6366f1', textTransform: 'none', fontWeight: 600 }}>
                  [↑/↓] Navigate • [Enter] Select
                </span>
              </div>

              {matchingSearchCustomers.length === 0 ? (
                <div style={{ padding: '0.75rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  No customer or shop matches "{searchQuery}"
                </div>
              ) : (
                matchingSearchCustomers.map((c, idx) => {
                  const isSelectedCandidate = idx === searchSelectedIndex;
                  return (
                    <div
                      key={c.id}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleSelectCustomerFromSearch(c);
                      }}
                      onClick={() => handleSelectCustomerFromSearch(c)}
                      style={{
                        padding: '0.45rem 0.75rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        borderBottom: '1px solid var(--border-light, #f1f5f9)',
                        gap: '0.5rem',
                        transition: 'background 0.1s ease',
                        background: isSelectedCandidate
                          ? '#eef2ff'
                          : (isWhatsAppEnabled && selectedCustomerId === c.id)
                          ? 'rgba(16, 185, 129, 0.1)'
                          : 'transparent',
                        borderLeft: isSelectedCandidate ? '3.5px solid #4f46e5' : '3.5px solid transparent',
                      }}
                      onMouseEnter={() => setSearchSelectedIndex(idx)}
                    >
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: isSelectedCandidate ? '#3730a3' : 'var(--text-primary)' }}>
                            {c.name}
                          </span>
                          {idx === 0 && (
                            <span style={{ fontSize: '0.62rem', background: '#4338ca', color: '#fff', padding: '0.06rem 0.35rem', borderRadius: '4px', fontWeight: 800, letterSpacing: '0.02em', display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                              ★ Best Match
                            </span>
                          )}
                          {isSelectedCandidate && (
                            <span style={{ fontSize: '0.6rem', background: idx === 0 ? '#4f46e5' : '#6366f1', color: '#fff', padding: '0.05rem 0.28rem', borderRadius: '3px', fontWeight: 700 }}>
                              ↵ Enter / Click
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.73rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', marginTop: '1px' }}>
                          {c.owner_name && <span>{c.owner_name}</span>}
                          {c.phone && (
                            <span style={{ color: '#059669', fontWeight: 600 }}>
                              📞 {c.phone}
                            </span>
                          )}
                          {c.route_details?.name && (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>
                              ({c.route_details.name})
                            </span>
                          )}
                        </div>
                      </div>

                      {isWhatsAppEnabled && (
                        <div
                          style={{
                            background: '#ecfdf5',
                            color: '#047857',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            padding: '0.15rem 0.45rem',
                            borderRadius: '5px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.2rem',
                            flexShrink: 0,
                            border: '1px solid #a7f3d0',
                          }}
                        >
                          <MessageCircle size={11} />
                          <span>WhatsApp</span>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Change Customer Arrow Buttons: Previous & Next Customer */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '1px',
            flexShrink: 0,
            background: 'var(--bg-card, #fff)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm, 4px)',
            padding: '1px',
          }}
          title="Change Customer (Prev / Next)"
        >
          <button
            type="button"
            onClick={() => handleNavigateCustomer('PREV')}
            disabled={visibleRows.length === 0}
            style={{
              height: '24px',
              width: '24px',
              padding: 0,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'transparent',
              border: 'none',
              borderRadius: '3px',
              cursor: visibleRows.length === 0 ? 'not-allowed' : 'pointer',
              color: visibleRows.length === 0 ? 'var(--text-muted)' : 'var(--text-primary)',
            }}
            title="Previous Customer (↑ / Alt+Up)"
          >
            <ChevronUp size={14} />
          </button>
          <button
            type="button"
            onClick={() => handleNavigateCustomer('NEXT')}
            disabled={visibleRows.length === 0}
            style={{
              height: '24px',
              width: '24px',
              padding: 0,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'transparent',
              border: 'none',
              borderRadius: '3px',
              cursor: visibleRows.length === 0 ? 'not-allowed' : 'pointer',
              color: visibleRows.length === 0 ? 'var(--text-muted)' : 'var(--text-primary)',
            }}
            title="Next Customer (↓ / Alt+Down)"
          >
            <ChevronDown size={14} />
          </button>
        </div>

        {/* Clear Filters */}
        {(routeFilter !== 'ALL' || searchQuery || showOrdersOnly || sourceFilter !== 'ALL') && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleClearAllFilters}
            style={{ height: '26px', padding: '0 0.45rem', fontSize: '0.72rem' }}
          >
            Clear Filters
          </button>
        )}

      </div>

      {/* 4. Billing Workspace Grid */}
      <div
        className="billing-workspace-grid"
        style={{
          flex: 1,
          minHeight: 0,
          minWidth: 0,
          width: '100%',
          maxWidth: '100%',
          display: 'flex',
          gap: '0.65rem',
          alignItems: 'stretch',
          overflow: 'hidden',
          boxSizing: 'border-box',
        }}
      >

        {/* Right: Existing Billing Table Container */}
        <div
          className="table-container card billing-table-wrapper"
            style={{
              flex: '1 1 0%',
              minWidth: 0,
              maxWidth: '100%',
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              padding: 0,
              overflow: 'hidden',
              marginBottom: 0,
              boxSizing: 'border-box',
            }}
          >
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto', minHeight: 0, WebkitOverflowScrolling: 'touch' }}>
          <table className="data-table" style={{ width: '100%', minWidth: '950px', borderCollapse: 'collapse' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg-card)' }}>
              <tr>
                {orderSort === 'CUSTOM' && isCustomEditing && (
                  <th style={{ width: '42px', minWidth: '42px', padding: '0.35rem 0.2rem', textAlign: 'center' }} title="Drag or click ▲/▼ to reorder shops">Order</th>
                )}
                <th style={{ width: '38px', minWidth: '36px', textAlign: 'center', padding: '0.35rem 0.25rem' }}>#</th>
                <th style={{ minWidth: '180px', maxWidth: '240px', padding: '0.35rem 0.55rem' }}>Shop Name</th>
                <th style={{ minWidth: '110px', padding: '0.35rem 0.55rem' }}>Route & Staff Driver</th>
                <th style={{ minWidth: '80px', textAlign: 'right', padding: '0.35rem 0.55rem', whiteSpace: 'nowrap' }}>Prev. Due</th>
                {products.length > 0 ? (
                  products.map((p) => {
                    const isSkipped = p.skip_in_entry || (p.skip_in_entry === undefined && (p.name.toLowerCase().includes('bun') || p.code.toLowerCase().includes('bun')));
                    return (
                      <th
                        key={p.id}
                        style={{ minWidth: '82px', textAlign: 'right', padding: '0.35rem 0.4rem', whiteSpace: 'nowrap' }}
                        title={`${p.name} (Unit price: ₹${parseFloat(p.unit_price).toFixed(2)})${isSkipped ? ' • Skipped on Enter' : ''}`}
                      >
                        {p.name} ({p.packet_size ? p.packet_size : 'ps'})
                      </th>
                    );
                  })
                ) : (
                  <>
                    <th style={{ minWidth: '82px', textAlign: 'right', padding: '0.35rem 0.4rem', whiteSpace: 'nowrap' }}>Kubbus (ps)</th>
                    <th style={{ minWidth: '82px', textAlign: 'right', padding: '0.35rem 0.4rem', whiteSpace: 'nowrap' }}>Romali (ps)</th>
                  </>
                )}
                <th style={{ minWidth: '82px', textAlign: 'right', padding: '0.35rem 0.4rem', whiteSpace: 'nowrap' }}>Cash (₹)</th>
                <th style={{ minWidth: '82px', textAlign: 'right', padding: '0.35rem 0.4rem', whiteSpace: 'nowrap' }}>GPay (₹)</th>
                <th style={{ minWidth: '82px', textAlign: 'right', padding: '0.35rem 0.55rem', whiteSpace: 'nowrap' }}>Bill Total</th>
                {isOrderDiscountEnabled && (
                  <th style={{ minWidth: '82px', textAlign: 'right', padding: '0.35rem 0.4rem', whiteSpace: 'nowrap' }} title="Discount / Deduction in ₹">Disc (₹)</th>
                )}
                <th style={{ minWidth: '88px', textAlign: 'right', padding: '0.35rem 0.55rem', whiteSpace: 'nowrap' }} title="Total Balance = Prev. Due + Today's Net Bill - Today's Payments">Balance</th>
                <th style={{ width: '82px', minWidth: '78px', textAlign: 'center', padding: '0.35rem 0.4rem' }}>Status</th>
                <th style={{ width: '40px', minWidth: '36px', textAlign: 'center', padding: '0.35rem 0.25rem' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading || (ordersLoading && rows.length === 0) ? (
                <tr>
                  <td colSpan={(orderSort === 'CUSTOM' && isCustomEditing ? 1 : 0) + (isOrderDiscountEnabled ? 11 : 10) + (products.length > 0 ? products.length : 2)} style={{ padding: '3rem', textAlign: 'center' }}>
                    <div className="spinner" style={{ margin: '0 auto 0.5rem' }} />
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      Loading orders for {orderDate}...
                    </span>
                  </td>
                </tr>
              ) : visibleRows.length === 0 ? (
                <tr>
                  <td colSpan={(orderSort === 'CUSTOM' && isCustomEditing ? 1 : 0) + (isOrderDiscountEnabled ? 11 : 10) + (products.length > 0 ? products.length : 2)} style={{ padding: '3rem 1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <div style={{ maxWidth: '420px', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.65rem' }}>
                      <Store size={40} color="var(--primary)" style={{ opacity: 0.8 }} />
                      <div style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-primary)' }}>
                        {customers.length === 0 ? 'No Customer Shops in Database' : 'No Shops Found'}
                      </div>
                      <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.4 }}>
                        {customers.length === 0
                          ? 'All sample data has been removed. Register your first shop to start entering real daily wholesale orders.'
                          : showOrdersOnly
                          ? `${customers.length} shops exist in your database, but none have orders placed on ${orderDate}. Click below to show all shops and enter orders.`
                          : 'No shops match your current search query or route filter.'}
                      </p>
                      {customers.length > 0 && showOrdersOnly && (
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => setShowOrdersOnly(false)}
                          style={{ marginTop: '0.4rem', padding: '0.45rem 1.25rem', fontWeight: 700 }}
                        >
                          <span>Show All {customers.length} Shops</span>
                        </button>
                      )}
                      {customers.length > 0 && !showOrdersOnly && isFilterActive && (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={handleClearAllFilters}
                          style={{ marginTop: '0.4rem', padding: '0.45rem 1.25rem', fontWeight: 700 }}
                        >
                          <span>Clear All Filters</span>
                        </button>
                      )}
                      {customers.length === 0 && (
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={handleOpenNewCustomerModal}
                          style={{ marginTop: '0.4rem', padding: '0.45rem 1.25rem', fontWeight: 700 }}
                        >
                          <UserPlus size={16} />
                          <span>+ Register First Shop</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                visibleRows.map((row, index) => {
                  const fin = getRowFinancials(row);
                  const isRowActive = fin.hasOrder || fin.cash > 0 || fin.gpay > 0;
                  const isDraggedOver = dragOver === row.rowId;
                  const isBeingDragged = isDragging === row.rowId;
                  const isSelected = Boolean(
                    (selectedRowId && row.rowId === selectedRowId) ||
                    (selectedCustomerId && row.customerId && row.customerId === selectedCustomerId)
                  );

                  return (
                    <tr
                      id={`order-row-${row.customerId || row.rowId}`}
                      key={row.rowId}
                      className={`order-row ${isSelected ? 'order-row-selected' : ''}`}
                      draggable={orderSort === 'CUSTOM' && isCustomEditing}
                      onDragStart={orderSort === 'CUSTOM' && isCustomEditing ? (e) => {
                        dragRowId.current = row.rowId;
                        setIsDragging(row.rowId);
                        e.dataTransfer.effectAllowed = 'move';
                      } : undefined}
                      onDragOver={orderSort === 'CUSTOM' && isCustomEditing ? (e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                        if (dragRowId.current !== row.rowId) {
                          dragOverRowId.current = row.rowId;
                          setDragOver(row.rowId);
                        }
                      } : undefined}
                      onDragEnd={orderSort === 'CUSTOM' && isCustomEditing ? () => {
                        if (dragRowId.current && dragOverRowId.current && dragRowId.current !== dragOverRowId.current) {
                          setCustomSortOrder((prev) => {
                            const currentOrder = prev.length > 0 ? prev : visibleRows.map((r) => r.rowId);
                            const fromIdx = currentOrder.indexOf(dragRowId.current!);
                            const toIdx = currentOrder.indexOf(dragOverRowId.current!);
                            if (fromIdx === -1 || toIdx === -1) {
                              // Build fresh from visible rows
                              const fresh = visibleRows.map((r) => r.rowId);
                              const fi = fresh.indexOf(dragRowId.current!);
                              const ti = fresh.indexOf(dragOverRowId.current!);
                              if (fi !== -1 && ti !== -1) {
                                fresh.splice(fi, 1);
                                fresh.splice(ti, 0, dragRowId.current!);
                              }
                              localStorage.setItem('zamzam_fast_custom_sort_order', JSON.stringify(fresh));
                              return fresh;
                            }
                            const updated = [...currentOrder];
                            updated.splice(fromIdx, 1);
                            updated.splice(toIdx, 0, dragRowId.current!);
                            localStorage.setItem('zamzam_fast_custom_sort_order', JSON.stringify(updated));
                            setHasUnsavedCustomOrder(true);
                            return updated;
                          });
                        }
                        dragRowId.current = null;
                        dragOverRowId.current = null;
                        setIsDragging(null);
                        setDragOver(null);
                      } : undefined}
                      onClick={() => {
                        if (row.customerId && selectedCustomerId !== row.customerId) {
                          setSelectedCustomerId(row.customerId);
                          if (isWhatsAppEnabled) handleSelectCustomerForWhatsApp(row.customerId);
                        }
                        setSelectedRowId(row.rowId);
                      }}
                      onFocusCapture={() => {
                        if (row.customerId && selectedCustomerId !== row.customerId) {
                          setSelectedCustomerId(row.customerId);
                        }
                        setSelectedRowId(row.rowId);
                      }}
                      style={{
                        cursor: (orderSort === 'CUSTOM' && isCustomEditing) ? 'grab' : 'pointer',
                        opacity: isBeingDragged ? 0.45 : 1,
                        transition: 'opacity 0.15s, background 0.12s',
                        background:
                          isDraggedOver
                            ? 'rgba(79, 70, 229, 0.10)'
                            : isSelected
                            ? '#fef9c3'
                            : (isWhatsAppEnabled && activeCustomer?.id === row.customerId)
                            ? 'rgba(16, 185, 129, 0.12)'
                            : row.orderSource === 'CUSTOMER_LINK'
                            ? '#f0fdf4'
                            : row.status === 'SAVED'
                            ? 'var(--success-bg)'
                            : row.status === 'ERROR'
                            ? 'var(--danger-bg)'
                            : isRowActive
                            ? '#f8fafc'
                            : undefined,
                        borderLeft:
                          isDraggedOver
                            ? '3px solid #4f46e5'
                            : isSelected
                            ? '4px solid #eab308'
                            : (isWhatsAppEnabled && activeCustomer?.id === row.customerId)
                            ? '4px solid #059669'
                            : row.orderSource === 'CUSTOMER_LINK'
                            ? '4px solid #10b981'
                            : undefined,
                        outline: isDraggedOver ? '1px dashed #4f46e5' : undefined,
                      }}
                    >
                      {/* Drag & Move Handle (only in CUSTOM sort mode when editing) */}
                      {orderSort === 'CUSTOM' && isCustomEditing && (
                        <td
                          style={{
                            textAlign: 'center',
                            padding: '0.12rem 0.2rem',
                            userSelect: 'none',
                            lineHeight: 1,
                            whiteSpace: 'nowrap',
                            minWidth: '42px',
                          }}
                        >
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', justifyContent: 'center' }}>
                            <span
                              style={{ cursor: 'grab', color: '#6366f1', fontSize: '0.95rem', fontWeight: 900 }}
                              title="Drag up or down to reorder"
                            >
                              ⠿
                            </span>
                            <div style={{ display: 'inline-flex', flexDirection: 'column', gap: '1px' }}>
                              <button
                                type="button"
                                disabled={index === 0}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleMoveCustomRow(row.rowId, 'UP');
                                }}
                                style={{
                                  padding: 0,
                                  width: '16px',
                                  height: '11px',
                                  lineHeight: '9px',
                                  fontSize: '0.52rem',
                                  background: index === 0 ? '#f1f5f9' : '#e0e7ff',
                                  color: index === 0 ? '#cbd5e1' : '#4338ca',
                                  border: '1px solid #c7d2fe',
                                  borderRadius: '2px',
                                  cursor: index === 0 ? 'default' : 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                                title="Move shop UP"
                              >
                                ▲
                              </button>
                              <button
                                type="button"
                                disabled={index === visibleRows.length - 1}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleMoveCustomRow(row.rowId, 'DOWN');
                                }}
                                style={{
                                  padding: 0,
                                  width: '16px',
                                  height: '11px',
                                  lineHeight: '9px',
                                  fontSize: '0.52rem',
                                  background: index === visibleRows.length - 1 ? '#f1f5f9' : '#e0e7ff',
                                  color: index === visibleRows.length - 1 ? '#cbd5e1' : '#4338ca',
                                  border: '1px solid #c7d2fe',
                                  borderRadius: '2px',
                                  cursor: index === visibleRows.length - 1 ? 'default' : 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                                title="Move shop DOWN"
                              >
                                ▼
                              </button>
                            </div>
                          </div>
                        </td>
                      )}
                      {/* Index / List Order */}
                      <td style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.74rem', padding: '0.25rem 0.2rem' }}>
                        {orderSort === 'CUSTOM' ? (
                          <span
                            title={`Custom Stop #${index + 1}`}
                            style={{
                              fontWeight: 800,
                              color: '#4f46e5',
                              background: '#eef2ff',
                              padding: '0.1rem 0.35rem',
                              borderRadius: '4px',
                            }}
                          >
                            #{index + 1}
                          </span>
                        ) : row.listOrder !== undefined ? (
                          <span
                            title={`Delivery Stop #${row.listOrder}`}
                            style={{
                              fontWeight: 800,
                              color: 'var(--primary)',
                              background: '#eff6ff',
                              padding: '0.1rem 0.35rem',
                              borderRadius: '4px',
                            }}
                          >
                            #{row.listOrder}
                          </span>
                        ) : (
                          index + 1
                        )}
                      </td>

                      {/* Shop Name - Compact single-row layout */}
                      <td style={{ padding: '0.18rem 0.4rem', minWidth: '170px', maxWidth: '250px' }}>
                        {row.isChangingCustomer || (row.isCustomRow && !row.customerId) ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                            <select
                              className="form-input"
                              value={row.customerId}
                              onChange={(e) => {
                                handleSelectCustomerForRow(row.rowId, e.target.value);
                                setRows((prev) =>
                                  prev.map((r) => (r.rowId === row.rowId ? { ...r, isChangingCustomer: false } : r))
                                );
                              }}
                              style={{
                                fontSize: '0.8rem',
                                padding: '0.15rem 0.35rem',
                                height: '28px',
                                fontWeight: 700,
                                borderColor: '#f59e0b',
                                backgroundColor: '#fffbeb',
                                flex: 1,
                              }}
                              autoFocus
                            >
                              <option value="">-- Select Customer Shop --</option>
                              {customers.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name} {c.owner_name ? `(${c.owner_name})` : ''} {c.route_details?.name ? `• ${c.route_details.name}` : ''}
                                </option>
                              ))}
                            </select>
                            {row.customerId && (
                              <button
                                type="button"
                                onClick={() =>
                                  setRows((prev) =>
                                    prev.map((r) => (r.rowId === row.rowId ? { ...r, isChangingCustomer: false } : r))
                                  )
                                }
                                style={{
                                  fontSize: '0.62rem',
                                  padding: '0.15rem 0.35rem',
                                  background: '#f1f5f9',
                                  border: '1px solid #cbd5e1',
                                  borderRadius: '3px',
                                  cursor: 'pointer',
                                  height: '28px',
                                }}
                                title="Cancel change"
                              >
                                <X size={12} />
                              </button>
                            )}
                          </div>
                        ) : (
                          <>
                            {/* Compact single-row: Name + Edit + mini-badges all inline */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.22rem', flexWrap: 'wrap', lineHeight: 1.2 }}>
                              <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.82rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '155px' }} title={row.customerName}>
                                {row.customerName || 'Walk-in'}
                              </span>
                              {row.customerId && (orderSort !== 'CUSTOM' || isCustomEditing) && (
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); handleOpenCustomerEdit(row.customerId); }}
                                  title={`Edit ${row.customerName}`}
                                  style={{ fontSize: '0.58rem', padding: '0.03rem 0.22rem', background: '#f0f9ff', color: '#0284c7', border: '1px solid #bae6fd', borderRadius: '3px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '1px', fontWeight: 600, flexShrink: 0 }}
                                >
                                  <Edit2 size={9} /><span>Edit</span>
                                </button>
                              )}
                              {/* Change Customer Arrow Button */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setRows((prev) =>
                                    prev.map((r) =>
                                      r.rowId === row.rowId ? { ...r, isChangingCustomer: true } : r
                                    )
                                  );
                                }}
                                style={{
                                  fontSize: '0.58rem',
                                  padding: '0.03rem 0.22rem',
                                  background: '#fef3c7',
                                  color: '#b45309',
                                  border: '1px solid #fde68a',
                                  borderRadius: '3px',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '1px',
                                  fontWeight: 600,
                                  flexShrink: 0,
                                }}
                                title="Change / Switch customer for this row"
                              >
                                <ArrowUpDown size={8} />
                                <span>Change</span>
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handlePrintRowOrder(row);
                                }}
                                title={`View & Send WhatsApp Bill for ${row.customerName || 'shop'}`}
                                style={{
                                  fontSize: '0.62rem',
                                  fontWeight: 700,
                                  background: '#dcfce7',
                                  color: '#15803d',
                                  border: '1px solid #86efac',
                                  borderRadius: '4px',
                                  padding: '0.05rem 0.35rem',
                                  whiteSpace: 'nowrap',
                                  flexShrink: 0,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '2px',
                                }}
                              >
                                <MessageCircle size={10} />
                                <span>{row.orderNumber ? `#${row.orderNumber} Bill` : 'Send Bill'}</span>
                              </button>

                              {!row.orderNumber && (
                                <button type="button" onClick={() => { const v = window.prompt(`Custom Order # / Token for ${row.customerName || 'shop'} (optional, leave blank to auto-generate):`, ''); if (v !== null) handleSetRowOrderDetails(row.rowId, v.trim() || undefined); }} style={{ fontSize: '0.58rem', padding: '0.03rem 0.22rem', background: 'transparent', color: 'var(--text-muted)', border: '1px dashed var(--border)', borderRadius: '3px', cursor: 'pointer', flexShrink: 0 }} title="Add custom order # / token for this order">+Ord#</button>
                              )}
                              {(orderSort === 'SHOP_CREATE_ASC' || orderSort === 'CUSTOM') && row.customerCreatedAt && (
                                <span
                                  title={`Customer shop registered in database on ${new Date(row.customerCreatedAt).toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' })}`}
                                  style={{ fontSize: '0.59rem', color: '#475569', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '3px', padding: '0.03rem 0.25rem', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '2px', flexShrink: 0 }}
                                >
                                  <Store size={9} style={{ color: '#64748b' }} />Shop Added: {new Date(row.customerCreatedAt).toLocaleDateString([], { day: '2-digit', month: 'short' })}
                                </span>
                              )}
                              {row.orderSource === 'CUSTOMER_LINK' && (
                                <span style={{ fontSize: '0.6rem', background: '#dcfce7', color: '#15803d', border: '1px solid #86efac', borderRadius: '3px', padding: '0.03rem 0.25rem', fontWeight: 700, whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '2px', flexShrink: 0 }}>
                                  <Smartphone size={9} />
                                  <span>Self-Order{(row.submittedAt || row.createdAt) ? ` ${formatOrderTime(row.submittedAt || row.createdAt)}` : ''}</span>
                                  {!unlockedSelfOrderIds.has(row.rowId) && (
                                    <button type="button" onClick={(e) => { e.stopPropagation(); setSelfOrderModalRow(row); setSelfOrderPendingField('kubbus'); }} style={{ fontSize: '0.57rem', padding: '0.02rem 0.18rem', background: '#fff', color: '#047857', border: '1px solid #10b981', borderRadius: '2px', cursor: 'pointer', fontWeight: 700, lineHeight: 1 }} title="Edit">Edit</button>
                                  )}
                                  {unlockedSelfOrderIds.has(row.rowId) && <span style={{ fontSize: '0.57rem', color: '#b45309', fontWeight: 700 }}>Unlocked</span>}
                                </span>
                              )}
                              {isWhatsAppEnabled && activeCustomer?.id === row.customerId && (
                                <span style={{ fontSize: '0.59rem', background: '#dcfce7', color: '#15803d', padding: '0.03rem 0.25rem', borderRadius: '3px', fontWeight: 800, flexShrink: 0, border: '1px solid #86efac', whiteSpace: 'nowrap' }}>💬 WA</span>
                              )}
                              {row.customerOwner && (
                                <span style={{ fontSize: '0.67rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '90px' }}>{row.customerOwner}</span>
                              )}
                            </div>
                          </>
                        )}
                      </td>

                      {/* Route & Driver Badge - compact */}
                      <td style={{ padding: '0.18rem 0.45rem', minWidth: '105px', maxWidth: '140px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem', minWidth: 0 }}>
                          <span
                            className="badge badge-neutral"
                            style={{
                              fontSize: '0.67rem',
                              padding: '0.06rem 0.35rem',
                              alignSelf: 'flex-start',
                              whiteSpace: 'nowrap',
                              maxWidth: '125px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              display: 'inline-block',
                            }}
                            title={row.customerRoute || 'No Route'}
                          >
                            {row.customerRoute || 'No Route'}
                          </span>
                          {isDriverModuleEnabled && row.driverName && (
                            <span
                              style={{
                                fontSize: '0.63rem',
                                color: autoConfirmDriver ? '#047857' : 'var(--text-muted)',
                                fontWeight: 600,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '2px',
                                whiteSpace: 'nowrap',
                                maxWidth: '125px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                              title={`Driver: ${row.driverName}`}
                            >
                              <Truck size={10} style={{ flexShrink: 0 }} />
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {row.driverName}
                              </span>
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Previous Due */}
                      <td
                        style={{
                          textAlign: 'right',
                          fontWeight: 700,
                          fontSize: '0.82rem',
                          padding: '0.18rem 0.45rem',
                          minWidth: '95px',
                          whiteSpace: 'nowrap',
                          color: parseFloat(row.customerBalance || '0') > 0 ? '#dc2626' : 'var(--text-secondary)',
                        }}
                      >
                        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: '3px' }}>
                          <span
                            onClick={() => {
                              if (row.customerId) handleOpenPrevDueModal(row);
                            }}
                            style={{
                              cursor: row.customerId ? 'pointer' : 'default',
                              borderBottom: row.customerId ? '1px dashed rgba(0,0,0,0.2)' : 'none',
                            }}
                            title={row.customerId ? `Click to edit Previous Due for ${row.customerName}` : undefined}
                          >
                            {formatCurrency(row.customerBalance || '0')}
                          </span>
                          {row.customerId && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenPrevDueModal(row);
                              }}
                              title={`Edit Previous Due for ${row.customerName}`}
                              style={{
                                fontSize: '0.58rem',
                                padding: '0.04rem 0.22rem',
                                background: '#f0f9ff',
                                color: '#0284c7',
                                border: '1px solid #bae6fd',
                                borderRadius: '3px',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '2px',
                                fontWeight: 600,
                                flexShrink: 0,
                                lineHeight: 1.1,
                              }}
                            >
                              <Edit2 size={8} />
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Dynamic Product Columns */}
                      {products.length > 0 ? (
                        products.map((prod) => {
                          const cellQty =
                            row.productQuantities?.[prod.id] !== undefined
                              ? row.productQuantities[prod.id]
                              : kubbusProduct && prod.id === kubbusProduct.id
                              ? row.kubbusQty
                              : romaliProduct && prod.id === romaliProduct.id
                              ? row.romaliQty
                              : '';
                          const isLocked =
                            (row.status === 'LOCKED' && !unlockedSelfOrderIds.has(row.rowId)) ||
                            (row.orderSource === 'CUSTOMER_LINK' && !unlockedSelfOrderIds.has(row.rowId));
                          const effRate = getProductPriceForCustomer(row.customerId, prod);
                          const stdRate = parseFloat(prod.unit_price || '0');
                          const isCustomRate = Boolean(row.customerId) && Math.abs(effRate - stdRate) > 0.001;
                          const isKubbus = Boolean((kubbusProduct && prod.id === kubbusProduct.id) || prod.name.toLowerCase().startsWith('kubbus'));
                          const isRomali = Boolean((romaliProduct && prod.id === romaliProduct.id) || prod.name.toLowerCase().startsWith('romali'));
                          const prodLetter = (prod.name || '').trim().charAt(0).toUpperCase() || (isKubbus ? 'K' : isRomali ? 'R' : 'P');

                          const badgeText = isKubbus ? '#b45309' : isRomali ? '#b91c1c' : '#2563eb';
                          const badgeBg = isKubbus ? 'rgba(245, 158, 11, 0.15)' : isRomali ? 'rgba(239, 68, 68, 0.15)' : 'rgba(37, 99, 235, 0.12)';
                          const badgeBorder = isKubbus ? 'rgba(245, 158, 11, 0.35)' : isRomali ? 'rgba(239, 68, 68, 0.35)' : 'rgba(37, 99, 235, 0.3)';

                          const activeBorder = isKubbus ? '#f59e0b' : isRomali ? '#dc2626' : 'var(--primary)';
                          const activeBg = isKubbus ? '#fffbeb' : isRomali ? '#fef2f2' : 'var(--primary-subtle, #f0fdf4)';

                          return (
                            <td key={prod.id} style={{ textAlign: 'right', padding: '0.12rem 0.35rem', minWidth: '80px' }}>
                              <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                                <span
                                  aria-hidden="true"
                                  style={{
                                    position: 'absolute',
                                    left: '5px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    zIndex: 2,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: '15px',
                                    height: '17px',
                                    fontSize: '0.66rem',
                                    fontWeight: 900,
                                    color: badgeText,
                                    backgroundColor: badgeBg,
                                    border: `1px solid ${badgeBorder}`,
                                    borderRadius: '3px',
                                    lineHeight: 1,
                                    pointerEvents: 'none',
                                    userSelect: 'none',
                                    boxShadow: '0 0.5px 1px rgba(0,0,0,0.05)',
                                  }}
                                  title={`${prod.name} (${prodLetter})`}
                                >
                                  {prodLetter}
                                </span>
                                <input
                                  ref={(el) => {
                                    inputRefs.current[`${index}_prod_${prod.id}`] = el;
                                    if (row.customerId) {
                                      inputRefs.current[`cust_${row.customerId}_prod_${prod.id}`] = el;
                                    }
                                  }}
                                  data-col={`prod_${prod.id}`}
                                  data-customer-id={row.customerId}
                                  type="number"
                                  min="0"
                                  step="1"
                                  placeholder="0"
                                  className="form-input"
                                  value={cellQty}
                                  readOnly={isLocked}
                                  onClick={() => {
                                    if (row.orderSource === 'CUSTOMER_LINK' && !unlockedSelfOrderIds.has(row.rowId)) {
                                      setSelfOrderModalRow(row);
                                      setSelfOrderPendingField(`prod_${prod.id}`);
                                    }
                                  }}
                                  onFocus={(e) => {
                                    e.target.select();
                                    if (row.orderSource === 'CUSTOMER_LINK' && !unlockedSelfOrderIds.has(row.rowId)) {
                                      setSelfOrderModalRow(row);
                                      setSelfOrderPendingField(`prod_${prod.id}`);
                                      return;
                                    }
                                    if (row.customerId) fetchCustomerPricing(row.customerId);
                                  }}
                                  onChange={(e) => handleProductQtyChange(row.rowId, prod.id, e.target.value)}
                                  onKeyDown={(e) => handleKeyDown(e, index, `prod_${prod.id}`)}
                                  style={{
                                    width: '74px',
                                    height: '28px',
                                    textAlign: 'right',
                                    fontWeight: 800,
                                    padding: '0.15rem 0.35rem 0.15rem 22px',
                                    fontSize: '0.86rem',
                                    display: 'inline-block',
                                    cursor: isLocked ? 'pointer' : 'text',
                                    borderColor: cellQty ? activeBorder : undefined,
                                    backgroundColor: isLocked ? '#f9fafb' : cellQty ? activeBg : undefined,
                                  }}
                                  title={
                                    (row.orderSource === 'CUSTOMER_LINK' && !unlockedSelfOrderIds.has(row.rowId))
                                      ? 'Customer Self-Order. Click to unlock and edit.'
                                      : row.status === 'LOCKED'
                                      ? 'Order is locked and cannot be edited. Use Reopen to modify.'
                                      : `${prod.name} • Rate: ₹${effRate.toFixed(2)}${isCustomRate ? ' (Customer Custom)' : ' (Standard)'}`
                                  }
                                />
                              </div>
                            </td>
                          );
                        })
                      ) : (
                        <>
                          {/* Fallback Kubbus Input */}
                          <td style={{ textAlign: 'right', padding: '0.12rem 0.35rem', minWidth: '80px' }}>
                            <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                              <span
                                aria-hidden="true"
                                style={{
                                  position: 'absolute',
                                  left: '5px',
                                  top: '50%',
                                  transform: 'translateY(-50%)',
                                  zIndex: 2,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  width: '15px',
                                  height: '17px',
                                  fontSize: '0.66rem',
                                  fontWeight: 900,
                                  color: '#b45309',
                                  backgroundColor: 'rgba(245, 158, 11, 0.15)',
                                  border: '1px solid rgba(245, 158, 11, 0.35)',
                                  borderRadius: '3px',
                                  lineHeight: 1,
                                  pointerEvents: 'none',
                                  userSelect: 'none',
                                  boxShadow: '0 0.5px 1px rgba(0,0,0,0.05)',
                                }}
                                title="Kubbus (K)"
                              >
                                K
                              </span>
                              <input
                                ref={(el) => {
                                  inputRefs.current[`${index}_kubbus`] = el;
                                  if (row.customerId) {
                                    inputRefs.current[`cust_${row.customerId}_kubbus`] = el;
                                  }
                                }}
                                data-col="kubbus"
                                data-customer-id={row.customerId}
                                type="number"
                                min="0"
                                step="1"
                                placeholder="0"
                                className="form-input"
                                value={row.kubbusQty}
                                readOnly={
                                  (row.status === 'LOCKED' && !unlockedSelfOrderIds.has(row.rowId)) ||
                                  (row.orderSource === 'CUSTOMER_LINK' && !unlockedSelfOrderIds.has(row.rowId))
                                }
                                onClick={() => {
                                  if (row.orderSource === 'CUSTOMER_LINK' && !unlockedSelfOrderIds.has(row.rowId)) {
                                    setSelfOrderModalRow(row);
                                    setSelfOrderPendingField('kubbus');
                                  }
                                }}
                                onFocus={(e) => {
                                  e.target.select();
                                  if (row.orderSource === 'CUSTOMER_LINK' && !unlockedSelfOrderIds.has(row.rowId)) {
                                    setSelfOrderModalRow(row);
                                    setSelfOrderPendingField('kubbus');
                                    return;
                                  }
                                  if (row.customerId) fetchCustomerPricing(row.customerId);
                                }}
                                onChange={(e) => handleCellChange(row.rowId, 'kubbusQty', e.target.value)}
                                onKeyDown={(e) => handleKeyDown(e, index, 'kubbus')}
                                style={{
                                  width: '74px',
                                  height: '28px',
                                  textAlign: 'right',
                                  fontWeight: 800,
                                  padding: '0.15rem 0.35rem 0.15rem 22px',
                                  fontSize: '0.86rem',
                                  display: 'inline-block',
                                  cursor: (
                                    (row.status === 'LOCKED' && !unlockedSelfOrderIds.has(row.rowId)) ||
                                    (row.orderSource === 'CUSTOMER_LINK' && !unlockedSelfOrderIds.has(row.rowId))
                                  ) ? 'pointer' : 'text',
                                  borderColor: row.kubbusQty ? '#f59e0b' : undefined,
                                  backgroundColor: (
                                    (row.status === 'LOCKED' && !unlockedSelfOrderIds.has(row.rowId)) ||
                                    (row.orderSource === 'CUSTOMER_LINK' && !unlockedSelfOrderIds.has(row.rowId))
                                  ) ? '#f9fafb' : row.kubbusQty ? '#fffbeb' : undefined,
                                }}
                                title={
                                  (row.orderSource === 'CUSTOMER_LINK' && !unlockedSelfOrderIds.has(row.rowId))
                                    ? 'Customer Self-Order. Click to unlock and edit.'
                                    : row.status === 'LOCKED'
                                    ? 'Order is locked and cannot be edited. Use Reopen to modify.'
                                    : kubbusProduct
                                    ? `Kubbus • Rate: ₹${getProductPriceForCustomer(row.customerId, kubbusProduct).toFixed(2)}`
                                    : 'Kubbus'
                                }
                              />
                            </div>
                          </td>

                          {/* Fallback Romali Roti Input */}
                          <td style={{ textAlign: 'right', padding: '0.12rem 0.35rem', minWidth: '80px' }}>
                            <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                              <span
                                aria-hidden="true"
                                style={{
                                  position: 'absolute',
                                  left: '5px',
                                  top: '50%',
                                  transform: 'translateY(-50%)',
                                  zIndex: 2,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  width: '15px',
                                  height: '17px',
                                  fontSize: '0.66rem',
                                  fontWeight: 900,
                                  color: '#b91c1c',
                                  backgroundColor: 'rgba(239, 68, 68, 0.15)',
                                  border: '1px solid rgba(239, 68, 68, 0.35)',
                                  borderRadius: '3px',
                                  lineHeight: 1,
                                  pointerEvents: 'none',
                                  userSelect: 'none',
                                  boxShadow: '0 0.5px 1px rgba(0,0,0,0.05)',
                                }}
                                title="Romali Roti (R)"
                              >
                                R
                              </span>
                              <input
                                ref={(el) => {
                                  inputRefs.current[`${index}_romali`] = el;
                                  if (row.customerId) {
                                    inputRefs.current[`cust_${row.customerId}_romali`] = el;
                                  }
                                }}
                                data-col="romali"
                                data-customer-id={row.customerId}
                                type="number"
                                min="0"
                                step="1"
                                placeholder="0"
                                className="form-input"
                                value={row.romaliQty}
                                readOnly={
                                  (row.status === 'LOCKED' && !unlockedSelfOrderIds.has(row.rowId)) ||
                                  (row.orderSource === 'CUSTOMER_LINK' && !unlockedSelfOrderIds.has(row.rowId))
                                }
                                onClick={() => {
                                  if (row.orderSource === 'CUSTOMER_LINK' && !unlockedSelfOrderIds.has(row.rowId)) {
                                    setSelfOrderModalRow(row);
                                    setSelfOrderPendingField('romali');
                                  }
                                }}
                                onFocus={(e) => {
                                  e.target.select();
                                  if (row.orderSource === 'CUSTOMER_LINK' && !unlockedSelfOrderIds.has(row.rowId)) {
                                    setSelfOrderModalRow(row);
                                    setSelfOrderPendingField('romali');
                                    return;
                                  }
                                  if (row.customerId) fetchCustomerPricing(row.customerId);
                                }}
                                onChange={(e) => handleCellChange(row.rowId, 'romaliQty', e.target.value)}
                                onKeyDown={(e) => handleKeyDown(e, index, 'romali')}
                                style={{
                                  width: '74px',
                                  height: '28px',
                                  textAlign: 'right',
                                  fontWeight: 800,
                                  padding: '0.15rem 0.35rem 0.15rem 22px',
                                  fontSize: '0.86rem',
                                  display: 'inline-block',
                                  cursor: (
                                    (row.status === 'LOCKED' && !unlockedSelfOrderIds.has(row.rowId)) ||
                                    (row.orderSource === 'CUSTOMER_LINK' && !unlockedSelfOrderIds.has(row.rowId))
                                  ) ? 'pointer' : 'text',
                                  borderColor: row.romaliQty ? '#dc2626' : undefined,
                                  backgroundColor: (
                                    (row.status === 'LOCKED' && !unlockedSelfOrderIds.has(row.rowId)) ||
                                    (row.orderSource === 'CUSTOMER_LINK' && !unlockedSelfOrderIds.has(row.rowId))
                                  ) ? '#f9fafb' : row.romaliQty ? '#fef2f2' : undefined,
                                }}
                                title={
                                  (row.orderSource === 'CUSTOMER_LINK' && !unlockedSelfOrderIds.has(row.rowId))
                                    ? 'Customer Self-Order. Click to unlock and edit.'
                                    : row.status === 'LOCKED'
                                    ? 'Order is locked and cannot be edited. Use Reopen to modify.'
                                    : romaliProduct
                                    ? `Romali • Rate: ₹${getProductPriceForCustomer(row.customerId, romaliProduct).toFixed(2)}`
                                    : 'Romali'
                                }
                              />
                            </div>
                          </td>
                        </>
                      )}

                      {/* Cash Input */}
                      <td style={{ textAlign: 'right', padding: '0.12rem 0.35rem', minWidth: '80px' }}>
                        <input
                          ref={(el) => {
                            inputRefs.current[`${index}_cash`] = el;
                            if (row.customerId) {
                              inputRefs.current[`cust_${row.customerId}_cash`] = el;
                            }
                          }}
                          data-col="cash"
                          data-customer-id={row.customerId}
                          type="number"
                          min="0"
                          step="any"
                          placeholder="0.00"
                          className="form-input"
                          value={row.cashAmount}
                          onFocus={(e) => {
                            e.target.select();
                            if (row.customerId) fetchCustomerPricing(row.customerId);
                          }}
                          onChange={(e) => handleCellChange(row.rowId, 'cashAmount', e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, index, 'cash')}
                          style={{
                            width: '72px',
                            height: '28px',
                            textAlign: 'right',
                            fontWeight: 800,
                            padding: '0.15rem 0.35rem',
                            fontSize: '0.84rem',
                            display: 'inline-block',
                            borderColor: row.cashAmount ? '#10b981' : undefined,
                          }}
                        />
                      </td>

                      {/* GPay Input */}
                      <td style={{ textAlign: 'right', padding: '0.12rem 0.35rem', minWidth: '80px' }}>
                        <input
                          ref={(el) => {
                            inputRefs.current[`${index}_gpay`] = el;
                            if (row.customerId) {
                              inputRefs.current[`cust_${row.customerId}_gpay`] = el;
                            }
                          }}
                          data-col="gpay"
                          data-customer-id={row.customerId}
                          type="number"
                          min="0"
                          step="any"
                          placeholder="0.00"
                          className="form-input"
                          value={row.gpayAmount}
                          onFocus={(e) => {
                            e.target.select();
                            if (row.customerId) fetchCustomerPricing(row.customerId);
                          }}
                          onChange={(e) => handleCellChange(row.rowId, 'gpayAmount', e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, index, 'gpay')}
                          style={{
                            width: '72px',
                            height: '28px',
                            textAlign: 'right',
                            fontWeight: 800,
                            padding: '0.15rem 0.35rem',
                            fontSize: '0.84rem',
                            display: 'inline-block',
                            borderColor: row.gpayAmount ? '#dc2626' : undefined,
                          }}
                        />
                      </td>

                      {/* Bill Total */}
                      <td
                        style={{ textAlign: 'right', fontWeight: 800, color: '#dc2626', fontSize: '0.88rem', padding: '0.18rem 0.45rem', minWidth: '80px', whiteSpace: 'nowrap' }}
                        title={`Bill: ${formatCurrency(fin.rowTotal)}`}
                      >
                        <div>{formatCurrency(fin.rowTotal)}</div>
                      </td>

                      {/* Discount Input */}
                      {isOrderDiscountEnabled && (
                        <td style={{ textAlign: 'right', padding: '0.12rem 0.35rem', minWidth: '80px' }}>
                          <input
                            ref={(el) => {
                              inputRefs.current[`${index}_discount`] = el;
                              if (row.customerId) {
                                inputRefs.current[`cust_${row.customerId}_discount`] = el;
                              }
                            }}
                            data-col="discount"
                            data-customer-id={row.customerId}
                            type="number"
                            min="0"
                            step="any"
                            placeholder="0.00"
                            className="form-input"
                            value={row.discountAmount}
                            onFocus={(e) => {
                              e.target.select();
                              if (row.customerId) fetchCustomerPricing(row.customerId);
                            }}
                            onChange={(e) => handleCellChange(row.rowId, 'discountAmount', e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, index, 'discount')}
                            style={{
                              width: '72px',
                              height: '28px',
                              textAlign: 'right',
                              fontWeight: 800,
                              padding: '0.15rem 0.35rem',
                              fontSize: '0.84rem',
                              display: 'inline-block',
                              borderColor: row.discountAmount ? '#f59e0b' : undefined,
                            }}
                            title="Discount / Deduction in ₹"
                          />
                        </td>
                      )}

                      {/* Balance (Prev. Due + Bill - Paid) */}
                      <td
                        style={{
                          textAlign: 'right',
                          fontWeight: 800,
                          fontSize: '0.84rem',
                          padding: '0.18rem 0.45rem',
                          minWidth: '85px',
                          whiteSpace: 'nowrap',
                        }}
                        title={`Prev Due: ${formatCurrency(fin.prevDue)} + Bill: ${formatCurrency(fin.rowTotal)} - Paid: ${formatCurrency(fin.rowPaid)} = ${formatCurrency(fin.rowBalance)}`}
                      >
                        {(fin.prevDue > 0 || fin.rowTotal > 0) && fin.rowBalance === 0 ? (
                          <span className="badge badge-success" style={{ fontSize: '0.68rem', padding: '0.1rem 0.4rem' }}>
                            ✓ Cleared
                          </span>
                        ) : fin.rowBalance < 0 ? (
                          <span className="badge badge-info" style={{ fontSize: '0.68rem', padding: '0.1rem 0.4rem' }} title="Advance Credit">
                            Adv {formatCurrency(Math.abs(fin.rowBalance))}
                          </span>
                        ) : fin.rowBalance > 0 ? (
                          <span style={{ color: '#dc2626', fontWeight: 800 }}>
                            {formatCurrency(fin.rowBalance)}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>₹0.00</span>
                        )}
                      </td>

                      {/* Status */}
                      <td style={{ textAlign: 'center', padding: '0.12rem 0.25rem' }}>
                        {row.orderSource === 'CUSTOMER_LINK' ? (
                          unlockedSelfOrderIds.has(row.rowId) ? (
                            <span
                              className="badge badge-warning"
                              style={{
                                fontSize: '0.68rem',
                                padding: '0.15rem 0.45rem',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                                background: '#fef3c7',
                                color: '#b45309',
                                border: '1px solid #fde68a',
                                fontWeight: 700,
                              }}
                              title="Customer Self-Order unlocked for editing"
                            >
                              <Edit size={11} />
                              <span>Editing</span>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setSelfOrderModalRow(row);
                                setSelfOrderPendingField('kubbus');
                              }}
                              style={{
                                fontSize: '0.68rem',
                                padding: '0.15rem 0.45rem',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                                background: '#059669',
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: '4px',
                                fontWeight: 700,
                                cursor: 'pointer',
                              }}
                              title={`Online Self-Order #${row.orderNumber || ''} placed by customer. Click to edit.`}
                            >
                              <Smartphone size={11} />
                              <span>Self-Order</span>
                            </button>
                          )
                        ) : row.status === 'SAVED' ? (
                          <span
                            className="badge badge-success"
                            style={{ fontSize: '0.68rem', padding: '0.15rem 0.4rem', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                            title={`Order #${row.orderNumber || ''} (Saved in Database)`}
                          >
                            <CheckCheck size={12} strokeWidth={2.5} />
                            <span>{row.orderNumber?.split('-').slice(-1)[0] || 'Saved'}</span>
                          </span>
                        ) : row.status === 'SAVING' ? (
                          <div className="spinner" style={{ width: 13, height: 13, margin: '0 auto' }} />
                        ) : row.status === 'ERROR' ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              alert(`⚠️ Server Error for ${row.customerName || 'Order'}:\n\n${row.errorMessage || 'Unknown error occurred while contacting the server.'}`);
                            }}
                            className="badge badge-danger"
                            style={{
                              fontSize: '0.68rem',
                              padding: '0.15rem 0.4rem',
                              cursor: 'pointer',
                              border: 'none',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                            }}
                            title={row.errorMessage ? `Error: ${row.errorMessage}\n(Click to view details)` : 'Click to view server error details'}
                          >
                            <AlertCircle size={10} />
                            <span>Error</span>
                          </button>
                        ) : row.orderId && row.status === 'IDLE' ? (
                          <span
                            className="badge"
                            style={{
                              fontSize: '0.68rem',
                              padding: '0.15rem 0.4rem',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                              background: '#fee2e2',
                              color: '#dc2626',
                              border: '1px solid #fecaca',
                              fontWeight: 700,
                            }}
                            title="Order modified - click Re-submit to save changes to database"
                          >
                            <RefreshCw size={10} />
                            <span>Modified</span>
                          </span>
                        ) : isRowActive ? (
                          <span className="badge badge-warning" style={{ fontSize: '0.68rem', padding: '0.15rem 0.4rem' }}>Ready</span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>—</span>
                        )}
                      </td>

                      {/* Action: Save Single Row & Remove Row Buttons */}
                      <td style={{ textAlign: 'center', padding: '0.35rem 0.25rem', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                          {row.orderId && row.status === 'IDLE' ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSaveSingleRow(row.rowId);
                              }}
                              title={`Re-submit order changes for ${row.customerName || 'shop'} to database`}
                              disabled={isSubmittingAll}
                              style={{
                                cursor: 'pointer',
                                padding: '3px 8px',
                                borderRadius: '5px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                                background: '#dc2626',
                                color: '#ffffff',
                                border: 'none',
                                fontWeight: 700,
                                fontSize: '0.7rem',
                                boxShadow: '0 1px 2px rgba(220, 38, 38, 0.25)',
                              }}
                            >
                              <RefreshCw size={11} />
                              <span>Re-submit</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSaveSingleRow(row.rowId);
                              }}
                              title={`Save order for ${row.customerName || 'shop'} to database`}
                              disabled={row.status === 'SAVING'}
                              className="action-pill-edit"
                              style={{
                                cursor: 'pointer',
                                padding: '3px 6px',
                                borderRadius: '6px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <Save size={13} />
                            </button>
                          )}

                          {row.orderId && (
                            <>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handlePrintRowOrder(row);
                                }}
                                title={`Send WhatsApp Bill for Order #${row.orderNumber || ''}`}
                                style={{
                                  background: '#dcfce7',
                                  border: '1px solid #86efac',
                                  cursor: 'pointer',
                                  padding: '3px 6px',
                                  borderRadius: '6px',
                                  color: '#15803d',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  transition: 'all 0.15s ease',
                                }}
                              >
                                <MessageCircle size={13} />
                              </button>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handlePrintRowOrder(row);
                                }}
                                title={`Print bill / slip for Order #${row.orderNumber || ''}`}
                                style={{
                                  background: '#eff6ff',
                                  border: '1px solid #bfdbfe',
                                  cursor: 'pointer',
                                  padding: '3px 6px',
                                  borderRadius: '6px',
                                  color: '#1d4ed8',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  transition: 'all 0.15s ease',
                                }}
                              >
                                <Printer size={13} />
                              </button>
                            </>
                          )}

                          {(orderSort !== 'CUSTOM' || isCustomEditing || row.isCustomRow) && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveRow(row.rowId);
                              }}
                              title={`Remove ${row.customerName || 'row'} from list`}
                              className="action-pill-delete"
                              style={{
                                cursor: 'pointer',
                                padding: '3px 6px',
                                borderRadius: '6px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {visibleRows.length > 0 && (
              <tfoot
                style={{
                  position: 'sticky',
                  bottom: 0,
                  zIndex: 9,
                  background: '#f8fafc',
                  borderTop: '2px solid var(--border)',
                  boxShadow: '0 -2px 8px rgba(0, 0, 0, 0.08)',
                  fontSize: '0.78rem',
                }}
              >
                <tr style={{ background: '#f8fafc' }}>
                  {orderSort === 'CUSTOM' && isCustomEditing && <td style={{ padding: '0.45rem 0.2rem' }}></td>}
                  <td style={{ textAlign: 'center', padding: '0.45rem 0.25rem', color: 'var(--text-muted)' }}>Σ</td>
                  <td style={{ padding: '0.45rem 0.55rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {selectedRouteObj ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', color: 'var(--primary)' }}>
                        <MapPin size={13} /> {selectedRouteObj.name} Total
                      </span>
                    ) : isFilterActive ? (
                      'Filtered Total'
                    ) : (
                      'All Visible Total'
                    )}
                  </td>
                  <td style={{ padding: '0.45rem 0.55rem', color: 'var(--text-muted)', fontSize: '0.73rem', fontWeight: 600 }}>
                    {filteredStats.validShopsCount} / {visibleRows.length} shops
                  </td>
                  <td
                    style={{
                      textAlign: 'right',
                      padding: '0.45rem 0.55rem',
                      fontWeight: 800,
                      color: filteredStats.totalPrevDue > 0 ? '#dc2626' : 'var(--text-primary)',
                      whiteSpace: 'nowrap',
                    }}
                    title="Total Previous Due across visible shops"
                  >
                    {formatCurrency(filteredStats.totalPrevDue)}
                  </td>
                  {products.length > 0 ? (
                    products.map((p, idx) => {
                      const colors = ['#b45309', '#0284c7', '#7c3aed', '#059669', '#ea580c', '#e11d48'];
                      const colColor = colors[idx % colors.length];
                      const qty =
                        filteredStats.productTotals[p.id] ||
                        (kubbusProduct && p.id === kubbusProduct.id
                          ? filteredStats.totalKubbus
                          : romaliProduct && p.id === romaliProduct.id
                          ? filteredStats.totalRomali
                          : 0);
                      return (
                        <td key={p.id} style={{ textAlign: 'right', padding: '0.45rem 0.4rem', fontWeight: 800, color: colColor }}>
                          {qty} <span style={{ fontSize: '0.68rem', fontWeight: 600 }}>ps</span>
                        </td>
                      );
                    })
                  ) : (
                    <>
                      <td style={{ textAlign: 'right', padding: '0.45rem 0.4rem', fontWeight: 800, color: '#b45309' }}>
                        {filteredStats.totalKubbus} <span style={{ fontSize: '0.68rem', fontWeight: 600 }}>ps</span>
                      </td>
                      <td style={{ textAlign: 'right', padding: '0.45rem 0.4rem', fontWeight: 800, color: '#dc2626' }}>
                        {filteredStats.totalRomali} <span style={{ fontSize: '0.68rem', fontWeight: 600 }}>ps</span>
                      </td>
                    </>
                  )}
                  <td style={{ textAlign: 'right', padding: '0.45rem 0.4rem', fontWeight: 800, color: '#16a34a' }}>
                    {formatCurrency(filteredStats.totalCash)}
                  </td>
                  <td style={{ textAlign: 'right', padding: '0.45rem 0.4rem', fontWeight: 800, color: '#2563eb' }}>
                    {formatCurrency(filteredStats.totalGPay)}
                  </td>
                  <td style={{ textAlign: 'right', padding: '0.45rem 0.55rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {formatCurrency(filteredStats.totalBill)}
                  </td>
                  {isOrderDiscountEnabled && (
                    <td style={{ textAlign: 'right', padding: '0.45rem 0.4rem', fontWeight: 800, color: '#d97706' }}>
                      {formatCurrency(filteredStats.totalDiscount)}
                    </td>
                  )}
                  <td style={{ textAlign: 'right', padding: '0.45rem 0.55rem', fontWeight: 800, color: filteredStats.totalDue > 0 ? '#dc2626' : '#16a34a' }}>
                    {formatCurrency(filteredStats.totalDue)}
                  </td>
                  <td style={{ padding: '0.45rem 0.4rem' }}></td>
                  <td style={{ padding: '0.45rem 0.25rem' }}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Downside Product & Dynamic Collection Summary Bar (Active on route filter or when toggled) */}
        {shouldShowDownside && (
          <div
            style={{
              padding: '0.6rem 1rem',
              background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
              borderTop: '2px solid var(--border)',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.45rem',
              flexShrink: 0,
            }}
          >
            {/* Top row: Route Badge + Quick stats */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span
                  style={{
                    background: routeFilter !== 'ALL' ? '#dbeafe' : '#e2e8f0',
                    color: routeFilter !== 'ALL' ? '#1e40af' : '#334155',
                    border: routeFilter !== 'ALL' ? '1px solid #93c5fd' : '1px solid #cbd5e1',
                    borderRadius: '6px',
                    padding: '0.2rem 0.55rem',
                    fontSize: '0.78rem',
                    fontWeight: 800,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                  }}
                >
                  <MapPin size={13} color={routeFilter !== 'ALL' ? '#2563eb' : '#64748b'} />
                  {selectedRouteObj ? `${selectedRouteObj.name} Route` : routeFilter !== 'ALL' ? 'Selected Route' : 'All Routes Summary'}
                </span>

                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                  <strong>{filteredStats.validShopsCount}</strong> of <strong>{visibleRows.length}</strong> shops with orders
                </span>

                {routeFilter !== 'ALL' && (
                  <span
                    style={{
                      background: '#ecfdf5',
                      color: '#047857',
                      border: '1px solid #a7f3d0',
                      borderRadius: '4px',
                      padding: '0.1rem 0.4rem',
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    Route Filter Active
                  </span>
                )}
              </div>

              {/* Total Pieces Badge */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span
                  style={{
                    background: '#e0e7ff',
                    color: '#3730a3',
                    border: '1px solid #c7d2fe',
                    borderRadius: '6px',
                    padding: '0.2rem 0.55rem',
                    fontSize: '0.78rem',
                    fontWeight: 800,
                  }}
                >
                  Total Dispatch: {filteredStats.totalPieces} ps
                </span>
                {routeFilter === 'ALL' && !isFilterActive && (
                  <button
                    type="button"
                    onClick={() => setShowDownsideSummary(false)}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '0.1rem' }}
                    title="Hide summary"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>
            </div>

            {/* Bottom row: Product list breakdown + Dynamic Collection breakdown */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '0.6rem',
                alignItems: 'stretch',
              }}
            >
              {/* Product Quantities List */}
              <div
                style={{
                  background: 'var(--bg-card)',
                  borderRadius: '6px',
                  border: '1px solid var(--border)',
                  padding: '0.45rem 0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  flexWrap: 'wrap',
                }}
              >
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em', marginRight: '0.25rem' }}>
                  Total Products:
                </span>

                {products.length > 0 ? (
                  products.map((p, idx) => {
                    const colors = [
                      { bg: '#fef3c7', text: '#b45309', border: '#fde68a' },
                      { bg: '#fee2e2', text: '#dc2626', border: '#fecaca' },
                      { bg: '#f5f3ff', text: '#7c3aed', border: '#ddd6fe' },
                      { bg: '#ecfdf5', text: '#059669', border: '#a7f3d0' },
                      { bg: '#ffedd5', text: '#ea580c', border: '#fed7aa' },
                    ];
                    const c = colors[idx % colors.length];
                    const qty =
                      filteredStats.productTotals[p.id] ||
                      (kubbusProduct && p.id === kubbusProduct.id
                        ? filteredStats.totalKubbus
                        : romaliProduct && p.id === romaliProduct.id
                        ? filteredStats.totalRomali
                        : 0);

                    return (
                      <span
                        key={p.id}
                        style={{
                          background: c.bg,
                          color: c.text,
                          border: `1px solid ${c.border}`,
                          borderRadius: '5px',
                          padding: '0.2rem 0.5rem',
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                        }}
                      >
                        <span>{p.name}:</span>
                        <strong style={{ fontSize: '0.82rem' }}>{qty}</strong>
                        <span style={{ fontSize: '0.65rem', opacity: 0.85 }}>ps</span>
                      </span>
                    );
                  })
                ) : (
                  <>
                    <span
                      style={{
                        background: '#fef3c7',
                        color: '#b45309',
                        border: '1px solid #fde68a',
                        borderRadius: '5px',
                        padding: '0.2rem 0.5rem',
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                      }}
                    >
                      <span>Kubbus:</span>
                      <strong style={{ fontSize: '0.82rem' }}>{filteredStats.totalKubbus}</strong>
                      <span style={{ fontSize: '0.65rem', opacity: 0.85 }}>ps</span>
                    </span>
                    <span
                      style={{
                        background: '#fee2e2',
                        color: '#dc2626',
                        border: '1px solid #fecaca',
                        borderRadius: '5px',
                        padding: '0.2rem 0.5rem',
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                      }}
                    >
                      <span>Romali:</span>
                      <strong style={{ fontSize: '0.82rem' }}>{filteredStats.totalRomali}</strong>
                      <span style={{ fontSize: '0.65rem', opacity: 0.85 }}>ps</span>
                    </span>
                  </>
                )}
              </div>

              {/* Dynamic Collections Breakdown */}
              <div
                style={{
                  background: 'var(--bg-card)',
                  borderRadius: '6px',
                  border: '1px solid var(--border)',
                  padding: '0.45rem 0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  flexWrap: 'wrap',
                }}
              >
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em', marginRight: '0.25rem' }}>
                  Collections:
                </span>

                {/* Prev. Due */}
                {filteredStats.totalPrevDue > 0 && (
                  <span
                    style={{
                      background: '#fff1f2',
                      color: '#dc2626',
                      border: '1px solid #fecdd3',
                      borderRadius: '5px',
                      padding: '0.2rem 0.5rem',
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                    }}
                    title="Total Opening / Previous Due across visible shops"
                  >
                    <span>📋 Prev. Due:</span>
                    <strong style={{ fontSize: '0.82rem' }}>{formatCurrency(filteredStats.totalPrevDue)}</strong>
                  </span>
                )}

                {/* Cash */}
                <span
                  style={{
                    background: '#f0fdf4',
                    color: '#16a34a',
                    border: '1px solid #bbf7d0',
                    borderRadius: '5px',
                    padding: '0.2rem 0.5rem',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                  }}
                >
                  <span>💵 Cash:</span>
                  <strong style={{ fontSize: '0.82rem' }}>{formatCurrency(filteredStats.totalCash)}</strong>
                </span>

                {/* GPay */}
                <span
                  style={{
                    background: '#eff6ff',
                    color: '#2563eb',
                    border: '1px solid #bfdbfe',
                    borderRadius: '5px',
                    padding: '0.2rem 0.5rem',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                  }}
                >
                  <span>📱 GPay:</span>
                  <strong style={{ fontSize: '0.82rem' }}>{formatCurrency(filteredStats.totalGPay)}</strong>
                </span>

                {/* Discount */}
                {isOrderDiscountEnabled && filteredStats.totalDiscount > 0 && (
                  <span
                    style={{
                      background: '#fef3c7',
                      color: '#b45309',
                      border: '1px solid #fde68a',
                      borderRadius: '5px',
                      padding: '0.2rem 0.5rem',
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                    }}
                    title="Total Discount / Deductions"
                  >
                    <span>🏷️ Disc:</span>
                    <strong style={{ fontSize: '0.82rem' }}>{formatCurrency(filteredStats.totalDiscount)}</strong>
                  </span>
                )}

                {/* Total Collection */}
                <span
                  style={{
                    background: '#ecfdf5',
                    color: '#065f46',
                    border: '1.5px solid #10b981',
                    borderRadius: '5px',
                    padding: '0.2rem 0.55rem',
                    fontSize: '0.74rem',
                    fontWeight: 800,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                  }}
                  title="Total Cash + GPay Collected"
                >
                  <span>Total Collected:</span>
                  <strong style={{ fontSize: '0.84rem' }}>{formatCurrency(filteredStats.totalCash + filteredStats.totalGPay)}</strong>
                </span>

                {/* Total Billed */}
                <span
                  style={{
                    background: '#f8fafc',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border)',
                    borderRadius: '5px',
                    padding: '0.2rem 0.5rem',
                    fontSize: '0.74rem',
                    fontWeight: 600,
                  }}
                >
                  Bill: <strong>{formatCurrency(filteredStats.totalBill)}</strong>
                </span>

                {/* Due Balance */}
                {filteredStats.totalDue > 0 && (
                  <span
                    style={{
                      background: '#fff1f2',
                      color: '#e11d48',
                      border: '1px solid #fecdd3',
                      borderRadius: '5px',
                      padding: '0.2rem 0.5rem',
                      fontSize: '0.74rem',
                      fontWeight: 700,
                    }}
                  >
                    Due: <strong>{formatCurrency(filteredStats.totalDue)}</strong>
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Bottom Controls Bar (Permanently docked inside table container) */}
        <div
          style={{
            padding: '0.22rem 0.65rem',
            background: 'var(--bg-card)',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
            gap: '0.5rem',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleAddCustomRow}
              style={{ height: '26px', padding: '0 0.55rem', fontSize: '0.72rem', borderRadius: '6px', fontWeight: 700 }}
            >
              <Plus size={12} />
              <span>+ Add Row</span>
            </button>

            <button
              type="button"
              onClick={() => setIsAutoEntryModalOpen(true)}
              style={{
                height: '26px',
                padding: '0 0.6rem',
                fontSize: '0.72rem',
                fontWeight: 700,
                background: '#059669',
                color: '#ffffff',
                border: '1px solid #047857',
                borderRadius: '6px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
                cursor: 'pointer',
              }}
              title="Auto-fill previous orders or bulk preset quantities"
            >
              <Zap size={11} color="#ffffff" />
              <span>Auto Entry</span>
            </button>

            {routeFilter === 'ALL' && !isFilterActive && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setShowDownsideSummary((prev) => !prev)}
                style={{
                  height: '26px',
                  padding: '0 0.5rem',
                  fontSize: '0.72rem',
                  borderRadius: '6px',
                  color: shouldShowDownside ? '#059669' : 'var(--text-secondary)',
                  borderColor: shouldShowDownside ? '#059669' : undefined,
                  background: shouldShowDownside ? '#ecfdf5' : undefined,
                }}
                title="Toggle bottom product totals and collections summary"
              >
                <BarChart2 size={11} />
                <span>{shouldShowDownside ? 'Hide Summary' : 'Bottom Summary'}</span>
              </button>
            )}

            {removedCount > 0 && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleRestoreAllShops}
                style={{ height: '26px', padding: '0 0.5rem', fontSize: '0.72rem', borderRadius: '6px', color: '#059669', borderColor: '#a7f3d0' }}
                title="Restore all removed shops back to the spreadsheet"
              >
                <RefreshCw size={11} />
                <span>Restore ({removedCount})</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleResetInputs}
              style={{
                height: '26px',
                padding: '0 0.5rem',
                fontSize: '0.72rem',
                fontWeight: 600,
                color: '#dc2626',
                background: '#fee2e2',
                border: '1px solid #fecaca',
                borderRadius: '6px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
                cursor: 'pointer',
              }}
              title="Reset all entered numbers"
            >
              <RotateCcw size={11} />
              <span>Clear Quantities</span>
            </button>

            <button
              type="button"
              onClick={handleSubmitAllOrders}
              disabled={isSubmittingAll || pendingOrdersCount === 0}
              style={{
                height: '26px',
                padding: '0 0.65rem',
                fontSize: '0.72rem',
                fontWeight: 700,
                color: '#ffffff',
                background: pendingOrdersCount > 0 ? '#dc2626' : '#94a3b8',
                border: 'none',
                borderRadius: '6px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                cursor: pendingOrdersCount > 0 ? 'pointer' : 'not-allowed',
                opacity: pendingOrdersCount > 0 ? 1 : 0.6,
                boxShadow: pendingOrdersCount > 0 ? '0 1px 3px rgba(220, 38, 38, 0.3)' : 'none',
              }}
              title={pendingOrdersCount > 0 ? 'Save / Re-submit all pending changes to database' : 'All orders saved'}
            >
              {resubmitOrdersCount > 0 ? <RefreshCw size={11} /> : <Save size={11} />}
              <span>
                {isSubmittingAll
                  ? `Submitting (${submitProgress?.current}/${submitProgress?.total})...`
                  : pendingOrdersCount > 0
                  ? resubmitOrdersCount > 0
                    ? `Re-submit Orders (${pendingOrdersCount})`
                    : `Submit Orders (${pendingOrdersCount})`
                  : 'All Orders Saved'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setIsBulkWhatsAppModalOpen(true)}
              disabled={bulkBillItems.length === 0}
              style={{
                height: '26px',
                padding: '0 0.65rem',
                fontSize: '0.72rem',
                fontWeight: 700,
                color: '#ffffff',
                background: bulkBillItems.length > 0 ? '#16a34a' : '#94a3b8',
                border: 'none',
                borderRadius: '6px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                cursor: bulkBillItems.length > 0 ? 'pointer' : 'not-allowed',
                opacity: bulkBillItems.length > 0 ? 1 : 0.6,
                boxShadow: bulkBillItems.length > 0 ? '0 1px 3px rgba(22, 163, 74, 0.3)' : 'none',
              }}
              title="Send WhatsApp Bill (PDF or Image) to all customers"
            >
              <MessageCircle size={11} />
              <span>Send All WhatsApp Bills ({bulkBillItems.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setIsPendingReminderModalOpen(true)}
              disabled={pendingCustomers.length === 0}
              style={{
                height: '26px',
                padding: '0 0.65rem',
                fontSize: '0.72rem',
                fontWeight: 700,
                color: '#ffffff',
                background: pendingCustomers.length > 0 ? '#d97706' : '#94a3b8',
                border: 'none',
                borderRadius: '6px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                cursor: pendingCustomers.length > 0 ? 'pointer' : 'not-allowed',
                opacity: pendingCustomers.length > 0 ? 1 : 0.6,
                boxShadow: pendingCustomers.length > 0 ? '0 1px 3px rgba(217, 119, 6, 0.3)' : 'none',
              }}
              title="Send WhatsApp Order Reminder / Enquiry to customers with no orders entered for today"
            >
              <BellRing size={11} />
              <span>Ask Pending Orders ({pendingCustomers.length})</span>
            </button>
          </div>

          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span>
              <kbd style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '0.1rem 0.35rem', borderRadius: '4px', fontWeight: 700 }}>
                Enter
              </kbd>{' '}
              {products.length > 0 ? products.map((p) => p.name).join(' → ') : 'Kubbus → Romali'} → Next Shop
            </span>
            <span>
              <kbd style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '0.1rem 0.35rem', borderRadius: '4px', fontWeight: 700 }}>
                Tab
              </kbd>{' '}
              Move right
            </span>
            <span>
              <kbd style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '0.1rem 0.35rem', borderRadius: '4px', fontWeight: 700 }}>
                &uarr; &darr;
              </kbd>{' '}
              Move between shops
            </span>
          </div>
        </div>
      </div>
      </div>

      {/* 4.5 Auto Data Entry & Bulk Assistant Modal */}
      {isAutoEntryModalOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(15, 23, 42, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
        >
          <div
            className="card"
            style={{
              padding: '1.25rem 1.5rem',
              width: '100%',
              maxWidth: '540px',
              boxShadow: 'var(--shadow-md)',
              borderRadius: '8px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                <div
                  style={{
                    background: '#fef3c7',
                    color: '#d97706',
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Zap size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.18rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                    ⚡ Auto Data Entry Assistant
                  </h3>
                  <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                    Instantly fill wholesale quantities across {visibleRows.length} shops
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="btn-icon"
                onClick={() => setIsAutoEntryModalOpen(false)}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Option 1: Smart History Repeat */}
            <div
              style={{
                background: '#f0fdf4',
                border: '1.5px solid #86efac',
                borderRadius: '10px',
                padding: '1rem',
                marginBottom: '1rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '1rem',
              }}
            >
              <div>
                <div style={{ fontWeight: 800, fontSize: '0.92rem', color: '#15803d', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Copy size={15} />
                  <span>Auto-Repeat Previous Day's Orders</span>
                </div>
                <div style={{ fontSize: '0.78rem', color: '#166534', marginTop: '0.2rem', lineHeight: 1.3 }}>
                  Copies the most recent order quantities for each matching shop directly into today's sheet.
                </div>
              </div>
              <button
                type="button"
                className="btn btn-sm"
                onClick={handleAutoFillPreviousOrders}
                disabled={isAutoLoading}
                style={{
                  background: '#16a34a',
                  borderColor: '#16a34a',
                  color: '#ffffff',
                  fontWeight: 800,
                  whiteSpace: 'nowrap',
                  padding: '0.45rem 0.85rem',
                  height: 'auto',
                }}
              >
                {isAutoLoading ? 'Loading...' : '⚡ Auto Fill'}
              </button>
            </div>

            {/* Option 2: Quick Bulk Fill Custom Values */}
            <div
              style={{
                background: 'var(--bg-main)',
                border: '1px solid var(--border)',
                borderRadius: '10px',
                padding: '1rem',
                marginBottom: '1rem',
              }}
            >
              <div style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--text-primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Sparkles size={15} color="var(--primary)" />
                <span>Bulk Set Preset Quantities</span>
              </div>
              
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: products.length > 2 ? 'repeat(auto-fit, minmax(130px, 1fr))' : '1fr 1fr',
                  gap: '0.75rem',
                  marginBottom: '0.75rem',
                }}
              >
                {products.length > 0 ? (
                  products.map((p) => (
                    <div key={p.id}>
                      <label style={{ fontSize: '0.78rem', fontWeight: 700, display: 'block', marginBottom: '0.25rem' }}>
                        {p.name} (pkts)
                      </label>
                      <input
                        type="number"
                        min="0"
                        className="form-input"
                        value={autoProductQtys[p.id] ?? ''}
                        onChange={(e) => setAutoProductQtys((prev) => ({ ...prev, [p.id]: e.target.value }))}
                        placeholder="e.g. 10"
                        style={{ fontWeight: 700 }}
                      />
                    </div>
                  ))
                ) : (
                  <>
                    <div>
                      <label style={{ fontSize: '0.78rem', fontWeight: 700, display: 'block', marginBottom: '0.25rem' }}>
                        Kubbus Qty (pkts)
                      </label>
                      <input
                        type="number"
                        min="0"
                        className="form-input"
                        value={autoKubbusQty}
                        onChange={(e) => setAutoKubbusQty(e.target.value)}
                        placeholder="e.g. 10"
                        style={{ fontWeight: 700 }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.78rem', fontWeight: 700, display: 'block', marginBottom: '0.25rem' }}>
                        Romali Qty (pkts)
                      </label>
                      <input
                        type="number"
                        min="0"
                        className="form-input"
                        value={autoRomaliQty}
                        onChange={(e) => setAutoRomaliQty(e.target.value)}
                        placeholder="e.g. 5"
                        style={{ fontWeight: 700 }}
                      />
                    </div>
                  </>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.78rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '3px', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="autoTarget"
                      checked={autoTargetMode === 'visible'}
                      onChange={() => setAutoTargetMode('visible')}
                    />
                    <span>Visible ({visibleRows.length})</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '3px', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="autoTarget"
                      checked={autoTargetMode === 'empty'}
                      onChange={() => setAutoTargetMode('empty')}
                    />
                    <span>Empty Only</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '3px', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="autoTarget"
                      checked={autoTargetMode === 'all'}
                      onChange={() => setAutoTargetMode('all')}
                    />
                    <span>All Shops ({rows.length})</span>
                  </label>
                </div>

                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={handleQuickBulkApply}
                  style={{ fontWeight: 800, padding: '0.35rem 0.85rem' }}
                >
                  Apply Preset
                </button>
              </div>
            </div>

            {/* Option 3: Sandbox / Demo Mode */}
            <div
              style={{
                background: '#f8fafc',
                border: '1px dashed #cbd5e1',
                borderRadius: '10px',
                padding: '0.85rem 1rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.75rem',
              }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  🎲 Sandbox Demo Simulation
                </div>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                  Generates realistic varied quantities across shops for instant testing.
                </div>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleAutoFillSandboxRandom}
                style={{ fontSize: '0.76rem', fontWeight: 700, padding: '0.3rem 0.65rem' }}
              >
                Simulate Demo
              </button>
            </div>

            <div style={{ marginTop: '1.25rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setIsAutoEntryModalOpen(false)}
                style={{ padding: '0.45rem 1rem' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. New Shop Modal */}
      {isNewCustModalOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
        >
          <div
            className="card"
            style={{
              padding: '1.5rem',
              width: '100%',
              maxWidth: '560px',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Store size={20} color="var(--primary)" />
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                  Register New Shop
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsNewCustModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={18} />
              </button>
            </div>

            {newCustError && (
              <div className="alert alert-error" style={{ marginBottom: '0.75rem', fontSize: '0.82rem', padding: '0.4rem 0.65rem' }}>
                {newCustError}
              </div>
            )}

            <form onSubmit={handleCreateCustomer}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem', marginBottom: '0.65rem' }}>
                <div>
                  <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: '0.2rem' }}>Shop Name *</label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    placeholder="e.g. Al-Madina Bakery"
                    value={newCustName}
                    onChange={(e) => setNewCustName(e.target.value)}
                    style={{ height: '34px', padding: '0.25rem 0.5rem' }}
                  />
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: '0.2rem' }}>Proprietor / Contact</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Rasheed"
                    value={newCustOwner}
                    onChange={(e) => setNewCustOwner(e.target.value)}
                    style={{ height: '34px', padding: '0.25rem 0.5rem' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem', marginBottom: '0.65rem' }}>
                <div>
                  <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: '0.2rem' }}>Phone Number *</label>
                  <input
                    type="tel"
                    required
                    className="form-input"
                    placeholder="e.g. 9876543210"
                    value={newCustPhone}
                    onChange={(e) => setNewCustPhone(e.target.value)}
                    style={{ height: '34px', padding: '0.25rem 0.5rem' }}
                  />
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: '0.2rem' }}>Assigned Route *</label>
                  {routes.length === 0 ? (
                    <div style={{ display: 'flex', gap: '0.35rem' }}>
                      <input
                        type="text"
                        placeholder="Route name (e.g. Town)"
                        className="form-input"
                        value={quickRouteName}
                        onChange={(e) => setQuickRouteName(e.target.value)}
                        style={{ height: '34px', fontSize: '0.82rem', flex: 1 }}
                      />
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={handleQuickCreateRoute}
                        disabled={!quickRouteName.trim() || isCreatingRoute}
                        style={{ height: '34px', whiteSpace: 'nowrap' }}
                      >
                        {isCreatingRoute ? 'Adding...' : '+ Route'}
                      </button>
                    </div>
                  ) : (
                    <select
                      required
                      className="form-select"
                      value={newCustRoute}
                      onChange={(e) => setNewCustRoute(e.target.value)}
                      style={{ height: '34px', padding: '0.25rem 0.5rem' }}
                    >
                      <option value="">Select Route</option>
                      {routes.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              <div style={{ marginBottom: '0.65rem' }}>
                <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: '0.2rem' }}>Shop Address / Location *</label>
                <input
                  type="text"
                  required
                  className="form-input"
                  placeholder="e.g. Near Bus Stand, Main Road"
                  value={newCustAddress}
                  onChange={(e) => setNewCustAddress(e.target.value)}
                  style={{ height: '34px', padding: '0.25rem 0.5rem' }}
                />
              </div>

              {/* Stop Sequence, Custom Order Number & Opening Prev. Due */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.65rem', marginBottom: '0.75rem' }}>
                <div>
                  <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: '0.2rem' }}>
                    Route Stop / List Order
                  </label>
                  <input
                    type="number"
                    min="1"
                    className="form-input"
                    placeholder={`e.g. ${rows.length + 1}`}
                    value={newCustListOrder}
                    onChange={(e) => setNewCustListOrder(e.target.value)}
                    style={{ height: '34px', padding: '0.25rem 0.5rem' }}
                    title="Sequence number in delivery route / order sheet"
                  />
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: '0.2rem' }}>
                    Today's Order # (Optional)
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. ORD-1001"
                    value={newCustOrderNumber}
                    onChange={(e) => setNewCustOrderNumber(e.target.value)}
                    style={{ height: '34px', padding: '0.25rem 0.5rem' }}
                    title="Specify a custom order number for today, or leave blank to auto-generate"
                  />
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: '0.2rem' }}>
                    Prev. Due / Opening (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="form-input"
                    placeholder="0.00"
                    value={newCustOpeningBalance}
                    onChange={(e) => setNewCustOpeningBalance(e.target.value)}
                    style={{ height: '34px', padding: '0.25rem 0.5rem', fontWeight: 600 }}
                    title="Initial previous due / opening balance for this customer"
                  />
                </div>
              </div>

              {/* Dynamic Products: Wholesale Rates & Today's Order Quantities Set Simultaneously */}
              <div
                style={{
                  background: 'var(--bg-main)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '0.75rem',
                  marginBottom: '1rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase' }}>
                    Shop Products & Initial Order
                  </span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    Wholesale Price & Today's Qty
                  </span>
                </div>

                {products.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '220px', overflowY: 'auto' }}>
                    {products.map((prod) => (
                      <div
                        key={prod.id}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1.2fr 1fr 1fr',
                          gap: '0.5rem',
                          alignItems: 'center',
                          background: 'var(--bg-card)',
                          padding: '0.4rem 0.6rem',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--border-light, #e2e8f0)',
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--text-primary)', lineHeight: 1.2 }}>
                            {prod.name}
                          </div>
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                            Standard: ₹{parseFloat(prod.unit_price).toFixed(2)}
                          </div>
                        </div>
                        <div>
                          <label style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.1rem' }}>
                            Rate (₹)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            className="form-input"
                            value={newCustProductPrices[prod.id] ?? prod.unit_price}
                            onChange={(e) =>
                              setNewCustProductPrices((prev) => ({ ...prev, [prod.id]: e.target.value }))
                            }
                            style={{ height: '30px', padding: '0.15rem 0.35rem', fontSize: '0.82rem', textAlign: 'right' }}
                            placeholder="Price"
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.1rem' }}>
                            Today's Qty
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            className="form-input"
                            value={newCustProductQuantities[prod.id] ?? ''}
                            onChange={(e) =>
                              setNewCustProductQuantities((prev) => ({ ...prev, [prod.id]: e.target.value }))
                            }
                            style={{ height: '30px', padding: '0.15rem 0.35rem', fontSize: '0.82rem', textAlign: 'right', fontWeight: 700 }}
                            placeholder="0"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
                    <div>
                      <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.15rem' }}>
                        Kubbus Rate (₹/ps)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        className="form-input"
                        value={newCustKubbusPrice}
                        onChange={(e) => setNewCustKubbusPrice(e.target.value)}
                        style={{ height: '32px', padding: '0.2rem 0.45rem' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.15rem' }}>
                        Romali Rate (₹/ps)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        className="form-input"
                        value={newCustRomaliPrice}
                        onChange={(e) => setNewCustRomaliPrice(e.target.value)}
                        style={{ height: '32px', padding: '0.2rem 0.45rem' }}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setIsNewCustModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={newCustSubmitting}
                >
                  {newCustSubmitting ? 'Saving...' : 'Add to Spreadsheet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Day Open Modal */}
      {isOpenDayModalOpen && (
        <div className="modal-overlay" style={{ zIndex: 9999 }}>
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: '#dc2626', marginBottom: '0.5rem' }}>
              <Sunrise size={24} />
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>
                Open Business Day ({orderDate})
              </h3>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
              Formally open today's business day and record the register cash float before entering wholesale orders.
            </p>

            {dayOpenError && (
              <div className="alert alert-error" style={{ marginBottom: '1rem', padding: '0.5rem 0.75rem', fontSize: '0.82rem' }}>
                <AlertCircle size={16} />
                <span>{dayOpenError}</span>
              </div>
            )}

            <form onSubmit={handleOpenDay}>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label" style={{ fontWeight: 700 }}>
                  Opening Cash Float in Register (₹) <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', fontWeight: 800, color: 'var(--text-muted)' }}>₹</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    className="form-input"
                    style={{ paddingLeft: '1.75rem', fontSize: '1.15rem', fontWeight: 800 }}
                    placeholder="500.00"
                    value={openingCashInput}
                    onChange={(e) => setOpeningCashInput(e.target.value)}
                    autoFocus
                  />
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'block' }}>
                  Petty cash available for change/counter expenses at start of day.
                </span>
              </div>

              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label className="form-label">Opening Notes / Shift Remarks (Optional)</label>
                <textarea
                  className="form-textarea"
                  rows={2}
                  placeholder="e.g. Morning float verified by Manager, counter cash ready"
                  value={openingNotesInput}
                  onChange={(e) => setOpeningNotesInput(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsOpenDayModalOpen(false)}
                  disabled={submittingDayOpen}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submittingDayOpen || !openingCashInput}
                  style={{ background: '#dc2626', borderColor: '#dc2626', fontWeight: 800 }}
                >
                  <Sun size={16} />
                  <span>{submittingDayOpen ? 'Opening Day...' : 'Confirm & Open Day'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Customer Self-Order Edit Confirmation Popup Modal */}
      {selfOrderModalRow && (
        <div className="modal-overlay" style={{ zIndex: 10000 }}>
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '50%',
                    background: '#fef3c7',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#d97706',
                    flexShrink: 0,
                  }}
                >
                  <AlertTriangle size={22} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.18rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                    Edit Customer Self-Order?
                  </h3>
                  <span style={{ fontSize: '0.76rem', color: '#059669', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                    <Smartphone size={12} /> Placed Online by Customer
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="btn-icon"
                onClick={() => {
                  setSelfOrderModalRow(null);
                  setSelfOrderPendingField(null);
                }}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={18} />
              </button>
            </div>

            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '0.85rem 1rem',
                marginBottom: '1rem',
                fontSize: '0.85rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Customer / Shop:</span>
                <span style={{ fontWeight: 700 }}>{selfOrderModalRow.customerName}</span>
              </div>
              {selfOrderModalRow.orderNumber && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Order ID:</span>
                  <span style={{ fontWeight: 700, color: '#059669' }}>#{selfOrderModalRow.orderNumber}</span>
                </div>
              )}
              {(selfOrderModalRow.submittedAt || selfOrderModalRow.createdAt) && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Order Placed At:</span>
                  <span style={{ fontWeight: 600, color: '#0369a1' }}>
                    🕒 {formatOrderDateTime(selfOrderModalRow.submittedAt || selfOrderModalRow.createdAt)}
                  </span>
                </div>
              )}
              {products.length > 0 ? (
                products.map((p) => {
                  const qty =
                    selfOrderModalRow.productQuantities?.[p.id] !== undefined
                      ? selfOrderModalRow.productQuantities[p.id]
                      : kubbusProduct && p.id === kubbusProduct.id
                      ? selfOrderModalRow.kubbusQty
                      : romaliProduct && p.id === romaliProduct.id
                      ? selfOrderModalRow.romaliQty
                      : '0';
                  if (!qty || qty === '0') return null;
                  return (
                    <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>{p.name} Ordered:</span>
                      <span style={{ fontWeight: 800, color: 'var(--primary)' }}>
                        {qty} pkts
                      </span>
                    </div>
                  );
                })
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Kubbus Ordered:</span>
                    <span style={{ fontWeight: 800, color: '#f59e0b' }}>
                      {selfOrderModalRow.kubbusQty ? `${selfOrderModalRow.kubbusQty} pkts` : '0 pkts'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Romali Ordered:</span>
                    <span style={{ fontWeight: 800, color: '#f97316' }}>
                      {selfOrderModalRow.romaliQty ? `${selfOrderModalRow.romaliQty} pkts` : '0 pkts'}
                    </span>
                  </div>
                </>
              )}
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.45, marginBottom: '1.25rem' }}>
              This order was submitted directly online by the customer. Changing these quantities will overwrite what the client requested.
              <br /><br />
              Do you want to unlock this row for manual editing?
            </p>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setSelfOrderModalRow(null);
                  setSelfOrderPendingField(null);
                }}
              >
                Cancel (Keep Original)
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  if (!selfOrderModalRow) return;
                  const rowId = selfOrderModalRow.rowId;
                  const pendingField = selfOrderPendingField || 'kubbus';

                  // Mark row as unlocked
                  setUnlockedSelfOrderIds((prev) => new Set(prev).add(rowId));

                  // Set row status to IDLE so changes can be saved
                  setRows((prev) =>
                    prev.map((r) => (r.rowId === rowId ? { ...r, status: 'IDLE' } : r))
                  );

                  setSuccessBanner(`Self-Order for "${selfOrderModalRow.customerName}" is unlocked for editing. Make your changes and click "Save Wholesale Orders" when done.`);
                  setTimeout(() => setSuccessBanner(null), 6000);

                  const targetIndex = visibleRows.findIndex((r) => r.rowId === rowId);
                  setSelfOrderModalRow(null);
                  setSelfOrderPendingField(null);

                  if (targetIndex >= 0) {
                    setTimeout(() => focusCell(targetIndex, pendingField), 120);
                  }
                }}
                style={{
                  background: '#059669',
                  borderColor: '#059669',
                  color: '#ffffff',
                  fontWeight: 800,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                }}
              >
                <Edit size={15} />
                <span>Unlock & Edit Order</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5.5 Edit Customer Details Modal */}
      {isEditCustomerModalOpen && editingCustomer && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !editCustSubmitting) {
              setIsEditCustomerModalOpen(false);
            }
          }}
        >
          <div
            className="card"
            style={{
              padding: '1.5rem',
              width: '100%',
              maxWidth: '560px',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Store size={20} color="var(--primary)" />
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                  Edit Customer Details
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsEditCustomerModalOpen(false)}
                disabled={editCustSubmitting}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={18} />
              </button>
            </div>

            {editCustError && (
              <div className="alert alert-error" style={{ marginBottom: '0.75rem', fontSize: '0.82rem', padding: '0.4rem 0.65rem' }}>
                {editCustError}
              </div>
            )}

            <form onSubmit={handleSaveCustomerEdit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem', marginBottom: '0.65rem' }}>
                <div>
                  <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: '0.2rem' }}>Shop Name *</label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    value={editCustName}
                    onChange={(e) => setEditCustName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: '0.2rem' }}>Owner / Contact Person</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editCustOwner}
                    onChange={(e) => setEditCustOwner(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem', marginBottom: '0.65rem' }}>
                <div>
                  <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: '0.2rem' }}>Phone Number *</label>
                  <input
                    type="tel"
                    required
                    className="form-input"
                    value={editCustPhone}
                    onChange={(e) => setEditCustPhone(e.target.value)}
                  />
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: '0.2rem' }}>Alternative Phone</label>
                  <input
                    type="tel"
                    className="form-input"
                    value={editCustAltPhone}
                    onChange={(e) => setEditCustAltPhone(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem', marginBottom: '0.65rem' }}>
                <div>
                  <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: '0.2rem' }}>Route Assignment</label>
                  <select
                    className="form-select"
                    value={editCustRoute}
                    onChange={(e) => setEditCustRoute(e.target.value)}
                  >
                    <option value="">-- Select Route --</option>
                    {routes.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} ({r.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: '0.2rem' }}>Credit Limit (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="form-input"
                    value={editCustCreditLimit}
                    onChange={(e) => setEditCustCreditLimit(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '0.65rem' }}>
                <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: '0.2rem' }}>Address</label>
                <input
                  type="text"
                  className="form-input"
                  value={editCustAddress}
                  onChange={(e) => setEditCustAddress(e.target.value)}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem', marginBottom: '0.65rem' }}>
                <div>
                  <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: '0.2rem' }}>Landmark</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editCustLandmark}
                    onChange={(e) => setEditCustLandmark(e.target.value)}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', marginTop: '1.4rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.84rem' }}>
                    <input
                      type="checkbox"
                      checked={editCustIsActive}
                      onChange={(e) => setEditCustIsActive(e.target.checked)}
                    />
                    <span>Active Customer</span>
                  </label>
                </div>
              </div>

              {/* Customer-Specific Wholesale Rates (₹) */}
              <div style={{ marginBottom: '0.85rem', padding: '0.65rem 0.75rem', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    Customer-Specific Wholesale Rates
                  </span>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                    Custom rate for this shop (overrides default product price)
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: products.length > 2 ? 'repeat(auto-fit, minmax(130px, 1fr))' : '1fr 1fr', gap: '0.65rem' }}>
                  {products.map((p) => {
                    const stdPrice = parseFloat(p.unit_price || '0').toFixed(2);
                    const currVal = editCustProductPrices[p.id] ?? stdPrice;
                    const isCustomRate = currVal !== '' && parseFloat(currVal) !== parseFloat(stdPrice);
                    return (
                      <div
                        key={p.id}
                        style={{
                          background: '#ffffff',
                          padding: '0.4rem 0.6rem',
                          borderRadius: '5px',
                          border: isCustomRate ? '1.5px solid #6366f1' : '1px solid #cbd5e1',
                        }}
                      >
                        <div style={{ fontWeight: 700, fontSize: '0.78rem', color: 'var(--text-primary)', lineHeight: 1.2 }}>
                          {p.name}
                        </div>
                        <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
                          Standard: ₹{stdPrice}
                        </div>
                        <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.1rem' }}>
                          Rate (₹/ps)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          className="form-input"
                          value={currVal}
                          onChange={(e) =>
                            setEditCustProductPrices((prev) => ({ ...prev, [p.id]: e.target.value }))
                          }
                          style={{
                            height: '28px',
                            padding: '0.15rem 0.35rem',
                            fontSize: '0.82rem',
                            textAlign: 'right',
                            fontWeight: 700,
                            borderColor: isCustomRate ? '#6366f1' : undefined,
                            backgroundColor: isCustomRate ? '#eef2ff' : undefined,
                          }}
                          placeholder={stdPrice}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: '0.2rem' }}>Notes</label>
                <textarea
                  className="form-input"
                  rows={2}
                  value={editCustNotes}
                  onChange={(e) => setEditCustNotes(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={editCustSubmitting}
                  onClick={() => setIsEditCustomerModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={editCustSubmitting}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  {editCustSubmitting ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                  <span>{editCustSubmitting ? 'Saving...' : 'Save Changes'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Previous Due Popup Modal */}
      {isPrevDueModalOpen && prevDueRow && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
            padding: '1rem',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsPrevDueModalOpen(false);
            }
          }}
        >
          <div
            className="card"
            style={{
              padding: '1.4rem',
              width: '100%',
              maxWidth: '460px',
              boxShadow: 'var(--shadow-lg)',
              borderRadius: 'var(--radius-lg, 10px)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CreditCard size={20} color="var(--primary)" />
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                    Edit Previous Due
                  </h3>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                    {prevDueRow.customerName} {prevDueRow.customerRoute ? `• ${prevDueRow.customerRoute}` : ''}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPrevDueModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '0.2rem' }}
              >
                <X size={18} />
              </button>
            </div>

            {prevDueError && (
              <div className="alert alert-error" style={{ marginBottom: '0.8rem', fontSize: '0.8rem', padding: '0.4rem 0.65rem' }}>
                {prevDueError}
              </div>
            )}

            <form onSubmit={handleSavePrevDue}>
              {/* Current Previous Due info box */}
              <div
                style={{
                  background: 'var(--bg-main, #f8fafc)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md, 6px)',
                  padding: '0.65rem 0.85rem',
                  marginBottom: '1rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                  Current Outstanding Due:
                </span>
                <span
                  style={{
                    fontSize: '0.95rem',
                    fontWeight: 800,
                    color: parseFloat(prevDueRow.customerBalance || '0') > 0 ? '#dc2626' : 'var(--text-primary)',
                  }}
                >
                  {formatCurrency(prevDueRow.customerBalance || '0')}
                </span>
              </div>

              {/* New Amount input */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label className="form-label" style={{ fontSize: '0.82rem', marginBottom: '0.35rem', fontWeight: 700 }}>
                  Today's Previous Due Amount (₹) *
                </label>
                <div style={{ position: 'relative' }}>
                  <span
                    style={{
                      position: 'absolute',
                      left: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      fontSize: '1rem',
                      fontWeight: 800,
                      color: 'var(--text-muted)',
                    }}
                  >
                    ₹
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    autoFocus
                    className="form-input"
                    placeholder="0.00"
                    value={prevDueAmount}
                    onChange={(e) => setPrevDueAmount(e.target.value)}
                    style={{
                      height: '38px',
                      fontSize: '1.1rem',
                      fontWeight: 800,
                      paddingLeft: '26px',
                      color: parseFloat(prevDueAmount || '0') > 0 ? '#dc2626' : 'var(--text-primary)',
                    }}
                  />
                </div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.35rem', display: 'block' }}>
                  Quickly set or override today's previous due for this shop on the sheet.
                </span>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsPrevDueModalOpen(false)}
                  style={{ height: '34px', fontSize: '0.82rem' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', height: '34px', fontSize: '0.82rem', fontWeight: 700 }}
                >
                  <Save size={14} />
                  <span>Save Amount</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}





      {/* Invoice Modal for Order Printing / Thermal POS Slip */}
      {invoiceModalOrder && (
        <InvoiceModal
          order={invoiceModalOrder.order}
          customer={invoiceModalOrder.customer}
          onClose={() => setInvoiceModalOrder(null)}
        />
      )}

      {/* Bulk WhatsApp Bills Modal (Send All PDF or Image to All Customers) */}
      {isBulkWhatsAppModalOpen && (
        <BulkSendWhatsAppBillsModal
          isOpen={isBulkWhatsAppModalOpen}
          onClose={() => setIsBulkWhatsAppModalOpen(false)}
          orderDate={orderDate}
          orders={bulkBillItems}
        />
      )}

      {/* Bulk WhatsApp Pending Orders Reminder Modal (Ask Pending Customers 1-Click) */}
      {isPendingReminderModalOpen && (
        <BulkSendWhatsAppReminderModal
          isOpen={isPendingReminderModalOpen}
          onClose={() => setIsPendingReminderModalOpen(false)}
          orderDate={orderDate}
          pendingCustomers={pendingCustomers}
        />
      )}
    </div>
  );
};


