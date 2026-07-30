// HomeFacts design system + shared chrome for the /homefacts area-profile pages (city · county · zip).
// Server components, inline styles (matches the codebase). The area profiles are the CEO-demo surface, so this
// is a deliberate, product-grade look — distinct from the /people directory's green.
//
// BRAND is one flip-able block: it defaults to the evolved-HomeFacts blue + "Homefacts" wordmark used in the
// pitch deck, so the live demo and the deck read as the same product. Set THEME to 'idlookup' to fall back to
// the site green.
import { MAIN } from './site';

const THEME = 'homefacts';
const BRANDS = {
  homefacts: { name: 'Homefacts', by: 'by IDLookup', accent: '#12507e', accentDark: '#0c3a5c', accentSoft: '#e8f1f8', accentLine: '#cbe0ef' },
  idlookup: { name: 'IDLookup', by: '', accent: '#0d5d2f', accentDark: '#084825', accentSoft: '#e7f3ec', accentLine: '#bfe0cb' },
};
export const BRAND = BRANDS[THEME];

const C = {
  ink: '#0f2233', body: '#38465a', muted: '#667085', faint: '#8a94a6',
  line: '#dde5ec', line2: '#eef2f6', surface: '#ffffff', bg: '#f4f6f8', soft: '#f6f9fb',
  accent: BRAND.accent, accentDark: BRAND.accentDark, accentSoft: BRAND.accentSoft, accentLine: BRAND.accentLine,
};
export const hfColor = C;

export const hf = {
  page: { background: C.bg, minHeight: '100vh', color: C.ink, fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif', lineHeight: 1.55 },
  main: { maxWidth: 960, margin: '0 auto', padding: '24px 18px 64px' },
  h1: { margin: '0 0 4px', fontSize: 'clamp(27px,4vw,38px)', fontWeight: 820, letterSpacing: '-.025em', lineHeight: 1.08, color: C.ink },
  eyebrow: { margin: '0 0 9px', fontSize: 12, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: C.accent },
  h2: { margin: 0, fontSize: 21, fontWeight: 800, letterSpacing: '-.015em', color: C.ink },
  lead: { margin: '10px 0 0', fontSize: 16, lineHeight: 1.6, color: C.body },
  card: { background: C.surface, border: `1px solid ${C.line}`, borderRadius: 14, padding: 'clamp(18px,2.4vw,26px)', marginBottom: 16, boxShadow: '0 1px 2px rgba(15,34,51,.04), 0 8px 26px rgba(15,34,51,.05)' },
  link: { color: C.accent, textDecoration: 'none', fontWeight: 600 },
  source: { margin: '14px 0 0', fontSize: 11.5, color: C.faint, lineHeight: 1.5 },
  chip: { fontSize: 12, fontWeight: 600, color: C.accentDark, background: C.accentSoft, border: `1px solid ${C.accentLine}`, borderRadius: 999, padding: '4px 11px' },
  cta: { display: 'inline-block', background: C.accent, color: '#fff', padding: '13px 22px', borderRadius: 10, fontWeight: 800, textDecoration: 'none' },
  secondaryCta: { display: 'inline-block', color: C.accent, border: `1px solid ${C.accentLine}`, background: '#fff', padding: '11px 18px', borderRadius: 10, fontWeight: 800, textDecoration: 'none' },
  linkGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: '8px 18px' },
};

// Sticky top bar with the wordmark + a "New search" affordance. Consistent across all area profiles.
export function HfHeader() {
  return (
    <header style={{ position: 'sticky', top: 0, zIndex: 20, background: 'rgba(255,255,255,0.92)', backdropFilter: 'saturate(1.4) blur(8px)', borderBottom: `1px solid ${C.line}` }}>
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
        <a href="/homefacts" style={{ textDecoration: 'none', display: 'flex', alignItems: 'baseline', gap: 7 }}>
          <span style={{ fontSize: 20, fontWeight: 850, letterSpacing: '-.02em', color: C.accent }}>{BRAND.name}</span>
          {BRAND.by && <span style={{ fontSize: 12, color: C.muted, fontWeight: 600 }}>{BRAND.by}</span>}
        </a>
        <a href="/homefacts" style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 700, color: C.accent, textDecoration: 'none', border: `1px solid ${C.accentLine}`, borderRadius: 8, padding: '7px 14px' }}>
          New search
        </a>
      </div>
    </header>
  );
}

export function HfBreadcrumbs({ crumbs }) {
  return (
    <nav style={{ fontSize: 13, color: C.muted, margin: '0 0 16px' }}>
      {crumbs.map((c, i) => (
        <span key={c.path || c.name}>
          {i > 0 && <span style={{ color: C.faint }}> › </span>}
          {i < crumbs.length - 1 ? <a href={c.path} style={hf.link}>{c.name}</a> : <span style={{ color: C.body }}>{c.name}</span>}
        </span>
      ))}
    </nav>
  );
}

// Scannable "report card" — headline metrics in a row. `tone` (a hex) tints a value (used for the risk rating).
export function SummaryBand({ items }) {
  if (!items || !items.length) return null;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(120px, 1fr))`, gap: 1, background: C.line, border: `1px solid ${C.line}`, borderRadius: 12, overflow: 'hidden', marginTop: 18 }}>
      {items.map((it) => (
        <div key={it.label} style={{ background: C.surface, padding: '13px 15px' }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase', color: C.muted }}>{it.label}</div>
          <div style={{ fontSize: 19, fontWeight: 820, letterSpacing: '-.01em', marginTop: 3, color: it.tone || C.accent }}>{it.value}</div>
        </div>
      ))}
    </div>
  );
}

// Sticky section nav (pills). `items` = [{id,label}].
export function SectionNav({ items }) {
  return (
    <nav aria-label="Report sections" style={{ position: 'sticky', top: 53, zIndex: 10, background: C.bg, padding: '12px 0 8px', margin: '2px 0 8px', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {items.map((m) => (
        <a key={m.id} href={`#${m.id}`} style={{ fontSize: 13, fontWeight: 700, color: C.body, background: C.surface, border: `1px solid ${C.line}`, borderRadius: 999, padding: '6px 13px', textDecoration: 'none' }}>{m.label}</a>
      ))}
    </nav>
  );
}

// A module block: eyebrow + title + body + optional source. No emoji markers — hierarchy carries it.
export function Section({ id, eyebrow, title, source, children, right }) {
  return (
    <section id={id} style={hf.card}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
        <div>
          {eyebrow && <p style={hf.eyebrow}>{eyebrow}</p>}
          <h2 style={hf.h2}>{title}</h2>
        </div>
        {right}
      </div>
      {children}
      {source && <p style={hf.source}>{source}</p>}
    </section>
  );
}

// Stat tiles (label + value).
export function StatGrid({ stats }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
      {stats.map((s) => (
        <div key={s.label} style={{ background: C.soft, border: `1px solid ${C.line2}`, borderRadius: 10, padding: '13px 15px' }}>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', color: C.muted, fontWeight: 800 }}>{s.label}</div>
          <div style={{ fontSize: 20, fontWeight: 820, color: C.accent, marginTop: 3 }}>{s.value}</div>
        </div>
      ))}
    </div>
  );
}

// Horizontal severity bar (label · bar · rating), colored by `color`.
export function Bar({ label, pct, color, right }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '7px 0', fontSize: 13 }}>
      <span style={{ width: 150, color: C.body }}>{label}</span>
      <span style={{ flex: 1, height: 8, background: '#e9eef3', borderRadius: 999, overflow: 'hidden' }}>
        <span style={{ display: 'block', height: '100%', width: `${Math.min(100, pct)}%`, background: color || C.accent }} />
      </span>
      {right != null && <span style={{ width: 120, textAlign: 'right', color: color || C.muted, fontWeight: 700, fontSize: 12 }}>{right}</span>}
    </div>
  );
}

export const hfSecondaryLink = `${MAIN}`;
