import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  sendWhatsAppTextMessageViaBridge,
  checkWhatsAppBridgeStatus,
  BridgeStatus,
} from '../utils/whatsappBridgeUtils';
import { useSettings } from '../context/SettingsContext';
import {
  MessageCircle,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Send,
  Pause,
  RotateCcw,
  CheckSquare,
  Square,
  AlertTriangle,
  Phone,
  Store,
  User,
  MapPin,
  Edit3,
  Smartphone,
  Eye,
  Search,
  Filter,
  Check,
  RefreshCw,
  Minimize2,
  Maximize2,
  EyeOff,
  ShieldCheck,
} from 'lucide-react';

export interface PendingCustomerReminderItem {
  customerId: string;
  customerName: string;
  customerOwner?: string;
  customerPhone?: string;
  customerRoute?: string;
  customerAddress?: string;
  rowId: string;
  status: 'PENDING' | 'SENDING' | 'SENT' | 'ERROR';
  errorMessage?: string;
}

interface BulkSendWhatsAppReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderDate: string;
  pendingCustomers: PendingCustomerReminderItem[];
}

export const BulkSendWhatsAppReminderModal: React.FC<BulkSendWhatsAppReminderModalProps> = ({
  isOpen,
  onClose,
  orderDate,
  pendingCustomers,
}) => {
  const { businessName, businessPhone } = useSettings();
  const storeName = businessName || 'Zamzam Foods Wholesale';
  const storePhone = businessPhone || '+91 98470 12345';

  const [items, setItems] = useState<PendingCustomerReminderItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRoute, setSelectedRoute] = useState<string>('ALL');
  const [bridgeStatus, setBridgeStatus] = useState<BridgeStatus | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [sendProgress, setSendProgress] = useState<{ current: number; total: number } | null>(null);
  const [currentSendingItem, setCurrentSendingItem] = useState<PendingCustomerReminderItem | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const [activeTab, setActiveTab] = useState<'TEMPLATE' | 'PREVIEW'>('TEMPLATE');
  const [isMinimized, setIsMinimized] = useState(false);
  const [isAntiBanSafeMode, setIsAntiBanSafeMode] = useState(true);
  const [safetyStatusMessage, setSafetyStatusMessage] = useState<string | null>(null);

  // Editable message template
  const defaultTemplate =
    `*${storeName.toUpperCase()}* 🍞\n` +
    `📅 *Order Date:* {date}\n\n` +
    `Assalamu Alaikum / Hello *{customer_name}*,\n\n` +
    `This is an update from *${storeName}*.\n` +
    `We are preparing today's wholesale vehicle delivery schedule and noticed your order is pending.\n\n` +
    `Do you have any new order for today?\n` +
    `Please reply with your requirement:\n` +
    `• Kubbus (Normal)\n` +
    `• Romali Roti\n` +
    `• Any other bakery items\n\n` +
    `Kindly send your quantities as soon as possible so our driver can dispatch on time.\n\n` +
    `Thank you!\n` +
    `📞 *Call / WhatsApp:* {store_phone}`;

  const [messageTemplate, setMessageTemplate] = useState<string>(defaultTemplate);
  const shouldStopRef = useRef(false);

  // Initialize and check bridge status
  useEffect(() => {
    if (isOpen) {
      checkWhatsAppBridgeStatus().then(setBridgeStatus);
      const initial = pendingCustomers.map((c) => ({ ...c, status: 'PENDING' as const }));
      setItems(initial);
      // Select all customers that have a phone number by default
      const withPhone = initial.filter((c) => Boolean(c.customerPhone && c.customerPhone.trim().length >= 7));
      setSelectedIds(new Set(withPhone.map((c) => c.rowId)));
      setIsSending(false);
      setSendProgress(null);
      setCurrentSendingItem(null);
      setIsCompleted(false);
      setIsMinimized(false);
      shouldStopRef.current = false;
      setSelectedRoute('ALL');
      setSearchTerm('');
    }
  }, [isOpen, pendingCustomers]);

  // Extract unique routes for filter dropdown
  const uniqueRoutes = useMemo(() => {
    const map = new Map<string, number>();
    items.forEach((it) => {
      const r = it.customerRoute ? it.customerRoute.trim() : 'No Route';
      map.set(r, (map.get(r) || 0) + 1);
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [items]);

  if (!isOpen) return null;

  // Format message for a specific customer
  const formatCustomerMessage = (item: PendingCustomerReminderItem) => {
    return messageTemplate
      .replace(/{customer_name}/g, item.customerName || 'Valued Customer')
      .replace(/{owner_name}/g, item.customerOwner || item.customerName || '')
      .replace(/{date}/g, orderDate)
      .replace(/{route}/g, item.customerRoute || 'Local Route')
      .replace(/{store_name}/g, storeName)
      .replace(/{store_phone}/g, storePhone);
  };

  // Toggle selection
  const handleToggleSelect = (rowId: string) => {
    if (isSending) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });
  };

  // Filtered list
  const filteredItems = items.filter((it) => {
    if (selectedRoute !== 'ALL') {
      const routeVal = it.customerRoute ? it.customerRoute.trim() : 'No Route';
      if (routeVal !== selectedRoute) return false;
    }
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      it.customerName.toLowerCase().includes(term) ||
      (it.customerOwner && it.customerOwner.toLowerCase().includes(term)) ||
      (it.customerRoute && it.customerRoute.toLowerCase().includes(term)) ||
      (it.customerPhone && it.customerPhone.includes(term))
    );
  });

  const handleSelectFiltered = () => {
    if (isSending) return;
    const eligible = filteredItems.filter((c) => Boolean(c.customerPhone && c.customerPhone.trim().length >= 7));
    const allFilteredSelected = eligible.every((c) => selectedIds.has(c.rowId));

    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        eligible.forEach((c) => next.delete(c.rowId));
      } else {
        eligible.forEach((c) => next.add(c.rowId));
      }
      return next;
    });
  };

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  // Single customer send
  const handleSendSingle = async (item: PendingCustomerReminderItem) => {
    if (isSending) return;
    if (!item.customerPhone || item.customerPhone.trim().length < 7) {
      alert(`Customer ${item.customerName} does not have a valid phone number.`);
      return;
    }

    setItems((prev) =>
      prev.map((it) => (it.rowId === item.rowId ? { ...it, status: 'SENDING', errorMessage: undefined } : it))
    );

    const message = formatCustomerMessage(item);
    const res = await sendWhatsAppTextMessageViaBridge({
      phone: item.customerPhone,
      message,
    });

    if (res.success) {
      setItems((prev) =>
        prev.map((it) => (it.rowId === item.rowId ? { ...it, status: 'SENT' } : it))
      );
    } else {
      setItems((prev) =>
        prev.map((it) =>
          it.rowId === item.rowId ? { ...it, status: 'ERROR', errorMessage: res.error || 'Failed to send' } : it
        )
      );
    }
  };

  // Bulk 1-Click Send All Selected
  const handleStartBulkSend = async () => {
    const queue = items.filter((it) => selectedIds.has(it.rowId) && it.status !== 'SENT');
    if (queue.length === 0) return;

    // Check bridge status
    const status = await checkWhatsAppBridgeStatus();
    setBridgeStatus(status);
    if (!status.connected) {
      alert(
        status.hasQr
          ? 'WhatsApp is not linked on this computer yet. Please scan the QR code first.'
          : 'WhatsApp service is not running on your laptop. Please start the WhatsApp bridge.'
      );
      return;
    }

    setIsSending(true);
    shouldStopRef.current = false;
    setIsCompleted(false);

    for (let i = 0; i < queue.length; i++) {
      if (shouldStopRef.current) break;

      const currentItem = queue[i];
      setCurrentSendingItem(currentItem);
      setSendProgress({ current: i + 1, total: queue.length });

      if (!currentItem.customerPhone || currentItem.customerPhone.trim().length < 7) {
        setItems((prev) =>
          prev.map((it) =>
            it.rowId === currentItem.rowId
              ? { ...it, status: 'ERROR', errorMessage: 'Missing / invalid phone number' }
              : it
          )
        );
        continue;
      }

      setItems((prev) =>
        prev.map((it) => (it.rowId === currentItem.rowId ? { ...it, status: 'SENDING' } : it))
      );

      const message = formatCustomerMessage(currentItem);

      try {
        const res = await sendWhatsAppTextMessageViaBridge({
          phone: currentItem.customerPhone,
          message,
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
          // Human-like randomized jitter delay (3.2s to 5.5s) in Safe Mode, or 1.5s in Fast Mode
          const delay = isAntiBanSafeMode ? Math.floor(3200 + Math.random() * 2300) : 1500;
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
    setIsCompleted(true);
  };

  const handleStopSending = () => {
    shouldStopRef.current = true;
    setIsSending(false);
    setCurrentSendingItem(null);
  };

  const sentCount = items.filter((it) => it.status === 'SENT').length;
  const errorCount = items.filter((it) => it.status === 'ERROR').length;
  const missingPhoneCount = items.filter((it) => !it.customerPhone || it.customerPhone.trim().length < 7).length;

  const sampleCustomer = items.find((it) => selectedIds.has(it.rowId)) || items[0] || {
    customerName: 'Sample Customer Shop',
    customerOwner: 'Manager',
    customerPhone: '9847012345',
    customerRoute: 'Main Route',
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
            backgroundColor: '#064e3b',
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
                  backgroundColor: '#059669',
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
                      <Loader2 size={12} className="animate-spin" color="#6ee7b7" />
                      <span>Sending Reminders in Background</span>
                    </>
                  ) : isCompleted ? (
                    <>
                      <CheckCircle2 size={13} color="#6ee7b7" />
                      <span>Reminders Completed</span>
                    </>
                  ) : (
                    <span>Order Reminders</span>
                  )}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#a7f3d0', marginTop: '2px' }}>
                  {currentSendingItem
                    ? `${currentSendingItem.customerName}`
                    : `${sentCount} sent of ${selectedIds.size}`}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <button
                type="button"
                onClick={() => setIsMinimized(false)}
                title="Expand back to full window"
                style={{
                  backgroundColor: '#047857',
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
                    backgroundColor: '#ef4444',
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
                    color: '#cbd5e1',
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
          <div style={{ width: '100%', height: '5px', backgroundColor: '#065f46', borderRadius: '9999px', overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${sendProgress ? Math.round((sendProgress.current / sendProgress.total) * 100) : 0}%`,
                backgroundColor: '#34d399',
                transition: 'width 0.3s ease',
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: '#a7f3d0' }}>
            <span>Progress: {sendProgress ? Math.round((sendProgress.current / sendProgress.total) * 100) : 0}%</span>
            <span>{sentCount} of {selectedIds.size} sent</span>
          </div>

          {safetyStatusMessage && (
            <div style={{ fontSize: '0.68rem', color: '#fef08a', fontWeight: 600 }}>
              {safetyStatusMessage}
            </div>
          )}
        </div>
      )}

      {/* Full Modal (shown when NOT minimized) */}
      {!isMinimized && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(6px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.25rem',
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '1200px',
              height: '88vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
              overflow: 'hidden',
              border: '1px solid #cbd5e1',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '1rem 1.5rem',
                background: 'linear-gradient(135deg, #064e3b 0%, #065f46 50%, #047857 100%)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                flexShrink: 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                <div
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(255, 255, 255, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: 'inset 0 1px 1px rgba(255, 255, 255, 0.2)',
                  }}
                >
                  <MessageCircle size={24} color="#ffffff" />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, letterSpacing: '-0.01em' }}>
                      Ask Pending Orders (WhatsApp Reminder)
                    </h2>
                    <span
                      style={{
                        backgroundColor: '#f59e0b',
                        color: '#0f172a',
                        fontWeight: 800,
                        fontSize: '0.72rem',
                        padding: '0.15rem 0.5rem',
                        borderRadius: '9999px',
                      }}
                    >
                      {items.length} Pending
                    </span>
                  </div>
                  <div style={{ fontSize: '0.8rem', opacity: 0.9, display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '3px' }}>
                    <span>Order Date: <strong>{orderDate}</strong></span>
                    <span>•</span>
                    <span>Notify customers who haven't placed today's order with a single click</span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                {/* Bridge Status Indicator */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    padding: '0.35rem 0.8rem',
                    borderRadius: '9999px',
                    fontSize: '0.76rem',
                    fontWeight: 700,
                    backgroundColor: bridgeStatus?.connected ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                    border: `1px solid ${bridgeStatus?.connected ? '#22c55e' : '#ef4444'}`,
                    color: '#ffffff',
                  }}
                  title={bridgeStatus?.connected ? 'Local WhatsApp service is active' : 'WhatsApp bridge offline'}
                >
                  <span
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: bridgeStatus?.connected ? '#22c55e' : '#ef4444',
                      boxShadow: bridgeStatus?.connected ? '0 0 8px #22c55e' : 'none',
                    }}
                  />
                  <span>
                    {bridgeStatus?.connected
                      ? `WhatsApp Ready (${bridgeStatus.info?.name || 'Linked'})`
                      : 'WhatsApp Offline'}
                  </span>
                </div>

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
                    <span>Hide</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => (isSending ? setIsMinimized(true) : onClose())}
                  style={{
                    background: 'rgba(255, 255, 255, 0.15)',
                    border: 'none',
                    color: '#ffffff',
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'background 0.2s',
                  }}
                  title={isSending ? 'Hide to background' : 'Close'}
                >
                  {isSending ? <Minimize2 size={18} /> : <X size={18} />}
                </button>
              </div>
            </div>

            {/* Modal Body: 2 Columns */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1.45fr 1fr',
                flex: 1,
                overflow: 'hidden',
                backgroundColor: '#f8fafc',
              }}
            >
              {/* Left Column: Customer Selection & Filter Directory */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  borderRight: '1px solid #e2e8f0',
                  overflow: 'hidden',
                  backgroundColor: '#ffffff',
                }}
              >
                {/* Top Toolbar: Selection controls & counters */}
                <div
                  style={{
                    padding: '0.85rem 1.1rem',
                    borderBottom: '1px solid #e2e8f0',
                    backgroundColor: '#ffffff',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.65rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <button
                        type="button"
                        onClick={handleSelectFiltered}
                        disabled={isSending}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          background: 'transparent',
                          border: 'none',
                          color: '#065f46',
                          fontSize: '0.82rem',
                          fontWeight: 700,
                          cursor: isSending ? 'not-allowed' : 'pointer',
                          padding: 0,
                        }}
                      >
                        {filteredItems.length > 0 && filteredItems.every((c) => selectedIds.has(c.rowId)) ? (
                          <CheckSquare size={17} color="#059669" />
                        ) : (
                          <Square size={17} color="#94a3b8" />
                        )}
                        <span>
                          Select All in View ({selectedIds.size} / {items.length} total)
                        </span>
                      </button>

                      {selectedIds.size > 0 && (
                        <button
                          type="button"
                          onClick={() => !isSending && setSelectedIds(new Set())}
                          disabled={isSending}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#64748b',
                            fontSize: '0.74rem',
                            textDecoration: 'underline',
                            cursor: 'pointer',
                            padding: 0,
                          }}
                        >
                          Clear
                        </button>
                      )}
                    </div>

                    {/* Anti-Ban Mode Toggle & Counters */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem' }}>
                      <button
                        type="button"
                        disabled={isSending}
                        onClick={() => setIsAntiBanSafeMode(!isAntiBanSafeMode)}
                        style={{
                          padding: '0.25rem 0.65rem',
                          borderRadius: '6px',
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          border: isAntiBanSafeMode ? '1.5px solid #059669' : '1px solid #cbd5e1',
                          backgroundColor: isAntiBanSafeMode ? '#ecfdf5' : '#f8fafc',
                          color: isAntiBanSafeMode ? '#065f46' : '#64748b',
                          cursor: isSending ? 'not-allowed' : 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                        }}
                        title={
                          isAntiBanSafeMode
                            ? 'Anti-Ban Active: Human-like 3-5s random delays + 15s pause every 25 sends to protect your account'
                            : 'Fast Mode: 1.5s fixed delay'
                        }
                      >
                        <ShieldCheck size={13} color={isAntiBanSafeMode ? '#059669' : '#94a3b8'} />
                        <span>{isAntiBanSafeMode ? '🛡️ Safe Anti-Ban (3-5s)' : '⚡ Fast Mode'}</span>
                      </button>

                      {sentCount > 0 && (
                        <span style={{ color: '#15803d', fontWeight: 700, background: '#dcfce7', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>
                          ✅ {sentCount} Sent
                        </span>
                      )}
                      {errorCount > 0 && (
                        <span style={{ color: '#b91c1c', fontWeight: 700, background: '#fee2e2', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>
                          ❌ {errorCount} Failed
                        </span>
                      )}
                      {missingPhoneCount > 0 && (
                        <span style={{ color: '#b45309', fontWeight: 600, background: '#fef3c7', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>
                          {missingPhoneCount} No Phone
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Filter Row: Route Selector & Search Box */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.6fr', gap: '0.6rem' }}>
                    {/* Route Filter Dropdown */}
                    <div style={{ position: 'relative' }}>
                      <select
                        value={selectedRoute}
                        onChange={(e) => setSelectedRoute(e.target.value)}
                        disabled={isSending}
                        style={{
                          width: '100%',
                          padding: '0.45rem 0.65rem',
                          fontSize: '0.78rem',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          backgroundColor: '#f8fafc',
                          color: '#0f172a',
                          fontWeight: 600,
                          outline: 'none',
                          cursor: 'pointer',
                        }}
                      >
                        <option value="ALL">All Routes ({items.length})</option>
                        {uniqueRoutes.map(([r, count]) => (
                          <option key={r} value={r}>
                            {r.length > 32 ? `${r.substring(0, 32)}...` : r} ({count})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Search Box */}
                    <div style={{ position: 'relative' }}>
                      <Search
                        size={14}
                        style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}
                      />
                      <input
                        type="text"
                        placeholder="Search shop, owner, or phone..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '0.45rem 2rem 0.45rem 2rem',
                          fontSize: '0.78rem',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          outline: 'none',
                          boxSizing: 'border-box',
                        }}
                      />
                      {searchTerm && (
                        <button
                          type="button"
                          onClick={() => setSearchTerm('')}
                          style={{
                            position: 'absolute',
                            right: '8px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            border: 'none',
                            background: 'transparent',
                            color: '#94a3b8',
                            cursor: 'pointer',
                            padding: 0,
                          }}
                        >
                          <X size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Customer Cards List */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '0.65rem 0.85rem' }}>
                  {filteredItems.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3.5rem 1rem', color: '#64748b' }}>
                      <Store size={40} style={{ margin: '0 auto 0.6rem', opacity: 0.4 }} />
                      <p style={{ margin: 0, fontWeight: 700, fontSize: '0.9rem', color: '#334155' }}>
                        No pending customers match your filters
                      </p>
                      <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                        Try clearing the search query or selecting "All Routes"
                      </p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                      {filteredItems.map((item) => {
                        const isSelected = selectedIds.has(item.rowId);
                        const hasPhone = Boolean(item.customerPhone && item.customerPhone.trim().length >= 7);
                        const formattedRoute = (item.customerRoute || '').replace(/,/g, ', ');

                        return (
                          <div
                            key={item.rowId}
                            onClick={() => hasPhone && handleToggleSelect(item.rowId)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '0.75rem',
                              padding: '0.65rem 0.85rem',
                              borderRadius: '8px',
                              border: isSelected ? '1px solid #10b981' : '1px solid #e2e8f0',
                              backgroundColor: isSelected ? '#f0fdf4' : hasPhone ? '#ffffff' : '#f8fafc',
                              cursor: isSending || !hasPhone ? 'default' : 'pointer',
                              transition: 'all 0.15s ease',
                              opacity: hasPhone ? 1 : 0.75,
                            }}
                          >
                            {/* Checkbox and Customer Info */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: 0 }}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                disabled={isSending || !hasPhone}
                                onChange={() => handleToggleSelect(item.rowId)}
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                  cursor: isSending || !hasPhone ? 'not-allowed' : 'pointer',
                                  accentColor: '#059669',
                                  width: '16px',
                                  height: '16px',
                                  flexShrink: 0,
                                }}
                              />

                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div
                                  style={{
                                    fontWeight: 800,
                                    fontSize: '0.88rem',
                                    color: '#0f172a',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                  }}
                                  title={item.customerName}
                                >
                                  {item.customerName}
                                </div>

                                <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.65rem',
                                    fontSize: '0.72rem',
                                    color: '#64748b',
                                    marginTop: '3px',
                                    flexWrap: 'nowrap',
                                    overflow: 'hidden',
                                  }}
                                >
                                  {item.customerRoute && (
                                    <span
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '3px',
                                        maxWidth: '180px',
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        backgroundColor: '#f1f5f9',
                                        padding: '1px 6px',
                                        borderRadius: '4px',
                                        color: '#334155',
                                      }}
                                      title={formattedRoute}
                                    >
                                      <MapPin size={10} style={{ flexShrink: 0 }} />
                                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{formattedRoute}</span>
                                    </span>
                                  )}

                                  {item.customerOwner && (
                                    <span
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '3px',
                                        maxWidth: '120px',
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                      }}
                                      title={item.customerOwner}
                                    >
                                      <User size={10} style={{ flexShrink: 0 }} />
                                      <span>{item.customerOwner}</span>
                                    </span>
                                  )}

                                  <span
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '3px',
                                      color: hasPhone ? '#0f766e' : '#dc2626',
                                      fontWeight: hasPhone ? 600 : 700,
                                      flexShrink: 0,
                                    }}
                                  >
                                    <Phone size={10} />
                                    <span>{hasPhone ? item.customerPhone : 'No Phone'}</span>
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Status Badge & 1-Click Send Button */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                              {item.status === 'PENDING' && (
                                <span
                                  style={{
                                    fontSize: '0.68rem',
                                    fontWeight: 700,
                                    padding: '0.2rem 0.5rem',
                                    borderRadius: '5px',
                                    backgroundColor: '#fef3c7',
                                    color: '#92400e',
                                    border: '1px solid #fde68a',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  No Order Yet
                                </span>
                              )}

                              {item.status === 'SENDING' && (
                                <span
                                  style={{
                                    fontSize: '0.68rem',
                                    fontWeight: 700,
                                    padding: '0.2rem 0.5rem',
                                    borderRadius: '5px',
                                    backgroundColor: '#e0f2fe',
                                    color: '#0369a1',
                                    border: '1px solid #bae6fd',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '3px',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  <Loader2 size={11} className="animate-spin" /> Sending...
                                </span>
                              )}

                              {item.status === 'SENT' && (
                                <span
                                  style={{
                                    fontSize: '0.68rem',
                                    fontWeight: 700,
                                    padding: '0.2rem 0.5rem',
                                    borderRadius: '5px',
                                    backgroundColor: '#dcfce7',
                                    color: '#15803d',
                                    border: '1px solid #bbf7d0',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '3px',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  <CheckCircle2 size={11} /> Sent
                                </span>
                              )}

                              {item.status === 'ERROR' && (
                                <span
                                  style={{
                                    fontSize: '0.68rem',
                                    fontWeight: 700,
                                    padding: '0.2rem 0.5rem',
                                    borderRadius: '5px',
                                    backgroundColor: '#fee2e2',
                                    color: '#b91c1c',
                                    border: '1px solid #fecaca',
                                    whiteSpace: 'nowrap',
                                  }}
                                  title={item.errorMessage}
                                >
                                  Failed
                                </span>
                              )}

                              {/* Quick Single Send Button */}
                              <button
                                type="button"
                                title={hasPhone ? `Send order reminder directly to ${item.customerName}` : 'No phone number available'}
                                disabled={isSending || !hasPhone || item.status === 'SENT'}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSendSingle(item);
                                }}
                                style={{
                                  background: '#16a34a',
                                  color: '#ffffff',
                                  border: 'none',
                                  borderRadius: '6px',
                                  padding: '0.35rem 0.65rem',
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  cursor: isSending || !hasPhone || item.status === 'SENT' ? 'not-allowed' : 'pointer',
                                  opacity: isSending || !hasPhone || item.status === 'SENT' ? 0.4 : 1,
                                  flexShrink: 0,
                                  whiteSpace: 'nowrap',
                                  boxShadow: hasPhone && item.status !== 'SENT' ? '0 1px 2px rgba(22, 163, 74, 0.3)' : 'none',
                                }}
                              >
                                <Send size={11} />
                                <span>Send</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Message Studio (Tabs for Template & Live Phone Preview) */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  backgroundColor: '#f8fafc',
                  overflow: 'hidden',
                }}
              >
                {/* Studio Navigation Tabs */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.6rem 1rem',
                    borderBottom: '1px solid #e2e8f0',
                    backgroundColor: '#ffffff',
                    flexShrink: 0,
                  }}
                >
                  <div style={{ display: 'flex', backgroundColor: '#f1f5f9', borderRadius: '8px', padding: '3px' }}>
                    <button
                      type="button"
                      onClick={() => setActiveTab('TEMPLATE')}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        padding: '0.35rem 0.75rem',
                        fontSize: '0.76rem',
                        fontWeight: 700,
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        backgroundColor: activeTab === 'TEMPLATE' ? '#ffffff' : 'transparent',
                        color: activeTab === 'TEMPLATE' ? '#065f46' : '#64748b',
                        boxShadow: activeTab === 'TEMPLATE' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                        transition: 'all 0.15s',
                      }}
                    >
                      <Edit3 size={13} />
                      <span>Message Template</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveTab('PREVIEW')}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        padding: '0.35rem 0.75rem',
                        fontSize: '0.76rem',
                        fontWeight: 700,
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        backgroundColor: activeTab === 'PREVIEW' ? '#ffffff' : 'transparent',
                        color: activeTab === 'PREVIEW' ? '#065f46' : '#64748b',
                        boxShadow: activeTab === 'PREVIEW' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                        transition: 'all 0.15s',
                      }}
                    >
                      <Smartphone size={13} />
                      <span>Live WhatsApp Preview</span>
                    </button>
                  </div>

                  {activeTab === 'TEMPLATE' && (
                    <button
                      type="button"
                      onClick={() => setMessageTemplate(defaultTemplate)}
                      title="Reset back to default template"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#64748b',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '3px',
                      }}
                    >
                      <RefreshCw size={11} />
                      <span>Reset Default</span>
                    </button>
                  )}
                </div>

                {/* Tab 1: Template Editor */}
                {activeTab === 'TEMPLATE' ? (
                  <div
                    style={{
                      padding: '1rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.85rem',
                      flex: 1,
                      overflowY: 'auto',
                    }}
                  >
                    {/* Dynamic Variable Insertion Pills */}
                    <div
                      style={{
                        backgroundColor: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '10px',
                        padding: '0.75rem 0.9rem',
                      }}
                    >
                      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569', marginBottom: '0.45rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                        Click to Insert Dynamic Tag:
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                        {[
                          { label: '+ Shop Name', tag: '{customer_name}' },
                          { label: '+ Owner Name', tag: '{owner_name}' },
                          { label: '+ Today\'s Date', tag: '{date}' },
                          { label: '+ Delivery Route', tag: '{route}' },
                          { label: '+ Store Phone', tag: '{store_phone}' },
                        ].map((item) => (
                          <button
                            key={item.tag}
                            type="button"
                            onClick={() => setMessageTemplate((prev) => prev + ' ' + item.tag)}
                            style={{
                              background: '#f1f5f9',
                              border: '1px solid #cbd5e1',
                              borderRadius: '6px',
                              padding: '0.25rem 0.5rem',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              color: '#334155',
                              cursor: 'pointer',
                              transition: 'all 0.15s',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = '#e2e8f0';
                              e.currentTarget.style.borderColor = '#94a3b8';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = '#f1f5f9';
                              e.currentTarget.style.borderColor = '#cbd5e1';
                            }}
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Editor Textarea */}
                    <div
                      style={{
                        backgroundColor: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '10px',
                        padding: '0.75rem 0.9rem',
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0f172a' }}>
                          Message Content:
                        </span>
                        <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>
                          Supports WhatsApp bold (*text*), italic (_text_)
                        </span>
                      </div>

                      <textarea
                        value={messageTemplate}
                        onChange={(e) => setMessageTemplate(e.target.value)}
                        rows={12}
                        style={{
                          width: '100%',
                          flex: 1,
                          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                          fontSize: '0.78rem',
                          lineHeight: '1.45',
                          padding: '0.65rem',
                          borderRadius: '8px',
                          border: '1px solid #cbd5e1',
                          boxSizing: 'border-box',
                          resize: 'none',
                          color: '#0f172a',
                          outline: 'none',
                          backgroundColor: '#fcfcfd',
                        }}
                      />
                    </div>
                  </div>
                ) : (
                  /* Tab 2: Realistic WhatsApp Mobile Preview */
                  <div
                    style={{
                      padding: '1rem',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flex: 1,
                      overflowY: 'auto',
                    }}
                  >
                    {/* Phone Shell */}
                    <div
                      style={{
                        width: '100%',
                        maxWidth: '380px',
                        backgroundColor: '#ffffff',
                        borderRadius: '24px',
                        boxShadow: '0 12px 30px -4px rgba(0, 0, 0, 0.25)',
                        border: '6px solid #1e293b',
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column',
                        height: '460px',
                      }}
                    >
                      {/* WhatsApp Mobile Chat Header */}
                      <div
                        style={{
                          backgroundColor: '#075e54',
                          color: '#ffffff',
                          padding: '0.65rem 0.85rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.6rem',
                        }}
                      >
                        <div
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            backgroundColor: '#128c7e',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 800,
                            fontSize: '0.85rem',
                          }}
                        >
                          {sampleCustomer.customerName.charAt(0).toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: '0.82rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {sampleCustomer.customerName}
                          </div>
                          <div style={{ fontSize: '0.66rem', opacity: 0.85 }}>Online</div>
                        </div>
                      </div>

                      {/* WhatsApp Chat Body */}
                      <div
                        style={{
                          flex: 1,
                          backgroundColor: '#efeae2',
                          backgroundImage: 'radial-gradient(#d1d7db 1px, transparent 1px)',
                          backgroundSize: '16px 16px',
                          padding: '0.85rem',
                          overflowY: 'auto',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'flex-start',
                        }}
                      >
                        {/* Message Bubble */}
                        <div
                          style={{
                            backgroundColor: '#dcf8c6',
                            borderRadius: '8px',
                            borderTopRightRadius: '2px',
                            padding: '0.7rem 0.85rem',
                            maxWidth: '92%',
                            alignSelf: 'flex-end',
                            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.15)',
                            fontSize: '0.78rem',
                            color: '#111827',
                            whiteSpace: 'pre-wrap',
                            lineHeight: 1.45,
                            wordBreak: 'break-word',
                          }}
                        >
                          {formatCustomerMessage(sampleCustomer as any)}
                          <div
                            style={{
                              textAlign: 'right',
                              fontSize: '0.64rem',
                              color: '#4b5563',
                              marginTop: '4px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'flex-end',
                              gap: '2px',
                            }}
                          >
                            <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            <span style={{ color: '#38bdf8', fontWeight: 900 }}>✓✓</span>
                          </div>
                        </div>
                      </div>

                      {/* Simulated Input Bar */}
                      <div
                        style={{
                          padding: '0.45rem 0.65rem',
                          backgroundColor: '#f0f2f5',
                          borderTop: '1px solid #e2e8f0',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          fontSize: '0.72rem',
                          color: '#94a3b8',
                        }}
                      >
                        <div style={{ flex: 1, backgroundColor: '#ffffff', borderRadius: '16px', padding: '0.35rem 0.65rem' }}>
                          Type a message...
                        </div>
                        <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: '#075e54', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Send size={12} color="#ffffff" />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer Controls */}
            <div
              style={{
                padding: '0.9rem 1.5rem',
                backgroundColor: '#ffffff',
                borderTop: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                boxShadow: '0 -2px 6px rgba(0, 0, 0, 0.03)',
                flexShrink: 0,
              }}
            >
              {/* Progress / Status display */}
              <div style={{ flex: 1, marginRight: '1.5rem' }}>
                {isSending && sendProgress ? (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', fontWeight: 700, color: '#0f172a', marginBottom: '4px' }}>
                      <span>Sending Reminder ({sendProgress.current} / {sendProgress.total})...</span>
                      <span>{Math.round((sendProgress.current / sendProgress.total) * 100)}%</span>
                    </div>
                    <div style={{ height: '7px', width: '100%', backgroundColor: '#e2e8f0', borderRadius: '9999px', overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${(sendProgress.current / sendProgress.total) * 100}%`,
                          backgroundColor: '#10b981',
                          transition: 'width 0.3s ease',
                        }}
                      />
                    </div>
                    {safetyStatusMessage ? (
                      <div style={{ fontSize: '0.74rem', color: '#b45309', fontWeight: 700, marginTop: '3px' }}>
                        {safetyStatusMessage}
                      </div>
                    ) : currentSendingItem ? (
                      <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '3px' }}>
                        Messaging: <strong>{currentSendingItem.customerName}</strong> ({currentSendingItem.customerPhone})
                      </div>
                    ) : null}
                  </div>
                ) : isCompleted ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#16a34a', fontSize: '0.84rem', fontWeight: 700 }}>
                    <CheckCircle2 size={16} />
                    <span>
                      Finished sending order reminders! ({sentCount} sent successfully{errorCount > 0 ? `, ${errorCount} failed` : ''})
                    </span>
                  </div>
                ) : (
                  <div style={{ fontSize: '0.82rem', color: '#334155' }}>
                    Ready to send WhatsApp reminder to <strong>{selectedIds.size}</strong> pending customer{selectedIds.size === 1 ? '' : 's'}.
                    <span style={{ fontSize: '0.74rem', color: '#059669', fontWeight: 600, marginLeft: '6px' }}>
                      ({isAntiBanSafeMode ? '🛡️ Safe Anti-Ban Active: 3–5s delays + 15s pause / 25 msgs' : '⚡ Fast Mode: 1.5s delay'} • )
                    </span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                {isSending ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={() => setIsMinimized(true)}
                      style={{
                        height: '38px',
                        padding: '0 1.1rem',
                        backgroundColor: '#f1f5f9',
                        color: '#0f172a',
                        border: '1px solid #cbd5e1',
                        borderRadius: '8px',
                        fontSize: '0.84rem',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        cursor: 'pointer',
                      }}
                      title="Hide window and continue sending in background"
                    >
                      <EyeOff size={15} />
                      <span>Hide (Send in Background)</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleStopSending}
                      style={{
                        height: '38px',
                        padding: '0 1.2rem',
                        backgroundColor: '#ef4444',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '0.84rem',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        cursor: 'pointer',
                      }}
                    >
                      <Pause size={15} />
                      <span>Stop Sending</span>
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={onClose}
                      style={{
                        height: '38px',
                        padding: '0 1.1rem',
                        backgroundColor: '#f1f5f9',
                        color: '#475569',
                        border: '1px solid #cbd5e1',
                        borderRadius: '8px',
                        fontSize: '0.84rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Close
                    </button>

                    <button
                      type="button"
                      onClick={handleStartBulkSend}
                      disabled={selectedIds.size === 0}
                      style={{
                        height: '38px',
                        padding: '0 1.4rem',
                        background: selectedIds.size > 0 ? 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)' : '#94a3b8',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '0.86rem',
                        fontWeight: 800,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        cursor: selectedIds.size > 0 ? 'pointer' : 'not-allowed',
                        boxShadow: selectedIds.size > 0 ? '0 4px 6px -1px rgba(22, 163, 74, 0.35)' : 'none',
                        transition: 'all 0.15s',
                      }}
                    >
                      <Send size={15} />
                      <span>
                        Send Reminder to {selectedIds.size} Customer{selectedIds.size === 1 ? '' : 's'} (1-Click)
                      </span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

