import { useMemo } from 'react';

/**
 * Funnel theme — the palette set by a themed landing (v3a→'blue', v3b→'dark' via
 * useLandingTrack) and read by the shared funnel pages (loader, results, payment) so the
 * whole path stays visually consistent. Returns null for un-themed/default funnels, in
 * which case pages keep their existing green styling (no override).
 *
 * `blue`  = /name/landing/v3a palette (light + blue + orange CTA).
 * `dark`  = /name/landing/v3b palette (charcoal + amber CTA, light text).
 */
const THEMES = {
  blue: {
    key: 'blue', onDark: false,
    pageBg: 'linear-gradient(180deg,#eef6fb 0%,#ffffff 45%)',
    surface: '#ffffff', ink: '#0f2533', mut: '#5b7484',
    accent: '#007cc2', accentDark: '#055a86', button: '#fd6f0b', line: '#d3e3ec',
    footer: { bg: '#055a86', fg: 'rgba(255,255,255,0.78)', accent: '#cfe6f2' },
  },
  dark: {
    key: 'dark', onDark: true,
    pageBg: 'linear-gradient(180deg,#0f1629 0%,#16213e 100%)',
    surface: '#16213e', ink: '#eef2f9', mut: '#9aa7bd',
    accent: '#f59e0b', accentDark: '#d97706', button: 'linear-gradient(180deg,#f59e0b,#d97706)', line: 'rgba(255,255,255,0.12)',
    footer: { bg: '#0f1629', fg: 'rgba(255,255,255,0.7)', accent: '#f59e0b' },
  },
};

export function useFunnelTheme() {
  return useMemo(() => {
    let t = null;
    try { t = sessionStorage.getItem('funnel.theme'); } catch { /* SSR / blocked */ }
    return THEMES[t] || null; // null → default green styling, no override
  }, []);
}

export default useFunnelTheme;
