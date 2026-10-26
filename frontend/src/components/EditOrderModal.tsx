import React, { useState, useEffect } from 'react';
import { Order, Product, Driver } from '../types';
import { orderService } from '../services/orderService';
import { productService } from '../services/productService';
import { routeService } from '../services/routeService';
import { formatCurrency } from '../utils/formatters';
import { X, Save, AlertCircle, ShoppingCart, UserCheck, Plus, Trash2, Unlock, RefreshCw } from 'lucide-react';
import { OrderActivityTimeline } from './OrderActivityTimeline';
import { apiClient } from '../services/apiClient';

interface EditOrderModalProps {
  order: Order;
  onClose: () => void;
  onSuccess: (updatedOrder: Order) => void;
}

export const EditOrderModal: React.FC<EditOrderModalProps> = ({ order, onClose, onSuccess }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Line items state
  const [items, setItems] = useState<Array<{ product_id: string; quantity: number; unit_price: string }>>([]);
  const [selectedDriverId, setSelectedDriverId] = useState<string>(order.driver || '');
  const [notes, setNotes] = useState<string>(order.notes || '');
  const [discount, setDiscount] = useState<string>(order.shop_expense ? String(order.shop_expense) : '0.00');
  const [reopenReason, setReopenReason] = useState('');
  const [isReopening, setIsReopening] = useState(false);

  const isIrreversible = order.status === 'CANCELLED';

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [prodList, driverList] = await Promise.all([
          productService.getProducts(),
          routeService.getDrivers(),
        ]);
        setProducts(prodList);
        setDrivers(driverList);

        // Prepopulate items from order
        if (order.items && order.items.length > 0) {
          setItems(
            order.items.map((it) => ({
              product_id: (typeof it.product === 'object' && it.product !== null ? (it.product as any).id : it.product) || (it.product_details as any)?.id || '',
              quantity: it.quantity,
              unit_price: String(it.unit_price),
            }))
          );
        } else if (prodList.length > 0) {
          setItems([{ product_id: prodList[0].id, quantity: 10, unit_price: prodList[0].unit_price }]);
        }
      } catch (err) {
        console.error(err);
        setError('Failed to load products and driver list.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [order]);

  const handleItemChange = (index: number, field: 'product_id' | 'quantity' | 'unit_price', value: string | number) => {
    setItems((prev) => {
      const updated = [...prev];
      const item = { ...updated[index] };
      if (field === 'product_id') {
        item.product_id = String(value);
        const p = products.find((prod) => prod.id === value);
        if (p) item.unit_price = p.unit_price;
      } else if (field === 'quantity') {
        item.quantity = Math.max(1, Number(value) || 1);
      } else if (field === 'unit_price') {
        item.unit_price = String(value);
      }
      updated[index] = item;
      return updated;
    });
  };

  const handleAddItem = () => {
    if (products.length === 0) return;
    setItems((prev) => [
      ...prev,
      { product_id: products[0].id, quantity: 10, unit_price: products[0].unit_price },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) {
      setError('An order must contain at least one line item.');
      return;
    }
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const calculateSubtotal = (): number => {
    return items.reduce((acc, it) => {
      const price = parseFloat(it.unit_price) || 0;
      return acc + it.quantity * price;
    }, 0);
  };

  const calculateTotal = (): number => {
    const subtotal = calculateSubtotal();
    const disc = parseFloat(discount) || 0;
    return Math.max(0, subtotal - disc);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isIrreversible) {
      setError(`Cannot edit order because it has been cancelled.`);
      return;
    }

    if (items.length === 0) {
      setError('Please add at least one line item.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      const updated = await orderService.updateOrder(order.id, {
        items: items.map((it) => ({
          product_id: it.product_id,
          quantity: it.quantity,
          unit_price: it.unit_price,
        })),
        driver_id: selectedDriverId || null,
        shop_expense: parseFloat(discount) > 0 ? parseFloat(discount).toFixed(2) : '0.00',
        shop_expense_notes: parseFloat(discount) > 0 ? 'Discount / Deduction' : '',
        notes,
      });
      onSuccess(updated);
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
      else setError('Failed to update order.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReopen = async () => {
    if (!reopenReason) {
      setError('Please provide a reason to reopen the order.');
      return;
    }
    try {
      setIsReopening(true);
      setError(null);
      
      const updated = await apiClient.post<Order>(`/orders/orders/${order.id}/reopen/`, {
        reason: reopenReason,
      });
      onSuccess(updated);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsReopening(false);
    }
  };

  const grandTotal = calculateTotal();

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '640px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              Edit Order #{order.order_number}
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '0.2rem 0 0' }}>
              Customer: <strong>{order.customer_details?.name}</strong> • Route: {order.route_details?.name}
            </p>
          </div>
          <button onClick={onClose} style={{ color: 'var(--text-muted)', padding: '0.4rem' }}>
            <X size={20} />
          </button>
        </div>

        {isIrreversible && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', padding: '1rem', borderRadius: 'var(--radius-md)', marginBottom: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AlertCircle size={18} />
              <span style={{ fontWeight: 600 }}>This order has been CANCELLED and cannot be modified.</span>
            </div>
            
            {order.status !== 'DELIVERY_CREATED' && order.status !== 'COMPLETED' && order.status !== 'CANCELLED' && (
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Reason for reopening..." 
                  value={reopenReason}
                  onChange={e => setReopenReason(e.target.value)}
                  style={{ flex: 1, padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}
                />
                <button 
                  type="button" 
                  className="btn btn-primary" 
                  style={{ background: '#dc2626', borderColor: '#dc2626', padding: '0.4rem 0.8rem' }}
                  onClick={handleReopen}
                  disabled={isReopening || !reopenReason}
                >
                  <Unlock size={14} />
                  <span>{isReopening ? 'Reopening...' : 'Reopen Order'}</span>
                </button>
              </div>
            )}
          </div>
        )}

        {error && (
          <div style={{ background: 'var(--danger-bg)', color: 'var(--danger)', padding: '0.85rem', borderRadius: 'var(--radius-md)', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center' }}>
            <div className="spinner" style={{ margin: '0 auto' }} />
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {/* Products & Line Items */}
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <label style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <ShoppingCart size={16} color="var(--primary)" />
                  <span>Line Items & Pricing</span>
                </label>
                {!isIrreversible && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handleAddItem}
                    style={{ fontSize: '0.78rem', padding: '0.25rem 0.6rem' }}
                  >
                    <Plus size={14} />
                    <span>Add Item</span>
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {items.map((it, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.6rem',
                      background: '#f8fafc',
                      padding: '0.65rem 0.85rem',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    <select
                      className="form-select"
                      style={{ flex: 2, fontSize: '0.85rem' }}
                      value={it.product_id}
                      onChange={(e) => handleItemChange(idx, 'product_id', e.target.value)}
                      disabled={isIrreversible}
                    >
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.packet_size})
                        </option>
                      ))}
                    </select>

                    <div style={{ width: '85px' }}>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        className="form-input"
                        placeholder="Qty"
                        style={{ textAlign: 'center', fontSize: '0.85rem' }}
                        value={it.quantity}
                        onChange={(e) => handleItemChange(idx, 'quantity', parseInt(e.target.value) || 1)}
                        disabled={isIrreversible}
                      />
                    </div>

                    <div style={{ width: '90px' }}>
                      <input
                        type="number"
                        step="0.05"
                        min="0"
                        className="form-input"
                        placeholder="Price"
                        style={{ textAlign: 'right', fontSize: '0.85rem', fontWeight: 600 }}
                        value={it.unit_price}
                        onChange={(e) => handleItemChange(idx, 'unit_price', e.target.value)}
                        disabled={isIrreversible}
                      />
                    </div>

                    <div style={{ minWidth: '75px', textAlign: 'right', fontSize: '0.9rem', fontWeight: 700, color: 'var(--primary)' }}>
                      {formatCurrency((it.quantity * (parseFloat(it.unit_price) || 0)).toFixed(2))}
                    </div>

                    {!isIrreversible && items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        style={{ color: '#dc2626', padding: '0.3rem' }}
                        title="Remove item"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Driver Assignment */}
            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <UserCheck size={16} color="var(--primary)" />
                <span>Assigned Driver</span>
              </label>
              <select
                className="form-select"
                value={selectedDriverId}
                onChange={(e) => setSelectedDriverId(e.target.value)}
                disabled={isIrreversible}
              >
                <option value="">Unassigned</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.driver_name} — {d.assigned_route_details?.name || 'Unassigned Route'} ({d.active_deliveries_count || 0} active today)
                  </option>
                ))}
              </select>
            </div>

            {/* Notes */}
            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
              <label className="form-label">Order Notes</label>
              <textarea
                className="form-textarea"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={isIrreversible}
                placeholder="Remarks, changes, or delivery instructions"
              />
            </div>

            {/* Discount / Deduction */}
            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>Discount / Shop Expense (₹)</span>
                {parseFloat(discount) > 0 && (
                  <span style={{ fontSize: '0.75rem', color: '#dc2626', fontWeight: 700 }}>
                    - {formatCurrency(parseFloat(discount))} deducted
                  </span>
                )}
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="form-input"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                disabled={isIrreversible}
                placeholder="0.00"
                style={{ fontSize: '0.9rem', fontWeight: 600 }}
              />
            </div>

            {/* Total and Actions */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.25rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 'var(--radius-md)', marginBottom: '1.25rem' }}>
              <div>
                <span style={{ fontSize: '0.8rem', color: 'var(--primary-dark)', fontWeight: 600 }}>Updated Total Amount:</span>
                <p style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary)', margin: 0 }}>
                  {formatCurrency(grandTotal)}
                </p>
              </div>
              <span className="badge badge-warning" style={{ fontSize: '0.75rem' }}>
                Financial changes will be logged to Audit Trail
              </span>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={submitting || isIrreversible || items.length === 0}>
                <RefreshCw size={15} />
                <span>{submitting ? 'Updating Order...' : 'Re-submit / Save Order'}</span>
              </button>
            </div>
            
            <OrderActivityTimeline orderId={order.id} />
          </form>
        )}
      </div>
    </div>
  );
};
