import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Store,
  MapPin,
  Phone,
  Plus,
  Minus,
  ShoppingCart,
  CheckCircle2,
  AlertCircle,
  Package,
  ArrowRight,
  Sparkles,
  Share2,
  RotateCcw,
  Check,
  Calendar,
  X,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';
import { useSettings } from '../../context/SettingsContext';
import { MaintenanceScreen } from '../../components/MaintenanceScreen';
import { API_BASE_URL } from '../../services/apiClient';

interface ProductInfo {
  id: string;
  name: string;
  code: string;
  unit: string;
  price: string;
}

interface CustomerInfo {
  id: string;
  name: string;
  owner_name: string;
  address: string;
  phone: string;
  current_balance: string;
}

export const CustomerOrderPage: React.FC = () => {
  const { customerId } = useParams();
  const { isWhatsAppEnabled, isSelfOrderEnabled, isMaintenanceMode, businessPhone, businessName, gstNumber, settings } = useSettings();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [customer, setCustomer] = useState<CustomerInfo | null>(null);
  const [products, setProducts] = useState<ProductInfo[]>([]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isConfirmedCheckbox, setIsConfirmedCheckbox] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submittedOrderNo, setSubmittedOrderNo] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    const fetchLinkData = async () => {
      try {
        setLoading(true);
        const apiBase = API_BASE_URL;
        let res = await fetch(`${apiBase}/public/customer-order/${customerId}/`);
        if (!res.ok && res.status === 404) {
          res = await fetch(`${apiBase}/orders/public/customer-order/${customerId}/`);
        }

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || errData.detail || `Customer link not found or inactive (HTTP ${res.status}).`);
        }
        const data = await res.json();
        setCustomer(data.customer);
        setProducts(data.products || []);

        // Check local storage if they already submitted in this session
        const cachedSubmit = localStorage.getItem(`submitted_order_${customerId}`);
        if (cachedSubmit) {
          setSubmittedOrderNo(cachedSubmit);
        }
      } catch (err: unknown) {
        if (err instanceof Error) setError(err.message);
        else setError('Failed to load order page.');
      } finally {
        setLoading(false);
      }
    };
    if (customerId) {
      fetchLinkData();
    }
  }, [customerId]);

  const handleQtyChange = (productId: string, val: string) => {
    const num = parseInt(val, 10);
    setQuantities((prev) => ({
      ...prev,
      [productId]: isNaN(num) || num < 0 ? 0 : num,
    }));
  };

  const incrementQty = (productId: string, delta = 1) => {
    setQuantities((prev) => {
      const current = prev[productId] || 0;
      return {
        ...prev,
        [productId]: current + delta,
      };
    });
  };

  const decrementQty = (productId: string, delta = 1) => {
    setQuantities((prev) => {
      const current = prev[productId] || 0;
      const next = Math.max(0, current - delta);
      return {
        ...prev,
        [productId]: next,
      };
    });
  };

  const getOrderTotal = () => {
    let total = 0;
    products.forEach((p) => {
      const qty = quantities[p.id] || 0;
      total += qty * parseFloat(p.price);
    });
    return total;
  };

  const activeItems = products.filter((p) => (quantities[p.id] || 0) > 0);
  const totalItemCount = activeItems.reduce((acc, p) => acc + (quantities[p.id] || 0), 0);
  const orderTotal = getOrderTotal();
  const currentBalance = customer ? parseFloat(customer.current_balance || '0') : 0;
  const grandTotal = orderTotal + currentBalance;

  const handleSubmit = async () => {
    if (!isConfirmedCheckbox || activeItems.length === 0) return;
    try {
      setSubmitting(true);

      const itemsPayload = activeItems.map((p) => ({
        product_id: p.id,
        quantity: quantities[p.id],
      }));

      // Explicitly determine business order date in Indian Standard Time (Asia/Kolkata)
      let kolkataDate = '';
      try {
        kolkataDate = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Asia/Kolkata',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).format(new Date());
      } catch {
        const d = new Date();
        kolkataDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      }

      const orderPayload = {
        items: itemsPayload,
        order_date: kolkataDate,
      };

      const apiBase = API_BASE_URL;
      let res = await fetch(`${apiBase}/public/customer-order/${customerId}/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload),
      });
      if (!res.ok && res.status === 404) {
        res = await fetch(`${apiBase}/orders/public/customer-order/${customerId}/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(orderPayload),
        });
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const msg = errData.detail || errData.error || (typeof errData === 'object' ? JSON.stringify(errData) : 'Failed to submit order.');
        throw new Error(msg);
      }

      const data = await res.json();
      setSubmittedOrderNo(data.order_number);
      if (customerId) {
        localStorage.setItem(`submitted_order_${customerId}`, data.order_number);
      }
      setIsConfirmModalOpen(false);
    } catch (err: unknown) {
      if (err instanceof Error) alert(err.message);
      else alert('Failed to submit order.');
    } finally {
      setSubmitting(false);
    }
  };

  const shareOnWhatsApp = () => {
    if (!customer || !submittedOrderNo) return;
    const storeName = (businessName || settings?.business_name || 'Zamzam Foods').toUpperCase();
    const storeGst = gstNumber || settings?.gst_number || '';
    const storeContact = businessPhone || settings?.phone_number || '';

    const itemsText = activeItems.map((p) => `• ${p.name}: ${quantities[p.id]} ${p.unit} (₹${(quantities[p.id] * parseFloat(p.price)).toFixed(2)})`).join('\n');
    let msg = `*${storeName} - WHOLESALE ORDER*\n`;
    if (storeGst) msg += `GSTIN: *${storeGst}*\n`;
    if (storeContact) msg += `Ph: ${storeContact}\n`;
    msg += `--------------------------------\n`;
    msg += `Order #: *${submittedOrderNo}*\n`;
    msg += `Shop: *${customer.name}*\n`;
    if (customer.address) msg += `Address: ${customer.address}\n`;
    msg += `--------------------------------\n`;
    msg += `*Items:*\n${itemsText}\n\n`;
    msg += `*Order Total: ₹${orderTotal.toFixed(2)}*\n`;
    msg += `Order placed via Customer Portal.`;

    const cleanPhone = storeContact ? storeContact.replace(/[^0-9]/g, '') : '';
    const targetUrl = cleanPhone.length === 10 ? `https://wa.me/91${cleanPhone}?text=${encodeURIComponent(msg)}` : cleanPhone ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(targetUrl, '_blank');
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
        <div style={{ textAlign: 'center', maxWidth: '340px' }}>
          <div
            style={{
              width: '54px',
              height: '54px',
              border: '3px solid #e2e8f0',
              borderTopColor: '#dc2626',
              borderRadius: '50%',
              margin: '0 auto 1.25rem',
              animation: 'spin 0.8s linear infinite',
            }}
          />
          <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.35rem' }}>Loading Shop Menu...</h3>
          <p style={{ fontSize: '0.85rem', color: '#64748b' }}>Connecting to Zamzam Foods Wholesale Portal</p>
        </div>
      </div>
    );
  }

  if (isMaintenanceMode) {
    return <MaintenanceScreen isPublic={true} />;
  }

  if (!isSelfOrderEnabled) {
    return (
      <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
        <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #fed7aa', padding: '2.5rem 1.5rem', maxWidth: '440px', width: '100%', textAlign: 'center', boxShadow: '0 10px 25px rgba(0,0,0,0.05)' }}>
          <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: '#ffedd5', color: '#ea580c', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem' }}>
            <ShoppingCart size={30} />
          </div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#9a3412', marginBottom: '0.5rem' }}>Online Ordering Paused</h2>
          <p style={{ fontSize: '0.92rem', color: '#64748b', lineHeight: 1.5, marginBottom: '1.5rem' }}>
            Customer self-ordering is currently turned off by {businessName || 'Zamzam Foods'}. Please contact us directly by phone or via your delivery driver to place your order.
          </p>
          {businessPhone && (
            <a
              href={`tel:${businessPhone.replace(/\s+/g, '')}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                width: '100%',
                padding: '0.85rem',
                background: '#ea580c',
                color: '#fff',
                borderRadius: '10px',
                fontWeight: 700,
                fontSize: '0.95rem',
                textDecoration: 'none',
              }}
            >
              <Phone size={18} />
              Call {businessPhone}
            </a>
          )}
        </div>
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
        <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #fecaca', padding: '2rem 1.5rem', maxWidth: '420px', width: '100%', textAlign: 'center', boxShadow: '0 10px 25px rgba(0,0,0,0.05)' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#fee2e2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
            <AlertCircle size={28} />
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#991b1b', marginBottom: '0.5rem' }}>Unable to Open Link</h2>
          <p style={{ fontSize: '0.9rem', color: '#64748b', lineHeight: 1.5, marginBottom: '1.5rem' }}>
            {error || 'This customer order link is inactive or invalid. Please request a new link from your delivery driver or manager.'}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              width: '100%',
              padding: '0.75rem',
              background: '#dc2626',
              color: '#fff',
              border: 'none',
              borderRadius: '10px',
              fontWeight: 700,
              fontSize: '0.95rem',
              cursor: 'pointer',
            }}
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Success Receipt Screen
  if (submittedOrderNo) {
    return (
      <div style={{ minHeight: '100vh', background: '#fff5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
        <div
          style={{
            background: '#ffffff',
            borderRadius: '20px',
            border: '1.5px solid #fca5a5',
            padding: '2rem 1.5rem',
            maxWidth: '460px',
            width: '100%',
            textAlign: 'center',
            boxShadow: '0 20px 35px -10px rgba(220, 38, 38, 0.15)',
          }}
        >
          <div
            style={{
              width: '68px',
              height: '68px',
              borderRadius: '50%',
              background: '#fee2e2',
              color: '#dc2626',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.25rem',
              boxShadow: '0 0 0 8px #fff5f5',
            }}
          >
            <CheckCircle2 size={38} strokeWidth={2.5} />
          </div>

          <span
            style={{
              display: 'inline-block',
              background: '#fee2e2',
              color: '#991b1b',
              fontSize: '0.75rem',
              fontWeight: 800,
              padding: '0.25rem 0.75rem',
              borderRadius: '999px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: '0.5rem',
            }}
          >
            Order Confirmed
          </span>

          <h2 style={{ fontSize: '1.45rem', fontWeight: 900, color: '#0f172a', marginBottom: '0.35rem' }}>
            Thank You, {customer.name}!
          </h2>
          <p style={{ fontSize: '0.88rem', color: '#64748b', marginBottom: '1.25rem' }}>
            Your wholesale order has been scheduled with route dispatch.
          </p>

          <div
            style={{
              background: '#f8fafc',
              border: '1px dashed #cbd5e1',
              borderRadius: '12px',
              padding: '1rem',
              marginBottom: '1.5rem',
            }}
          >
            <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>
              Order Reference
            </div>
            <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#dc2626', letterSpacing: '0.03em', marginTop: '0.25rem' }}>
              #{submittedOrderNo}
            </div>
            {orderTotal > 0 && (
              <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ color: '#64748b' }}>Order Value:</span>
                <span style={{ fontWeight: 800, color: '#0f172a' }}>{formatCurrency(orderTotal)}</span>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {isWhatsAppEnabled && (
              <button
                type="button"
                onClick={shareOnWhatsApp}
                style={{
                  width: '100%',
                  padding: '0.85rem 1rem',
                  background: '#25D366',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '0.95rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  boxShadow: '0 4px 12px rgba(37, 211, 102, 0.25)',
                }}
              >
                <Share2 size={18} />
                <span>Share Order to WhatsApp</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                if (customerId) {
                  localStorage.removeItem(`submitted_order_${customerId}`);
                }
                setSubmittedOrderNo(null);
                setQuantities({});
                setIsConfirmedCheckbox(false);
              }}
              style={{
                width: '100%',
                padding: '0.8rem 1rem',
                background: '#ffffff',
                color: '#475569',
                border: '1.5px solid #cbd5e1',
                borderRadius: '12px',
                fontSize: '0.9rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
              }}
            >
              <RotateCcw size={16} />
              <span>Place Another Order</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', flexDirection: 'column' }}>
      {/* 1. Header Banner */}
      <header
        style={{
          background: '#7f1d1d',
          color: '#ffffff',
          padding: '1.25rem 1rem 1.25rem',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div style={{ maxWidth: '520px', margin: '0 auto', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: 'rgba(255, 255, 255, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 900,
                  fontSize: '1rem',
                }}
              >
                🥖
              </div>
              <div>
                <h1 style={{ fontSize: '1.05rem', fontWeight: 900, letterSpacing: '0.04em', margin: 0, textTransform: 'uppercase' }}>
                  Zamzam Foods
                </h1>
                <span style={{ fontSize: '0.72rem', color: '#fca5a5', fontWeight: 600 }}>Wholesale Direct Portal</span>
              </div>
            </div>

            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                background: 'rgba(239, 68, 68, 0.25)',
                border: '1px solid rgba(252, 165, 165, 0.4)',
                padding: '0.2rem 0.55rem',
                borderRadius: '999px',
                fontSize: '0.72rem',
                fontWeight: 700,
                color: '#fee2e2',
              }}
            >
              <span
                style={{
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  background: '#fca5a5',
                  boxShadow: '0 0 6px #fca5a5',
                }}
              />
              <span>Live Today</span>
            </div>
          </div>
        </div>
      </header>

      {/* 2. Scrollable Body Content */}
      <main
        style={{
          flex: 1,
          maxWidth: '520px',
          width: '100%',
          margin: '0 auto',
          padding: '1rem 1rem 7.5rem 1rem',
        }}
      >
        {/* Customer Shop Details Card */}
        <section
          style={{
            background: '#ffffff',
            borderRadius: '16px',
            border: '1px solid #e2e8f0',
            padding: '1.15rem',
            marginBottom: '1.25rem',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            position: 'relative',
            marginTop: '-0.75rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: '#fee2e2',
                  color: '#dc2626',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Store size={18} />
              </div>
              <div>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', margin: 0, lineHeight: 1.2 }}>
                  {customer.name}
                </h2>
                {customer.owner_name && (
                  <span style={{ fontSize: '0.76rem', color: '#64748b' }}>Attn: {customer.owner_name}</span>
                )}
              </div>
            </div>

            {/* Prev Balance Pill */}
            {currentBalance > 0 ? (
              <span
                style={{
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  color: '#dc2626',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  padding: '0.2rem 0.5rem',
                  borderRadius: '6px',
                  whiteSpace: 'nowrap',
                }}
              >
                Due: {formatCurrency(currentBalance)}
              </span>
            ) : (
              <span
                style={{
                  background: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  color: '#16a34a',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  padding: '0.2rem 0.5rem',
                  borderRadius: '6px',
                  whiteSpace: 'nowrap',
                }}
              >
                ✓ Balance Clear
              </span>
            )}
          </div>

          {customer.address && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', color: '#64748b', marginTop: '0.35rem' }}>
              <MapPin size={14} style={{ flexShrink: 0, color: '#94a3b8' }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {customer.address}
              </span>
            </div>
          )}
        </section>

        {/* Section Heading */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', padding: '0 0.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Package size={16} color="#dc2626" />
            <h3 style={{ fontSize: '0.92rem', fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.04em', margin: 0 }}>
              Order Fresh Breads
            </h3>
          </div>
          <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Custom Wholesale Rates</span>
        </div>

        {/* Products List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {products.map((p) => {
            const qty = quantities[p.id] || 0;
            const unitPrice = parseFloat(p.price) || 0;
            const itemSubtotal = qty * unitPrice;
            const isKubbus = p.name.toLowerCase().includes('kubbus') || p.code === 'KUB' || p.code === 'KBS';

            return (
              <div
                key={p.id}
                style={{
                  background: '#ffffff',
                  borderRadius: '16px',
                  border: qty > 0 ? '1.5px solid #dc2626' : '1px solid #e2e8f0',
                  padding: '1rem 1.15rem',
                  boxShadow: qty > 0 ? '0 4px 15px rgba(220, 38, 38, 0.12)' : '0 2px 6px rgba(0,0,0,0.03)',
                  transition: 'all 0.2s ease',
                }}
              >
                {/* Product Info Row */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <div
                      style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '10px',
                        background: isKubbus ? '#fef3c7' : '#ffedd5',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.25rem',
                        flexShrink: 0,
                      }}
                    >
                      {isKubbus ? '🥖' : '🫓'}
                    </div>
                    <div>
                      <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                        {p.name}
                      </h4>
                      <span style={{ fontSize: '0.82rem', color: '#dc2626', fontWeight: 700 }}>
                        {formatCurrency(unitPrice)} <span style={{ color: '#94a3b8', fontWeight: 500 }}>/ {p.unit || 'Packet'}</span>
                      </span>
                    </div>
                  </div>

                  {/* Dynamic Subtotal */}
                  {qty > 0 && (
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block' }}>Subtotal</span>
                      <span style={{ fontSize: '1.05rem', fontWeight: 900, color: '#dc2626' }}>
                        {formatCurrency(itemSubtotal)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Stepper Controls Row */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.5rem',
                    background: '#f8fafc',
                    padding: '0.4rem 0.5rem',
                    borderRadius: '12px',
                    border: '1px solid #f1f5f9',
                  }}
                >
                  <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 700, paddingLeft: '0.5rem' }}>
                    Quantity
                  </span>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <button
                      type="button"
                      onClick={() => decrementQty(p.id, 1)}
                      disabled={qty <= 0}
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        border: '1.5px solid #cbd5e1',
                        background: qty > 0 ? '#ffffff' : '#f1f5f9',
                        color: qty > 0 ? '#ef4444' : '#cbd5e1',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: qty > 0 ? 'pointer' : 'default',
                        transition: 'all 0.15s ease',
                      }}
                      title="Decrease quantity by 1"
                    >
                      <Minus size={16} strokeWidth={2.5} />
                    </button>

                    <input
                      type="number"
                      min="0"
                      step="1"
                      className="form-input"
                      placeholder="0"
                      value={qty === 0 ? '' : qty}
                      onChange={(e) => handleQtyChange(p.id, e.target.value)}
                      style={{
                        width: '64px',
                        height: '36px',
                        textAlign: 'center',
                        fontSize: '1.1rem',
                        fontWeight: 900,
                        padding: '0.2rem',
                        borderRadius: '8px',
                        border: qty > 0 ? '1.5px solid #dc2626' : '1px solid #cbd5e1',
                        background: qty > 0 ? '#ffffff' : '#ffffff',
                        color: '#0f172a',
                      }}
                    />

                    <button
                      type="button"
                      onClick={() => incrementQty(p.id, 1)}
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        border: 'none',
                        background: '#dc2626',
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        boxShadow: '0 2px 6px rgba(220, 38, 38, 0.3)',
                        transition: 'all 0.15s ease',
                      }}
                      title="Increase quantity by 1"
                    >
                      <Plus size={16} strokeWidth={2.5} />
                    </button>
                  </div>
                </div>

                {/* Quick Increment Chips (Wholesale Presets: +10, +25, +50, +100) */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600, marginRight: '0.2rem' }}>Quick Add:</span>
                  {[10, 25, 50, 100].map((step) => (
                    <button
                      key={step}
                      type="button"
                      onClick={() => incrementQty(p.id, step)}
                      style={{
                        background: '#f1f5f9',
                        border: '1px solid #e2e8f0',
                        borderRadius: '6px',
                        padding: '0.2rem 0.5rem',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        color: '#334155',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      +{step}
                    </button>
                  ))}
                  {qty > 0 && (
                    <button
                      type="button"
                      onClick={() => setQuantities((prev) => ({ ...prev, [p.id]: 0 }))}
                      style={{
                        marginLeft: 'auto',
                        background: 'transparent',
                        border: 'none',
                        color: '#94a3b8',
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        textDecoration: 'underline',
                      }}
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* 3. Floating Fixed Bottom Checkout Bar (Clean, gapless on all devices) */}
      <footer
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: '#ffffff',
          borderTop: '1px solid #cbd5e1',
          boxShadow: 'var(--shadow-md)',
          zIndex: 90,
          padding: '0.75rem 1rem calc(0.75rem + env(safe-area-inset-bottom, 0px))',
        }}
      >
        <div
          style={{
            maxWidth: '520px',
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
          }}
        >
          {/* Total Info */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.1rem' }}>
              <span style={{ fontSize: '0.74rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em' }}>
                Order Total
              </span>
              {totalItemCount > 0 && (
                <span
                  style={{
                    background: '#fee2e2',
                    color: '#dc2626',
                    fontSize: '0.7rem',
                    fontWeight: 800,
                    padding: '0.05rem 0.4rem',
                    borderRadius: '4px',
                  }}
                >
                  {totalItemCount} {totalItemCount === 1 ? 'pkt' : 'pkts'}
                </span>
              )}
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 900, color: orderTotal > 0 ? '#b91c1c' : '#0f172a', lineHeight: 1.1 }}>
              {formatCurrency(orderTotal)}
            </div>
          </div>

          {/* Action Button */}
          <button
            type="button"
            onClick={() => setIsConfirmModalOpen(true)}
            disabled={activeItems.length === 0}
            style={{
              padding: '0.65rem 1.4rem',
              background: activeItems.length > 0 ? '#b91c1c' : '#cbd5e1',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              fontSize: '0.95rem',
              fontWeight: 800,
              cursor: activeItems.length > 0 ? 'pointer' : 'not-allowed',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              boxShadow: 'var(--shadow-sm)',
              transition: 'background 0.15s ease',
            }}
          >
            <span>{activeItems.length > 0 ? 'Review Order' : 'Add Items'}</span>
            <ArrowRight size={17} />
          </button>
        </div>
      </footer>

      {/* 4. Order Confirmation Modal / Bottom-Sheet */}
      {isConfirmModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.6)',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 0,
          }}
        >
          <div
            style={{
              background: '#ffffff',
              width: '100%',
              maxWidth: '520px',
              borderTopLeftRadius: '24px',
              borderTopRightRadius: '24px',
              padding: '1.5rem 1.25rem calc(1.5rem + env(safe-area-inset-bottom, 0px))',
              maxHeight: '88vh',
              overflowY: 'auto',
              boxShadow: '0 -10px 40px rgba(0,0,0,0.2)',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    background: '#fee2e2',
                    color: '#dc2626',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <ShoppingCart size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                    Confirm Wholesale Order
                  </h3>
                  <span style={{ fontSize: '0.76rem', color: '#64748b' }}>Delivery scheduled for today</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsConfirmModalOpen(false)}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  border: '1px solid #e2e8f0',
                  background: '#f8fafc',
                  color: '#64748b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Shop Badge */}
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '0.75rem 0.9rem',
                marginBottom: '1rem',
              }}
            >
              <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.95rem' }}>{customer.name}</div>
              {customer.address && (
                <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.15rem' }}>{customer.address}</div>
              )}
            </div>

            {/* Line Items Receipt Card */}
            <div
              style={{
                background: '#f8fafc',
                border: '1px dashed #cbd5e1',
                borderRadius: '12px',
                padding: '1rem',
                marginBottom: '1.25rem',
              }}
            >
              <div style={{ fontSize: '0.76rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.6rem' }}>
                Item Summary
              </div>

              {activeItems.map((p) => {
                const qty = quantities[p.id] || 0;
                const price = parseFloat(p.price);
                const sub = qty * price;
                return (
                  <div
                    key={p.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '0.9rem',
                      padding: '0.35rem 0',
                    }}
                  >
                    <div>
                      <span style={{ fontWeight: 700, color: '#0f172a' }}>{p.name}</span>
                      <span style={{ color: '#64748b', fontSize: '0.8rem', marginLeft: '0.4rem' }}>
                        × {qty} {p.unit || 'pkts'}
                      </span>
                    </div>
                    <span style={{ fontWeight: 800, color: '#0f172a' }}>{formatCurrency(sub)}</span>
                  </div>
                );
              })}

              <div style={{ borderTop: '1px solid #e2e8f0', marginTop: '0.75rem', paddingTop: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', color: '#64748b', marginBottom: '0.35rem' }}>
                  <span>Order Subtotal:</span>
                  <span style={{ fontWeight: 800, color: '#0f172a' }}>{formatCurrency(orderTotal)}</span>
                </div>

                {currentBalance > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#dc2626', marginBottom: '0.35rem' }}>
                    <span>Previous Outstanding Due:</span>
                    <span style={{ fontWeight: 700 }}>+{formatCurrency(currentBalance)}</span>
                  </div>
                )}

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '1.15rem',
                    fontWeight: 900,
                    color: '#dc2626',
                    paddingTop: '0.5rem',
                    borderTop: '1px dashed #cbd5e1',
                  }}
                >
                  <span>Total Amount:</span>
                  <span>{formatCurrency(grandTotal)}</span>
                </div>
              </div>
            </div>

            {/* Confirmation Checkbox */}
            <label
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.65rem',
                background: '#fef2f2',
                border: '1.5px solid #fecaca',
                padding: '0.85rem 1rem',
                borderRadius: '12px',
                cursor: 'pointer',
                marginBottom: '1.25rem',
              }}
            >
              <input
                type="checkbox"
                checked={isConfirmedCheckbox}
                onChange={(e) => setIsConfirmedCheckbox(e.target.checked)}
                style={{
                  marginTop: '0.2rem',
                  width: '18px',
                  height: '18px',
                  accentColor: '#dc2626',
                  cursor: 'pointer',
                }}
              />
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#991b1b', lineHeight: 1.4 }}>
                I confirm this wholesale order. Please pack and dispatch for delivery today.
              </span>
            </label>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => setIsConfirmModalOpen(false)}
                disabled={submitting}
                style={{
                  flex: 1,
                  padding: '0.85rem',
                  background: '#f1f5f9',
                  color: '#475569',
                  border: '1px solid #cbd5e1',
                  borderRadius: '12px',
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  cursor: 'pointer',
                }}
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!isConfirmedCheckbox || submitting}
                style={{
                  flex: 2,
                  padding: '0.75rem',
                  background: isConfirmedCheckbox && !submitting ? '#b91c1c' : '#cbd5e1',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: 800,
                  fontSize: '0.95rem',
                  cursor: isConfirmedCheckbox && !submitting ? 'pointer' : 'not-allowed',
                  boxShadow: 'var(--shadow-sm)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem',
                }}
              >
                {submitting ? (
                  <>
                    <div
                      style={{
                        width: '16px',
                        height: '16px',
                        border: '2px solid #ffffff',
                        borderTopColor: 'transparent',
                        borderRadius: '50%',
                        animation: 'spin 0.8s linear infinite',
                      }}
                    />
                    <span>Submitting Order...</span>
                  </>
                ) : (
                  <>
                    <Check size={18} strokeWidth={2.5} />
                    <span>Submit Wholesale Order</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
