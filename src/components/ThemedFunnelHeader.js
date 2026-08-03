import React from 'react';
import { useBrand } from '../services/brand';

/**
 * Branded header band for themed funnel pages (results, etc.). When the green global nav is
 * suppressed on a themed funnel, this restores a brand anchor in the funnel's own palette so
 * the page reads as branded — not a bleached white expanse. Renders nothing for un-themed
 * (green) funnels, where the normal green nav is present. Props: theme (from useFunnelTheme).
 */
const ThemedFunnelHeader = ({ theme }) => {
  const brand = useBrand();
  if (!theme) return null;
  const onDark = theme.onDark;
  return (
    <div style={{
      background: theme.band,
      color: onDark ? theme.ink : '#ffffff',
      borderBottom: onDark ? `1px solid ${theme.line}` : 'none',
      padding: '0.85rem 1rem 0.95rem',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: '0.82rem', fontWeight: 800, letterSpacing: '0.04em' }}>
        <span style={{ color: onDark ? theme.accent : '#ffffff' }}>{onDark ? '◆' : '🔍'} {brand.name.toUpperCase()}</span>
        <span style={{ opacity: 0.9 }}> · {theme.heroLabel}</span>
      </div>
      <div style={{ fontSize: '0.7rem', opacity: 0.82, marginTop: 3 }}>
        🔒 Secure &amp; encrypted · Jails, prisons &amp; facilities nationwide
      </div>
    </div>
  );
};

export default ThemedFunnelHeader;
