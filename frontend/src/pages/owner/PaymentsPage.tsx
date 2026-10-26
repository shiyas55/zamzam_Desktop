import React, { useEffect, useState } from 'react';
import { paymentService } from '../../services/paymentService';
import { staffService } from '../../services/staffService';
import { Payment, StaffMember } from '../../types';
import { formatCurrency, formatDateTime } from '../../utils/formatters';
import { CreditCard, DollarSign, MessageSquare, RotateCcw, AlertTriangle, X, CheckCircle, Plus } from 'lucide-react';
import { openWhatsApp, generatePaymentReceiptMessage } from '../../utils/whatsappUtils';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { RecordShopPaymentModal } from '../../components/RecordShopPaymentModal';

export const PaymentsPage: React.FC = () => {
  const { user } = useAuth();
  const { isWhatsAppEnabled } = useSettings();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [method, setMethod] = useState('');
  const [paymentType, setPaymentType] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [collectorFilter, setCollectorFilter] = useState('');
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<{ total_collected: string; cash_total: string; upi_total: string } | null>(null);

  // Record Payment Modal State
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);

  // Reversal Modal State
  const [reversalPayment, setReversalPayment] = useState<Payment | null>(null);
  const [reversalReason, setReversalReason] = useState('');
  const [isReversing, setIsReversing] = useState(false);
  const [reversalError, setReversalError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const canReverse = user?.role === 'OWNER' || user?.role === 'MANAGER';

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const [list, sum, stfList] = await Promise.all([
        paymentService.getPayments({
          method: method || undefined,
          payment_type: paymentType || undefined,
          status: statusFilter || undefined,
          driver: collectorFilter || undefined,
        }),
        paymentService.getDailySummary(),
        staffService.getStaff({ is_active: true }),
      ]);
      setPayments(list);
      setSummary(sum);
      setStaffList(stfList);
    } catch (err: unknown) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, [method, paymentType, statusFilter, collectorFilter]);

  const handleOpenReverseModal = (payment: Payment) => {
    setReversalPayment(payment);
    setReversalReason('');
    setReversalError(null);
  };

  const handleConfirmReversal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reversalPayment) return;
    if (!reversalReason.trim() || reversalReason.trim().length < 3) {
      setReversalError('A clear audit reason (at least 3 characters) is required to reverse a payment.');
      return;
    }

    try {
      setIsReversing(true);
      setReversalError(null);
      await paymentService.reversePayment(reversalPayment.id, reversalReason.trim());
      setSuccessMessage(`Payment #${reversalPayment.payment_number} has been reversed and customer receivable balance restored.`);
      setReversalPayment(null);
      fetchPayments();
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: any) {
      setReversalError(err.response?.data?.error || err.message || 'Failed to reverse payment');
    } finally {
      setIsReversing(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Payment Collections & Receipts
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', margin: '4px 0 0 0' }}>
            Audit trail of all Cash and UPI payments collected from customer shops with financial reversal safeguards.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setIsRecordModalOpen(true)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.45rem',
            fontWeight: 700,
            fontSize: '0.92rem',
            padding: '0.55rem 1.25rem',
            backgroundColor: '#059669',
            borderColor: '#059669',
            borderRadius: '8px',
            boxShadow: '0 2px 4px rgba(5, 150, 105, 0.25)',
          }}
          title="Create customer shop payment collection"
        >
          <Plus size={18} /> Create Collection
        </button>
      </div>

      {successMessage && (
        <div style={{ background: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0', padding: '0.9rem 1.25rem', borderRadius: 'var(--radius-md)', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <CheckCircle size={18} color="#059669" />
          <span style={{ fontWeight: 600 }}>{successMessage}</span>
        </div>
      )}

      {/* Summary Cards */}
      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>
          <div style={{ background: 'white', padding: '1rem 1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Today's Total Collected</span>
            <p style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>{formatCurrency(summary.total_collected)}</p>
          </div>
          <div style={{ background: 'white', padding: '1rem 1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Cash Collected</span>
            <p style={{ fontSize: '1.4rem', fontWeight: 700, color: '#059669' }}>{formatCurrency(summary.cash_total)}</p>
          </div>
          <div style={{ background: 'white', padding: '1rem 1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>GPay / UPI Collected</span>
            <p style={{ fontSize: '1.4rem', fontWeight: 800, color: '#991b1b' }}>{formatCurrency(summary.upi_total)}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <select
          className="form-select"
          style={{ width: '190px' }}
          value={method}
          onChange={(e) => setMethod(e.target.value)}
        >
          <option value="">All Payment Methods</option>
          <option value="CASH">Cash Only</option>
          <option value="GPAY_UPI">GPay / UPI Only</option>
        </select>

        <select
          className="form-select"
          style={{ width: '210px' }}
          value={paymentType}
          onChange={(e) => setPaymentType(e.target.value)}
        >
          <option value="">All Allocations</option>
          <option value="ORDER_PAYMENT">Order Payment Only</option>
          <option value="PREVIOUS_CREDIT">Previous Credit Only</option>
        </select>

        <select
          className="form-select"
          style={{ width: '180px' }}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All Statuses</option>
          <option value="COMPLETED">Completed</option>
          <option value="REVERSED">Reversed</option>
        </select>

        {/* Collector / Driver Filter */}
        <select
          className="form-select"
          style={{ minWidth: '220px' }}
          value={collectorFilter}
          onChange={(e) => setCollectorFilter(e.target.value)}
        >
          <option value="">All Drivers & Collectors</option>
          <optgroup label="Staff Drivers">
            {staffList
              .filter((s) => s.role_type === 'STAFF')
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name} (Driver)
                </option>
              ))}
          </optgroup>
          <optgroup label="Share Members (Owners)">
            {staffList
              .filter((s) => s.role_type === 'MEMBER')
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name} (Share Member)
                </option>
              ))}
          </optgroup>
        </select>
      </div>

      {/* Table */}
      <div className="table-container" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center' }}>
            <div className="spinner" style={{ margin: '0 auto' }} />
          </div>
        ) : (
          <table className="data-table" style={{ width: '100%', minWidth: '1150px' }}>
            <thead>
              <tr>
                <th style={{ whiteSpace: 'nowrap' }}>Receipt #</th>
                <th style={{ whiteSpace: 'nowrap' }}>Customer Shop</th>
                <th style={{ whiteSpace: 'nowrap' }}>Route</th>
                <th style={{ whiteSpace: 'nowrap' }}>Allocation</th>
                <th style={{ whiteSpace: 'nowrap' }}>Amount</th>
                <th style={{ whiteSpace: 'nowrap' }}>Method</th>
                <th style={{ whiteSpace: 'nowrap' }}>Status</th>
                <th style={{ whiteSpace: 'nowrap' }}>UPI Reference</th>
                <th style={{ whiteSpace: 'nowrap' }}>Collected By</th>
                <th style={{ whiteSpace: 'nowrap' }}>Timestamp</th>
                <th style={{ textAlign: 'right', whiteSpace: 'nowrap', minWidth: '150px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {payments.length > 0 ? (
                payments.map((p) => {
                  const isReversed = p.status === 'REVERSED';
                  return (
                    <tr key={p.id} style={{ opacity: isReversed ? 0.75 : 1 }}>
                      <td style={{ fontWeight: 600 }}>{p.payment_number}</td>
                      <td style={{ fontWeight: 600 }}>{p.customer_name || p.customer_details?.name}</td>
                      <td>
                        <span className="badge badge-neutral">{p.route_name || 'Route'}</span>
                      </td>
                      <td>
                        {p.order_number ? (
                          <span className="badge badge-info" style={{ fontSize: '0.75rem' }}>
                            Order: {p.order_number}
                          </span>
                        ) : (
                          <span className="badge badge-neutral" style={{ fontSize: '0.75rem' }}>
                            Previous Credit
                          </span>
                        )}
                      </td>
                      <td style={{ fontWeight: 700, color: isReversed ? '#9ca3af' : '#059669', textDecoration: isReversed ? 'line-through' : 'none' }}>
                        {formatCurrency(p.amount)}
                      </td>
                      <td>
                        {p.payment_method === 'CASH' ? (
                          <span className="badge badge-success">Cash</span>
                        ) : (
                          <span className="badge badge-info">GPay / UPI</span>
                        )}
                      </td>
                      <td>
                        {isReversed ? (
                          <span className="badge badge-danger" title={`Reversed: ${p.reversal_reason}`}>
                            Reversed
                          </span>
                        ) : (
                          <span className="badge badge-success">Completed</span>
                        )}
                      </td>
                      <td style={{ fontSize: '0.85rem' }}>{p.reference_number || '—'}</td>
                      <td>
                        {p.notes && p.notes.toLowerCase().includes('forgot') ? (
                          <div>
                            <span
                              style={{
                                fontSize: '0.68rem',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                backgroundColor: '#fef3c7',
                                color: '#92400e',
                                fontWeight: 800,
                                border: '1px solid #fde68a',
                                display: 'inline-block',
                              }}
                            >
                              Driver Forgot • Owner Collected
                            </span>
                            <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                              {p.staff_member_name ? `For Driver: ${p.staff_member_name}` : p.collected_by_name || 'Owner'}
                            </div>
                          </div>
                        ) : p.staff_member_name ? (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                            <span style={{ fontWeight: 700 }}>{p.staff_member_name}</span>
                            <span
                              style={{
                                fontSize: '0.66rem',
                                padding: '1px 5px',
                                borderRadius: '4px',
                                backgroundColor: p.staff_member_role === 'MEMBER' ? '#fef3c7' : '#dbeafe',
                                color: p.staff_member_role === 'MEMBER' ? '#92400e' : '#1d4ed8',
                                fontWeight: 700,
                              }}
                            >
                              {p.staff_member_role === 'MEMBER' ? 'Share Member' : 'Staff Driver'}
                            </span>
                          </div>
                        ) : (
                          p.collected_by_name || 'Staff'
                        )}
                      </td>
                      <td>{formatDateTime(p.received_at)}</td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', gap: '0.4rem', alignItems: 'center' }}>
                          {!isReversed && isWhatsAppEnabled && (
                            <button
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.78rem', color: '#059669', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                              onClick={() => {
                                const custName = p.customer_name || p.customer_details?.name || 'Valued Customer';
                                const msg = generatePaymentReceiptMessage({
                                  customerName: custName,
                                  paymentNumber: p.payment_number,
                                  amount: p.amount,
                                  paymentMethod: p.payment_method,
                                  date: new Date(p.received_at).toLocaleDateString(),
                                  remainingBalance: p.customer_details?.current_balance,
                                });
                                openWhatsApp(p.customer_details?.phone, msg);
                              }}
                              title="Share Payment Confirmation on WhatsApp"
                            >
                              <MessageSquare size={13} />
                              <span>Share</span>
                            </button>
                          )}

                          {canReverse && !isReversed && (
                            <button
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.78rem', color: '#dc2626', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                              onClick={() => handleOpenReverseModal(p)}
                              title="Reverse / Void Payment"
                            >
                              <RotateCcw size={13} />
                              <span>Reverse</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={11} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    No payments found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Reverse Payment Modal */}
      {reversalPayment && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#dc2626' }}>
                <RotateCcw size={22} />
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>Reverse Payment</h3>
              </div>
              <button onClick={() => setReversalPayment(null)}>
                <X size={20} />
              </button>
            </div>

            <div style={{ background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: 'var(--radius-md)', padding: '0.9rem', marginBottom: '1.25rem' }}>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#991b1b', lineHeight: 1.5 }}>
                <strong>Important Audit Notice:</strong> Financial records cannot be deleted. Reversing this payment will restore <strong>{formatCurrency(reversalPayment.amount)}</strong> to <strong>{reversalPayment.customer_name}</strong>'s receivable credit debt and post a reversing audit entry to the credit ledger.
              </p>
            </div>

            {reversalError && (
              <div style={{ background: 'var(--danger-bg)', color: 'var(--danger)', padding: '0.75rem', borderRadius: 'var(--radius-md)', marginBottom: '1rem', fontSize: '0.85rem' }}>
                {reversalError}
              </div>
            )}

            <form onSubmit={handleConfirmReversal}>
              <div style={{ marginBottom: '1rem', fontSize: '0.88rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Receipt Number:</span>
                  <strong>{reversalPayment.payment_number}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Amount:</span>
                  <strong style={{ color: '#059669' }}>{formatCurrency(reversalPayment.amount)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Method:</span>
                  <span>{reversalPayment.payment_method}</span>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Mandatory Audit Explanation Reason *</label>
                <textarea
                  className="form-textarea"
                  rows={3}
                  placeholder="e.g. Duplicate entry made by mistake; Wrong amount entered; Customer bounced payment."
                  value={reversalReason}
                  onChange={(e) => setReversalReason(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setReversalPayment(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-danger" style={{ flex: 1 }} disabled={isReversing}>
                  {isReversing ? 'Reversing...' : 'Confirm Reversal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Shop Payment Modal */}
      <RecordShopPaymentModal
        isOpen={isRecordModalOpen}
        onClose={() => setIsRecordModalOpen(false)}
        onSuccess={(msg) => {
          if (msg) setSuccessMessage(msg);
          fetchPayments();
        }}
      />
    </div>
  );
};
