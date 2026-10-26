import React, { useRef, useState, useEffect } from 'react';
import { Customer, CustomerDetailSummary, Order, Payment } from '../types';
import { openWhatsApp, generateCustomerStatementMessage } from '../utils/whatsappUtils';
import { sendInvoiceFileViaBridge, getWhatsAppBridgeQrUrl } from '../utils/whatsappBridgeUtils';
import { useSettings } from '../context/SettingsContext';
import {
  Printer,
  MessageCircle,
  X,
  Store,
  CreditCard,
  ShoppingBag,
  MapPin,
  Phone,
  RefreshCw,
  Image as ImageIcon,
  FileText,
  Loader2,
  Calendar,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { formatCurrency, formatDate } from '../utils/formatters';

import { customerService } from '../services/customerService';
import { orderService } from '../services/orderService';
import { paymentService } from '../services/paymentService';

interface CustomerStatementModalProps {
  customer: Customer;
  summary?: CustomerDetailSummary | null;
  orders?: Order[];
  onClose: () => void;
}

export const CustomerStatementModal: React.FC<CustomerStatementModalProps> = ({
  customer,
  summary: initialSummary,
  orders: initialOrders,
  onClose,
}) => {
  const statementRef = useRef<HTMLDivElement>(null);
  const { isWhatsAppEnabled, gstNumber, businessPhone, businessName, settings } = useSettings();
  const [summary, setSummary] = useState<CustomerDetailSummary | null>(initialSummary || null);
  const [orders, setOrders] = useState<Order[]>(initialOrders || []);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  // Period Filter States
  const [period, setPeriod] = useState<'THIS_MONTH' | 'TODAY' | 'ALL' | 'CUSTOM'>('THIS_MONTH');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');

  // WhatsApp Sending States
  const [isSendingWhatsAppFile, setIsSendingWhatsAppFile] = useState(false);
  const [whatsAppFileStatus, setWhatsAppFileStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!customer?.id) {
      setLoading(false);
      return;
    }
    let isCancelled = false;
    setLoading(true);

    const promises: Promise<any>[] = [
      initialSummary
        ? Promise.resolve(initialSummary)
        : customerService.getCustomerSummary(customer.id).catch((err) => {
            console.error('Error fetching statement summary:', err);
            return null;
          }),
      initialOrders && initialOrders.length > 0
        ? Promise.resolve(initialOrders)
        : orderService.getOrders({ customer: customer.id }).catch((err) => {
            console.error('Error fetching statement orders:', err);
            return [];
          }),
      paymentService.getPayments({ customer: customer.id }).catch((err) => {
        console.error('Error fetching statement payments:', err);
        return [];
      }),
    ];

    Promise.all(promises)
      .then(([summaryData, ordersData, paymentsData]) => {
        if (isCancelled) return;
        if (summaryData) setSummary(summaryData);
        if (Array.isArray(ordersData)) setOrders(ordersData);
        if (Array.isArray(paymentsData)) setPayments(paymentsData);
      })
      .catch((err) => console.error('Error fetching statement data:', err))
      .finally(() => {
        if (!isCancelled) setLoading(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [customer?.id]);

  const storeName = businessName || settings?.business_name || 'Zamzam Foods Wholesale';
  const storePhone = businessPhone || settings?.phone_number || '+91 98470 12345';
  const storeGst = gstNumber || settings?.gst_number || '';
  const storeAddress = settings?.address || 'Main Road, Pandikkad, Malappuram, Kerala';
  const storeEmail = settings?.email || 'info@zamzamfoods.com';
  const storeUpi = settings?.upi_id || '';

  const rawBalance = Number(summary?.outstanding_balance ?? customer.current_balance ?? 0);
  const balance = isNaN(rawBalance) ? 0 : rawBalance;
  const rawCreditLimit = Number(customer.credit_limit || 0);
  const creditLimit = isNaN(rawCreditLimit) ? 0 : rawCreditLimit;

  // Compile combined ledger transactions (orders & payments)
  const transactions: Array<{
    date: string;
    type: 'ORDER' | 'PAYMENT';
    ref: string;
    description: string;
    debit: number;
    credit: number;
  }> = [];

  // Add non-cancelled orders
  const validOrders = (orders.length > 0 ? orders : (summary?.recent_orders || []))
    .filter((o: any) => o.status !== 'CANCELLED');

  validOrders.forEach((o: any) => {
    transactions.push({
      date: o.order_date || o.created_at || '',
      type: 'ORDER',
      ref: o.order_number,
      description: `Wholesale Order #${o.order_number} (${(o.items || []).length} items)`,
      debit: Number(o.total_amount || 0),
      credit: 0,
    });
  });

  // Add valid payments
  const validPayments = (payments.length > 0 ? payments : (summary?.recent_payments || []))
    .filter((p: any) => p.status !== 'REVERSED' && p.status !== 'CANCELLED');

  validPayments.forEach((p: any) => {
    transactions.push({
      date: p.received_at || '',
      type: 'PAYMENT',
      ref: p.payment_number || 'RECEIPT',
      description: `Payment Received (${p.payment_method === 'GPAY_UPI' ? 'GPay / UPI' : 'Cash'}${p.reference_number ? ` • Ref: ${p.reference_number}` : ''})`,
      debit: 0,
      credit: Number(p.amount || 0),
    });
  });

  // Sort descending by date (latest first)
  transactions.sort((a, b) => (new Date(b.date || 0).getTime() || 0) - (new Date(a.date || 0).getTime() || 0));

  // Aggregate totals
  const rawOrdersAmount = summary?.total_sales !== undefined 
    ? Number(summary.total_sales) 
    : transactions.filter(t => t.type === 'ORDER').reduce((acc, t) => acc + (t.debit || 0), 0);
  const totalOrdersAmount = isNaN(rawOrdersAmount) ? 0 : rawOrdersAmount;

  const rawPaidAmount = summary?.total_paid !== undefined 
    ? Number(summary.total_paid) 
    : transactions.filter(t => t.type === 'PAYMENT').reduce((acc, t) => acc + (t.credit || 0), 0);
  const totalPaidAmount = isNaN(rawPaidAmount) ? 0 : rawPaidAmount;

  const totalOrdersCount = summary?.total_orders ?? validOrders.length;
  const todayStr = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  // Date Period Calculations
  const now = new Date();
  const todayIso = now.toISOString().slice(0, 10);
  const firstDayOfMonthIso = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);

  let periodStartDate = '';
  let periodEndDate = todayIso;
  let periodLabel = 'All-Time Account History';

  if (period === 'TODAY') {
    periodStartDate = todayIso;
    periodEndDate = todayIso;
    periodLabel = `Today's Summary (${todayStr})`;
  } else if (period === 'THIS_MONTH') {
    periodStartDate = firstDayOfMonthIso;
    periodEndDate = todayIso;
    const monthName = now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    periodLabel = `${monthName} Statement (${formatDate(firstDayOfMonthIso)} – ${todayStr})`;
  } else if (period === 'CUSTOM') {
    periodStartDate = customStartDate;
    periodEndDate = customEndDate || todayIso;
    periodLabel = `Custom Statement (${customStartDate || 'Start'} to ${customEndDate || 'Today'})`;
  }

  // Transactions within selected date period
  const periodTransactions = transactions.filter((t) => {
    if (!t.date) return period === 'ALL';
    const txDateIso = String(t.date).slice(0, 10);
    if (periodStartDate && txDateIso < periodStartDate) return false;
    if (periodEndDate && txDateIso > periodEndDate) return false;
    return true;
  });

  const periodPurchases = periodTransactions
    .filter((t) => t.type === 'ORDER')
    .reduce((acc, t) => acc + (t.debit || 0), 0);

  const periodPayments = periodTransactions
    .filter((t) => t.type === 'PAYMENT')
    .reduce((acc, t) => acc + (t.credit || 0), 0);

  const openingDue = period === 'ALL' ? 0 : Math.max(0, balance - (periodPurchases - periodPayments));
  const closingDue = period === 'ALL' ? balance : Math.max(0, openingDue + periodPurchases - periodPayments);

  const handlePrint = () => {
    if (!statementRef.current) {
      window.print();
      return;
    }

    const oldFrame = document.getElementById('statement-print-frame');
    if (oldFrame) oldFrame.remove();

    const iframe = document.createElement('iframe');
    iframe.id = 'statement-print-frame';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    iframe.style.visibility = 'hidden';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      window.print();
      return;
    }

    const statementHtml = statementRef.current.innerHTML;

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Statement - ${customer.name}</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 8mm;
            }
            * {
              box-sizing: border-box;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            html, body {
              margin: 0;
              padding: 6mm;
              background: #ffffff;
              color: #0f172a;
              font-family: system-ui, -apple-system, sans-serif;
              font-size: 12px;
              line-height: 1.35;
              width: 100%;
            }
            table {
              width: 100%;
              border-collapse: collapse;
            }
            img {
              max-width: 100%;
              height: auto;
            }
            .statement-non-printable {
              display: none !important;
            }
          </style>
        </head>
        <body>
          ${statementHtml}
        </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => {
        iframe.remove();
      }, 3000);
    }, 200);
  };

  const handleWhatsAppSendFile = async (format: 'IMAGE' | 'PDF' = 'IMAGE') => {
    const custPhone = customer.phone;
    if (!custPhone || custPhone.trim().length < 7) {
      alert('This customer shop does not have a valid phone number entered.');
      return;
    }
    if (!statementRef.current) return;

    setIsSendingWhatsAppFile(true);
    setWhatsAppFileStatus(`Sending Statement ${format}...`);

    try {
      const caption =
        `*${storeName.toUpperCase()}*\n` +
        `*CUSTOMER ACCOUNT STATEMENT*\n` +
        `Shop: *${customer.name}*\n` +
        `Period: *${periodLabel}*\n` +
        `Outstanding Due: *₹${closingDue.toFixed(2)}*\n` +
        (storeUpi ? `GPay / UPI Payment: *${storeUpi}*\n` : '') +
        `\nThank you for choosing ${storeName}!`;

      const res = await sendInvoiceFileViaBridge({
        phone: custPhone,
        element: statementRef.current,
        orderNumber: `Statement_${customer.name.replace(/[^a-zA-Z0-9]/g, '_')}`,
        format,
        caption,
      });

      if (res.success) {
        setWhatsAppFileStatus(`✅ Statement ${format} Sent!`);
        setTimeout(() => setWhatsAppFileStatus(null), 4000);
      } else {
        setWhatsAppFileStatus(null);
        const openQr = window.confirm(
          `${res.error}\n\nWould you like to open the WhatsApp QR Code page on your laptop now to connect?`
        );
        if (openQr) {
          window.open(getWhatsAppBridgeQrUrl(), '_blank');
        }
      }
    } catch (err: unknown) {
      setWhatsAppFileStatus(null);
      const errMsg = err instanceof Error ? err.message : String(err);
      alert('Failed to send statement via WhatsApp: ' + errMsg);
    } finally {
      setIsSendingWhatsAppFile(false);
    }
  };

  const handleWhatsAppShare = () => {
    const msg = generateCustomerStatementMessage({
      customerName: customer.name,
      customerPhone: customer.phone,
      customerAddress: customer.address,
      route: typeof customer.route === 'object' ? (customer.route as any)?.name : undefined,
      statementDate: todayStr,
      totalOrdersCount,
      totalOrdersAmount: periodPurchases,
      totalPaymentsAmount: periodPayments,
      outstandingBalance: closingDue,
      recentTransactions: periodTransactions.slice(0, 6).map((t) => ({
        date: formatDate(t.date),
        type: t.type,
        ref: t.ref,
        amount: t.type === 'ORDER' ? t.debit : t.credit,
      })),
      businessOverride: {
        businessName: storeName,
        businessPhone: storePhone,
        gstNumber: storeGst,
        address: storeAddress,
        upiId: storeUpi,
        email: storeEmail,
      },
    });

    openWhatsApp(customer.phone, msg);
  };

  return (
    <div
      className="statement-modal-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        overflowY: 'auto',
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        padding: '1.25rem 0.75rem',
        boxSizing: 'border-box',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <style>{`
        @media print {
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            overflow: visible !important;
            height: auto !important;
          }

          #root > *:not(.statement-modal-overlay),
          .manager-sidebar,
          .manager-topbar,
          .sidebar,
          header,
          nav,
          aside,
          .statement-non-printable,
          .btn,
          button {
            display: none !important;
          }

          .statement-modal-overlay {
            position: static !important;
            inset: auto !important;
            background: transparent !important;
            padding: 0 !important;
            margin: 0 !important;
            display: block !important;
            overflow: visible !important;
          }

          .statement-modal-overlay .card {
            box-shadow: none !important;
            border: none !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            overflow: visible !important;
          }

          .statement-printable-wrapper {
            position: static !important;
            width: 100% !important;
            margin: 0 auto !important;
            padding: 8mm !important;
            box-shadow: none !important;
            border: none !important;
            background: #ffffff !important;
            color: #000000 !important;
            display: block !important;
            page-break-inside: avoid;
          }
        }
      `}</style>

      {/* Main Container */}
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '820px',
          background: '#ffffff',
          borderRadius: '8px',
          border: '1px solid #cbd5e1',
          boxShadow: 'var(--shadow-md)',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* Action Header Bar (Hidden during print) */}
        <div
          className="statement-non-printable"
          style={{
            background: '#0f172a',
            color: '#ffffff',
            padding: '0.75rem 1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.75rem',
            borderBottom: '1px solid #1e293b',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#ffffff' }}>
              CUSTOMER ACCOUNT STATEMENT
            </span>
            <span
              style={{
                fontSize: '0.68rem',
                fontWeight: 800,
                backgroundColor: '#047857',
                color: '#ffffff',
                padding: '0.12rem 0.45rem',
                borderRadius: '4px',
                textTransform: 'uppercase',
              }}
            >
              {customer.name}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            {/* Direct WhatsApp Image Dispatch (Default) */}
            <button
              type="button"
              onClick={() => handleWhatsAppSendFile('IMAGE')}
              disabled={loading || isSendingWhatsAppFile}
              style={{
                padding: '0.35rem 0.75rem',
                background: '#047857',
                color: '#ffffff',
                border: 'none',
                borderRadius: '4px',
                fontSize: '0.76rem',
                fontWeight: 800,
                cursor: loading || isSendingWhatsAppFile ? 'wait' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                boxShadow: '0 2px 4px rgba(4, 120, 87, 0.3)',
              }}
              title="Send High-Res Statement Image directly to customer WhatsApp"
            >
              {isSendingWhatsAppFile ? <Loader2 size={13} className="animate-spin" /> : <ImageIcon size={13} />}
              <span>Send Image (Default)</span>
            </button>

            {/* Direct WhatsApp PDF Dispatch */}
            <button
              type="button"
              onClick={() => handleWhatsAppSendFile('PDF')}
              disabled={loading || isSendingWhatsAppFile}
              style={{
                padding: '0.35rem 0.65rem',
                background: '#16a34a',
                color: '#ffffff',
                border: 'none',
                borderRadius: '4px',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: loading || isSendingWhatsAppFile ? 'wait' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
              title="Send PDF Statement directly to customer WhatsApp"
            >
              <FileText size={13} />
              <span>Send PDF</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              disabled={loading}
              style={{
                padding: '0.35rem 0.65rem',
                background: '#475569',
                color: '#ffffff',
                border: 'none',
                borderRadius: '4px',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
            >
              <Printer size={13} />
              <span>Print</span>
            </button>

            <button
              type="button"
              onClick={handleWhatsAppShare}
              disabled={loading}
              style={{
                padding: '0.35rem 0.55rem',
                background: 'transparent',
                color: '#94a3b8',
                border: '1px solid #475569',
                borderRadius: '4px',
                fontSize: '0.72rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
              }}
              title="Share Text Link"
            >
              <MessageCircle size={12} />
              <span>Share Link</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title="Close modal"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* WhatsApp Sending Status Indicator */}
        {whatsAppFileStatus && (
          <div
            className="statement-non-printable"
            style={{
              padding: '0.45rem 1.25rem',
              backgroundColor: whatsAppFileStatus.includes('✅') ? '#ecfdf5' : '#eff6ff',
              color: whatsAppFileStatus.includes('✅') ? '#065f46' : '#1d4ed8',
              fontSize: '0.8rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              borderBottom: '1px solid #cbd5e1',
            }}
          >
            {whatsAppFileStatus.includes('Sending') && <Loader2 size={14} className="animate-spin" />}
            {whatsAppFileStatus.includes('✅') && <CheckCircle2 size={14} />}
            <span>{whatsAppFileStatus}</span>
          </div>
        )}

        {/* Period Filter Toolbar (Hidden during print) */}
        <div
          className="statement-non-printable"
          style={{
            padding: '0.65rem 1.25rem',
            backgroundColor: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.6rem',
            fontSize: '0.78rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, color: '#475569', marginRight: '4px' }}>Statement Period:</span>
            <button
              type="button"
              onClick={() => setPeriod('THIS_MONTH')}
              style={{
                padding: '0.25rem 0.55rem',
                borderRadius: '5px',
                fontSize: '0.75rem',
                fontWeight: 700,
                border: period === 'THIS_MONTH' ? '2px solid #047857' : '1px solid #cbd5e1',
                backgroundColor: period === 'THIS_MONTH' ? '#ecfdf5' : '#ffffff',
                color: period === 'THIS_MONTH' ? '#065f46' : '#64748b',
                cursor: 'pointer',
              }}
            >
              📅 This Month
            </button>

            <button
              type="button"
              onClick={() => setPeriod('TODAY')}
              style={{
                padding: '0.25rem 0.55rem',
                borderRadius: '5px',
                fontSize: '0.75rem',
                fontWeight: 700,
                border: period === 'TODAY' ? '2px solid #047857' : '1px solid #cbd5e1',
                backgroundColor: period === 'TODAY' ? '#ecfdf5' : '#ffffff',
                color: period === 'TODAY' ? '#065f46' : '#64748b',
                cursor: 'pointer',
              }}
            >
              ⚡ Today
            </button>

            <button
              type="button"
              onClick={() => setPeriod('ALL')}
              style={{
                padding: '0.25rem 0.55rem',
                borderRadius: '5px',
                fontSize: '0.75rem',
                fontWeight: 700,
                border: period === 'ALL' ? '2px solid #047857' : '1px solid #cbd5e1',
                backgroundColor: period === 'ALL' ? '#ecfdf5' : '#ffffff',
                color: period === 'ALL' ? '#065f46' : '#64748b',
                cursor: 'pointer',
              }}
            >
              📜 All-Time
            </button>

            <button
              type="button"
              onClick={() => setPeriod('CUSTOM')}
              style={{
                padding: '0.25rem 0.55rem',
                borderRadius: '5px',
                fontSize: '0.75rem',
                fontWeight: 700,
                border: period === 'CUSTOM' ? '2px solid #047857' : '1px solid #cbd5e1',
                backgroundColor: period === 'CUSTOM' ? '#ecfdf5' : '#ffffff',
                color: period === 'CUSTOM' ? '#065f46' : '#64748b',
                cursor: 'pointer',
              }}
            >
              📆 Custom Range
            </button>
          </div>

          {period === 'CUSTOM' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                style={{ padding: '0.2rem 0.4rem', fontSize: '0.75rem', border: '1px solid #cbd5e1', borderRadius: '4px' }}
              />
              <span>to</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                style={{ padding: '0.2rem 0.4rem', fontSize: '0.75rem', border: '1px solid #cbd5e1', borderRadius: '4px' }}
              />
            </div>
          )}

          <div style={{ color: '#047857', fontWeight: 700 }}>
            {periodLabel}
          </div>
        </div>

        {/* ==================================================================== */}
        {/* PRINTABLE STATEMENT BODY                                            */}
        {/* ==================================================================== */}
        {loading ? (
          <div style={{ padding: '4rem 2rem', textAlign: 'center' }}>
            <div className="spinner" style={{ margin: '0 auto 1rem' }} />
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 600 }}>
              Loading complete customer statement & ledger transactions...
            </p>
          </div>
        ) : (
          <div
            ref={statementRef}
            className="statement-printable-wrapper"
            style={{
              padding: '1.75rem',
              backgroundColor: '#ffffff',
              color: '#0f172a',
              fontFamily: 'system-ui, -apple-system, sans-serif',
            }}
          >
          {/* Header Banner: Store Branding, Logo, GSTIN */}
          <div style={{ borderBottom: '2px solid #b91c1c', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                <img
                  src="/app-icon.png"
                  alt="Store Logo"
                  style={{
                    width: '54px',
                    height: '54px',
                    objectFit: 'cover',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    flexShrink: 0,
                  }}
                  onError={(e) => {
                    (e.currentTarget as HTMLElement).style.display = 'none';
                  }}
                />
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.45rem', fontWeight: 900, color: '#b91c1c', textTransform: 'uppercase' }}>
                    {storeName}
                  </h2>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginTop: '2px' }}>
                    {storeAddress}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#475569', marginTop: '2px' }}>
                    Contact Phone: <strong>{storePhone}</strong> {storeEmail ? `| Email: ${storeEmail}` : ''}
                  </div>
                  {storeGst && (
                    <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0f172a', marginTop: '3px' }}>
                      GSTIN: <span style={{ color: '#b91c1c', fontFamily: 'monospace' }}>{storeGst}</span>
                    </div>
                  )}
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#0f172a' }}>
                  CUSTOMER ACCOUNT STATEMENT
                </div>
                <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#047857', marginTop: '3px' }}>
                  {periodLabel}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>
                  Generated On: <strong>{todayStr}</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Customer Metadata Card */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: '1rem',
              padding: '0.85rem 1rem',
              backgroundColor: '#f8fafc',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              marginBottom: '1.25rem',
              fontSize: '0.82rem',
            }}
          >
            <div>
              <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '3px' }}>
                CUSTOMER ACCOUNT DETAILS:
              </span>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>
                {customer.name}
              </div>
              {customer.owner_name && <div>Proprietor: <strong>{customer.owner_name}</strong></div>}
              {customer.phone && <div>Phone: <strong>{customer.phone}</strong> {customer.alternative_phone ? `/ ${customer.alternative_phone}` : ''}</div>}
              {customer.address && <div>Address: {customer.address}</div>}
            </div>

            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '3px' }}>
                ROUTE & PAYMENT PROFILE:
              </span>
              {customer.route_details?.name && <div>Delivery Route: <strong>{customer.route_details.name}</strong></div>}
              <div>Credit Limit: <strong>₹{creditLimit.toFixed(2)}</strong></div>
              <div>Period Orders Count: <strong>{periodTransactions.filter(t => t.type === 'ORDER').length}</strong></div>
              {storeUpi && (
                <div style={{ marginTop: '4px', fontWeight: 700 }}>
                  UPI / GPay: <span style={{ fontFamily: 'monospace', color: '#b91c1c' }}>{storeUpi}</span>
                </div>
              )}
            </div>
          </div>

          {/* Financial KPI Summary Cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '0.75rem',
              marginBottom: '1.25rem',
            }}
          >
            <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
              <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                Opening Due (b/f)
              </span>
              <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#0f172a', marginTop: '2px', fontFamily: 'monospace' }}>
                ₹{openingDue.toFixed(2)}
              </div>
            </div>

            <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
              <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                Period Purchases
              </span>
              <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#0f172a', marginTop: '2px', fontFamily: 'monospace' }}>
                ₹{periodPurchases.toFixed(2)}
              </div>
            </div>

            <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
              <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                Period Payments
              </span>
              <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#15803d', marginTop: '2px', fontFamily: 'monospace' }}>
                ₹{periodPayments.toFixed(2)}
              </div>
            </div>

            <div style={{ background: '#fef2f2', padding: '0.75rem', borderRadius: '6px', border: '1px solid #fecaca' }}>
              <span style={{ fontSize: '0.72rem', color: '#991b1b', fontWeight: 800, textTransform: 'uppercase' }}>
                Net Outstanding Due
              </span>
              <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#b91c1c', marginTop: '2px', fontFamily: 'monospace' }}>
                ₹{closingDue.toFixed(2)}
              </div>
            </div>
          </div>

          {/* Statement Transaction History Table */}
          <div style={{ overflowX: 'auto', marginBottom: '1.5rem' }}>
            <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#0f172a', marginBottom: '0.4rem', textTransform: 'uppercase' }}>
              {periodLabel} — Transaction Ledger:
            </div>
            <table className="data-table" style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #cbd5e1' }}>
                  <th style={{ padding: '0.5rem 0.6rem', textAlign: 'left', width: '90px' }}>Date</th>
                  <th style={{ padding: '0.5rem 0.6rem', textAlign: 'center', width: '80px' }}>Type</th>
                  <th style={{ padding: '0.5rem 0.6rem', textAlign: 'left', width: '110px' }}>Ref / Invoice</th>
                  <th style={{ padding: '0.5rem 0.6rem', textAlign: 'left' }}>Description</th>
                  <th style={{ padding: '0.5rem 0.6rem', textAlign: 'right', width: '110px' }}>Bill (Debit ₹)</th>
                  <th style={{ padding: '0.5rem 0.6rem', textAlign: 'right', width: '110px' }}>Paid (Credit ₹)</th>
                </tr>
              </thead>
              <tbody>
                {/* Opening balance row if filtered */}
                {openingDue > 0 && (
                  <tr style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: '#fcfcfd' }}>
                    <td style={{ padding: '0.5rem 0.6rem', fontFamily: 'monospace', color: '#64748b' }}>
                      {periodStartDate ? formatDate(periodStartDate) : '—'}
                    </td>
                    <td style={{ padding: '0.5rem 0.6rem', textAlign: 'center' }}>
                      <span style={{ fontSize: '0.68rem', fontWeight: 800, padding: '0.1rem 0.4rem', borderRadius: '3px', background: '#f1f5f9', color: '#475569' }}>
                        OPENING
                      </span>
                    </td>
                    <td style={{ padding: '0.5rem 0.6rem', fontFamily: 'monospace', color: '#64748b' }}>
                      BALANCE B/F
                    </td>
                    <td style={{ padding: '0.5rem 0.6rem', color: '#475569', fontStyle: 'italic' }}>
                      Previous outstanding balance brought forward
                    </td>
                    <td style={{ padding: '0.5rem 0.6rem', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: '#b91c1c' }}>
                      ₹{openingDue.toFixed(2)}
                    </td>
                    <td style={{ padding: '0.5rem 0.6rem', textAlign: 'right', fontFamily: 'monospace', color: '#94a3b8' }}>
                      —
                    </td>
                  </tr>
                )}

                {periodTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '1.25rem', textAlign: 'center', color: '#64748b' }}>
                      No transactions recorded in this period.
                    </td>
                  </tr>
                ) : (
                  periodTransactions.map((tx, idx) => (
                    <tr key={`${tx.ref}_${idx}`} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '0.5rem 0.6rem', fontFamily: 'monospace', color: '#475569' }}>
                        {formatDate(tx.date)}
                      </td>
                      <td style={{ padding: '0.5rem 0.6rem', textAlign: 'center' }}>
                        <span
                          style={{
                            fontSize: '0.68rem',
                            fontWeight: 800,
                            padding: '0.1rem 0.4rem',
                            borderRadius: '3px',
                            background: tx.type === 'ORDER' ? '#fef2f2' : '#ecfdf5',
                            color: tx.type === 'ORDER' ? '#b91c1c' : '#15803d',
                            border: tx.type === 'ORDER' ? '1px solid #fecaca' : '1px solid #a7f3d0',
                          }}
                        >
                          {tx.type}
                        </span>
                      </td>
                      <td style={{ padding: '0.5rem 0.6rem', fontWeight: 700, fontFamily: 'monospace', color: '#0f172a' }}>
                        #{tx.ref}
                      </td>
                      <td style={{ padding: '0.5rem 0.6rem', color: '#334155' }}>
                        {tx.description}
                      </td>
                      <td style={{ padding: '0.5rem 0.6rem', textAlign: 'right', fontFamily: 'monospace', fontWeight: tx.debit > 0 ? 800 : 400, color: tx.debit > 0 ? '#b91c1c' : '#94a3b8' }}>
                        {tx.debit > 0 ? `₹${tx.debit.toFixed(2)}` : '—'}
                      </td>
                      <td style={{ padding: '0.5rem 0.6rem', textAlign: 'right', fontFamily: 'monospace', fontWeight: tx.credit > 0 ? 800 : 400, color: tx.credit > 0 ? '#15803d' : '#94a3b8' }}>
                        {tx.credit > 0 ? `₹${tx.credit.toFixed(2)}` : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot>
                <tr style={{ background: '#f8fafc', borderTop: '2px solid #cbd5e1', fontWeight: 800 }}>
                  <td colSpan={4} style={{ padding: '0.6rem', textAlign: 'right' }}>
                    NET CLOSING OUTSTANDING DUE:
                  </td>
                  <td colSpan={2} style={{ padding: '0.6rem', textAlign: 'right', color: '#b91c1c', fontSize: '1.05rem', fontFamily: 'monospace' }}>
                    ₹{closingDue.toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Statement Disclaimer & Signatures */}
          <div
            style={{
              paddingTop: '1.25rem',
              borderTop: '1px solid #cbd5e1',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              textAlign: 'center',
              fontSize: '0.76rem',
              color: '#475569',
            }}
          >
            <div>
              <div style={{ height: '44px' }} />
              <div style={{ borderTop: '1px dashed #94a3b8', paddingTop: '4px', fontWeight: 600 }}>
                Customer Confirmation & Seal
              </div>
            </div>
            <div>
              <div style={{ height: '44px' }} />
              <div style={{ borderTop: '1px dashed #94a3b8', paddingTop: '4px', fontWeight: 700, color: '#b91c1c' }}>
                For {storeName} (Authorized Signatory)
              </div>
            </div>
          </div>
        </div>
        )}
      </div>
    </div>
  );
};
