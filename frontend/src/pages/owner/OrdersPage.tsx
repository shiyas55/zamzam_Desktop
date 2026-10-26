import React, { useEffect, useState, useMemo } from 'react';
import { orderService } from '../../services/orderService';
import { routeService } from '../../services/routeService';
import { Order, Route } from '../../types';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { apiClient } from '../../services/apiClient';
import {
  Search,
  Eye,
  FileText,
  MessageSquare,
  Edit,
  Trash2,
  Calendar,
  RefreshCw,
  X,
  AlertCircle,
  CheckCircle2,
  Store,
  Filter,
} from 'lucide-react';
import { InvoiceModal } from '../../components/InvoiceModal';
import { UniversalDatePicker } from '../../components/UniversalDatePicker';
import { EditOrderModal } from '../../components/EditOrderModal';
import { openWhatsApp, generateInvoiceMessage } from '../../utils/whatsappUtils';
import { useSettings } from '../../context/SettingsContext';

export const OrdersPage: React.FC = () => {
  const { isWhatsAppEnabled } = useSettings();
  const [orders, setOrders] = useState<Order[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [selectedRoute, setSelectedRoute] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedSource, setSelectedSource] = useState('');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [searchShopQuery, setSearchShopQuery] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [invoiceOrder, setInvoiceOrder] = useState<Order | null>(null);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [deletingOrderId, setDeletingOrderId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Load routes once on initial mount
  useEffect(() => {
    routeService.getRoutes().then(setRoutes).catch(console.error);
  }, []);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const orderList = await orderService.getOrders({
        route: selectedRoute || undefined,
        status: selectedStatus || undefined,
        date: selectedDate || undefined,
      });
      setOrders(orderList);
    } catch (err: unknown) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [selectedRoute, selectedStatus, selectedDate]);

  // Quick date selector helper
  const setQuickDate = (type: 'today' | 'yesterday' | 'all') => {
    if (type === 'all') {
      setSelectedDate('');
      return;
    }
    const d = new Date();
    if (type === 'yesterday') {
      d.setDate(d.getDate() - 1);
    }
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    setSelectedDate(`${year}-${month}-${day}`);
  };

  // Delete / Clear order handler
  const handleDeleteOrder = async (order: Order) => {
    const shopName = order.customer_details?.name || 'Customer';
    const amountStr = formatCurrency(order.total_amount);
    const confirmed = window.confirm(
      `Are you sure you want to delete / clear Order #${order.order_number} for "${shopName}" (${amountStr})?\n\nThis will permanently delete this order from the database.`
    );
    if (!confirmed) return;

    try {
      setDeletingOrderId(order.id);
      await orderService.deleteOrder(order.id);
      setNotification({
        type: 'success',
        message: `Order #${order.order_number} for ${shopName} has been permanently deleted.`,
      });
      await fetchOrders();
    } catch (err: any) {
      console.error('Failed to delete order:', err);
      const errMsg =
        err?.response?.data?.detail || err?.response?.data?.error || err?.message || 'Failed to delete order.';
      setNotification({
        type: 'error',
        message: `Could not delete order: ${errMsg}`,
      });
    } finally {
      setDeletingOrderId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DELIVERED':
        return <span className="badge badge-success">Delivered</span>;
      case 'OUT_FOR_DELIVERY':
      case 'DELIVERY_CREATED':
        return <span className="badge badge-warning">Out for Delivery</span>;
      case 'SUBMITTED':
        return <span className="badge badge-info">Submitted</span>;
      case 'CONFIRMED':
        return <span className="badge badge-info">Confirmed</span>;
      case 'LOCKED':
        return <span className="badge badge-primary">Locked</span>;
      case 'CANCELLED':
        return <span className="badge badge-danger">Cancelled</span>;
      default:
        return <span className="badge badge-neutral">{status}</span>;
    }
  };

  // Client-side search and source filter
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (selectedSource && o.source !== selectedSource) return false;
      if (searchShopQuery.trim()) {
        const q = searchShopQuery.toLowerCase().trim();
        const matchesShop = (o.customer_details?.name || '').toLowerCase().includes(q);
        const matchesOwner = (o.customer_details?.owner_name || '').toLowerCase().includes(q);
        const matchesPhone = Boolean(o.customer_details?.phone && o.customer_details.phone.includes(q));
        const matchesOrderNum = (o.order_number || '').toLowerCase().includes(q);
        const matchesDriver = (o.driver_name || '').toLowerCase().includes(q);
        if (!matchesShop && !matchesOwner && !matchesPhone && !matchesOrderNum && !matchesDriver) {
          return false;
        }
      }
      return true;
    });
  }, [orders, selectedSource, searchShopQuery]);

  const totalFilteredValue = useMemo(() => {
    return filteredOrders.reduce((sum, o) => sum + (parseFloat(o.total_amount) || 0), 0);
  }, [filteredOrders]);

  const hasActiveFilters = Boolean(
    selectedRoute || selectedStatus || selectedSource || selectedDate || searchShopQuery
  );

  const clearAllFilters = () => {
    setSelectedRoute('');
    setSelectedStatus('');
    setSelectedSource('');
    setSelectedDate('');
    setSearchShopQuery('');
  };

  return (
    <div>
      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '1.25rem',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            Sales Orders & Dispatches
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', margin: '0.25rem 0 0 0' }}>
            Batch orders for Kubbus and Romali rotis across delivery routes.
          </p>
        </div>

        {/* Quick Summary KPIs */}
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <div
            style={{
              padding: '0.45rem 0.85rem',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '6px',
              fontSize: '0.82rem',
              fontWeight: 600,
              color: '#334155',
            }}
          >
            Orders: <strong style={{ color: '#0f172a' }}>{filteredOrders.length}</strong>
          </div>
          <div
            style={{
              padding: '0.45rem 0.85rem',
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              borderRadius: '6px',
              fontSize: '0.82rem',
              fontWeight: 600,
              color: '#1d4ed8',
            }}
          >
            Total: <strong>{formatCurrency(totalFilteredValue)}</strong>
          </div>
        </div>
      </div>

      {/* Notification Toast */}
      {notification && (
        <div
          className={`alert ${notification.type === 'success' ? 'alert-success' : 'alert-error'}`}
          style={{
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.86rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {notification.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{notification.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotification(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Filter Bar */}
      <div
        className="card"
        style={{
          display: 'flex',
          gap: '0.65rem',
          marginBottom: '1.25rem',
          padding: '0.75rem 1rem',
          flexWrap: 'wrap',
          alignItems: 'center',
          background: 'var(--bg-card)',
        }}
      >
        {/* Date Selector */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
          <UniversalDatePicker
            value={selectedDate}
            onChange={(d) => setSelectedDate(d)}
            style={{ width: '135px', height: '34px' }}
            title="Select specific order date (DD/MM/YYYY) to filter"
          />
          <div style={{ display: 'inline-flex', gap: '0.2rem' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{
                height: '34px',
                padding: '0 0.55rem',
                fontSize: '0.78rem',
                fontWeight: selectedDate === new Date().toISOString().split('T')[0] ? 700 : 500,
                background: selectedDate === new Date().toISOString().split('T')[0] ? '#eff6ff' : undefined,
                borderColor: selectedDate === new Date().toISOString().split('T')[0] ? '#93c5fd' : undefined,
                color: selectedDate === new Date().toISOString().split('T')[0] ? '#1d4ed8' : undefined,
              }}
              onClick={() => setQuickDate('today')}
              title="Show orders for today"
            >
              Today
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ height: '34px', padding: '0 0.55rem', fontSize: '0.78rem' }}
              onClick={() => setQuickDate('yesterday')}
              title="Show orders for yesterday"
            >
              Yesterday
            </button>
            {selectedDate && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ height: '34px', padding: '0 0.55rem', fontSize: '0.78rem', color: '#64748b' }}
                onClick={() => setQuickDate('all')}
                title="View all dates"
              >
                All Dates
              </button>
            )}
          </div>
        </div>

        {/* Shop Name / Search Query */}
        <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', minWidth: '200px' }}>
          <Search size={14} style={{ position: 'absolute', left: '8px', color: '#64748b', pointerEvents: 'none' }} />
          <input
            type="text"
            className="form-input"
            style={{ width: '100%', height: '34px', paddingLeft: '1.75rem', paddingRight: searchShopQuery ? '1.75rem' : '0.65rem', fontSize: '0.82rem' }}
            placeholder="Search shop, owner, ord#..."
            value={searchShopQuery}
            onChange={(e) => setSearchShopQuery(e.target.value)}
          />
          {searchShopQuery && (
            <button
              type="button"
              onClick={() => setSearchShopQuery('')}
              style={{
                position: 'absolute',
                right: '6px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#94a3b8',
                padding: '2px',
                display: 'inline-flex',
              }}
              title="Clear search"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Route Select */}
        <select
          className="form-select"
          style={{ width: '180px', height: '34px', fontSize: '0.82rem' }}
          value={selectedRoute}
          onChange={(e) => setSelectedRoute(e.target.value)}
        >
          <option value="">All Delivery Routes</option>
          {routes.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>

        {/* Status Select */}
        <select
          className="form-select"
          style={{ width: '150px', height: '34px', fontSize: '0.82rem' }}
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
        >
          <option value="">All Statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="PENDING">Pending</option>
          <option value="SUBMITTED">Submitted</option>
          <option value="LOCKED">Locked</option>
          <option value="CONFIRMED">Confirmed</option>
          <option value="DELIVERY_CREATED">Delivery Created</option>
          <option value="DELIVERED">Delivered</option>
          <option value="CANCELLED">Cancelled</option>
        </select>

        {/* Source Select */}
        <select
          className="form-select"
          style={{ width: '175px', height: '34px', fontSize: '0.82rem' }}
          value={selectedSource}
          onChange={(e) => setSelectedSource(e.target.value)}
        >
          <option value="">All Sources</option>
          <option value="CUSTOMER_LINK">Customer Self-Order</option>
          <option value="MANAGER">Manager Sheet Entry</option>
          <option value="OWNER">Owner Entry</option>
        </select>

        {/* Refresh Button */}
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => {
            apiClient.clearCache('order');
            fetchOrders();
          }}
          disabled={loading}
          style={{ height: '34px', padding: '0 0.65rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
          title="Refresh orders from database"
        >
          <RefreshCw size={13} className={loading ? 'spinner' : ''} />
          <span>Refresh</span>
        </button>

        {/* Clear Filters Button */}
        {hasActiveFilters && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={clearAllFilters}
            style={{ height: '34px', padding: '0 0.65rem', color: '#dc2626', borderColor: '#fca5a5' }}
            title="Clear all active filters"
          >
            <X size={13} />
            <span>Clear Filters</span>
          </button>
        )}
      </div>

      {/* Orders Table */}
      <div className="table-container">
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center' }}>
            <div className="spinner" style={{ margin: '0 auto 0.5rem' }} />
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Loading orders...</span>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '130px' }}>Order #</th>
                <th style={{ width: '105px' }}>Date</th>
                <th>Customer Shop</th>
                <th style={{ width: '120px' }}>Route</th>
                <th style={{ width: '120px' }}>Driver</th>
                <th style={{ textAlign: 'right', width: '110px' }}>Total (₹)</th>
                <th style={{ width: '120px' }}>Source</th>
                <th style={{ width: '110px' }}>Entered By</th>
                <th style={{ width: '100px' }}>Status</th>
                <th style={{ textAlign: 'center', width: '220px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.length > 0 ? (
                filteredOrders.map((o) => (
                  <tr key={o.id}>
                    {/* Order # */}
                    <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                      #{o.order_number}
                    </td>

                    {/* Date (Clickable to filter this date) */}
                    <td>
                      <button
                        type="button"
                        onClick={() => setSelectedDate(o.order_date)}
                        title={`Click to filter all orders for ${formatDate(o.order_date)}`}
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          cursor: 'pointer',
                          color: selectedDate === o.order_date ? '#1d4ed8' : 'inherit',
                          fontSize: 'inherit',
                          fontFamily: 'inherit',
                          fontWeight: selectedDate === o.order_date ? 800 : 500,
                          textAlign: 'left',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px',
                        }}
                      >
                        <Calendar size={11} style={{ opacity: 0.6 }} />
                        <span>{formatDate(o.order_date)}</span>
                      </button>
                    </td>

                    {/* Customer Shop (Clickable to filter this shop) */}
                    <td>
                      <button
                        type="button"
                        onClick={() => setSearchShopQuery(o.customer_details?.name || '')}
                        title={`Click to filter all orders for "${o.customer_details?.name || 'this shop'}"`}
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          cursor: 'pointer',
                          color: 'var(--primary)',
                          fontSize: 'inherit',
                          fontFamily: 'inherit',
                          fontWeight: 700,
                          textAlign: 'left',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <Store size={12} style={{ opacity: 0.7 }} />
                        <span>{o.customer_details?.name || 'Customer'}</span>
                      </button>
                      {o.customer_details?.owner_name && (
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                          {o.customer_details.owner_name}
                        </div>
                      )}
                    </td>

                    {/* Route */}
                    <td style={{ maxWidth: '190px' }}>
                      <span
                        className="badge badge-neutral"
                        style={{
                          fontSize: '0.75rem',
                          maxWidth: '175px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          display: 'inline-block',
                          verticalAlign: 'middle',
                        }}
                        title={o.route_details?.name || '—'}
                      >
                        {o.route_details?.name || '—'}
                      </span>
                    </td>

                    {/* Driver */}
                    <td style={{ fontSize: '0.82rem', maxWidth: '140px' }}>
                      <span
                        style={{
                          maxWidth: '130px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          display: 'inline-block',
                          verticalAlign: 'middle',
                        }}
                        title={o.driver_name || 'Unassigned'}
                      >
                        {o.driver_name || 'Unassigned'}
                      </span>
                    </td>

                    {/* Total Amount */}
                    <td style={{ fontWeight: 800, color: 'var(--primary)', textAlign: 'right' }}>
                      {formatCurrency(o.total_amount)}
                    </td>

                    {/* Source */}
                    <td>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          padding: '0.15rem 0.45rem',
                          background: o.source === 'CUSTOMER_LINK' ? '#ecfdf5' : '#f3f4f6',
                          color: o.source === 'CUSTOMER_LINK' ? '#047857' : '#374151',
                          border: o.source === 'CUSTOMER_LINK' ? '1px solid #a7f3d0' : '1px solid #e5e7eb',
                          borderRadius: '4px',
                          fontWeight: 700,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.2rem',
                        }}
                      >
                        {o.source === 'CUSTOMER_LINK' ? '📱 Self-Order' : (o.source || 'MANAGER')}
                      </span>
                    </td>

                    {/* Entered By */}
                    <td>
                      <div style={{ fontSize: '0.78rem', fontWeight: 600 }}>
                        {o.entered_by_name || 'System'}
                      </div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                        {o.entered_by_role || 'MANAGER'}
                      </div>
                    </td>

                    {/* Status */}
                    <td>{getStatusBadge(o.status)}</td>

                    {/* Actions: View, Edit, Invoice, Delete */}
                    <td>
                      <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center', justifyContent: 'center' }}>
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.76rem' }}
                          onClick={() => setActiveOrder(o)}
                          title="View order details and items"
                        >
                          <Eye size={12} />
                          <span>View</span>
                        </button>

                        {o.status !== 'DELIVERED' && o.status !== 'CANCELLED' && (
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.76rem', color: '#b45309', borderColor: '#fde68a' }}
                            onClick={() => setEditingOrder(o)}
                            title="Edit order items or driver"
                          >
                            <Edit size={12} />
                            <span>Edit</span>
                          </button>
                        )}

                        <button
                          className="btn btn-secondary"
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.76rem', color: 'var(--primary)' }}
                          onClick={() => setInvoiceOrder(o)}
                          title="View and print tax invoice"
                        >
                          <FileText size={12} />
                          <span>Invoice</span>
                        </button>

                        {/* Owner / Manager Delete / Clear Order */}
                        <button
                          className="btn btn-secondary"
                          style={{
                            padding: '0.25rem 0.5rem',
                            fontSize: '0.76rem',
                            color: '#dc2626',
                            borderColor: '#fca5a5',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.2rem',
                          }}
                          onClick={() => handleDeleteOrder(o)}
                          disabled={deletingOrderId === o.id}
                          title={`Permanently delete and clear Order #${o.order_number}`}
                        >
                          <Trash2 size={12} />
                          <span>{deletingOrderId === o.id ? 'Deleting...' : 'Delete'}</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'var(--text-muted)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                      <Filter size={32} style={{ opacity: 0.5 }} />
                      <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                        No Orders Found
                      </div>
                      <p style={{ margin: 0, fontSize: '0.84rem' }}>
                        {hasActiveFilters
                          ? 'No orders match your selected date, route, status, or shop name filter.'
                          : 'No orders have been recorded in the database yet.'}
                      </p>
                      {hasActiveFilters && (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={clearAllFilters}
                          style={{ marginTop: '0.35rem' }}
                        >
                          Clear Active Filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Order Items Modal */}
      {activeOrder && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '520px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>
                Order #{activeOrder.order_number}
              </h3>
              <button
                type="button"
                onClick={() => setActiveOrder(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
              Customer: <strong>{activeOrder.customer_details?.name}</strong> | Route: {activeOrder.route_details?.name} | Date: {formatDate(activeOrder.order_date)}
            </p>

            <table className="data-table" style={{ marginBottom: '1.25rem' }}>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Quantity</th>
                  <th>Price</th>
                  <th style={{ textAlign: 'right' }}>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {activeOrder.items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.product_details?.name}</td>
                    <td>{item.quantity} packs</td>
                    <td>{formatCurrency(item.unit_price)}</td>
                    <td style={{ fontWeight: 600, textAlign: 'right' }}>{formatCurrency(item.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.75rem',
                background: '#f8fafc',
                borderRadius: 'var(--radius-md)',
                marginBottom: '1.25rem',
              }}
            >
              <span style={{ fontWeight: 600 }}>Total Order Value:</span>
              <span style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--primary)' }}>
                {formatCurrency(activeOrder.total_amount)}
              </span>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
              {isWhatsAppEnabled && (
                <button
                  className="btn btn-secondary"
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', color: '#059669' }}
                  onClick={() => {
                    const items = (activeOrder.items || []).map((it) => ({
                      name: it.product_details?.name || 'Product',
                      quantity: it.quantity,
                      unitPrice: it.unit_price,
                      subtotal: it.subtotal || (Number(it.unit_price) * it.quantity).toFixed(2),
                    }));
                    const msg = generateInvoiceMessage({
                      customerName: activeOrder.customer_details?.name || 'Customer',
                      orderNumber: activeOrder.order_number,
                      date: activeOrder.order_date,
                      items,
                      totalAmount: activeOrder.total_amount,
                    });
                    openWhatsApp(activeOrder.customer_details?.phone, msg);
                  }}
                >
                  <MessageSquare size={15} />
                  <span>Share WhatsApp</span>
                </button>
              )}

              <button
                className="btn btn-primary"
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
                onClick={() => {
                  setInvoiceOrder(activeOrder);
                  setActiveOrder(null);
                }}
              >
                <FileText size={15} />
                <span>Print Invoice</span>
              </button>
            </div>

            {/* Clear / Delete Order from Modal */}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ flex: 1, color: '#dc2626', borderColor: '#fca5a5', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}
                onClick={() => {
                  const toDelete = activeOrder;
                  setActiveOrder(null);
                  handleDeleteOrder(toDelete);
                }}
              >
                <Trash2 size={14} />
                <span>Delete Order</span>
              </button>
              <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setActiveOrder(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Modal */}
      {invoiceOrder && (
        <InvoiceModal
          order={invoiceOrder}
          customer={invoiceOrder.customer_details}
          onClose={() => setInvoiceOrder(null)}
        />
      )}

      {/* Edit Order Modal */}
      {editingOrder && (
        <EditOrderModal
          order={editingOrder}
          onClose={() => setEditingOrder(null)}
          onSuccess={() => {
            setEditingOrder(null);
            fetchOrders();
          }}
        />
      )}
    </div>
  );
};
