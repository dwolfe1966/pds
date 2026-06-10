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

      const isAdmin =
        isInAllowlist ||
        rawUser.role === 'csr' || rawUser.role === 'admin' ||
        rolesArray.includes('csr') || rolesArray.includes('admin');

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

    // -------------------------------------------------------------------------
    // Admin / CSR endpoints — BC csrWrapper API
    // BC CSR responses typically wrap lists in { raws: [...] } and single items
    // as the root object. We normalise to { data: [...] } or the raw object so
    // admin pages can use a consistent shape.
    // -------------------------------------------------------------------------
    // csrWrapper.api.user.find → POST /database/search
    // Native support for email/phone/zip/panLast4/lastId as of BC update 2026-04-07.
    // The prior commerceOrder-collection fallback is no longer needed.
    case 'admin-users': {
      const qp = params.queryParams || {};
      const raw = await apiWrapper.csrFindUsers(qp);
      const items = raw?.docs ?? raw?.raws ?? raw?.users ?? raw?.data ?? (Array.isArray(raw) ? raw : []);
      return { data: items, total: raw?.total ?? items.length, noMoreDocs: raw?.noMoreDocs };
    }

    // csrWrapper.api.user.getUserDetail → POST /user/management/detail
    case 'admin-user-detail': {
      return await apiWrapper.csrGetUserDetail(params.id);
    }

    // csrWrapper.api.user.update → POST /user/management/update
    case 'admin-suspend-user': {
      return await apiWrapper.csrUpdateUser(params.id, { status: 'suspended' });
    }

    // csrWrapper.api.user.update → POST /user/management/update (re-activate)
    case 'admin-unsuspend-user': {
      return await apiWrapper.csrUpdateUser(params.id, { status: 'active' });
    }

    // csrWrapper.api.user.findOrders → POST /commerceMgnt/userOrders → { orders: [...] }
    case 'admin-purchases': {
      const raw = await apiWrapper.csrFindUserOrders(params.queryParams || {});
      const items = raw?.orders ?? raw?.data ?? (Array.isArray(raw) ? raw : []);
      return { data: items, total: raw?.total ?? items.length };
    }

    // Global recent-orders default view.
    //
    // BC's /database/search on commerceOrder may reject unfiltered queries
    // depending on backend config — when it does, we fan out: pull the top N
    // recent customers and merge their per-user findOrders pages. Strictly
    // worse than a real global query (limited to N customers' worth of
    // orders), but produces a meaningful default view instead of an empty page.
    //
    // queryParams:
    //   - limit (default 10) — number of orders to return after merge
    //   - userPoolSize (default 25) — how many recent customers to scan when
    //     falling back. Bump if CSRs report missing recent orders.
    //   - any other filter passes straight through to the global search.
    case 'admin-purchases-global': {
      const qp = params.queryParams || {};
      const limit = Math.max(1, Math.min(100, Number(qp.limit) || 10));
      const userPoolSize = Math.max(5, Math.min(100, Number(qp.userPoolSize) || 50));

      // Diagnostics object always returned alongside data so the UI can show
      // CSRs exactly what BC did with each strategy.
      const diag = {
        triedGlobal: false, globalCount: 0, globalError: null,
        triedFanout: false, usersScanned: 0, usersWithOrders: 0,
        fanoutOrderCount: 0, fanoutError: null,
      };

      // 1. Fast path — try BC's global commerceOrder search first.
      let globalErr = null;
      try {
        diag.triedGlobal = true;
        const raw = await apiWrapper.csrFindOrders(qp);
        const items = raw?.docs ?? raw?.orders ?? raw?.data ?? (Array.isArray(raw) ? raw : []);
        diag.globalCount = items.length;
        if (items.length > 0) {
          return {
            data: items.slice(0, limit),
            total: raw?.total ?? items.length,
            noMoreDocs: raw?.noMoreDocs,
            source: 'global',
            diagnostics: diag,
          };
        }
      } catch (err) {
        globalErr = err;
        diag.globalError = err?.message || 'failed';
        dbg('[admin-purchases-global] global search failed:', err?.message);
      }

      // 2. Fan-out — pull recent customers, merge their orders.
      let recentUsers = [];
      try {
        diag.triedFanout = true;
        const usersRes = await apiWrapper.csrFindUsers({ brandId: 'idlookup' });
        const users = usersRes?.docs ?? usersRes?.users ?? usersRes?.data ?? (Array.isArray(usersRes) ? usersRes : []);
        recentUsers = users;
        const userIds = users.slice(0, userPoolSize)
          .map((u) => u?._id || u?.id)
          .filter(Boolean);
        diag.usersScanned = userIds.length;

        if (userIds.length === 0) {
          return {
            data: [],
            total: 0,
            noMoreDocs: true,
            source: 'fanout-empty',
            diagnostics: diag,
            recentUsers: [],
          };
        }

        const settle = (p) => p.then((v) => v).catch(() => null);
        const orderPages = await Promise.all(
          userIds.map((uid) => settle(apiWrapper.csrFindUserOrders({ userId: uid })))
        );

        const merged = [];
        orderPages.forEach((page, i) => {
          const arr = page?.orders ?? page?.docs ?? page?.data ?? (Array.isArray(page) ? page : []);
          if (arr.length > 0) diag.usersWithOrders += 1;
          arr.forEach((o) => {
            merged.push({ ...o, _resolvedUserId: o.payerId || userIds[i] });
          });
        });

        diag.fanoutOrderCount = merged.length;
        merged.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

        dbg('[admin-purchases-global] diagnostics:', diag);

        return {
          data: merged.slice(0, limit),
          total: merged.length,
          noMoreDocs: merged.length <= limit,
          source: merged.length > 0 ? 'fanout' : 'fanout-empty',
          userPoolSize: userIds.length,
          diagnostics: diag,
          // Pass the recent-users list back so the UI can render a "lobby"
          // when no orders surface.
          recentUsers: recentUsers.slice(0, userPoolSize).map((u) => ({
            _id: u._id || u.id,
            email: u.email,
            firstName: u.firstName,
            lastName: u.lastName,
            createdAt: u.createdAt,
          })),
        };
      } catch (fanoutErr) {
        diag.fanoutError = fanoutErr?.message || 'failed';
        dbg('[admin-purchases-global] fan-out failed:', fanoutErr?.message, diag);
        throw globalErr || fanoutErr;
      }
    }

    // csrWrapper.api.user.getOrder → POST /commerceMgnt/getUserOrder → { orders: [order] }
    case 'admin-purchase-detail': {
      const raw = await apiWrapper.csrGetUserOrder({ userId: params.userId, orderId: params.id });
      const order = raw?.orders?.[0] ?? raw?.order ?? raw;
      return order;
    }

    // csrWrapper.api.user.refundVoidOrder → POST /commerceBilling/correct
    // params must include: commercePaymentType, targetCommerceOrderId, targetCommerceOrderRevisionId,
    //                      targetCommercePaymentId, targetCommercePaymentRevisionId, amount
    case 'admin-refund': {
      return await apiWrapper.csrRefundVoidOrder(params.body || params);
    }

    // csrWrapper.api.optOut.find → POST /database/search
    case 'admin-data-removal': {
      const raw = await apiWrapper.csrFindOptOuts(params.queryParams || {});
      const items = raw?.docs ?? raw?.raws ?? raw?.optOuts ?? raw?.data ?? (Array.isArray(raw) ? raw : []);
      return { data: items, total: raw?.total ?? items.length, noMoreDocs: raw?.noMoreDocs };
    }

    // csrWrapper.api.user.findAdmin → POST /database/search (admin/csr role filter)
    // BC's findAdmin may use isAdmin flag or internal filtering.
    // Client-side filter as safety net: only return users with admin/csr roles.
    case 'admin-cs-reps': {
      const raw = await apiWrapper.csrFindCsReps(params.queryParams || {});
      const allItems = raw?.docs ?? raw?.raws ?? raw?.users ?? raw?.data ?? (Array.isArray(raw) ? raw : []);
      const items = allItems.filter(u => {
        const roles = Array.isArray(u.roles) ? u.roles : [];
        return roles.includes('admin') || roles.includes('csr');
      });
      return { data: items, total: items.length, noMoreDocs: raw?.noMoreDocs };
    }

    // csrWrapper.api.user.create → POST /user/management/create
    case 'admin-create-cs-rep': {
      return await apiWrapper.csrCreateUser(params.body || params);
    }

    // csrWrapper.api.user.update → POST /user/management/update
    case 'admin-update-cs-rep': {
      return await apiWrapper.csrUpdateUser(params.id, params.body || {});
    }

    // csrWrapper.api.user.update → POST /user/management/update
    // Same endpoint as admin-update-cs-rep, but reserved for editing customer
    // (member) accounts so callers can be wired without semantic confusion.
    case 'admin-update-user': {
      return await apiWrapper.csrUpdateUser(params.id, params.body || {});
    }

    // CSR: locate a user's managedContact record by type + contactAddress.
    case 'admin-find-managed-contact': {
      const raw = await apiWrapper.csrFindManagedContacts(params.queryParams || params.body || {});
      const docs = raw?.docs ?? (Array.isArray(raw) ? raw : []);
      return { data: docs, noMoreDocs: raw?.noMoreDocs ?? true };
    }

    // CSR: unsubscribe a managedContact record by _id.
    case 'admin-unsubscribe-managed-contact': {
      return await apiWrapper.csrUnsubscribeManagedContact(params.id || params.body?.managedContactId);
    }

    // CSR: look up an offer by shm name (real plan name + price).
    case 'admin-find-offer': {
      return await apiWrapper.csrFindOfferByShmName(params.body || params.queryParams || {});
    }

    // csrWrapper.api.user.cancelUncancelOrder → POST /commerceMgnt/cancelUncancelOrder
    case 'admin-cancel-order': {
      return await apiWrapper.csrCancelUncancelOrder(params.orderId, params.flag);
    }

    // Unsubscribed email contacts — managedContact.find({ type: 'email' })
    case 'admin-unsubscribe': {
      const raw = await apiWrapper.csrFindManagedContacts({ type: 'email', ...(params.queryParams || {}) });
      const docs = raw?.docs ?? (Array.isArray(raw) ? raw : []);
      return { data: docs, noMoreDocs: raw?.noMoreDocs ?? true };
    }

    // Unsubscribe a managed contact — managedContact.unsubscribe
    case 'admin-unsubscribe-delete': {
      return await apiWrapper.csrUnsubscribeManagedContact(params.id);
    }

    // Phone opt-out contacts — managedContact.find({ type: 'phone' })
    case 'admin-phone-optout': {
      const raw = await apiWrapper.csrFindManagedContacts({ type: 'phone', ...(params.queryParams || {}) });
      const docs = raw?.docs ?? (Array.isArray(raw) ? raw : []);
      return { data: docs, noMoreDocs: raw?.noMoreDocs ?? true };
    }

    // Unsubscribe a phone managed contact
    case 'admin-phone-optout-delete': {
      return await apiWrapper.csrUnsubscribeManagedContact(params.id);
    }

    // User contacts (notes + csr mail) — findUserContacts({ userId, lastId? })
    case 'admin-user-contacts': {
      const raw = await apiWrapper.csrFindUserContacts(params.queryParams || {});
      const docs = raw?.docs ?? (Array.isArray(raw) ? raw : []);
      return { data: docs, noMoreDocs: raw?.noMoreDocs ?? true };
    }

    // BC's dedicated read endpoint for admin notes (GET /message/admin/findNotes).
    case 'admin-find-user-notes': {
      const raw = await apiWrapper.csrFindUserAdminNotes(params.queryParams || {});
      const docs = raw?.docs ?? (Array.isArray(raw) ? raw : []);
      return { data: docs, noMoreDocs: raw?.noMoreDocs ?? (docs.length === 0) };
    }

    // ALL userContact docs (across all users) for the unified admin inbox.
    case 'admin-find-all-user-contacts': {
      const raw = await apiWrapper.csrFindAllUserContacts(params.queryParams || {});
      const docs = raw?.docs ?? (Array.isArray(raw) ? raw : []);
      return { data: docs, noMoreDocs: raw?.noMoreDocs ?? (docs.length === 0) };
    }

    // Create admin note on a user — message.note.createUserAdminNote({ userId, message, contentType, attachments })
    case 'admin-create-note': {
      return await apiWrapper.csrCreateAdminNote(params.body || {});
    }

    // Create admin note on a contact message — message.note.createContactAdminNote({ contactMessageId, message, contentType, attachments })
    case 'admin-create-contact-note': {
      return await apiWrapper.csrCreateContactAdminNote(params.body || {});
    }

    // Update admin note — message.note.updateAdminNote({ messageId, message })
    case 'admin-update-note': {
      return await apiWrapper.csrUpdateAdminNote(params.body || {});
    }

    // Send CSR mail to a user — createCsrMail({ targetUserId, subject, message })
    case 'admin-create-csr-mail': {
      return await apiWrapper.csrCreateCsrMail(params.body || {});
    }

    // csrWrapper.api.user.findOrderPayments → POST /commerceMgnt/orderPayments
    case 'admin-order-payments': {
      const raw = await apiWrapper.csrFindOrderPayments(params.orderId, params.lastPaymentId);
      const payments = raw?.payments ?? raw?.data ?? (Array.isArray(raw) ? raw : []);
      return { data: payments };
    }

    // csrWrapper.api.user.findOrderHistories → POST /commerceMgnt/orderHistories
    case 'admin-order-histories': {
      const raw = await apiWrapper.csrFindOrderHistories(params.orderId, params.lastRevisionId);
      const histories = raw?.orderHistories ?? raw?.data ?? (Array.isArray(raw) ? raw : []);
      return { data: histories, perPage: raw?.perPage ?? 5 };
    }

    // csrWrapper.api.user.getOrder → POST /commerceMgnt/getUserOrder (single order)
    case 'admin-order-detail': {
      const raw = await apiWrapper.csrGetUserOrder({ userId: params.userId, orderId: params.orderId, lastPaymentId: params.lastPaymentId });
      const order = raw?.orders?.[0] ?? raw?.order ?? raw;
      return order;
    }

    // csrWrapper.api.user.updateScheduleDueTimestamp → POST /commerceMgnt/updateScheduleDueTimestamp
    case 'admin-update-schedule': {
      return await apiWrapper.csrUpdateScheduleDueTimestamp(params.scheduleId, params.dueTimestamp);
    }

    // Tracking — database/search on 'tracking' collection
    // CSR-initiated billing sale (agent order on behalf of user)
    case 'admin-create-order': {
      return await apiWrapper.csrCreateOrder(params.body || {});
    }

    case 'admin-user-tracking': {
      const raw = await apiWrapper.csrFindUserTracking(params);
      const docs = raw?.docs ?? (Array.isArray(raw) ? raw : []);
      return { docs, noMoreDocs: raw?.noMoreDocs ?? true };
    }

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

    // CSR: find visitor contact messages
    case 'admin-find-contacts': {
      const raw = await apiWrapper.csrFindContacts(params.queryParams || {});
      const docs = raw?.docs ?? (Array.isArray(raw) ? raw : []);
      return { data: docs, noMoreDocs: raw?.noMoreDocs ?? true };
    }

    // CSR: link visitor contact to a user account
    case 'admin-change-contact-to-user': {
      return await apiWrapper.csrChangeContactToUserContact(params.body || {});
    }

    // CSR: find all contact messages (member + non-member)
    // csrWrapper.api.message.contact.find → GET /contactMessage/admin/find
    case 'admin-find-contact-messages': {
      const raw = await apiWrapper.csrFindContactMessages(params.queryParams || {});
      const docs = raw?.docs ?? (Array.isArray(raw) ? raw : []);
      return { data: docs, noMoreDocs: raw?.noMoreDocs ?? (docs.length === 0) };
    }

    // CSR: find contact messages linked to a specific user — by targetUserId
    // when set, or by sender email as fallback. Email is essential because BC
    // doesn't auto-populate targetUserId on member-submitted contactMessages.
    case 'admin-find-user-contact-messages': {
      const raw = await apiWrapper.csrFindUserContactMessages({
        userId: params.userId || params.id,
        userEmail: params.userEmail,
        lastId: params.lastId,
      });
      const docs = raw?.docs ?? (Array.isArray(raw) ? raw : []);
      return { data: docs, noMoreDocs: raw?.noMoreDocs ?? (docs.length === 0) };
    }

    // CSR: get full history of a single contact message thread
    // csrWrapper.api.message.contact.histories → GET /contactMessage/admin/histories
    case 'admin-contact-histories': {
      const raw = await apiWrapper.csrFindContactHistories(params.queryParams || {});
      const docs = raw?.docs ?? (Array.isArray(raw) ? raw : []);
      return { data: docs, noMoreDocs: raw?.noMoreDocs ?? (docs.length === 0) };
    }

    // CSR: reply to a contact message thread
    // csrWrapper.api.message.contact.createCsrReply → POST /message/admin/user/csrMail/create
    case 'admin-create-csr-reply': {
      return await apiWrapper.csrCreateCsrReply(params.body || {});
    }

    // CSR: assign contact message to self / another CSR
    case 'admin-set-contact-actor': {
      return await apiWrapper.csrSetContactActor(params.body || {});
    }

    // CSR: link contact message to a user
    case 'admin-set-contact-target-user': {
      return await apiWrapper.csrSetContactTargetUser(params.body || {});
    }

    // CSR: replace tags on a contact message
    case 'admin-set-contact-tags': {
      return await apiWrapper.csrSetContactTags(params.body || {});
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
