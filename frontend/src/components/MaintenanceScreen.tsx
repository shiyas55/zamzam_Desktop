import React, { useState } from 'react';
import { Wrench, Phone, RotateCcw, LogOut, Clock, ShieldAlert } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';

interface MaintenanceScreenProps {
  isPublic?: boolean;
}

export const MaintenanceScreen: React.FC<MaintenanceScreenProps> = ({ isPublic = false }) => {
  const { businessName, businessPhone, maintenanceMessage, refreshSettings } = useSettings();
  const { logout } = useAuth();
  const [checking, setChecking] = useState(false);

  const handleRefresh = async () => {
    try {
      setChecking(true);
      await refreshSettings();
      // Reload window if settings are refreshed
      window.location.reload();
    } finally {
      setChecking(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0f172a',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1.5rem',
      fontFamily: 'Inter, system-ui, sans-serif',
      color: '#f8fafc',
    }}>
      <div style={{
        maxWidth: 480,
        width: '100%',
        backgroundColor: '#1e293b',
        border: '1px solid #334155',
        borderRadius: '8px',
        padding: '2rem 1.75rem',
        textAlign: 'center',
        boxShadow: 'var(--shadow-md)',
      }}>
        {/* Animated Icon Badge */}
        <div style={{
          width: 56,
          height: 56,
          borderRadius: '8px',
          backgroundColor: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid rgba(239, 68, 68, 0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 1.25rem',
          color: '#f87171',
        }}>
          <Wrench size={38} />
        </div>

        {/* Brand Tag */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.4rem',
          padding: '0.3rem 0.85rem',
          borderRadius: '999px',
          backgroundColor: 'rgba(239, 68, 68, 0.2)',
          color: '#fca5a5',
          fontSize: '0.75rem',
          fontWeight: 800,
          letterSpacing: '0.06em',
          marginBottom: '1rem',
          border: '1px solid rgba(239, 68, 68, 0.3)',
        }}>
          <ShieldAlert size={14} />
          UNDER MAINTENANCE
        </div>

        <h1 style={{
          margin: '0 0 0.75rem 0',
          fontSize: '1.65rem',
          fontWeight: 800,
          color: '#ffffff',
          letterSpacing: '-0.02em',
        }}>
          {businessName || 'Zamzam Foods'}
        </h1>

        <h2 style={{
          margin: '0 0 1rem 0',
          fontSize: '1.1rem',
          fontWeight: 700,
          color: '#fca5a5',
        }}>
          System Is Currently Under Maintenance
        </h2>

        <p style={{
          margin: '0 0 1.75rem 0',
          fontSize: '0.92rem',
          color: '#cbd5e1',
          lineHeight: 1.6,
          backgroundColor: 'rgba(255, 255, 255, 0.04)',
          padding: '1rem',
          borderRadius: '12px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
        }}>
          {maintenanceMessage || 'We are performing scheduled maintenance to upgrade system reliability and order processing. Normal service will resume shortly.'}
        </p>

        {/* Action Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {businessPhone && (
            <a
              href={`tel:${businessPhone.replace(/\s+/g, '')}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                padding: '0.85rem 1rem',
                backgroundColor: '#dc2626',
                color: '#ffffff',
                borderRadius: '12px',
                fontWeight: 700,
                fontSize: '0.95rem',
                textDecoration: 'none',
                boxShadow: '0 4px 14px rgba(220, 38, 38, 0.4)',
                transition: 'all 0.2s ease',
              }}
            >
              <Phone size={18} />
              Call Support: {businessPhone}
            </a>
          )}

          <div style={{ display: 'flex', gap: '0.65rem' }}>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={checking}
              style={{
                flex: 1,
                padding: '0.75rem 1rem',
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                color: '#ffffff',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '12px',
                fontWeight: 600,
                fontSize: '0.88rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
              }}
            >
              <RotateCcw size={16} />
              {checking ? 'Checking...' : 'Check Status'}
            </button>

            {!isPublic && (
              <button
                type="button"
                onClick={async () => {
                  await logout();
                  window.location.href = '/login';
                }}
                style={{
                  padding: '0.75rem 1rem',
                  backgroundColor: 'transparent',
                  color: '#94a3b8',
                  border: '1px solid rgba(148, 163, 184, 0.2)',
                  borderRadius: '12px',
                  fontWeight: 600,
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem',
                }}
              >
                <LogOut size={16} />
                Sign Out
              </button>
            )}
          </div>
        </div>

        {/* Footer Note */}
        <div style={{
          marginTop: '1.75rem',
          paddingTop: '1rem',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          fontSize: '0.75rem',
          color: '#64748b',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.35rem',
        }}>
          <Clock size={13} />
          <span>If you are an Admin/Owner, please sign in with Owner credentials.</span>
        </div>
      </div>
    </div>
  );
};
