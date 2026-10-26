import React, { useRef, useState } from 'react';
import { Order, Customer } from '../types';
import { openWhatsApp, generateInvoiceMessage } from '../utils/whatsappUtils';
import { sendInvoiceFileViaBridge, getWhatsAppBridgeQrUrl } from '../utils/whatsappBridgeUtils';
import { useSettings } from '../context/SettingsContext';
import { Printer, MessageCircle, X, Check, Receipt, FileText, QrCode, Send, Loader2, Image as ImageIcon } from 'lucide-react';

interface InvoiceModalProps {
  order: Order;
  customer?: Customer | null;
  onClose: () => void;
}

export const InvoiceModal: React.FC<InvoiceModalProps> = ({ order, customer, onClose }) => {
  const invoiceRef = useRef<HTMLDivElement>(null);
  const [applyGst, setApplyGst] = useState(false);
  const [printFormat, setPrintFormat] = useState<'A4' | 'THERMAL'>('A4');
  const { isWhatsAppEnabled, gstNumber, businessPhone, businessName, settings } = useSettings();

  const cust = customer || order.customer_details;
  const subtotal = Number(order.total_amount || 0);
  const gstAmount = applyGst ? subtotal * 0.05 : 0;
  const finalTotal = subtotal + gstAmount;

  // Exact previous due prior to this order
  const prevCredit =
    order.previous_balance !== undefined && order.previous_balance !== null
      ? Math.max(0, Number(order.previous_balance))
      : cust?.current_balance
      ? Math.max(0, Number(cust.current_balance) - subtotal)
      : 0;

  const paidAmount = Number(order.paid_amount || (order as any).paid_amount || 0);
  const totalAccountDue = Math.max(0, prevCredit + finalTotal - paidAmount);

  const storeName = businessName || settings?.business_name || 'Zamzam Foods Wholesale';
  const storePhone = businessPhone || settings?.phone_number || '+91 98470 12345';
  const storeGst = gstNumber || settings?.gst_number || '';
  const storeAddress = settings?.address || 'Main Road, Pandikkad, Malappuram, Kerala';
  const storeEmail = settings?.email || 'info@zamzamfoods.com';
  const storeUpi = settings?.upi_id || '';
  const storeFooterNotes = settings?.invoice_footer_notes || 'Thank you for your business. Fresh Kubbus & Romali rotis delivered daily.';

  const handlePrint = () => {
    if (!invoiceRef.current) {
      window.print();
      return;
    }

    // Clean up any previous print iframes
    const oldFrame = document.getElementById('invoice-print-frame');
    if (oldFrame) oldFrame.remove();

    const iframe = document.createElement('iframe');
    iframe.id = 'invoice-print-frame';
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

    const isThermal = printFormat === 'THERMAL';
    const invoiceHtml = invoiceRef.current.innerHTML;

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Invoice #${order.order_number}</title>
          <style>
            @page {
              size: ${isThermal ? '80mm auto' : 'A4 portrait'};
              margin: ${isThermal ? '2mm' : '8mm'};
            }
            * {
              box-sizing: border-box;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            html, body {
              margin: 0;
              padding: ${isThermal ? '2mm' : '6mm'};
              background: #ffffff;
              color: #0f172a;
              font-family: ${isThermal ? 'monospace, system-ui, sans-serif' : 'system-ui, -apple-system, sans-serif'};
              font-size: ${isThermal ? '11px' : '12px'};
              line-height: 1.35;
              width: ${isThermal ? '76mm' : '100%'};
            }
            table {
              width: 100%;
              border-collapse: collapse;
            }
            img {
              max-width: 100%;
              height: auto;
            }
            .invoice-non-printable {
              display: none !important;
            }
          </style>
        </head>
        <body>
          ${invoiceHtml}
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

  const handleWhatsAppShare = () => {
    const custName = customer?.name || order.customer_details?.name || 'Valued Customer';
    const custPhone = customer?.phone || order.customer_details?.phone;
    const items = order.items.map((it) => ({
      name: it.product_details?.name || 'Product',
      quantity: it.quantity,
      unitPrice: it.unit_price,
      subtotal: it.subtotal,
    }));

    const msg = generateInvoiceMessage({
      customerName: custName,
      orderNumber: order.order_number,
      date: order.order_date,
      items,
      totalAmount: finalTotal.toFixed(2),
      gstAmount: applyGst ? gstAmount.toFixed(2) : undefined,
      outstandingBalance: prevCredit > 0 ? prevCredit.toFixed(2) : undefined,
      businessOverride: {
        businessName: storeName,
        businessPhone: storePhone,
        gstNumber: storeGst,
        address: storeAddress,
        upiId: storeUpi,
        email: storeEmail,
      },
    });

    openWhatsApp(custPhone, msg);
  };

  const [isSendingWhatsAppFile, setIsSendingWhatsAppFile] = useState(false);
  const [whatsAppFileStatus, setWhatsAppFileStatus] = useState<string | null>(null);

  const handleWhatsAppSendFile = async (format: 'PDF' | 'IMAGE' = 'PDF') => {
    const custName = customer?.name || order.customer_details?.name || 'Valued Customer';
    const custPhone = customer?.phone || order.customer_details?.phone;
    if (!custPhone) {
      alert('This customer does not have a phone number entered.');
      return;
    }
    if (!invoiceRef.current) return;

    setIsSendingWhatsAppFile(true);
    setWhatsAppFileStatus(`Sending ${format} Bill...`);

    try {
      const caption = `*${storeName.toUpperCase()}*\nTAX INVOICE / BILL: *#${order.order_number}*\nCustomer: *${custName}*\nTotal: ₹${finalTotal.toFixed(2)}\n\nThank you for choosing ${storeName}!`;

      const res = await sendInvoiceFileViaBridge({
        phone: custPhone,
        element: invoiceRef.current,
        orderNumber: order.order_number,
        format,
        caption,
      });

      if (res.success) {
        setWhatsAppFileStatus(`✅ ${format} Sent!`);
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
      alert('Failed to send WhatsApp bill file: ' + errMsg);
    } finally {
      setIsSendingWhatsAppFile(false);
    }
  };

  return (
    <div
      className="invoice-modal-overlay"
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

          /* Hide all app contents outside the invoice modal */
          #root > *:not(.invoice-modal-overlay),
          .manager-sidebar,
          .manager-topbar,
          .sidebar,
          header,
          nav,
          aside,
          .invoice-non-printable,
          .btn,
          button {
            display: none !important;
          }

          .invoice-modal-overlay {
            position: static !important;
            inset: auto !important;
            background: transparent !important;
            padding: 0 !important;
            margin: 0 !important;
            display: block !important;
            overflow: visible !important;
          }

          .invoice-modal-overlay .card {
            box-shadow: none !important;
            border: none !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            overflow: visible !important;
          }

          .invoice-printable-wrapper {
            position: static !important;
            width: 100% !important;
            margin: 0 auto !important;
            padding: ${printFormat === 'THERMAL' ? '2mm' : '8mm'} !important;
            box-shadow: none !important;
            border: none !important;
            background: #ffffff !important;
            color: #000000 !important;
            display: block !important;
            page-break-inside: avoid;
          }

          .thermal-mode {
            width: 80mm !important;
            max-width: 80mm !important;
            padding: 2mm !important;
            margin: 0 auto !important;
            font-size: 11px !important;
          }
        }
      `}</style>

      {/* Main Card Container */}
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: printFormat === 'THERMAL' ? '460px' : '760px',
          background: '#ffffff',
          borderRadius: '8px',
          border: '1px solid #cbd5e1',
          boxShadow: 'var(--shadow-md)',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* Top Operational Bar (Hidden during Print) */}
        <div
          className="invoice-non-printable"
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
            <span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#ffffff', letterSpacing: '-0.01em' }}>
              ORDER #{order.order_number}
            </span>
            <span
              style={{
                fontSize: '0.68rem',
                fontWeight: 800,
                backgroundColor: '#991b1b',
                color: '#ffffff',
                padding: '0.12rem 0.45rem',
                borderRadius: '4px',
                textTransform: 'uppercase',
              }}
            >
              {order.status}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            {/* Format Toggle: A4 Standard vs 80mm Thermal */}
            <div
              style={{
                display: 'inline-flex',
                background: '#1e293b',
                borderRadius: '4px',
                padding: '2px',
                border: '1px solid #334155',
              }}
            >
              <button
                type="button"
                onClick={() => setPrintFormat('A4')}
                style={{
                  padding: '0.25rem 0.55rem',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  background: printFormat === 'A4' ? '#b91c1c' : 'transparent',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '3px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                }}
              >
                <FileText size={12} />
                <span>A4 Invoice</span>
              </button>
              <button
                type="button"
                onClick={() => setPrintFormat('THERMAL')}
                style={{
                  padding: '0.25rem 0.55rem',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  background: printFormat === 'THERMAL' ? '#b91c1c' : 'transparent',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '3px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                }}
              >
                <Receipt size={12} />
                <span>80mm POS Slip</span>
              </button>
            </div>

            {/* GST Checkbox */}
            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontSize: '0.75rem',
                fontWeight: 600,
                color: '#cbd5e1',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={applyGst}
                onChange={(e) => setApplyGst(e.target.checked)}
                style={{ accentColor: '#b91c1c', cursor: 'pointer' }}
              />
              <span>5% GST</span>
            </label>

            {isWhatsAppEnabled && (
              <>
                <button
                  type="button"
                  disabled={isSendingWhatsAppFile}
                  onClick={() => handleWhatsAppSendFile('IMAGE')}
                  title="Send Bill Image directly to customer WhatsApp (Recommended)"
                  style={{
                    padding: '0.35rem 0.75rem',
                    background: '#047857',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    cursor: isSendingWhatsAppFile ? 'wait' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    opacity: isSendingWhatsAppFile ? 0.7 : 1,
                    boxShadow: '0 2px 4px rgba(4, 120, 87, 0.25)',
                  }}
                >
                  {isSendingWhatsAppFile ? <Loader2 size={13} className="animate-spin" /> : <ImageIcon size={13} />}
                  <span>Send Bill Image (Default)</span>
                </button>

                <button
                  type="button"
                  disabled={isSendingWhatsAppFile}
                  onClick={() => handleWhatsAppSendFile('PDF')}
                  title="Send actual PDF Bill directly to customer WhatsApp"
                  style={{
                    padding: '0.35rem 0.65rem',
                    background: '#16a34a',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: isSendingWhatsAppFile ? 'wait' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    opacity: isSendingWhatsAppFile ? 0.7 : 1,
                  }}
                >
                  <FileText size={13} />
                  <span>Send PDF</span>
                </button>

                <button
                  type="button"
                  onClick={handleWhatsAppShare}
                  title="Share text summary via WhatsApp link"
                  style={{
                    padding: '0.35rem 0.55rem',
                    background: 'transparent',
                    color: '#15803d',
                    border: '1px solid #86efac',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                  }}
                >
                  <MessageCircle size={12} />
                  <span>Text</span>
                </button>

                {whatsAppFileStatus && (
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      color: '#15803d',
                      background: '#dcfce7',
                      padding: '2px 8px',
                      borderRadius: '12px',
                    }}
                  >
                    {whatsAppFileStatus}
                  </span>
                )}
              </>
            )}

            <button
              type="button"
              onClick={handlePrint}
              style={{
                padding: '0.35rem 0.75rem',
                background: '#b91c1c',
                color: '#ffffff',
                border: 'none',
                borderRadius: '4px',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer',
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

        {/* ==================================================================== */}
        {/* PRINTABLE CONTENT AREA                                               */}
        {/* ==================================================================== */}
        <div
          ref={invoiceRef}
          className={`invoice-printable-wrapper ${printFormat === 'THERMAL' ? 'thermal-mode' : ''}`}
          style={{
            padding: printFormat === 'THERMAL' ? '1rem' : '1.75rem',
            backgroundColor: '#ffffff',
            color: '#0f172a',
            fontFamily: printFormat === 'THERMAL' ? 'monospace, system-ui, sans-serif' : 'system-ui, -apple-system, sans-serif',
          }}
        >
          {printFormat === 'THERMAL' ? (
            /* ─────────────────────────────────────────────────────────────
               FORMAT 1: 80mm THERMAL POS RECEIPT LAYOUT
            ───────────────────────────────────────────────────────────── */
            <div style={{ maxWidth: '340px', margin: '0 auto', fontSize: '12px', lineHeight: 1.35 }}>
              {/* Header */}
              <div style={{ textAlign: 'center', paddingBottom: '0.75rem', borderBottom: '1px dashed #0f172a' }}>
                <img
                  src="/app-icon.png"
                  alt="Store Logo"
                  style={{ width: '42px', height: '42px', objectFit: 'contain', margin: '0 auto 0.35rem', display: 'block' }}
                  onError={(e) => {
                    (e.currentTarget as HTMLElement).style.display = 'none';
                  }}
                />
                <div style={{ fontWeight: 900, fontSize: '15px', letterSpacing: '0.02em', textTransform: 'uppercase' }}>
                  {storeName}
                </div>
                <div style={{ fontSize: '11px', color: '#334155', marginTop: '2px' }}>
                  {storeAddress}
                </div>
                <div style={{ fontSize: '11px', fontWeight: 700, marginTop: '2px' }}>
                  Ph: {storePhone}
                </div>
                {storeGst && (
                  <div style={{ fontSize: '11px', fontWeight: 800, marginTop: '2px' }}>
                    GSTIN: {storeGst}
                  </div>
                )}
                <div style={{ fontWeight: 800, fontSize: '12px', marginTop: '0.5rem', borderTop: '1px solid #0f172a', paddingTop: '0.35rem' }}>
                  TAX INVOICE / POS RECEIPT
                </div>
              </div>

              {/* Order & Customer Metadata */}
              <div style={{ padding: '0.5rem 0', borderBottom: '1px dashed #0f172a', fontSize: '11px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Bill No: <strong>#{order.order_number}</strong></span>
                  <span>Date: {order.order_date}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
                  <span>Customer: <strong>{cust?.name || 'Customer'}</strong></span>
                </div>
                {cust?.phone && <div>Phone: {cust.phone}</div>}
                {order.route_details?.name && <div>Route: {order.route_details.name}</div>}
                {order.driver_name && <div>Driver: {order.driver_name}</div>}
              </div>

              {/* Itemized Table */}
              <div style={{ padding: '0.5rem 0', borderBottom: '1px dashed #0f172a' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, borderBottom: '1px solid #0f172a', paddingBottom: '3px', fontSize: '11px' }}>
                  <span style={{ width: '45%' }}>Item</span>
                  <span style={{ width: '15%', textAlign: 'right' }}>Qty</span>
                  <span style={{ width: '20%', textAlign: 'right' }}>Rate</span>
                  <span style={{ width: '20%', textAlign: 'right' }}>Total</span>
                </div>
                {order.items.map((it) => (
                  <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: '11px' }}>
                    <span style={{ width: '45%', fontWeight: 600 }}>{it.product_details?.name || 'Item'}</span>
                    <span style={{ width: '15%', textAlign: 'right' }}>{it.quantity}</span>
                    <span style={{ width: '20%', textAlign: 'right' }}>₹{Number(it.unit_price).toFixed(2)}</span>
                    <span style={{ width: '20%', textAlign: 'right', fontWeight: 700 }}>₹{Number(it.subtotal).toFixed(2)}</span>
                  </div>
                ))}
              </div>

              {/* Totals Breakdown */}
              <div style={{ padding: '0.5rem 0', borderBottom: '1px dashed #0f172a', fontSize: '11px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Subtotal:</span>
                  <span>₹{subtotal.toFixed(2)}</span>
                </div>
                {applyGst && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>GST (5%):</span>
                    <span>₹{gstAmount.toFixed(2)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: '13px', marginTop: '3px' }}>
                  <span>CURRENT BILL:</span>
                  <span>₹{finalTotal.toFixed(2)}</span>
                </div>
                {prevCredit > 0 && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '3px', color: '#b91c1c' }}>
                      <span>Previous Due:</span>
                      <span>₹{prevCredit.toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: '13px', marginTop: '3px', borderTop: '1px solid #0f172a', paddingTop: '3px' }}>
                      <span>NET TOTAL DUE:</span>
                      <span>₹{totalAccountDue.toFixed(2)}</span>
                    </div>
                  </>
                )}
              </div>

              {/* Thermal Footer */}
              <div style={{ textAlign: 'center', paddingTop: '0.65rem', fontSize: '10px', color: '#334155' }}>
                {storeUpi && <div>UPI: <strong>{storeUpi}</strong></div>}
                <div style={{ marginTop: '3px' }}>{storeFooterNotes}</div>
                <div style={{ marginTop: '6px', fontWeight: 700 }}>* Thank You — Visit Again *</div>
              </div>
            </div>
          ) : (
            /* ─────────────────────────────────────────────────────────────
               FORMAT 2: STANDARD A4/A5 PROFESSIONAL TAX INVOICE
            ───────────────────────────────────────────────────────────── */
            <div>
              {/* Header with Store Identity, Logo & GSTIN */}
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
                        Phone: <strong>{storePhone}</strong> {storeEmail ? ` | Email: ${storeEmail}` : ''}
                      </div>
                      {storeGst && (
                        <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0f172a', marginTop: '3px' }}>
                          GSTIN: <span style={{ color: '#b91c1c', fontFamily: 'monospace' }}>{storeGst}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#0f172a' }}>
                      TAX INVOICE
                    </div>
                    <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#b91c1c', marginTop: '2px' }}>
                      Invoice No: <span style={{ fontFamily: 'monospace' }}>#{order.order_number}</span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: '2px' }}>
                      Date: <strong>{order.order_date}</strong>
                    </div>
                    {order.route_details?.name && (
                      <div style={{ fontSize: '0.8rem', color: '#475569' }}>
                        Route: <strong>{order.route_details.name}</strong>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Billed To (Customer Details) & Dispatch Details */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
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
                    BILLED TO (CUSTOMER):
                  </span>
                  <div style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>
                    {cust?.name || 'Customer'}
                  </div>
                  {cust?.owner_name && <div>Contact Person: <strong>{cust.owner_name}</strong></div>}
                  {cust?.phone && <div>Phone: <strong>{cust.phone}</strong></div>}
                  {cust?.address && <div>Address: {cust.address}</div>}
                </div>

                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '3px' }}>
                    DISPATCH & PAYMENT STATUS:
                  </span>
                  <div>Order Reference: <strong style={{ fontFamily: 'monospace' }}>#{order.order_number}</strong></div>
                  <div>Delivery Status: <strong style={{ color: '#b91c1c' }}>{order.status}</strong></div>
                  {order.driver_name && <div>Delivery Driver: <strong>{order.driver_name}</strong></div>}
                  <div>Created On: {new Date(order.created_at).toLocaleDateString()}</div>
                </div>
              </div>

              {/* Products Table */}
              <div style={{ overflowX: 'auto', marginBottom: '1.25rem' }}>
                <table className="data-table" style={{ width: '100%', fontSize: '0.82rem', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '2px solid #cbd5e1' }}>
                      <th style={{ padding: '0.5rem 0.6rem', textAlign: 'center', width: '36px' }}>#</th>
                      <th style={{ padding: '0.5rem 0.6rem', textAlign: 'left' }}>Item Description</th>
                      <th style={{ padding: '0.5rem 0.6rem', textAlign: 'right', width: '80px' }}>Quantity</th>
                      <th style={{ padding: '0.5rem 0.6rem', textAlign: 'right', width: '100px' }}>Unit Rate (₹)</th>
                      <th style={{ padding: '0.5rem 0.6rem', textAlign: 'right', width: '110px' }}>Total (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.items.map((item, idx) => (
                      <tr key={item.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '0.55rem 0.6rem', textAlign: 'center', color: '#64748b', fontFamily: 'monospace' }}>
                          {idx + 1}
                        </td>
                        <td style={{ padding: '0.55rem 0.6rem' }}>
                          <div style={{ fontWeight: 700, color: '#0f172a' }}>
                            {item.product_details?.name || 'Product'}
                          </div>
                          {item.product_details?.packet_size && (
                            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                              Pack: {item.product_details.packet_size}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '0.55rem 0.6rem', textAlign: 'right', fontWeight: 600 }}>
                          {item.quantity}
                        </td>
                        <td style={{ padding: '0.55rem 0.6rem', textAlign: 'right', fontFamily: 'monospace' }}>
                          ₹{Number(item.unit_price).toFixed(2)}
                        </td>
                        <td style={{ padding: '0.55rem 0.6rem', textAlign: 'right', fontFamily: 'monospace', fontWeight: 800 }}>
                          ₹{Number(item.subtotal).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Financial Summary & Outstanding Ledger Section */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                  gap: '1.25rem',
                  alignItems: 'start',
                  paddingTop: '0.5rem',
                  borderTop: '1px solid #e2e8f0',
                }}
              >
                {/* Payment & Terms Note */}
                <div style={{ fontSize: '0.78rem', color: '#475569' }}>
                  <div
                    style={{
                      padding: '0.75rem',
                      background: '#f8fafc',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                    }}
                  >
                    <div style={{ fontWeight: 800, textTransform: 'uppercase', color: '#0f172a', marginBottom: '3px', fontSize: '0.74rem' }}>
                      Payment Methods & Terms:
                    </div>
                    <div>Cash on Delivery or UPI to authorized distribution driver.</div>
                    {storeUpi && (
                      <div style={{ marginTop: '4px', fontWeight: 700, color: '#0f172a' }}>
                        UPI / VPA: <span style={{ fontFamily: 'monospace', color: '#b91c1c' }}>{storeUpi}</span>
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '0.5rem', fontStyle: 'italic' }}>
                    * Outstanding balance is verified and synchronized with the live wholesale distribution credit ledger.
                  </div>
                </div>

                {/* Calculation Table */}
                <div
                  style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    padding: '0.85rem 1rem',
                    fontSize: '0.84rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.35rem' }}>
                    <span style={{ color: '#475569' }}>Invoice Subtotal:</span>
                    <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>₹{subtotal.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.35rem' }}>
                    <span style={{ color: '#475569' }}>Tax / GST (5%):</span>
                    <span style={{ fontFamily: 'monospace', color: applyGst ? '#0f172a' : '#94a3b8' }}>
                      {applyGst ? `₹${gstAmount.toFixed(2)}` : '₹0.00 (Exempt)'}
                    </span>
                  </div>

                  <div
                    style={{
                      borderTop: '1px solid #cbd5e1',
                      paddingTop: '0.45rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontWeight: 800,
                      fontSize: '0.98rem',
                      color: '#b91c1c',
                    }}
                  >
                    <span>Current Bill Total:</span>
                    <span style={{ fontFamily: 'monospace' }}>₹{finalTotal.toFixed(2)}</span>
                  </div>

                  {prevCredit > 0 && (
                    <div style={{ borderTop: '1px dashed #cbd5e1', marginTop: '0.5rem', paddingTop: '0.45rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#475569' }}>
                        <span>Previous Outstanding Due:</span>
                        <span style={{ fontFamily: 'monospace', color: '#b91c1c', fontWeight: 700 }}>₹{prevCredit.toFixed(2)}</span>
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontWeight: 900,
                          fontSize: '1rem',
                          color: '#0f172a',
                          background: '#fef2f2',
                          padding: '0.35rem 0.5rem',
                          borderRadius: '4px',
                          marginTop: '4px',
                          border: '1px solid #fecaca',
                        }}
                      >
                        <span>Net Account Due:</span>
                        <span style={{ fontFamily: 'monospace', color: '#b91c1c' }}>
                          ₹{totalAccountDue.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer Notes */}
              {storeFooterNotes && (
                <div
                  style={{
                    marginTop: '1rem',
                    padding: '0.6rem 0.85rem',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '4px',
                    fontSize: '0.74rem',
                    color: '#475569',
                    fontStyle: 'italic',
                  }}
                >
                  {storeFooterNotes}
                </div>
              )}

              {/* Authorized Signatures */}
              <div
                style={{
                  marginTop: '1.75rem',
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
                  <div style={{ height: '40px' }} />
                  <div style={{ borderTop: '1px dashed #94a3b8', paddingTop: '4px', fontWeight: 600 }}>
                    Customer Signature & Seal
                  </div>
                </div>
                <div>
                  <div style={{ height: '40px' }} />
                  <div style={{ borderTop: '1px dashed #94a3b8', paddingTop: '4px', fontWeight: 700, color: '#b91c1c' }}>
                    For {storeName} (Authorized Signatory)
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
