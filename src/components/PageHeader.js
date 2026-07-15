import React from 'react';

/**
 * Shared member-page layout template — one construct, used on every main page for continuity:
 *   <PageShell><PageHeader title subtitle right? /> …white "well" cards on the gray page… </PageShell>
 *
 * - Gray page background (#f7f8fa), centered max-width container.
 * - Left-aligned Title + subtitle, identical font/size/placement everywhere.
 * - Content sits in white cards ("wells") over the gray; use a 2-col grid for left/right wells.
 */

export const PAGE_BG = '#f7f8fa';
const MAXW = 1180;

export function PageShell({ children, maxWidth = MAXW }) {
  return (
    <main style={{ background: PAGE_BG, minHeight: 'calc(100vh - 4rem)', paddingBottom: '3rem' }}>
      <div style={{ maxWidth, margin: '0 auto', padding: '1.5rem 1rem 0' }}>
        {children}
      </div>
    </main>
  );
}

export default function PageHeader({ title, subtitle, right }) {
  return (
    <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
      <div style={{ minWidth: 0 }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: '#111827', letterSpacing: '-0.01em' }}>{title}</h1>
        {subtitle && (
          <p style={{ margin: '0.35rem 0 0', fontSize: '0.95rem', color: '#6b7280', maxWidth: 680, lineHeight: 1.5 }}>{subtitle}</p>
        )}
      </div>
      {right && <div style={{ flexShrink: 0 }}>{right}</div>}
    </header>
  );
}
