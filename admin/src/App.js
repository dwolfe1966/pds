import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AdminAuthProvider, useAdminAuth } from './context/AdminAuthContext';
import AdminLayout from './components/AdminLayout';

import LoginPage             from './pages/LoginPage';
import CustomersPage         from './pages/customers/CustomersPage';
import CustomerDetailPage    from './pages/customers/CustomerDetailPage';
import OrdersPage            from './pages/orders/OrdersPage';
import OrderDetailPage       from './pages/orders/OrderDetailPage';
import PaymentsPage          from './pages/payments/PaymentsPage';
import UserManagementPage    from './pages/users/UserManagementPage';
import ManageNotesPage       from './pages/notes/ManageNotesPage';
import OptOutUsersPage       from './pages/optout/OptOutUsersPage';
import OptOutPhonePage       from './pages/optout/OptOutPhonePage';
import EmailsPage            from './pages/emails/EmailsPage';
import MailSentPage          from './pages/emails/MailSentPage';
import ContentPage           from './pages/content/ContentPage';
import PermissionsPage       from './pages/permissions/PermissionsPage';
import OffersPage            from './pages/offers/OffersPage';
import LogsPage              from './pages/logs/LogsPage';
import TrackingPage          from './pages/tracking/TrackingPage';
import UnsubscribePage       from './pages/unsubscribe/UnsubscribePage';
import TimesheetsPage        from './pages/timesheets/TimesheetsPage';
import UxManagementPage      from './pages/ux/UxManagementPage';
import UxcHistoryPage        from './pages/ux/UxcHistoryPage';

function RequireAuth({ children }) {
  const { user, loading } = useAdminAuth();
  if (loading) return <div style={{ padding: '2rem', color: '#4a5568' }}>Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <AdminLayout>{children}</AdminLayout>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route path="/customers"          element={<RequireAuth><CustomersPage /></RequireAuth>} />
      <Route path="/customers/:id"      element={<RequireAuth><CustomerDetailPage /></RequireAuth>} />
      <Route path="/orders"             element={<RequireAuth><OrdersPage /></RequireAuth>} />
      <Route path="/orders/:id"         element={<RequireAuth><OrderDetailPage /></RequireAuth>} />
      <Route path="/payments"           element={<RequireAuth><PaymentsPage /></RequireAuth>} />
      <Route path="/user-management"    element={<RequireAuth><UserManagementPage /></RequireAuth>} />
      <Route path="/notes"              element={<RequireAuth><ManageNotesPage /></RequireAuth>} />
      <Route path="/optout/users"       element={<RequireAuth><OptOutUsersPage /></RequireAuth>} />
      <Route path="/optout/phones"      element={<RequireAuth><OptOutPhonePage /></RequireAuth>} />
      <Route path="/emails"             element={<RequireAuth><EmailsPage /></RequireAuth>} />
      <Route path="/mail-sent"          element={<RequireAuth><MailSentPage /></RequireAuth>} />
      <Route path="/content"            element={<RequireAuth><ContentPage /></RequireAuth>} />
      <Route path="/permissions"        element={<RequireAuth><PermissionsPage /></RequireAuth>} />
      <Route path="/offers"             element={<RequireAuth><OffersPage /></RequireAuth>} />
      <Route path="/logs"               element={<RequireAuth><LogsPage /></RequireAuth>} />
      <Route path="/tracking"           element={<RequireAuth><TrackingPage /></RequireAuth>} />
      <Route path="/unsubscribe"        element={<RequireAuth><UnsubscribePage /></RequireAuth>} />
      <Route path="/timesheets"         element={<RequireAuth><TimesheetsPage /></RequireAuth>} />
      <Route path="/ux"                 element={<RequireAuth><UxManagementPage /></RequireAuth>} />
      <Route path="/ux-history"         element={<RequireAuth><UxcHistoryPage /></RequireAuth>} />

      <Route path="*" element={<Navigate to="/customers" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AdminAuthProvider>
        <AppRoutes />
      </AdminAuthProvider>
    </BrowserRouter>
  );
}
