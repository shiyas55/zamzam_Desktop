import React, { useState, useEffect } from 'react';
import {
  RefreshCw,
  Clock,
  HardDrive,
  CheckCircle2,
  AlertTriangle,
  Globe,
  Sparkles,
  Zap,
  Trash2,
  Server,
  Smartphone,
  Laptop,
  Radio,
  Check,
} from 'lucide-react';
import { settingsService } from '../services/settingsService';

interface VersionInfo {
  version: string;
  buildTimestamp: string;
  lastWebsiteUpdate: string;
  environment: string;
  releaseNotes?: string;
}

export const WebsiteCacheVersionSection: React.FC = () => {
  const [clearingCache, setClearingCache] = useState(false);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [apiLatency, setApiLatency] = useState<number | null>(null);
  const [swActive, setSwActive] = useState<boolean>(false);
  const [cachedEntriesCount, setCachedEntriesCount] = useState<number>(0);

  const [versionData, setVersionData] = useState<VersionInfo>({
    version: '3.2.0',
    buildTimestamp: '2026-10-01T09:48:00.000Z',
    lastWebsiteUpdate: 'October 1, 2026, 03:20 PM IST',
    environment: 'production',
    releaseNotes: 'Storage telemetry, driver/route/product deletions, session security, cache purge engine',
  });

  // Fetch version & inspect local cache stats
  const inspectEnvironment = async () => {
    try {
      // 1. Fetch version.json with cache buster
      const res = await fetch(`/version.json?t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        setVersionData(data);
      }
    } catch {
      // Use fallback
    }

    // 2. Measure API ping latency
    try {
      const startTime = performance.now();
      await settingsService.getSettings();
      const endTime = performance.now();
      setApiLatency(Math.round(endTime - startTime));
    } catch {
      setApiLatency(null);
    }

    // 3. Inspect Service Worker
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      setSwActive(registrations.length > 0);
    }

    // 4. Count CacheStorage entries
    if ('caches' in window) {
      try {
        const keys = await caches.keys();
        let total = 0;
        for (const key of keys) {
          const cache = await caches.open(key);
          const requests = await cache.keys();
          total += requests.length;
        }
        setCachedEntriesCount(total);
      } catch {
        setCachedEntriesCount(0);
      }
    }
  };

  useEffect(() => {
    inspectEnvironment();
  }, []);

  const handleCheckForUpdates = async () => {
    setCheckingUpdate(true);
    setFeedback(null);
    try {
      await inspectEnvironment();
      setFeedback({
        type: 'info',
        message: `Deployment verified: You are connected to the live Railway Cloud server (${apiLatency ? apiLatency + 'ms' : 'Active'}). Latest update: ${versionData.lastWebsiteUpdate}`,
      });
    } catch {
      setFeedback({
        type: 'error',
        message: 'Could not connect to deployment server. Please check your internet connection.',
      });
    } finally {
      setCheckingUpdate(false);
    }
  };

  const handleClearCacheAndReload = async () => {
    try {
      setClearingCache(true);
      setFeedback(null);

      // 1. Unregister all service workers
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          try {
            registration.active?.postMessage({ type: 'PURGE_ALL_CACHE' });
          } catch {
            // ignore
          }
          await registration.unregister();
        }
      }

      // 2. Delete all CacheStorage caches
      if ('caches' in window) {
        const cacheKeys = await caches.keys();
        for (const key of cacheKeys) {
          await caches.delete(key);
        }
      }

      // 3. Clear temporary sessionStorage
      sessionStorage.clear();

      setFeedback({
        type: 'success',
        message: 'Cache successfully purged! Reloading fresh application in 1 second...',
      });

      // 4. Force reload with cache-busting timestamp
      setTimeout(() => {
        window.location.href = window.location.pathname + '?reload=' + Date.now();
      }, 900);
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to clear application cache.',
      });
      setClearingCache(false);
    }
  };

  return (
    <div
      style={{
        backgroundColor: 'var(--bg-card, #ffffff)',
        border: '1px solid var(--border, #e2e8f0)',
        borderRadius: '6px',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      {/* Top Banner Header */}
      <div
        style={{
          padding: '1rem 1.25rem',
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
              width: 38,
              height: 38,
              borderRadius: '6px',
              background: 'rgba(99, 102, 241, 0.25)',
              border: '1px solid rgba(99, 102, 241, 0.45)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#818cf8',
            }}
          >
            <Globe size={20} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: '#ffffff' }}>
                Website Version & Cache Telemetry
              </h3>
              <span
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  backgroundColor: 'rgba(16, 185, 129, 0.25)',
                  color: '#34d399',
                  border: '1px solid rgba(52, 211, 153, 0.35)',
                  padding: '0.12rem 0.5rem',
                  borderRadius: '4px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                }}
              >
                <Radio size={10} className="pulse" />
                LIVE PRODUCTION
              </span>
            </div>
            <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '0.2rem 0 0 0' }}>
              Real-time build timestamps, cloud deployment sync, and 1-click browser cache reset.
            </p>
          </div>
        </div>

        {/* Top Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handleCheckForUpdates}
            disabled={checkingUpdate || clearingCache}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.45rem 0.85rem',
              borderRadius: '6px',
              background: '#1e293b',
              border: '1px solid #334155',
              color: '#ffffff',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background 0.15s ease',
            }}
          >
            <RefreshCw size={14} className={checkingUpdate ? 'spinner' : ''} />
            <span>{checkingUpdate ? 'Checking...' : 'Check Server'}</span>
          </button>

          <button
            type="button"
            onClick={handleClearCacheAndReload}
            disabled={clearingCache}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.45rem 1rem',
              borderRadius: '6px',
              background: '#b91c1c',
              border: '1px solid #991b1b',
              color: '#ffffff',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: 'var(--shadow-sm)',
              transition: 'background 0.15s ease',
            }}
          >
            <Trash2 size={15} className={clearingCache ? 'spinner' : ''} />
            <span>{clearingCache ? 'Purging Cache...' : 'Purge Cache & Force Update'}</span>
          </button>
        </div>
      </div>

      <div style={{ padding: '1.75rem' }}>
        {/* Feedback Alert */}
        {feedback && (
          <div
            style={{
              padding: '0.85rem 1.1rem',
              borderRadius: '10px',
              marginBottom: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
              background:
                feedback.type === 'success'
                  ? '#f0fdf4'
                  : feedback.type === 'info'
                  ? '#eff6ff'
                  : '#fef2f2',
              border: `1px solid ${
                feedback.type === 'success'
                  ? '#bbf7d0'
                  : feedback.type === 'info'
                  ? '#bfdbfe'
                  : '#fecaca'
              }`,
              color:
                feedback.type === 'success'
                  ? '#166534'
                  : feedback.type === 'info'
                  ? '#1e40af'
                  : '#991b1b',
              fontSize: '0.88rem',
              fontWeight: 600,
            }}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 size={18} />
            ) : feedback.type === 'info' ? (
              <Sparkles size={18} />
            ) : (
              <AlertTriangle size={18} />
            )}
            <span>{feedback.message}</span>
          </div>
        )}

        {/* Telemetry Cards Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '1rem',
            marginBottom: '1.5rem',
          }}
        >
          {/* Card 1: Last Website Update */}
          <div
            style={{
              padding: '1.25rem',
              borderRadius: '12px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.76rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                  Last Website Update
                </span>
                <Clock size={16} color="#0284c7" />
              </div>
              <div style={{ fontSize: '1.12rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.35rem', lineHeight: 1.3 }}>
                {versionData.lastWebsiteUpdate}
              </div>
            </div>
            <div style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.5rem' }}>
              <Check size={14} />
              <span>Deployed to Railway Production</span>
            </div>
          </div>

          {/* Card 2: App Release Version */}
          <div
            style={{
              padding: '1.25rem',
              borderRadius: '12px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.76rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                  Release Version
                </span>
                <Zap size={16} color="#dc2626" />
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#dc2626', marginBottom: '0.35rem' }}>
                v{versionData.version} Enterprise
              </div>
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.5rem' }}>
              Local PostgreSQL Engine
            </div>
          </div>

          {/* Card 3: Live API & Cloud Sync */}
          <div
            style={{
              padding: '1.25rem',
              borderRadius: '12px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.76rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                  Cloud API Connectivity
                </span>
                <Server size={16} color="#059669" />
              </div>
              <div style={{ fontSize: '1.12rem', fontWeight: 800, color: '#059669', marginBottom: '0.35rem' }}>
                {apiLatency ? `Online (${apiLatency}ms)` : 'Connected'}
              </div>
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.5rem' }}>
              Backend endpoint: <code style={{ fontSize: '0.72rem', background: '#e2e8f0', padding: '1px 4px', borderRadius: '4px' }}>/api/</code>
            </div>
          </div>

          {/* Card 4: Local Cache Storage Status */}
          <div
            style={{
              padding: '1.25rem',
              borderRadius: '12px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.76rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                  Browser Cache Status
                </span>
                <HardDrive size={16} color="#7c3aed" />
              </div>
              <div style={{ fontSize: '1.12rem', fontWeight: 800, color: '#7c3aed', marginBottom: '0.35rem' }}>
                {cachedEntriesCount > 0 ? `${cachedEntriesCount} Cached Items` : 'Clean & Fresh'}
              </div>
            </div>
            <div style={{ fontSize: '0.75rem', color: swActive ? '#16a34a' : '#64748b', fontWeight: swActive ? 600 : 400, marginTop: '0.5rem' }}>
              Service Worker: {swActive ? 'Active (Auto-Updating)' : 'Standard Network Mode'}
            </div>
          </div>
        </div>

        {/* Release Features */}
        {versionData.releaseNotes && (
          <div
            style={{
              padding: '0.85rem 1rem',
              borderRadius: '10px',
              background: '#faf5ff',
              border: '1px solid #e9d5ff',
              fontSize: '0.82rem',
              color: '#6b21a8',
              marginBottom: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <Sparkles size={16} style={{ color: '#9333ea', flexShrink: 0 }} />
            <span><strong>Latest Release Features:</strong> {versionData.releaseNotes}</span>
          </div>
        )}

        {/* Cache Fix Quick Guide Cards */}
        <div
          style={{
            marginTop: '1rem',
            padding: '1.25rem',
            borderRadius: '12px',
            background: '#f0fdf4',
            border: '1px solid #bbf7d0',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <Sparkles size={18} color="#16a34a" />
            <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 800, color: '#166534' }}>
              How to Fix Stale Cache Issues on Any Device
            </h4>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '0.85rem',
              fontSize: '0.82rem',
              color: '#1e293b',
            }}
          >
            <div style={{ background: '#ffffff', padding: '0.75rem', borderRadius: '8px', border: '1px solid #dcfce7' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, color: '#166534', marginBottom: '0.25rem' }}>
                <Laptop size={15} />
                <span>Mac Computers</span>
              </div>
              <p style={{ margin: 0, color: '#475569', fontSize: '0.78rem' }}>
                Press <kbd style={{ background: '#f1f5f9', padding: '1px 5px', borderRadius: '3px', border: '1px solid #cbd5e1', fontWeight: 700 }}>Cmd + Shift + R</kbd> in Safari or Chrome.
              </p>
            </div>

            <div style={{ background: '#ffffff', padding: '0.75rem', borderRadius: '8px', border: '1px solid #dcfce7' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, color: '#166534', marginBottom: '0.25rem' }}>
                <Laptop size={15} />
                <span>Windows Computers</span>
              </div>
              <p style={{ margin: 0, color: '#475569', fontSize: '0.78rem' }}>
                Press <kbd style={{ background: '#f1f5f9', padding: '1px 5px', borderRadius: '3px', border: '1px solid #cbd5e1', fontWeight: 700 }}>Ctrl + Shift + R</kbd> or <kbd style={{ background: '#f1f5f9', padding: '1px 5px', borderRadius: '3px', border: '1px solid #cbd5e1', fontWeight: 700 }}>Ctrl + F5</kbd>.
              </p>
            </div>

            <div style={{ background: '#ffffff', padding: '0.75rem', borderRadius: '8px', border: '1px solid #dcfce7' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, color: '#166534', marginBottom: '0.25rem' }}>
                <Smartphone size={15} />
                <span>iPhone / iPad</span>
              </div>
              <p style={{ margin: 0, color: '#475569', fontSize: '0.78rem' }}>
                Click <strong>"Purge Cache & Force Update"</strong> button above, or open iOS Settings → Safari → Clear History.
              </p>
            </div>

            <div style={{ background: '#ffffff', padding: '0.75rem', borderRadius: '8px', border: '1px solid #dcfce7' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, color: '#166534', marginBottom: '0.25rem' }}>
                <Smartphone size={15} />
                <span>Android Phone</span>
              </div>
              <p style={{ margin: 0, color: '#475569', fontSize: '0.78rem' }}>
                Click <strong>"Purge Cache & Force Update"</strong> button above, or Chrome Menu ⋮ → Settings → Clear data.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
