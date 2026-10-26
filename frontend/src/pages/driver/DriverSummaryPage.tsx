import React, { useEffect, useState } from 'react';
import { paymentService } from '../../services/paymentService';
import { expenseService } from '../../services/expenseService';
import { reportService } from '../../services/reportService';
import { deliveryService } from '../../services/deliveryService';
import { Payment, DriverExpenseSummary, DashboardSummary, Delivery, DriverExpense } from '../../types';
import { formatCurrency, formatDateTime, formatDate } from '../../utils/formatters';
import {
  Receipt,
  Banknote,
  QrCode,
  Wallet,
  ArrowDownRight,
  ArrowUpRight,
  History,
  CheckCircle2,
  XCircle,
  Truck,
  ChevronLeft,
  ChevronRight,
  FileText,
  Fuel,
  Utensils,
  ParkingCircle,
  Landmark,
  Wrench,
  Coins,
  CreditCard,
  Building2,
} from 'lucide-react';

const ITEMS_PER_PAGE = 8;

export const DriverSummaryPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'SUMMARY' | 'HISTORY'>('SUMMARY');
  const [historyCategory, setHistoryCategory] = useState<'DELIVERED' | 'NOT_DELIVERED' | 'COLLECTIONS' | 'EXPENSES'>('DELIVERED');
  const [historyPage, setHistoryPage] = useState(1);

  const [payments, setPayments] = useState<Payment[]>([]);
  const [paymentSummary, setPaymentSummary] = useState<{ total_collected: string; cash_total: string; upi_total: string } | null>(null);
  const [expenseSummary, setExpenseSummary] = useState<DriverExpenseSummary | null>(null);
  const [expenses, setExpenses] = useState<DriverExpense[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [dashboardSummary, setDashboardSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [payList, paySum, expSum, expList, delList, dashSum] = await Promise.all([
          paymentService.getPayments(),
          paymentService.getDailySummary(),
          expenseService.getExpenseSummary(),
          expenseService.getExpenses(),
          deliveryService.getDeliveries(),
          reportService.getDashboardSummary(),
        ]);
        setPayments(payList);
        setPaymentSummary(paySum);
        setExpenseSummary(expSum);
        setExpenses(expList);
        setDeliveries(delList);
        setDashboardSummary(dashSum);
      } catch (err: unknown) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const totalCollectedNum = parseFloat(paymentSummary?.total_collected || '0');
  const todayCashNum = parseFloat(paymentSummary?.cash_total || '0');
  const todayUpiNum = parseFloat(paymentSummary?.upi_total || '0');
  const todayExpenseNum = parseFloat(expenseSummary?.today_total || '0');

  // Net Cash Balance: Actual physical cash collected minus route expenses (can be negative if expenses exceed cash)
  const cashBalance = todayCashNum - todayExpenseNum;
  // Net Total Business Balance: Total revenue collected (Cash + GPay) minus route expenses
  const netTotalBalance = totalCollectedNum - todayExpenseNum;

  // History filtering & pagination
  const completedDeliveries = deliveries.filter((d) => d.status === 'DELIVERED');
  const notDeliveredList = deliveries.filter((d) => d.status === 'NOT_DELIVERED');

  const getActiveHistoryList = () => {
    switch (historyCategory) {
      case 'DELIVERED':
        return completedDeliveries;
      case 'NOT_DELIVERED':
        return notDeliveredList;
      case 'COLLECTIONS':
        return payments;
      case 'EXPENSES':
        return expenses;
    }
  };

  const currentList = getActiveHistoryList();
  const totalPages = Math.max(1, Math.ceil(currentList.length / ITEMS_PER_PAGE));
  const paginatedItems = currentList.slice((historyPage - 1) * ITEMS_PER_PAGE, historyPage * ITEMS_PER_PAGE);

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'PETROL':
        return <Fuel size={16} />;
      case 'FOOD':
        return <Utensils size={16} />;
      case 'PARKING':
        return <ParkingCircle size={16} />;
      case 'TOLL':
        return <Landmark size={16} />;
      case 'MAINTENANCE':
        return <Wrench size={16} />;
      default:
        return <FileText size={16} />;
    }
  };

  return (
    <div style={{ maxWidth: '560px', margin: '0 auto', paddingBottom: '2rem' }}>
      {/* Header & Main Mode Toggle */}
      <div style={{ marginBottom: '1rem' }}>
        <h2 style={{ fontSize: '1.35rem', fontWeight: 900, color: 'var(--text-primary)', margin: '0 0 0.25rem' }}>
          {activeTab === 'SUMMARY' ? 'Reconciliation & Settlement' : 'My Activity History'}
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: 0 }}>
          {activeTab === 'SUMMARY'
            ? "Today's cash in hand, GPay / UPI, route expenses, and cash handover."
            : 'Track your completed stops, failed deliveries, payments & expenses.'}
        </p>
      </div>

      {/* Primary Tab Switcher */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '1.25rem' }}>
        <button
          type="button"
          className={`btn ${activeTab === 'SUMMARY' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ minHeight: '44px', fontSize: '0.88rem', fontWeight: 700, gap: '0.4rem', borderRadius: '10px' }}
          onClick={() => setActiveTab('SUMMARY')}
        >
          <Receipt size={18} />
          <span>Reconciliation</span>
        </button>

        <button
          type="button"
          className={`btn ${activeTab === 'HISTORY' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ minHeight: '44px', fontSize: '0.88rem', fontWeight: 700, gap: '0.4rem', borderRadius: '10px' }}
          onClick={() => {
            setActiveTab('HISTORY');
            setHistoryPage(1);
          }}
        >
          <History size={18} />
          <span>Activity History</span>
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
          <div className="spinner" />
        </div>
      ) : activeTab === 'SUMMARY' ? (
        /* ========================================================================= */
        /* TAB 1: DAILY RECONCILIATION SUMMARY */
        /* ========================================================================= */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Prominent TODAY CASH & TODAY GPAY Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            {/* 1. TODAY'S CASH CARD */}
            <div
              style={{
                background: '#ecfdf5',
                padding: '1rem',
                borderRadius: '6px',
                border: '1px solid #a7f3d0',
                boxShadow: 'var(--shadow-sm)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#065f46', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    TODAY CASH
                  </span>
                  <div
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: '4px',
                      background: '#059669',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Banknote size={15} />
                  </div>
                </div>

                <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#065f46', lineHeight: 1.1, margin: '0.2rem 0' }}>
                  {formatCurrency(paymentSummary?.cash_total || '0')}
                </div>
              </div>

              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#047857', marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <Coins size={13} />
                <span>Physical cash collected</span>
              </div>
            </div>

            {/* 2. TODAY'S GPAY / UPI CARD */}
            <div
              style={{
                background: '#fef2f2',
                padding: '1rem',
                borderRadius: '6px',
                border: '1px solid #fecaca',
                boxShadow: 'var(--shadow-sm)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--primary-dark)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    TODAY GPAY
                  </span>
                  <div
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: '4px',
                      background: 'var(--primary)',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <QrCode size={15} />
                  </div>
                </div>

                <div style={{ fontSize: '1.45rem', fontWeight: 900, color: 'var(--primary-dark)', lineHeight: 1.1, margin: '0.2rem 0' }}>
                  {formatCurrency(paymentSummary?.upi_total || '0')}
                </div>
              </div>

              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--primary-dark)', marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <CreditCard size={13} />
                <span>Direct to bank account</span>
              </div>
            </div>
          </div>

          {/* Cash Handover & Settlement Card */}
          <div
            style={{
              background: cashBalance < 0 ? '#450a0a' : '#0f172a',
              color: 'white',
              borderRadius: '6px',
              padding: '1.25rem',
              boxShadow: 'var(--shadow-sm)',
              border: cashBalance < 0 ? '1px solid #dc2626' : '1px solid #334155',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span
                  style={{
                    fontSize: '0.72rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: cashBalance < 0 ? '#fca5a5' : '#fbbf24',
                    fontWeight: 800,
                  }}
                >
                  {cashBalance < 0 ? 'EXPENSES EXCEED CASH (DEFICIT)' : 'NET CASH TO HANDOVER'}
                </span>
                <p
                  style={{
                    fontSize: '2.25rem',
                    fontWeight: 900,
                    color: cashBalance < 0 ? '#f87171' : '#fef08a',
                    margin: '0.2rem 0 0.4rem',
                    lineHeight: 1.1,
                  }}
                >
                  {cashBalance < 0 ? '−' : ''}{formatCurrency(Math.abs(cashBalance))}
                </p>
                <div style={{ fontSize: '0.76rem', color: cashBalance < 0 ? '#fecaca' : '#94a3b8' }}>
                  {cashBalance < 0
                    ? `Driver spent ${formatCurrency(Math.abs(cashBalance))} extra from own money. Company owes driver.`
                    : 'Amount of physical cash to give to owner/manager'}
                </div>
              </div>
              <div
                style={{
                  background: 'rgba(251, 191, 36, 0.15)',
                  border: '1px solid rgba(251, 191, 36, 0.3)',
                  padding: '0.4rem 0.65rem',
                  borderRadius: '10px',
                  textAlign: 'right',
                }}
              >
                <span style={{ fontSize: '0.68rem', color: '#fef08a', fontWeight: 700, display: 'block' }}>TOTAL REVENUE</span>
                <strong style={{ fontSize: '1.05rem', color: '#ffffff' }}>
                  {formatCurrency(paymentSummary?.total_collected || '0')}
                </strong>
                <div style={{ fontSize: '0.68rem', color: '#cbd5e1', marginTop: '2px' }}>
                  Net: {netTotalBalance < 0 ? '−' : ''}{formatCurrency(Math.abs(netTotalBalance))}
                </div>
              </div>
            </div>

            {/* Reconciliation Math Breakdown */}
            <div
              style={{
                marginTop: '1rem',
                paddingTop: '0.85rem',
                borderTop: '1px dashed #334155',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.45rem',
                fontSize: '0.82rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#cbd5e1' }}>
                <span>(+) Today's Cash Collected:</span>
                <strong style={{ color: '#4ade80' }}>+{formatCurrency(paymentSummary?.cash_total || '0')}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#cbd5e1' }}>
                <span>(−) Today's Route Expenses:</span>
                <strong style={{ color: '#f87171' }}>−{formatCurrency(expenseSummary?.today_total || '0')}</strong>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  paddingTop: '0.4rem',
                  borderTop: '1px solid rgba(255,255,255,0.15)',
                  fontWeight: 800,
                  fontSize: '0.88rem',
                }}
              >
                <span style={{ color: '#f1f5f9' }}>(=) Net Cash Balance:</span>
                <strong style={{ color: cashBalance < 0 ? '#f87171' : '#fef08a' }}>
                  {cashBalance < 0 ? '−' : ''}{formatCurrency(Math.abs(cashBalance))}
                  {cashBalance < 0 ? ' (Company Owes Driver)' : ' (Handover)'}
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: '0.75rem', paddingTop: '0.35rem', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                <span>GPay / UPI (Direct to Shop Bank):</span>
                <span style={{ color: '#fca5a5', fontWeight: 600 }}>{formatCurrency(paymentSummary?.upi_total || '0')}</span>
              </div>
            </div>

            {/* Deliveries Recap */}
            {dashboardSummary && (
              <div
                style={{
                  display: 'flex',
                  gap: '0.85rem',
                  marginTop: '0.85rem',
                  paddingTop: '0.75rem',
                  borderTop: '1px solid rgba(255,255,255,0.1)',
                  fontSize: '0.76rem',
                  flexWrap: 'wrap',
                }}
              >
                <span>Delivered: <strong style={{ color: '#4ade80' }}>{dashboardSummary.completed_deliveries || 0}</strong></span>
                {Boolean(dashboardSummary.not_delivered_count) && (
                  <span>Failed: <strong style={{ color: '#f87171' }}>{dashboardSummary.not_delivered_count}</strong></span>
                )}
                <span>Route: <strong style={{ color: '#fca5a5' }}>{dashboardSummary.route_name}</strong></span>
              </div>
            )}
          </div>

          {/* Secondary Metric Cards: Expenses vs Total Collection */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            {/* Expenses Card */}
            <div style={{ background: 'var(--surface)', padding: '0.9rem', borderRadius: '12px', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#dc2626', marginBottom: '0.25rem' }}>
                <ArrowDownRight size={15} />
                <span style={{ fontSize: '0.72rem', fontWeight: 800 }}>ROUTE EXPENSES</span>
              </div>
              <p style={{ fontSize: '1.2rem', fontWeight: 900, color: '#dc2626', margin: '0.1rem 0' }}>
                {formatCurrency(expenseSummary?.today_total || '0.00')}
              </p>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                {expenseSummary?.count || 0} expense item(s) logged
              </div>
            </div>

            {/* Total Collected Card */}
            <div style={{ background: 'var(--surface)', padding: '0.9rem', borderRadius: '12px', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#059669', marginBottom: '0.25rem' }}>
                <ArrowUpRight size={15} />
                <span style={{ fontSize: '0.72rem', fontWeight: 800 }}>TOTAL COLLECTED</span>
              </div>
              <p style={{ fontSize: '1.2rem', fontWeight: 900, color: '#059669', margin: '0.1rem 0' }}>
                {formatCurrency(paymentSummary?.total_collected || '0.00')}
              </p>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                {payments.length} shop receipt(s)
              </div>
            </div>
          </div>

          {/* Receipts Breakdown */}
          <div style={{ background: 'var(--surface)', padding: '1rem', borderRadius: '14px', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                Today's Receipts ({payments.length})
              </h3>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                Cash & UPI logs
              </span>
            </div>

            {payments.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {payments.map((p) => {
                  const isCash = p.payment_method === 'CASH';
                  return (
                    <div
                      key={p.id}
                      style={{
                        padding: '0.75rem 0.85rem',
                        borderRadius: '10px',
                        border: '1px solid var(--border)',
                        background: 'var(--surface)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div>
                        <strong style={{ fontSize: '0.92rem', color: 'var(--text-primary)', display: 'block' }}>
                          {p.customer_name || 'Customer Shop'}
                        </strong>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          Receipt #{p.payment_number} • {formatDateTime(p.received_at)}
                        </span>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <strong style={{ fontSize: '1.05rem', color: isCash ? '#059669' : 'var(--primary)', fontWeight: 900 }}>
                          {formatCurrency(p.amount)}
                        </strong>
                        <div style={{ marginTop: '2px' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.2rem',
                              fontSize: '0.68rem',
                              fontWeight: 800,
                              padding: '0.15rem 0.45rem',
                              borderRadius: '6px',
                              background: isCash ? '#ecfdf5' : '#fef2f2',
                              color: isCash ? '#047857' : 'var(--primary-dark)',
                              border: isCash ? '1px solid #a7f3d0' : '1px solid #fecaca',
                            }}
                          >
                            {isCash ? <Banknote size={11} /> : <QrCode size={11} />}
                            <span>{isCash ? 'CASH' : 'GPAY UPI'}</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                <Receipt size={32} style={{ margin: '0 auto 0.5rem', opacity: 0.35 }} />
                <p style={{ fontSize: '0.85rem', fontWeight: 600, margin: 0 }}>No payments recorded yet today.</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ========================================================================= */
        /* TAB 2: DRIVER HISTORY WITH PAGINATION */
        /* ========================================================================= */
        <div>
          {/* History Subcategory Pills */}
          <div style={{ display: 'flex', gap: '0.35rem', overflowX: 'auto', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
            {[
              { id: 'DELIVERED', label: 'Delivered', count: completedDeliveries.length, icon: CheckCircle2 },
              { id: 'NOT_DELIVERED', label: 'Not Delivered', count: notDeliveredList.length, icon: XCircle },
              { id: 'COLLECTIONS', label: 'Collections', count: payments.length, icon: Receipt },
              { id: 'EXPENSES', label: 'Expenses', count: expenses.length, icon: Wallet },
            ].map((cat) => {
              const Icon = cat.icon;
              const isActive = historyCategory === cat.id;

              return (
                <button
                  key={cat.id}
                  type="button"
                  style={{
                    flex: 1,
                    whiteSpace: 'nowrap',
                    padding: '0.45rem 0.6rem',
                    fontSize: '0.75rem',
                    fontWeight: isActive ? 700 : 600,
                    borderRadius: '20px',
                    border: isActive ? '1px solid var(--primary)' : '1px solid var(--border)',
                    background: isActive ? 'var(--primary)' : 'var(--surface)',
                    color: isActive ? '#ffffff' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    minHeight: '38px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.3rem',
                  }}
                  onClick={() => {
                    setHistoryCategory(cat.id as any);
                    setHistoryPage(1);
                  }}
                >
                  <Icon size={14} />
                  <span>{cat.label}</span>
                  <span
                    style={{
                      background: isActive ? 'rgba(255,255,255,0.25)' : 'var(--surface-sunken)',
                      color: isActive ? '#ffffff' : 'var(--text-muted)',
                      borderRadius: '10px',
                      padding: '0.05rem 0.35rem',
                      fontSize: '0.66rem',
                    }}
                  >
                    {cat.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Paginated History Items List */}
          {paginatedItems.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginBottom: '1rem' }}>
              {historyCategory === 'DELIVERED' &&
                (paginatedItems as Delivery[]).map((d) => (
                  <div key={d.id} style={{ background: 'var(--surface)', padding: '0.85rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid #86efac' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.25rem' }}>
                      <strong style={{ fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                        {d.order_details?.customer_details?.name || 'Customer Shop'}
                      </strong>
                      <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>Delivered</span>
                    </div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', marginBottom: '0.2rem' }}>
                      {d.order_details?.items.map((it) => `${it.product_details?.name} (${it.quantity})`).join(', ')}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                      <span>Staff: <strong>{d.recipient_name || 'Shop Staff'}</strong></span>
                      <strong style={{ color: 'var(--primary)' }}>{formatCurrency(d.order_details?.total_amount || '0')}</strong>
                    </div>
                  </div>
                ))}

              {historyCategory === 'NOT_DELIVERED' &&
                (paginatedItems as Delivery[]).map((d) => (
                  <div key={d.id} style={{ background: 'var(--surface)', padding: '0.85rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid #fca5a5' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.25rem' }}>
                      <strong style={{ fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                        {d.order_details?.customer_details?.name || 'Customer Shop'}
                      </strong>
                      <span className="badge badge-danger" style={{ fontSize: '0.7rem' }}>Not Delivered</span>
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#dc2626', fontWeight: 600, margin: '0.2rem 0' }}>
                      Reason: {d.failed_reason || 'Shop closed / skipped'}
                    </div>
                    {d.notes && (
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                        Remarks: {d.notes}
                      </div>
                    )}
                  </div>
                ))}

              {historyCategory === 'COLLECTIONS' &&
                (paginatedItems as Payment[]).map((p) => (
                  <div key={p.id} style={{ background: 'var(--surface)', padding: '0.85rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <strong style={{ fontSize: '0.92rem', color: 'var(--text-primary)', display: 'block' }}>
                        {p.customer_name || 'Customer Shop'}
                      </strong>
                      <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                        Receipt #{p.payment_number} • {formatDateTime(p.received_at)}
                      </span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <strong style={{ fontSize: '1.05rem', color: '#059669', fontWeight: 800 }}>
                        {formatCurrency(p.amount)}
                      </strong>
                      <span style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: p.payment_method === 'CASH' ? '#059669' : 'var(--primary)' }}>
                        {p.payment_method === 'CASH' ? 'Cash' : 'GPay UPI'}
                      </span>
                    </div>
                  </div>
                ))}

              {historyCategory === 'EXPENSES' &&
                (paginatedItems as DriverExpense[]).map((exp) => (
                  <div key={exp.id} style={{ background: 'var(--surface)', padding: '0.85rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      <div style={{ width: 34, height: 34, borderRadius: '8px', background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {getCategoryIcon(exp.category)}
                      </div>
                      <div>
                        <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)', display: 'block' }}>
                          {exp.category_display}
                        </strong>
                        <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                          {formatDate(exp.date)} {exp.notes && `• ${exp.notes}`}
                        </span>
                      </div>
                    </div>
                    <strong style={{ fontSize: '1rem', color: '#dc2626', fontWeight: 800 }}>
                      {formatCurrency(exp.amount)}
                    </strong>
                  </div>
                ))}
            </div>
          ) : (
            <div style={{ background: 'var(--surface)', padding: '2.5rem 1rem', textAlign: 'center', borderRadius: 'var(--radius-md)', color: 'var(--text-muted)', border: '1px solid var(--border)', marginBottom: '1rem' }}>
              <History size={36} style={{ margin: '0 auto 0.5rem', opacity: 0.35 }} />
              <p style={{ fontSize: '0.88rem' }}>No records found in this category.</p>
            </div>
          )}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface)', padding: '0.6rem 0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                Page {historyPage} of {totalPages} ({currentList.length} total)
              </span>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ minHeight: '34px', padding: '0.25rem 0.6rem', fontSize: '0.78rem' }}
                  disabled={historyPage <= 1}
                  onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft size={16} />
                  <span>Prev</span>
                </button>

                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ minHeight: '34px', padding: '0.25rem 0.6rem', fontSize: '0.78rem' }}
                  disabled={historyPage >= totalPages}
                  onClick={() => setHistoryPage((p) => Math.min(totalPages, p + 1))}
                >
                  <span>Next</span>
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
