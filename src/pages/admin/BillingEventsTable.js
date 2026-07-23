import React from 'react';
import { Link } from 'react-router-dom';
import { classifyBilling, billingEvents } from './billingClassification';

// Methodical billing-events table for the Orders & Payments tab: descending chronological — When · Charge ·
// Outcome · Notes — consolidated across all the customer's orders, with the expected NEXT event pinned at
// the top. Actionable orders link to their detail page (where refund/cancel live). Accepts a single
// `order` (order detail page) or `orders` + `userId` (customer detail tab).
const OUTCOME_TONE = {
  green:  { fg: '#065f46', bg: '#d1fae5' },
  red:    { fg: '#991b1b', bg: '#fee2e2' },
  purple: { fg: '#5b21b6', bg: '#ede9fe' },
  gray:   { fg: '#374151', bg: '#f3f4f6' },
};
const fmtDate = (ms) => {
  if (!Number.isFinite(ms)) return '—';
  try { return new Date(ms).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }); }
  catch { return '—'; }
};
const fmtMoney = (a) => (a == null ? '' : `$${Number(a).toFixed(2)}`);
const oidOf = (o) => o?._id || o?.id || '';

export default function BillingEventsTable({ order, orders, userId }) {
  const list = Array.isArray(orders) ? orders : (order ? [order] : []);
  if (list.length === 0) return null;

  // Consolidate events across every order, tag each with its orderId.
  const rows = list
    .flatMap((o) => billingEvents(o).map((r) => ({ ...r, orderId: oidOf(o) })))
    .sort((a, b) => b.ts - a.ts);

  // The pinned next event comes from the primary (active, else most recent) order.
  const primary = list.find((o) => (o?.status || '').toLowerCase() === 'active') || list[0];
  const c = primary ? classifyBilling(primary) : null;
  const ne = c?.nextEvent;
  const nextCharge = ne
    ? (ne.type === 'access-ends' ? 'No further charges'
        : ne.isRetry ? `Retry ${ne.retry}${ne.maxAttempts ? ` of ${ne.maxAttempts}` : ''} ${fmtMoney(ne.amount)}`
        : `${ne.type === 'trial-charge' ? 'Initial charge' : ne.type === 'first-bill' ? 'First bill (M1)' : 'Renewal'} ${fmtMoney(ne.amount)}`)
    : '—';

  const linkTo = (oid) => (userId && oid ? `/purchases/${oid}?userId=${userId}` : null);
  const th = { textAlign: 'left', padding: '6px 10px', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#6b7280', fontWeight: 700, borderBottom: '2px solid #e5e7eb', whiteSpace: 'nowrap' };
  const td = { padding: '7px 10px', fontSize: '0.84rem', color: '#111827', borderBottom: '1px solid #f3f4f6', verticalAlign: 'top' };

  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6b7280', fontWeight: 700, marginBottom: 6 }}>Billing events</div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
          <thead>
            <tr>
              <th style={th}>When</th>
              <th style={th}>Charge</th>
              <th style={th}>Outcome</th>
              <th style={th}>Notes</th>
              {userId && <th style={th}>Order</th>}
            </tr>
          </thead>
          <tbody>
            <tr style={{ background: '#eff6ff' }}>
              <td style={{ ...td, fontWeight: 600 }}>{ne?.date ? fmtDate(ne.date) : 'upcoming'}</td>
              <td style={{ ...td, fontWeight: 700 }}>{nextCharge}</td>
              <td style={td}><span style={{ display: 'inline-block', padding: '1px 8px', borderRadius: 999, fontSize: '0.72rem', fontWeight: 700, color: '#1e40af', background: '#dbeafe' }}>Expected next</span></td>
              <td style={{ ...td, color: '#4b5563' }} colSpan={userId ? 2 : 1}>{c?.expectation || ''}</td>
            </tr>
            {rows.map((r, i) => {
              const t = OUTCOME_TONE[r.tone] || OUTCOME_TONE.gray;
              const href = linkTo(r.orderId);
              return (
                <tr key={i}>
                  <td style={{ ...td, color: '#6b7280', whiteSpace: 'nowrap' }}>{fmtDate(r.ts)}</td>
                  <td style={td}>{r.charge}{r.amount != null && r.charge !== '—' ? ` · ${fmtMoney(r.amount)}` : ''}</td>
                  <td style={td}><span style={{ display: 'inline-block', padding: '1px 8px', borderRadius: 999, fontSize: '0.72rem', fontWeight: 700, color: t.fg, background: t.bg }}>{r.outcome}</span></td>
                  <td style={{ ...td, color: '#4b5563' }}>{r.notes || '—'}</td>
                  {userId && (
                    <td style={td}>{href ? <Link to={href} style={{ color: '#4338ca', fontWeight: 600, fontSize: '0.78rem' }}>View / act →</Link> : '—'}</td>
                  )}
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td style={{ ...td, color: '#9ca3af' }} colSpan={userId ? 5 : 4}>No billing events yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
