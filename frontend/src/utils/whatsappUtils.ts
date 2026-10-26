/**
 * Zamzam Foods - Professional WhatsApp Business Sharing Utilities
 * Formats 100% dynamic, customer-facing operational messages without hardcoded company info.
 * Dynamically pulls business name, phone, GSTIN, store address, and UPI ID from system settings.
 */
import { BRAND_CONFIG } from '../config/brandConfig';

export interface DynamicStoreInfo {
  businessName: string;
  businessPhone: string;
  gstNumber: string;
  address: string;
  upiId: string;
  email: string;
}

/**
 * Returns dynamic business identity from cached settings with fallback to BRAND_CONFIG
 */
export function getDynamicStoreInfo(override?: Partial<DynamicStoreInfo>): DynamicStoreInfo {
  let cached: Record<string, any> | null = null;
  try {
    const raw = localStorage.getItem('zamzam_system_settings');
    if (raw) cached = JSON.parse(raw);
  } catch {}

  const businessName =
    override?.businessName?.trim() ||
    cached?.business_name?.trim() ||
    BRAND_CONFIG.fullName ||
    'Zamzam Foods Wholesale';

  const businessPhone =
    override?.businessPhone?.trim() ||
    cached?.phone_number?.trim() ||
    BRAND_CONFIG.phone ||
    '+91 98470 12345';

  const gstNumber =
    override?.gstNumber?.trim() ||
    cached?.gst_number?.trim() ||
    '';

  const address =
    override?.address?.trim() ||
    cached?.address?.trim() ||
    'Main Road, Pandikkad, Malappuram, Kerala';

  const upiId =
    override?.upiId?.trim() ||
    cached?.upi_id?.trim() ||
    '';

  const email =
    override?.email?.trim() ||
    cached?.email?.trim() ||
    'info@zamzamfoods.com';

  return {
    businessName,
    businessPhone,
    gstNumber,
    address,
    upiId,
    email,
  };
}

// Backward-compatible exports
export const BUSINESS_NAME = BRAND_CONFIG.fullName;
export const BUSINESS_PHONE = BRAND_CONFIG.phone;

export function cleanPhoneNumber(phone?: string): string {
  if (!phone) return '';
  const digits = phone.replace(/[^0-9]/g, '');
  if (digits.length === 10) {
    return `91${digits}`; // Default to India country code if 10 digits
  }
  return digits;
}

export function isWhatsAppActive(): boolean {
  try {
    const raw = localStorage.getItem('zamzam_system_settings');
    if (raw) {
      const data = JSON.parse(raw);
      if (data.is_whatsapp_enabled === false) return false;
    }
  } catch {}
  return true;
}

export function openWhatsApp(phone: string | undefined, message: string) {
  if (!isWhatsAppActive()) {
    console.warn('WhatsApp messaging is disabled by system administrator.');
    return;
  }
  const cleanPhone = cleanPhoneNumber(phone);
  const encodedText = encodeURIComponent(message);
  const url = cleanPhone ? `https://wa.me/${cleanPhone}?text=${encodedText}` : `https://wa.me/?text=${encodedText}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

export interface InvoiceShareData {
  customerName: string;
  orderNumber: string;
  date: string;
  items: Array<{ name: string; quantity: number; unitPrice: string | number; subtotal: string | number }>;
  totalAmount: string | number;
  gstAmount?: string | number;
  paidAmount?: string | number;
  outstandingBalance?: string | number;
  businessOverride?: Partial<DynamicStoreInfo>;
}

export function generateInvoiceMessage(data: InvoiceShareData): string {
  const store = getDynamicStoreInfo(data.businessOverride);

  const itemLines = data.items
    .map(
      (it) =>
        `• ${it.name} x ${it.quantity} @ ₹${Number(it.unitPrice).toFixed(2)} = ₹${Number(it.subtotal).toFixed(2)}`
    )
    .join('\n');

  const total = Number(data.totalAmount || 0);
  const gst = Number(data.gstAmount || 0);
  const paid = Number(data.paidAmount || 0);
  const outstanding = Number(data.outstandingBalance || 0);

  let text = `*${store.businessName.toUpperCase()}*\n`;
  if (store.gstNumber) {
    text += `GSTIN: *${store.gstNumber}*\n`;
  }
  text += `Ph: ${store.businessPhone}\n`;
  text += `--------------------------------\n`;
  text += `TAX INVOICE / BILL: *#${data.orderNumber}*\n`;
  text += `Date: ${data.date}\n`;
  text += `Customer: *${data.customerName}*\n`;
  text += `--------------------------------\n`;
  text += `*ITEMS:*\n${itemLines}\n\n`;
  text += `*Subtotal:* ₹${(gst > 0 ? total - gst : total).toFixed(2)}\n`;
  if (gst > 0) {
    text += `*GST (5%):* ₹${gst.toFixed(2)}\n`;
  }
  text += `*Current Bill Total:* ₹${total.toFixed(2)}\n`;
  if (paid > 0) {
    text += `*Paid Amount:* ₹${paid.toFixed(2)}\n`;
  }
  if (outstanding > 0) {
    text += `*Previous Due:* ₹${outstanding.toFixed(2)}\n`;
    text += `*Total Account Due:* ₹${(outstanding + (total - paid)).toFixed(2)}\n`;
  }
  if (store.upiId) {
    text += `\n*UPI Payment:* \`${store.upiId}\`\n`;
  }
  text += `--------------------------------\n`;
  text += `Thank you for your business!\n*${store.businessName}*\n${store.address}`;

  return text;
}

export interface PaymentShareData {
  customerName: string;
  paymentNumber: string;
  amount: string | number;
  paymentMethod: string;
  date: string;
  remainingBalance?: string | number;
  businessOverride?: Partial<DynamicStoreInfo>;
}

export function generatePaymentReceiptMessage(data: PaymentShareData): string {
  const store = getDynamicStoreInfo(data.businessOverride);
  const methodLabel = data.paymentMethod === 'GPAY_UPI' ? 'GPay / UPI' : 'Cash';
  const remaining = Number(data.remainingBalance || 0);

  let text = `*${store.businessName.toUpperCase()}*\n`;
  if (store.gstNumber) {
    text += `GSTIN: *${store.gstNumber}*\n`;
  }
  text += `Ph: ${store.businessPhone}\n`;
  text += `--------------------------------\n`;
  text += `*OFFICIAL PAYMENT RECEIPT*\n`;
  text += `Receipt No: *#${data.paymentNumber}*\n`;
  text += `Date: ${data.date}\n`;
  text += `Received From: *${data.customerName}*\n`;
  text += `--------------------------------\n`;
  text += `*Amount Received:* ₹${Number(data.amount).toFixed(2)}\n`;
  text += `*Payment Mode:* ${methodLabel}\n`;
  if (remaining > 0) {
    text += `*Remaining Outstanding Balance:* ₹${remaining.toFixed(2)}\n`;
  } else {
    text += `*Account Balance Status:* All Clear (₹0.00) ✓\n`;
  }
  text += `--------------------------------\n`;
  text += `Thank you for your prompt payment!\n*${store.businessName}*`;

  return text;
}

export interface BalanceShareData {
  customerName: string;
  outstandingBalance: string | number;
  creditLimit?: string | number;
  date: string;
  businessOverride?: Partial<DynamicStoreInfo>;
}

export function generateBalanceReminderMessage(data: BalanceShareData): string {
  const store = getDynamicStoreInfo(data.businessOverride);
  const balance = Number(data.outstandingBalance || 0);

  let text = `*${store.businessName.toUpperCase()}*\n`;
  if (store.gstNumber) {
    text += `GSTIN: *${store.gstNumber}*\n`;
  }
  text += `Ph: ${store.businessPhone}\n`;
  text += `--------------------------------\n`;
  text += `*ACCOUNT STATEMENT & DUE NOTICE*\n`;
  text += `Date: ${data.date}\n`;
  text += `Customer Shop: *${data.customerName}*\n`;
  text += `--------------------------------\n`;
  text += `*Current Outstanding Balance:* ₹${balance.toFixed(2)}\n`;
  if (data.creditLimit && Number(data.creditLimit) > 0) {
    text += `Credit Limit: ₹${Number(data.creditLimit).toFixed(2)}\n`;
  }
  if (store.upiId) {
    text += `\n*Pay via UPI / GPay:* \`${store.upiId}\`\n`;
  }
  text += `--------------------------------\n`;
  text += `Please arrange for settlement at your earliest convenience.\n`;
  text += `For billing inquiries, contact ${store.businessPhone}.\n*${store.businessName}*`;

  return text;
}

export interface CustomerStatementShareData {
  customerName: string;
  customerPhone?: string;
  customerAddress?: string;
  route?: string;
  statementDate: string;
  totalOrdersCount: number;
  totalOrdersAmount: number | string;
  totalPaymentsAmount: number | string;
  outstandingBalance: number | string;
  recentTransactions?: Array<{
    date: string;
    type: 'ORDER' | 'PAYMENT';
    ref: string;
    amount: number | string;
  }>;
  businessOverride?: Partial<DynamicStoreInfo>;
}

export function generateCustomerStatementMessage(data: CustomerStatementShareData): string {
  const store = getDynamicStoreInfo(data.businessOverride);
  const balance = Number(data.outstandingBalance || 0);

  let text = `*${store.businessName.toUpperCase()}*\n`;
  if (store.gstNumber) {
    text += `GSTIN: *${store.gstNumber}*\n`;
  }
  text += `Ph: ${store.businessPhone}\n`;
  text += `Address: ${store.address}\n`;
  text += `--------------------------------\n`;
  text += `*CUSTOMER ACCOUNT STATEMENT*\n`;
  text += `Shop Name: *${data.customerName}*\n`;
  if (data.route) text += `Route: ${data.route}\n`;
  if (data.customerPhone) text += `Phone: ${data.customerPhone}\n`;
  text += `Statement Date: ${data.statementDate}\n`;
  text += `--------------------------------\n`;
  text += `*Total Orders Placed:* ${data.totalOrdersCount} (₹${Number(data.totalOrdersAmount).toFixed(2)})\n`;
  text += `*Total Paid to Date:* ₹${Number(data.totalPaymentsAmount).toFixed(2)}\n`;
  text += `*Current Outstanding Due:* *₹${balance.toFixed(2)}*\n`;

  if (data.recentTransactions && data.recentTransactions.length > 0) {
    text += `\n*Recent Activity:*\n`;
    data.recentTransactions.slice(0, 5).forEach((tx) => {
      const typeLabel = tx.type === 'ORDER' ? 'Order' : 'Payment Received';
      const sign = tx.type === 'ORDER' ? '+' : '-';
      text += `• ${tx.date} | ${typeLabel} #${tx.ref}: ${sign}₹${Number(tx.amount).toFixed(2)}\n`;
    });
  }

  if (store.upiId) {
    text += `\n*Pay via UPI / GPay:* \`${store.upiId}\`\n`;
  }
  text += `--------------------------------\n`;
  text += `Thank you for your business!\n*${store.businessName}*\nInquiries: ${store.businessPhone}`;

  return text;
}

export interface DeliverySummaryShareData {
  customerName: string;
  orderNumber: string;
  driverName?: string;
  status: string;
  totalAmount: string | number;
  date: string;
  businessOverride?: Partial<DynamicStoreInfo>;
}

export function generateDeliverySummaryMessage(data: DeliverySummaryShareData): string {
  const store = getDynamicStoreInfo(data.businessOverride);

  let text = `*${store.businessName.toUpperCase()}*\n`;
  if (store.gstNumber) {
    text += `GSTIN: *${store.gstNumber}*\n`;
  }
  text += `--------------------------------\n`;
  text += `*DELIVERY DISPATCH UPDATE*\n`;
  text += `Customer: *${data.customerName}*\n`;
  text += `Order No: *#${data.orderNumber}*\n`;
  text += `Status: *${data.status}*\n`;
  text += `Date: ${data.date}\n`;
  if (data.driverName) {
    text += `Delivery Person: ${data.driverName}\n`;
  }
  text += `Total Bill Amount: ₹${Number(data.totalAmount).toFixed(2)}\n`;
  text += `--------------------------------\n`;
  text += `Thank you for choosing *${store.businessName}*!\nPh: ${store.businessPhone}`;

  return text;
}
