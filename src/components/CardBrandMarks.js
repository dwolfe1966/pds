import React from 'react';

/**
 * Colored card-brand acceptance marks for the checkout page.
 *
 * Required by the card brands (flagged by our payments provider, TRX): the
 * colored Visa / Mastercard / Amex / Discover logos must be visible at checkout.
 * Implemented as inline SVG (no image assets) — Parcel resolves .png imports to
 * `{}` at runtime in this build, and inline SVG renders the colored marks crisply
 * at any size with no extra request or dependency.
 *
 * Pass `detected` (one of 'visa' | 'mastercard' | 'amex' | 'discover' | null) to
 * emphasize the matched brand and dim the rest as the user types their PAN. All
 * four stay visible regardless, so the acceptance marks are always shown.
 */

const W = 38, H = 24, VB = '0 0 48 30';

function Visa() {
  return (
    <svg viewBox={VB} width={W} height={H} role="img" aria-label="Visa">
      <rect width="48" height="30" rx="4" fill="#fff" stroke="#e5e7eb" />
      <text x="24" y="20" textAnchor="middle" fontFamily="Arial, Helvetica, sans-serif"
        fontSize="13" fontStyle="italic" fontWeight="700" fill="#1434CB" letterSpacing="0.5">VISA</text>
    </svg>
  );
}

function Mastercard() {
  return (
    <svg viewBox={VB} width={W} height={H} role="img" aria-label="Mastercard">
      <rect width="48" height="30" rx="4" fill="#fff" stroke="#e5e7eb" />
      <circle cx="20" cy="15" r="8.5" fill="#EB001B" />
      <circle cx="28" cy="15" r="8.5" fill="#F79E1B" />
      <path d="M24 8.6a8.5 8.5 0 0 0 0 12.8 8.5 8.5 0 0 0 0-12.8z" fill="#FF5F00" />
    </svg>
  );
}

function Amex() {
  return (
    <svg viewBox={VB} width={W} height={H} role="img" aria-label="American Express">
      <rect width="48" height="30" rx="4" fill="#1F72CD" />
      <text x="24" y="19" textAnchor="middle" fontFamily="Arial, Helvetica, sans-serif"
        fontSize="9" fontWeight="700" fill="#fff" letterSpacing="0.3">AMEX</text>
    </svg>
  );
}

function Discover() {
  return (
    <svg viewBox={VB} width={W} height={H} role="img" aria-label="Discover">
      <rect width="48" height="30" rx="4" fill="#fff" stroke="#e5e7eb" />
      <text x="2.5" y="19" fontFamily="Arial, Helvetica, sans-serif" fontSize="6.6"
        fontWeight="700" fill="#1a1a1a" letterSpacing="0.1">DISCOVER</text>
      <circle cx="43" cy="15" r="5.5" fill="#FF6000" />
    </svg>
  );
}

const BRANDS = [
  { key: 'visa', Mark: Visa },
  { key: 'mastercard', Mark: Mastercard },
  { key: 'amex', Mark: Amex },
  { key: 'discover', Mark: Discover },
];

export default function CardBrandMarks({ detected = null, className = '' }) {
  return (
    <span className={className} role="group" aria-label="Accepted cards" style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
      {BRANDS.map(({ key, Mark }) => {
        const dim = detected && detected !== key;
        return (
          <span
            key={key}
            style={{
              display: 'inline-flex',
              opacity: dim ? 0.32 : 1,
              filter: dim ? 'grayscale(1)' : 'none',
              transition: 'opacity 120ms ease, filter 120ms ease',
            }}
          >
            <Mark />
          </span>
        );
      })}
    </span>
  );
}
