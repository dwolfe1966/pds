/*
 * API helper for performing HTTP requests.
 * Uses hybrid API router to intelligently route requests to new API or mock API.
 */

import { routeApiRequest, setTokenGetter as setRouterTokenGetter, getMockAPIPath } from './services/apiRouter';
import { setSearchContext } from './services/searchContext';

// Token getter function - will be set by AuthContext
let getToken = () => null;

export const setTokenGetter = (fn) => {
  getToken = fn;
  // Also set in router
  setRouterTokenGetter(fn);
};

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
  const { params, token } = options;
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
    return await routeApiRequest('login', { body });
  },

  logout: async () => {
    return await routeApiRequest('logout');
  },

  /**
   * ID Lookup (Teaser Search)
   */
  searchPeople: async (params) => {
    const { firstName, lastName, type = 'name', phone, email, state } = params;

    const query = { type };
    if (type === 'name') {
      query.fName = firstName;
      query.lName = lastName;
      if (state) query.state = state;
    } else if (type === 'phone') {
      query.phone = phone;
    } else if (type === 'email') {
      query.email = email;
    }

    const response = await routeApiRequest('teaser-search', query);
    
    // Store search context
    if (response.searchContext) {
      setSearchContext(response.searchContext);
    }
    
    return response;
  },

  /**
   * Report Generation
   */
  createReport: async (params) => {
    return await routeApiRequest('create-report', params);
  },

  getReportList: async (params) => {
    return await routeApiRequest('report-list', params);
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
};

export default api;