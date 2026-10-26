import React, { useState, useEffect } from 'react';
import { WifiOff, Wifi } from 'lucide-react';

export const OfflineBanner: React.FC = () => {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [showRestored, setShowRestored] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      setShowRestored(true);
      const timer = setTimeout(() => setShowRestored(false), 3500);
      return () => clearTimeout(timer);
    };

    const handleOffline = () => {
      setIsOffline(true);
      setShowRestored(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOffline && !showRestored) {
    return null;
  }

  if (showRestored) {
    return (
      <div
        role="status"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 9999,
          background: '#16a34a',
          color: '#ffffff',
          padding: '0.45rem 1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem',
          fontSize: '0.82rem',
          fontWeight: 600,
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        }}
      >
        <Wifi size={16} />
        <span>Connection restored. Back online with Zamzam server.</span>
      </div>
    );
  }

  return (
    <div
      role="alert"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 9999,
        background: '#7f1d1d',
        color: '#fef08a',
        borderBottom: '2px solid #fbbf24',
        padding: '0.5rem 1rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.6rem',
        fontSize: '0.85rem',
        fontWeight: 600,
        boxShadow: '0 4px 12px rgba(127, 29, 29, 0.4)',
        textAlign: 'center',
      }}
    >
      <WifiOff size={18} color="#fbbf24" />
      <span>
        <strong>Offline:</strong> No internet connection. Live actions (payments, delivery completions, and orders) require a connection to save.
      </span>
    </div>
  );
};
