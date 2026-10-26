import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { deliveryService } from '../../services/deliveryService';
import { paymentService } from '../../services/paymentService';
import { Delivery, PaymentMethod } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import {
  CheckCircle2,
  Clock,
  Phone,
  Navigation,
  Search,
  Check,
  Banknote,
  QrCode,
  AlertTriangle,
  X,
  XCircle,
  RefreshCw,
  HandCoins,
  Store,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';

const SKIP_REASONS = [
  'Shop Closed',
  'Owner Not Available',
  'Customer Refused Order',
  'Stock Already Sufficient',
  'Damaged In Transit',
  'Rescheduled to Tomorrow',
  'Other',
];

interface ShopFinancials {
  previousOutstanding: number;
  todayAmount: number;
  collectedAmount: number;
  remainingAmount: number;
  totalDue: number;
}

const formatCompactINR = (val: number): string => {
  if (val === 0) return '₹0';
  const hasDecimals = val % 1 !== 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(val);
};

export const DriverDashboard: React.FC = () => {
  const { user } = useAuth();

  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'DELIVERED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFinancialIds, setExpandedFinancialIds] = useState<Set<string>>(new Set());

  // 1. Payment Modal State
  const [paymentDelivery, setPaymentDelivery] = useState<Delivery | null>(null);
  const [collectAmount, setCollectAmount] = useState('');
  const [collectMethod, setCollectMethod] = useState<PaymentMethod>('CASH');
  const [collectRef, setCollectRef] = useState('');

  // 2. Complete Delivery Modal State
  const [completeDelivery, setCompleteDelivery] = useState<Delivery | null>(null);
  const [recipientName, setRecipientName] = useState('');
  const [includePayment, setIncludePayment] = useState(false);
  const [completePayAmount, setCompletePayAmount] = useState('');
  const [completePayMethod, setCompletePayMethod] = useState<PaymentMethod>('CASH');

  // 3. Skip / Not Delivered Modal State
  const [skipDelivery, setSkipDelivery] = useState<Delivery | null>(null);
  const [skipReason, setSkipReason] = useState(SKIP_REASONS[0]);

  // Async action submission state
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Auto-dismiss toast
  useEffect(() => {
    if (successToast) {
      const t = setTimeout(() => setSuccessToast(null), 3500);
      return () => clearTimeout(t);
    }
  }, [successToast]);

  const fetchDeliveries = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      else setRefreshing(true);
      const data = await deliveryService.getDeliveries();
      setDeliveries(data);
    } catch (err) {
      console.warn('Failed to load deliveries:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDeliveries();

    // Auto-refresh in background every 20 seconds
    const interval = setInterval(() => {
      fetchDeliveries(true);
    }, 20000);

    const handleFocus = () => fetchDeliveries(true);
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [fetchDeliveries]);

  // Compute financial values clearly for each delivery stop
  const getFinancials = useCallback((d: Delivery): ShopFinancials => {
    const todayAmount = parseFloat(d.order_details?.total_amount || '0');
    const customerBalance = parseFloat(d.order_details?.customer_details?.current_balance || '0');

    // Accurate previous outstanding before today's order
    const orderPrevBal = d.order_details?.previous_balance !== undefined && d.order_details?.previous_balance !== null
      ? parseFloat(d.order_details.previous_balance)
      : undefined;

    const previousOutstanding = orderPrevBal !== undefined
      ? Math.max(0, orderPrevBal)
      : Math.max(0, customerBalance - todayAmount);

    const totalDue = previousOutstanding + todayAmount;

    // Collected for this specific delivery order if tracked, or payments today
    const collectedAmount = parseFloat(
      (d.order_details as any)?.paid_amount ||
      (d.order_details as any)?.amount_paid ||
      '0'
    );

    const remainingAmount = Math.max(0, totalDue - collectedAmount);

    return {
      previousOutstanding,
      todayAmount,
      collectedAmount,
      remainingAmount,
      totalDue,
    };
  }, []);

  // Filtered deliveries for mobile display
  const filteredDeliveries = useMemo(() => {
    return deliveries.filter((d) => {
      if (statusFilter === 'PENDING' && (d.status === 'DELIVERED' || d.status === 'NOT_DELIVERED')) return false;
      if (statusFilter === 'DELIVERED' && d.status !== 'DELIVERED') return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const name = d.order_details?.customer_details?.name?.toLowerCase() || '';
        const phone = d.order_details?.customer_details?.phone?.toLowerCase() || '';
        const addr = d.order_details?.customer_details?.address?.toLowerCase() || '';
        return name.includes(q) || phone.includes(q) || addr.includes(q);
      }
      return true;
    });
  }, [deliveries, statusFilter, searchQuery]);

  const counts = useMemo(() => {
    const total = deliveries.length;
    const delivered = deliveries.filter((d) => d.status === 'DELIVERED').length;
    const pending = deliveries.filter((d) => d.status !== 'DELIVERED' && d.status !== 'NOT_DELIVERED').length;
    return { total, delivered, pending };
  }, [deliveries]);

  // Open Collect Modal
  const openCollect = (d: Delivery) => {
    const fin = getFinancials(d);
    setPaymentDelivery(d);
    // Default to today's bill amount, or remaining due if bill is 0
    const defaultAmount = fin.todayAmount > 0 ? fin.todayAmount : fin.remainingAmount;
    setCollectAmount(defaultAmount > 0 ? String(defaultAmount) : '');
    setCollectMethod('CASH');
    setCollectRef('');
    setActionError(null);
  };

  // Submit Collect Payment
  const handleConfirmPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentDelivery) return;

    const amt = parseFloat(collectAmount.trim() || '0');
    if (isNaN(amt) || amt < 0) {
      setActionError('Please enter a valid amount (₹0 or greater)');
      return;
    }

    try {
      setSubmitting(true);
      setActionError(null);
      const shopName = paymentDelivery.order_details?.customer_details?.name || 'Shop';

      if (amt === 0) {
        // Zero cash collected - mark delivery completed with zero collection (bill is on credit)
        await deliveryService.completeDelivery(paymentDelivery.id, {
          recipient_name: paymentDelivery.order_details?.customer_details?.owner_name || 'Staff',
        });
        setSuccessToast(`✓ Delivery completed for ${shopName} (₹0 Cash collected — Bill on Credit)`);
        setPaymentDelivery(null);
        await fetchDeliveries(true);
        return;
      }

      await paymentService.recordPayment({
        customer_id: paymentDelivery.order_details?.customer || '',
        order_id: paymentDelivery.order,
        amount: amt.toFixed(2),
        payment_method: collectMethod,
        reference_number: collectRef.trim() || undefined,
        notes: `Collected by driver for ${shopName}`,
      });

      setSuccessToast(`₹${amt} collected from ${shopName}`);
      setPaymentDelivery(null);
      await fetchDeliveries(true);
    } catch (err: any) {
      setActionError(err.response?.data?.error || err.message || 'Payment collection failed');
    } finally {
      setSubmitting(false);
    }
  };

  // Open Complete Delivery Modal
  const openComplete = (d: Delivery) => {
    const fin = getFinancials(d);
    setCompleteDelivery(d);
    setRecipientName(d.order_details?.customer_details?.owner_name || 'Staff');
    setIncludePayment(false);
    setCompletePayAmount(fin.todayAmount > 0 ? String(fin.todayAmount) : '');
    setCompletePayMethod('CASH');
    setActionError(null);
  };

  // Submit Complete Delivery
  const handleConfirmComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!completeDelivery) return;

    try {
      setSubmitting(true);
      setActionError(null);
      const shopName = completeDelivery.order_details?.customer_details?.name || 'Shop';

      // 1. Complete delivery in backend
      await deliveryService.completeDelivery(completeDelivery.id, {
        recipient_name: recipientName.trim() || 'Staff',
      });

      // 2. If payment was collected at time of delivery
      if (includePayment) {
        const pAmt = parseFloat(completePayAmount);
        if (!isNaN(pAmt) && pAmt > 0) {
          await paymentService.recordPayment({
            customer_id: completeDelivery.order_details?.customer || '',
            order_id: completeDelivery.order,
            amount: pAmt.toFixed(2),
            payment_method: completePayMethod,
            notes: `Collected upon delivery at ${shopName}`,
          });
        }
      }

      setSuccessToast(`✓ Delivery completed for ${shopName}`);
      setCompleteDelivery(null);
      await fetchDeliveries(true);
    } catch (err: any) {
      setActionError(err.response?.data?.error || err.message || 'Delivery completion failed');
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Skip Delivery
  const handleConfirmSkip = async () => {
    if (!skipDelivery) return;
    try {
      setSubmitting(true);
      setActionError(null);
      const shopName = skipDelivery.order_details?.customer_details?.name || 'Shop';

      await deliveryService.markNotDelivered(skipDelivery.id, {
        failed_reason: skipReason,
      });

      setSuccessToast(`Delivery marked as skipped for ${shopName}`);
      setSkipDelivery(null);
      await fetchDeliveries(true);
    } catch (err: any) {
      setActionError(err.response?.data?.error || err.message || 'Failed to skip delivery');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ padding: '0.65rem 0.5rem 5rem 0.5rem', maxWidth: '640px', margin: '0 auto' }}>
      {/* Toast Notification */}
      {successToast && (
        <div
          style={{
            position: 'fixed',
            top: '1rem',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 9999,
            background: '#064e3b',
            color: '#ecfdf5',
            padding: '0.65rem 1.15rem',
            borderRadius: '999px',
            fontSize: '0.86rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '0.45rem',
            boxShadow: '0 8px 24px rgba(0,0,0,0.28)',
            animation: 'fadeIn 0.2s ease',
          }}
        >
          <CheckCircle2 size={16} color="#34d399" />
          <span>{successToast}</span>
        </div>
      )}

      {/* ── Compact Sticky-Ready Header ── */}
      <div
        style={{
          background: 'var(--surface, #ffffff)',
          border: '1px solid var(--border, #e2e8f0)',
          borderRadius: '12px',
          padding: '0.75rem 0.9rem',
          marginBottom: '0.65rem',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
          <div>
            <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              TODAY'S DELIVERIES
            </span>
            <h1 style={{ fontSize: '1.15rem', fontWeight: 900, color: 'var(--text-main, #0f172a)', margin: '0.1rem 0 0 0' }}>
              {user?.assigned_route_name || 'Assigned Route'}
            </h1>
          </div>

          <button
            type="button"
            onClick={() => fetchDeliveries(true)}
            disabled={refreshing || loading}
            aria-label="Refresh deliveries"
            style={{
              background: 'var(--bg-main, #f8fafc)',
              border: '1px solid var(--border, #cbd5e1)',
              borderRadius: '8px',
              padding: '0.45rem 0.65rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              fontSize: '0.75rem',
              fontWeight: 700,
              color: 'var(--text-main, #334155)',
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={13} className={refreshing ? 'spinner' : ''} />
            <span>Sync</span>
          </button>
        </div>

        {/* Compact 3-Tab Filter Pills */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.35rem', marginBottom: '0.5rem' }}>
          <button
            type="button"
            onClick={() => setStatusFilter('ALL')}
            style={{
              padding: '0.45rem 0.3rem',
              borderRadius: '8px',
              border: 'none',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer',
              background: statusFilter === 'ALL' ? '#0f172a' : 'var(--bg-main, #f1f5f9)',
              color: statusFilter === 'ALL' ? '#ffffff' : 'var(--text-muted, #64748b)',
              transition: 'all 0.15s ease',
            }}
          >
            All ({counts.total})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('PENDING')}
            style={{
              padding: '0.45rem 0.3rem',
              borderRadius: '8px',
              border: 'none',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer',
              background: statusFilter === 'PENDING' ? '#b45309' : 'var(--bg-main, #f1f5f9)',
              color: statusFilter === 'PENDING' ? '#ffffff' : '#b45309',
              transition: 'all 0.15s ease',
            }}
          >
            Pending ({counts.pending})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('DELIVERED')}
            style={{
              padding: '0.45rem 0.3rem',
              borderRadius: '8px',
              border: 'none',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer',
              background: statusFilter === 'DELIVERED' ? '#059669' : 'var(--bg-main, #f1f5f9)',
              color: statusFilter === 'DELIVERED' ? '#ffffff' : '#059669',
              transition: 'all 0.15s ease',
            }}
          >
            Done ({counts.delivered})
          </button>
        </div>

        {/* Minimal Search Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.45rem',
            background: 'var(--bg-main, #f8fafc)',
            border: '1px solid var(--border, #cbd5e1)',
            borderRadius: '8px',
            padding: '0.35rem 0.65rem',
          }}
        >
          <Search size={14} color="#94a3b8" />
          <input
            type="text"
            placeholder="Search shop name or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              border: 'none',
              background: 'transparent',
              outline: 'none',
              width: '100%',
              fontSize: '0.82rem',
              color: 'var(--text-main, #0f172a)',
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#94a3b8' }}
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Loading Spinner */}
      {loading && deliveries.length === 0 && (
        <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
          <div className="spinner" style={{ margin: '0 auto 0.75rem', width: 28, height: 28 }} />
          <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Loading today's shop list...</span>
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredDeliveries.length === 0 && (
        <div
          style={{
            background: 'var(--surface, #ffffff)',
            borderRadius: '12px',
            padding: '2.5rem 1rem',
            textAlign: 'center',
            border: '1px dashed var(--border, #cbd5e1)',
          }}
        >
          <Store size={36} color="#94a3b8" style={{ margin: '0 auto 0.5rem' }} />
          <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 0.25rem 0', color: 'var(--text-main, #0f172a)' }}>
            No Deliveries Found
          </h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted, #64748b)', margin: 0 }}>
            {searchQuery ? 'Try clearing your search query' : 'No stops assigned for this status filter.'}
          </p>
        </div>
      )}

      {/* ── DRIVER SHOPS / DELIVERIES LIST ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
        {filteredDeliveries.map((delivery, index) => {
          const shop = delivery.order_details?.customer_details;
          const fin = getFinancials(delivery);
          const isDelivered = delivery.status === 'DELIVERED';
          const isNotDelivered = delivery.status === 'NOT_DELIVERED';
          const isPending = !isDelivered && !isNotDelivered;
          const stopNumber = delivery.stop_number || index + 1;

          return (
            <div
              key={delivery.id}
              style={{
                background: 'var(--bg-card, #ffffff)',
                border: `1px solid ${isDelivered ? '#86efac' : isNotDelivered ? '#fca5a5' : 'var(--border)'}`,
                borderRadius: '6px',
                padding: '0.85rem 0.9rem',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              {/* Card Top Row: Stop Number, Shop Name, Phone, Maps */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.65rem' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.55rem', flex: 1, minWidth: 0 }}>
                  {/* Sequence circle */}
                  <div
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '4px',
                      background: isDelivered ? '#15803d' : isNotDelivered ? '#b91c1c' : '#0f172a',
                      color: 'white',
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {isDelivered ? <Check size={14} /> : stopNumber}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                      <strong
                        style={{
                          fontSize: '0.94rem',
                          fontWeight: 800,
                          color: 'var(--text-primary, #0f172a)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {shop?.name || 'Customer Shop'}
                      </strong>

                      {/* Status Tag */}
                      {isDelivered && (
                        <span
                          style={{
                            fontSize: '0.65rem',
                            fontWeight: 700,
                            background: '#dcfce7',
                            color: '#15803d',
                            padding: '0.1rem 0.45rem',
                            borderRadius: '4px',
                            border: '1px solid #86efac',
                          }}
                        >
                          DELIVERED
                        </span>
                      )}
                      {isNotDelivered && (
                        <span
                          style={{
                            fontSize: '0.65rem',
                            fontWeight: 700,
                            background: '#fee2e2',
                            color: '#b91c1c',
                            padding: '0.1rem 0.45rem',
                            borderRadius: '4px',
                            border: '1px solid #fca5a5',
                          }}
                        >
                          SKIPPED
                        </span>
                      )}
                      {isPending && (
                        <span
                          style={{
                            fontSize: '0.65rem',
                            fontWeight: 700,
                            background: '#fef3c7',
                            color: '#b45309',
                            padding: '0.1rem 0.45rem',
                            borderRadius: '4px',
                            border: '1px solid #fde68a',
                          }}
                        >
                          PENDING
                        </span>
                      )}
                    </div>

                    {shop?.address && (
                      <p
                        style={{
                          fontSize: '0.74rem',
                          color: 'var(--text-muted, #64748b)',
                          margin: '0.15rem 0 0 0',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {shop.address}
                      </p>
                    )}
                  </div>
                </div>

                {/* Quick Call & Map Icons */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }}>
                  {shop?.phone && (
                    <a
                      href={`tel:${shop.phone}`}
                      aria-label="Call shop"
                      style={{
                        width: '34px',
                        height: '34px',
                        borderRadius: '6px',
                        background: '#eff6ff',
                        color: '#1d4ed8',
                        border: '1px solid #bfdbfe',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        textDecoration: 'none',
                      }}
                    >
                      <Phone size={15} />
                    </a>
                  )}
                  {shop?.address && (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(shop.address)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Navigate to shop"
                      style={{
                        width: '34px',
                        height: '34px',
                        borderRadius: '6px',
                        background: '#f0fdf4',
                        color: '#15803d',
                        border: '1px solid #bbf7d0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        textDecoration: 'none',
                      }}
                    >
                      <Navigation size={15} />
                    </a>
                  )}
                </div>
              </div>

              {/* ── FINANCIAL DATA: Previous Due only by default; click to toggle full POS Ledger Breakdown ── */}
              {(() => {
                const isExpanded = expandedFinancialIds.has(delivery.id);
                return (
                  <div
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #cbd5e1',
                      borderRadius: '4px',
                      padding: '0.35rem 0.65rem',
                      marginBottom: '0.65rem',
                    }}
                  >
                    <div
                      onClick={() => {
                        setExpandedFinancialIds((prev) => {
                          const next = new Set(prev);
                          if (next.has(delivery.id)) {
                            next.delete(delivery.id);
                          } else {
                            next.add(delivery.id);
                          }
                          return next;
                        });
                      }}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        cursor: 'pointer',
                        userSelect: 'none',
                        fontSize: '0.82rem',
                        padding: isExpanded ? '0.12rem 0 0.25rem' : '0.1rem 0',
                        borderBottom: isExpanded ? '1px dashed #e2e8f0' : 'none',
                      }}
                      title="Click to show/hide bill breakdown"
                    >
                      <span style={{ color: '#475569', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                        <span>Previous Due</span>
                        <ChevronDown
                          size={12}
                          style={{
                            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                            transition: 'transform 0.15s ease',
                            color: '#64748b',
                          }}
                        />
                      </span>
                      <span style={{ fontWeight: 700, color: fin.previousOutstanding > 0 ? '#b91c1c' : '#334155' }}>
                        {formatCompactINR(fin.previousOutstanding)}
                      </span>
                    </div>

                    {isExpanded && (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.18rem 0', borderBottom: '1px dashed #e2e8f0', fontSize: '0.82rem' }}>
                          <span style={{ color: '#475569', fontWeight: 600 }}>Current Bill</span>
                          <span style={{ fontWeight: 700, color: '#0f172a' }}>
                            {formatCompactINR(fin.todayAmount)}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.18rem 0', borderBottom: '1px dashed #e2e8f0', fontSize: '0.82rem' }}>
                          <span style={{ color: '#475569', fontWeight: 600 }}>Collected</span>
                          <span style={{ fontWeight: 700, color: fin.collectedAmount > 0 ? '#15803d' : '#64748b' }}>
                            {formatCompactINR(fin.collectedAmount)}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.22rem 0 0.05rem', fontSize: '0.86rem' }}>
                          <span style={{ color: '#0f172a', fontWeight: 700 }}>Remaining</span>
                          <span style={{ fontWeight: 800, color: fin.remainingAmount > 0 ? '#b91c1c' : '#15803d', fontSize: '0.94rem' }}>
                            {formatCompactINR(fin.remainingAmount)}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                );
              })()}

              {/* ── DRIVER ACTION BUTTONS (Optimized for 1-Handed Mobile Touch) ── */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                {isPending && (
                  <>
                    {/* Primary 1: Collect Payment */}
                    <button
                      type="button"
                      onClick={() => openCollect(delivery)}
                      style={{
                        flex: 1,
                        height: '44px',
                        minHeight: '44px',
                        background: '#ffffff',
                        color: '#0f172a',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        fontSize: '0.85rem',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.35rem',
                        cursor: 'pointer',
                      }}
                    >
                      <HandCoins size={16} color="#b91c1c" />
                      <span>Collect Payment</span>
                    </button>

                    {/* Primary 2: Complete Delivery */}
                    <button
                      type="button"
                      onClick={() => openComplete(delivery)}
                      style={{
                        flex: 1.15,
                        height: '44px',
                        minHeight: '44px',
                        background: '#15803d',
                        color: '#ffffff',
                        border: '1px solid #166534',
                        borderRadius: '6px',
                        fontSize: '0.88rem',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.35rem',
                        cursor: 'pointer',
                        boxShadow: 'var(--shadow-sm)',
                      }}
                    >
                      <Check size={18} />
                      <span>Delivered</span>
                    </button>

                    {/* Skip */}
                    <button
                      type="button"
                      onClick={() => {
                        setSkipDelivery(delivery);
                        setSkipReason(SKIP_REASONS[0]);
                        setActionError(null);
                      }}
                      title="Skip Stop"
                      style={{
                        height: '44px',
                        minHeight: '44px',
                        padding: '0 0.75rem',
                        background: '#f8fafc',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        color: '#64748b',
                        fontSize: '0.76rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Skip
                    </button>
                  </>
                )}

                {isDelivered && (
                  <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.78rem', color: '#15803d', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <CheckCircle2 size={16} color="#15803d" />
                      Delivered
                    </span>

                    {/* Allow collecting any remaining overdue balance */}
                    {fin.remainingAmount > 0 ? (
                      <button
                        type="button"
                        onClick={() => openCollect(delivery)}
                        style={{
                          height: '38px',
                          minHeight: '38px',
                          padding: '0 0.85rem',
                          background: '#f0fdf4',
                          color: '#15803d',
                          border: '1px solid #86efac',
                          borderRadius: '6px',
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                        }}
                      >
                        <HandCoins size={14} />
                        <span>Collect Remaining</span>
                      </button>
                    ) : (
                      <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>
                        All settled ✓
                      </span>
                    )}
                  </div>
                )}


                {isNotDelivered && (
                  <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.76rem', color: '#dc2626', fontWeight: 600 }}>
                      Skipped: {delivery.failed_reason || 'Shop closed'}
                    </span>
                    <button
                      type="button"
                      onClick={() => openComplete(delivery)}
                      style={{
                        minHeight: '36px',
                        padding: '0 0.75rem',
                        background: '#0f172a',
                        color: 'white',
                        border: 'none',
                        borderRadius: '7px',
                        fontSize: '0.76rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Retry Deliver
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ===================================================================== */}
      {/* ── MODAL 1: SIMPLE PAYMENT / COLLECTION (Touch-Friendly Bottom Sheet) ─ */}
      {/* ===================================================================== */}
      {paymentDelivery && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.55)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
          }}
          onClick={() => !submitting && setPaymentDelivery(null)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '540px',
              background: 'var(--bg-card, #ffffff)',
              borderRadius: '8px 8px 0 0',
              padding: '1.25rem 1.25rem 2rem 1.25rem',
              boxShadow: 'var(--shadow-lg)',
              border: '1px solid var(--border)',
              borderBottom: 'none',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div>
                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#059669', textTransform: 'uppercase' }}>
                  COLLECT PAYMENT
                </span>
                <h3 style={{ margin: '0.1rem 0 0 0', fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main, #0f172a)' }}>
                  {paymentDelivery.order_details?.customer_details?.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPaymentDelivery(null)}
                disabled={submitting}
                style={{
                  background: '#f1f5f9',
                  border: 'none',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <X size={18} />
              </button>
            </div>

            {actionError && (
              <div
                style={{
                  padding: '0.55rem 0.85rem',
                  borderRadius: '8px',
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  color: '#b91c1c',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  marginBottom: '0.85rem',
                }}
              >
                {actionError}
              </div>
            )}

            <form onSubmit={handleConfirmPayment}>
              {/* Quick Amount Selector Pills */}
              {(() => {
                const fin = getFinancials(paymentDelivery);
                return (
                  <div style={{ display: 'flex', gap: '0.45rem', marginBottom: '0.85rem' }}>
                    {fin.todayAmount > 0 && (
                      <button
                        type="button"
                        onClick={() => setCollectAmount(String(fin.todayAmount))}
                        style={{
                          flex: 1,
                          padding: '0.4rem',
                          borderRadius: '8px',
                          border: collectAmount === String(fin.todayAmount) ? '2px solid #059669' : '1px solid #cbd5e1',
                          background: collectAmount === String(fin.todayAmount) ? '#ecfdf5' : '#f8fafc',
                          color: '#065f46',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        Bill: ₹{fin.todayAmount}
                      </button>
                    )}
                    {fin.totalDue > 0 && fin.totalDue !== fin.todayAmount && (
                      <button
                        type="button"
                        onClick={() => setCollectAmount(String(fin.totalDue))}
                        style={{
                          flex: 1,
                          padding: '0.4rem',
                          borderRadius: '8px',
                          border: collectAmount === String(fin.totalDue) ? '2px solid #059669' : '1px solid #cbd5e1',
                          background: collectAmount === String(fin.totalDue) ? '#ecfdf5' : '#f8fafc',
                          color: '#065f46',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        Total Due: ₹{fin.totalDue}
                      </button>
                    )}
                  </div>
                );
              })()}

              {/* Amount Input */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                  Amount to Collect (₹)
                </label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontWeight: 800, fontSize: '1.2rem', color: '#64748b' }}>
                    ₹
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    autoFocus
                    value={collectAmount}
                    onChange={(e) => setCollectAmount(e.target.value)}
                    placeholder="0.00"
                    style={{
                      width: '100%',
                      padding: '0.75rem 0.75rem 0.75rem 2.2rem',
                      borderRadius: '10px',
                      border: '2px solid #cbd5e1',
                      fontSize: '1.25rem',
                      fontWeight: 800,
                      color: '#0f172a',
                      outline: 'none',
                    }}
                  />
                </div>
              </div>

              {/* Payment Method: Cash vs GPay (Large Touch Targets) */}
              <div style={{ marginBottom: '1.15rem' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                  Payment Method
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => setCollectMethod('CASH')}
                    style={{
                      minHeight: '48px',
                      borderRadius: '10px',
                      border: collectMethod === 'CASH' ? '2.5px solid #059669' : '1.5px solid #cbd5e1',
                      background: collectMethod === 'CASH' ? '#ecfdf5' : '#ffffff',
                      color: collectMethod === 'CASH' ? '#047857' : '#475569',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.45rem',
                      fontWeight: 800,
                      fontSize: '0.92rem',
                      cursor: 'pointer',
                    }}
                  >
                    <Banknote size={20} />
                    <span>CASH</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCollectMethod('GPAY_UPI')}
                    style={{
                      minHeight: '48px',
                      borderRadius: '10px',
                      border: collectMethod === 'GPAY_UPI' ? '2.5px solid #2563eb' : '1.5px solid #cbd5e1',
                      background: collectMethod === 'GPAY_UPI' ? '#eff6ff' : '#ffffff',
                      color: collectMethod === 'GPAY_UPI' ? '#1d4ed8' : '#475569',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.45rem',
                      fontWeight: 800,
                      fontSize: '0.92rem',
                      cursor: 'pointer',
                    }}
                  >
                    <QrCode size={20} />
                    <span>GPay / UPI</span>
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={submitting}
                style={{
                  width: '100%',
                  height: '46px',
                  minHeight: '46px',
                  borderRadius: '6px',
                  background: '#15803d',
                  color: 'white',
                  border: '1px solid #166534',
                  fontSize: '0.94rem',
                  fontWeight: 700,
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                {submitting ? (
                  <>
                    <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                    <span>Recording Payment...</span>
                  </>
                ) : (
                  <>
                    <Check size={18} />
                    <span>Confirm ₹{collectAmount || '0'} Collected</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* ── MODAL 2: COMPLETE DELIVERY ACTION ──────────────────────────────── */}
      {/* ===================================================================== */}
      {completeDelivery && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.55)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
          }}
          onClick={() => !submitting && setCompleteDelivery(null)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '540px',
              background: 'var(--bg-card, #ffffff)',
              borderRadius: '8px 8px 0 0',
              padding: '1.25rem 1.25rem 2rem 1.25rem',
              boxShadow: 'var(--shadow-lg)',
              border: '1px solid var(--border)',
              borderBottom: 'none',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div>
                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#059669', textTransform: 'uppercase' }}>
                  COMPLETE DELIVERY
                </span>
                <h3 style={{ margin: '0.1rem 0 0 0', fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main, #0f172a)' }}>
                  {completeDelivery.order_details?.customer_details?.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setCompleteDelivery(null)}
                disabled={submitting}
                style={{
                  background: '#f1f5f9',
                  border: 'none',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <X size={18} />
              </button>
            </div>

            {actionError && (
              <div
                style={{
                  padding: '0.55rem 0.85rem',
                  borderRadius: '8px',
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  color: '#b91c1c',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  marginBottom: '0.85rem',
                }}
              >
                {actionError}
              </div>
            )}

            <form onSubmit={handleConfirmComplete}>
              {/* Recipient Input */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                  Received by (Owner / Staff Name)
                </label>
                <input
                  type="text"
                  required
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="e.g. Shop Owner / Manager"
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '8px',
                    border: '1.5px solid #cbd5e1',
                    fontSize: '0.92rem',
                    color: '#0f172a',
                    outline: 'none',
                  }}
                />
              </div>

              {/* Optional: Collect Payment Checkbox */}
              <div
                style={{
                  background: '#f8fafc',
                  border: '1.5px solid #cbd5e1',
                  borderRadius: '10px',
                  padding: '0.75rem 0.85rem',
                  marginBottom: '1.15rem',
                }}
              >
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.86rem', fontWeight: 700, color: '#0f172a' }}>
                  <input
                    type="checkbox"
                    checked={includePayment}
                    onChange={(e) => setIncludePayment(e.target.checked)}
                    style={{ width: '18px', height: '18px', accentColor: '#059669', cursor: 'pointer' }}
                  />
                  <span>Also collect payment now (₹{getFinancials(completeDelivery).todayAmount})</span>
                </label>

                {includePayment && (
                  <div style={{ marginTop: '0.65rem', paddingTop: '0.65rem', borderTop: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.45rem', marginBottom: '0.5rem' }}>
                      <button
                        type="button"
                        onClick={() => setCompletePayMethod('CASH')}
                        style={{
                          padding: '0.45rem',
                          borderRadius: '6px',
                          border: completePayMethod === 'CASH' ? '2px solid #059669' : '1px solid #cbd5e1',
                          background: completePayMethod === 'CASH' ? '#ecfdf5' : '#ffffff',
                          color: completePayMethod === 'CASH' ? '#047857' : '#475569',
                          fontWeight: 700,
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                        }}
                      >
                        Cash
                      </button>
                      <button
                        type="button"
                        onClick={() => setCompletePayMethod('GPAY_UPI')}
                        style={{
                          padding: '0.45rem',
                          borderRadius: '6px',
                          border: completePayMethod === 'GPAY_UPI' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                          background: completePayMethod === 'GPAY_UPI' ? '#eff6ff' : '#ffffff',
                          color: completePayMethod === 'GPAY_UPI' ? '#1d4ed8' : '#475569',
                          fontWeight: 700,
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                        }}
                      >
                        GPay / UPI
                      </button>
                    </div>

                    <input
                      type="number"
                      step="0.01"
                      value={completePayAmount}
                      onChange={(e) => setCompletePayAmount(e.target.value)}
                      placeholder="Amount"
                      style={{
                        width: '100%',
                        padding: '0.45rem 0.65rem',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        fontSize: '0.88rem',
                        fontWeight: 700,
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Confirm Complete Button */}
              <button
                type="submit"
                disabled={submitting}
                style={{
                  width: '100%',
                  height: '46px',
                  minHeight: '46px',
                  borderRadius: '6px',
                  background: '#15803d',
                  color: 'white',
                  border: '1px solid #166534',
                  fontSize: '0.94rem',
                  fontWeight: 700,
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                {submitting ? (
                  <>
                    <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                    <span>Confirming Delivery...</span>
                  </>
                ) : (
                  <>
                    <Check size={18} />
                    <span>Mark Delivery Completed</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* ── MODAL 3: SKIP STOP / NOT DELIVERED ─────────────────────────────── */}
      {/* ===================================================================== */}
      {skipDelivery && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.55)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
          }}
          onClick={() => !submitting && setSkipDelivery(null)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '540px',
              background: 'var(--bg-card, #ffffff)',
              borderRadius: '8px 8px 0 0',
              padding: '1.25rem 1.25rem 2rem 1.25rem',
              boxShadow: 'var(--shadow-lg)',
              border: '1px solid var(--border)',
              borderBottom: 'none',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div>
                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#b91c1c', textTransform: 'uppercase' }}>
                  SKIP STOP / NOT DELIVERED
                </span>
                <h3 style={{ margin: '0.1rem 0 0 0', fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary, #0f172a)' }}>
                  {skipDelivery.order_details?.customer_details?.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSkipDelivery(null)}
                disabled={submitting}
                style={{
                  background: '#f1f5f9',
                  border: 'none',
                  borderRadius: '4px',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '0.5rem' }}>
                Select Reason
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {SKIP_REASONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setSkipReason(r)}
                    style={{
                      textAlign: 'left',
                      padding: '0.6rem 0.85rem',
                      borderRadius: '6px',
                      border: skipReason === r ? '2px solid #b91c1c' : '1px solid #cbd5e1',
                      background: skipReason === r ? '#fef2f2' : '#ffffff',
                      color: skipReason === r ? '#b91c1c' : '#334155',
                      fontWeight: skipReason === r ? 700 : 500,
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                    }}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={handleConfirmSkip}
              disabled={submitting}
              style={{
                width: '100%',
                height: '46px',
                minHeight: '46px',
                borderRadius: '6px',
                background: '#b91c1c',
                color: 'white',
                border: '1px solid #991b1b',
                fontSize: '0.92rem',
                fontWeight: 700,
                cursor: submitting ? 'not-allowed' : 'pointer',
              }}
            >
              {submitting ? 'Saving...' : 'Confirm Skip Stop'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
