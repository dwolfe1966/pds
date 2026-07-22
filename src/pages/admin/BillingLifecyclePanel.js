import React, { useState } from 'react';
import { classifyBilling, billingTimeline } from './billingClassification';

/**
 * BillingLifecyclePanel — the per-customer S-code lifecycle view for a single order (CSR).
 * Shows: current S-code + phase, card type (cpd), early-cancel flag, the NEXT expected event
 * ("what happens next" — the piece reps were missing), and the billing-event history.
 * Definitions: docs/admin/csr-billing-classification-spec.md.
 */

const PHASE_STYLE = {
  trial:            { bg: '#fef3c7', fg: '#92400e', dot: '#d97706' },
  subscriber:       { bg: '#d1fae5', fg: '#065f46', dot: '#059669' },
  dunning:          { bg: '#fee2e2', fg: '#991b1b', dot: '#dc2626' },
  cancelled_active: { bg: '#ffedd5', fg: '#9a3412', dot: '#ea580c' },
  cancelled_ended:  { bg: '#e5e7eb', fg: '#374151', dot: '#6b7280' },
  expired:          { bg: '#fee2e2', fg: '#7f1d1d', dot: '#b91c1c' },
  order_suspended:  { bg: '#fee2e2', fg: '#991b1b', dot: '#dc2626' },
  refunded:         { bg: '#ede9fe', fg: '#5b21b6', dot: '#7c3aed' },
  payment_failed:   { bg: '#fef2f2', fg: '#7c2d12', dot: '#dc2626' },
};

const fmtDate = (ms) => {
  if (!Number.isFinite(ms)) return '—';
  try { return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); }
  catch { return '—'; }
};
const fmtMoney = (a) => (a == null ? '' : `$${Number(a).toFixed(2)}`);

export default function BillingLifecyclePanel({ order }) {
  const [showHistory, setShowHistory] = useState(false);
  const c = classifyBilling(order);
  if (!c) return null;
  const ps = PHASE_STYLE[c.phase] || PHASE_STYLE.expired;
  const ne = c.nextEvent;
  const timeline = billingTimeline(order);

  // Plain-English, phase-aware "what to expect" (simpler for the CSR than a field dump).
  const nextLine = c.expectation || 'No upcoming billing event';
  const m = c.money || {};
  const moneyLine = [
    m.capturedAny ? `Captured ${fmtMoney(m.collected)}${m.saleCount ? ` (${m.saleCount} charge${m.saleCount === 1 ? '' : 's'})` : ''}` : 'No money captured yet',
    m.refunded > 0 ? `Refunded ${fmtMoney(m.refunded)}` : null,
    c.memberDays != null ? `Member ${c.memberDays}d` : null,
    c.subscriberDays > 0 ? `Paid ${c.subscriberDays}d` : null,
  ].filter(Boolean).join(' · ');

  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: '0.85rem 1rem', marginBottom: '0.75rem', background: '#fff' }}>
      {/* Status line */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: ps.bg, color: ps.fg, borderRadius: 999, padding: '0.2rem 0.7rem', fontWeight: 800, fontSize: '0.95rem' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: ps.dot }} />
          {c.sCode}
        </span>
        <span style={{ fontSize: '0.92rem', fontWeight: 600, color: '#111827' }}>{c.phaseLabel}</span>
        {c.hasAccess && <span style={{ fontSize: '0.72rem', color: '#065f46' }}>has access</span>}
        {c.earlyCancel && (
          <span title={c.earlyCancel === 'C0' ? 'Cancelled within day 1 (poor first impression)' : 'Cancelled before the first monthly charge'}
            style={{ fontSize: '0.72rem', fontWeight: 700, color: '#7c2d12', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '0.05rem 0.4rem' }}>
            {c.earlyCancel}
          </span>
        )}
        {c.card?.cpd && (
          <span title={`Card type — payment propensity signal${c.card.lowPropensity ? ' (prepaid/debit convert worse)' : ''}`}
            style={{ marginLeft: 'auto', fontSize: '0.74rem', color: c.card.lowPropensity ? '#9a3412' : '#374151', background: c.card.lowPropensity ? '#fff7ed' : '#f3f4f6', border: `1px solid ${c.card.lowPropensity ? '#fed7aa' : '#e5e7eb'}`, borderRadius: 999, padding: '0.1rem 0.55rem', whiteSpace: 'nowrap' }}>
            {c.card.brand ? `${c.card.brand} · ` : ''}{c.card.label} ({c.card.cpd}){c.card.lowPropensity ? ' ⚠' : ''}
          </span>
        )}
      </div>

      {/* What to expect — one plain-English sentence */}
      <div style={{ marginTop: 8, display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6b7280', fontWeight: 700, whiteSpace: 'nowrap' }}>What to expect</span>
        <span style={{ fontSize: '0.9rem', color: c.dunning || c.phase === 'order_suspended' ? '#991b1b' : '#111827', fontWeight: c.dunning ? 700 : 500 }}>{nextLine}</span>
      </div>

      {/* Money captured + tenure — one compact line */}
      <div style={{ marginTop: 6, fontSize: '0.82rem', color: c.money?.capturedAny ? '#374151' : '#9a3412' }}>
        💰 {moneyLine}
      </div>

      {/* Billing history toggle */}
      {timeline.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <button type="button" onClick={() => setShowHistory((v) => !v)}
            style={{ fontSize: '0.78rem', color: '#4338ca', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontWeight: 600 }}>
            {showHistory ? '▾ Hide' : '▸ Show'} billing history ({timeline.length})
          </button>
          {showHistory && (
            <ul style={{ listStyle: 'none', margin: '0.5rem 0 0', padding: 0, borderLeft: '2px solid #e5e7eb' }}>
              {timeline.slice(0, 30).map((e, i) => (
                <li key={i} style={{ padding: '0.25rem 0 0.25rem 0.75rem', fontSize: '0.82rem', color: '#374151' }}>
                  <span style={{ color: '#9ca3af', marginRight: 8 }}>{fmtDate(e.ts)}</span>
                  {e.kind === 'payment'
                    ? <span>{e.type === 'refund' ? 'Refund' : e.type === 'sale' ? 'Charge' : e.type} {fmtMoney(e.amount)} — <b style={{ color: e.pstatus === 'fulfilled' ? '#065f46' : '#991b1b' }}>{e.pstatus === 'fulfilled' ? 'paid' : (e.decline ? `failed (${e.decline})` : e.pstatus)}</b></span>
                    : <span>Status → <b>{e.status}{e.subStatus ? ` · ${e.subStatus}` : ''}</b>{e.reason ? ` (${e.reason})` : ''}{e.by ? ` · ${e.by}` : ''}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
