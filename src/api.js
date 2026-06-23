/*
 * API helper for performing HTTP requests.
 * Uses hybrid API router to intelligently route requests to new API or mock API.
 */

import { routeApiRequest, setTokenGetter as setRouterTokenGetter, setLogoutHandler as setRouterLogoutHandler, getMockAPIPath } from './services/apiRouter';
import { setSearchContext } from './services/searchContext';
import { adaptIdentity } from './services/apiAdapter';
import { recordSearch as recordSearchToHistory } from './utils/searchHistory';

// Direct mock API base URL (used for endpoints that bypass the hybrid router)
const MOCK_API_URL = process.env.REACT_APP_API_URL ||
  (process.env.NODE_ENV === 'development' ? 'http://localhost:3001/api/v1' : '/api/v1');

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
    'admin/unsubscribe': 'admin-unsubscribe',
    'admin/phone-optout': 'admin-phone-optout',
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
    if (cleanPath.endsWith('/unsuspend')) {
      return 'admin-unsuspend-user';
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
  if (cleanPath.startsWith('admin/unsubscribe/')) {
    return 'admin-unsubscribe-delete';
  }
  if (cleanPath.startsWith('admin/phone-optout/')) {
    return 'admin-phone-optout-delete';
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
      // Partner bug 10: city/middleName/age were destructured but never sent.
      // BC docs only list fName/lName/state/contextKey as inputs, so these are
      // speculative — BC should ignore unknowns gracefully. We ALSO filter
      // client-side in SearchResultsPage so the user sees the refinement.
      if (middleName && middleName.trim()) query.mName = middleName.trim();
      if (city && city.trim()) query.city = city.trim();
      if (age && String(age).trim()) {
        const n = parseInt(String(age).trim(), 10);
        if (!Number.isNaN(n)) query.age = n;
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

    // Record search history client-side (best-effort).
    // BC doesn't expose a user-facing history-read endpoint, so we maintain
    // a localStorage ring buffer scoped per-user. See utils/searchHistory.js
    // — swap to a server endpoint when BC ships one.
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
        recordSearchToHistory({
          type,
          query: queryPayload,
          resultCount: response.data?.length || 0,
          source: source || 'searchPeople',
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
   * Opt-Out — BC hosts the full search/request/verification flow. Our only
   * server-side endpoint is the confirmation handler hit from the email
   * deep-link. The search and request submission live on BC's hosted page,
   * which we open via ApiWrapper.goPage (see openBcOptOutPage below).
   */
  confirmOptOut: async (params) => {
    return await routeApiRequest('opt-out-confirmation', params);
  },

  /**
   * Open BC's authoritative hosted opt-out page via ApiWrapper.goPage.
   * newPage=true opens in a new tab; newPage=false redirects the current tab.
   * Falls back to our in-app /opt-out route if the BC library is unavailable.
   */
  openBcOptOutPage: async ({ newPage = true } = {}) => {
    const { default: apiWrapper } = await import('./services/apiWrapper');
    return await apiWrapper.goToOptOutPage({ newPage });
  },

  // Consumer email unsubscribe (public /unsubscribe page + member Communications tab).
  unsubscribeEmail: async (email) => {
    const { default: apiWrapper } = await import('./services/apiWrapper');
    return await apiWrapper.unsubscribeManagedContactMail(email);
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
   * Look up a commerce offer by its shmName (e.g. 'comp.offer.signup.main').
   * POST /commerce/offer/findByShmName
   * Returns offer with extName (human-readable) and transient.priceInfo.s0/s1.
   */
  findOfferByShmName: async ({ shmName, key } = {}) => {
    return await routeApiRequest('find-offer', { shmName, key });
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
   * Cancel an active subscription order. Forwards to BC's
   * commerceBilling.cancelOrUncancelOrder(flag, orderId).
   * Pass flag=false to reactivate a canceled order before its period ends.
   */
  cancelSubscription: async (orderId, { flag = true } = {}) => {
    return await routeApiRequest('cancel-subscription', { body: { orderId, flag } });
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

  adminListOrdersGlobal: async (params = {}) => {
    return await routeApiRequest('admin-purchases-global', { queryParams: params });
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

  adminFindOrderPayments: async (orderId, lastPaymentId) => {
    return await routeApiRequest('admin-order-payments', { orderId, lastPaymentId });
  },

  adminFindOrderHistories: async (orderId, lastRevisionId) => {
    return await routeApiRequest('admin-order-histories', { orderId, lastRevisionId });
  },

  adminGetOrderDetail: async (userId, orderId, lastPaymentId) => {
    return await routeApiRequest('admin-order-detail', { userId, orderId, lastPaymentId });
  },

  adminUpdateScheduleDueTimestamp: async (scheduleId, dueTimestamp, amount) => {
    return await routeApiRequest('admin-update-schedule', { scheduleId, dueTimestamp, amount });
  },

  adminListDataRemoval: async (params = {}) => {
    return await routeApiRequest('admin-data-removal', { queryParams: params });
  },

  adminListUnsubscribed: async (params = {}) => {
    return await routeApiRequest('admin-unsubscribe', { queryParams: params });
  },

  adminUnsubscribeContact: async (id) => {
    return await routeApiRequest('admin-unsubscribe-delete', { id });
  },

  adminRemoveUnsubscribed: async (id) => {
    return await routeApiRequest('admin-unsubscribe-delete', { id });
  },

  adminListPhoneOptOuts: async (params = {}) => {
    return await routeApiRequest('admin-phone-optout', { queryParams: params });
  },

  adminUnsubscribePhoneContact: async (id) => {
    return await routeApiRequest('admin-phone-optout-delete', { id });
  },

  adminFindUserContacts: async (params = {}) => {
    return await routeApiRequest('admin-user-contacts', { queryParams: params });
  },

  // CSR: BC's dedicated admin-notes read endpoint (GET /message/admin/findNotes).
  // Replaces the /database/search collectionName=userContact path which queries
  // the wrong collection after BC restructured 2026-04-17. Returns notes only.
  adminFindUserAdminNotes: async ({ userId, lastId } = {}) => {
    return await routeApiRequest('admin-find-user-notes', { queryParams: { userId, ...(lastId ? { lastId } : {}) } });
  },

  // CSR: list ALL userContact docs (across all users) for the unified inbox
  // — paginated via lastId.
  adminFindAllUserContacts: async ({ lastId } = {}) => {
    return await routeApiRequest('admin-find-all-user-contacts', { queryParams: lastId ? { lastId } : {} });
  },

  adminCreateOrder: async (body = {}) => {
    return await routeApiRequest('admin-create-order', { body });
  },

  adminCreateNote: async (body = {}) => {
    return await routeApiRequest('admin-create-note', { body });
  },

  adminCreateContactNote: async (body = {}) => {
    return await routeApiRequest('admin-create-contact-note', { body });
  },

  adminUpdateNote: async (body = {}) => {
    return await routeApiRequest('admin-update-note', { body });
  },

  adminCreateCsrMail: async (body = {}) => {
    return await routeApiRequest('admin-create-csr-mail', { body });
  },

  adminFindUserTracking: async (type, lastId, userId) => {
    return await routeApiRequest('admin-user-tracking', { type, ...(lastId ? { lastId } : {}), ...(userId ? { updaterId: userId } : {}) });
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

  // CSR: edit a customer's profile fields (firstName, lastName, email, phone).
  // Hits the same BC endpoint as adminUpdateCsRep but reserved for member edits.
  adminUpdateUser: async (id, body) => {
    return await routeApiRequest('admin-update-user', { id, body });
  },

  // CSR: locate a managedContact record (email/phone subscription) by type + address.
  adminFindManagedContact: async (params = {}) => {
    return await routeApiRequest('admin-find-managed-contact', { queryParams: params });
  },

  // CSR: unsubscribe a managedContact by _id.
  adminUnsubscribeManagedContact: async (managedContactId) => {
    return await routeApiRequest('admin-unsubscribe-managed-contact', { id: managedContactId, body: { managedContactId } });
  },

  // CSR: look up an offer (plan name + s0/s1 price) by shm name.
  // Returns the BC offer document; transient.priceInfo holds s0/s1 amounts.
  adminFindOffer: async ({ shmName, key }) => {
    return await routeApiRequest('admin-find-offer', { body: { shmName, ...(key ? { key } : {}) } });
  },

  /**
   * Get the logged-in user's support messages (contacts + CSR mail).
   * POST /api/message/userContact/list
   * Paginated via lastId; returns { messages: [...], noMoreDocs: boolean }
   */
  getUserContacts: async (lastId) => {
    return await routeApiRequest('get-user-contacts', { lastId });
  },

  // CSR: find visitor contact messages
  adminFindContacts: async (params = {}) => {
    return await routeApiRequest('admin-find-contacts', { queryParams: params });
  },

  // CSR: link visitor contact to a user account
  adminChangeContactToUser: async (messageId, targetUserId) => {
    return await routeApiRequest('admin-change-contact-to-user', { body: { messageId, targetUserId } });
  },

  // CSR: list all contact messages (member + non-member), newest first.
  adminFindContactMessages: async (params = {}) => {
    return await routeApiRequest('admin-find-contact-messages', { queryParams: params });
  },

  // CSR: list contact messages assigned to a specific user.
  // Matches by targetUserId OR sender email — BC's targetUserId is often unset
  // on member-submitted contactMessages, so the email fallback fills the gap.
  adminFindUserContactMessages: async ({ userId, userEmail, lastId } = {}) => {
    return await routeApiRequest('admin-find-user-contact-messages', { userId, userEmail, lastId });
  },

  // CSR: full thread history for a contact message.
  adminContactHistories: async (params = {}) => {
    return await routeApiRequest('admin-contact-histories', { queryParams: params });
  },

  // CSR: reply to a contact message thread.
  // params: { contactMessageId, subject, message, contentType?, attachments? }
  adminCreateCsrReply: async (body = {}) => {
    return await routeApiRequest('admin-create-csr-reply', { body });
  },

  // CSR: assign a contact message to an agent (defaults to self).
  adminSetContactActor: async (body = {}) => {
    return await routeApiRequest('admin-set-contact-actor', { body });
  },

  // CSR: link a contact message to a specific user.
  adminSetContactTargetUser: async (body = {}) => {
    return await routeApiRequest('admin-set-contact-target-user', { body });
  },

  // CSR: replace tags on a contact message.
  adminSetContactTags: async (body = {}) => {
    return await routeApiRequest('admin-set-contact-tags', { body });
  },

  /**
   * Contact / Support endpoints
   * Routes through BC API: contact.create (visitor) or user.createContact (member)
   * Falls back to mock server thread endpoints for the visitor thread viewer.
   */

  /**
   * Submit a contact form — routes to BC message.contact.create (new spec 2026-04-17).
   *
   * Accepts the legacy form shape { name, email, phone, message, reason, orderId?, zip?, last4? }
   * and maps to BC's disjoint category payloads:
   *   billing  → { category, date, name, email, zip, last4, phone?, orderId? }
   *   general  → { category, topic, name, email, phone, description, orderId, zip?, last4? }
   *
   * Caller passes `category` when known; defaults to 'general' for UI topic-based flow.
   */
  submitContact: async (body) => {
    const category = body.category || 'general';
    let contactBody;
    if (category === 'billing') {
      contactBody = {
        category: 'billing',
        date: body.date || [new Date().toISOString()],
        name: body.name || '',
        email: body.email || '',
        zip: body.zip || '',
        last4: body.last4 || '',
        ...(body.phone ? { phone: body.phone } : {}),
        ...(body.orderId ? { orderId: body.orderId } : {}),
        // NOTE: do NOT send targetUserId on /contactMessage/create. BC's prod v3
        // rejects it with 400 "Invalid params." (confirmed 2026-06-23: a logged-in
        // member had it appended → EVERY member contact submit failed). It is not in
        // BC's create param spec {category,topic,name,email,phone,description,orderId}.
        // The thread still links to the member by EMAIL (the per-user finder email-
        // merges) + the localStorage thread ref (persistContactThreadRef), so member
        // visibility is preserved. Visitors never sent it, which is why only members broke.
      };
    } else {
      // BC's general-category 'orderId' is required by the doc but empty
      // string is rejected (likely with 403 or 400). Only include when we
      // actually have one so BC's _unwrapBcResponse strips empties before
      // sending. Same for zip/last4.
      //
      // Phone is special: BC ALWAYS requires a non-empty valid phone on
      // /contactMessage/create general category ("input.phone must be a
      // valid phone number"). The public contact form doesn't require
      // phone, so when the visitor leaves it blank we send the same
      // sentinel AccountPage uses for member-compose: 212-555-0100
      // (NANP 212 area + 555-01XX fictional subscriber range). Passes
      // libphonenumber. Remove this fallback once BC drops the phone
      // requirement on this endpoint.
      const phoneDigits = (body.phone || '').replace(/\D/g, '');
      const phone = phoneDigits.length >= 10 ? phoneDigits : '2125550100';
      contactBody = {
        category: 'general',
        topic: body.topic || body.reason || body.subject || 'General inquiry',
        name: body.name || '',
        email: body.email || '',
        description: body.description || body.message || '',
        phone,
        // BC requires orderId on general-category per their 2026-04-17 spec
        // (must match /^[a-zA-Z0-9]{8,24}$/). Members without an active
        // subscription have no real orderId, so send a recognisable sentinel.
        // CSRs: orderId starting with NOORDERID = no order on file.
        orderId: body.orderId || 'NOORDERID0000',
        ...(body.zip ? { zip: body.zip } : {}),
        ...(body.last4 ? { last4: body.last4 } : {}),
        // NOTE: do NOT send targetUserId on /contactMessage/create. BC's prod v3
        // rejects it with 400 "Invalid params." (confirmed 2026-06-23: a logged-in
        // member had it appended → EVERY member contact submit failed). It is not in
        // BC's create param spec {category,topic,name,email,phone,description,orderId}.
        // The thread still links to the member by EMAIL (the per-user finder email-
        // merges) + the localStorage thread ref (persistContactThreadRef), so member
        // visibility is preserved. Visitors never sent it, which is why only members broke.
      };
    }

    return await routeApiRequest('create-contact-message', { body: contactBody });
  },

  /** Reply to a contact message thread via BC — requires contactMessageId + hash from reply link. */
  replyContactMessage: async (body) => {
    return await routeApiRequest('reply-contact-message', { body });
  },

  /** Get contact message thread history via BC — requires contactMessageId + hash. */
  getContactHistories: async (params) => {
    return await routeApiRequest('contact-histories', { queryParams: params });
  },

  /**
   * Record a tracking event on BC — for compliance agreements, T&C acceptance,
   * and other arbitrary user events the business wants auditable.
   * Fire-and-forget; never throws.
   */
  createTracking: async (data) => {
    try {
      return await routeApiRequest('tracking-create', { body: data || {} });
    } catch (err) {
      return null;
    }
  },

  /** Get a contact thread by ID (mock server — visitor thread view) */
  getContactThread: async (threadId) => {
    const res = await fetch(`${MOCK_API_URL}/contact/thread/${threadId}`);
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || 'Thread not found');
    return res.json();
  },

  /** Reply to a contact thread (mock server — visitor follow-up) */
  replyToContactThread: async (threadId, body) => {
    const res = await fetch(`${MOCK_API_URL}/contact/thread/${threadId}/reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || 'Failed to reply');
    return res.json();
  },
};

export default api;