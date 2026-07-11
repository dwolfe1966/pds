import React, { useEffect, useRef, useState } from 'react';

/**
 * Social-proof / trust assets for the BeenVerified-style optional flow.
 * All inline SVG / CSS — no external images (CSP-safe, no trademark/asset risk).
 *
 * ⚠️ PLACEHOLDER DATA (owner to approve before live traffic): the review count,
 * star rating, live counter, testimonials, and use-case percentages below are
 * ILLUSTRATIVE. BeenVerified shows real (or at least substantiated) figures;
 * do not run these as factual claims on real ad traffic until the owner supplies
 * approved numbers/copy. Everything is centralized in PLACEHOLDER_* consts so it's
 * a one-place swap. See docs/design/funnel-mimic-plan.md.
 */

export const PLACEHOLDER_RATING = 4.7;
export const PLACEHOLDER_REVIEWS = '2,500+';
export const PLACEHOLDER_REPORTS_BASE = 146000000; // "reports generated" live counter seed
export const PLACEHOLDER_TESTIMONIALS = [
  { q: 'Reconnected with a cousin I hadn’t spoken to in 20 years.', a: 'Sarah M.' },
  { q: 'Checked out a buyer before meeting them to sell my car. Peace of mind.', a: 'David R.' },
  { q: 'Found the right contact info when an old friend moved away.', a: 'Priya K.' },
  { q: 'Confirmed who kept calling from a number I didn’t recognize.', a: 'James T.' },
];
// Use-case donut infographic ("How people use it") — BV's normalization device.
export const PLACEHOLDER_USE_CASES = [
  { label: 'Curiosity', pct: 21, color: '#16a34a' },
  { label: 'Phone / Email', pct: 20, color: '#0d9488' },
  { label: 'Family & Friends', pct: 19, color: '#2563eb' },
  { label: 'Personal Records', pct: 17, color: '#7c3aed' },
  { label: 'Dating Safety', pct: 13, color: '#db2777' },
  { label: 'Address & Property', pct: 10, color: '#f59e0b' },
];

/** ★ rating + review count. */
export function ReviewStars({ rating = PLACEHOLDER_RATING, count = PLACEHOLDER_REVIEWS }) {
  const full = Math.round(rating);
  return (
    <div style={ss.stars}>
      <span style={{ color: '#f59e0b', letterSpacing: 1 }}>{'★'.repeat(full)}{'☆'.repeat(5 - full)}</span>
      <span style={ss.starsText}>{rating.toFixed(1)} · {count} reviews</span>
    </div>
  );
}

/** Row of security/compliance badges (about data security, NOT search confidentiality). */
export function TrustBadges() {
  const badges = ['🔒 SSL Encrypted', 'SOC 2 Type II', 'Secure Checkout'];
  return (
    <div style={ss.badges}>
      {badges.map((b) => <span key={b} style={ss.badge}>{b}</span>)}
    </div>
  );
}

/** Animated "reports generated" live counter (BV's 146M+ device). PLACEHOLDER. */
export function LiveStat({ base = PLACEHOLDER_REPORTS_BASE, label = 'reports generated' }) {
  const [n, setN] = useState(base);
  const ref = useRef(base);
  useEffect(() => {
    const id = setInterval(() => { ref.current += Math.floor(3 + (ref.current % 7)); setN(ref.current); }, 900);
    return () => clearInterval(id);
  }, []);
  return (
    <div style={ss.liveStat}>
      <span style={ss.liveNum}>{n.toLocaleString('en-US')}+</span>
      <span style={ss.liveLabel}>{label}</span>
    </div>
  );
}

/** Rotating testimonial card. */
export function Testimonials({ items = PLACEHOLDER_TESTIMONIALS, intervalMs = 4000 }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((x) => (x + 1) % items.length), intervalMs);
    return () => clearInterval(id);
  }, [items.length, intervalMs]);
  const t = items[i];
  return (
    <div style={ss.testimonial}>
      <span style={{ color: '#f59e0b' }}>★★★★★</span>
      <p style={ss.tq}>“{t.q}”</p>
      <p style={ss.ta}>— {t.a}</p>
    </div>
  );
}

/** Inline-SVG donut "How people use it" infographic. PLACEHOLDER percentages. */
export function UseCaseDonut({ data = PLACEHOLDER_USE_CASES, title = 'How people use IDLookup' }) {
  const R = 52, C = 2 * Math.PI * R;
  let offset = 0;
  return (
    <div style={ss.donutWrap}>
      <p style={ss.donutTitle}>{title}</p>
      <div style={ss.donutRow}>
        <svg width="120" height="120" viewBox="0 0 120 120" aria-hidden="true">
          <g transform="rotate(-90 60 60)">
            {data.map((d) => {
              const seg = (d.pct / 100) * C;
              const el = (
                <circle key={d.label} cx="60" cy="60" r={R} fill="none" stroke={d.color} strokeWidth="14"
                  strokeDasharray={`${seg} ${C - seg}`} strokeDashoffset={-offset} />
              );
              offset += seg;
              return el;
            })}
          </g>
        </svg>
        <ul style={ss.legend}>
          {data.map((d) => (
            <li key={d.label} style={ss.legendItem}>
              <span style={{ ...ss.dot, background: d.color }} /> {d.label} <b>{d.pct}%</b>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

const ss = {
  stars: { display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', margin: '.5rem 0' },
  starsText: { fontSize: 13, color: '#6b7280' },
  badges: { display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center', margin: '.5rem 0 0' },
  badge: { fontSize: 11, color: '#4b5563', background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 999, padding: '3px 8px' },
  liveStat: { textAlign: 'center', margin: '.75rem 0' },
  liveNum: { display: 'block', fontSize: 18, fontWeight: 700, color: '#0d5d2f', fontVariantNumeric: 'tabular-nums' },
  liveLabel: { fontSize: 12, color: '#6b7280' },
  testimonial: { background: '#fafcfb', border: '1px solid #eef2f0', borderRadius: 10, padding: '.75rem 1rem', textAlign: 'center' },
  tq: { fontSize: 14, color: '#374151', margin: '.35rem 0', lineHeight: 1.4 },
  ta: { fontSize: 12, color: '#6b7280', margin: 0 },
  donutWrap: { background: '#fff', border: '1px solid #eef2f0', borderRadius: 12, padding: '1rem' },
  donutTitle: { fontSize: 13, fontWeight: 600, color: '#111', margin: '0 0 .5rem', textAlign: 'center' },
  donutRow: { display: 'flex', gap: 14, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' },
  legend: { listStyle: 'none', padding: 0, margin: 0, fontSize: 12, color: '#374151', display: 'grid', gap: 4 },
  legendItem: { display: 'flex', alignItems: 'center', gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 3, display: 'inline-block' },
};
