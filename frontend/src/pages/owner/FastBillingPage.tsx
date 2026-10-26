import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  nativeDbService,
  Customer,
  Product,
  CustomerProductPrice,
  SaveOrderInput,
  SaveOrderItem,
} from '../../services/nativeDbService';
import {
  Plus,
  Trash2,
  Printer,
  Save,
  RotateCcw,
  Search,
  CheckCircle2,
  AlertCircle,
  FileText,
  Calendar,
  CreditCard,
  Building,
  ArrowRight,
  Receipt,
  X,
} from 'lucide-react';

interface ProductRow {
  productId: string;
  productName: string;
  productCode: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export const FastBillingPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const editOrderId = searchParams.get('edit');

  // Master Data
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customerPrices, setCustomerPrices] = useState<CustomerProductPrice[]>([]);
  const [isLoadingMaster, setIsLoadingMaster] = useState(true);

  // Bill Form State
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [billDate, setBillDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [billNumber, setBillNumber] = useState<string>('');
  const [previousDue, setPreviousDue] = useState<number>(0);
  const [rows, setRows] = useState<ProductRow[]>([]);
  const [discount, setDiscount] = useState<number>(0);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<string>('CASH');
  const [paymentRef, setPaymentRef] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // UI state
  const [customerSearch, setCustomerSearch] = useState<string>('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [printBillData, setPrintBillData] = useState<any | null>(null);

  // Load Master Data
  const loadMasterData = useCallback(async () => {
    try {
      setIsLoadingMaster(true);
      const [custList, prodList] = await Promise.all([
        nativeDbService.getCustomers({ activeOnly: true }),
        nativeDbService.getProducts(true),
      ]);
      setCustomers(custList);
      setProducts(prodList);
    } catch (err) {
      console.error('Failed to load master data:', err);
      setNotification({ type: 'error', message: 'Unable to load products or customers from database.' });
    } finally {
      setIsLoadingMaster(false);
    }
  }, []);

  useEffect(() => {
    loadMasterData();
  }, [loadMasterData]);

  // Load Order if in Edit Mode
  useEffect(() => {
    if (!editOrderId || products.length === 0) return;

    const loadOrderToEdit = async () => {
      try {
        const order = await nativeDbService.getOrder(editOrderId);
        setSelectedCustomerId(order.customer_id);
        setBillDate(order.bill_date);
        setBillNumber(order.bill_number);
        setPreviousDue(order.previous_due);
        setDiscount(order.discount);
        setPaymentAmount(order.payment_amount);
        setPaymentMethod(order.payment_method);
        setNotes(order.notes || '');

        const itemRows: ProductRow[] = order.items.map((it) => ({
          productId: it.product_id,
          productName: it.product_name,
          productCode: it.product_code,
          quantity: it.quantity,
          unitPrice: it.unit_price,
          subtotal: it.subtotal,
        }));
        setRows(itemRows);

        // Fetch customer custom prices
        const prices = await nativeDbService.getCustomerPrices(order.customer_id);
        setCustomerPrices(prices);
      } catch (err) {
        console.error('Failed to load order for edit:', err);
        setNotification({ type: 'error', message: 'Failed to load order for editing.' });
      }
    };

    loadOrderToEdit();
  }, [editOrderId, products]);

  // Handle Customer Selection
  const handleSelectCustomer = async (cust: Customer) => {
    setSelectedCustomerId(cust.id);
    setCustomerSearch(`${cust.name} (${cust.route_name || 'No Route'})`);
    setShowCustomerDropdown(false);

    try {
      // 1. Authoritative previous due from local DB
      const due = await nativeDbService.getOpeningDue(cust.id);
      setPreviousDue(due);

      // 2. Customer specific prices
      const prices = await nativeDbService.getCustomerPrices(cust.id);
      setCustomerPrices(prices);

      // 3. If rows empty, initialize with active products
      if (rows.length === 0 && products.length > 0) {
        const initialRows: ProductRow[] = products.map((p) => {
          const customP = prices.find((cp) => cp.product_id === p.id);
          const price = customP ? customP.price : p.unit_price;
          return {
            productId: p.id,
            productName: p.name,
            productCode: p.code,
            quantity: 0,
            unitPrice: price,
            subtotal: 0,
          };
        });
        setRows(initialRows);
      } else {
        // Update unit prices for current rows
        setRows((prev) =>
          prev.map((r) => {
            const customP = prices.find((cp) => cp.product_id === r.productId);
            const defP = products.find((p) => p.id === r.productId);
            const price = customP ? customP.price : defP ? defP.unit_price : r.unitPrice;
            return {
              ...r,
              unitPrice: price,
              subtotal: r.quantity * price,
            };
          })
        );
      }
    } catch (err) {
      console.error('Failed to fetch customer pricing or due:', err);
    }
  };

  // Filtered Customers for Search
  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return customers.slice(0, 15);
    const q = customerSearch.toLowerCase();
    return customers
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.owner_name.toLowerCase().includes(q) ||
          c.phone.includes(q) ||
          c.route_name.toLowerCase().includes(q)
      )
      .slice(0, 20);
  }, [customers, customerSearch]);

  const selectedCustomer = useMemo(() => {
    return customers.find((c) => c.id === selectedCustomerId);
  }, [customers, selectedCustomerId]);

  // Calculations
  const subtotal = useMemo(() => {
    return rows.reduce((sum, r) => sum + r.subtotal, 0);
  }, [rows]);

  const totalAmount = useMemo(() => {
    return Math.max(0, subtotal - (Number(discount) || 0));
  }, [subtotal, discount]);

  const remainingDue = useMemo(() => {
    // Formula: Previous Due + Current Bill - Payment
    return Number(previousDue) + Number(totalAmount) - Number(paymentAmount);
  }, [previousDue, totalAmount, paymentAmount]);

  // Update Line Item Quantity
  const handleQuantityChange = (index: number, qty: number) => {
    const val = Math.max(0, qty);
    setRows((prev) => {
      const next = [...prev];
      const r = next[index];
      next[index] = {
        ...r,
        quantity: val,
        subtotal: val * r.unitPrice,
      };
      return next;
    });
  };

  // Update Line Item Price
  const handlePriceChange = (index: number, price: number) => {
    const val = Math.max(0, price);
    setRows((prev) => {
      const next = [...prev];
      const r = next[index];
      next[index] = {
        ...r,
        unitPrice: val,
        subtotal: r.quantity * val,
      };
      return next;
    });
  };

  // Add Custom Product Row
  const handleAddProductRow = (prod: Product) => {
    const customP = customerPrices.find((cp) => cp.product_id === prod.id);
    const price = customP ? customP.price : prod.unit_price;
    setRows((prev) => [
      ...prev,
      {
        productId: prod.id,
        productName: prod.name,
        productCode: prod.code,
        quantity: 1,
        unitPrice: price,
        subtotal: price,
      },
    ]);
  };

  // Remove Row
  const handleRemoveRow = (index: number) => {
    setRows((prev) => prev.filter((_, i) => i !== index));
  };

  // Save Bill
  const handleSaveBill = async (andPrint = false) => {
    if (!selectedCustomerId) {
      setNotification({ type: 'error', message: 'Please select a customer/shop before saving.' });
      return;
    }

    const validItems = rows.filter((r) => r.quantity > 0);
    if (validItems.length === 0 && Number(paymentAmount) <= 0) {
      setNotification({ type: 'error', message: 'Please enter at least one product quantity or payment amount.' });
      return;
    }

    try {
      setIsSaving(true);
      setNotification(null);

      const itemsPayload: SaveOrderItem[] = validItems.map((r) => ({
        product_id: r.productId,
        quantity: r.quantity,
        unit_price: r.unitPrice,
        subtotal: r.subtotal,
      }));

      const payload: SaveOrderInput = {
        id: editOrderId || undefined,
        bill_number: billNumber || undefined,
        customer_id: selectedCustomerId,
        bill_date: billDate,
        subtotal: subtotal,
        discount: Number(discount) || 0,
        total_amount: totalAmount,
        previous_due: previousDue,
        payment_amount: Number(paymentAmount) || 0,
        remaining_due: remainingDue,
        payment_method: paymentMethod,
        notes: notes.trim(),
        items: itemsPayload,
      };

      const savedBillNumber = await nativeDbService.saveOrder(payload);

      setNotification({
        type: 'success',
        message: editOrderId
          ? `Bill #${savedBillNumber} updated successfully in database.`
          : `Bill #${savedBillNumber} created and saved successfully!`,
      });

      if (andPrint) {
        setPrintBillData({
          billNumber: savedBillNumber,
          customer: selectedCustomer,
          billDate,
          rows: validItems,
          subtotal,
          discount,
          totalAmount,
          previousDue,
          paymentAmount,
          paymentMethod,
          remainingDue,
          notes,
        });
      }

      if (editOrderId) {
        setTimeout(() => navigate('/owner/orders'), 1200);
      } else {
        // Reset form for next order
        handleResetForm();
      }
    } catch (err: unknown) {
      console.error('Failed to save bill:', err);
      const msg = err instanceof Error ? err.message : String(err);
      setNotification({ type: 'error', message: `Database error: ${msg}` });
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetForm = () => {
    setSelectedCustomerId('');
    setCustomerSearch('');
    setPreviousDue(0);
    setRows(
      products.map((p) => ({
        productId: p.id,
        productName: p.name,
        productCode: p.code,
        quantity: 0,
        unitPrice: p.unit_price,
        subtotal: 0,
      }))
    );
    setDiscount(0);
    setPaymentAmount(0);
    setPaymentMethod('CASH');
    setPaymentRef('');
    setNotes('');
  };

  // Keyboard shortcut Ctrl+S or Cmd+S to save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSaveBill(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px', height: '100%', overflowY: 'auto' }}>
      {/* Top Banner / Breadcrumb */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid #cbd5e1',
          paddingBottom: '12px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Receipt size={20} color="#dc2626" />
            <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>
              {editOrderId ? `Edit Bill #${billNumber || editOrderId}` : 'Fast Daily Billing Terminal'}
            </h1>
          </div>
          <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b' }}>
            Offline-first billing with real-time balance calculations. Shortcut: <strong>Ctrl + S</strong> to Save.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={handleResetForm}
            style={{
              padding: '6px 12px',
              backgroundColor: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '4px',
              fontSize: '12px',
              fontWeight: 600,
              color: '#475569',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
            }}
          >
            <RotateCcw size={14} />
            <span>Reset</span>
          </button>

          <button
            type="button"
            onClick={() => handleSaveBill(true)}
            disabled={isSaving}
            style={{
              padding: '6px 14px',
              backgroundColor: '#0284c7',
              border: 'none',
              borderRadius: '4px',
              fontSize: '12px',
              fontWeight: 600,
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: isSaving ? 'not-allowed' : 'pointer',
            }}
          >
            <Printer size={14} />
            <span>Save & Print</span>
          </button>

          <button
            type="button"
            onClick={() => handleSaveBill(false)}
            disabled={isSaving}
            style={{
              padding: '6px 16px',
              backgroundColor: '#dc2626',
              border: 'none',
              borderRadius: '4px',
              fontSize: '12px',
              fontWeight: 600,
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: isSaving ? 'not-allowed' : 'pointer',
            }}
          >
            <Save size={14} />
            <span>{isSaving ? 'Saving...' : 'Save Bill'}</span>
          </button>
        </div>
      </div>

      {/* Notification Banner */}
      {notification && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: '6px',
            backgroundColor: notification.type === 'success' ? '#dcfce7' : '#fee2e2',
            border: `1px solid ${notification.type === 'success' ? '#86efac' : '#fca5a5'}`,
            color: notification.type === 'success' ? '#166534' : '#991b1b',
            fontSize: '12px',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {notification.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{notification.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotification(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Header Info Grid: Customer, Date, Route, Prev Due */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '12px',
          backgroundColor: '#ffffff',
          padding: '14px',
          borderRadius: '6px',
          border: '1px solid #e2e8f0',
        }}
      >
        {/* Customer Search Dropdown */}
        <div style={{ position: 'relative' }}>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
            Select Customer / Shop *
          </label>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              placeholder="Search by shop name, route, phone..."
              value={customerSearch}
              onChange={(e) => {
                setCustomerSearch(e.target.value);
                setShowCustomerDropdown(true);
              }}
              onFocus={() => setShowCustomerDropdown(true)}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '6px 28px 6px 10px',
                fontSize: '12px',
                border: '1px solid #cbd5e1',
                borderRadius: '4px',
                outline: 'none',
              }}
            />
            <Search
              size={14}
              color="#94a3b8"
              style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)' }}
            />
          </div>

          {showCustomerDropdown && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                maxHeight: '220px',
                overflowY: 'auto',
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '4px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                zIndex: 1000,
                marginTop: '4px',
              }}
            >
              {filteredCustomers.length === 0 ? (
                <div style={{ padding: '8px 12px', fontSize: '11px', color: '#94a3b8' }}>No customers found</div>
              ) : (
                filteredCustomers.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => handleSelectCustomer(c)}
                    style={{
                      padding: '8px 12px',
                      borderBottom: '1px solid #f1f5f9',
                      cursor: 'pointer',
                      fontSize: '12px',
                      backgroundColor: selectedCustomerId === c.id ? '#fef2f2' : 'transparent',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.backgroundColor =
                        selectedCustomerId === c.id ? '#fef2f2' : 'transparent')
                    }
                  >
                    <div style={{ fontWeight: 600, color: '#0f172a' }}>{c.name}</div>
                    <div style={{ fontSize: '11px', color: '#64748b', display: 'flex', gap: '8px' }}>
                      <span>Route: {c.route_name || 'None'}</span>
                      {c.phone && <span>• {c.phone}</span>}
                      <span>• Due: ₹{Number(c.current_balance || 0).toFixed(2)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Bill Date */}
        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
            Bill Date *
          </label>
          <input
            type="date"
            value={billDate}
            onChange={(e) => setBillDate(e.target.value)}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '6px 10px',
              fontSize: '12px',
              border: '1px solid #cbd5e1',
              borderRadius: '4px',
              outline: 'none',
            }}
          />
        </div>

        {/* Previous Due Display */}
        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
            Previous Due (Opening Balance)
          </label>
          <div
            style={{
              padding: '6px 10px',
              backgroundColor: '#f1f5f9',
              borderRadius: '4px',
              fontSize: '13px',
              fontWeight: 700,
              color: previousDue > 0 ? '#b91c1c' : '#166534',
              border: '1px solid #cbd5e1',
            }}
          >
            ₹{Number(previousDue || 0).toFixed(2)}
          </div>
        </div>

        {/* Route Info */}
        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
            Route / Location
          </label>
          <div
            style={{
              padding: '6px 10px',
              backgroundColor: '#f1f5f9',
              borderRadius: '4px',
              fontSize: '12px',
              color: '#334155',
              border: '1px solid #cbd5e1',
            }}
          >
            {selectedCustomer ? selectedCustomer.route_name || 'Standard Route' : '— Select shop —'}
          </div>
        </div>
      </div>

      {/* Product Items Table */}
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '6px',
          border: '1px solid #e2e8f0',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            padding: '10px 14px',
            backgroundColor: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>Bill Line Items</span>
          <span style={{ fontSize: '11px', color: '#64748b' }}>
            Press Enter / Tab to move quickly between fields
          </span>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
          <thead>
            <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #cbd5e1', textAlign: 'left' }}>
              <th style={{ padding: '8px 12px', width: '40px' }}>#</th>
              <th style={{ padding: '8px 12px' }}>Product</th>
              <th style={{ padding: '8px 12px', width: '100px' }}>Code</th>
              <th style={{ padding: '8px 12px', width: '130px', textAlign: 'center' }}>Quantity</th>
              <th style={{ padding: '8px 12px', width: '130px', textAlign: 'right' }}>Unit Price (₹)</th>
              <th style={{ padding: '8px 12px', width: '140px', textAlign: 'right' }}>Subtotal (₹)</th>
              <th style={{ padding: '8px 12px', width: '50px' }}></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>
                  No products added yet. Select a customer to auto-populate items or add below.
                </td>
              </tr>
            ) : (
              rows.map((row, idx) => (
                <tr
                  key={row.productId + idx}
                  style={{
                    borderBottom: '1px solid #e2e8f0',
                    backgroundColor: row.quantity > 0 ? '#fff9f9' : 'transparent',
                  }}
                >
                  <td style={{ padding: '8px 12px', color: '#64748b' }}>{idx + 1}</td>
                  <td style={{ padding: '8px 12px', fontWeight: 600, color: '#0f172a' }}>{row.productName}</td>
                  <td style={{ padding: '8px 12px', color: '#64748b' }}>{row.productCode}</td>
                  <td style={{ padding: '6px 12px', textAlign: 'center' }}>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={row.quantity === 0 ? '' : row.quantity}
                      onChange={(e) => handleQuantityChange(idx, parseInt(e.target.value) || 0)}
                      placeholder="0"
                      style={{
                        width: '80px',
                        padding: '4px 8px',
                        textAlign: 'center',
                        fontSize: '13px',
                        fontWeight: 700,
                        border: '1px solid #cbd5e1',
                        borderRadius: '4px',
                        outline: 'none',
                      }}
                    />
                  </td>
                  <td style={{ padding: '6px 12px', textAlign: 'right' }}>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={row.unitPrice}
                      onChange={(e) => handlePriceChange(idx, parseFloat(e.target.value) || 0)}
                      style={{
                        width: '80px',
                        padding: '4px 8px',
                        textAlign: 'right',
                        fontSize: '12px',
                        border: '1px solid #cbd5e1',
                        borderRadius: '4px',
                        outline: 'none',
                      }}
                    />
                  </td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                    ₹{row.subtotal.toFixed(2)}
                  </td>
                  <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                    <button
                      type="button"
                      onClick={() => handleRemoveRow(idx)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#94a3b8',
                        cursor: 'pointer',
                        padding: '4px',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = '#dc2626')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = '#94a3b8')}
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Quick Add Product Buttons */}
        <div style={{ padding: '8px 14px', backgroundColor: '#f8fafc', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '11px', color: '#64748b', alignSelf: 'center' }}>Add Product:</span>
          {products.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => handleAddProductRow(p)}
              style={{
                padding: '4px 8px',
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: 600,
                color: '#334155',
                cursor: 'pointer',
              }}
            >
              + {p.name}
            </button>
          ))}
        </div>
      </div>

      {/* Financial Summary & Payment Box */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '14px',
        }}
      >
        {/* Payment & Notes Entry */}
        <div
          style={{
            backgroundColor: '#ffffff',
            padding: '14px',
            borderRadius: '6px',
            border: '1px solid #e2e8f0',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          <h2 style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>
            Payment & Settlement
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                Payment Received (₹)
              </label>
              <input
                type="number"
                min={0}
                step={0.01}
                value={paymentAmount === 0 ? '' : paymentAmount}
                onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                placeholder="0.00"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '6px 10px',
                  fontSize: '13px',
                  fontWeight: 700,
                  color: '#166534',
                  border: '1px solid #cbd5e1',
                  borderRadius: '4px',
                  outline: 'none',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                Payment Mode
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '6px 10px',
                  fontSize: '12px',
                  border: '1px solid #cbd5e1',
                  borderRadius: '4px',
                  outline: 'none',
                }}
              >
                <option value="CASH">Cash</option>
                <option value="GPAY">GPay / UPI</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
                <option value="CHEQUE">Cheque</option>
              </select>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
              Discount (₹)
            </label>
            <input
              type="number"
              min={0}
              step={0.01}
              value={discount === 0 ? '' : discount}
              onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
              placeholder="0.00"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '6px 10px',
                fontSize: '12px',
                border: '1px solid #cbd5e1',
                borderRadius: '4px',
                outline: 'none',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
              Notes / Instructions
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes for this bill..."
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '6px 10px',
                fontSize: '12px',
                border: '1px solid #cbd5e1',
                borderRadius: '4px',
                outline: 'none',
              }}
            />
          </div>
        </div>

        {/* Arithmetic Calculation Summary */}
        <div
          style={{
            backgroundColor: '#ffffff',
            padding: '14px',
            borderRadius: '6px',
            border: '1px solid #e2e8f0',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <h2 style={{ margin: '0 0 10px', fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>
              Authoritative Bill Calculation
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
                <span>Subtotal:</span>
                <span>₹{subtotal.toFixed(2)}</span>
              </div>
              {discount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#16a34a' }}>
                  <span>Discount:</span>
                  <span>- ₹{Number(discount).toFixed(2)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, color: '#0f172a' }}>
                <span>Current Bill Amount:</span>
                <span>₹{totalAmount.toFixed(2)}</span>
              </div>
              <div style={{ height: '1px', backgroundColor: '#e2e8f0', margin: '4px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
                <span>(+) Previous Due:</span>
                <span>₹{Number(previousDue).toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#16a34a' }}>
                <span>(-) Payment Received:</span>
                <span>₹{Number(paymentAmount).toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Big Remaining Balance */}
          <div
            style={{
              marginTop: '12px',
              padding: '10px 12px',
              backgroundColor: remainingDue > 0 ? '#fef2f2' : '#f0fdf4',
              borderRadius: '6px',
              border: `1px solid ${remainingDue > 0 ? '#fca5a5' : '#86efac'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ fontSize: '11px', fontWeight: 600, color: remainingDue > 0 ? '#991b1b' : '#166534' }}>
                FINAL REMAINING DUE
              </div>
              <div style={{ fontSize: '10px', color: '#64748b' }}>
                (Prev Due + Bill - Payment)
              </div>
            </div>
            <div
              style={{
                fontSize: '18px',
                fontWeight: 800,
                color: remainingDue > 0 ? '#dc2626' : '#16a34a',
              }}
            >
              ₹{remainingDue.toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      {/* Thermal Bill Print Dialog */}
      {printBillData && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
          }}
        >
          <div
            style={{
              width: '340px',
              backgroundColor: '#ffffff',
              borderRadius: '8px',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)',
              padding: '16px',
              maxHeight: '90vh',
              overflowY: 'auto',
              fontFamily: 'monospace',
            }}
          >
            <div style={{ textAlign: 'center', borderBottom: '1px dashed #000', paddingBottom: '8px' }}>
              <div style={{ fontWeight: 800, fontSize: '16px' }}>ZAMZAM FOODS</div>
              <div style={{ fontSize: '11px' }}>Pandikkad, Malappuram</div>
              <div style={{ fontSize: '11px' }}>Ph: +91 98470 12345</div>
              <div style={{ marginTop: '4px', fontSize: '11px', fontWeight: 700 }}>
                BILL #{printBillData.billNumber}
              </div>
              <div style={{ fontSize: '10px' }}>Date: {printBillData.billDate}</div>
            </div>

            <div style={{ padding: '8px 0', borderBottom: '1px dashed #000', fontSize: '11px' }}>
              <div>Shop: {printBillData.customer?.name}</div>
              <div>Route: {printBillData.customer?.route_name || 'N/A'}</div>
            </div>

            <table style={{ width: '100%', fontSize: '11px', margin: '8px 0', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #000' }}>
                  <th style={{ textAlign: 'left' }}>Item</th>
                  <th style={{ textAlign: 'center' }}>Qty</th>
                  <th style={{ textAlign: 'right' }}>Price</th>
                  <th style={{ textAlign: 'right' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {printBillData.rows.map((r: any, idx: number) => (
                  <tr key={idx}>
                    <td>{r.productName}</td>
                    <td style={{ textAlign: 'center' }}>{r.quantity}</td>
                    <td style={{ textAlign: 'right' }}>{r.unitPrice.toFixed(0)}</td>
                    <td style={{ textAlign: 'right' }}>{r.subtotal.toFixed(0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ borderTop: '1px dashed #000', paddingTop: '6px', fontSize: '11px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Subtotal:</span>
                <span>₹{printBillData.subtotal.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                <span>Bill Total:</span>
                <span>₹{printBillData.totalAmount.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Previous Due:</span>
                <span>₹{printBillData.previousDue.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Paid ({printBillData.paymentMethod}):</span>
                <span>₹{printBillData.paymentAmount.toFixed(2)}</span>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontWeight: 800,
                  fontSize: '13px',
                  borderTop: '1px solid #000',
                  marginTop: '4px',
                  paddingTop: '4px',
                }}
              >
                <span>Net Due:</span>
                <span>₹{printBillData.remainingDue.toFixed(2)}</span>
              </div>
            </div>

            <div style={{ textAlign: 'center', marginTop: '12px', fontSize: '10px' }}>
              *** Thank You for Your Business ***
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
              <button
                type="button"
                onClick={() => window.print()}
                style={{
                  flex: 1,
                  padding: '8px',
                  backgroundColor: '#dc2626',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '4px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontSize: '12px',
                }}
              >
                Print Receipt
              </button>
              <button
                type="button"
                onClick={() => setPrintBillData(null)}
                style={{
                  padding: '8px 14px',
                  backgroundColor: '#e2e8f0',
                  color: '#334155',
                  border: 'none',
                  borderRadius: '4px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: '12px',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FastBillingPage;
