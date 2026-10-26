import React, { useEffect, useState } from 'react';
import { isTauriEnvironment } from '../services/tauriBackupService';
import { nativeDbService } from '../services/nativeDbService';
import { Minus, Square, X, Database, ShieldCheck, RefreshCw } from 'lucide-react';

export const TitleBar: React.FC = () => {
  const [dbConnected, setDbConnected] = useState<boolean>(true);
  const [isTauri, setIsTauri] = useState<boolean>(false);
  const [lastCheck, setLastCheck] = useState<Date>(new Date());

  useEffect(() => {
    setIsTauri(isTauriEnvironment());

    const checkDb = async () => {
      if (isTauriEnvironment()) {
        try {
          const ok = await nativeDbService.ping();
          setDbConnected(ok);
        } catch {
          setDbConnected(false);
        }
      } else {
        setDbConnected(true);
      }
      setLastCheck(new Date());
    };

    checkDb();
    const interval = setInterval(checkDb, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleMinimize = async () => {
    if (isTauriEnvironment()) {
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        await getCurrentWindow().minimize();
      } catch (err) {
        console.error('Minimize failed:', err);
      }
    }
  };

  const handleMaximize = async () => {
    if (isTauriEnvironment()) {
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        await getCurrentWindow().toggleMaximize();
      } catch (err) {
        console.error('Toggle maximize failed:', err);
      }
    }
  };

  const handleClose = async () => {
    if (isTauriEnvironment()) {
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        await getCurrentWindow().close();
      } catch (err) {
        console.error('Close failed:', err);
      }
    }
  };

  return (
    <header
      data-tauri-drag-region
      style={{
        height: '34px',
        backgroundColor: '#1e293b',
        color: '#f8fafc',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingLeft: '12px',
        userSelect: 'none',
        fontSize: '12px',
        fontWeight: 500,
        borderBottom: '1px solid #0f172a',
        zIndex: 9999,
      }}
    >
      {/* Left: Brand & Title */}
      <div
        data-tauri-drag-region
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          cursor: 'default',
        }}
      >
        <div
          style={{
            width: '18px',
            height: '18px',
            backgroundColor: '#dc2626',
            borderRadius: '3px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontWeight: 800,
            fontSize: '11px',
          }}
        >
          Z
        </div>
        <span style={{ fontWeight: 600, letterSpacing: '0.02em', color: '#ffffff' }}>
          ZAMZAM FOODS
        </span>
        <span style={{ color: '#94a3b8', fontSize: '11px' }}>
          Distribution Management System (Offline Desktop)
        </span>
      </div>

      {/* Center: Live Database & System Health Status */}
      <div
        data-tauri-drag-region
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          fontSize: '11px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            padding: '2px 8px',
            borderRadius: '10px',
            backgroundColor: dbConnected ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            border: `1px solid ${dbConnected ? '#22c55e' : '#ef4444'}`,
            color: dbConnected ? '#4ade80' : '#f87171',
          }}
        >
          <span
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: dbConnected ? '#22c55e' : '#ef4444',
            }}
          />
          <span>{dbConnected ? 'PostgreSQL Local: Connected' : 'Database Disconnected'}</span>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            color: '#94a3b8',
          }}
        >
          <ShieldCheck size={13} color="#38bdf8" />
          <span>Owner Mode</span>
        </div>
      </div>

      {/* Right: Window Controls (Minimize, Maximize, Close) */}
      {isTauri ? (
        <div style={{ display: 'flex', height: '100%' }}>
          <button
            type="button"
            onClick={handleMinimize}
            title="Minimize"
            style={{
              width: '42px',
              height: '100%',
              backgroundColor: 'transparent',
              border: 'none',
              color: '#cbd5e1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <Minus size={14} />
          </button>
          <button
            type="button"
            onClick={handleMaximize}
            title="Maximize"
            style={{
              width: '42px',
              height: '100%',
              backgroundColor: 'transparent',
              border: 'none',
              color: '#cbd5e1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <Square size={12} />
          </button>
          <button
            type="button"
            onClick={handleClose}
            title="Close"
            style={{
              width: '46px',
              height: '100%',
              backgroundColor: 'transparent',
              border: 'none',
              color: '#cbd5e1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#dc2626';
              e.currentTarget.style.color = '#ffffff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = '#cbd5e1';
            }}
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <div style={{ paddingRight: '12px', color: '#64748b', fontSize: '11px' }}>
          Web Preview
        </div>
      )}
    </header>
  );
};
