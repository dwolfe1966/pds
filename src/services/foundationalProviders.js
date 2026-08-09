// Foundational (wholesale) data providers — the credit bureaus + the high-stakes specialty files that set
// your insurance rate and gate your loan / apartment / job / bank account. Unlike the retail broker catalog
// (one opt-out URL each), these have MULTIPLE distinct, regulated levers grouped into two honest jobs:
//   'lock'  — Lock & correct your high-stakes file (security freeze + FCRA dispute). Durable, high-impact.
//   'reduce'— Reduce marketing/investigative exposure (privacy-portal opt-outs). Best-effort, re-aggregates.
// Verified levers + gating: docs/product/foundational-data-providers.md. Copy states DEGREE honestly — freeze
// / correct / suppress, never "erase." Each action has a stable `id` → tracked as `${provider.key}:${id}`
// in the Exposure Graph (surfaceType 'foundational'), self-reported (we can't verify a freeze on their site).
//   badge  = a callout (e.g. Recommended)
//   gate   = an eligibility/scope caveat shown inline
//   recheck= a re-verification cadence (e.g. prescreen expiry)
export const FOUNDATIONAL = [
  {
    key: 'transunion', name: 'TransUnion', tag: 'Credit bureau',
    blurb: 'A credit bureau — and a wholesale source feeding lenders, landlords, employers, and investigators.',
    jobs: [
      {
        id: 'lock', title: 'Lock & correct your file', tone: 'strong',
        lead: 'The high-impact, durable moves. Do these first.',
        actions: [
          { id: 'freeze', label: 'Freeze your credit', url: 'https://www.transunion.com/credit-freeze', effect: 'Free & reversible. Blocks new creditors from pulling your file — the strongest guard against new-account fraud.', badge: 'Recommended' },
          { id: 'prescreen', label: 'Stop prescreened credit/insurance offers', url: 'https://www.optoutprescreen.com', effect: 'One request covers all four bureaus.', recheck: 'The online opt-out expires after 5 years — we’ll remind you to renew (or mail the form for permanent).' },
          { id: 'screening', label: 'See & dispute rental / employment screening', url: 'https://www.transunion.com/client-support/rental-screening-disputes', effect: 'Fix inaccurate records used to decide your housing or job.' },
        ],
      },
      {
        id: 'reduce', title: 'Reduce marketing & investigative exposure', tone: 'soft',
        lead: 'Best-effort — this data re-aggregates from many sources over time.',
        actions: [
          { id: 'dns', label: 'Do-Not-Sell & privacy request', url: 'https://www.transunion.com/consumer-privacy', effect: 'Opt out of sale/share and suppress the investigative (TLOxp) and marketing-identity (TruAudience) data — the arms that actually fuel data-broker exposure.', gate: 'Strength depends on your state; suppressed data can re-appear as it’s re-sourced.' },
        ],
      },
    ],
  },
  {
    key: 'equifax', name: 'Equifax', tag: 'Credit bureau',
    blurb: 'The second of the three bureaus — a freeze at only one or two of them still leaves you exposed.',
    jobs: [
      {
        id: 'lock', title: 'Lock & correct your file', tone: 'strong',
        lead: 'The high-impact, durable moves. Do these first.',
        actions: [
          { id: 'freeze', label: 'Freeze your credit', url: 'https://www.equifax.com/personal/credit-report-services/credit-freeze/', effect: 'Free & reversible. Part of the same freeze — you need all three bureaus for it to work.', badge: 'Recommended' },
          { id: 'dispute', label: 'See & dispute your credit report', url: 'https://www.equifax.com/personal/credit-report-services/credit-dispute/', effect: 'Correct inaccurate accounts or inquiries dragging down your file.' },
        ],
      },
      {
        id: 'reduce', title: 'Reduce marketing & data-sale exposure', tone: 'soft',
        lead: 'Best-effort — regulated data itself can’t be deleted.',
        actions: [
          { id: 'dns', label: 'Do-Not-Sell & privacy request', url: 'https://my.equifax.com/consumer-registration/UCSC/#/personal-info-request', effect: 'Opt out of the sale/share of your personal information.', gate: 'Scope depends on your state; FCRA credit data is exempt from deletion.' },
        ],
      },
    ],
  },
  {
    key: 'experian', name: 'Experian', tag: 'Credit bureau',
    blurb: 'The third bureau — and a major marketing-data broker in its own right (Experian Marketing Services).',
    jobs: [
      {
        id: 'lock', title: 'Lock & correct your file', tone: 'strong',
        lead: 'The high-impact, durable moves. Do these first.',
        actions: [
          { id: 'freeze', label: 'Freeze your credit', url: 'https://www.experian.com/freeze/center.html', effect: 'Free & reversible. The third of the three freezes — complete the set here.', badge: 'Recommended' },
          { id: 'dispute', label: 'See & dispute your credit report', url: 'https://www.experian.com/disputes/main.html', effect: 'Correct inaccurate accounts or inquiries on your file.' },
        ],
      },
      {
        id: 'reduce', title: 'Reduce marketing & data-sale exposure', tone: 'soft',
        lead: 'Best-effort — Experian re-collects marketing data over time.',
        actions: [
          { id: 'marketing', label: 'Opt out of Experian marketing data', url: 'https://www.experian.com/privacy/opting_out', effect: 'Removes you from Experian’s marketing lists and audience data.', gate: 'Marketing only; your credit file is unaffected.' },
        ],
      },
    ],
  },
  {
    key: 'lexisnexis', name: 'LexisNexis', tag: 'Risk data',
    blurb: 'The data behind your insurance rate, background checks, and lending decisions — not a people-search site.',
    jobs: [
      {
        id: 'lock', title: 'Lock & correct your file', tone: 'strong',
        lead: 'The high-impact, durable moves. Do these first.',
        actions: [
          { id: 'freeze', label: 'Freeze your LexisNexis report', url: 'https://consumer.risk.lexisnexis.com/freeze', effect: 'Free. Blocks release of your LexisNexis Consumer Disclosure & SageStream reports for new inquiries.', badge: 'Recommended' },
          { id: 'clue', label: 'See & dispute your insurance claims (C.L.U.E.)', url: 'https://consumer.risk.lexisnexis.com/request', effect: 'Free annual disclosure. Dispute any inaccurate claim — errors here quietly raise your premiums.' },
        ],
      },
      {
        id: 'reduce', title: 'Reduce marketing & data-sale exposure', tone: 'soft',
        lead: 'Best-effort — LexisNexis can re-collect public records over time.',
        actions: [
          { id: 'dns', label: 'Do-Not-Sell & delete request', url: 'https://consumer.risk.lexisnexis.com/privacy', effect: 'Opt out of sale/share and delete non-exempt data.', gate: 'Available only in the 20 state-privacy states; FCRA / DMV / financial data is exempt from deletion.' },
          { id: 'marketing', label: 'Opt out of marketing & prescreen offers', url: 'https://consumer.risk.lexisnexis.com/opt', effect: 'Stops marketing lists + firm-offer prescreening. Open to anyone.', gate: 'The public-records “Information Suppression” option here is limited to public officials, people facing physical harm, and identity-theft victims.' },
        ],
      },
    ],
  },
  {
    key: 'the_work_number', name: 'The Work Number (Equifax)', tag: 'Employment & income',
    blurb: 'Sells your salary and employment history to lenders, landlords, and background checkers — often without you knowing.',
    jobs: [
      {
        id: 'lock', title: 'Lock & correct your file', tone: 'strong',
        lead: 'A data freeze here is one of the highest-impact, least-known moves.',
        actions: [
          { id: 'freeze', label: 'Freeze your employment data', url: 'https://employees.theworknumber.com/employee-data-freeze', effect: 'Blocks release of your income & employment records unless you unlock it — few people know this exists.', badge: 'Recommended' },
          { id: 'disclosure', label: 'See your employment data report', url: 'https://employees.theworknumber.com/', effect: 'Free FCRA disclosure — check what employers have reported about you.' },
        ],
      },
    ],
  },
  {
    key: 'chexsystems', name: 'ChexSystems', tag: 'Banking',
    blurb: 'The bureau banks check before opening an account — a bad or erroneous record here can get you denied.',
    jobs: [
      {
        id: 'lock', title: 'Lock & correct your file', tone: 'strong',
        lead: 'Freeze it and check it before your next bank application.',
        actions: [
          { id: 'freeze', label: 'Freeze your ChexSystems report', url: 'https://www.chexsystems.com/security-freeze/place-freeze', effect: 'Free. Blocks banks from pulling your ChexSystems file for new accounts.', badge: 'Recommended' },
          { id: 'disclosure', label: 'See & dispute your ChexSystems report', url: 'https://www.chexsystems.com/request-reports/consumer-disclosure', effect: 'Free annual disclosure — dispute errors that could get a bank account denied.' },
        ],
      },
    ],
  },
];

// A count of every trackable lever across the tier (for the progress header).
export const FOUNDATIONAL_ACTION_COUNT = FOUNDATIONAL.reduce((n, p) => n + p.jobs.reduce((m, j) => m + j.actions.length, 0), 0);

// The correctness note that must lead the credit-bureau section — a partial freeze is a false sense of safety.
export const FOUNDATIONAL_FREEZE_NOTE =
  'A credit freeze only protects you if you do all three bureaus — TransUnion, Equifax, and Experian. Freezing one leaves the other two open.';

// The one thing that must always accompany this tier — what these levers can NOT do.
export const FOUNDATIONAL_CAVEAT =
  'These are regulated sources: you can freeze access, dispute errors, and opt out of marketing — but accurate credit, insurance, criminal, and eviction records can’t be deleted. That’s the honest limit, and it’s the same for everyone.';
