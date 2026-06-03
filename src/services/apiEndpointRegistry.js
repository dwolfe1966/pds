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
  'admin-unsuspend-user': { newApi: true, mockApi: false },
  'admin-sessions': { newApi: false, mockApi: false }, // No BC sessions endpoint
  'admin-purchases': { newApi: true, mockApi: false },
  'admin-purchases-global': { newApi: true, mockApi: false },
  'admin-purchase-detail': { newApi: true, mockApi: false },
  'admin-refund': { newApi: true, mockApi: false },
  'admin-data-removal': { newApi: true, mockApi: false },
  'admin-approve-removal': { newApi: false, mockApi: false }, // No BC approve endpoint
  'admin-reject-removal': { newApi: false, mockApi: false }, // No BC reject endpoint
  'admin-analytics': { newApi: false, mockApi: true },
  'admin-cs-reps': { newApi: true, mockApi: false },
  'admin-create-cs-rep': { newApi: true, mockApi: false },
  'admin-update-cs-rep': { newApi: true, mockApi: false },
  'admin-update-user': { newApi: true, mockApi: false },
  'admin-find-managed-contact': { newApi: true, mockApi: false },
  'admin-find-user-contact-messages': { newApi: true, mockApi: false },
  'admin-unsubscribe-managed-contact': { newApi: true, mockApi: false },
  'admin-find-offer': { newApi: true, mockApi: false },
  'admin-cancel-order': { newApi: true, mockApi: false },
  'admin-order-payments': { newApi: true, mockApi: false },
  'admin-order-histories': { newApi: true, mockApi: false },
  'admin-order-detail': { newApi: true, mockApi: false },
  'admin-update-schedule': { newApi: true, mockApi: false },
  // Unsubscribe — managedContact.find({ type: 'email' }) + managedContact.unsubscribe
  'admin-unsubscribe': { newApi: true, mockApi: false },
  'admin-unsubscribe-delete': { newApi: true, mockApi: false },
  // Phone opt-outs — managedContact.find({ type: 'phone' }) + managedContact.unsubscribe
  'admin-phone-optout': { newApi: true, mockApi: false },
  'admin-phone-optout-delete': { newApi: true, mockApi: false },
  // User contacts (notes + csr mail) — findUserContacts requires userId
  'admin-user-contacts': { newApi: true, mockApi: false },
  'admin-find-all-user-contacts': { newApi: true, mockApi: false },
  'admin-create-note': { newApi: true, mockApi: false },
  'admin-create-contact-note': { newApi: true, mockApi: false },
  'admin-update-note': { newApi: true, mockApi: false },
  'admin-create-csr-mail': { newApi: true, mockApi: false },
  // CSR-initiated billing sale — commerceBilling/sale via admin session
  'admin-create-order': { newApi: true, mockApi: false },
  // Tracking — database/search on 'tracking' collection
  'admin-user-tracking': { newApi: true, mockApi: false },
  // Consumer: user's own support messages via user.getContacts
  'get-user-contacts': { newApi: true, mockApi: false },
  // Consumer: new BC message.contact.* endpoints
  'create-contact-message': { newApi: true, mockApi: false },
  'reply-contact-message': { newApi: true, mockApi: false },
  'contact-histories': { newApi: true, mockApi: false },
  // Consumer: tracking events (agreement timestamps, compliance)
  'tracking-create': { newApi: true, mockApi: false },
  // CSR: find visitor contact messages
  'admin-find-contacts': { newApi: true, mockApi: false },
  // CSR: link visitor contact to user account
  'admin-change-contact-to-user': { newApi: true, mockApi: false },
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
