import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  Lock,
  User,
  ArrowRight,
  AlertCircle,
  Eye,
  EyeOff,
  Server,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Settings,
  Sparkles,
} from 'lucide-react';
import { getDynamicStoreInfo } from '../../utils/whatsappUtils';
import {
  getApiBaseUrl,
  setApiBaseUrl,
  checkServerHealth,
  normalizeApiUrl,
  DEFAULT_RAILWAY_URL,
  LOCAL_ENGINE_URL,
} from '../../services/apiClient';

export const LoginPage: React.FC = () => {
  const store = getDynamicStoreInfo();
  const { login } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Server health state
  const [currentApiUrl, setCurrentApiUrl] = useState<string>(getApiBaseUrl());
  const [serverStatus, setServerStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [statusMessage, setStatusMessage] = useState<string>('Testing connection...');
  const [isCheckingServer, setIsCheckingServer] = useState(false);
  const [showServerConfig, setShowServerConfig] = useState(false);
  const [customUrlInput, setCustomUrlInput] = useState<string>(getApiBaseUrl());
  const [urlSaveSuccess, setUrlSaveSuccess] = useState(false);

  const verifyBackend = useCallback(async (urlToTest?: string) => {
    const target = normalizeApiUrl(urlToTest || getApiBaseUrl());
    setIsCheckingServer(true);
    setServerStatus('checking');
    setStatusMessage('Connecting...');
    try {
      const res = await checkServerHealth(target);
      if (res.ok) {
        setServerStatus('online');
        const isRailway = target.includes('railway.app');
        setStatusMessage(isRailway ? 'Railway Cloud Online' : 'Local Backend Online');
      } else {
        setServerStatus('offline');
        const isRailway = target.includes('railway.app');
        setStatusMessage(isRailway ? 'Railway Offline (502)' : 'Local Engine Offline');
      }
    } catch {
      setServerStatus('offline');
      setStatusMessage('Backend Offline');
    } finally {
      setIsCheckingServer(false);
    }
  }, []);

  useEffect(() => {
    verifyBackend();
    const interval = setInterval(() => verifyBackend(), 15000);
    return () => clearInterval(interval);
  }, [verifyBackend]);

  const handleSelectPreset = (url: string) => {
    const normalized = setApiBaseUrl(url);
    setCustomUrlInput(normalized);
    setCurrentApiUrl(normalized);
    setUrlSaveSuccess(true);
    setTimeout(() => setUrlSaveSuccess(false), 3000);
    verifyBackend(normalized);
  };

  const handleSaveApiUrl = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customUrlInput.trim()) return;
    const normalized = setApiBaseUrl(customUrlInput.trim());
    setCustomUrlInput(normalized);
    setCurrentApiUrl(normalized);
    setUrlSaveSuccess(true);
    setTimeout(() => setUrlSaveSuccess(false), 3000);
    verifyBackend(normalized);
  };

  const handleResetApiUrl = () => {
    const resetUrl = setApiBaseUrl('');
    setCustomUrlInput(resetUrl);
    setCurrentApiUrl(resetUrl);
    setUrlSaveSuccess(true);
    setTimeout(() => setUrlSaveSuccess(false), 3000);
    verifyBackend(resetUrl);
  };

  const handleQuickFill = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('Please provide both username and password.');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      await login(username.trim(), password);
      navigate('/owner');
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (err.message.includes('connect to the Zamzam server') || err.message.includes('Failed to fetch')) {
          setServerStatus('offline');
          setError('Backend is offline. Double-click "start_zamzam_all.bat" to start your backend server, then try again.');
        } else if (err.message.toLowerCase().includes('credential') || err.message.toLowerCase().includes('401')) {
          setError('Invalid credentials. Use default admin "admin" / "zamzam@2026".');
        } else {
          setError(err.message);
        }
      } else {
        setError('Login failed. Please verify credentials.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-wrapper">
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-4px); }
          40%, 80% { transform: translateX(4px); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes pulse-green {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.15); }
        }

        .login-wrapper {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f1f5f9;
          position: relative;
          padding: 1.5rem;
          box-sizing: border-box;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        }

        .login-card {
          width: 100%;
          max-width: 420px;
          background: #ffffff;
          border-radius: 12px;
          border: 1px solid #cbd5e1;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04);
          overflow: hidden;
          position: relative;
          z-index: 10;
          box-sizing: border-box;
        }

        .login-header {
          padding: 1.75rem 1.5rem 1.25rem;
          background: #ffffff;
          border-bottom: 1px solid #e2e8f0;
          text-align: center;
        }

        .login-logo {
          height: 64px;
          width: 64px;
          object-fit: cover;
          border-radius: 8px;
          margin-bottom: 0.5rem;
          display: inline-block;
          box-shadow: 0 2px 6px rgba(0,0,0,0.06);
        }

        .status-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          border-radius: 9999px;
          font-size: 0.73rem;
          font-weight: 600;
          margin-top: 0.6rem;
          border: 1px solid transparent;
          transition: all 0.2s ease;
        }

        .status-pill.online {
          background: #ecfdf5;
          color: #065f46;
          border-color: #a7f3d0;
        }

        .status-pill.offline {
          background: #fef2f2;
          color: #991b1b;
          border-color: #fecaca;
        }

        .status-pill.checking {
          background: #f8fafc;
          color: #475569;
          border-color: #e2e8f0;
        }

        .status-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
        }
        .status-dot.online {
          background: #10b981;
          animation: pulse-green 2s infinite;
        }
        .status-dot.offline {
          background: #ef4444;
        }
        .status-dot.checking {
          background: #f59e0b;
        }

        .animated-input-group {
          margin-bottom: 1.1rem;
          text-align: left;
        }
        .animated-input-group label {
          display: block;
          font-size: 0.82rem;
          font-weight: 700;
          color: #334155;
          margin-bottom: 0.4rem;
        }

        .input-wrapper {
          position: relative;
          width: 100%;
          height: 44px;
          display: flex;
          align-items: center;
          box-sizing: border-box;
        }

        .input-icon-left {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: #94a3b8;
          pointer-events: none;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 18px;
          height: 18px;
          z-index: 5;
        }

        .animated-input {
          width: 100%;
          height: 100%;
          padding: 0 40px 0 38px;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          font-size: 0.9rem;
          color: #0f172a;
          background: #ffffff;
          outline: none;
          box-sizing: border-box;
          line-height: normal;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }
        .animated-input::placeholder {
          color: #94a3b8;
          font-size: 0.88rem;
        }
        .animated-input:focus {
          border-color: #b91c1c;
          box-shadow: 0 0 0 3px rgba(185, 28, 28, 0.12);
        }

        .input-wrapper:focus-within .input-icon-left {
          color: #b91c1c;
        }

        .password-toggle-btn {
          position: absolute;
          right: 8px;
          top: 50%;
          transform: translateY(-50%);
          background: transparent;
          border: none;
          color: #94a3b8;
          cursor: pointer;
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
          z-index: 5;
          padding: 0;
        }
        .password-toggle-btn:hover {
          color: #b91c1c;
        }

        .animated-submit-btn {
          width: 100%;
          height: 44px;
          background: #b91c1c;
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 0.94rem;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          box-shadow: 0 2px 4px rgba(185, 28, 28, 0.2);
          transition: background 0.15s ease, transform 0.05s active;
          margin-top: 0.5rem;
        }
        .animated-submit-btn:hover:not(:disabled) {
          background: #991b1b;
        }
        .animated-submit-btn:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }

        .error-banner {
          display: flex;
          align-items: flex-start;
          gap: 0.6rem;
          padding: 0.75rem 0.9rem;
          border-radius: 6px;
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #b91c1c;
          font-size: 0.82rem;
          font-weight: 600;
          margin-bottom: 1.1rem;
          animation: shake 0.4s ease-in-out;
          line-height: 1.4;
          text-align: left;
        }

        .quick-fill-chip {
          background: #f1f5f9;
          border: 1px solid #cbd5e1;
          color: #334155;
          border-radius: 4px;
          padding: 4px 8px;
          font-size: 0.74rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }
        .quick-fill-chip:hover {
          background: #e2e8f0;
          border-color: #94a3b8;
          color: #0f172a;
        }

        .offline-box {
          background: #fffbeb;
          border: 1px solid #fde68a;
          border-radius: 6px;
          padding: 0.75rem 0.9rem;
          margin-bottom: 1.1rem;
          color: #92400e;
          font-size: 0.8rem;
          text-align: left;
          line-height: 1.4;
        }
      `}</style>

      {/* Main Login Card */}
      <div className="login-card">
        {/* Header */}
        <div className="login-header">
          <img
            src="/app-icon.png"
            alt="Zamzam Foods App Icon"
            className="login-logo"
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
          <h1
            style={{
              fontSize: '1.3rem',
              fontWeight: 800,
              color: '#0f172a',
              margin: '0 0 0.25rem 0',
              letterSpacing: '-0.02em',
            }}
          >
            Zamzam Foods
          </h1>
          <p style={{ fontSize: '0.84rem', color: '#64748b', margin: 0 }}>
            Enterprise Wholesale & Route Management
          </p>

          {/* Backend Connection Status Badge */}
          <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <div className={`status-pill ${serverStatus}`}>
              <span className={`status-dot ${serverStatus}`} />
              <span>{statusMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => verifyBackend()}
              title="Refresh connection status"
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: '#64748b',
                display: 'flex',
                alignItems: 'center',
                padding: '4px',
              }}
            >
              <RefreshCw size={14} className={isCheckingServer ? 'spin' : ''} style={{ animation: isCheckingServer ? 'spin 1s linear infinite' : 'none' }} />
            </button>
            <button
              type="button"
              onClick={() => setShowServerConfig(!showServerConfig)}
              title="Configure Server URL"
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: showServerConfig ? '#b91c1c' : '#64748b',
                display: 'flex',
                alignItems: 'center',
                padding: '4px',
              }}
            >
              <Settings size={14} />
            </button>
          </div>

          {/* Collapsible Server Configuration */}
          {showServerConfig && (
            <div
              style={{
                marginTop: '0.75rem',
                padding: '0.75rem',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                textAlign: 'left',
              }}
            >
              <div style={{ fontSize: '0.76rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Server size={13} />
                <span>Backend API URL</span>
              </div>
              <form onSubmit={handleSaveApiUrl} style={{ display: 'flex', gap: '6px' }}>
                <input
                  type="text"
                  value={customUrlInput}
                  onChange={(e) => setCustomUrlInput(e.target.value)}
                  style={{
                    flex: 1,
                    fontSize: '0.78rem',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    border: '1px solid #cbd5e1',
                    outline: 'none',
                  }}
                  placeholder="https://zamzamfood.up.railway.app/api/v1"
                />
                <button
                  type="submit"
                  style={{
                    background: urlSaveSuccess ? '#16a34a' : '#0f172a',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '4px 12px',
                    fontSize: '0.74rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {urlSaveSuccess ? '✓ Saved' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={handleResetApiUrl}
                  title="Reset to default Railway Cloud backend"
                  style={{
                    background: '#f1f5f9',
                    color: '#475569',
                    border: '1px solid #cbd5e1',
                    borderRadius: '4px',
                    padding: '4px 8px',
                    fontSize: '0.74rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Reset
                </button>
              </form>

              {/* Quick Presets */}
              <div style={{ marginTop: '0.5rem', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => handleSelectPreset(LOCAL_ENGINE_URL)}
                  style={{
                    background: currentApiUrl.includes('127.0.0.1') || currentApiUrl.includes('localhost') ? '#dbeafe' : '#ffffff',
                    borderColor: currentApiUrl.includes('127.0.0.1') || currentApiUrl.includes('localhost') ? '#3b82f6' : '#cbd5e1',
                    borderWidth: '1px',
                    borderStyle: 'solid',
                    borderRadius: '4px',
                    padding: '3px 8px',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    color: '#1e293b',
                  }}
                >
                  🏠 Local Engine (127.0.0.1:8000)
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectPreset(DEFAULT_RAILWAY_URL)}
                  style={{
                    background: currentApiUrl.includes('railway') ? '#f3e8ff' : '#ffffff',
                    borderColor: currentApiUrl.includes('railway') ? '#9333ea' : '#cbd5e1',
                    borderWidth: '1px',
                    borderStyle: 'solid',
                    borderRadius: '4px',
                    padding: '3px 8px',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    color: '#1e293b',
                  }}
                >
                  ☁️ Railway Cloud
                </button>
              </div>

              {urlSaveSuccess && (
                <div style={{ fontSize: '0.72rem', color: '#16a34a', marginTop: '0.35rem', fontWeight: 600 }}>
                  ✓ Backend API URL updated and verified: {currentApiUrl}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Form Body */}
        <div style={{ padding: '1.5rem 1.75rem 1.75rem' }}>
          {error && (
            <div className="error-banner">
              <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
              <span>{error}</span>
            </div>
          )}

          {serverStatus === 'offline' && (
            <div className="offline-box">
              <div style={{ fontWeight: 700, marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <XCircle size={15} color="#dc2626" />
                <span>{currentApiUrl.includes('railway') ? 'Railway Cloud Server Offline (502)' : 'Backend Engine Offline'}</span>
              </div>
              <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.77rem' }}>
                Cannot connect to <strong>{currentApiUrl}</strong>.
              </p>
              {currentApiUrl.includes('railway') ? (
                <div style={{ fontSize: '0.74rem', background: '#fee2e2', padding: '6px 8px', borderRadius: '4px', border: '1px solid #fecaca', color: '#991b1b', marginBottom: '0.5rem' }}>
                  Railway Cloud returned 502 Bad Gateway (the container is offline or sleeping).<br />
                  Switch to your running Local Engine to continue:
                </div>
              ) : (
                <div style={{ fontSize: '0.74rem', background: '#fef3c7', padding: '6px 8px', borderRadius: '4px', border: '1px solid #fde68a', marginBottom: '0.5rem' }}>
                  • <strong>Windows:</strong> Double-click <code>start_zamzam_all.bat</code> in the app folder.<br />
                  • <strong>Mac/Dev:</strong> Run <code>.venv/bin/python backend/manage.py runserver 127.0.0.1:8000</code>.
                </div>
              )}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {currentApiUrl.includes('railway') ? (
                  <button
                    type="button"
                    onClick={() => handleSelectPreset(LOCAL_ENGINE_URL)}
                    style={{
                      background: '#16a34a',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '5px 10px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    ✓ Switch to Local Engine
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleSelectPreset(DEFAULT_RAILWAY_URL)}
                    style={{
                      background: '#7c3aed',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '5px 10px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    ☁️ Switch to Railway Cloud
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => verifyBackend()}
                  style={{
                    background: '#d97706',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '5px 10px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <RefreshCw size={12} />
                  Retry Connection
                </button>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="animated-input-group">
              <label htmlFor="username">Username</label>
              <div className="input-wrapper">
                <div className="input-icon-left">
                  <User size={18} />
                </div>
                <input
                  id="username"
                  type="text"
                  className="animated-input"
                  placeholder="Enter username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={isLoading}
                  autoComplete="username"
                  autoFocus
                />
              </div>
            </div>

            <div className="animated-input-group" style={{ marginBottom: '1.25rem' }}>
              <label htmlFor="password">Password</label>
              <div className="input-wrapper">
                <div className="input-icon-left">
                  <Lock size={18} />
                </div>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  className="animated-input"
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="animated-submit-btn"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <div
                    style={{
                      width: 18,
                      height: 18,
                      border: '2px solid rgba(255,255,255,0.35)',
                      borderTopColor: '#ffffff',
                      borderRadius: '50%',
                      animation: 'spin 0.8s linear infinite',
                    }}
                  />
                  <span>Signing In...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          {/* Quick-Fill Helper Chips */}
          <div style={{ marginTop: '1.25rem', textAlign: 'center' }}>
            <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600, marginBottom: '0.4rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
              <Sparkles size={13} color="#b91c1c" />
              <span>Quick Login Accounts:</span>
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="quick-fill-chip"
                onClick={() => handleQuickFill('admin', 'zamzam@2026')}
                title="Log in as System Admin (admin / zamzam@2026)"
              >
                👑 <span>admin</span> (Master Admin)
              </button>
              <button
                type="button"
                className="quick-fill-chip"
                onClick={() => handleQuickFill('shiyas', 'zamzam@2026')}
                title="Log in as Owner (shiyas / zamzam@2026)"
              >
                👤 <span>shiyas</span> (Owner)
              </button>
            </div>
          </div>

          {/* Zamzam Foods Footer */}
          <div
            style={{
              marginTop: '1.5rem',
              paddingTop: '1rem',
              borderTop: '1px solid #f1f5f9',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.45rem',
                marginBottom: '0.2rem',
              }}
            >
              <strong style={{ fontSize: '0.82rem', color: '#b91c1c', letterSpacing: '0.02em' }}>
                Zamzam Foods
              </strong>
              <span
                style={{
                  fontSize: '0.65rem',
                  fontWeight: 600,
                  backgroundColor: '#fee2e2',
                  color: '#dc2626',
                  padding: '0.1rem 0.45rem',
                  borderRadius: '999px',
                  border: '1px solid #fca5a5',
                }}
              >
                Server Engine
              </span>
            </div>
            <p style={{ margin: 0, fontSize: '0.72rem', color: '#64748b' }}>
              Wholesale Billing & Daily Route Dispatch System
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
