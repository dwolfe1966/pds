import React, { useState } from 'react';
import SignalTeaser from '../../components/SignalTeaser';
import { getPersonSignals } from '../../services/personSignals';
import MarriageDivorceSection from '../../components/MarriageDivorceSection';
import SexOffenderSection from '../../components/SexOffenderSection';

/**
 * Paid-profile (post-pay, member-other lens) demo: the SAME engine, but with stage='post-pay' it returns the
 * report signals — booking (merges into the Criminal module on the real report), marriage/divorce (its own
 * section), and the corroborated sex-offender safety check (dating flow only). Button-triggered because the
 * sex-offender lookup is ~10s (browser-tier NSOPW).
 */
function PaidProfileDemo() {
  const subject = { firstName: 'James', lastName: 'Smith', state: 'FL', age: '40', gender: 'M' };
  const [res, setRes] = useState(null);
  const [loading, setLoading] = useState(false);
  const load = () => {
    setLoading(true);
    getPersonSignals({ subject, viewerRelation: 'member-other', stage: 'post-pay', sexOffender: true, flow: 'dating' })
      .then(setRes).finally(() => setLoading(false));
  };
  const booking = res && res.signals.booking ? res.signals.booking.records : [];
  const md = res && res.signals.marriageDivorce ? res.signals.marriageDivorce.records : [];
  const so = res && res.signals.sexOffender ? res.signals.sexOffender.records : [];
  return (
    <section style={{ margin: '18px 0', padding: 12, border: '2px solid #0d5d2f', borderRadius: 10, background: '#f0fdf4' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong style={{ fontSize: 13, color: '#0d5d2f' }}>PAID PROFILE (post-pay · member-other) — James Smith / FL, age 40</strong>
        <button type="button" onClick={load} disabled={loading} style={{ fontSize: 12, padding: '4px 10px', cursor: 'pointer' }}>
          {loading ? 'Running (safety check ~10s)…' : 'Load augmentation'}
        </button>
      </div>
      {res && (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 12, color: '#374151', marginBottom: 8 }}>
            Engine post-pay signals → booking <strong>{booking.length}</strong> (merges into Criminal on the real report) ·
            marriage/divorce <strong>{md.length}</strong> · corroborated sex-offender <strong>{so.length}</strong>
          </div>
          {booking.length > 0 && (
            <div style={{ padding: 10, background: '#fff', borderRadius: 8, border: '1px solid #e5e7eb', marginBottom: 10 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: '#111827', marginBottom: 4 }}>⚖️ Court &amp; Criminal (augmented with first-party booking)</div>
              {booking.slice(0, 4).map((r, i) => (
                <div key={i} style={{ fontSize: 12.5, color: '#374151' }}>
                  • {(r.charges && r.charges.length ? r.charges.join('; ') : (r.recordType === 'court' ? 'Court record' : 'Incarceration record'))}
                  {r.facility ? ` · ${r.facility}` : ''}
                </div>
              ))}
            </div>
          )}
          <MarriageDivorceSection records={md} context="search" />
          <SexOffenderSection records={so} personName="James Smith" />
        </div>
      )}
    </section>
  );
}

/**
 * DEV-ONLY harness to eyeball SignalTeaser rendering without walking the whole funnel (signals-augmentation
 * QA). Renders the unified teaser for a few (flow, subject) combos + dumps the raw getPersonSignals result.
 * Not linked anywhere; short-circuits in production. Run with the flags + endpoints pointed at idlookup.me:
 *   REACT_APP_SIGNALS_AUGMENT=1 REACT_APP_SIGNALS_BOOKING_PRESIGNUP=1 \
 *   REACT_APP_LIFE_EVENTS_URL=https://idlookup.me/api/life-events \
 *   REACT_APP_INCARCERATION_URL=https://idlookup.me/api/incarceration npm start
 * then open http://localhost:3000/dev/signal-teaser
 */
const CASES = [
  { label: 'divorce flow — Michael Johnson / NV', flow: 'divorce', subject: { firstName: 'Michael', lastName: 'Johnson', state: 'NV', age: '' } },
  { label: 'dating flow — Michael Johnson / NV', flow: 'dating', subject: { firstName: 'Michael', lastName: 'Johnson', state: 'NV', age: '' } },
  { label: 'inmate flow — James Smith / FL', flow: 'inmate', subject: { firstName: 'James', lastName: 'Smith', state: 'FL', age: '' } },
  { label: 'general flow — James Smith / FL', flow: 'general', subject: { firstName: 'James', lastName: 'Smith', state: 'FL', age: '' } },
];

export default function SignalTeaserDevPage() {
  const [dump, setDump] = useState(null);
  if (process.env.NODE_ENV === 'production') return <div style={{ padding: 40 }}>Not available.</div>;

  const augment = process.env.REACT_APP_SIGNALS_AUGMENT === '1';
  const bookingPre = process.env.REACT_APP_SIGNALS_BOOKING_PRESIGNUP === '1';

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 16px', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: 20 }}>SignalTeaser dev harness</h1>
      <p style={{ fontSize: 13, color: augment ? '#166534' : '#b91c1c', fontWeight: 700 }}>
        REACT_APP_SIGNALS_AUGMENT = {augment ? '1 (default: lead + also-found)' : 'unset/0 → default augment ON unless =0 (kill-switch → lead-only)'}
        {' · '}BOOKING_PRESIGNUP = {bookingPre ? '1' : 'off (booking hidden pre-signup)'}
      </p>
      <PaidProfileDemo />
      <h2 style={{ fontSize: 15, marginTop: 24 }}>Pre-signup teasers (prospect)</h2>
      {CASES.map((c) => (
        <section key={c.label} style={{ margin: '18px 0', padding: 12, border: '1px solid #e5e7eb', borderRadius: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <strong style={{ fontSize: 13, color: '#374151' }}>{c.label}</strong>
            <button type="button" onClick={() => getPersonSignals({ subject: c.subject, flow: c.flow, viewerRelation: 'prospect', stage: 'pre-signup' }).then(setDump)}
              style={{ fontSize: 12, padding: '4px 10px', cursor: 'pointer' }}>log result</button>
          </div>
          <SignalTeaser subject={c.subject} flow={c.flow} viewerRelation="prospect" stage="pre-signup" />
        </section>
      ))}
      {dump && <pre style={{ fontSize: 11, background: '#f9fafb', padding: 12, borderRadius: 8, overflow: 'auto' }}>{JSON.stringify(dump, (k, v) => (k === 'records' && Array.isArray(v) ? `[${v.length} records]` : v), 2)}</pre>}
    </div>
  );
}
