import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { reportService } from '../../services/reportService';
import { customerService } from '../../services/customerService';
import { routeService } from '../../services/routeService';
import { productService } from '../../services/productService';
import { DashboardSummary, Customer, Route, Product } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import {
  ShoppingCart,
  Send,
  PlusCircle,
  AlertCircle,
  Receipt,
  RefreshCw,
  Store,
  CreditCard,
  Truck,
  Lock,
  Search,
  CheckCircle,
  XCircle,
  Clock,
  ArrowRight,
  Plus,
  TrendingUp,
  Activity,
  X,
  Package,
  Wallet,
  ChevronRight,
  Users,
  BarChart2,
  Zap,
} from 'lucide-react';

export const ManagerDashboard: React.FC = () => {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [routes, setRoutes] = useState<Route[]>([]);
  const navigate = useNavigate();

  // Instant Customer Search on Dashboard
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Customer[]>([]);
  const [searching, setSearching] = useState(false);

  // "+ Add Customer" Modal from Dashboard
  const [isNewCustModalOpen, setIsNewCustModalOpen] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustOwner, setNewCustOwner] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustAddress, setNewCustAddress] = useState('');
  const [newCustRoute, setNewCustRoute] = useState('');
  const [availableProducts, setAvailableProducts] = useState<Product[]>([]);
  const [newCustProductPrices, setNewCustProductPrices] = useState<Record<string, string>>({});
  const [newCustSubmitting, setNewCustSubmitting] = useState(false);
  const [newCustError, setNewCustError] = useState<string | null>(null);

  const fetchDashboardSummary = async () => {
    try {
      const summaryRes = await reportService.getDashboardSummary({ date_preset: 'today' });
      setData(summaryRes);
    } catch (err) {
      console.error('Auto-refresh failed:', err);
    }
  };

  const fetchTodayOperations = async () => {
    try {
      setLoading(true);
      const [summaryRes, routeList, prodList] = await Promise.all([
        reportService.getDashboardSummary({ date_preset: 'today' }),
        routeService.getRoutes(),
        productService.getProducts(),
      ]);
      setData(summaryRes);
      setRoutes(routeList);
      setAvailableProducts(prodList);

      const initPrices: Record<string, string> = {};
      prodList.forEach((p) => {
        initPrices[p.id] = p.unit_price;
      });
      setNewCustProductPrices(initPrices);

      if (routeList.length > 0 && !newCustRoute) {
        setNewCustRoute(routeList[0].id);
      }
    } catch (err: unknown) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTodayOperations();

    // Auto-update dashboard every 60 seconds
    const interval = setInterval(() => {
      fetchDashboardSummary();
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  // Live Customer Search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        setSearching(true);
        const res = await customerService.getCustomers(undefined, searchQuery.trim());
        setSearchResults(res.slice(0, 6));
      } catch (err) {
        console.error(err);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustName || !newCustPhone || !newCustAddress || !newCustRoute) {
      setNewCustError('Please fill in shop name, phone, address, and select a route.');
      return;
    }

    try {
      setNewCustSubmitting(true);
      setNewCustError(null);

      const product_prices = availableProducts
        .filter((p) => newCustProductPrices[p.id] !== undefined && newCustProductPrices[p.id] !== null && String(newCustProductPrices[p.id]).trim() !== '')
        .map((p) => ({
          product_id: p.id,
          price: String(newCustProductPrices[p.id]).trim(),
        }));

      const created = await customerService.createCustomer({
        name: newCustName,
        owner_name: newCustOwner,
        phone: newCustPhone,
        address: newCustAddress,
        route: newCustRoute,
        product_prices: product_prices.length > 0 ? product_prices : undefined,
      });
      setIsNewCustModalOpen(false);
      setNewCustName('');
      setNewCustOwner('');
      setNewCustPhone('');
      setNewCustAddress('');
      const resetPrices: Record<string, string> = {};
      availableProducts.forEach((p) => {
        resetPrices[p.id] = p.unit_price;
      });
      setNewCustProductPrices(resetPrices);

      navigate('/manager/create-order', { state: { repeatCustomerId: created.id } });
    } catch (err: unknown) {
      if (err instanceof Error) setNewCustError(err.message);
      else setNewCustError('Failed to create customer');
    } finally {
      setNewCustSubmitting(false);
    }
  };

  const todayStr = data?.date || new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div style={{ minHeight: '100%' }}>

      {/* ═══════════════════════════════════════════════════
          HERO HEADER — Enterprise header with date + quick CTA
      ═══════════════════════════════════════════════════ */}
      <div
        style={{
          background: '#7f1d1d',
          borderRadius: '6px',
          padding: '1.25rem 1.5rem',
          marginBottom: '1.25rem',
          border: '1px solid #991b1b',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem' }}>
              <div style={{
                width: '32px', height: '32px', borderRadius: '4px',
                background: 'rgba(255,255,255,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem',
              }}>
                🏪
              </div>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff', margin: 0, letterSpacing: '-0.01em' }}>
                  Daily Operations
                </h2>
                <span style={{ fontSize: '0.75rem', color: '#fca5a5', fontWeight: 600 }}>
                  Manager Control Centre
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)',
                padding: '0.15rem 0.5rem', borderRadius: '4px',
                fontSize: '0.72rem', fontWeight: 700, color: '#ffffff',
              }}>
                <span style={{
                  width: '6px', height: '6px', borderRadius: '50%',
                  background: '#4ade80',
                  display: 'inline-block',
                }} />
                {todayStr}
              </span>
              {!loading && (
                <span style={{
                  fontSize: '0.72rem', color: '#fca5a5', fontWeight: 600,
                }}>
                  {data?.today_orders_count || 0} orders today
                </span>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center' }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => fetchTodayOperations()}
              disabled={loading}
              style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.25)', color: '#fff' }}
            >
              <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
              <span>Refresh</span>
            </button>
            <button
              className="btn"
              onClick={() => navigate('/manager/create-order')}
              style={{
                background: '#ffffff', color: '#7f1d1d', fontWeight: 800,
                border: '1px solid #cbd5e1', boxShadow: 'var(--shadow-sm)',
                display: 'flex', alignItems: 'center', gap: '0.45rem',
              }}
            >
              <PlusCircle size={16} />
              <span>New Order</span>
            </button>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════
          QUICK ACTIONS GRID
      ═══════════════════════════════════════════════════ */}
      <div style={{ marginBottom: '1.25rem' }}>
        <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Zap size={12} />
          Quick Access
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.5rem' }}>
          {[
            { label: 'New Order', icon: <PlusCircle size={17} />, onClick: () => navigate('/manager/create-order'), color: '#b91c1c', bg: '#ffffff', border: '#cbd5e1' },
            { label: 'New Customer', icon: <Plus size={17} />, onClick: () => setIsNewCustModalOpen(true), color: '#475569', bg: '#ffffff', border: '#cbd5e1' },
            { label: "Today's Orders", icon: <ShoppingCart size={17} />, onClick: () => navigate('/manager/orders'), color: '#0369a1', bg: '#ffffff', border: '#cbd5e1' },
            { label: 'Deliveries', icon: <Send size={17} />, onClick: () => navigate('/manager/deliveries'), color: '#15803d', bg: '#ffffff', border: '#cbd5e1' },
            { label: 'Payments', icon: <CreditCard size={17} />, onClick: () => navigate('/manager/payments'), color: '#b45309', bg: '#ffffff', border: '#cbd5e1' },
            { label: 'Customers', icon: <Users size={17} />, onClick: () => navigate('/manager/customers'), color: '#0f766e', bg: '#ffffff', border: '#cbd5e1' },
            { label: 'Expenses', icon: <Receipt size={17} />, onClick: () => navigate('/manager/expenses'), color: '#b91c1c', bg: '#ffffff', border: '#cbd5e1' },
            { label: 'Daily Closing', icon: <Lock size={17} />, onClick: () => navigate('/manager/daily-closing'), color: '#78350f', bg: '#ffffff', border: '#cbd5e1' },
          ].map((action) => (
            <button
              key={action.label}
              onClick={action.onClick}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: '0.4rem', padding: '0.65rem 0.5rem',
                background: action.bg, border: `1px solid ${action.border}`,
                borderRadius: '6px', cursor: 'pointer',
                color: action.color, fontWeight: 700, fontSize: '0.76rem',
                transition: 'background 0.15s ease, border-color 0.15s ease', textAlign: 'center', lineHeight: 1.25,
                boxShadow: 'var(--shadow-sm)',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#94a3b8'; (e.currentTarget as HTMLButtonElement).style.background = '#f8fafc'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = action.border; (e.currentTarget as HTMLButtonElement).style.background = action.bg; }}
            >
              {action.icon}
              <span>{action.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════
          INSTANT SHOP SEARCH
      ═══════════════════════════════════════════════════ */}
      <div
        className="card"
        style={{
          padding: '1rem 1.15rem', marginBottom: '1.5rem',
          border: '1.5px solid var(--border)', background: 'var(--bg-card)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: searchResults.length > 0 || searching ? '0.85rem' : 0 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
            <input
              type="text"
              className="form-input"
              style={{ paddingLeft: '2.35rem', paddingRight: searchQuery ? '2.5rem' : '0.75rem', fontSize: '0.9rem', width: '100%' }}
              placeholder="Search shop by name, phone, or route..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute', right: '0.6rem', top: '50%', transform: 'translateY(-50%)',
                  background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: '20px', height: '20px',
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>
          {searching && (
            <div style={{ width: '18px', height: '18px', border: '2px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
          )}
        </div>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
            {searchResults.map((cust) => (
              <div
                key={cust.id}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '0.7rem 0.9rem', background: '#fafafa',
                  borderRadius: '10px', border: '1px solid var(--border)',
                  flexWrap: 'wrap', gap: '0.5rem',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = '#f1f5f9'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = '#fafafa'; }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Store size={14} color="var(--primary)" style={{ flexShrink: 0 }} />
                    <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cust.name}</strong>
                  </div>
                  <span style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', marginLeft: '1.3rem' }}>
                    {cust.route_details?.name} • {cust.phone}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
                  <span style={{
                    fontSize: '0.82rem', fontWeight: 800,
                    color: cust.is_credit_exceeded ? 'var(--danger)' : 'var(--text-secondary)',
                    background: cust.is_credit_exceeded ? '#fef2f2' : '#f1f5f9',
                    padding: '0.15rem 0.5rem', borderRadius: '6px',
                  }}>
                    {formatCurrency(cust.current_balance)}
                  </span>
                  <button
                    className="btn btn-primary btn-sm"
                    style={{ fontSize: '0.78rem', padding: '0.25rem 0.7rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                    onClick={() => navigate('/manager/create-order', { state: { repeatCustomerId: cust.id } })}
                  >
                    Bill Shop
                    <ChevronRight size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {searchQuery.trim() && !searching && searchResults.length === 0 && (
          <div style={{ textAlign: 'center', padding: '0.75rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            No shops found for "{searchQuery}"
          </div>
        )}

        {!searchQuery && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', fontSize: '0.78rem', paddingLeft: '0.15rem' }}>
            <Search size={12} />
            <span>Type shop name to instantly search and bill from any route</span>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════
          KPI STAT CARDS — 9 Operational Metrics
      ═══════════════════════════════════════════════════ */}
      {loading && !data ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem 0', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
          <div
            style={{
              width: '42px', height: '42px',
              border: '3px solid var(--border)',
              borderTopColor: 'var(--primary)',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }}
          />
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Loading today's operations…</span>
        </div>
      ) : (
        <>
          <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <BarChart2 size={12} />
            Live Operational KPIs
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(195px, 1fr))', gap: '0.85rem', marginBottom: '1.75rem' }}>

            {/* 1. Today's Orders */}
            <div
              className="card"
              style={{ padding: '1.2rem', borderLeft: '4px solid var(--primary)', cursor: 'pointer' }}
              onClick={() => navigate('/manager/orders')}
              title="Click to view today's orders"
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Today's Orders</span>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#fef2f2', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ShoppingCart size={16} />
                </div>
              </div>
              <p style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--text-primary)', margin: '0 0 0.15rem', lineHeight: 1 }}>
                {data?.today_orders_count || 0}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                <Activity size={11} />
                <span>Confirmed & dispatched today</span>
              </div>
            </div>

            {/* 2. Today's Sales */}
            <div className="card" style={{ padding: '1.2rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Today's Sales</span>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#fef2f2', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <TrendingUp size={16} />
                </div>
              </div>
              <p style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--primary)', margin: '0 0 0.15rem', lineHeight: 1 }}>
                {formatCurrency(data?.today_sales || '0.00')}
              </p>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Total gross order value</span>
            </div>

            {/* 3. Today's Collection */}
            <div className="card" style={{ padding: '1.2rem', borderLeft: '4px solid #059669' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Today's Collection</span>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#f0fdf4', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Wallet size={16} />
                </div>
              </div>
              <p style={{ fontSize: '1.75rem', fontWeight: 900, color: '#059669', margin: '0 0 0.15rem', lineHeight: 1 }}>
                {formatCurrency(data?.total_collected || '0.00')}
              </p>
              <div style={{ display: 'flex', gap: '0.6rem', fontSize: '0.72rem', marginTop: '0.1rem' }}>
                <span style={{ color: '#059669', fontWeight: 700 }}>💵 Cash: {formatCurrency(data?.cash_collected || '0.00')}</span>
                <span style={{ color: 'var(--primary)', fontWeight: 700 }}>📱 UPI: {formatCurrency(data?.upi_collected || '0.00')}</span>
              </div>
            </div>

            {/* 4. Today's Credit */}
            <div className="card" style={{ padding: '1.2rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Today's Credit</span>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#fffbeb', color: '#b45309', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CreditCard size={16} />
                </div>
              </div>
              <p style={{ fontSize: '1.75rem', fontWeight: 900, color: '#b45309', margin: '0 0 0.15rem', lineHeight: 1 }}>
                {formatCurrency(data?.today_credit || '0.00')}
              </p>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Extended credit today</span>
            </div>

            {/* 5. Pending Deliveries */}
            <div
              className="card"
              style={{ padding: '1.2rem', borderLeft: '4px solid #f59e0b', cursor: 'pointer' }}
              onClick={() => navigate('/manager/deliveries')}
              title="Click to view delivery board"
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Pending Deliveries</span>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#fffbeb', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Clock size={16} />
                </div>
              </div>
              <p style={{ fontSize: '2rem', fontWeight: 900, color: '#d97706', margin: '0 0 0.15rem', lineHeight: 1 }}>
                {data?.pending_deliveries || 0}
              </p>
              <span style={{ fontSize: '0.72rem', color: '#b45309', fontWeight: 600 }}>View live delivery board →</span>
            </div>

            {/* 6. Delivered */}
            <div className="card" style={{ padding: '1.2rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Delivered</span>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#f0fdf4', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CheckCircle size={16} />
                </div>
              </div>
              <p style={{ fontSize: '2rem', fontWeight: 900, color: '#059669', margin: '0 0 0.15rem', lineHeight: 1 }}>
                {data?.completed_deliveries || 0}
              </p>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Acknowledged at shops</span>
            </div>

            {/* 7. Not Delivered */}
            <div
              className="card"
              style={{
                padding: '1.2rem',
                borderLeft: (data?.not_delivered_count || 0) > 0 ? '4px solid #dc2626' : undefined,
                background: (data?.not_delivered_count || 0) > 0 ? '#fef2f2' : 'var(--bg-card)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: (data?.not_delivered_count || 0) > 0 ? '#dc2626' : 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Not Delivered
                </span>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: (data?.not_delivered_count || 0) > 0 ? '#fee2e2' : '#f1f5f9', color: (data?.not_delivered_count || 0) > 0 ? '#dc2626' : 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <XCircle size={16} />
                </div>
              </div>
              <p style={{ fontSize: '2rem', fontWeight: 900, color: (data?.not_delivered_count || 0) > 0 ? '#dc2626' : 'var(--text-primary)', margin: '0 0 0.15rem', lineHeight: 1 }}>
                {data?.not_delivered_count || 0}
              </p>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Shop closed / refused</span>
            </div>

            {/* 8. Expenses */}
            <div className="card" style={{ padding: '1.2rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Total Expenses</span>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#fef2f2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Receipt size={16} />
                </div>
              </div>
              <p style={{ fontSize: '1.75rem', fontWeight: 900, color: '#dc2626', margin: '0 0 0.15rem', lineHeight: 1 }}>
                {formatCurrency(data?.today_expenses || '0.00')}
              </p>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Shop, maintenance & route costs</span>
            </div>

            {/* 9. Total Outstanding */}
            <div className="card" style={{ padding: '1.2rem', borderLeft: '4px solid #7c3aed', background: '#faf5ff' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#6b21a8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Customer Outstanding</span>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#ede9fe', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Store size={16} />
                </div>
              </div>
              <p style={{ fontSize: '1.75rem', fontWeight: 900, color: '#6b21a8', margin: '0 0 0.15rem', lineHeight: 1 }}>
                {formatCurrency(data?.total_receivable || '0.00')}
              </p>
              <span style={{ fontSize: '0.72rem', color: '#581c87' }}>Total market receivables</span>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════
              ROUTE BREAKDOWN TABLE
          ═══════════════════════════════════════════════════ */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Truck size={18} color="var(--primary)" />
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                Route Operational Breakdown
              </h3>
            </div>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => navigate('/manager/deliveries')}
              style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem' }}
            >
              <span>Live Delivery Board</span>
              <ArrowRight size={13} />
            </button>
          </div>

          <div className="table-container" style={{ marginBottom: '2rem', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border)', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <table className="data-table" style={{ margin: 0 }}>
              <thead>
                <tr style={{ background: 'var(--primary)' }}>
                  <th style={{ color: '#fff', fontWeight: 700, fontSize: '0.78rem' }}>Route</th>
                  <th style={{ color: '#fca5a5', fontWeight: 700, fontSize: '0.78rem' }}>Shops</th>
                  <th style={{ color: '#fca5a5', fontWeight: 700, fontSize: '0.78rem' }}>Orders</th>
                  <th style={{ color: '#fca5a5', fontWeight: 700, fontSize: '0.78rem' }}>Sales</th>
                  <th style={{ color: '#fca5a5', fontWeight: 700, fontSize: '0.78rem' }}>Deliveries</th>
                  <th style={{ color: '#fca5a5', fontWeight: 700, fontSize: '0.78rem' }}>Collections</th>
                  <th style={{ color: '#fca5a5', fontWeight: 700, fontSize: '0.78rem' }}>Expenses</th>
                  <th style={{ color: '#fef08a', fontWeight: 800, fontSize: '0.78rem' }}>Net Handover</th>
                </tr>
              </thead>
              <tbody>
                {data?.route_breakdown && data.route_breakdown.length > 0 ? (
                  data.route_breakdown.map((r, idx) => (
                    <tr
                      key={r.route_id}
                      style={{ background: idx % 2 === 0 ? 'var(--bg-card)' : '#fafafa' }}
                    >
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary)', flexShrink: 0 }} />
                          <span style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '0.88rem' }}>{r.route_name}</span>
                        </div>
                      </td>
                      <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{r.shops_count}</td>
                      <td>
                        <span style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '0.88rem' }}>{r.today_orders_count}</span>
                      </td>
                      <td style={{ fontWeight: 800, color: 'var(--primary)', fontSize: '0.88rem' }}>{formatCurrency(r.today_sales)}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                          <span style={{ color: '#059669', fontWeight: 700, fontSize: '0.8rem' }}>✓ {r.completed_deliveries || 0}</span>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>/</span>
                          <span style={{ color: '#b45309', fontWeight: 600, fontSize: '0.8rem' }}>{(r.total_deliveries || 0) - (r.completed_deliveries || 0)} pending</span>
                        </div>
                      </td>
                      <td style={{ color: '#059669', fontWeight: 800, fontSize: '0.88rem' }}>{formatCurrency(r.today_collected)}</td>
                      <td style={{ color: '#dc2626', fontWeight: 700, fontSize: '0.85rem' }}>{formatCurrency(r.today_expenses || '0.00')}</td>
                      <td>
                        <span style={{
                          background: '#fef3c7', color: '#78350f', fontWeight: 900,
                          fontSize: '0.9rem', padding: '0.2rem 0.5rem', borderRadius: '6px',
                        }}>
                          {formatCurrency(r.net_collected || '0.00')}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                        <Package size={28} color="var(--text-muted)" />
                        <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>No route activity today yet.</span>
                        <span style={{ fontSize: '0.8rem' }}>Use "+ New Order" to start today's deliveries.</span>
                        <button
                          className="btn btn-primary btn-sm"
                          style={{ marginTop: '0.5rem' }}
                          onClick={() => navigate('/manager/create-order')}
                        >
                          <PlusCircle size={14} />
                          New Order
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ═══════════════════════════════════════════════════
          "+ Add New Customer" MODAL
      ═══════════════════════════════════════════════════ */}
      {isNewCustModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '540px', borderRadius: '8px', overflow: 'hidden', padding: 0 }}>
            {/* Modal Header */}
            <div style={{
              background: '#7f1d1d',
              padding: '1rem 1.25rem',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '4px', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Store size={16} color="#fff" />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#fff', margin: 0 }}>Add New Customer Shop</h3>
                    <span style={{ fontSize: '0.72rem', color: '#fca5a5' }}>Set up shop & open billing in one step</span>
                  </div>
                </div>
                <button
                  onClick={() => setIsNewCustModalOpen(false)}
                  style={{
                    width: '28px', height: '28px', borderRadius: '4px',
                    background: 'rgba(255,255,255,0.15)', border: 'none', cursor: 'pointer',
                    color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div style={{ padding: '1.5rem' }}>
              {newCustError && (
                <div style={{
                  background: '#fef2f2', color: '#dc2626', padding: '0.75rem 1rem',
                  borderRadius: '10px', marginBottom: '1.1rem', fontSize: '0.85rem',
                  border: '1px solid #fecaca', display: 'flex', alignItems: 'center', gap: '0.5rem',
                }}>
                  <AlertCircle size={16} />
                  {newCustError}
                </div>
              )}

              <form onSubmit={handleCreateCustomer}>
                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label className="form-label">Shop Name *</label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    placeholder="e.g. Al-Madina Supermarket"
                    value={newCustName}
                    onChange={(e) => setNewCustName(e.target.value)}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Proprietor Name</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Owner name"
                      value={newCustOwner}
                      onChange={(e) => setNewCustOwner(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Phone Number *</label>
                    <input
                      type="tel"
                      required
                      className="form-input"
                      placeholder="10-digit mobile"
                      value={newCustPhone}
                      onChange={(e) => setNewCustPhone(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label className="form-label">Address / Landmark *</label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    placeholder="Street, town, location"
                    value={newCustAddress}
                    onChange={(e) => setNewCustAddress(e.target.value)}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label className="form-label">Delivery Route *</label>
                  <select
                    className="form-select"
                    value={newCustRoute}
                    onChange={(e) => setNewCustRoute(e.target.value)}
                    required
                  >
                    {routes.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Wholesale Product Pricing */}
                {availableProducts.length > 0 && (
                  <div style={{
                    background: '#f8fafc', border: '1px solid #e2e8f0',
                    borderRadius: '12px', padding: '0.9rem', marginBottom: '1.25rem',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
                      <Package size={14} color="var(--primary)" />
                      <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                        Wholesale Pricing (₹ per unit)
                      </span>
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.65rem' }}>
                      Defaults to standard price. Override as needed.
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.6rem' }}>
                      {availableProducts.map((p) => (
                        <div key={p.id} style={{ background: '#fff', padding: '0.6rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                          <div style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text-primary)' }}>{p.name}</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                            Standard: ₹{Number(p.unit_price).toFixed(2)}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                            <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--primary)' }}>₹</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              className="form-input"
                              style={{ padding: '0.28rem 0.45rem', fontSize: '0.88rem', fontWeight: 700 }}
                              value={newCustProductPrices[p.id] ?? p.unit_price}
                              onChange={(e) => setNewCustProductPrices({ ...newCustProductPrices, [p.id]: e.target.value })}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setIsNewCustModalOpen(false)}
                    disabled={newCustSubmitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={newCustSubmitting}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: '160px', justifyContent: 'center' }}
                  >
                    {newCustSubmitting ? (
                      <>
                        <div style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                        <span>Creating…</span>
                      </>
                    ) : (
                      <>
                        <Store size={15} />
                        <span>Save & Open Billing</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
