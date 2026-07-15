import React, { useState } from 'react';

/**
 * MyProfileModular — the My Profile experience as a social-profile surface (FB/LinkedIn model):
 *   • a cover-image vCard hero (customizable cover + avatar)
 *   • a collection of modules (About, Contact, Locations, Family, Work, Education, Online, Activity, Records)
 *   • EACH module carries a Protect / Promote control (Present vs Expose per component)
 *   • per-module INSIGHT tips that comment on that part of the profile
 *   • a "Preview as" (View As) switcher — see exactly what an anonymous / free / paid viewer sees
 * See docs/design/profile-concept-model.md. First pass: dispositions + view are local state (not yet persisted).
 */

const GREEN = '#0d5d2f';

const VIEWS = [
  { key: 'you', label: '👤 You (owner)', short: 'owner' },
  { key: 'anonymous', label: '🕶️ Anonymous', short: 'anonymous visitor' },
  { key: 'free', label: '🙂 Free member', short: 'free member' },
  { key: 'paid', label: '💳 Paid member', short: 'paid member' },
];

// disposition: 'protect' (hidden from others) | 'promote' (featured/public) | 'neutral' (default)
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

function Module({ id, icon, title, disposition, setDisposition, protectOnly, insight, isOwner = true, children }) {
  const promoted = disposition === 'promote';
  const protectedOn = disposition === 'protect';
  return (
    <section style={{
      background: '#fff', border: `1px solid ${promoted ? '#bbf7d0' : '#e5e7eb'}`, borderRadius: 12,
      boxShadow: '0 2px 10px rgba(17,24,39,0.06)', overflow: 'hidden',
    }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', padding: '12px 16px', borderBottom: '1px solid #f0f2f1' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14.5, fontWeight: 800, color: '#111827' }}>
          <span aria-hidden="true">{icon}</span>{title}
          {isOwner && protectedOn && <span style={{ fontSize: 11, fontWeight: 700, color: '#b91c1c', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 999, padding: '1px 8px' }}>Hidden</span>}
          {promoted && <span style={{ fontSize: 11, fontWeight: 700, color: GREEN, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 999, padding: '1px 8px' }}>Featured</span>}
        </div>
        {isOwner && <DispositionToggle value={disposition} onChange={(v) => setDisposition(id, v)} protectOnly={protectOnly} />}
      </header>
      <div style={{ padding: '14px 16px' }}>{children}</div>
      {isOwner && insight && (
        <div style={{ display: 'flex', gap: 8, padding: '10px 16px', background: '#fffdf5', borderTop: '1px solid #f3e8c8', fontSize: 12.5, color: '#7a5b12', lineHeight: 1.5 }}>
          <span aria-hidden="true">💡</span><span>{insight}</span>
        </div>
      )}
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

export default function MyProfileModular({ data, hero = {} }) {
  const [disp, setDisp] = useState({
    contact: 'protect', locations: 'protect', family: 'protect', records: 'protect',
    about: 'neutral', work: 'neutral', education: 'neutral', online: 'promote', activity: 'neutral',
  });
  const [viewAs, setViewAs] = useState('you');
  const set = (id, v) => setDisp((s) => ({ ...s, [id]: v }));
  const d = data || {};
  const isOwner = viewAs === 'you';

  // Viewer projection: protect = only you; promote = everyone; neutral = members (not anonymous).
  const visible = (id) => {
    const x = disp[id];
    if (isOwner) return true;
    if (x === 'protect') return false;
    if (x === 'promote') return true;
    return viewAs !== 'anonymous';
  };

  const pastAddrs = Math.max((d.addresses?.length || 0) - 1, 0);
  const recordsCount = (d.criminalRecords?.length || 0) + (d.properties?.length || 0) + (d.liens?.length || 0) + (d.judgments?.length || 0);

  const insights = {
    contact: disp.contact !== 'protect'
      ? 'Your phone and email are visible to anyone who looks you up — Protect to stop unwanted contact.'
      : 'Protected — hidden from people searching for you.',
    locations: pastAddrs > 0
      ? `${pastAddrs} past address${pastAddrs === 1 ? '' : 'es'} on record. Protecting your location history makes you harder to track.`
      : null,
    family: disp.family !== 'protect'
      ? 'Relatives are a common way people find you — Protect to add a layer of privacy.'
      : null,
    work: 'Promote your work for professional discovery, or Protect it to shrink your footprint.',
    records: recordsCount > 0
      ? 'These are public records. Protecting hides them on IDLookup; we can also help remove them from data brokers.'
      : null,
  };

  const MODULES = [
    { id: 'about', icon: '👤', title: 'About', body: () => (
      <>
        <Row label="Also known as" value={(d.aliases || []).join(' · ')} />
        <Row label="Born" value={d.dob} />
        <Row label="Age" value={d.age} />
        <Row label="Gender" value={d.gender} />
      </>
    ) },
    { id: 'contact', icon: '📇', title: 'Contact', body: () => (
      <div style={wrap}>
        {(d.phones || []).map((p, i) => <Chip key={`ph${i}`}>📞 {p.number}{p.type ? ` · ${p.type}` : ''}</Chip>)}
        {(d.emails || []).map((e, i) => <Chip key={`em${i}`}>✉️ {e.address}</Chip>)}
        {!(d.phones || []).length && !(d.emails || []).length && <span style={{ color: '#9ca3af', fontSize: 13 }}>No contact info on record.</span>}
      </div>
    ) },
    { id: 'locations', icon: '📍', title: 'Locations', body: () => (
      <div style={wrap}>
        {(d.addresses || []).map((a, i) => <Chip key={`ad${i}`}>{i === 0 ? '🏠 ' : ''}{[a.city, a.state].filter(Boolean).join(', ')}{a.firstSeen ? ` · ${a.firstSeen}${a.lastSeen ? `–${a.lastSeen}` : ''}` : ''}</Chip>)}
        {!(d.addresses || []).length && <span style={{ color: '#9ca3af', fontSize: 13 }}>No addresses on record.</span>}
      </div>
    ) },
    { id: 'family', icon: '👪', title: 'Family & Relatives', body: () => (
      <div style={wrap}>
        {(d.relatives || []).map((r, i) => <Chip key={`rl${i}`}>{r.name}{r.relationship ? ` · ${r.relationship}` : ''}</Chip>)}
        {!(d.relatives || []).length && <span style={{ color: '#9ca3af', fontSize: 13 }}>No relatives on record.</span>}
      </div>
    ) },
    { id: 'work', icon: '💼', title: 'Work', body: () => (
      <>
        {(d.jobs || []).map((j, i) => (
          <div key={`jb${i}`} style={{ padding: '4px 0' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{j.title || 'Role'}{j.employer ? ` · ${j.employer}` : ''}</div>
            <div style={{ fontSize: 12.5, color: '#6b7280' }}>{[[j.city, j.state].filter(Boolean).join(', '), [j.start, j.end || 'Present'].filter(Boolean).join('–')].filter(Boolean).join(' · ')}</div>
          </div>
        ))}
        {!(d.jobs || []).length && <span style={{ color: '#9ca3af', fontSize: 13 }}>No employment on record.</span>}
      </>
    ) },
    { id: 'education', icon: '🎓', title: 'Education', body: () => (
      <>
        {(d.education || []).map((e, i) => (
          <div key={`ed${i}`} style={{ padding: '4px 0' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{e.school}</div>
            <div style={{ fontSize: 12.5, color: '#6b7280' }}>{[e.degree, e.year].filter(Boolean).join(' · ')}</div>
          </div>
        ))}
        {!(d.education || []).length && <span style={{ color: '#9ca3af', fontSize: 13 }}>No education on record.</span>}
      </>
    ) },
    { id: 'online', icon: '🌐', title: 'Online presence', body: () => (
      <div style={wrap}>
        {(d.social || []).map((s, i) => <Chip key={`so${i}`}>{s.platform}{s.username ? ` · @${s.username}` : ''}</Chip>)}
        {!(d.social || []).length && <span style={{ color: '#9ca3af', fontSize: 13 }}>No linked profiles yet — promote to add them.</span>}
      </div>
    ) },
    { id: 'activity', icon: '📰', title: 'Activity', body: () => (
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
    { id: 'records', icon: '⚖️', title: 'Public records', protectOnly: true, body: () => (
      <>
        <p style={{ margin: '0 0 8px', fontSize: 12.5, color: '#6b7280' }}>Court, property, and financial records tied to you. These can only be protected — never promoted.</p>
        <div style={wrap}>
          {(d.criminalRecords || []).map((c, i) => <Chip key={`cr${i}`}>⚖️ {c.charge || 'Court record'}</Chip>)}
          {(d.properties || []).map((p, i) => <Chip key={`pr${i}`}>🏘️ {[p.city, p.state].filter(Boolean).join(', ') || 'Property'}</Chip>)}
          {(d.judgments || []).map((j, i) => <Chip key={`ju${i}`}>💵 {j.type || 'Judgment'}</Chip>)}
          {recordsCount === 0 && <span style={{ color: '#9ca3af', fontSize: 13 }}>No public records found.</span>}
        </div>
      </>
    ) },
  ];

  const shown = MODULES.filter((m) => visible(m.id));

  return (
    <div>
      {/* Preview as (View As) — see exactly what each audience sees. */}
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

      {!isOwner && (
        <div style={{ marginBottom: 14, background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#1e40af' }}>
          👁 Previewing your profile as a <strong>{VIEWS.find((v) => v.key === viewAs)?.short}</strong>. Protected sections are hidden — this is exactly what they see.
        </div>
      )}

      {/* ── Cover vCard hero ─────────────────────────────────────────────── */}
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
          {isOwner && (
            <p style={{ margin: '14px 0 0', fontSize: 12.5, color: '#6b7280', lineHeight: 1.5 }}>
              Each section below is yours to control. <strong style={{ color: '#b91c1c' }}>🔒 Protect</strong> hides it from people who look you up;
              <strong style={{ color: GREEN }}> 📣 Promote</strong> features it on the profile you share.
            </p>
          )}
        </div>
      </div>

      {/* ── Modules ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gap: 14 }}>
        {shown.map((m) => (
          <Module key={m.id} id={m.id} icon={m.icon} title={m.title} disposition={disp[m.id]}
            setDisposition={set} protectOnly={m.protectOnly} insight={insights[m.id]} isOwner={isOwner}>
            {m.body()}
          </Module>
        ))}
        {!isOwner && shown.length === 0 && (
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '24px', textAlign: 'center', color: '#6b7280', fontSize: 14 }}>
            You have protected everything — this viewer sees nothing but your name.
          </div>
        )}
      </div>
    </div>
  );
}
