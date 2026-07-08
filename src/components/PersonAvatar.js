import React from 'react';

// Shared person avatar — one treatment across the SERP card, SUP vCard, and Payment
// vCard. Background varies per person (deterministic by id/name); known gender shows
// initials + a ♂/♀ badge, unknown gender shows a neutral person silhouette.
const AV_BGS = [
  { bg: '#eef2ff', fg: '#4f46e5' }, { bg: '#ecfdf5', fg: '#059669' },
  { bg: '#fff7ed', fg: '#c2410c' }, { bg: '#fdf2f8', fg: '#be185d' },
  { bg: '#eff6ff', fg: '#2563eb' }, { bg: '#f5f3ff', fg: '#7c3aed' },
  { bg: '#fefce8', fg: '#a16207' }, { bg: '#f0fdfa', fg: '#0d9488' },
];

export function PersonAvatar({ person = {}, size = 40 }) {
  let h = 0;
  for (const c of String(person.id || person.fullName || '')) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const av = AV_BGS[h % AV_BGS.length];
  const initials = (person.fullName || '?')
    .split(/\s+/).filter(Boolean).slice(0, 2).map((n) => n[0]).join('').toUpperCase() || '?';
  const g = String(person.gender || '').toLowerCase();
  const sym = (g === 'male' || g === 'm') ? '♂' : (g === 'female' || g === 'f') ? '♀' : null;
  const badge = Math.max(Math.round(size * 0.42), 15);

  return (
    <div style={{ position: 'relative', flexShrink: 0, width: size, height: size }}>
      <div style={{
        width: size, height: size, borderRadius: '50%', backgroundColor: av.bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: av.fg, fontWeight: 700, fontSize: Math.round(size * 0.36), letterSpacing: '0.02em',
      }}>
        {sym ? initials : (
          <svg viewBox="0 0 24 24" width={Math.round(size * 0.5)} height={Math.round(size * 0.5)} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4" /><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" /></svg>
        )}
      </div>
      {sym && (
        <span aria-hidden="true" style={{
          position: 'absolute', bottom: -2, right: -2, width: badge, height: badge, borderRadius: '50%',
          background: '#fff', border: `1.5px solid ${av.bg}`, color: av.fg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: Math.round(badge * 0.62), lineHeight: 1, fontWeight: 700, boxShadow: '0 1px 2px rgba(0,0,0,0.14)',
        }}>{sym}</span>
      )}
    </div>
  );
}

// Proper-case a name for display: "JOHN a. SMITH" → "John A. Smith". Handles spaces,
// hyphens, and apostrophes (o'brien → O'Brien, smith-jones → Smith-Jones).
export function properCaseName(s) {
  return String(s || '').toLowerCase().replace(/(^|[\s'-])([a-z])/g, (m, sep, c) => sep + c.toUpperCase());
}

export default PersonAvatar;
