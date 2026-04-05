import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { gtmPageView } from '../services/gtm';

/**
 * Scrolls the window to the top when the route changes.
 * Also fires a GTM virtual pageview for SPA navigation tracking.
 */
const ScrollToTop = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
    gtmPageView(pathname);
  }, [pathname]);

  return null;
};

export default ScrollToTop;
