// Foundational (wholesale) data providers — LexisNexis + TransUnion. Unlike the retail broker catalog (one
// opt-out URL each), these have MULTIPLE distinct, regulated levers grouped into two honest jobs:
//   'lock'  — Lock & correct your high-stakes file (security freeze + FCRA dispute). Durable, high-impact.
//   'reduce'— Reduce marketing/investigative exposure (privacy-portal opt-outs). Best-effort, re-aggregates.
// Verified levers + gating: docs/product/foundational-data-providers.md. Copy states DEGREE honestly — freeze
// / correct / suppress, never "erase." `gate` = an eligibility/scope caveat shown inline; `recheck` = a
// re-verification cadence (e.g. prescreen expiry).
export const FOUNDATIONAL = [
  {
    key: 'lexisnexis',
    name: 'LexisNexis',
    blurb: 'The data behind your insurance rate, background checks, and lending decisions — not a people-search site.',
    jobs: [
      {
        id: 'lock', title: 'Lock & correct your file', tone: 'strong',
        lead: 'The high-impact, durable moves. Do these first.',
        actions: [
          { label: 'Freeze your LexisNexis report', url: 'https://consumer.risk.lexisnexis.com/freeze', effect: 'Free. Blocks release of your LexisNexis Consumer Disclosure & SageStream reports for new inquiries.', badge: 'Recommended' },
          { label: 'See & dispute your insurance claims (C.L.U.E.)', url: 'https://consumer.risk.lexisnexis.com/request', effect: 'Free annual disclosure. Dispute any inaccurate claim — errors here quietly raise your premiums.' },
        ],
      },
      {
        id: 'reduce', title: 'Reduce marketing & data-sale exposure', tone: 'soft',
        lead: 'Best-effort — LexisNexis can re-collect public records over time.',
        actions: [
          { label: 'Do-Not-Sell & delete request', url: 'https://consumer.risk.lexisnexis.com/privacy', effect: 'Opt out of sale/share and delete non-exempt data.', gate: 'Available only in the 20 state-privacy states; FCRA / DMV / financial data is exempt from deletion.' },
          { label: 'Opt out of marketing & prescreen offers', url: 'https://consumer.risk.lexisnexis.com/opt', effect: 'Stops marketing lists + firm-offer prescreening. Open to anyone.', gate: 'The public-records “Information Suppression” option here is limited to public officials, people facing physical harm, and identity-theft victims.' },
        ],
      },
    ],
  },
  {
    key: 'transunion',
    name: 'TransUnion',
    blurb: 'A credit bureau — and a wholesale source feeding lenders, landlords, employers, and investigators.',
    jobs: [
      {
        id: 'lock', title: 'Lock & correct your file', tone: 'strong',
        lead: 'The high-impact, durable moves. Do these first.',
        actions: [
          { label: 'Freeze your credit', url: 'https://www.transunion.com/credit-freeze', effect: 'Free & reversible. Blocks new creditors from pulling your file — the strongest guard against new-account fraud.', badge: 'Recommended' },
          { label: 'Stop prescreened credit/insurance offers', url: 'https://www.optoutprescreen.com', effect: 'One request covers all four bureaus.', recheck: 'The online opt-out expires after 5 years — we’ll remind you to renew (or mail the form for permanent).' },
          { label: 'See & dispute rental / employment screening', url: 'https://www.transunion.com/client-support/rental-screening-disputes', effect: 'Fix inaccurate records used to decide your housing or job.' },
        ],
      },
      {
        id: 'reduce', title: 'Reduce marketing & investigative exposure', tone: 'soft',
        lead: 'Best-effort — this data re-aggregates from many sources over time.',
        actions: [
          { label: 'Do-Not-Sell & privacy request', url: 'https://www.transunion.com/consumer-privacy', effect: 'Opt out of sale/share and suppress the investigative (TLOxp) and marketing-identity (TruAudience) data — the arms that actually fuel data-broker exposure.', gate: 'Strength depends on your state; suppressed data can re-appear as it’s re-sourced.' },
        ],
      },
    ],
  },
];

// The one thing that must always accompany this tier — what these levers can NOT do.
export const FOUNDATIONAL_CAVEAT =
  'These are regulated sources: you can freeze access, dispute errors, and opt out of marketing — but accurate credit, insurance, criminal, and eviction records can’t be deleted. That’s the honest limit, and it’s the same for everyone.';
