/*
 * Simple API helper for performing HTTP requests to the backend.
 * Injects the auth token if available and handles JSON serialization.
 */
const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api/v1';

// Token getter function - will be set by AuthContext
let getToken = () => null;

export const setTokenGetter = (fn) => {
  getToken = fn;
};

async function request(method, url, { body, token, params } = {}) {
  let fullUrl = `${BASE_URL}${url}`;
  // Append query parameters if provided
  if (params) {
    const query = new URLSearchParams(params).toString();
    fullUrl += `?${query}`;
  }
  const headers = { 'Content-Type': 'application/json' };
  // Use provided token, or get from token getter
  const authToken = token || getToken();
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  const response = await fetch(fullUrl, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'include',
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const errorMessage = error.error?.message || error.message || `Request failed with status ${response.status}`;
    console.error('API Error:', { status: response.status, error });
    throw new Error(errorMessage);
  }
  if (response.status === 204) return null;
  return await response.json();
}

const api = {
  get: (url, options = {}) => request('GET', url, options),
  post: (url, body, options = {}) => request('POST', url, { ...options, body }),
  put: (url, body, options = {}) => request('PUT', url, { ...options, body }),
  delete: (url, options = {}) => request('DELETE', url, options),
  /**
   * Auth endpoints
   */
  signup: (body, options = {}) => request('POST', '/signup', { ...options, body }),
  login: (body, options = {}) => request('POST', '/login', { ...options, body }),
  verifyEmail: (params) => request('GET', '/verify-email', { params }),
  refreshToken: (body) => request('POST', '/refresh-token', { body }),
  logout: (options = {}) => request('POST', '/logout', options),

  /**
   * Member endpoints
   */
  getProfile: (options = {}) => request('GET', '/me', options),
  updateProfile: (body, options = {}) => request('PUT', '/me', { ...options, body }),
  searchPublic: (params, options = {}) => request('GET', '/search', { ...options, params }),
  searchPeople: (params, options = {}) => request('GET', '/search', { ...options, params }),
  getPerson: (id, options = {}) => request('GET', `/people/${id}`, options),
  getDashboard: (options = {}) => request('GET', '/dashboard', options),
  getWhoIsSearching: (options = {}) => request('GET', '/searches/me', options),
  getAlerts: (options = {}) => request('GET', '/alerts', options),
  createAlert: (body, options = {}) => request('POST', '/alerts', { ...options, body }),
  updateAlert: (id, body, options = {}) => request('PUT', `/alerts/${id}`, { ...options, body }),
  deleteAlert: (id, options = {}) => request('DELETE', `/alerts/${id}`, options),
  getSubscription: (options = {}) => request('GET', '/subscription', options),
  updateSubscription: (body, options = {}) => request('PUT', '/subscription', { ...options, body }),
  cancelSubscription: (options = {}) => request('DELETE', '/subscription', options),
  getInvoices: (params, options = {}) => request('GET', '/invoices', { ...options, params }),
  getNotifications: (options = {}) => request('GET', '/notifications', options),
  markNotificationRead: (id, options = {}) => request('PUT', `/notifications/${id}/read`, options),
  deleteNotification: (id, options = {}) => request('DELETE', `/notifications/${id}`, options),
  changePassword: (body, options = {}) => request('POST', '/auth/change-password', { ...options, body }),
  enableMfa: (body, options = {}) => request('POST', '/auth/mfa/enable', { ...options, body }),
  disableMfa: (options = {}) => request('POST', '/auth/mfa/disable', options),
  updatePrivacy: (body, options = {}) => request('PUT', '/privacy', { ...options, body }),

  /**
   * Admin endpoints
   */
  getUsers: (options = {}) => request('GET', '/admin/users', options),
  getUser: (id, options = {}) => request('GET', `/admin/users/${id}`, options),
  suspendUser: (id, body, options = {}) => request('POST', `/admin/users/${id}/suspend`, { ...options, body }),
  getSessions: (options = {}) => request('GET', '/admin/sessions', options),
  getPurchases: (options = {}) => request('GET', '/admin/purchases', options),
  getPurchase: (id, options = {}) => request('GET', `/admin/purchases/${id}`, options),
  refundPurchase: (id, body, options = {}) => request('POST', `/admin/purchases/${id}/refund`, { ...options, body }),
  getDataRemovalRequests: (options = {}) => request('GET', '/admin/data-removal', options),
  approveDataRemoval: (id, options = {}) => request('POST', `/admin/data-removal/${id}/approve`, options),
  rejectDataRemoval: (id, body, options = {}) => request('POST', `/admin/data-removal/${id}/reject`, { ...options, body }),
  getAnalytics: (options = {}) => request('GET', '/admin/analytics', options),
  getCsReps: (options = {}) => request('GET', '/admin/cs-reps', options),
  createCsRep: (body, options = {}) => request('POST', '/admin/cs-reps', { ...options, body }),
  updateCsRep: (id, body, options = {}) => request('PUT', `/admin/cs-reps/${id}`, { ...options, body }),
};

export default api;