import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';

// Admin pages
import UsersPage from './pages/admin/UsersPage';
import UserDetailPage from './pages/admin/UserDetailPage';
import SessionsPage from './pages/admin/SessionsPage';
import PurchasesPage from './pages/admin/PurchasesPage';
import PurchaseDetailPage from './pages/admin/PurchaseDetailPage';
import DataRemovalPage from './pages/admin/DataRemovalPage';
import AnalyticsPage from './pages/admin/AnalyticsPage';
import CsRepManagementPage from './pages/admin/CsRepManagementPage';
import EmailBroadcastPage from './pages/admin/EmailBroadcastPage';
import EmailSearchPage from './pages/admin/EmailSearchPage';
import PhoneOptOutPage from './pages/admin/PhoneOptOutPage';
import UnsubscribePage from './pages/admin/UnsubscribePage';
import NotesPage from './pages/admin/NotesPage';
import EmailTicketsPage from './pages/admin/EmailTicketsPage';
import MailActivityPage from './pages/admin/MailActivityPage';
import OrdersPage from './pages/admin/OrdersPage';
import PaymentsPage from './pages/admin/PaymentsPage';
import PermissionsPage from './pages/admin/PermissionsPage';
import ContentPage from './pages/admin/ContentPage';
import TimesheetsPage from './pages/admin/TimesheetsPage';
import OffersProductsPage from './pages/admin/OffersProductsPage';
import LogViewerPage from './pages/admin/LogViewerPage';
import UxManagementPage from './pages/admin/UxManagementPage';
import UxcHistoryPage from './pages/admin/UxcHistoryPage';

// Shared
import AdminNav from './components/AdminNav';
import AdminLandingPage from './pages/admin/AdminLandingPage';
import AdminLoginPage from './pages/admin/AdminLoginPage';

/** Scroll to top on route change */
function ScrollToTop() {
  const { pathname } = useLocation();
  React.useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

/** Route guard — redirects to /login if not authenticated or not admin */
const AdminRoute = ({ children }) => {
  const { token, user, loading } = useAuth();
  const location = useLocation();
  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', color: '#6b7280' }}>
        Loading…
      </div>
    );
  }
  if (!token) {
    return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname)}`} replace />;
  }
  if (user?.role !== 'admin') {
    return <Navigate to="/login" replace />;
  }
  return children;
};

const AdminApp = () => {
  const { token, user } = useAuth();
  const isAdmin = token && user?.role === 'admin';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <ScrollToTop />
      {isAdmin && <AdminNav />}
      <div style={{ flex: 1 }}>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={isAdmin ? <Navigate to="/users" replace /> : <AdminLandingPage />} />
          <Route path="/login" element={isAdmin ? <Navigate to="/users" replace /> : <AdminLoginPage />} />

          {/* Admin routes */}
          <Route path="/users" element={<AdminRoute><UsersPage /></AdminRoute>} />
          <Route path="/users/:id" element={<AdminRoute><UserDetailPage /></AdminRoute>} />
          <Route path="/sessions" element={<AdminRoute><SessionsPage /></AdminRoute>} />
          <Route path="/purchases" element={<AdminRoute><PurchasesPage /></AdminRoute>} />
          <Route path="/purchases/:id" element={<AdminRoute><PurchaseDetailPage /></AdminRoute>} />
          <Route path="/data-removal" element={<AdminRoute><DataRemovalPage /></AdminRoute>} />
          <Route path="/unsubscribe" element={<AdminRoute><UnsubscribePage /></AdminRoute>} />
          <Route path="/analytics" element={<AdminRoute><AnalyticsPage /></AdminRoute>} />
          <Route path="/cs-reps" element={<AdminRoute><CsRepManagementPage /></AdminRoute>} />
          <Route path="/email" element={<AdminRoute><EmailBroadcastPage /></AdminRoute>} />
          <Route path="/email-search" element={<AdminRoute><EmailSearchPage /></AdminRoute>} />
          <Route path="/phone-optout" element={<AdminRoute><PhoneOptOutPage /></AdminRoute>} />
          <Route path="/orders" element={<AdminRoute><OrdersPage /></AdminRoute>} />
          <Route path="/payments" element={<AdminRoute><PaymentsPage /></AdminRoute>} />
          <Route path="/notes" element={<AdminRoute><NotesPage /></AdminRoute>} />
          <Route path="/tickets" element={<AdminRoute><EmailTicketsPage /></AdminRoute>} />
          <Route path="/mail-log" element={<AdminRoute><MailActivityPage /></AdminRoute>} />
          <Route path="/timesheets" element={<AdminRoute><TimesheetsPage /></AdminRoute>} />
          <Route path="/permissions" element={<AdminRoute><PermissionsPage /></AdminRoute>} />
          <Route path="/content" element={<AdminRoute><ContentPage /></AdminRoute>} />
          <Route path="/offers" element={<AdminRoute><OffersProductsPage /></AdminRoute>} />
          <Route path="/logs" element={<AdminRoute><LogViewerPage /></AdminRoute>} />
          <Route path="/ux" element={<AdminRoute><UxManagementPage /></AdminRoute>} />
          <Route path="/uxc-history" element={<AdminRoute><UxcHistoryPage /></AdminRoute>} />

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
  );
};

export default AdminApp;
