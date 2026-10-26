import React, { useEffect, useState } from 'react';
import { creditService } from '../../services/creditService';
import { customerService } from '../../services/customerService';
import { CreditTransaction, Customer } from '../../types';
import { formatCurrency, formatDateTime } from '../../utils/formatters';
import { BookOpen, Plus, X, FileText } from 'lucide-react';
import { CustomerStatementModal } from '../../components/CustomerStatementModal';

export const CreditLedgerPage: React.FC = () => {
  const [entries, setEntries] = useState<CreditTransaction[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [loading, setLoading] = useState(true);
  const [statementCustomer, setStatementCustomer] = useState<Customer | null>(null);

  // Adjustment Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [adjCustomer, setAdjCustomer] = useState('');
  const [adjAmount, setAdjAmount] = useState('');
  const [adjNotes, setAdjNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLedger = async () => {
    try {
      setLoading(true);
      const [list, custList] = await Promise.all([
        creditService.getLedgerEntries({
          customer: selectedCustomer || undefined,
          type: selectedType || undefined,
        }),
        customerService.getCustomers(),
      ]);
      setEntries(list);
      setCustomers(custList);
      if (custList.length > 0 && !adjCustomer) {
        setAdjCustomer(custList[0].id);
      }
    } catch (err: unknown) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLedger();
  }, [selectedCustomer, selectedType]);

  const handleCreateAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjCustomer || !adjAmount || !adjNotes) {
      setError('Please provide customer, amount (+/-), and explanation notes.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await creditService.recordAdjustment({
        customer_id: adjCustomer,
        amount: adjAmount,
        notes: adjNotes,
      });
      setIsModalOpen(false);
      setAdjAmount('');
      setAdjNotes('');
      fetchLedger();
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
      else setError('Failed to record adjustment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getTypeBadge = (type: string, allocation?: string) => {
    switch (type) {
      case 'OPENING_BALANCE':
        return <span className="badge badge-neutral">Opening Balance</span>;
      case 'CREDIT_SALE':
        return <span className="badge badge-warning">Order Credit</span>;
      case 'ORDER_PAYMENT':
        return <span className="badge badge-success">Order Payment</span>;
      case 'PREVIOUS_CREDIT_PAYMENT':
        return <span className="badge badge-success" style={{ background: '#ecfdf5', color: '#047857' }}>Prev Credit Payment</span>;
      case 'CASH_PAYMENT':
        return (
          <span className="badge badge-success">
            Cash {allocation === 'ORDER_PAYMENT' ? '(Order)' : '(Credit)'}
          </span>
        );
      case 'GPAY_PAYMENT':
        return (
          <span className="badge badge-info">
            UPI {allocation === 'ORDER_PAYMENT' ? '(Order)' : '(Credit)'}
          </span>
        );
      case 'PAYMENT_REVERSAL':
        return <span className="badge badge-danger">Payment Reversal</span>;
      case 'ADJUSTMENT':
        return <span className="badge badge-neutral" style={{ background: '#f3e8ff', color: '#6b21a8' }}>Adjustment</span>;
      default:
        return <span className="badge badge-neutral">{type}</span>;
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.75rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Customer Credit Ledger
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
            Auditable double-entry trail of receivables, sales deliveries, payments, and authorized adjustments.
          </p>
        </div>
        <button className="btn btn-secondary" onClick={() => setIsModalOpen(true)}>
          <Plus size={18} />
          <span>Record Adjustment</span>
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <select
          className="form-select"
          style={{ width: '240px' }}
          value={selectedCustomer}
          onChange={(e) => setSelectedCustomer(e.target.value)}
        >
          <option value="">All Customer Shops</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.route_details?.name})
            </option>
          ))}
        </select>

        <select
          className="form-select"
          style={{ width: '220px' }}
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
        >
          <option value="">All Transaction Types</option>
          <option value="OPENING_BALANCE">Opening Balance</option>
          <option value="CREDIT_SALE">Order Credit (Delivered)</option>
          <option value="CASH_PAYMENT">Cash Payment</option>
          <option value="GPAY_PAYMENT">UPI Payment</option>
          <option value="PAYMENT_REVERSAL">Payment Reversal</option>
          <option value="ADJUSTMENT">Adjustment</option>
        </select>

        {selectedCustomer && (
          <button
            type="button"
            className="btn btn-secondary"
            style={{ color: '#b91c1c', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
            onClick={() => {
              const cust = customers.find((c) => c.id === selectedCustomer);
              if (cust) setStatementCustomer(cust);
            }}
          >
            <FileText size={15} />
            <span>Print Customer Statement</span>
          </button>
        )}
      </div>

      {/* Table */}
      <div className="table-container">
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center' }}>
            <div className="spinner" style={{ margin: '0 auto' }} />
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Customer Shop</th>
                <th>Route</th>
                <th>Type</th>
                <th>Allocation</th>
                <th>Balance Before</th>
                <th>Amount Delta</th>
                <th>Balance After</th>
                <th>Reference</th>
                <th>Notes</th>
                <th>Recorded By</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {entries.length > 0 ? (
                entries.map((tx) => {
                  const isPositive = parseFloat(tx.amount) > 0;
                  return (
                    <tr key={tx.id}>
                      <td style={{ fontWeight: 600 }}>{tx.customer_name}</td>
                      <td>
                        <span className="badge badge-neutral">{tx.route_name}</span>
                      </td>
                      <td>{getTypeBadge(tx.transaction_type, tx.allocation)}</td>
                      <td>
                        {tx.allocation === 'ORDER' && <span className="badge badge-warning" style={{ fontSize: '0.72rem' }}>Order</span>}
                        {tx.allocation === 'ORDER_PAYMENT' && <span className="badge badge-info" style={{ fontSize: '0.72rem' }}>Order Payment</span>}
                        {tx.allocation === 'PREVIOUS_CREDIT' && <span className="badge badge-neutral" style={{ fontSize: '0.72rem' }}>Prev Credit</span>}
                        {tx.allocation === 'REVERSAL' && <span className="badge badge-danger" style={{ fontSize: '0.72rem' }}>Reversal</span>}
                        {tx.allocation === 'ADJUSTMENT' && <span className="badge badge-neutral" style={{ fontSize: '0.72rem' }}>Adjustment</span>}
                        {tx.allocation === 'OPENING_BALANCE' && <span className="badge badge-neutral" style={{ fontSize: '0.72rem' }}>Opening</span>}
                        {!tx.allocation && '—'}
                      </td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                        {tx.balance_before ? formatCurrency(tx.balance_before) : '—'}
                      </td>
                      <td
                        style={{
                          fontWeight: 700,
                          color: isPositive ? '#dc2626' : '#059669',
                        }}
                      >
                        {isPositive ? `+${formatCurrency(tx.amount)}` : `-${formatCurrency(Math.abs(parseFloat(tx.amount)))}`}
                      </td>
                      <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                        {formatCurrency(tx.balance_after)}
                      </td>
                      <td>
                        {tx.order_number && <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Ord: {tx.order_number}</span>}
                        {tx.payment_number && <span style={{ fontSize: '0.8rem', color: '#059669' }}>Pay: {tx.payment_number}</span>}
                        {!tx.order_number && !tx.payment_number && '—'}
                      </td>
                      <td style={{ fontSize: '0.82rem', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={tx.notes}>
                        {tx.notes || '—'}
                      </td>
                      <td>{tx.recorded_by_name || 'System'}</td>
                      <td>{formatDateTime(tx.created_at)}</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={11} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    No ledger transactions found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Adjustment Modal */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Record Credit Adjustment</h3>
              <button onClick={() => setIsModalOpen(false)}>
                <X size={20} />
              </button>
            </div>

            {error && (
              <div style={{ background: 'var(--danger-bg)', color: 'var(--danger)', padding: '0.75rem', borderRadius: 'var(--radius-md)', marginBottom: '1rem', fontSize: '0.85rem' }}>
                {error}
              </div>
            )}

            <form onSubmit={handleCreateAdjustment}>
              <div className="form-group">
                <label className="form-label">Customer Shop *</label>
                <select
                  className="form-select"
                  value={adjCustomer}
                  onChange={(e) => setAdjCustomer(e.target.value)}
                  required
                >
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} (Current Bal: {formatCurrency(c.current_balance)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Adjustment Amount (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-input"
                  placeholder="e.g. 500.00 or -200.00"
                  value={adjAmount}
                  onChange={(e) => setAdjAmount(e.target.value)}
                  required
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Enter positive number to increase debt, negative to discount/write off.
                </span>
              </div>

              <div className="form-group">
                <label className="form-label">Audit Reason / Authorization Notes *</label>
                <textarea
                  className="form-textarea"
                  rows={3}
                  placeholder="Reason for balance correction, manager approval notes"
                  value={adjNotes}
                  onChange={(e) => setAdjNotes(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setIsModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={isSubmitting}>
                  {isSubmitting ? 'Recording...' : 'Commit Adjustment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Customer Statement Modal */}
      {statementCustomer && (
        <CustomerStatementModal
          customer={statementCustomer}
          onClose={() => setStatementCustomer(null)}
        />
      )}
    </div>
  );
};
