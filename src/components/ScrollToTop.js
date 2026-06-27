import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { gtmPageView } from '../services/gtm';

/**
 * Maps a route to a unique, human-readable page title. Without this, document.title is
 * the static brand name on every page, so GA4's page_title dimension (its default
 * "Pages and screens" grouping) collapses the whole funnel into one row. Deterministic
 * (derived here, not raced against page components setting their own title).
 */
export function titleForPath(pathname) {
  const p = (pathname || '/').replace(/\/+$/, '') || '/';

  // Funnel: /{name|phone|email}/landing[/vN] | /loader | /search-result
  const funnel = p.match(/^\/(name|phone|email)\/(landing(?:\/v(\d+))?|loader|search-result)/);
  if (funnel) {
    const kind = { name: 'Name', phone: 'Phone', email: 'Email' }[funnel[1]];
    if (funnel[2].startsWith('landing')) return `${kind} Search · LP${funnel[3] ? ' v' + funnel[3] : ''}`;
    if (funnel[2] === 'loader') return `${kind} Search · Searching`;
    return `${kind} Search · Results`;
  }

  const MAP = {
    '/': 'Home',
    '/signup': 'Sign Up', '/signup/v2': 'Sign Up', '/name/signup': 'Sign Up',
    '/payment': 'Payment',
    '/paymentconfirm': 'Order Confirmation',
    '/people-results': 'Search Results', '/search-results': 'Search Results', '/people-search': 'People Search',
    '/about': 'About', '/contact': 'Contact Us',
    '/privacy': 'Privacy Policy', '/terms': 'Terms of Use', '/refund': 'Refund Policy',
    '/opt-out': 'Opt Out', '/suppression-list': 'Suppression List', '/unsubscribe': 'Unsubscribe',
    '/partner': 'Partner',
    '/login': 'Log In', '/logout': 'Log Out', '/forgot-password': 'Forgot Password',
    '/dashboard': 'Dashboard', '/dashboard2': 'Dashboard', '/account': 'Account',
    '/profile': 'Profile', '/settings': 'Settings', '/alerts': 'Alerts',
    '/search': 'Search', '/search-history': 'Search History', '/who-is-searching': 'Who Is Searching',
  };
  if (MAP[p]) return MAP[p];

  // Dynamic segments
  if (/^\/people\//.test(p)) return 'Report Detail';
  if (/^\/contact\/thread\//.test(p)) return 'Contact Thread';
  if (/^\/search\//.test(p)) return 'Search';

  // Fallback: title-case the last path segment
  const seg = p.split('/').filter(Boolean).pop() || 'Home';
  return seg.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Scrolls to top on route change and fires a GTM virtual pageview with a per-route title.
 */
const ScrollToTop = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
    const title = titleForPath(pathname);
    try { document.title = title; } catch { /* SSR / non-DOM */ }
    gtmPageView(pathname, title);
  }, [pathname]);

  return null;
};

export default ScrollToTop;
