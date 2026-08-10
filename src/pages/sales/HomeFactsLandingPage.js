import React from 'react';
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
  autoPrime: true,
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

const HomeFactsLandingPage = () => <VerticalIntentLanding cfg={HOMEFACTS_CFG} />;
export default HomeFactsLandingPage;
