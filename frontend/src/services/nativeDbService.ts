import { isTauriEnvironment } from './tauriBackupService';

export interface Customer {
  id: string;
  name: string;
  owner_name: string;
  phone: string;
  alternative_phone: string;
  address: string;
  route_name: string;
  opening_due: number;
  current_balance: number;
  is_active: boolean;
  notes: string;
}

export interface SaveCustomerInput {
  id?: string;
  name: string;
  owner_name?: string;
  phone?: string;
  alternative_phone?: string;
  address?: string;
  route_name?: string;
  opening_due?: number;
  is_active?: boolean;
  notes?: string;
}

export interface CustomerLedgerItem {
  id: string;
  created_at: string;
  transaction_type: string;
  amount: number;
  balance_after: number;
  order_id?: string;
  payment_id?: string;
  notes: string;
}

export interface Product {
  id: string;
  name: string;
  code: string;
  unit_price: number;
  packet_size: string;
  order_number: number;
  is_active: boolean;
  notes: string;
}

export interface SaveProductInput {
  id?: string;
  name: string;
  code: string;
  unit_price: number;
  packet_size?: string;
  order_number?: number;
  is_active?: boolean;
  notes?: string;
}

export interface CustomerProductPrice {
  id: string;
  customer_id: string;
  product_id: string;
  product_name: string;
  price: number;
  default_price: number;
}

export interface OrderListItem {
  id: string;
  bill_number: string;
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  route_name: string;
  bill_date: string;
  subtotal: number;
  discount: number;
  total_amount: number;
  previous_due: number;
  payment_amount: number;
  remaining_due: number;
  payment_method: string;
  status: string;
}

export interface OrderItemDetail {
  id: string;
  product_id: string;
  product_name: string;
  product_code: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

export interface OrderDetail {
  id: string;
  bill_number: string;
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  route_name: string;
  bill_date: string;
  subtotal: number;
  discount: number;
  total_amount: number;
  previous_due: number;
  payment_amount: number;
  remaining_due: number;
  payment_method: string;
  notes: string;
  status: string;
  items: OrderItemDetail[];
}

export interface SaveOrderItem {
  product_id: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

export interface SaveOrderInput {
  id?: string;
  bill_number?: string;
  customer_id: string;
  bill_date: string;
  subtotal: number;
  discount: number;
  total_amount: number;
  previous_due: number;
  payment_amount: number;
  remaining_due: number;
  payment_method: string;
  notes?: string;
  items: SaveOrderItem[];
}

export interface RecordPaymentInput {
  customer_id: string;
  amount: number;
  payment_method: string;
  reference_number?: string;
  notes?: string;
}

export interface ExpenseItem {
  id: string;
  expense_date: string;
  category: string;
  amount: number;
  payment_method: string;
  description: string;
  receipt_reference: string;
}

export interface SaveExpenseInput {
  id?: string;
  expense_date: string;
  category: string;
  amount: number;
  payment_method: string;
  description?: string;
  receipt_reference?: string;
}

export interface StaffItem {
  id: string;
  full_name: string;
  phone_number: string;
  address: string;
  joined_date: string;
  staff_type: string;
  salary_type: string;
  monthly_salary: number;
  daily_wage: number;
  is_active: boolean;
  notes: string;
}

export interface SaveStaffInput {
  id?: string;
  full_name: string;
  phone_number?: string;
  address?: string;
  joined_date?: string;
  staff_type?: string;
  salary_type?: string;
  monthly_salary?: number;
  daily_wage?: number;
  is_active?: boolean;
  notes?: string;
}

export interface AttendanceItem {
  staff_id: string;
  staff_name: string;
  staff_type: string;
  default_daily_wage: number;
  status: string;
  daily_wage: number;
  notes: string;
}

export interface SaveAttendanceRecord {
  staff_id: string;
  status: string;
  daily_wage?: number;
  notes?: string;
}

export interface DocumentItem {
  id: string;
  title: string;
  category: string;
  description: string;
  document_date: string;
  file_name: string;
  file_size: number;
  mime_type: string;
}

export interface SaveDocumentInput {
  id?: string;
  title: string;
  category?: string;
  description?: string;
  document_date?: string;
  file_name?: string;
  file_path?: string;
  file_size?: number;
  mime_type?: string;
}

export interface SystemSettingsDto {
  business_name: string;
  phone_number: string;
  gst_number: string;
  address: string;
  upi_id: string;
  invoice_footer_notes: string;
  pin_code: string;
  auto_backup_enabled: boolean;
  backup_folder: string;
  backup_on_close: boolean;
  fallback_backup_time: string;
  retention_count: number;
  last_backup_at?: string | null;
  last_cloud_upload_at?: string | null;
}

export interface DashboardSummary {
  today_sales: number;
  today_payments: number;
  total_receivables: number;
  today_expenses: number;
  net_amount: number;
  total_customers: number;
  customers_with_due: number;
  staff_present: number;
  staff_absent: number;
  date: string;
}

export interface SalesReportSummary {
  total_sales: number;
  total_payments: number;
  total_expenses: number;
  order_count: number;
  payment_count: number;
  start_date: string;
  end_date: string;
}

export interface LocalDbConfig {
  host: string;
  port: number;
  user: string;
  password?: string;
  dbname: string;
}

export interface DbTestResult {
  ok: boolean;
  message: string;
  version?: string;
}

export const DEFAULT_AIVEN_CONFIG: LocalDbConfig = {
  host: 'pg-65e4170-zamzamfoods.h.aivencloud.com',
  port: 18638,
  user: 'avnadmin',
  password: '',
  dbname: 'defaultdb',
};

async function invokeTauri<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (!isTauriEnvironment()) {
    console.warn(`[nativeDbService] Browser environment detected for "${cmd}". Fallback mode active.`);
    throw new Error(`Native Tauri command "${cmd}" called in browser environment`);
  }
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<T>(cmd, args);
}

export const nativeDbService = {
  // Connectivity & Health
  async ping(): Promise<boolean> {
    try {
      return await invokeTauri<boolean>('db_ping');
    } catch {
      return false;
    }
  },

  async getDbConfig(): Promise<LocalDbConfig> {
    if (!isTauriEnvironment()) {
      return DEFAULT_AIVEN_CONFIG;
    }
    try {
      const cfg = await invokeTauri<LocalDbConfig>('db_get_config');
      if (!cfg || !cfg.host || cfg.host === 'localhost') {
        return DEFAULT_AIVEN_CONFIG;
      }
      return cfg;
    } catch {
      return DEFAULT_AIVEN_CONFIG;
    }
  },

  async saveDbConfig(config: LocalDbConfig): Promise<boolean> {
    return invokeTauri<boolean>('db_save_config', { config });
  },

  async testDbConnection(config: LocalDbConfig): Promise<DbTestResult> {
    return invokeTauri<DbTestResult>('db_test_connection', { config });
  },

  async initDbSchema(): Promise<string> {
    return invokeTauri<string>('db_init_schema');
  },

  // Dashboard
  async getDashboardSummary(date?: string): Promise<DashboardSummary> {
    return invokeTauri<DashboardSummary>('db_get_dashboard_summary', { date });
  },

  // Customers
  async getCustomers(params?: { search?: string; route?: string; activeOnly?: boolean }): Promise<Customer[]> {
    return invokeTauri<Customer[]>('db_get_customers', {
      search: params?.search,
      route: params?.route,
      activeOnly: params?.activeOnly,
    });
  },

  async saveCustomer(input: SaveCustomerInput): Promise<string> {
    return invokeTauri<string>('db_save_customer', { input });
  },

  async getCustomerLedger(customerId: string): Promise<CustomerLedgerItem[]> {
    return invokeTauri<CustomerLedgerItem[]>('db_get_customer_ledger', { customerId });
  },

  // Products
  async getProducts(activeOnly?: boolean): Promise<Product[]> {
    return invokeTauri<Product[]>('db_get_products', { activeOnly });
  },

  async saveProduct(input: SaveProductInput): Promise<string> {
    return invokeTauri<string>('db_save_product', { input });
  },

  // Customer Prices
  async getCustomerPrices(customerId: string): Promise<CustomerProductPrice[]> {
    return invokeTauri<CustomerProductPrice[]>('db_get_customer_prices', { customerId });
  },

  async setCustomerPrice(customerId: string, productId: string, price: number): Promise<boolean> {
    return invokeTauri<boolean>('db_set_customer_price', { customerId, productId, price });
  },

  // Orders / Billing
  async getOpeningDue(customerId: string): Promise<number> {
    return invokeTauri<number>('db_get_opening_due', { customerId });
  },

  async saveOrder(order: SaveOrderInput): Promise<string> {
    return invokeTauri<string>('db_save_order', { order });
  },

  async getOrders(params?: {
    startDate?: string;
    endDate?: string;
    customerId?: string;
    search?: string;
    limit?: number;
  }): Promise<OrderListItem[]> {
    return invokeTauri<OrderListItem[]>('db_get_orders', {
      startDate: params?.startDate,
      endDate: params?.endDate,
      customerId: params?.customerId,
      search: params?.search,
      limit: params?.limit,
    });
  },

  async getOrder(id: string): Promise<OrderDetail> {
    return invokeTauri<OrderDetail>('db_get_order', { id });
  },

  // Payments
  async recordPayment(input: RecordPaymentInput): Promise<string> {
    return invokeTauri<string>('db_record_payment', { input });
  },

  // Expenses
  async getExpenses(params?: { startDate?: string; endDate?: string; category?: string }): Promise<ExpenseItem[]> {
    return invokeTauri<ExpenseItem[]>('db_get_expenses', {
      startDate: params?.startDate,
      endDate: params?.endDate,
      category: params?.category,
    });
  },

  async saveExpense(input: SaveExpenseInput): Promise<string> {
    return invokeTauri<string>('db_save_expense', { input });
  },

  async deleteExpense(id: string): Promise<boolean> {
    return invokeTauri<boolean>('db_delete_expense', { id });
  },

  // Staff
  async getStaff(activeOnly?: boolean): Promise<StaffItem[]> {
    return invokeTauri<StaffItem[]>('db_get_staff', { activeOnly });
  },

  async saveStaff(input: SaveStaffInput): Promise<string> {
    return invokeTauri<string>('db_save_staff', { input });
  },

  // Attendance
  async getAttendance(date: string): Promise<AttendanceItem[]> {
    return invokeTauri<AttendanceItem[]>('db_get_attendance', { date });
  },

  async saveAttendance(date: string, records: SaveAttendanceRecord[]): Promise<boolean> {
    return invokeTauri<boolean>('db_save_attendance', { date, records });
  },

  // Documents
  async getDocuments(category?: string): Promise<DocumentItem[]> {
    return invokeTauri<DocumentItem[]>('db_get_documents', { category });
  },

  async saveDocument(input: SaveDocumentInput): Promise<string> {
    return invokeTauri<string>('db_save_document', { input });
  },

  async deleteDocument(id: string): Promise<boolean> {
    return invokeTauri<boolean>('db_delete_document', { id });
  },

  // Settings
  async getSettings(): Promise<SystemSettingsDto> {
    return invokeTauri<SystemSettingsDto>('db_get_settings');
  },

  async updateSettings(input: SystemSettingsDto): Promise<boolean> {
    return invokeTauri<boolean>('db_update_settings', { input });
  },

  async verifyPin(pin: string): Promise<boolean> {
    return invokeTauri<boolean>('db_verify_pin', { pin });
  },

  // Reports
  async getSalesReport(startDate: string, endDate: string): Promise<SalesReportSummary> {
    return invokeTauri<SalesReportSummary>('db_get_sales_report', { startDate, endDate });
  },
};
