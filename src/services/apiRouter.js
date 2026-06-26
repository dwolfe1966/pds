/**
 * Hybrid API Router
 * 
 * Intelligently routes API requests to either the new API or mock API
 * based on endpoint availability and feature flags.
 */

import { getEndpointConfig, isAvailableInNewAPI, isAvailableInMockAPI } from './apiEndpointRegistry';
import apiWrapper from './apiWrapper';
import { adaptTeaserResponse, adaptReportDetailResponse, adaptReportListResponse } from './apiAdapter';
import { dbg, dbgWarn, dbgError } from './_debug';
import { setBcAttributionFromResponse } from './gtmContext';

// Environment configuration
const USE_NEW_API = process.env.REACT_APP_NEW_API_ENABLED === 'true';
const USE_MOCK_API = process.env.REACT_APP_USE_MOCK_API === 'true'; // Default to false (safe for production)
const MOCK_API_URL = process.env.REACT_APP_API_URL ||
  (process.env.NODE_ENV === 'development' ? 'http://localhost:3001/api/v1' : '/api/v1');

// ---------------------------------------------------------------------------
// BC synthetic session helpers
// BC uses cookie-based sessions and does not issue JWTs to clients.
// When BC auth succeeds we create a lightweight signed-less token so that
// AuthContext / ProtectedRoute (which look for an accessToken in localStorage)
// still work.  The token is NOT cryptographically verified — it exists only for
// client-side route-gating.  Actual API authentication is handled by the BC
// session cookie set during login.
// ---------------------------------------------------------------------------
function createBcSessionToken(user) {
  const payload = {
    bcSession: true,
    user: user || { role: 'member' },
    iat: Date.now(),
    exp: Date.now() + 24 * 60 * 60 * 1000, // 24 h
  };
  return btoa(JSON.stringify(payload));
}

/**
 * Returns the decoded payload if `token` is a BC synthetic session token
 * that has not expired, otherwise returns null.
 */
function decodeBcSessionToken(token) {
  if (!token) return null;
  // Real JWTs have exactly 3 dot-separated segments.
  if (token.split('.').length === 3) return null;
  try {
    const data = JSON.parse(atob(token));
    if (data.bcSession && data.exp > Date.now()) return data;
  } catch {
    // not a BC token
  }
  return null;
}

// Per-endpoint feature flags
const FEATURE_FLAGS = {
  'teaser-search': process.env.REACT_APP_USE_NEW_API_SEARCH === 'true',
  'create-report': process.env.REACT_APP_USE_NEW_API_REPORTS === 'true',
  'get-report': process.env.REACT_APP_USE_NEW_API_REPORTS === 'true',
  'report-list': process.env.REACT_APP_USE_NEW_API_REPORTS === 'true',
  'opt-out-confirmation': process.env.REACT_APP_USE_NEW_API_OPTOUT === 'true',
  'commerce-billing-sale': true, // Always use new API when available
  'commerce-billing-signup': true, // Always use new API when available
  'login': process.env.REACT_APP_USE_NEW_API_AUTH === 'true',
  'logout': process.env.REACT_APP_USE_NEW_API_AUTH === 'true',
};

// Token getter function - will be set by AuthContext
let getToken = () => null;

export const setTokenGetter = (fn) => {
  getToken = fn;
};

// Admin (CSR) API handler — registered by src/admin-index.js via setAdminHandler.
// Kept as an injectable so apiRouter.js never imports apiRouterAdmin/apiWrapperCsr,
// keeping the BC csrWrapper surface out of the consumer bundle. Consumer builds
// never register a handler and never dispatch admin-* endpoints.
let _adminHandler = null;
export const setAdminHandler = (fn) => { _adminHandler = fn; };

// Logout handler - set by AuthContext so apiRouter can trigger logout on 401
let doLogout = () => {};
let _logoutInFlight = false;

export const setLogoutHandler = (fn) => {
  doLogout = async () => {
    if (_logoutInFlight) return;
    _logoutInFlight = true;
    try { await fn(); } finally { _logoutInFlight = false; }
  };
};

/**
 * Make a request to the mock API
 */
async function callMockAPI(endpoint, params = {}) {
  // If path is provided directly, use it; otherwise construct from endpoint
  let path = params.path;
  if (!path) {
    path = getMockAPIPath(endpoint, params);
  }
  
  const { method = 'GET', body, queryParams, token: providedToken } = params;
  
  // Construct URL properly.
  // MOCK_API_URL may be absolute ('http://localhost:3001/api/v1') in dev or
  // relative ('/api/v1') in production. new URL() requires an absolute base,
  // so supply window.location.origin as the fallback base for relative URLs.
  const cleanPath = path.startsWith('/') ? path.substring(1) : path;
  const baseUrl = MOCK_API_URL.endsWith('/') ? MOCK_API_URL : `${MOCK_API_URL}/`;
  const fullUrl = `${baseUrl}${cleanPath}`;
  const urlBase = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  const url = new URL(fullUrl, urlBase);
  if (queryParams) {
    Object.entries(queryParams).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, value);
      }
    });
  }

  const headers = {
    'Content-Type': 'application/json',
  };

  // Use provided token, then getter, then localStorage (so payment works after signup redirect)
  const token = providedToken || getToken() ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('accessToken') : null);
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  } else if (process.env.NODE_ENV === 'development') {
    dbgWarn(`[callMockAPI] No token provided for endpoint: ${endpoint}. Request may fail if authentication is required.`);
  }

  const options = {
    method,
    headers,
  };

  if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url.toString(), options);

  // 401 handling: BC session users get a safe throw (no logout); JWT users get a refresh attempt.
  // Skip for auth endpoints (login/refresh) — wrong credentials should not trigger logout.
  const AUTH_ENDPOINTS = new Set(['login', 'logout', 'refresh-token', 'signup']);
  if (response.status === 401 && !params._retried && !AUTH_ENDPOINTS.has(endpoint)) {
    const storedToken = typeof localStorage !== 'undefined' ? localStorage.getItem('accessToken') : null;
    const refreshToken = typeof localStorage !== 'undefined' ? localStorage.getItem('refreshToken') : null;

    // BC mode: synthetic session token — mock server cannot validate these tokens,
    // so a 401 here means the endpoint is mock-only and the BC session is still valid.
    // Do NOT call doLogout() — that would terminate an active BC session unnecessarily.
    // Just throw so the calling page can handle gracefully (e.g. show empty state).
    const bcSession = decodeBcSessionToken(storedToken);
    if (bcSession) {
      const error = new Error('This feature is not yet available in your account.');
      error.status = 401;
      error.isMockUnavailable = true;
      throw error;
    }

    // JWT mode: hit the mock refresh endpoint.
    if (!refreshToken) {
      doLogout();
      throw new Error('Session expired. Please log in again.');
    }
    try {
      const refreshRes = await fetch(`${MOCK_API_URL}/refresh-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!refreshRes.ok) {
        doLogout();
        throw new Error('Session expired. Please log in again.');
      }
      const refreshData = await refreshRes.json();
      const newToken = refreshData.accessToken;
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('accessToken', newToken);
      }
      setTokenGetter(() => newToken);
      return await callMockAPI(endpoint, { ...params, token: newToken, _retried: true });
    } catch (refreshErr) {
      doLogout();
      throw refreshErr;
    }
  }

  if (!response.ok) {
    let errorData;
    try {
      errorData = await response.json();
    } catch (e) {
      errorData = { message: response.statusText };
    }
    
    const errorMessage = errorData?.error?.message || errorData?.message || `API request failed: ${response.statusText}`;
    const error = new Error(errorMessage);
    error.status = response.status;
    error.statusText = response.statusText;
    error.data = errorData;
    error.isApiError = true; // Flag to identify API errors
    
    if (process.env.NODE_ENV === 'development') {
      // Use console.warn instead of console.error to avoid triggering React error overlay
      dbgWarn(`[callMockAPI] Request failed for ${endpoint}:`, {
        status: response.status,
        statusText: response.statusText,
        url: url.toString(),
        hasToken: !!token,
        error: errorData
      });
    }
    
    throw error;
  }

  // Handle no-content responses (e.g., logout)
  if (response.status === 204 || response.status === 205) {
    return null;
  }
  const contentLength = response.headers.get('content-length');
  if (contentLength === '0') {
    return null;
  }

  return await response.json();
}

/**
 * Route API request to appropriate API.
 * Wrapper that captures BC shared-host attribution (shConId/shColId/brandId)
 * from every response into the GTM dataLayer context.
 */
export async function routeApiRequest(endpoint, params = {}) {
  const response = await _routeApiRequestInner(endpoint, params);
  try { setBcAttributionFromResponse(response); } catch { /* never block on telemetry */ }
  return response;
}

async function _routeApiRequestInner(endpoint, params = {}) {
  const endpointConfig = getEndpointConfig(endpoint);
  // Check if feature flag is explicitly set to true (not just not false)
  const featureFlagEnabled = FEATURE_FLAGS[endpoint] === true;
  // Force new API – no mock fallback for these endpoints
  const FORCE_NEW_API_ENDPOINTS = new Set([
    'create-report', 'get-report', 'report-list',
    'commerce-billing-sale', 'commerce-billing-signup',
    'download-pdf-report',
    'get-shape-compiled',
    // Auth & user creation — BC is the production user DB
    'login', 'logout', 'signup',
    // Subscription status — must come from BC, not mock
    'get-user-orders',
    // User activity statistics — BC only
    'count-teaser-searches',
    'count-report-creations',
    'count-pdf-downloads',
    // Activated product types — BC only
    'get-activated-product-types',
    // Member self-serve profile update + password change + cancel + offer lookup — BC only
    'update-profile',
    'change-password',
    'cancel-subscription',
    'find-offer',
    // Admin (CSR) endpoints — BC only, no mock fallback
    'admin-users',
    'admin-user-detail',
    'admin-suspend-user',
    'admin-purchases',
    'admin-purchase-detail',
    'admin-refund',
    'admin-data-removal',
    'admin-cs-reps',
    'admin-create-cs-rep',
    'admin-update-cs-rep',
    'admin-update-user',
    'admin-find-managed-contact',
    'admin-unsubscribe-managed-contact',
    'admin-find-offer',
    'admin-cancel-order',
    'admin-order-payments',
    'admin-order-histories',
    'admin-order-detail',
    'admin-update-schedule',
    'admin-unsubscribe',
    'admin-unsubscribe-delete',
    'admin-unsuspend-user',
    'admin-purchases-global',
    'admin-phone-optout',
    'admin-phone-optout-delete',
    'admin-user-contacts',
    'admin-find-user-notes',
    'admin-find-all-user-contacts',
    'admin-create-order',
    'admin-create-note',
    'admin-create-contact-note',
    'admin-update-note',
    'admin-create-csr-mail',
    'admin-user-tracking',
    // Consumer: user's own support messages
    'get-user-contacts',
    // Contact / messaging — BC endpoints
    'create-contact-message',
    'reply-contact-message',
    'contact-histories',
    'tracking-create',
    'admin-find-contacts',
    'admin-change-contact-to-user',
    'admin-find-contact-messages',
    'admin-find-user-contact-messages',
    'admin-contact-histories',
    'admin-download-attachment',
    'admin-create-csr-reply',
    'admin-set-contact-actor',
    'admin-set-contact-target-user',
    'admin-set-contact-tags',
  ]);
  const forceNewApi = FORCE_NEW_API_ENDPOINTS.has(endpoint);
  // CSR (admin-*) endpoints use direct fetch, not the IIFE — check isCsrReady() instead
  const isCsrEndpoint = endpoint.startsWith('admin-');
  // Use new API if forced and available, otherwise require flags
  const useNewAPI =
    (forceNewApi && (isCsrEndpoint ? apiWrapper.isCsrReady() : apiWrapper.isAvailable())) ||
    (USE_NEW_API && endpointConfig.newApi && featureFlagEnabled);
  // Avoid mock for forced endpoints
  const useMockAPI = USE_MOCK_API && endpointConfig.mockApi && !forceNewApi;

  // Log which API is being used (for debugging)
  if (process.env.NODE_ENV === 'development') {
    dbg(`[API Router] ${endpoint}:`, {
      USE_NEW_API,
      endpointAvailable: endpointConfig.newApi,
      featureFlag: FEATURE_FLAGS[endpoint],
      featureFlagEnabled,
      useNewAPI,
      useMockAPI,
      available: { newApi: endpointConfig.newApi, mockApi: endpointConfig.mockApi },
      envVars: {
        NEW_API_ENABLED: process.env.REACT_APP_NEW_API_ENABLED,
        USE_NEW_API_SEARCH: process.env.REACT_APP_USE_NEW_API_SEARCH
      }
    });
  }

  // Try new API first if available and enabled
    if (useNewAPI && apiWrapper.isAvailable()) {
    try {
      const result = await callNewAPI(endpoint, params);
      return result;
    } catch (error) {
        if (forceNewApi) {
          // Do not fall back to mock for forced new API endpoints
          throw error;
        }
      // Check if this is a CORS error or network error
      const isCorsError = error.isCorsError ||
                         error.message?.includes('CORS') || 
                         error.message?.includes('Access-Control-Allow-Origin') ||
                         error.message?.includes('Failed to fetch') ||
                         error.message?.includes('NetworkError') ||
                         error.name === 'NetworkError' ||
                         (error.code === 'ERR_FAILED' && !error.response) ||
                         (error.originalError && (
                           error.originalError.message?.includes('CORS') ||
                           error.originalError.message?.includes('Access-Control-Allow-Origin') ||
                           error.originalError.message?.includes('Failed to fetch')
                         ));
      
      if (isCorsError) {
        dbgWarn(`[API Router] CORS error detected for ${endpoint}. This is expected in development when the API server doesn't allow localhost. Falling back to mock API.`);
      } else {
        dbgWarn(`[API Router] New API failed for ${endpoint}, falling back to mock API:`, error.message || error);
      }
      
      // Fallback to mock API if new API fails (teaser-search excluded – force ByteCrtrs for debugging)
      if (useMockAPI) {
        try {
          return await callMockAPI(endpoint, params);
        } catch (fallbackError) {
          dbgError(`[API Router] Both new API and mock API failed for ${endpoint}:`, fallbackError);
          throw fallbackError;
        }
      }
      throw error;
    }
  }

  // Use mock API if new API not available or disabled
  if (useMockAPI) {
    // For search endpoints, convert to query params format
    if (endpoint === 'teaser-search') {
      const { firstName, lastName, fName, lName, phone, state, zip } = params;
      const queryParams = {
        firstName: firstName || fName,
        lastName: lastName || lName,
        phone,
        state,
        zip,
        limit: 20
      };
      if (process.env.NODE_ENV === 'development') {
        dbg('[Mock API Search] Params sent to /search:', JSON.stringify(queryParams, null, 2));
        dbg('[Mock API Search] Results-per-page (limit):', queryParams.limit);
      }
      return await callMockAPI(endpoint, {
        method: 'GET',
        queryParams
      });
    }
    if (endpoint === 'create-report') {
      const { token, ...body } = params || {};
      return await callMockAPI(endpoint, {
        method: 'POST',
        body,
        token
      });
    }
    return await callMockAPI(endpoint, params);
  }

  // Neither API available
  throw new Error(`Endpoint ${endpoint} is not available in either API`);
}

/**
 * Call the new API using the wrapper
 */
async function callNewAPI(endpoint, params) {
  // Admin (CSR) endpoints are dispatched through an injected handler so the BC
  // csrWrapper surface lives only in the admin bundle. setAdminHandler() is
  // called by src/admin-index.js; consumer builds never register it.
  if (endpoint.startsWith('admin-')) {
    if (!_adminHandler) throw new Error('Admin API handler not registered');
    return await _adminHandler(endpoint, params);
  }
  switch (endpoint) {
    case 'login': {
      const loginBody = params.body || params;
      // ByteCrtrs auth.login expects { username, password } — map from our { email, password }
      const bcBody = {
        username: loginBody.username || loginBody.email,
        password: loginBody.password,
      };

      // 1. Login via ByteCrtrs — establishes session cookie needed for report endpoints.
      const raw = await apiWrapper.login(bcBody);

      // ── FULL RAW RESPONSE DUMP (dev only) ────────────────────────────────────
      if (process.env.NODE_ENV === 'development') {
        dbg('[BC Login] ===== RAW IIFE RESPONSE =====');
        dbg('[BC Login] typeof raw:', typeof raw);
        dbg('[BC Login] raw keys:', raw ? Object.keys(raw) : 'null/undefined');
        try { dbg('[BC Login] JSON.stringify(raw):', JSON.stringify(raw)?.substring(0, 2000)); } catch(e) { dbg('[BC Login] raw not serialisable:', e.message); }
        if (raw?.params) {
          dbg('[BC Login] raw.params keys:', Object.keys(raw.params));
          dbg('[BC Login] raw.params.response?.status:', raw.params.response?.status);
          try { dbg('[BC Login] raw.params.response?.data:', JSON.stringify(raw.params.response?.data)?.substring(0, 2000)); } catch(e) {}
          try { dbg('[BC Login] raw.params.error:', JSON.stringify(raw.params.error)?.substring(0, 500)); } catch(e) {}
        }
        if (typeof raw?.getData === 'function') {
          try { dbg('[BC Login] raw.getData():', JSON.stringify(raw.getData())?.substring(0, 2000)); } catch(e) {}
        }
        if (typeof raw?.getError === 'function') {
          try { dbg('[BC Login] raw.getError():', JSON.stringify(raw.getError())?.substring(0, 500)); } catch(e) {}
        }
        dbg('[BC Login] ===== END RAW RESPONSE =====');
      }
      // ─────────────────────────────────────────────────────────────────────────

      // The IIFE swallows HTTP errors and returns them as wrapped objects instead of throwing.
      // Detect this before trying to extract user data — otherwise a 401 silently falls through
      // to createBcSessionToken and the app "logs in" with no real BC session.
      const iifLoginErr = raw?.params?.error ?? raw?.getError?.();
      if (iifLoginErr) {
        const errData = iifLoginErr?.response?.data;
        const errStatus = iifLoginErr?.response?.status ?? iifLoginErr?.status;
        const errMsg = errData?.message || errData?.error || iifLoginErr?.message || 'Login failed';
        const err = new Error(errMsg);
        err.status = errStatus;
        throw err;
      }

      const d = raw?.getData?.() ?? raw?.data ?? raw ?? {};

      if (process.env.NODE_ENV === 'development') {
        dbg('[BC Login] Response keys:', Object.keys(d || {}));
        dbg('[BC Login] accessToken present:', !!(d.accessToken || d.token || d.jwt || d.access_token));
      }

      const bcToken = d.accessToken || d.token || d.jwt || d.access_token || raw?.accessToken;
      const bcRefresh = d.refreshToken || d.refresh_token || raw?.refreshToken;
      // BC's login response sometimes nests the user under .user, sometimes
      // returns user fields at the top level (matching the CSR doc shape:
      // { _id, email, firstName, lastName, roles, ... }). Detect either.
      const looksLikeUser = !!(d && (d.firstName || d.lastName || d._id || d.uniqueId));
      const rawUser = d.user || d.userData || d.profile || raw?.user || (looksLikeUser ? d : {
        email: loginBody.email || loginBody.username,
      });

      // BC returns roles as an array; normalize to a single role string for ProtectedRoute.
      // BC uses 'csr' or 'admin' to denote admin-level users.
      if (process.env.NODE_ENV === 'development') {
        dbg('[BC Login] rawUser:', JSON.stringify(rawUser));
      }
      const rolesArray = Array.isArray(rawUser.roles) ? rawUser.roles : [];
      const loginEmail = (loginBody.email || loginBody.username || '').toLowerCase().trim();

      // Check admin allowlist from env — covers cases where BC doesn't return role in login response.
      const adminEmails = (process.env.REACT_APP_ADMIN_EMAILS || '')
        .split(',')
        .map(e => e.toLowerCase().trim())
        .filter(Boolean);
      const isInAllowlist = adminEmails.includes(loginEmail);

      // BC denotes staff with role strings like 'admin', 'csr', and 'csrManager'
      // (verified live 2026-06-16: frontend@csrManager.pds → roles:['csrManager']).
      // Match any admin*/csr* role rather than an exact 'csr'/'admin' string, so new
      // CSR tiers authenticate without a code change. Additional non-prefixed role
      // names can be allow-listed via REACT_APP_ADMIN_ROLES (comma-list, exact match,
      // case-insensitive). 'member' never matches either rule.
      const extraAdminRoles = (process.env.REACT_APP_ADMIN_ROLES || '')
        .split(',')
        .map(r => r.toLowerCase().trim())
        .filter(Boolean);
      const isStaffRole = (r) => {
        if (typeof r !== 'string') return false;
        const role = r.toLowerCase().trim();
        return /^(admin|csr)/.test(role) || extraAdminRoles.includes(role);
      };
      const isAdmin =
        isInAllowlist ||
        isStaffRole(rawUser.role) ||
        rolesArray.some(isStaffRole);

      if (process.env.NODE_ENV === 'development') {
        dbg('[BC Login] isAdmin:', isAdmin, '(allowlist:', isInAllowlist, ', roles:', rolesArray, ')');
      }

      const bcUser = {
        ...rawUser,
        role: isAdmin ? 'admin' : (rawUser.role || 'member'),
      };

      // 3. If BC returned a real JWT, use it directly.
      if (bcToken) {
        return { accessToken: bcToken, refreshToken: bcRefresh, user: bcUser };
      }

      // 4. BC uses cookie-based sessions — no JWT issued to client.
      //    The BC session cookie is now set (reports/billing will work).
      //    Create a synthetic session token for app-level route protection only.
      if (process.env.NODE_ENV === 'development') {
        dbg('[BC Login] BC session established (cookie). Issuing synthetic session token for app routing.');
      }
      return {
        accessToken: createBcSessionToken(bcUser),
        refreshToken: null,
        user: bcUser,
      };
    }
    
    case 'logout':
      try {
        return await apiWrapper.logout();
      } catch (err) {
        // BC logout failure should not block local session teardown.
        if (process.env.NODE_ENV === 'development') {
          dbgWarn('[BC Logout] request failed (ignored):', err?.message);
        }
        return { success: true };
      }

    case 'signup': {
      // BC's billing.sale creates the user AND processes payment in one step.
      // Calling billing.signup here before billing.sale would register the user as a
      // "member" in BC first, causing billing.sale to reject with { status: "rejected" }
      // because the offer has nonMemberOnly: true.
      // Solution: skip billing.signup entirely — just issue a synthetic app-level session
      // token from the form data so the user can navigate to PaymentPage. The real BC
      // user creation happens inside billing.sale on PaymentPage.
      const body = params.body || params;
      const nameParts = (body.fullName || '').trim().split(/\s+/);
      const firstName = body.firstName || nameParts[0] || '';
      const lastName = body.lastName || nameParts.slice(1).join(' ') || '';

      const bcUser = {
        email: body.email,
        firstName,
        lastName,
        fullName: `${firstName} ${lastName}`.trim(),
        // Optional phone from signup — flows to user.phone, used at billing.sale and
        // shown/editable in the Account → Profile tab.
        ...(body.phone ? { phone: String(body.phone).trim() } : {}),
        role: 'member',
      };

      return {
        accessToken: createBcSessionToken(bcUser),
        refreshToken: null,
        user: bcUser,
      };
    }
    
    case 'teaser-search': {
      // Convert params to new API format
      const query = { ...params };
      // Map firstName/lastName to fName/lName if needed
      if (query.firstName && !query.fName) {
        query.fName = query.firstName;
        delete query.firstName;
      }
      if (query.lastName && !query.lName) {
        query.lName = query.lastName;
        delete query.lastName;
      }
      // BC teaser docs do not list perPage as an input; BC returns its default
      // page size (~5) and additional results must be fetched via response.getMore().
      delete query.perPage;
      delete query.per_page;
      delete query.pageSize;
      const isPaginationRequest = !!query.commerceContentId && query.page != null;
      if (process.env.NODE_ENV === 'development') {
        dbg('[ByteCrtrs Search] All params sent to searchTeaser:', JSON.stringify(query, null, 2));
        dbg('[ByteCrtrs Search] Pagination request (getMore):', isPaginationRequest);
      }
      const response = await apiWrapper.searchTeaser(query);
      const adapted = adaptTeaserResponse(response);
      // Attach raw response for pagination (hasMore, getMore)
      if (response && typeof response.hasMore === 'function' && typeof response.getMore === 'function') {
        adapted.rawResponse = response;
        adapted.pagination = {
          ...adapted.pagination,
          hasMore: response.hasMore(),
          total: typeof response.getTotalCount === 'function' ? response.getTotalCount() : adapted.pagination?.total
        };
      }
      return adapted;
    }
    
    case 'create-report': {
      const response = await apiWrapper.createReport(params);
      const adapted = adaptReportDetailResponse(response);
      // Upstream library can swallow HTTP errors (4xx) and return empty data.
      // Detect that and throw a generic error — internal vendor names and HTTP
      // details are preserved on the error object for dev inspection but the
      // user-visible message stays neutral.
      if (!adapted.commerceContentId) {
        const rawData = response?.getData?.() ?? response?.params?.response?.data ?? response;
        const httpStatus = rawData?.status || response?.params?.response?.status || null;
        const err = new Error('We couldn\'t generate this report right now. Please try again in a moment.');
        err.upstreamResponse = rawData;
        err.httpStatus = httpStatus;
        if (process.env.NODE_ENV === 'development') {
          dbgError('[API Router] create-report failed — raw response:', JSON.stringify(rawData, null, 2));
        }
        throw err;
      }
      return adapted;
    }

    case 'get-report': {
      if (!params?.id || params.id === 'undefined' || params.id === 'null') {
        throw new Error('Report id is required.');
      }
      const response = await apiWrapper.getReportDetail(params.id);
      const adapted = adaptReportDetailResponse(response);
      if (!adapted.commerceContentId) {
        const rawData = response?.getData?.() ?? response?.params?.response?.data ?? response;
        const err = new Error('We couldn\'t load this report right now. Please try again in a moment.');
        err.upstreamResponse = rawData;
        if (process.env.NODE_ENV === 'development') {
          dbgError('[API Router] get-report failed — raw response:', JSON.stringify(rawData, null, 2));
        }
        throw err;
      }
      return adapted;
    }
    
    case 'report-list': {
      // Strip our JWT token — ByteCrtrs manages its own session auth
      const { token, ...listParams } = params || {};
      const response = await apiWrapper.getReportList(listParams);
      return adaptReportListResponse(response);
    }
    
    case 'opt-out-confirmation':
      return await apiWrapper.confirmOptOut(params);


    case 'commerce-billing-sale':
      return await apiWrapper.sale(params.body || params);

    case 'commerce-billing-signup':
      return await apiWrapper.billingSignup(params.body || params);

    case 'get-user-orders': {
      // Returns array of orders. Subscriber = at least one with status 'active' + transient.canceled false.
      const raw = await apiWrapper.getOrders();
      // BC wraps responses; unwrap to get the actual data payload.
      const d = raw?.getData?.() ?? raw?.params?.response?.data ?? raw?.data ?? raw;
      if (process.env.NODE_ENV === 'development') {
        dbg('[BC getUserOrders] raw keys:', Object.keys(raw || {}));
        dbg('[BC getUserOrders] unwrapped data:', JSON.stringify(d)?.substring(0, 600));
      }
      // BC may return the orders array directly, or under { orders: [...] } / { raws: [...] }
      if (Array.isArray(d)) return d;
      if (Array.isArray(d?.orders)) return d.orders;
      if (Array.isArray(d?.raws)) return d.raws;
      // A non-array response is NOT "no orders" — BC returns 403 for that (which throws).
      // Reaching here with a gateway-error payload (the IIFE swallows a 502 'Bad Gateway'
      // HTML into a non-array) means BC is unreachable. Surface it as a 5xx so AuthContext
      // shows "can't reach servers" instead of rendering a paid member as unpaid.
      const blob = typeof d === 'string' ? d : JSON.stringify(d ?? raw ?? '');
      if (/<html|bad gateway|gateway time-?out|\b50[234]\b/i.test(blob)) {
        const e = new Error('BC gateway error on getUserOrders');
        e.status = 503;
        throw e;
      }
      return [];
    }

    case 'count-teaser-searches':
      return await apiWrapper.countUserTeaserSearches();

    case 'count-report-creations':
      return await apiWrapper.countUserReportCreations();

    case 'count-pdf-downloads':
      return await apiWrapper.countUserPdfDownloads();

    case 'get-activated-product-types':
      return await apiWrapper.getActivatedProductTypes();

    // Update logged-in user's profile (firstName/lastName/phone).
    // BC apiWrapper.api.user.update — POST /api/user/update
    case 'update-profile': {
      const body = params.body || {};
      return await apiWrapper.userUpdate(body);
    }

    // POST /api/user/changePassword via wrapper.api.user.changePassword
    // AccountPage sends { currentPassword, newPassword }; BC only needs the new one.
    case 'change-password': {
      const body = params.body || {};
      return await apiWrapper.changePassword({ newPassword: body.newPassword });
    }

    // POST /api/commerceBilling/cancelOrUncancelOrder via wrapper.api.commerceBilling
    // Accepts { orderId, flag } where flag=true cancels, flag=false reactivates.
    case 'cancel-subscription': {
      const body = params.body || params || {};
      return await apiWrapper.cancelOrder({
        orderId: body.orderId,
        flag: body.flag === undefined ? true : body.flag,
      });
    }

    // Look up a commerce offer by shmName (e.g. 'comp.offer.signup.main').
    // BC apiWrapper.api.offer.findByShmName — POST /commerce/offer/findByShmName
    case 'find-offer': {
      const { shmName, key } = params;
      return await apiWrapper.findOfferByShmName({ shmName, key });
    }

    case 'download-pdf-report':
      return await apiWrapper.downloadPdfReport(params.commerceContentId || params.id);

    case 'get-shape-compiled':
      return await apiWrapper.getShapeCompiled();


    // Consumer: user's own support messages — user.getContacts({ lastId? })
    case 'get-user-contacts': {
      return await apiWrapper.getUserContacts(params.lastId);
    }

    // Consumer: create contact message — new BC spec (2026-04-17)
    // apiWrapper.api.message.contact.create → POST /api/contactMessage/create
    case 'create-contact-message': {
      return await apiWrapper.createContactMessage(params.body || {});
    }

    // Consumer: reply to contact message thread
    // apiWrapper.api.message.contact.reply → POST /api/contactMessage/userReply
    case 'reply-contact-message': {
      return await apiWrapper.replyContactMessage(params.body || {});
    }

    // Consumer: fetch contact message thread history
    // apiWrapper.api.message.contact.histories → GET /api/contactMessage/histories
    case 'contact-histories': {
      return await apiWrapper.getContactHistories(params.queryParams || params.body || {});
    }

    // Consumer: record a tracking event (agreement timestamps, compliance).
    // apiWrapper.api.tracking.create → POST /api/tracking/create
    case 'tracking-create': {
      return await apiWrapper.createTracking(params.body || {});
    }


    default:
      throw new Error(`Endpoint ${endpoint} not implemented in new API router`);
  }
}

/**
 * Map endpoint names to mock API paths
 */
export function getMockAPIPath(endpoint, params = {}) {
  const pathMap = {
    'signup': '/signup',
    'login': '/login',
    'logout': '/logout',
    'refresh-token': '/refresh-token',
    'verify-email': '/verify-email',
    'get-profile': '/me',
    'update-profile': '/me',
    'get-person': `/people/${params.id}`,
    'dashboard': '/dashboard',
    'my-searches': '/searches/me',
    'lookups-of-me': '/searches/lookups-of-me',
    'delete-search': `/searches/${params.id}`,
    'create-search': '/searches',
    'search-by-address': '/search/by-address',
    'notification-preferences': '/notifications/preferences',
    'profile-views': '/profile-views',
    'profile-views-me': '/profile-views/me',
    'alerts': '/alerts',
    'create-alert': '/alerts',
    'update-alert': `/alerts/${params.id}`,
    'delete-alert': `/alerts/${params.id}`,
    'subscription': '/subscription',
    'update-subscription': '/subscription',
    'cancel-subscription': '/subscription',
    'invoices': '/invoices',
    'notifications': '/notifications',
    'mark-notification-read': `/notifications/${params.id}/read`,
    'delete-notification': `/notifications/${params.id}`,
    'privacy-settings': '/privacy',
    'change-password': '/auth/change-password',
    'enable-mfa': '/auth/mfa/enable',
    'disable-mfa': '/auth/mfa/disable',
    'admin-users': '/admin/users',
    'admin-user-detail': `/admin/users/${params.id}`,
    'admin-suspend-user': `/admin/users/${params.id}/suspend`,
    'admin-sessions': '/admin/sessions',
    'admin-purchases': '/admin/purchases',
    'admin-purchase-detail': `/admin/purchases/${params.id}`,
    'admin-refund': `/admin/purchases/${params.id}/refund`,
    'admin-data-removal': '/admin/data-removal',
    'admin-approve-removal': `/admin/data-removal/${params.id}/approve`,
    'admin-reject-removal': `/admin/data-removal/${params.id}/reject`,
    'admin-analytics': '/admin/analytics',
    'admin-cs-reps': '/admin/cs-reps',
    'admin-create-cs-rep': '/admin/cs-reps',
    'admin-update-cs-rep': `/admin/cs-reps/${params.id}`,
    'admin-unsubscribe': '/admin/unsubscribe',
    'admin-unsubscribe-delete': `/admin/unsubscribe/${params.id}`,
    // For search, use the existing mock API endpoint
    'teaser-search': '/search',
    // Report endpoints
    'create-report': '/reports',
    'get-report': `/reports/${params.id}`,
    'report-list': '/reports',
  };

  return pathMap[endpoint] || `/${endpoint}`;
}
