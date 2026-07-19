import React from 'react';
import VerticalIntentLanding from './VerticalIntentLanding';

// v14 — DATING / "is this person safe, real, single?" intent. Same v3 (incarceration) flow + chrome,
// dating-verification copy. Data hook = safety-check CAPABILITY tease + the cheap marriage/divorce reveal
// (DatingTeaser). The sex-offender safety check itself runs POST-PAY only (corroborated) — never teased.
const DATING_CFG = {
  variant: 'v14',
  idPrefix: 'v14',
  flow: 'dating', // session flow → SERP + SUP + report customize for dating (safety check, relationship status)
  teaser: 'dating', // renders DatingTeaser at the details step (the conversion hook)
  headline: 'Date Safely — Verify Who They Really Are',
  benefits: [
    ['shield', 'Check safety & criminal records'],
    ['camera', 'Confirm their photo, age & identity'],
    ['heart', 'See if they’re actually single'],
  ],
  firstLabel: 'First name',
  lastLabel: 'Last name',
  firstPlaceholder: 'ex. Alex',
  lastPlaceholder: 'ex. Morgan',
  socialProof: 'Used by online daters to verify a match is safe and who they claim to be before meeting.',
  vpLabel: 'What your safety check covers',
  valuePreview: [
    ['shield', 'Sex-offender check'],
    ['scale', 'Criminal records'],
    ['heart', 'Marriage / divorce'],
    ['camera', 'Photo & identity'],
    ['calendar', 'Real age'],
    ['pin', 'Current location'],
    ['users', 'Who they live with'],
  ],
  searchingOneHelper: 'Checking safety and public records…',
  searchingOneList: ['Sex-offender registries', 'Criminal & court records', 'Marriage & divorce filings', 'Identity & location'],
  searchingTwoList: ['Matching the right person', 'Checking safety records', 'Verifying identity & location'],
  detailsTitle: 'We found records',
  confirmTitle: 'Confirm to view the safety check',
  finalList: ['Sex-offender registries', 'Criminal & court records', 'Marriage & divorce filings', 'Identity & location'],
};

const NameSearchLandingV14Page = () => <VerticalIntentLanding cfg={DATING_CFG} />;
export default NameSearchLandingV14Page;
