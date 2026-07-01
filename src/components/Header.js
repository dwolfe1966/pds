import React from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import SalesNav from './SalesNav';
import MemberNav from './MemberNav';
import styles from './Header.module.css';

// Color-exploration landings that own their full chrome (their own palette + hero/header).
// The shared green nav would clash with their color scheme, so the global header is
// suppressed entirely on these routes. Add new self-chrome landings here.
export const SELF_CHROME_PREFIXES = ['/name/landing/v7', '/name/landing/v8', '/name/landing/v9', '/name/landing/v10', '/name/landing/v3a', '/name/landing/v3b'];

// Shared funnel pages that carry a funnel theme (loader, results). When a theme is active
// (blue/dark, set by a themed landing), the green global nav/footer would clash — suppress
// them here. Green funnels (no theme) keep the chrome. Payment added once it's themed.
export const THEMED_FUNNEL_PREFIXES = ['/name/loader', '/name/search-result'];
export function funnelThemeActive() {
  try { return !!sessionStorage.getItem('funnel.theme'); } catch { return false; }
}

const Header = () => {
  const { token } = useAuth();
  const { pathname } = useLocation();
  // Suppress the global header on self-chrome landings (regardless of auth) so the green
  // nav never sits above a blue/charcoal hero.
  if (SELF_CHROME_PREFIXES.some((p) => pathname.startsWith(p))) return null;
  // Themed funnel pages (loader/results) suppress the green nav when a theme is active.
  if (funnelThemeActive() && THEMED_FUNNEL_PREFIXES.some((p) => pathname.startsWith(p))) return null;
  // Signup teaser pages (/search/:id) render their own mini-header + a re-skinnable card;
  // suppress the green sales nav there so it doesn't clash with a variant's palette.
  // (Excludes the member /search/all search page, which keeps its nav.)
  if (!token && pathname.startsWith('/search/') && pathname !== '/search/all') return null;
  // Consumer app never renders AdminNav — admins use the separate CSR app build.
  const navComponent = token ? <MemberNav /> : <SalesNav />;
  return (
    <header className={styles.header}>
      {navComponent}
    </header>
  );
};

export default Header;