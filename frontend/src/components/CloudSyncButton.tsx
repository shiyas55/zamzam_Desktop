import React, { useEffect, useState } from 'react';
import { cloudSyncService, SyncState } from '../services/cloudSyncService';
import { Cloud, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';

interface CloudSyncButtonProps {
  variant?: 'topbar' | 'compact' | 'button';
  className?: string;
  style?: React.CSSProperties;
}

export const CloudSyncButton: React.FC<CloudSyncButtonProps> = ({
  variant = 'topbar',
  className = '',
  style = {},
}) => {
  const [syncState, setSyncState] = useState<SyncState>(cloudSyncService.getState());
  const [justFinished, setJustFinished] = useState(false);

  useEffect(() => {
    const unsubscribe = cloudSyncService.subscribe((state) => {
      setSyncState(state);
      if (state.lastSyncResult === 'SUCCESS') {
        setJustFinished(true);
        const timer = setTimeout(() => setJustFinished(false), 3000);
        return () => clearTimeout(timer);
      }
    });
    return unsubscribe;
  }, []);

  const handleSync = async () => {
    await cloudSyncService.syncWithCloud();
  };

  const formatLastSync = (iso: string | null): string => {
    if (!iso) return 'Not synced';
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return 'Recent';
    }
  };

  if (variant === 'topbar') {
    return (
      <div
        className={`header-action-btn ${className}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.45rem',
          height: '34px',
          padding: '0 0.8rem',
          background: 'rgba(255, 255, 255, 0.16)',
          border: '1px solid rgba(255, 255, 255, 0.3)',
          color: '#ffffff',
          borderRadius: '8px',
          fontSize: '0.78rem',
          fontWeight: 700,
          cursor: 'pointer',
          userSelect: 'none',
          ...style,
        }}
        title="Database Engine — Connected & Live. All terminals share this data in real time."
        onClick={handleSync}
      >
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: '#4ade80',
            boxShadow: '0 0 8px #4ade80',
            display: 'inline-block',
          }}
        />
        <span style={{ letterSpacing: '-0.01em' }}>
          {syncState.isSyncing ? 'Testing...' : 'Database Live'}
        </span>
      </div>
    );
  }

  // Button Variant (For Settings or Action bars)
  return (
    <button
      type="button"
      onClick={handleSync}
      disabled={syncState.isSyncing}
      className={`btn ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.45rem',
        height: '36px',
        padding: '0 1rem',
        borderRadius: '8px',
        fontWeight: 700,
        fontSize: '0.84rem',
        background: syncState.isSyncing ? '#ecfdf5' : '#059669',
        color: syncState.isSyncing ? '#047857' : '#ffffff',
        border: '1px solid #047857',
        cursor: syncState.isSyncing ? 'wait' : 'pointer',
        transition: 'all 0.15s ease',
        ...style,
      }}
      title="Synchronize Local PostgreSQL with Cloud Master Database"
    >
      {syncState.isSyncing ? (
        <RefreshCw size={15} className="spinner" />
      ) : justFinished ? (
        <CheckCircle2 size={15} style={{ color: '#ffffff' }} />
      ) : (
        <Cloud size={15} />
      )}
      <span>
        {syncState.isSyncing
          ? 'Syncing with Cloud...'
          : justFinished
          ? 'Data Synced!'
          : 'Sync with Cloud'}
      </span>
      {syncState.lastSyncedAt && !syncState.isSyncing && (
        <span style={{ fontSize: '0.7rem', opacity: 0.85, fontWeight: 500 }}>
          ({formatLastSync(syncState.lastSyncedAt)})
        </span>
      )}
    </button>
  );
};
