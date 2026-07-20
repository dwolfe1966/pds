import React, { useState } from 'react';
import SignalTeaser from '../../components/SignalTeaser';
import { getPersonSignals } from '../../services/personSignals';

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
