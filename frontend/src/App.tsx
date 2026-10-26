import React, { useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { AppRoutes } from './routes/AppRoutes';
import { OfflineBanner } from './components/OfflineBanner';
import { SettingsProvider } from './context/SettingsContext';
import { warmUpServer } from './services/apiClient';
import { cloudSyncService } from './services/cloudSyncService';

import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './app/queryClient';

export const App: React.FC = () => {
  useEffect(() => {
    warmUpServer();
    cloudSyncService.startAutoSync();
    return () => {
      cloudSyncService.stopAutoSync();
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ThemeProvider>
          <OfflineBanner />
          <AuthProvider>
            <SettingsProvider>
              <AppRoutes />
            </SettingsProvider>
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

export default App;
