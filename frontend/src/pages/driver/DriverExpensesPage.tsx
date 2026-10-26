import React, { useEffect, useState } from 'react';
import { expenseService } from '../../services/expenseService';
import { DriverExpense, DriverExpenseCategory, DriverExpenseSummary } from '../../types';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { Plus, Wallet, Fuel, Utensils, ParkingCircle, Landmark, Wrench, FileText, Trash2, X, AlertCircle } from 'lucide-react';

const CATEGORIES: { label: string; value: DriverExpenseCategory; icon: React.FC<{ size?: number }> }[] = [
  { label: 'Petrol / Fuel', value: 'PETROL', icon: Fuel },
  { label: 'Food / Meals', value: 'FOOD', icon: Utensils },
  { label: 'Parking', value: 'PARKING', icon: ParkingCircle },
  { label: 'Toll Gate', value: 'TOLL', icon: Landmark },
  { label: 'Vehicle Maintenance', value: 'MAINTENANCE', icon: Wrench },
  { label: 'Other', value: 'OTHER', icon: FileText },
];

export const DriverExpensesPage: React.FC = () => {
  const [expenses, setExpenses] = useState<DriverExpense[]>([]);
  const [summary, setSummary] = useState<DriverExpenseSummary | null>(null);
  const [loading, setLoading] = useState(true);

  // Add Expense Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [category, setCategory] = useState<DriverExpenseCategory>('PETROL');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchExpenses = async () => {
    try {
      setLoading(true);
      const [list, sum] = await Promise.all([
        expenseService.getExpenses(),
        expenseService.getExpenseSummary(),
      ]);
      setExpenses(list);
      setSummary(sum);
    } catch (err: unknown) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, []);

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Please enter a valid expense amount greater than 0.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await expenseService.createExpense({
        category,
        amount: parsedAmount.toFixed(2),
        date,
        notes: notes || undefined,
      });
      setIsModalOpen(false);
      setAmount('');
      setNotes('');
      fetchExpenses();
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
      else setError('Failed to record expense.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteExpense = async (id: string) => {
    if (!window.confirm('Are you sure you want to remove this expense entry?')) return;
    try {
      await expenseService.deleteExpense(id);
      fetchExpenses();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete expense.');
    }
  };

  const getCategoryIcon = (cat: DriverExpenseCategory) => {
    const item = CATEGORIES.find((c) => c.value === cat);
    const IconComponent = item?.icon || FileText;
    return <IconComponent size={18} />;
  };

  return (
    <div>
      {/* Header with + Add Expense */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--text-primary)' }}>
            My Expenses
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
            Fuel, food, parking, tolls, and route vehicle maintenance.
          </p>
        </div>
        <button
          className="btn btn-primary"
          style={{ padding: '0.65rem 0.95rem', fontSize: '0.85rem', fontWeight: 700 }}
          onClick={() => setIsModalOpen(true)}
        >
          <Plus size={16} />
          <span>+ Add Expense</span>
        </button>
      </div>

      {/* Summary KPI Cards: Today's expenses, Recent expenses, Total (Prompt 9) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginBottom: '1.25rem' }}>
        <div style={{ background: 'var(--surface)', padding: '0.85rem 0.6rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', textAlign: 'center' }}>
          <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', display: 'block' }}>
            TODAY
          </span>
          <p style={{ fontSize: '1.15rem', fontWeight: 900, color: 'var(--primary)', margin: '0.15rem 0 0' }}>
            {formatCurrency(summary?.today_total || '0.00')}
          </p>
        </div>

        <div style={{ background: 'var(--surface)', padding: '0.85rem 0.6rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', textAlign: 'center' }}>
          <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', display: 'block' }}>
            RECENT (WEEK)
          </span>
          <p style={{ fontSize: '1.15rem', fontWeight: 900, color: 'var(--text-primary)', margin: '0.15rem 0 0' }}>
            {formatCurrency(summary?.week_total || '0.00')}
          </p>
        </div>

        <div style={{ background: 'var(--surface)', padding: '0.85rem 0.6rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', textAlign: 'center' }}>
          <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', display: 'block' }}>
            TOTAL
          </span>
          <p style={{ fontSize: '1.15rem', fontWeight: 900, color: '#059669', margin: '0.15rem 0 0' }}>
            {formatCurrency(summary?.month_total || summary?.week_total || '0.00')}
          </p>
        </div>
      </div>

      {/* Quick Add Category Chips */}
      <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          return (
            <button
              key={cat.value}
              type="button"
              className="btn btn-secondary"
              style={{
                whiteSpace: 'nowrap',
                fontSize: '0.78rem',
                padding: '0.45rem 0.75rem',
                borderRadius: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
              onClick={() => {
                setCategory(cat.value);
                setIsModalOpen(true);
              }}
            >
              <Icon size={14} />
              <span>+{cat.label.split('/')[0].trim()}</span>
            </button>
          );
        })}
      </div>

      {/* Expense History List */}
      <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
        Recent Logged Expenses ({expenses.length})
      </h3>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
          <div className="spinner" />
        </div>
      ) : expenses.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {expenses.map((exp) => (
            <div
              key={exp.id}
              style={{
                background: 'white',
                padding: '0.9rem 1rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: '10px',
                    background: 'var(--primary-light)',
                    color: 'var(--primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {getCategoryIcon(exp.category)}
                </div>
                <div>
                  <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)', display: 'block' }}>
                    {exp.category_display}
                  </strong>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {formatDate(exp.date)} {exp.notes && `• ${exp.notes}`}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <strong style={{ fontSize: '1.05rem', color: 'var(--primary)' }}>
                  {formatCurrency(exp.amount)}
                </strong>
                <button
                  type="button"
                  onClick={() => handleDeleteExpense(exp.id)}
                  title="Remove expense"
                  style={{ color: 'var(--text-muted)', padding: '0.25rem' }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ background: 'white', padding: '2.5rem 1rem', textAlign: 'center', borderRadius: 'var(--radius-md)', color: 'var(--text-muted)' }}>
          <Wallet size={36} style={{ margin: '0 auto 0.5rem', opacity: 0.4 }} />
          <p style={{ fontSize: '0.88rem' }}>No expenses recorded yet.</p>
        </div>
      )}

      {/* Add Expense Modal */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '420px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>+ Log Route Expense</h3>
              <button onClick={() => setIsModalOpen(false)}>
                <X size={20} />
              </button>
            </div>

            {error && (
              <div style={{ background: 'var(--danger-bg)', color: 'var(--danger)', padding: '0.75rem', borderRadius: 'var(--radius-md)', marginBottom: '1rem', fontSize: '0.85rem' }}>
                {error}
              </div>
            )}

            <form onSubmit={handleCreateExpense}>
              <div className="form-group">
                <label className="form-label">Expense Category *</label>
                <select
                  className="form-select"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as DriverExpenseCategory)}
                  required
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Amount (₹) *</label>
                <input
                  type="number"
                  step="1"
                  min="1"
                  className="form-input"
                  style={{ fontSize: '1.2rem', fontWeight: 700 }}
                  placeholder="e.g. 500"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label className="form-label">Date *</label>
                <input
                  type="date"
                  className="form-input"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Optional Note / Remark</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. 5L petrol at Pandikkad pump"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setIsModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={submitting}>
                  {submitting ? 'Saving...' : 'Save Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
