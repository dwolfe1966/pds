'use client';

// "Who lives here" — the Where×Who fusion, on an ADDRESS search. Reads the searched address from the URL
// (?from=), asks the server for a PRIVACY-PRESERVING teaser (count + masked initials — never full PII), and
// converts to the people-search funnel for the real, gated reveal. Client-only + additive; renders nothing
// without an address or on empty result.
import { useEffect, useState } from 'react';

const MAIN = 'https://www.idlookup.ai';
const C = { ink: '#0f2233', body: '#38465a', muted: '#667085', accent: '#12507e', accentDark: '#0c3a5c' };

export default function WhoLivesHere() {
  const [from, setFrom] = useState('');
  const [data, setData] = useState(null);

  useEffect(() => {
    let alive = true;
    let addr = '';
    try { addr = new URLSearchParams(window.location.search).get('from') || ''; } catch { /* none */ }
    if (!addr) return undefined;
    setFrom(addr);
    fetch(`/api/homefacts/who-lives-here?addr=${encodeURIComponent(addr)}`, { signal: AbortSignal.timeout(14000) })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (alive && d && d.count > 0) setData(d); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  if (!data) return null;
  const href = `${MAIN}/name/landing/v2?utm_source=idlookup.me&utm_medium=referral&utm_campaign=homefacts-wlh`;

  return (
    <section style={{ position: 'relative', overflow: 'hidden', background: `linear-gradient(135deg, ${C.accent} 0%, ${C.accentDark} 100%)`, color: '#fff', borderRadius: 14, padding: 'clamp(20px,2.8vw,28px)', marginBottom: 16, boxShadow: '0 1px 2px rgba(15,34,51,.06), 0 12px 34px rgba(18,80,126,.28)' }}>
      <p style={{ margin: 0, fontSize: 12, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', opacity: 0.8 }}>Who lives here</p>
      <h2 style={{ margin: '6px 0 0', fontSize: 'clamp(20px,2.6vw,26px)', fontWeight: 840, letterSpacing: '-.025em' }}>
        {data.count} {data.count === 1 ? 'person is' : 'people are'} associated with this address
      </h2>
      <p style={{ margin: '8px 0 0', fontSize: 14, opacity: 0.92, lineHeight: 1.5, maxWidth: '60ch' }}>
        Current and past residents, with contact details, relatives, and public records. Confirm identities and see full profiles:
      </p>
      {data.residents && data.residents.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: '14px 0 4px' }}>
          {data.residents.map((r, i) => (
            <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13.5, fontWeight: 700, background: 'rgba(255,255,255,.14)', border: '1px solid rgba(255,255,255,.22)', borderRadius: 999, padding: '6px 13px' }}>
              <span style={{ filter: 'blur(3px)', userSelect: 'none' }}>{r.initials}</span>
              {r.band && <span style={{ opacity: 0.85 }}>{r.band}</span>}
            </span>
          ))}
        </div>
      )}
      <a href={href} style={{ display: 'inline-block', marginTop: 14, background: '#fff', color: C.accentDark, fontWeight: 800, fontSize: 15, padding: '12px 22px', borderRadius: 10, textDecoration: 'none' }}>
        See who lives here →
      </a>
      <p style={{ margin: '12px 0 0', fontSize: 11, opacity: 0.7 }}>Names shown masked for privacy. Not for FCRA-regulated uses.</p>
    </section>
  );
}
