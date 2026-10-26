import React, { useState, useEffect, useRef } from 'react';
import { Customer, Order } from '../types';
import { sendInvoiceFileViaBridge, checkWhatsAppBridgeStatus, BridgeStatus, getWhatsAppBridgeQrUrl } from '../utils/whatsappBridgeUtils';
import { useSettings } from '../context/SettingsContext';
import {
  MessageCircle,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileText,
  Image as ImageIcon,
  Send,
  Pause,
  Play,
  RotateCcw,
  CheckSquare,
  Square,
  AlertTriangle,
  Clock,
  Minimize2,
  Maximize2,
  EyeOff,
  ShieldCheck,
} from 'lucide-react';
import { formatCurrency } from '../utils/formatters';

export interface BulkBillProductLine {
  id?: string;
  name: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  packetSize?: string;
}

export interface BulkBillItem {
  rowId: string;
  orderId?: string;
  orderNumber?: string;
  customerId: string;
  customerName: string;
  customerPhone?: string;
  ownerName?: string;
  customerAddress?: string;
  customerRoute?: string;
  driverName?: string;
  itemsSummary: string;
  lines?: BulkBillProductLine[];
  totalAmount: number;
  prevDue: number;
  orderDate: string;
  fullOrder?: Order;
  // Execution status
  status: 'PENDING' | 'SENDING' | 'SENT' | 'ERROR';
  errorMessage?: string;
}

interface BulkSendWhatsAppBillsModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderDate: string;
  orders: BulkBillItem[];
}

export const BulkSendWhatsAppBillsModal: React.FC<BulkSendWhatsAppBillsModalProps> = ({
  isOpen,
  onClose,
  orderDate,
  orders,
}) => {
  const { businessName, businessPhone, gstNumber, settings } = useSettings();
  const [items, setItems] = useState<BulkBillItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sendFormat, setSendFormat] = useState<'PDF' | 'IMAGE'>('IMAGE');
  const [isSending, setIsSending] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentSendingItem, setCurrentSendingItem] = useState<BulkBillItem | null>(null);
  const [sendProgress, setSendProgress] = useState<{ current: number; total: number } | null>(null);
  const [bridgeStatus, setBridgeStatus] = useState<BridgeStatus | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isAntiBanSafeMode, setIsAntiBanSafeMode] = useState(true);
  const [safetyStatusMessage, setSafetyStatusMessage] = useState<string | null>(null);

  // Hidden print element ref for generating canvas/PDF
  const renderContainerRef = useRef<HTMLDivElement>(null);
  const [renderOrder, setRenderOrder] = useState<BulkBillItem | null>(null);

  // Stop flag ref for pause/cancel
  const shouldStopRef = useRef(false);

  useEffect(() => {
    if (isOpen) {
      checkWhatsAppBridgeStatus().then(setBridgeStatus);
      const validOrders = orders.filter((o) => o.totalAmount > 0 || (o.orderId && o.itemsSummary));
      setItems(validOrders.map((o) => ({ ...o, status: 'PENDING' })));
      // Select all by default
      setSelectedIds(new Set(validOrders.map((o) => o.rowId)));
      setIsSending(false);
      setIsPaused(false);
      setCurrentSendingItem(null);
      setSendProgress(null);
      setIsCompleted(false);
      setIsMinimized(false);
      shouldStopRef.current = false;
    }
  }, [isOpen, orders]);

  if (!isOpen) return null;

  const storeName = businessName || settings?.business_name || 'Zamzam Foods Wholesale';
  const storePhone = businessPhone || settings?.phone_number || '+91 98470 12345';
  const storeGst = gstNumber || settings?.gst_number || '';
  const storeAddress = settings?.address || 'Main Road, Pandikkad, Malappuram, Kerala';
  const storeUpi = settings?.upi_id || '9847012345@upi';
  const storeEmail = settings?.email || 'billing@zamzamfoods.com';
  const storeFooterNotes = settings?.invoice_footer_notes || 'Thank you for choosing Zamzam Foods Wholesale! Fresh Kubbus & Romali Delivered Daily.';

  const selectedCount = selectedIds.size;
  const sentCount = items.filter((it) => it.status === 'SENT').length;
  const errorCount = items.filter((it) => it.status === 'ERROR').length;
  const progressPercent = sendProgress && sendProgress.total > 0
    ? Math.round(((sendProgress.current - (isSending ? 1 : 0)) / sendProgress.total) * 100)
    : selectedCount > 0 ? Math.round((sentCount / selectedCount) * 100) : 0;

  const toggleSelectAll = () => {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map((it) => it.rowId)));
    }
  };

  const toggleSelect = (rowId: string) => {
    if (isSending) return;
    const next = new Set(selectedIds);
    if (next.has(rowId)) next.delete(rowId);
    else next.add(rowId);
    setSelectedIds(next);
  };

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  // Core Bulk Send Loop
  const handleStartSending = async () => {
    if (!bridgeStatus?.connected) {
      const openQr = window.confirm(
        'WhatsApp is not linked on your laptop yet.\nWould you like to open the QR Code page to link your phone now?'
      );
      if (openQr) {
        window.open(getWhatsAppBridgeQrUrl(), '_blank');
      }
      return;
    }

    const queue = items.filter((it) => selectedIds.has(it.rowId) && it.status !== 'SENT');
    if (queue.length === 0) {
      alert('No pending orders selected to send.');
      return;
    }

    setIsSending(true);
    setIsPaused(false);
    setIsCompleted(false);
    shouldStopRef.current = false;
    setSendProgress({ current: 1, total: queue.length });

    for (let i = 0; i < queue.length; i++) {
      if (shouldStopRef.current) break;

      const currentItem = queue[i];
      setCurrentSendingItem(currentItem);
      setSendProgress({ current: i + 1, total: queue.length });

      // Check phone number
      if (!currentItem.customerPhone) {
        setItems((prev) =>
          prev.map((it) =>
            it.rowId === currentItem.rowId
              ? { ...it, status: 'ERROR', errorMessage: 'Missing customer phone number' }
              : it
          )
        );
        continue;
      }

      // Set item to SENDING
      setItems((prev) =>
        prev.map((it) => (it.rowId === currentItem.rowId ? { ...it, status: 'SENDING' } : it))
      );

      // 1. Render invoice HTML in off-screen container
      setRenderOrder(currentItem);
      // Wait for React to render the DOM & layout fully
      await sleep(350);

      try {
        if (!renderContainerRef.current) {
          throw new Error('Render container not ready');
        }

        const custName = currentItem.customerName;
        const total = currentItem.totalAmount;
        const prevDue = currentItem.prevDue || 0;
        const totalDue = total + prevDue;

        const caption =
          `*${storeName.toUpperCase()}*\n` +
          `TAX INVOICE: *#${currentItem.orderNumber || 'BILL'}*\n` +
          `Date: ${currentItem.orderDate}\n` +
          `Customer: *${custName}*\n` +
          `Bill Total: ₹${total.toFixed(2)}\n` +
          (prevDue > 0 ? `Previous Due: ₹${prevDue.toFixed(2)}\nTotal Account Due: ₹${totalDue.toFixed(2)}\n` : '') +
          `\nThank you for choosing ${storeName}!`;

        const res = await sendInvoiceFileViaBridge({
          phone: currentItem.customerPhone,
          element: renderContainerRef.current,
          orderNumber: currentItem.orderNumber || 'BILL',
          format: sendFormat,
          caption,
        });

        if (res.success) {
          setItems((prev) =>
            prev.map((it) => (it.rowId === currentItem.rowId ? { ...it, status: 'SENT' } : it))
          );
        } else {
          setItems((prev) =>
            prev.map((it) =>
              it.rowId === currentItem.rowId
                ? { ...it, status: 'ERROR', errorMessage: res.error || 'Send failed' }
                : it
            )
          );
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setItems((prev) =>
          prev.map((it) =>
            it.rowId === currentItem.rowId ? { ...it, status: 'ERROR', errorMessage: msg } : it
          )
        );
      }

      // Anti-Ban Safe Throttling & Breather Cooldowns
      if (i < queue.length - 1 && !shouldStopRef.current) {
        // Every 25 sends, take a 15-second breather cooldown if in Safe Mode
        if (isAntiBanSafeMode && (i + 1) % 25 === 0) {
          for (let s = 15; s > 0; s--) {
            if (shouldStopRef.current) break;
            setSafetyStatusMessage(`☕ Safety cooldown: pausing ${s}s after 25 sends...`);
            await sleep(1000);
          }
          setSafetyStatusMessage(null);
        } else {
          // Human-like randomized jitter delay (3.2s to 5.5s) in Safe Mode, or 1.8s in Fast Mode
          const delay = isAntiBanSafeMode ? Math.floor(3200 + Math.random() * 2300) : 1800;
          if (isAntiBanSafeMode) {
            setSafetyStatusMessage(`🛡️ Anti-ban delay (${(delay / 1000).toFixed(1)}s)...`);
          }
          await sleep(delay);
          setSafetyStatusMessage(null);
        }
      }
    }

    setSafetyStatusMessage(null);

    setIsSending(false);
    setCurrentSendingItem(null);
    setRenderOrder(null);
    setIsCompleted(true);
  };

  const handleStopSending = () => {
    shouldStopRef.current = true;
    setIsSending(false);
    setCurrentSendingItem(null);
  };

  return (
    <>
      {/* Minimized Floating Background Status Widget */}
      {isMinimized && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 99999,
            backgroundColor: '#0f172a',
            color: '#ffffff',
            borderRadius: '14px',
            padding: '0.85rem 1.1rem',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.15)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.55rem',
            minWidth: '340px',
            maxWidth: '420px',
            animation: 'fadeIn 0.2s ease-out',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  backgroundColor: '#16a34a',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <MessageCircle size={18} color="#ffffff" />
              </div>
              <div>
                <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  {isSending ? (
                    <>
                      <Loader2 size={12} className="animate-spin" color="#4ade80" />
                      <span>Sending Bills in Background</span>
                    </>
                  ) : isCompleted ? (
                    <>
                      <CheckCircle2 size={13} color="#4ade80" />
                      <span>Bills Sending Completed</span>
                    </>
                  ) : (
                    <span>WhatsApp Bills</span>
                  )}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '2px' }}>
                  {currentSendingItem
                    ? `${currentSendingItem.customerName} (${sendFormat})`
                    : `${sentCount} sent of ${selectedCount}`}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <button
                type="button"
                onClick={() => setIsMinimized(false)}
                title="Expand back to full window"
                style={{
                  backgroundColor: '#334155',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '0.35rem 0.65rem',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  cursor: 'pointer',
                }}
              >
                <Maximize2 size={12} />
                <span>Open</span>
              </button>

              {isSending ? (
                <button
                  type="button"
                  onClick={handleStopSending}
                  title="Stop sending"
                  style={{
                    backgroundColor: '#dc2626',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '0.35rem 0.65rem',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    cursor: 'pointer',
                  }}
                >
                  <Pause size={12} />
                  <span>Stop</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onClose}
                  title="Close widget"
                  style={{
                    backgroundColor: 'transparent',
                    color: '#94a3b8',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '0.3rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Mini progress bar */}
          <div style={{ width: '100%', height: '5px', backgroundColor: '#334155', borderRadius: '9999px', overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${progressPercent}%`,
                backgroundColor: '#22c55e',
                transition: 'width 0.3s ease',
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: '#94a3b8' }}>
            <span>Progress: {progressPercent}%</span>
            <span>{sentCount} of {selectedCount} sent</span>
          </div>
        </div>
      )}

      {/* Full Modal (shown when NOT minimized) */}
      {!isMinimized && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            backgroundColor: 'rgba(15, 23, 42, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '780px',
              maxHeight: '90vh',
              backgroundColor: 'var(--bg-main, #ffffff)',
              borderRadius: '16px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              border: '1px solid var(--border, #e2e8f0)',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '1.25rem 1.5rem',
                borderBottom: '1px solid var(--border, #e2e8f0)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'linear-gradient(135deg, #15803d 0%, #166534 100%)',
                color: '#ffffff',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: '10px',
                    backgroundColor: 'rgba(255, 255, 255, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <MessageCircle size={22} color="#ffffff" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>
                    Bulk Send WhatsApp Bills
                  </h3>
                  <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.8rem', opacity: 0.9 }}>
                    Send official PDF or Image bills to all customers with orders for {orderDate}
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {isSending && (
                  <button
                    type="button"
                    onClick={() => setIsMinimized(true)}
                    title="Hide window and continue sending in background"
                    style={{
                      background: 'rgba(255, 255, 255, 0.2)',
                      border: 'none',
                      color: '#ffffff',
                      padding: '0.35rem 0.75rem',
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      fontSize: '0.76rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    <Minimize2 size={14} />
                    <span>Hide / Background</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => (isSending ? setIsMinimized(true) : onClose())}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#ffffff',
                    cursor: 'pointer',
                    padding: '6px',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  title={isSending ? 'Hide to background' : 'Close'}
                >
                  {isSending ? <Minimize2 size={18} /> : <X size={20} />}
                </button>
              </div>
            </div>

        {/* Options Bar */}
        <div
          style={{
            padding: '0.85rem 1.5rem',
            backgroundColor: 'var(--bg-card, #f8fafc)',
            borderBottom: '1px solid var(--border, #e2e8f0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          {/* Format Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)' }}>
              Format:
            </span>
            <button
              type="button"
              disabled={isSending}
              onClick={() => setSendFormat('IMAGE')}
              style={{
                padding: '0.35rem 0.75rem',
                borderRadius: '6px',
                fontSize: '0.78rem',
                fontWeight: 700,
                border: sendFormat === 'IMAGE' ? '2px solid #047857' : '1px solid var(--border)',
                backgroundColor: sendFormat === 'IMAGE' ? '#ccfbf1' : 'transparent',
                color: sendFormat === 'IMAGE' ? '#0f766e' : 'var(--text-muted)',
                cursor: isSending ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
            >
              <ImageIcon size={14} />
              <span>Bill Image (JPG - Default)</span>
            </button>

            <button
              type="button"
              disabled={isSending}
              onClick={() => setSendFormat('PDF')}
              style={{
                padding: '0.35rem 0.75rem',
                borderRadius: '6px',
                fontSize: '0.78rem',
                fontWeight: 700,
                border: sendFormat === 'PDF' ? '2px solid #16a34a' : '1px solid var(--border)',
                backgroundColor: sendFormat === 'PDF' ? '#dcfce7' : 'transparent',
                color: sendFormat === 'PDF' ? '#15803d' : 'var(--text-muted)',
                cursor: isSending ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
            >
              <FileText size={14} />
              <span>PDF Document</span>
            </button>
          </div>

          {/* Anti-Ban Protection Toggle & Bridge Status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <button
              type="button"
              disabled={isSending}
              onClick={() => setIsAntiBanSafeMode(!isAntiBanSafeMode)}
              style={{
                padding: '0.35rem 0.75rem',
                borderRadius: '6px',
                fontSize: '0.78rem',
                fontWeight: 700,
                border: isAntiBanSafeMode ? '2px solid #059669' : '1px solid var(--border, #cbd5e1)',
                backgroundColor: isAntiBanSafeMode ? '#ecfdf5' : 'transparent',
                color: isAntiBanSafeMode ? '#065f46' : 'var(--text-muted, #64748b)',
                cursor: isSending ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                transition: 'all 0.15s ease',
              }}
              title={
                isAntiBanSafeMode
                  ? 'Anti-Ban Active: Human-like 3-5s random delays + 15s pause every 25 sends to protect your account'
                  : 'Fast Mode: 1.8s fixed delay (use only for small batches)'
              }
            >
              <ShieldCheck size={14} color={isAntiBanSafeMode ? '#059669' : '#94a3b8'} />
              <span>{isAntiBanSafeMode ? '🛡️ Safe Anti-Ban (3-5s)' : '⚡ Fast Mode (1.8s)'}</span>
            </button>

            <span
              style={{
                fontSize: '0.76rem',
                fontWeight: 700,
                padding: '3px 10px',
                borderRadius: '12px',
                backgroundColor: bridgeStatus?.connected ? '#dcfce7' : '#fee2e2',
                color: bridgeStatus?.connected ? '#15803d' : '#b91c1c',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  backgroundColor: bridgeStatus?.connected ? '#22c55e' : '#ef4444',
                }}
              />
              {bridgeStatus?.connected
                ? `Connected (${bridgeStatus.info?.phone || 'WhatsApp Ready'})`
                : 'WhatsApp Bridge Offline'}
            </span>
          </div>
        </div>

        {/* Live Progress Bar & Currently Sending Customer Indicator */}
        {(isSending || isCompleted || sentCount > 0 || errorCount > 0) && (
          <div
            style={{
              padding: '1rem 1.5rem',
              backgroundColor: isSending ? '#f0fdf4' : isCompleted && errorCount === 0 ? '#ecfdf5' : '#f8fafc',
              borderBottom: '1px solid #bbf7d0',
            }}
          >
            {/* Header info */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '0.5rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                {isSending ? (
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      backgroundColor: '#dcfce7',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Loader2 size={18} className="animate-spin" color="#16a34a" />
                  </div>
                ) : isCompleted ? (
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      backgroundColor: errorCount === 0 ? '#dcfce7' : '#fee2e2',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {errorCount === 0 ? (
                      <CheckCircle2 size={18} color="#15803d" />
                    ) : (
                      <AlertCircle size={18} color="#b91c1c" />
                    )}
                  </div>
                ) : (
                  <Clock size={18} color="#64748b" />
                )}

                <div>
                  {isSending && currentSendingItem ? (
                    <div>
                      <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#166534', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span>Sending to: {currentSendingItem.customerName}</span>
                        <span
                          style={{
                            fontSize: '0.68rem',
                            padding: '1px 6px',
                            borderRadius: '4px',
                            backgroundColor: sendFormat === 'PDF' ? '#dbeafe' : '#ccfbf1',
                            color: sendFormat === 'PDF' ? '#1d4ed8' : '#0f766e',
                            fontWeight: 700,
                          }}
                        >
                          {sendFormat}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.74rem', color: '#15803d', marginTop: '1px' }}>
                        📞 {currentSendingItem.customerPhone || 'No Phone'} • Bill #{currentSendingItem.orderNumber || 'BILL'} ({formatCurrency(currentSendingItem.totalAmount)})
                      </div>
                      {safetyStatusMessage && (
                        <div style={{ fontSize: '0.72rem', color: '#b45309', fontWeight: 700, marginTop: '2px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <span>{safetyStatusMessage}</span>
                        </div>
                      )}
                    </div>
                  ) : isCompleted ? (
                    <div>
                      <div style={{ fontSize: '0.88rem', fontWeight: 800, color: errorCount === 0 ? '#15803d' : '#b91c1c' }}>
                        {errorCount === 0 ? '🎉 All Bills Dispatched Successfully!' : `Finished: ${sentCount} Sent, ${errorCount} Failed`}
                      </div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                        All selected customers received their official {sendFormat} bill on WhatsApp.
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>
                      Ready to send bills to {selectedCount} customers
                    </div>
                  )}
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.95rem', fontWeight: 900, color: '#166534' }}>
                  {progressPercent}%
                </span>
                <div style={{ fontSize: '0.72rem', color: '#15803d' }}>
                  {sendProgress ? `${sendProgress.current} of ${sendProgress.total}` : `${sentCount}/${selectedCount}`}
                </div>
              </div>
            </div>

            {/* Progress Bar */}
            <div
              style={{
                width: '100%',
                height: '9px',
                backgroundColor: '#bbf7d0',
                borderRadius: '6px',
                overflow: 'hidden',
                boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.1)',
              }}
            >
              <div
                style={{
                  width: `${progressPercent}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #22c55e 0%, #16a34a 100%)',
                  borderRadius: '6px',
                  transition: 'width 0.4s ease',
                }}
              />
            </div>
          </div>
        )}

        {/* Customer List Header */}
        <div
          style={{
            padding: '0.65rem 1.5rem',
            borderBottom: '1px solid var(--border, #e2e8f0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--bg-card, #f8fafc)',
            fontSize: '0.78rem',
            fontWeight: 700,
            color: 'var(--text-muted)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <button
              type="button"
              disabled={isSending}
              onClick={toggleSelectAll}
              style={{
                background: 'none',
                border: 'none',
                cursor: isSending ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                padding: 0,
                color: selectedCount === items.length ? '#16a34a' : 'var(--text-muted)',
              }}
            >
              {selectedCount === items.length ? <CheckSquare size={16} /> : <Square size={16} />}
            </button>
            <span>
              SELECT SHOPS ({selectedCount}/{items.length})
            </span>
          </div>

          <div style={{ display: 'flex', gap: '2rem' }}>
            <span>ITEMS ORDERED</span>
            <span>BILL AMOUNT</span>
            <span style={{ width: '90px', textAlign: 'right' }}>STATUS</span>
          </div>
        </div>

        {/* Scrollable Customer List */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '0.5rem 1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.4rem',
          }}
        >
          {items.map((it) => {
            const isSelected = selectedIds.has(it.rowId);
            const isCurrent = isSending && currentSendingItem?.rowId === it.rowId;

            return (
              <div
                key={it.rowId}
                onClick={() => toggleSelect(it.rowId)}
                style={{
                  padding: '0.7rem 0.9rem',
                  borderRadius: '10px',
                  border: isCurrent
                    ? '2px solid #16a34a'
                    : isSelected
                    ? '1px solid #bbf7d0'
                    : '1px solid var(--border, #e2e8f0)',
                  backgroundColor: isCurrent
                    ? '#dcfce7'
                    : isSelected
                    ? 'rgba(240, 253, 244, 0.4)'
                    : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: isSending ? 'default' : 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {/* Checkbox & Shop Info */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', maxWidth: '40%' }}>
                  <div style={{ color: isSelected ? '#16a34a' : '#94a3b8' }}>
                    {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-main)' }}>
                        {it.customerName}
                      </span>
                      {it.orderNumber && (
                        <span
                          style={{
                            fontSize: '0.65rem',
                            fontWeight: 800,
                            padding: '1px 5px',
                            borderRadius: '3px',
                            backgroundColor: '#eff6ff',
                            color: '#1d4ed8',
                          }}
                        >
                          #{it.orderNumber}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {it.customerPhone ? (
                        <span>📞 {it.customerPhone}</span>
                      ) : (
                        <span style={{ color: '#dc2626', fontWeight: 600 }}>⚠️ No phone number</span>
                      )}
                      {it.ownerName && <span> • {it.ownerName}</span>}
                    </div>
                  </div>
                </div>

                {/* Items Summary */}
                <div
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--text-muted)',
                    maxWidth: '30%',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                  title={it.itemsSummary}
                >
                  {it.itemsSummary || 'Standard Daily Wholesale'}
                </div>

                {/* Bill Total */}
                <div style={{ textAlign: 'right', minWidth: '90px' }}>
                  <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#166534' }}>
                    {formatCurrency(it.totalAmount)}
                  </div>
                  {it.prevDue > 0 && (
                    <div style={{ fontSize: '0.68rem', color: '#dc2626' }}>
                      Due: {formatCurrency(it.prevDue)}
                    </div>
                  )}
                </div>

                {/* Status Column */}
                <div style={{ width: '90px', textAlign: 'right' }}>
                  {it.status === 'PENDING' && (
                    <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>
                      Pending
                    </span>
                  )}
                  {it.status === 'SENDING' && (
                    <span
                      style={{
                        fontSize: '0.72rem',
                        color: '#16a34a',
                        fontWeight: 700,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                      }}
                    >
                      <Loader2 size={12} className="animate-spin" />
                      Sending...
                    </span>
                  )}
                  {it.status === 'SENT' && (
                    <span
                      style={{
                        fontSize: '0.72rem',
                        color: '#15803d',
                        fontWeight: 700,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.2rem',
                      }}
                    >
                      <CheckCircle2 size={13} />
                      Sent ✓
                    </span>
                  )}
                  {it.status === 'ERROR' && (
                    <span
                      style={{
                        fontSize: '0.72rem',
                        color: '#dc2626',
                        fontWeight: 700,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.2rem',
                      }}
                      title={it.errorMessage}
                    >
                      <AlertCircle size={13} />
                      Failed
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Modal Footer Controls */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid var(--border, #e2e8f0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--bg-main, #ffffff)',
          }}
        >
          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Total Selected: <b>{selectedCount} Shops</b> (
            {formatCurrency(
              items.filter((it) => selectedIds.has(it.rowId)).reduce((sum, it) => sum + it.totalAmount, 0)
            )}
            )
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              type="button"
              disabled={isSending}
              onClick={onClose}
              className="btn btn-secondary btn-sm"
              style={{ padding: '0.45rem 1rem', fontSize: '0.82rem', fontWeight: 600 }}
            >
              Close
            </button>

            {isSending ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setIsMinimized(true)}
                  style={{
                    padding: '0.45rem 1rem',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    backgroundColor: '#f1f5f9',
                    color: '#0f172a',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    cursor: 'pointer',
                  }}
                  title="Hide window and continue sending in background"
                >
                  <EyeOff size={14} />
                  <span>Hide (Send in Background)</span>
                </button>

                <button
                  type="button"
                  onClick={handleStopSending}
                  style={{
                    padding: '0.45rem 1.25rem',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    backgroundColor: '#dc2626',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    cursor: 'pointer',
                  }}
                >
                  <Pause size={14} />
                  <span>Stop Sending</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={selectedCount === 0}
                onClick={handleStartSending}
                style={{
                  padding: '0.5rem 1.4rem',
                  fontSize: '0.88rem',
                  fontWeight: 800,
                  backgroundColor: selectedCount === 0 ? '#94a3b8' : '#16a34a',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  cursor: selectedCount === 0 ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 6px -1px rgba(22, 163, 74, 0.3)',
                }}
              >
                <Send size={15} />
                <span>
                  {sentCount > 0 && sentCount === selectedCount
                    ? 'Resend All Bills'
                    : `Send ${selectedCount} ${sendFormat} Bills on WhatsApp`}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )}


      {/* Hidden off-screen invoice container for html2canvas rendering (Exact A4 Tax Invoice Design) */}
      {renderOrder && (
        <div
          ref={renderContainerRef}
          style={{
            position: 'fixed',
            top: '-9999px',
            left: '-9999px',
            width: '760px',
            zIndex: -9999,
            pointerEvents: 'none',
            backgroundColor: '#ffffff',
            color: '#0f172a',
            padding: '28px 32px',
            fontFamily: 'Arial, Helvetica, sans-serif',
            boxSizing: 'border-box',
          }}
        >
          {/* Header with Store Identity, Logo & GSTIN */}
            <div style={{ borderBottom: '2px solid #b91c1c', paddingBottom: '0.85rem', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                  <img
                    src="/app-icon.png"
                    alt="Store Logo"
                    style={{
                      width: '52px',
                      height: '52px',
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
                    <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 900, color: '#b91c1c', textTransform: 'uppercase' }}>
                      {storeName}
                    </h2>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginTop: '2px' }}>
                      {storeAddress}
                    </div>
                    <div style={{ fontSize: '0.76rem', color: '#475569', marginTop: '2px' }}>
                      Phone: <strong>{storePhone}</strong> {storeEmail ? ` | Email: ${storeEmail}` : ''}
                    </div>
                    {storeGst && (
                      <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>
                        GSTIN: <span style={{ color: '#b91c1c', fontFamily: 'monospace' }}>{storeGst}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#0f172a' }}>
                    TAX INVOICE
                  </div>
                  <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#b91c1c', marginTop: '2px' }}>
                    Invoice No: <span style={{ fontFamily: 'monospace' }}>#{renderOrder.orderNumber || 'BILL'}</span>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#475569', marginTop: '2px' }}>
                    Date: <strong>{renderOrder.orderDate}</strong>
                  </div>
                  {renderOrder.customerRoute && (
                    <div style={{ fontSize: '0.78rem', color: '#475569' }}>
                      Route: <strong>{renderOrder.customerRoute}</strong>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Billed To (Customer Details) & Dispatch Details */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '1rem',
                padding: '0.8rem 1rem',
                backgroundColor: '#f8fafc',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                marginBottom: '1rem',
                fontSize: '0.8rem',
              }}
            >
              <div>
                <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '3px' }}>
                  BILLED TO (CUSTOMER):
                </span>
                <div style={{ fontSize: '0.98rem', fontWeight: 800, color: '#0f172a' }}>
                  {renderOrder.customerName}
                </div>
                {renderOrder.ownerName && <div>Contact Person: <strong>{renderOrder.ownerName}</strong></div>}
                {renderOrder.customerPhone && <div>Phone: <strong>{renderOrder.customerPhone}</strong></div>}
                {renderOrder.customerAddress && <div>Address: {renderOrder.customerAddress}</div>}
              </div>

              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '3px' }}>
                  DISPATCH & PAYMENT STATUS:
                </span>
                <div>Order Reference: <strong style={{ fontFamily: 'monospace' }}>#{renderOrder.orderNumber || 'BILL'}</strong></div>
                <div>Delivery Status: <strong style={{ color: '#15803d' }}>CONFIRMED</strong></div>
                {renderOrder.driverName && <div>Delivery Driver: <strong>{renderOrder.driverName}</strong></div>}
                <div>Date: {renderOrder.orderDate}</div>
              </div>
            </div>

            {/* Products Table */}
            <div style={{ marginBottom: '1rem' }}>
              <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #cbd5e1' }}>
                    <th style={{ padding: '0.45rem 0.6rem', textAlign: 'center', width: '36px' }}>#</th>
                    <th style={{ padding: '0.45rem 0.6rem', textAlign: 'left' }}>Item Description</th>
                    <th style={{ padding: '0.45rem 0.6rem', textAlign: 'right', width: '80px' }}>Quantity</th>
                    <th style={{ padding: '0.45rem 0.6rem', textAlign: 'right', width: '100px' }}>Unit Rate (₹)</th>
                    <th style={{ padding: '0.45rem 0.6rem', textAlign: 'right', width: '110px' }}>Total (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {renderOrder.lines && renderOrder.lines.length > 0 ? (
                    renderOrder.lines.map((item, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '0.5rem 0.6rem', textAlign: 'center', color: '#64748b', fontFamily: 'monospace' }}>
                          {idx + 1}
                        </td>
                        <td style={{ padding: '0.5rem 0.6rem' }}>
                          <div style={{ fontWeight: 700, color: '#0f172a' }}>
                            {item.name}
                          </div>
                          {item.packetSize && (
                            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                              Pack: {item.packetSize}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '0.5rem 0.6rem', textAlign: 'right', fontWeight: 600 }}>
                          {item.quantity}
                        </td>
                        <td style={{ padding: '0.5rem 0.6rem', textAlign: 'right', fontFamily: 'monospace' }}>
                          ₹{Number(item.unitPrice).toFixed(2)}
                        </td>
                        <td style={{ padding: '0.5rem 0.6rem', textAlign: 'right', fontFamily: 'monospace', fontWeight: 800 }}>
                          ₹{Number(item.subtotal).toFixed(2)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '0.5rem 0.6rem', textAlign: 'center', color: '#64748b', fontFamily: 'monospace' }}>1</td>
                      <td style={{ padding: '0.5rem 0.6rem', fontWeight: 700, color: '#0f172a' }}>
                        {renderOrder.itemsSummary || 'Daily Wholesale Dispatch'}
                      </td>
                      <td style={{ padding: '0.5rem 0.6rem', textAlign: 'right', fontWeight: 600 }}>1</td>
                      <td style={{ padding: '0.5rem 0.6rem', textAlign: 'right', fontFamily: 'monospace' }}>
                        ₹{renderOrder.totalAmount.toFixed(2)}
                      </td>
                      <td style={{ padding: '0.5rem 0.6rem', textAlign: 'right', fontFamily: 'monospace', fontWeight: 800 }}>
                        ₹{renderOrder.totalAmount.toFixed(2)}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Financial Summary & Outstanding Ledger Section */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '1rem',
                alignItems: 'start',
                paddingTop: '0.5rem',
                borderTop: '1px solid #e2e8f0',
              }}
            >
              {/* Payment & Terms Note */}
              <div style={{ fontSize: '0.76rem', color: '#475569' }}>
                <div
                  style={{
                    padding: '0.7rem',
                    background: '#f8fafc',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                  }}
                >
                  <div style={{ fontWeight: 800, textTransform: 'uppercase', color: '#0f172a', marginBottom: '3px', fontSize: '0.72rem' }}>
                    Payment Methods & Terms:
                  </div>
                  <div>Cash on Delivery or UPI to authorized distribution driver.</div>
                  {storeUpi && (
                    <div style={{ marginTop: '4px', fontWeight: 700, color: '#0f172a' }}>
                      UPI / VPA: <span style={{ fontFamily: 'monospace', color: '#b91c1c' }}>{storeUpi}</span>
                    </div>
                  )}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.45rem', fontStyle: 'italic' }}>
                  * Outstanding balance is verified and synchronized with the live wholesale distribution credit ledger.
                </div>
              </div>

              {/* Calculation Table */}
              <div
                style={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  padding: '0.75rem 0.9rem',
                  fontSize: '0.82rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.3rem' }}>
                  <span style={{ color: '#475569' }}>Invoice Subtotal:</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>₹{renderOrder.totalAmount.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.3rem' }}>
                  <span style={{ color: '#475569' }}>Tax / GST:</span>
                  <span style={{ fontFamily: 'monospace', color: '#94a3b8' }}>₹0.00 (Wholesale Exempt)</span>
                </div>

                <div
                  style={{
                    borderTop: '1px solid #cbd5e1',
                    paddingTop: '0.4rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontWeight: 800,
                    fontSize: '0.94rem',
                    color: '#b91c1c',
                  }}
                >
                  <span>Current Bill Total:</span>
                  <span style={{ fontFamily: 'monospace' }}>₹{renderOrder.totalAmount.toFixed(2)}</span>
                </div>

                {renderOrder.prevDue > 0 && (
                  <div style={{ borderTop: '1px dashed #cbd5e1', marginTop: '0.45rem', paddingTop: '0.4rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#475569' }}>
                      <span>Previous Outstanding Due:</span>
                      <span style={{ fontFamily: 'monospace', color: '#b91c1c', fontWeight: 700 }}>
                        ₹{renderOrder.prevDue.toFixed(2)}
                      </span>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontWeight: 900,
                        fontSize: '0.98rem',
                        color: '#0f172a',
                        background: '#fef2f2',
                        padding: '0.3rem 0.5rem',
                        borderRadius: '4px',
                        marginTop: '4px',
                        border: '1px solid #fecaca',
                      }}
                    >
                      <span>Net Account Due:</span>
                      <span style={{ fontFamily: 'monospace', color: '#b91c1c' }}>
                        ₹{(renderOrder.totalAmount + renderOrder.prevDue).toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer Notes & Authorized Signatory */}
            <div style={{ marginTop: '0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', fontSize: '0.74rem', color: '#64748b' }}>
              <div style={{ fontStyle: 'italic', maxWidth: '65%' }}>
                {storeFooterNotes}
              </div>
              <div style={{ textAlign: 'center', borderTop: '1px solid #cbd5e1', paddingTop: '4px', minWidth: '140px' }}>
                <span style={{ fontWeight: 700, fontSize: '0.7rem', color: '#334155' }}>Authorized Signatory</span>
              </div>
            </div>
          </div>
        )}
      </>
    );
  };
