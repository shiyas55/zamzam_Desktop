import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { customerService } from '../../services/customerService';
import { paymentService } from '../../services/paymentService';
import { orderService } from '../../services/orderService';
import { Customer, Order } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import { openWhatsApp, generatePaymentReceiptMessage } from '../../utils/whatsappUtils';
import { useSettings } from '../../context/SettingsContext';
import {
  HandCoins,
  Check,
  AlertCircle,
  QrCode,
  Banknote,
  Share2,
  ArrowLeft,
  Store,
  Phone,
  Calendar,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';

export const DriverCollectPaymentPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isWhatsAppEnabled } = useSettings();

  const stateCustomerId = (location.state as { customerId?: string })?.customerId;
  const stateOrderId = (location.state as { orderId?: string })?.orderId;

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState(stateCustomerId || '');
  const [customerOrders, setCustomerOrders] = useState<Order[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string>(stateOrderId || '');

  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'GPAY_UPI'>('CASH');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Success Confirmation State
  const [successData, setSuccessData] = useState<{
    customerName: string;
    customerPhone?: string;
    paymentNumber: string;
    amount: string;
    paymentMethod: string;
    remainingBalance: string;
    date: string;
  } | null>(null);

  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        setLoading(true);
        // Driver only gets customers on their assigned route (enforced by backend)
        const list = await customerService.getCustomers();
        setCustomers(list);
        if (!selectedCustomerId && list.length > 0) {
          setSelectedCustomerId(list[0].id);
        }
      } catch (err: unknown) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchCustomers();
  }, []);

  // When selected customer changes, fetch their recent orders
  useEffect(() => {
    if (!selectedCustomerId) return;
    const fetchOrders = async () => {
      try {
        const orders = await orderService.getOrders({ customer: selectedCustomerId });
        setCustomerOrders(orders);
        if (stateOrderId && orders.some((o) => o.id === stateOrderId)) {
          setSelectedOrderId(stateOrderId);
          const order = orders.find((o) => o.id === stateOrderId);
          if (order && !amount) {
            setAmount(order.total_amount);
          }
        } else if (orders.length > 0) {
          setSelectedOrderId(orders[0].id);
          if (!amount) setAmount(orders[0].total_amount);
        } else {
          setSelectedOrderId('');
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchOrders();
  }, [selectedCustomerId]);

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);
  const activeOrder = customerOrders.find((o) => o.id === selectedOrderId) || (customerOrders.length > 0 ? customerOrders[0] : null);

  // Financial Breakdown Calculation (Requested items #5, #6, #7)
  const calculateBreakdown = () => {
    const customerBal = parseFloat(selectedCustomer?.current_balance || '0');
    const todayAmount = activeOrder ? parseFloat(activeOrder.total_amount || '0') : 0;

    let previousOutstanding = 0;
    let totalDue = 0;

    if (activeOrder) {
      const orderPrevBal = activeOrder.previous_balance !== undefined && activeOrder.previous_balance !== null
        ? parseFloat(activeOrder.previous_balance)
        : undefined;

      previousOutstanding = orderPrevBal !== undefined
        ? Math.max(0, orderPrevBal)
        : Math.max(0, customerBal - todayAmount);
      totalDue = previousOutstanding + todayAmount;
    } else {
      // Customer with outstanding credit but no today's order
      previousOutstanding = customerBal;
      totalDue = customerBal;
    }

    const collectedNum = parseFloat(amount) || 0;
    const currentOutstanding = Math.max(0, totalDue - collectedNum);

    return {
      previousOutstanding,
      todayAmount,
      totalDue,
      currentOutstanding,
    };
  };

  const { previousOutstanding, todayAmount, totalDue, currentOutstanding } = calculateBreakdown();

  const handleQuickAmount = (val: string) => {
    setAmount(val);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmt = parseFloat(amount || '0');
    if (!selectedCustomerId || isNaN(parsedAmt) || parsedAmt < 0) {
      setError('Please select a customer and specify a valid amount (₹0 or greater).');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      let paymentNum = 'CREDIT-VISIT';
      if (parsedAmt > 0) {
        const recorded = await paymentService.recordPayment({
          customer_id: selectedCustomerId,
          amount: parsedAmt.toFixed(2),
          payment_method: paymentMethod,
          order_id: activeOrder ? activeOrder.id : null,
          reference_number: referenceNumber.trim() || undefined,
          notes: notes.trim() || (activeOrder ? "Delivery collection" : 'Customer balance collection'),
        });
        paymentNum = recorded.payment_number;
      }

      setSuccessData({
        customerName: selectedCustomer?.name || 'Customer Shop',
        customerPhone: selectedCustomer?.phone,
        paymentNumber: paymentNum,
        amount,
        paymentMethod,
        remainingBalance: currentOutstanding.toFixed(2),
        date: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
      });
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
      else setError('Failed to record payment');
    } finally {
      setSubmitting(false);
    }
  };

  // Payment Confirmation & WhatsApp Screen
  if (successData) {
    return (
      <div style={{ maxWidth: '480px', margin: '0 auto', padding: '0.5rem' }}>
        <div
          style={{
            background: 'var(--surface)',
            padding: '1.75rem 1.25rem',
            borderRadius: '16px',
            textAlign: 'center',
            boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
            border: '1px solid var(--border)',
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: '#ecfdf5',
              color: '#059669',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '0.85rem',
            }}
          >
            <Check size={36} strokeWidth={3} />
          </div>

          <h3 style={{ fontSize: '1.35rem', fontWeight: 900, color: 'var(--text-primary)', marginBottom: '0.2rem' }}>
            Payment Recorded!
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginBottom: '1.25rem' }}>
            Receipt #{successData.paymentNumber}
          </p>

          {/* Prominent Shop Name Banner */}
          <div
            style={{
              background: '#f8fafc',
              padding: '0.85rem 1rem',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              marginBottom: '1.25rem',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Customer Shop
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--text-primary)', marginTop: '2px' }}>
              {successData.customerName}
            </div>
          </div>

          {/* Breakdown Card */}
          <div
            style={{
              background: '#f8fafc',
              padding: '1rem',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              marginBottom: '1.25rem',
              textAlign: 'left',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.55rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Amount Collected</span>
              <strong style={{ fontSize: '1.35rem', color: '#059669', fontWeight: 900 }}>
                {formatCurrency(successData.amount)}
              </strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Payment Mode</span>
              <span style={{ fontWeight: 700 }}>{successData.paymentMethod === 'GPAY_UPI' ? 'GPay / UPI' : 'Cash'}</span>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '0.9rem',
                paddingTop: '0.55rem',
                borderTop: '1px dashed #cbd5e1',
                marginTop: '0.2rem',
              }}
            >
              <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Current Outstanding:</span>
              <strong style={{ fontWeight: 900, color: parseFloat(successData.remainingBalance) > 0 ? '#dc2626' : '#059669', fontSize: '1.1rem' }}>
                {formatCurrency(successData.remainingBalance)}
              </strong>
            </div>
          </div>

          {/* WhatsApp Sharing Button */}
          {isWhatsAppEnabled && (
            <button
              type="button"
              className="btn btn-full btn-lg"
              style={{
                background: '#16a34a',
                color: '#ffffff',
                borderColor: '#15803d',
                marginBottom: '0.75rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                minHeight: '48px',
                fontSize: '0.95rem',
                fontWeight: 800,
                borderRadius: '10px',
              }}
              onClick={() => {
                const msg = generatePaymentReceiptMessage({
                  customerName: successData.customerName,
                  paymentNumber: successData.paymentNumber,
                  amount: successData.amount,
                  paymentMethod: successData.paymentMethod,
                  remainingBalance: successData.remainingBalance,
                  date: successData.date,
                });
                openWhatsApp(successData.customerPhone, msg);
              }}
            >
              <Share2 size={19} />
              <span>Share Receipt on WhatsApp</span>
            </button>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ minHeight: '44px', fontWeight: 700 }}
              onClick={() => {
                setSuccessData(null);
                setAmount('');
                setReferenceNumber('');
                setNotes('');
              }}
            >
              Collect Another
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              style={{ minHeight: '44px', fontWeight: 700 }}
              onClick={() => navigate('/driver')}
            >
              Back to Deliveries
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '520px', margin: '0 auto', paddingBottom: '2rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
        <button
          type="button"
          onClick={() => navigate('/driver')}
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '10px',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            padding: '0.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ArrowLeft size={19} />
        </button>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>
            Collect Payment
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', margin: 0 }}>
            Fast daily payment collection & balance update
          </p>
        </div>
      </div>

      {error && (
        <div
          style={{
            background: '#fef2f2',
            color: '#dc2626',
            padding: '0.75rem 1rem',
            borderRadius: '10px',
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.85rem',
          }}
        >
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
          <div className="spinner" />
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {/* Shop Selection Card */}
          <div
            style={{
              background: 'var(--surface)',
              padding: '1rem',
              borderRadius: '14px',
              border: '1px solid var(--border)',
            }}
          >
            <label className="form-label" style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              SELECT SHOP *
            </label>
            <select
              className="form-select"
              style={{
                minHeight: '46px',
                fontSize: '0.95rem',
                fontWeight: 700,
                borderRadius: '8px',
                marginBottom: selectedCustomer ? '0.75rem' : 0,
              }}
              value={selectedCustomerId}
              onChange={(e) => {
                setSelectedCustomerId(e.target.value);
                setAmount('');
              }}
              required
            >
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.owner_name ? `(${c.owner_name})` : ''} — Due: {formatCurrency(c.current_balance)}
                </option>
              ))}
            </select>

            {/* Prominent Shop Name Banner */}
            {selectedCustomer && (
              <div
                style={{
                  background: '#fef2f2',
                  padding: '0.85rem 1rem',
                  borderRadius: '6px',
                  border: '1px solid #fecdd3',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#991b1b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Shop Name
                  </div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#991b1b', lineHeight: 1.2 }}>
                    {selectedCustomer.name}
                  </div>
                  {selectedCustomer.owner_name && (
                    <div style={{ fontSize: '0.75rem', color: '#b91c1c', marginTop: '2px' }}>
                      Proprietor: {selectedCustomer.owner_name}
                    </div>
                  )}
                </div>
                {selectedCustomer.phone && (
                  <a
                    href={`tel:${selectedCustomer.phone}`}
                    style={{
                      background: '#ffffff',
                      color: '#059669',
                      border: '1px solid #a7f3d0',
                      width: '38px',
                      height: '38px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      textDecoration: 'none',
                    }}
                  >
                    <Phone size={18} />
                  </a>
                )}
              </div>
            )}
          </div>

          {/* 4-Line Financial Summary Box (Requested items #5, #6, #7) */}
          <div
            style={{
              background: '#f8fafc',
              border: '2px solid #e2e8f0',
              borderRadius: '14px',
              padding: '0.85rem 1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.55rem',
            }}
          >
            <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Financial Breakdown
            </div>

            {/* Line 1: Previous Outstanding */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.88rem', color: '#475569', fontWeight: 600 }}>Previous Outstanding</span>
              <strong style={{ fontSize: '1rem', color: '#b45309', fontWeight: 800 }}>
                {formatCurrency(previousOutstanding)}
              </strong>
            </div>

            {/* Line 2: Today's Amount */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.88rem', color: '#475569', fontWeight: 600 }}>Today's Amount</span>
              <strong style={{ fontSize: '1rem', color: 'var(--primary-dark)', fontWeight: 800 }}>
                {formatCurrency(todayAmount)}
              </strong>
            </div>

            {/* Total Due Sub-indicator */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingTop: '0.35rem',
                borderTop: '1px dashed #cbd5e1',
                fontSize: '0.82rem',
                color: 'var(--text-muted)',
              }}
            >
              <span>Total Billable</span>
              <span style={{ fontWeight: 700, color: '#334155' }}>{formatCurrency(totalDue)}</span>
            </div>

            {/* Line 3: Amount Collected */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.45rem 0.65rem',
                background: '#ecfdf5',
                borderRadius: '8px',
                border: '1px solid #a7f3d0',
              }}
            >
              <span style={{ fontSize: '0.88rem', color: '#065f46', fontWeight: 700 }}>Amount Collected</span>
              <strong style={{ fontSize: '1.15rem', color: '#047857', fontWeight: 900 }}>
                {formatCurrency(parseFloat(amount) || 0)}
              </strong>
            </div>

            {/* Line 4: Current Outstanding (Dynamically Updated) */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.6rem 0.75rem',
                background: currentOutstanding === 0 ? '#f0fdf4' : '#fff7ed',
                borderRadius: '10px',
                border: currentOutstanding === 0 ? '1.5px solid #86efac' : '1.5px solid #fed7aa',
              }}
            >
              <div>
                <span
                  style={{
                    fontSize: '0.82rem',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    color: currentOutstanding === 0 ? '#15803d' : '#c2410c',
                  }}
                >
                  Current Outstanding
                </span>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  {currentOutstanding === 0 ? 'Fully Cleared! ✓' : 'Remaining customer balance'}
                </div>
              </div>
              <strong
                style={{
                  fontSize: '1.35rem',
                  fontWeight: 900,
                  color: currentOutstanding === 0 ? '#15803d' : '#c2410c',
                }}
              >
                {formatCurrency(currentOutstanding)}
              </strong>
            </div>
          </div>

          {/* Amount Input & Payment Method */}
          <div
            style={{
              background: 'var(--surface)',
              padding: '1rem',
              borderRadius: '14px',
              border: '1px solid var(--border)',
            }}
          >
            {/* Payment Method Toggle */}
            <label className="form-label" style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              PAYMENT METHOD *
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '1rem' }}>
              <button
                type="button"
                className={`btn ${paymentMethod === 'CASH' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setPaymentMethod('CASH')}
                style={{ minHeight: '44px', fontSize: '0.9rem', fontWeight: 700, borderRadius: '8px', gap: '0.4rem' }}
              >
                <Banknote size={19} />
                <span>Cash</span>
              </button>

              <button
                type="button"
                className={`btn ${paymentMethod === 'GPAY_UPI' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setPaymentMethod('GPAY_UPI')}
                style={{ minHeight: '44px', fontSize: '0.9rem', fontWeight: 700, borderRadius: '8px', gap: '0.4rem' }}
              >
                <QrCode size={19} />
                <span>GPay / UPI</span>
              </button>
            </div>

            {/* Collected Amount Field */}
            <div className="form-group" style={{ marginBottom: '0.65rem' }}>
              <label className="form-label" style={{ fontWeight: 700, fontSize: '0.85rem' }}>
                Enter Collected Amount (₹) *
              </label>
              <div style={{ position: 'relative' }}>
                <span
                  style={{
                    position: 'absolute',
                    left: '1rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    fontSize: '1.4rem',
                    fontWeight: 900,
                    color: '#059669',
                  }}
                >
                  ₹
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="form-input"
                  style={{
                    fontSize: '1.6rem',
                    fontWeight: 900,
                    textAlign: 'left',
                    paddingLeft: '2.5rem',
                    height: '56px',
                    color: '#059669',
                    borderRadius: '10px',
                    border: '2px solid #a7f3d0',
                  }}
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Quick Amount Shortcuts */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.4rem', marginBottom: '0.5rem' }}>
              {totalDue > 0 && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{
                    fontSize: '0.72rem',
                    padding: '0.45rem 0.2rem',
                    minHeight: '38px',
                    fontWeight: 800,
                    color: '#047857',
                    borderRadius: '8px',
                  }}
                  onClick={() => handleQuickAmount(totalDue.toFixed(2))}
                >
                  Full Due
                </button>
              )}
              {todayAmount > 0 && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{
                    fontSize: '0.72rem',
                    padding: '0.45rem 0.2rem',
                    minHeight: '38px',
                    fontWeight: 800,
                    color: 'var(--primary-dark)',
                    borderRadius: '8px',
                  }}
                  onClick={() => handleQuickAmount(todayAmount.toFixed(2))}
                >
                  Today's Bill
                </button>
              )}
              <button
                type="button"
                className="btn btn-secondary"
                style={{ fontSize: '0.78rem', padding: '0.45rem 0.2rem', minHeight: '38px', fontWeight: 700, borderRadius: '8px' }}
                onClick={() => handleQuickAmount('500')}
              >
                ₹500
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ fontSize: '0.78rem', padding: '0.45rem 0.2rem', minHeight: '38px', fontWeight: 700, borderRadius: '8px' }}
                onClick={() => handleQuickAmount('1000')}
              >
                ₹1,000
              </button>
            </div>

            {paymentMethod === 'GPAY_UPI' && (
              <div className="form-group" style={{ marginTop: '0.75rem', marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                  UPI Reference / UTR Number
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. UPI-9988776655"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  style={{ borderRadius: '8px' }}
                />
              </div>
            )}
          </div>

          {/* Optional Notes */}
          <div className="form-group" style={{ marginBottom: '0.5rem' }}>
            <label className="form-label" style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Notes (Optional)
            </label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Paid in cash to driver"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{ borderRadius: '8px' }}
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="btn btn-primary btn-full btn-lg"
            style={{
              minHeight: '52px',
              fontSize: '1.05rem',
              fontWeight: 900,
              borderRadius: '12px',
              background: '#059669',
              borderColor: '#047857',
              boxShadow: '0 4px 14px rgba(5, 150, 105, 0.35)',
            }}
            disabled={submitting || !amount || parseFloat(amount) <= 0}
          >
            {submitting ? 'Recording Payment...' : `Confirm Payment of ${formatCurrency(amount || 0)}`}
          </button>
        </form>
      )}
    </div>
  );
};
