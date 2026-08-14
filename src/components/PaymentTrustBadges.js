import React from 'react';

// Payment-page credibility badges — GENERIC, entitlement-safe safety markers only.
// Deliberately NO payment-processor (TRX/Celero) logos: naming the acquirer on a
// consumer checkout is poor OPSEC for a high-risk merchant category (complaint-driven
// deplatforming, competitive intel) with little consumer-recognition upside. The
// conversion lift comes from the guarantee + a clear secure/PCI/SSL signal
// (research: see .claude/memory/project_payment_trust_badges.md).
//
// Accepted-card marks are intentionally NOT here — the payment form already shows them
// at the Card Number field via <CardBrandMarks> (which also highlights the detected
// card). Repeating them below would be redundant clutter.
//
// All marks are inline SVG (no image imports — Parcel yields {} for .png imports at
// runtime; inline SVG is crisp, themeable, and self-contained).

const LockIcon = ({ size = 15, color = '#0d5d2f' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="4.5" y="10.5" width="15" height="9.5" rx="2" fill={color} />
    <path d="M7.5 10.5V8a4.5 4.5 0 0 1 9 0v2.5" stroke={color} strokeWidth="2" fill="none" />
    <circle cx="12" cy="15" r="1.6" fill="#fff" />
  </svg>
);

const ShieldCheck = ({ size = 15, color = '#0d5d2f' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M12 2.5 20 5.5v6c0 5-3.4 8.3-8 10-4.6-1.7-8-5-8-10v-6L12 2.5Z" fill={color} />
    <path d="m8.3 12 2.5 2.5 4.9-5" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const SealCheck = ({ size = 15, color = '#0d5d2f' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="3" y="10" width="18" height="11" rx="2" fill={color} />
    <path d="M7 10V7a5 5 0 0 1 10 0v3" stroke={color} strokeWidth="2" fill="none" />
    <path d="m9.3 15.4 1.7 1.7 3.3-3.4" stroke="#fff" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// Rosette / guarantee seal.
const GuaranteeSeal = ({ size = 34 }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#0d5d2f" d="M24 3l4.6 3.1 5.5-.6 2.6 4.9 4.9 2.6-.6 5.5L44 24l-3.1 4.6.6 5.5-4.9 2.6-2.6 4.9-5.5-.6L24 45l-4.6-3.1-5.5.6-2.6-4.9L6.4 35l.6-5.5L4 24l3.1-4.6-.6-5.5 4.9-2.6 2.6-4.9 5.5.6L24 3Z" />
    <circle cx="24" cy="24" r="14" fill="#0f7a3d" />
    <path d="m17.5 24 4.3 4.3 9-9.3" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const S = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 11, background: '#fff', borderRadius: 10, padding: '14px 16px', marginBottom: 16 },
  guaranteeRow: { display: 'flex', alignItems: 'center', gap: 10 },
  guaranteeText: { display: 'flex', flexDirection: 'column', lineHeight: 1.25 },
  guaranteeTitle: { fontSize: 13, fontWeight: 700, color: '#0d5d2f' },
  guaranteeSub: { fontSize: 11.5, color: '#6b7280' },
  divider: { height: 1, background: '#f0f1f3', margin: '2px 0' },
  secureRow: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: '6px 16px' },
  secureItem: { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: '#374151' },
};

/**
 * Payment credibility badges. Highest-leverage first:
 *   1. Guarantee (cancel-anytime) — strongest trust signal per research
 *   2. Secure / PCI / SSL markers
 * (Accepted-card marks live at the Card Number field, not here.)
 */
export default function PaymentTrustBadges() {
  return (
    <div style={S.wrap}>
      <div style={S.guaranteeRow}>
        <GuaranteeSeal />
        <span style={S.guaranteeText}>
          <span style={S.guaranteeTitle}>100% Hassle-Free Cancellation</span>
          <span style={S.guaranteeSub}>Cancel anytime — no lock-in, no cancellation fees.</span>
        </span>
      </div>

      <div style={S.divider} />

      <div style={S.secureRow}>
        <span style={S.secureItem}><LockIcon /> Secure Checkout</span>
        <span style={S.secureItem}><ShieldCheck /> PCI DSS Compliant</span>
        <span style={S.secureItem}><SealCheck /> 256-bit SSL Encrypted</span>
      </div>
    </div>
  );
}
