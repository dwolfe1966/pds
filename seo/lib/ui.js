// Shared server-rendered chrome for hub + leaf pages (styles, breadcrumbs, the
// FCRA/opt-out footer). Server components — no client JS. Keeps the generated
// hub pages visually + legally consistent without duplicating markup.

import { MAIN } from './site';

export const ui = {
  main: { maxWidth: 760, margin: '0 auto', padding: '32px 16px' },
  card: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '20px 24px', marginBottom: 16 },
  link: { color: '#0d5d2f', textDecoration: 'none' },
  muted: { color: '#6b7280' },
  h1: { margin: '0 0 4px', fontSize: 30 },
  cta: { display: 'inline-block', background: '#0d5d2f', color: '#fff', padding: '12px 22px', borderRadius: 8, fontWeight: 700, textDecoration: 'none' },
};

// Breadcrumb nav from [{name, path}] (last item is current = not linked).
export function Breadcrumbs({ crumbs }) {
  return (
    <nav style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
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
    <footer style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.6, marginTop: 24 }}>
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
