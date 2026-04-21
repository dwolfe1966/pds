import { useCallback, useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import { track } from '../services/trackingService';
import { gtmEvent } from '../services/gtm';

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
 * Validate password meets BC complexity requirements:
 * min 8 chars, uppercase, lowercase, number, special character.
 * Returns null if valid, or an error message string.
 */
export function validatePassword(pw) {
  if (!pw || pw.length < 8) return 'Password must be at least 8 characters.';
  if (!/[A-Z]/.test(pw)) return 'Password must contain at least one uppercase letter.';
  if (!/[a-z]/.test(pw)) return 'Password must contain at least one lowercase letter.';
  if (!/[0-9]/.test(pw)) return 'Password must contain at least one number.';
  if (!/[^A-Za-z0-9]/.test(pw)) return 'Password must contain at least one special character.';
  return null;
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
      return false;
    }
    setLoading(true);
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
      track('signup_complete', { source: 'signup' });
      gtmEvent('sign_up', { method: 'email' });
      // BC compliance tracking — record T&C/FCRA agreement timestamp on BC side.
      api.createTracking({
        type: 'agreement',
        event: 'signup_tos',
        date: new Date().toISOString(),
        email,
      });
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
