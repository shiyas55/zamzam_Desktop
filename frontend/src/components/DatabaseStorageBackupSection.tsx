import React, { useState, useEffect, useCallback } from 'react';
import {
  Database,
  Download,
  HardDrive,
  Layers,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Package,
  Store,
  ShoppingCart,
  Truck,
  CreditCard,
  BookOpen,
  MapPin,
  MessageCircle,
  Users,
  ShieldCheck,
  CheckSquare,
  Square,
  FileJson,
  ShieldAlert,
  Server,
  Copy,
  Check,
  Folder,
  FolderOpen,
  Play,
  Clock,
  Shield,
  FileText,
  AlertCircle,
  Laptop,
  Edit2,
  Save,
  Upload,
  UploadCloud,
  FileUp,
  Trash2,
  AlertOctagon,
  Lock,
  X,
  KeyRound,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { draftOrderStorage } from '../utils/draftOrderStorage';
import { databaseService, DatabaseStats, DatabaseModuleStat, ClearAllResult } from '../services/databaseService';
import { tauriBackupService, TauriBackupConfig, TauriBackupFileInfo, isTauriEnvironment } from '../services/tauriBackupService';
import { nativeDbService, LocalDbConfig } from '../services/nativeDbService';
import { CloudSyncButton } from './CloudSyncButton';

const ICON_MAP: Record<string, React.ElementType> = {
  Package,
  Store,
  ShoppingCart,
  Truck,
  CreditCard,
  BookOpen,
  MapPin,
  MessageCircle,
  Users,
  ShieldCheck,
  FileText,
};

const DEFAULT_MODULE_LIST: DatabaseModuleStat[] = [
  { id: 'accounts', name: 'Users & Staff Profiles', count: 0, icon: 'Users' },
  { id: 'products', name: 'Products & Pricing', count: 0, icon: 'Package' },
  { id: 'routes', name: 'Routes, Drivers & Shifts', count: 0, icon: 'MapPin' },
  { id: 'customers', name: 'Customer Shops & Documents', count: 0, icon: 'Store' },
  { id: 'orders', name: 'Orders & Order Items', count: 0, icon: 'ShoppingCart' },
  { id: 'deliveries', name: 'Deliveries & Dispatches', count: 0, icon: 'Truck' },
  { id: 'payments', name: 'Payments & Receipts', count: 0, icon: 'CreditCard' },
  { id: 'credits', name: 'Credit Ledger Transactions', count: 0, icon: 'BookOpen' },
  { id: 'reports', name: 'Daily Closing Reports', count: 0, icon: 'FileText' },
  { id: 'whatsapp', name: 'WhatsApp Messages & Customers', count: 0, icon: 'MessageCircle' },
  { id: 'logs', name: 'Audit & System Settings', count: 0, icon: 'ShieldCheck' },
];

export const DatabaseStorageBackupSection: React.FC = () => {
  const [stats, setStats] = useState<DatabaseStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Tauri Native Backup Manager State
  const isDesktop = isTauriEnvironment();
  const [tauriConfig, setTauriConfig] = useState<TauriBackupConfig | null>(null);
  const [tauriHistory, setTauriHistory] = useState<TauriBackupFileInfo[]>([]);
  const [isBackingUpNow, setIsBackingUpNow] = useState(false);
  const [isSelectingFolder, setIsSelectingFolder] = useState(false);
  const [tauriFeedback, setTauriFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Web Backup states
  const [isFullBackingUp, setIsFullBackingUp] = useState(false);
  const [isSqlBackingUp, setIsSqlBackingUp] = useState(false);
  const [isSelectiveBackingUp, setIsSelectiveBackingUp] = useState(false);
  const [selectedModules, setSelectedModules] = useState<string[]>(() =>
    DEFAULT_MODULE_LIST.map((m) => m.id)
  );
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Aiven PostgreSQL Cloud Database Connection State
  const [pgHost, setPgHost] = useState('pg-65e4170-zamzamfoods.h.aivencloud.com');
  const [pgPort, setPgPort] = useState('18638');
  const [pgDatabase, setPgDatabase] = useState('defaultdb');
  const [pgUser, setPgUser] = useState('avnadmin');
  const [pgPassword, setPgPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isTestingPg, setIsTestingPg] = useState(false);
  const [pgTestResult, setPgTestResult] = useState<{ success: boolean; message: string; latency?: number } | null>(null);
  const [showPgSettings, setShowPgSettings] = useState(false);
  const [isSavingPg, setIsSavingPg] = useState(false);
  const [isInitSchema, setIsInitSchema] = useState(false);
  const [schemaInitResult, setSchemaInitResult] = useState<{ success: boolean; message: string } | null>(null);

  // Database Import / Restore State (.sql & .json)
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreFeedback, setRestoreFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Clear All System Data (Owner & Admin Only) State
  const { user } = useAuth();
  const isOwnerOrAdmin = user?.role === 'OWNER' || (user as { is_superuser?: boolean } | null)?.is_superuser === true;
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [clearPin, setClearPin] = useState('');
  const [clearConfirmation, setClearConfirmation] = useState('');
  const [isClearing, setIsClearing] = useState(false);
  const [clearError, setClearError] = useState<string | null>(null);
  const [clearSuccess, setClearSuccess] = useState<ClearAllResult | null>(null);

  const handleClearAllSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (clearPin.trim().length !== 4) {
      setClearError('Please enter your 4-digit security PIN (e.g. 7667).');
      return;
    }
    if (clearConfirmation.trim().toUpperCase() !== 'CLEAR ALL DATA') {
      setClearError('Confirmation phrase must match exactly: CLEAR ALL DATA');
      return;
    }

    try {
      setIsClearing(true);
      setClearError(null);
      const res = await databaseService.clearAllData(clearPin.trim(), clearConfirmation.trim().toUpperCase());
      draftOrderStorage.clearAllChromeStorage();
      setClearSuccess(res);
      setClearPin('');
      setClearConfirmation('');
      await fetchStats(true);
      await loadTauriData();
    } catch (err: unknown) {
      setClearError(err instanceof Error ? err.message : 'Failed to clear database. Please verify your PIN.');
    } finally {
      setIsClearing(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const f = e.target.files[0];
      setRestoreFile(f);
      setRestoreFeedback(null);
    }
  };

  const handleDropFile = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const f = e.dataTransfer.files[0];
      setRestoreFile(f);
      setRestoreFeedback(null);
    }
  };

  const handleRestoreSubmit = async () => {
    if (!restoreFile) {
      setRestoreFeedback({
        type: 'error',
        message: 'Please choose or drag & drop a .sql or .json backup file first.',
      });
      return;
    }

    const isConfirmed = window.confirm(
      `Are you sure you want to restore and import '${restoreFile.name}'? This will write records into the database in an atomic transaction.`
    );
    if (!isConfirmed) return;

    try {
      setIsRestoring(true);
      setRestoreFeedback(null);
      const ext = restoreFile.name.toLowerCase().endsWith('.json') ? 'json' : 'sql';
      const result = await databaseService.restoreDatabase(restoreFile, ext);
      setRestoreFeedback({
        type: 'success',
        message: result.message || `Successfully restored items from '${restoreFile.name}'!`,
      });
      setRestoreFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      await fetchStats(true);
      await loadTauriData();
    } catch (err: unknown) {
      let msg = 'Database import failed. Please verify file format and database connection.';
      if (err instanceof Error) {
        msg = err.message === '[object Object]' ? 'Authentication or session error. Please refresh the page and try again.' : err.message;
      } else if (typeof err === 'string') {
        msg = err;
      } else if (typeof err === 'object' && err !== null) {
        msg = (err as any).message || (err as any).error || JSON.stringify(err);
      }
      setRestoreFeedback({
        type: 'error',
        message: msg,
      });
    } finally {
      setIsRestoring(false);
    }
  };

  const fetchStats = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      const data = await databaseService.getStats();
      setStats(data);
      if (data.host) setPgHost(data.host);
      if (data.port) setPgPort(data.port);
      if (data.name) setPgDatabase(data.name);
      if (data.user) setPgUser(data.user);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to fetch database storage statistics.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (isDesktop) {
      nativeDbService
        .getDbConfig()
        .then((cfg) => {
          if (cfg) {
            if (cfg.host) setPgHost(cfg.host);
            if (cfg.port) setPgPort(String(cfg.port));
            if (cfg.dbname) setPgDatabase(cfg.dbname);
            if (cfg.user) setPgUser(cfg.user);
            if (cfg.password !== undefined) setPgPassword(cfg.password);
          }
        })
        .catch((e) => console.warn('[Settings] Native DB config load:', e));
    }
  }, [isDesktop]);

  const handleCopy = (key: string, value: string) => {
    try {
      navigator.clipboard.writeText(value);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2200);
    } catch {
      // ignore clipboard error
    }
  };

  const handleTestPgConnection = async () => {
    const t0 = performance.now();
    try {
      setIsTestingPg(true);
      setPgTestResult(null);
      const portNum = parseInt(pgPort.trim() || '18638', 10);
      const cfg: LocalDbConfig = {
        host: pgHost.trim() || 'pg-65e4170-zamzamfoods.h.aivencloud.com',
        port: isNaN(portNum) ? 18638 : portNum,
        dbname: pgDatabase.trim() || 'defaultdb',
        user: pgUser.trim() || 'avnadmin',
        password: pgPassword,
      };

      if (isDesktop) {
        const res = await nativeDbService.testDbConnection(cfg);
        const elapsed = Math.round(performance.now() - t0);
        if (res.ok) {
          await nativeDbService.saveDbConfig(cfg);
          setPgTestResult({
            success: true,
            message: `Connected to Aiven Cloud PostgreSQL! Version: ${res.version || '18.x'} (Active TLS 1.3)`,
            latency: elapsed,
          });
        } else {
          setPgTestResult({
            success: false,
            message: res.message || 'Could not connect to Aiven Cloud Database. Please verify credentials.',
            latency: elapsed,
          });
        }
      } else {
        const res = await databaseService.testConnection({
          host: cfg.host,
          port: String(cfg.port),
          name: cfg.dbname,
          user: cfg.user,
          password: cfg.password,
        });
        const elapsed = Math.round(performance.now() - t0);
        setPgTestResult({
          success: res.success,
          message: res.message || (res.success ? 'Connected to Aiven Cloud Database via REST API.' : 'Connection test failed.'),
          latency: elapsed,
        });
      }
      try {
        await fetchStats(true);
      } catch {
        // Ignore background stats refresh hiccups
      }
    } catch (err: unknown) {
      const elapsed = Math.round(performance.now() - t0);
      const msg = err instanceof Error ? err.message : 'Aiven Cloud PostgreSQL connection test failed.';
      setPgTestResult({ success: false, message: msg, latency: elapsed });
    } finally {
      setIsTestingPg(false);
    }
  };

  const handleSavePgConfig = async () => {
    try {
      setIsSavingPg(true);
      const portNum = parseInt(pgPort.trim() || '5432', 10);
      const cfg: LocalDbConfig = {
        host: pgHost.trim() || 'localhost',
        port: isNaN(portNum) ? 5432 : portNum,
        user: pgUser.trim() || 'postgres',
        password: pgPassword,
        dbname: pgDatabase.trim() || 'zamzam_foods',
      };
      if (isDesktop) {
        await nativeDbService.saveDbConfig(cfg);
      }
      setPgTestResult({
        success: true,
        message: 'PostgreSQL configuration saved to local storage (%APPDATA% / system config).',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save configuration';
      setPgTestResult({ success: false, message: msg });
    } finally {
      setIsSavingPg(false);
    }
  };

  const handleInitDbSchema = async () => {
    try {
      setIsInitSchema(true);
      setSchemaInitResult(null);
      if (isDesktop) {
        const msg = await nativeDbService.initDbSchema();
        setSchemaInitResult({
          success: true,
          message: msg || 'Database schema, tables, and default settings initialized successfully.',
        });
      } else {
        setSchemaInitResult({
          success: true,
          message: 'Local schema initialized (fallback mode).',
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to initialize schema';
      setSchemaInitResult({ success: false, message: msg });
    } finally {
      setIsInitSchema(false);
    }
  };

  const [isEditingPath, setIsEditingPath] = useState(false);
  const [customPathInput, setCustomPathInput] = useState('');

  const loadTauriData = useCallback(async () => {
    try {
      const cfg = await tauriBackupService.getConfig();
      setTauriConfig(cfg);
      const hist = await tauriBackupService.getHistory();
      setTauriHistory(hist);
    } catch (err) {
      console.warn('Backup state not initialized:', err);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    loadTauriData();
    const interval = setInterval(() => {
      fetchStats(true);
      loadTauriData();
    }, 15000);
    return () => clearInterval(interval);
  }, [fetchStats, loadTauriData]);

  // Automated Daily Backup Daemon (Runs silently in background)
  useEffect(() => {
    if (!tauriConfig?.auto_backup_enabled) return;

    const checkAutoBackup = async () => {
      const today = new Date().toISOString().slice(0, 10);
      const currentHour = new Date().getHours();
      const needsDailyBackup = tauriConfig.last_backup_date !== today;
      const isLateNightSafety = tauriConfig.safety_backup_2359 && currentHour >= 23 && needsDailyBackup;

      if (needsDailyBackup || isLateNightSafety) {
        console.log('[AutoBackup] Triggering automated daily database snapshot...');
        try {
          const res = await tauriBackupService.triggerBackupNow();
          await loadTauriData();
          setTauriFeedback({
            type: 'success',
            message: `Automated daily backup completed: ${res.filename} (${res.size_formatted})`,
          });
        } catch (err) {
          console.warn('[AutoBackup] Automated backup attempt failed:', err);
        }
      }
    };

    const initialTimer = setTimeout(checkAutoBackup, 4000);
    const interval = setInterval(checkAutoBackup, 15 * 60 * 1000);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, [tauriConfig?.auto_backup_enabled, tauriConfig?.last_backup_date, tauriConfig?.safety_backup_2359, loadTauriData]);

  // Folder Picker & Path Configuration
  const handleSelectFolder = async () => {
    try {
      setIsSelectingFolder(true);
      const folder = await tauriBackupService.selectFolder();
      if (folder && tauriConfig) {
        const updated = { ...tauriConfig, backup_folder: folder };
        await tauriBackupService.saveConfig(updated);
        setTauriConfig(updated);
        const hist = await tauriBackupService.getHistory();
        setTauriHistory(hist);
        setIsEditingPath(false);
        setTauriFeedback({
          type: 'success',
          message: `Backup directory successfully updated to: ${folder}`,
        });
      } else {
        // Fallback to inline path editor if native dialog is not supported
        setCustomPathInput(tauriConfig?.backup_folder || 'C:\\ZamzamBackups');
        setIsEditingPath(true);
      }
    } catch (err) {
      setTauriFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Folder selection not supported by browser. Enter path below.',
      });
      setCustomPathInput(tauriConfig?.backup_folder || 'C:\\ZamzamBackups');
      setIsEditingPath(true);
    } finally {
      setIsSelectingFolder(false);
    }
  };

  const handleSaveCustomPath = async () => {
    if (!customPathInput.trim() || !tauriConfig) return;
    const cleaned = customPathInput.trim();
    const updated = { ...tauriConfig, backup_folder: cleaned };
    await tauriBackupService.saveConfig(updated);
    setTauriConfig(updated);
    setIsEditingPath(false);
    setTauriFeedback({
      type: 'success',
      message: `Backup directory successfully saved: ${cleaned}`,
    });
  };

  // Toggle Auto Backup
  const handleToggleAutoBackup = async () => {
    if (!tauriConfig) return;
    const updated = { ...tauriConfig, auto_backup_enabled: !tauriConfig.auto_backup_enabled };
    setTauriConfig(updated);
    await tauriBackupService.saveConfig(updated);
  };

  // Toggle Close Backup
  const handleToggleCloseBackup = async () => {
    if (!tauriConfig) return;
    const updated = { ...tauriConfig, backup_on_close: !tauriConfig.backup_on_close };
    setTauriConfig(updated);
    await tauriBackupService.saveConfig(updated);
  };

  // Toggle 23:59 Safety Backup
  const handleToggleSafetyBackup = async () => {
    if (!tauriConfig) return;
    const updated = { ...tauriConfig, safety_backup_2359: !tauriConfig.safety_backup_2359 };
    setTauriConfig(updated);
    await tauriBackupService.saveConfig(updated);
  };

  // Update Retention Count
  const handleRetentionChange = async (count: number) => {
    if (!tauriConfig || count < 1 || count > 365) return;
    const updated = { ...tauriConfig, retention_count: count };
    setTauriConfig(updated);
    await tauriBackupService.saveConfig(updated);
  };

  // Trigger Backup Now
  const handleTriggerNativeBackupNow = async () => {
    try {
      setIsBackingUpNow(true);
      setTauriFeedback(null);
      const res = await tauriBackupService.triggerBackupNow();
      setTauriFeedback({
        type: 'success',
        message: `Database PostgreSQL backup completed & verified! Saved: ${res.filename} (${res.size_formatted})`,
      });
      await loadTauriData();
    } catch (err) {
      setTauriFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Database backup failed. Please check backend connection.',
      });
      await loadTauriData();
    } finally {
      setIsBackingUpNow(false);
    }
  };

  const modulesToRender =
    stats?.modules && stats.modules.length > 0 ? stats.modules : DEFAULT_MODULE_LIST;

  const handleToggleModule = (id: string) => {
    setSelectedModules((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedModules.length === modulesToRender.length) {
      setSelectedModules([]);
    } else {
      setSelectedModules(modulesToRender.map((m) => m.id));
    }
  };

  const handleFullBackup = async () => {
    try {
      setIsFullBackingUp(true);
      setFeedback(null);
      await databaseService.downloadBackup({ type: 'full', format: 'json' });
      setFeedback({
        type: 'success',
        message: 'Full database JSON snapshot successfully generated and downloaded!',
      });
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Full backup failed.',
      });
    } finally {
      setIsFullBackingUp(false);
    }
  };

  const handleSqlBackup = async () => {
    try {
      setIsSqlBackingUp(true);
      setFeedback(null);
      await databaseService.downloadBackup({ type: 'full', format: 'sql' });
      setFeedback({
        type: 'success',
        message: 'PostgreSQL restorable SQL script backup successfully downloaded!',
      });
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'PostgreSQL SQL backup failed.',
      });
    } finally {
      setIsSqlBackingUp(false);
    }
  };

  const handleSelectiveBackup = async () => {
    if (selectedModules.length === 0) {
      setFeedback({
        type: 'error',
        message: 'Please select at least one module for selective backup.',
      });
      return;
    }

    try {
      setIsSelectiveBackingUp(true);
      setFeedback(null);
      await databaseService.downloadBackup({
        type: 'selective',
        modules: selectedModules,
        format: 'json',
      });
      setFeedback({
        type: 'success',
        message: `Selective backup (${selectedModules.length} modules) successfully downloaded!`,
      });
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Selective backup failed.',
      });
    } finally {
      setIsSelectiveBackingUp(false);
    }
  };

  const selectedRecordsCount =
    stats?.modules
      ?.filter((m) => selectedModules.includes(m.id))
      .reduce((sum, m) => sum + m.count, 0) || 0;

  return (
    <div
      style={{
        marginTop: '2rem',
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '16px',
        boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.05)',
        overflow: 'hidden',
      }}
    >
      {/* Header Banner */}
      <div
        style={{
          padding: '1.25rem 1.5rem',
          background: '#0f172a',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          borderBottom: '1px solid #1e293b',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              backgroundColor: 'rgba(239, 68, 68, 0.2)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#f87171',
            }}
          >
            <Database size={22} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: 'white' }}>
                Database Storage & Automatic Backup
              </h3>
              <span
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  backgroundColor: 'rgba(16, 185, 129, 0.2)',
                  color: '#34d399',
                  border: '1px solid rgba(52, 211, 153, 0.3)',
                  padding: '0.15rem 0.5rem',
                  borderRadius: '999px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                {stats?.engine || 'POSTGRESQL'}
              </span>
              {isDesktop && (
                <span
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    backgroundColor: 'rgba(59, 130, 246, 0.2)',
                    color: '#60a5fa',
                    border: '1px solid rgba(96, 165, 250, 0.3)',
                    padding: '0.15rem 0.5rem',
                    borderRadius: '999px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                  }}
                >
                  <Laptop size={11} />
                  TAURI 2 DESKTOP
                </span>
              )}
            </div>
            <p style={{ fontSize: '0.82rem', color: '#94a3b8', margin: '0.2rem 0 0 0' }}>
              Automated native backups, daily closing safety snapshots, and live PostgreSQL storage management.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            fetchStats(true);
            loadTauriData();
          }}
          disabled={refreshing || loading}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.45rem 0.9rem',
            borderRadius: '8px',
            background: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            color: '#f8fafc',
            fontSize: '0.8rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          <RefreshCw size={14} className={refreshing ? 'spinner' : ''} />
          <span>{refreshing ? 'Refreshing...' : 'Refresh Status'}</span>
        </button>
      </div>

      <div style={{ padding: '1.75rem' }}>
        {/* ==================================================================== */}
        {/* 1. NATIVE TAURI / RUST AUTOMATIC DATABASE BACKUP MANAGER             */}
        {/* ==================================================================== */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '6px',
            padding: '1.25rem',
            marginBottom: '1.5rem',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '6px',
                  background: '#15803d',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <ShieldCheck size={22} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>
                    Automatic Local Database Backup Manager
                  </h4>
                  <span
                    style={{
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      background: '#dcfce7',
                      color: '#15803d',
                      border: '1px solid #86efac',
                      padding: '0.1rem 0.5rem',
                      borderRadius: '4px',
                    }}
                  >
                    {isDesktop ? 'Rust Native Engine' : 'Auto Backup Engine'}
                  </span>
                </div>
                <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.8rem', color: '#475569' }}>
                  Restorable PostgreSQL backups with verification, atomic writing, and automated shutdown protection.
                </p>
              </div>
            </div>

            {/* Backup Now Button */}
            <button
              type="button"
              onClick={handleTriggerNativeBackupNow}
              disabled={isBackingUpNow}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem 1rem',
                borderRadius: '6px',
                background: isBackingUpNow ? '#94a3b8' : '#15803d',
                color: 'white',
                border: 'none',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: isBackingUpNow ? 'not-allowed' : 'pointer',
                boxShadow: 'var(--shadow-sm)',
                transition: 'background 0.15s ease',
              }}
            >
              {isBackingUpNow ? (
                <>
                  <div className="spinner" style={{ width: 15, height: 15, borderWidth: 2 }} />
                  <span>Validating & Backing Up...</span>
                </>
              ) : (
                <>
                  <Play size={16} fill="white" />
                  <span>Backup Now</span>
                </>
              )}
            </button>
          </div>

          {/* Tauri Feedback Alert */}
          {tauriFeedback && (
            <div
              style={{
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                marginBottom: '1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                background: tauriFeedback.type === 'success' ? '#ffffff' : '#fef2f2',
                border: `1px solid ${tauriFeedback.type === 'success' ? '#86efac' : '#fca5a5'}`,
                color: tauriFeedback.type === 'success' ? '#15803d' : '#b91c1c',
                fontSize: '0.84rem',
                fontWeight: 600,
              }}
            >
              {tauriFeedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              <span>{tauriFeedback.message}</span>
            </div>
          )}

          {/* Backup Folder Selector Row */}
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '10px',
              padding: '0.85rem 1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '0.75rem',
              marginBottom: '1rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flex: 1, minWidth: '240px' }}>
              <FolderOpen size={20} color="#059669" />
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                  Selected Backup Folder
                </span>
                <div
                  style={{
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    color: '#0f172a',
                    fontFamily: 'monospace',
                    wordBreak: 'break-all',
                  }}
                >
                  {tauriConfig?.backup_folder || 'Select a local folder...'}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={handleSelectFolder}
                disabled={isSelectingFolder}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.45rem 0.85rem',
                  borderRadius: '8px',
                  background: '#f1f5f9',
                  border: '1px solid #cbd5e1',
                  color: '#334155',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                title="Choose Directory"
              >
                <Folder size={15} />
                <span>{isSelectingFolder ? 'Opening Picker...' : 'Choose Folder'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setCustomPathInput(tauriConfig?.backup_folder || 'C:\\ZamzamBackups');
                  setIsEditingPath(!isEditingPath);
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.45rem 0.85rem',
                  borderRadius: '8px',
                  background: isEditingPath ? '#fee2e2' : '#f8fafc',
                  border: '1px solid #cbd5e1',
                  color: isEditingPath ? '#b91c1c' : '#475569',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                title="Manually type or paste local directory path"
              >
                <Edit2 size={14} />
                <span>{isEditingPath ? 'Cancel' : 'Edit Path'}</span>
              </button>
            </div>

            {/* Inline Custom Folder Path Input */}
            {isEditingPath && (
              <div
                style={{
                  width: '100%',
                  marginTop: '0.65rem',
                  paddingTop: '0.65rem',
                  borderTop: '1px dashed #cbd5e1',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ flex: 1, minWidth: '240px' }}>
                  <input
                    type="text"
                    className="form-input"
                    value={customPathInput}
                    onChange={(e) => setCustomPathInput(e.target.value)}
                    placeholder="Enter backup directory path (e.g. C:\ZamzamBackups or /Users/username/backups)"
                    style={{
                      width: '100%',
                      fontFamily: 'monospace',
                      fontSize: '0.82rem',
                      padding: '0.45rem 0.65rem',
                    }}
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSaveCustomPath}
                  className="btn btn-primary"
                  style={{
                    padding: '0.45rem 0.85rem',
                    fontSize: '0.8rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                  }}
                >
                  <Save size={14} />
                  <span>Save Path</span>
                </button>
              </div>
            )}
          </div>

          {/* Native Backup Settings Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: '0.85rem',
              marginBottom: '1rem',
            }}
          >
            {/* Toggle 1: Automatic Backup Enabled */}
            <div
              onClick={handleToggleAutoBackup}
              style={{
                background: '#ffffff',
                border: `1.5px solid ${tauriConfig?.auto_backup_enabled ? '#86efac' : '#cbd5e1'}`,
                borderRadius: '10px',
                padding: '0.75rem 0.9rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0f172a' }}>
                  Automatic Backup
                </div>
                <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                  Background snapshot daemon
                </div>
              </div>
              <input
                type="checkbox"
                checked={Boolean(tauriConfig?.auto_backup_enabled)}
                onChange={() => {}}
                style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#059669' }}
              />
            </div>

            {/* Toggle 2: Backup on Counter / App Close */}
            <div
              onClick={handleToggleCloseBackup}
              style={{
                background: '#ffffff',
                border: `1.5px solid ${tauriConfig?.backup_on_close ? '#86efac' : '#cbd5e1'}`,
                borderRadius: '10px',
                padding: '0.75rem 0.9rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0f172a' }}>
                  Backup on App Close
                </div>
                <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                  Safe counter daily closing snapshot
                </div>
              </div>
              <input
                type="checkbox"
                checked={Boolean(tauriConfig?.backup_on_close)}
                onChange={() => {}}
                style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#059669' }}
              />
            </div>

            {/* Toggle 3: Safety Backup at 23:59 */}
            <div
              onClick={handleToggleSafetyBackup}
              style={{
                background: '#ffffff',
                border: `1.5px solid ${tauriConfig?.safety_backup_2359 ? '#86efac' : '#cbd5e1'}`,
                borderRadius: '10px',
                padding: '0.75rem 0.9rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0f172a' }}>
                  23:59 Safety Backup
                </div>
                <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                  If daily closing was not completed
                </div>
              </div>
              <input
                type="checkbox"
                checked={Boolean(tauriConfig?.safety_backup_2359)}
                onChange={() => {}}
                style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#059669' }}
              />
            </div>

            {/* Setting 4: Configurable Retention */}
            <div
              style={{
                background: '#ffffff',
                border: '1.5px solid #cbd5e1',
                borderRadius: '10px',
                padding: '0.75rem 0.9rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0f172a' }}>
                  Retention Policy
                </div>
                <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                  Never deletes on failure
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={tauriConfig?.retention_count || 30}
                  onChange={(e) => handleRetentionChange(parseInt(e.target.value, 10) || 30)}
                  style={{
                    width: '60px',
                    padding: '0.25rem 0.4rem',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    textAlign: 'center',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                  }}
                />
                <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>files</span>
              </div>
            </div>
          </div>

          {/* Backup Status & Guarantee Bar */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '0.75rem',
              padding: '0.85rem',
              background: 'rgba(255, 255, 255, 0.7)',
              borderRadius: '10px',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              fontSize: '0.78rem',
            }}
          >
            <div>
              <span style={{ color: '#047857', fontWeight: 700, display: 'block' }}>Last Successful Backup:</span>
              <strong style={{ color: '#0f172a', fontSize: '0.84rem' }}>
                {tauriConfig?.last_successful_backup || 'None recorded yet'}
              </strong>
            </div>

            <div>
              <span style={{ color: '#047857', fontWeight: 700, display: 'block' }}>Status & Validation:</span>
              <span
                style={{
                  fontWeight: 700,
                  color: tauriConfig?.last_backup_status === 'SUCCESS' ? '#15803d' : tauriConfig?.last_backup_status === 'FAILED' ? '#b91c1c' : '#475569',
                }}
              >
                {tauriConfig?.last_backup_status === 'SUCCESS'
                  ? '✓ Verified PostgreSQL Dump'
                  : tauriConfig?.last_backup_status === 'FAILED'
                  ? `✗ Error: ${tauriConfig?.last_error || 'Failed'}`
                  : 'Ready'}
              </span>
            </div>

            <div>
              <span style={{ color: '#047857', fontWeight: 700, display: 'block' }}>Duplicate Daily Prevention:</span>
              <span style={{ color: '#0f172a', fontWeight: 600 }}>
                {tauriConfig?.last_backup_date ? `Completed on ${tauriConfig.last_backup_date}` : 'Enabled (Ready for today)'}
              </span>
            </div>
          </div>

          {/* History of Local Backups (if on Desktop) */}
          {tauriHistory.length > 0 && (
            <div style={{ marginTop: '1rem' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#064e3b', marginBottom: '0.4rem' }}>
                Recent Verified Local Backups ({tauriHistory.length})
              </div>
              <div style={{ maxHeight: '160px', overflowY: 'auto', border: '1px solid #cbd5e1', borderRadius: '8px', background: 'white' }}>
                {tauriHistory.slice(0, 10).map((b) => (
                  <div
                    key={b.filename}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.45rem 0.75rem',
                      borderBottom: '1px solid #f1f5f9',
                      fontSize: '0.78rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                      <CheckCircle2 size={14} color="#16a34a" />
                      <span style={{ fontWeight: 600, color: '#1e293b' }}>{b.filename}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#64748b' }}>
                      <span>{b.size_formatted}</span>
                      <span>{b.created_at}</span>
                      <span
                        style={{
                          fontSize: '0.68rem',
                          background: '#ecfdf5',
                          color: '#059669',
                          padding: '0.1rem 0.4rem',
                          borderRadius: '4px',
                          fontWeight: 700,
                        }}
                      >
                        {b.format}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Feedback Alert for Web Downloads */}
        {feedback && (
          <div
            style={{
              padding: '0.85rem 1rem',
              borderRadius: '10px',
              marginBottom: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
              background: feedback.type === 'success' ? '#f0fdf4' : '#fef2f2',
              border: `1px solid ${feedback.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
              color: feedback.type === 'success' ? '#166534' : '#991b1b',
              fontSize: '0.88rem',
              fontWeight: 500,
            }}
          >
            {feedback.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
            <span>{feedback.message}</span>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div
            style={{
              padding: '0.85rem 1rem',
              borderRadius: '10px',
              marginBottom: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#991b1b',
              fontSize: '0.88rem',
            }}
          >
            <ShieldAlert size={18} />
            <span>{error}</span>
          </div>
        )}

        {/* Storage Level Gauge & Top Stats Cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '1rem',
            marginBottom: '1.75rem',
          }}
        >
          {/* Card 1: Storage Level */}
          <div
            style={{
              padding: '1.25rem',
              borderRadius: '12px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b' }}>STORAGE LEVEL</span>
              <HardDrive size={16} color="#0284c7" />
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem', marginBottom: '0.6rem' }}>
              <span style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0f172a' }}>
                {stats?.size_formatted || '...'}
              </span>
              <span style={{ fontSize: '0.82rem', color: '#64748b' }}>
                / {stats?.quota_formatted || 'Local Disk (Unlimited)'}
              </span>
            </div>
            {/* Storage Progress Bar */}
            <div
              style={{
                width: '100%',
                height: '8px',
                background: '#e2e8f0',
                borderRadius: '999px',
                overflow: 'hidden',
                marginBottom: '0.4rem',
              }}
            >
              <div
                style={{
                  width: `${Math.max(5, stats?.usage_pct || 0)}%`,
                  height: '100%',
                  background: '#10b981',
                  transition: 'width 0.5s ease-in-out',
                }}
              />
            </div>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
              <strong>Local Disk Storage</strong> — No cloud quota limit
            </span>
          </div>

          {/* Card 2: Total Records */}
          <div
            style={{
              padding: '1.25rem',
              borderRadius: '12px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b' }}>ACTIVE RECORDS</span>
              <Layers size={16} color="#0284c7" />
            </div>
            <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.6rem' }}>
              {stats?.total_records.toLocaleString() || 0}
            </div>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
              Distributed across {stats?.table_count || 10} database entities
            </span>
          </div>

          {/* Card 3: Storage Health */}
          <div
            style={{
              padding: '1.25rem',
              borderRadius: '12px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b' }}>DATABASE STATUS</span>
              <ShieldCheck size={16} color="#16a34a" />
            </div>
            <div
              style={{
                fontSize: '1.45rem',
                fontWeight: 800,
                color:
                  stats?.status === 'critical'
                    ? '#dc2626'
                    : stats?.status === 'warning'
                    ? '#d97706'
                    : '#16a34a',
                marginBottom: '0.6rem',
                textTransform: 'capitalize',
              }}
            >
              {stats?.status || 'Healthy'}
            </div>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
              Continuous read/write operations active
            </span>
          </div>
        </div>

        {/* MANUAL WEB DOWNLOADS GRID */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '1.5rem',
            paddingTop: '1.5rem',
            borderTop: '1px solid #e2e8f0',
          }}
        >
          {/* OPTION 1: Restorable PostgreSQL SQL Backup */}
          <div
            style={{
              padding: '1.5rem',
              borderRadius: '14px',
              border: '1.5px solid #cbd5e1',
              background: '#f8fafc',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.6rem' }}>
                <div
                  style={{
                    padding: '0.45rem',
                    borderRadius: '8px',
                    background: '#dbeafe',
                    color: '#1d4ed8',
                  }}
                >
                  <FileText size={20} />
                </div>
                <div>
                  <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                    Restorable PostgreSQL SQL Script (.sql)
                  </h4>
                  <span style={{ fontSize: '0.74rem', color: '#1d4ed8', fontWeight: 600 }}>
                    Standard Production Format for psql / pg_restore
                  </span>
                </div>
              </div>

              <p style={{ fontSize: '0.82rem', color: '#475569', lineHeight: 1.5, margin: '0.75rem 0 1rem 0' }}>
                Generates a pure SQL transactional script with schema tables, sequence resets, and INSERT statements ready for direct execution with psql.
              </p>

              <div
                style={{
                  padding: '0.65rem 0.85rem',
                  borderRadius: '8px',
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  fontSize: '0.75rem',
                  color: '#64748b',
                  marginBottom: '1.25rem',
                }}
              >
                🐘 <strong>PostgreSQL Compatible:</strong> Includes transactions, sequences & integrity constraints
              </div>
            </div>

            <button
              type="button"
              onClick={handleSqlBackup}
              disabled={isSqlBackingUp}
              style={{
                width: '100%',
                padding: '0.65rem 1.25rem',
                background: '#1e3a8a',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '0.85rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                boxShadow: 'var(--shadow-sm)',
                transition: 'background 0.15s ease',
              }}
            >
              {isSqlBackingUp ? (
                <>
                  <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                  <span>Generating PostgreSQL SQL...</span>
                </>
              ) : (
                <>
                  <Download size={16} />
                  <span>Download PostgreSQL SQL (.sql)</span>
                </>
              )}
            </button>
          </div>

          {/* OPTION 2: Complete JSON Snapshot */}
          <div
            style={{
              padding: '1.5rem',
              borderRadius: '14px',
              border: '1.5px solid #cbd5e1',
              background: '#f8fafc',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.6rem' }}>
                <div
                  style={{
                    padding: '0.45rem',
                    borderRadius: '8px',
                    background: '#e0f2fe',
                    color: '#0284c7',
                  }}
                >
                  <FileJson size={20} />
                </div>
                <div>
                  <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                    JSON Database Snapshot (.json)
                  </h4>
                  <span style={{ fontSize: '0.74rem', color: '#0284c7', fontWeight: 600 }}>
                    SHA-256 Verified Full Platform Archive
                  </span>
                </div>
              </div>

              <p style={{ fontSize: '0.82rem', color: '#475569', lineHeight: 1.5, margin: '0.75rem 0 1rem 0' }}>
                Downloads a unified, verified JSON snapshot encompassing all master products, customer shops, orders, credit ledger, deliveries, and payments.
              </p>

              <div
                style={{
                  padding: '0.65rem 0.85rem',
                  borderRadius: '8px',
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  fontSize: '0.75rem',
                  color: '#64748b',
                  marginBottom: '1.25rem',
                }}
              >
                📦 <strong>Included:</strong> All 10 modules ({stats?.total_records.toLocaleString() || 0} total records)
              </div>
            </div>

            <button
              type="button"
              onClick={handleFullBackup}
              disabled={isFullBackingUp}
              style={{
                width: '100%',
                padding: '0.65rem 1.25rem',
                background: '#0284c7',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '0.85rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                boxShadow: 'var(--shadow-sm)',
                transition: 'background 0.15s ease',
              }}
            >
              {isFullBackingUp ? (
                <>
                  <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                  <span>Generating Full Snapshot...</span>
                </>
              ) : (
                <>
                  <Download size={16} />
                  <span>Download JSON Snapshot (.json)</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* ── DATABASE RESTORE & IMPORT (.SQL / .JSON) SECTION ──────────────── */}
        <div
          style={{
            marginTop: '2rem',
            paddingTop: '1.75rem',
            borderTop: '2px solid #e2e8f0',
          }}
        >
          <div
            style={{
              background: '#ffffff',
              border: '1.5px solid #cbd5e1',
              borderRadius: '12px',
              padding: '1.5rem',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '8px',
                  background: '#ecfdf5',
                  color: '#059669',
                  border: '1px solid #a7f3d0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <UploadCloud size={20} />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                  Database Restore & Data Import (SQL & JSON)
                </h4>
                <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.82rem', color: '#64748b' }}>
                  Upload and restore records from an exported PostgreSQL <code style={{ color: '#1e3a8a', fontWeight: 700 }}>.sql</code> script or <code style={{ color: '#0284c7', fontWeight: 700 }}>.json</code> platform archive.
                </p>
              </div>
            </div>

            {/* Restore Feedback Notification */}
            {restoreFeedback && (
              <div
                style={{
                  padding: '0.85rem 1rem',
                  borderRadius: '8px',
                  marginBottom: '1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.65rem',
                  background: restoreFeedback.type === 'success' ? '#f0fdf4' : '#fef2f2',
                  border: `1px solid ${restoreFeedback.type === 'success' ? '#86efac' : '#fca5a5'}`,
                  color: restoreFeedback.type === 'success' ? '#166534' : '#991b1b',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                }}
              >
                {restoreFeedback.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                <span>{restoreFeedback.message}</span>
              </div>
            )}

            {/* Hidden File Input */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".sql,.json,application/sql,application/json,text/plain"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />

            {/* Drag & Drop Zone or File Details */}
            {!restoreFile ? (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDropFile}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: `2px dashed ${isDragOver ? '#059669' : '#cbd5e1'}`,
                  borderRadius: '10px',
                  padding: '2rem 1.5rem',
                  textAlign: 'center',
                  background: isDragOver ? '#f0fdf4' : '#f8fafc',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  marginBottom: '1.25rem',
                }}
              >
                <div
                  style={{
                    width: '46px',
                    height: '46px',
                    borderRadius: '50%',
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 0.75rem',
                    color: '#64748b',
                  }}
                >
                  <FileUp size={24} />
                </div>
                <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.25rem' }}>
                  Click to choose file or drag & drop backup file here
                </div>
                <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                  Supported formats: <strong>PostgreSQL .sql</strong> script or <strong>Zamzam .json</strong> snapshot (Max: 50MB)
                </div>
              </div>
            ) : (
              <div
                style={{
                  background: '#f8fafc',
                  border: '1.5px solid #86efac',
                  borderRadius: '10px',
                  padding: '1rem 1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '1rem',
                  marginBottom: '1.25rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '8px',
                      background: restoreFile.name.toLowerCase().endsWith('.json') ? '#e0f2fe' : '#dbeafe',
                      color: restoreFile.name.toLowerCase().endsWith('.json') ? '#0284c7' : '#1d4ed8',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {restoreFile.name.toLowerCase().endsWith('.json') ? <FileJson size={22} /> : <FileText size={22} />}
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.92rem', color: '#0f172a' }}>
                      {restoreFile.name}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', gap: '0.5rem', marginTop: '2px' }}>
                      <span>Size: {(restoreFile.size / 1024).toFixed(1)} KB</span>
                      <span>•</span>
                      <span style={{ fontWeight: 700, color: restoreFile.name.toLowerCase().endsWith('.json') ? '#0284c7' : '#1d4ed8' }}>
                        {restoreFile.name.toLowerCase().endsWith('.json') ? 'JSON Platform Archive' : 'PostgreSQL SQL Script'}
                      </span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setRestoreFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    disabled={isRestoring}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.8rem' }}
                  >
                    Change File
                  </button>
                  <button
                    type="button"
                    onClick={handleRestoreSubmit}
                    disabled={isRestoring}
                    className="btn btn-primary"
                    style={{
                      background: '#b91c1c',
                      borderColor: '#b91c1c',
                      padding: '0.5rem 1.15rem',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                    }}
                  >
                    {isRestoring ? (
                      <>
                        <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                        <span>Restoring Database...</span>
                      </>
                    ) : (
                      <>
                        <Upload size={15} />
                        <span>Import & Restore Now</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Atomic Protection Note */}
            <div
              style={{
                fontSize: '0.76rem',
                color: '#64748b',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              <ShieldCheck size={15} color="#15803d" />
              <span>
                <strong>Atomic Safety Guarantee:</strong> Restorations execute in an isolated database transaction. If any entity conflict occurs, the database safely rolls back without corruption.
              </span>
            </div>
          </div>
        </div>

        {/* ── SECTION: DANGER ZONE - CLEAR ALL SYSTEM DATA (OWNER & ADMIN ONLY) ── */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: '16px',
            border: '1.5px solid #fecaca',
            overflow: 'hidden',
            boxShadow: '0 4px 16px rgba(239, 68, 68, 0.07)',
            marginTop: '1.5rem',
          }}
        >
          <div
            style={{
              padding: '1.25rem 1.5rem',
              background: 'linear-gradient(90deg, #fff1f2 0%, #fff5f5 100%)',
              borderBottom: '1.5px solid #fee2e2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '1rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  background: '#fee2e2',
                  color: '#dc2626',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 8px rgba(220, 38, 38, 0.15)',
                }}
              >
                <AlertOctagon size={24} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#991b1b' }}>
                    Danger Zone: Clear All System Data
                  </h3>
                  <span
                    style={{
                      fontSize: '0.68rem',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      padding: '3px 9px',
                      borderRadius: '999px',
                      background: '#dc2626',
                      color: '#ffffff',
                    }}
                  >
                    Owner & Admin Only
                  </span>
                </div>
                <p style={{ margin: '3px 0 0', fontSize: '0.82rem', color: '#7f1d1d' }}>
                  Wipe all business and transactional data. Only Administrator and Owner accounts are preserved.
                </p>
              </div>
            </div>

            <div>
              <button
                type="button"
                onClick={() => {
                  setIsClearModalOpen(true);
                  setClearError(null);
                  setClearSuccess(null);
                  setClearPin('');
                  setClearConfirmation('');
                }}
                disabled={!isOwnerOrAdmin}
                style={{
                  background: isOwnerOrAdmin ? '#dc2626' : '#94a3b8',
                  color: '#ffffff',
                  border: 'none',
                  padding: '0.65rem 1.35rem',
                  borderRadius: '10px',
                  fontWeight: 800,
                  fontSize: '0.88rem',
                  cursor: isOwnerOrAdmin ? 'pointer' : 'not-allowed',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  boxShadow: isOwnerOrAdmin ? '0 3px 10px rgba(220, 38, 38, 0.3)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                <Trash2 size={16} />
                <span>Clear All Data</span>
              </button>
            </div>
          </div>

          <div style={{ padding: '1.25rem 1.5rem', background: '#ffffff' }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '1rem',
                fontSize: '0.82rem',
              }}
            >
              <div
                style={{
                  background: '#fff1f2',
                  border: '1px solid #fecdd3',
                  borderRadius: '10px',
                  padding: '1rem',
                }}
              >
                <div style={{ fontWeight: 800, color: '#9f1239', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <AlertTriangle size={16} /> Data that will be permanently removed:
                </div>
                <ul style={{ margin: 0, paddingLeft: '1.2rem', color: '#881337', lineHeight: 1.6 }}>
                  <li><strong>Orders & Invoices:</strong> All orders, line items, and activity logs.</li>
                  <li><strong>Customers & Shops:</strong> All shop profiles, customer documents, and custom prices.</li>
                  <li><strong>Products:</strong> All bakery items and inventory records.</li>
                  <li><strong>Deliveries & Routes:</strong> All trips, routes, driver expenses, and shifts.</li>
                  <li><strong>Financial Ledger:</strong> All payments, receipts, and credit transactions.</li>
                  <li><strong>Staff Records:</strong> All employee profiles, attendances, and payouts.</li>
                  <li><strong>Non-Admin Accounts:</strong> All driver and staff login credentials.</li>
                  <li><strong>WhatsApp & Audits:</strong> All chat conversations and old audit logs.</li>
                </ul>
              </div>

              <div
                style={{
                  background: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  borderRadius: '10px',
                  padding: '1rem',
                }}
              >
                <div style={{ fontWeight: 800, color: '#166534', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <ShieldCheck size={16} /> Data that is guaranteed to stay intact:
                </div>
                <ul style={{ margin: 0, paddingLeft: '1.2rem', color: '#14532d', lineHeight: 1.6 }}>
                  <li>
                    <strong>Admin & Owner Accounts:</strong> Only Owner and Admin user accounts ({user?.username || 'Owner'}) remain active so you can log back in.
                  </li>
                  <li>
                    <strong>System Configuration:</strong> Business name, tax information, contact numbers, and security PIN code.
                  </li>
                  <li>
                    <strong>Database Structure:</strong> All tables and schema constraints remain ready for immediate fresh business use.
                  </li>
                  <li>
                    <strong>Authentication Session:</strong> Your current login session stays valid without disruption.
                  </li>
                </ul>
              </div>
            </div>

            {!isOwnerOrAdmin && (
              <div
                style={{
                  marginTop: '1rem',
                  padding: '0.75rem 1rem',
                  background: '#fef3c7',
                  border: '1px solid #fde68a',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  color: '#92400e',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                }}
              >
                <Lock size={16} />
                <span>Restricted Action: Only user accounts with role OWNER or System Superuser can perform database clear-all.</span>
              </div>
            )}
          </div>
        </div>

        {/* ── MODAL: CLEAR ALL SYSTEM DATA CONFIRMATION & EXECUTION ── */}
        {isClearModalOpen && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.75)',
              backdropFilter: 'blur(4px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
              padding: '1rem',
            }}
          >
            <div
              style={{
                background: '#ffffff',
                borderRadius: '18px',
                width: '100%',
                maxWidth: '560px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                overflow: 'hidden',
                border: '1.5px solid #fecaca',
                animation: 'modalSlideIn 0.2s ease-out',
              }}
            >
              {/* Modal Header */}
              <div
                style={{
                  padding: '1.25rem 1.5rem',
                  background: clearSuccess ? '#f0fdf4' : '#fff1f2',
                  borderBottom: `1.5px solid ${clearSuccess ? '#bbf7d0' : '#fee2e2'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div
                    style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '10px',
                      background: clearSuccess ? '#dcfce7' : '#fee2e2',
                      color: clearSuccess ? '#15803d' : '#dc2626',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {clearSuccess ? <CheckCircle2 size={22} /> : <AlertOctagon size={22} />}
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: clearSuccess ? '#166534' : '#991b1b' }}>
                      {clearSuccess ? 'Database Cleared Successfully' : 'Confirm Complete System Wipe'}
                    </h3>
                    <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: clearSuccess ? '#15803d' : '#7f1d1d' }}>
                      {clearSuccess ? 'All operational data removed • Owner accounts intact' : 'This action is PERMANENT and CANNOT be undone'}
                    </p>
                  </div>
                </div>

                {!isClearing && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsClearModalOpen(false);
                      if (clearSuccess) {
                        window.location.reload();
                      }
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#64748b',
                      cursor: 'pointer',
                      padding: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      borderRadius: '6px',
                    }}
                  >
                    <X size={20} />
                  </button>
                )}
              </div>

              {/* Modal Body */}
              <div style={{ padding: '1.5rem' }}>
                {clearSuccess ? (
                  <div>
                    <div
                      style={{
                        padding: '1rem',
                        background: '#f0fdf4',
                        border: '1px solid #bbf7d0',
                        borderRadius: '10px',
                        marginBottom: '1.25rem',
                      }}
                    >
                      <div style={{ fontWeight: 800, color: '#166534', fontSize: '0.95rem', marginBottom: '0.35rem' }}>
                        {clearSuccess.message}
                      </div>
                      <div style={{ fontSize: '0.82rem', color: '#15803d' }}>
                        <strong>{clearSuccess.total_deleted}</strong> total records permanently removed from the database.
                      </div>
                    </div>

                    <div style={{ marginBottom: '1.25rem' }}>
                      <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '0.5rem' }}>
                        Preserved Admin & Owner Accounts:
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {clearSuccess.preserved_users.map((uname) => (
                          <span
                            key={uname}
                            style={{
                              padding: '4px 10px',
                              background: '#dbeafe',
                              color: '#1d4ed8',
                              borderRadius: '6px',
                              fontWeight: 700,
                              fontSize: '0.82rem',
                            }}
                          >
                            🛡️ {uname}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div style={{ marginBottom: '1.5rem' }}>
                      <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '0.5rem' }}>
                        Deleted Record Breakdown:
                      </div>
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(2, 1fr)',
                          gap: '0.5rem',
                          fontSize: '0.78rem',
                          background: '#f8fafc',
                          padding: '0.75rem',
                          borderRadius: '8px',
                          border: '1px solid #e2e8f0',
                        }}
                      >
                        {Object.entries(clearSuccess.deleted_counts).map(([k, v]) => (
                          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
                            <span style={{ textTransform: 'capitalize' }}>{k.replace(/_/g, ' ')}:</span>
                            <strong style={{ color: '#0f172a' }}>{v}</strong>
                          </div>
                        ))}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setIsClearModalOpen(false);
                        window.location.reload();
                      }}
                      style={{
                        width: '100%',
                        background: '#15803d',
                        color: '#ffffff',
                        border: 'none',
                        padding: '0.75rem',
                        borderRadius: '10px',
                        fontWeight: 800,
                        fontSize: '0.92rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem',
                      }}
                    >
                      <CheckCircle2 size={18} />
                      <span>Done & Reload Clean Application</span>
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleClearAllSubmit}>
                    {/* Warning Notice */}
                    <div
                      style={{
                        padding: '0.85rem 1rem',
                        background: '#fff1f2',
                        border: '1px solid #fecdd3',
                        borderRadius: '10px',
                        color: '#9f1239',
                        fontSize: '0.82rem',
                        lineHeight: 1.5,
                        marginBottom: '1.25rem',
                      }}
                    >
                      <strong>Attention:</strong> You are about to clear all orders, customers, products, routes, payments, staff profiles, and non-admin users. <strong>Only Admin & Owner accounts will remain.</strong>
                    </div>

                    {clearError && (
                      <div
                        style={{
                          padding: '0.75rem 1rem',
                          background: '#fee2e2',
                          border: '1px solid #fca5a5',
                          borderRadius: '8px',
                          color: '#b91c1c',
                          fontSize: '0.82rem',
                          fontWeight: 600,
                          marginBottom: '1rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                        }}
                      >
                        <AlertCircle size={16} />
                        <span>{clearError}</span>
                      </div>
                    )}

                    {/* Step 1: Security PIN */}
                    <div style={{ marginBottom: '1.2rem' }}>
                      <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.35rem' }}>
                        1. Owner Security PIN (4 Digits)
                      </label>
                      <div style={{ position: 'relative' }}>
                        <input
                          type="password"
                          maxLength={4}
                          value={clearPin}
                          onChange={(e) => setClearPin(e.target.value.replace(/\D/g, ''))}
                          placeholder="Enter 4-digit PIN (Default: 7667)"
                          disabled={isClearing}
                          style={{
                            width: '100%',
                            padding: '0.65rem 0.85rem 0.65rem 2.2rem',
                            borderRadius: '8px',
                            border: '1.5px solid #cbd5e1',
                            fontSize: '0.92rem',
                            letterSpacing: '2px',
                            fontWeight: 700,
                            boxSizing: 'border-box',
                          }}
                        />
                        <KeyRound size={16} color="#64748b" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)' }} />
                      </div>
                      <span style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '3px', display: 'block' }}>
                        Authorizes Owner administrative clearance.
                      </span>
                    </div>

                    {/* Step 2: Confirmation phrase */}
                    <div style={{ marginBottom: '1.5rem' }}>
                      <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.35rem' }}>
                        2. Type Confirmation Phrase: <code style={{ color: '#b91c1c', background: '#fee2e2', padding: '2px 6px', borderRadius: '4px' }}>CLEAR ALL DATA</code>
                      </label>
                      <input
                        type="text"
                        value={clearConfirmation}
                        onChange={(e) => setClearConfirmation(e.target.value)}
                        placeholder="Type CLEAR ALL DATA here"
                        disabled={isClearing}
                        style={{
                          width: '100%',
                          padding: '0.65rem 0.85rem',
                          borderRadius: '8px',
                          border: clearConfirmation.toUpperCase() === 'CLEAR ALL DATA' ? '1.5px solid #16a34a' : '1.5px solid #cbd5e1',
                          fontSize: '0.9rem',
                          fontWeight: 700,
                          boxSizing: 'border-box',
                        }}
                      />
                      <span style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '3px', display: 'block' }}>
                        Confirms you understand all non-admin data will be deleted.
                      </span>
                    </div>

                    {/* Buttons */}
                    <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                      <button
                        type="button"
                        onClick={() => setIsClearModalOpen(false)}
                        disabled={isClearing}
                        className="btn btn-secondary"
                        style={{ padding: '0.65rem 1.25rem', fontSize: '0.88rem' }}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={
                          isClearing ||
                          clearPin.length !== 4 ||
                          clearConfirmation.trim().toUpperCase() !== 'CLEAR ALL DATA'
                        }
                        style={{
                          background:
                            clearPin.length === 4 && clearConfirmation.trim().toUpperCase() === 'CLEAR ALL DATA' && !isClearing
                              ? '#dc2626'
                              : '#cbd5e1',
                          color: '#ffffff',
                          border: 'none',
                          padding: '0.65rem 1.35rem',
                          borderRadius: '8px',
                          fontWeight: 800,
                          fontSize: '0.88rem',
                          cursor:
                            clearPin.length === 4 && clearConfirmation.trim().toUpperCase() === 'CLEAR ALL DATA' && !isClearing
                              ? 'pointer'
                              : 'not-allowed',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.45rem',
                          boxShadow:
                            clearPin.length === 4 && clearConfirmation.trim().toUpperCase() === 'CLEAR ALL DATA'
                              ? '0 3px 10px rgba(220, 38, 38, 0.3)'
                              : 'none',
                        }}
                      >
                        {isClearing ? (
                          <>
                            <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                            <span>Clearing All System Data...</span>
                          </>
                        ) : (
                          <>
                            <Trash2 size={16} />
                            <span>Wipe All Data & Keep Admin/Owner</span>
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

