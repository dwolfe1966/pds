/**
 * Google Tag Manager dataLayer helpers.
 *
 * GTM is loaded via a script tag in index.html. This module pushes
 * events to `window.dataLayer` for Google Analytics and Google Ads.
 *
 * Usage:
 *   gtmPageView('/some/path', 'Page Title');
 *   gtmEvent('sign_up', { method: 'email' });
 */

function push(data) {
  if (typeof window !== 'undefined') {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(data);
  }
}

/** Virtual page view — call on every SPA route change */
export function gtmPageView(path, title) {
  push({
    event: 'virtualPageview',
    pagePath: path,
    pageTitle: title || document.title,
  });
}

/** Custom event — maps to GA4 events and Google Ads conversions */
export function gtmEvent(eventName, params = {}) {
  push({ event: eventName, ...params });
}
