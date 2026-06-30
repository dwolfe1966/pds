import React from 'react';
import { Link } from 'react-router-dom';
import { useBrand } from '../../services/brand';

/**
 * Minimal legal footer for the self-chrome color landings (v7+). Carries the required
 * Privacy/Terms/Opt-out/Unsubscribe/Contact links + FCRA disclaimer in the landing's own
 * palette, so the green global footer can be suppressed without losing compliance links.
 * Props: bg, fg, accent (palette colors).
 */
const ColorLandingFooter = ({ bg = '#0f2533', fg = 'rgba(255,255,255,0.72)', accent = '#cfe6f2' }) => {
  const brand = useBrand();
  const year = new Date().getFullYear();
  const links = [
    ['/privacy', 'Privacy'], ['/terms', 'Terms'], ['/opt-out', 'Opt Out'],
    ['/unsubscribe', 'Unsubscribe'], ['/contact', 'Contact'],
  ];
  return (
    <footer style={{ background: bg, color: fg, padding: '1.75rem 1rem 2.25rem', textAlign: 'center', fontSize: '0.78rem' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0.4rem 1.1rem', marginBottom: '0.7rem' }}>
        {links.map(([to, label]) => (
          <Link key={to} to={to} style={{ color: accent, textDecoration: 'none', fontWeight: 600 }}>{label}</Link>
        ))}
      </div>
      <p style={{ margin: '0 auto 0.5rem', maxWidth: 460, lineHeight: 1.45, opacity: 0.85 }}>
        {brand.name} is not a consumer reporting agency under the FCRA. Information may not be used for
        employment, tenant, or credit screening.
      </p>
      <p style={{ margin: 0, opacity: 0.6 }}>© {year} {brand.name}. All rights reserved.</p>
    </footer>
  );
};

export default ColorLandingFooter;
