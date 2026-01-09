/**
 * API Endpoint Registry
 * 
 * Tracks which endpoints are available in the new API vs mock API.
 * This allows intelligent routing and easy updates as new endpoints become available.
 */

export const API_ENDPOINTS = {
  // Available in new API
  'teaser-search': { newApi: true, mockApi: true },
  'create-report': { newApi: true, mockApi: true },
  'get-report': { newApi: true, mockApi: true },
  'report-list': { newApi: true, mockApi: true },
  'opt-out-request': { newApi: true, mockApi: true },
  'opt-out-confirmation': { newApi: true, mockApi: true },
  'login': { newApi: true, mockApi: true },
  'logout': { newApi: true, mockApi: true },
  
  // Only in mock API (for now)
  'signup': { newApi: false, mockApi: true },
  'verify-email': { newApi: false, mockApi: true },
  'refresh-token': { newApi: false, mockApi: true },
  'get-profile': { newApi: false, mockApi: true },
  'update-profile': { newApi: false, mockApi: true },
  'get-person': { newApi: false, mockApi: true },
  'dashboard': { newApi: false, mockApi: true },
  'my-searches': { newApi: false, mockApi: true },
  'alerts': { newApi: false, mockApi: true },
  'create-alert': { newApi: false, mockApi: true },
  'update-alert': { newApi: false, mockApi: true },
  'delete-alert': { newApi: false, mockApi: true },
  'subscription': { newApi: false, mockApi: true },
  'update-subscription': { newApi: false, mockApi: true },
  'cancel-subscription': { newApi: false, mockApi: true },
  'invoices': { newApi: false, mockApi: true },
  'notifications': { newApi: false, mockApi: true },
  'mark-notification-read': { newApi: false, mockApi: true },
  'delete-notification': { newApi: false, mockApi: true },
  'privacy-settings': { newApi: false, mockApi: true },
  'change-password': { newApi: false, mockApi: true },
  'enable-mfa': { newApi: false, mockApi: true },
  'disable-mfa': { newApi: false, mockApi: true },
  
  // Admin endpoints (only in mock API)
  'admin-users': { newApi: false, mockApi: true },
  'admin-user-detail': { newApi: false, mockApi: true },
  'admin-suspend-user': { newApi: false, mockApi: true },
  'admin-sessions': { newApi: false, mockApi: true },
  'admin-purchases': { newApi: false, mockApi: true },
  'admin-purchase-detail': { newApi: false, mockApi: true },
  'admin-refund': { newApi: false, mockApi: true },
  'admin-data-removal': { newApi: false, mockApi: true },
  'admin-approve-removal': { newApi: false, mockApi: true },
  'admin-reject-removal': { newApi: false, mockApi: true },
  'admin-analytics': { newApi: false, mockApi: true },
  'admin-cs-reps': { newApi: false, mockApi: true },
  'admin-create-cs-rep': { newApi: false, mockApi: true },
  'admin-update-cs-rep': { newApi: false, mockApi: true },
};

/**
 * Check if an endpoint is available in the new API
 */
export function isAvailableInNewAPI(endpoint) {
  return API_ENDPOINTS[endpoint]?.newApi === true;
}

/**
 * Check if an endpoint is available in the mock API
 */
export function isAvailableInMockAPI(endpoint) {
  return API_ENDPOINTS[endpoint]?.mockApi === true;
}

/**
 * Get endpoint configuration
 */
export function getEndpointConfig(endpoint) {
  return API_ENDPOINTS[endpoint] || { newApi: false, mockApi: false };
}
