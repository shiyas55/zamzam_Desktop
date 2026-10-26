import React, { useState, useEffect } from 'react';
import { X, Share, PlusSquare } from 'lucide-react';

export const PWAInstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showAndroidPrompt, setShowAndroidPrompt] = useState(false);
  const [showIOSPrompt, setShowIOSPrompt] = useState(false);

  useEffect(() => {
    // Check if already installed
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches 
      || (window.navigator as any).standalone 
      || document.referrer.includes('android-app://');
      
    if (isStandalone) {
      return; // App is already installed
    }

    // --- Android / Chrome Logic ---
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
      // Update UI notify the user they can install the PWA
      const hasDismissed = localStorage.getItem('pwa_prompt_dismissed');
      if (!hasDismissed) {
        setShowAndroidPrompt(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // --- iOS / Safari Logic ---
    const isIos = () => {
      const userAgent = window.navigator.userAgent.toLowerCase();
      return /iphone|ipad|ipod/.test(userAgent);
    };
    
    // Check if it's iOS and not standalone, and no android prompt is firing
    if (isIos() && !(window.navigator as any).standalone) {
      const hasDismissed = localStorage.getItem('pwa_prompt_dismissed');
      if (!hasDismissed) {
        setShowIOSPrompt(true);
      }
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    
    // Show the install prompt
    deferredPrompt.prompt();
    
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to the install prompt: ${outcome}`);
    
    // We've used the prompt, and can't use it again, throw it away
    setDeferredPrompt(null);
    setShowAndroidPrompt(false);
  };

  const handleDismiss = () => {
    setShowAndroidPrompt(false);
    setShowIOSPrompt(false);
    // Don't show again for 7 days
    localStorage.setItem('pwa_prompt_dismissed', new Date().getTime().toString());
  };

  if (!showAndroidPrompt && !showIOSPrompt) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '80px', // Above the bottom nav
        left: '50%',
        transform: 'translateX(-50%)',
        width: '92%',
        maxWidth: '400px',
        backgroundColor: '#fff',
        borderRadius: '12px',
        boxShadow: '0 8px 30px rgba(0,0,0,0.2)',
        padding: '1rem',
        zIndex: 9999,
        border: '1px solid #e2e8f0',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
      }}
    >
      <button 
        onClick={handleDismiss}
        style={{ position: 'absolute', top: '8px', right: '8px', background: 'none', border: 'none', padding: '4px', color: '#94a3b8' }}
      >
        <X size={16} />
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <img src="/app-icon.png" alt="App Icon" style={{ width: '48px', height: '48px', borderRadius: '10px' }} />
        <div>
          <h4 style={{ margin: '0 0 0.2rem 0', fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>
            Install Driver App
          </h4>
          <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>
            Add to home screen for quick access and offline mode.
          </p>
        </div>
      </div>

      {showAndroidPrompt && (
        <button
          onClick={handleInstallClick}
          style={{
            width: '100%',
            padding: '0.6rem',
            backgroundColor: 'var(--primary)',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontWeight: 700,
            fontSize: '0.9rem',
          }}
        >
          Install App
        </button>
      )}

      {showIOSPrompt && (
        <div style={{ 
          background: '#f8fafc', 
          padding: '0.75rem', 
          borderRadius: '8px', 
          fontSize: '0.8rem', 
          color: '#334155',
          border: '1px solid #e2e8f0',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            1. Tap the <Share size={16} color="var(--primary)" /> Share icon at the bottom.
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            2. Select <strong>Add to Home Screen</strong> <PlusSquare size={16} color="var(--primary)" />
          </div>
        </div>
      )}
    </div>
  );
};
