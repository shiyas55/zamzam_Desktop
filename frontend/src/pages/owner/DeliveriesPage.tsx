import React, { useEffect, useState } from 'react';
import { deliveryService } from '../../services/deliveryService';
import { routeService } from '../../services/routeService';
import { Delivery, Route, Driver } from '../../types';
import { formatCurrency, formatDateTime } from '../../utils/formatters';
import {
  Send,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  UserCheck,
  Search,
  Filter,
  RefreshCw,
  AlertCircle,
  Check,
} from 'lucide-react';

export const DeliveriesPage: React.FC = () => {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [dateFilter, setDateFilter] = useState<'today' | 'all'>('today');
  const [selectedRoute, setSelectedRoute] = useState('');
  const [selectedDriver, setSelectedDriver] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');

  // "Mark Not Delivered" Modal
  const [notDeliveredTarget, setNotDeliveredTarget] = useState<Delivery | null>(null);
  const [failedReasonPreset, setFailedReasonPreset] = useState('Shop closed');
  const [customFailedReason, setCustomFailedReason] = useState('');
  const [notDeliveredNotes, setNotDeliveredNotes] = useState('');
  const [submittingNotDelivered, setSubmittingNotDelivered] = useState(false);

  // "Assign Driver" Modal
  const [assignTarget, setAssignTarget] = useState<Delivery | null>(null);
  const [newDriverId, setNewDriverId] = useState('');
  const [allowCrossRoute, setAllowCrossRoute] = useState(false);
  const [assignNotes, setAssignNotes] = useState('');
  const [submittingAssign, setSubmittingAssign] = useState(false);

  // Preset reasons for not delivered (Prompt 11)
  const failedReasonsList = [
    'Shop closed',
    'Customer unavailable',
    'Product unavailable',
    'Customer refused',
    'Address issue',
    'Other',
  ];

  const fetchDeliveries = async () => {
    try {
      setLoading(true);
      setError(null);
      const todayStr = new Date().toISOString().split('T')[0];
      const [delList, routeList, driverList] = await Promise.all([
        deliveryService.getDeliveries({
          route: selectedRoute || undefined,
          status: selectedStatus || undefined,
          date: dateFilter === 'today' ? todayStr : undefined,
        }),
        routeService.getRoutes(),
        routeService.getDrivers(),
      ]);
      setDeliveries(delList);
      setRoutes(routeList);
      setDrivers(driverList);
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
      else setError('Failed to load deliveries');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeliveries();
  }, [selectedRoute, selectedStatus, dateFilter]);

  // Mark Completed / Delivered Handler
  const handleMarkDelivered = async (del: Delivery) => {
    try {
      const recipient = window.prompt(`Confirm delivery for ${del.order_details?.customer_details?.name || 'Customer'}.\nEnter Recipient Name (or press OK):`, 'Store Manager');
      if (recipient === null) return;
      await deliveryService.completeDelivery(del.id, {
        recipient_name: recipient,
        notes: 'Confirmed by Manager via Delivery Board',
      });
      fetchDeliveries();
    } catch (err: unknown) {
      if (err instanceof Error) alert(err.message);
      else alert('Failed to complete delivery');
    }
  };

  // Submit Not Delivered Modal
  const handleSubmitNotDelivered = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notDeliveredTarget) return;

    const finalReason = failedReasonPreset === 'Other' ? customFailedReason.trim() : failedReasonPreset;
    if (!finalReason) {
      alert('Please specify the reason for non-delivery.');
      return;
    }

    try {
      setSubmittingNotDelivered(true);
      await deliveryService.markNotDelivered(notDeliveredTarget.id, {
        failed_reason: finalReason,
        notes: notDeliveredNotes,
      });
      setNotDeliveredTarget(null);
      setCustomFailedReason('');
      setNotDeliveredNotes('');
      fetchDeliveries();
    } catch (err: unknown) {
      if (err instanceof Error) alert(err.message);
      else alert('Failed to mark delivery as not delivered');
    } finally {
      setSubmittingNotDelivered(false);
    }
  };

  // Submit Driver Assignment Modal (Prompt 8)
  const handleSubmitAssignDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignTarget || !newDriverId) return;

    try {
      setSubmittingAssign(true);
      await deliveryService.assignDriver(assignTarget.id, {
        driver_id: newDriverId,
        allow_cross_route: allowCrossRoute,
        notes: assignNotes,
      });
      setAssignTarget(null);
      setNewDriverId('');
      setAllowCrossRoute(false);
      setAssignNotes('');
      fetchDeliveries();
    } catch (err: unknown) {
      if (err instanceof Error) alert(err.message);
      else alert('Failed to assign driver');
    } finally {
      setSubmittingAssign(false);
    }
  };

  // Quick 1-click filter for Manager (Prompt 10: "Which deliveries are still pending?")
  const handleQuickPendingFilter = () => {
    setSelectedStatus('ASSIGNED');
    setDateFilter('today');
  };

  // Filter deliveries client-side by driver & customer search
  const filteredDeliveries = deliveries.filter((d) => {
    if (selectedDriver && d.driver !== selectedDriver) return false;
    if (customerSearch) {
      const q = customerSearch.toLowerCase();
      const custName = d.order_details?.customer_details?.name?.toLowerCase() || '';
      const orderNum = d.order_details?.order_number?.toLowerCase() || '';
      if (!custName.includes(q) && !orderNum.includes(q)) return false;
    }
    return true;
  });

  const selectedTargetDriver = drivers.find((d) => d.id === newDriverId);
  const isCrossRouteTarget =
    assignTarget &&
    selectedTargetDriver &&
    selectedTargetDriver.assigned_route &&
    assignTarget.route &&
    selectedTargetDriver.assigned_route !== assignTarget.route;

  return (
    <div>
      {/* Title & Stats Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            Today's Deliveries Board
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', margin: '0.2rem 0 0' }}>
            Live fulfillment control, driver dispatch reassignment, and failed reason tracking.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button
            className={`btn btn-sm ${dateFilter === 'today' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setDateFilter('today')}
          >
            Today's Board
          </button>
          <button
            className={`btn btn-sm ${dateFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setDateFilter('all')}
          >
            All Dates
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => fetchDeliveries()} disabled={loading}>
            <RefreshCw size={15} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: 'var(--danger-bg)', color: 'var(--danger)', padding: '0.85rem', borderRadius: 'var(--radius-md)', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Filter Toolbar (Prompt 10) */}
      <div
        className="card"
        style={{
          padding: '1rem 1.25rem',
          marginBottom: '1.5rem',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.75rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
          {/* Customer Search */}
          <div style={{ position: 'relative', width: '220px' }}>
            <Search size={15} style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="form-input"
              style={{ paddingLeft: '2rem', fontSize: '0.85rem' }}
              placeholder="Search shop or order..."
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
            />
          </div>

          {/* Route Filter */}
          <select
            className="form-select"
            style={{ width: '170px', fontSize: '0.85rem' }}
            value={selectedRoute}
            onChange={(e) => setSelectedRoute(e.target.value)}
          >
            <option value="">All Routes</option>
            {routes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>

          {/* Staff Driver Filter */}
          <select
            className="form-select"
            style={{ width: '170px', fontSize: '0.85rem' }}
            value={selectedDriver}
            onChange={(e) => setSelectedDriver(e.target.value)}
          >
            <option value="">All Staff Drivers</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.driver_name}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            className="form-select"
            style={{ width: '160px', fontSize: '0.85rem' }}
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="ASSIGNED">Assigned / Pending</option>
            <option value="IN_TRANSIT">In Transit</option>
            <option value="DELIVERED">Delivered</option>
            <option value="NOT_DELIVERED">Not Delivered</option>
            <option value="FAILED">Failed</option>
          </select>
        </div>

        {/* 1-Click "Which deliveries are still pending?" (Prompt 10) */}
        <button
          className="btn btn-secondary btn-sm"
          onClick={handleQuickPendingFilter}
          style={{ background: '#fef3c7', borderColor: '#fde68a', color: '#92400e', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem' }}
        >
          <Clock size={15} />
          <span>Show Pending Deliveries Only</span>
        </button>
      </div>

      {/* Operational Board Table (Prompt 9) */}
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
                <th>Staff Driver</th>
                <th>Order #</th>
                <th>Amount</th>
                <th>Payment Status</th>
                <th>Delivery Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredDeliveries.length > 0 ? (
                filteredDeliveries.map((d) => {
                  const isDelivered = d.status === 'DELIVERED';
                  const isNotDelivered = d.status === 'NOT_DELIVERED' || d.status === 'FAILED';
                  const isPending = d.status === 'ASSIGNED' || d.status === 'IN_TRANSIT';

                  return (
                    <tr key={d.id}>
                      {/* Customer */}
                      <td>
                        <strong style={{ fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                          {d.order_details?.customer_details?.name || 'Customer Shop'}
                        </strong>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                          {d.order_details?.customer_details?.phone || ''}
                        </div>
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
                          }}
                          title={d.route_details?.name || 'Route'}
                        >
                          {d.route_details?.name || 'Route'}
                        </span>
                      </td>

                      {/* Driver */}
                      <td style={{ maxWidth: '170px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 0 }}>
                          <span
                            style={{
                              fontWeight: 600,
                              maxWidth: '120px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              display: 'inline-block',
                            }}
                            title={d.driver_name || 'Unassigned'}
                          >
                            {d.driver_name || 'Unassigned'}
                          </span>
                          {!isDelivered && (
                            <button
                              type="button"
                              onClick={() => {
                                setAssignTarget(d);
                                setNewDriverId(d.driver || '');
                              }}
                              style={{ color: 'var(--primary)', padding: '0.2rem', fontSize: '0.72rem', textDecoration: 'underline' }}
                              title="Reassign driver"
                            >
                              Reassign
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Order */}
                      <td style={{ fontWeight: 600 }}>{d.order_details?.order_number || d.delivery_number}</td>

                      {/* Amount */}
                      <td style={{ fontWeight: 700, color: 'var(--primary)' }}>
                        {formatCurrency(d.order_details?.total_amount || '0.00')}
                      </td>

                      {/* Payment Status */}
                      <td>
                        {isDelivered ? (
                          <span className="badge badge-success" style={{ fontSize: '0.72rem' }}>
                            Settled / In Ledger
                          </span>
                        ) : (
                          <span className="badge badge-warning" style={{ fontSize: '0.72rem' }}>
                            Credit / On Delivery
                          </span>
                        )}
                      </td>

                      {/* Delivery Status & Failed Reason */}
                      <td>
                        {isDelivered ? (
                          <div>
                            <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                              <CheckCircle2 size={12} />
                              <span>Delivered</span>
                            </span>
                            {d.recipient_name && (
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                                Recipient: {d.recipient_name}
                              </div>
                            )}
                          </div>
                        ) : isNotDelivered ? (
                          <div>
                            <span className="badge badge-danger" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                              <XCircle size={12} />
                              <span>Not Delivered</span>
                            </span>
                            <div style={{ fontSize: '0.75rem', color: '#dc2626', fontWeight: 600, marginTop: '0.15rem' }}>
                              Reason: {d.failed_reason || 'Shop closed'}
                            </div>
                            {d.notes && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{d.notes}</div>}
                          </div>
                        ) : (
                          <span className="badge badge-warning" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                            <Clock size={12} />
                            <span>{d.status}</span>
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td>
                        {!isDelivered ? (
                          <div style={{ display: 'flex', gap: '0.35rem' }}>
                            <button
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', color: '#059669', borderColor: '#a7f3d0' }}
                              onClick={() => handleMarkDelivered(d)}
                              title="Mark as delivered"
                            >
                              <Check size={13} />
                              <span>Delivered</span>
                            </button>

                            <button
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', color: '#dc2626', borderColor: '#fecaca' }}
                              onClick={() => {
                                setNotDeliveredTarget(d);
                                setFailedReasonPreset('Shop closed');
                                setCustomFailedReason('');
                              }}
                              title="Mark as not delivered with reason"
                            >
                              <XCircle size={13} />
                              <span>Not Delivered</span>
                            </button>
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Completed</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    No deliveries match the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* "Mark Not Delivered" Modal (Prompt 11) */}
      {notDeliveredTarget && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#dc2626', marginBottom: '0.5rem' }}>
              <XCircle size={22} />
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>
                Mark Delivery as Not Delivered
              </h3>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
              Customer: <strong>{notDeliveredTarget.order_details?.customer_details?.name}</strong> • Order #{notDeliveredTarget.order_details?.order_number}
            </p>

            <form onSubmit={handleSubmitNotDelivered}>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">
                  Reason for Non-Delivery <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <select
                  className="form-select"
                  value={failedReasonPreset}
                  onChange={(e) => setFailedReasonPreset(e.target.value)}
                  required
                >
                  {failedReasonsList.map((reason) => (
                    <option key={reason} value={reason}>
                      {reason}
                    </option>
                  ))}
                </select>
              </div>

              {failedReasonPreset === 'Other' && (
                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label className="form-label">Specify Custom Reason *</label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    placeholder="Describe specific issue"
                    value={customFailedReason}
                    onChange={(e) => setCustomFailedReason(e.target.value)}
                  />
                </div>
              )}

              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label className="form-label">Driver / Dispatch Remarks</label>
                <textarea
                  className="form-textarea"
                  rows={2}
                  placeholder="e.g. Arrived at 10 AM, shop shutter down, phone switched off"
                  value={notDeliveredNotes}
                  onChange={(e) => setNotDeliveredNotes(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setNotDeliveredTarget(null)}
                  disabled={submittingNotDelivered}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submittingNotDelivered}
                  style={{ background: '#dc2626', borderColor: '#dc2626' }}
                >
                  <span>{submittingNotDelivered ? 'Updating...' : 'Confirm Not Delivered'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* "Reassign Driver" Modal (Prompt 8) */}
      {assignTarget && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <UserCheck size={22} color="var(--primary)" />
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>
                Assign Staff Driver to Delivery
              </h3>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
              Customer: <strong>{assignTarget.order_details?.customer_details?.name}</strong> • Delivery Route: <strong>{assignTarget.route_details?.name}</strong>
            </p>

            <form onSubmit={handleSubmitAssignDriver}>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Select Staff Driver *</label>
                <select
                  className="form-select"
                  value={newDriverId}
                  onChange={(e) => setNewDriverId(e.target.value)}
                  required
                >
                  <option value="">Choose Staff Driver...</option>
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.driver_name} — Route: {d.assigned_route_details?.name || 'Unassigned'} ({d.active_deliveries_count || 0} active today)
                    </option>
                  ))}
                </select>
              </div>

              {/* Route Compatibility Warning (Prompt 8) */}
              {isCrossRouteTarget && (
                <div style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', padding: '0.75rem', borderRadius: 'var(--radius-md)', fontSize: '0.82rem', marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <AlertTriangle size={15} />
                    <span>
                      <strong>Route Mismatch:</strong> Driver belongs to '{selectedTargetDriver?.assigned_route_details?.name}', whereas this delivery is on '{assignTarget.route_details?.name}'.
                    </span>
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, cursor: 'pointer', marginTop: '0.2rem' }}>
                    <input
                      type="checkbox"
                      checked={allowCrossRoute}
                      onChange={(e) => setAllowCrossRoute(e.target.checked)}
                    />
                    <span>Allow cross-route dispatch override</span>
                  </label>
                </div>
              )}

              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label className="form-label">Assignment Notes</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Optional dispatch instruction"
                  value={assignNotes}
                  onChange={(e) => setAssignNotes(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setAssignTarget(null)}
                  disabled={submittingAssign}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submittingAssign || !newDriverId || Boolean(isCrossRouteTarget && !allowCrossRoute)}
                >

                  <span>{submittingAssign ? 'Assigning...' : 'Confirm Staff Driver Assignment'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
