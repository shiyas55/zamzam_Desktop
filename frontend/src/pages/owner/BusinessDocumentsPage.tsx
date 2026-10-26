import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  businessDocumentService,
  BusinessDocument,
  BusinessDocumentType,
} from '../../services/businessDocumentService';
import { formatDate } from '../../utils/formatters';
import {
  ShieldCheck,
  UploadCloud,
  Eye,
  Download,
  Trash2,
  Edit2,
  Search,
  AlertTriangle,
  CheckCircle2,
  X,
  FileText,
  File as FileIcon,
  Image as ImageIcon,
  Clock,
  HardDrive,
  RefreshCw,
  FolderArchive,
  Calendar,
  AlertCircle,
  Building,
  Hash,
  ExternalLink,
  Plus,
  Award,
  Flame,
  Leaf,
  CreditCard,
  Briefcase,
  Star,
} from 'lucide-react';

/* ── Document type config ── */
const DOC_TYPES: Record<
  BusinessDocumentType,
  { label: string; color: string; bg: string; icon: React.ReactNode }
> = {
  FSSAI_LICENSE:   { label: 'FSSAI Food Safety',    color: '#16a34a', bg: '#dcfce7', icon: <ShieldCheck size={14}/> },
  GST_CERTIFICATE: { label: 'GST Certificate',       color: '#2563eb', bg: '#dbeafe', icon: <FileText size={14}/> },
  TRADE_LICENSE:   { label: 'Trade License',          color: '#0891b2', bg: '#cffafe', icon: <Building size={14}/> },
  SHOP_ACT:        { label: 'Shop & Estb. Act',       color: '#6d28d9', bg: '#ede9fe', icon: <Briefcase size={14}/> },
  FIRE_NOC:        { label: 'Fire NOC',               color: '#dc2626', bg: '#fee2e2', icon: <Flame size={14}/> },
  POLLUTION_NOC:   { label: 'Pollution NOC',          color: '#059669', bg: '#d1fae5', icon: <Leaf size={14}/> },
  BANK_DOCUMENT:   { label: 'Bank Document',          color: '#0f766e', bg: '#ccfbf1', icon: <CreditCard size={14}/> },
  INSURANCE:       { label: 'Insurance Policy',       color: '#7c3aed', bg: '#ede9fe', icon: <ShieldCheck size={14}/> },
  RENT_AGREEMENT:  { label: 'Rent Agreement',         color: '#9333ea', bg: '#f3e8ff', icon: <FileText size={14}/> },
  PAN_CARD:        { label: 'PAN Card',               color: '#ea580c', bg: '#ffedd5', icon: <CreditCard size={14}/> },
  UDYAM:           { label: 'Udyam / MSME',           color: '#0369a1', bg: '#e0f2fe', icon: <Award size={14}/> },
  HALAL_CERT:      { label: 'Halal Certification',    color: '#15803d', bg: '#dcfce7', icon: <Star size={14}/> },
  QUALITY_CERT:    { label: 'Quality / ISO Cert',     color: '#b45309', bg: '#fef3c7', icon: <Award size={14}/> },
  OTHER:           { label: 'Other Document',         color: '#4b5563', bg: '#f3f4f6', icon: <FileIcon size={14}/> },
};

function formatBytes(bytes: number, decimals = 1): string {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
}

/* ══════════════════════════════════════════════════════════════════ */
export const BusinessDocumentsPage: React.FC = () => {
  const { user } = useAuth();
  const canWrite = user?.role === 'OWNER' || user?.role === 'MANAGER';

  const [documents, setDocuments] = useState<BusinessDocument[]>([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  /* Filters */
  const [search, setSearch]           = useState('');
  const [typeFilter, setTypeFilter]   = useState<string>('ALL');
  const [expiryFilter, setExpiryFilter] = useState<'ALL'|'EXPIRED'|'ACTIVE'>('ALL');

  /* Modals */
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [previewDoc, setPreviewDoc]     = useState<BusinessDocument | null>(null);
  const [editDoc, setEditDoc]           = useState<BusinessDocument | null>(null);
  const [deleteDoc, setDeleteDoc]       = useState<BusinessDocument | null>(null);
  const [toast, setToast]               = useState<string | null>(null);

  /* Upload form */
  const [upDocType, setUpDocType]       = useState<BusinessDocumentType>('FSSAI_LICENSE');
  const [upTitle, setUpTitle]           = useState('');
  const [upDocNumber, setUpDocNumber]   = useState('');
  const [upAuthority, setUpAuthority]   = useState('');
  const [upIssueDate, setUpIssueDate]   = useState('');
  const [upExpiry, setUpExpiry]         = useState('');
  const [upNotes, setUpNotes]           = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadError, setUploadError]   = useState<string | null>(null);
  const [uploading, setUploading]       = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* Edit form */
  const [editTitle, setEditTitle]       = useState('');
  const [editDocType, setEditDocType]   = useState<BusinessDocumentType>('OTHER');
  const [editDocNum, setEditDocNum]     = useState('');
  const [editAuthority, setEditAuthority] = useState('');
  const [editIssue, setEditIssue]       = useState('');
  const [editExpiry, setEditExpiry]     = useState('');
  const [editNotes, setEditNotes]       = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError]       = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  /* ── Fetch ── */
  const fetchDocs = async () => {
    try {
      setLoading(true);
      const docs = await businessDocumentService.getDocuments({
        document_type: typeFilter !== 'ALL' ? typeFilter : undefined,
        is_expired:
          expiryFilter === 'EXPIRED' ? 'true' : expiryFilter === 'ACTIVE' ? 'false' : undefined,
        search: search || undefined,
      });
      setDocuments(docs);
    } catch (err: any) {
      showToast('Failed to load documents.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchDocs(); }, [typeFilter, expiryFilter]);

  const handleRefresh = () => { setRefreshing(true); fetchDocs(); };

  /* ── Client-side search ── */
  const filtered = useMemo(() => {
    if (!search.trim()) return documents;
    const q = search.toLowerCase();
    return documents.filter(d =>
      d.title.toLowerCase().includes(q) ||
      d.document_number?.toLowerCase().includes(q) ||
      d.issuing_authority?.toLowerCase().includes(q) ||
      d.document_type_display?.toLowerCase().includes(q) ||
      d.file_name?.toLowerCase().includes(q)
    );
  }, [documents, search]);

  /* ── Stats ── */
  const stats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const totalStorage = documents.reduce((s, d) => s + (d.file_size || 0), 0);
    const expired = documents.filter(d => d.expiry_date && d.expiry_date < today).length;
    const expiringSoon = documents.filter(d => {
      if (!d.expiry_date) return false;
      const ms = new Date(d.expiry_date).getTime() - Date.now();
      return ms >= 0 && ms <= 30 * 24 * 3600 * 1000;
    }).length;
    return { total: documents.length, totalStorage, expired, expiringSoon };
  }, [documents]);

  /* ── File helpers ── */
  const isImage = (mime?: string, name?: string) =>
    mime?.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(name || '');
  const isPdf = (mime?: string, name?: string) =>
    mime === 'application/pdf' || /\.pdf$/i.test(name || '');

  /* ── Upload handlers ── */
  const openUploadModal = () => {
    setUpDocType('FSSAI_LICENSE'); setUpTitle(''); setUpDocNumber(''); setUpAuthority('');
    setUpIssueDate(''); setUpExpiry(''); setUpNotes(''); setSelectedFiles([]);
    setUploadError(null); setIsUploadOpen(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFiles(prev => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.style.borderColor = 'var(--border)';
    e.currentTarget.style.background = 'var(--bg-secondary)';
    if (e.dataTransfer.files.length > 0)
      setSelectedFiles(prev => [...prev, ...Array.from(e.dataTransfer.files)]);
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedFiles.length === 0) { setUploadError('Select at least one file.'); return; }
    try {
      setUploading(true); setUploadError(null);
      const created = await businessDocumentService.batchUpload({
        document_type: upDocType,
        title: upTitle.trim() || undefined,
        document_number: upDocNumber.trim() || undefined,
        issuing_authority: upAuthority.trim() || undefined,
        issue_date: upIssueDate || undefined,
        expiry_date: upExpiry || undefined,
        notes: upNotes.trim() || undefined,
        files: selectedFiles,
      });
      showToast(`${created.length} document${created.length > 1 ? 's' : ''} uploaded successfully!`);
      setIsUploadOpen(false);
      fetchDocs();
    } catch (err: any) {
      setUploadError(err.message || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  /* ── Edit handlers ── */
  const openEditModal = (doc: BusinessDocument) => {
    setEditDoc(doc); setEditTitle(doc.title); setEditDocType(doc.document_type);
    setEditDocNum(doc.document_number || ''); setEditAuthority(doc.issuing_authority || '');
    setEditIssue(doc.issue_date || ''); setEditExpiry(doc.expiry_date || '');
    setEditNotes(doc.notes || ''); setEditError(null);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editDoc) return;
    if (!editTitle.trim()) { setEditError('Title is required.'); return; }
    try {
      setEditSubmitting(true); setEditError(null);
      const updated = await businessDocumentService.updateDocument(editDoc.id, {
        title: editTitle.trim(),
        document_type: editDocType,
        document_number: editDocNum.trim() || undefined,
        issuing_authority: editAuthority.trim() || undefined,
        issue_date: editIssue || null,
        expiry_date: editExpiry || null,
        notes: editNotes.trim(),
      });
      setDocuments(prev => prev.map(d => d.id === updated.id ? updated : d));
      showToast('Document updated.'); setEditDoc(null);
    } catch (err: any) {
      setEditError(err.message || 'Failed to update.');
    } finally {
      setEditSubmitting(false);
    }
  };

  /* ── Delete handler ── */
  const handleDelete = async () => {
    if (!deleteDoc) return;
    try {
      await businessDocumentService.deleteDocument(deleteDoc.id);
      setDocuments(prev => prev.filter(d => d.id !== deleteDoc.id));
      showToast('Document deleted.'); setDeleteDoc(null);
    } catch {
      showToast('Failed to delete document.');
    }
  };

  /* ══════════════════════════════ RENDER ══════════════════════════════ */
  return (
    <div style={{ maxWidth: 1440, margin: '0 auto', paddingBottom: '3rem' }}>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: '1.5rem', right: '1.5rem', zIndex: 9999,
          background: 'var(--text-primary)', color: 'var(--bg-primary)',
          padding: '0.75rem 1.25rem', borderRadius: '12px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          fontWeight: 600, fontSize: '0.875rem',
        }}>
          <CheckCircle2 size={16} color="#10b981" />
          <span>{toast}</span>
        </div>
      )}

      {/* ── Header ── */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', alignItems: 'center',
        justifyContent: 'space-between', gap: '1rem', marginBottom: '1.75rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: 48, height: 48, borderRadius: '12px',
            background: 'linear-gradient(135deg, #16a34a 0%, #059669 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', boxShadow: '0 6px 16px rgba(22,163,74,0.35)',
          }}>
            <ShieldCheck size={26} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.55rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              My Business Documents
            </h1>
            <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
              Zamzam Foods — FSSAI food safety license, GST, trade licenses &amp; compliance certificates
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            type="button" className="btn btn-secondary"
            onClick={handleRefresh} disabled={refreshing}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', height: '38px' }}
          >
            <RefreshCw size={15} className={refreshing ? 'spin' : ''} />
            <span>Refresh</span>
          </button>

          {canWrite && (
            <button
              type="button" className="btn btn-primary"
              onClick={openUploadModal}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                height: '38px', padding: '0 1.25rem', fontWeight: 700,
                background: 'linear-gradient(135deg, #16a34a 0%, #059669 100%)',
                boxShadow: '0 4px 12px rgba(22,163,74,0.35)',
                border: 'none',
              }}
            >
              <UploadCloud size={17} />
              <span>Upload Document</span>
            </button>
          )}
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
        gap: '1rem', marginBottom: '1.5rem',
      }}>
        {[
          { label: 'Total Documents', value: stats.total, icon: <FolderArchive size={20} color="#16a34a" />, sub: 'Zamzam Foods compliance files' },
          { label: 'Storage Used', value: formatBytes(stats.totalStorage), icon: <HardDrive size={20} color="#0891b2" />, sub: 'Encrypted document storage' },
          { label: 'Expiring Soon', value: stats.expiringSoon, icon: <Clock size={20} color="#d97706" />, sub: 'Renew within 30 days', alert: stats.expiringSoon > 0 },
          { label: 'Expired', value: stats.expired, icon: <AlertTriangle size={20} color="#dc2626" />, sub: 'Requires urgent renewal', alert: stats.expired > 0 },
        ].map((card, i) => (
          <div key={i} className="card" style={{
            padding: '1rem 1.25rem',
            border: card.alert ? '1.5px solid #fca5a5' : '1px solid var(--border)',
            background: card.alert ? 'rgba(239,68,68,0.03)' : undefined,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{card.label}</span>
              {card.icon}
            </div>
            <div style={{
              fontSize: '1.65rem', fontWeight: 800, marginTop: '0.4rem',
              color: card.alert ? '#dc2626' : 'var(--text-primary)',
            }}>{card.value}</div>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{card.sub}</span>
          </div>
        ))}
      </div>

      {/* ── Filters ── */}
      <div className="card" style={{
        padding: '1rem', marginBottom: '1.5rem',
        display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem',
      }}>
        <div style={{ position: 'relative', flex: '1 1 240px', minWidth: 200 }}>
          <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text" className="input"
            style={{ paddingLeft: '2.25rem', height: '36px', fontSize: '0.85rem' }}
            placeholder="Search title, license #, authority..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <select className="input" style={{ height: '36px', fontSize: '0.85rem', minWidth: 180 }}
          value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="ALL">All Document Types</option>
          {Object.entries(DOC_TYPES).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>

        <select className="input" style={{ height: '36px', fontSize: '0.85rem', minWidth: 140 }}
          value={expiryFilter} onChange={e => setExpiryFilter(e.target.value as any)}>
          <option value="ALL">All Expiries</option>
          <option value="ACTIVE">Active / Valid</option>
          <option value="EXPIRED">Expired</option>
        </select>

        {(search || typeFilter !== 'ALL' || expiryFilter !== 'ALL') && (
          <button type="button" className="btn btn-secondary btn-sm"
            style={{ height: '36px', color: 'var(--text-muted)' }}
            onClick={() => { setSearch(''); setTypeFilter('ALL'); setExpiryFilter('ALL'); }}>
            Clear Filters
          </button>
        )}
      </div>

      {/* ── Document Grid ── */}
      {loading ? (
        <div className="card" style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          <RefreshCw size={28} className="spin" style={{ margin: '0 auto 0.75rem' }} />
          <div style={{ fontWeight: 600 }}>Loading business documents...</div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{
          padding: '4rem 2rem', textAlign: 'center',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem',
        }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: 'linear-gradient(135deg, #dcfce7, #d1fae5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#16a34a',
          }}>
            <ShieldCheck size={36} />
          </div>
          <div>
            <h3 style={{ margin: '0 0 0.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {search || typeFilter !== 'ALL' ? 'No documents matched your filters' : 'No business documents yet'}
            </h3>
            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)', maxWidth: 460 }}>
              {search || typeFilter !== 'ALL'
                ? 'Try clearing your filters to see all documents.'
                : 'Upload your FSSAI food safety license, GST certificate, trade license, and other compliance documents for Zamzam Foods.'}
            </p>
          </div>
          {canWrite && !search && (
            <button type="button" className="btn btn-primary"
              onClick={openUploadModal}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem',
                background: 'linear-gradient(135deg, #16a34a 0%, #059669 100%)',
                border: 'none', boxShadow: '0 4px 12px rgba(22,163,74,0.3)',
              }}>
              <UploadCloud size={16} />
              <span>Upload First Document</span>
            </button>
          )}
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(330px,1fr))',
          gap: '1.25rem',
        }}>
          {filtered.map(doc => {
            const badge = DOC_TYPES[doc.document_type] || DOC_TYPES.OTHER;
            const today = new Date().toISOString().split('T')[0];
            const isExpired = !!(doc.expiry_date && doc.expiry_date < today);
            const isExpiringSoon = !isExpired && !!doc.expiry_date &&
              (new Date(doc.expiry_date).getTime() - Date.now() <= 30 * 24 * 3600 * 1000);
            const imgFile = isImage(doc.mime_type, doc.file_name);
            const pdfFile = isPdf(doc.mime_type, doc.file_name);

            return (
              <div key={doc.id} className="card" style={{
                display: 'flex', flexDirection: 'column', overflow: 'hidden',
                border: isExpired
                  ? '1.5px solid #fca5a5'
                  : isExpiringSoon
                  ? '1.5px solid #fde68a'
                  : '1px solid var(--border)',
                transition: 'transform 0.18s, box-shadow 0.18s',
              }}>

                {/* Thumbnail */}
                <div
                  style={{
                    height: 148, position: 'relative', overflow: 'hidden', cursor: 'pointer',
                    background: imgFile ? '#000' : `linear-gradient(135deg, ${badge.bg}, #fff)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                  onClick={() => setPreviewDoc(doc)}
                >
                  {imgFile && doc.file_url ? (
                    <img src={doc.file_url} alt={doc.title}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : pdfFile ? (
                    <div style={{ textAlign: 'center', color: '#dc2626', opacity: 0.9 }}>
                      <FileText size={54} strokeWidth={1.2} />
                      <div style={{ fontSize: '0.7rem', fontWeight: 800, marginTop: '0.25rem', letterSpacing: '0.06em' }}>PDF</div>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', color: badge.color, opacity: 0.85 }}>
                      <span style={{ fontSize: '2.5rem' }}>{badge.icon}</span>
                      <div style={{ fontSize: '0.7rem', fontWeight: 800, marginTop: '0.25rem', color: badge.color, letterSpacing: '0.04em' }}>DOCUMENT</div>
                    </div>
                  )}

                  {/* Type badge */}
                  <span style={{
                    position: 'absolute', top: '0.65rem', left: '0.65rem',
                    display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                    padding: '0.22rem 0.55rem', borderRadius: '5px',
                    fontSize: '0.7rem', fontWeight: 800,
                    background: badge.bg, color: badge.color,
                    boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
                  }}>
                    {badge.icon} {badge.label}
                  </span>

                  {/* Expiry badge */}
                  {isExpired ? (
                    <span style={{
                      position: 'absolute', top: '0.65rem', right: '0.65rem',
                      display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                      padding: '0.22rem 0.55rem', borderRadius: '5px',
                      fontSize: '0.7rem', fontWeight: 800,
                      background: '#fee2e2', color: '#dc2626',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
                    }}>
                      <AlertTriangle size={11} /> EXPIRED
                    </span>
                  ) : isExpiringSoon ? (
                    <span style={{
                      position: 'absolute', top: '0.65rem', right: '0.65rem',
                      display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                      padding: '0.22rem 0.55rem', borderRadius: '5px',
                      fontSize: '0.7rem', fontWeight: 800,
                      background: '#fef3c7', color: '#d97706',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
                    }}>
                      <Clock size={11} /> EXPIRING SOON
                    </span>
                  ) : doc.expiry_date ? (
                    <span style={{
                      position: 'absolute', top: '0.65rem', right: '0.65rem',
                      display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                      padding: '0.22rem 0.55rem', borderRadius: '5px',
                      fontSize: '0.7rem', fontWeight: 800,
                      background: '#dcfce7', color: '#16a34a',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
                    }}>
                      <CheckCircle2 size={11} /> VALID
                    </span>
                  ) : null}

                  {/* View hint */}
                  <div style={{
                    position: 'absolute', bottom: '0.5rem', right: '0.5rem',
                    background: 'rgba(0,0,0,0.55)', color: '#fff',
                    padding: '0.2rem 0.45rem', borderRadius: '4px',
                    fontSize: '0.68rem', display: 'flex', alignItems: 'center', gap: '0.25rem',
                  }}>
                    <Eye size={11} /> View
                  </div>
                </div>

                {/* Card Body */}
                <div style={{ padding: '1rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <h4 style={{
                    margin: 0, fontSize: '0.98rem', fontWeight: 800,
                    color: isExpired ? '#dc2626' : 'var(--text-primary)',
                    lineHeight: 1.3, wordBreak: 'break-word',
                  }}>
                    {doc.title}
                  </h4>

                  {doc.document_number && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.79rem', color: 'var(--text-secondary)' }}>
                      <Hash size={12} color="var(--text-muted)" />
                      <span>License #: <strong style={{ color: 'var(--text-primary)' }}>{doc.document_number}</strong></span>
                    </div>
                  )}

                  {doc.issuing_authority && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.79rem', color: 'var(--text-secondary)' }}>
                      <Building size={12} color="var(--text-muted)" />
                      <span>{doc.issuing_authority}</span>
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', marginTop: '0.25rem', fontSize: '0.77rem' }}>
                    {doc.issue_date && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-muted)' }}>
                        <Calendar size={11} />
                        <span>Issued: {formatDate(doc.issue_date)}</span>
                      </div>
                    )}
                    {doc.expiry_date && (
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: '0.35rem',
                        color: isExpired ? '#dc2626' : isExpiringSoon ? '#d97706' : 'var(--text-muted)',
                        fontWeight: isExpired || isExpiringSoon ? 700 : 400,
                      }}>
                        <Clock size={11} />
                        <span>Expires: {formatDate(doc.expiry_date)}</span>
                      </div>
                    )}
                  </div>

                  {doc.notes && (
                    <p style={{
                      margin: '0.25rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)',
                      lineHeight: 1.4, overflow: 'hidden',
                      display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                    }}>
                      {doc.notes}
                    </p>
                  )}

                  {/* Footer */}
                  <div style={{
                    marginTop: 'auto', paddingTop: '0.65rem',
                    borderTop: '1px solid var(--border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    fontSize: '0.7rem', color: 'var(--text-muted)',
                  }}>
                    <span>{formatBytes(doc.file_size)} • {formatDate(doc.created_at)}</span>
                    {doc.uploaded_by_name && <span>By {doc.uploaded_by_name}</span>}
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.6rem' }}>
                    <button type="button" className="btn btn-secondary btn-sm"
                      onClick={() => setPreviewDoc(doc)}
                      style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', height: '30px' }}>
                      <Eye size={13} /> <span>View</span>
                    </button>

                    {doc.file_url && (
                      <a href={doc.file_url} target="_blank" rel="noopener noreferrer"
                        download={doc.file_name}
                        className="btn btn-secondary btn-sm"
                        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', height: '30px', padding: '0 0.5rem', color: '#10b981' }}
                        title="Download">
                        <Download size={13} />
                      </a>
                    )}

                    {canWrite && (
                      <>
                        <button type="button" className="btn btn-secondary btn-sm"
                          onClick={() => openEditModal(doc)}
                          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', height: '30px', padding: '0 0.5rem', color: '#0284c7' }}
                          title="Edit">
                          <Edit2 size={13} />
                        </button>
                        <button type="button" className="btn btn-secondary btn-sm"
                          onClick={() => setDeleteDoc(doc)}
                          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', height: '30px', padding: '0 0.5rem', color: '#dc2626' }}
                          title="Delete">
                          <Trash2 size={13} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ══ UPLOAD MODAL ══ */}
      {isUploadOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
        }}>
          <div className="card" style={{
            width: '100%', maxWidth: 660,
            maxHeight: '92vh', overflowY: 'auto',
            padding: '1.75rem', boxShadow: '0 25px 50px rgba(0,0,0,0.35)',
          }}>
            {/* Modal header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <div style={{
                  width: 40, height: 40, borderRadius: '10px',
                  background: 'linear-gradient(135deg, #dcfce7, #d1fae5)',
                  color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <UploadCloud size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>Upload Business Document</h3>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Zamzam Foods — FSSAI, GST, licenses &amp; compliance files
                  </p>
                </div>
              </div>
              <button type="button" className="btn-icon" onClick={() => setIsUploadOpen(false)} disabled={uploading}>
                <X size={20} />
              </button>
            </div>

            {uploadError && (
              <div style={{
                background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626',
                padding: '0.75rem 1rem', borderRadius: '10px', marginBottom: '1rem',
                fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem',
              }}>
                <AlertCircle size={16} /> <span>{uploadError}</span>
              </div>
            )}

            <form onSubmit={handleUploadSubmit}>
              {/* Doc type + title */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.83rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                    Document Type <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <select className="input" value={upDocType} onChange={e => setUpDocType(e.target.value as BusinessDocumentType)}>
                    {Object.entries(DOC_TYPES).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.83rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                    Title / Name (Optional)
                  </label>
                  <input type="text" className="input" value={upTitle} onChange={e => setUpTitle(e.target.value)}
                    placeholder="e.g. FSSAI Food Safety License 2026" />
                </div>
              </div>


              {/* Issue date + expiry */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.83rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                    Date of Issue
                  </label>
                  <input type="date" className="input" value={upIssueDate} onChange={e => setUpIssueDate(e.target.value)} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.83rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                    Expiry Date
                  </label>
                  <input type="date" className="input" value={upExpiry} onChange={e => setUpExpiry(e.target.value)} />
                </div>
              </div>

              {/* Notes */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.83rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                  Notes (Optional)
                </label>
                <textarea className="input" rows={2} value={upNotes} onChange={e => setUpNotes(e.target.value)}
                  placeholder="Additional notes about this document..." style={{ resize: 'vertical' }} />
              </div>

              {/* Dropzone */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.83rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                  Select File(s) <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={e => {
                    e.preventDefault();
                    e.currentTarget.style.borderColor = '#16a34a';
                    e.currentTarget.style.background = 'rgba(22,163,74,0.04)';
                  }}
                  onDragLeave={e => {
                    e.currentTarget.style.borderColor = 'var(--border)';
                    e.currentTarget.style.background = 'var(--bg-secondary)';
                  }}
                  onDrop={handleDrop}
                  style={{
                    border: '2px dashed var(--border)', borderRadius: '12px',
                    padding: '2rem 1rem', textAlign: 'center',
                    background: 'var(--bg-secondary)', cursor: 'pointer',
                    transition: 'border-color 0.2s, background 0.2s',
                  }}
                >
                  <input ref={fileInputRef} type="file" multiple style={{ display: 'none' }}
                    onChange={handleFileChange}
                    accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx" />
                  <div style={{
                    width: 46, height: 46, borderRadius: '50%',
                    background: 'rgba(22,163,74,0.1)', color: '#16a34a',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 0.75rem',
                  }}>
                    <UploadCloud size={24} />
                  </div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Click or drag &amp; drop files here
                  </div>
                  <div style={{ fontSize: '0.77rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    PDF, JPEG, PNG, DOCX — Max 25 MB per file
                  </div>
                </div>

                {selectedFiles.length > 0 && (
                  <div style={{ marginTop: '0.75rem', border: '1px solid var(--border)', borderRadius: '10px', background: 'var(--bg-card)', overflow: 'hidden' }}>
                    <div style={{
                      padding: '0.5rem 0.75rem',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      borderBottom: '1px solid var(--border)',
                      fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)',
                    }}>
                      <span>{selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''} selected</span>
                      <span>Total: {formatBytes(selectedFiles.reduce((acc, f) => acc + f.size, 0))}</span>
                    </div>
                    <div style={{ maxHeight: 160, overflowY: 'auto' }}>
                      {selectedFiles.map((f, i) => (
                        <div key={`${f.name}-${i}`} style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '0.45rem 0.75rem', fontSize: '0.8rem',
                          borderBottom: i < selectedFiles.length - 1 ? '1px solid var(--border)' : 'none',
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', overflow: 'hidden' }}>
                            <FileIcon size={13} color="#16a34a" />
                            <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 300 }} title={f.name}>
                              {f.name}
                            </span>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>({formatBytes(f.size)})</span>
                          </div>
                          <button type="button" className="btn-icon" style={{ width: 22, height: 22, color: '#dc2626' }}
                            onClick={() => setSelectedFiles(prev => prev.filter((_, j) => j !== i))}>
                            <X size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsUploadOpen(false)} disabled={uploading}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary"
                  disabled={uploading || selectedFiles.length === 0}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700,
                    background: 'linear-gradient(135deg, #16a34a, #059669)',
                    border: 'none', minWidth: 140,
                  }}>
                  {uploading ? (
                    <><RefreshCw size={15} className="spin" /><span>Uploading...</span></>
                  ) : (
                    <><UploadCloud size={15} /><span>Upload {selectedFiles.length > 0 ? `(${selectedFiles.length})` : ''}</span></>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══ PREVIEW MODAL ══ */}
      {previewDoc && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem',
        }} onClick={() => setPreviewDoc(null)}>
          <div style={{
            position: 'relative', width: '100%', maxWidth: 960, maxHeight: '92vh',
            background: 'var(--bg-card)', borderRadius: '16px', overflow: 'hidden',
            display: 'flex', flexDirection: 'column',
            boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
          }} onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div style={{
              padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>{previewDoc.title}</h3>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                  {DOC_TYPES[previewDoc.document_type]?.label}
                  {previewDoc.document_number && ` • License #: ${previewDoc.document_number}`}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {previewDoc.file_url && (
                  <>
                    <a href={previewDoc.file_url} target="_blank" rel="noopener noreferrer"
                      className="btn btn-secondary btn-sm"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                      <ExternalLink size={13} /><span>Open</span>
                    </a>
                    <a href={previewDoc.file_url} download={previewDoc.file_name}
                      className="btn btn-primary btn-sm"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                      <Download size={13} /><span>Download</span>
                    </a>
                  </>
                )}
                <button type="button" className="btn-icon" onClick={() => setPreviewDoc(null)}>
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Preview body */}
            <div style={{
              flex: 1, minHeight: 380, maxHeight: '68vh', overflow: 'auto',
              background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
            }}>
              {isImage(previewDoc.mime_type, previewDoc.file_name) ? (
                <img src={previewDoc.file_url} alt={previewDoc.title}
                  style={{ maxWidth: '100%', maxHeight: '64vh', objectFit: 'contain', borderRadius: '4px' }} />
              ) : isPdf(previewDoc.mime_type, previewDoc.file_name) ? (
                <iframe src={previewDoc.file_url} title={previewDoc.title}
                  style={{ width: '100%', height: '64vh', border: 'none', borderRadius: '4px', background: '#fff' }} />
              ) : (
                <div style={{ textAlign: 'center', color: '#fff', padding: '2rem' }}>
                  <FileIcon size={64} style={{ margin: '0 auto 1rem', color: '#94a3b8' }} />
                  <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{previewDoc.file_name}</div>
                  <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '0.4rem' }}>
                    {formatBytes(previewDoc.file_size)} • {previewDoc.mime_type || 'Binary Document'}
                  </div>
                  <a href={previewDoc.file_url} download={previewDoc.file_name}
                    className="btn btn-primary"
                    style={{ marginTop: '1.25rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Download size={16} /><span>Download to View</span>
                  </a>
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{
              padding: '0.75rem 1.25rem', borderTop: '1px solid var(--border)',
              background: 'var(--bg-secondary)', fontSize: '0.78rem',
              display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem',
            }}>
              <span>
                <strong>File:</strong> {previewDoc.file_name} ({formatBytes(previewDoc.file_size)})
                {previewDoc.expiry_date && <> • <strong>Expires:</strong> {formatDate(previewDoc.expiry_date)}</>}
                {previewDoc.issuing_authority && <> • <strong>Issued by:</strong> {previewDoc.issuing_authority}</>}
              </span>
              <span style={{ color: 'var(--text-muted)' }}>
                Uploaded: {formatDate(previewDoc.created_at)} {previewDoc.uploaded_by_name ? `by ${previewDoc.uploaded_by_name}` : ''}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ══ EDIT MODAL ══ */}
      {editDoc && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(3px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
        }}>
          <div className="card" style={{ width: '100%', maxWidth: 540, padding: '1.5rem', boxShadow: '0 20px 40px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Edit2 size={18} color="#0284c7" />
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Edit Document Details</h3>
              </div>
              <button type="button" className="btn-icon" onClick={() => setEditDoc(null)} disabled={editSubmitting}><X size={18} /></button>
            </div>

            {editError && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '0.6rem 0.8rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.83rem' }}>
                {editError}
              </div>
            )}

            <form onSubmit={handleEditSubmit}>
              <div style={{ marginBottom: '0.85rem' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.3rem' }}>Title <span style={{ color: '#dc2626' }}>*</span></label>
                <input type="text" className="input" value={editTitle} onChange={e => setEditTitle(e.target.value)} required />
              </div>

              <div style={{ marginBottom: '0.85rem' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.3rem' }}>Document Type</label>
                <select className="input" value={editDocType} onChange={e => setEditDocType(e.target.value as BusinessDocumentType)}>
                  {Object.entries(DOC_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.85rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.3rem' }}>Issue Date</label>
                  <input type="date" className="input" value={editIssue} onChange={e => setEditIssue(e.target.value)} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.3rem' }}>Expiry Date</label>
                  <input type="date" className="input" value={editExpiry} onChange={e => setEditExpiry(e.target.value)} />
                </div>
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.3rem' }}>Notes</label>
                <textarea className="input" rows={2} value={editNotes} onChange={e => setEditNotes(e.target.value)} style={{ resize: 'vertical' }} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setEditDoc(null)} disabled={editSubmitting}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={editSubmitting}>
                  {editSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══ DELETE CONFIRM MODAL ══ */}
      {deleteDoc && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(3px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
        }}>
          <div className="card" style={{ width: '100%', maxWidth: 440, padding: '1.5rem', boxShadow: '0 20px 40px rgba(0,0,0,0.3)' }}>
            <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
              <div style={{
                width: 54, height: 54, borderRadius: '50%',
                background: '#fef2f2', color: '#dc2626',
                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.75rem',
              }}>
                <Trash2 size={26} />
              </div>
              <h3 style={{ margin: '0 0 0.4rem', fontSize: '1.15rem', fontWeight: 800 }}>Delete Document?</h3>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                "<strong>{deleteDoc.title}</strong>" will be permanently deleted from storage.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setDeleteDoc(null)}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" style={{ flex: 1, background: '#dc2626', borderColor: '#dc2626' }} onClick={handleDelete}>
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
