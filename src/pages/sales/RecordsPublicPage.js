import React from 'react';
import VerticalIntentLanding from './VerticalIntentLanding';

// Homefacts public-records experience (d) — cold search (general records-intent traffic). No params → the
// 4-step wizard; if a partner link ever pre-fills name it auto-primes too. Pre-pay teaser leads with the
// public-records capability hook + any pre-pay booking/marriage hits; full records reveal POST-PAY.
const PUBLIC_RECORDS_CFG = {
  variant: 'records-public',
  idPrefix: 'pr',
  flow: 'publicRecords',
  teaser: 'publicRecords',
  autoPrime: true,
  headline: 'Search Public Records',
  benefits: [
    ['pin', 'Addresses & phone numbers'],
    ['users', 'Relatives & associates'],
    ['search', 'Court, criminal & vital records'],
  ],
  firstLabel: 'First name',
  lastLabel: 'Last name',
  firstPlaceholder: 'ex. John',
  lastPlaceholder: 'ex. Smith',
  socialProof: 'Used by individuals, researchers, and reconnecting families to find public records.',
  vpLabel: 'What you may find',
  valuePreview: [
    ['pin', 'Addresses & phones'],
    ['users', 'Relatives'],
    ['shield', 'Criminal records'],
    ['scale', 'Court cases'],
    ['heart', 'Marriage & divorce'],
    ['file', 'Public filings'],
    ['building', 'County records'],
  ],
  searchingOneHelper: 'Searching public records…',
  searchingOneList: ['Address history', 'Phone & contact records', 'Court & criminal records', 'Vital records'],
  searchingTwoList: ['Matching jurisdictions', 'Checking public databases', 'County & state records'],
  detailsTitle: 'Records found',
  confirmTitle: 'Confirm to view records',
  finalList: ['Address history', 'Contact records', 'Court & criminal records', 'Vital records'],
};

const RecordsPublicPage = () => <VerticalIntentLanding cfg={PUBLIC_RECORDS_CFG} />;
export default RecordsPublicPage;
