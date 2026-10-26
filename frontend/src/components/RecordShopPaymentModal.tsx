import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Customer, StaffMember, PaymentMethod, Route } from '../types';
import { customerService } from '../services/customerService';
import { staffService } from '../services/staffService';
import { routeService } from '../services/routeService';
import { paymentService } from '../services/paymentService';
import { formatCurrency } from '../utils/formatters';
import { useSettings } from '../context/SettingsContext';
import {
  Search,
  X,
  CreditCard,
  Banknote,
  Smartphone,
  Store,
  Users,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  Check,
  Filter,
  MapPin,
  CornerDownLeft,
  Sparkles,
  Phone,
  CheckCircle2,
} from 'lucide-react';

interface RecordShopPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message?: string) => void;
  preSelectedCustomerId?: string;
  preSelectedStaffId?: string;
}

// Clean, diacritic-free, punctuation-tolerant search normalizer
const normalizeSearchText = (text: string): string => {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

export const RecordShopPaymentModal: React.FC<RecordShopPaymentModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  preSelectedCustomerId,
  preSelectedStaffId,
}) => {
  const { isDriverModuleEnabled } = useSettings();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(false);

  // Form State
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedRouteId, setSelectedRouteId] = useState<string>('ALL');
  const [balanceFilter, setBalanceFilter] = useState<'ALL' | 'DUE' | 'ADVANCE'>('ALL');
  const [highlightedIndex, setHighlightedIndex] = useState<number>(0);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const amountInputRef = useRef<HTMLInputElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [driverForgotToggle, setDriverForgotToggle] = useState(false);
  const [forgotDriverId, setForgotDriverId] = useState('');
  const [notes, setNotes] = useState('');

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load Customers & Staff
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const loadData = async () => {
      try {
        setLoadingInitial(true);
        setErrorMessage(null);
        const [custData, stfData, rtData] = await Promise.all([
          customerService.getCustomers(undefined, undefined, true),
          staffService.getStaff({ is_active: true }),
          routeService.getRoutes(),
        ]);

        if (!isMounted) return;
        setCustomers(custData);
        setStaffList(stfData);
        setRoutes(rtData);

        if (preSelectedCustomerId) {
          const foundCust = custData.find((c) => c.id === preSelectedCustomerId);
          if (foundCust) {
            setSelectedCustomer(foundCust);
            const bal = parseFloat(foundCust.current_balance || '0');
            if (bal > 0) setAmount(bal.toFixed(2));
          }
        }

        if (preSelectedStaffId) {
          setSelectedStaffId(preSelectedStaffId);
        }
      } catch (err: any) {
        if (isMounted) {
          setErrorMessage(err.message || 'Failed to load shops or staff members.');
        }
      } finally {
        if (isMounted) setLoadingInitial(false);
      }
    };

    loadData();
    return () => {
      isMounted = false;
    };
  }, [isOpen, preSelectedCustomerId, preSelectedStaffId]);

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedCustomer(null);
      setCustomerSearch('');
      setSelectedRouteId('ALL');
      setBalanceFilter('ALL');
      setHighlightedIndex(0);
      setAmount('');
      setPaymentMethod('CASH');
      setReferenceNumber('');
      setSelectedStaffId('');
      setDriverForgotToggle(false);
      setForgotDriverId('');
      setNotes('');
      setErrorMessage(null);
      setSubmitting(false);
    }
  }, [isOpen]);

  // Focus search input on open
  useEffect(() => {
    if (isOpen && !selectedCustomer) {
      const timer = setTimeout(() => searchInputRef.current?.focus(), 80);
      return () => clearTimeout(timer);
    }
  }, [isOpen, selectedCustomer]);

  // Auto scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex >= 0 && itemRefs.current[highlightedIndex]) {
      itemRefs.current[highlightedIndex]?.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth',
      });
    }
  }, [highlightedIndex]);

  // Count of customers with pending due / advance
  const countWithDue = useMemo(() => {
    return customers.filter((c) => parseFloat(c.current_balance || '0') > 0).length;
  }, [customers]);

  const countWithAdv = useMemo(() => {
    return customers.filter((c) => parseFloat(c.current_balance || '0') < 0).length;
  }, [customers]);

  // Power Search Scoring: Multi-field, tokenized, typo-tolerant relevance scoring
  const getCustomerPowerScore = useCallback(
    (cust: Customer, rawQuery: string, tokens: string[], digitsQ: string): { score: number; matchedAll: boolean } => {
      if (tokens.length === 0) return { score: 0, matchedAll: true };

      const normName = normalizeSearchText(cust.name);
      const nameWords = normName.split(' ').filter(Boolean);
      const normOwner = normalizeSearchText(cust.owner_name || '');
      const ownerWords = normOwner.split(' ').filter(Boolean);
      const routeName = cust.route_details?.name || (cust as any).route_name || '';
      const normRoute = normalizeSearchText(routeName);
      const normAddress = normalizeSearchText(cust.address || '');
      const normLandmark = normalizeSearchText(cust.landmark || '');
      const cleanPhone = (cust.phone || '').replace(/[^0-9]/g, '');
      const cleanAltPhone = (cust.alternative_phone || '').replace(/[^0-9]/g, '');
      const bal = parseFloat(cust.current_balance || '0');

      const fullNormQuery = normalizeSearchText(rawQuery);

      let matchedTokensCount = 0;
      let tokenScoreSum = 0;

      for (const token of tokens) {
        let tScore = 0;
        const isNum = /^[0-9]+$/.test(token);

        // 1. Shop name matches
        if (normName === token) {
          tScore = Math.max(tScore, 4000);
        } else if (normName.startsWith(token)) {
          tScore = Math.max(tScore, 3000);
        } else if (nameWords.some((w) => w === token)) {
          tScore = Math.max(tScore, 2600);
        } else if (nameWords.some((w) => w.startsWith(token))) {
          tScore = Math.max(tScore, 2000);
        } else if (normName.includes(token)) {
          tScore = Math.max(tScore, 1200);
        }

        // 2. Owner name matches
        if (normOwner === token) {
          tScore = Math.max(tScore, 2400);
        } else if (ownerWords.some((w) => w === token)) {
          tScore = Math.max(tScore, 2000);
        } else if (ownerWords.some((w) => w.startsWith(token))) {
          tScore = Math.max(tScore, 1500);
        } else if (normOwner.includes(token)) {
          tScore = Math.max(tScore, 900);
        }

        // 3. Phone number matches (digits)
        if (isNum && token.length >= 2) {
          if (cleanPhone.endsWith(token) || cleanAltPhone.endsWith(token)) {
            tScore = Math.max(tScore, 2800);
          } else if (cleanPhone.startsWith(token) || cleanAltPhone.startsWith(token)) {
            tScore = Math.max(tScore, 2200);
          } else if (cleanPhone.includes(token) || cleanAltPhone.includes(token)) {
            tScore = Math.max(tScore, 1600);
          }
        }

        // 4. Route matches
        if (normRoute === token) {
          tScore = Math.max(tScore, 1800);
        } else if (normRoute.startsWith(token)) {
          tScore = Math.max(tScore, 1400);
        } else if (normRoute.includes(token)) {
          tScore = Math.max(tScore, 800);
        }

        // 5. Address / Landmark
        if (normAddress.includes(token) || normLandmark.includes(token)) {
          tScore = Math.max(tScore, 600);
        }

        if (tScore > 0) {
          matchedTokensCount++;
          tokenScoreSum += tScore;
        }
      }

      if (matchedTokensCount === 0) {
        return { score: 0, matchedAll: false };
      }

      let totalScore = tokenScoreSum;
      const matchedAll = matchedTokensCount === tokens.length;

      // Big bonus when ALL query tokens match across fields
      if (matchedAll) {
        totalScore += 5000 + matchedTokensCount * 500;
      }

      // Bonus if whole query is contiguous in shop name
      if (fullNormQuery.length > 2) {
        if (normName === fullNormQuery) {
          totalScore += 8000;
        } else if (normName.startsWith(fullNormQuery)) {
          totalScore += 4500;
        } else if (normName.includes(fullNormQuery)) {
          totalScore += 2500;
        } else if (normOwner.includes(fullNormQuery)) {
          totalScore += 1500;
        }
      }

      // Outstanding balance ranking priority (collecting dues is top priority)
      if (bal > 0) {
        totalScore += 400 + Math.min(bal, 400);
      } else if (bal < 0) {
        totalScore += 100;
      }

      return { score: totalScore, matchedAll };
    },
    []
  );

  // Filtered customer list using Power Search engine
  const filteredCustomers = useMemo(() => {
    let list = customers;

    // Filter by route
    if (selectedRouteId !== 'ALL') {
      list = list.filter((c) => c.route === selectedRouteId);
    }

    // Filter by balance tab
    if (balanceFilter === 'DUE') {
      list = list.filter((c) => parseFloat(c.current_balance || '0') > 0);
    } else if (balanceFilter === 'ADVANCE') {
      list = list.filter((c) => parseFloat(c.current_balance || '0') < 0);
    }

    const normQ = normalizeSearchText(customerSearch);
    const tokens = normQ.split(' ').filter(Boolean);
    const digitsQ = customerSearch.replace(/[^0-9]/g, '');

    if (tokens.length === 0) {
      // Sort shops: highest due balance first, then advance, then alphabetical
      return [...list].sort((a, b) => {
        const balA = parseFloat(a.current_balance || '0');
        const balB = parseFloat(b.current_balance || '0');
        if (balB !== balA) return balB - balA;
        return (a.name || '').localeCompare(b.name || '');
      });
    }

    // Score all items
    const scoredItems = list.map((c) => {
      const res = getCustomerPowerScore(c, customerSearch, tokens, digitsQ);
      return { cust: c, score: res.score, matchedAll: res.matchedAll };
    });

    // Prefer items matching ALL tokens first
    let matching = scoredItems.filter((item) => item.score > 0 && item.matchedAll);
    // If no shop matches ALL tokens (e.g. typing multiple words), fallback to any matching token!
    if (matching.length === 0) {
      matching = scoredItems.filter((item) => item.score > 0);
    }

    matching.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const balA = parseFloat(a.cust.current_balance || '0');
      const balB = parseFloat(b.cust.current_balance || '0');
      if (balB !== balA) return balB - balA;
      return (a.cust.name || '').localeCompare(b.cust.name || '');
    });

    return matching.map((item) => item.cust);
  }, [customers, customerSearch, selectedRouteId, balanceFilter, getCustomerPowerScore]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [customerSearch, selectedRouteId, balanceFilter]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (filteredCustomers.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev + 1) % filteredCustomers.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev - 1 + filteredCustomers.length) % filteredCustomers.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = filteredCustomers[highlightedIndex];
      if (target) handleSelectCustomer(target);
    } else if (e.key === 'Escape') {
      setCustomerSearch('');
    }
  };

  // Multi-token match highlighter
  const highlightMatch = (text: string, query: string) => {
    if (!query.trim() || !text) return text;
    const tokens = query
      .trim()
      .toLowerCase()
      .replace(/[^a-zA-Z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 0);

    if (tokens.length === 0) return text;

    const safeTokens = tokens.map((t) => t.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'));
    const regex = new RegExp(`(${safeTokens.join('|')})`, 'gi');
    const parts = text.split(regex);

    return (
      <>
        {parts.map((part, i) =>
          tokens.some((t) => t.toLowerCase() === part.toLowerCase()) ? (
            <mark
              key={i}
              style={{
                backgroundColor: '#fef08a',
                color: '#854d0e',
                padding: '0 2px',
                borderRadius: '2px',
                fontWeight: 800,
              }}
            >
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </>
    );
  };

  const outstandingBalance = useMemo(() => {
    if (!selectedCustomer) return 0;
    return parseFloat(selectedCustomer.current_balance || '0');
  }, [selectedCustomer]);

  const paidAmount = parseFloat(amount) || 0;
  const projectedBalance = outstandingBalance > 0 ? Math.max(0, outstandingBalance - paidAmount) : outstandingBalance - paidAmount;

  const handleSelectCustomer = (cust: Customer) => {
    setSelectedCustomer(cust);
    setCustomerSearch('');
    const bal = parseFloat(cust.current_balance || '0');
    if (bal > 0) {
      setAmount(bal.toFixed(2));
    } else {
      setAmount('');
    }
    setTimeout(() => {
      amountInputRef.current?.focus();
    }, 80);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) {
      setErrorMessage('Please select a customer shop.');
      return;
    }

    if (!paidAmount || paidAmount <= 0) {
      setErrorMessage('Please enter a valid payment amount greater than zero.');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMessage(null);

      let staffNote = '';
      if (isDriverModuleEnabled && driverForgotToggle) {
        const dObj = staffList.find((s) => s.id === forgotDriverId);
        staffNote = `Collected by Owner (Driver ${dObj?.full_name || 'Driver'} missed/forgot collection)`;
      } else {
        const staffObj = staffList.find((s) => s.id === selectedStaffId);
        if (staffObj) {
          staffNote = `Collected by ${staffObj.full_name} (${staffObj.role_type === 'MEMBER' ? 'Share Member' : (isDriverModuleEnabled ? 'Staff Driver' : 'Staff Member')})`;
        }
      }
      const combinedNotes = [notes.trim(), staffNote].filter(Boolean).join(' • ');

      const res = await paymentService.recordPayment({
        customer_id: selectedCustomer.id,
        amount: paidAmount.toFixed(2),
        payment_method: paymentMethod,
        payment_type: 'PREVIOUS_CREDIT',
        staff_member_id: (isDriverModuleEnabled && driverForgotToggle) ? (forgotDriverId || null) : (selectedStaffId || null),
        reference_number: referenceNumber.trim() || undefined,
        notes: combinedNotes || undefined,
      });

      onSuccess(
        `Successfully recorded ₹${formatCurrency(res.amount)} collection for ${selectedCustomer.name}!`
      );
      onClose();
    } catch (err: any) {
      setErrorMessage(
        err.response?.data?.error ||
          err.response?.data?.detail ||
          err.message ||
          'Failed to record payment collection.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1100,
        padding: '1rem',
        backdropFilter: 'blur(3px)',
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '600px',
          maxHeight: 'min(90vh, 740px)',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          borderRadius: '16px',
          backgroundColor: 'var(--card-bg, #ffffff)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
          overflow: 'hidden',
        }}
      >
        {/* Header - Pinned at top */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border)',
            flexShrink: 0,
            backgroundColor: 'var(--card-bg, #ffffff)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '8px',
                backgroundColor: '#ecfdf5',
                color: '#059669',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <CreditCard size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                Create Shop Collection
              </h3>
              <p style={{ margin: 0, fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                Collect money from customer shop • Credit shop balance • Attribute to collector
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              padding: '4px',
            }}
          >
            <X size={20} />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          style={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            minHeight: 0,
            overflow: 'hidden',
          }}
        >
          {/* Scrollable Form Body */}
          <div
            style={{
              padding: '1.25rem 1.5rem',
              overflowY: 'auto',
              flex: 1,
            }}
          >
            {errorMessage && (
              <div
                style={{
                  padding: '0.75rem 1rem',
                  backgroundColor: '#fee2e2',
                  color: '#991b1b',
                  borderRadius: '8px',
                  marginBottom: '1rem',
                  fontSize: '0.84rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <AlertCircle size={16} />
                <span>{errorMessage}</span>
              </div>
            )}
          {/* ─── SECTION 1: CUSTOMER SHOP SELECTION ──────────────────────── */}
          <div style={{ marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  fontSize: '0.86rem',
                  fontWeight: 800,
                  color: 'var(--text-primary)',
                  margin: 0,
                }}
              >
                <span>1. Customer Shop Selection *</span>
              </label>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  color: '#059669',
                  backgroundColor: '#ecfdf5',
                  padding: '2px 7px',
                  borderRadius: '12px',
                }}
              >
                <Sparkles size={11} /> Power Search Active
              </span>
            </div>

            {selectedCustomer ? (
              <div
                style={{
                  padding: '0.9rem 1.1rem',
                  backgroundColor: '#f8fafc',
                  border: '1.5px solid #059669',
                  borderRadius: '10px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '0.75rem',
                }}
              >
                <div style={{ flex: 1, minWidth: '220px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                    <Store size={18} color="#059669" />
                    <span style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-primary)' }}>
                      {selectedCustomer.name}
                    </span>
                    {(selectedCustomer.route_details?.name || (selectedCustomer as any).route_name) && (
                      <span
                        className="badge badge-neutral"
                        style={{ fontSize: '0.7rem', padding: '1px 7px', fontWeight: 700 }}
                      >
                        <MapPin size={10} style={{ marginRight: '3px' }} />
                        {selectedCustomer.route_details?.name || (selectedCustomer as any).route_name}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    {selectedCustomer.owner_name && (
                      <span>
                        <strong style={{ color: 'var(--text-secondary)' }}>Owner:</strong> {selectedCustomer.owner_name}
                      </span>
                    )}
                    {selectedCustomer.phone && (
                      <span>
                        <strong style={{ color: 'var(--text-secondary)' }}>Phone:</strong> {selectedCustomer.phone}
                      </span>
                    )}
                  </div>
                  {selectedCustomer.address && (
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {selectedCustomer.address}
                    </div>
                  )}
                </div>

                <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div
                    style={{
                      padding: '6px 12px',
                      borderRadius: '8px',
                      backgroundColor: outstandingBalance > 0 ? '#fee2e2' : outstandingBalance < 0 ? '#dbeafe' : '#ecfdf5',
                      color: outstandingBalance > 0 ? '#991b1b' : outstandingBalance < 0 ? '#1e40af' : '#059669',
                      textAlign: 'right',
                    }}
                  >
                    <div style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      {outstandingBalance > 0 ? 'Previous Due' : outstandingBalance < 0 ? 'Advance Credit' : 'Balance Settled'}
                    </div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>
                      {outstandingBalance > 0
                        ? formatCurrency(outstandingBalance.toFixed(2))
                        : outstandingBalance < 0
                        ? `Adv ${formatCurrency(Math.abs(outstandingBalance).toFixed(2))}`
                        : '₹0.00'}
                    </div>
                  </div>

                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      setSelectedCustomer(null);
                      setAmount('');
                    }}
                    style={{ fontSize: '0.76rem', padding: '6px 10px', fontWeight: 700 }}
                  >
                    Change Shop
                  </button>
                </div>
              </div>
            ) : (
              <div>
                {/* Search Bar + Controls */}
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                  <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
                    <Search
                      size={16}
                      style={{
                        position: 'absolute',
                        left: '12px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: 'var(--text-muted)',
                      }}
                    />
                    <input
                      ref={searchInputRef}
                      type="text"
                      className="form-input"
                      placeholder="Search shop name, owner, phone, route (e.g. Best 25, Forkod, 8863)..."
                      style={{
                        width: '100%',
                        paddingLeft: '36px',
                        paddingRight: customerSearch ? '32px' : '12px',
                        fontSize: '0.88rem',
                        fontWeight: 600,
                      }}
                      value={customerSearch}
                      onChange={(e) => setCustomerSearch(e.target.value)}
                      onKeyDown={handleKeyDown}
                      autoFocus
                    />
                    {customerSearch && (
                      <button
                        type="button"
                        onClick={() => setCustomerSearch('')}
                        style={{
                          position: 'absolute',
                          right: '8px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: 'var(--text-muted)',
                          padding: '3px',
                        }}
                        title="Clear search"
                      >
                        <X size={15} />
                      </button>
                    )}
                  </div>

                  {/* Route Filter Dropdown */}
                  {routes.length > 0 && (
                    <select
                      className="form-select"
                      style={{ maxWidth: '175px', fontSize: '0.8rem', fontWeight: 600 }}
                      value={selectedRouteId}
                      onChange={(e) => setSelectedRouteId(e.target.value)}
                    >
                      <option value="ALL">All Routes ({customers.length})</option>
                      {routes.map((r) => {
                        const count = customers.filter((c) => c.route === r.id).length;
                        return (
                          <option key={r.id} value={r.id}>
                            {r.name} ({count})
                          </option>
                        );
                      })}
                    </select>
                  )}
                </div>

                {/* Filter Pills */}
                <div style={{ display: 'flex', gap: '0.35rem', marginBottom: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className={`btn btn-xs ${balanceFilter === 'ALL' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '4px' }}
                    onClick={() => setBalanceFilter('ALL')}
                  >
                    All Shops ({customers.length})
                  </button>
                  <button
                    type="button"
                    className={`btn btn-xs ${balanceFilter === 'DUE' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{
                      fontSize: '0.72rem',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      backgroundColor: balanceFilter === 'DUE' ? '#b91c1c' : undefined,
                      borderColor: balanceFilter === 'DUE' ? '#b91c1c' : undefined,
                      color: balanceFilter === 'DUE' ? '#ffffff' : undefined,
                    }}
                    onClick={() => setBalanceFilter(balanceFilter === 'DUE' ? 'ALL' : 'DUE')}
                  >
                    🔴 Outstanding Due ({countWithDue})
                  </button>
                  {countWithAdv > 0 && (
                    <button
                      type="button"
                      className={`btn btn-xs ${balanceFilter === 'ADVANCE' ? 'btn-primary' : 'btn-secondary'}`}
                      style={{
                        fontSize: '0.72rem',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        backgroundColor: balanceFilter === 'ADVANCE' ? '#1d4ed8' : undefined,
                        borderColor: balanceFilter === 'ADVANCE' ? '#1d4ed8' : undefined,
                        color: balanceFilter === 'ADVANCE' ? '#ffffff' : undefined,
                      }}
                      onClick={() => setBalanceFilter(balanceFilter === 'ADVANCE' ? 'ALL' : 'ADVANCE')}
                    >
                      🔵 Advance Credit ({countWithAdv})
                    </button>
                  )}
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                    {filteredCustomers.length} shop{filteredCustomers.length === 1 ? '' : 's'} found • Use ↑ ↓ to navigate, Enter to select
                  </span>
                </div>

                {loadingInitial ? (
                  <div style={{ padding: '1.5rem', textAlign: 'center', fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                    Loading customer shops...
                  </div>
                ) : (
                  <div
                    style={{
                      maxHeight: '200px',
                      overflowY: 'auto',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      marginTop: '0.25rem',
                      backgroundColor: '#fff',
                      boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.05)',
                    }}
                  >
                    {filteredCustomers.length > 0 ? (
                      filteredCustomers.map((cust, idx) => {
                        const bal = parseFloat(cust.current_balance || '0');
                        const isHighlighted = idx === highlightedIndex;
                        const routeName = cust.route_details?.name || (cust as any).route_name;
                        return (
                          <div
                            key={cust.id}
                            ref={(el) => {
                              itemRefs.current[idx] = el;
                            }}
                            onClick={() => handleSelectCustomer(cust)}
                            onMouseEnter={() => setHighlightedIndex(idx)}
                            style={{
                              padding: '10px 14px',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              cursor: 'pointer',
                              borderBottom: '1px solid var(--border-light, #f1f5f9)',
                              backgroundColor: isHighlighted ? '#ecfdf5' : '#fff',
                              borderLeft: isHighlighted ? '4px solid #059669' : '4px solid transparent',
                              transition: 'all 0.12s ease',
                            }}
                          >
                            <div style={{ flex: 1, paddingRight: '0.5rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                                <Store size={14} color={isHighlighted ? '#059669' : 'var(--text-muted)'} />
                                <span style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                                  {highlightMatch(cust.name, customerSearch)}
                                </span>
                                {routeName && (
                                  <span
                                    className="badge badge-neutral"
                                    style={{ fontSize: '0.66rem', padding: '1px 5px', fontWeight: 600 }}
                                  >
                                    <MapPin size={9} style={{ marginRight: '2px' }} />
                                    {routeName}
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '3px', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                {cust.owner_name && (
                                  <span>Owner: <strong>{highlightMatch(cust.owner_name, customerSearch)}</strong></span>
                                )}
                                {cust.phone && (
                                  <span>• Phone: <strong>{highlightMatch(cust.phone, customerSearch)}</strong></span>
                                )}
                              </div>
                            </div>

                            <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                              <div>
                                <span
                                  style={{
                                    fontSize: '0.78rem',
                                    fontWeight: 800,
                                    padding: '3px 8px',
                                    borderRadius: '6px',
                                    backgroundColor: bal > 0 ? '#fee2e2' : bal < 0 ? '#dbeafe' : '#ecfdf5',
                                    color: bal > 0 ? '#dc2626' : bal < 0 ? '#1e40af' : '#059669',
                                    display: 'inline-block',
                                  }}
                                >
                                  {bal > 0
                                    ? `Due: ${formatCurrency(bal.toFixed(2))}`
                                    : bal < 0
                                    ? `Adv: ${formatCurrency(Math.abs(bal).toFixed(2))}`
                                    : '✓ No Due'}
                                </span>
                              </div>
                              {isHighlighted && (
                                <span title="Press Enter to select">
                                  <CornerDownLeft size={14} color="#059669" />
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div style={{ padding: '2rem 1.5rem', textAlign: 'center', fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
                          No customer shops found matching "{customerSearch}".
                        </div>
                        <div style={{ fontSize: '0.76rem', marginBottom: '0.75rem' }}>
                          Try searching by phone digits, shop name keywords, or route.
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                          {customerSearch && (
                            <button
                              type="button"
                              className="btn btn-secondary btn-xs"
                              onClick={() => setCustomerSearch('')}
                            >
                              Clear Search
                            </button>
                          )}
                          {selectedRouteId !== 'ALL' && (
                            <button
                              type="button"
                              className="btn btn-secondary btn-xs"
                              onClick={() => setSelectedRouteId('ALL')}
                            >
                              Clear Route Filter
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ─── SECTION 2: AMOUNT & PAYMENT METHOD ─────────────────────── */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label
              style={{
                display: 'block',
                fontSize: '0.84rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
                marginBottom: '0.4rem',
              }}
            >
              2. Payment Amount & Method *
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                  Amount Received (₹) *
                </label>
                <div style={{ position: 'relative' }}>
                  <span
                    style={{
                      position: 'absolute',
                      left: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      fontWeight: 800,
                      color: 'var(--text-muted)',
                      fontSize: '1.1rem',
                    }}
                  >
                    ₹
                  </span>
                  <input
                    ref={amountInputRef}
                    type="number"
                    step="0.01"
                    min="0"
                    className="form-input"
                    placeholder="0.00"
                    style={{
                      width: '100%',
                      paddingLeft: '30px',
                      fontSize: '1.15rem',
                      fontWeight: 800,
                      color: '#059669',
                    }}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                  Payment Method *
                </label>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '4px',
                    padding: '3px',
                    backgroundColor: 'var(--border-color, #f1f5f9)',
                    borderRadius: '8px',
                    height: '42px',
                    alignItems: 'center',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('CASH')}
                    style={{
                      height: '36px',
                      border: 'none',
                      borderRadius: '6px',
                      fontWeight: 700,
                      fontSize: '0.78rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px',
                      background: paymentMethod === 'CASH' ? '#059669' : 'transparent',
                      color: paymentMethod === 'CASH' ? '#ffffff' : 'var(--text-primary)',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <Banknote size={14} /> Cash
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('GPAY_UPI')}
                    style={{
                      height: '36px',
                      border: 'none',
                      borderRadius: '6px',
                      fontWeight: 700,
                      fontSize: '0.78rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px',
                      background: paymentMethod === 'GPAY_UPI' ? '#1d4ed8' : 'transparent',
                      color: paymentMethod === 'GPAY_UPI' ? '#ffffff' : 'var(--text-primary)',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <Smartphone size={14} /> GPay / UPI
                  </button>
                </div>
              </div>
            </div>

            {/* Quick shortcuts if customer has balance */}
            {selectedCustomer && outstandingBalance > 0 && (
              <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', alignSelf: 'center' }}>
                  Quick Fill:
                </span>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.72rem', padding: '2px 8px' }}
                  onClick={() => setAmount(outstandingBalance.toFixed(2))}
                >
                  Full Due (₹{outstandingBalance.toFixed(2)})
                </button>
                {outstandingBalance >= 500 && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.72rem', padding: '2px 8px' }}
                    onClick={() => setAmount('500.00')}
                  >
                    ₹500
                  </button>
                )}
                {outstandingBalance >= 1000 && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.72rem', padding: '2px 8px' }}
                    onClick={() => setAmount('1000.00')}
                  >
                    ₹1,000
                  </button>
                )}
              </div>
            )}

            {/* If GPay / UPI, show reference number input */}
            {paymentMethod === 'GPAY_UPI' && (
              <div style={{ marginBottom: '0.75rem' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                  UPI Reference ID / Transaction Ref (Optional)
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. 423985729182 or GPay UTR"
                  style={{ width: '100%', fontSize: '0.84rem' }}
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                />
              </div>
            )}

            {/* Projected Balance Card */}
            {selectedCustomer && (
              <div
                style={{
                  padding: '0.65rem 0.9rem',
                  backgroundColor: '#f8fafc',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '0.78rem',
                }}
              >
                <span>
                  Pre-due:{' '}
                  <strong>
                    {outstandingBalance > 0
                      ? formatCurrency(outstandingBalance.toFixed(2))
                      : outstandingBalance < 0
                      ? `Adv ${formatCurrency(Math.abs(outstandingBalance).toFixed(2))}`
                      : '₹0.00'}
                  </strong>{' '}
                  − Paid:{' '}
                  <strong style={{ color: '#059669' }}>{formatCurrency(paidAmount.toFixed(2))}</strong>
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <ArrowRight size={13} color="var(--text-muted)" />
                  {projectedBalance > 0 ? (
                    <>
                      Remaining Due:{' '}
                      <strong style={{ color: '#dc2626', fontSize: '0.86rem' }}>
                        {formatCurrency(projectedBalance.toFixed(2))}
                      </strong>
                    </>
                  ) : projectedBalance < 0 ? (
                    <>
                      Projected Advance:{' '}
                      <strong style={{ color: '#1d4ed8', fontSize: '0.86rem' }}>
                        Adv {formatCurrency(Math.abs(projectedBalance).toFixed(2))}
                      </strong>
                    </>
                  ) : (
                    <>
                      Balance:{' '}
                      <strong style={{ color: '#059669', fontSize: '0.86rem' }}>
                        ✓ Cleared (₹0.00)
                      </strong>
                    </>
                  )}
                </span>
              </div>
            )}
          </div>

          {/* ─── SECTION 3: STAFF / SHARE MEMBER SELECTION ───────────────── */}
          <div style={{ marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem', flexWrap: 'wrap', gap: '0.4rem' }}>
              <label
                style={{
                  fontSize: '0.84rem',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  margin: 0,
                }}
              >
                3. Money Received / Held By
              </label>

              {isDriverModuleEnabled && (
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    color: driverForgotToggle ? '#b45309' : 'var(--text-muted)',
                    cursor: 'pointer',
                    backgroundColor: driverForgotToggle ? '#fef3c7' : '#f1f5f9',
                    padding: '2px 8px',
                    borderRadius: '6px',
                    border: driverForgotToggle ? '1px solid #fde68a' : '1px solid transparent',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={driverForgotToggle}
                    onChange={(e) => {
                      setDriverForgotToggle(e.target.checked);
                      if (e.target.checked && !forgotDriverId) {
                        const firstDriver = staffList.find((s) => s.role_type === 'STAFF');
                        if (firstDriver) setForgotDriverId(firstDriver.id);
                      }
                    }}
                  />
                  <span>Driver Forgot to Collect (Owner Collected)</span>
                </label>
              )}
            </div>

            {isDriverModuleEnabled && driverForgotToggle ? (
              <div
                style={{
                  padding: '0.75rem',
                  backgroundColor: '#fffbeb',
                  border: '1.5px solid #f59e0b',
                  borderRadius: '8px',
                  marginBottom: '0.5rem',
                }}
              >
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#92400e', marginBottom: '0.35rem' }}>
                  Select Which Driver Missed / Forgot This Collection:
                </div>
                <select
                  className="form-select"
                  style={{ width: '100%', fontSize: '0.84rem', fontWeight: 600, borderColor: '#f59e0b' }}
                  value={forgotDriverId}
                  onChange={(e) => setForgotDriverId(e.target.value)}
                >
                  <option value="">-- Choose Assigned Driver --</option>
                  {staffList
                    .filter((s) => s.role_type === 'STAFF')
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.full_name} ({s.designation || 'Staff Driver'})
                      </option>
                    ))}
                </select>
                <div style={{ fontSize: '0.72rem', color: '#b45309', marginTop: '4px' }}>
                  Payment will be credited directly to the shop and registered as received by Owner on behalf of the driver.
                </div>
              </div>
            ) : (
              <div style={{ position: 'relative' }}>
                <select
                  className="form-select"
                  style={{ width: '100%', fontSize: '0.86rem', fontWeight: 600 }}
                  value={selectedStaffId}
                  onChange={(e) => setSelectedStaffId(e.target.value)}
                >
                  <option value="">-- Direct Counter / Owner Cash Drawer --</option>
                  <optgroup label="Share Members (Business Owners)">
                    {staffList
                      .filter((s) => s.role_type === 'MEMBER')
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.full_name} ({s.designation || 'Share Member'})
                        </option>
                      ))}
                  </optgroup>
                  <optgroup label={isDriverModuleEnabled ? "Staff & Drivers" : "Staff Members"}>
                    {staffList
                      .filter((s) => s.role_type === 'STAFF')
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.full_name} ({s.designation || (isDriverModuleEnabled ? 'Staff Driver' : 'Staff Member')})
                        </option>
                      ))}
                  </optgroup>
                </select>
              </div>
            )}

            {/* Informational notice: NOT an expense */}
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.45rem',
                marginTop: '0.45rem',
                padding: '0.5rem 0.75rem',
                backgroundColor: '#eff6ff',
                color: '#1e40af',
                borderRadius: '6px',
                fontSize: '0.74rem',
                lineHeight: 1.4,
              }}
            >
              <ShieldCheck size={16} style={{ flexShrink: 0, marginTop: '1px' }} />
              <div>
                <strong>Accounting Safeguard:</strong> This money collected from the shop is credited to the
                customer's ledger (reduces their outstanding debt) and logged under the selected member. It is{' '}
                <strong>NOT</strong> recorded as an expense.
              </div>
            </div>
          </div>

          {/* Notes / Remarks */}
          <div style={{ marginBottom: '0.5rem' }}>
            <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
              Additional Notes / Remarks (Optional)
            </label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Cleared Diwali balance, partial cash..."
              style={{ width: '100%', fontSize: '0.82rem' }}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        {/* Fixed Action Footer - Always visible, never cut off */}
        <div
          style={{
            padding: '0.9rem 1.5rem',
            borderTop: '1px solid var(--border)',
            backgroundColor: 'var(--bg-main, #f8fafc)',
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            gap: '0.75rem',
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={submitting || !selectedCustomer || paidAmount <= 0}
            style={{
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              backgroundColor: '#059669',
              borderColor: '#059669',
              padding: '0.55rem 1.25rem',
            }}
          >
            <Check size={16} />
            {submitting
              ? 'Creating Collection...'
              : `Create Collection of ${formatCurrency(paidAmount.toFixed(2))}`}
          </button>
        </div>
      </form>
    </div>
  </div>
);
};
