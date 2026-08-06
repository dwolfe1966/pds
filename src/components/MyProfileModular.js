import React, { useState, useEffect } from 'react';
import InlineOwnerNote from './InlineOwnerNote';
import { fetchExposureGraph } from '../services/memberEnrichment';
import AddressMap from './AddressMap';
import { fetchSocialPresence } from '../services/socialPresenceService';

// Social-presence enrichment (EXPERIMENTAL, behind REACT_APP_SIGNALS_SOCIAL). On the report we have the
// subject's EMAIL → PDL/Gravatar returns a RICH set (not the spotty name-key). Merged into the existing
// "Online presence" module. ⚠️ PDL terms bar production people-search display — experimental until cleared.
const socialEnrichOn = () => process.env.REACT_APP_SIGNALS_SOCIAL === '1';
const SOC_PLATFORM = { linkedin: 'LinkedIn', facebook: 'Facebook', twitter: 'Twitter / X', instagram: 'Instagram', youtube: 'YouTube', tiktok: 'TikTok', pinterest: 'Pinterest', github: 'GitHub', gravatar: 'Gravatar', quora: 'Quora', crunchbase: 'Crunchbase', angellist: 'AngelList', vimeo: 'Vimeo', 'about.me': 'about.me', wordpress: 'WordPress', reddit: 'Reddit' };
const socPlatform = (n) => SOC_PLATFORM[n] || (String(n || '').charAt(0).toUpperCase() + String(n || '').slice(1));

/**
 * MyProfileModular — My Profile as a social-profile surface (FB/LinkedIn model). See
 * docs/design/profile-concept-model.md.
 *   • Cover-image vCard hero (customizable cover + avatar).
 *   • 2-column layout: LEFT = core content modules, RIGHT = assessment + recommended actions (owner only).
 *   • Modules are SOURCE-CODED (colored accent + label): 'record' (public records), 'observed' (found in
 *     public data), 'user' (you added). Public records are split into Court / Property / Financial.
 *   • Per-module Protect / Promote control (Present vs Expose).
 *   • "Preview as" (View As) switcher — see exactly what an anonymous / free / paid viewer sees.
 * First pass: dispositions + view are local state (persistence next).
 */

const GREEN = '#0d5d2f';

const SOURCE = {
  user:     { color: GREEN,     bg: '#f0fdf4', label: 'You added' },
  observed: { color: '#1d4ed8', bg: '#eff6ff', label: 'From public data' },
  record:   { color: '#b45309', bg: '#fffbeb', label: 'Public record' },
};

const VIEWS = [
  { key: 'you', label: '👤 You (owner)', short: 'owner' },
  { key: 'anonymous', label: '🕶️ Anonymous', short: 'anonymous visitor' },
  { key: 'free', label: '🙂 Free member', short: 'free member' },
  { key: 'paid', label: '💳 Paid member', short: 'paid member' },
];

function DispositionToggle({ value, onChange, protectOnly }) {
  const opt = (key, label) => {
    const active = value === key;
    const protect = key === 'protect';
    return (
      <button type="button" onClick={() => onChange(active ? 'neutral' : key)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, fontWeight: 700,
          border: `1px solid ${active ? (protect ? '#fca5a5' : '#bbf7d0') : '#e5e7eb'}`,
          background: active ? (protect ? '#fef2f2' : '#f0fdf4') : '#fff',
          color: active ? (protect ? '#b91c1c' : GREEN) : '#6b7280',
          borderRadius: 999, padding: '4px 10px', cursor: 'pointer', whiteSpace: 'nowrap',
        }}>
        {label}
      </button>
    );
  };
  return (
    <div style={{ display: 'inline-flex', gap: 6 }}>
      {opt('protect', '🔒 Protect')}
      {!protectOnly && opt('promote', '📣 Promote')}
    </div>
  );
}

function Module({ id, icon, title, source = 'observed', tier = 'free', count, disposition, setDisposition, protectOnly, isOwner = true, locked, blurLocked, canExpand = false, expanded = false, onToggleExpand, children }) {
  const promoted = disposition === 'promote';
  const protectedOn = disposition === 'protect';
  const s = SOURCE[source] || SOURCE.observed;
  const paid = tier === 'paid';
  return (
    <section style={{
      background: '#fff', border: `1px solid ${promoted ? '#bbf7d0' : '#e5e7eb'}`, borderLeft: `4px solid ${s.color}`,
      borderRadius: 12, boxShadow: '0 2px 10px rgba(17,24,39,0.06)', overflow: 'hidden',
    }}>
      {/* Coded header — source-tinted, icon in a source chip, count infographic, source + tier badges. */}
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', padding: '10px 14px', background: s.bg, borderBottom: `1px solid ${s.color}22` }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <span aria-hidden="true" style={{ width: 34, height: 34, borderRadius: 9, background: '#fff', border: `1px solid ${s.color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, flexShrink: 0 }}>{icon}</span>
          <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 14.5, fontWeight: 800, color: '#111827' }}>{title}</span>
              {count != null && count > 0 && <span style={{ fontSize: 11, fontWeight: 800, color: s.color, background: '#fff', border: `1px solid ${s.color}55`, borderRadius: 999, minWidth: 20, textAlign: 'center', padding: '0 6px' }}>{count}</span>}
              {isOwner && protectedOn && <span style={{ fontSize: 11, fontWeight: 700, color: '#b91c1c', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 999, padding: '1px 8px' }}>Hidden</span>}
              {promoted && <span style={{ fontSize: 11, fontWeight: 700, color: GREEN, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 999, padding: '1px 8px' }}>Featured</span>}
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 1 }}>
              <span style={{ fontSize: 10.5, fontWeight: 700, color: s.color }}>{s.label}</span>
              {paid && <span style={{ fontSize: 10, fontWeight: 800, color: '#7c2d12', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 999, padding: '0 6px' }} title="Only paid searchers see this in others' profiles">🔒 PAID</span>}
            </span>
          </span>
        </div>
        {isOwner
          ? <DispositionToggle value={disposition} onChange={(v) => setDisposition(id, v)} protectOnly={protectOnly} />
          : canExpand && (
            <button type="button" onClick={onToggleExpand} aria-expanded={expanded}
              style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 5, border: `1px solid ${s.color}55`,
                background: expanded ? s.color : '#fff', color: expanded ? '#fff' : s.color, borderRadius: 999,
                padding: '5px 12px', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
              {expanded ? 'Hide detail' : 'View detail'}
              <span aria-hidden="true" style={{ display: 'inline-block', transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>⌄</span>
            </button>
          )}
      </header>
      <div style={{ padding: '14px 16px' }}>
        {locked ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 13.5, color: '#7c2d12', fontWeight: 700 }}>🔒 {count != null && count > 0 ? `${count} record${count === 1 ? '' : 's'}` : 'Details'} available to paid members</div>
            {/* Real data is ONLY put in the DOM for the owner previewing their OWN profile (blurLocked).
                For a real non-owner viewer it is NOT rendered — CSS blur would leak paid data. */}
            {blurLocked && <div style={{ filter: 'blur(4px)', userSelect: 'none', pointerEvents: 'none' }} aria-hidden="true">{children}</div>}
            <button type="button" style={{ alignSelf: 'flex-start', background: GREEN, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>Unlock full report →</button>
          </div>
        ) : children}
      </div>
    </section>
  );
}

const Chip = ({ children }) => (
  <span style={{ fontSize: 13, background: '#f8faf9', border: '1px solid #e5e7eb', color: '#374151', borderRadius: 999, padding: '5px 12px' }}>{children}</span>
);
const Row = ({ label, value }) => value ? (
  <div style={{ display: 'flex', gap: 10, fontSize: 13.5, padding: '3px 0' }}>
    <span style={{ color: '#9ca3af', minWidth: 92 }}>{label}</span>
    <span style={{ color: '#111827', fontWeight: 600 }}>{value}</span>
  </div>
) : null;
const wrap = { display: 'flex', flexWrap: 'wrap', gap: 8 };
const none = (t) => <span style={{ color: '#9ca3af', fontSize: 13 }}>{t}</span>;
// Full-detail helpers — one record per Item, labeled fields (F). Used by the `full` renderers so paid/
// owner viewers get every field the report has (no data loss when the profile design replaces the report).
const Item = ({ children }) => <div style={{ padding: '9px 0', borderTop: '1px solid #f3f4f6' }}>{children}</div>;
const Title = ({ children }) => <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{children}</div>;
const F = ({ label, value }) => value ? (
  <span style={{ marginRight: 14, fontSize: 12.5 }}>
    <span style={{ color: '#9ca3af' }}>{label}: </span><span style={{ color: '#111827', fontWeight: 600 }}>{value}</span>
  </span>
) : null;
const Meta = ({ children }) => <div style={{ marginTop: 3, lineHeight: 1.7 }}>{children}</div>;
// A property's `lastSale` is the newest transfer OBJECT (from reportExtract history[0]) — never render it
// directly (React #31). Collapse to a short "$price · date · deed" string; empty string if nothing usable.
const lastSaleText = (ls) => {
  if (!ls) return '';
  if (typeof ls === 'string') return ls;
  const price = (typeof ls.salesPrice === 'number' && !isNaN(ls.salesPrice)) ? `$${ls.salesPrice.toLocaleString()}` : '';
  return [price, ls.date || ls.transferDate, ls.deedType].filter(Boolean).join(' · ');
};

const DEFAULT_DISP = {
  contact: 'protect', locations: 'protect', family: 'protect',
  court: 'protect', property: 'protect', financial: 'protect',
  about: 'neutral', work: 'neutral', education: 'neutral', online: 'promote', activity: 'neutral',
};

export default function MyProfileModular({ data, hero = {}, dispositions, onDispositionChange, mode = 'owner', viewerTier = 'paid' }) {
  // mode: 'owner' = My Profile (controls + View-As preview) | 'others' = viewing someone else's profile
  // (no controls; the viewer's tier is fixed by viewerTier — 'paid' on the report, 'free'/'anonymous' on a tease).
  const ownerMode = mode === 'owner';
  // Owner mode starts from the owner's privacy defaults; others mode starts NEUTRAL (an unclaimed
  // subject hasn't protected anything) overlaid with the subject's stored dispositions if claimed.
  const [disp, setDisp] = useState(() => (ownerMode ? { ...DEFAULT_DISP, ...(dispositions || {}) } : { ...(dispositions || {}) }));
  const [viewAs, setViewAs] = useState('you'); // owner-mode preview switcher only
  // Others/report view only: which areas the viewer has expanded from concise summary → full detail
  // (progressive disclosure). Keyed by module id. Owner/My-Profile ignores this (uses `detailed`).
  const [expandedAreas, setExpandedAreas] = useState({});
  // Update local state AND persist (when a handler is wired — dev preview leaves it local).
  const set = (id, v) => { setDisp((s) => ({ ...s, [id]: v })); if (onDispositionChange) onDispositionChange(id, v); };
  const d = data || {};

  // Owner Voice — the owner's "add your side" per module/area (owner 2026-08-05: belongs on My Profile).
  // Only fetched in owner mode; each note is keyed by area:<moduleId> and surfaces on the public record.
  const [ownerNotes, setOwnerNotes] = useState([]);
  useEffect(() => {
    if (!ownerMode) return;
    let alive = true;
    fetchExposureGraph().then((g) => { if (alive) setOwnerNotes(g.annotations || []); });
    return () => { alive = false; };
  }, [ownerMode]);

  // Social-presence enrichment — key on the subject's EMAIL (rich, unlike the spotty name-key teaser) and
  // merge into the "Online presence" module below. Self-gating (no match → nothing added).
  const [extraSocial, setExtraSocial] = useState([]);
  const subjEmail = ((d.emails || [])[0] || {}).address || '';
  const subjName = d.fullName || hero.name || '';
  const subjState = ((hero.location || '').match(/,\s*([A-Za-z]{2})\b/) || [])[1] || '';
  useEffect(() => {
    if (!socialEnrichOn() || (!subjEmail && !subjName)) return undefined;
    let alive = true;
    const parts = String(subjName).trim().split(/\s+/);
    fetchSocialPresence({ email: subjEmail || undefined, firstName: parts[0], lastName: parts.length > 1 ? parts[parts.length - 1] : '', state: subjState, verify: true })
      .then((r) => {
        if (!alive || !r || !r.matched) return;
        setExtraSocial((r.profiles || []).map((p) => ({ platform: socPlatform(p.network), username: p.username, url: p.url, confidence: p.confidence, enriched: true })));
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [subjEmail, subjName, subjState]);
  // Merged online-presence list: report-native social + enriched (deduped by url/platform).
  const socialItems = (() => {
    const seen = new Set(); const out = [];
    for (const s of [...(d.social || []), ...extraSocial]) {
      const k = String(s.url || `${s.platform}:${s.username || ''}`).toLowerCase();
      if (k && !seen.has(k)) { seen.add(k); out.push(s); }
    }
    return out;
  })();

  const view = ownerMode ? viewAs : viewerTier; // effective viewer: 'you' | 'anonymous' | 'free' | 'paid'
  const isOwner = ownerMode && viewAs === 'you'; // owner controls active only here

  const visible = (id) => {
    const x = disp[id];
    if (isOwner) return true;
    if (x === 'protect') return false;
    if (x === 'promote') return true;
    return view !== 'anonymous';
  };
  // Two fidelities: full detail for the owner + paid viewers (every report field, no data loss);
  // summary chips for free/anonymous teasing. This is what lets the profile design replace the report.
  const detailed = isOwner || view === 'paid';

  const pastAddrs = Math.max((d.addresses?.length || 0) - 1, 0);
  const finCount = (d.liens?.length || 0) + (d.judgments?.length || 0) + (d.foreclosures?.length || 0) + (d.bankruptcies?.length || 0);
  const recordsTotal = (d.criminalRecords?.length || 0) + (d.properties?.length || 0) + finCount;

  // Privileged/paid tier — the premium data paid searchers pay for. In the OTHERS view these gate behind
  // the paywall (locked tease for anonymous/free). Free-tier modules stay the tease layer.
  const PAID = new Set(['contact', 'court', 'property', 'financial']);
  const COUNT = {
    about: (d.aliases || []).length,
    contact: (d.phones || []).length + (d.emails || []).length,
    locations: (d.addresses || []).length,
    family: (d.relatives || []).length,
    work: (d.jobs || []).length,
    education: (d.education || []).length,
    online: socialItems.length,
    activity: 3,
    court: (d.criminalRecords || []).length,
    property: (d.properties || []).length,
    financial: finCount,
  };

  const MODULES = [
    { id: 'about', icon: '👤', title: 'About', source: 'observed', body: () => (
      <>
        <Row label="Also known as" value={(d.aliases || []).join(' · ')} />
        <Row label="Born" value={d.dob} /><Row label="Age" value={d.age} /><Row label="Gender" value={d.gender} />
      </>
    ), full: () => (
      <>
        <Row label="Full name" value={d.fullName} />
        <Row label="Also known as" value={(d.aliases || []).join(' · ')} />
        <Row label="Date of birth" value={d.dob} />
        <Row label="Age" value={d.age} />
        <Row label="Gender" value={d.gender} />
        <Row label="Citizenship" value={d.citizenship} />
      </>
    ) },
    // Death record (IDI/DMF) — ONLY included when the subject has a death record (deceased). Safe-by-default:
    // never shown on a living person's report. Prominent (right after About) since it's the payoff of the death
    // vertical. Obituary/burial come from the death teaser vendor; this confirms the passing (dates + residence).
    ...((d.deaths || []).length ? [{ id: 'death', icon: '⚰️', title: 'Death Record & Obituary', source: 'record', body: () => (
      <div>
        {(d.deaths || []).map((dr, i) => (
          <div key={`de${i}`} style={{ padding: '4px 0' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{dr.date ? `Died ${dr.date}` : 'Death record'}</div>
            <div style={{ fontSize: 12.5, color: '#6b7280' }}>{[dr.dob && `Born ${dr.dob}`, dr.age && `Age ${dr.age}`, [dr.city, dr.state].filter(Boolean).join(', '), dr.sourceName].filter(Boolean).join(' · ')}</div>
          </div>
        ))}
      </div>
    ), full: () => (
      <div>
        {(d.deaths || []).map((dr, i) => (
          <Item key={`de${i}`}><Title>⚰️ {dr.date ? `Died ${dr.date}` : 'Death record'}</Title><Meta><F label="Born" value={dr.dob} /><F label="Age at death" value={dr.age} /><F label="Last residence" value={[dr.city, dr.state].filter(Boolean).join(', ')} /><F label="SSN issued" value={dr.birthState} /><F label="Source" value={dr.sourceName} /></Meta></Item>
        ))}
      </div>
    ) }] : []),
    { id: 'contact', icon: '📇', title: 'Contact', source: 'observed', body: () => (
      <div style={wrap}>
        {(d.phones || []).map((p, i) => <Chip key={`ph${i}`}>📞 {p.number}{p.type ? ` · ${p.type}` : ''}</Chip>)}
        {(d.emails || []).map((e, i) => <Chip key={`em${i}`}>✉️ {e.address}</Chip>)}
        {!(d.phones || []).length && !(d.emails || []).length && none('No contact info on record.')}
      </div>
    ), full: () => (
      <div>
        {(d.phones || []).map((p, i) => (
          <Item key={`ph${i}`}><Title>📞 {p.number}</Title><Meta><F label="Type" value={p.type} /><F label="Carrier" value={p.carrier} /><F label="Seen" value={[p.firstSeen, p.lastSeen].filter(Boolean).join('–')} /></Meta></Item>
        ))}
        {(d.emails || []).map((e, i) => (
          <Item key={`em${i}`}><Title>✉️ {e.address}</Title><Meta><F label="Type" value={e.type} /></Meta></Item>
        ))}
        {!(d.phones || []).length && !(d.emails || []).length && none('No contact info on record.')}
      </div>
    ) },
    { id: 'locations', icon: '📍', title: 'Locations', source: 'observed', body: () => (
      <div style={wrap}>
        <div style={{ width: '100%' }}><AddressMap addresses={d.addresses} height={200} /></div>
        {(d.addresses || []).map((a, i) => <Chip key={`ad${i}`}>{i === 0 ? '🏠 ' : ''}{[a.city, a.state].filter(Boolean).join(', ')}{a.firstSeen ? ` · ${a.firstSeen}${a.lastSeen ? `–${a.lastSeen}` : ''}` : ''}</Chip>)}
        {!(d.addresses || []).length && none('No addresses on record.')}
      </div>
    ), full: () => (
      <div>
        <AddressMap addresses={d.addresses} height={240} />
        {(d.addresses || []).map((a, i) => (
          <Item key={`ad${i}`}><Title>{i === 0 ? '🏠 ' : '📍 '}{[a.street, a.city, a.state, a.zip].filter(Boolean).join(', ')}</Title><Meta><F label="County" value={a.county} /><F label="Dates" value={[a.firstSeen, a.lastSeen].filter(Boolean).join('–')} /></Meta></Item>
        ))}
        {!(d.addresses || []).length && none('No addresses on record.')}
      </div>
    ) },
    { id: 'family', icon: '👪', title: 'Family & Relatives', source: 'observed', body: () => (
      <div style={wrap}>
        {(d.relatives || []).map((r, i) => <Chip key={`rl${i}`}>{r.name}{r.relationship ? ` · ${r.relationship}` : ''}</Chip>)}
        {!(d.relatives || []).length && none('No relatives on record.')}
      </div>
    ), full: () => (
      <div>
        {(d.relatives || []).map((r, i) => (
          <Item key={`rl${i}`}><Title>{r.name}</Title><Meta><F label="Relation" value={r.relationship} /><F label="Age" value={r.age} /><F label="Location" value={r.location} /></Meta></Item>
        ))}
        {!(d.relatives || []).length && none('No relatives on record.')}
      </div>
    ) },
    { id: 'work', icon: '💼', title: 'Work', source: 'observed', body: () => (
      <>
        {(d.jobs || []).map((j, i) => (
          <div key={`jb${i}`} style={{ padding: '4px 0' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{j.title || 'Role'}{j.employer ? ` · ${j.employer}` : ''}</div>
            <div style={{ fontSize: 12.5, color: '#6b7280' }}>{[[j.city, j.state].filter(Boolean).join(', '), [j.start, j.end || 'Present'].filter(Boolean).join('–')].filter(Boolean).join(' · ')}</div>
          </div>
        ))}
        {!(d.jobs || []).length && none('No employment on record.')}
      </>
    ) },
    { id: 'education', icon: '🎓', title: 'Education', source: 'observed', body: () => (
      <>
        {(d.education || []).map((e, i) => (
          <div key={`ed${i}`} style={{ padding: '4px 0' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{e.school}</div>
            <div style={{ fontSize: 12.5, color: '#6b7280' }}>{[e.degree, e.year].filter(Boolean).join(' · ')}</div>
          </div>
        ))}
        {!(d.education || []).length && none('No education on record.')}
      </>
    ) },
    { id: 'online', icon: '🌐', title: 'Online presence', source: 'user', body: () => (
      <div style={wrap}>
        {socialItems.map((s, i) => <Chip key={`so${i}`}>{s.platform}{s.username ? ` · @${s.username}` : ''}</Chip>)}
        {!socialItems.length && none('No linked profiles yet — promote to add them.')}
      </div>
    ), full: () => (
      <div>
        {socialItems.map((s, i) => (
          <Item key={`so${i}`}>
            <Title>{s.platform}{s.username ? ` · @${s.username}` : ''}
              {s.enriched && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: s.confidence === 'confirmed' ? '#0d5d2f' : '#92400e', background: s.confidence === 'confirmed' ? '#f0fdf4' : '#fffbeb', border: `1px solid ${s.confidence === 'confirmed' ? '#bbf7d0' : '#fde68a'}`, borderRadius: 999, padding: '1px 6px' }}>{s.confidence === 'confirmed' ? '✓ verified' : 'found online'}</span>}
            </Title>
            {s.url && <div style={{ marginTop: 2 }}><a href={s.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12.5, color: '#1d4ed8' }}>{s.url}</a></div>}
          </Item>
        ))}
        {!socialItems.length && none('No linked profiles yet — promote to add them.')}
      </div>
    ) },
    { id: 'activity', icon: '📰', title: 'Activity', source: 'user', body: () => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[
          { icon: '🛡️', text: 'Verified identity with a government ID', when: 'Today' },
          { icon: '🔒', text: 'Hid contact info from public search', when: 'This week' },
          { icon: '👀', text: '3 people searched for you', when: 'Last 30 days' },
        ].map((a, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 13.5 }}>
            <span aria-hidden="true">{a.icon}</span>
            <span style={{ flex: 1, color: '#111827' }}>{a.text}</span>
            <span style={{ color: '#9ca3af', fontSize: 12 }}>{a.when}</span>
          </div>
        ))}
      </div>
    ) },
    { id: 'court', icon: '⚖️', title: 'Court & Criminal', source: 'record', protectOnly: true, body: () => (
      <div style={wrap}>
        {(d.criminalRecords || []).map((c, i) => <Chip key={`cr${i}`}>⚖️ {c._firstParty ? (c._recordType === 'court' ? 'Court record' : (c.charge || 'Incarceration')) : (c.charge || 'Court record')}{c.disposition ? ` · ${c.disposition}` : ''}</Chip>)}
        {!(d.criminalRecords || []).length && none('No court or criminal records found.')}
      </div>
    ), full: () => (
      <div>
        {(d.criminalRecords || []).map((c, i) => c._firstParty ? (
          <div key={`cr${i}`} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
            <div style={{ flexShrink: 0, width: 60, height: 74, borderRadius: 6, overflow: 'hidden', background: '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, color: '#94a3b8', position: 'relative' }}>
              👤{c.photo && <img src={c.photo} alt="" onError={(e) => { e.currentTarget.style.display = 'none'; }} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, color: '#111827', fontSize: 14 }}>{c._recordType === 'court' ? 'Court record' : (c.charge || 'Incarceration record')}</span>
                <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 999, padding: '2px 8px', ...(c._recordType === 'court' ? { color: '#b45309', background: '#fef3c7' } : { color: '#166534', background: '#dcfce7' }) }}>{c._recordType === 'court' ? 'Court' : 'Incarceration'}</span>
                <span title={c._strength === 'strong' ? 'Age and gender both match' : 'Age matches; gender not confirmed'} style={{ fontSize: 11, fontWeight: 700, borderRadius: 999, padding: '2px 8px', ...(c._strength === 'strong' ? { color: '#166534', background: '#dcfce7' } : { color: '#64748b', background: '#f1f5f9' }) }}>{c._strength === 'strong' ? 'Strong match' : 'Possible match'}</span>
              </div>
              <div style={{ fontSize: 12.5, color: '#6b7280', marginTop: 3 }}>{[c.disposition, c.source].filter(Boolean).join(' · ')}</div>
            </div>
          </div>
        ) : (
          <Item key={`cr${i}`}><Title>⚖️ {c.charge || 'Court record'}</Title><Meta><F label="Case" value={c.caseNumber} /><F label="Court" value={c.court} /><F label="Disposition" value={c.disposition} /><F label="Filed" value={c.chargesFiledDate} /></Meta></Item>
        ))}
        {!(d.criminalRecords || []).length && none('No court or criminal records found.')}
      </div>
    ) },
    { id: 'property', icon: '🏘️', title: 'Property', source: 'record', protectOnly: true, body: () => (
      <>
        {(d.properties || []).map((p, i) => (
          <div key={`pr${i}`} style={{ padding: '4px 0' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{p.address || [p.city, p.state].filter(Boolean).join(', ') || 'Property'}</div>
            <div style={{ fontSize: 12.5, color: '#6b7280' }}>{[p.assessedValue && `Assessed ${p.assessedValue}`, lastSaleText(p.lastSale)].filter(Boolean).join(' · ')}</div>
          </div>
        ))}
        {!(d.properties || []).length && none('No property records found.')}
      </>
    ), full: () => (
      <div>
        {(d.properties || []).map((p, i) => (
          <Item key={`pr${i}`}><Title>🏘️ {p.address || [p.city, p.state].filter(Boolean).join(', ') || 'Property'}</Title><Meta><F label="APN" value={p.apn} /><F label="Assessed" value={p.assessedValue} /><F label="Owner" value={p.owner} /><F label="Last sale" value={lastSaleText(p.lastSale)} /></Meta></Item>
        ))}
        {!(d.properties || []).length && none('No property records found.')}
      </div>
    ) },
    { id: 'financial', icon: '💵', title: 'Financial records', source: 'record', protectOnly: true, body: () => (
      <div style={wrap}>
        {(d.judgments || []).map((j, i) => <Chip key={`ju${i}`}>💵 {j.type || 'Judgment'}{j.amount ? ` · ${j.amount}` : ''}{j.status ? ` · ${j.status}` : ''}</Chip>)}
        {(d.liens || []).map((l, i) => <Chip key={`li${i}`}>📌 Lien{l.amount ? ` · ${l.amount}` : ''}</Chip>)}
        {(d.bankruptcies || []).map((b, i) => <Chip key={`bk${i}`}>🏦 Bankruptcy</Chip>)}
        {finCount === 0 && none('No financial records found.')}
      </div>
    ), full: () => (
      <div>
        {(d.judgments || []).map((j, i) => (
          <Item key={`ju${i}`}><Title>💵 {j.type || 'Judgment'}</Title><Meta><F label="Amount" value={j.amount} /><F label="Court" value={j.court} /><F label="Status" value={j.status} /><F label="Filed" value={j.filedDate} /></Meta></Item>
        ))}
        {(d.liens || []).map((l, i) => (
          <Item key={`li${i}`}><Title>📌 Lien</Title><Meta><F label="Amount" value={l.amount} /><F label="Status" value={l.status} /></Meta></Item>
        ))}
        {(d.bankruptcies || []).map((b, i) => (
          <Item key={`bk${i}`}><Title>🏦 Bankruptcy</Title><Meta><F label="Chapter" value={b.chapter} /><F label="Filed" value={b.filedDate} /></Meta></Item>
        ))}
        {finCount === 0 && none('No financial records found.')}
      </div>
    ) },
  ];

  const shown = MODULES.filter((m) => visible(m.id));

  // Right-rail assessment + actions (owner only).
  const withData = MODULES.filter((m) => ['about', 'contact', 'locations', 'family', 'work', 'education', 'online', 'court', 'property', 'financial'].includes(m.id));
  const counts = { protected: 0, promoted: 0, exposed: 0 };
  withData.forEach((m) => { const x = disp[m.id]; if (x === 'protect') counts.protected++; else if (x === 'promote') counts.promoted++; else counts.exposed++; });

  const actions = [];
  if (!hero.verified) actions.push({ icon: '🛡️', text: 'Verify your identity', sub: "Prove it's you to unlock full control." });
  if (disp.contact !== 'protect') actions.push({ icon: '🔒', text: 'Protect your contact info', sub: 'Hide phone & email from people searching you.' });
  if (disp.family !== 'protect') actions.push({ icon: '🔒', text: 'Protect your relatives', sub: 'A common way people track you down.' });
  if (disp.locations !== 'protect' && pastAddrs > 0) actions.push({ icon: '📍', text: 'Protect your address history', sub: `${pastAddrs} past address${pastAddrs === 1 ? '' : 'es'} on record.` });
  if (recordsTotal > 0) actions.push({ icon: '🧹', text: 'Remove records from data brokers', sub: `${recordsTotal} public record${recordsTotal === 1 ? '' : 's'} exist elsewhere.` });
  if (!socialItems.length) actions.push({ icon: '📣', text: 'Add your links', sub: 'Promote the profile you want people to see.' });

  const legend = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: '#6b7280' }}>
      {Object.entries(SOURCE).map(([k, s]) => (
        <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color, flexShrink: 0 }} />
          <span><strong style={{ color: '#374151' }}>{s.label}</strong> — {k === 'record' ? 'court, property, financial' : k === 'observed' ? 'found in public data' : 'you created or linked'}</span>
        </div>
      ))}
    </div>
  );

  const railCard = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, boxShadow: '0 2px 10px rgba(17,24,39,0.06)', padding: '16px 18px' };

  return (
    <div>
      {/* Preview as (View As) — owner-mode only (their preview tool). */}
      {ownerMode && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
          <span style={{ fontSize: 12.5, fontWeight: 800, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Preview as</span>
          {VIEWS.map((v) => {
            const active = viewAs === v.key;
            return (
              <button key={v.key} type="button" onClick={() => setViewAs(v.key)}
                style={{ fontSize: 12.5, fontWeight: 700, border: `1px solid ${active ? GREEN : '#e5e7eb'}`, background: active ? '#f0fdf4' : '#fff', color: active ? GREEN : '#6b7280', borderRadius: 999, padding: '5px 12px', cursor: 'pointer' }}>
                {v.label}
              </button>
            );
          })}
        </div>
      )}

      {ownerMode && !isOwner && (
        <div style={{ marginBottom: 14, background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#1e40af' }}>
          👁 Previewing your profile as a <strong>{VIEWS.find((v) => v.key === viewAs)?.short}</strong>. Protected sections are hidden — this is exactly what they see.
        </div>
      )}

      {/* Cover vCard hero. */}
      <div style={{ border: '1px solid #d7ddd9', borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 12px rgba(17,24,39,0.08)', background: '#fff', marginBottom: 18 }}>
        <div style={{ position: 'relative', height: 150, background: 'linear-gradient(120deg, #0d5d2f 0%, #14532d 55%, #166534 100%)' }}>
          {isOwner && <button type="button" style={{ position: 'absolute', top: 12, right: 12, fontSize: 12, fontWeight: 700, color: '#fff', background: 'rgba(0,0,0,0.28)', border: '1px solid rgba(255,255,255,0.4)', borderRadius: 8, padding: '6px 12px', cursor: 'pointer' }}>📷 Edit cover</button>}
        </div>
        <div style={{ padding: '0 22px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ marginTop: -44, width: 96, height: 96, borderRadius: '50%', background: GREEN, border: '4px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 36, fontWeight: 800, flexShrink: 0, position: 'relative' }}>
              {(hero.name || '?').trim()[0]?.toUpperCase() || '?'}
              {isOwner && <span style={{ position: 'absolute', bottom: 2, right: 2, width: 26, height: 26, borderRadius: '50%', background: '#fff', border: '1px solid #d7ddd9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, cursor: 'pointer' }}>📷</span>}
            </div>
            <div style={{ flex: 1, minWidth: 220, paddingTop: 12 }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#111827' }}>{hero.name}{hero.age ? `, ${hero.age}` : ''}</div>
              {hero.location && <div style={{ fontSize: 14, color: '#6b7280', marginTop: 2 }}>📍 {hero.location}</div>}
              <div style={{ marginTop: 8, display: 'inline-flex', gap: 8, flexWrap: 'wrap' }}>
                {hero.verified && <span style={{ fontSize: 12, fontWeight: 700, color: GREEN, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 999, padding: '3px 10px' }}>🛡️ ID verified</span>}
                {isOwner && hero.score != null && <span style={{ fontSize: 12, fontWeight: 700, color: '#111827', background: '#f8faf9', border: '1px solid #e5e7eb', borderRadius: 999, padding: '3px 10px' }}>Protection {hero.score}/100</span>}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2-column: LEFT = modules, RIGHT = assessment + actions (owner only). */}
      {/* Stack to a single column on mobile — the fixed-min rail was crushing the modules column. */}
      <style>{`@media (max-width: 860px){ [data-profile-grid]{ grid-template-columns: 1fr !important; } [data-profile-rail]{ position: static !important; } }`}</style>
      <div data-profile-grid style={{ display: 'grid', gridTemplateColumns: isOwner ? 'minmax(0, 1fr) minmax(280px, 340px)' : '1fr', gap: 18, alignItems: 'start' }}>
        <div style={{ display: 'grid', gap: 14, minWidth: 0 }}>
          {shown.map((m) => {
            const paid = PAID.has(m.id);
            // Paid-tier data is locked (teased) for non-paid viewers — unless the owner PROMOTED it public.
            const locked = !isOwner && paid && disp[m.id] !== 'promote' && view !== 'paid';
            // Report/others view = concise summary by default; a per-area "View detail" expands THIS area
            // to its full rich detail inline. Owner/My-Profile keeps its existing `detailed` behavior.
            const canExpand = !ownerMode && !locked && !!m.full && COUNT[m.id] > 0;
            const areaExpanded = !!expandedAreas[m.id];
            const showFull = ownerMode ? (detailed && m.full) : (areaExpanded && m.full);
            return (
              <Module key={m.id} id={m.id} icon={m.icon} title={m.title} source={m.source}
                tier={paid ? 'paid' : 'free'} count={COUNT[m.id]} disposition={disp[m.id]}
                setDisposition={set} protectOnly={m.protectOnly} isOwner={isOwner} locked={locked} blurLocked={ownerMode}
                canExpand={canExpand} expanded={areaExpanded}
                onToggleExpand={() => setExpandedAreas((prev) => ({ ...prev, [m.id]: !prev[m.id] }))}>
                {showFull ? m.full() : m.body()}
                {isOwner && (
                  <InlineOwnerNote recordKey={`area:${m.id}`} label={m.title}
                    notes={ownerNotes.filter((a) => a.record_key === `area:${m.id}`)}
                    onChanged={setOwnerNotes} indent={0} />
                )}
              </Module>
            );
          })}
          {!isOwner && shown.length === 0 && (
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '24px', textAlign: 'center', color: '#6b7280', fontSize: 14 }}>
              You have protected everything — this viewer sees nothing but your name.
            </div>
          )}
        </div>

        {isOwner && (
          <aside data-profile-rail style={{ display: 'grid', gap: 14, position: 'sticky', top: 16 }}>
            <div style={railCard}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#111827', marginBottom: 10 }}>Profile assessment</div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                {[
                  { n: counts.protected, l: 'Protected', c: '#b91c1c', bg: '#fef2f2' },
                  { n: counts.exposed, l: 'Exposed', c: '#b45309', bg: '#fffbeb' },
                  { n: counts.promoted, l: 'Featured', c: GREEN, bg: '#f0fdf4' },
                ].map((x) => (
                  <div key={x.l} style={{ flex: 1, textAlign: 'center', background: x.bg, borderRadius: 8, padding: '8px 4px' }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: x.c }}>{x.n}</div>
                    <div style={{ fontSize: 10.5, fontWeight: 700, color: x.c, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{x.l}</div>
                  </div>
                ))}
              </div>
              {hero.score != null && (
                <div style={{ fontSize: 12.5, color: '#6b7280', lineHeight: 1.5 }}>
                  Your Protection Score is <strong style={{ color: '#111827' }}>{hero.score}/100</strong>. Protecting more sections raises it.
                </div>
              )}
            </div>

            {actions.length > 0 && (
              <div style={railCard}>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#111827', marginBottom: 10 }}>Recommended actions</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {actions.map((a, i) => (
                    <button key={i} type="button" style={{ display: 'flex', gap: 10, textAlign: 'left', background: '#f8faf9', border: '1px solid #e5e7eb', borderRadius: 10, padding: '10px 12px', cursor: 'pointer', width: '100%' }}>
                      <span aria-hidden="true" style={{ fontSize: 16 }}>{a.icon}</span>
                      <span style={{ minWidth: 0 }}>
                        <span style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#111827' }}>{a.text}</span>
                        <span style={{ display: 'block', fontSize: 12, color: '#6b7280', marginTop: 1 }}>{a.sub}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div style={railCard}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#111827', marginBottom: 10 }}>Where this comes from</div>
              {legend}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
