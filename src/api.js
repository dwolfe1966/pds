/*
 * API helper for performing HTTP requests.
 * Uses hybrid API router to intelligently route requests to new API or mock API.
 */

import { routeApiRequest, setTokenGetter as setRouterTokenGetter, setLogoutHandler as setRouterLogoutHandler, getMockAPIPath } from './services/apiRouter';
import { setSearchContext } from './services/searchContext';
import { adaptIdentity } from './services/apiAdapter';

// Token getter function - will be set by AuthContext
let getToken = () => null;

export const setTokenGetter = (fn) => {
  getToken = fn;
  // Also set in router
  setRouterTokenGetter(fn);
};

export const setLogoutHandler = setRouterLogoutHandler;

/**
 * Map API path to endpoint name
 */
function pathToEndpoint(path) {
  // Remove leading slash
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  
  // Map common paths to endpoint names
  const pathMap = {
    'search': 'teaser-search',
    'search/phone': 'teaser-search',
    'signup': 'signup',
    'login': 'login',
    'logout': 'logout',
    'refresh-token': 'refresh-token',
    'verify-email': 'verify-email',
    'me': 'get-profile',
    'dashboard': 'dashboard',
    'searches/me': 'my-searches',
    'searches/lookups-of-me': 'lookups-of-me',
    'searches': 'create-search',
    'search/by-address': 'search-by-address',
    'notifications/preferences': 'notification-preferences',
    'profile-views': 'profile-views',
    'profile-views/me': 'profile-views-me',
    'alerts': 'alerts',
    'subscription': 'subscription',
    'invoices': 'invoices',
    'notifications': 'notifications',
    'privacy': 'privacy-settings',
    'auth/change-password': 'change-password',
    'auth/mfa/enable': 'enable-mfa',
    'auth/mfa/disable': 'disable-mfa',
    'admin/users': 'admin-users',
    'admin/sessions': 'admin-sessions',
    'admin/purchases': 'admin-purchases',
    'admin/data-removal': 'admin-data-removal',
    'admin/analytics': 'admin-analytics',
    'admin/cs-reps': 'admin-cs-reps',
    'admin/email-log': 'admin-email-log',
    'admin/email-broadcast': 'admin-email-broadcast',
  };

  // Check for exact match first
  if (pathMap[cleanPath]) {
    return pathMap[cleanPath];
  }

  // Check for patterns (e.g., /people/:id, /admin/users/:id)
  if (cleanPath.startsWith('people/')) {
    return 'get-person';
  }
  if (cleanPath.startsWith('admin/users/')) {
    if (cleanPath.endsWith('/suspend')) {
      return 'admin-suspend-user';
    }
    return 'admin-user-detail';
  }
  if (cleanPath.startsWith('admin/purchases/')) {
    if (cleanPath.endsWith('/refund')) {
      return 'admin-refund';
    }
    return 'admin-purchase-detail';
  }
  if (cleanPath.startsWith('admin/data-removal/')) {
    if (cleanPath.endsWith('/approve')) {
      return 'admin-approve-removal';
    }
    if (cleanPath.endsWith('/reject')) {
      return 'admin-reject-removal';
    }
  }
  if (cleanPath.startsWith('admin/cs-reps/')) {
    return 'admin-update-cs-rep';
  }
  if (cleanPath.match(/^searches\/[^/]+$/)) {
    return 'delete-search';
  }
  if (cleanPath.startsWith('alerts/')) {
    const id = cleanPath.split('/')[1];
    if (id && !cleanPath.includes('/')) {
      return 'update-alert'; // PUT /alerts/:id
    }
    return 'delete-alert'; // DELETE /alerts/:id
  }
  if (cleanPath.startsWith('notifications/')) {
    if (cleanPath.endsWith('/read')) {
      return 'mark-notification-read';
    }
    return 'delete-notification';
  }

  // Default: use path as endpoint name
  return cleanPath.replace(/\//g, '-');
}

/**
 * Generic GET request handler
 */
async function handleGet(path, options = {}) {
  // Handle case where options is just { token } or { params, token }
  let params, token;
  if (options.token && !options.params) {
    // If only token is provided, extract it
    token = options.token;
    params = undefined;
  } else {
    // Normal case: { params, token } or { params }
    params = options.params;
    token = options.token;
  }
  
  const endpoint = pathToEndpoint(path);
  const mockPath = getMockAPIPath(endpoint, { id: path.split('/').pop() });

  // Special handling for search endpoints
  if (endpoint === 'teaser-search') {
    const { firstName, lastName, phone, zip, state } = params || {};
    const type = path.includes('/phone') ? 'phone' : 'name';
    
    const searchParams = {
      type,
      ...(type === 'name' ? {
        fName: firstName,
        lName: lastName,
        ...(state && { state }),
      } : {
        phone,
      })
    };

    const response = await routeApiRequest('teaser-search', searchParams);
    
    // Store search context for later use (report creation, opt-out)
    if (response.searchContext) {
      setSearchContext(response.searchContext);
    }
    
    return response;
  }

  // For other endpoints, use the router
  return await routeApiRequest(endpoint, {
    method: 'GET',
    path: mockPath,
    queryParams: params,
    token: token || getToken(),
  });
}

/**
 * Generic POST request handler
 */
async function handlePost(path, options = {}) {
  const { body, token } = options;
  const endpoint = pathToEndpoint(path);
  const mockPath = getMockAPIPath(endpoint, { id: path.split('/').pop() });

  return await routeApiRequest(endpoint, {
    method: 'POST',
    path: mockPath,
    body,
    token: token || getToken(),
  });
}

/**
 * Generic PUT request handler
 */
async function handlePut(path, options = {}) {
  const { body, token } = options;
  const endpoint = pathToEndpoint(path);
  const mockPath = getMockAPIPath(endpoint, { id: path.split('/').pop() });

  return await routeApiRequest(endpoint, {
    method: 'PUT',
    path: mockPath,
    body,
    token: token || getToken(),
  });
}

/**
 * Generic DELETE request handler
 */
async function handleDelete(path, options = {}) {
  const { token } = options;
  const endpoint = pathToEndpoint(path);
  const mockPath = getMockAPIPath(endpoint, { id: path.split('/').pop() });

  return await routeApiRequest(endpoint, {
    method: 'DELETE',
    path: mockPath,
    token: token || getToken(),
  });
}

const api = {
  /**
   * Generic HTTP methods (for backward compatibility)
   */
  get: handleGet,
  post: handlePost,
  put: handlePut,
  delete: handleDelete,

  /**
   * Auth endpoints
   */
  login: async (body) => {
    return await routeApiRequest('login', { method: 'POST', body });
  },

  logout: async () => {
    return await routeApiRequest('logout', { method: 'POST' });
  },

  /**
   * ID Lookup (Teaser Search)
   */
  searchPeople: async (params) => {
    const { firstName, lastName, type = 'name', phone, email, state, searchContextKey, middleName, age, city, source } = params;

    const query = { type };
    if (type === 'name') {
      query.fName = firstName;
      query.lName = lastName;
      if (state) {
        // Ensure state is uppercase two-letter abbreviation (API expects this format)
        query.state = state.trim().toUpperCase();
      }
    } else if (type === 'phone') {
      query.phone = phone;
    } else if (type === 'email') {
      query.email = email;
    }
    
    // contextKey is required by ByteCrtrs API spec. Per spec, only sale.* keys exist.
    // window.ApiWrapper.contextKey is the library enum; fall back to hardcoded sale.* values.
    {
      const CONTEXT_KEYS = {
        name:  'sale.name.teaser',
        phone: 'sale.phone.teaser',
        email: 'sale.email.teaser',
      };
      const typeKey = type === 'name' ? 'name' : type === 'phone' ? 'phone' : 'email';
      const libCtx = typeof window !== 'undefined' ? window.ApiWrapper?.contextKey : null;
      const resolvedKey = searchContextKey || libCtx?.sale?.[typeKey]?.teaser || CONTEXT_KEYS[typeKey];
      if (process.env.NODE_ENV === 'development') {
        console.log('[API] Using contextKey:', resolvedKey, `(type=${type})`);
      }
      query.contextKey = resolvedKey;
    }

    const response = await routeApiRequest('teaser-search', query);
    
    // Store search context
    if (response.searchContext) {
      setSearchContext(response.searchContext);
    }

    // Record search history for authenticated users (best-effort)
    try {
      const token = getToken();
      if (token) {
        let queryPayload = {};
        if (type === 'name') {
          queryPayload = { firstName, lastName };
          if (middleName) queryPayload.middleName = middleName;
          if (age) queryPayload.age = age;
          if (city) queryPayload.city = city;
          if (state) queryPayload.state = state;
        } else if (type === 'phone') {
          queryPayload = { phone };
        } else if (type === 'email') {
          queryPayload = { email };
        }

        await routeApiRequest('create-search', {
          method: 'POST',
          path: '/searches',
          body: {
            type,
            query: queryPayload,
            resultCount: response.data?.length || 0,
            source: source || 'searchPeople'
          },
          token
        });
      }
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[API] Failed to record search history:', err?.message || err);
      }
    }
    
    return response;
  },

  /**
   * Load more search results (pagination)
   * @param {Object} rawResponse - The rawResponse from searchPeople (when using ByteCrtrs API)
   * @returns {Promise<{data: Array}|null>} Next page of adapted identities, or null if no more
   */
  loadMoreSearchResults: async (rawResponse) => {
    if (!rawResponse || typeof rawResponse.getMore !== 'function' || !rawResponse.hasMore()) {
      return null;
    }
    const more = await rawResponse.getMore();
    if (!more || !Array.isArray(more) || more.length === 0) {
      return null;
    }
    return {
      data: more.map(adaptIdentity)
    };
  },

  /**
   * Report Generation
   */
  createReport: async (params) => {
    return await routeApiRequest('create-report', params);
  },

  getReportList: async (params = {}) => {
    // Use provided token or fall back to token getter
    const token = params.token || getToken();
    // Remove token from params before spreading to avoid duplication
    const { token: _, ...restParams } = params;
    return await routeApiRequest('report-list', {
      ...restParams,
      token: token
    });
  },

  getReportDetail: async (id) => {
    return await routeApiRequest('get-report', { id });
  },

  /**
   * Opt-Out
   */
  requestOptOut: async (body) => {
    return await routeApiRequest('opt-out-request', { body });
  },

  confirmOptOut: async (params) => {
    return await routeApiRequest('opt-out-confirmation', params);
  },

  /**
   * Search opt-out status (ByteCrtrs API)
   * Check if a record is already opted out before submitting request
   */
  searchOptOut: async (params) => {
    return await routeApiRequest('opt-out-search', { body: params });
  },

  /**
   * Download report as PDF via ByteCrtrs.
   * Triggers a BC-managed popup — the user clicks Confirm to start the download.
   * Only valid for detail report commerceContentIds (not teaser commerceContentIds).
   */
  downloadPdfReport: async (commerceContentId) => {
    return await routeApiRequest('download-pdf-report', { commerceContentId });
  },

  /**
   * Fetch all orders for the logged-in user from BC.
   * Used to determine subscriber status: active subscriber has at least one order
   * where status === 'active' and transient.canceled === false.
   * POST /api/commerceBilling/getUserOrders
   */
  getUserOrders: async () => {
    return await routeApiRequest('get-user-orders', {});
  },

  /**
   * Count teaser searches performed by the logged-in user.
   * GET /api/idLookup/statistic/userTeaserSearches
   */
  countUserTeaserSearches: async () => {
    return await routeApiRequest('count-teaser-searches', {});
  },

  /**
   * Count report creations performed by the logged-in user.
   * GET /api/idLookup/statistic/userReportCreations
   */
  countUserReportCreations: async () => {
    return await routeApiRequest('count-report-creations', {});
  },

  /**
   * Count PDF downloads performed by the logged-in user.
   * GET /api/idLookup/statistic/userPdfDownloads
   */
  countUserPdfDownloads: async () => {
    return await routeApiRequest('count-pdf-downloads', {});
  },

  /**
   * Get activated product types for the logged-in user.
   * POST /api/commerceBilling/getActivatedProductTypes
   */
  getActivatedProductTypes: async () => {
    return await routeApiRequest('get-activated-product-types', {});
  },

  /**
   * Register user in ByteCrtrs (pre-payment, no charge)
   * Must be called before billingSale so ByteCrtrs knows the user.
   */
  billingSignup: async (params) => {
    return await routeApiRequest('commerce-billing-signup', { body: params });
  },

  /**
   * Process payment via ByteCrtrs commerceBilling/sale
   * Establishes an authenticated ByteCrtrs session in the browser (required for report endpoints).
   */
  billingSale: async (params) => {
    return await routeApiRequest('commerce-billing-sale', { body: params });
  },

  /**
   * User endpoints (via mock API for now)
   */
  signup: async (body) => {
    return await routeApiRequest('signup', { body, method: 'POST', path: '/signup' });
  },

  getProfile: async (token) => {
    return await routeApiRequest('get-profile', { 
      method: 'GET', 
      path: '/me', 
      token: token || getToken() 
    });
  },

  updateProfile: async (body, token) => {
    return await routeApiRequest('update-profile', { 
      method: 'PUT', 
      path: '/me', 
      body, 
      token: token || getToken() 
    });
  },

  /**
   * Dashboard and other member endpoints
   */
  getDashboard: async (token) => {
    return await routeApiRequest('dashboard', { 
      method: 'GET', 
      path: '/dashboard', 
      token: token || getToken() 
    });
  },

  getAlerts: async (token) => {
    return await routeApiRequest('alerts', { 
      method: 'GET', 
      path: '/alerts', 
      token: token || getToken() 
    });
  },

  getSubscription: async (token) => {
    return await routeApiRequest('subscription', { 
      method: 'GET', 
      path: '/subscription', 
      token: token || getToken() 
    });
  },

  /**
   * Create/update subscription (payment). Use body.simulate: 'success' | 'failure'
   * for proxy testing when real payment API is not implemented.
   */
  updateSubscription: async (body, token) => {
    return await routeApiRequest('update-subscription', {
      method: 'PUT',
      path: '/subscription',
      body,
      token: token || getToken(),
    });
  },

  /**
   * Admin (CSR) endpoints — BC csrWrapper API
   */
  adminListUsers: async (params = {}) => {
    return await routeApiRequest('admin-users', { queryParams: params });
  },

  adminGetUser: async (id) => {
    return await routeApiRequest('admin-user-detail', { id });
  },

  adminSuspendUser: async (id) => {
    return await routeApiRequest('admin-suspend-user', { id });
  },

  adminListPurchases: async (params = {}) => {
    return await routeApiRequest('admin-purchases', { queryParams: params });
  },

  adminGetPurchase: async (id, userId) => {
    return await routeApiRequest('admin-purchase-detail', { id, userId });
  },

  // params: { commercePaymentType, targetCommerceOrderId, targetCommerceOrderRevisionId,
  //           targetCommercePaymentId, targetCommercePaymentRevisionId, amount }
  adminRefundPurchase: async (params) => {
    return await routeApiRequest('admin-refund', { body: params });
  },

  adminGetPurchaseOrder: async (userId, orderId) => {
    return await routeApiRequest('admin-purchase-detail', { userId, id: orderId });
  },

  adminCancelOrder: async (orderId, flag) => {
    return await routeApiRequest('admin-cancel-order', { orderId, flag });
  },

  adminListDataRemoval: async (params = {}) => {
    return await routeApiRequest('admin-data-removal', { queryParams: params });
  },

  adminListCsReps: async (params = {}) => {
    return await routeApiRequest('admin-cs-reps', { queryParams: params });
  },

  adminCreateCsRep: async (body) => {
    return await routeApiRequest('admin-create-cs-rep', { body });
  },

  adminUpdateCsRep: async (id, body) => {
    return await routeApiRequest('admin-update-cs-rep', { id, body });
  },

  /**
   * Admin: fetch the outbound email log.
   */
  getEmailLog: async ({ token } = {}) => {
    return await routeApiRequest('admin-email-log', {
      method: 'GET',
      path: '/admin/email-log',
      token: token || getToken(),
    });
  },

  /**
   * Admin: send a broadcast email to a user segment.
   * @param {Object} params
   * @param {string} params.subject
   * @param {string} params.html
   * @param {string} params.audience  'all' | 'paid' | 'unpaid' | 'optin'
   * @param {string} [params.token]
   */
  sendEmailBroadcast: async ({ subject, html, audience, token } = {}) => {
    return await routeApiRequest('admin-email-broadcast', {
      method: 'POST',
      path: '/admin/email-broadcast',
      body: { subject, html, audience },
      token: token || getToken(),
    });
  },
};

export default api;