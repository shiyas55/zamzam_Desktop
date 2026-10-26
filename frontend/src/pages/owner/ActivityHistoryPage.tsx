import React, { useEffect, useState } from 'react';
import { auditService, ActivityFilterParams } from '../../services/auditService';
import { ActivityLog, ActivityActionType, ActivityEntityType, DatePreset } from '../../types';
import { formatDate } from '../../utils/formatters';
import {
  History,
  Calendar,
  Filter,
  RefreshCw,
  Search,
  User,
  Tag,
  ShoppingCart,
  Send,
  CreditCard,
  Receipt,
  Store,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';

export const ActivityHistoryPage: React.FC = () => {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [datePreset, setDatePreset] = useState<DatePreset>('today');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showCustomRange, setShowCustomRange] = useState(false);
  const [userRole, setUserRole] = useState('');
  const [actionType, setActionType] = useState<ActivityActionType | ''>('');
  const [entityType, setEntityType] = useState<ActivityEntityType | ''>('');
  const [search, setSearch] = useState('');

  const fetchLogs = async (overrideParams?: ActivityFilterParams, isAutoRetry = false) => {
    try {
      setLoading(true);
      setError(null);
      const params: ActivityFilterParams = overrideParams || {
        date_preset: datePreset,
        start_date: datePreset === 'custom' ? startDate : undefined,
        end_date: datePreset === 'custom' ? endDate : undefined,
        user_role: userRole || undefined,
        action_type: actionType ? actionType : undefined,
        entity_type: entityType ? entityType : undefined,
        search: search || undefined,
      };

      const data = await auditService.getActivityLogs(params);
      setLogs(data);
    } catch (err: unknown) {
      // If first attempt failed on server cold-start, automatically retry once after a short delay
      if (!isAutoRetry && err instanceof Error && err.message.includes('Unable to connect to the Zamzam server')) {
        setTimeout(() => {
          fetchLogs(overrideParams, true);
        }, 2000);
        return;
      }
      if (err instanceof Error) setError(err.message);
      else setError('Failed to load system activity logs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [datePreset, userRole, actionType, entityType]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchLogs();
  };

  const handleApplyCustomDates = (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || !endDate) return;
    setDatePreset('custom');
    fetchLogs({
      date_preset: 'custom',
      start_date: startDate,
      end_date: endDate,
      user_role: userRole || undefined,
      action_type: actionType ? actionType : undefined,
      entity_type: entityType ? entityType : undefined,
      search: search || undefined,
    });
  };

  const getEntityIcon = (type: ActivityEntityType) => {
    switch (type) {
      case 'ORDER':
        return <ShoppingCart size={15} color="var(--primary)" />;
      case 'PRICE':
        return <Tag size={15} color="#d97706" />;
      case 'PAYMENT':
        return <CreditCard size={15} color="#059669" />;
      case 'DELIVERY':
        return <Send size={15} color="#7c3aed" />;
      case 'EXPENSE':
        return <Receipt size={15} color="#dc2626" />;
      case 'CUSTOMER':
        return <Store size={15} color="#0891b2" />;
      default:
        return <History size={15} color="var(--primary)" />;
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'OWNER':
        return <span className="badge badge-danger">Owner</span>;
      case 'MANAGER':
        return <span className="badge badge-warning">Manager</span>;
      case 'DRIVER':
        return <span className="badge badge-neutral">Driver</span>;
      default:
        return <span className="badge badge-neutral">{role}</span>;
    }
  };

  const formatLogTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return isoString;
    }
  };

  const formatLogDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return isoString;
    }
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>
            System Activity History & Audit Log
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', margin: '0.2rem 0 0' }}>
            Audited business trail: orders, negotiated price overrides, collections, deliveries, and driver expenses.
          </p>
        </div>

        <button
          className="btn btn-secondary"
          onClick={() => fetchLogs()}
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
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.85rem', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Preset Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
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

          {/* Role, Action, Entity filters */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            {/* Role Filter */}
            <select
              className="form-input"
              style={{ padding: '0.3rem 0.55rem', fontSize: '0.82rem', minWidth: '100px' }}
              value={userRole}
              onChange={(e) => setUserRole(e.target.value)}
            >
              <option value="">All Roles</option>
              <option value="OWNER">Owner</option>
              <option value="MANAGER">Manager</option>
              <option value="DRIVER">Driver</option>
            </select>

            {/* Entity Filter */}
            <select
              className="form-input"
              style={{ padding: '0.3rem 0.55rem', fontSize: '0.82rem', minWidth: '110px' }}
              value={entityType}
              onChange={(e) => setEntityType(e.target.value as ActivityEntityType | '')}
            >
              <option value="">All Entities</option>
              <option value="ORDER">Orders</option>
              <option value="PRICE">Pricing</option>
              <option value="PAYMENT">Payments</option>
              <option value="DELIVERY">Deliveries</option>
              <option value="EXPENSE">Expenses</option>
              <option value="CUSTOMER">Customers</option>
            </select>

            {/* Action Filter */}
            <select
              className="form-input"
              style={{ padding: '0.3rem 0.55rem', fontSize: '0.82rem', minWidth: '110px' }}
              value={actionType}
              onChange={(e) => setActionType(e.target.value as ActivityActionType | '')}
            >
              <option value="">All Actions</option>
              <option value="CREATE">Created</option>
              <option value="UPDATE">Updated / Edited</option>
              <option value="DELETE">Deleted</option>
              <option value="CANCEL">Cancelled</option>
              <option value="DELIVER">Delivered</option>
              <option value="PAYMENT">Payment</option>
            </select>
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
              marginTop: '0.85rem',
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
              Apply Dates
            </button>
          </form>
        )}
      </div>

      {error && (
        <div
          style={{
            padding: '0.85rem 1.25rem',
            background: 'var(--danger-bg)',
            color: 'var(--danger)',
            borderRadius: 'var(--radius-md)',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShieldAlert size={18} style={{ flexShrink: 0 }} />
            <span style={{ fontSize: '0.86rem', fontWeight: 600 }}>{error}</span>
          </div>
          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={() => fetchLogs()}
            disabled={loading}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>Retry Connection</span>
          </button>
        </div>
      )}

      {/* Activity Timeline / Table */}
      <div className="card" style={{ padding: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <History size={18} color="var(--primary)" />
            <span>Activity Trail</span>
          </h3>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {logs.length} logged events
          </span>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem 0' }}>
            <div className="spinner" />
          </div>
        ) : logs.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {logs.map((log) => (
              <div
                key={log.id}
                style={{
                  padding: '0.85rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-main)',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: '1rem',
                  flexWrap: 'wrap',
                }}
              >
                {/* Left: Icon, Summary, Entity */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', flex: 1, minWidth: '260px' }}>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: '8px',
                      background: 'rgba(220, 38, 38, 0.08)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {getEntityIcon(log.entity_type)}
                  </div>

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                        {log.user_name}
                      </span>
                      {getRoleBadge(log.user_role)}
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                        {log.action_type_display || log.action} • {log.entity_type_display || log.entity_type}
                      </span>
                    </div>

                    <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                      {log.summary}
                    </p>

                    {/* Old Value -> New Value Diff Display if present in details */}
                    {log.details && (log.details.old_price || log.details.new_price) && (
                      <div
                        style={{
                          marginTop: '0.4rem',
                          padding: '0.35rem 0.65rem',
                          background: 'rgba(0,0,0,0.03)',
                          borderRadius: '6px',
                          fontSize: '0.78rem',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                        }}
                      >
                        {log.details.old_price && (
                          <span style={{ color: 'var(--text-muted)' }}>
                            Previous Rate: <strong style={{ color: '#dc2626' }}>₹{log.details.old_price}</strong>
                          </span>
                        )}
                        {log.details.old_price && log.details.new_price && (
                          <ArrowRight size={12} color="var(--text-muted)" />
                        )}
                        {log.details.new_price && (
                          <span style={{ color: 'var(--text-primary)' }}>
                            New Rate: <strong style={{ color: '#059669' }}>₹{log.details.new_price}</strong>
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: Timestamp */}
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                    {formatLogTime(log.timestamp || log.created_at || '')}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    {formatLogDate(log.timestamp || log.created_at || '')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
            No activity history records found for the selected filter period.
          </div>
        )}
      </div>
    </div>
  );
};
