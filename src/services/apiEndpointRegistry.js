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
  'opt-out-search': { newApi: true, mockApi: false },
  'commerce-billing-sale': { newApi: true, mockApi: false },
  'commerce-billing-signup': { newApi: true, mockApi: false },
  'download-pdf-report': { newApi: true, mockApi: false },
  'get-user-orders': { newApi: true, mockApi: false },
  'count-teaser-searches': { newApi: true, mockApi: false },
  'count-report-creations': { newApi: true, mockApi: false },
  'count-pdf-downloads': { newApi: true, mockApi: false },
  'get-activated-product-types': { newApi: true, mockApi: false },
  'login': { newApi: true, mockApi: false },
  'logout': { newApi: true, mockApi: false },
  
  // BC handles user creation (billing.signup) + auto-login. mockApi kept for fallback awareness only.
  'signup': { newApi: true, mockApi: false },
  'verify-email': { newApi: false, mockApi: true },
  'refresh-token': { newApi: false, mockApi: true },
  'get-profile': { newApi: false, mockApi: true },
  'update-profile': { newApi: false, mockApi: true },
  'get-person': { newApi: false, mockApi: true },
  'dashboard': { newApi: false, mockApi: true },
  'my-searches': { newApi: false, mockApi: true },
  'lookups-of-me': { newApi: false, mockApi: true },
  'delete-search': { newApi: false, mockApi: true },
  'create-search': { newApi: false, mockApi: true },
  'search-by-address': { newApi: false, mockApi: true },
  'profile-views': { newApi: false, mockApi: true },
  'profile-views-me': { newApi: false, mockApi: true },
  'alerts': { newApi: false, mockApi: true },
  'create-alert': { newApi: false, mockApi: true },
  'update-alert': { newApi: false, mockApi: true },
  'delete-alert': { newApi: false, mockApi: true },
  'subscription': { newApi: false, mockApi: true },
  'update-subscription': { newApi: false, mockApi: true },
  'cancel-subscription': { newApi: false, mockApi: true },
  'invoices': { newApi: false, mockApi: true },
  'notifications': { newApi: false, mockApi: true },
  'notification-preferences': { newApi: false, mockApi: true },
  'mark-notification-read': { newApi: false, mockApi: true },
  'delete-notification': { newApi: false, mockApi: true },
  'privacy-settings': { newApi: false, mockApi: true },
  'change-password': { newApi: false, mockApi: true },
  'enable-mfa': { newApi: false, mockApi: true },
  'disable-mfa': { newApi: false, mockApi: true },
  
  // Admin endpoints — BC CSR API
  'admin-users': { newApi: true, mockApi: false },
  'admin-user-detail': { newApi: true, mockApi: false },
  'admin-suspend-user': { newApi: true, mockApi: false },
  'admin-sessions': { newApi: false, mockApi: false }, // No BC sessions endpoint
  'admin-purchases': { newApi: true, mockApi: false },
  'admin-purchase-detail': { newApi: true, mockApi: false },
  'admin-refund': { newApi: true, mockApi: false },
  'admin-data-removal': { newApi: true, mockApi: false },
  'admin-approve-removal': { newApi: false, mockApi: false }, // No BC approve endpoint
  'admin-reject-removal': { newApi: false, mockApi: false }, // No BC reject endpoint
  'admin-analytics': { newApi: false, mockApi: true },
  'admin-cs-reps': { newApi: true, mockApi: false },
  'admin-create-cs-rep': { newApi: true, mockApi: false },
  'admin-update-cs-rep': { newApi: true, mockApi: false },
  'admin-cancel-order': { newApi: true, mockApi: false },
  'admin-email-log': { newApi: false, mockApi: true },
  'admin-email-broadcast': { newApi: false, mockApi: true },
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
