import React, { useEffect, useState } from 'react';
import { routeService } from '../../services/routeService';
import { Route } from '../../types';
import { MapPin, Plus, X, Users, Store, Edit2, Trash2, Search, CheckCircle2, AlertTriangle, AlertCircle } from 'lucide-react';

export const RoutesPage: React.FC = () => {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Create Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Edit Modal State
  const [editingRoute, setEditingRoute] = useState<Route | null>(null);
  const [editName, setEditName] = useState('');
  const [editCode, setEditCode] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editIsActive, setEditIsActive] = useState(true);
  const [isEditingSubmitting, setIsEditingSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Delete Confirmation State
  const [deletingRoute, setDeletingRoute] = useState<Route | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Feedback Banner
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchRoutes = async () => {
    try {
      setLoading(true);
      const data = await routeService.getRoutes();
      setRoutes(data);
    } catch (err: unknown) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoutes();
  }, []);

  const handleCreateRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !code.trim()) {
      setError('Please provide route name and code.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await routeService.createRoute({ name: name.trim(), code: code.trim().toUpperCase(), description: description.trim() });
      setIsModalOpen(false);
      setName('');
      setCode('');
      setDescription('');
      setFeedback({ type: 'success', message: `Route "${name}" created successfully.` });
      fetchRoutes();
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
      else setError('Failed to create route');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenEdit = (route: Route) => {
    setEditingRoute(route);
    setEditName(route.name);
    setEditCode(route.code);
    setEditDescription(route.description || '');
    setEditIsActive(route.is_active !== false);
    setEditError(null);
  };

  const handleUpdateRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRoute) return;
    if (!editName.trim() || !editCode.trim()) {
      setEditError('Please provide route name and code.');
      return;
    }

    try {
      setIsEditingSubmitting(true);
      setEditError(null);
      await routeService.updateRoute(editingRoute.id, {
        name: editName.trim(),
        code: editCode.trim().toUpperCase(),
        description: editDescription.trim(),
        is_active: editIsActive,
      });
      setEditingRoute(null);
      setFeedback({ type: 'success', message: `Route "${editName}" updated successfully.` });
      fetchRoutes();
    } catch (err: unknown) {
      if (err instanceof Error) setEditError(err.message);
      else setEditError('Failed to update route');
    } finally {
      setIsEditingSubmitting(false);
    }
  };

  const handleDeleteRoute = async () => {
    if (!deletingRoute) return;
    try {
      setIsDeleting(true);
      setDeleteError(null);
      await routeService.deleteRoute(deletingRoute.id);
      setFeedback({ type: 'success', message: `Route "${deletingRoute.name}" deleted successfully.` });
      setDeletingRoute(null);
      fetchRoutes();
    } catch (err: unknown) {
      if (err instanceof Error) setDeleteError(err.message);
      else setDeleteError('Failed to delete route.');
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredRoutes = routes.filter((r) => {
    const q = searchQuery.toLowerCase();
    return (
      r.name.toLowerCase().includes(q) ||
      r.code.toLowerCase().includes(q) ||
      (r.description && r.description.toLowerCase().includes(q)) ||
      (r.active_driver_name && r.active_driver_name.toLowerCase().includes(q))
    );
  });

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Delivery Routes
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', margin: '0.25rem 0 0 0' }}>
            Territories serviced daily by dedicated drivers and delivery vans ({routes.length} total).
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
          <Plus size={18} />
          <span>Add New Route</span>
        </button>
      </div>

      {/* Global Feedback Banner */}
      {feedback && (
        <div
          style={{
            padding: '0.85rem 1rem',
            borderRadius: '10px',
            marginBottom: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: feedback.type === 'success' ? '#f0fdf4' : '#fef2f2',
            border: `1px solid ${feedback.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
            color: feedback.type === 'success' ? '#166534' : '#991b1b',
            fontSize: '0.88rem',
            fontWeight: 500,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            {feedback.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
            <span>{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit' }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input
            type="text"
            className="form-input"
            style={{ paddingLeft: '2.4rem' }}
            placeholder="Search routes by name, code, driver..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
          <div className="spinner" />
        </div>
      ) : filteredRoutes.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', background: 'white', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
          <MapPin size={40} style={{ color: '#cbd5e1', marginBottom: '0.75rem' }} />
          <h3 style={{ fontSize: '1.1rem', color: 'var(--text-primary)', fontWeight: 600 }}>No routes found</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            {searchQuery ? 'Try matching a different keyword.' : 'Click "Add New Route" to get started.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
          {filteredRoutes.map((r) => (
            <div
              key={r.id}
              style={{
                background: 'white',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border)',
                padding: '1.5rem',
                boxShadow: 'var(--shadow-sm)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                minWidth: 0,
                overflow: 'hidden',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <span className="badge badge-info" style={{ fontSize: '0.82rem', padding: '0.2rem 0.6rem', fontWeight: 700 }}>
                    {r.code}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {r.is_active !== false ? (
                      <span className="badge badge-success">Active Route</span>
                    ) : (
                      <span className="badge badge-warning" style={{ background: '#fef3c7', color: '#b45309' }}>Inactive</span>
                    )}
                  </div>
                </div>

                <h3
                  style={{
                    fontSize: '1.2rem',
                    fontWeight: 700,
                    marginBottom: '0.5rem',
                    color: 'var(--text-primary)',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    overflowWrap: 'anywhere',
                    wordBreak: 'break-word',
                    lineHeight: 1.3,
                  }}
                  title={r.name}
                >
                  {r.name}
                </h3>
                <p
                  style={{
                    fontSize: '0.85rem',
                    color: 'var(--text-secondary)',
                    marginBottom: '1.25rem',
                    minHeight: '38px',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    overflowWrap: 'anywhere',
                    wordBreak: 'break-word',
                    lineHeight: 1.4,
                  }}
                  title={r.description || 'Primary distribution route'}
                >
                  {r.description || 'Primary distribution route'}
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.85rem', background: '#f8fafc', borderRadius: 'var(--radius-md)', marginBottom: '1.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)' }}>
                      <Users size={16} /> Driver:
                    </span>
                    <span style={{ fontWeight: 600 }}>{r.active_driver_name || 'Unassigned'}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)' }}>
                      <Store size={16} /> Active Shops:
                    </span>
                    <span style={{ fontWeight: 600, color: (r.customer_count || 0) > 0 ? '#0284c7' : '#64748b' }}>
                      {r.customer_count || 0} shops
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons: Edit & Delete */}
              <div style={{ display: 'flex', gap: '0.6rem', borderTop: '1px solid #f1f5f9', paddingTop: '1rem' }}>
                <button
                  type="button"
                  onClick={() => handleOpenEdit(r)}
                  style={{
                    flex: 1,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.35rem',
                    padding: '0.5rem',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    background: '#ffffff',
                    color: '#334155',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#0284c7';
                    e.currentTarget.style.color = '#0284c7';
                    e.currentTarget.style.background = '#f0f9ff';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#e2e8f0';
                    e.currentTarget.style.color = '#334155';
                    e.currentTarget.style.background = '#ffffff';
                  }}
                >
                  <Edit2 size={14} />
                  <span>Edit</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setDeletingRoute(r);
                    setDeleteError(null);
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.35rem',
                    padding: '0.5rem 0.85rem',
                    borderRadius: '8px',
                    border: '1px solid #fee2e2',
                    background: '#fff5f5',
                    color: '#dc2626',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#dc2626';
                    e.currentTarget.style.background = '#dc2626';
                    e.currentTarget.style.color = '#ffffff';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#fee2e2';
                    e.currentTarget.style.background = '#fff5f5';
                    e.currentTarget.style.color = '#dc2626';
                  }}
                  title="Delete Route"
                >
                  <Trash2 size={14} />
                  <span>Delete</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Route Modal */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>Add Delivery Route</h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            {error && (
              <div style={{ background: 'var(--danger-bg)', color: 'var(--danger)', padding: '0.75rem', borderRadius: 'var(--radius-md)', marginBottom: '1rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleCreateRoute}>
              <div className="form-group">
                <label className="form-label">Route Name *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Manjeri Highway"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label className="form-label">Route Code *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. MJR"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Route Description</label>
                <textarea
                  className="form-textarea"
                  rows={2}
                  placeholder="Territory description, towns, checkpoints"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setIsModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={isSubmitting}>
                  {isSubmitting ? 'Creating...' : 'Create Route'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Route Modal */}
      {editingRoute && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>Edit Delivery Route</h3>
              <button
                type="button"
                onClick={() => setEditingRoute(null)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            {editError && (
              <div style={{ background: 'var(--danger-bg)', color: 'var(--danger)', padding: '0.75rem', borderRadius: 'var(--radius-md)', marginBottom: '1rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertCircle size={16} />
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleUpdateRoute}>
              <div className="form-group">
                <label className="form-label">Route Name *</label>
                <input
                  type="text"
                  className="form-input"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Route Code *</label>
                <input
                  type="text"
                  className="form-input"
                  value={editCode}
                  onChange={(e) => setEditCode(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Route Description</label>
                <textarea
                  className="form-textarea"
                  rows={2}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '1rem 0' }}>
                <input
                  type="checkbox"
                  id="editIsActive"
                  checked={editIsActive}
                  onChange={(e) => setEditIsActive(e.target.checked)}
                  style={{ width: '16px', height: '16px', accentColor: '#dc2626' }}
                />
                <label htmlFor="editIsActive" style={{ fontSize: '0.88rem', fontWeight: 600, color: '#334155', cursor: 'pointer' }}>
                  Route Active & Dispatchable
                </label>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setEditingRoute(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={isEditingSubmitting}>
                  {isEditingSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Route Confirmation Modal */}
      {deletingRoute && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '440px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', color: '#dc2626' }}>
              <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Trash2 size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                  Delete Delivery Route?
                </h3>
                <span style={{ fontSize: '0.82rem', color: '#64748b' }}>This action cannot be undone.</span>
              </div>
            </div>

            {deleteError && (
              <div style={{ background: 'var(--danger-bg)', color: 'var(--danger)', padding: '0.75rem', borderRadius: 'var(--radius-md)', marginBottom: '1rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertCircle size={16} />
                <span>{deleteError}</span>
              </div>
            )}

            <p style={{ fontSize: '0.9rem', color: '#334155', lineHeight: 1.5, marginBottom: '1.25rem' }}>
              Are you sure you want to permanently delete <strong>"{deletingRoute.name}"</strong> (Code: <code>{deletingRoute.code}</code>)?
            </p>

            {(deletingRoute.customer_count || 0) > 0 && (
              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '0.75rem', color: '#92400e', fontSize: '0.82rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                <span>
                  <strong>Warning:</strong> This route currently has <strong>{deletingRoute.customer_count}</strong> active shop(s). You must reassign or remove them before deleting this route.
                </span>
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ flex: 1 }}
                onClick={() => setDeletingRoute(null)}
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                style={{ flex: 1, background: '#dc2626', borderColor: '#dc2626', color: 'white' }}
                onClick={handleDeleteRoute}
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
