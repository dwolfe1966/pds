/**
 * Hybrid API Router
 * 
 * Intelligently routes API requests to either the new API or mock API
 * based on endpoint availability and feature flags.
 */

import { getEndpointConfig, isAvailableInNewAPI, isAvailableInMockAPI } from './apiEndpointRegistry';
import apiWrapper from './apiWrapper';
import { adaptTeaserResponse, adaptReportDetailResponse, adaptReportListResponse } from './apiAdapter';

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
  'opt-out-request': process.env.REACT_APP_USE_NEW_API_OPTOUT === 'true',
  'opt-out-confirmation': process.env.REACT_APP_USE_NEW_API_OPTOUT === 'true',
  'opt-out-search': true, // Always use new API when available
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
    console.warn(`[callMockAPI] No token provided for endpoint: ${endpoint}. Request may fail if authentication is required.`);
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
      console.warn(`[callMockAPI] Request failed for ${endpoint}:`, {
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
 * Route API request to appropriate API
 */
export async function routeApiRequest(endpoint, params = {}) {
  const endpointConfig = getEndpointConfig(endpoint);
  // Check if feature flag is explicitly set to true (not just not false)
  const featureFlagEnabled = FEATURE_FLAGS[endpoint] === true;
  // Force new API – no mock fallback for these endpoints
  const FORCE_NEW_API_ENDPOINTS = new Set([
    'create-report', 'get-report', 'report-list',
    'opt-out-search', 'commerce-billing-sale', 'commerce-billing-signup',
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
    'admin-create-note',
    'admin-update-note',
    'admin-create-csr-mail',
  ]);
  const forceNewApi = FORCE_NEW_API_ENDPOINTS.has(endpoint);
  // Use new API if forced and available, otherwise require flags
  const useNewAPI =
    (forceNewApi && apiWrapper.isAvailable()) ||
    (USE_NEW_API && endpointConfig.newApi && featureFlagEnabled);
  // Avoid mock for forced endpoints
  const useMockAPI = USE_MOCK_API && endpointConfig.mockApi && !forceNewApi;

  // Log which API is being used (for debugging)
  if (process.env.NODE_ENV === 'development') {
    console.log(`[API Router] ${endpoint}:`, {
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
        console.warn(`[API Router] CORS error detected for ${endpoint}. This is expected in development when the API server doesn't allow localhost. Falling back to mock API.`);
      } else {
        console.warn(`[API Router] New API failed for ${endpoint}, falling back to mock API:`, error.message || error);
      }
      
      // Fallback to mock API if new API fails (teaser-search excluded – force ByteCrtrs for debugging)
      if (useMockAPI) {
        try {
          return await callMockAPI(endpoint, params);
        } catch (fallbackError) {
          console.error(`[API Router] Both new API and mock API failed for ${endpoint}:`, fallbackError);
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
        console.log('[Mock API Search] Params sent to /search:', JSON.stringify(queryParams, null, 2));
        console.log('[Mock API Search] Results-per-page (limit):', queryParams.limit);
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
        console.log('[BC Login] ===== RAW IIFE RESPONSE =====');
        console.log('[BC Login] typeof raw:', typeof raw);
        console.log('[BC Login] raw keys:', raw ? Object.keys(raw) : 'null/undefined');
        try { console.log('[BC Login] JSON.stringify(raw):', JSON.stringify(raw)?.substring(0, 2000)); } catch(e) { console.log('[BC Login] raw not serialisable:', e.message); }
        if (raw?.params) {
          console.log('[BC Login] raw.params keys:', Object.keys(raw.params));
          console.log('[BC Login] raw.params.response?.status:', raw.params.response?.status);
          try { console.log('[BC Login] raw.params.response?.data:', JSON.stringify(raw.params.response?.data)?.substring(0, 2000)); } catch(e) {}
          try { console.log('[BC Login] raw.params.error:', JSON.stringify(raw.params.error)?.substring(0, 500)); } catch(e) {}
        }
        if (typeof raw?.getData === 'function') {
          try { console.log('[BC Login] raw.getData():', JSON.stringify(raw.getData())?.substring(0, 2000)); } catch(e) {}
        }
        if (typeof raw?.getError === 'function') {
          try { console.log('[BC Login] raw.getError():', JSON.stringify(raw.getError())?.substring(0, 500)); } catch(e) {}
        }
        console.log('[BC Login] ===== END RAW RESPONSE =====');
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
        console.log('[BC Login] Response keys:', Object.keys(d || {}));
        console.log('[BC Login] accessToken present:', !!(d.accessToken || d.token || d.jwt || d.access_token));
      }

      const bcToken = d.accessToken || d.token || d.jwt || d.access_token || raw?.accessToken;
      const bcRefresh = d.refreshToken || d.refresh_token || raw?.refreshToken;
      const rawUser = d.user || d.userData || d.profile || raw?.user || {
        email: loginBody.email || loginBody.username,
      };

      // BC returns roles as an array; normalize to a single role string for ProtectedRoute.
      // BC uses 'csr' or 'admin' to denote admin-level users.
      if (process.env.NODE_ENV === 'development') {
        console.log('[BC Login] rawUser:', JSON.stringify(rawUser));
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
        console.log('[BC Login] isAdmin:', isAdmin, '(allowlist:', isInAllowlist, ', roles:', rolesArray, ')');
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
        console.log('[BC Login] BC session established (cookie). Issuing synthetic session token for app routing.');
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
          console.warn('[BC Logout] request failed (ignored):', err?.message);
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
      // NOTE: ByteCrtrs API may cap at 5; revert if results come back malformed
      query.perPage = 10;
      delete query.per_page;
      delete query.pageSize;
      const isPaginationRequest = !!query.commerceContentId && query.page != null;
      if (process.env.NODE_ENV === 'development') {
        console.log('[ByteCrtrs Search] All params sent to searchTeaser:', JSON.stringify(query, null, 2));
        console.log('[ByteCrtrs Search] Pagination request (getMore):', isPaginationRequest);
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
      // ByteCrtrs library can swallow HTTP errors (4xx) and return empty data.
      // Detect this and throw a descriptive error so the UI can surface it.
      if (!adapted.commerceContentId) {
        // Try to extract any error message from the raw response
        const rawData = response?.getData?.() ?? response?.params?.response?.data ?? response;
        const apiError = rawData?.error || rawData?.message || rawData?.code || null;
        const httpStatus = rawData?.status || response?.params?.response?.status || null;
        const err = new Error(
          `ByteCrtrs report/create returned no commerceContentId` +
          (httpStatus ? ` (HTTP ${httpStatus})` : '') +
          (apiError ? `: ${JSON.stringify(apiError)}` : '') +
          `. Check server console for full ByteCrtrs response.`
        );
        err.bytecrtrsResponse = rawData;
        err.httpStatus = httpStatus;
        if (process.env.NODE_ENV === 'development') {
          console.error('[API Router] create-report failed — ByteCrtrs raw response:', JSON.stringify(rawData, null, 2));
        }
        throw err;
      }
      return adapted;
    }

    case 'get-report': {
      if (!params?.id || params.id === 'undefined' || params.id === 'null') {
        throw new Error('Report detail requires a valid commerceContentId');
      }
      const response = await apiWrapper.getReportDetail(params.id);
      const adapted = adaptReportDetailResponse(response);
      if (!adapted.commerceContentId) {
        const rawData = response?.getData?.() ?? response?.params?.response?.data ?? response;
        const apiError = rawData?.error || rawData?.message || rawData?.code || null;
        const err = new Error(
          `ByteCrtrs report/detail returned no data` +
          (apiError ? `: ${JSON.stringify(apiError)}` : '') +
          `. Check server console for full ByteCrtrs response.`
        );
        err.bytecrtrsResponse = rawData;
        if (process.env.NODE_ENV === 'development') {
          console.error('[API Router] get-report failed — ByteCrtrs raw response:', JSON.stringify(rawData, null, 2));
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
    
    case 'opt-out-request':
      return await apiWrapper.requestOptOut(params.body || params);
    
    case 'opt-out-confirmation':
      return await apiWrapper.confirmOptOut(params);
    
    case 'opt-out-search':
      return await apiWrapper.searchOptOut(params.body || params);
    
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
        console.log('[BC getUserOrders] raw keys:', Object.keys(raw || {}));
        console.log('[BC getUserOrders] unwrapped data:', JSON.stringify(d)?.substring(0, 600));
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
    case 'admin-users': {
      const raw = await apiWrapper.csrFindUsers(params.queryParams || {});
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

    // csrWrapper global order search → POST /database/search { collectionName: 'commerceOrder' }
    case 'admin-purchases-global': {
      const raw = await apiWrapper.csrFindOrders(params.queryParams || {});
      const items = raw?.docs ?? raw?.orders ?? raw?.data ?? (Array.isArray(raw) ? raw : []);
      return { data: items, total: raw?.total ?? items.length, noMoreDocs: raw?.noMoreDocs };
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
    case 'admin-cs-reps': {
      const raw = await apiWrapper.csrFindCsReps(params.queryParams || {});
      const items = raw?.docs ?? raw?.raws ?? raw?.users ?? raw?.data ?? (Array.isArray(raw) ? raw : []);
      return { data: items, total: raw?.total ?? items.length, noMoreDocs: raw?.noMoreDocs };
    }

    // csrWrapper.api.user.create → POST /user/management/create
    case 'admin-create-cs-rep': {
      return await apiWrapper.csrCreateUser(params.body || params);
    }

    // csrWrapper.api.user.update → POST /user/management/update
    case 'admin-update-cs-rep': {
      return await apiWrapper.csrUpdateUser(params.id, params.body || {});
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

    // Create admin note on a user — createAdminNote({ userId, message })
    case 'admin-create-note': {
      return await apiWrapper.csrCreateAdminNote(params.body || {});
    }

    // Update admin note — updateAdminNote({ messageId, message })
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
