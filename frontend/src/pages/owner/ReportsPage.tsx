import React, { useEffect, useState } from 'react';
import { 
  reportService, 
  OutstandingCreditReport, 
  OutstandingShopReport,
  CollectionReportResponse,
  DailyFinancialSummaryResponse 
} from '../../services/reportService';
import { routeService } from '../../services/routeService';
import { customerService } from '../../services/customerService';
import { Route, Driver, Customer, DatePreset, CollectionItem } from '../../types';
import { formatCurrency, formatDateTime } from '../../utils/formatters';
import { 
  Receipt, 
  Users, 
  DollarSign, 
  Calendar, 
  Filter, 
  Search, 
  MessageSquare, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  FileSpreadsheet,
  ArrowRight
} from 'lucide-react';
import { openWhatsApp, generatePaymentReceiptMessage, generateBalanceReminderMessage } from '../../utils/whatsappUtils';
import { useSettings } from '../../context/SettingsContext';

type ReportTab = 'COLLECTIONS' | 'OUTSTANDING' | 'FINANCIAL_SUMMARY';

export const ReportsPage: React.FC = () => {
  const { isWhatsAppEnabled } = useSettings();
  const [activeTab, setActiveTab] = useState<ReportTab>('COLLECTIONS');

  // Shared master data
  const [routes, setRoutes] = useState<Route[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);

  // Filter states
  const [datePreset, setDatePreset] = useState<DatePreset>('today');
  const [selectedRoute, setSelectedRoute] = useState('');
  const [selectedDriver, setSelectedDriver] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [selectedMethod, setSelectedMethod] = useState('');
  const [selectedAllocation, setSelectedAllocation] = useState('');
  const [selectedAgingBucket, setSelectedAgingBucket] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Report state
  const [loading, setLoading] = useState(true);
  const [collectionReport, setCollectionReport] = useState<CollectionReportResponse | null>(null);
  const [outstandingReport, setOutstandingReport] = useState<OutstandingCreditReport | null>(null);
  const [financialSummary, setFinancialSummary] = useState<DailyFinancialSummaryResponse | null>(null);

  // Load master dropdown options once
  useEffect(() => {
    const loadMasterData = async () => {
      try {
        const [rList, dList, cList] = await Promise.all([
          routeService.getRoutes(),
          routeService.getDrivers(),
          customerService.getCustomers(),
        ]);
        setRoutes(rList);
        setDrivers(dList);
        setCustomers(cList);
      } catch (err) {
        console.error('Failed to load master filter data', err);
      }
    };
    loadMasterData();
  }, []);

  // Fetch report based on active tab and filters
  const fetchReportData = async () => {
    try {
      setLoading(true);
      if (activeTab === 'COLLECTIONS') {
        const res = await reportService.getCollectionReport({
          date_preset: datePreset,
          route: selectedRoute || undefined,
          driver: selectedDriver || undefined,
          customer: selectedCustomer || undefined,
          method: selectedMethod || undefined,
          payment_type: selectedAllocation || undefined,
        });
        setCollectionReport(res);
      } else if (activeTab === 'OUTSTANDING') {
        const res = await reportService.getOutstandingCreditReport({
          route: selectedRoute || undefined,
          aging_bucket: selectedAgingBucket || undefined,
          search: searchQuery || undefined,
        });
        setOutstandingReport(res);
      } else if (activeTab === 'FINANCIAL_SUMMARY') {
        const res = await reportService.getDailyFinancialSummary({
          date_preset: datePreset,
        });
        setFinancialSummary(res);
      }
    } catch (err) {
      console.error('Failed to load report data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReportData();
  }, [
    activeTab, 
    datePreset, 
    selectedRoute, 
    selectedDriver, 
    selectedCustomer, 
    selectedMethod, 
    selectedAllocation, 
    selectedAgingBucket, 
    searchQuery
  ]);

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '1.75rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          Financial & Operational Reports
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
          Real-time financial audits, collection breakdowns, receivables risk analysis, and driver reconciliations.
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border)', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <button
          className={`btn ${activeTab === 'COLLECTIONS' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ borderRadius: 'var(--radius-md) var(--radius-md) 0 0', borderBottom: 'none' }}
          onClick={() => setActiveTab('COLLECTIONS')}
        >
          <Receipt size={16} />
          <span>Collection Report</span>
        </button>

        <button
          className={`btn ${activeTab === 'OUTSTANDING' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ borderRadius: 'var(--radius-md) var(--radius-md) 0 0', borderBottom: 'none' }}
          onClick={() => setActiveTab('OUTSTANDING')}
        >
          <Users size={16} />
          <span>Outstanding Customers</span>
        </button>

        <button
          className={`btn ${activeTab === 'FINANCIAL_SUMMARY' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ borderRadius: 'var(--radius-md) var(--radius-md) 0 0', borderBottom: 'none' }}
          onClick={() => setActiveTab('FINANCIAL_SUMMARY')}
        >
          <DollarSign size={16} />
          <span>Daily Financial Summary</span>
        </button>
      </div>

      {/* TAB 1: COLLECTION REPORT */}
      {activeTab === 'COLLECTIONS' && (
        <div>
          {/* Filters Bar */}
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <select
              className="form-select"
              style={{ width: '160px' }}
              value={datePreset}
              onChange={(e) => setDatePreset(e.target.value as DatePreset)}
            >
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="this_week">This Week</option>
              <option value="this_month">This Month</option>
            </select>

            <select
              className="form-select"
              style={{ width: '180px' }}
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

            <select
              className="form-select"
              style={{ width: '180px' }}
              value={selectedDriver}
              onChange={(e) => setSelectedDriver(e.target.value)}
            >
              <option value="">All Drivers</option>
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.driver_name} ({d.assigned_route_details?.name || 'No Route'})
                </option>
              ))}
            </select>

            <select
              className="form-select"
              style={{ width: '180px' }}
              value={selectedCustomer}
              onChange={(e) => setSelectedCustomer(e.target.value)}
            >
              <option value="">All Customers</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            <select
              className="form-select"
              style={{ width: '150px' }}
              value={selectedMethod}
              onChange={(e) => setSelectedMethod(e.target.value)}
            >
              <option value="">All Methods</option>
              <option value="CASH">Cash Only</option>
              <option value="GPAY_UPI">UPI Only</option>
            </select>

            <select
              className="form-select"
              style={{ width: '180px' }}
              value={selectedAllocation}
              onChange={(e) => setSelectedAllocation(e.target.value)}
            >
              <option value="">All Allocations</option>
              <option value="ORDER_PAYMENT">Today's Orders</option>
              <option value="PREVIOUS_CREDIT">Previous Credit</option>
            </select>
          </div>

          {/* Collection KPI Cards */}
          {collectionReport && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ background: 'white', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Total Collection</span>
                <p style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.2rem' }}>
                  {formatCurrency(collectionReport.summary.total_collected)}
                </p>
                <span style={{ fontSize: '0.75rem', color: '#059669' }}>
                  {collectionReport.summary.completed_count} receipts
                </span>
              </div>

              <div style={{ background: 'white', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Cash Collected</span>
                <p style={{ fontSize: '1.4rem', fontWeight: 700, color: '#059669', marginTop: '0.2rem' }}>
                  {formatCurrency(collectionReport.summary.cash_total)}
                </p>
              </div>

              <div style={{ background: 'white', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>UPI / GPay Collected</span>
                <p style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--primary)', marginTop: '0.2rem' }}>
                  {formatCurrency(collectionReport.summary.upi_total)}
                </p>
              </div>

              <div style={{ background: 'white', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Order Collections</span>
                <p style={{ fontSize: '1.4rem', fontWeight: 700, color: '#7c3aed', marginTop: '0.2rem' }}>
                  {formatCurrency(collectionReport.summary.today_order_collected)}
                </p>
              </div>

              <div style={{ background: 'white', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Prev Credit Collected</span>
                <p style={{ fontSize: '1.4rem', fontWeight: 700, color: '#d97706', marginTop: '0.2rem' }}>
                  {formatCurrency(collectionReport.summary.previous_credit_collected)}
                </p>
              </div>

              {parseFloat(collectionReport.summary.reversed_amount) > 0 && (
                <div style={{ background: '#fef2f2', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid #fee2e2' }}>
                  <span style={{ fontSize: '0.78rem', color: '#991b1b' }}>Reversals / Voids</span>
                  <p style={{ fontSize: '1.4rem', fontWeight: 700, color: '#dc2626', marginTop: '0.2rem' }}>
                    {formatCurrency(collectionReport.summary.reversed_amount)}
                  </p>
                  <span style={{ fontSize: '0.75rem', color: '#dc2626' }}>
                    {collectionReport.summary.reversed_count} reversed
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Collections Table */}
          <div className="table-container">
            {loading ? (
              <div style={{ padding: '3rem', textAlign: 'center' }}>
                <div className="spinner" style={{ margin: '0 auto' }} />
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Receipt #</th>
                    <th>Customer Shop</th>
                    <th>Route</th>
                    <th>Driver / Staff</th>
                    <th>Allocation</th>
                    <th>Amount</th>
                    <th>Method</th>
                    <th>Status</th>
                    <th>Ref ID</th>
                    <th>Timestamp</th>
                    <th style={{ textAlign: 'right' }}>WhatsApp</th>
                  </tr>
                </thead>
                <tbody>
                  {collectionReport && collectionReport.collections.length > 0 ? (
                    collectionReport.collections.map((c: CollectionItem) => {
                      const isReversed = c.status === 'REVERSED';
                      return (
                        <tr key={c.id} style={{ opacity: isReversed ? 0.7 : 1 }}>
                          <td style={{ fontWeight: 600 }}>{c.payment_number}</td>
                          <td style={{ fontWeight: 600 }}>{c.customer_name}</td>
                          <td>
                            <span className="badge badge-neutral">{c.route_name}</span>
                          </td>
                          <td>{c.driver_name}</td>
                          <td>
                            {c.order_number ? (
                              <span className="badge badge-info" style={{ fontSize: '0.74rem' }}>
                                Ord: {c.order_number}
                              </span>
                            ) : (
                              <span className="badge badge-neutral" style={{ fontSize: '0.74rem' }}>
                                Prev Credit
                              </span>
                            )}
                          </td>
                          <td style={{ fontWeight: 700, color: isReversed ? '#9ca3af' : '#059669', textDecoration: isReversed ? 'line-through' : 'none' }}>
                            {formatCurrency(c.amount)}
                          </td>
                          <td>
                            {c.payment_method === 'CASH' ? (
                              <span className="badge badge-success">Cash</span>
                            ) : (
                              <span className="badge badge-info">UPI</span>
                            )}
                          </td>
                          <td>
                            {isReversed ? (
                              <span className="badge badge-danger" title={`Reversal reason: ${c.reversal_reason}`}>
                                Reversed
                              </span>
                            ) : (
                              <span className="badge badge-success">Completed</span>
                            )}
                          </td>
                          <td style={{ fontSize: '0.82rem' }}>{c.reference_number || '—'}</td>
                          <td>{formatDateTime(c.received_at)}</td>
                          <td style={{ textAlign: 'right' }}>
                            {!isReversed && isWhatsAppEnabled && (
                              <button
                                className="btn btn-secondary btn-sm"
                                style={{ padding: '0.2rem 0.5rem', fontSize: '0.78rem', color: '#059669', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                                onClick={() => {
                                  const msg = generatePaymentReceiptMessage({
                                    customerName: c.customer_name,
                                    paymentNumber: c.payment_number,
                                    amount: c.amount,
                                    paymentMethod: c.payment_method,
                                    date: new Date(c.received_at).toLocaleDateString(),
                                  });
                                  openWhatsApp(c.customer_phone, msg);
                                }}
                              >
                                <MessageSquare size={13} />
                                <span>Share</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={11} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                        No collections matching the selected filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: OUTSTANDING CUSTOMERS */}
      {activeTab === 'OUTSTANDING' && (
        <div>
          {/* Aging Distribution Banner */}
          {outstandingReport && outstandingReport.aging_summary && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ background: '#ecfdf5', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid #a7f3d0' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#065f46' }}>0 - 7 Days (Fresh)</span>
                <p style={{ fontSize: '1.4rem', fontWeight: 700, color: '#047857', marginTop: '0.2rem' }}>
                  {formatCurrency(outstandingReport.aging_summary['0_to_7_days'])}
                </p>
              </div>

              <div style={{ background: '#fefce8', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid #fef08a' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#854d0e' }}>8 - 15 Days (Due)</span>
                <p style={{ fontSize: '1.4rem', fontWeight: 700, color: '#ca8a04', marginTop: '0.2rem' }}>
                  {formatCurrency(outstandingReport.aging_summary['8_to_15_days'])}
                </p>
              </div>

              <div style={{ background: '#fff7ed', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid #fed7aa' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#9a3412' }}>16 - 30 Days (Overdue)</span>
                <p style={{ fontSize: '1.4rem', fontWeight: 700, color: '#ea580c', marginTop: '0.2rem' }}>
                  {formatCurrency(outstandingReport.aging_summary['16_to_30_days'])}
                </p>
              </div>

              <div style={{ background: '#fef2f2', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid #fee2e2' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#991b1b' }}>30+ Days (Critical)</span>
                <p style={{ fontSize: '1.4rem', fontWeight: 700, color: '#dc2626', marginTop: '0.2rem' }}>
                  {formatCurrency(outstandingReport.aging_summary['30_plus_days'])}
                </p>
              </div>
            </div>
          )}

          {/* Filters Bar */}
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', width: '240px' }}>
              <Search size={16} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="form-input"
                style={{ paddingLeft: '2rem' }}
                placeholder="Search shop or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <select
              className="form-select"
              style={{ width: '180px' }}
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

            <select
              className="form-select"
              style={{ width: '180px' }}
              value={selectedAgingBucket}
              onChange={(e) => setSelectedAgingBucket(e.target.value)}
            >
              <option value="">All Aging Buckets</option>
              <option value="0-7 days">0-7 days</option>
              <option value="8-15 days">8-15 days</option>
              <option value="16-30 days">16-30 days</option>
              <option value="30+ days">30+ days</option>
            </select>

            {outstandingReport && (
              <div style={{ marginLeft: 'auto', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                Total: <strong>{formatCurrency(outstandingReport.total_outstanding)}</strong> ({outstandingReport.customer_count} shops)
              </div>
            )}
          </div>

          {/* Outstanding Table */}
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
                    <th>Total Outstanding</th>
                    <th>Aging</th>
                    <th>Last Payment</th>
                    <th>Last Order</th>
                    <th style={{ textAlign: 'right' }}>Reminder</th>
                  </tr>
                </thead>
                <tbody>
                  {outstandingReport && outstandingReport.customers.length > 0 ? (
                    outstandingReport.customers.map((c) => (
                      <tr key={c.customer_id}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{c.customer_name}</div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                            {c.owner_name} • {c.phone}
                          </div>
                        </td>
                        <td>
                          <span className="badge badge-neutral">{c.route_name}</span>
                        </td>
                        <td style={{ fontWeight: 700, color: '#dc2626' }}>
                          {formatCurrency(c.current_balance)}
                        </td>
                        <td>
                          <span 
                            className="badge" 
                            style={{
                              background: 
                                c.aging_bucket === '0-7 days' ? '#ecfdf5' : 
                                c.aging_bucket === '8-15 days' ? '#fefce8' : 
                                c.aging_bucket === '16-30 days' ? '#fff7ed' : '#fef2f2',
                              color: 
                                c.aging_bucket === '0-7 days' ? '#065f46' : 
                                c.aging_bucket === '8-15 days' ? '#854d0e' : 
                                c.aging_bucket === '16-30 days' ? '#9a3412' : '#991b1b',
                              fontWeight: 600
                            }}
                          >
                            {c.aging_bucket} ({c.days_outstanding}d)
                          </span>
                        </td>
                        <td>
                          {c.last_payment ? (
                            <div>
                              <span style={{ fontWeight: 600, color: '#059669' }}>{formatCurrency(c.last_payment.amount)}</span>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                {c.last_payment.date} via {c.last_payment.method}
                              </div>
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>No payment</span>
                          )}
                        </td>
                        <td>
                          {c.last_order ? (
                            <div>
                              <span style={{ fontWeight: 600 }}>{formatCurrency(c.last_order.amount)}</span>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                {c.last_order.date} ({c.last_order.order_number})
                              </div>
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>No orders</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {isWhatsAppEnabled && (
                            <button
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '0.2rem 0.5rem', fontSize: '0.78rem', color: '#047857', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                              onClick={() => {
                                const msg = generateBalanceReminderMessage({
                                  customerName: c.customer_name,
                                  outstandingBalance: c.current_balance,
                                  creditLimit: c.credit_limit,
                                  date: new Date().toLocaleDateString(),
                                });
                                openWhatsApp(c.phone, msg);
                              }}
                            >
                              <MessageSquare size={13} />
                              <span>WhatsApp</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                        No outstanding customers found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: DAILY FINANCIAL SUMMARY */}
      {activeTab === 'FINANCIAL_SUMMARY' && (
        <div>
          {/* Date Selector */}
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', alignItems: 'center' }}>
            <select
              className="form-select"
              style={{ width: '180px' }}
              value={datePreset}
              onChange={(e) => setDatePreset(e.target.value as DatePreset)}
            >
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="this_week">This Week</option>
              <option value="this_month">This Month</option>
            </select>
          </div>

          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center' }}>
              <div className="spinner" style={{ margin: '0 auto' }} />
            </div>
          ) : financialSummary ? (
            <div>
              {/* Top Level Financial Reconciliation Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
                <div style={{ background: 'white', padding: '1.25rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Gross Wholesale Sales</span>
                  <p style={{ fontSize: '1.75rem', fontWeight: 800, color: '#1e3a8a', marginTop: '0.3rem' }}>
                    {formatCurrency(financialSummary.sales)}
                  </p>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    {financialSummary.orders_count} confirmed orders
                  </span>
                </div>

                <div style={{ background: 'white', padding: '1.25rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Total Received Collections</span>
                  <p style={{ fontSize: '1.75rem', fontWeight: 800, color: '#059669', marginTop: '0.3rem' }}>
                    {formatCurrency(financialSummary.total_collected)}
                  </p>
                  <span style={{ fontSize: '0.78rem', color: '#059669' }}>
                    Cash: {formatCurrency(financialSummary.cash_collected)} • UPI: {formatCurrency(financialSummary.upi_collected)}
                  </span>
                </div>

                <div style={{ background: 'white', padding: '1.25rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Driver Operational Expenses</span>
                  <p style={{ fontSize: '1.75rem', fontWeight: 800, color: '#dc2626', marginTop: '0.3rem' }}>
                    {formatCurrency(financialSummary.driver_expenses)}
                  </p>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Fuel, maintenance, toll, food
                  </span>
                </div>

                <div style={{ background: 'white', padding: '1.25rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Staff Wages &amp; Advances</span>
                  <p style={{ fontSize: '1.75rem', fontWeight: 800, color: '#7c3aed', marginTop: '0.3rem' }}>
                    {formatCurrency(financialSummary.total_staff_payouts || '0.00')}
                  </p>
                  <span style={{ fontSize: '0.78rem', color: '#7c3aed' }}>
                    Cash: {formatCurrency(financialSummary.staff_cash_paid || '0.00')} • GPay: {formatCurrency(financialSummary.staff_gpay_paid || '0.00')}
                  </span>
                </div>

                <div style={{ background: '#0f172a', color: 'white', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid #1e293b' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#94a3b8' }}>Net Cashflow Handover</span>
                  <p style={{ fontSize: '1.85rem', fontWeight: 800, color: '#facc15', marginTop: '0.3rem' }}>
                    {formatCurrency(financialSummary.net_collection)}
                  </p>
                  <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                    Collections minus Expenses &amp; Staff Wages
                  </span>
                </div>
              </div>

              {/* Detailed Ledger Breakdown Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
                <div className="card" style={{ padding: '1.5rem', background: 'white' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text-primary)' }}>
                    Collection Allocation Breakdown
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', fontSize: '0.92rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Current Order Collections</span>
                      <strong style={{ color: '#059669' }}>{formatCurrency(financialSummary.today_order_collected)}</strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Previous Credit Debt Recovered</span>
                      <strong style={{ color: '#d97706' }}>{formatCurrency(financialSummary.previous_credit_collected)}</strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Cash Percentage</span>
                      <strong>
                        {parseFloat(financialSummary.total_collected) > 0 
                          ? `${((parseFloat(financialSummary.cash_collected) / parseFloat(financialSummary.total_collected)) * 100).toFixed(1)}%` 
                          : '0.0%'}
                      </strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>UPI / GPay Percentage</span>
                      <strong>
                        {parseFloat(financialSummary.total_collected) > 0 
                          ? `${((parseFloat(financialSummary.upi_collected) / parseFloat(financialSummary.total_collected)) * 100).toFixed(1)}%` 
                          : '0.0%'}
                      </strong>
                    </div>
                  </div>
                </div>

                <div className="card" style={{ padding: '1.5rem', background: 'white' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text-primary)' }}>
                    Credit & Receivables Audit
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', fontSize: '0.92rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>New Credit Generated</span>
                      <strong style={{ color: '#dc2626' }}>{formatCurrency(financialSummary.credit_generated)}</strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Active Receivables Pool</span>
                      <strong style={{ color: '#991b1b', fontSize: '1.05rem' }}>{formatCurrency(financialSummary.total_receivable)}</strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Net Daily Credit Change</span>
                      <strong style={{ color: parseFloat(financialSummary.credit_generated) - parseFloat(financialSummary.previous_credit_collected) >= 0 ? '#dc2626' : '#059669' }}>
                        {formatCurrency(parseFloat(financialSummary.credit_generated) - parseFloat(financialSummary.previous_credit_collected))}
                      </strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Audit Source</span>
                      <span className="badge badge-success">Live Database Ledger</span>
                    </div>
                  </div>
                </div>

                <div className="card" style={{ padding: '1.5rem', background: 'white' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text-primary)' }}>
                    Staff Wages &amp; Advances Payouts
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', fontSize: '0.92rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Staff Cash Wages Paid</span>
                      <strong style={{ color: '#16a34a' }}>- {formatCurrency(financialSummary.staff_cash_paid || '0.00')}</strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Staff GPay / UPI Wages Paid</span>
                      <strong style={{ color: '#2563eb' }}>- {formatCurrency(financialSummary.staff_gpay_paid || '0.00')}</strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Total Staff Deductions</span>
                      <strong style={{ color: '#7c3aed', fontSize: '1.05rem' }}>
                        - {formatCurrency(financialSummary.total_staff_payouts || '0.00')}
                      </strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Deduction Source</span>
                      <span className="badge badge-info">Attendance Sheet &amp; Wage Payouts</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <p style={{ color: 'var(--text-muted)' }}>No summary data available.</p>
          )}
        </div>
      )}
    </div>
  );
};
