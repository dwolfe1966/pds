import React from 'react';
import VerticalIntentLanding from './VerticalIntentLanding';

// Homefacts sex-offender experience (a) — person-primed. Arrives from an offender-detail page with
// firstName/lastName/city/state → auto-primes to the loader → SERP (pays off "see this person's record").
// Pre-pay teaser = the compliance-safe SO FLAG (possible-match, framed to verify); corroborated criminal/
// offender records reveal POST-PAY from our licensed source. FCRA agreement is enforced at /payment.
const SEX_OFFENDER_CFG = {
  variant: 'records-so',
  idPrefix: 'so',
  flow: 'sexOffender',
  teaser: 'sexOffender',
  autoPrime: true,
  headline: 'Criminal & Offender Records',
  benefits: [
    ['shield', 'See the full criminal record'],
    ['search', 'Registered-offender status & details'],
    ['pin', 'Check offenders near an address'],
  ],
  firstLabel: 'First name',
  lastLabel: 'Last name',
  firstPlaceholder: 'ex. Robert',
  lastPlaceholder: 'ex. Tapia',
  socialProof: 'Used by parents, residents, and researchers to check criminal and registered-offender records.',
  vpLabel: 'What you may find',
  valuePreview: [
    ['shield', 'Criminal record'],
    ['file', 'Offenses & charges'],
    ['pin', 'Registered address'],
    ['users', 'Aliases'],
    ['scale', 'Court cases'],
    ['camera', 'Photo'],
    ['calendar', 'Date of birth'],
  ],
  searchingOneHelper: 'Searching criminal and offender records…',
  searchingOneList: ['Criminal records', 'State offender registries', 'Court filings', 'Arrest records'],
  searchingTwoList: ['Matching jurisdictions', 'Checking criminal databases', 'County & state records'],
  detailsTitle: 'Records found',
  confirmTitle: 'Confirm to view records',
  finalList: ['Criminal records', 'Offender registry', 'Court filings', 'Arrest records'],
};

const RecordsSexOffenderPage = () => <VerticalIntentLanding cfg={SEX_OFFENDER_CFG} />;
export default RecordsSexOffenderPage;
