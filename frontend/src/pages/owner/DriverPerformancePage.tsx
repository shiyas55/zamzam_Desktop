import React, { useEffect, useState } from 'react';
import { reportService, DriverPerformanceParams } from '../../services/reportService';
import { routeService } from '../../services/routeService';
import {
  DriverPerformanceSummary,
  DriverDetailReport,
  DatePreset,
  Route,
  Driver,
} from '../../types';
import { formatCurrency, formatDate } from '../../utils/formatters';
import {
  Truck,
  Calendar,
  Filter,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  DollarSign,
  Receipt,
  Scale,
  Eye,
  X,
  AlertTriangle,
  MapPin,
} from 'lucide-react';

export const DriverPerformancePage: React.FC = () => {
  const [performanceData, setPerformanceData] = useState<DriverPerformanceSummary[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [datePreset, setDatePreset] = useState<DatePreset>('today');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showCustomRange, setShowCustomRange] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState('');
  const [selectedDriver, setSelectedDriver] = useState('');

  // Drilldown Modal
  const [activeDriverId, setActiveDriverId] = useState<string | null>(null);
  const [driverDetail, setDriverDetail] = useState<DriverDetailReport | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailTab, setDetailTab] = useState<'deliveries' | 'collections' | 'expenses'>('deliveries');

  const fetchPerformance = async (overrideParams?: DriverPerformanceParams) => {
    try {
      setLoading(true);
      setError(null);
      const params: DriverPerformanceParams = overrideParams || {
        date_preset: datePreset,
        start_date: datePreset === 'custom' ? startDate : undefined,
        end_date: datePreset === 'custom' ? endDate : undefined,
        route: selectedRoute || undefined,
        driver: selectedDriver || undefined,
      };

      const res = await reportService.getDriverPerformance(params);
      setPerformanceData(res.drivers || []);
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
      else setError('Failed to load driver performance records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const [rList, dList] = await Promise.all([
          routeService.getRoutes(),
          routeService.getDrivers(),
        ]);
        setRoutes(rList);
        setDrivers(dList);
      } catch (e) {
        console.error('Failed to load filter metadata:', e);
      }
    };
    fetchMetadata();
  }, []);

  useEffect(() => {
    fetchPerformance();
  }, [datePreset, selectedRoute, selectedDriver]);

  const handleOpenDetail = async (driverId: string) => {
    try {
      setActiveDriverId(driverId);
      setLoadingDetail(true);
      const detail = await reportService.getDriverDetail(driverId, {
        date_preset: datePreset,
        start_date: datePreset === 'custom' ? startDate : undefined,
        end_date: datePreset === 'custom' ? endDate : undefined,
      });
      setDriverDetail(detail);
    } catch (err: unknown) {
      console.error(err);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleApplyCustomDates = (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || !endDate) return;
    setDatePreset('custom');
    fetchPerformance({
      date_preset: 'custom',
      start_date: startDate,
      end_date: endDate,
      route: selectedRoute || undefined,
      driver: selectedDriver || undefined,
    });
  };

  return (
    <div>
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>
            Staff Driver Performance
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', margin: '0.2rem 0 0' }}>
            Factual delivery fulfillment, collections, and expense accounting by staff driver.
          </p>
        </div>

        <button
          className="btn btn-secondary"
          onClick={() => fetchPerformance()}
          disabled={loading}
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filter Toolbar */}
      <div
        className="card"
        style={{
          padding: '1rem 1.25rem',
          marginBottom: '1.5rem',
          borderLeft: '4px solid var(--primary)',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Preset Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <Calendar size={15} color="var(--primary)" />
              <span>PERIOD:</span>
            </span>

            {(['today', 'yesterday', 'this_week', 'this_month'] as DatePreset[]).map((preset) => (
              <button
                key={preset}
                className={`btn btn-sm ${datePreset === preset ? 'btn-primary' : 'btn-secondary'}`}
                style={{ textTransform: 'capitalize', padding: '0.3rem 0.75rem', fontSize: '0.8rem' }}
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
              style={{ padding: '0.3rem 0.75rem', fontSize: '0.8rem' }}
              onClick={() => setShowCustomRange(!showCustomRange)}
            >
              Custom Range
            </button>
          </div>

          {/* Route & Driver Dropdown Selects */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Route:</span>
              <select
                className="form-input"
                style={{ padding: '0.3rem 0.6rem', fontSize: '0.82rem', minWidth: '130px' }}
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
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Staff Driver:</span>
              <select
                className="form-input"
                style={{ padding: '0.3rem 0.6rem', fontSize: '0.82rem', minWidth: '130px' }}
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
            </div>
          </div>
        </div>

        {/* Custom Range Drawer */}
        {showCustomRange && (
          <form
            onSubmit={handleApplyCustomDates}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              marginTop: '1rem',
              paddingTop: '0.75rem',
              borderTop: '1px solid var(--border)',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Start Date:</label>
              <input
                type="date"
                className="form-input"
                style={{ padding: '0.25rem 0.5rem', fontSize: '0.82rem' }}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>End Date:</label>
              <input
                type="date"
                className="form-input"
                style={{ padding: '0.25rem 0.5rem', fontSize: '0.82rem' }}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="btn btn-primary btn-sm">
              Apply Filter
            </button>
          </form>
        )}
      </div>

      {error && (
        <div style={{ padding: '1rem', background: 'var(--danger-bg)', color: 'var(--danger)', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Driver Performance Table */}
      <div className="card" style={{ padding: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Truck size={18} color="var(--primary)" />
            <span>Driver Distribution Report</span>
          </h3>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {performanceData.length} active delivery drivers
          </span>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem 0' }}>
            <div className="spinner" />
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Driver Name</th>
                  <th>Route</th>
                  <th style={{ textAlign: 'center' }}>Assigned</th>
                  <th style={{ textAlign: 'center' }}>Delivered</th>
                  <th style={{ textAlign: 'center' }}>Not Delivered</th>
                  <th style={{ textAlign: 'center' }}>Pending</th>
                  <th>Collection</th>
                  <th>Expenses</th>
                  <th>Net Collection</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {performanceData.length > 0 ? (
                  performanceData.map((d) => (
                    <tr key={d.driver_id}>
                      <td>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{d.driver_name}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          {d.vehicle_number ? `Veh: ${d.vehicle_number}` : ''} {d.phone_number ? `• ${d.phone_number}` : ''}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{d.route_name}</div>
                        {d.route_code && (
                          <span className="badge badge-neutral" style={{ fontSize: '0.7rem' }}>{d.route_code}</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 700 }}>{d.total_assigned}</td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{ color: '#059669', fontWeight: 700 }}>{d.delivered}</span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {d.not_delivered > 0 ? (
                          <span style={{ color: '#dc2626', fontWeight: 700 }}>{d.not_delivered}</span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>0</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {d.pending > 0 ? (
                          <span style={{ color: '#d97706', fontWeight: 600 }}>{d.pending}</span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>0</span>
                        )}
                      </td>
                      <td>
                        <div style={{ fontWeight: 800, color: '#059669' }}>
                          {formatCurrency(d.collection_amount)}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          Cash: {formatCurrency(d.cash_collected)} • UPI: {formatCurrency(d.upi_collected)}
                        </div>
                      </td>
                      <td style={{ fontWeight: 700, color: '#b91c1c' }}>
                        {formatCurrency(d.expenses)}
                      </td>
                      <td>
                        <div style={{ fontWeight: 900, color: '#92400e', fontSize: '1.05rem' }}>
                          {formatCurrency(d.net_collection)}
                        </div>
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                          Net cash/UPI handover
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleOpenDetail(d.driver_id)}
                          style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                        >
                          <Eye size={13} />
                          <span>View Detail</span>
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={10} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                      No driver activity found for the selected date and filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Driver Detail Drilldown Modal (Prompt 3 Requirement 5) */}
      {activeDriverId && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '850px' }}>
            {loadingDetail || !driverDetail ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
                <div className="spinner" />
              </div>
            ) : (
              <div>
                {/* Modal Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '0.85rem', marginBottom: '1.25rem' }}>
                  <div>
                    <h3 style={{ fontSize: '1.3rem', fontWeight: 800, margin: 0 }}>
                      {driverDetail.driver_name} — Operational Detail
                    </h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0.2rem 0 0' }}>
                      Route: <strong>{driverDetail.route_name}</strong> | Vehicle: {driverDetail.vehicle_number || 'N/A'} | Period: {driverDetail.start_date} to {driverDetail.end_date}
                    </p>
                  </div>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      setActiveDriverId(null);
                      setDriverDetail(null);
                    }}
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Factual Summary Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
                  <div style={{ padding: '0.75rem', background: 'var(--bg-main)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Assigned</span>
                    <div style={{ fontSize: '1.3rem', fontWeight: 800 }}>{driverDetail.summary.assigned}</div>
                  </div>

                  <div style={{ padding: '0.75rem', background: '#ecfdf5', borderRadius: '8px', border: '1px solid #a7f3d0' }}>
                    <span style={{ fontSize: '0.72rem', color: '#065f46', textTransform: 'uppercase', fontWeight: 600 }}>Delivered</span>
                    <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#047857' }}>{driverDetail.summary.delivered}</div>
                  </div>

                  <div style={{ padding: '0.75rem', background: '#fffbeb', borderRadius: '8px', border: '1px solid #fde68a' }}>
                    <span style={{ fontSize: '0.72rem', color: '#92400e', textTransform: 'uppercase', fontWeight: 600 }}>Pending</span>
                    <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#b45309' }}>{driverDetail.summary.pending}</div>
                  </div>

                  <div style={{ padding: '0.75rem', background: '#fee2e2', borderRadius: '8px', border: '1px solid #fca5a5' }}>
                    <span style={{ fontSize: '0.72rem', color: '#991b1b', textTransform: 'uppercase', fontWeight: 600 }}>Not Delivered</span>
                    <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#dc2626' }}>{driverDetail.summary.not_delivered}</div>
                  </div>

                  <div style={{ padding: '0.75rem', background: '#ecfdf5', borderRadius: '8px', border: '1px solid #a7f3d0' }}>
                    <span style={{ fontSize: '0.72rem', color: '#065f46', textTransform: 'uppercase', fontWeight: 600 }}>Collections</span>
                    <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#047857' }}>{formatCurrency(driverDetail.summary.total_collection)}</div>
                  </div>

                  <div style={{ padding: '0.75rem', background: '#fef2f2', borderRadius: '8px', border: '1px solid #fecaca' }}>
                    <span style={{ fontSize: '0.72rem', color: '#991b1b', textTransform: 'uppercase', fontWeight: 600 }}>Expenses</span>
                    <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#dc2626' }}>{formatCurrency(driverDetail.summary.total_expenses)}</div>
                  </div>

                  <div style={{ padding: '0.75rem', background: '#fffbeb', borderRadius: '8px', border: '2px solid #f59e0b' }}>
                    <span style={{ fontSize: '0.72rem', color: '#78350f', textTransform: 'uppercase', fontWeight: 700 }}>Net Handover</span>
                    <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#92400e' }}>{formatCurrency(driverDetail.summary.net_collection)}</div>
                  </div>
                </div>

                {/* Drilldown Tabs */}
                <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border)', marginBottom: '1rem' }}>
                  <button
                    className={`btn btn-sm ${detailTab === 'deliveries' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setDetailTab('deliveries')}
                  >
                    <span>Deliveries ({driverDetail.deliveries.length})</span>
                  </button>
                  <button
                    className={`btn btn-sm ${detailTab === 'collections' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setDetailTab('collections')}
                  >
                    <span>Collections ({driverDetail.collections.length})</span>
                  </button>
                  <button
                    className={`btn btn-sm ${detailTab === 'expenses' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setDetailTab('expenses')}
                  >
                    <span>Expenses ({driverDetail.expenses.length})</span>
                  </button>
                </div>

                {/* Tab 1: Deliveries */}
                {detailTab === 'deliveries' && (
                  <div className="table-container" style={{ maxHeight: '350px', overflowY: 'auto' }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Order #</th>
                          <th>Customer Shop</th>
                          <th>Amount</th>
                          <th>Status</th>
                          <th>Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {driverDetail.deliveries.length > 0 ? (
                          driverDetail.deliveries.map((dl) => (
                            <tr key={dl.id}>
                              <td style={{ fontWeight: 700 }}>#{dl.order_number}</td>
                              <td>
                                <div style={{ fontWeight: 600 }}>{dl.customer_name}</div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{dl.customer_address}</div>
                              </td>
                              <td style={{ fontWeight: 700 }}>{formatCurrency(dl.total_amount)}</td>
                              <td>
                                <span className={`badge ${
                                  dl.status === 'DELIVERED' ? 'badge-success' :
                                  dl.status === 'NOT_DELIVERED' || dl.status === 'FAILED' ? 'badge-danger' : 'badge-neutral'
                                }`}>
                                  {dl.status}
                                </span>
                                {dl.failed_reason && (
                                  <div style={{ fontSize: '0.7rem', color: '#dc2626' }}>{dl.failed_reason}</div>
                                )}
                              </td>
                              <td>{formatDate(dl.date)}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                              No deliveries recorded in this period.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Tab 2: Collections */}
                {detailTab === 'collections' && (
                  <div className="table-container" style={{ maxHeight: '350px', overflowY: 'auto' }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Receipt #</th>
                          <th>Customer</th>
                          <th>Mode</th>
                          <th>Amount</th>
                          <th>Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {driverDetail.collections.length > 0 ? (
                          driverDetail.collections.map((c) => (
                            <tr key={c.id}>
                              <td style={{ fontWeight: 700 }}>#{c.payment_number}</td>
                              <td style={{ fontWeight: 600 }}>{c.customer_name}</td>
                              <td>
                                <span className="badge badge-neutral">{c.payment_method}</span>
                              </td>
                              <td style={{ fontWeight: 800, color: '#059669' }}>
                                {formatCurrency(c.amount)}
                              </td>
                              <td>{formatDate(c.date)}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                              No collections recorded in this period.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Tab 3: Expenses */}
                {detailTab === 'expenses' && (
                  <div className="table-container" style={{ maxHeight: '350px', overflowY: 'auto' }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Category</th>
                          <th>Amount</th>
                          <th>Date</th>
                          <th>Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {driverDetail.expenses.length > 0 ? (
                          driverDetail.expenses.map((e) => (
                            <tr key={e.id}>
                              <td>
                                <span className="badge badge-neutral">{e.category_display}</span>
                              </td>
                              <td style={{ fontWeight: 800, color: '#dc2626' }}>
                                {formatCurrency(e.amount)}
                              </td>
                              <td>{formatDate(e.date)}</td>
                              <td>{e.notes || '—'}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={4} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                              No expenses recorded in this period.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Modal Footer */}
                <div style={{ marginTop: '1.25rem', paddingTop: '0.85rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    className="btn btn-secondary"
                    onClick={() => {
                      setActiveDriverId(null);
                      setDriverDetail(null);
                    }}
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
