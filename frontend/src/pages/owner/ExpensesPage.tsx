import React, { useEffect, useState, useRef } from 'react';
import { expenseService } from '../../services/expenseService';
import { routeService } from '../../services/routeService';
import { DriverExpense, DriverExpenseCategory, DriverExpenseSummary, Driver, Route } from '../../types';
import { formatCurrency, formatDate } from '../../utils/formatters';
import {
  Plus,
  X,
  AlertCircle,
  CheckCircle,
  Store,
  Fuel,
  Utensils,
  ParkingCircle,
  Wrench,
  Trash2,
  Receipt,
  Building,
  UserCheck,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Tag,
} from 'lucide-react';

const CATEGORY_OPTIONS: { label: string; value: string }[] = [
  { label: 'All Expense Categories', value: '' },
  { label: '🏢 Shop / Store Expense', value: 'SHOP_EXPENSE' },
  { label: '🔧 Shop & Vehicle Maintenance', value: 'MAINTENANCE' },
  { label: '📦 Raw Materials / Packaging', value: 'RAW_MATERIAL' },
  { label: '⛽ Petrol / Fuel', value: 'PETROL_FUEL' },
  { label: '🍽️ Food / Meals / Refreshments', value: 'FOOD' },
  { label: '🅿️ Parking', value: 'PARKING' },
  { label: '🛣️ Toll Gate', value: 'TOLL' },
  { label: '💡 Electricity / Rent / Utilities', value: 'UTILITY' },
  { label: '💼 Daily Wages / Staff Allowance', value: 'SALARY_WAGES' },
  { label: '🚗 Vehicle Repair', value: 'VEHICLE_REPAIR' },
  { label: '📝 Other Miscellaneous', value: 'OTHER' },
];

const FORM_CATEGORIES: { label: string; value: DriverExpenseCategory }[] = [
  { label: '🏢 Shop / Store Expense', value: 'SHOP_EXPENSE' },
  { label: '🔧 Shop & Equipment Maintenance', value: 'MAINTENANCE' },
  { label: '📦 Raw Materials / Packaging', value: 'RAW_MATERIAL' },
  { label: '⛽ Petrol / Fuel', value: 'PETROL_FUEL' },
  { label: '🍽️ Food / Meals / Refreshments', value: 'FOOD' },
  { label: '🅿️ Parking', value: 'PARKING' },
  { label: '🛣️ Toll Gate', value: 'TOLL' },
  { label: '💡 Electricity / Rent / Utilities', value: 'UTILITY' },
  { label: '💼 Daily Wages / Staff Allowance', value: 'SALARY_WAGES' },
  { label: '🚗 Vehicle Repair', value: 'VEHICLE_REPAIR' },
  { label: '📝 Other Miscellaneous', value: 'OTHER' },
];

export const ExpensesPage: React.FC = () => {
  const [expenses, setExpenses] = useState<DriverExpense[]>([]);
  const [summary, setSummary] = useState<DriverExpenseSummary | null>(null);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedDriver, setSelectedDriver] = useState('');
  const [selectedRoute, setSelectedRoute] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('');
  const [selectedDate, setSelectedDate] = useState('');

  // Add Expense Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const amountInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    category: 'SHOP_EXPENSE' as DriverExpenseCategory,
    custom_category: '',
    payment_method: 'CASH' as 'CASH' | 'GPAY_UPI',
    driver: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    notes: '',
    receipt_reference: '',
  });
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isModalOpen) {
      setTimeout(() => {
        amountInputRef.current?.focus();
        amountInputRef.current?.select();
      }, 50);
    }
  }, [isModalOpen]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [expList, sumData, driverList, routeList] = await Promise.all([
        expenseService.getExpenses({
          driver: selectedDriver || undefined,
          route: selectedRoute || undefined,
          category: selectedCategory || undefined,
          payment_method: selectedPaymentMethod || undefined,
          date: selectedDate || undefined,
        }),
        expenseService.getExpenseSummary(selectedDriver || undefined),
        routeService.getDrivers(),
        routeService.getRoutes(),
      ]);
      setExpenses(expList);
      setSummary(sumData);
      setDrivers(driverList);
      setRoutes(routeList);
    } catch (err: unknown) {
      console.error('Failed to load expenses data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedDriver, selectedRoute, selectedCategory, selectedPaymentMethod, selectedDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      setFormError('Please enter a valid expense amount greater than zero.');
      return;
    }

    try {
      setFormSubmitting(true);
      setFormError(null);

      await expenseService.createExpense({
        category: formData.category,
        custom_category: formData.custom_category.trim() || undefined,
        payment_method: formData.payment_method,
        driver: formData.driver || null,
        amount: formData.amount,
        date: formData.date || undefined,
        notes: formData.notes.trim() || undefined,
        receipt_reference: formData.receipt_reference.trim() || undefined,
      });

      setIsModalOpen(false);
      setFormData({
        category: 'SHOP_EXPENSE',
        custom_category: '',
        payment_method: 'CASH',
        driver: '',
        amount: '',
        date: new Date().toISOString().split('T')[0],
        notes: '',
        receipt_reference: '',
      });
      setSuccessMsg('Expense recorded successfully!');
      setTimeout(() => setSuccessMsg(null), 4000);
      await fetchData();
    } catch (err: any) {
      const msg =
        err.response?.data?.detail ||
        err.response?.data?.amount?.[0] ||
        err.response?.data?.driver?.[0] ||
        'Failed to record expense. Please verify the inputs.';
      setFormError(msg);
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete this expense of ${name}?`)) {
      return;
    }
    try {
      await expenseService.deleteExpense(id);
      setSuccessMsg('Expense deleted successfully!');
      setTimeout(() => setSuccessMsg(null), 4000);
      await fetchData();
    } catch (err) {
      console.error('Failed to delete expense:', err);
      alert('Failed to delete expense. Please try again.');
    }
  };

  const getCategoryBadgeClass = (category: string) => {
    switch (category) {
      case 'SHOP_EXPENSE':
        return 'badge-primary';
      case 'MAINTENANCE':
        return 'badge-warning';
      case 'RAW_MATERIAL':
        return 'badge-info';
      case 'PETROL_FUEL':
      case 'PETROL':
        return 'badge-warning';
      case 'UTILITY':
        return 'badge-purple';
      case 'SALARY_WAGES':
        return 'badge-success';
      default:
        return 'badge-neutral';
    }
  };

  return (
    <div>
      {/* Toast Alert */}
      {successMsg && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            zIndex: 9999,
            backgroundColor: '#059669',
            color: '#fff',
            padding: '12px 20px',
            borderRadius: '8px',
            boxShadow: '0 4px 14px rgba(0,0,0,0.2)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontWeight: 600,
          }}
        >
          <CheckCircle size={18} />
          {successMsg}
        </div>
      )}

      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1.5rem',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            Expenses Management
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
            Record and manage all shop expenses, equipment maintenance, raw materials, fuel, and driver allowances.
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => {
            setFormError(null);
            setIsModalOpen(true);
          }}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}
        >
          <Plus size={18} />
          Record Expense
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid #dc2626' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
            Today's Total Expenses
          </span>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#dc2626', marginTop: '0.25rem' }}>
            {formatCurrency(summary?.today_total || '0.00')}
          </div>
          <div style={{ display: 'flex', gap: '0.6rem', fontSize: '0.74rem', marginTop: '0.35rem' }}>
            <span style={{ color: '#dc2626', fontWeight: 700 }}>Cash: {formatCurrency(summary?.today_cash_total || '0.00')}</span>
            <span style={{ color: 'var(--primary)', fontWeight: 700 }}>GPay: {formatCurrency(summary?.today_upi_total || '0.00')}</span>
          </div>
        </div>

        <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid #f59e0b' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
            This Week's Expenses
          </span>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#b45309', marginTop: '0.25rem' }}>
            {formatCurrency(summary?.week_total || '0.00')}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Rolling 7-day total
          </div>
        </div>

        <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid #dc2626' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
            This Month's Expenses
          </span>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#dc2626', marginTop: '0.25rem' }}>
            {formatCurrency(summary?.month_total || '0.00')}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Current calendar month
          </div>
        </div>

        <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid #10b981' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
            Category Breakdown (Month)
          </span>
          <div
            style={{
              fontSize: '0.8rem',
              marginTop: '0.4rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.25rem',
              maxHeight: '80px',
              overflowY: 'auto',
            }}
          >
            {summary?.category_breakdown &&
            Object.entries(summary.category_breakdown).some(([_, val]) => parseFloat(val || '0') > 0) ? (
              Object.entries(summary.category_breakdown)
                .filter(([_, val]) => parseFloat(val || '0') > 0)
                .map(([cat, val]) => {
                  const item = FORM_CATEGORIES.find((c) => c.value === cat);
                  const label = item ? item.label.replace(/^[^\s]+\s/, '') : cat;
                  return (
                    <div key={cat} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>{label}:</span>
                      <strong>{formatCurrency(val)}</strong>
                    </div>
                  );
                })
            ) : (
              <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>No expenses recorded this month</span>
            )}
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <select
          className="form-select"
          style={{ minWidth: '220px' }}
          value={selectedDriver}
          onChange={(e) => setSelectedDriver(e.target.value)}
        >
          <option value="">All Sources (Shop & Drivers)</option>
          <option value="SHOP_ONLY">🏢 Shop / General Only (No Driver)</option>
          <optgroup label="Filter by Driver:">
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                🚗 {d.driver_name} ({d.assigned_route_details?.name || 'No Route'})
              </option>
            ))}
          </optgroup>
        </select>

        <select
          className="form-select"
          style={{ minWidth: '180px' }}
          value={selectedRoute}
          onChange={(e) => setSelectedRoute(e.target.value)}
        >
          <option value="">All Routes</option>
          {routes.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name} ({r.code})
            </option>
          ))}
        </select>

        <select
          className="form-select"
          style={{ minWidth: '220px' }}
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
        >
          {CATEGORY_OPTIONS.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>

        <select
          className="form-select"
          style={{ minWidth: '170px' }}
          value={selectedPaymentMethod}
          onChange={(e) => setSelectedPaymentMethod(e.target.value)}
        >
          <option value="">All Payment Modes</option>
          <option value="CASH">💵 Cash Only</option>
          <option value="GPAY_UPI">📱 GPay / UPI Only</option>
        </select>

        <input
          type="date"
          className="form-input"
          style={{ minWidth: '160px' }}
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
        />

        {(selectedDriver || selectedRoute || selectedCategory || selectedPaymentMethod || selectedDate) && (
          <button
            className="btn btn-secondary"
            onClick={() => {
              setSelectedDriver('');
              setSelectedRoute('');
              setSelectedCategory('');
              setSelectedPaymentMethod('');
              setSelectedDate('');
            }}
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Expense Audit Table */}
      <div className="table-container">
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center' }}>
            <div className="spinner" style={{ margin: '0 auto' }} />
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Expense Source</th>
                <th>Route / Location</th>
                <th>Category</th>
                <th>Payment Mode</th>
                <th>Logged By</th>
                <th>Amount (₹)</th>
                <th>Date</th>
                <th>Notes / Bill Ref</th>
                <th style={{ textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {expenses.length > 0 ? (
                expenses.map((exp) => (
                  <tr key={exp.id}>
                    <td>
                      {exp.driver ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700 }}>
                          <span>🚗</span>
                          <span>{exp.driver_name}</span>
                        </div>
                      ) : (
                        <span className="badge badge-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                          <Building size={13} />
                          Shop / Store Expense
                        </span>
                      )}
                    </td>
                    <td>
                      <span className="badge badge-neutral">
                        {exp.route_name || 'Shop / Direct'}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${getCategoryBadgeClass(exp.category)}`}>
                        {exp.custom_category || exp.category_display || exp.category}
                      </span>
                    </td>
                    <td>
                      {exp.payment_method === 'GPAY_UPI' ? (
                        <span className="badge" style={{ backgroundColor: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                          <span>📱</span> GPay / UPI
                        </span>
                      ) : (
                        <span className="badge" style={{ backgroundColor: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                          <span>💵</span> Cash
                        </span>
                      )}
                    </td>
                    <td style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
                      {exp.created_by_name ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                          <UserCheck size={14} style={{ color: 'var(--primary)' }} />
                          {exp.created_by_name}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td style={{ fontWeight: 800, color: '#dc2626', fontSize: '1rem', whiteSpace: 'nowrap' }}>
                      {formatCurrency(exp.amount)}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>{formatDate(exp.date)}</td>
                    <td style={{ maxWidth: '240px', color: 'var(--text-secondary)' }}>
                      <div>{exp.notes || '—'}</div>
                      {exp.receipt_reference && (
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          Ref: {exp.receipt_reference}
                        </div>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        onClick={() => handleDelete(exp.id, `${formatCurrency(exp.amount)} (${exp.category_display || exp.category})`)}
                        className="btn btn-secondary btn-sm"
                        style={{
                          padding: '4px 8px',
                          color: '#dc2626',
                          borderColor: '#fca5a5',
                          background: '#fff',
                        }}
                        title="Delete expense"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    No expenses found matching current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Easy & Fast Record Expense Modal */}
      {isModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1050,
            padding: '1rem',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsModalOpen(false);
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '520px',
              padding: '1.5rem',
              boxShadow: '0 25px 35px -5px rgba(0, 0, 0, 0.25), 0 15px 15px -5px rgba(0, 0, 0, 0.08)',
              borderRadius: '16px',
              backgroundColor: 'var(--card-bg, #ffffff)',
              border: '1px solid #e2e8f0',
              maxHeight: '92vh',
              overflowY: 'auto',
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.8rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    backgroundColor: '#fee2e2',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#dc2626',
                  }}
                >
                  <Receipt size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                    Quick Expense Entry
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>
                    Enter expense amount & category in 2 seconds
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                style={{
                  background: '#f1f5f9',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#64748b',
                  padding: '6px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={18} />
              </button>
            </div>

            {formError && (
              <div
                style={{
                  padding: '0.65rem 0.9rem',
                  backgroundColor: '#fee2e2',
                  color: '#991b1b',
                  borderRadius: '8px',
                  marginBottom: '1rem',
                  fontSize: '0.82rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <AlertCircle size={16} />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              {/* 1. Large Hero Amount Input */}
              <div style={{ marginBottom: '1.1rem' }}>
                <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: '0.35rem', letterSpacing: '0.04em' }}>
                  Expense Amount (₹) *
                </label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <span
                    style={{
                      position: 'absolute',
                      left: '14px',
                      fontSize: '1.6rem',
                      fontWeight: 900,
                      color: '#dc2626',
                      pointerEvents: 'none',
                    }}
                  >
                    ₹
                  </span>
                  <input
                    ref={amountInputRef}
                    type="number"
                    step="any"
                    min="0.01"
                    className="form-input"
                    placeholder="0"
                    style={{
                      width: '100%',
                      fontSize: '1.75rem',
                      fontWeight: 800,
                      padding: '10px 14px 10px 38px',
                      borderRadius: '12px',
                      border: '2px solid #cbd5e1',
                      color: '#0f172a',
                      backgroundColor: '#ffffff',
                    }}
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    required
                  />
                </div>

                {/* Quick Amount Suggestion Chips */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.55rem' }}>
                  {[50, 100, 200, 500, 1000, 2000].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setFormData({ ...formData, amount: String(val) })}
                      style={{
                        padding: '4px 10px',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        backgroundColor: formData.amount === String(val) ? '#fee2e2' : '#f8fafc',
                        color: formData.amount === String(val) ? '#dc2626' : '#334155',
                        border: formData.amount === String(val) ? '1px solid #f87171' : '1px solid #e2e8f0',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      ₹{val}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      const cur = parseFloat(formData.amount) || 0;
                      setFormData({ ...formData, amount: String(cur + 50) });
                    }}
                    style={{
                      padding: '4px 8px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      backgroundColor: '#f1f5f9',
                      color: '#64748b',
                      border: '1px solid #cbd5e1',
                      borderRadius: '6px',
                      cursor: 'pointer',
                    }}
                  >
                    +₹50
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const cur = parseFloat(formData.amount) || 0;
                      setFormData({ ...formData, amount: String(cur + 100) });
                    }}
                    style={{
                      padding: '4px 8px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      backgroundColor: '#f1f5f9',
                      color: '#64748b',
                      border: '1px solid #cbd5e1',
                      borderRadius: '6px',
                      cursor: 'pointer',
                    }}
                  >
                    +₹100
                  </button>
                </div>
              </div>

              {/* Payment Mode Selector: Cash vs GPay / UPI */}
              <div style={{ marginBottom: '1.1rem' }}>
                <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: '0.45rem', letterSpacing: '0.04em' }}>
                  Payment Method *
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, payment_method: 'CASH' })}
                    style={{
                      padding: '10px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      borderRadius: '10px',
                      border: formData.payment_method === 'CASH' ? '2.5px solid #dc2626' : '1.5px solid #cbd5e1',
                      backgroundColor: formData.payment_method === 'CASH' ? '#fef2f2' : '#ffffff',
                      color: formData.payment_method === 'CASH' ? '#991b1b' : '#475569',
                      fontWeight: formData.payment_method === 'CASH' ? 800 : 600,
                      fontSize: '0.92rem',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      boxShadow: formData.payment_method === 'CASH' ? '0 2px 6px rgba(220, 38, 38, 0.18)' : 'none',
                    }}
                  >
                    <span style={{ fontSize: '1.25rem' }}>💵</span>
                    <span>Cash Expense</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, payment_method: 'GPAY_UPI' })}
                    style={{
                      padding: '10px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      borderRadius: '10px',
                      border: formData.payment_method === 'GPAY_UPI' ? '2.5px solid #2563eb' : '1.5px solid #cbd5e1',
                      backgroundColor: formData.payment_method === 'GPAY_UPI' ? '#eff6ff' : '#ffffff',
                      color: formData.payment_method === 'GPAY_UPI' ? '#1d4ed8' : '#475569',
                      fontWeight: formData.payment_method === 'GPAY_UPI' ? 800 : 600,
                      fontSize: '0.92rem',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      boxShadow: formData.payment_method === 'GPAY_UPI' ? '0 2px 6px rgba(37, 99, 235, 0.18)' : 'none',
                    }}
                  >
                    <span style={{ fontSize: '1.25rem' }}>📱</span>
                    <span>GPay / UPI</span>
                  </button>
                </div>
              </div>

              {/* 2. Fast 1-Tap Category Grid */}
              <div style={{ marginBottom: '1.1rem' }}>
                <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: '0.45rem', letterSpacing: '0.04em' }}>
                  Select Category *
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.45rem' }}>
                  {[
                    { label: 'Shop / Store', icon: '🏢', value: 'SHOP_EXPENSE' },
                    { label: 'Petrol / Fuel', icon: '⛽', value: 'PETROL_FUEL' },
                    { label: 'Tea / Food', icon: '🍽️', value: 'FOOD' },
                    { label: 'Packaging', icon: '📦', value: 'RAW_MATERIAL' },
                    { label: 'Maintenance', icon: '🔧', value: 'MAINTENANCE' },
                    { label: 'Wages / Bata', icon: '💼', value: 'SALARY_WAGES' },
                    { label: 'Power / Rent', icon: '💡', value: 'UTILITY' },
                    { label: 'Other', icon: '📝', value: 'OTHER' },
                  ].map((cat) => {
                    const isSelected = formData.category === cat.value;
                    return (
                      <button
                        key={cat.value}
                        type="button"
                        onClick={() => setFormData({ ...formData, category: cat.value as DriverExpenseCategory })}
                        style={{
                          padding: '8px 4px',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '3px',
                          borderRadius: '10px',
                          border: isSelected ? '2px solid #dc2626' : '1px solid #e2e8f0',
                          backgroundColor: isSelected ? '#fef2f2' : '#ffffff',
                          color: isSelected ? '#991b1b' : '#334155',
                          cursor: 'pointer',
                          fontWeight: isSelected ? 800 : 600,
                          fontSize: '0.72rem',
                          textAlign: 'center',
                          transition: 'all 0.15s ease',
                          boxShadow: isSelected ? '0 2px 4px rgba(220, 38, 38, 0.15)' : 'none',
                        }}
                      >
                        <span style={{ fontSize: '1.15rem' }}>{cat.icon}</span>
                        <span style={{ lineHeight: 1.1 }}>{cat.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {formData.category === 'OTHER' && (
                <div style={{ marginBottom: '1rem' }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Enter Custom Category Name (e.g. Ice blocks, Covers...)"
                    style={{ width: '100%', fontSize: '0.85rem' }}
                    value={formData.custom_category}
                    onChange={(e) => setFormData({ ...formData, custom_category: e.target.value })}
                    required
                  />
                </div>
              )}

              {/* 3. Notes / What was this for? */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: '0.35rem', letterSpacing: '0.04em' }}>
                  What was this for? (Remarks)
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Tea & snacks, Delivery auto petrol, Packaging covers..."
                  style={{ width: '100%', fontSize: '0.88rem' }}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />

                {/* Quick Remark Suggestions */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.4rem' }}>
                  {[
                    'Tea & Refreshments',
                    'Delivery Van Petrol',
                    'Packing Covers / Bags',
                    'Shop Cleaning Supplies',
                  ].map((phrase) => (
                    <button
                      key={phrase}
                      type="button"
                      onClick={() => setFormData({ ...formData, notes: phrase })}
                      style={{
                        padding: '2px 8px',
                        fontSize: '0.72rem',
                        backgroundColor: '#f1f5f9',
                        color: '#475569',
                        border: '1px solid #e2e8f0',
                        borderRadius: '4px',
                        cursor: 'pointer',
                      }}
                    >
                      + {phrase}
                    </button>
                  ))}
                </div>
              </div>

              {/* 4. Collapsible Advanced Options (Date, Driver, Bill #) */}
              <div style={{ marginBottom: '1.25rem', border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.85rem',
                    backgroundColor: '#f8fafc',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    color: '#475569',
                  }}
                >
                  <span>
                    {showAdvanced ? '▲ Hide Extra Details' : '▼ More Options (Change Date, Driver, Bill Ref)'}
                  </span>
                  <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                    {formData.date === new Date().toISOString().split('T')[0] ? 'Date: Today' : `Date: ${formData.date}`}
                  </span>
                </button>

                {showAdvanced && (
                  <div style={{ padding: '0.85rem', backgroundColor: '#ffffff', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {/* Date with Today / Yesterday toggle */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569' }}>
                          Expense Date
                        </label>
                        <div style={{ display: 'flex', gap: '0.3rem' }}>
                          <button
                            type="button"
                            onClick={() => setFormData({ ...formData, date: new Date().toISOString().split('T')[0] })}
                            style={{
                              padding: '2px 6px',
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              backgroundColor: formData.date === new Date().toISOString().split('T')[0] ? '#fee2e2' : '#f1f5f9',
                              color: formData.date === new Date().toISOString().split('T')[0] ? '#dc2626' : '#475569',
                              border: '1px solid #cbd5e1',
                              borderRadius: '4px',
                              cursor: 'pointer',
                            }}
                          >
                            Today
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const y = new Date();
                              y.setDate(y.getDate() - 1);
                              setFormData({ ...formData, date: y.toISOString().split('T')[0] });
                            }}
                            style={{
                              padding: '2px 6px',
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              backgroundColor: '#f1f5f9',
                              color: '#475569',
                              border: '1px solid #cbd5e1',
                              borderRadius: '4px',
                              cursor: 'pointer',
                            }}
                          >
                            Yesterday
                          </button>
                        </div>
                      </div>
                      <input
                        type="date"
                        className="form-input"
                        style={{ width: '100%', fontSize: '0.82rem' }}
                        value={formData.date}
                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      />
                    </div>

                    {/* Driver / Shop Source */}
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '0.25rem' }}>
                        Assign to Driver (Optional)
                      </label>
                      <select
                        className="form-select"
                        style={{ width: '100%', fontSize: '0.82rem' }}
                        value={formData.driver}
                        onChange={(e) => setFormData({ ...formData, driver: e.target.value })}
                      >
                        <option value="">🏢 Shop / General Expense (Default)</option>
                        <optgroup label="Or assign to a Driver:">
                          {drivers.map((d) => (
                            <option key={d.id} value={d.id}>
                              🚗 {d.driver_name} ({d.assigned_route_details?.name || 'No Route'})
                            </option>
                          ))}
                        </optgroup>
                      </select>
                    </div>

                    {/* Receipt Ref */}
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '0.25rem' }}>
                        Bill / Receipt Reference (Optional)
                      </label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. Bill #104, Fuel receipt #42..."
                        style={{ width: '100%', fontSize: '0.82rem' }}
                        value={formData.receipt_reference}
                        onChange={(e) => setFormData({ ...formData, receipt_reference: e.target.value })}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* 5. Action Buttons */}
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsModalOpen(false)}
                  disabled={formSubmitting}
                  style={{ flex: 1, padding: '10px', fontWeight: 700 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={formSubmitting}
                  style={{
                    flex: 2,
                    padding: '10px',
                    fontWeight: 800,
                    fontSize: '0.95rem',
                    backgroundColor: '#dc2626',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                  }}
                >
                  <CheckCircle size={18} />
                  <span>
                    {formSubmitting
                      ? 'Saving...'
                      : formData.amount
                      ? `Save ₹${formData.amount} (${formData.payment_method === 'GPAY_UPI' ? 'GPay' : 'Cash'}) Expense`
                      : 'Save Expense'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
