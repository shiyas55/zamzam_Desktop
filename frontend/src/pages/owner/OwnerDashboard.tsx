import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { reportService, DateFilterParams } from '../../services/reportService';
import { DashboardSummary, DatePreset } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import { BRAND_CONFIG } from '../../config/brandConfig';

import {
  TrendingUp,
  ShoppingCart,
  CheckCircle2,
  DollarSign,
  AlertTriangle,
  MapPin,
  RefreshCw,
  Wallet,
  Receipt,
  Scale,
  XCircle,
  Clock,
  Calendar,
  Truck,
  Users,
  History,
  Store,
  Tag,
  CreditCard,
  ArrowRight,
} from 'lucide-react';

export const OwnerDashboard: React.FC = () => {
  const navigate = useNavigate();

  // Date Filtering State
  const [datePreset, setDatePreset] = useState<DatePreset>('today');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showCustomRange, setShowCustomRange] = useState(false);

  // Data & loading state
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = async (overrideParams?: DateFilterParams) => {
    try {
      setLoading(true);
      setError(null);
      const params: DateFilterParams = overrideParams || {
        date_preset: datePreset,
        start_date: datePreset === 'custom' ? startDate : undefined,
        end_date: datePreset === 'custom' ? endDate : undefined,
      };
      const res = await reportService.getDashboardSummary(params);
      setData(res);
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
      else setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, [datePreset]);

  const handleApplyCustomDates = (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || !endDate) return;
    setDatePreset('custom');
    fetchDashboard({
      date_preset: 'custom',
      start_date: startDate,
      end_date: endDate,
    });
  };

  const getPeriodLabel = () => {
    switch (datePreset) {
      case 'today':
        return "TODAY'S";
      case 'yesterday':
        return "YESTERDAY'S";
      case 'this_week':
        return "THIS WEEK'S";
      case 'this_month':
        return "THIS MONTH'S";
      default:
        return 'PERIOD';
    }
  };

  return (
    <div>
      {/* Top Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>
            Owner Business Intelligence
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', margin: '0.2rem 0 0' }}>
            Live wholesale operations across {BRAND_CONFIG.routes.join(', ')} routes.
          </p>
        </div>

        <button
          className="btn btn-secondary"
          onClick={() => fetchDashboard()}
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          disabled={loading}
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Date Filtering Control Bar */}
      <div
        className="card"
        style={{
          padding: '0.85rem 1.25rem',
          marginBottom: '1.5rem',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.75rem',
          borderLeft: '4px solid var(--primary)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 700, marginRight: '0.5rem' }}>
            <Calendar size={16} color="var(--primary)" />
            <span>DATE FILTER:</span>
          </div>

          {(['today', 'yesterday', 'this_week', 'this_month'] as DatePreset[]).map((preset) => (
            <button
              key={preset}
              className={`btn btn-sm ${datePreset === preset ? 'btn-primary' : 'btn-secondary'}`}
              style={{
                textTransform: 'capitalize',
                padding: '0.35rem 0.8rem',
                fontSize: '0.8rem',
              }}
              onClick={() => {
                setShowCustomRange(false);
                setDatePreset(preset);
              }}
            >
              {preset.replace('_', ' ')}
            </button>
          ))}

          <button
            className={`btn btn-sm ${datePreset === 'custom' || showCustomRange ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '0.35rem 0.8rem', fontSize: '0.8rem' }}
            onClick={() => setShowCustomRange(!showCustomRange)}
          >
            Custom Range
          </button>
        </div>

        {data && (
          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
            Active Date: <span className="badge badge-neutral" style={{ fontSize: '0.78rem' }}>{data.date}</span>
          </span>
        )}
      </div>

      {/* Custom Range Picker Drawer */}
      {showCustomRange && (
        <form
          onSubmit={handleApplyCustomDates}
          className="card"
          style={{
            padding: '1rem 1.25rem',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            flexWrap: 'wrap',
            background: 'var(--bg-main)',
            border: '1px solid var(--border)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.82rem', fontWeight: 600 }}>Start Date:</label>
            <input
              type="date"
              className="form-input"
              style={{ padding: '0.3rem 0.6rem', fontSize: '0.85rem' }}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.82rem', fontWeight: 600 }}>End Date:</label>
            <input
              type="date"
              className="form-input"
              style={{ padding: '0.3rem 0.6rem', fontSize: '0.85rem' }}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn btn-primary btn-sm">
            Apply Date Range
          </button>
        </form>
      )}

      {/* Error Display */}
      {error && (
        <div style={{ padding: '1rem', background: 'var(--danger-bg)', color: 'var(--danger)', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertTriangle size={18} />
          <span>Error loading data: {error}</span>
        </div>
      )}

      {/* Loading state */}
      {loading && !data && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem 0' }}>
          <div className="spinner" />
        </div>
      )}

      {data && (
        <>
          {/* SECTION: TODAY'S / PERIOD'S BUSINESS SUMMARY */}
          <div style={{ marginBottom: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <div style={{ width: 8, height: 24, background: 'var(--primary)', borderRadius: '4px' }} />
              <h3 style={{ fontSize: '1.25rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-primary)', margin: 0 }}>
                {getPeriodLabel()} BUSINESS SUMMARY
              </h3>
              <span className="badge badge-neutral" style={{ fontSize: '0.75rem' }}>
                {data.date}
              </span>
            </div>

            {/* 9 KPI Cards as specified in Prompt 3 */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
                gap: '1rem',
              }}
            >
              {/* 1. Today's Orders */}
              <div className="card" style={{ padding: '1.15rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                    {getPeriodLabel()} Orders
                  </span>
                  <div style={{ width: 32, height: 32, borderRadius: '8px', background: '#fef2f2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ShoppingCart size={16} />
                  </div>
                </div>
                <p style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>
                  {data.today_orders_count || 0}
                </p>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Created orders</span>
              </div>

              {/* 2. Today's Sales */}
              <div className="card" style={{ padding: '1.15rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                    {getPeriodLabel()} Sales
                  </span>
                  <div style={{ width: 32, height: 32, borderRadius: '8px', background: '#fef2f2', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <TrendingUp size={16} />
                  </div>
                </div>
                <p style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--primary-dark)', margin: 0 }}>
                  {formatCurrency(data.today_sales)}
                </p>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Billed order gross value</span>
              </div>

              {/* 3. Today's Collection */}
              <div className="card" style={{ padding: '1.15rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                    {getPeriodLabel()} Collection
                  </span>
                  <div style={{ width: 32, height: 32, borderRadius: '8px', background: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <DollarSign size={16} />
                  </div>
                </div>
                <p style={{ fontSize: '1.5rem', fontWeight: 900, color: '#059669', margin: 0 }}>
                  {formatCurrency(data.total_collected)}
                </p>
                <div style={{ display: 'flex', gap: '0.4rem', fontSize: '0.7rem', marginTop: '0.2rem' }}>
                  <span style={{ color: '#059669', fontWeight: 600 }}>Cash: {formatCurrency(data.cash_collected)}</span>
                  <span style={{ color: 'var(--primary)', fontWeight: 600 }}>UPI: {formatCurrency(data.upi_collected)}</span>
                </div>
              </div>

              {/* 4. Today's Credit */}
              <div className="card" style={{ padding: '1.15rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                    {getPeriodLabel()} Credit
                  </span>
                  <div style={{ width: 32, height: 32, borderRadius: '8px', background: '#fef3c7', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Wallet size={16} />
                  </div>
                </div>
                <p style={{ fontSize: '1.5rem', fontWeight: 900, color: '#b45309', margin: 0 }}>
                  {formatCurrency(data.today_credit || '0.00')}
                </p>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Net credit extended in period</span>
              </div>

              {/* 5. Delivered Orders */}
              <div className="card" style={{ padding: '1.15rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                    Delivered
                  </span>
                  <div style={{ width: 32, height: 32, borderRadius: '8px', background: '#ecfdf5', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <CheckCircle2 size={16} />
                  </div>
                </div>
                <p style={{ fontSize: '1.5rem', fontWeight: 900, color: '#047857', margin: 0 }}>
                  {data.completed_deliveries || 0}
                </p>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Successfully received</span>
              </div>

              {/* 6. Pending Deliveries */}
              <div className="card" style={{ padding: '1.15rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                    Pending
                  </span>
                  <div style={{ width: 32, height: 32, borderRadius: '8px', background: '#fffbeb', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Clock size={16} />
                  </div>
                </div>
                <p style={{ fontSize: '1.5rem', fontWeight: 900, color: '#d97706', margin: 0 }}>
                  {data.pending_deliveries || 0}
                </p>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Assigned or in-transit</span>
              </div>

              {/* 7. Not Delivered Orders */}
              <div className="card" style={{ padding: '1.15rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                    Not Delivered
                  </span>
                  <div style={{ width: 32, height: 32, borderRadius: '8px', background: '#fee2e2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <XCircle size={16} />
                  </div>
                </div>
                <p style={{ fontSize: '1.5rem', fontWeight: 900, color: '#dc2626', margin: 0 }}>
                  {data.not_delivered_count || 0}
                </p>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Shop closed or failed</span>
              </div>

              {/* 8. Total Expenses */}
              <div className="card" style={{ padding: '1.15rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                    Total Expenses
                  </span>
                  <div style={{ width: 32, height: 32, borderRadius: '8px', background: '#fef2f2', color: '#b91c1c', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Receipt size={16} />
                  </div>
                </div>
                <p style={{ fontSize: '1.5rem', fontWeight: 900, color: '#b91c1c', margin: 0 }}>
                  {formatCurrency(data.today_expenses || '0.00')}
                </p>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Shop, maintenance, fuel & route</span>
              </div>

              {/* 9. Net Collection (Highlighted Card) */}
              <div
                className="card"
                style={{
                  padding: '1.15rem',
                  border: '1px solid #f59e0b',
                  background: '#fffbeb',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#92400e', textTransform: 'uppercase' }}>
                    Net Collection
                  </span>
                  <div style={{ width: 32, height: 32, borderRadius: '8px', background: '#fde68a', color: '#b45309', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Scale size={16} />
                  </div>
                </div>
                <p style={{ fontSize: '1.6rem', fontWeight: 900, color: '#92400e', margin: 0 }}>
                  {formatCurrency(data.net_collection || '0.00')}
                </p>
                <span style={{ fontSize: '0.72rem', color: '#78350f', fontWeight: 600 }}>
                  Collection − Total Expenses
                </span>
              </div>
            </div>
          </div>

          {/* Quick Access Actions Bar for Owner (Prompt 3 Requirement 21) */}
          <div style={{ marginBottom: '2rem' }}>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '0.75rem', letterSpacing: '0.03em' }}>
              Owner Quick Operations
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.6rem' }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => navigate('/owner/customers')}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', padding: '0.6rem' }}
              >
                <Store size={14} color="var(--primary)" />
                <span style={{ fontWeight: 600 }}>Customer Search</span>
              </button>

              <button
                className="btn btn-secondary btn-sm"
                onClick={() => navigate('/owner/orders')}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', padding: '0.6rem' }}
              >
                <ShoppingCart size={14} color="var(--primary)" />
                <span style={{ fontWeight: 600 }}>Orders & Invoices</span>
              </button>

              <button
                className="btn btn-secondary btn-sm"
                onClick={() => navigate('/owner/payments')}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', padding: '0.6rem' }}
              >
                <CreditCard size={14} color="#059669" />
                <span style={{ fontWeight: 600 }}>Payments</span>
              </button>

              <button
                className="btn btn-secondary btn-sm"
                onClick={() => navigate('/owner/expenses')}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', padding: '0.6rem' }}
              >
                <Receipt size={14} color="#dc2626" />
                <span style={{ fontWeight: 600 }}>Expenses</span>
              </button>

              <button
                className="btn btn-secondary btn-sm"
                onClick={() => navigate('/owner/activity-history')}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', padding: '0.6rem' }}
              >
                <History size={14} color="var(--primary)" />
                <span style={{ fontWeight: 600 }}>Activity History</span>
              </button>
            </div>
          </div>

          {/* Route-by-Route Breakdown Table */}
          <div style={{ marginBottom: '2rem' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <MapPin size={20} color="var(--primary)" />
              <span>Route Operational Breakdown ({data.date})</span>
            </h3>

            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Route</th>
                    <th>Code</th>
                    <th>Active Shops</th>
                    <th>Orders</th>
                    <th>Sales</th>
                    <th>Deliveries</th>
                    <th>Collections</th>
                    <th>Expenses</th>
                    <th>Net Handover</th>
                  </tr>
                </thead>
                <tbody>
                  {data.route_breakdown && data.route_breakdown.length > 0 ? (
                    data.route_breakdown.map((r) => (
                      <tr key={r.route_id}>
                        <td style={{ fontWeight: 700 }}>{r.route_name}</td>
                        <td>
                          <span className="badge badge-neutral">{r.route_code}</span>
                        </td>
                        <td>{r.shops_count} shops</td>
                        <td style={{ fontWeight: 600 }}>{r.today_orders_count}</td>
                        <td style={{ fontWeight: 600 }}>{formatCurrency(r.today_sales)}</td>
                        <td>
                          <span style={{ color: '#059669', fontWeight: 600 }}>{r.completed_deliveries || 0}</span>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}> / {r.total_deliveries || 0}</span>
                        </td>
                        <td style={{ color: '#059669', fontWeight: 700 }}>{formatCurrency(r.today_collected)}</td>
                        <td style={{ color: '#dc2626', fontWeight: 600 }}>{formatCurrency(r.today_expenses || '0.00')}</td>
                        <td style={{ color: '#92400e', fontWeight: 800 }}>{formatCurrency(r.net_collected || '0.00')}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                        No route activity recorded for this period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
