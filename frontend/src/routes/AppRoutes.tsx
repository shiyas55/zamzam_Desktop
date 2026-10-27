import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ProtectedRoute } from './ProtectedRoute';
import { ErrorBoundary } from '../components/ErrorBoundary';

// Layouts
import { OwnerLayout } from '../layouts/OwnerLayout';

// Auth Pages (Lazy)
const LoginPage = React.lazy(() => import('../pages/auth/LoginPage').then(m => ({ default: m.LoginPage })));

// Owner Pages (Lazy)
const OwnerDashboard = React.lazy(() => import('../pages/owner/OwnerDashboard').then(m => ({ default: m.OwnerDashboard })));
const CustomerShopsPage = React.lazy(() => import('../pages/owner/CustomerShopsPage').then(m => ({ default: m.CustomerShopsPage })));
const CustomerDetailPage = React.lazy(() => import('../pages/owner/CustomerDetailPage').then(m => ({ default: m.CustomerDetailPage })));
const ProductsPage = React.lazy(() => import('../pages/owner/ProductsPage').then(m => ({ default: m.ProductsPage })));
const RoutesPage = React.lazy(() => import('../pages/owner/RoutesPage').then(m => ({ default: m.RoutesPage })));
const DriversPage = React.lazy(() => import('../pages/owner/DriversPage').then(m => ({ default: m.DriversPage })));
const OrdersPage = React.lazy(() => import('../pages/owner/OrdersPage').then(m => ({ default: m.OrdersPage })));
const DeliveriesPage = React.lazy(() => import('../pages/owner/DeliveriesPage').then(m => ({ default: m.DeliveriesPage })));
const ExpensesPage = React.lazy(() => import('../pages/owner/ExpensesPage').then(m => ({ default: m.ExpensesPage })));
const PaymentsPage = React.lazy(() => import('../pages/owner/PaymentsPage').then(m => ({ default: m.PaymentsPage })));
const CreditLedgerPage = React.lazy(() => import('../pages/owner/CreditLedgerPage').then(m => ({ default: m.CreditLedgerPage })));
const ReportsPage = React.lazy(() => import('../pages/owner/ReportsPage').then(m => ({ default: m.ReportsPage })));
const StaffUsersPage = React.lazy(() => import('../pages/owner/StaffUsersPage').then(m => ({ default: m.StaffUsersPage })));
const SettingsPage = React.lazy(() => import('../pages/owner/SettingsPage').then(m => ({ default: m.SettingsPage })));
const ShopDocumentsPage = React.lazy(() => import('../pages/owner/ShopDocumentsPage').then(m => ({ default: m.ShopDocumentsPage })));
const NotepadSheetPage = React.lazy(() => import('../pages/owner/NotepadSheetPage').then(m => ({ default: m.NotepadSheetPage })));

// Order Entry & Daily Operations (Lazy)
const CreateOrderPage = React.lazy(() => import('../pages/manager/CreateOrderPage').then(m => ({ default: m.CreateOrderPage })));

// Customer Pages (Lazy)
const CustomerOrderPage = React.lazy(() => import('../pages/customer/CustomerOrderPage').then(m => ({ default: m.CustomerOrderPage })));

const PageLoadingFallback: React.FC = () => (
  <div style={{ display: 'flex', minHeight: '60vh', alignItems: 'center', justifyContent: 'center' }}>
    <div className="spinner" />
  </div>
);

export const AppRoutes: React.FC = () => {
  const { user, isAuthenticated, isLoading, status } = useAuth();

  if (isLoading && status === 'INITIALIZING') {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner" />
      </div>
    );
  }

  // Root redirect helper - exclusively OWNER destination
  const getHomeRedirect = () => {
    if (status === 'UNAUTHENTICATED' || !isAuthenticated || !user) return <Navigate to="/login" replace />;
    return <Navigate to="/owner" replace />;
  };

  return (
    <ErrorBoundary>
      <React.Suspense fallback={<PageLoadingFallback />}>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={isAuthenticated ? getHomeRedirect() : <LoginPage />} />
          <Route path="/customer/:customerId" element={<CustomerOrderPage />} />
          <Route path="/" element={getHomeRedirect()} />

          {/* 1. OWNER / ADMIN INTERFACE */}
          <Route
            path="/owner"
            element={
              <ProtectedRoute allowedRoles={['OWNER', 'MANAGER', 'DRIVER']}>
                <OwnerLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<OwnerDashboard />} />
            <Route path="driver-performance" element={<Navigate to="/owner" replace />} />
            <Route path="customers" element={<CustomerShopsPage />} />
            <Route path="customers/:id" element={<CustomerDetailPage />} />
            <Route path="shop-documents" element={<ShopDocumentsPage />} />
            <Route path="products" element={<ProductsPage />} />
            <Route path="routes" element={<RoutesPage />} />
            <Route path="drivers" element={<DriversPage />} />
            <Route path="create-order" element={<CreateOrderPage />} />
            <Route path="fast-order" element={<Navigate to="/owner/create-order" replace />} />
            <Route path="orders" element={<OrdersPage />} />
            <Route path="deliveries" element={<DeliveriesPage />} />
            <Route path="expenses" element={<ExpensesPage />} />
            <Route path="payments" element={<PaymentsPage />} />
            <Route path="credit" element={<CreditLedgerPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="daily-closing" element={<Navigate to="/owner/create-order" replace />} />
            <Route path="activity-history" element={<Navigate to="/owner/settings?tab=activity" replace />} />
            <Route path="attendance" element={<StaffUsersPage defaultTab="attendance" />} />
            <Route path="notepad" element={<NotepadSheetPage />} />
            <Route path="users" element={<Navigate to="/owner" replace />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>

          {/* Legacy Manager & Driver route redirects to Owner interface */}
          <Route path="/manager/*" element={<Navigate to="/owner" replace />} />
          <Route path="/manager" element={<Navigate to="/owner" replace />} />
          <Route path="/driver/*" element={<Navigate to="/owner" replace />} />
          <Route path="/driver" element={<Navigate to="/owner" replace />} />

          {/* Catch-all redirect */}
          <Route path="*" element={<Navigate to="/owner" replace />} />
        </Routes>
      </React.Suspense>
    </ErrorBoundary>
  );
};


