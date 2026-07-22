import React from 'react';
import { classifyBilling } from './billingClassification';

// Compact per-ORDER billing status for Purchases/Orders list rows — the same S-code vocabulary as the
// customer surfaces, but scoped to one order (classifyBilling, not the customer rollup). Risk-coloured
// (green/yellow/red); short state on the chip, next-event + fraud in the tooltip.
const TONE = {
  green:  { bg: '#d1fae5', fg: '#065f46' },
  yellow: { bg: '#fef3c7', fg: '#92400e' },
  red:    { bg: '#fee2e2', fg: '#991b1b' },
};

export default function OrderBillingBadge({ order }) {
  const c = classifyBilling(order);
  if (!c) return <span style={{ color: '#9ca3af' }}>—</span>;
  const t = TONE[c.risk?.tone] || TONE.red;
  const title = [
    c.stateName,
    c.nextEventShort && c.nextEventShort !== 'None' ? `Next: ${c.nextEventShort}` : null,
    c.renewalNote ? `⚠ ${c.renewalNote}` : null,
    c.neverCaptured ? '⚠ Never captured ($0)' : null,
    c.fraudStop ? '🚫 Suspected fraud' : null,
  ].filter(Boolean).join(' · ');
  return (
    <span
      title={title}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: t.bg, color: t.fg, padding: '2px 9px', borderRadius: 999, fontSize: '0.72rem', fontWeight: 700, whiteSpace: 'nowrap' }}
    >
      {c.fraudStop ? '🚫 ' : ''}{c.stateCode}
    </span>
  );
}
