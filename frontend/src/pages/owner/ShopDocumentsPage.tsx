import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  businessDocumentService,
  BusinessDocument,
  BusinessDocumentType,
} from '../../services/businessDocumentService';
import { formatDate } from '../../utils/formatters';
import { compressImages } from '../../utils/imageCompression';
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

/* ── Document type config for My Shop Documents (Zamzam Foods) ── */
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

export const ShopDocumentsPage: React.FC = () => {
  const { user } = useAuth();
  const canWrite = user?.role === 'OWNER' || user?.role === 'MANAGER';

  const [documents, setDocuments] = useState<BusinessDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  /* Filters */
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [expiryFilter, setExpiryFilter] = useState<'ALL' | 'EXPIRED' | 'ACTIVE'>('ALL');

  /* Modals */
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<BusinessDocument | null>(null);
  const [editDoc, setEditDoc] = useState<BusinessDocument | null>(null);
  const [deleteDoc, setDeleteDoc] = useState<BusinessDocument | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  /* Upload form state */
  const [upDocType, setUpDocType] = useState<BusinessDocumentType>('FSSAI_LICENSE');
  const [upTitle, setUpTitle] = useState('');
  const [upDocNumber, setUpDocNumber] = useState('');
  const [upAuthority, setUpAuthority] = useState('');
  const [upIssueDate, setUpIssueDate] = useState('');
  const [upExpiry, setUpExpiry] = useState('');
  const [upNotes, setUpNotes] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* Edit form state */
  const [editTitle, setEditTitle] = useState('');
  const [editDocType, setEditDocType] = useState<BusinessDocumentType>('OTHER');
  const [editDocNum, setEditDocNum] = useState('');
  const [editAuthority, setEditAuthority] = useState('');
  const [editIssue, setEditIssue] = useState('');
  const [editExpiry, setEditExpiry] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  /* ── Fetch Documents ── */
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
    } catch {
      showToast('Failed to load shop documents.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDocs();
  }, [typeFilter, expiryFilter]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchDocs();
  };

  /* ── Client-side search ── */
  const filtered = useMemo(() => {
    if (!search.trim()) return documents;
    const q = search.toLowerCase();
    return documents.filter(
      (d) =>
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
    const expired = documents.filter((d) => d.expiry_date && d.expiry_date < today).length;
    const expiringSoon = documents.filter((d) => {
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
    setUpDocType('FSSAI_LICENSE');
    setUpTitle('');
    setUpDocNumber('');
    setUpAuthority('');
    setUpIssueDate('');
    setUpExpiry('');
    setUpNotes('');
    setSelectedFiles([]);
    setUploadError(null);
    setIsUploadOpen(true);
  };

  const isImageFile = (file: File) => {
    return file.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|bmp|heic)$/i.test(file.name);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const incoming = Array.from(e.target.files);
      const validImages = incoming.filter(isImageFile);
      if (validImages.length < incoming.length) {
        setUploadError('Only photo/image files (JPG, PNG, WEBP) are allowed. Non-image files were skipped.');
      } else {
        setUploadError(null);
      }
      if (validImages.length > 0) {
        setSelectedFiles((prev) => [...prev, ...validImages]);
      }
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.style.borderColor = 'var(--border)';
    e.currentTarget.style.background = 'var(--bg-secondary)';
    if (e.dataTransfer.files.length > 0) {
      const incoming = Array.from(e.dataTransfer.files);
      const validImages = incoming.filter(isImageFile);
      if (validImages.length < incoming.length) {
        setUploadError('Only photo/image files (JPG, PNG, WEBP) are allowed. Non-image files were skipped.');
      } else {
        setUploadError(null);
      }
      if (validImages.length > 0) {
        setSelectedFiles((prev) => [...prev, ...validImages]);
      }
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedFiles.length === 0) {
      setUploadError('Select at least one file to upload.');
      return;
    }
    try {
      setUploading(true);
      setUploadError(null);
      const filesToUpload = await compressImages(selectedFiles);
      const created = await businessDocumentService.batchUpload({
        document_type: upDocType,
        title: upTitle.trim() || undefined,
        document_number: upDocNumber.trim() || undefined,
        issuing_authority: upAuthority.trim() || undefined,
        issue_date: upIssueDate || undefined,
        expiry_date: upExpiry || undefined,
        notes: upNotes.trim() || undefined,
        files: filesToUpload,
      });
      setDocuments((prev) => [...created, ...prev]);
      showToast(`Uploaded ${created.length} shop document(s) successfully!`);
      setIsUploadOpen(false);
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  /* ── Edit handlers ── */
  const openEditModal = (doc: BusinessDocument) => {
    setEditDoc(doc);
    setEditTitle(doc.title);
    setEditDocType(doc.document_type);
    setEditDocNum(doc.document_number || '');
    setEditAuthority(doc.issuing_authority || '');
    setEditIssue(doc.issue_date || '');
    setEditExpiry(doc.expiry_date || '');
    setEditNotes(doc.notes || '');
    setEditError(null);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editDoc) return;
    if (!editTitle.trim()) {
      setEditError('Title is required.');
      return;
    }
    try {
      setEditSubmitting(true);
      setEditError(null);
      const updated = await businessDocumentService.updateDocument(editDoc.id, {
        title: editTitle.trim(),
        document_type: editDocType,
        document_number: editDocNum.trim() || undefined,
        issuing_authority: editAuthority.trim() || undefined,
        issue_date: editIssue || null,
        expiry_date: editExpiry || null,
        notes: editNotes.trim(),
      });
      setDocuments((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
      showToast('Document updated successfully.');
      setEditDoc(null);
    } catch (err: unknown) {
      setEditError(err instanceof Error ? err.message : 'Failed to update document.');
    } finally {
      setEditSubmitting(false);
    }
  };

  /* ── Delete handler ── */
  const handleDelete = async () => {
    if (!deleteDoc) return;
    try {
      await businessDocumentService.deleteDocument(deleteDoc.id);
      setDocuments((prev) => prev.filter((d) => d.id !== deleteDoc.id));
      showToast('Document deleted.');
      setDeleteDoc(null);
    } catch {
      showToast('Failed to delete document.');
    }
  };

  return (
    <div style={{ maxWidth: 1440, margin: '0 auto', paddingBottom: '3rem' }}>
      {/* Toast Notification */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            top: '1.5rem',
            right: '1.5rem',
            zIndex: 9999,
            background: 'var(--text-primary)',
            color: 'var(--bg-primary)',
            padding: '0.75rem 1.25rem',
            borderRadius: '12px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontWeight: 600,
            fontSize: '0.875rem',
          }}
        >
          <CheckCircle2 size={16} color="#10b981" />
          <span>{toast}</span>
        </div>
      )}

      {/* ── Header ── */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          marginBottom: '1.75rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div
            style={{
              width: 50,
              height: 50,
              borderRadius: '14px',
              background: 'linear-gradient(135deg, #16a34a 0%, #059669 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              boxShadow: '0 6px 18px rgba(22, 163, 74, 0.35)',
            }}
          >
            <ShieldCheck size={28} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                Shop Documents & Storage
              </h1>
              <span
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  padding: '3px 9px',
                  borderRadius: '999px',
                  background: '#dcfce7',
                  color: '#15803d',
                  border: '1px solid #bbf7d0',
                }}
              >
                Only My Shop Documents — Zamzam Foods
              </span>
            </div>
            <p style={{ margin: '3px 0 0', fontSize: '0.86rem', color: 'var(--text-secondary)' }}>
              Official food safety license (FSSAI), GST certificate, municipal trade license, rent agreements &amp; compliance certificates.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleRefresh}
            disabled={refreshing}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', height: '38px' }}
          >
            <RefreshCw size={15} className={refreshing ? 'spin' : ''} />
            <span>Refresh</span>
          </button>

          {canWrite && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={openUploadModal}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                height: '38px',
                padding: '0 1.25rem',
                fontWeight: 700,
                background: 'linear-gradient(135deg, #16a34a 0%, #059669 100%)',
                boxShadow: '0 4px 12px rgba(22, 163, 74, 0.35)',
                border: 'none',
              }}
            >
              <UploadCloud size={17} />
              <span>Upload Shop Document</span>
            </button>
          )}
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        {[
          {
            label: 'Total Shop Documents',
            value: stats.total,
            icon: <FolderArchive size={20} color="#16a34a" />,
            sub: 'Zamzam Foods licenses & files',
          },
          {
            label: 'Storage Used',
            value: formatBytes(stats.totalStorage),
            icon: <HardDrive size={20} color="#0891b2" />,
            sub: 'Encrypted document vault',
          },
          {
            label: 'Expiring Soon',
            value: stats.expiringSoon,
            icon: <Clock size={20} color="#d97706" />,
            sub: 'Renew within 30 days',
            alert: stats.expiringSoon > 0,
          },
          {
            label: 'Expired',
            value: stats.expired,
            icon: <AlertTriangle size={20} color="#dc2626" />,
            sub: 'Requires urgent renewal',
            alert: stats.expired > 0,
          },
        ].map((card, i) => (
          <div
            key={i}
            className="card"
            style={{
              padding: '1rem 1.25rem',
              border: card.alert ? '1.5px solid #fca5a5' : '1px solid var(--border)',
              background: card.alert ? 'rgba(239, 68, 68, 0.03)' : undefined,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{card.label}</span>
              {card.icon}
            </div>
            <div
              style={{
                fontSize: '1.65rem',
                fontWeight: 800,
                marginTop: '0.4rem',
                color: card.alert ? '#dc2626' : 'var(--text-primary)',
              }}
            >
              {card.value}
            </div>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{card.sub}</span>
          </div>
        ))}
      </div>

      {/* ── Filters ── */}
      <div
        className="card"
        style={{
          padding: '1rem',
          marginBottom: '1.5rem',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '0.75rem',
        }}
      >
        <div style={{ position: 'relative', flex: '1 1 240px', minWidth: 200 }}>
          <Search
            size={16}
            style={{
              position: 'absolute',
              left: '0.75rem',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)',
            }}
          />
          <input
            type="text"
            className="input"
            style={{ paddingLeft: '2.25rem', height: '36px', fontSize: '0.85rem' }}
            placeholder="Search license #, authority, title..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select
          className="input"
          style={{ height: '36px', fontSize: '0.85rem', minWidth: 190 }}
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option value="ALL">All Document Types</option>
          {Object.entries(DOC_TYPES).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </select>

        <select
          className="input"
          style={{ height: '36px', fontSize: '0.85rem', minWidth: 140 }}
          value={expiryFilter}
          onChange={(e) => setExpiryFilter(e.target.value as 'ALL' | 'EXPIRED' | 'ACTIVE')}
        >
          <option value="ALL">All Status</option>
          <option value="ACTIVE">Active / Valid</option>
          <option value="EXPIRED">Expired</option>
        </select>

        {(search || typeFilter !== 'ALL' || expiryFilter !== 'ALL') && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            style={{ height: '36px', color: 'var(--text-muted)' }}
            onClick={() => {
              setSearch('');
              setTypeFilter('ALL');
              setExpiryFilter('ALL');
            }}
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* ── Document Grid ── */}
      {loading ? (
        <div className="card" style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          <RefreshCw size={28} className="spin" style={{ margin: '0 auto 0.75rem' }} />
          <div style={{ fontWeight: 600 }}>Loading shop documents...</div>
        </div>
      ) : filtered.length === 0 ? (
        <div
          className="card"
          style={{
            padding: '4rem 2rem',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1rem',
          }}
        >
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #dcfce7, #d1fae5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#16a34a',
            }}
          >
            <ShieldCheck size={36} />
          </div>
          <div>
            <h3 style={{ margin: '0 0 0.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {search || typeFilter !== 'ALL' ? 'No shop documents matched your filters' : 'No shop documents uploaded yet'}
            </h3>
            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)', maxWidth: 480 }}>
              {search || typeFilter !== 'ALL'
                ? 'Try clearing your filters to see all documents.'
                : 'Upload your FSSAI food safety license, GST certificate, municipal trade license, and other official documents for Zamzam Foods.'}
            </p>
          </div>
          {canWrite && !search && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={openUploadModal}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                marginTop: '0.5rem',
                background: 'linear-gradient(135deg, #16a34a 0%, #059669 100%)',
                border: 'none',
                boxShadow: '0 4px 12px rgba(22, 163, 74, 0.3)',
              }}
            >
              <UploadCloud size={16} />
              <span>Upload First Shop Document</span>
            </button>
          )}
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '1.25rem',
          }}
        >
          {filtered.map((doc) => {
            const typeConfig = DOC_TYPES[doc.document_type] || DOC_TYPES.OTHER;
            const today = new Date().toISOString().split('T')[0];
            const isExpired = doc.expiry_date && doc.expiry_date < today;
            const isExpiringSoon =
              doc.expiry_date &&
              !isExpired &&
              new Date(doc.expiry_date).getTime() - Date.now() <= 30 * 24 * 3600 * 1000;

            return (
              <div
                key={doc.id}
                className="card"
                style={{
                  padding: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.85rem',
                  border: isExpired
                    ? '1.5px solid #fca5a5'
                    : isExpiringSoon
                    ? '1.5px solid #fde68a'
                    : '1px solid var(--border)',
                  position: 'relative',
                  transition: 'all 0.15s ease',
                }}
              >
                {/* Card Top: Type badge & actions */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '3px 8px',
                      borderRadius: '6px',
                      background: typeConfig.bg,
                      color: typeConfig.color,
                    }}
                  >
                    {typeConfig.icon}
                    <span>{typeConfig.label}</span>
                  </span>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <button
                      type="button"
                      onClick={() => setPreviewDoc(doc)}
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '4px 7px', height: '28px' }}
                      title="Preview Document"
                    >
                      <Eye size={14} />
                    </button>

                    <a
                      href={doc.file_url || doc.file}
                      download={doc.file_name || doc.title}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '4px 7px', height: '28px', display: 'inline-flex', alignItems: 'center' }}
                      title="Download File"
                    >
                      <Download size={14} />
                    </a>

                    {canWrite && (
                      <>
                        <button
                          type="button"
                          onClick={() => openEditModal(doc)}
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '4px 7px', height: '28px' }}
                          title="Edit Document Info"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteDoc(doc)}
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '4px 7px', height: '28px', color: '#dc2626' }}
                          title="Delete Document"
                        >
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Card Middle: Title & Document Number */}
                <div>
                  <h4 style={{ margin: '0 0 0.25rem', fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {doc.title}
                  </h4>
                  {doc.document_number && (
                    <div
                      style={{
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        color: 'var(--text-secondary)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                      }}
                    >
                      <Hash size={13} color="var(--text-muted)" />
                      <span>{doc.document_number}</span>
                    </div>
                  )}
                  {doc.issuing_authority && (
                    <div
                      style={{
                        fontSize: '0.78rem',
                        color: 'var(--text-muted)',
                        marginTop: '2px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                      }}
                    >
                      <Building size={13} />
                      <span>{doc.issuing_authority}</span>
                    </div>
                  )}
                </div>

                {/* Expiry Pill */}
                {doc.expiry_date && (
                  <div
                    style={{
                      padding: '4px 8px',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      background: isExpired ? '#fee2e2' : isExpiringSoon ? '#fef3c7' : '#f0fdf4',
                      color: isExpired ? '#dc2626' : isExpiringSoon ? '#d97706' : '#16a34a',
                      alignSelf: 'flex-start',
                    }}
                  >
                    <Calendar size={13} />
                    <span>
                      {isExpired
                        ? `Expired on ${formatDate(doc.expiry_date)}`
                        : isExpiringSoon
                        ? `Expires soon: ${formatDate(doc.expiry_date)}`
                        : `Valid until ${formatDate(doc.expiry_date)}`}
                    </span>
                  </div>
                )}

                {/* Card Bottom: File specs */}
                <div
                  style={{
                    marginTop: 'auto',
                    paddingTop: '0.65rem',
                    borderTop: '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '0.75rem',
                    color: 'var(--text-muted)',
                  }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                    {isPdf(doc.mime_type, doc.file_name) ? (
                      <FileText size={14} color="#dc2626" />
                    ) : isImage(doc.mime_type, doc.file_name) ? (
                      <ImageIcon size={14} color="#0891b2" />
                    ) : (
                      <FileIcon size={14} />
                    )}
                    <span>{formatBytes(doc.file_size)}</span>
                  </span>
                  <span>{formatDate(doc.created_at || '')}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── MODAL: UPLOAD SHOP DOCUMENTS ── */}
      {isUploadOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(15, 23, 42, 0.7)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem',
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '560px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
              overflow: 'hidden',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '1.25rem 1.5rem',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: '#f8fafc',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '8px',
                    background: '#dcfce7',
                    color: '#16a34a',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>Upload Shop Document</h3>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    Add Zamzam Foods food safety licenses, GST, trade certificates
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsUploadOpen(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '4px',
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleUploadSubmit} style={{ padding: '1.5rem', overflowY: 'auto' }}>
              {uploadError && (
                <div
                  style={{
                    padding: '0.75rem',
                    background: '#fee2e2',
                    border: '1px solid #fca5a5',
                    borderRadius: '8px',
                    color: '#b91c1c',
                    fontSize: '0.82rem',
                    marginBottom: '1rem',
                  }}
                >
                  {uploadError}
                </div>
              )}

              {/* Document Type */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                  Document Type *
                </label>
                <select
                  className="input"
                  style={{ width: '100%', height: '38px', fontSize: '0.88rem' }}
                  value={upDocType}
                  onChange={(e) => setUpDocType(e.target.value as BusinessDocumentType)}
                >
                  {Object.entries(DOC_TYPES).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Title */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                  Document Title
                </label>
                <input
                  type="text"
                  className="input"
                  style={{ width: '100%', height: '38px', fontSize: '0.88rem' }}
                  placeholder="e.g. FSSAI Food Safety License - Bakery Unit"
                  value={upTitle}
                  onChange={(e) => setUpTitle(e.target.value)}
                />
              </div>


              {/* Issue & Expiry Dates */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                    Issue Date
                  </label>
                  <input
                    type="date"
                    className="input"
                    style={{ width: '100%', height: '38px', fontSize: '0.85rem' }}
                    value={upIssueDate}
                    onChange={(e) => setUpIssueDate(e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                    Expiry Date
                  </label>
                  <input
                    type="date"
                    className="input"
                    style={{ width: '100%', height: '38px', fontSize: '0.85rem' }}
                    value={upExpiry}
                    onChange={(e) => setUpExpiry(e.target.value)}
                  />
                </div>
              </div>

              {/* File Dropzone */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                  Upload File(s) *
                </label>
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    border: '2px dashed var(--border)',
                    borderRadius: '10px',
                    padding: '1.5rem',
                    textAlign: 'center',
                    cursor: 'pointer',
                    background: '#f8fafc',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <UploadCloud size={30} color="#16a34a" style={{ margin: '0 auto 0.5rem' }} />
                  <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Click or drag &amp; drop photo files
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 600, marginTop: '2px' }}>
                    Photo / Image files only (JPG, PNG, WEBP, JPEG up to 20MB)
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    style={{ display: 'none' }}
                    onChange={handleFileChange}
                    accept="image/*,.jpg,.jpeg,.png,.webp"
                  />
                </div>

                {/* Selected files chip list */}
                {selectedFiles.length > 0 && (
                  <div style={{ marginTop: '0.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                    {selectedFiles.map((f, idx) => (
                      <span
                        key={idx}
                        style={{
                          fontSize: '0.75rem',
                          background: '#dcfce7',
                          color: '#16a34a',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontWeight: 600,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                        }}
                      >
                        <span>{f.name}</span>
                        <X
                          size={12}
                          style={{ cursor: 'pointer' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedFiles((prev) => prev.filter((_, i) => i !== idx));
                          }}
                        />
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Notes */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                  Notes / Remarks
                </label>
                <textarea
                  className="input"
                  style={{ width: '100%', minHeight: '60px', fontSize: '0.85rem' }}
                  placeholder="Additional remarks or renewal contact..."
                  value={upNotes}
                  onChange={(e) => setUpNotes(e.target.value)}
                />
              </div>

              {/* Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setIsUploadOpen(false)}
                  disabled={uploading}
                  className="btn btn-secondary"
                  style={{ padding: '0.65rem 1.25rem' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="btn btn-primary"
                  style={{
                    padding: '0.65rem 1.5rem',
                    fontWeight: 700,
                    background: 'linear-gradient(135deg, #16a34a 0%, #059669 100%)',
                    border: 'none',
                  }}
                >
                  {uploading ? 'Uploading...' : 'Save & Upload'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: PREVIEW DOCUMENT ── */}
      {previewDoc && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1.5rem',
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '850px',
              maxHeight: '92vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: '1rem 1.5rem',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: '#f8fafc',
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>{previewDoc.title}</h3>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  {previewDoc.document_number ? `#${previewDoc.document_number} • ` : ''}
                  {formatBytes(previewDoc.file_size)}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <a
                  href={previewDoc.file_url || previewDoc.file}
                  download={previewDoc.file_name}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                >
                  <Download size={14} />
                  <span>Download</span>
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewDoc(null)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: '4px',
                  }}
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Content Viewer */}
            <div
              style={{
                flex: 1,
                padding: '1rem',
                overflow: 'auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#0f172a',
              }}
            >
              {isImage(previewDoc.mime_type, previewDoc.file_name) ? (
                <img
                  src={previewDoc.file_url || previewDoc.file}
                  alt={previewDoc.title}
                  style={{ maxWidth: '100%', maxHeight: '72vh', objectFit: 'contain', borderRadius: '8px' }}
                />
              ) : isPdf(previewDoc.mime_type, previewDoc.file_name) ? (
                <iframe
                  src={previewDoc.file_url || previewDoc.file}
                  title={previewDoc.title}
                  style={{ width: '100%', height: '72vh', border: 'none', borderRadius: '8px' }}
                />
              ) : (
                <div style={{ textAlign: 'center', color: '#cbd5e1', padding: '3rem' }}>
                  <FileIcon size={48} style={{ margin: '0 auto 1rem' }} />
                  <div style={{ fontSize: '1rem', fontWeight: 600 }}>Preview not available for this file type</div>
                  <a
                    href={previewDoc.file_url || previewDoc.file}
                    download
                    className="btn btn-primary"
                    style={{ marginTop: '1rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
                  >
                    <Download size={16} />
                    <span>Download to View</span>
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: EDIT DOCUMENT DETAILS ── */}
      {editDoc && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(15, 23, 42, 0.7)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem',
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '520px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '1.25rem 1.5rem',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: '#f8fafc',
              }}
            >
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>Edit Document Info</h3>
              <button
                type="button"
                onClick={() => setEditDoc(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '4px',
                }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} style={{ padding: '1.5rem' }}>
              {editError && (
                <div
                  style={{
                    padding: '0.75rem',
                    background: '#fee2e2',
                    border: '1px solid #fca5a5',
                    borderRadius: '8px',
                    color: '#b91c1c',
                    fontSize: '0.82rem',
                    marginBottom: '1rem',
                  }}
                >
                  {editError}
                </div>
              )}

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                  Document Title *
                </label>
                <input
                  type="text"
                  className="input"
                  style={{ width: '100%', height: '38px', fontSize: '0.88rem' }}
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  required
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                  Document Type
                </label>
                <select
                  className="input"
                  style={{ width: '100%', height: '38px', fontSize: '0.88rem' }}
                  value={editDocType}
                  onChange={(e) => setEditDocType(e.target.value as BusinessDocumentType)}
                >
                  {Object.entries(DOC_TYPES).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </div>


              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                    Issue Date
                  </label>
                  <input
                    type="date"
                    className="input"
                    style={{ width: '100%', height: '38px', fontSize: '0.85rem' }}
                    value={editIssue}
                    onChange={(e) => setEditIssue(e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                    Expiry Date
                  </label>
                  <input
                    type="date"
                    className="input"
                    style={{ width: '100%', height: '38px', fontSize: '0.85rem' }}
                    value={editExpiry}
                    onChange={(e) => setEditExpiry(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                  Notes / Remarks
                </label>
                <textarea
                  className="input"
                  style={{ width: '100%', minHeight: '60px', fontSize: '0.85rem' }}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setEditDoc(null)}
                  disabled={editSubmitting}
                  className="btn btn-secondary"
                  style={{ padding: '0.65rem 1.25rem' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSubmitting}
                  className="btn btn-primary"
                  style={{ padding: '0.65rem 1.5rem', fontWeight: 700 }}
                >
                  {editSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: DELETE CONFIRMATION ── */}
      {deleteDoc && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(15, 23, 42, 0.7)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem',
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '440px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
              padding: '1.5rem',
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: '10px',
                background: '#fee2e2',
                color: '#dc2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '1rem',
              }}
            >
              <Trash2 size={22} />
            </div>
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.15rem', fontWeight: 800 }}>Delete Shop Document</h3>
            <p style={{ margin: '0 0 1.25rem', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Are you sure you want to delete <strong>{deleteDoc.title}</strong>? This file will be permanently removed from storage.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => setDeleteDoc(null)}
                className="btn btn-secondary"
                style={{ padding: '0.65rem 1.25rem' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                style={{
                  background: '#dc2626',
                  color: '#fff',
                  border: 'none',
                  padding: '0.65rem 1.25rem',
                  borderRadius: '8px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Delete File
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
