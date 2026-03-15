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
import NameSearchLoaderPage from './pages/sales/NameSearchLoaderPage';
import SalesSearchResultsPage from './pages/sales/SearchResultsPage';
import GeneralSearchPage from './pages/sales/GeneralSearchPage';
import SearchDetailPreviewPage from './pages/sales/SearchDetailPreviewPage';
import SignupPage from './pages/sales/SignupPage';
import LoginPage from './pages/sales/LoginPage';
import PaymentPage from './pages/sales/PaymentPage';
import PhoneSearchLandingPage from './pages/sales/PhoneSearchLandingPage';
import PhoneLandingPage from './pages/sales/PhoneLandingPage';
import PhoneLoaderPage from './pages/sales/PhoneLoaderPage';
import PhoneSearchResultsPage from './pages/sales/PhoneSearchResultsPage';
import EmailLandingPage from './pages/sales/EmailLandingPage';
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
// Member pages
import DashboardHome from './pages/member/DashboardHome';
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
import UsersPage from './pages/admin/UsersPage';
import UserDetailPage from './pages/admin/UserDetailPage';
import SessionsPage from './pages/admin/SessionsPage';
import PurchasesPage from './pages/admin/PurchasesPage';
import PurchaseDetailPage from './pages/admin/PurchaseDetailPage';
import DataRemovalPage from './pages/admin/DataRemovalPage';
import AnalyticsPage from './pages/admin/AnalyticsPage';
import CsRepManagementPage from './pages/admin/CsRepManagementPage';
// Protected route
import ProtectedRoute from './pages/ProtectedRoute';
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
          <Route path="/search" element={<LandingPage />} />
          {/* General search page with tabs for name, phone, and email */}
          <Route path="/search/all" element={<GeneralSearchPage />} />
          {/* Name search flow (mimics privaterecords.net) */}
          <Route path="/name/landing" element={<NameSearchLandingPage />} />
          <Route path="/name/landing/v2" element={<NameSearchLandingV2Page />} />
          <Route path="/name/landing/v3" element={<NameSearchLandingV3Page />} />
          <Route path="/name/loader" element={<NameSearchLoaderPage />} />
          <Route path="/name/search-result" element={<SalesSearchResultsPage />} />
          <Route path="/name/signup" element={<SignupPage />} />
          {/* Legacy routes */}
          <Route path="/search-results" element={<SalesSearchResultsPage />} />
          <Route path="/search/:id" element={<SearchDetailPreviewPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/payment" element={<PaymentPage />} />
          {/* Phone search routes (new pattern matching name search) */}
          <Route path="/phone/landing" element={<PhoneLandingPage />} />
          <Route path="/phone/loader" element={<PhoneLoaderPage />} />
          <Route path="/phone/search-result" element={<PhoneSearchResultsPage />} />
          {/* Legacy phone search routes (kept for backward compatibility) */}
          <Route path="/phone-search" element={<PhoneSearchLandingPage />} />
          <Route path="/phone-search-loading" element={<PhoneLoaderPage />} />
          <Route path="/phone-search-results" element={<PhoneSearchResultsPage />} />
          {/* Email search routes */}
          <Route path="/email/landing" element={<EmailLandingPage />} />
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
          {/* Development test routes */}
          <Route path="/api-test" element={<ApiTestPage />} />
          <Route path="/search-test" element={<SearchTestPage />} />

          {/* Member routes (authenticated) */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardHome />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <ProfilePage />
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
                <ErrorBoundary>
                  <SearchResultDetailPage />
                </ErrorBoundary>
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
                <SettingsPage />
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