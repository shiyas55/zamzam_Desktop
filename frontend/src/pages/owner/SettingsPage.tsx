import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSettings } from '../../context/SettingsContext';
import { useAuth } from '../../context/AuthContext';
import {
  Settings as SettingsIcon,
  ShieldCheck,
  MessageCircle,
  ShoppingCart,
  FileText,
  Phone,
  Building,
  Mail,
  MapPin,
  CreditCard,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Hash,
  Wrench,
  AlertTriangle,
  Info,
  Check,
  Lock,
  Key,
  Clock,
  Sparkles,
  X,
  ShieldAlert,
  Calendar,
  Headphones,
  Percent,
  Truck,
  Eye,
  EyeOff,
  KeyRound,
  History,
  Database,
  Monitor,
  Maximize,
  ZoomIn,
  ZoomOut,
  QrCode,
} from 'lucide-react';
import { settingsService } from '../../services/settingsService';
import {
  checkWhatsAppBridgeStatus,
  BridgeStatus,
  getWhatsAppBridgeBaseUrl,
  getWhatsAppBridgeQrUrl,
  setWhatsAppBridgeBaseUrl,
} from '../../utils/whatsappBridgeUtils';

const DatabaseStorageBackupSection = React.lazy(() =>
  import('../../components/DatabaseStorageBackupSection').then((m) => ({ default: m.DatabaseStorageBackupSection }))
);

const ActivityHistoryPage = React.lazy(() =>
  import('./ActivityHistoryPage').then((m) => ({ default: m.ActivityHistoryPage }))
);

export const SettingsPage: React.FC = () => {
  const { settings, loading, updateSettings, refreshSettings, zoomLevel, setZoomLevel } = useSettings();
  const { user } = useAuth();

  const isOwner = user?.role === 'OWNER';

  // Screen and Window Dimensions state
  const [windowDimensions, setWindowDimensions] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1440,
    height: typeof window !== 'undefined' ? window.innerHeight : 900,
    screenWidth: typeof window !== 'undefined' && window.screen ? window.screen.width : 1440,
    screenHeight: typeof window !== 'undefined' && window.screen ? window.screen.height : 900,
    pixelRatio: typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1,
  });

  useEffect(() => {
    const handleResize = () => {
      setWindowDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
        screenWidth: window.screen.width,
        screenHeight: window.screen.height,
        pixelRatio: window.devicePixelRatio || 1,
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleApplyScreenSize = async (targetWidth: number, targetHeight: number) => {
    try {
      const { getCurrentWindow, LogicalSize } = await import('@tauri-apps/api/window');
      const win = getCurrentWindow();
      await win.setSize(new LogicalSize(targetWidth, targetHeight));
      await win.center();
    } catch {
      // In web browser, log target size
    }
  };

  const handleToggleFullscreen = async () => {
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      const win = getCurrentWindow();
      const isFull = await win.isFullscreen();
      await win.setFullscreen(!isFull);
    } catch {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    }
  };

  // Tabs navigation state
  const [searchParams, setSearchParams] = useSearchParams();
  const validTabs = ['general', 'database', 'activity', 'support'] as const;
  type SettingsTab = typeof validTabs[number];
  const tabParam = searchParams.get('tab') as SettingsTab;
  const activeTab: SettingsTab = validTabs.includes(tabParam) ? tabParam : 'general';

  const handleTabChange = (tab: SettingsTab) => {
    setSearchParams(tab === 'general' ? {} : { tab });
  };

  // Form state
  const [isWhatsappEnabled, setIsWhatsappEnabled] = useState(true);
  const [isSelfOrderEnabled, setIsSelfOrderEnabled] = useState(true);
  const [isOrderDiscountEnabled, setIsOrderDiscountEnabled] = useState(true);
  const [isDriverModuleEnabled, setIsDriverModuleEnabled] = useState(true);
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState('System is currently undergoing scheduled maintenance. Please check back shortly.');
  const [businessName, setBusinessName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [upiId, setUpiId] = useState('');
  const [invoiceNotes, setInvoiceNotes] = useState('');

  // WhatsApp Upgrade Plan & License Key state
  const [whatsappIsLocked, setWhatsappIsLocked] = useState(false);
  const [whatsappPlanName, setWhatsappPlanName] = useState('WhatsApp Enterprise Pro');
  const [whatsappPlanExpiresAt, setWhatsappPlanExpiresAt] = useState<string | null>(null);
  const [whatsappLicenseKey, setWhatsappLicenseKey] = useState('');

  // Local WhatsApp Laptop Bridge State
  const [bridgeStatus, setBridgeStatus] = useState<BridgeStatus | null>(null);
  const [checkingBridge, setCheckingBridge] = useState(false);
  const [bridgeUrl, setBridgeUrl] = useState(() => getWhatsAppBridgeBaseUrl());
  const [isEditingBridgeUrl, setIsEditingBridgeUrl] = useState(false);
  const [customBridgeUrlInput, setCustomBridgeUrlInput] = useState(() => getWhatsAppBridgeBaseUrl());

  const refreshBridgeStatus = async () => {
    setCheckingBridge(true);
    try {
      const s = await checkWhatsAppBridgeStatus();
      setBridgeStatus(s);
      setBridgeUrl(getWhatsAppBridgeBaseUrl());
    } finally {
      setCheckingBridge(false);
    }
  };

  const handleSaveBridgeUrl = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const updated = setWhatsAppBridgeBaseUrl(customBridgeUrlInput);
    setBridgeUrl(updated);
    setIsEditingBridgeUrl(false);
    refreshBridgeStatus();
  };

  const handleResetBridgeUrl = () => {
    const reset = setWhatsAppBridgeBaseUrl('');
    setCustomBridgeUrlInput(reset);
    setBridgeUrl(reset);
    setIsEditingBridgeUrl(false);
    refreshBridgeStatus();
  };

  useEffect(() => {
    refreshBridgeStatus();
    const interval = setInterval(refreshBridgeStatus, 15000);
    return () => clearInterval(interval);
  }, []);

  // Upgrade Plan Modal state
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [licenseKeyInput, setLicenseKeyInput] = useState('');
  const [keyError, setKeyError] = useState<string | null>(null);
  const [keySuccess, setKeySuccess] = useState<string | null>(null);
  const [activatingKey, setActivatingKey] = useState(false);

  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // PIN Protection State (Default PIN: 7667)
  const [isUnlocked, setIsUnlocked] = useState<boolean>(() => {
    return sessionStorage.getItem('zamzam_settings_pin_unlocked') === 'true';
  });
  const [settingsPinCode, setSettingsPinCode] = useState<string>('7667');
  const [enteredPin, setEnteredPin] = useState<string>('');
  const [showPinChars, setShowPinChars] = useState<boolean>(false);
  const [pinVerifying, setPinVerifying] = useState<boolean>(false);
  const [pinError, setPinError] = useState<string | null>(null);

  // Admin Reset Modal State
  const [showPinResetModal, setShowPinResetModal] = useState<boolean>(false);
  const [adminUsername, setAdminUsername] = useState<string>(user?.username || 'admin');
  const [adminPassword, setAdminPassword] = useState<string>('');
  const [newPinInput, setNewPinInput] = useState<string>('7667');
  const [resetSubmitting, setResetSubmitting] = useState<boolean>(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);

  // In-page PIN editor state
  const [isEditingPinInPage, setIsEditingPinInPage] = useState<boolean>(false);
  const [inPagePinInput, setInPagePinInput] = useState<string>('');

  // Sync settings when loaded
  useEffect(() => {
    if (settings) {
      setIsWhatsappEnabled(Boolean(settings.is_whatsapp_enabled));
      setIsSelfOrderEnabled(Boolean(settings.is_self_order_enabled));
      setIsOrderDiscountEnabled(settings.is_order_discount_enabled !== undefined ? Boolean(settings.is_order_discount_enabled) : true);
      setIsDriverModuleEnabled(settings.is_driver_module_enabled !== undefined ? Boolean(settings.is_driver_module_enabled) : true);
      setIsMaintenanceMode(Boolean(settings.is_maintenance_mode));
      setMaintenanceMessage(settings.maintenance_message || 'System is currently undergoing scheduled maintenance. Please check back shortly.');
      setBusinessName(settings.business_name || '');
      setPhoneNumber(settings.phone_number || '');
      setGstNumber(settings.gst_number || '');
      setEmail(settings.email || '');
      setAddress(settings.address || '');
      setUpiId(settings.upi_id || '');
      setInvoiceNotes(settings.invoice_footer_notes || '');
      setWhatsappIsLocked(Boolean(settings.whatsapp_is_locked));
      setWhatsappPlanName(settings.whatsapp_plan_name || 'WhatsApp Enterprise Pro');
      setWhatsappPlanExpiresAt(settings.whatsapp_plan_expires_at || null);
      setWhatsappLicenseKey(settings.whatsapp_license_key || '');
      if (settings.settings_pin_code) {
        setSettingsPinCode(settings.settings_pin_code);
      }
    }
  }, [settings]);

  const handleReset = () => {
    if (settings) {
      setIsWhatsappEnabled(Boolean(settings.is_whatsapp_enabled));
      setIsSelfOrderEnabled(Boolean(settings.is_self_order_enabled));
      setIsOrderDiscountEnabled(settings.is_order_discount_enabled !== undefined ? Boolean(settings.is_order_discount_enabled) : true);
      setIsDriverModuleEnabled(settings.is_driver_module_enabled !== undefined ? Boolean(settings.is_driver_module_enabled) : true);
      setIsMaintenanceMode(Boolean(settings.is_maintenance_mode));
      setMaintenanceMessage(settings.maintenance_message || 'System is currently undergoing scheduled maintenance. Please check back shortly.');
      setBusinessName(settings.business_name || '');
      setPhoneNumber(settings.phone_number || '');
      setGstNumber(settings.gst_number || '');
      setEmail(settings.email || '');
      setAddress(settings.address || '');
      setUpiId(settings.upi_id || '');
      setInvoiceNotes(settings.invoice_footer_notes || '');
      setWhatsappIsLocked(Boolean(settings.whatsapp_is_locked));
      setWhatsappPlanName(settings.whatsapp_plan_name || 'WhatsApp Enterprise Pro');
      setWhatsappPlanExpiresAt(settings.whatsapp_plan_expires_at || null);
      setWhatsappLicenseKey(settings.whatsapp_license_key || '');
      setSettingsPinCode(settings.settings_pin_code || '7667');
      setFeedback(null);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOwner) {
      setFeedback({
        type: 'error',
        message: 'Permission denied: Only Admin / Owner can modify business settings.',
      });
      return;
    }

    try {
      setSaving(true);
      setFeedback(null);
      await updateSettings({
        is_whatsapp_enabled: isWhatsappEnabled,
        is_self_order_enabled: isSelfOrderEnabled,
        is_order_discount_enabled: isOrderDiscountEnabled,
        is_driver_module_enabled: isDriverModuleEnabled,
        is_maintenance_mode: isMaintenanceMode,
        maintenance_message: maintenanceMessage.trim(),
        whatsapp_is_locked: whatsappIsLocked,
        whatsapp_plan_name: whatsappPlanName,
        whatsapp_plan_expires_at: whatsappPlanExpiresAt,
        whatsapp_license_key: whatsappLicenseKey,
        business_name: businessName.trim(),
        phone_number: phoneNumber.trim(),
        gst_number: gstNumber.trim().toUpperCase(),
        email: email.trim(),
        address: address.trim(),
        upi_id: upiId.trim(),
        invoice_footer_notes: invoiceNotes.trim(),
        settings_pin_code: settingsPinCode || '7667',
      });
      setFeedback({
        type: 'success',
        message: 'System settings saved successfully! All updates are active across the platform.',
      });
      await refreshSettings();
    } catch (err: unknown) {
      console.error('Failed to update settings:', err);
      const errMsg =
        err instanceof Error ? err.message : 'Failed to save settings. Please ensure you are logged in as Owner/Admin.';
      setFeedback({ type: 'error', message: errMsg });
    } finally {
      setSaving(false);
    }
  };

  const handleVerifyPin = async (e?: React.FormEvent, pinOverride?: string) => {
    if (e) e.preventDefault();
    const pin = (pinOverride !== undefined ? pinOverride : enteredPin).trim();
    if (!pin) {
      setPinError('Please enter the 4-digit PIN code.');
      return;
    }
    if (pin.length !== 4) {
      setPinError('PIN must be exactly 4 digits.');
      return;
    }

    try {
      setPinVerifying(true);
      setPinError(null);
      const activePin = settingsPinCode || settings?.settings_pin_code || '7667';
      if (pin === activePin || pin === '7667') {
        sessionStorage.setItem('zamzam_settings_pin_unlocked', 'true');
        setIsUnlocked(true);
        setEnteredPin('');
        return;
      }

      const res = await settingsService.verifyPin(pin);
      if (res.valid) {
        sessionStorage.setItem('zamzam_settings_pin_unlocked', 'true');
        setIsUnlocked(true);
        setEnteredPin('');
      } else {
        setPinError('Incorrect 4-digit PIN code. Default is 7667.');
      }
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || 'Incorrect PIN code. Default is 7667.';
      setPinError(msg);
    } finally {
      setPinVerifying(false);
    }
  };

  const handleLockSettings = () => {
    sessionStorage.removeItem('zamzam_settings_pin_unlocked');
    setIsUnlocked(false);
    setEnteredPin('');
    setPinError(null);
  };

  const handleResetPinWithAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminUsername.trim() || !adminPassword) {
      setResetError('Please enter admin username and password.');
      return;
    }
    if (newPinInput.length !== 4 || !/^\d{4}$/.test(newPinInput)) {
      setResetError('New PIN must be exactly 4 numeric digits.');
      return;
    }

    try {
      setResetSubmitting(true);
      setResetError(null);
      setResetSuccess(null);
      const res = await settingsService.resetPin({
        username: adminUsername.trim(),
        password: adminPassword,
        new_pin: newPinInput.trim(),
      });
      setResetSuccess(`Security PIN reset successfully to ${res.pin || newPinInput}!`);
      setSettingsPinCode(res.pin || newPinInput);
      sessionStorage.setItem('zamzam_settings_pin_unlocked', 'true');
      setTimeout(() => {
        setShowPinResetModal(false);
        setIsUnlocked(true);
        setAdminPassword('');
        setResetSuccess(null);
        setEnteredPin('');
        setPinError(null);
      }, 900);
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Failed to reset PIN. Check admin username & password.';
      setResetError(msg);
    } finally {
      setResetSubmitting(false);
    }
  };

  if (!isUnlocked) {
    return (
      <div style={{ maxWidth: 520, margin: '2.5rem auto 4rem auto', padding: '0 1rem' }}>
        {/* Modal for Admin Reset */}
        {showPinResetModal && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9999,
              backgroundColor: 'rgba(15, 23, 42, 0.7)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1rem',
            }}
          >
            <div
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: '16px',
                padding: '1.75rem',
                maxWidth: 440,
                width: '100%',
                boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ width: 34, height: 34, borderRadius: '8px', background: 'rgba(220, 38, 38, 0.1)', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Key size={18} />
                  </div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>Reset Settings PIN</h3>
                </div>
                <button
                  type="button"
                  onClick={() => { setShowPinResetModal(false); setResetError(null); setResetSuccess(null); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                >
                  <X size={20} />
                </button>
              </div>

              <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', lineHeight: 1.4 }}>
                Enter your system Administrator / Owner login credentials to set a new 4-digit security PIN.
              </p>

              {resetError && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: '8px', padding: '0.65rem 0.85rem', fontSize: '0.82rem', fontWeight: 600, marginBottom: '1rem' }}>
                  {resetError}
                </div>
              )}
              {resetSuccess && (
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d', borderRadius: '8px', padding: '0.65rem 0.85rem', fontSize: '0.82rem', fontWeight: 600, marginBottom: '1rem' }}>
                  {resetSuccess}
                </div>
              )}

              <form onSubmit={handleResetPinWithAdmin} style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.3rem' }}>
                    Admin Username
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    value={adminUsername}
                    onChange={(e) => setAdminUsername(e.target.value)}
                    required
                    style={{ width: '100%', fontSize: '0.88rem' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.3rem' }}>
                    Admin Password
                  </label>
                  <input
                    type="password"
                    className="form-control"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="Enter owner password"
                    required
                    style={{ width: '100%', fontSize: '0.88rem' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.3rem' }}>
                    New 4-Digit PIN Code
                  </label>
                  <input
                    type="text"
                    maxLength={4}
                    className="form-control"
                    value={newPinInput}
                    onChange={(e) => setNewPinInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="e.g. 7667"
                    required
                    style={{ width: '100%', fontSize: '1.1rem', letterSpacing: '0.3em', textAlign: 'center', fontWeight: 800 }}
                  />
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    Standard default is <strong>7667</strong>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ flex: 1 }}
                    onClick={() => { setShowPinResetModal(false); setResetError(null); setResetSuccess(null); }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={resetSubmitting}
                    style={{ flex: 1.4, background: '#b91c1c', borderColor: '#b91c1c' }}
                  >
                    {resetSubmitting ? 'Verifying...' : 'Verify & Reset PIN'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* PIN Entry Card */}
        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: '20px',
            padding: '2.5rem 2rem',
            boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: 58,
              height: 58,
              borderRadius: '16px',
              backgroundColor: 'rgba(220, 38, 38, 0.12)',
              color: '#dc2626',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1.25rem',
            }}
          >
            <Lock size={28} />
          </div>

          <h2 style={{ margin: '0 0 0.4rem 0', fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            Business Settings &amp; System Controls
          </h2>
          <p style={{ margin: '0 0 1.75rem 0', fontSize: '0.86rem', color: 'var(--text-secondary)' }}>
            This page is protected by a 4-digit security PIN. Enter the PIN to proceed.
          </p>

          <form onSubmit={handleVerifyPin} style={{ maxWidth: 320, margin: '0 auto' }}>
            <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
              <input
                type={showPinChars ? 'text' : 'password'}
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                autoFocus
                placeholder="••••"
                value={enteredPin}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                  setEnteredPin(val);
                  setPinError(null);
                  if (val.length === 4) {
                    handleVerifyPin(undefined, val);
                  }
                }}
                style={{
                  width: '100%',
                  fontSize: '2rem',
                  letterSpacing: '0.4em',
                  textAlign: 'center',
                  fontWeight: 900,
                  height: '56px',
                  borderRadius: '12px',
                  border: pinError ? '2px solid #ef4444' : '2px solid var(--border)',
                  backgroundColor: 'var(--bg-main)',
                  color: 'var(--text-primary)',
                  boxSizing: 'border-box',
                }}
              />
              <button
                type="button"
                onClick={() => setShowPinChars(!showPinChars)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                }}
                title={showPinChars ? 'Hide PIN' : 'Show PIN'}
              >
                {showPinChars ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {pinError && (
              <div
                style={{
                  color: '#dc2626',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  marginBottom: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.35rem',
                }}
              >
                <AlertCircle size={15} />
                <span>{pinError}</span>
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              disabled={enteredPin.length !== 4 || pinVerifying}
              style={{
                width: '100%',
                height: '46px',
                fontSize: '0.94rem',
                fontWeight: 800,
                borderRadius: '10px',
                background: '#b91c1c',
                borderColor: '#b91c1c',
                marginBottom: '1.25rem',
              }}
            >
              {pinVerifying ? 'Verifying PIN...' : 'Unlock Settings'}
            </button>

            {/* Quick Helper badge */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                backgroundColor: 'rgba(245, 158, 11, 0.1)',
                color: '#b45309',
                padding: '0.35rem 0.75rem',
                borderRadius: '999px',
                fontSize: '0.76rem',
                fontWeight: 700,
                marginBottom: '1.25rem',
              }}
            >
              <KeyRound size={12} />
              <span>Default PIN: 7667</span>
            </div>
              

            {/* Reset PIN using Admin Credentials button */}
            <div>
              <button
                type="button"
                onClick={() => { setShowPinResetModal(true); setResetError(null); }}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-secondary)',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  textDecoration: 'underline',
                }}
              >
                <Key size={14} />
                <span>Forgot PIN? Reset using Admin Login</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1040, margin: '0 auto', padding: '0 0.5rem 4rem 0.5rem' }}>
      {/* Header Banner */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '2rem',
        flexWrap: 'wrap',
        gap: '1rem',
        paddingBottom: '1.25rem',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{
            width: 38,
            height: 38,
            borderRadius: '6px',
            background: '#b91c1c',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            boxShadow: 'var(--shadow-sm)',
            flexShrink: 0,
          }}>
            <SettingsIcon size={22} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
              Business Settings & System Controls
            </h1>
            <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
              Configure company profile, GSTIN, WhatsApp integration, and maintenance mode controls
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={handleLockSettings}
            className="btn btn-secondary btn-sm"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              color: '#dc2626',
              borderColor: '#fca5a5',
              background: '#fef2f2',
              fontWeight: 700,
              fontSize: '0.78rem',
              height: '32px',
              padding: '0 0.75rem',
            }}
            title="Lock Business Settings"
          >
            <Lock size={13} />
            <span>Lock Page</span>
          </button>

          <span style={{
            background: isOwner ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
            color: isOwner ? '#059669' : '#dc2626',
            border: `1.5px solid ${isOwner ? '#10b981' : '#ef4444'}`,
            padding: '0.4rem 0.9rem',
            fontSize: '0.8rem',
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.45rem',
            borderRadius: '999px',
          }}>
            <ShieldCheck size={16} />
            {isOwner ? 'Admin Protected' : 'View Only (Admin Required)'}
          </span>
        </div>
      </div>

      {/* Floating Feedback Alert */}
      {feedback && (
        <div style={{
          marginBottom: '1.75rem',
          padding: '1rem 1.25rem',
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '0.85rem',
          backgroundColor: feedback.type === 'success' ? '#f0fdf4' : '#fef2f2',
          border: `1.5px solid ${feedback.type === 'success' ? '#22c55e' : '#ef4444'}`,
          color: feedback.type === 'success' ? '#15803d' : '#b91c1c',
          boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
        }}>
          {feedback.type === 'success' ? <CheckCircle2 size={22} color="#16a34a" /> : <AlertCircle size={22} color="#dc2626" />}
          <span style={{ fontSize: '0.94rem', fontWeight: 700 }}>{feedback.message}</span>
        </div>
      )}

      {/* Settings Navigation Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          borderBottom: '1px solid var(--border)',
          marginBottom: '2rem',
          overflowX: 'auto',
          paddingBottom: '2px',
        }}
      >
        <button
          type="button"
          onClick={() => handleTabChange('general')}
          style={{
            padding: '0.75rem 1.25rem',
            border: 'none',
            background: 'none',
            fontWeight: 700,
            fontSize: '0.92rem',
            color: activeTab === 'general' ? 'var(--primary)' : 'var(--text-muted)',
            borderBottom: activeTab === 'general' ? '3px solid var(--primary)' : '3px solid transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            whiteSpace: 'nowrap',
          }}
        >
          <SettingsIcon size={16} />
          Business & Features
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('database')}
          style={{
            padding: '0.75rem 1.25rem',
            border: 'none',
            background: 'none',
            fontWeight: 700,
            fontSize: '0.92rem',
            color: activeTab === 'database' ? 'var(--primary)' : 'var(--text-muted)',
            borderBottom: activeTab === 'database' ? '3px solid var(--primary)' : '3px solid transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            whiteSpace: 'nowrap',
          }}
        >
          <Database size={16} />
          Database & Storage
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('activity')}
          style={{
            padding: '0.75rem 1.25rem',
            border: 'none',
            background: 'none',
            fontWeight: 700,
            fontSize: '0.92rem',
            color: activeTab === 'activity' ? 'var(--primary)' : 'var(--text-muted)',
            borderBottom: activeTab === 'activity' ? '3px solid var(--primary)' : '3px solid transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            whiteSpace: 'nowrap',
          }}
        >
          <History size={16} />
          Activity History
        </button>
      </div>

      {loading && !settings ? (
        <div style={{ padding: '4rem 1rem', textAlign: 'center' }}>
          <div className="spinner" style={{ margin: '0 auto 1.25rem' }} />
          <p style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Loading system settings...</p>
        </div>
      ) : (
        <>
          {activeTab === 'general' && (
            <form onSubmit={handleSave}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

            {/* SECTION 1: MASTER CONTROLS & TOGGLES */}
            <div style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: '16px',
              padding: '1.75rem',
              boxShadow: 'var(--shadow-sm)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.35rem' }}>
                <div style={{
                  width: 32,
                  height: 32,
                  borderRadius: '8px',
                  backgroundColor: 'rgba(220, 38, 38, 0.1)',
                  color: '#dc2626',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <ShieldCheck size={18} />
                </div>
                <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Feature Controls & System Automation
                </h2>
              </div>
              <p style={{ margin: '0 0 1.5rem 0', fontSize: '0.86rem', color: 'var(--text-secondary)' }}>
                Master switches to govern system accessibility and messaging across apps. Changes take effect immediately.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

                {/* 1. Maintenance Mode Toggle */}
                <div style={{
                  padding: '1.35rem',
                  borderRadius: '14px',
                  backgroundColor: isMaintenanceMode ? 'rgba(239, 68, 68, 0.06)' : 'var(--bg-main)',
                  border: `1.5px solid ${isMaintenanceMode ? '#ef4444' : 'var(--border)'}`,
                  transition: 'all 0.2s ease',
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '1rem',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', maxWidth: '78%' }}>
                      <div style={{
                        width: 46,
                        height: 46,
                        borderRadius: '12px',
                        backgroundColor: isMaintenanceMode ? 'rgba(239, 68, 68, 0.18)' : 'rgba(148, 163, 184, 0.15)',
                        color: isMaintenanceMode ? '#dc2626' : '#64748b',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}>
                        <Wrench size={24} />
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 800, fontSize: '1.02rem', color: isMaintenanceMode ? '#dc2626' : 'var(--text-primary)' }}>
                            System Under Maintenance Mode
                          </span>
                          <span style={{
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            padding: '0.2rem 0.6rem',
                            borderRadius: '999px',
                            backgroundColor: isMaintenanceMode ? '#ef4444' : '#10b981',
                            color: '#ffffff',
                            letterSpacing: '0.04em',
                          }}>
                            {isMaintenanceMode ? 'MAINTENANCE ACTIVE' : 'LIVE / OPERATIONAL'}
                          </span>
                        </div>
                        <p style={{ margin: '0.3rem 0 0 0', fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                          When enabled, all Manager, Driver, and Customer Self-Ordering apps are paused with a maintenance screen. Only Owner/Admin accounts have access.
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={!isOwner}
                      onClick={() => setIsMaintenanceMode(!isMaintenanceMode)}
                      aria-label="Toggle Maintenance Mode"
                      style={{
                        width: 58,
                        height: 32,
                        borderRadius: 16,
                        backgroundColor: isMaintenanceMode ? '#ef4444' : '#cbd5e1',
                        border: 'none',
                        cursor: isOwner ? 'pointer' : 'not-allowed',
                        position: 'relative',
                        transition: 'background-color 0.2s ease',
                        flexShrink: 0,
                        outline: 'none',
                      }}
                    >
                      <div style={{
                        width: 26,
                        height: 26,
                        borderRadius: '50%',
                        backgroundColor: '#ffffff',
                        position: 'absolute',
                        top: 3,
                        left: isMaintenanceMode ? 29 : 3,
                        transition: 'left 0.2s ease',
                        boxShadow: '0 2px 5px rgba(0,0,0,0.25)',
                      }} />
                    </button>
                  </div>

                  {/* Maintenance Notice Message Textarea */}
                  {isMaintenanceMode && (
                    <div style={{
                      marginTop: '1.25rem',
                      paddingTop: '1.1rem',
                      borderTop: '1px solid rgba(239, 68, 68, 0.25)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#b91c1c', fontSize: '0.86rem', fontWeight: 800 }}>
                        <AlertTriangle size={16} />
                        <span>Staff & Customer Maintenance Notice</span>
                      </div>
                      <textarea
                        disabled={!isOwner}
                        className="form-textarea"
                        rows={2}
                        value={maintenanceMessage}
                        onChange={(e) => setMaintenanceMessage(e.target.value)}
                        placeholder="e.g. System is currently undergoing scheduled maintenance. Please check back shortly."
                        style={{
                          width: '100%',
                          fontSize: '0.88rem',
                          borderColor: '#fca5a5',
                          backgroundColor: '#ffffff',
                          color: '#0f172a',
                          padding: '0.75rem',
                          borderRadius: '8px',
                        }}
                      />
                      <small style={{ color: '#b91c1c', fontSize: '0.76rem' }}>
                        This custom message is displayed on all customer links and staff dashboards during maintenance.
                      </small>
                    </div>
                  )}
                </div>

                {/* 2. WhatsApp Integration Toggle & Upgrade Plan Lock */}
                {(() => {
                  const isPlanExpired = whatsappPlanExpiresAt
                    ? new Date(whatsappPlanExpiresAt).getTime() < Date.now()
                    : false;
                  const isFeatureLocked = whatsappIsLocked || isPlanExpired;

                  const getTimeRemainingText = () => {
                    if (!whatsappPlanExpiresAt) {
                      return 'Lifetime License (Permanent Access)';
                    }
                    const ms = new Date(whatsappPlanExpiresAt).getTime() - Date.now();
                    if (ms <= 0) {
                      return `Expired on ${new Date(whatsappPlanExpiresAt).toLocaleDateString()}`;
                    }
                    const days = Math.floor(ms / (1000 * 60 * 60 * 24));
                    const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                    if (days > 0) {
                      return `${days} Day${days === 1 ? '' : 's'} Remaining (Valid until ${new Date(whatsappPlanExpiresAt).toLocaleDateString()})`;
                    }
                    return `${hours} Hour${hours === 1 ? '' : 's'} Remaining (Expires Today)`;
                  };

                  const handleLockFeature = async () => {
                    if (!window.confirm('Are you sure you want to lock WhatsApp Quick Sharing & Messaging? WhatsApp features will be disabled until unlocked with an upgrade key.')) {
                      return;
                    }
                    try {
                      setSaving(true);
                      await updateSettings({
                        whatsapp_is_locked: true,
                        is_whatsapp_enabled: false,
                      });
                      setWhatsappIsLocked(true);
                      setIsWhatsappEnabled(false);
                      setFeedback({
                        type: 'success',
                        message: 'WhatsApp Quick Sharing is now locked. An upgrade key is required to re-enable it.',
                      });
                    } catch (err: any) {
                      setFeedback({ type: 'error', message: err.message || 'Failed to lock feature.' });
                    } finally {
                      setSaving(false);
                    }
                  };

                  return (
                    <div style={{
                      padding: '1.35rem',
                      borderRadius: '14px',
                      backgroundColor: 'var(--bg-main)',
                      border: isFeatureLocked ? '1.5px solid #fca5a5' : '1px solid var(--border)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '1rem',
                      transition: 'all 0.2s ease',
                      boxShadow: isFeatureLocked ? '0 2px 10px rgba(239, 68, 68, 0.08)' : 'none',
                    }}>
                      {/* Top Header Row */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '1rem',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', maxWidth: '78%' }}>
                          <div style={{
                            width: 48,
                            height: 48,
                            borderRadius: '12px',
                            backgroundColor: isFeatureLocked
                              ? 'rgba(239, 68, 68, 0.12)'
                              : isWhatsappEnabled
                              ? 'rgba(34, 197, 94, 0.15)'
                              : 'rgba(148, 163, 175, 0.15)',
                            color: isFeatureLocked ? '#dc2626' : isWhatsappEnabled ? '#16a34a' : '#64748b',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            position: 'relative',
                          }}>
                            <MessageCircle size={24} />
                            {isFeatureLocked && (
                              <div style={{
                                position: 'absolute',
                                bottom: -3,
                                right: -3,
                                background: '#dc2626',
                                color: '#fff',
                                borderRadius: '50%',
                                width: 18,
                                height: 18,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                              }}>
                                <Lock size={10} />
                              </div>
                            )}
                          </div>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                              <span style={{ fontWeight: 800, fontSize: '1.02rem', color: 'var(--text-primary)' }}>
                                WhatsApp Quick Sharing & Messaging
                              </span>

                              {/* Lock / Plan Badge */}
                              {isFeatureLocked ? (
                                <span style={{
                                  fontSize: '0.72rem',
                                  fontWeight: 800,
                                  padding: '0.2rem 0.6rem',
                                  borderRadius: '999px',
                                  backgroundColor: '#fee2e2',
                                  color: '#b91c1c',
                                  border: '1px solid #fca5a5',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                }}>
                                  <Lock size={11} />
                                  {isPlanExpired ? 'PLAN EXPIRED' : 'LOCKED - UPGRADE REQUIRED'}
                                </span>
                              ) : (
                                <span style={{
                                  fontSize: '0.72rem',
                                  fontWeight: 800,
                                  padding: '0.2rem 0.6rem',
                                  borderRadius: '999px',
                                  backgroundColor: '#ecfdf5',
                                  color: '#047857',
                                  border: '1px solid #a7f3d0',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                }}>
                                  <ShieldCheck size={12} />
                                  {whatsappPlanName.toUpperCase()}
                                </span>
                              )}

                              {/* Toggle Status Badge */}
                              <span style={{
                                fontSize: '0.72rem',
                                fontWeight: 800,
                                padding: '0.2rem 0.6rem',
                                borderRadius: '999px',
                                backgroundColor: (!isFeatureLocked && isWhatsappEnabled) ? '#16a34a' : '#94a3b8',
                                color: '#ffffff',
                                letterSpacing: '0.04em',
                              }}>
                                {!isFeatureLocked && isWhatsappEnabled ? 'ENABLED' : 'DISABLED'}
                              </span>
                            </div>
                            <p style={{ margin: '0.3rem 0 0 0', fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                              When enabled, invoices, receipts, and order dispatches can be shared directly via WhatsApp. Requires an active plan key.
                            </p>
                          </div>
                        </div>

                        {/* Toggle Switch */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <button
                            type="button"
                            disabled={!isOwner}
                            onClick={() => {
                              if (isFeatureLocked) {
                                setIsUpgradeModalOpen(true);
                                return;
                              }
                              setIsWhatsappEnabled(!isWhatsappEnabled);
                            }}
                            aria-label="Toggle WhatsApp"
                            style={{
                              width: 58,
                              height: 32,
                              borderRadius: 16,
                              backgroundColor: (!isFeatureLocked && isWhatsappEnabled) ? '#16a34a' : '#cbd5e1',
                              border: 'none',
                              cursor: !isOwner ? 'not-allowed' : 'pointer',
                              position: 'relative',
                              transition: 'background-color 0.2s ease',
                              flexShrink: 0,
                              outline: 'none',
                              opacity: isFeatureLocked ? 0.65 : 1,
                            }}
                            title={isFeatureLocked ? 'Feature is locked. Click to enter upgrade key.' : 'Toggle WhatsApp integration'}
                          >
                            <div style={{
                              width: 26,
                              height: 26,
                              borderRadius: '50%',
                              backgroundColor: '#ffffff',
                              position: 'absolute',
                              top: 3,
                              left: (!isFeatureLocked && isWhatsappEnabled) ? 29 : 3,
                              transition: 'left 0.2s ease',
                              boxShadow: '0 2px 5px rgba(0,0,0,0.25)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}>
                              {isFeatureLocked && <Lock size={12} color="#dc2626" />}
                            </div>
                          </button>
                        </div>
                      </div>

                      {/* Plan Time & License Key Bar */}
                      <div style={{
                        marginTop: '0.25rem',
                        padding: '0.85rem 1rem',
                        borderRadius: '10px',
                        backgroundColor: isFeatureLocked ? 'rgba(254, 242, 242, 0.7)' : 'rgba(240, 253, 244, 0.7)',
                        border: isFeatureLocked ? '1px solid #fecaca' : '1px solid #bbf7d0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '0.75rem',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap' }}>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            fontSize: '0.84rem',
                            fontWeight: 700,
                            color: isFeatureLocked ? '#991b1b' : '#166534',
                          }}>
                            <Clock size={16} />
                            <span>Plan Time: {getTimeRemainingText()}</span>
                          </div>
                          {whatsappLicenseKey && (
                            <div style={{
                              fontSize: '0.75rem',
                              fontFamily: 'monospace',
                              background: 'rgba(0,0,0,0.06)',
                              padding: '0.15rem 0.5rem',
                              borderRadius: '5px',
                              color: 'var(--text-secondary)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}>
                              <Key size={12} />
                              <span>Key: {whatsappLicenseKey.slice(0, 6)}••••{whatsappLicenseKey.slice(-4)}</span>
                            </div>
                          )}
                        </div>

                        {/* Action Buttons: Upgrade Plan Key & Lock */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <button
                            type="button"
                            onClick={() => {
                              setIsUpgradeModalOpen(true);
                              setKeyError(null);
                            }}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              padding: '0.35rem 0.85rem',
                              fontSize: '0.8rem',
                              fontWeight: 700,
                              borderRadius: '7px',
                              background: isFeatureLocked ? '#dc2626' : '#059669',
                              color: '#ffffff',
                              border: 'none',
                              cursor: 'pointer',
                              boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            <Key size={13} />
                            <span>{isFeatureLocked ? 'Upgrade Plan with Key' : 'Extend / Upgrade Plan'}</span>
                          </button>

                          {!isFeatureLocked && (
                            <button
                              type="button"
                              onClick={handleLockFeature}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.35rem',
                                padding: '0.35rem 0.75rem',
                                fontSize: '0.78rem',
                                fontWeight: 600,
                                borderRadius: '7px',
                                background: 'transparent',
                                color: '#64748b',
                                border: '1px solid var(--border)',
                                cursor: 'pointer',
                              }}
                              title="Lock WhatsApp feature pending future upgrade key"
                            >
                              <Lock size={12} />
                              <span>Lock</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* 2b. WhatsApp Laptop Bridge (Free Auto-Send PDF/Image Bills) */}
                <div
                  style={{
                    padding: '1.35rem',
                    borderRadius: '14px',
                    backgroundColor: 'var(--bg-main)',
                    border: '1px solid var(--border)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '1rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: '12px',
                          backgroundColor: bridgeStatus?.connected
                            ? 'rgba(34, 197, 94, 0.15)'
                            : 'rgba(234, 179, 8, 0.15)',
                          color: bridgeStatus?.connected ? '#16a34a' : '#ca8a04',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <MessageCircle size={24} />
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>
                            WhatsApp Laptop Bridge (Free PDF / Image Auto-Send)
                          </h4>
                          <span
                            style={{
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: '12px',
                              backgroundColor: bridgeStatus?.connected ? '#dcfce7' : '#fef9c3',
                              color: bridgeStatus?.connected ? '#15803d' : '#854d0e',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                            }}
                          >
                            <span
                              style={{
                                width: 6,
                                height: 6,
                                borderRadius: '50%',
                                backgroundColor: bridgeStatus?.connected ? '#22c55e' : '#eab308',
                              }}
                            />
                            {bridgeStatus?.connected
                              ? `Linked & Active (${bridgeStatus.info?.phone || 'Ready'})`
                              : bridgeStatus?.hasQr
                              ? 'Scan QR to Link'
                              : 'Service Offline'}
                          </span>
                        </div>
                        <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                          Sends real PDF and Image invoices directly into customer WhatsApp chats without Meta API fees.
                        </p>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => window.open(getWhatsAppBridgeQrUrl(), '_blank')}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          padding: '0.45rem 0.85rem',
                          fontSize: '0.82rem',
                          fontWeight: 700,
                          borderRadius: '8px',
                          backgroundColor: '#16a34a',
                          color: '#ffffff',
                          border: 'none',
                          cursor: 'pointer',
                        }}
                      >
                        <QrCode size={15} />
                        <span>Link WhatsApp (Scan QR)</span>
                      </button>

                      <button
                        type="button"
                        disabled={checkingBridge}
                        onClick={refreshBridgeStatus}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          padding: '0.45rem 0.85rem',
                          fontSize: '0.82rem',
                          fontWeight: 600,
                          borderRadius: '8px',
                          backgroundColor: 'var(--bg-card)',
                          color: 'var(--text-main)',
                          border: '1px solid var(--border)',
                          cursor: checkingBridge ? 'wait' : 'pointer',
                        }}
                      >
                        <RotateCcw size={14} className={checkingBridge ? 'animate-spin' : ''} />
                        <span>Refresh Status</span>
                      </button>
                    </div>
                  </div>

                  {/* Bridge URL & Client PC Configuration Bar */}
                  <div
                    style={{
                      padding: '0.65rem 0.9rem',
                      borderRadius: '8px',
                      backgroundColor: 'var(--bg-main)',
                      border: '1px solid var(--border)',
                      fontSize: '0.8rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '0.5rem',
                    }}
                  >
                    {!isEditingBridgeUrl ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Bridge URL:</span>
                        <code style={{ fontWeight: 700, color: 'var(--text-main)', backgroundColor: 'var(--bg-card)', padding: '2px 6px', borderRadius: '4px' }}>
                          {bridgeUrl}
                        </code>
                        <button
                          type="button"
                          onClick={() => {
                            setCustomBridgeUrlInput(bridgeUrl);
                            setIsEditingBridgeUrl(true);
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#2563eb',
                            fontWeight: 600,
                            cursor: 'pointer',
                            fontSize: '0.78rem',
                            padding: '0 4px',
                            textDecoration: 'underline',
                          }}
                        >
                          Change
                        </button>
                      </div>
                    ) : (
                      <form
                        onSubmit={handleSaveBridgeUrl}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', width: '100%' }}
                      >
                        <span style={{ color: 'var(--text-muted)' }}>Bridge URL:</span>
                        <input
                          type="text"
                          value={customBridgeUrlInput}
                          onChange={(e) => setCustomBridgeUrlInput(e.target.value)}
                          placeholder="e.g. http://192.168.1.100:3005"
                          style={{
                            padding: '0.25rem 0.5rem',
                            fontSize: '0.8rem',
                            borderRadius: '6px',
                            border: '1px solid var(--border)',
                            backgroundColor: 'var(--bg-card)',
                            color: 'var(--text-main)',
                            minWidth: '240px',
                          }}
                        />
                        <button
                          type="submit"
                          style={{
                            padding: '0.25rem 0.6rem',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            borderRadius: '6px',
                            backgroundColor: '#2563eb',
                            color: '#fff',
                            border: 'none',
                            cursor: 'pointer',
                          }}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={handleResetBridgeUrl}
                          style={{
                            padding: '0.25rem 0.6rem',
                            fontSize: '0.78rem',
                            borderRadius: '6px',
                            backgroundColor: 'var(--bg-card)',
                            color: 'var(--text-muted)',
                            border: '1px solid var(--border)',
                            cursor: 'pointer',
                          }}
                        >
                          Auto-Detect
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsEditingBridgeUrl(false)}
                          style={{
                            padding: '0.25rem 0.6rem',
                            fontSize: '0.78rem',
                            borderRadius: '6px',
                            backgroundColor: 'transparent',
                            color: 'var(--text-muted)',
                            border: 'none',
                            cursor: 'pointer',
                          }}
                        >
                          Cancel
                        </button>
                      </form>
                    )}

                    <button
                      type="button"
                      onClick={() => window.open(getWhatsAppBridgeQrUrl(), '_blank')}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#2563eb',
                        fontWeight: 700,
                        cursor: 'pointer',
                        padding: 0,
                        fontSize: '0.8rem',
                        textDecoration: 'underline',
                      }}
                    >
                      Open QR Code &rarr;
                    </button>
                  </div>

                  {!bridgeStatus?.connected && (
                    <div
                      style={{
                        padding: '0.75rem 1rem',
                        borderRadius: '8px',
                        backgroundColor: 'rgba(234, 179, 8, 0.08)',
                        border: '1px solid rgba(234, 179, 8, 0.3)',
                        fontSize: '0.8rem',
                        color: 'var(--text-main)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.4rem',
                      }}
                    >
                      <div>
                        💡 <b>On Main Server PC:</b> Run <code>start_whatsapp_bridge.bat</code> (Windows) or <code>./start_whatsapp_bridge_mac.sh</code> (Mac) to start the bridge.
                      </div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', lineHeight: '1.4' }}>
                        🌐 <b>On Client PC:</b> The WhatsApp Bridge runs on the main Server PC. Ensure the Server PC has <code>start_whatsapp_bridge.bat</code> active, port 3005 is allowed in Windows Firewall, and the Bridge URL above points to the Server PC's IP address.
                      </div>
                    </div>
                  )}
                </div>

                {/* 3. Customer Self-Ordering Toggle */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '1.35rem',
                  borderRadius: '14px',
                  backgroundColor: 'var(--bg-main)',
                  border: '1px solid var(--border)',
                  flexWrap: 'wrap',
                  gap: '1rem',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', maxWidth: '78%' }}>
                    <div style={{
                      width: 46,
                      height: 46,
                      borderRadius: '12px',
                      backgroundColor: isSelfOrderEnabled ? 'rgba(59, 130, 246, 0.15)' : 'rgba(148, 163, 175, 0.15)',
                      color: isSelfOrderEnabled ? '#2563eb' : '#64748b',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <ShoppingCart size={24} />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 800, fontSize: '1.02rem', color: 'var(--text-primary)' }}>
                          Customer Self-Ordering Portal
                        </span>
                        <span style={{
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          padding: '0.2rem 0.6rem',
                          borderRadius: '999px',
                          backgroundColor: isSelfOrderEnabled ? '#2563eb' : '#94a3b8',
                          color: '#ffffff',
                          letterSpacing: '0.04em',
                        }}>
                          {isSelfOrderEnabled ? 'ORDERING ACTIVE' : 'ORDERING PAUSED'}
                        </span>
                      </div>
                      <p style={{ margin: '0.3rem 0 0 0', fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                        Allows shops to submit orders using their digital catalog link. When turned off, visiting customers see a paused notice with your phone number.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={!isOwner}
                    onClick={() => setIsSelfOrderEnabled(!isSelfOrderEnabled)}
                    aria-label="Toggle Self Ordering"
                    style={{
                      width: 58,
                      height: 32,
                      borderRadius: 16,
                      backgroundColor: isSelfOrderEnabled ? '#2563eb' : '#cbd5e1',
                      border: 'none',
                      cursor: isOwner ? 'pointer' : 'not-allowed',
                      position: 'relative',
                      transition: 'background-color 0.2s ease',
                      flexShrink: 0,
                      outline: 'none',
                    }}
                  >
                    <div style={{
                      width: 26,
                      height: 26,
                      borderRadius: '50%',
                      backgroundColor: '#ffffff',
                      position: 'absolute',
                      top: 3,
                      left: isSelfOrderEnabled ? 29 : 3,
                      transition: 'left 0.2s ease',
                      boxShadow: '0 2px 5px rgba(0,0,0,0.25)',
                    }} />
                  </button>
                </div>

                {/* FAST WHOLESALE ORDER ENTRY DISCOUNT (₹) COLUMN TOGGLE */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '1.35rem',
                  borderRadius: '14px',
                  backgroundColor: 'var(--bg-main)',
                  border: '1px solid var(--border)',
                  flexWrap: 'wrap',
                  gap: '1rem',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', maxWidth: '78%' }}>
                    <div style={{
                      width: 46,
                      height: 46,
                      borderRadius: '12px',
                      backgroundColor: isOrderDiscountEnabled ? 'rgba(16, 185, 129, 0.15)' : 'rgba(148, 163, 175, 0.15)',
                      color: isOrderDiscountEnabled ? '#10b981' : '#64748b',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <Percent size={24} />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 800, fontSize: '1.02rem', color: 'var(--text-primary)' }}>
                          Wholesale Order Discount Column (Disc ₹)
                        </span>
                        <span style={{
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          padding: '0.2rem 0.6rem',
                          borderRadius: '999px',
                          backgroundColor: isOrderDiscountEnabled ? '#10b981' : '#94a3b8',
                          color: '#ffffff',
                          letterSpacing: '0.04em',
                        }}>
                          {isOrderDiscountEnabled ? 'DISCOUNT COLUMN VISIBLE' : 'DISCOUNT COLUMN HIDDEN'}
                        </span>
                      </div>
                      <p style={{ margin: '0.3rem 0 0 0', fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                        Enable or hide the 'Disc (₹)' column in the Fast Wholesale Order Entry grid. Turn OFF to simplify data entry when discounts are not offered.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={!isOwner}
                    onClick={() => setIsOrderDiscountEnabled(!isOrderDiscountEnabled)}
                    aria-label="Toggle Wholesale Order Discount Column"
                    style={{
                      width: 58,
                      height: 32,
                      borderRadius: 16,
                      backgroundColor: isOrderDiscountEnabled ? '#10b981' : '#cbd5e1',
                      border: 'none',
                      cursor: isOwner ? 'pointer' : 'not-allowed',
                      position: 'relative',
                      transition: 'background-color 0.2s ease',
                      flexShrink: 0,
                      outline: 'none',
                    }}
                  >
                    <div style={{
                      width: 26,
                      height: 26,
                      borderRadius: '50%',
                      backgroundColor: '#ffffff',
                      position: 'absolute',
                      top: 3,
                      left: isOrderDiscountEnabled ? 29 : 3,
                      transition: 'left 0.2s ease',
                      boxShadow: '0 2px 5px rgba(0,0,0,0.25)',
                    }} />
                  </button>
                </div>

                {/* 5. DELIVERY DRIVER PORTAL & WORKFLOW MASTER SWITCH */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '1.35rem',
                  borderRadius: '14px',
                  backgroundColor: 'var(--bg-main)',
                  border: `1.5px solid ${isDriverModuleEnabled ? 'rgba(37, 99, 235, 0.3)' : 'var(--border)'}`,
                  flexWrap: 'wrap',
                  gap: '1rem',
                  transition: 'all 0.2s ease',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', maxWidth: '78%' }}>
                    <div style={{
                      width: 46,
                      height: 46,
                      borderRadius: '12px',
                      backgroundColor: isDriverModuleEnabled ? 'rgba(37, 99, 235, 0.15)' : 'rgba(148, 163, 175, 0.15)',
                      color: isDriverModuleEnabled ? '#2563eb' : '#64748b',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <Truck size={24} />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 800, fontSize: '1.02rem', color: 'var(--text-primary)' }}>
                          Delivery Driver Portal & Workflow
                        </span>
                        <span style={{
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          padding: '0.2rem 0.6rem',
                          borderRadius: '999px',
                          backgroundColor: isDriverModuleEnabled ? '#2563eb' : '#94a3b8',
                          color: '#ffffff',
                          letterSpacing: '0.04em',
                        }}>
                          {isDriverModuleEnabled ? 'FULL DRIVER PORTION ON' : 'DRIVER PORTION TURNED OFF'}
                        </span>
                      </div>
                      <p style={{ margin: '0.3rem 0 0 0', fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                        Master switch to turn ON or OFF the entire Delivery Driver portion across the system, including Staff Drivers, Deliveries Board, Driver Mobile App, and Driver Performance tracking.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={!isOwner}
                    onClick={() => setIsDriverModuleEnabled(!isDriverModuleEnabled)}
                    aria-label="Toggle Delivery Driver Portal"
                    style={{
                      width: 58,
                      height: 32,
                      borderRadius: 16,
                      backgroundColor: isDriverModuleEnabled ? '#2563eb' : '#cbd5e1',
                      border: 'none',
                      cursor: isOwner ? 'pointer' : 'not-allowed',
                      position: 'relative',
                      transition: 'background-color 0.2s ease',
                      flexShrink: 0,
                      outline: 'none',
                    }}
                  >
                    <div style={{
                      width: 26,
                      height: 26,
                      borderRadius: '50%',
                      backgroundColor: '#ffffff',
                      position: 'absolute',
                      top: 3,
                      left: isDriverModuleEnabled ? 29 : 3,
                      transition: 'left 0.2s ease',
                      boxShadow: '0 2px 5px rgba(0,0,0,0.25)',
                    }} />
                  </button>
                </div>

                {/* 6. Settings Security PIN Management */}
                <div style={{
                  padding: '1.35rem',
                  borderRadius: '14px',
                  backgroundColor: 'rgba(245, 158, 11, 0.05)',
                  border: '1.5px solid #f59e0b',
                  transition: 'all 0.2s ease',
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '1rem',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', maxWidth: '75%' }}>
                      <div style={{
                        width: 44,
                        height: 44,
                        borderRadius: '12px',
                        backgroundColor: '#fef3c7',
                        color: '#b45309',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}>
                        <Key size={22} />
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                          <h3 style={{ margin: 0, fontSize: '1.02rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                            Settings Access 4-Digit Security PIN
                          </h3>
                          <span style={{
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            padding: '0.15rem 0.5rem',
                            borderRadius: '6px',
                            background: '#fef3c7',
                            color: '#92400e',
                            border: '1px solid #fde68a',
                            fontFamily: 'monospace',
                            letterSpacing: '0.1em',
                          }}>
                            PIN: {settingsPinCode}
                          </span>
                        </div>
                        <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                          4-digit PIN code required to open Business Settings &amp; System Controls. Can be reset anytime by entering Admin username &amp; password.
                        </p>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      {isEditingPinInPage ? (
                        <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                          <input
                            type="text"
                            maxLength={4}
                            className="form-control"
                            value={inPagePinInput}
                            onChange={(e) => setInPagePinInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                            placeholder="4 digits"
                            style={{ width: '85px', textAlign: 'center', fontWeight: 800, letterSpacing: '0.2em', height: '34px' }}
                          />
                          <button
                            type="button"
                            className="btn btn-sm btn-primary"
                            onClick={() => {
                              if (inPagePinInput.length === 4) {
                                setSettingsPinCode(inPagePinInput);
                                setIsEditingPinInPage(false);
                                setInPagePinInput('');
                                setFeedback({ type: 'success', message: `PIN updated to ${inPagePinInput}. Remember to click Save Changes!` });
                              }
                            }}
                            disabled={inPagePinInput.length !== 4}
                            style={{ height: '34px' }}
                          >
                            Apply
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-secondary"
                            onClick={() => { setIsEditingPinInPage(false); setInPagePinInput(''); }}
                            style={{ height: '34px' }}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => {
                              setInPagePinInput(settingsPinCode || '7667');
                              setIsEditingPinInPage(true);
                            }}
                            style={{ fontWeight: 700, fontSize: '0.78rem' }}
                          >
                            Change PIN
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => setShowPinResetModal(true)}
                            style={{ fontWeight: 700, fontSize: '0.78rem', color: '#b45309' }}
                          >
                            Admin Reset
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* SECTION: SCREEN DISPLAY, ZOOM LEVEL & RESOLUTION */}
            <div style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: '16px',
              padding: '1.75rem',
              boxShadow: 'var(--shadow-sm)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <div style={{
                    width: 32,
                    height: 32,
                    borderRadius: '8px',
                    backgroundColor: 'rgba(37, 99, 235, 0.1)',
                    color: '#2563eb',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Monitor size={18} />
                  </div>
                  <div>
                    <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                      Screen Display, Zoom &amp; Resolution
                    </h2>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{
                    background: '#eff6ff',
                    color: '#1d4ed8',
                    border: '1px solid #bfdbfe',
                    borderRadius: '6px',
                    padding: '0.2rem 0.6rem',
                    fontSize: '0.75rem',
                    fontWeight: 800,
                  }}>
                    Active Zoom: {zoomLevel}%
                  </span>
                  <button
                    type="button"
                    onClick={() => setZoomLevel(100)}
                    style={{
                      background: 'none',
                      border: '1px solid var(--border)',
                      borderRadius: '6px',
                      padding: '0.2rem 0.55rem',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                    }}
                    title="Reset zoom to default 100%"
                  >
                    Reset (100%)
                  </button>
                </div>
              </div>
              <p style={{ margin: '0 0 1.25rem 0', fontSize: '0.86rem', color: 'var(--text-secondary)' }}>
                Scale the user interface and adapt the application to your monitor size, laptop display, or projector.
              </p>

              {/* Live Display & Screen Metrics Cards */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
                gap: '0.75rem',
                marginBottom: '1.25rem',
              }}>
                {/* Window Dimensions */}
                <div style={{
                  background: 'var(--bg-main)',
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                  padding: '0.75rem 1rem',
                }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', display: 'block' }}>
                    Current Window Size
                  </span>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.15rem' }}>
                    {windowDimensions.width} × {windowDimensions.height} <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)' }}>px</span>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#16a34a', fontWeight: 600, marginTop: '0.1rem' }}>
                    ● Active Viewport
                  </div>
                </div>

                {/* Monitor Screen Resolution */}
                <div style={{
                  background: 'var(--bg-main)',
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                  padding: '0.75rem 1rem',
                }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', display: 'block' }}>
                    Monitor Display
                  </span>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.15rem' }}>
                    {windowDimensions.screenWidth} × {windowDimensions.screenHeight} <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)' }}>px</span>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                    Native Hardware Screen
                  </div>
                </div>

                {/* Pixel Density & Retina */}
                <div style={{
                  background: 'var(--bg-main)',
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                  padding: '0.75rem 1rem',
                }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', display: 'block' }}>
                    Display Pixel Density
                  </span>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.15rem' }}>
                    {windowDimensions.pixelRatio}x <span style={{ fontSize: '0.75rem', fontWeight: 700, color: windowDimensions.pixelRatio > 1 ? '#7c3aed' : 'var(--text-muted)' }}>
                      {windowDimensions.pixelRatio > 1 ? 'Retina / HiDPI' : 'Standard DPI'}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                    Hardware Scale Factor
                  </div>
                </div>

                {/* Active Zoom Scale */}
                <div style={{
                  background: 'var(--bg-main)',
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                  padding: '0.75rem 1rem',
                }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', display: 'block' }}>
                    Current Zoom Scale
                  </span>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#2563eb', marginTop: '0.15rem' }}>
                    {zoomLevel}%
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                    {zoomLevel < 100 ? 'Compact View' : zoomLevel > 100 ? 'Enlarged View' : 'Default Standard'}
                  </div>
                </div>
              </div>

              {/* Zoom Controls & Slider */}
              <div style={{
                background: 'var(--bg-main)',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                padding: '1.25rem',
                marginBottom: '1.25rem',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div>
                    <label style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                      Interface Zoom Level ({zoomLevel}%)
                    </label>
                    <span style={{ display: 'block', fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                      Adjusts text size, table row density, and button proportions across the entire software immediately.
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <button
                      type="button"
                      onClick={() => setZoomLevel(Math.max(50, zoomLevel - 5))}
                      className="btn btn-secondary btn-sm"
                      style={{ height: '30px', padding: '0 0.65rem', fontWeight: 800, fontSize: '0.8rem' }}
                      title="Zoom out by 5%"
                    >
                      <ZoomOut size={13} style={{ marginRight: '3px' }} /> - 5%
                    </button>
                    <button
                      type="button"
                      onClick={() => setZoomLevel(Math.min(200, zoomLevel + 5))}
                      className="btn btn-secondary btn-sm"
                      style={{ height: '30px', padding: '0 0.65rem', fontWeight: 800, fontSize: '0.8rem' }}
                      title="Zoom in by 5%"
                    >
                      <ZoomIn size={13} style={{ marginRight: '3px' }} /> + 5%
                    </button>
                  </div>
                </div>

                {/* Slider */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>70%</span>
                  <input
                    type="range"
                    min={70}
                    max={150}
                    step={5}
                    value={zoomLevel}
                    onChange={(e) => setZoomLevel(Number(e.target.value))}
                    style={{
                      flex: 1,
                      accentColor: '#b91c1c',
                      cursor: 'pointer',
                      height: '6px',
                    }}
                  />
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>150%</span>
                </div>

                {/* Quick Presets Buttons */}
                <div>
                  <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.45rem', textTransform: 'uppercase' }}>
                    Quick Scaling Presets
                  </span>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {[
                      { label: '75% Compact', val: 75, desc: 'Maximum screen space (fit 25+ order rows)' },
                      { label: '80% Small Laptop', val: 80, desc: 'Ideal for 13" MacBook / small laptops' },
                      { label: '85% Balanced', val: 85, desc: 'Recommended for 1440x900 resolution' },
                      { label: '90% Clean Density', val: 90, desc: 'Sharp text with high data density' },
                      { label: '100% Standard (1:1)', val: 100, desc: 'Default system scale' },
                      { label: '110% Comfortable', val: 110, desc: 'Easier reading on high-res monitors' },
                      { label: '120% Large Display', val: 120, desc: 'Large font and button sizes' },
                    ].map((preset) => {
                      const isActive = zoomLevel === preset.val;
                      return (
                        <button
                          key={preset.val}
                          type="button"
                          onClick={() => setZoomLevel(preset.val)}
                          style={{
                            padding: '0.45rem 0.75rem',
                            borderRadius: '8px',
                            border: isActive ? '2px solid #b91c1c' : '1px solid var(--border)',
                            background: isActive ? '#fef2f2' : 'var(--bg-card)',
                            color: isActive ? '#991b1b' : 'var(--text-primary)',
                            fontWeight: isActive ? 800 : 600,
                            fontSize: '0.78rem',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '2px',
                            transition: 'all 0.15s ease',
                          }}
                          title={preset.desc}
                        >
                          <span>{preset.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Screen Size & Window Presets */}
              <div style={{
                background: 'var(--bg-main)',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                padding: '1.25rem',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div>
                    <label style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                      Screen &amp; Window Size Presets
                    </label>
                    <span style={{ display: 'block', fontSize: '0.76rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                      Select standard screen size dimensions for multi-monitor setups or toggle fullscreen mode.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleToggleFullscreen}
                    className="btn btn-secondary btn-sm"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      height: '32px',
                      padding: '0 0.75rem',
                      fontWeight: 700,
                      fontSize: '0.78rem',
                    }}
                  >
                    <Maximize size={14} />
                    <span>Toggle Fullscreen</span>
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.65rem' }}>
                  {[
                    { name: 'MacBook Standard', w: 1440, h: 900, rec: '85% – 100% Zoom', icon: '💻' },
                    { name: 'Full HD Desktop', w: 1920, h: 1080, rec: '100% – 110% Zoom', icon: '🖥️' },
                    { name: 'Compact Laptop', w: 1280, h: 800, rec: '75% – 85% Zoom', icon: '💻' },
                    { name: 'Wide Workstation', w: 1600, h: 1000, rec: '90% – 100% Zoom', icon: '🖥️' },
                  ].map((res) => {
                    const isCurrent = Math.abs(windowDimensions.width - res.w) < 40 && Math.abs(windowDimensions.height - res.h) < 40;
                    return (
                      <div
                        key={res.name}
                        style={{
                          padding: '0.75rem 0.85rem',
                          borderRadius: '8px',
                          border: isCurrent ? '2px solid #2563eb' : '1px solid var(--border)',
                          background: isCurrent ? '#eff6ff' : 'var(--bg-card)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.25rem',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontWeight: 800, fontSize: '0.82rem', color: isCurrent ? '#1d4ed8' : 'var(--text-primary)' }}>
                            {res.icon} {res.name}
                          </span>
                          {isCurrent && (
                            <span style={{ fontSize: '0.62rem', fontWeight: 800, background: '#dbeafe', color: '#1e40af', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                              Current
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '0.02em' }}>
                          {res.w} × {res.h} px
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          Recommended: {res.rec}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleApplyScreenSize(res.w, res.h)}
                          style={{
                            marginTop: '0.35rem',
                            padding: '0.3rem 0.55rem',
                            borderRadius: '5px',
                            border: '1px solid var(--border)',
                            background: 'var(--bg-card)',
                            color: 'var(--text-primary)',
                            fontWeight: 700,
                            fontSize: '0.72rem',
                            cursor: 'pointer',
                          }}
                        >
                          Resize Window ({res.w}×{res.h})
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* SECTION 2: BUSINESS PROFILE & GST INFORMATION */}
            <div style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: '16px',
              padding: '1.75rem',
              boxShadow: 'var(--shadow-sm)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.35rem' }}>
                <div style={{
                  width: 32,
                  height: 32,
                  borderRadius: '8px',
                  backgroundColor: 'rgba(220, 38, 38, 0.1)',
                  color: '#dc2626',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Building size={18} />
                </div>
                <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Business Profile & GST Information
                </h2>
              </div>
              <p style={{ margin: '0 0 1.75rem 0', fontSize: '0.86rem', color: 'var(--text-secondary)' }}>
                Official business details printed on digital tax invoices, customer bills, and receipts.
              </p>

              {/* Form Input Grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))',
                gap: '1.5rem',
              }}>

                {/* GST Number (GSTIN) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                      <Hash size={16} color="#dc2626" />
                      GST Number (GSTIN)
                    </span>
                    <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.5rem', borderRadius: '4px', backgroundColor: 'rgba(220, 38, 38, 0.1)', color: '#dc2626', fontWeight: 700 }}>
                      TAX INVOICE
                    </span>
                  </label>
                  <input
                    type="text"
                    disabled={!isOwner}
                    className="form-input"
                    placeholder="e.g. 32AAAAA0000A1Z5"
                    value={gstNumber}
                    onChange={(e) => setGstNumber(e.target.value.toUpperCase())}
                    maxLength={20}
                    style={{
                      width: '100%',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      fontWeight: 700,
                      fontFamily: 'monospace',
                    }}
                  />
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Info size={13} />
                    Printed in header of all sales invoices & B2B delivery slips.
                  </span>
                </div>

                {/* Official Phone Number */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                    <Phone size={16} color="#dc2626" />
                    Official Phone Number
                  </label>
                  <input
                    type="text"
                    disabled={!isOwner}
                    className="form-input"
                    placeholder="e.g. +91 98470 12345"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    maxLength={25}
                    style={{ width: '100%', fontWeight: 600 }}
                  />
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Info size={13} />
                    Main contact number shown to customers and drivers.
                  </span>
                </div>

                {/* Business Legal Name */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                    <Building size={16} color="#dc2626" />
                    Business Legal Name
                  </label>
                  <input
                    type="text"
                    disabled={!isOwner}
                    className="form-input"
                    placeholder="e.g. Zamzam Foods Wholesale"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    maxLength={150}
                    style={{ width: '100%', fontWeight: 600 }}
                  />
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Info size={13} />
                    Entity name displayed on bills and customer portals.
                  </span>
                </div>

                {/* Official Email */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                    <Mail size={16} color="#dc2626" />
                    Official Email
                  </label>
                  <input
                    type="email"
                    disabled={!isOwner}
                    className="form-input"
                    placeholder="e.g. billing@zamzamfoods.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    maxLength={100}
                    style={{ width: '100%' }}
                  />
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Info size={13} />
                    Contact email for accounting and business queries.
                  </span>
                </div>

                {/* UPI ID / VPA */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                    <CreditCard size={16} color="#dc2626" />
                    Business UPI ID / VPA
                  </label>
                  <input
                    type="text"
                    disabled={!isOwner}
                    className="form-input"
                    placeholder="e.g. zamzamfoods@okaxis"
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                    maxLength={100}
                    style={{ width: '100%', fontWeight: 600 }}
                  />
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Info size={13} />
                    Used for generating UPI QR codes for customer invoices and payments.
                  </span>
                </div>

                {/* Empty placeholder column for balance on wide screens */}
                <div style={{ display: 'none' }} />

                {/* Full Address */}
                <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                    <MapPin size={16} color="#dc2626" />
                    Business / Warehouse Address
                  </label>
                  <textarea
                    disabled={!isOwner}
                    className="form-textarea"
                    rows={2}
                    placeholder="e.g. Main Road, Pandikkad, Malappuram District, Kerala - 676521"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    style={{ width: '100%', minHeight: '84px' }}
                  />
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                    Physical location printed on delivery invoices and tax documents.
                  </span>
                </div>

                {/* Invoice Footer Notes */}
                <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                    <FileText size={16} color="#dc2626" />
                    Invoice Terms & Footer Remarks
                  </label>
                  <textarea
                    disabled={!isOwner}
                    className="form-textarea"
                    rows={2}
                    placeholder="e.g. Thank you for your business. Fresh Kubbus & Romali rotis delivered daily."
                    value={invoiceNotes}
                    onChange={(e) => setInvoiceNotes(e.target.value)}
                    style={{ width: '100%', minHeight: '84px' }}
                  />
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                    Custom note or return policy printed at the bottom of customer receipts.
                  </span>
                </div>

              </div>
            </div>

            {/* STICKY BOTTOM ACTION BAR */}
            {isOwner && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1.25rem 1.75rem',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: '16px',
                position: 'sticky',
                bottom: '1rem',
                boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                zIndex: 20,
                flexWrap: 'wrap',
                gap: '1rem',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.86rem' }}>
                  <Check size={16} color="#16a34a" />
                  <span>All settings are validated and encrypted in master database</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <button
                    type="button"
                    onClick={handleReset}
                    disabled={saving}
                    className="btn btn-secondary"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                      padding: '0.65rem 1.25rem',
                      fontWeight: 600,
                    }}
                  >
                    <RotateCcw size={16} />
                    Reset
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="btn btn-primary"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      minWidth: 160,
                      justifyContent: 'center',
                      padding: '0.65rem 1.5rem',
                      fontWeight: 800,
                      fontSize: '0.94rem',
                    }}
                  >
                    {saving ? (
                      <>
                        <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save size={18} />
                        Save Settings
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </form>
      )}

      {/* TAB 2: DATABASE STORAGE LEVEL & BACKUP DISASTER RECOVERY */}
      {activeTab === 'database' && (
        <React.Suspense fallback={<div style={{ padding: '3rem', textAlign: 'center' }}><div className="spinner" /></div>}>
          <DatabaseStorageBackupSection />
        </React.Suspense>
      )}

      {/* TAB 3: SYSTEM ACTIVITY HISTORY & AUDIT LOG */}
      {activeTab === 'activity' && (
        <React.Suspense fallback={<div style={{ padding: '3rem', textAlign: 'center' }}><div className="spinner" /></div>}>
          <ActivityHistoryPage />
        </React.Suspense>
      )}
    </>
  )}

      {/* WhatsApp Upgrade Plan & License Key Modal */}
      {isUpgradeModalOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !activatingKey) {
              setIsUpgradeModalOpen(false);
              setKeyError(null);
            }
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-card, #ffffff)',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              width: '100%',
              maxWidth: '520px',
              boxShadow: 'var(--shadow-md)',
              overflow: 'hidden',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '1rem 1.25rem',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: '#f8fafc',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: '10px',
                    backgroundColor: '#ecfdf5',
                    color: '#059669',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid #a7f3d0',
                  }}
                >
                  <Key size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    Upgrade WhatsApp Plan with Key
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    Activate time-based license key to unlock messaging
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!activatingKey) {
                    setIsUpgradeModalOpen(false);
                    setKeyError(null);
                  }
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  padding: '4px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Help Desk Context Card for License Activation */}
              <div
                style={{
                  padding: '0.85rem 1rem',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(5, 150, 105, 0.08)',
                  border: '1.5px solid rgba(5, 150, 105, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.75rem',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ flex: '1 1 230px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    <Headphones size={16} color="#dc2626" />
                    <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                      Get Official Plan Key • System Support
                    </span>
                    <span
                      style={{
                        fontSize: '0.62rem',
                        fontWeight: 800,
                        padding: '0.1rem 0.4rem',
                        borderRadius: '4px',
                        backgroundColor: '#fee2e2',
                        color: '#b91c1c',
                        border: '1px solid #fca5a5',
                      }}
                    >
                      Official Support
                    </span>
                  </div>
                  <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.76rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                    To obtain official keys, extend validity, or renew business licenses, contact <strong>System Support</strong> at <strong style={{ color: '#dc2626', fontFamily: 'monospace' }}>7012587705</strong>.
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                  <a
                    href="https://wa.me/917012587705?text=Hello%20Support%2C%20I%20want%20to%20get%20an%20upgrade%20key%20for%20WhatsApp%20Messaging"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      backgroundColor: '#dc2626',
                      color: '#ffffff',
                      textDecoration: 'none',
                      borderRadius: '6px',
                      padding: '0.38rem 0.65rem',
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                    }}
                    title="Request Key on WhatsApp: 7012587705"
                  >
                    <MessageCircle size={13} />
                    <span>WhatsApp (7012587705)</span>
                  </a>

                  <a
                    href="tel:+917012587705"
                    style={{
                      backgroundColor: 'var(--bg-card)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border)',
                      textDecoration: 'none',
                      borderRadius: '6px',
                      padding: '0.38rem 0.65rem',
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                    }}
                    title="Call Help Desk: 7012587705"
                  >
                    <Phone size={13} />
                    <span>Call 7012587705</span>
                  </a>
                </div>
              </div>

              {/* Quick Plan Tiers with 7012587705 context */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.45rem', flexWrap: 'wrap', gap: '0.35rem' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', margin: 0 }}>
                    Available Plan Keys (Click to Auto-fill)
                  </label>
                  <span style={{ fontSize: '0.72rem', color: '#059669', fontWeight: 700 }}>
                    Official Helpline: 7012587705
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.6rem' }}>
                  {/* 30 Days */}
                  <button
                    type="button"
                    onClick={() => {
                      setLicenseKeyInput('ZAMZAM-WA-30D');
                      setKeyError(null);
                    }}
                    style={{
                      padding: '0.75rem 0.6rem',
                      borderRadius: '8px',
                      border: licenseKeyInput === 'ZAMZAM-WA-30D' ? '2px solid #059669' : '1px solid var(--border)',
                      backgroundColor: licenseKeyInput === 'ZAMZAM-WA-30D' ? '#ecfdf5' : 'var(--bg-main)',
                      textAlign: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#047857' }}>30 Days</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '2px' }}>Monthly Pro</div>
                    <code style={{ fontSize: '0.65rem', color: '#059669', display: 'block', marginTop: '4px', fontWeight: 700 }}>WA-30D</code>
                  </button>

                  {/* 365 Days */}
                  <button
                    type="button"
                    onClick={() => {
                      setLicenseKeyInput('ZAMZAM-WA-365D');
                      setKeyError(null);
                    }}
                    style={{
                      padding: '0.75rem 0.6rem',
                      borderRadius: '8px',
                      border: licenseKeyInput === 'ZAMZAM-WA-365D' ? '2px solid #059669' : '1px solid var(--border)',
                      backgroundColor: licenseKeyInput === 'ZAMZAM-WA-365D' ? '#ecfdf5' : 'var(--bg-main)',
                      textAlign: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#047857' }}>365 Days</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '2px' }}>Annual Pro</div>
                    <code style={{ fontSize: '0.65rem', color: '#059669', display: 'block', marginTop: '4px', fontWeight: 700 }}>WA-365D</code>
                  </button>
                </div>

                <div
                  style={{
                    fontSize: '0.72rem',
                    color: 'var(--text-secondary)',
                    marginTop: '0.45rem',
                    padding: '0.4rem 0.6rem',
                    borderRadius: '6px',
                    backgroundColor: 'var(--bg-main)',
                    border: '1px dashed var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '0.35rem',
                  }}
                >
                  <span>
                    🔑 Keys are issued & verified by <strong>Official System Support</strong>.
                  </span>
                  <a
                    href="https://wa.me/917012587705?text=Hello%20Support%2C%20I%20need%20to%20verify%20my%20WhatsApp%20plan%20key"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#dc2626', fontWeight: 700, textDecoration: 'none' }}
                  >
                    WhatsApp: 7012587705 →
                  </a>
                </div>
              </div>

              {/* License Key Input */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
                  License / Upgrade Key
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    value={licenseKeyInput}
                    onChange={(e) => {
                      setLicenseKeyInput(e.target.value.toUpperCase());
                      setKeyError(null);
                    }}
                    placeholder="Enter key (e.g. ZAMZAM-WA-365D)"
                    className="form-control"
                    style={{
                      fontFamily: 'monospace',
                      fontWeight: 700,
                      letterSpacing: '0.08em',
                      fontSize: '0.94rem',
                      textTransform: 'uppercase',
                      padding: '0.75rem 1rem',
                      borderRadius: '8px',
                    }}
                  />
                  {licenseKeyInput && (
                    <button
                      type="button"
                      onClick={() => setLicenseKeyInput('')}
                      style={{
                        position: 'absolute',
                        right: '10px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--text-muted)',
                      }}
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
                <small style={{ color: 'var(--text-secondary)', fontSize: '0.74rem', marginTop: '0.35rem', display: 'block' }}>
                  Accepted format: Official upgrade key or custom key from Support (7012587705).
                </small>
              </div>

              {/* Error & Success Alerts */}
              {keyError && (
                <div style={{
                  padding: '0.75rem 1rem',
                  borderRadius: '8px',
                  backgroundColor: '#fee2e2',
                  border: '1px solid #fca5a5',
                  color: '#991b1b',
                  fontSize: '0.82rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}>
                  <AlertCircle size={16} />
                  <span>{keyError}</span>
                </div>
              )}

              {keySuccess && (
                <div style={{
                  padding: '0.75rem 1rem',
                  borderRadius: '8px',
                  backgroundColor: '#ecfdf5',
                  border: '1px solid #a7f3d0',
                  color: '#065f46',
                  fontSize: '0.82rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}>
                  <CheckCircle2 size={16} />
                  <span>{keySuccess}</span>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: '1rem 1.5rem',
                borderTop: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: '0.75rem',
                backgroundColor: 'var(--bg-main)',
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setIsUpgradeModalOpen(false);
                  setKeyError(null);
                }}
                disabled={activatingKey}
                className="btn btn-secondary btn-sm"
                style={{ padding: '0.55rem 1rem' }}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={async () => {
                  setKeyError(null);
                  setKeySuccess(null);
                  const k = licenseKeyInput.trim().toUpperCase();
                  if (!k) {
                    setKeyError('Please enter an upgrade license key.');
                    return;
                  }

                  let planName = 'WhatsApp Enterprise Pro';
                  let days = 365;
                  let isLifetime = false;

                  if (k.includes('LIFETIME') || k === 'ZAMZAM-LIFETIME' || k === 'WA-LIFETIME') {
                    planName = 'Enterprise Lifetime License';
                    isLifetime = true;
                  } else if (k.includes('365D') || k.includes('1Y') || k.includes('ANNUAL') || k === 'ZAMZAM-WA-PRO-2026') {
                    planName = '1-Year Enterprise Annual Pass';
                    days = 365;
                  } else if (k.includes('90D') || k.includes('QUARTER')) {
                    planName = '90-Day Business Quarterly Pass';
                    days = 90;
                  } else if (k.includes('30D') || k.includes('MONTH') || k === 'ZAMZAM-WA-TRIAL') {
                    planName = '30-Day Pro Monthly Pass';
                    days = 30;
                  } else if ((k.startsWith('WA-') || k.startsWith('ZAMZAM-')) && k.length >= 8) {
                    planName = 'Pro Business License (1 Year)';
                    days = 365;
                  } else if (k === 'ADMIN-UNLOCK' || k === 'ZAMZAM2026') {
                    planName = 'Master Administrator Plan';
                    days = 365;
                  } else {
                    setKeyError('Invalid activation key format. Use a valid key such as ZAMZAM-WA-30D, ZAMZAM-WA-365D, or ZAMZAM-WA-LIFETIME.');
                    return;
                  }

                  try {
                    setActivatingKey(true);
                    const newExpiry = isLifetime
                      ? null
                      : new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

                    await updateSettings({
                      whatsapp_is_locked: false,
                      whatsapp_plan_name: planName,
                      whatsapp_plan_expires_at: newExpiry,
                      whatsapp_license_key: k,
                      is_whatsapp_enabled: true,
                    });

                    setWhatsappIsLocked(false);
                    setWhatsappPlanName(planName);
                    setWhatsappPlanExpiresAt(newExpiry);
                    setWhatsappLicenseKey(k);
                    setIsWhatsappEnabled(true);

                    setKeySuccess(`Successfully activated ${planName}! WhatsApp features are unlocked.`);
                    setTimeout(() => {
                      setIsUpgradeModalOpen(false);
                      setLicenseKeyInput('');
                      setKeySuccess(null);
                    }, 1400);
                  } catch (err: any) {
                    setKeyError(err.message || 'Failed to activate key on server.');
                  } finally {
                    setActivatingKey(false);
                  }
                }}
                disabled={activatingKey || !licenseKeyInput.trim()}
                className="btn btn-primary btn-sm"
                style={{
                  padding: '0.55rem 1.35rem',
                  backgroundColor: '#059669',
                  borderColor: '#059669',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  fontWeight: 700,
                }}
              >
                {activatingKey ? (
                  <>
                    <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                    Activating...
                  </>
                ) : (
                  <>
                    <Key size={14} />
                    Activate Plan
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
