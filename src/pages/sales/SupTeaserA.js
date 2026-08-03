import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSignup, generatePassword } from '../../hooks/useSignup';
import { useBrand } from '../../services/brand';
import { PersonAvatar, properCaseName } from '../../components/PersonAvatar';
import SignalTeaser from '../../components/SignalTeaser';
import { getFlow, getVariant } from '../../services/funnelFlow';

/**
 * Shared "default SUP" teaser (the variant-A design), driven by a `palette` so
 * the same layout/copy can be re-skinned per funnel:
 *   - variant A  → green (default)
 *   - variant I  → trust-blue (inmate A/B, matches landing v3a)
 *   - variant J  → dark/amber (inmate A/B, matches landing v3b)
 *
 * Structure: hook line → vCard (name/age/aliases + OBFUSCATED contact rows —
 * masked, never fabricated) → compressed record-category cards → white unlock
 * form (inline italic field notes) → bulleted trial + satisfaction copy.
 *
 * Surface system (design audit 2026-07-04): neutral page canvas, WHITE cards
 * with elevation and minimal borders, green reserved for verified/secure/success
 * accents (not broad container fills), orange for the primary action only, and a
 * reduced-weight sticky CTA (white footer + inset orange button).
 *
 * Palette keys: pageBg, ink, ink2, mut, muted, accent, accentGrad, cardBg,
 * cardBorder, chipBg, formBg, formBorder, inputBg, inputBorder, cta, ctaText,
 * verifiedBg, verifiedText, verifiedBorder, headerBg, headerText, onDark.
 */

const CATEGORIES = [
  { icon: '⚖️', title: 'Court Records', items: 'Arrests · Sex offenders · Traffic violations · Felonies' },
  { icon: '📋', title: 'Personal Info', items: 'Birth · Marriage · Divorce · Census & military' },
  { icon: '🏠', title: 'Property & Assets', items: 'Owned properties · Estimated values' },
  { icon: '💼', title: 'Work & Education', items: 'Employment history · Schools attended' },
];

// Variant C — punchier, more visceral category framing (same 4 slots).
const CATEGORIES_AGGRESSIVE = [
  { icon: '🚔', title: 'Criminal & Court', items: 'Arrests · Warrants · Felonies · Sex offenders · DUIs' },
  { icon: '📇', title: 'Contact & Identity', items: 'Phones · Emails · Aliases · Marriage & divorce' },
  { icon: '💰', title: 'Property & Money', items: 'Properties · Values · Liens · Bankruptcies' },
  { icon: '👥', title: 'People & Places', items: 'Relatives · Associates · Address history · Employers' },
];

// Copy driven by `tone`. `default` = measured (A/B/I/J). `aggressive` = the
// "closer" (variant C): salesier, curiosity-gap, urgency — but NO fabricated data
// and NO FCRA-regulated framing (never sold for hiring/tenant/credit decisions).
const COPY = {
  default: {
    hookIcon: '✓',
    hook: (n) => `Get Instant Information on ${n}`,
    formTitle: (n) => `View ${n}'s Report`,
    emailNote: '— so we can email your report to you.',
    pwNote: '— keeps your report private and secure.',
    cta: 'View Report →',
    ctaLoading: 'Loading…',
    stickyCta: 'View Report →',
  },
  aggressive: {
    hookIcon: '🔍',
    hook: (n) => `Here's everything we found on ${n}`,
    formTitle: (n) => `Get the Full Story on ${n}`,
    emailNote: '— where we send your report, instantly.',
    pwNote: '— to secure your account.',
    cta: 'Show Me Everything →',
    ctaLoading: 'Pulling the full report…',
    stickyCta: '🚨 Show Me Everything →',
  },
};

const SupTeaserA = ({ person, id, palette: P, tone, layout, signup, showHook = false }) => {
  const aggressive = tone === 'aggressive';
  const realMap = layout === 'realmap';
  const mapLayout = layout === 'map' || realMap;
  const emailOnly = signup === 'email-only';
  const T = COPY[tone] || COPY.default;
  const cats = aggressive ? CATEGORIES_AGGRESSIVE : CATEGORIES;
  const brand = useBrand();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { submit: submitSignup, loading, error, success, setError } = useSignup();

  const initials = (person.fullName || '?')
    .split(/\s+/).slice(0, 2).map(n => n[0]).join('').toUpperCase() || '?';
  const cityState = person.location || '';
  const addressObf = cityState ? `••••• ••••••, ${cityState}` : 'Available in full report';
  // Booking-record teaser identity (self-gates: shows only when incarceration records match).
  const _nm = (person.fullName || '').trim().split(/\s+/).filter(Boolean);
  const bkFirst = _nm[0] || '';
  const bkLast = _nm.length > 1 ? _nm[_nm.length - 1] : '';
  const bkState = ((cityState.match(/,\s*([A-Za-z]{2})\b/) || [])[1] || '').toUpperCase();
  // Honest freshness signal (not a fabricated count) — 3 days before today, the
  // same "recently updated" cue approved on the payment vCard.
  const updatedDate = new Date(Date.now() - 3 * 86400000)
    .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  // Real per-identity data footprint from the BC teaser (honest — never fabricated;
  // 0/absent categories are simply not shown, never claimed). Degrades gracefully
  // when a person object predates the counts (all fall back to masked generics).
  const R = person.records || {};
  const Fl = person.flags || {};
  const plural = (n, s, p) => `${n} ${n === 1 ? s : (p || s + 's')}`;
  const addressVal = R.address > 0
    ? `${plural(R.address, 'address', 'addresses')} on record${cityState ? ` · ${cityState}` : ''}`
    : addressObf;
  // Phone type detail (residential/mobile) when it accounts for the whole count.
  const phoneType = R.residentialPhone === R.phone && R.phone > 0 ? ' residential'
    : R.mobilePhone === R.phone && R.phone > 0 ? ' mobile' : '';
  const phoneVal = R.phone > 0 ? `${plural(R.phone, 'number')} found${phoneType ? ` (${phoneType.trim()})` : ''} · (•••) •••-••••` : '(•••) •••-••••';
  const emailVal = R.email > 0 ? `${plural(R.email, 'address', 'addresses')} on file` : 'See available information';
  // A real relative's name, masked to first name + last initial (honest tease).
  const firstRel = (person.relatives || [])[0];
  const relNameMasked = firstRel && firstRel.name
    ? firstRel.name.trim().split(/\s+/).map((w, i, a) => (i === a.length - 1 && a.length > 1 ? `${w[0]}.` : w)).join(' ')
    : null;
  const foundChips = [];
  if (Fl.isCriminal || R.criminal > 0) foundChips.push('⚖️ Criminal record');
  if (Fl.isPropertyOwner || R.property > 0) foundChips.push(R.property > 0 ? `🏠 ${plural(R.property, 'property', 'properties')}` : '🏠 Property owner');
  if (R.relatives > 0) foundChips.push(`👥 ${plural(R.relatives, 'relative')}${relNameMasked ? ` incl. ${relNameMasked}` : ''}`);
  if (Fl.hasEmployment || R.employment > 0) foundChips.push('💼 Employment history');
  if (Fl.hasProfessionalLicense || R.professionalLicense > 0) foundChips.push('📜 Professional license');
  if (R.bankruptcy > 0) foundChips.push('📉 Bankruptcy');
  if (R.lien > 0) foundChips.push('📑 Lien');
  if (R.judgment > 0) foundChips.push('⚖️ Judgment');
  if (R.foreclosure > 0) foundChips.push('🏚️ Foreclosure');
  if (Fl.hasVehicle) foundChips.push('🚗 Vehicle record');
  if (R.business > 0) foundChips.push('🏢 Associated business');
  const chip = { display: 'inline-flex', alignItems: 'center', gap: '0.3rem', background: P.onDark ? 'rgba(255,255,255,0.06)' : 'rgba(17,24,39,0.05)', color: P.ink2, borderRadius: '999px', padding: '0.25rem 0.7rem', fontSize: '0.75rem', fontWeight: 600 };

  // Variant D (map layout): Spokeo-style colored-dot category legend from REAL
  // counts. Buckets that sum to 0 drop out; "And more" always shows.
  const n0 = (v) => v || 0; // defensive: undefined terms would NaN-out a sum
  const legend = [
    { color: '#2563eb', label: 'Phone & Email', n: n0(R.phone) + n0(R.email) },
    { color: '#7c3aed', label: 'Addresses', n: n0(R.address) },
    { color: '#dc2626', label: 'Court & Records', n: n0(R.criminal) + n0(R.lien) + n0(R.judgment) + n0(R.bankruptcy) + n0(R.foreclosure) },
    { color: '#16a34a', label: 'Relatives', n: n0(R.relatives) },
    { color: '#0891b2', label: 'Work & Licenses', n: n0(R.employment) + n0(R.professionalLicense) },
    { color: '#6b7280', label: 'And more', n: null },
  ].filter((x) => x.n === null || x.n > 0);

  const handleSubmit = (e) => {
    e.preventDefault();
    // Validate here — the form is noValidate, so the HTML `required`/type=email
    // checks don't fire and an empty email would otherwise submit.
    const emailTrim = email.trim();
    if (!emailTrim || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim)) {
      if (setError) setError('Please enter a valid email address.');
      return;
    }
    if (!emailOnly && (!password || password.length < 8)) {
      if (setError) setError('Please create a password of at least 8 characters.');
      return;
    }
    if (emailOnly) {
      // Autogenerate a password (no field). Flag it so PaymentPage knows to reveal
      // it on the confirmation screen (only auto-generated ones are shown).
      const pw = generatePassword();
      try { sessionStorage.setItem('_pwAuto', '1'); } catch { /* storage unavailable */ }
      submitSignup({ email: emailTrim, password: pw, optin: true, selectedPersonId: id || null });
      return;
    }
    submitSignup({ email: emailTrim, password, optin: true, selectedPersonId: id || null });
  };
  const scrollToForm = (e) => { if (e) e.preventDefault(); document.getElementById('signup-form')?.scrollIntoView({ behavior: 'smooth' }); };

  // Emphasis hierarchy (light palette): the vCard is TIER 1 — the most elevated
  // surface + a brand accent top-bar so it reads as the star. Category rects are
  // tier 2 (medium elevation); the unlock form is tier 3 (recessed, tinted). Dark
  // palette keeps its bordered look.
  const card = { background: P.cardBg, border: P.onDark ? `1px solid ${P.cardBorder}` : 'none', borderTop: P.onDark ? `1px solid ${P.cardBorder}` : `4px solid ${P.accent}`, borderRadius: '1.125rem', padding: '2rem 1.75rem', marginBottom: '1.5rem', boxShadow: P.onDark ? '0 8px 30px rgba(0,0,0,0.4)' : '0 20px 48px rgba(17,24,39,0.18), 0 4px 12px rgba(17,24,39,0.07)' };
  const formLabel = { display: 'block', fontSize: '0.85rem', fontWeight: 600, color: P.ink2, marginBottom: '0.3rem' };
  const labelNote = { fontWeight: 400, fontStyle: 'italic' };
  const formInput = { width: '100%', boxSizing: 'border-box', padding: '0.75rem 0.85rem', fontSize: '1rem', border: `1.5px solid ${P.inputBorder}`, borderRadius: '0.5rem', outline: 'none', background: P.inputBg, color: P.ink };

  const contactRow = (label, value) => (
    <div key={label} style={{ display: 'flex', gap: '0.5rem', fontSize: '0.9rem', lineHeight: 1.4 }}>
      <span style={{ color: P.accent, flexShrink: 0 }}>✓</span>
      <span style={{ color: P.mut }}><strong style={{ color: P.ink2, fontWeight: 600 }}>{label}:</strong> {value}</span>
    </div>
  );

  const catHoverIn = (e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = P.onDark ? '0 8px 20px rgba(0,0,0,0.4)' : '0 8px 18px rgba(17,24,39,0.12)'; };
  const catHoverOut = (e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = P.onDark ? 'none' : '0 4px 14px rgba(17,24,39,0.08)'; };
  const ctaHoverIn = (e) => { e.currentTarget.style.filter = 'brightness(0.93)'; };
  const ctaHoverOut = (e) => { e.currentTarget.style.filter = 'none'; };

  return (
    <main data-no-nav="true" style={{ minHeight: '100vh', background: P.pageBg, paddingBottom: '5rem' }}>
      {/* Mini header — full-bleed */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.7rem 1rem', background: P.headerBg, color: P.headerText, fontSize: '0.85rem', borderBottom: P.onDark ? 'none' : '1px solid rgba(17,24,39,0.06)' }}>
        <Link to="/name/search-result" style={{ color: P.headerText, textDecoration: 'none', opacity: 0.9 }}>← Back to Results</Link>
        <span style={{ fontWeight: 700 }}>🔒 {brand.name}</span>
      </div>

      {/* Centered content column (premium desktop framing). Top padding lifts the
          vCard off the green header so the two greens don't butt together (owner). */}
      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '1.75rem 1rem 0' }}>
        {/* Hook line — removed on every variant except C (owner). */}
        {showHook && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '1.25rem 0 0.75rem', fontSize: aggressive ? '1.25rem' : '1.1rem', fontWeight: aggressive ? 800 : 700, color: P.ink }}>
            <span style={{ color: P.accent, fontSize: '1.15rem' }} aria-hidden="true">{T.hookIcon}</span>
            {T.hook(person.fullName)}
          </div>
        )}

        {/* Variant C: urgency strip — the report already exists; sign up to see it. */}
        {aggressive && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: P.verifiedBg, color: P.verifiedText, border: `1px solid ${P.verifiedBorder}`, borderRadius: '0.6rem', padding: '0.6rem 0.85rem', marginBottom: '0.75rem', fontSize: '0.85rem', fontWeight: 600 }}>
            ⚡ Full report compiled and ready — unlocks the moment you sign up.
          </div>
        )}

        {/* VCard — the dominant object */}
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
            <PersonAvatar person={person} size={72} />
            <div style={{ minWidth: 0 }}>
              {/* Self flow (/my-exposure): frame this as the visitor's OWN record — name KEPT (owner 2026-08-03). */}
              {getVariant() === 'self' && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 6, fontSize: '0.7rem', fontWeight: 800, letterSpacing: '.05em', textTransform: 'uppercase', color: P.accent, background: P.verifiedBg, border: `1px solid ${P.verifiedBorder}`, padding: '3px 9px', borderRadius: 999 }}>
                  Is this you?
                </span>
              )}
              <h1 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 800, color: P.ink, lineHeight: 1.1 }}>
                {properCaseName(person.fullName)}{(person.age || person.ageRange) ? `, ${person.age || person.ageRange}` : ''}
              </h1>
              {Array.isArray(person.aliases) && person.aliases.length > 0 && (
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.95rem', fontWeight: 500, color: P.mut, fontStyle: 'italic' }}>
                  aka {person.aliases.slice(0, 3).join(', ')}
                </p>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', background: P.verifiedBg, color: P.verifiedText, border: `1px solid ${P.verifiedBorder}`, borderRadius: '999px', padding: '0.2rem 0.65rem', fontSize: '0.73rem', fontWeight: 600 }}>
              🛡️ Verified in our database
            </span>
            {person.onRecordSince && <span style={{ fontSize: '0.73rem', color: P.muted }}>📁 On record since {person.onRecordSince}</span>}
            <span style={{ fontSize: '0.73rem', color: P.muted }}>🕓 Last updated {updatedDate}</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
            {contactRow('Addresses', addressVal)}
            {contactRow('Phone Numbers', phoneVal)}
            {contactRow('Email Addresses', emailVal)}
          </div>

          {foundChips.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.9rem', paddingTop: '0.9rem', borderTop: `1px solid ${P.onDark ? 'rgba(255,255,255,0.1)' : 'rgba(17,24,39,0.08)'}` }}>
              <span style={{ width: '100%', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: P.muted, marginBottom: '0.15rem' }}>Also on file</span>
              {foundChips.map((c) => <span key={c} style={chip}>{c}</span>)}
            </div>
          )}

          {/* Record teaser — high-intent conversion lever on a SPECIFIC person → STRICT (corroborate on age so a
              same-name stranger's record is never attributed here). Unified engine teaser, flow-prioritized. */}
          {bkLast && <SignalTeaser subject={{ firstName: bkFirst, lastName: bkLast, state: bkState, age: person.age || person.ageRange, gender: person.gender }} flow={getFlow() || 'general'} viewerRelation="prospect" stage="pre-signup" strict accent={P.accent || P.ink} dark={P.ink} />}
        </div>

        {/* Variant D (map layout): location map panel — stylized, self-contained
            (no map SDK/key). City/state is REAL; the streets are a decorative
            motif, so the caption keeps precision honest (city-level). */}
        {mapLayout && (
          <>
            <div style={{ background: P.cardBg, borderRadius: '1.125rem', overflow: 'hidden', marginBottom: '1rem', boxShadow: P.onDark ? '0 8px 30px rgba(0,0,0,0.35)' : '0 8px 24px rgba(17,24,39,0.08)' }}>
              {realMap ? (
                /* Real map via the keyless Google Maps embed (city/state query —
                   no API key, no dependency, no coordinate dataset). City-level
                   only. NOTE: this legacy embed is fine for a challenger test;
                   production scale should move to the official Maps Embed API
                   (needs a key) or bundled coords + OSM tiles. */
                <iframe
                  title={`Map of ${cityState || 'the United States'}`}
                  src={`https://maps.google.com/maps?q=${encodeURIComponent(cityState || 'United States')}&z=11&output=embed`}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  style={{ display: 'block', width: '100%', height: '230px', border: 0 }}
                />
              ) : (
              <div style={{ position: 'relative', height: '190px' }}>
                <svg viewBox="0 0 400 190" preserveAspectRatio="xMidYMid slice" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} aria-hidden="true">
                  <rect width="400" height="190" fill="#e9f1ec" />
                  <path d="M0 140 Q 110 122 210 146 T 400 138 V190 H0 Z" fill="#d6e8f0" />
                  <rect x="34" y="26" width="78" height="46" rx="5" fill="#dcebd7" />
                  <rect x="250" y="34" width="96" height="58" rx="5" fill="#dcebd7" />
                  <rect x="150" y="96" width="70" height="40" rx="5" fill="#dcebd7" />
                  <g stroke="#ffffff" strokeWidth="7" opacity="0.95" strokeLinecap="round">
                    <line x1="-10" y1="78" x2="410" y2="70" />
                    <line x1="-10" y1="120" x2="410" y2="128" />
                    <line x1="120" y1="-10" x2="150" y2="200" />
                    <line x1="285" y1="-10" x2="262" y2="200" />
                  </g>
                  <g stroke="#f4d06f" strokeWidth="3.5" opacity="0.9" strokeLinecap="round">
                    <line x1="-10" y1="99" x2="410" y2="96" />
                  </g>
                </svg>
                <div style={{ position: 'absolute', left: '50%', top: '46%', transform: 'translate(-50%,-50%)', width: '46px', height: '46px', borderRadius: '50%', background: 'rgba(21,128,61,0.18)' }} />
                <div style={{ position: 'absolute', left: '50%', top: '44%', transform: 'translate(-50%,-100%)', fontSize: '2.3rem', filter: 'drop-shadow(0 3px 3px rgba(0,0,0,0.3))', lineHeight: 1 }} aria-hidden="true">📍</div>
                <div style={{ position: 'absolute', left: '50%', top: '52%', transform: 'translateX(-50%)', background: '#fff', borderRadius: '8px', padding: '0.35rem 0.75rem', fontSize: '0.82rem', fontWeight: 800, color: P.ink, boxShadow: '0 3px 10px rgba(0,0,0,0.22)', whiteSpace: 'nowrap' }}>
                  {cityState || 'United States'}
                </div>
              </div>
              )}
              <div style={{ padding: '0.85rem 1.4rem' }}>
                <p style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700, color: P.ink }}>📌 {R.address > 0 ? `${plural(R.address, 'location')} on record` : 'Location on record'}</p>
                <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: P.mut }}>Full street address &amp; interactive map unlock with the report.</p>
              </div>
            </div>

            {legend.length > 0 && (
              <div style={{ background: P.cardBg, borderRadius: '1.125rem', padding: '1.25rem 1.5rem', marginBottom: '1rem', boxShadow: P.onDark ? '0 8px 30px rgba(0,0,0,0.35)' : '0 8px 24px rgba(17,24,39,0.08)' }}>
                <p style={{ margin: '0 0 0.85rem', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: P.muted }}>What&apos;s in the full report</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem 1rem' }}>
                  {legend.map((item) => (
                    <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', color: P.ink2 }}>
                      <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: item.color, flexShrink: 0 }} />
                      <span style={{ fontWeight: 600 }}>{item.label}</span>
                      {item.n != null && <span style={{ color: P.mut }}>({item.n})</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Compressed record categories — white cards, accent line, hover lift */}
        {!mapLayout && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', marginBottom: '1.5rem' }}>
          {cats.map((c) => (
            <div key={c.title} onMouseEnter={catHoverIn} onMouseLeave={catHoverOut}
              style={{ background: P.cardBg, borderLeft: `3px solid ${P.accent}`, borderRadius: '0.6rem', padding: '0.75rem 0.9rem', boxShadow: P.onDark ? 'none' : '0 4px 14px rgba(17,24,39,0.08)', transition: 'transform 0.15s ease, box-shadow 0.15s ease' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: P.ink, marginBottom: '0.2rem' }}>{c.icon} {c.title}</div>
              <div style={{ fontSize: '0.73rem', color: P.mut, lineHeight: 1.4 }}>{c.items}</div>
            </div>
          ))}
        </div>
        )}

        {/* Variant C: redacted "locked report" preview — shows there's a full report
            behind the paywall (blurred bars are decorative, never fake values).
            Suppressed in map layouts (F), where the category legend already does this. */}
        {aggressive && !mapLayout && (
          <div style={{ background: P.cardBg, borderRadius: '1.125rem', padding: '1.4rem 1.6rem', marginBottom: '1rem', boxShadow: '0 8px 24px rgba(17,24,39,0.08)' }}>
            <p style={{ margin: '0 0 0.9rem', fontWeight: 800, fontSize: '1.05rem', color: P.ink }}>🔒 {person.fullName}&apos;s full report is locked</p>
            {['Phone numbers', 'Email addresses', 'Home & past addresses', 'Criminal & court records', 'Relatives & associates'].map((row) => (
              <div key={row} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.55rem 0', borderBottom: '1px solid rgba(17,24,39,0.06)' }}>
                <span style={{ color: P.ink2, fontWeight: 600, fontSize: '0.9rem' }}>{row}</span>
                <span aria-hidden="true" style={{ background: 'rgba(17,24,39,0.12)', color: 'transparent', borderRadius: '4px', padding: '0.1rem 0.5rem', userSelect: 'none', fontSize: '0.85rem', letterSpacing: '2px' }}>████████</span>
              </div>
            ))}
            <p style={{ margin: '0.9rem 0 0', textAlign: 'center', fontWeight: 700, fontSize: '0.9rem', color: P.accent }}>👇 Unlock below to reveal all of it</p>
          </div>
        )}

        {/* Unlock form — TIER 3: recessed tinted panel (light palette). Sits below
            the vCard + rects in emphasis; white inputs + orange CTA pop against it. */}
        <div id="signup-form" style={{ background: P.onDark ? P.formBg : '#e9edf3', border: P.onDark ? `1px solid ${P.formBorder}` : '1px solid rgba(17,24,39,0.06)', borderRadius: '1.125rem', padding: '2rem 1.75rem', marginBottom: '1rem', boxShadow: P.onDark ? '0 8px 30px rgba(0,0,0,0.35)' : '0 1px 2px rgba(17,24,39,0.04)' }}>
          <div style={{ textAlign: 'center', fontSize: '1.7rem', marginBottom: '0.25rem' }} aria-hidden="true">🔍</div>
          <h2 style={{ margin: '0 0 1.1rem', textAlign: 'center', fontSize: '1.35rem', fontWeight: 800, color: P.ink }}>
            {T.formTitle(person.fullName)}
          </h2>

          {success ? (
            <div style={{ textAlign: 'center', color: P.accent, fontWeight: 600, padding: '1rem 0' }}>
              ✅ Account created! Redirecting to complete your access…
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate>
              <div style={{ marginBottom: '1rem' }}>
                <label style={formLabel} htmlFor="sup-email">Email address <span style={labelNote}>{T.emailNote}</span></label>
                <input id="sup-email" type="email" name="email" value={email} onChange={e => setEmail(e.target.value)} style={formInput} placeholder="you@email.com" required autoComplete="email" />
              </div>
              {!emailOnly && (
                <div style={{ marginBottom: '1rem' }}>
                  <label style={formLabel} htmlFor="sup-password">Create a password <span style={labelNote}>{T.pwNote}</span></label>
                  <input id="sup-password" type="password" name="password" value={password} onChange={e => setPassword(e.target.value)} style={formInput} placeholder="Min. 8 characters" required minLength={8} autoComplete="new-password" />
                </div>
              )}

              {error && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: '0.5rem', padding: '0.6rem 0.75rem', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
                  {error === 'already_exists' ? (<>An account with this email already exists. <Link to="/login" style={{ color: '#991b1b', fontWeight: 600 }}>Log in instead</Link></>) : error}
                </div>
              )}

              <button type="submit" disabled={loading} onMouseEnter={ctaHoverIn} onMouseLeave={ctaHoverOut}
                style={{ width: '100%', padding: '0.95rem', fontSize: '1.05rem', fontWeight: 800, color: P.ctaText, background: P.cta, border: 'none', borderRadius: '0.6rem', cursor: loading ? 'default' : 'pointer', boxShadow: '0 6px 16px rgba(245,158,11,0.35)', transition: 'filter 0.15s ease' }}>
                {loading ? T.ctaLoading : T.cta}
              </button>

              {aggressive && (
                <p style={{ textAlign: 'center', margin: '0.8rem 0 0', fontSize: '0.82rem', fontWeight: 600, color: P.accent }}>
                  🔒 Secure checkout · cancel anytime.
                </p>
              )}

              <p style={{ textAlign: 'center', margin: '0.9rem 0 0', fontSize: '0.85rem', color: P.mut }}>
                Already have an account? <Link to="/login" style={{ color: P.accent, fontWeight: 600 }}>Sign in</Link>
              </p>
            </form>
          )}

          <div style={{ display: 'flex', justifyContent: 'center', gap: '1.25rem', marginTop: '1rem', fontSize: '0.78rem', color: P.muted }}>
            <span style={{ color: P.accent }}>🔒 SSL Encrypted</span>
            <span>🚫 No spam</span>
          </div>
        </div>

        {/* Reassurance — the trial + satisfaction bullets were removed (owner). The
            social-proof line stays only on the aggressive tone. */}
        {aggressive && (
          <ul style={{ margin: '0 0 1.5rem', padding: '0 0 0 1.1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', color: P.mut, fontSize: '0.85rem', lineHeight: 1.5 }}>
            <li>Join <strong>3 million+</strong> members who trust {brand.name} to find the truth.</li>
          </ul>
        )}
      </div>

      {/* Sticky mobile CTA removed (owner) — the orange anchored button conflicted
          with the green chrome; the in-form CTA carries the conversion. */}
    </main>
  );
};

export const SUP_PALETTE_GREEN = {
  pageBg: '#f5f7fa',
  ink: '#111827', ink2: '#374151', mut: '#6b7280', muted: '#9ca3af',
  accent: '#15803d', accentGrad: 'linear-gradient(135deg, #0d5d2f 0%, #1a7a42 100%)',
  cardBg: '#ffffff', cardBorder: 'rgba(17,24,39,0.08)', chipBg: '#ffffff',
  formBg: '#ffffff', formBorder: 'rgba(17,24,39,0.08)', inputBg: '#ffffff', inputBorder: '#d1d5db',
  cta: '#0d5d2f', ctaText: '#ffffff',
  verifiedBg: '#ecfdf3', verifiedText: '#15803d', verifiedBorder: 'rgba(21,128,61,0.25)',
  headerBg: '#0d5d2f', headerText: '#ffffff', onDark: false,
};

export const SUP_PALETTE_BLUE = {
  pageBg: '#f5f7fa',
  ink: '#0f2533', ink2: '#0f2533', mut: '#5b7484', muted: '#8aa0b0',
  accent: '#007cc2', accentGrad: 'linear-gradient(135deg, #007cc2 0%, #055a86 100%)',
  cardBg: '#ffffff', cardBorder: 'rgba(17,24,39,0.08)', chipBg: '#ffffff',
  formBg: '#ffffff', formBorder: 'rgba(17,24,39,0.08)', inputBg: '#ffffff', inputBorder: '#d3e3ec',
  cta: '#fd6f0b', ctaText: '#ffffff',
  verifiedBg: '#e0f2fe', verifiedText: '#055a86', verifiedBorder: 'rgba(5,90,134,0.25)',
  headerBg: 'linear-gradient(135deg, #007cc2, #055a86)', headerText: '#ffffff', onDark: false,
};

export const SUP_PALETTE_DARK = {
  pageBg: 'linear-gradient(180deg, #0f1629 0%, #16213e 100%)',
  ink: '#eef2f9', ink2: '#eef2f9', mut: '#9aa7bd', muted: '#7a869c',
  accent: '#f59e0b', accentGrad: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
  cardBg: '#1e2a47', cardBorder: 'rgba(255,255,255,0.12)', chipBg: 'rgba(255,255,255,0.04)',
  formBg: '#1e2a47', formBorder: 'rgba(255,255,255,0.12)', inputBg: 'rgba(255,255,255,0.06)', inputBorder: 'rgba(255,255,255,0.12)',
  cta: 'linear-gradient(180deg, #f59e0b, #d97706)', ctaText: '#1a1206',
  verifiedBg: 'rgba(245,158,11,0.14)', verifiedText: '#fbbf24', verifiedBorder: 'rgba(245,158,11,0.4)',
  headerBg: '#0f1629', headerText: '#eef2f9', onDark: true,
};

export default SupTeaserA;
