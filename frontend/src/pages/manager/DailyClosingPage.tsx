import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { reportService, DailyClosingResponse } from '../../services/reportService';
import { formatCurrency, formatDateTime, formatDate, getLocalDateString } from '../../utils/formatters';
import { UniversalDatePicker } from '../../components/UniversalDatePicker';
import {
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Unlock,
  RefreshCw,
  DollarSign,
  ShoppingCart,
  Send,
  Receipt,
  Scale,
  CreditCard,
  Wallet,
  Info,
  ShieldAlert,
  Sun,
  Sunrise,
  Edit2,
} from 'lucide-react';

export const DailyClosingPage: React.FC = () => {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return getLocalDateString();
  });
  const [closingData, setClosingData] = useState<DailyClosingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Day Open Modal
  const [isOpenDayModalOpen, setIsOpenDayModalOpen] = useState(false);
  const [openingCashInput, setOpeningCashInput] = useState('500.00');
  const [openingNotesInput, setOpeningNotesInput] = useState('');
  const [submittingDayOpen, setSubmittingDayOpen] = useState(false);

  // Closing Confirmation Modal
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [closingNotes, setClosingNotes] = useState('');
  const [isChecklistVerified, setIsChecklistVerified] = useState(false);
  const [submittingClosing, setSubmittingClosing] = useState(false);

  // Owner Reopen Modal
  const [isReopenModalOpen, setIsReopenModalOpen] = useState(false);
  const [reopenReason, setReopenReason] = useState('');
  const [submittingReopen, setSubmittingReopen] = useState(false);

  const fetchClosingSummary = async (dateStr?: string) => {
    try {
      setLoading(true);
      setError(null);
      const res = await reportService.getDailyClosing(dateStr || selectedDate);
      setClosingData(res);
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
      else setError('Failed to load daily closing data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClosingSummary(selectedDate);
  }, [selectedDate]);

  const handleOpenDay = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmittingDayOpen(true);
      setError(null);
      await reportService.openDay({
        date: selectedDate,
        opening_cash: openingCashInput,
        notes: openingNotesInput,
      });
      setIsOpenDayModalOpen(false);
      await fetchClosingSummary(selectedDate);
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
      else setError('Failed to open business day.');
    } finally {
      setSubmittingDayOpen(false);
    }
  };

  const handleConfirmClosing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isChecklistVerified) {
      setError('Please review and check the figures before closing.');
      return;
    }

    try {
      setSubmittingClosing(true);
      setError(null);
      await reportService.submitDailyClosing({
        date: selectedDate,
        notes: closingNotes,
      });
      setIsConfirmModalOpen(false);
      setClosingNotes('');
      setIsChecklistVerified(false);
      await fetchClosingSummary(selectedDate);
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
      else setError('Failed to submit daily closing.');
    } finally {
      setSubmittingClosing(false);
    }
  };

  const handleReopenClosing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reopenReason.trim()) {
      setError('A mandatory reason is required to reopen a closed day.');
      return;
    }

    try {
      setSubmittingReopen(true);
      setError(null);
      await reportService.reopenDailyClosing({
        date: selectedDate,
        reason: reopenReason.trim(),
      });
      setIsReopenModalOpen(false);
      setReopenReason('');
      await fetchClosingSummary(selectedDate);
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
      else setError('Failed to reopen business day.');
    } finally {
      setSubmittingReopen(false);
    }
  };

  const figures = closingData?.figures;
  const isClosed = closingData?.is_closed || false;
  const closingRecord = closingData?.closing_record;

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      {/* Page Title & Controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            Daily Business Closing
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', margin: '0.2rem 0 0' }}>
            Review fulfillment, reconcile cash & UPI collections, and execute verified end-of-day closing.
          </p>
        </div>

        {/* Date Selector & Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <UniversalDatePicker
            value={selectedDate}
            onChange={(d) => setSelectedDate(d)}
            style={{ width: '135px', height: '34px' }}
            title="Business Day Date (DD/MM/YYYY)"
          />

          {!isClosed && !closingData?.is_opened ? (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => setIsOpenDayModalOpen(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 800, background: '#dc2626', borderColor: '#dc2626' }}
            >
              <Sun size={15} />
              <span>Open Business Day</span>
            </button>
          ) : closingData?.is_opened && !isClosed ? (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
              <span
                className="badge badge-success"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '0.4rem 0.7rem', fontSize: '0.8rem' }}
              >
                <Sun size={14} />
                <span>Day Open (Float: {formatCurrency(closingData.opening_record?.opening_cash || '0')})</span>
              </span>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setOpeningCashInput(closingData.opening_record?.opening_cash ? String(closingData.opening_record.opening_cash) : '');
                  setOpeningNotesInput(closingData.opening_record?.opening_notes || '');
                  setIsOpenDayModalOpen(true);
                }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem', fontWeight: 700 }}
                title="Edit opening float amount"
              >
                <Edit2 size={13} />
                <span>Edit Float</span>
              </button>
            </div>
          ) : null}

          <button className="btn btn-secondary btn-sm" onClick={() => fetchClosingSummary()} disabled={loading}>
            <RefreshCw size={15} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: 'var(--danger-bg)', color: 'var(--danger)', padding: '0.85rem', borderRadius: 'var(--radius-md)', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Day Status Banners */}
      {isClosed && closingRecord ? (
        <div
          className="card"
          style={{
            padding: '1.25rem 1.5rem',
            marginBottom: '1.5rem',
            borderLeft: '5px solid #059669',
            background: '#ecfdf5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
              <Lock size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#065f46', margin: 0 }}>
                  BUSINESS DAY CLOSED
                </h3>
                <span className="badge badge-success" style={{ fontSize: '0.75rem' }}>
                  Finalized Snapshot
                </span>
              </div>
              <p style={{ color: '#047857', fontSize: '0.85rem', margin: '0.2rem 0 0' }}>
                Closed by <strong>{closingRecord.closed_by_name}</strong> on {formatDateTime(closingRecord.closed_at)}
              </p>
              {closingRecord.notes && (
                <p style={{ color: '#065f46', fontSize: '0.8rem', fontStyle: 'italic', margin: '0.3rem 0 0' }}>
                  "{closingRecord.notes}"
                </p>
              )}
            </div>
          </div>

          {/* Owner Reopen Action */}
          {user?.role === 'OWNER' && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setIsReopenModalOpen(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', borderColor: '#059669', color: '#065f46' }}
            >
              <Unlock size={15} />
              <span>Owner Reopen Day</span>
            </button>
          )}
        </div>
      ) : closingRecord && !closingRecord.is_closed ? (
        <div
          className="card"
          style={{
            padding: '1.25rem 1.5rem',
            marginBottom: '1.5rem',
            borderLeft: '5px solid #f59e0b',
            background: '#fffbeb',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
          }}
        >
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
            <Unlock size={20} />
          </div>
          <div>
            <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#92400e', margin: 0 }}>
              Business Day Reopened by Owner
            </h4>
            <p style={{ color: '#b45309', fontSize: '0.85rem', margin: '0.2rem 0 0' }}>
              Reopened by <strong>{closingRecord.reopened_by_name}</strong> on {closingRecord.reopened_at ? formatDateTime(closingRecord.reopened_at) : 'N/A'}: "{closingRecord.reopen_reason}"
            </p>
          </div>
        </div>
      ) : closingData?.is_opened ? (
        <div
          className="card"
          style={{
            padding: '1.25rem 1.5rem',
            marginBottom: '1.5rem',
            borderLeft: '5px solid #dc2626',
            background: '#fef2f2',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
              <Sun size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#991b1b', margin: 0 }}>
                  BUSINESS DAY OPEN
                </h3>
                <span className="badge badge-primary" style={{ fontSize: '0.75rem' }}>
                  Active Trading
                </span>
              </div>
              <p style={{ color: '#b91c1c', fontSize: '0.85rem', margin: '0.2rem 0 0' }}>
                Opened by <strong>{closingData.opening_record?.opened_by_name}</strong> at {closingData.opening_record?.opened_at ? formatDateTime(closingData.opening_record.opened_at) : 'Morning'} • Opening Float: <strong>{formatCurrency(closingData.opening_record?.opening_cash || '0')}</strong>
              </p>
              {closingData.opening_record?.opening_notes && (
                <p style={{ color: '#991b1b', fontSize: '0.8rem', fontStyle: 'italic', margin: '0.3rem 0 0' }}>
                  "{closingData.opening_record.opening_notes}"
                </p>
              )}
            </div>
          </div>
          {!isClosed && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setOpeningCashInput(closingData.opening_record?.opening_cash ? String(closingData.opening_record.opening_cash) : '');
                setOpeningNotesInput(closingData.opening_record?.opening_notes || '');
                setIsOpenDayModalOpen(true);
              }}
              style={{
                marginLeft: 'auto',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                border: '1px solid #ef4444',
                color: '#b91c1c',
                background: 'white',
                cursor: 'pointer',
                padding: '0.4rem 0.85rem',
              }}
              title="Click to edit opening cash float amount"
            >
              <Edit2 size={15} />
              <span>Edit Float Amount</span>
            </button>
          )}
        </div>
      ) : (
        <div
          className="card"
          style={{
            padding: '1.25rem 1.5rem',
            marginBottom: '1.5rem',
            borderLeft: '5px solid #f59e0b',
            background: '#fffbeb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
              <Sunrise size={22} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#92400e', margin: 0 }}>
                BUSINESS DAY NOT OPENED
              </h3>
              <p style={{ color: '#b45309', fontSize: '0.85rem', margin: '0.2rem 0 0' }}>
                Initialize the business day by setting the morning cash float in the cash drawer.
              </p>
            </div>
          </div>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => setIsOpenDayModalOpen(true)}
            style={{ fontWeight: 800, padding: '0.45rem 1rem', background: '#dc2626', borderColor: '#dc2626' }}
          >
            <Sun size={15} />
            <span>+ Open Business Day</span>
          </button>
        </div>
      )}

      {loading && !closingData ? (
        <div style={{ padding: '4rem', textAlign: 'center' }}>
          <div className="spinner" style={{ margin: '0 auto' }} />
        </div>
      ) : (
        <>
          {/* Main Financial KPI Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            {/* 1. Total Orders & Sales */}
            <div className="card" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Orders & Sales</span>
                <ShoppingCart size={18} color="var(--primary)" />
              </div>
              <p style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--text-primary)', margin: '0.3rem 0 0' }}>
                {figures?.total_orders || 0} Orders
              </p>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--primary)' }}>
                Total Sales: {formatCurrency(figures?.total_sales || '0.00')}
              </span>
            </div>

            {/* 2. Total Collections */}
            <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid #059669' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Collections</span>
                <Wallet size={18} color="#059669" />
              </div>
              <p style={{ fontSize: '1.6rem', fontWeight: 900, color: '#059669', margin: '0.3rem 0 0' }}>
                {formatCurrency(figures?.total_collected || '0.00')}
              </p>
              <div style={{ display: 'flex', gap: '0.6rem', fontSize: '0.75rem', marginTop: '0.2rem' }}>
                <span style={{ color: '#059669', fontWeight: 600 }}>Cash: {formatCurrency(figures?.cash_collected || '0.00')}</span>
                <span style={{ color: 'var(--primary)', fontWeight: 600 }}>UPI: {formatCurrency(figures?.upi_collected || '0.00')}</span>
              </div>
            </div>

            {/* 3. Expenses */}
            <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid #dc2626' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Expenses</span>
                <Receipt size={18} color="#dc2626" />
              </div>
              <p style={{ fontSize: '1.6rem', fontWeight: 900, color: '#dc2626', margin: '0.3rem 0 0' }}>
                {formatCurrency(figures?.driver_expenses || '0.00')}
              </p>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Shop expenses, maintenance, fuel & route costs
              </span>
            </div>

            {/* 4. Cash in Drawer Handover */}
            <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid #f59e0b', background: '#fffbeb' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#92400e', textTransform: 'uppercase' }}>Cash in Drawer / Handover</span>
                <Scale size={18} color="#b45309" />
              </div>
              <p style={{ fontSize: '1.6rem', fontWeight: 900, color: '#b45309', margin: '0.3rem 0 0' }}>
                {formatCurrency(figures?.expected_cash_in_hand ?? figures?.net_collection ?? '0.00')}
              </p>
              <span style={{ fontSize: '0.75rem', color: '#78350f' }}>
                Float ({formatCurrency(figures?.opening_cash || '0.00')}) + Cash Rec. ({formatCurrency(figures?.cash_collected || '0.00')}) − Exp. ({formatCurrency(figures?.driver_expenses || '0.00')}) − Staff Wages ({formatCurrency(figures?.staff_cash_paid || '0.00')})
              </span>
            </div>
          </div>

          {/* Deep Breakdown Sections */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem', marginBottom: '1.75rem' }}>
            {/* Credit & Receivables Analysis */}
            <div className="card" style={{ padding: '1.25rem' }}>
              <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.85rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <CreditCard size={16} color="var(--primary)" />
                <span>Credit & Collections Breakdown</span>
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.45rem 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Credit Sales Generated Today:</span>
                  <strong style={{ fontSize: '0.88rem', color: 'var(--primary)' }}>
                    {formatCurrency(figures?.credit_generated || '0.00')}
                  </strong>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.45rem 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: '0.85rem', color: '#e11d48' }}>Shop Expenses / Deductions:</span>
                  <strong style={{ fontSize: '0.88rem', color: '#e11d48' }}>
                    - {formatCurrency(figures?.total_shop_expense || '0.00')}
                  </strong>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.45rem 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Today's Order Payments:</span>
                  <strong style={{ fontSize: '0.88rem', color: '#059669' }}>
                    {formatCurrency(figures?.today_order_collected || '0.00')}
                  </strong>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.45rem 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Previous Credit Recovered Today:</span>
                  <strong style={{ fontSize: '0.88rem', color: 'var(--primary)' }}>
                    {formatCurrency(figures?.previous_credit_collected || '0.00')}
                  </strong>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.45rem 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>Total Received Today:</span>
                  <strong style={{ fontSize: '0.95rem', color: '#059669' }}>
                    {formatCurrency(figures?.total_collected || '0.00')}
                  </strong>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.45rem 0' }}>
                  <span style={{ fontSize: '0.85rem', color: '#16a34a' }}>Staff Cash Wages Paid:</span>
                  <strong style={{ fontSize: '0.88rem', color: '#16a34a' }}>
                    - {formatCurrency(figures?.staff_cash_paid || '0.00')}
                  </strong>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.45rem 0' }}>
                  <span style={{ fontSize: '0.85rem', color: '#2563eb' }}>Staff GPay Wages Paid:</span>
                  <strong style={{ fontSize: '0.88rem', color: '#2563eb' }}>
                    - {formatCurrency(figures?.staff_gpay_paid || '0.00')}
                  </strong>
                </div>
              </div>
            </div>

            {/* Delivery Dispatch Summary */}
            <div className="card" style={{ padding: '1.25rem' }}>
              <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.85rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Send size={16} color="#059669" />
                <span>Delivery Fulfillment Status</span>
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.45rem 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Total Scheduled Deliveries:</span>
                  <strong style={{ fontSize: '0.88rem' }}>{figures?.total_deliveries || 0}</strong>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.45rem 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: '0.85rem', color: '#059669' }}>Delivered & Acknowledged:</span>
                  <strong style={{ fontSize: '0.88rem', color: '#059669' }}>{figures?.delivered_count || 0}</strong>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.45rem 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: '0.85rem', color: '#b45309' }}>Pending / In Transit:</span>
                  <strong style={{ fontSize: '0.88rem', color: '#b45309' }}>{figures?.pending_deliveries || 0}</strong>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.45rem 0' }}>
                  <span style={{ fontSize: '0.85rem', color: '#dc2626' }}>Not Delivered / Refused:</span>
                  <strong style={{ fontSize: '0.88rem', color: '#dc2626' }}>{figures?.not_delivered_count || 0}</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Verification & Closing Action */}
          {!isClosed ? (
            <div className="card" style={{ padding: '1.5rem', background: '#f8fafc', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <h4 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                    Execute Verified Daily Closing
                  </h4>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '0.2rem 0 0' }}>
                    Review figures before closing. Identifying discrepancies now avoids post-closing corrections.
                  </p>
                </div>
                <button
                  className="btn btn-primary btn-lg"
                  onClick={() => setIsConfirmModalOpen(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  <Lock size={18} />
                  <span>Review & Close Business Day</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="card" style={{ padding: '1.25rem', textAlign: 'center', background: '#f8fafc' }}>
              <span style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                This business day ({formatDate(selectedDate)}) is closed. Financial snapshots have been secured in the audit ledger.
              </span>
            </div>
          )}
        </>
      )}

      {/* Confirmation Modal */}
      {isConfirmModalOpen && figures && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '580px' }}>
            <h3 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
              Review Today's Figures Before Closing
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
              Please verify final collection cash and delivery status before locking the day ({selectedDate}).
            </p>

            {/* Checklist */}
            <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: 'var(--radius-md)', marginBottom: '1.25rem', border: '1px solid var(--border)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
                <div>Total Sales: <strong>{formatCurrency(figures.total_sales)}</strong></div>
                <div>Cash Handover: <strong style={{ color: '#059669' }}>{formatCurrency(figures.cash_collected)}</strong></div>
                <div>UPI Collected: <strong style={{ color: 'var(--primary)' }}>{formatCurrency(figures.upi_collected)}</strong></div>
                <div>Expenses: <strong style={{ color: '#dc2626' }}>{formatCurrency(figures.driver_expenses)}</strong></div>
                <div style={{ gridColumn: 'span 2', fontWeight: 800, color: '#b45309' }}>
                  Net Expected Handover: {formatCurrency(figures.net_collection)}
                </div>
              </div>

              {figures.pending_deliveries > 0 && (
                <div style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', fontSize: '0.78rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <AlertTriangle size={15} />
                  <span>Warning: {figures.pending_deliveries} deliveries are still marked pending today.</span>
                </div>
              )}

              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={isChecklistVerified}
                  onChange={(e) => setIsChecklistVerified(e.target.checked)}
                  style={{ marginTop: '0.15rem' }}
                />
                <span>
                  I have verified all driver cash envelopes, UPI settlement references, and delivery logs for {selectedDate}.
                </span>
              </label>
            </div>

            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
              <label className="form-label">Closing Notes / Remarks (Optional)</label>
              <textarea
                className="form-textarea"
                rows={2}
                placeholder="e.g. Counter cash reconciled, driver fuel receipts checked"
                value={closingNotes}
                onChange={(e) => setClosingNotes(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsConfirmModalOpen(false)}
                disabled={submittingClosing}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleConfirmClosing}
                disabled={submittingClosing || !isChecklistVerified}
              >
                <Lock size={16} />
                <span>{submittingClosing ? 'Closing Day...' : 'Finalize & Close Business Day'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Owner Reopen Modal */}
      {isReopenModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#b45309', marginBottom: '0.5rem' }}>
              <ShieldAlert size={22} />
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>
                Reopen Business Day ({selectedDate})
              </h3>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
              Controlled Owner action. This unlocks the day to allow late entries or corrections. An audit entry will be permanently recorded.
            </p>

            <form onSubmit={handleReopenClosing}>
              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label className="form-label">
                  Mandatory Reason for Reopening <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <textarea
                  className="form-textarea"
                  rows={3}
                  required
                  placeholder="e.g. Authorized entry of missed late evening delivery batch"
                  value={reopenReason}
                  onChange={(e) => setReopenReason(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsReopenModalOpen(false)}
                  disabled={submittingReopen}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submittingReopen || !reopenReason.trim()}
                  style={{ background: '#b45309', borderColor: '#b45309' }}
                >
                  <Unlock size={16} />
                  <span>{submittingReopen ? 'Reopening...' : 'Confirm Reopening'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Day Open Modal */}
      {isOpenDayModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: '#dc2626', marginBottom: '0.5rem' }}>
              <Sunrise size={24} />
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>
                {closingData?.is_opened ? 'Edit Opening Cash Float' : 'Open Business Day'} ({selectedDate})
              </h3>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
              {closingData?.is_opened
                ? 'Update the morning cash float amount in the cash drawer for this business day.'
                : "Record the opening cash float in the cash drawer and start today's trading session."}
            </p>

            <form onSubmit={handleOpenDay}>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label" style={{ fontWeight: 700 }}>
                  Opening Cash Float in Register (₹) <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', fontWeight: 800, color: 'var(--text-muted)' }}>₹</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    className="form-input"
                    style={{ paddingLeft: '1.75rem', fontSize: '1.1rem', fontWeight: 800 }}
                    placeholder="500.00"
                    value={openingCashInput}
                    onChange={(e) => setOpeningCashInput(e.target.value)}
                  />
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'block' }}>
                  Petty cash available for change/counter expenses at start of day.
                </span>
              </div>

              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label className="form-label">Opening Notes / Shift Remarks (Optional)</label>
                <textarea
                  className="form-textarea"
                  rows={2}
                  placeholder="e.g. Morning float verified by Manager, change breakdown ready"
                  value={openingNotesInput}
                  onChange={(e) => setOpeningNotesInput(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsOpenDayModalOpen(false)}
                  disabled={submittingDayOpen}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submittingDayOpen || !openingCashInput}
                  style={{ background: '#dc2626', borderColor: '#dc2626' }}
                >
                  <Sun size={16} />
                  <span>{submittingDayOpen ? 'Saving...' : closingData?.is_opened ? 'Save Float Amount' : 'Confirm & Open Day'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

