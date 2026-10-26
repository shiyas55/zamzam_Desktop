import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { customerService } from '../../services/customerService';
import { routeService } from '../../services/routeService';
import { productService } from '../../services/productService';
import { Customer, Route, Product } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import { 
  Plus, Search, Store, AlertCircle, X, ChevronRight, Eye, Tag, 
  ExternalLink, Copy, Check, Smartphone, Edit2, Trash2, AlertTriangle, 
  CheckCircle2, Save, FileText, FolderArchive, MessageCircle 
} from 'lucide-react';
import { CustomerStatementModal } from '../../components/CustomerStatementModal';
import { BulkSendCustomerStatementsModal } from '../../components/BulkSendCustomerStatementsModal';

export const CustomerShopsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBulkStatementModalOpen, setIsBulkStatementModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [statementCustomer, setStatementCustomer] = useState<Customer | null>(null);

  // Create Form State
  const [name, setName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [alternativePhone, setAlternativePhone] = useState('');
  const [address, setAddress] = useState('');
  const [landmark, setLandmark] = useState('');
  const [routeId, setRouteId] = useState('');
  const [creditLimit, setCreditLimit] = useState('5000.00');
  const [notes, setNotes] = useState('');
  const [availableProducts, setAvailableProducts] = useState<Product[]>([]);
  const [productPrices, setProductPrices] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit Modal State
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [editName, setEditName] = useState('');
  const [editOwnerName, setEditOwnerName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAlternativePhone, setEditAlternativePhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editLandmark, setEditLandmark] = useState('');
  const [editRouteId, setEditRouteId] = useState('');
  const [editCreditLimit, setEditCreditLimit] = useState('5000.00');
  const [editDueBalance, setEditDueBalance] = useState('0.00');
  const [editIsActive, setEditIsActive] = useState(true);
  const [editNotes, setEditNotes] = useState('');
  const [editProductPrices, setEditProductPrices] = useState<Record<string, string>>({});
  const [editPricingLoading, setEditPricingLoading] = useState(false);
  const [editFormError, setEditFormError] = useState<string | null>(null);
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);

  // Delete Modal State
  const [deletingCustomer, setDeletingCustomer] = useState<Customer | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeletingSubmitting, setIsDeletingSubmitting] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [custList, routeList, prodList] = await Promise.all([
        customerService.getCustomers(selectedRoute || undefined, debouncedSearch || undefined),
        routeService.getRoutes(),
        productService.getProducts(),
      ]);
      setCustomers(custList);
      setRoutes(routeList);
      setAvailableProducts(prodList);
      
      // Initialize product prices with default product unit_price
      const initialPrices: Record<string, string> = {};
      prodList.forEach((p) => {
        initialPrices[p.id] = p.unit_price;
      });
      setProductPrices(initialPrices);

      if (routeList.length > 0 && !routeId) {
        setRouteId(routeList[0].id);
      }
    } catch (err: unknown) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedRoute, debouncedSearch]);

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim() || !address.trim() || !routeId) {
      setFormError('Please fill in shop name, phone, address, and select a route.');
      return;
    }

    try {
      setIsSubmitting(true);
      setFormError(null);

      // Package customer product wholesale prices
      const product_prices = availableProducts
        .filter((p) => productPrices[p.id] !== undefined && productPrices[p.id] !== null && String(productPrices[p.id]).trim() !== '')
        .map((p) => ({
          product_id: p.id,
          price: String(productPrices[p.id]).trim(),
        }));

      await customerService.createCustomer({
        name: name.trim(),
        owner_name: ownerName.trim() || undefined,
        phone: phone.trim(),
        alternative_phone: alternativePhone.trim() || undefined,
        address: address.trim(),
        landmark: landmark.trim() || undefined,
        route: routeId,
        credit_limit: creditLimit || '5000.00',
        notes: notes.trim() || undefined,
        product_prices: product_prices.length > 0 ? product_prices : undefined,
      });

      setIsModalOpen(false);
      setName('');
      setOwnerName('');
      setPhone('');
      setAlternativePhone('');
      setAddress('');
      setLandmark('');
      setCreditLimit('5000.00');
      setNotes('');
      // Reset product prices to defaults
      const resetPrices: Record<string, string> = {};
      availableProducts.forEach((p) => {
        resetPrices[p.id] = p.unit_price;
      });
      setProductPrices(resetPrices);

      showToast(`Shop "${name.trim()}" created successfully!`);
      fetchData();
    } catch (err: unknown) {
      if (err instanceof Error) setFormError(err.message);
      else setFormError('Failed to create customer');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenEditModal = async (c: Customer) => {
    setEditingCustomer(c);
    setEditName(c.name || '');
    setEditOwnerName(c.owner_name || '');
    setEditPhone(c.phone || '');
    setEditAlternativePhone(c.alternative_phone || '');
    setEditAddress(c.address || '');
    setEditLandmark(c.landmark || '');
    const rId = typeof c.route === 'string' ? c.route : c.route_details?.id || (routes[0]?.id ?? '');
    setEditRouteId(rId);
    setEditCreditLimit(c.credit_limit || '5000.00');
    setEditDueBalance(String(c.current_balance || '0.00'));
    setEditIsActive(c.is_active ?? true);
    setEditNotes(c.notes || '');
    setEditFormError(null);

    // Default prices from products
    const initialEditPrices: Record<string, string> = {};
    availableProducts.forEach((p) => {
      initialEditPrices[p.id] = String(p.unit_price ?? '');
    });
    setEditProductPrices(initialEditPrices);

    // Fetch existing customer-specific wholesale pricing
    try {
      setEditPricingLoading(true);
      const customerPricingList = await customerService.getCustomerPricing(c.id);
      const mergedPrices: Record<string, string> = { ...initialEditPrices };
      customerPricingList.forEach((item) => {
        const val = item.effective_price ?? item.default_price;
        if (val !== undefined && val !== null) {
          mergedPrices[item.product_id] = String(val);
        }
      });
      setEditProductPrices(mergedPrices);
    } catch (e) {
      console.error('Failed to load customer prices for edit modal:', e);
    } finally {
      setEditPricingLoading(false);
    }
  };

  const handleUpdateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCustomer) return;
    if (!editName.trim() || !editPhone.trim() || !editAddress.trim() || !editRouteId) {
      setEditFormError('Please fill in shop name, phone, address, and select a route.');
      return;
    }

    try {
      setIsEditSubmitting(true);
      setEditFormError(null);

      // Package updated customer product wholesale prices
      const product_prices = availableProducts
        .filter((p) => editProductPrices[p.id] !== undefined && editProductPrices[p.id] !== null && String(editProductPrices[p.id]).trim() !== '')
        .map((p) => ({
          product_id: p.id,
          price: String(editProductPrices[p.id]).trim(),
        }));

      await customerService.updateCustomer(editingCustomer.id, {
        name: editName.trim(),
        owner_name: editOwnerName.trim(),
        phone: editPhone.trim(),
        alternative_phone: editAlternativePhone.trim(),
        address: editAddress.trim(),
        landmark: editLandmark.trim(),
        route: editRouteId,
        credit_limit: editCreditLimit,
        is_active: editIsActive,
        notes: editNotes.trim(),
        product_prices: product_prices.length > 0 ? product_prices : undefined,
      });

      // Update Due Balance if modified by manager/owner
      if (
        editDueBalance.trim() !== '' &&
        !isNaN(Number(editDueBalance)) &&
        Number(editDueBalance) !== Number(editingCustomer.current_balance || 0)
      ) {
        await customerService.setBalance(
          editingCustomer.id,
          editDueBalance.trim(),
          undefined,
          'Corrected via Customer Shops Management'
        );
      }

      const updatedName = editName.trim();
      setEditingCustomer(null);
      showToast(`Shop "${updatedName}" updated successfully!`);
      fetchData();
    } catch (err: unknown) {
      if (err instanceof Error) setEditFormError(err.message);
      else setEditFormError('Failed to update customer');
    } finally {
      setIsEditSubmitting(false);
    }
  };

  const handleOpenDeleteModal = (c: Customer) => {
    setDeletingCustomer(c);
    setDeleteError(null);
  };

  const handleConfirmDelete = async () => {
    if (!deletingCustomer) return;

    try {
      setIsDeletingSubmitting(true);
      setDeleteError(null);

      await customerService.deleteCustomer(deletingCustomer.id);
      const deletedName = deletingCustomer.name;
      setDeletingCustomer(null);
      showToast(`Shop "${deletedName}" deleted successfully.`);
      fetchData();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setDeleteError(err.message);
      } else {
        setDeleteError('Failed to delete customer shop. Make sure there are no conflicting dependencies.');
      }
    } finally {
      setIsDeletingSubmitting(false);
    }
  };

  const handleViewCustomer = (customerId: string) => {
    const basePath = user?.role === 'MANAGER' ? '/manager' : '/owner';
    navigate(`${basePath}/customers/${customerId}`);
  };

  return (
    <div>
      {/* Success Notification Toast */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            top: '1.5rem',
            right: '1.5rem',
            backgroundColor: '#065f46',
            color: '#ffffff',
            padding: '0.85rem 1.25rem',
            borderRadius: '10px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            zIndex: 9999,
            fontSize: '0.9rem',
            fontWeight: 600,
            animation: 'fadeIn 0.25s ease-out',
          }}
        >
          <CheckCircle2 size={18} color="#34d399" />
          <span>{toastMessage}</span>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Customer Shops Management
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
            Directory of retail bakeries, tea stalls, and wholesale restaurants.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setIsBulkStatementModalOpen(true)}
            style={{
              backgroundColor: '#047857',
              color: '#ffffff',
              border: 'none',
              fontWeight: 800,
              fontSize: '0.86rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              boxShadow: '0 2px 4px rgba(4, 120, 87, 0.25)',
              padding: '0.5rem 0.95rem',
              borderRadius: '8px',
            }}
            title="Bulk Send Due Statements / Monthly Reports on WhatsApp"
          >
            <MessageCircle size={16} />
            <span>Send Due Statements on WhatsApp ({customers.filter((c) => Number(c.current_balance) > 0).length})</span>
          </button>

          <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
            <Plus size={18} />
            <span>Add New Shop</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
          <Search size={18} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="form-input"
            style={{ paddingLeft: '2.5rem' }}
            placeholder="Search by shop name, owner, or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select
          className="form-select"
          style={{ width: '260px' }}
          value={selectedRoute}
          onChange={(e) => setSelectedRoute(e.target.value)}
        >
          <option value="">All Delivery Routes ({routes.reduce((acc, r) => acc + (r.customer_count || 0), 0)} Shops)</option>
          {routes.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name} ({r.code}) {r.customer_count !== undefined ? `• ${r.customer_count} Shops` : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="table-container" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center' }}>
            <div className="spinner" style={{ margin: '0 auto' }} />
          </div>
        ) : (
          <table className="data-table" style={{ minWidth: '1020px', width: '100%' }}>
            <thead>
              <tr>
                <th style={{ minWidth: '150px' }}>Shop Name</th>
                <th style={{ minWidth: '140px' }}>Owner / Contact</th>
                <th style={{ minWidth: '130px' }}>Route</th>
                <th style={{ minWidth: '160px' }}>Address</th>
                <th style={{ minWidth: '120px', textAlign: 'right' }}>Current Balance</th>
                <th style={{ minWidth: '110px' }}>Status</th>
                <th style={{ minWidth: '200px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {customers.length > 0 ? (
                customers.map((c) => (
                  <tr key={c.id}>
                    {/* 1. Shop Name */}
                    <td style={{ minWidth: '150px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{c.name}</span>
                        {!c.is_active && (
                          <span className="badge badge-neutral" style={{ fontSize: '0.65rem' }}>Inactive</span>
                        )}
                      </div>
                    </td>

                    {/* 2. Owner / Contact */}
                    <td style={{ minWidth: '140px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.86rem' }}>
                        {c.owner_name || '—'}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        {c.phone}
                        {c.alternative_phone && ` • ${c.alternative_phone}`}
                      </div>
                    </td>

                    {/* 3. Route */}
                    <td style={{ minWidth: '130px', maxWidth: '170px' }}>
                      <span
                        className="badge badge-neutral"
                        style={{
                          maxWidth: '155px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          display: 'inline-block',
                          verticalAlign: 'middle',
                        }}
                        title={c.route_details?.name || 'Assigned'}
                      >
                        {c.route_details?.name || 'Assigned'}
                      </span>
                    </td>

                    {/* 4. Address */}
                    <td style={{ minWidth: '160px', maxWidth: '210px' }}>
                      <div
                        style={{
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          fontSize: '0.84rem',
                        }}
                        title={c.address}
                      >
                        {c.address || '—'}
                      </div>
                      {c.landmark && (
                        <div
                          style={{
                            fontSize: '0.74rem',
                            color: 'var(--text-muted)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                          title={`Landmark: ${c.landmark}`}
                        >
                          Near: {c.landmark}
                        </div>
                      )}
                    </td>

                    {/* 5. Current Balance */}
                    <td
                      style={{
                        minWidth: '130px',
                        textAlign: 'right',
                        fontWeight: 700,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: '5px' }}>
                        <span
                          style={{
                            fontWeight: 800,
                            fontFamily: 'monospace',
                            color: c.is_credit_exceeded || Number(c.current_balance) > 0 ? '#b91c1c' : 'var(--text-primary)',
                          }}
                        >
                          {formatCurrency(c.current_balance)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(c)}
                          title="Correct or adjust this shop's due balance"
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#94a3b8',
                            cursor: 'pointer',
                            padding: '2px',
                            display: 'inline-flex',
                            alignItems: 'center',
                          }}
                        >
                          <Edit2 size={11} />
                        </button>
                      </div>
                    </td>

                    {/* 6. Status */}
                    <td style={{ minWidth: '110px', whiteSpace: 'nowrap' }}>
                      {c.is_credit_exceeded ? (
                        <span className="badge badge-danger">Credit Exceeded</span>
                      ) : (
                        <span className="badge badge-success">Good Standing</span>
                      )}
                    </td>

                    {/* 7. Actions (Responsive & zoom-proof with nowrap) */}
                    <td style={{ minWidth: '200px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'flex-end',
                          gap: '0.3rem',
                          flexWrap: 'nowrap',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {/* Edit Button */}
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleOpenEditModal(c)}
                          title="Edit Customer Shop Details"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', height: '28px', padding: '0 0.45rem' }}
                        >
                          <Edit2 size={12} />
                          <span>Edit</span>
                        </button>

                        {/* Profile & Pricing */}
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleViewCustomer(c.id)}
                          title="View Customer Profile & Wholesale Pricing"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', height: '28px', padding: '0 0.45rem' }}
                        >
                          <Eye size={12} />
                          <span>Profile</span>
                        </button>

                        {/* Statement Print / Share */}
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => setStatementCustomer(c)}
                          title="Print Customer Account Statement & Ledger"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: '#b91c1c', height: '28px', padding: '0 0.45rem' }}
                        >
                          <FileText size={12} />
                          <span>Statement</span>
                        </button>

                        {/* Shop Documents Storage */}
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => {
                            const basePath = user?.role === 'MANAGER' ? '/manager' : '/owner';
                            navigate(`${basePath}/customers/${c.id}?tab=documents`);
                          }}
                          title="View & Upload Shop Documents"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', height: '28px', padding: '0 0.45rem' }}
                        >
                          <FolderArchive size={12} />
                          <span>Docs{c.documents_count ? ` (${c.documents_count})` : ''}</span>
                        </button>

                        {/* Delete Button */}
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleOpenDeleteModal(c)}
                          title="Delete Customer Shop"
                          style={{ display: 'inline-flex', alignItems: 'center', color: '#dc2626', height: '28px', padding: '0 0.45rem' }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    No customer shops found matching the search criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Add Customer Modal */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '650px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Store size={22} color="var(--primary)" />
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Add New Customer Shop</h3>
              </div>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            {formError && (
              <div style={{ background: 'var(--danger-bg)', color: 'var(--danger)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', marginBottom: '1rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreateCustomer}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Shop Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Malabar Bakery"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Proprietor / Contact Person</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Yousuf"
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Primary Phone Number *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. 9847000000"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Alternative Phone</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. 9847111111"
                    value={alternativePhone}
                    onChange={(e) => setAlternativePhone(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Delivery Route *</label>
                  <select
                    className="form-select"
                    value={routeId}
                    onChange={(e) => setRouteId(e.target.value)}
                    required
                  >
                    {routes.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} ({r.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Credit Limit (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="form-input"
                    placeholder="5000.00"
                    value={creditLimit}
                    onChange={(e) => setCreditLimit(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Location / Street Address *</label>
                <textarea
                  className="form-textarea"
                  rows={2}
                  placeholder="Street / building / locality"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Nearby Landmark</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Opp. City Hospital"
                  value={landmark}
                  onChange={(e) => setLandmark(e.target.value)}
                />
              </div>

              {/* Wholesale Product Pricing Assignment */}
              {availableProducts.length > 0 && (
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 'var(--radius-md)', padding: '0.85rem', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem' }}>
                    <Tag size={16} color="var(--primary)" />
                    <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      Assign Product Wholesale Pricing (₹)
                    </span>
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                    Set customer-specific unit prices for this shop. Defaults to standard base wholesale prices.
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
                    {availableProducts.map((p) => (
                      <div key={p.id} style={{ background: '#ffffff', padding: '0.65rem 0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid #cbd5e1' }}>
                        <div style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                          {p.name}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                          Standard: ₹{Number(p.unit_price).toFixed(2)}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--primary)' }}>₹</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            className="form-input"
                            style={{ padding: '0.3rem 0.5rem', fontSize: '0.88rem', fontWeight: 600 }}
                            value={productPrices[p.id] ?? p.unit_price}
                            onChange={(e) => setProductPrices({ ...productPrices, [p.id]: e.target.value })}
                            placeholder={p.unit_price}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Notes / Delivery Preferences</label>
                <textarea
                  className="form-textarea"
                  rows={2}
                  placeholder="e.g. Early morning delivery preferred, payment on Saturdays"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Saving...' : 'Create Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Customer Modal */}
      {editingCustomer && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '650px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Edit2 size={22} color="#0284c7" />
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Edit Customer Shop</h3>
              </div>
              <button onClick={() => setEditingCustomer(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            {editFormError && (
              <div style={{ background: 'var(--danger-bg)', color: 'var(--danger)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', marginBottom: '1rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{editFormError}</span>
              </div>
            )}

            <form onSubmit={handleUpdateCustomer}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Shop Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Proprietor / Contact Person</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editOwnerName}
                    onChange={(e) => setEditOwnerName(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Primary Phone Number *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Alternative Phone</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editAlternativePhone}
                    onChange={(e) => setEditAlternativePhone(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Delivery Route *</label>
                  <select
                    className="form-select"
                    value={editRouteId}
                    onChange={(e) => setEditRouteId(e.target.value)}
                    required
                  >
                    {routes.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} ({r.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Credit Limit (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="form-input"
                    value={editCreditLimit}
                    onChange={(e) => setEditCreditLimit(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>Current Outstanding Due (₹)</span>
                    <span style={{ fontSize: '0.72rem', color: '#b91c1c', fontWeight: 700 }}>Direct Balance Edit</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-input"
                    style={{ fontWeight: 800, color: '#b91c1c' }}
                    value={editDueBalance}
                    onChange={(e) => setEditDueBalance(e.target.value)}
                    placeholder="0.00"
                  />
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                    Set or correct this shop's current outstanding receivable due.
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Location / Street Address *</label>
                <textarea
                  className="form-textarea"
                  rows={2}
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Nearby Landmark</label>
                <input
                  type="text"
                  className="form-input"
                  value={editLandmark}
                  onChange={(e) => setEditLandmark(e.target.value)}
                />
              </div>

              {/* Wholesale Product Pricing Assignment in Edit Modal */}
              {availableProducts.length > 0 && (
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 'var(--radius-md)', padding: '0.85rem', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Tag size={16} color="var(--primary)" />
                      <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        Wholesale Product Rates (₹)
                      </span>
                    </div>
                    {editPricingLoading && (
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Loading customer rates...</span>
                    )}
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                    Adjust custom unit prices for this customer. Orders for this shop will automatically use these rates.
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
                    {availableProducts.map((p) => (
                      <div key={p.id} style={{ background: '#ffffff', padding: '0.65rem 0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid #cbd5e1' }}>
                        <div style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                          {p.name}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                          Standard: ₹{Number(p.unit_price).toFixed(2)}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--primary)' }}>₹</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            className="form-input"
                            style={{ padding: '0.3rem 0.5rem', fontSize: '0.88rem', fontWeight: 600 }}
                            value={editProductPrices[p.id] ?? p.unit_price}
                            onChange={(e) => setEditProductPrices({ ...editProductPrices, [p.id]: e.target.value })}
                            placeholder={p.unit_price}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600 }}>
                  <input
                    type="checkbox"
                    checked={editIsActive}
                    onChange={(e) => setEditIsActive(e.target.checked)}
                    style={{ width: '18px', height: '18px', accentColor: 'var(--primary)' }}
                  />
                  <span>Active Customer (Eligible for orders & deliveries)</span>
                </label>
              </div>

              <div className="form-group">
                <label className="form-label">Notes / Preferences</label>
                <textarea
                  className="form-textarea"
                  rows={2}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                  onClick={() => setEditingCustomer(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                  disabled={isEditSubmitting}
                >
                  {isEditSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Customer Confirmation Modal */}
      {deletingCustomer && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', color: '#dc2626' }}>
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
                  Delete Customer Shop?
                </h3>
                <p style={{ margin: '0.15rem 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  This action will permanently delete this shop record.
                </p>
              </div>
            </div>

            {deleteError && (
              <div style={{ background: 'var(--danger-bg)', color: 'var(--danger)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', marginBottom: '1rem', fontSize: '0.85rem' }}>
                {deleteError}
              </div>
            )}

            <div style={{ background: '#f8fafc', padding: '0.85rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid #e2e8f0', marginBottom: '1.25rem' }}>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                {deletingCustomer.name}
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                Phone: {deletingCustomer.phone}
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                Route: {deletingCustomer.route_details?.name || 'Assigned'}
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
                Current Balance: <strong>{formatCurrency(deletingCustomer.current_balance)}</strong>
              </div>
            </div>

            {Number(deletingCustomer.current_balance) > 0 && (
              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#b45309', padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <AlertTriangle size={16} style={{ flexShrink: 0 }} />
                <span>Warning: This shop has an outstanding balance of {formatCurrency(deletingCustomer.current_balance)}.</span>
              </div>
            )}

            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 0 1.25rem' }}>
              Are you sure you want to delete <strong>{deletingCustomer.name}</strong>?
            </p>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ flex: 1 }}
                onClick={() => setDeletingCustomer(null)}
                disabled={isDeletingSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                style={{ flex: 1, backgroundColor: '#dc2626', borderColor: '#dc2626', color: '#ffffff' }}
                onClick={handleConfirmDelete}
                disabled={isDeletingSubmitting}
              >
                {isDeletingSubmitting ? 'Deleting...' : 'Yes, Delete Shop'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Customer Statement Modal */}
      {statementCustomer && (
        <CustomerStatementModal
          customer={statementCustomer}
          onClose={() => setStatementCustomer(null)}
        />
      )}

      {/* Bulk Send Customer Statements Modal */}
      {isBulkStatementModalOpen && (
        <BulkSendCustomerStatementsModal
          customers={customers}
          routes={routes}
          onClose={() => setIsBulkStatementModalOpen(false)}
          onRefresh={fetchData}
        />
      )}
    </div>
  );
};

