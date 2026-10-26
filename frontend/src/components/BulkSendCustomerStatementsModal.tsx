import React, { useState, useEffect, useRef } from 'react';
import { Customer, Route } from '../types';
import { useSettings } from '../context/SettingsContext';
import {
  MessageCircle,
  Send,
  Pause,
  CheckCircle2,
  AlertCircle,
  X,
  Search,
  CheckSquare,
  Square,
  Store,
  FileText,
  Image as ImageIcon,
  Loader2,
  ShieldCheck,
  EyeOff,
  Maximize2,
  Calendar,
  Filter,
} from 'lucide-react';
import { formatCurrency, formatDate } from '../utils/formatters';
import {
  checkWhatsAppBridgeStatus,
  sendInvoiceFileViaBridge,
  BridgeStatus,
  getWhatsAppBridgeQrUrl,
} from '../utils/whatsappBridgeUtils';

interface BulkCustomerItem {
  id: string;
  name: string;
  ownerName?: string;
  phone: string;
  route?: string;
  currentBalance: number;
  creditLimit: number;
  status: 'IDLE' | 'SENDING' | 'SENT' | 'ERROR';
  errorMessage?: string;
}

interface BulkSendCustomerStatementsModalProps {
  customers: Customer[];
  routes: Route[];
  onClose: () => void;
  onRefresh?: () => void;
}

export const BulkSendCustomerStatementsModal: React.FC<BulkSendCustomerStatementsModalProps> = ({
  customers,
  routes,
  onClose,
  onRefresh,
}) => {
  const { businessName, businessPhone, gstNumber, settings } = useSettings();

  // Mode & Filters
  const [reportType, setReportType] = useState<'DUE_REMINDER' | 'THIS_MONTH' | 'TODAY'>('THIS_MONTH');
  const [onlyWithDue, setOnlyWithDue] = useState(true);
  const [selectedRoute, setSelectedRoute] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [sendFormat, setSendFormat] = useState<'IMAGE' | 'PDF'>('IMAGE');

  // Anti-Ban Throttling & Background States
  const [isAntiBanSafeMode, setIsAntiBanSafeMode] = useState(true);
  const [safetyStatusMessage, setSafetyStatusMessage] = useState<string | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);

  // Items & Selection
  const [items, setItems] = useState<BulkCustomerItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Sending Loop State
  const [isSending, setIsSending] = useState(false);
  const [currentSendingItem, setCurrentSendingItem] = useState<BulkCustomerItem | null>(null);
  const [sendProgress, setSendProgress] = useState<{ current: number; total: number } | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const [bridgeStatus, setBridgeStatus] = useState<BridgeStatus | null>(null);

  // Hidden Rendering ref for html2canvas statement capture
  const [renderCustomer, setRenderCustomer] = useState<BulkCustomerItem | null>(null);
  const statementRenderRef = useRef<HTMLDivElement>(null);
  const shouldStopRef = useRef(false);

  const storeName = businessName || settings?.business_name || 'Zamzam Foods Wholesale';
  const storePhone = businessPhone || settings?.phone_number || '+91 98470 12345';
  const storeGst = gstNumber || settings?.gst_number || '';
  const storeAddress = settings?.address || 'Main Road, Pandikkad, Malappuram, Kerala';
  const storeUpi = settings?.upi_id || '';

  // Initialize Items from Customers
  useEffect(() => {
    const mapped: BulkCustomerItem[] = customers.map((c) => ({
      id: c.id,
      name: c.name,
      ownerName: c.owner_name,
      phone: (c.phone || '').trim(),
      route: c.route_details?.name || (typeof c.route === 'string' ? c.route : ''),
      currentBalance: Number(c.current_balance || 0),
      creditLimit: Number(c.credit_limit || 0),
      status: 'IDLE',
    }));

    setItems(mapped);

    // Default selection: Select customers who have phone numbers and (if onlyWithDue is true) due > 0
    const initialSelected = new Set<string>();
    mapped.forEach((it) => {
      if (it.phone && it.phone.length >= 7 && it.currentBalance > 0) {
        initialSelected.add(it.id);
      }
    });
    setSelectedIds(initialSelected);
  }, [customers]);

  // Check WhatsApp Bridge connection on mount
  useEffect(() => {
    checkWhatsAppBridgeStatus().then(setBridgeStatus);
    const interval = setInterval(() => {
      checkWhatsAppBridgeStatus().then(setBridgeStatus);
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  // Filtered Items
  const filteredItems = items.filter((it) => {
    if (onlyWithDue && it.currentBalance <= 0) return false;
    if (selectedRoute !== 'ALL' && it.route !== selectedRoute) return false;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const matchName = it.name.toLowerCase().includes(q);
      const matchOwner = it.ownerName?.toLowerCase().includes(q);
      const matchPhone = it.phone.includes(q);
      if (!matchName && !matchOwner && !matchPhone) return false;
    }
    return true;
  });

  const handleSelectFiltered = () => {
    const validInView = filteredItems.filter((it) => it.phone && it.phone.length >= 7);
    const allSelected = validInView.every((it) => selectedIds.has(it.id));

    const next = new Set(selectedIds);
    if (allSelected) {
      validInView.forEach((it) => next.delete(it.id));
    } else {
      validInView.forEach((it) => next.add(it.id));
    }
    setSelectedIds(next);
  };

  const handleToggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

  // Sending Loop
  const handleStartSending = async () => {
    if (!bridgeStatus?.connected) {
      const openQr = window.confirm(
        'WhatsApp is not connected on your laptop yet.\n\nWould you like to open the WhatsApp QR Code page now to link it?'
      );
      if (openQr) {
        window.open(getWhatsAppBridgeQrUrl(), '_blank');
      }
      return;
    }

    const queue = items.filter((it) => selectedIds.has(it.id) && it.status !== 'SENT');
    if (queue.length === 0) {
      alert('No pending shops selected to send statements.');
      return;
    }

    setIsSending(true);
    setIsCompleted(false);
    shouldStopRef.current = false;
    setSendProgress({ current: 1, total: queue.length });

    const todayStr = new Date().toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

    const monthStr = new Date().toLocaleDateString('en-IN', {
      month: 'long',
      year: 'numeric',
    });

    for (let i = 0; i < queue.length; i++) {
      if (shouldStopRef.current) break;

      const currentItem = queue[i];
      setCurrentSendingItem(currentItem);
      setSendProgress({ current: i + 1, total: queue.length });

      if (!currentItem.phone || currentItem.phone.length < 7) {
        setItems((prev) =>
          prev.map((it) =>
            it.id === currentItem.id
              ? { ...it, status: 'ERROR', errorMessage: 'Missing customer phone number' }
              : it
          )
        );
        continue;
      }

      setItems((prev) =>
        prev.map((it) => (it.id === currentItem.id ? { ...it, status: 'SENDING' } : it))
      );

      // Render statement HTML in off-screen container
      setRenderCustomer(currentItem);
      await sleep(350); // Allow React to paint off-screen

      try {
        if (!statementRenderRef.current) {
          throw new Error('Statement render container not ready');
        }

        let reportTitle = 'ACCOUNT STATEMENT & OUTSTANDING DUE';
        let periodSubtitle = `As of: ${todayStr}`;
        if (reportType === 'THIS_MONTH') {
          reportTitle = `STATEMENT FOR ${monthStr.toUpperCase()}`;
          periodSubtitle = `Month: ${monthStr} (As of ${todayStr})`;
        } else if (reportType === 'TODAY') {
          reportTitle = `TODAY'S ACCOUNT SUMMARY (${todayStr})`;
          periodSubtitle = `Date: ${todayStr}`;
        }

        const caption =
          `*${storeName.toUpperCase()}*\n` +
          `*${reportTitle}*\n` +
          `Shop: *${currentItem.name}*\n` +
          `Total Outstanding Due: *₹${currentItem.currentBalance.toFixed(2)}*\n` +
          (storeUpi ? `GPay / UPI Payment: *${storeUpi}*\n` : '') +
          `\n${periodSubtitle}\n` +
          `Thank you for your business with ${storeName}!`;

        const res = await sendInvoiceFileViaBridge({
          phone: currentItem.phone,
          element: statementRenderRef.current,
          orderNumber: `Statement_${currentItem.name.replace(/[^a-zA-Z0-9]/g, '_')}`,
          format: sendFormat,
          caption,
        });

        if (res.success) {
          setItems((prev) =>
            prev.map((it) => (it.id === currentItem.id ? { ...it, status: 'SENT' } : it))
          );
        } else {
          setItems((prev) =>
            prev.map((it) =>
              it.id === currentItem.id
                ? { ...it, status: 'ERROR', errorMessage: res.error || 'Failed to send' }
                : it
            )
          );
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setItems((prev) =>
          prev.map((it) => (it.id === currentItem.id ? { ...it, status: 'ERROR', errorMessage: msg } : it))
        );
      }

      // Safe Anti-Ban Throttling
      if (i < queue.length - 1 && !shouldStopRef.current) {
        if (isAntiBanSafeMode && (i + 1) % 25 === 0) {
          for (let s = 15; s > 0; s--) {
            if (shouldStopRef.current) break;
            setSafetyStatusMessage(`☕ Safety cooldown: pausing ${s}s after 25 sends...`);
            await sleep(1000);
          }
          setSafetyStatusMessage(null);
        } else {
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
    setRenderCustomer(null);
    setIsCompleted(true);
    if (onRefresh) onRefresh();
  };

  const handleStopSending = () => {
    shouldStopRef.current = true;
    setIsSending(false);
    setCurrentSendingItem(null);
  };

  const selectedCount = selectedIds.size;
  const sentCount = items.filter((it) => it.status === 'SENT').length;
  const errorCount = items.filter((it) => it.status === 'ERROR').length;
  const totalSelectedDue = items
    .filter((it) => selectedIds.has(it.id))
    .reduce((sum, it) => sum + it.currentBalance, 0);

  const todayStr = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  return (
    <>
      {/* Minimized Floating Status Widget */}
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
                  backgroundColor: '#047857',
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
                      <Loader2 size={12} className="animate-spin" color="#34d399" />
                      <span>Sending Due Statements...</span>
                    </>
                  ) : isCompleted ? (
                    <>
                      <CheckCircle2 size={13} color="#34d399" />
                      <span>Statements Dispatched</span>
                    </>
                  ) : (
                    <span>Customer Statements</span>
                  )}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '2px' }}>
                  {currentSendingItem
                    ? `${currentSendingItem.name} (${sendFormat})`
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
                    color: '#cbd5e1',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '0.3rem',
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
                width: `${sendProgress ? Math.round((sendProgress.current / sendProgress.total) * 100) : 0}%`,
                backgroundColor: '#10b981',
                transition: 'width 0.3s ease',
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: '#94a3b8' }}>
            <span>Progress: {sendProgress ? Math.round((sendProgress.current / sendProgress.total) * 100) : 0}%</span>
            <span>{sentCount} of {selectedCount} sent</span>
          </div>

          {safetyStatusMessage && (
            <div style={{ fontSize: '0.68rem', color: '#fef08a', fontWeight: 600 }}>
              {safetyStatusMessage}
            </div>
          )}
        </div>
      )}

      {/* Full Modal */}
      {!isMinimized && (
        <div
          className="modal-overlay"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem',
          }}
        >
          <div
            className="modal-content"
            style={{
              width: '100%',
              maxWidth: '920px',
              height: '90vh',
              maxHeight: '850px',
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '1rem 1.5rem',
                backgroundColor: '#064e3b',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexShrink: 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(255, 255, 255, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <FileText size={22} color="#6ee7b7" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, letterSpacing: '-0.01em' }}>
                    Send Customer Due Statements on WhatsApp
                  </h3>
                  <div style={{ fontSize: '0.78rem', color: '#a7f3d0', marginTop: '2px' }}>
                    Dispatch official A4 Statements (JPG Image or PDF) directly to customer shop WhatsApp numbers
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {isSending && (
                  <button
                    type="button"
                    onClick={() => setIsMinimized(true)}
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
                    <EyeOff size={14} />
                    <span>Hide Window</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSending}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#a7f3d0',
                    cursor: isSending ? 'not-allowed' : 'pointer',
                    padding: '4px',
                  }}
                >
                  <X size={22} />
                </button>
              </div>
            </div>

            {/* Options Bar: Report Type, Format & Anti-Ban */}
            <div
              style={{
                padding: '0.85rem 1.5rem',
                backgroundColor: '#f8fafc',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '0.75rem',
                fontSize: '0.82rem',
              }}
            >
              {/* Report Period Selector */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ fontWeight: 700, color: '#334155' }}>Statement Period:</span>
                <button
                  type="button"
                  disabled={isSending}
                  onClick={() => setReportType('THIS_MONTH')}
                  style={{
                    padding: '0.3rem 0.65rem',
                    borderRadius: '6px',
                    fontSize: '0.76rem',
                    fontWeight: 700,
                    border: reportType === 'THIS_MONTH' ? '2px solid #047857' : '1px solid #cbd5e1',
                    backgroundColor: reportType === 'THIS_MONTH' ? '#ecfdf5' : '#ffffff',
                    color: reportType === 'THIS_MONTH' ? '#065f46' : '#64748b',
                    cursor: isSending ? 'not-allowed' : 'pointer',
                  }}
                >
                  📅 This Month Report
                </button>

                <button
                  type="button"
                  disabled={isSending}
                  onClick={() => setReportType('TODAY')}
                  style={{
                    padding: '0.3rem 0.65rem',
                    borderRadius: '6px',
                    fontSize: '0.76rem',
                    fontWeight: 700,
                    border: reportType === 'TODAY' ? '2px solid #047857' : '1px solid #cbd5e1',
                    backgroundColor: reportType === 'TODAY' ? '#ecfdf5' : '#ffffff',
                    color: reportType === 'TODAY' ? '#065f46' : '#64748b',
                    cursor: isSending ? 'not-allowed' : 'pointer',
                  }}
                >
                  ⚡ Today Report
                </button>

                <button
                  type="button"
                  disabled={isSending}
                  onClick={() => setReportType('DUE_REMINDER')}
                  style={{
                    padding: '0.3rem 0.65rem',
                    borderRadius: '6px',
                    fontSize: '0.76rem',
                    fontWeight: 700,
                    border: reportType === 'DUE_REMINDER' ? '2px solid #047857' : '1px solid #cbd5e1',
                    backgroundColor: reportType === 'DUE_REMINDER' ? '#ecfdf5' : '#ffffff',
                    color: reportType === 'DUE_REMINDER' ? '#065f46' : '#64748b',
                    cursor: isSending ? 'not-allowed' : 'pointer',
                  }}
                >
                  💰 Total Due Summary
                </button>
              </div>

              {/* Format & Anti-Ban Controls */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontWeight: 700, color: '#334155' }}>Format:</span>
                <button
                  type="button"
                  disabled={isSending}
                  onClick={() => setSendFormat('IMAGE')}
                  style={{
                    padding: '0.3rem 0.65rem',
                    borderRadius: '6px',
                    fontSize: '0.76rem',
                    fontWeight: 700,
                    border: sendFormat === 'IMAGE' ? '2px solid #047857' : '1px solid #cbd5e1',
                    backgroundColor: sendFormat === 'IMAGE' ? '#ecfdf5' : '#ffffff',
                    color: sendFormat === 'IMAGE' ? '#065f46' : '#64748b',
                    cursor: isSending ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <ImageIcon size={13} />
                  <span>Statement Image (JPG - Default)</span>
                </button>

                <button
                  type="button"
                  disabled={isSending}
                  onClick={() => setSendFormat('PDF')}
                  style={{
                    padding: '0.3rem 0.65rem',
                    borderRadius: '6px',
                    fontSize: '0.76rem',
                    fontWeight: 700,
                    border: sendFormat === 'PDF' ? '2px solid #16a34a' : '1px solid #cbd5e1',
                    backgroundColor: sendFormat === 'PDF' ? '#dcfce7' : '#ffffff',
                    color: sendFormat === 'PDF' ? '#15803d' : '#64748b',
                    cursor: isSending ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <FileText size={13} />
                  <span>PDF Document</span>
                </button>

                {/* Safe Anti-Ban Mode Toggle */}
                <button
                  type="button"
                  disabled={isSending}
                  onClick={() => setIsAntiBanSafeMode(!isAntiBanSafeMode)}
                  style={{
                    padding: '0.3rem 0.65rem',
                    borderRadius: '6px',
                    fontSize: '0.76rem',
                    fontWeight: 700,
                    border: isAntiBanSafeMode ? '1.5px solid #059669' : '1px solid #cbd5e1',
                    backgroundColor: isAntiBanSafeMode ? '#ecfdf5' : '#ffffff',
                    color: isAntiBanSafeMode ? '#065f46' : '#64748b',
                    cursor: isSending ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    marginLeft: '4px',
                  }}
                  title={
                    isAntiBanSafeMode
                      ? 'Anti-Ban Active: Human 3–5s delays + 15s pause every 25 sends to keep your number safe'
                      : 'Fast Mode: 1.8s delay'
                  }
                >
                  <ShieldCheck size={13} color={isAntiBanSafeMode ? '#059669' : '#94a3b8'} />
                  <span>{isAntiBanSafeMode ? '🛡️ Safe Anti-Ban' : '⚡ Fast Mode'}</span>
                </button>
              </div>
            </div>

            {/* Filter Row: Route, Search, Only with Due */}
            <div
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: '#ffffff',
                borderBottom: '1px solid #e2e8f0',
                display: 'grid',
                gridTemplateColumns: '1.2fr 1.6fr auto',
                gap: '0.85rem',
                alignItems: 'center',
              }}
            >
              <select
                className="form-select"
                style={{ fontSize: '0.82rem', height: '36px' }}
                value={selectedRoute}
                onChange={(e) => setSelectedRoute(e.target.value)}
                disabled={isSending}
              >
                <option value="ALL">All Delivery Routes ({items.length} Shops)</option>
                {routes.map((r) => (
                  <option key={r.id} value={r.name}>
                    Route: {r.name} ({r.code})
                  </option>
                ))}
              </select>

              <div style={{ position: 'relative' }}>
                <Search
                  size={15}
                  style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}
                />
                <input
                  type="text"
                  placeholder="Search shop name, owner, or phone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  disabled={isSending}
                  style={{
                    width: '100%',
                    height: '36px',
                    padding: '0 2rem 0 2rem',
                    fontSize: '0.82rem',
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
                      background: 'none',
                      cursor: 'pointer',
                      color: '#94a3b8',
                    }}
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  color: '#334155',
                  cursor: isSending ? 'not-allowed' : 'pointer',
                  userSelect: 'none',
                }}
              >
                <input
                  type="checkbox"
                  checked={onlyWithDue}
                  onChange={(e) => setOnlyWithDue(e.target.checked)}
                  disabled={isSending}
                  style={{ width: '16px', height: '16px', accentColor: '#047857' }}
                />
                <span>Only Shops with Due (&gt; ₹0)</span>
              </label>
            </div>

            {/* Selection Toolbar */}
            <div
              style={{
                padding: '0.55rem 1.5rem',
                backgroundColor: '#f1f5f9',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '0.78rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={handleSelectFiltered}
                  disabled={isSending}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    background: 'none',
                    border: 'none',
                    color: '#065f46',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: isSending ? 'not-allowed' : 'pointer',
                    padding: 0,
                  }}
                >
                  {filteredItems.length > 0 && filteredItems.every((it) => selectedIds.has(it.id)) ? (
                    <CheckSquare size={16} color="#059669" />
                  ) : (
                    <Square size={16} color="#94a3b8" />
                  )}
                  <span>
                    Select All in View ({filteredItems.filter((it) => selectedIds.has(it.id)).length} / {filteredItems.length})
                  </span>
                </button>

                {selectedIds.size > 0 && !isSending && (
                  <button
                    type="button"
                    onClick={() => setSelectedIds(new Set())}
                    style={{ background: 'none', border: 'none', color: '#64748b', textDecoration: 'underline', cursor: 'pointer', padding: 0 }}
                  >
                    Clear All
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                <span style={{ color: '#475569' }}>
                  Total Selected: <strong>{selectedCount} Shops</strong>
                </span>
                <span style={{ color: '#b91c1c', fontWeight: 800 }}>
                  Combined Due: {formatCurrency(totalSelectedDue)}
                </span>
              </div>
            </div>

            {/* Shops Table List */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem 1.5rem' }}>
              {filteredItems.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3.5rem 1rem', color: '#64748b' }}>
                  <Store size={44} style={{ margin: '0 auto 0.75rem', opacity: 0.35 }} />
                  <p style={{ margin: 0, fontWeight: 700, fontSize: '0.95rem', color: '#334155' }}>
                    No customer shops found matching filters
                  </p>
                  <p style={{ margin: '4px 0 0', fontSize: '0.8rem' }}>
                    Try unchecking "Only Shops with Due" or clearing your search.
                  </p>
                </div>
              ) : (
                <table style={{ width: '100%', fontSize: '0.82rem', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '2px solid #cbd5e1', textAlign: 'left' }}>
                      <th style={{ width: '40px', padding: '0.5rem', textAlign: 'center' }}>#</th>
                      <th style={{ padding: '0.5rem 0.75rem' }}>Customer Shop</th>
                      <th style={{ padding: '0.5rem 0.75rem' }}>Delivery Route</th>
                      <th style={{ padding: '0.5rem 0.75rem' }}>Phone Number</th>
                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>Outstanding Due</th>
                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center', width: '120px' }}>Dispatch Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.map((item, idx) => {
                      const isSelected = selectedIds.has(item.id);
                      const hasPhone = Boolean(item.phone && item.phone.length >= 7);

                      return (
                        <tr
                          key={item.id}
                          onClick={() => hasPhone && !isSending && handleToggleSelect(item.id)}
                          style={{
                            borderBottom: '1px solid #e2e8f0',
                            backgroundColor: isSelected ? '#f0fdf4' : idx % 2 === 0 ? '#ffffff' : '#fcfcfd',
                            cursor: hasPhone && !isSending ? 'pointer' : 'default',
                            transition: 'background-color 0.1s',
                          }}
                        >
                          <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              disabled={!hasPhone || isSending}
                              onChange={() => handleToggleSelect(item.id)}
                              style={{ accentColor: '#059669', width: '15px', height: '15px' }}
                            />
                          </td>
                          <td style={{ padding: '0.5rem 0.75rem' }}>
                            <div style={{ fontWeight: 700, color: '#0f172a' }}>{item.name}</div>
                            {item.ownerName && (
                              <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Proprietor: {item.ownerName}</div>
                            )}
                          </td>
                          <td style={{ padding: '0.5rem 0.75rem' }}>
                            <span style={{ backgroundColor: '#e2e8f0', padding: '0.15rem 0.45rem', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 600 }}>
                              {item.route || 'General'}
                            </span>
                          </td>
                          <td style={{ padding: '0.5rem 0.75rem', fontFamily: 'monospace' }}>
                            {hasPhone ? item.phone : <span style={{ color: '#b91c1c', fontStyle: 'italic' }}>No Phone</span>}
                          </td>
                          <td
                            style={{
                              padding: '0.5rem 0.75rem',
                              textAlign: 'right',
                              fontFamily: 'monospace',
                              fontWeight: 800,
                              fontSize: '0.88rem',
                              color: item.currentBalance > 0 ? '#b91c1c' : '#15803d',
                            }}
                          >
                            ₹{item.currentBalance.toFixed(2)}
                          </td>
                          <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>
                            {item.status === 'SENDING' ? (
                              <span style={{ color: '#0284c7', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                <Loader2 size={12} className="animate-spin" /> Sending...
                              </span>
                            ) : item.status === 'SENT' ? (
                              <span style={{ color: '#16a34a', fontWeight: 700, background: '#dcfce7', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>
                                ✅ Sent
                              </span>
                            ) : item.status === 'ERROR' ? (
                              <span
                                style={{ color: '#dc2626', fontWeight: 700, background: '#fee2e2', padding: '0.15rem 0.5rem', borderRadius: '4px' }}
                                title={item.errorMessage}
                              >
                                ❌ Failed
                              </span>
                            ) : (
                              <span style={{ color: '#94a3b8' }}>Pending</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Modal Footer Controls */}
            <div
              style={{
                padding: '0.85rem 1.5rem',
                backgroundColor: '#ffffff',
                borderTop: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexShrink: 0,
              }}
            >
              {/* Progress Bar / Safety info */}
              <div style={{ flex: 1, marginRight: '1.5rem' }}>
                {isSending && sendProgress ? (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', fontWeight: 700, color: '#0f172a', marginBottom: '4px' }}>
                      <span>Sending Statement ({sendProgress.current} / {sendProgress.total})...</span>
                      <span>{Math.round((sendProgress.current / sendProgress.total) * 100)}%</span>
                    </div>
                    <div style={{ height: '6px', width: '100%', backgroundColor: '#e2e8f0', borderRadius: '9999px', overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${(sendProgress.current / sendProgress.total) * 100}%`,
                          backgroundColor: '#047857',
                          transition: 'width 0.3s ease',
                        }}
                      />
                    </div>
                    {safetyStatusMessage ? (
                      <div style={{ fontSize: '0.72rem', color: '#b45309', fontWeight: 700, marginTop: '3px' }}>
                        {safetyStatusMessage}
                      </div>
                    ) : currentSendingItem ? (
                      <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '3px' }}>
                        Messaging: <strong>{currentSendingItem.name}</strong> ({currentSendingItem.phone})
                      </div>
                    ) : null}
                  </div>
                ) : isCompleted ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#16a34a', fontSize: '0.84rem', fontWeight: 700 }}>
                    <CheckCircle2 size={16} />
                    <span>
                      Finished sending statements! ({sentCount} sent successfully{errorCount > 0 ? `, ${errorCount} failed` : ''})
                    </span>
                  </div>
                ) : (
                  <div style={{ fontSize: '0.82rem', color: '#334155' }}>
                    Ready to send {reportType === 'THIS_MONTH' ? 'This Month Report' : reportType === 'TODAY' ? "Today's Summary" : 'Due Statements'} to <strong>{selectedCount}</strong> shop{selectedCount === 1 ? '' : 's'}.
                    <span style={{ fontSize: '0.74rem', color: '#059669', fontWeight: 600, marginLeft: '6px' }}>
                      ({isAntiBanSafeMode ? '🛡️ Safe Anti-Ban Active: 3–5s delays + 15s pause / 25 msgs' : '⚡ Fast Mode'} • )
                    </span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                {isSending ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={() => setIsMinimized(true)}
                      style={{
                        height: '38px',
                        padding: '0 1rem',
                        backgroundColor: '#f1f5f9',
                        color: '#0f172a',
                        border: '1px solid #cbd5e1',
                        borderRadius: '8px',
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        cursor: 'pointer',
                      }}
                    >
                      <EyeOff size={14} />
                      <span>Hide (Send in Background)</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleStopSending}
                      style={{
                        height: '38px',
                        padding: '0 1.2rem',
                        backgroundColor: '#dc2626',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        cursor: 'pointer',
                      }}
                    >
                      <Pause size={14} />
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
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Close
                    </button>

                    <button
                      type="button"
                      onClick={handleStartSending}
                      disabled={selectedCount === 0}
                      style={{
                        height: '38px',
                        padding: '0 1.4rem',
                        background: selectedCount > 0 ? 'linear-gradient(135deg, #047857 0%, #065f46 100%)' : '#94a3b8',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '0.86rem',
                        fontWeight: 800,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.45rem',
                        cursor: selectedCount > 0 ? 'pointer' : 'not-allowed',
                        boxShadow: selectedCount > 0 ? '0 4px 6px -1px rgba(4, 120, 87, 0.35)' : 'none',
                      }}
                    >
                      <Send size={15} />
                      <span>
                        Send {selectedCount} {sendFormat} Statement{selectedCount === 1 ? '' : 's'} (1-Click)
                      </span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hidden Offscreen Container for rendering high-res statement images / PDFs */}
      {renderCustomer && (
        <div
          ref={statementRenderRef}
          style={{
            position: 'fixed',
            top: 0,
            left: '-9999px',
            width: '760px',
            zIndex: -9999,
            pointerEvents: 'none',
            backgroundColor: '#ffffff',
            color: '#0f172a',
            padding: '32px 36px',
            fontFamily: 'Arial, Helvetica, sans-serif',
            boxSizing: 'border-box',
          }}
        >
          {/* Statement Header */}
          <div style={{ borderBottom: '2px solid #b91c1c', paddingBottom: '14px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <img
                  src="/app-icon.png"
                  alt="Store Logo"
                  style={{
                    width: '56px',
                    height: '56px',
                    objectFit: 'cover',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    flexShrink: 0,
                  }}
                  onError={(e) => {
                    (e.currentTarget as HTMLElement).style.display = 'none';
                  }}
                />
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.45rem', fontWeight: 900, color: '#b91c1c', textTransform: 'uppercase', lineHeight: 1.2 }}>
                    {storeName}
                  </h2>
                  <div style={{ fontSize: '0.84rem', fontWeight: 600, color: '#334155', marginTop: '4px', lineHeight: 1.3 }}>
                    {storeAddress}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: '4px' }}>
                    <span>Phone: </span>
                    <strong style={{ color: '#0f172a' }}>{storePhone}</strong>
                  </div>
                  {storeGst && (
                    <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0f172a', marginTop: '3px' }}>
                      <span>GSTIN: </span>
                      <span style={{ color: '#b91c1c', fontFamily: 'monospace' }}>{storeGst}</span>
                    </div>
                  )}
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0f172a', lineHeight: 1.2 }}>
                  CUSTOMER ACCOUNT STATEMENT
                </div>
                <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#047857', marginTop: '5px' }}>
                  {reportType === 'THIS_MONTH' ? 'Monthly Account Report' : reportType === 'TODAY' ? 'Daily Account Report' : 'Outstanding Balance Due'}
                </div>
                <div style={{ fontSize: '0.82rem', color: '#475569', marginTop: '4px' }}>
                  <span>Date: </span>
                  <strong style={{ color: '#0f172a' }}>{todayStr}</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Customer Details Box */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1.2fr 1fr',
              gap: '20px',
              padding: '14px 18px',
              backgroundColor: '#f8fafc',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              marginBottom: '16px',
              fontSize: '0.84rem',
            }}
          >
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: '5px' }}>
                CUSTOMER SHOP DETAILS:
              </div>
              <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#0f172a', marginBottom: '4px' }}>
                {renderCustomer.name}
              </div>
              {renderCustomer.ownerName && (
                <div style={{ marginTop: '3px', color: '#334155' }}>
                  <span>Proprietor: </span>
                  <strong style={{ color: '#0f172a' }}>{renderCustomer.ownerName}</strong>
                </div>
              )}
              {renderCustomer.phone && (
                <div style={{ marginTop: '3px', color: '#334155' }}>
                  <span>Phone: </span>
                  <strong style={{ color: '#0f172a' }}>{renderCustomer.phone}</strong>
                </div>
              )}
              {renderCustomer.route && (
                <div style={{ marginTop: '3px', color: '#334155' }}>
                  <span>Route: </span>
                  <strong style={{ color: '#0f172a' }}>{renderCustomer.route}</strong>
                </div>
              )}
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: '5px' }}>
                PAYMENT INSTRUCTIONS:
              </div>
              {storeUpi && (
                <div style={{ marginTop: '4px', color: '#334155' }}>
                  <span>GPay / UPI ID: </span>
                  <strong style={{ fontFamily: 'monospace', color: '#b91c1c' }}>{storeUpi}</strong>
                </div>
              )}
              <div style={{ marginTop: '4px', color: '#334155' }}>
                <span>Accepted: </span>
                <strong style={{ color: '#0f172a' }}>Cash on Delivery / UPI Transfer</strong>
              </div>
              <div style={{ marginTop: '4px', color: '#334155' }}>
                <span>Bank: </span>
                <strong style={{ color: '#0f172a' }}>Contact Office for NEFT / IMPS</strong>
              </div>
            </div>
          </div>

          {/* Account Balance Banner */}
          <div
            style={{
              padding: '16px 20px',
              backgroundColor: '#fef2f2',
              border: '2px solid #fecaca',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '16px',
            }}
          >
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 900, color: '#991b1b', textTransform: 'uppercase' }}>
                TOTAL OUTSTANDING RECEIVABLE DUE
              </div>
              <div style={{ fontSize: '0.82rem', color: '#475569', marginTop: '4px' }}>
                <span>Please arrange payment at the earliest. Contact </span>
                <strong style={{ color: '#0f172a' }}>{storePhone}</strong>
                <span> for any statement clarification.</span>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '2rem', fontWeight: 900, color: '#b91c1c', fontFamily: 'monospace' }}>
                ₹{renderCustomer.currentBalance.toFixed(2)}
              </div>
            </div>
          </div>

          {/* Footer Notes & Signatory */}
          <div style={{ marginTop: '18px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', fontSize: '0.76rem', color: '#64748b' }}>
            <div style={{ fontStyle: 'italic', maxWidth: '65%', lineHeight: 1.4 }}>
              * Computer generated account statement. Thank you for your continued partnership with {storeName}.
            </div>
            <div style={{ textAlign: 'center', borderTop: '1px solid #cbd5e1', paddingTop: '6px', minWidth: '150px' }}>
              <span style={{ fontWeight: 700, fontSize: '0.72rem', color: '#334155' }}>Authorized Signatory</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
