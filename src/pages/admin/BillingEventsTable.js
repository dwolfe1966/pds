import React from 'react';
import { classifyBilling, billingEvents } from './billingClassification';

// Methodical billing-events table for the Orders & Payments tab: descending chronological — charge,
// outcome, notes — with the expected NEXT event pinned at the top (owner 2026-07-22).
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

export default function BillingEventsTable({ order }) {
  const c = classifyBilling(order);
  const rows = billingEvents(order);
  if (!c && rows.length === 0) return null;

  const ne = c?.nextEvent;
  const nextCharge = ne
    ? (ne.type === 'access-ends' ? 'No further charges'
        : ne.isRetry ? `Retry ${ne.retry}${ne.maxAttempts ? ` of ${ne.maxAttempts}` : ''} ${fmtMoney(ne.amount)}`
        : `${ne.type === 'trial-charge' ? 'Initial charge' : ne.type === 'first-bill' ? 'First bill (S1)' : 'Renewal'} ${fmtMoney(ne.amount)}`)
    : '—';
  const nextWhen = ne?.date ? fmtDate(ne.date) : (c?.expectation && !ne ? '' : '—');
  const th = { textAlign: 'left', padding: '6px 10px', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#6b7280', fontWeight: 700, borderBottom: '2px solid #e5e7eb', whiteSpace: 'nowrap' };
  const td = { padding: '7px 10px', fontSize: '0.84rem', color: '#111827', borderBottom: '1px solid #f3f4f6', verticalAlign: 'top' };

  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6b7280', fontWeight: 700, marginBottom: 6 }}>Billing events</div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 520 }}>
          <thead>
            <tr>
              <th style={th}>When</th>
              <th style={th}>Charge</th>
              <th style={th}>Outcome</th>
              <th style={th}>Notes</th>
            </tr>
          </thead>
          <tbody>
            {/* Pinned top row: the expected NEXT event */}
            <tr style={{ background: '#eff6ff' }}>
              <td style={{ ...td, fontWeight: 600 }}>{nextWhen || 'upcoming'}</td>
              <td style={{ ...td, fontWeight: 700 }}>{nextCharge}</td>
              <td style={td}>
                <span style={{ display: 'inline-block', padding: '1px 8px', borderRadius: 999, fontSize: '0.72rem', fontWeight: 700, color: '#1e40af', background: '#dbeafe' }}>Expected next</span>
              </td>
              <td style={{ ...td, color: '#4b5563' }}>{c?.expectation || ''}</td>
            </tr>
            {rows.map((r, i) => {
              const t = OUTCOME_TONE[r.tone] || OUTCOME_TONE.gray;
              return (
                <tr key={i}>
                  <td style={{ ...td, color: '#6b7280', whiteSpace: 'nowrap' }}>{fmtDate(r.ts)}</td>
                  <td style={td}>{r.charge}{r.amount != null && r.charge !== '—' ? ` · ${fmtMoney(r.amount)}` : ''}</td>
                  <td style={td}>
                    <span style={{ display: 'inline-block', padding: '1px 8px', borderRadius: 999, fontSize: '0.72rem', fontWeight: 700, color: t.fg, background: t.bg }}>{r.outcome}</span>
                  </td>
                  <td style={{ ...td, color: '#4b5563' }}>{r.notes || '—'}</td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td style={{ ...td, color: '#9ca3af' }} colSpan={4}>No billing events yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
