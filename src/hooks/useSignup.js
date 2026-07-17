import { useCallback, useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import { track } from '../services/trackingService';
import { gtmEvent, gtmSignUp } from '../services/gtm';
import { setUser as gtmSetUser } from '../services/gtmContext';
import { recordLogin } from '../services/loginHistory';
import { captureEmail } from '../services/emailCapture';
import { sendCampaignEmail } from '../services/emailService';
import { readLog as readVisitorSearchLog, clearLog as clearVisitorSearchLog } from '../services/visitorSearchLog';

/**
 * Allowed post-signup redirect targets.
 * Prevents open-redirect abuse via crafted ?redirect= query params.
 */
const SAFE_REDIRECT_PREFIXES = ['/payment', '/dashboard', '/people/', '/account'];

function isSafeRedirect(path) {
  return typeof path === 'string' && SAFE_REDIRECT_PREFIXES.some(p => path.startsWith(p));
}

/**
 * Encode password before writing to sessionStorage to prevent casual reading.
 * Not a security mechanism — just reduces accidental exposure in DevTools.
 */
function encodePw(pw) {
  try { return btoa(unescape(encodeURIComponent(pw))); } catch { return btoa(pw); }
}

/**
 * Validate password — minimum 8 characters. Per bug #28 (2026-05-29),
 * stripped the uppercase/lowercase/number/special requirements because
 * they were causing 3-click signup friction with no real security gain
 * for a people-search consumer product. If BC rejects on the wire we'll
 * surface that error and revisit.
 * Returns null if valid, or an error message string.
 */
export function validatePassword(pw) {
  if (!pw || pw.length < 8) return 'Password must be at least 8 characters.';
  return null;
}

/**
 * Generate a strong, readable password for the email-only signup flow (no BC
 * change — it rides the existing _pendingPw → billing.sale/changePassword path,
 * and BC's policy is min-8/no-complexity). Unambiguous charset (no 0/O/1/l/I),
 * grouped `xxxx-xxxx-xxxx` for easy reading/copying off the confirmation screen.
 */
export function generatePassword() {
  const cs = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const arr = new Uint32Array(12);
  crypto.getRandomValues(arr);
  const r = Array.from(arr, (v) => cs[v % cs.length]).join('');
  return `${r.slice(0, 4)}-${r.slice(4, 8)}-${r.slice(8, 12)}`;
}

/**
 * Shared signup logic for SignupPage, SignupPageStepped, and the embedded
 * form in SearchDetailPreviewPage.
 *
 * Handles:
 *  - api.signup() call
 *  - Auth context + localStorage update
 *  - sessionStorage setup (_pendingPw, _signupOptin, selectedPersonId)
 *  - Safe post-signup navigation with unmount-safe timeout cancellation
 *
 * Returns: { submit, loading, error, setError, success, redirectTo }
 */
export function useSignup() {
  const navigate = useNavigate();
  const { setToken, setUser } = useAuth();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [redirectTo, setRedirectTo] = useState('/dashboard');

  // Cancel pending navigation timeout if component unmounts before it fires.
  const timeoutRef = useRef(null);
  useEffect(() => {
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, []);

  /**
   * @param {object} opts
   * @param {string}  opts.email
   * @param {string}  opts.password
   * @param {boolean} [opts.optin=false]        - Marketing optin chosen at signup
   * @param {string}  [opts.selectedPersonId]   - Teaser person ID from URL/session
   * @param {string}  [opts.queryString]        - Attribution query string for BC
   * @param {string}  [opts.redirectParam]      - Value of ?redirect= param (validated)
   * @param {object}  [opts.extraPayload]       - Extra fields for api.signup (fullName, zip, intent)
   * @returns {Promise<boolean>} true on success
   */
  const submit = useCallback(async ({
    email,
    password,
    optin = false,
    selectedPersonId = null,
    queryString = undefined,
    redirectParam = null,
    extraPayload = {},
  }) => {
    setError('');
    const pwError = validatePassword(password);
    if (pwError) {
      setError(pwError);
      track('validation_error', { reason: 'password_too_short', step: 'signup' });
      return false;
    }
    setLoading(true);
    // Every signup is a captured email lead → post to our /api/leads endpoint (independent
    // of BC; fire-and-forget + localStorage fallback). Fires here so a lead is recorded even
    // if BC later rejects (e.g. email already exists).
    captureEmail(email, { source: 'signup', selected: !!selectedPersonId });
    try {
      const response = await api.signup({
        email,
        password,
        optin: !!optin,
        queryString: queryString || undefined,
        ...extraPayload,
      });

      if (response.accessToken) {
        const userData = response.user || { email, role: 'member', emailVerified: false };
        setToken(response.accessToken);
        setUser(userData);
        localStorage.setItem('accessToken', response.accessToken);
        localStorage.setItem('user', JSON.stringify(userData));
        if (response.refreshToken) localStorage.setItem('refreshToken', response.refreshToken);
        // Push user identity into the GTM dataLayer context so every
        // subsequent event (including the gtmSignUp below) carries it.
        gtmSetUser({
          email: userData.email || email,
          firstName: userData.firstName || extraPayload?.firstName,
          lastName: userData.lastName || extraPayload?.lastName,
          phone: userData.phone || extraPayload?.phone,
          zip: userData.zip || extraPayload?.zip,
        });
        // Welcome email via our own platform (fire-and-forget; no-op until SendGrid is live).
        sendCampaignEmail({ to: email, campaign: 'welcome', vars: { firstName: userData.firstName || extraPayload?.firstName || '' }, meta: { source: 'signup' } });
      }

      // Store password (encoded) so PaymentPage can call changePassword after billing.sale.
      // Removed by PaymentPage immediately after use.
      sessionStorage.setItem('_pendingPw', encodePw(password));

      // Store optin choice — not on the synthetic BC token, so PaymentPage reads this.
      sessionStorage.setItem('_signupOptin', optin ? '1' : '0');

      if (selectedPersonId) {
        sessionStorage.setItem('selectedPersonId', selectedPersonId);
      }

      // Validate redirect target against whitelist to prevent open redirect.
      let target = redirectParam || (selectedPersonId ? '/payment' : '/dashboard');
      if (!isSafeRedirect(target)) target = selectedPersonId ? '/payment' : '/dashboard';

      setRedirectTo(target);
      // Resolve the search funnel type so GA4 can split signup by funnel.
      let searchType;
      try {
        const ctx = JSON.parse(sessionStorage.getItem('searchContext') || '{}');
        searchType = ctx?.teaserInput?.type || ctx?.type || undefined;
      } catch { /* no-op */ }
      // userId makes this partner-attributed conversion (data.refer is auto-
      // attached by track) joinable to the user in BC's tracking store — the
      // queryable attribution path while order-level commerceorders.refer
      // isn't persisting (#77).
      track('signup_complete', { source: 'signup', search_type: searchType, userId: response.user?._id || response.user?.id });
      gtmSignUp({ method: 'email', search_type: searchType });
      recordLogin({ method: 'signup', source: 'signup_flow', email });
      // BC compliance tracking — record T&C/FCRA agreement timestamp on BC side.
      api.createTracking({
        type: 'agreement',
        event: 'signup_tos',
        date: new Date().toISOString(),
        email,
      });
      // Replay any visitor searches captured before signup so the new member's
      // history isn't blank. Fire-and-forget — clear local log only on success.
      try {
        const { items } = readVisitorSearchLog();
        if (items.length > 0 && response.accessToken) {
          api.post('/searches/import', {
            body: { items },
            token: response.accessToken,
          })
            .then(() => clearVisitorSearchLog())
            .catch((err) => {
              if (process.env.NODE_ENV === 'development') {
                console.warn('[visitorSearchLog] import failed:', err?.message);
              }
            });
        }
      } catch (err) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('[visitorSearchLog] flush threw:', err?.message);
        }
      }
      setSuccess(true);
      timeoutRef.current = setTimeout(() => navigate(target), 2000);
      return true;
    } catch (err) {
      const errorType = err.code === 'USER_ALREADY_EXISTS' ? 'already_exists' : 'signup_failed';
      track('signup_error', { errorType, errorMessage: err.message });
      gtmEvent('signup_error', { error_type: errorType });
      if (err.code === 'USER_ALREADY_EXISTS') {
        setError('already_exists');
      } else {
        setError(err.message || 'An error occurred during signup. Please try again.');
      }
      return false;
    } finally {
      setLoading(false);
    }
  }, [navigate, setToken, setUser]);

  return { submit, loading, error, setError, success, redirectTo };
}
