export type UserRole = 'OWNER' | 'MANAGER' | 'DRIVER';

export interface User {
  id: number | string;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  phone_number?: string;
  is_active: boolean;
  date_joined?: string;
  driver_profile_id?: string | null;
  assigned_route_id?: string | null;
  assigned_route_name?: string | null;
}

export interface AuthResponse {
  /**
   * Cookie-based auth: access & refresh tokens are set as HttpOnly cookies by
   * the server. The response body only contains the user profile + a message.
   * These fields are intentionally absent to prevent JS from accessing tokens.
   */
  detail: string;
  user: User;
}


export interface Route {
  id: string;
  name: string;
  code: string;
  description: string;
  is_active: boolean;
  customer_count?: number;
  active_driver_name?: string | null;
}

export interface Driver {
  id: string;
  user: number;
  user_details?: User;
  assigned_route: string | null;
  assigned_route_details?: Route;
  driver_name: string;
  active_deliveries_count?: number;
  phone_number: string;
  vehicle_number: string;
  license_number: string;
  is_active: boolean;
}


export interface Customer {
  id: string;
  name: string;
  owner_name: string;
  phone: string;
  alternative_phone?: string;
  address: string;
  landmark?: string;
  route: string;
  route_details?: Route;
  credit_limit: string;
  current_balance: string;
  is_credit_exceeded: boolean;
  is_active: boolean;
  notes?: string;
  documents_count?: number;
  product_prices?: Array<{ product_id: string; price: string }>;
  custom_prices?: Record<string, string>;
  created_at?: string;
  updated_at?: string;
}

export type CustomerDocumentType =
  | 'FSSAI_LICENSE'
  | 'GST_CERTIFICATE'
  | 'TRADE_LICENSE'
  | 'RENT_AGREEMENT'
  | 'ID_PROOF'
  | 'SHOP_PHOTO'
  | 'BANK_PROOF'
  | 'CONTRACT'
  | 'OTHER';

export interface CustomerDocument {
  id: string;
  customer: string;
  customer_name?: string;
  customer_route_name?: string;
  title: string;
  document_type: CustomerDocumentType;
  document_type_display?: string;
  file: string;
  file_url: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  document_number?: string;
  expiry_date?: string | null;
  notes?: string;
  uploaded_by?: number | string | null;
  uploaded_by_name?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CustomerDocumentBatchUploadPayload {
  customer: string;
  document_type?: CustomerDocumentType;
  title?: string;
  document_number?: string;
  expiry_date?: string;
  notes?: string;
  files: File[];
}

export interface CustomerProductPrice {
  id: string;
  customer: string;
  customer_name?: string;
  product: string;
  product_name?: string;
  product_code?: string;
  price: string;
  effective_from: string;
  effective_to?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CustomerPricingOverviewItem {
  product_id: string;
  product_name: string;
  product_code: string;
  default_price: string;
  packet_size: string;
  customer_price: string | null;
  effective_price: string;
  is_custom_price: boolean;
  price_record_id: string | null;
  is_active: boolean;
}

export interface LastOrderItem {
  product_id: string;
  product_name: string;
  product_code: string;
  packet_size: string;
  quantity: number;
  historical_unit_price: string;
  current_unit_price: string;
  price_changed: boolean;
}

export interface LastOrderInfo {
  id: string;
  order_number: string;
  order_date: string;
  total_amount: string;
  status: string;
  items: LastOrderItem[];
}

export interface FrequentOrderInfo {
  most_frequent_product: string;
  typical_quantity: number;
  total_orders: number;
  last_order_date: string | null;
}

export interface CustomerDetailSummary {
  customer: Customer;
  total_orders: number;
  total_sales: string;
  total_paid: string;
  outstanding_balance: string;
  pricing: CustomerPricingOverviewItem[];
  recent_orders: Order[];
  recent_payments: Payment[];
  recent_deliveries: Delivery[];
  last_order?: LastOrderInfo | null;
  frequent_order_info?: FrequentOrderInfo | null;
}

export interface Product {
  id: string;
  name: string;
  code: string;
  description: string;
  unit_price: string;
  packet_size: string;
  order_number?: number;
  skip_in_entry?: boolean;
  is_active: boolean;
  created_at?: string;
}

export interface OrderItem {
  id: string;
  product: string;
  product_details?: Product;
  quantity: number;
  unit_price: string;
  subtotal: string;
}

export type OrderStatus = 'DRAFT' | 'CONFIRMATION_PENDING' | 'SUBMITTED' | 'LOCKED' | 'BILLING' | 'DELIVERY_CREATED' | 'COMPLETED' | 'CANCELLED' | 'DELIVERED' | 'NOT_DELIVERED';

export interface Order {
  id: string;
  order_number: string;
  customer: string;
  customer_details?: Customer;
  route: string;
  route_details?: Route;
  driver?: string | null;
  driver_name?: string;
  order_date: string;
  status: OrderStatus;
  total_amount: string;
  shop_expense?: string;
  shop_expense_notes?: string;
  notes?: string;
  items: OrderItem[];
  delivery_status?: string | null;
  delivery_id?: string | null;
  source?: string;
  entered_by_role?: string;
  entered_by_name?: string;
  created_at: string;
  updated_at?: string;
  submitted_at?: string;
  previous_balance?: string;
  balance_after?: string;
  paid_amount?: string;
}

export type DeliveryStatus = 'ASSIGNED' | 'IN_TRANSIT' | 'DELIVERED' | 'NOT_DELIVERED' | 'FAILED' | 'RETURNED';

export interface Delivery {
  id: string;
  delivery_number: string;
  order: string;
  order_details?: Order;
  driver: string;
  driver_name: string;
  route: string;
  route_details?: Route;
  status: DeliveryStatus;
  delivered_at?: string | null;
  recipient_name?: string;
  failed_reason?: string;
  notes?: string;
  stop_number?: number;
  created_at: string;
}



export type DriverExpenseCategory =
  | 'SHOP_EXPENSE'
  | 'MAINTENANCE'
  | 'RAW_MATERIAL'
  | 'PETROL_FUEL'
  | 'PETROL'
  | 'FOOD'
  | 'PARKING'
  | 'TOLL'
  | 'UTILITY'
  | 'SALARY_WAGES'
  | 'VEHICLE_REPAIR'
  | 'OTHER';
export type DriverExpenseStatus = 'SUBMITTED' | 'APPROVED' | 'REJECTED';

export interface DriverExpense {
  id: string;
  driver?: string | null;
  driver_name: string;
  route_name?: string;
  category: DriverExpenseCategory;
  category_display: string;
  custom_category?: string;
  amount: string;
  date: string;
  notes?: string;
  receipt_url?: string;
  receipt_reference?: string;
  status: DriverExpenseStatus;
  created_by?: string;
  created_by_name?: string;
  created_at: string;
  updated_at: string;
}

export interface DriverExpenseSummary {
  today_total: string;
  week_total: string;
  month_total: string;
  category_breakdown: Record<string, string>;
  count: number;
}

export type PaymentMethod = 'CASH' | 'GPAY_UPI';

export interface Payment {
  id: string;
  payment_number: string;
  customer: string;
  customer_name?: string;
  route_name?: string;
  customer_details?: Customer;
  order?: string | null;
  order_number?: string | null;
  payment_type?: 'ORDER_PAYMENT' | 'PREVIOUS_CREDIT';
  amount: string;
  payment_method: PaymentMethod;
  status: 'COMPLETED' | 'REVERSED' | 'VOID';
  reference_number?: string;
  collected_by: number;
  collected_by_name?: string;
  staff_member?: string | null;
  staff_member_name?: string | null;
  staff_member_role?: string | null;
  received_at: string;
  notes?: string;
  reversed_by?: string | null;
  reversed_by_name?: string | null;
  reversed_at?: string | null;
  reversal_reason?: string | null;
}

export type CreditTransactionType = 
  | 'OPENING_BALANCE' 
  | 'CREDIT_SALE' 
  | 'CASH_PAYMENT' 
  | 'GPAY_PAYMENT' 
  | 'ORDER_PAYMENT'
  | 'PREVIOUS_CREDIT_PAYMENT'
  | 'ADJUSTMENT'
  | 'PAYMENT_REVERSAL';

export interface CreditTransaction {
  id: string;
  customer: string;
  customer_name: string;
  route_name: string;
  transaction_type: CreditTransactionType;
  amount: string;
  balance_before?: string;
  balance_after: string;
  allocation?: 'ORDER' | 'ORDER_PAYMENT' | 'PREVIOUS_CREDIT' | 'REVERSAL' | 'ADJUSTMENT' | 'OPENING_BALANCE';
  reference_order?: string | null;
  order_number?: string;
  reference_payment?: string | null;
  payment_number?: string;
  notes?: string;
  recorded_by?: string;
  recorded_by_name?: string;
  created_at: string;
}

export interface CollectionItem {
  id: string;
  payment_number: string;
  customer_id: string;
  customer_name: string;
  customer_phone?: string;
  route_name: string;
  route_id?: string | null;
  driver_name: string;
  amount: string;
  payment_method: PaymentMethod;
  payment_type: 'ORDER_PAYMENT' | 'PREVIOUS_CREDIT';
  order_number?: string | null;
  status: 'COMPLETED' | 'REVERSED';
  reference_number?: string;
  notes?: string;
  received_at: string;
  reversed_at?: string | null;
  reversal_reason?: string | null;
  reversed_by_name?: string | null;
}

export interface CollectionReportResponse {
  start_date: string;
  end_date: string;
  date_preset: string;
  summary: {
    total_collected: string;
    cash_total: string;
    upi_total: string;
    today_order_collected: string;
    previous_credit_collected: string;
    completed_count: number;
    reversed_count: number;
    reversed_amount: string;
  };
  collections: CollectionItem[];
}

export interface DriverCollectionRow {
  driver_id: string;
  driver_name: string;
  phone_number: string;
  vehicle_number: string;
  route_id: string | null;
  route_name: string;
  orders_delivered: number;
  cash_collected: string;
  upi_collected: string;
  order_payment_collected: string;
  previous_credit_collected: string;
  total_collected: string;
  expenses: string;
  net_collection: string;
}

export interface DriverCollectionReportResponse {
  start_date: string;
  end_date: string;
  date_preset: string;
  grand_totals: {
    total_collected: string;
    total_expenses: string;
    net_collection: string;
  };
  drivers: DriverCollectionRow[];
}

export interface DailyFinancialSummaryResponse {
  start_date: string;
  end_date: string;
  date_preset: string;
  sales: string;
  orders_count: number;
  total_collected: string;
  cash_collected: string;
  upi_collected: string;
  today_order_collected: string;
  previous_credit_collected: string;
  credit_generated: string;
  driver_expenses: string;
  staff_cash_paid?: string;
  staff_gpay_paid?: string;
  total_staff_payouts?: string;
  net_collection: string;
  total_receivable: string;
}

export type DatePreset = 'today' | 'yesterday' | 'this_week' | 'this_month' | 'custom';

export interface DashboardSummary {
  role: UserRole;
  date: string;
  start_date?: string;
  end_date?: string;
  date_preset?: string;
  // Owner & Manager stats
  today_orders_count?: number;
  today_sales?: string;
  total_deliveries?: number;
  completed_deliveries?: number;
  pending_deliveries?: number;
  not_delivered_count?: number;
  cash_collected?: string;
  upi_collected?: string;
  total_collected?: string;
  today_expenses?: string;
  today_credit?: string;
  net_collection?: string;
  total_customers?: number;
  total_receivable?: string;
  credit_exceeded_count?: number;
  route_breakdown?: Array<{
    route_id: string;
    route_name: string;
    route_code: string;
    shops_count: number;
    today_orders_count: number;
    today_sales: string;
    today_collected: string;
    today_expenses?: string;
    net_collected?: string;
    total_receivable: string;
    total_deliveries?: number;
    completed_deliveries?: number;
    not_delivered_count?: number;
  }>;
  // Driver stats
  driver_name?: string;
  route_name?: string;
  vehicle_number?: string;
}

export interface DriverPerformanceSummary {
  driver_id: string;
  driver_name: string;
  phone_number: string;
  vehicle_number: string;
  route_id: string | null;
  route_name: string;
  route_code: string;
  total_assigned: number;
  delivered: number;
  not_delivered: number;
  pending: number;
  cash_collected: string;
  upi_collected: string;
  collection_amount: string;
  expenses: string;
  net_collection: string;
}

export interface DriverPerformanceReport {
  start_date: string;
  end_date: string;
  date_preset: string;
  drivers: DriverPerformanceSummary[];
}

export interface DriverDetailReport {
  driver_id: string;
  driver_name: string;
  vehicle_number: string;
  route_name: string;
  start_date: string;
  end_date: string;
  date_preset: string;
  summary: {
    assigned: number;
    delivered: number;
    not_delivered: number;
    pending: number;
    total_collection: string;
    total_expenses: string;
    net_collection: string;
  };
  deliveries: Array<{
    id: string;
    delivery_number: string;
    order_number: string;
    customer_name: string;
    customer_address: string;
    total_amount: string;
    status: string;
    failed_reason?: string;
    date: string;
  }>;
  collections: Array<{
    id: string;
    payment_number: string;
    customer_name: string;
    amount: string;
    payment_method: string;
    date: string;
  }>;
  expenses: Array<{
    id: string;
    category: string;
    category_display: string;
    amount: string;
    date: string;
    notes?: string;
  }>;
}

export type ActivityActionType = 'CREATE' | 'UPDATE' | 'DELETE' | 'CANCEL' | 'DELIVER' | 'PAYMENT';
export type ActivityEntityType = 'ORDER' | 'PRICE' | 'PAYMENT' | 'DELIVERY' | 'EXPENSE' | 'CUSTOMER';

export interface ActivityLog {
  id: string;
  user_name: string;
  user_role: string;
  action: string;
  action_type?: string;
  action_type_display?: string;
  entity_type: ActivityEntityType;
  entity_type_display?: string;
  entity_id: string;
  entity_name: string;
  summary: string;
  details?: Record<string, any>;
  old_value?: Record<string, any> | null;
  new_value?: Record<string, any> | null;
  timestamp: string;
  created_at?: string;
}

export type StaffWageType = 'DEFAULT_SLAB' | 'CUSTOM';
export type StaffRoleType = 'STAFF' | 'MEMBER';

export interface StaffMember {
  id: string;
  user?: string | null;
  user_details?: {
    id: string;
    username: string;
    role: string;
    email: string;
    is_active: boolean;
  } | null;
  has_login_account: boolean;
  full_name: string;
  phone_number: string;
  role_type?: StaffRoleType;
  designation: string;
  joined_date: string;
  wage_type: StaffWageType;
  custom_daily_wage?: string | null;
  current_daily_wage: string;
  tenure_days: number;
  tenure_slab_label: string;
  proof_document?: string | null;
  proof_document_url?: string | null;
  is_active: boolean;
  notes?: string;
  total_earned: string;
  total_paid: string;
  balance_due: string;
  created_at: string;
  updated_at: string;
}

export type AttendanceStatus = 'FULL' | 'HALF' | 'LEAVE';

export interface StaffAttendance {
  id: string;
  staff: string;
  staff_name: string;
  staff_designation: string;
  date: string;
  status: AttendanceStatus;
  status_display: string;
  daily_wage: string;
  notes?: string;
  marked_by_name?: string;
  created_at: string;
  updated_at: string;
}

export interface DailySheetItem {
  staff_id: string;
  full_name: string;
  phone_number: string;
  role_type?: StaffRoleType;
  designation: string;
  has_login_account: boolean;
  joined_date: string | null;
  wage_type?: StaffWageType;
  custom_daily_wage?: string | null;
  tenure_slab_label: string;
  base_daily_wage: string;
  attendance_id: string | null;
  status: AttendanceStatus;
  is_marked: boolean;
  calculated_wage: string;
  cash_paid?: string;
  gpay_paid?: string;
  notes: string;
}

export type StaffPayoutType = 'SALARY' | 'ADVANCE' | 'BONUS' | 'OTHER';
export type StaffPaymentMethod = 'CASH' | 'GPAY_UPI';

export interface StaffPayout {
  id: string;
  staff: string;
  staff_name: string;
  amount: string;
  payout_type: StaffPayoutType;
  payout_type_display: string;
  payment_method: StaffPaymentMethod;
  payment_method_display: string;
  date: string;
  reference?: string;
  notes?: string;
  paid_by_name?: string;
  created_at: string;
  updated_at: string;
}

export interface StaffSummary {
  total_staff: number;
  active_staff: number;
  login_staff: number;
  worker_staff: number;
  today_present: number;
  month_wages_earned: string;
  month_payouts_given: string;
}

