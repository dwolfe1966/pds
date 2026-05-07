import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Header from './components/Header';
import Footer from './components/Footer';
import ScrollToTop from './components/ScrollToTop';
// Sales pages
import HomePage from './pages/sales/HomePage';
import AboutPage from './pages/sales/AboutPage';
import ContactPage from './pages/sales/ContactPage';
import LandingPage from './pages/sales/LandingPage';
import NameSearchLandingPage from './pages/sales/NameSearchLandingPage';
import NameSearchLandingV2Page from './pages/sales/NameSearchLandingV2Page';
import NameSearchLandingV3Page from './pages/sales/NameSearchLandingV3Page';
import NameSearchLandingV4Page from './pages/sales/NameSearchLandingV4Page';
import NameSearchLandingV5Page from './pages/sales/NameSearchLandingV5Page';
import NameSearchLandingV6Page from './pages/sales/NameSearchLandingV6Page';
import NameSearchLoaderPage from './pages/sales/NameSearchLoaderPage';
import SalesSearchResultsPage from './pages/sales/SearchResultsPage';
import GeneralSearchPage from './pages/sales/GeneralSearchPage';
import SearchDetailPreviewPage from './pages/sales/SearchDetailPreviewPage';
import SignupPage from './pages/sales/SignupPage';
import SignupPageStepped from './pages/sales/SignupPageStepped';
import LoginPage from './pages/sales/LoginPage';
import ForgotPasswordPage from './pages/sales/ForgotPasswordPage';
import PaymentPage from './pages/sales/PaymentPage';
import PhoneSearchLandingPage from './pages/sales/PhoneSearchLandingPage';
import PhoneLandingPage from './pages/sales/PhoneLandingPage';
import PhoneLandingV2Page from './pages/sales/PhoneSearchLandingV2Page';
import PhoneLandingV3Page from './pages/sales/PhoneSearchLandingV3Page';
import PhoneLandingV4Page from './pages/sales/PhoneSearchLandingV4Page';
import PhoneLandingV5Page from './pages/sales/PhoneSearchLandingV5Page';
import PhoneLandingV6Page from './pages/sales/PhoneSearchLandingV6Page';
import PhoneLoaderPage from './pages/sales/PhoneLoaderPage';
import PhoneSearchResultsPage from './pages/sales/PhoneSearchResultsPage';
import EmailLandingPage from './pages/sales/EmailLandingPage';
import EmailLandingV2Page from './pages/sales/EmailSearchLandingV2Page';
import EmailLandingV3Page from './pages/sales/EmailSearchLandingV3Page';
import EmailLandingV4Page from './pages/sales/EmailSearchLandingV4Page';
import EmailLandingV5Page from './pages/sales/EmailSearchLandingV5Page';
import EmailLandingV6Page from './pages/sales/EmailSearchLandingV6Page';
import EmailLoaderPage from './pages/sales/EmailLoaderPage';
import EmailSearchResultsPage from './pages/sales/EmailSearchResultsPage';
import OptOutLandingPage from './pages/sales/OptOutLandingPage';
import OptOutSearchResultsPage from './pages/sales/OptOutSearchResultsPage';
import OptOutInfoInputPage from './pages/sales/OptOutInfoInputPage';
import PartnerPage from './pages/sales/PartnerPage';
import PrivacyPage from './pages/sales/PrivacyPage';
import TermsPage from './pages/sales/TermsPage';
import RefundPage from './pages/sales/RefundPage';
import SuppressionListPage from './pages/sales/SuppressionListPage';
import CPCCPage from './pages/sales/CPCCPage';
import AddonPage from './pages/sales/AddonPage';
import ContactThreadPage from './pages/sales/ContactThreadPage';
// Member pages
import Dashboard2 from './pages/member/Dashboard2';
// DashboardHome (the original monitoring-framed dashboard) is parked. Kept in
// the repo for reference but no longer routed anywhere on the consumer SPA.
import ProfilePage from './pages/member/ProfilePage';
import SearchPage from './pages/member/SearchPage';
import MemberGeneralSearchPage from './pages/member/MemberGeneralSearchPage';
import MemberSearchResultsPage from './pages/member/SearchResultsPage';
import SearchResultDetailPage from './pages/member/SearchResultDetailPage';
import WhoIsSearchingPage from './pages/member/WhoIsSearchingPage';
import AlertsPage from './pages/member/AlertsPage';
import AccountPage from './pages/member/AccountPage';
import SettingsPage from './pages/member/SettingsPage';
import LogoutPage from './pages/member/LogoutPage';
import SearchHistoryPage from './pages/member/SearchHistoryPage';
// Admin pages
import MyDashboardPage from './pages/admin/MyDashboardPage';
import UsersPage from './pages/admin/UsersPage';
import UserDetailPage from './pages/admin/UserDetailPage';
import SessionsPage from './pages/admin/SessionsPage';
import PurchasesPage from './pages/admin/PurchasesPage';
import PurchaseDetailPage from './pages/admin/PurchaseDetailPage';
import DataRemovalPage from './pages/admin/DataRemovalPage';
import AnalyticsPage from './pages/admin/AnalyticsPage';
import CsRepManagementPage from './pages/admin/CsRepManagementPage';

import UnsubscribePage from './pages/admin/UnsubscribePage';
import NotesPage from './pages/admin/NotesPage';
import EmailTicketsPage from './pages/admin/EmailTicketsPage';
import MailActivityPage from './pages/admin/MailActivityPage';
import OrdersPage from './pages/admin/OrdersPage';
import PermissionsPage from './pages/admin/PermissionsPage';
import ContentPage from './pages/admin/ContentPage';
import OffersProductsPage from './pages/admin/OffersProductsPage';

// Protected route
import ProtectedRoute from './pages/ProtectedRoute';
import PaidRoute from './pages/PaidRoute';
import NotFoundPage from './pages/NotFoundPage';
import ErrorBoundary from './components/ErrorBoundary';
// Test pages (development only)
import ApiTestPage from './pages/ApiTestPage';
import SearchTestPage from './pages/SearchTestPage';

// Component to redirect logged-in users from home to dashboard
const HomePageRedirect = () => {
  const { token } = useAuth();
  if (token) {
    return <Navigate to="/dashboard" replace />;
  }
  return <HomePage />;
};

const App = () => {
  return (
    <div className="app-container" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <ScrollToTop />
      <Header />
      <div style={{ flex: 1 }}>
        <ErrorBoundary>
        <Routes>
          {/* Sales/public routes */}
          <Route path="/" element={<HomePageRedirect />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/contact/thread/:threadId" element={<ContactThreadPage />} />
          <Route path="/search" element={<LandingPage />} />
          {/* General search page with tabs for name, phone, and email */}
          <Route path="/search/all" element={<GeneralSearchPage />} />
          {/* Name search flow (mimics privaterecords.net) */}
          <Route path="/name/landing" element={<NameSearchLandingPage />} />
          <Route path="/name/landing/v2" element={<NameSearchLandingV2Page />} />
          <Route path="/name/landing/v3" element={<NameSearchLandingV3Page />} />
          <Route path="/name/landing/v4" element={<NameSearchLandingV4Page />} />
          <Route path="/name/landing/v5" element={<NameSearchLandingV5Page />} />
          <Route path="/name/landing/v6" element={<NameSearchLandingV6Page />} />
          <Route path="/name/loader" element={<NameSearchLoaderPage />} />
          <Route path="/name/search-result" element={<SalesSearchResultsPage />} />
          <Route path="/name/signup" element={<SignupPage source="name-search" />} />
          {/* Legacy routes */}
          <Route path="/search-results" element={<SalesSearchResultsPage />} />
          <Route path="/search/:id" element={<SearchDetailPreviewPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/signup/v2" element={<SignupPageStepped />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/payment" element={<PaymentPage />} />
          {/* Phone search routes */}
          <Route path="/phone/landing" element={<PhoneLandingPage />} />
          <Route path="/phone/landing/v2" element={<PhoneLandingV2Page />} />
          <Route path="/phone/landing/v3" element={<PhoneLandingV3Page />} />
          <Route path="/phone/landing/v4" element={<PhoneLandingV4Page />} />
          <Route path="/phone/landing/v5" element={<PhoneLandingV5Page />} />
          <Route path="/phone/landing/v6" element={<PhoneLandingV6Page />} />
          <Route path="/phone/loader" element={<PhoneLoaderPage />} />
          <Route path="/phone/search-result" element={<PhoneSearchResultsPage />} />
          {/* Legacy phone search routes */}
          <Route path="/phone-search" element={<PhoneSearchLandingPage />} />
          <Route path="/phone-search-loading" element={<PhoneLoaderPage />} />
          <Route path="/phone-search-results" element={<PhoneSearchResultsPage />} />
          {/* Email search routes */}
          <Route path="/email/landing" element={<EmailLandingPage />} />
          <Route path="/email/landing/v2" element={<EmailLandingV2Page />} />
          <Route path="/email/landing/v3" element={<EmailLandingV3Page />} />
          <Route path="/email/landing/v4" element={<EmailLandingV4Page />} />
          <Route path="/email/landing/v5" element={<EmailLandingV5Page />} />
          <Route path="/email/landing/v6" element={<EmailLandingV6Page />} />
          <Route path="/email/loader" element={<EmailLoaderPage />} />
          <Route path="/email/search-result" element={<EmailSearchResultsPage />} />
          {/* Opt-out routes */}
          <Route path="/opt-out" element={<OptOutLandingPage />} />
          <Route path="/opt-out-results" element={<OptOutSearchResultsPage />} />
          <Route path="/opt-out/request" element={<OptOutInfoInputPage />} />
          {/* Legal and policy pages */}
          <Route path="/partner" element={<PartnerPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/refund" element={<RefundPage />} />
          <Route path="/suppression-list" element={<SuppressionListPage />} />
          <Route path="/cpcc" element={<CPCCPage />} />
          <Route path="/addon" element={<AddonPage />} />
          {/* Development-only routes — not registered in production builds. */}
          {process.env.NODE_ENV === 'development' && (
            <>
              <Route path="/api-test" element={<ApiTestPage />} />
              <Route path="/search-test" element={<SearchTestPage />} />
            </>
          )}

          {/* Member routes (authenticated) */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard2 />
              </ProtectedRoute>
            }
          />
          {/* /dashboard2 redirects to /dashboard now that Dashboard2 is canonical. */}
          <Route
            path="/dashboard2"
            element={<Navigate to="/dashboard" replace />}
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Navigate to="/account" replace />
              </ProtectedRoute>
            }
          />
          <Route
            path="/people-search"
            element={
              <ProtectedRoute>
                <MemberGeneralSearchPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/people-results"
            element={
              <ProtectedRoute>
                <MemberSearchResultsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/people/:id"
            element={
              <ProtectedRoute>
                <PaidRoute>
                  <ErrorBoundary>
                    <SearchResultDetailPage />
                  </ErrorBoundary>
                </PaidRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/who-is-searching"
            element={
              <ProtectedRoute>
                <WhoIsSearchingPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/alerts"
            element={
              <ProtectedRoute>
                <AlertsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/search-history"
            element={
              <ProtectedRoute>
                <SearchHistoryPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/account"
            element={
              <ProtectedRoute>
                <AccountPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <Navigate to="/account" replace />
              </ProtectedRoute>
            }
          />
          <Route
            path="/logout"
            element={
              <ProtectedRoute>
                <LogoutPage />
              </ProtectedRoute>
            }
          />

          {/* Admin routes (authenticated & role=admin) */}
          <Route
            path="/admin/my-dashboard"
            element={
              <ProtectedRoute role="admin">
                <MyDashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/users"
            element={
              <ProtectedRoute role="admin">
                <UsersPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/users/:id"
            element={
              <ProtectedRoute role="admin">
                <UserDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/sessions"
            element={
              <ProtectedRoute role="admin">
                <SessionsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/purchases"
            element={
              <ProtectedRoute role="admin">
                <PurchasesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/purchases/:id"
            element={
              <ProtectedRoute role="admin">
                <PurchaseDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/data-removal"
            element={
              <ProtectedRoute role="admin">
                <DataRemovalPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/unsubscribe"
            element={
              <ProtectedRoute role="admin">
                <UnsubscribePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/analytics"
            element={
              <ProtectedRoute role="admin">
                <AnalyticsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/cs-reps"
            element={
              <ProtectedRoute role="admin">
                <CsRepManagementPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/email-search"
            element={<Navigate to="/admin/users" replace />}
          />
          <Route
            path="/admin/phone-optout"
            element={<Navigate to="/admin/data-removal" replace />}
          />
          <Route
            path="/admin/orders"
            element={
              <ProtectedRoute role="admin">
                <OrdersPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/payments"
            element={<Navigate to="/admin/orders" replace />}
          />
          <Route
            path="/admin/notes"
            element={
              <ProtectedRoute role="admin">
                <NotesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/tickets"
            element={
              <ProtectedRoute role="admin">
                <EmailTicketsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/mail-log"
            element={
              <ProtectedRoute role="admin">
                <MailActivityPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/timesheets"
            element={<Navigate to="/admin/analytics" replace />}
          />
          <Route
            path="/admin/permissions"
            element={
              <ProtectedRoute role="admin">
                <PermissionsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/content"
            element={
              <ProtectedRoute role="admin">
                <ContentPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/offers"
            element={
              <ProtectedRoute role="admin">
                <OffersProductsPage />
              </ProtectedRoute>
            }
          />
          <Route path="/admin/logs" element={<Navigate to="/admin/sessions" replace />} />
          <Route path="/admin/ux" element={<Navigate to="/admin/content" replace />} />
          <Route path="/admin/uxc-history" element={<Navigate to="/admin/content" replace />} />

          {/* 404 catch-all */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        </ErrorBoundary>
      </div>
      <Footer />
    </div>
  );
};

export default App;