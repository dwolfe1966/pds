// Shared server-rendered chrome for hub + leaf pages (styles, breadcrumbs, the
// FCRA/opt-out footer). Server components — no client JS. Keeps the generated
// hub pages visually + legally consistent without duplicating markup.

import { MAIN } from './site';

const palette = {
  ink: '#172033',
  body: '#344054',
  muted: '#667085',
  faint: '#8a94a6',
  border: '#d8e0ea',
  softBorder: '#e7edf4',
  surface: '#ffffff',
  soft: '#f6f8fb',
  tint: '#eef6f1',
  accent: '#0d5d2f',
  accentDark: '#084825',
  blue: '#1d4ed8',
};

export const ui = {
  color: palette,
  main: {
    maxWidth: 900,
    margin: '0 auto',
    padding: '40px 18px',
    color: palette.ink,
    fontFamily: 'Arial, Helvetica, sans-serif',
    lineHeight: 1.55,
  },
  card: {
    background: palette.surface,
    border: `1px solid ${palette.softBorder}`,
    borderRadius: 8,
    padding: '22px 24px',
    marginBottom: 18,
    boxShadow: '0 1px 2px rgba(16, 24, 40, 0.04)',
  },
  hero: {
    background: `linear-gradient(180deg, ${palette.soft} 0%, #ffffff 100%)`,
    border: `1px solid ${palette.softBorder}`,
    borderRadius: 8,
    padding: '24px 26px',
    marginBottom: 18,
  },
  link: { color: palette.accent, textDecoration: 'none', fontWeight: 600 },
  muted: { color: palette.muted },
  h1: { margin: '0 0 6px', fontSize: 34, lineHeight: 1.12, letterSpacing: 0, color: palette.ink },
  h2: { margin: '0 0 12px', fontSize: 19, lineHeight: 1.25, color: palette.ink },
  lead: { margin: '0 0 16px', fontSize: 16, lineHeight: 1.7, color: palette.body },
  eyebrow: {
    margin: '0 0 8px',
    fontSize: 12,
    fontWeight: 800,
    color: palette.accent,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  cta: {
    display: 'inline-block',
    background: palette.accent,
    color: '#fff',
    padding: '12px 22px',
    borderRadius: 8,
    fontWeight: 800,
    textDecoration: 'none',
    boxShadow: '0 1px 2px rgba(16, 24, 40, 0.12)',
  },
  secondaryCta: {
    display: 'inline-block',
    color: palette.accent,
    border: `1px solid ${palette.border}`,
    background: '#fff',
    padding: '11px 18px',
    borderRadius: 8,
    fontWeight: 800,
    textDecoration: 'none',
  },
  linkGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
    gap: '8px 18px',
  },
  featureGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
    gap: 10,
  },
  featureItem: {
    background: palette.soft,
    border: `1px solid ${palette.softBorder}`,
    borderRadius: 8,
    padding: '10px 12px',
    color: palette.body,
    fontSize: 14,
    fontWeight: 700,
  },
  chip: {
    fontSize: 12,
    color: palette.body,
    background: palette.tint,
    border: '1px solid #d7e8dc',
    borderRadius: 999,
    padding: '4px 10px',
  },
  source: { margin: '10px 0 0', fontSize: 11, color: palette.faint },
};

// Breadcrumb nav from [{name, path}] (last item is current = not linked).
export function Breadcrumbs({ crumbs }) {
  return (
    <nav style={{ fontSize: 13, color: palette.muted, marginBottom: 18 }}>
      {crumbs.map((c, i) => (
        <span key={c.path || c.name}>
          {i > 0 && ' › '}
          {i < crumbs.length - 1 ? <a href={c.path} style={ui.link}>{c.name}</a> : c.name}
        </span>
      ))}
    </nav>
  );
}

export function FcraFooter() {
  return (
    <footer style={{ fontSize: 12, color: palette.muted, lineHeight: 1.65, marginTop: 28, paddingTop: 18, borderTop: `1px solid ${palette.softBorder}` }}>
      <p>
        IDLookup.AI is not a consumer reporting agency as defined by the Fair Credit Reporting
        Act (FCRA). Do not use this site to make decisions about employment, tenant screening,
        credit, insurance, or any other purpose covered by the FCRA.
      </p>
      <p>
        <a href={`${MAIN}/optout`} style={ui.link}>Remove my information</a>
        {' · '}
        <a href={`${MAIN}/privacy`} style={ui.link}>Privacy Policy</a>
      </p>
    </footer>
  );
}

// Render a list of JSON-LD blocks into the initial HTML.
export function JsonLd({ blocks }) {
  return blocks.map((block, i) => (
    <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(block) }} />
  ));
}
