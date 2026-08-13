import React from 'react';
import { useLocation, Navigate } from 'react-router-dom';
import VerticalIntentLanding from './VerticalIntentLanding';

// Dedicated HomeFacts partner landing — /name/landing/homefacts.
// HomeFacts is a place-and-neighborhood site whose top intent is "who is this person / who's around this
// address" (safety, offender, records). Their outbound links pass the person, so this AUTO-PRIMES on
// firstName+lastName and pays off the continuity — "you checked the place, now check the person."
//
// Params (any casing; state 2-letter assumed, full names parsed as fallback): firstName/lastName/state,
// plus optional city/age/middleName and `type` (per-placement attribution) + `shn` (BC partner token, global).
// Broad public-records payoff (surfaces criminal/offender/booking when found) so one link serves HomeFacts's
// mixed safety intents. Compliance: any offender/criminal reveal pays off POST-PAY from our licensed source
// with FCRA agreement at /payment — same as the /records/* experiences.
const HOMEFACTS_CFG = {
  variant: 'homefacts',
  idPrefix: 'hf',
  flow: 'publicRecords',
  teaser: 'publicRecords',
  partnerBrand: 'homefacts', // co-brands the results header (persisted through the funnel)
  autoPrime: true, // LIVE: auto-fires the search on arrival. The primed-confirm experience (Move 1+2) is on
                   // /name/landing/homefacts-v2 for review; flip primeToConfirm here to make it the default
                   // once the owner signs off (2026-08-13: value-prop added, pending final review).
  // Value proposition shown under the primed "view the records" heading (Move 2 — reason to push through).
  primedValueProp: 'See what public records reveal about them — criminal & offender history, current & past addresses, relatives, and phone numbers — compiled into one report.',
  headline: 'Public Records & Safety Check',
  benefits: [
    ['shield', 'Criminal & registered-offender records'],
    ['pin', 'Address history & who lives nearby'],
    ['users', 'Relatives, associates & contact info'],
  ],
  firstLabel: 'First name',
  lastLabel: 'Last name',
  firstPlaceholder: 'ex. Robert',
  lastPlaceholder: 'ex. Tapia',
  socialProof: 'Trusted by neighbors, parents, and residents to check who’s on record.',
  vpLabel: 'What you may find',
  valuePreview: [
    ['shield', 'Criminal record'],
    ['search', 'Offender registry'],
    ['pin', 'Address history'],
    ['users', 'Relatives'],
    ['scale', 'Court cases'],
    ['heart', 'Marriage & divorce'],
    ['camera', 'Photo'],
    ['calendar', 'Date of birth'],
  ],
  searchingOneHelper: 'Searching public & safety records…',
  searchingOneList: ['Criminal & offender records', 'Address & neighbor records', 'Court & vital records', 'Contact records'],
  searchingTwoList: ['Matching jurisdictions', 'Checking safety databases', 'County & state records'],
  detailsTitle: 'Records found',
  confirmTitle: 'Confirm to view the report',
  finalList: ['Criminal & offender records', 'Address history', 'Relatives & associates', 'Court & vital records'],
};

// PREVIEW/TEST config — Move 1+2 (2026-08-13): land primed visitors on the pre-filled CONFIRM step with a
// records teaser + a one-click "See <Name>'s report" CTA, instead of auto-firing the search straight into the
// CAPTCHA (which was passing only ~12–29% for lack of a human gesture). Runs on its OWN route
// (/name/landing/homefacts-v2) so it can be reviewed side-by-side with the live experience before switching.
// Distinct `variant` isolates its metrics. Everything else is identical to the live config.
const HOMEFACTS_V2_CFG = { ...HOMEFACTS_CFG, variant: 'homefacts-v2', primeToConfirm: true };

// Smart routing shared by both experiences: HomeFacts is built for PRIMED traffic (a person passed in). If the
// core name params are missing (case-insensitively — any alias), there's nothing to prime, so fall through to
// the proven general funnel (/name/landing/v3), preserving the query string (shn/tracking) and the HomeFacts
// co-brand so the downstream results still read IDLookup.AI × HomeFacts.
function HomeFactsFunnel({ cfg }) {
  const location = useLocation();
  const lc = {};
  for (const [k, v] of new URLSearchParams(location.search).entries()) { const lk = k.toLowerCase(); if (v && lc[lk] === undefined) lc[lk] = v; }
  const first = lc.firstname || lc.fn || lc.first || '';
  const last = lc.lastname || lc.ln || lc.last || '';
  if (!first.trim() || !last.trim()) {
    try { sessionStorage.setItem('idlPartnerBrand', 'homefacts'); } catch { /* ignore */ }
    return <Navigate to={`/name/landing/v3${location.search}`} replace />;
  }
  return <VerticalIntentLanding cfg={cfg} />;
}

// LIVE experience — /name/landing/homefacts (auto-fires the search on arrival; the current campaign behavior).
export default function HomeFactsLandingPage() { return <HomeFactsFunnel cfg={HOMEFACTS_CFG} />; }

// PREVIEW — /name/landing/homefacts-v2 (Move 1+2 primed-confirm; for review before switching the live one).
export function HomeFactsPreviewPage() { return <HomeFactsFunnel cfg={HOMEFACTS_V2_CFG} />; }
