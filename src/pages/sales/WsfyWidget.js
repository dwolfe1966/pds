import React, { useMemo } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * WSFY embeddable partner widget (a.3, owner 2026-08-15) — the "Who's searching for YOU" acquisition hook.
 *
 * Meant to be dropped into a PARTNER page as an iframe:
 *   <iframe src="https://www.idlookup.ai/widget/wsfy?partner=homefacts&shn=<token>"
 *           style="width:100%;max-width:420px;height:220px;border:0"></iframe>
 *
 * Bare by design (chrome suppressed via SELF_CHROME_PREFIXES). The CTA is a target="_top" link so the
 * click breaks OUT of the iframe and navigates the parent tab to our free-tier funnel (/my-exposure) —
 * a full-page experience, not trapped in the frame. A user click is required, which also satisfies
 * cross-origin top-navigation. Partner attribution (partner/shn/utm) is read from the widget's own URL and
 * forwarded to the funnel so the traffic is credited. First-party curiosity hook — no data claims, no PII.
 */

const C = {
  ink: '#0f2010', mut: '#5b6672', line: '#dfe5ea',
  cta: '#0d5d2f', ctaText: '#fff', accentSoft: '#e7f3ec',
};

export default function WsfyWidget() {
  const location = useLocation();
  const p = useMemo(() => new URLSearchParams(location.search), [location.search]);

  // Attribution the partner sets on the iframe src (any casing). Forwarded to the funnel.
  const partner = p.get('partner') || p.get('utm_source') || 'widget';
  const shn = p.get('shn') || '';

  const funnelUrl = useMemo(() => {
    const origin = (typeof window !== 'undefined' && window.location && window.location.origin) || 'https://www.idlookup.ai';
    const q = new URLSearchParams();
    q.set('utm_source', partner);
    q.set('utm_medium', 'widget');
    q.set('utm_campaign', 'wsfy');
    if (shn) q.set('shn', shn);
    return `${origin}/my-exposure?${q.toString()}`;
  }, [partner, shn]);

  return (
    <div style={{ fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif', padding: 8, boxSizing: 'border-box', background: 'transparent' }}>
      <div style={{ maxWidth: 440, margin: '0 auto', background: '#fff', border: `1px solid ${C.line}`, borderRadius: 14, padding: '16px 18px', boxShadow: '0 1px 2px rgba(20,24,29,.05),0 10px 30px rgba(20,24,29,.08)', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, alignSelf: 'flex-start', fontSize: 11.5, fontWeight: 700, letterSpacing: '.03em', textTransform: 'uppercase', color: C.cta, background: C.accentSoft, border: '1px solid #cfe0d6', padding: '4px 10px', borderRadius: 999 }}>
          👁 Powered by IDLookup.AI
        </div>
        <div style={{ fontSize: 18, fontWeight: 800, color: C.ink, lineHeight: 1.2 }}>
          Is someone searching for you?
        </div>
        <div style={{ fontSize: 13, color: C.mut, lineHeight: 1.5 }}>
          People look up your address, phone, and public records every day. See who&apos;s been searching for you — and exactly what&apos;s exposed about you online.
        </div>
        <a href={funnelUrl} target="_top" rel="noopener"
          style={{ display: 'block', textAlign: 'center', background: C.cta, color: C.ctaText, textDecoration: 'none', borderRadius: 10, padding: '13px 20px', fontSize: 15.5, fontWeight: 800 }}>
          See who&apos;s searching for you →
        </a>
        <div style={{ fontSize: 11.5, color: '#9aa4ad', textAlign: 'center' }}>Free to check · No card required</div>
      </div>
    </div>
  );
}
