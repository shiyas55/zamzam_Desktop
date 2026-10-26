import React, { useEffect, useState } from 'react';
import { productService } from '../../services/productService';
import { Product } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import { Package, Edit2, Trash2, Plus, X, Search, CheckCircle2, AlertTriangle, AlertCircle } from 'lucide-react';

export const ProductsPage: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Add Product Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [packetSize, setPacketSize] = useState('');
  const [orderNumber, setOrderNumber] = useState('1');
  const [skipInEntry, setSkipInEntry] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Edit Product Modal State
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editName, setEditName] = useState('');
  const [editCode, setEditCode] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editUnitPrice, setEditUnitPrice] = useState('');
  const [editPacketSize, setEditPacketSize] = useState('');
  const [editOrderNumber, setEditOrderNumber] = useState('1');
  const [editSkipInEntry, setEditSkipInEntry] = useState(false);
  const [editIsActive, setEditIsActive] = useState(true);
  const [isEditingSubmitting, setIsEditingSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Delete Product Modal State
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Feedback Banner
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const data = await productService.getProducts();
      setProducts(data);
    } catch (err: unknown) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleOpenEdit = (p: Product) => {
    setEditingProduct(p);
    setEditName(p.name);
    setEditCode(p.code);
    setEditDescription(p.description || '');
    setEditUnitPrice(String(p.unit_price));
    setEditPacketSize(p.packet_size || '');
    setEditOrderNumber(String(p.order_number ?? 1));
    setEditSkipInEntry(Boolean(p.skip_in_entry));
    setEditIsActive(p.is_active !== false);
    setEditError(null);
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !code.trim() || !unitPrice) {
      setError('Please provide product name, SKU code, and unit price.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await productService.createProduct({
        name: name.trim(),
        code: code.trim().toUpperCase(),
        description: description.trim(),
        unit_price: unitPrice,
        packet_size: packetSize.trim(),
        order_number: parseInt(orderNumber, 10) || (products.length + 1),
        skip_in_entry: skipInEntry,
      });
      setIsAddModalOpen(false);
      setName('');
      setCode('');
      setDescription('');
      setUnitPrice('');
      setPacketSize('');
      setOrderNumber(String(products.length + 2));
      setSkipInEntry(false);
      setFeedback({ type: 'success', message: `Product "${name}" created successfully.` });
      fetchProducts();
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
      else setError('Failed to create product');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    if (!editName.trim() || !editCode.trim() || !editUnitPrice) {
      setEditError('Please provide product name, SKU code, and unit price.');
      return;
    }

    try {
      setIsEditingSubmitting(true);
      setEditError(null);
      await productService.updateProduct(editingProduct.id, {
        name: editName.trim(),
        code: editCode.trim().toUpperCase(),
        description: editDescription.trim(),
        unit_price: editUnitPrice,
        packet_size: editPacketSize.trim(),
        order_number: parseInt(editOrderNumber, 10) || 1,
        skip_in_entry: editSkipInEntry,
        is_active: editIsActive,
      });
      setEditingProduct(null);
      setFeedback({ type: 'success', message: `Product "${editName}" updated successfully.` });
      fetchProducts();
    } catch (err: unknown) {
      if (err instanceof Error) setEditError(err.message);
      else setEditError('Failed to update product.');
    } finally {
      setIsEditingSubmitting(false);
    }
  };

  const handleDeleteProduct = async () => {
    if (!deletingProduct) return;
    try {
      setIsDeleting(true);
      setDeleteError(null);
      await productService.deleteProduct(deletingProduct.id);
      setFeedback({ type: 'success', message: `Product "${deletingProduct.name}" deleted successfully.` });
      setDeletingProduct(null);
      fetchProducts();
    } catch (err: unknown) {
      if (err instanceof Error) setDeleteError(err.message);
      else setDeleteError('Failed to delete product.');
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredProducts = products.filter((p) => {
    const q = searchQuery.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.code.toLowerCase().includes(q) ||
      (p.description && p.description.toLowerCase().includes(q)) ||
      (p.packet_size && p.packet_size.toLowerCase().includes(q))
    );
  });

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Product Catalog
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', margin: '0.25rem 0 0 0' }}>
            Manufactured bakery products, batch packaging, and unit pricing ({products.length} total).
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setIsAddModalOpen(true)}>
          <Plus size={18} />
          <span>Add New Product</span>
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

      {/* Search Bar */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input
            type="text"
            className="form-input"
            style={{ paddingLeft: '2.4rem' }}
            placeholder="Search products by name, code/SKU..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
          <div className="spinner" />
        </div>
      ) : filteredProducts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', background: 'white', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
          <Package size={40} style={{ color: '#cbd5e1', marginBottom: '0.75rem' }} />
          <h3 style={{ fontSize: '1.1rem', color: 'var(--text-primary)', fontWeight: 600 }}>No products found</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            {searchQuery ? 'Try searching with a different SKU or name.' : 'Click "Add New Product" to create one.'}
          </p>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '1.5rem',
          }}
        >
          {filteredProducts.map((p) => (
            <div
              key={p.id}
              style={{
                background: 'white',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border)',
                padding: '1.5rem',
                boxShadow: 'var(--shadow-sm)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                    <span className="badge badge-info" style={{ fontWeight: 700 }}>{p.code}</span>
                    <span className="badge badge-secondary" style={{ fontWeight: 700, background: '#f1f5f9', color: '#475569' }}>
                      Order #{p.order_number ?? 1}
                    </span>
                    {p.skip_in_entry && (
                      <span className="badge" style={{ fontWeight: 700, background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', fontSize: '0.72rem' }}>
                        Skip on Enter
                      </span>
                    )}
                  </div>
                  {p.is_active !== false ? (
                    <span className="badge badge-success">Active Product</span>
                  ) : (
                    <span className="badge badge-warning" style={{ background: '#fef3c7', color: '#b45309' }}>Inactive</span>
                  )}
                </div>

                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                  {p.name}
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1rem', minHeight: '38px' }}>
                  {p.description || 'Standard freshly baked distribution package'}
                </p>

                <div style={{ padding: '0.75rem', background: '#f8fafc', borderRadius: 'var(--radius-md)', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '0.35rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Package Size:</span>
                    <span style={{ fontWeight: 600 }}>{p.packet_size || 'Standard'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Selling Price:</span>
                    <span style={{ fontWeight: 800, color: 'var(--primary)' }}>{formatCurrency(p.unit_price)}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons: Edit & Delete */}
              <div style={{ display: 'flex', gap: '0.6rem', borderTop: '1px solid #f1f5f9', paddingTop: '1rem' }}>
                <button
                  type="button"
                  onClick={() => handleOpenEdit(p)}
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
                  <span>Edit Product</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setDeletingProduct(p);
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
                  title="Delete Product"
                >
                  <Trash2 size={14} />
                  <span>Delete</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Product Modal */}
      {isAddModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>Add New Product</h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
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

            <form onSubmit={handleCreateProduct}>
              <div className="form-group">
                <label className="form-label">Product Name *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Garlic Kubbus"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label className="form-label">Code / SKU *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. GKUB"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Unit Price (₹) *</label>
                <input
                  type="number"
                  step="0.50"
                  className="form-input"
                  placeholder="e.g. 40.00"
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Package Size</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. 10 pcs / pack"
                  value={packetSize}
                  onChange={(e) => setPacketSize(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Order Number (Display Sequence) *</label>
                <input
                  type="number"
                  min="1"
                  className="form-input"
                  placeholder="e.g. 1 for Kubbus, 2 for Bun, 3 for Romali"
                  value={orderNumber}
                  onChange={(e) => setOrderNumber(e.target.value)}
                  required
                />
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                  Controls which column position this product appears on the billing sheet (1 = 1st column, 2 = 2nd column, etc.)
                </span>
              </div>

              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea
                  className="form-textarea"
                  rows={2}
                  placeholder="Freshly prepared flatbread distribution package"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0.75rem 0 0.25rem 0' }}>
                <input
                  type="checkbox"
                  id="productSkipInEntry"
                  checked={skipInEntry}
                  onChange={(e) => setSkipInEntry(e.target.checked)}
                  style={{ width: '16px', height: '16px', accentColor: '#dc2626' }}
                />
                <label htmlFor="productSkipInEntry" style={{ fontSize: '0.88rem', fontWeight: 600, color: '#334155', cursor: 'pointer' }}>
                  Skip in Enter key navigation (Fast Order Entry)
                </label>
              </div>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'block', marginBottom: '1rem' }}>
                When checked, pressing Enter during billing sheet entry will jump past this product column straight to cash/gpay or next shop.
              </span>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setIsAddModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={isSubmitting}>
                  {isSubmitting ? 'Creating...' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Product Modal */}
      {editingProduct && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>Edit Product: {editingProduct.name}</h3>
              <button
                type="button"
                onClick={() => setEditingProduct(null)}
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

            <form onSubmit={handleUpdateProduct}>
              <div className="form-group">
                <label className="form-label">Product Name *</label>
                <input
                  type="text"
                  className="form-input"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Code / SKU *</label>
                <input
                  type="text"
                  className="form-input"
                  value={editCode}
                  onChange={(e) => setEditCode(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Unit Price (₹) *</label>
                <input
                  type="number"
                  step="0.50"
                  className="form-input"
                  value={editUnitPrice}
                  onChange={(e) => setEditUnitPrice(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Package Size</label>
                <input
                  type="text"
                  className="form-input"
                  value={editPacketSize}
                  onChange={(e) => setEditPacketSize(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Order Number (Display Sequence) *</label>
                <input
                  type="number"
                  min="1"
                  className="form-input"
                  value={editOrderNumber}
                  onChange={(e) => setEditOrderNumber(e.target.value)}
                  required
                />
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                  Controls which column position this product appears on the billing sheet (1 = 1st column, 2 = 2nd column, etc.)
                </span>
              </div>

              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea
                  className="form-textarea"
                  rows={2}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '1rem 0 0.25rem 0' }}>
                <input
                  type="checkbox"
                  id="editProductActive"
                  checked={editIsActive}
                  onChange={(e) => setEditIsActive(e.target.checked)}
                  style={{ width: '16px', height: '16px', accentColor: '#dc2626' }}
                />
                <label htmlFor="editProductActive" style={{ fontSize: '0.88rem', fontWeight: 600, color: '#334155', cursor: 'pointer' }}>
                  Product Active for Wholesale Orders
                </label>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0.75rem 0 0.25rem 0' }}>
                <input
                  type="checkbox"
                  id="editProductSkipInEntry"
                  checked={editSkipInEntry}
                  onChange={(e) => setEditSkipInEntry(e.target.checked)}
                  style={{ width: '16px', height: '16px', accentColor: '#dc2626' }}
                />
                <label htmlFor="editProductSkipInEntry" style={{ fontSize: '0.88rem', fontWeight: 600, color: '#334155', cursor: 'pointer' }}>
                  Skip in Enter key navigation (Fast Order Entry)
                </label>
              </div>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'block', marginBottom: '1rem' }}>
                When checked, pressing Enter during billing sheet entry will jump past this product column straight to cash/gpay or next shop.
              </span>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setEditingProduct(null)}>
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

      {/* Delete Product Confirmation Modal */}
      {deletingProduct && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '440px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', color: '#dc2626' }}>
              <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Trash2 size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                  Delete Product?
                </h3>
                <span style={{ fontSize: '0.82rem', color: '#64748b' }}>This removes the product from wholesale listings.</span>
              </div>
            </div>

            {deleteError && (
              <div style={{ background: 'var(--danger-bg)', color: 'var(--danger)', padding: '0.75rem', borderRadius: 'var(--radius-md)', marginBottom: '1rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertCircle size={16} />
                <span>{deleteError}</span>
              </div>
            )}

            <p style={{ fontSize: '0.9rem', color: '#334155', lineHeight: 1.5, marginBottom: '1.25rem' }}>
              Are you sure you want to delete <strong>"{deletingProduct.name}"</strong> (SKU: <code>{deletingProduct.code}</code>, Price: {formatCurrency(deletingProduct.unit_price)})?
            </p>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ flex: 1 }}
                onClick={() => setDeletingProduct(null)}
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                style={{ flex: 1, background: '#dc2626', borderColor: '#dc2626', color: 'white', fontWeight: 700 }}
                onClick={handleDeleteProduct}
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
