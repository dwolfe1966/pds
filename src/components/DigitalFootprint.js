import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMappedIdentity, fetchMappedIdentity, fetchSuppression } from '../services/memberEnrichment';

/**
 * "Your Digital Footprint" — the Transparency + Control panel (see docs/design/profile-concept-model.md).
 * Aggregates where a person is represented across the web and gives a manage action per source. Leads
 * with the core narrative: you can't delete yourself from the internet, but you can take control.
 *
 * Two roles behind one component:
 *  - idlookup row — OUR surface, real status from the member's suppression state (Visible / Hidden), and a
 *    real control (Manage → /my-identity).
 *  - broker/Google rows — the ecosystem. We provide the opt-out PATH (honest: we offer the route, we don't
 *    assert live presence). Automated at-the-source removal is the phase-2 north star.
 *
 * <DigitalFootprint compact /> — Dashboard summary + CTA. <DigitalFootprint /> — full list (top of My Identity).
 */

const GREEN = '#0d5d2f';

// Major people-search brokers with their real opt-out entry points. Ordered by prominence.
const BROKERS = [
  { key: 'spokeo', name: 'Spokeo', url: 'https://www.spokeo.com/optout' },
  { key: 'beenverified', name: 'BeenVerified', url: 'https://www.beenverified.com/app/optout/search' },
  { key: 'peoplefinders', name: 'PeopleFinders', url: 'https://www.peoplefinders.com/opt-out' },
  { key: 'whitepages', name: 'Whitepages', url: 'https://www.whitepages.com/suppression-requests' },
  { key: 'intelius', name: 'Intelius', url: 'https://www.intelius.com/opt-out/' },
  { key: 'radaris', name: 'Radaris', url: 'https://radaris.com/control/privacy' },
  { key: 'mylife', name: 'MyLife', url: 'https://www.mylife.com/ccpa/index.pubview' },
];
const GOOGLE = { key: 'google', name: 'Google Search results', url: 'https://myactivity.google.com/results-about-you' };

function Badge({ label, color, bg }) {
  return <span style={{ fontSize: 11.5, fontWeight: 700, color, background: bg, borderRadius: 999, padding: '3px 10px', whiteSpace: 'nowrap' }}>{label}</span>;
}

function Avatar({ name }) {
  return (
    <span aria-hidden="true" style={{ width: 30, height: 30, borderRadius: 8, background: '#f0fdf4', border: '1px solid #d1fae5', color: GREEN, fontWeight: 800, fontSize: 13, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      {(name.trim()[0] || '?').toUpperCase()}
    </span>
  );
}

function Row({ name, statusNode, action }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderTop: '1px solid #f0f2f1' }}>
      <Avatar name={name} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{name}</div>
        <div style={{ marginTop: 2 }}>{statusNode}</div>
      </div>
      {action}
    </div>
  );
}

export default function DigitalFootprint({ compact = false, onManage } = {}) {
  const navigate = useNavigate();
  // Where "Manage" on the idlookup row goes. On the My Identity footprint tab, onManage switches to the
  // My Profile tab (where the real controls live) — a plain /my-identity navigate would be a no-op there.
  const manage = onManage || (() => navigate('/my-identity'));
  const [identity, setIdentity] = useState(() => getMappedIdentity());
  const [suppressed, setSuppressed] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchMappedIdentity().then((i) => { if (alive && i) setIdentity(i); });
    fetchSuppression().then((s) => { if (alive) setSuppressed(!!(s && s.activityHidden)); });
    return () => { alive = false; };
  }, []);

  const mapped = !!(identity && (identity.confirmed || identity.name || identity.hasReport));
  const siteCount = BROKERS.length + 1; // brokers + Google (idlookup is "ours", counted separately)

  const link = (url) => (
    <a href={url} target="_blank" rel="noopener noreferrer"
      style={{ flexShrink: 0, fontSize: 12.5, fontWeight: 700, color: GREEN, textDecoration: 'none', border: '1px solid #bbf7d0', borderRadius: 999, padding: '5px 12px', whiteSpace: 'nowrap' }}>
      Remove →
    </a>
  );

  // ── Compact (Dashboard) ────────────────────────────────────────────────────
  if (compact) {
    return (
      <div style={{ border: '1px solid #d7ddd9', borderRadius: 14, padding: '18px 20px', background: '#fff', boxShadow: '0 2px 10px rgba(13,93,47,0.06)' }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: '#111827' }}>Your Digital Footprint <span style={{ fontWeight: 600, fontSize: 12.5, color: '#9ca3af' }}>· across the web</span></div>
        <p style={{ margin: '6px 0 14px', fontSize: 13.5, color: '#4b5563', lineHeight: 1.5 }}>
          Your personal info is spread across {siteCount}+ people-search sites and data brokers. You can't erase it all —
          but you can take control.
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button type="button" onClick={() => navigate('/my-identity')}
            style={{ background: GREEN, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 18px', fontSize: 14, fontWeight: 800, cursor: 'pointer' }}>
            {mapped ? 'Manage my footprint →' : 'See my digital footprint →'}
          </button>
          <Badge label={mapped ? (suppressed ? '✓ Hidden on ' + 'idlookup' : 'Visible on idlookup') : 'Not yet claimed'}
            color={mapped && suppressed ? GREEN : '#92400e'} bg={mapped && suppressed ? '#f0fdf4' : '#fffbeb'} />
        </div>
      </div>
    );
  }

  // ── Full (top of My Identity) ──────────────────────────────────────────────
  return (
    <div style={{ border: '1px solid #d7ddd9', borderRadius: 14, padding: '20px 22px', background: '#fff', boxShadow: '0 2px 10px rgba(13,93,47,0.06)' }}>
      <div style={{ fontSize: 18, fontWeight: 800, color: '#111827' }}>Your Digital Footprint</div>
      <p style={{ margin: '4px 0 0', fontSize: 13, color: '#9ca3af', fontWeight: 600 }}>Where you're represented across the web</p>
      <p style={{ margin: '12px 0 16px', fontSize: 13.5, color: '#4b5563', lineHeight: 1.55 }}>
        Your personal info is spread across dozens of people-search sites and data brokers. <strong>You can't delete
        yourself from the internet</strong> — data re-lists and re-appears. But you <strong>can take control</strong>:
        hide it where we can, and remove it site by site. Here's where to start.
      </p>

      {/* Our surface — real status + real control */}
      <Row
        name="idlookup"
        statusNode={mapped
          ? (suppressed
              ? <Badge label="✓ Hidden here" color={GREEN} bg="#f0fdf4" />
              : <Badge label="Visible in search" color="#92400e" bg="#fffbeb" />)
          : <span style={{ fontSize: 12.5, color: '#6b7280' }}>Claim your record to see &amp; control this</span>}
        action={(
          <button type="button" onClick={manage}
            style={{ flexShrink: 0, fontSize: 12.5, fontWeight: 700, color: '#fff', background: GREEN, border: 'none', borderRadius: 999, padding: '5px 14px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            {mapped ? 'Manage' : 'Claim'}
          </button>
        )}
      />

      {/* The ecosystem — we provide the opt-out path (presence not asserted; automation is phase 2). */}
      {BROKERS.map((b) => (
        <Row key={b.key} name={b.name}
          statusNode={<span style={{ fontSize: 12.5, color: '#6b7280' }}>Opt-out available</span>}
          action={link(b.url)} />
      ))}
      <Row name={GOOGLE.name}
        statusNode={<span style={{ fontSize: 12.5, color: '#6b7280' }}>Request removal from Search</span>}
        action={link(GOOGLE.url)} />

      <p style={{ margin: '14px 0 0', fontSize: 11.5, color: '#9ca3af', lineHeight: 1.5 }}>
        Opt-out links open each site's own removal form. Removals can take days and data can re-list — we'll keep
        helping you monitor and manage it. Automated, one-click removal across sites is coming.
      </p>
    </div>
  );
}
