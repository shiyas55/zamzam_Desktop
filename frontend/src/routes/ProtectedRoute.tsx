import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';

import { useSettings } from '../context/SettingsContext';
import { MaintenanceScreen } from '../components/MaintenanceScreen';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { user, isAuthenticated, isLoading, status } = useAuth();
  const { isMaintenanceMode } = useSettings();
  const location = useLocation();

  if (isLoading && status === 'INITIALIZING') {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="spinner" style={{ margin: '0 auto 1rem' }} />
          <p style={{ color: '#64748b', fontSize: '0.9rem', fontWeight: 500 }}>Authenticating session...</p>
        </div>
      </div>
    );
  }

  if (status === 'UNAUTHENTICATED' || !isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Master Maintenance Mode: Non-owners blocked from accessing staff apps
  if (isMaintenanceMode && user.role !== 'OWNER') {
    return <MaintenanceScreen isPublic={false} />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/owner" replace />;
  }

  return <>{children}</>;
};
