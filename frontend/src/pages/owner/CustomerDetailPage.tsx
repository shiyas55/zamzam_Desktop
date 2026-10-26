import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { customerService } from '../../services/customerService';
import { routeService } from '../../services/routeService';
import { orderService } from '../../services/orderService';
import { paymentService } from '../../services/paymentService';
import { customerDocumentService } from '../../services/customerDocumentService';
import { CustomerDetailSummary, CustomerPricingOverviewItem, Order, Payment, Route, CustomerDocument } from '../../types';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { 
  ArrowLeft, Store, Phone, MapPin, Tag, ShoppingBag, 
  CreditCard, Truck, Plus, Edit2, CheckCircle, AlertTriangle, X,
  Repeat, FileText, MessageSquare, ExternalLink, Copy, Check, Smartphone, Send,
  Trash2, CheckCircle2, AlertCircle, RefreshCw, Printer, FolderArchive, UploadCloud, Download
} from 'lucide-react';
import { InvoiceModal } from '../../components/InvoiceModal';
import { CustomerStatementModal } from '../../components/CustomerStatementModal';
import { openWhatsApp, generateBalanceReminderMessage, generateInvoiceMessage } from '../../utils/whatsappUtils';
import { useSettings } from '../../context/SettingsContext';
import { useAuth } from '../../context/AuthContext';

export const CustomerDetailPage: React.FC = () => {
  const { user } = useAuth();
  const { isWhatsAppEnabled } = useSettings();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [summary, setSummary] = useState<CustomerDetailSummary | null>(null);
  const [pricing, setPricing] = useState<CustomerPricingOverviewItem[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Edit Customer Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editOwnerName, setEditOwnerName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAlternativePhone, setEditAlternativePhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editLandmark, setEditLandmark] = useState('');
  const [editRouteId, setEditRouteId] = useState('');
  const [editCreditLimit, setEditCreditLimit] = useState('5000.00');
  const [editIsActive, setEditIsActive] = useState(true);
  const [editNotes, setEditNotes] = useState('');
  const [editFormError, setEditFormError] = useState<string | null>(null);
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);

  // Delete Customer Modal State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleteSubmitting, setIsDeleteSubmitting] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Price Modal State
  const [isPriceModalOpen, setIsPriceModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<CustomerPricingOverviewItem | null>(null);
  const [newPrice, setNewPrice] = useState('');
  const [isActivePrice, setIsActivePrice] = useState(true);
  const [savingPrice, setSavingPrice] = useState(false);
  const [priceError, setPriceError] = useState<string | null>(null);

  // Active Tab: 'pricing' | 'orders' | 'payments' | 'deliveries' | 'documents'
  const [searchParams] = useSearchParams();
  const urlTab = searchParams.get('tab') as 'pricing' | 'orders' | 'payments' | 'deliveries' | 'documents' | null;
  const [activeTab, setActiveTab] = useState<'pricing' | 'orders' | 'payments' | 'deliveries' | 'documents'>(urlTab || 'pricing');
  const [selectedOrderForInvoice, setSelectedOrderForInvoice] = useState<Order | null>(null);
  const [isStatementModalOpen, setIsStatementModalOpen] = useState(false);
  const [customerOrders, setCustomerOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [customerPayments, setCustomerPayments] = useState<Payment[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [customerDocuments, setCustomerDocuments] = useState<CustomerDocument[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);

  const loadCustomerOrders = async () => {
    if (!id) return;
    try {
      setOrdersLoading(true);
      const orders = await orderService.getOrders({ customer: id });
      setCustomerOrders(orders);
    } catch (e) {
      console.error('Failed to load full orders for customer:', e);
    } finally {
      setOrdersLoading(false);
    }
  };

  const loadCustomerPayments = async () => {
    if (!id) return;
    try {
      setPaymentsLoading(true);
      const payments = await paymentService.getPayments({ customer: id });
      setCustomerPayments(payments);
    } catch (e) {
      console.error('Failed to load full payments for customer:', e);
    } finally {
      setPaymentsLoading(false);
    }
  };

  const loadCustomerDocuments = async () => {
    if (!id) return;
    try {
      setDocumentsLoading(true);
      const docs = await customerDocumentService.getDocuments({ customer: id });
      setCustomerDocuments(docs);
    } catch (e) {
      console.error('Failed to load documents for customer:', e);
    } finally {
      setDocumentsLoading(false);
    }
  };

  const loadCustomerData = async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const [summaryData, pricingData, routeList] = await Promise.all([
        customerService.getCustomerSummary(id),
        customerService.getCustomerPricing(id),
        routeService.getRoutes().catch(() => []),
      ]);
      setSummary(summaryData);
      setPricing(pricingData);
      setRoutes(routeList);
    } catch (err: unknown) {
      console.error(err);
      setError('Failed to load customer profile details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomerData();
    if (id) {
      loadCustomerOrders();
      loadCustomerPayments();
      loadCustomerDocuments();
    }
  }, [id]);

  useEffect(() => {
    if (activeTab === 'orders' && id) {
      loadCustomerOrders();
    }
    if (activeTab === 'payments' && id) {
      loadCustomerPayments();
    }
    if (activeTab === 'documents' && id) {
      loadCustomerDocuments();
    }
  }, [activeTab, id]);

  const handleOpenEditModal = () => {
    if (!summary?.customer) return;
    const c = summary.customer;
    setEditName(c.name || '');
    setEditOwnerName(c.owner_name || '');
    setEditPhone(c.phone || '');
    setEditAlternativePhone(c.alternative_phone || '');
    setEditAddress(c.address || '');
    setEditLandmark(c.landmark || '');
    const rId = typeof c.route === 'string' ? c.route : c.route_details?.id || (routes[0]?.id ?? '');
    setEditRouteId(rId);
    setEditCreditLimit(c.credit_limit || '5000.00');
    setEditIsActive(c.is_active ?? true);
    setEditNotes(c.notes || '');
    setEditFormError(null);
    setIsEditModalOpen(true);
  };

  const handleUpdateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !editName.trim() || !editPhone.trim() || !editAddress.trim() || !editRouteId) {
      setEditFormError('Please fill in shop name, phone, address, and select a route.');
      return;
    }

    try {
      setIsEditSubmitting(true);
      setEditFormError(null);

      await customerService.updateCustomer(id, {
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
      });

      setIsEditModalOpen(false);
      showToast('Shop details updated successfully!');
      loadCustomerData();
    } catch (err: unknown) {
      if (err instanceof Error) setEditFormError(err.message);
      else setEditFormError('Failed to update customer shop.');
    } finally {
      setIsEditSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!id || !summary?.customer) return;

    try {
      setIsDeleteSubmitting(true);
      setDeleteError(null);

      await customerService.deleteCustomer(id);
      setIsDeleteModalOpen(false);
      navigate('/owner/customers');
    } catch (err: unknown) {
      if (err instanceof Error) {
        setDeleteError(err.message);
      } else {
        setDeleteError('Failed to delete customer. Make sure there are no conflicting dependencies.');
      }
    } finally {
      setIsDeleteSubmitting(false);
    }
  };

  const handleOpenPriceModal = (item: CustomerPricingOverviewItem) => {
    setSelectedProduct(item);
    setNewPrice(item.customer_price || item.default_price);
    setIsActivePrice(item.is_active);
    setPriceError(null);
    setIsPriceModalOpen(true);
  };

  const handleSavePrice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !selectedProduct) return;

    const parsedPrice = parseFloat(newPrice);
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      setPriceError('Please enter a valid price (greater than or equal to 0).');
      return;
    }

    try {
      setSavingPrice(true);
      setPriceError(null);
      await customerService.setCustomerPricing(id, {
        product_id: selectedProduct.product_id,
        price: parsedPrice.toFixed(2),
        is_active: isActivePrice,
      });
      setIsPriceModalOpen(false);
      // Reload pricing & summary
      const updatedPricing = await customerService.getCustomerPricing(id);
      setPricing(updatedPricing);
    } catch (err: unknown) {
      if (err instanceof Error) setPriceError(err.message);
      else setPriceError('Failed to update customer price.');
    } finally {
      setSavingPrice(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center' }}>
        <div className="spinner" style={{ margin: '0 auto' }} />
        <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>Loading customer shop profile...</p>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div style={{ maxWidth: '800px', margin: '2rem auto', textAlign: 'center' }}>
        <div style={{ background: 'var(--danger-bg)', color: 'var(--danger)', padding: '1.5rem', borderRadius: 'var(--radius-lg)' }}>
          <AlertTriangle size={32} style={{ margin: '0 auto 0.5rem' }} />
          <p style={{ fontWeight: 600 }}>{error || 'Customer not found'}</p>
          <button className="btn btn-secondary" style={{ marginTop: '1rem' }} onClick={() => navigate(-1)}>
            <ArrowLeft size={16} />
            <span>Go Back</span>
          </button>
        </div>
      </div>
    );
  }

  const { customer } = summary;

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
      {/* Toast Notification */}
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

      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button className="btn btn-secondary" onClick={() => navigate(-1)}>
            <ArrowLeft size={16} />
            <span>Back</span>
          </button>
          <div>
            <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>{customer.name}</span>
              {customer.is_credit_exceeded && (
                <span className="badge badge-danger">Credit Exceeded</span>
              )}
              {!customer.is_active && (
                <span className="badge badge-neutral">Inactive</span>
              )}
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
              Proprietor: {customer.owner_name || 'N/A'} • Route: {customer.route_details?.name || 'Unassigned'}
            </p>
          </div>
        </div>

        {/* Quick Header Actions: Edit, Delete, Self-Order */}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={handleOpenEditModal}
            title="Edit Customer Profile"
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#0284c7' }}
          >
            <Edit2 size={14} />
            <span>Edit Shop</span>
          </button>

          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setIsStatementModalOpen(true)}
            title="View & Print Customer Account Statement"
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#b91c1c' }}
          >
            <Printer size={14} />
            <span>Print Statement</span>
          </button>

          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setIsDeleteModalOpen(true)}
            title="Delete Customer Shop"
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#dc2626' }}
          >
            <Trash2 size={14} />
            <span>Delete</span>
          </button>
        </div>
      </div>

      {/* Basic Info & Financial KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid var(--primary)' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Current Receivable</span>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: customer.is_credit_exceeded ? 'var(--danger)' : 'var(--text-primary)', marginTop: '0.25rem' }}>
            {formatCurrency(summary.outstanding_balance)}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Continuous Route Credit
          </div>
        </div>

        <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid #10b981' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Total Sales</span>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#10b981', marginTop: '0.25rem' }}>
            {formatCurrency(summary.total_sales)}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Lifetime Orders: {summary.total_orders}
          </div>
        </div>

        <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid var(--primary)' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Total Collected</span>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary)', marginTop: '0.25rem' }}>
            {formatCurrency(summary.total_paid)}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Audited Payments
          </div>
        </div>

        <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid #f59e0b' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Contact & Address</span>
          <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.25rem' }}>
            {customer.phone}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {customer.address}
          </div>
        </div>
      </div>

      {/* Prompt 3: Last Order Card + Repeat Order & Frequent Order Info */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        {/* Last Order & Repeat Order */}
        <div className="card" style={{ padding: '1.25rem', border: '1px solid #fed7aa', background: '#fffbeb' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.1rem' }}>🛍️</span>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#9a3412', margin: 0 }}>
                LAST ORDER
              </h3>
            </div>
            {summary.last_order && (
              <span className="badge badge-neutral" style={{ fontSize: '0.72rem' }}>
                #{summary.last_order.order_number} ({summary.last_order.order_date})
              </span>
            )}
          </div>

          {summary.last_order ? (
            <div>
              <div style={{ background: '#ffffff', borderRadius: '6px', padding: '0.75rem', marginBottom: '0.85rem', border: '1px solid #fed7aa' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.85rem' }}>
                  {summary.last_order.items.map((it) => (
                    <div key={it.product_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        {it.product_name} — {it.quantity} pieces
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                          Hist: ₹{Number(it.historical_unit_price).toFixed(2)}
                        </span>
                        {it.price_changed && (
                          <span className="badge badge-warning" style={{ fontSize: '0.68rem', padding: '0.1rem 0.35rem' }} title={`Current wholesale price is ₹${Number(it.current_unit_price).toFixed(2)}`}>
                            Rate now: ₹{Number(it.current_unit_price).toFixed(2)}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ borderTop: '1px dashed #fdba74', marginTop: '0.5rem', paddingTop: '0.4rem', display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '0.9rem', color: '#9a3412' }}>
                  <span>Order Total:</span>
                  <span>{formatCurrency(summary.last_order.total_amount)}</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    navigate('/manager/create-order', {
                      state: {
                        repeatCustomerId: customer.id,
                        repeatItems: summary.last_order?.items.map((it) => ({
                          product_id: it.product_id,
                          quantity: it.quantity,
                        })),
                        sourceOrderNumber: summary.last_order?.order_number,
                      },
                    });
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: '#b91c1c' }}
                >
                  <Repeat size={14} />
                  <span>Repeat Last Order</span>
                </button>
              </div>
            </div>
          ) : (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>
              No previous orders found for this customer shop.
            </p>
          )}
        </div>

        {/* Frequent Order Information */}
        <div className="card" style={{ padding: '1.25rem', border: '1px solid #fecaca', background: '#fef2f2' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '1.1rem' }}>📊</span>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--primary-dark)', margin: 0 }}>
              FREQUENT ORDER PATTERNS
            </h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.85rem' }}>
            <div style={{ background: 'rgba(255,255,255,0.85)', padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid #fee2e2' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', fontWeight: 600 }}>
                Most Frequent Product
              </span>
              <strong style={{ fontSize: '1rem', color: '#1e3a8a' }}>
                {summary.frequent_order_info?.most_frequent_product || 'Kubbus'}
              </strong>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.85)', padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid #fee2e2' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', fontWeight: 600 }}>
                Typical Quantity
              </span>
              <strong style={{ fontSize: '1rem', color: '#1e3a8a' }}>
                {summary.frequent_order_info?.typical_quantity || 0} pieces / order
              </strong>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.85)', padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid #fee2e2' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', fontWeight: 600 }}>
                Lifetime Orders
              </span>
              <strong style={{ fontSize: '1rem', color: '#1e3a8a' }}>
                {summary.frequent_order_info?.total_orders || summary.total_orders} orders
              </strong>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.85)', padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid #fee2e2' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', fontWeight: 600 }}>
                Last Order Date
              </span>
              <strong style={{ fontSize: '0.95rem', color: '#1e3a8a' }}>
                {summary.frequent_order_info?.last_order_date || 'None'}
              </strong>
            </div>
          </div>

          <div style={{ marginTop: '0.85rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setIsStatementModalOpen(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#b91c1c' }}
              title="Print Customer Statement and Ledger"
            >
              <Printer size={14} />
              <span>Print Account Statement</span>
            </button>

            {isWhatsAppEnabled && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  const msg = generateBalanceReminderMessage({
                    customerName: customer.name,
                    outstandingBalance: summary.outstanding_balance,
                    creditLimit: customer.credit_limit,
                    date: new Date().toLocaleDateString(),
                  });
                  openWhatsApp(customer.phone, msg);
                }}
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#047857' }}
              >
                <MessageSquare size={14} />
                <span>Share Balance on WhatsApp</span>
              </button>
            )}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border)', marginBottom: '1.5rem' }}>
        <button
          className={`btn ${activeTab === 'pricing' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ borderRadius: 'var(--radius-md) var(--radius-md) 0 0', borderBottom: 'none' }}
          onClick={() => setActiveTab('pricing')}
        >
          <Tag size={16} />
          <span>Customer-Specific Pricing ({pricing.length})</span>
        </button>
        <button
          className={`btn ${activeTab === 'orders' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ borderRadius: 'var(--radius-md) var(--radius-md) 0 0', borderBottom: 'none' }}
          onClick={() => setActiveTab('orders')}
        >
          <ShoppingBag size={16} />
          <span>Order History ({customerOrders.length > 0 ? customerOrders.length : (summary.recent_orders?.length || 0)})</span>
        </button>
        <button
          className={`btn ${activeTab === 'payments' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ borderRadius: 'var(--radius-md) var(--radius-md) 0 0', borderBottom: 'none' }}
          onClick={() => setActiveTab('payments')}
        >
          <CreditCard size={16} />
          <span>Payment History ({customerPayments.length > 0 ? customerPayments.length : (summary.recent_payments?.length || 0)})</span>
        </button>
        <button
          className={`btn ${activeTab === 'deliveries' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ borderRadius: 'var(--radius-md) var(--radius-md) 0 0', borderBottom: 'none' }}
          onClick={() => setActiveTab('deliveries')}
        >
          <Truck size={16} />
          <span>Delivery History ({summary.recent_deliveries?.length || 0})</span>
        </button>
        <button
          className={`btn ${activeTab === 'documents' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ borderRadius: 'var(--radius-md) var(--radius-md) 0 0', borderBottom: 'none' }}
          onClick={() => setActiveTab('documents')}
        >
          <FolderArchive size={16} />
          <span>Shop Documents ({customerDocuments.length})</span>
        </button>
      </div>

      {/* Tab 1: Customer Pricing Management */}
      {activeTab === 'pricing' && (
        <div className="card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Wholesale Customer Pricing</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Configure negotiated rates per product for {customer.name}. Orders automatically use this rate instead of the product base price.
              </p>
            </div>
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Packet Size</th>
                  <th>Default Base Price</th>
                  <th>Negotiated Customer Price</th>
                  <th>Effective Billing Price</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {pricing.map((item) => (
                  <tr key={item.product_id}>
                    <td>
                      <div style={{ fontWeight: 700 }}>{item.product_name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.product_code}</div>
                    </td>
                    <td>{item.packet_size}</td>
                    <td style={{ color: 'var(--text-muted)', textDecoration: item.is_custom_price ? 'line-through' : 'none' }}>
                      {formatCurrency(item.default_price)}
                    </td>
                    <td>
                      {item.is_custom_price ? (
                        <span style={{ fontWeight: 800, color: 'var(--primary)', fontSize: '1.05rem' }}>
                          {formatCurrency(item.customer_price || item.default_price)}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.85rem' }}>
                          None (Uses Base)
                        </span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <strong style={{ fontSize: '1rem' }}>{formatCurrency(item.effective_price)}</strong>
                        {item.is_custom_price ? (
                          <span className="badge badge-warning" style={{ fontSize: '0.72rem' }}>Custom</span>
                        ) : (
                          <span className="badge badge-neutral" style={{ fontSize: '0.72rem' }}>Default</span>
                        )}
                      </div>
                    </td>
                    <td>
                      {item.is_custom_price ? (
                        item.is_active ? (
                          <span className="badge badge-success">Active Custom</span>
                        ) : (
                          <span className="badge badge-neutral">Inactive</span>
                        )
                      ) : (
                        <span className="badge badge-neutral">Standard</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleOpenPriceModal(item)}
                      >
                        <Edit2 size={14} />
                        <span>{item.is_custom_price ? 'Edit Rate' : 'Set Custom Rate'}</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Order History */}
      {activeTab === 'orders' && (() => {
        const displayOrders = customerOrders.length > 0 ? customerOrders : (summary.recent_orders || []);
        return (
          <div className="card" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>Historical Orders</h3>
                <span className="badge badge-neutral" style={{ fontSize: '0.78rem' }}>
                  {displayOrders.length} order{displayOrders.length === 1 ? '' : 's'}
                </span>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  loadCustomerOrders();
                  loadCustomerData();
                }}
                disabled={ordersLoading}
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                title="Refresh customer order history from database"
              >
                <RefreshCw size={13} className={ordersLoading ? 'animate-spin' : ''} />
                <span>{ordersLoading ? 'Syncing...' : 'Refresh Orders'}</span>
              </button>
            </div>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Order #</th>
                    <th>Date</th>
                    <th>Items & Historical Rates</th>
                    <th>Total Amount</th>
                    <th>Order Status</th>
                    <th>Delivery</th>
                    <th style={{ textAlign: 'right' }}>Invoice & Share</th>
                  </tr>
                </thead>
                <tbody>
                  {displayOrders.length > 0 ? (
                    displayOrders.map((ord) => (
                      <tr key={ord.id}>
                        <td>
                          <div style={{ fontWeight: 700 }}>{ord.order_number}</div>
                          {ord.source === 'CUSTOMER_LINK' && (
                            <span
                              className="badge badge-info"
                              style={{
                                fontSize: '0.68rem',
                                padding: '0.1rem 0.4rem',
                                marginTop: '0.2rem',
                                display: 'inline-block',
                                background: '#dcfce7',
                                color: '#15803d',
                                border: '1px solid #86efac',
                              }}
                            >
                              📱 Self-Order
                            </span>
                          )}
                        </td>
                        <td>{formatDate(ord.order_date)}</td>
                        <td>
                          <div style={{ fontSize: '0.85rem' }}>
                            {ord.items?.map((it) => {
                              const pName = it.product_details?.name || (it as any).product_name || 'Item';
                              return (
                                <div key={it.id} style={{ display: 'flex', gap: '0.5rem' }}>
                                  <span>{pName}:</span>
                                  <strong>{it.quantity} packs</strong>
                                  <span style={{ color: 'var(--text-muted)' }}>@ {formatCurrency(it.unit_price)}</span>
                                </div>
                              );
                            })}
                          </div>
                        </td>
                        <td style={{ fontWeight: 800, color: 'var(--text-primary)' }}>
                          {formatCurrency(ord.total_amount)}
                        </td>
                        <td>
                          <span className={`badge ${
                            ord.status === 'DELIVERED' ? 'badge-success' :
                            ord.status === 'NOT_DELIVERED' ? 'badge-danger' : 'badge-neutral'
                          }`}>
                            {ord.status}
                          </span>
                        </td>
                        <td>
                          <span className="badge badge-neutral">
                            {ord.delivery_status || 'ASSIGNED'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => {
                                const fullOrder: Order = {
                                  ...ord,
                                  customer_details: ord.customer_details || summary.customer,
                                } as Order;
                                setSelectedOrderForInvoice(fullOrder);
                              }}
                              title="View & Print Professional Invoice"
                              style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                            >
                              <FileText size={13} />
                              <span>Invoice</span>
                            </button>
                            {isWhatsAppEnabled && (
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => {
                                  const items = (ord.items || []).map((it) => ({
                                    name: it.product_details?.name || (it as any).product_name || 'Product',
                                    quantity: it.quantity,
                                    unitPrice: it.unit_price,
                                    subtotal: it.subtotal || (Number(it.unit_price) * it.quantity).toFixed(2),
                                  }));
                                  const msg = generateInvoiceMessage({
                                    customerName: summary.customer.name,
                                    orderNumber: ord.order_number,
                                    date: ord.order_date,
                                    items,
                                    totalAmount: ord.total_amount,
                                    outstandingBalance: summary.outstanding_balance,
                                  });
                                  openWhatsApp(summary.customer.phone, msg);
                                }}
                                title="Share on WhatsApp"
                              >
                                <Send size={13} />
                                <span>WhatsApp</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                        No orders recorded yet for this customer.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}


      {/* Tab 3: Payment History */}
      {activeTab === 'payments' && (() => {
        const displayPayments = customerPayments.length > 0 ? customerPayments : (summary.recent_payments || []);
        return (
          <div className="card" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>Payment Collections</h3>
                <span className="badge badge-neutral" style={{ fontSize: '0.78rem' }}>
                  {displayPayments.length} payment{displayPayments.length === 1 ? '' : 's'}
                </span>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  loadCustomerPayments();
                  loadCustomerData();
                }}
                disabled={paymentsLoading}
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                title="Refresh customer payment collections from database"
              >
                <RefreshCw size={13} className={paymentsLoading ? 'animate-spin' : ''} />
                <span>{paymentsLoading ? 'Syncing...' : 'Refresh Payments'}</span>
              </button>
            </div>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Receipt #</th>
                    <th>Date</th>
                    <th>Method</th>
                    <th>Amount</th>
                    <th>Collected By</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {displayPayments.length > 0 ? (
                    displayPayments.map((p) => (
                      <tr key={p.id}>
                        <td style={{ fontWeight: 700 }}>
                          <div>{p.payment_number}</div>
                          {p.reference_number && (
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                              Ref: {p.reference_number}
                            </div>
                          )}
                        </td>
                        <td>{formatDate(p.received_at)}</td>
                        <td>
                          <span className="badge badge-neutral">
                            {p.payment_method === 'GPAY_UPI' ? 'GPay / UPI' : 'Cash'}
                          </span>
                        </td>
                        <td style={{ fontWeight: 800, color: '#10b981' }}>
                          {formatCurrency(p.amount)}
                        </td>
                        <td>
                          {p.collected_by_name ||
                            (typeof p.collected_by === 'object' && p.collected_by
                              ? (p.collected_by as any).name || (p.collected_by as any).username
                              : 'Driver / Staff')}
                        </td>
                        <td>
                          <span className={`badge ${p.status === 'COMPLETED' ? 'badge-success' : p.status === 'REVERSED' ? 'badge-danger' : 'badge-neutral'}`}>
                            {p.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                        No payment records found for this customer.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* Tab 4: Delivery History */}
      {activeTab === 'deliveries' && (
        <div className="card" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '1rem' }}>Delivery Tracking Records</h3>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Delivery #</th>
                  <th>Date</th>
                  <th>Driver</th>
                  <th>Status</th>
                  <th>Notes / Failure Reason</th>
                </tr>
              </thead>
              <tbody>
                {summary.recent_deliveries && summary.recent_deliveries.length > 0 ? (
                  summary.recent_deliveries.map((d) => (
                    <tr key={d.id}>
                      <td style={{ fontWeight: 700 }}>{d.delivery_number}</td>
                      <td>{formatDate(d.created_at)}</td>
                      <td>{d.driver_name || 'Assigned Driver'}</td>
                      <td>
                        <span className={`badge ${
                          d.status === 'DELIVERED' ? 'badge-success' :
                          d.status === 'NOT_DELIVERED' ? 'badge-danger' : 'badge-warning'
                        }`}>
                          {d.status}
                        </span>
                      </td>
                      <td>
                        {d.failed_reason ? (
                          <span style={{ color: 'var(--danger)', fontWeight: 600 }}>Reason: {d.failed_reason}</span>
                        ) : (
                          d.notes || '—'
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                      No delivery records found for this customer.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 5: Shop Documents & Multi-File Storage */}
      {activeTab === 'documents' && (
        <div className="card" style={{ padding: '1.5rem' }}>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
              marginBottom: '1.25rem',
            }}
          >
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>Shop Documents & Storage</h3>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Official licenses, GST certificates, supply agreements, and verification proofs.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => {
                  const basePath = user?.role === 'MANAGER' ? '/manager' : '/owner';
                  navigate(`${basePath}/shop-documents?customer=${id}`);
                }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
              >
                <UploadCloud size={14} />
                <span>Upload / Manage Documents</span>
              </button>
            </div>
          </div>

          {documentsLoading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <RefreshCw size={20} className="spin" style={{ margin: '0 auto 0.5rem auto' }} />
              <div>Loading documents...</div>
            </div>
          ) : customerDocuments.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '3rem 1.5rem',
                background: 'var(--bg-secondary)',
                borderRadius: 'var(--radius-md)',
              }}
            >
              <FolderArchive size={36} color="var(--text-muted)" style={{ margin: '0 auto 0.75rem auto' }} />
              <h4 style={{ margin: 0, fontWeight: 700, color: 'var(--text-primary)' }}>No documents uploaded yet</h4>
              <p style={{ margin: '0.25rem 0 1rem 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Upload this shop's FSSAI license, GST certificate, rent agreement, or photos.
              </p>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => {
                  const basePath = user?.role === 'MANAGER' ? '/manager' : '/owner';
                  navigate(`${basePath}/shop-documents?customer=${id}`);
                }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
              >
                <UploadCloud size={14} />
                <span>Upload Documents for {summary?.customer?.name}</span>
              </button>
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: '1rem',
              }}
            >
              {customerDocuments.map((doc) => {
                const isImg = doc.mime_type?.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif)$/i.test(doc.file_name);
                const isPdf = doc.mime_type === 'application/pdf' || /\.pdf$/i.test(doc.file_name);
                const todayStr = new Date().toISOString().split('T')[0];
                const isExpired = doc.expiry_date && doc.expiry_date < todayStr;

                return (
                  <div
                    key={doc.id}
                    style={{
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)',
                      overflow: 'hidden',
                      background: 'var(--bg-card)',
                      display: 'flex',
                      flexDirection: 'column',
                    }}
                  >
                    <div
                      style={{
                        height: '110px',
                        background: isImg ? '#000' : 'var(--bg-secondary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        position: 'relative',
                      }}
                    >
                      {isImg && doc.file_url ? (
                        <img
                          src={doc.file_url}
                          alt={doc.title}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : isPdf ? (
                        <div style={{ textAlign: 'center', color: '#dc2626' }}>
                          <FileText size={36} />
                          <div style={{ fontSize: '0.7rem', fontWeight: 700 }}>PDF</div>
                        </div>
                      ) : (
                        <FileText size={36} color="var(--text-muted)" />
                      )}

                      <span
                        className="badge"
                        style={{
                          position: 'absolute',
                          top: '0.5rem',
                          left: '0.5rem',
                          fontSize: '0.7rem',
                          background: 'rgba(0,0,0,0.7)',
                          color: '#fff',
                        }}
                      >
                        {doc.document_type_display || doc.document_type}
                      </span>

                      {isExpired && (
                        <span
                          className="badge badge-danger"
                          style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', fontSize: '0.65rem' }}
                        >
                          EXPIRED
                        </span>
                      )}
                    </div>

                    <div style={{ padding: '0.75rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                        {doc.title}
                      </div>

                      {doc.document_number && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                          Doc #: {doc.document_number}
                        </div>
                      )}

                      {doc.expiry_date && (
                        <div
                          style={{
                            fontSize: '0.75rem',
                            color: isExpired ? '#dc2626' : 'var(--text-secondary)',
                            fontWeight: isExpired ? 700 : 500,
                            marginTop: '0.2rem',
                          }}
                        >
                          Expires: {formatDate(doc.expiry_date)}
                        </div>
                      )}

                      <div
                        style={{
                          marginTop: 'auto',
                          paddingTop: '0.5rem',
                          borderTop: '1px solid var(--border)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '0.5rem',
                        }}
                      >
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          {formatDate(doc.created_at)}
                        </span>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          {doc.file_url && (
                            <a
                              href={doc.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn btn-secondary btn-sm"
                              style={{ height: '26px', padding: '0 0.4rem', fontSize: '0.75rem' }}
                              title="Open file"
                            >
                              <ExternalLink size={12} />
                            </a>
                          )}
                          {doc.file_url && (
                            <a
                              href={doc.file_url}
                              download={doc.file_name}
                              className="btn btn-primary btn-sm"
                              style={{ height: '26px', padding: '0 0.4rem', fontSize: '0.75rem' }}
                              title="Download"
                            >
                              <Download size={12} />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Edit Customer Price Modal */}
      {isPriceModalOpen && selectedProduct && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '440px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>
                Set Custom Wholesale Rate
              </h3>
              <button onClick={() => setIsPriceModalOpen(false)} style={{ color: 'var(--text-muted)' }}>
                <X size={20} />
              </button>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
              Product: <strong>{selectedProduct.product_name}</strong> ({selectedProduct.packet_size})<br />
              Default Base Price: <strong>{formatCurrency(selectedProduct.default_price)}</strong>
            </p>

            {priceError && (
              <div style={{ background: 'var(--danger-bg)', color: 'var(--danger)', padding: '0.75rem', borderRadius: 'var(--radius-md)', marginBottom: '1rem', fontSize: '0.85rem' }}>
                {priceError}
              </div>
            )}

            <form onSubmit={handleSavePrice}>
              <div className="form-group">
                <label className="form-label">Negotiated Customer Price (₹) *</label>
                <input
                  type="number"
                  step="0.05"
                  min="0"
                  className="form-input"
                  style={{ fontSize: '1.15rem', fontWeight: 700 }}
                  value={newPrice}
                  onChange={(e) => setNewPrice(e.target.value)}
                  placeholder="e.g. 10.50"
                  required
                  autoFocus
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'block' }}>
                  Future billing for {customer.name} will default to this price automatically.
                </span>
              </div>

              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1rem' }}>
                <input
                  type="checkbox"
                  id="isActiveCheck"
                  checked={isActivePrice}
                  onChange={(e) => setIsActivePrice(e.target.checked)}
                />
                <label htmlFor="isActiveCheck" style={{ fontSize: '0.88rem', fontWeight: 600, cursor: 'pointer' }}>
                  Active Customer Rate (Disable to revert to Base Price)
                </label>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                  onClick={() => setIsPriceModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                  disabled={savingPrice}
                >
                  {savingPrice ? 'Saving...' : 'Save Rate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Customer Modal */}
      {isEditModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '650px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Edit2 size={22} color="#0284c7" />
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Edit Customer Shop</h3>
              </div>
              <button onClick={() => setIsEditModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
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
                  onClick={() => setIsEditModalOpen(false)}
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
      {isDeleteModalOpen && summary && (
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
                  This action will permanently delete this customer record.
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
                {customer.name}
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                Phone: {customer.phone}
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                Route: {customer.route_details?.name || 'Assigned'}
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
                Current Balance: <strong>{formatCurrency(customer.current_balance)}</strong>
              </div>
            </div>

            {Number(customer.current_balance) > 0 && (
              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#b45309', padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <AlertTriangle size={16} style={{ flexShrink: 0 }} />
                <span>Warning: This shop has an outstanding balance of {formatCurrency(customer.current_balance)}.</span>
              </div>
            )}

            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 0 1.25rem' }}>
              Are you sure you want to delete <strong>{customer.name}</strong>?
            </p>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ flex: 1 }}
                onClick={() => setIsDeleteModalOpen(false)}
                disabled={isDeleteSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                style={{ flex: 1, backgroundColor: '#dc2626', borderColor: '#dc2626', color: '#ffffff' }}
                onClick={handleConfirmDelete}
                disabled={isDeleteSubmitting}
              >
                {isDeleteSubmitting ? 'Deleting...' : 'Yes, Delete Shop'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Modal */}
      {selectedOrderForInvoice && (
        <InvoiceModal
          order={selectedOrderForInvoice}
          customer={customer}
          onClose={() => setSelectedOrderForInvoice(null)}
        />
      )}

      {/* Customer Account Statement Modal */}
      {isStatementModalOpen && (summary?.customer || customer) && (
        <CustomerStatementModal
          customer={summary?.customer || customer}
          summary={summary}
          orders={customerOrders}
          onClose={() => setIsStatementModalOpen(false)}
        />
      )}
    </div>
  );
};
