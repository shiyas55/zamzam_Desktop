import React, { useEffect, useState } from 'react';
import { routeService, CreateDriverPayload } from '../../services/routeService';
import { Driver, Route } from '../../types';
import {
  Truck,
  Phone,
  Navigation,
  UserPlus,
  Search,
  Filter,
  X,
  Edit2,
  Trash2,
  CheckCircle,
  AlertCircle,
  FileText,
  UserCheck,
  ShieldCheck,
  AlertTriangle,
  Lock,
  Key,
} from 'lucide-react';

export const DriversPage: React.FC = () => {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRoute, setFilterRoute] = useState('');

  // Add Driver Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addFormData, setAddFormData] = useState<CreateDriverPayload>({
    name: '',
    username: '',
    password: 'zamzam123',
    phone_number: '',
    vehicle_number: '',
    license_number: '',
    assigned_route: '',
  });
  const [addingDriver, setAddingDriver] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Edit Driver Modal
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [editFormData, setEditFormData] = useState({
    name: '',
    assigned_route: '',
    phone_number: '',
    vehicle_number: '',
    license_number: '',
    password: '',
    is_active: true,
  });
  const [updatingDriver, setUpdatingDriver] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Delete Driver Modal
  const [deletingDriver, setDeletingDriver] = useState<Driver | null>(null);
  const [isDeletingDriver, setIsDeletingDriver] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Feedback Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [driverList, routeList] = await Promise.all([
        routeService.getDrivers(),
        routeService.getRoutes(),
      ]);
      setDrivers(driverList);
      setRoutes(routeList);
    } catch (err: unknown) {
      console.error('Failed to load drivers and routes:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Handle adding new driver
  const handleAddDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addFormData.name.trim()) {
      setAddError('Driver name is required.');
      return;
    }

    try {
      setAddingDriver(true);
      setAddError(null);

      await routeService.createDriver({
        name: addFormData.name.trim(),
        username: addFormData.username?.trim() || undefined,
        password: addFormData.password?.trim() || 'zamzam123',
        phone_number: addFormData.phone_number?.trim() || '',
        vehicle_number: addFormData.vehicle_number?.trim() || '',
        license_number: addFormData.license_number?.trim() || '',
        assigned_route: addFormData.assigned_route || null,
      });

      setIsAddModalOpen(false);
      setAddFormData({
        name: '',
        username: '',
        password: 'zamzam123',
        phone_number: '',
        vehicle_number: '',
        license_number: '',
        assigned_route: '',
      });
      showToast('New driver profile created successfully!');
      await loadData();
    } catch (err: any) {
      console.error('Failed to create driver:', err);
      const msg =
        err.response?.data?.name?.[0] ||
        err.response?.data?.username?.[0] ||
        err.response?.data?.detail ||
        (err instanceof Error ? err.message : 'Failed to create driver profile. Please check the inputs.');
      setAddError(msg);
    } finally {
      setAddingDriver(false);
    }
  };

  // Open edit modal
  const handleOpenEdit = (driver: Driver) => {
    setEditingDriver(driver);
    setEditFormData({
      name: driver.driver_name || '',
      assigned_route: driver.assigned_route || '',
      phone_number: driver.phone_number || driver.user_details?.phone_number || '',
      vehicle_number: driver.vehicle_number || '',
      license_number: driver.license_number || '',
      password: '',
      is_active: driver.is_active,
    });
    setEditError(null);
  };

  // Handle updating existing driver
  const handleUpdateDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDriver) return;

    try {
      setUpdatingDriver(true);
      setEditError(null);

      await routeService.updateDriver(editingDriver.id, {
        name: editFormData.name.trim() || undefined,
        assigned_route: editFormData.assigned_route || null,
        phone_number: editFormData.phone_number.trim(),
        vehicle_number: editFormData.vehicle_number.trim(),
        license_number: editFormData.license_number.trim(),
        password: editFormData.password.trim() || undefined,
        is_active: editFormData.is_active,
      });

      const updatedName = editFormData.name.trim() || editingDriver.driver_name;
      setEditingDriver(null);
      showToast(`Driver profile for ${updatedName} updated successfully!`);
      await loadData();
    } catch (err: any) {
      console.error('Failed to update driver:', err);
      const msg =
        err.response?.data?.detail ||
        (err instanceof Error ? err.message : 'Failed to update driver profile. Please check the inputs.');
      setEditError(msg);
    } finally {
      setUpdatingDriver(false);
    }
  };

  // Open delete modal
  const handleOpenDelete = (driver: Driver) => {
    setDeletingDriver(driver);
    setDeleteError(null);
  };

  // Handle delete driver
  const handleConfirmDelete = async () => {
    if (!deletingDriver) return;

    try {
      setIsDeletingDriver(true);
      setDeleteError(null);

      await routeService.deleteDriver(deletingDriver.id);
      const name = deletingDriver.driver_name;
      setDeletingDriver(null);
      showToast(`Driver profile for ${name} deleted successfully.`);
      await loadData();
    } catch (err: any) {
      console.error('Failed to delete driver:', err);
      const msg =
        err.response?.data?.detail ||
        (err instanceof Error ? err.message : 'Failed to delete driver profile. Ensure all active assignments are resolved.');
      setDeleteError(msg);
    } finally {
      setIsDeletingDriver(false);
    }
  };

  // Auto-generate username suggestion from name
  const handleNameChange = (name: string) => {
    const suggestedUsername = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]/g, '_')
      .slice(0, 20);

    setAddFormData((prev) => ({
      ...prev,
      name,
      username: prev.username && prev.username !== prev.name.toLowerCase().replace(/[^a-z0-9]/g, '_')
        ? prev.username
        : suggestedUsername ? `driver_${suggestedUsername}` : '',
    }));
  };

  // Filtered drivers list
  const filteredDrivers = drivers.filter((d) => {
    const matchesSearch =
      d.driver_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (d.user_details?.username || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (d.phone_number || '').includes(searchTerm) ||
      (d.vehicle_number || '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchesRoute = !filterRoute || d.assigned_route === filterRoute;

    return matchesSearch && matchesRoute;
  });

  const activeDriversCount = drivers.filter((d) => d.is_active).length;
  const routesCoveredCount = new Set(drivers.map((d) => d.assigned_route).filter(Boolean)).size;

  return (
    <div>
      {/* Toast Alert */}
      {toastMessage && (
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
          {toastMessage}
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
            Staff Drivers Fleet
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
            Staff drivers, delivery vehicles, assigned routes, and attendance-linked login accounts.
          </p>
        </div>

        <button
          className="btn btn-primary"
          onClick={() => {
            setAddError(null);
            setIsAddModalOpen(true);
          }}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}
        >
          <UserPlus size={18} />
          Add Staff Driver
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
            Total Fleet Size
          </span>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#dc2626', marginTop: '0.25rem' }}>
            {drivers.length} Staff Drivers
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Registered delivery staff drivers
          </div>
        </div>

        <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid #059669' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
            Active on Duty
          </span>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#059669', marginTop: '0.25rem' }}>
            {activeDriversCount} Active
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Enabled for order dispatch
          </div>
        </div>

        <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid #f59e0b' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
            Routes Covered
          </span>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#b45309', marginTop: '0.25rem' }}>
            {routesCoveredCount} of {routes.length} Routes
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Assigned delivery sectors
          </div>
        </div>
      </div>

      {/* Search and Route Filter Bar (Sticky for easy access) */}
      <div style={{
        display: 'flex',
        gap: '0.75rem',
        marginBottom: '1.5rem',
        flexWrap: 'wrap',
        position: 'sticky',
        top: 'var(--header-h)',
        zIndex: 10,
        background: 'var(--bg-main)',
        padding: '1rem 0',
        borderBottom: '1px solid var(--border)'
      }}>
        <div style={{ position: 'relative', flex: '1', minWidth: '240px' }}>
          <Search
            size={18}
            style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)',
            }}
          />
          <input
            type="text"
            className="form-input"
            style={{ paddingLeft: '38px', width: '100%' }}
            placeholder="Search driver name, username, phone, or vehicle plate..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <select
          className="form-select"
          style={{ minWidth: '180px' }}
          value={filterRoute}
          onChange={(e) => setFilterRoute(e.target.value)}
        >
          <option value="">All Routes</option>
          {routes.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name} ({r.code})
            </option>
          ))}
        </select>

        {(searchTerm || filterRoute) && (
          <button
            className="btn btn-secondary"
            onClick={() => {
              setSearchTerm('');
              setFilterRoute('');
            }}
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Driver Cards Grid */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
          <div className="spinner" />
        </div>
      ) : filteredDrivers.length === 0 ? (
        <div
          className="card"
          style={{
            padding: '3rem',
            textAlign: 'center',
            color: 'var(--text-muted)',
            borderRadius: '12px',
          }}
        >
          <Truck size={40} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
            No Staff Drivers Found
          </h3>
          <p style={{ fontSize: '0.88rem', marginBottom: '1.25rem' }}>
            {searchTerm || filterRoute
              ? 'No staff driver matches the current search or route filter.'
              : 'You have not added any staff drivers to the fleet yet.'}
          </p>
          <button
            className="btn btn-primary"
            onClick={() => setIsAddModalOpen(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <UserPlus size={16} /> Add First Staff Driver
          </button>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '1.25rem',
          }}
        >
          {filteredDrivers.map((d) => {
            const initials = d.driver_name
              .split(' ')
              .map((n) => n[0])
              .join('')
              .toUpperCase()
              .slice(0, 2);

            return (
              <div
                key={d.id}
                className="card"
                style={{
                  padding: '1.5rem',
                  borderRadius: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                  border: d.is_active ? '1px solid var(--border)' : '1px dashed #cbd5e1',
                  opacity: d.is_active ? 1 : 0.75,
                }}
              >
                <div>
                  {/* Top Bar with Avatar and Status */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '1rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div
                        style={{
                          width: '42px',
                          height: '42px',
                          borderRadius: '50%',
                          backgroundColor: '#fee2e2',
                          color: '#991b1b',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 800,
                          fontSize: '1rem',
                        }}
                      >
                        {initials || 'DR'}
                      </div>
                      <div>
                        <h3
                          style={{
                            fontSize: '1.15rem',
                            fontWeight: 800,
                            margin: 0,
                            color: 'var(--text-primary)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            maxWidth: '160px',
                          }}
                          title={d.driver_name}
                        >
                          {d.driver_name}
                        </h3>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          @{d.user_details?.username || 'driver'}
                        </span>
                      </div>
                    </div>

                    <span
                      className={`badge ${d.is_active ? 'badge-success' : 'badge-neutral'}`}
                      style={{ fontSize: '0.75rem', flexShrink: 0 }}
                    >
                      {d.is_active ? 'Active Staff Driver' : 'Inactive'}
                    </span>
                  </div>

                  {/* Info details box */}
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.6rem',
                      padding: '0.85rem',
                      background: 'var(--bg-muted, #f8fafc)',
                      borderRadius: '8px',
                      marginBottom: '1rem',
                      fontSize: '0.85rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', minWidth: 0 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', flexShrink: 0 }}>
                        <Navigation size={15} /> Assigned Route:
                      </span>
                      <span
                        className="badge badge-primary"
                        style={{
                          fontWeight: 700,
                          maxWidth: '170px',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          display: 'inline-block',
                        }}
                        title={d.assigned_route_details?.name || 'Unassigned / Floating'}
                      >
                        {d.assigned_route_details?.name || 'Unassigned / Floating'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', minWidth: 0 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', flexShrink: 0 }}>
                        <Truck size={15} /> Vehicle / Plate:
                      </span>
                      <strong
                        style={{
                          color: 'var(--text-primary)',
                          maxWidth: '170px',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          textAlign: 'right',
                        }}
                        title={d.vehicle_number || 'Van (Unassigned)'}
                      >
                        {d.vehicle_number || 'Van (Unassigned)'}
                      </strong>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)' }}>
                        <Phone size={15} /> Mobile Contact:
                      </span>
                      {d.phone_number || d.user_details?.phone_number ? (
                        <a
                          href={`tel:${d.phone_number || d.user_details?.phone_number}`}
                          style={{
                            color: 'var(--primary, #dc2626)',
                            fontWeight: 600,
                            textDecoration: 'none',
                          }}
                        >
                          {d.phone_number || d.user_details?.phone_number}
                        </a>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                      )}
                    </div>

                    {d.license_number && (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)' }}>
                          <FileText size={15} /> License:
                        </span>
                        <span style={{ color: 'var(--text-secondary)' }}>{d.license_number}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer action */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingTop: '0.85rem',
                    borderTop: '1px solid var(--border)',
                    flexWrap: 'wrap',
                    gap: '0.5rem',
                  }}
                >
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Deliveries today: <strong>{d.active_deliveries_count || 0}</strong>
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <button
                      className="btn btn-secondary"
                      onClick={() => handleOpenEdit(d)}
                      style={{
                        fontSize: '0.8rem',
                        padding: '5px 10px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        color: '#0284c7',
                      }}
                      title="Edit Driver Profile"
                    >
                      <Edit2 size={13} />
                      <span>Edit</span>
                    </button>

                    <button
                      className="btn btn-secondary"
                      onClick={() => handleOpenDelete(d)}
                      style={{
                        fontSize: '0.8rem',
                        padding: '5px 10px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        color: '#dc2626',
                      }}
                      title="Delete Driver Profile"
                    >
                      <Trash2 size={13} />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ----------------- ADD DRIVER PROFILE MODAL ----------------- */}
      {isAddModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1050,
            padding: '1rem',
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '520px',
              padding: '1.75rem',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
              borderRadius: '12px',
              backgroundColor: 'var(--card-bg, #ffffff)',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <UserPlus size={22} style={{ color: 'var(--primary, #dc2626)' }} />
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>
                  Add New Staff Driver
                </h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            {addError && (
              <div
                style={{
                  padding: '0.75rem 1rem',
                  backgroundColor: '#fee2e2',
                  color: '#991b1b',
                  borderRadius: '6px',
                  marginBottom: '1rem',
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <AlertCircle size={16} />
                {addError}
              </div>
            )}

            <form onSubmit={handleAddDriver}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                  Driver Full Name *
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Jamsheer K"
                  style={{ width: '100%' }}
                  value={addFormData.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    className="form-input"
                    placeholder="e.g. 9847123456"
                    style={{ width: '100%' }}
                    value={addFormData.phone_number}
                    onChange={(e) => setAddFormData({ ...addFormData, phone_number: e.target.value })}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                    Assigned Route
                  </label>
                  <select
                    className="form-select"
                    style={{ width: '100%' }}
                    value={addFormData.assigned_route || ''}
                    onChange={(e) => setAddFormData({ ...addFormData, assigned_route: e.target.value })}
                  >
                    <option value="">Unassigned / Floating</option>
                    {routes.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} ({r.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                    Vehicle / Van Plate
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. KL 53 H 4092"
                    style={{ width: '100%' }}
                    value={addFormData.vehicle_number}
                    onChange={(e) => setAddFormData({ ...addFormData, vehicle_number: e.target.value })}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                    Driving License No.
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. KL1020220019283"
                    style={{ width: '100%' }}
                    value={addFormData.license_number}
                    onChange={(e) => setAddFormData({ ...addFormData, license_number: e.target.value })}
                  />
                </div>
              </div>

              <div
                style={{
                  padding: '1rem',
                  backgroundColor: '#f1f5f9',
                  borderRadius: '8px',
                  marginBottom: '1.25rem',
                }}
              >
                <div style={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.6rem' }}>
                  Mobile App Login Credentials
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                      Login Username
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="driver_username"
                      style={{ width: '100%' }}
                      value={addFormData.username}
                      onChange={(e) => setAddFormData({ ...addFormData, username: e.target.value })}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                      Password
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="zamzam123"
                      style={{ width: '100%' }}
                      value={addFormData.password}
                      onChange={(e) => setAddFormData({ ...addFormData, password: e.target.value })}
                    />
                  </div>
                </div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.4rem' }}>
                  The driver will log into the Driver PWA app with these credentials to manage their deliveries.
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsAddModalOpen(false)}
                  disabled={addingDriver}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={addingDriver}
                  style={{ fontWeight: 700 }}
                >
                  {addingDriver ? 'Creating...' : 'Create Staff Driver'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ----------------- EDIT DRIVER PROFILE MODAL ----------------- */}
      {editingDriver && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1050,
            padding: '1rem',
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '520px',
              padding: '1.75rem',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
              borderRadius: '12px',
              backgroundColor: 'var(--card-bg, #ffffff)',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <Edit2 size={22} style={{ color: '#0284c7' }} />
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>
                    Edit Staff Driver Profile
                  </h3>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    @{editingDriver.user_details?.username || 'driver'}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setEditingDriver(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            {editError && (
              <div
                style={{
                  padding: '0.75rem 1rem',
                  backgroundColor: '#fee2e2',
                  color: '#991b1b',
                  borderRadius: '6px',
                  marginBottom: '1rem',
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <AlertCircle size={16} />
                {editError}
              </div>
            )}

            <form onSubmit={handleUpdateDriver}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                  Driver Full Name
                </label>
                <input
                  type="text"
                  className="form-input"
                  style={{ width: '100%' }}
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  placeholder="e.g. Jamsheer K"
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    className="form-input"
                    style={{ width: '100%' }}
                    value={editFormData.phone_number}
                    onChange={(e) => setEditFormData({ ...editFormData, phone_number: e.target.value })}
                    placeholder="e.g. 9847123456"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                    Assigned Route
                  </label>
                  <select
                    className="form-select"
                    style={{ width: '100%' }}
                    value={editFormData.assigned_route}
                    onChange={(e) => setEditFormData({ ...editFormData, assigned_route: e.target.value })}
                  >
                    <option value="">Unassigned / Floating</option>
                    {routes.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} ({r.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                    Vehicle Plate / Van
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    style={{ width: '100%' }}
                    value={editFormData.vehicle_number}
                    onChange={(e) => setEditFormData({ ...editFormData, vehicle_number: e.target.value })}
                    placeholder="e.g. KL 53 H 4092"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                    License Number
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    style={{ width: '100%' }}
                    value={editFormData.license_number}
                    onChange={(e) => setEditFormData({ ...editFormData, license_number: e.target.value })}
                    placeholder="e.g. KL1020220019283"
                  />
                </div>
              </div>

              <div style={{ marginBottom: '1rem', background: '#f8fafc', padding: '0.85rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                  <Lock size={14} color="#64748b" /> Reset Login Password (Optional)
                </label>
                <input
                  type="text"
                  className="form-input"
                  style={{ width: '100%' }}
                  value={editFormData.password}
                  onChange={(e) => setEditFormData({ ...editFormData, password: e.target.value })}
                  placeholder="Leave blank to keep unchanged"
                />
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.3rem' }}>
                  Only enter a new password if the driver forgot their credentials.
                </span>
              </div>

              <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  id="driver_active_checkbox"
                  checked={editFormData.is_active}
                  onChange={(e) => setEditFormData({ ...editFormData, is_active: e.target.checked })}
                  style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--primary)' }}
                />
                <label htmlFor="driver_active_checkbox" style={{ fontSize: '0.88rem', fontWeight: 600, cursor: 'pointer' }}>
                  Active Driver (available for order dispatch and route assignments)
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setEditingDriver(null)}
                  disabled={updatingDriver}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={updatingDriver}
                  style={{ fontWeight: 700 }}
                >
                  {updatingDriver ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ----------------- DELETE DRIVER CONFIRMATION MODAL ----------------- */}
      {deletingDriver && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1050,
            padding: '1rem',
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '480px',
              padding: '1.75rem',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
              borderRadius: '12px',
              backgroundColor: 'var(--card-bg, #ffffff)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '50%',
                  background: '#fee2e2',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <AlertTriangle size={24} color="#dc2626" />
              </div>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                  Delete Driver Profile?
                </h3>
                <p style={{ margin: '0.15rem 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  This will remove the driver profile and their app access.
                </p>
              </div>
            </div>

            {deleteError && (
              <div
                style={{
                  padding: '0.75rem 1rem',
                  backgroundColor: '#fee2e2',
                  color: '#991b1b',
                  borderRadius: '6px',
                  marginBottom: '1rem',
                  fontSize: '0.85rem',
                }}
              >
                {deleteError}
              </div>
            )}

            <div style={{ background: '#f8fafc', padding: '0.85rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '1.25rem' }}>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                {deletingDriver.driver_name} <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 400 }}>@{deletingDriver.user_details?.username}</span>
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                Assigned Route: <strong>{deletingDriver.assigned_route_details?.name || 'Unassigned'}</strong>
              </div>
              {deletingDriver.vehicle_number && (
                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                  Vehicle: {deletingDriver.vehicle_number}
                </div>
              )}
            </div>

            {(deletingDriver.active_deliveries_count || 0) > 0 && (
              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#b45309', padding: '0.65rem 0.85rem', borderRadius: '6px', fontSize: '0.8rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <AlertTriangle size={16} style={{ flexShrink: 0 }} />
                <span>Warning: This driver currently has {deletingDriver.active_deliveries_count} active deliveries today.</span>
              </div>
            )}

            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 0 1.25rem' }}>
              Are you sure you want to delete <strong>{deletingDriver.driver_name}</strong>?
            </p>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ flex: 1 }}
                onClick={() => setDeletingDriver(null)}
                disabled={isDeletingDriver}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                style={{ flex: 1, backgroundColor: '#dc2626', borderColor: '#dc2626', color: '#ffffff', fontWeight: 700 }}
                onClick={handleConfirmDelete}
                disabled={isDeletingDriver}
              >
                {isDeletingDriver ? 'Deleting...' : 'Yes, Delete Driver'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
