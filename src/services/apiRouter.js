/**
 * Hybrid API Router
 * 
 * Intelligently routes API requests to either the new API or mock API
 * based on endpoint availability and feature flags.
 */

import { getEndpointConfig, isAvailableInNewAPI, isAvailableInMockAPI } from './apiEndpointRegistry';
import apiWrapper from './apiWrapper';
import { adaptTeaserResponse, adaptReportResponse, adaptReportListResponse } from './apiAdapter';

// Environment configuration
const USE_NEW_API = process.env.REACT_APP_NEW_API_ENABLED === 'true';
const USE_MOCK_API = process.env.REACT_APP_USE_MOCK_API !== 'false';
const MOCK_API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api/v1';

// Per-endpoint feature flags
const FEATURE_FLAGS = {
  'teaser-search': process.env.REACT_APP_USE_NEW_API_SEARCH === 'true',
  'create-report': process.env.REACT_APP_USE_NEW_API_REPORTS === 'true',
  'get-report': process.env.REACT_APP_USE_NEW_API_REPORTS === 'true',
  'report-list': process.env.REACT_APP_USE_NEW_API_REPORTS === 'true',
  'opt-out-request': process.env.REACT_APP_USE_NEW_API_OPTOUT === 'true',
  'opt-out-confirmation': process.env.REACT_APP_USE_NEW_API_OPTOUT === 'true',
  'login': process.env.REACT_APP_USE_NEW_API_AUTH === 'true',
  'logout': process.env.REACT_APP_USE_NEW_API_AUTH === 'true',
};

// Token getter function - will be set by AuthContext
let getToken = () => null;

export const setTokenGetter = (fn) => {
  getToken = fn;
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

  // Use provided token or get from token getter
  const token = providedToken || getToken();
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
  // Force new API for report creation/detail to avoid mock endpoints
  const FORCE_NEW_API_ENDPOINTS = new Set(['create-report', 'get-report']);
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
      
      // Fallback to mock API if new API fails
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
      return await callMockAPI(endpoint, {
        method: 'GET',
        queryParams: {
          firstName: firstName || fName,
          lastName: lastName || lName,
          phone,
          state,
          zip
        }
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
    case 'login':
      return await apiWrapper.login(params.body || params);
    
    case 'logout':
      return await apiWrapper.logout();
    
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
      const response = await apiWrapper.searchTeaser(query);
      return adaptTeaserResponse(response);
    }
    
    case 'create-report': {
      const response = await apiWrapper.createReport(params);
      return adaptReportResponse(response);
    }
    
    case 'get-report': {
      const response = await apiWrapper.getReportDetail(params.id);
      return adaptReportResponse(response);
    }
    
    case 'report-list': {
      const response = await apiWrapper.getReportList(params);
      return adaptReportListResponse(response);
    }
    
    case 'opt-out-request':
      return await apiWrapper.requestOptOut(params.body || params);
    
    case 'opt-out-confirmation':
      return await apiWrapper.confirmOptOut(params);
    
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
