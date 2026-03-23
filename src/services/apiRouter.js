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
const USE_MOCK_API = process.env.REACT_APP_USE_MOCK_API !== 'false';
const MOCK_API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api/v1';

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
  
  // Construct URL properly
  // MOCK_API_URL is like 'http://localhost:3001/api/v1'
  // path is like '/search' - we need to append it to the base URL
  // Remove leading slash from path if present, then append
  const cleanPath = path.startsWith('/') ? path.substring(1) : path;
  const baseUrl = MOCK_API_URL.endsWith('/') ? MOCK_API_URL : `${MOCK_API_URL}/`;
  const fullUrl = `${baseUrl}${cleanPath}`;
  const url = new URL(fullUrl);
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
      // BC uses 'csr' (customer service rep) to denote admin-level users.
      const bcUser = {
        ...rawUser,
        role: rawUser.role || (Array.isArray(rawUser.roles) && rawUser.roles.includes('csr') ? 'admin' : 'member'),
      };

      // 2. If BC returned a real JWT, use it directly.
      if (bcToken) {
        return { accessToken: bcToken, refreshToken: bcRefresh, user: bcUser };
      }

      // 3. BC uses cookie-based sessions — no JWT issued to client.
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
      const body = params.body || params;
      const nameParts = (body.fullName || '').trim().split(/\s+/);
      const firstName = body.firstName || nameParts[0] || '';
      const lastName = body.lastName || nameParts.slice(1).join(' ') || '';

      // 1. Register the user in BC (no password at this stage — billing.signup doesn't accept one).
      // queryString must always be present (BC requires the field even if empty).
      await apiWrapper.billingSignup({
        userInfo: { email: body.email, firstName, lastName, optin: !!body.optin },
        queryString: body.queryString || '',
      });

      // 2. BC auto-establishes a session after billing.signup.
      //    auth.login({}) with no credentials checks whether the server session is live.
      let sessionUser = null;
      try {
        const raw = await apiWrapper.login({});
        const d = raw?.getData?.() ?? raw?.data ?? raw ?? {};
        const rawUser = d.user || d.userData || raw?.user || null;
        if (rawUser) {
          sessionUser = {
            ...rawUser,
            role: rawUser.role || (Array.isArray(rawUser.roles) && rawUser.roles.includes('csr') ? 'admin' : 'member'),
          };
        }
      } catch (err) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('[BC Signup] Session check after billing.signup failed:', err?.message);
        }
      }

      // 3. If a session was established, set the user's chosen password so future logins work.
      if (sessionUser && body.password) {
        try {
          const wrapper = await apiWrapper.getWrapper();
          await wrapper.api.user.changePassword(body.password);
        } catch (err) {
          if (process.env.NODE_ENV === 'development') {
            console.warn('[BC Signup] changePassword after signup failed:', err?.message);
          }
        }
      }

      // 4. Return synthetic token. If no BC session was established the user will need
      //    to set their password via the reset-password email flow.
      const bcUser = sessionUser || {
        email: body.email,
        firstName,
        lastName,
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

    case 'get-user-orders':
      // Returns array of orders. Subscriber = at least one with status 'active' + transient.canceled false.
      return await apiWrapper.getOrders();

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
    'create-search': '/searches',
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
    // For search, use the existing mock API endpoint
    'teaser-search': '/search',
    // Report endpoints
    'create-report': '/reports',
    'get-report': `/reports/${params.id}`,
    'report-list': '/reports',
  };

  return pathMap[endpoint] || `/${endpoint}`;
}
