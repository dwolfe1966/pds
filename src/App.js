import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { useCampaign } from './context/CampaignContext';
import Header from './components/Header';
import Footer from './components/Footer';
import ScrollToTop from './components/ScrollToTop';
import BrandStyles from './components/BrandStyles';
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
import NameSearchLandingV7Page from './pages/sales/NameSearchLandingV7Page';
import NameSearchLoaderPage from './pages/sales/NameSearchLoaderPage';
import SalesSearchResultsPage from './pages/sales/SearchResultsPage';
import GeneralSearchPage from './pages/sales/GeneralSearchPage';
import SearchDetailPreviewPage from './pages/sales/SearchDetailPreviewPage';
import SignupPage from './pages/sales/SignupPage';
import SignupPageStepped from './pages/sales/SignupPageStepped';
import LoginPage from './pages/sales/LoginPage';
import ForgotPasswordPage from './pages/sales/ForgotPasswordPage';
import PaymentPage from './pages/sales/PaymentPage';
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
import UnsubscribePage from './pages/sales/UnsubscribePage';
import PartnerPage from './pages/sales/PartnerPage';
import PrivacyPage from './pages/sales/PrivacyPage';
import TermsPage from './pages/sales/TermsPage';
import RefundPage from './pages/sales/RefundPage';
import SuppressionListPage from './pages/sales/SuppressionListPage';
import ContactThreadPage from './pages/sales/ContactThreadPage';
// Member pages
import Dashboard2 from './pages/member/Dashboard2';
// DashboardHome (the original monitoring-framed dashboard) is parked. Kept in
// the repo for reference but no longer routed anywhere on the consumer SPA.
import MemberGeneralSearchPage from './pages/member/MemberGeneralSearchPage';
import MemberSearchResultsPage from './pages/member/SearchResultsPage';
import SearchResultDetailPage from './pages/member/SearchResultDetailPage';
import WhoIsSearchingPage from './pages/member/WhoIsSearchingPage';
import AlertsPage from './pages/member/AlertsPage';
import AccountPage from './pages/member/AccountPage';
import LogoutPage from './pages/member/LogoutPage';
import SearchHistoryPage from './pages/member/SearchHistoryPage';

// Admin / CSR pages live in the separate admin bundle (src/AdminApp.js).
// Consumer never mounts /admin/* routes — admins use the dedicated CSR app
// build at dev.admin.www.bytecrtrs.com.

// Protected route
import ProtectedRoute from './pages/ProtectedRoute';
import PaidRoute from './pages/PaidRoute';
import NotFoundPage from './pages/NotFoundPage';
import ErrorBoundary from './components/ErrorBoundary';
// Test pages (development only)
import ApiTestPage from './pages/ApiTestPage';
import SearchTestPage from './pages/SearchTestPage';

// Component to redirect logged-in users from home to dashboard, OR redirect
// visitors with an active campaign config to the campaign-specific landing.
const HomePageRedirect = () => {
  const { token } = useAuth();
  const campaign = useCampaign();
  const location = useLocation();
  if (token) {
    return <Navigate to="/dashboard" replace />;
  }
  // Campaign landing redirect is one-shot per landing — only fires when the
  // URL had shn/shl params on the most recent boot. Without this gate, any
  // future `/` visit in the same session would redirect again because shn/shl
  // are persisted to sessionStorage for attribution. Read + clear the flag
  // atomically so subsequent `/` visits stay on the homepage.
  let shouldApply = false;
  try {
    if (sessionStorage.getItem('attribution.landingPending') === '1') {
      sessionStorage.removeItem('attribution.landingPending');
      shouldApply = true;
    }
  } catch {}
  const campaignRoute = campaign?.landing?.route;
  if (shouldApply && campaignRoute && campaignRoute !== '/') {
    // Carry the original query string (gclid, utm_*, shn) to the vertical LP.
    // Without this, the redirect drops gclid before GTM's Conversion Linker can
    // capture it → no _gcl_aw cookie → Google Ads can't attribute conversions to
    // the ad click. Verified: direct LP?gclid sets _gcl_aw; redirect-without-params
    // does not. (campaignRoute is a static path, never has its own query string.)
    return <Navigate to={`${campaignRoute}${location.search}`} replace />;
  }
  return <HomePage />;
};

const App = () => {
  // document.title is set per-route by ScrollToTop (titleForPath) so GA4's page_title
  // dimension is unique per page — don't override it with a static brand name here.
  return (
    <div className="app-container" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <BrandStyles />
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
          {/* Name search flow */}
          <Route path="/name/landing" element={<NameSearchLandingPage />} />
          <Route path="/name/landing/v2" element={<NameSearchLandingV2Page />} />
          <Route path="/name/landing/v3" element={<NameSearchLandingV3Page />} />
          <Route path="/name/landing/v4" element={<NameSearchLandingV4Page />} />
          <Route path="/name/landing/v5" element={<NameSearchLandingV5Page />} />
          <Route path="/name/landing/v6" element={<NameSearchLandingV6Page />} />
          <Route path="/name/landing/v7" element={<NameSearchLandingV7Page />} />
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
          {/* Confirmation URL — PaymentPage replaceState's to /paymentconfirm on success.
              On a fresh hit (reload/direct) there's no success state, so PaymentPage's
              isPaid guard sends the (already-paid) user to the dashboard. */}
          <Route path="/paymentconfirm" element={<PaymentPage />} />
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
          <Route path="/unsubscribe" element={<UnsubscribePage />} />
          {/* Legal and policy pages */}
          <Route path="/partner" element={<PartnerPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/refund" element={<RefundPage />} />
          <Route path="/suppression-list" element={<SuppressionListPage />} />
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

          {/* Admin / CSR routes are NOT mounted in the consumer bundle.
              Admins reach the CSR app via its own deploy (build-admin /
              dev.admin.www.bytecrtrs.com). Any `/admin/*` URL on the
              consumer domain falls through to the 404 catch-all below. */}

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