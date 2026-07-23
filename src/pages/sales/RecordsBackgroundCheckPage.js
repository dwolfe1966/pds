import React from 'react';
import VerticalIntentLanding from './VerticalIntentLanding';

// Homefacts background-check experience — handles BOTH (b) person-primed (arrives with firstName/lastName →
// auto-primes to loader → SERP) AND (c) cold search (no params → the 4-step wizard). Pre-pay teaser leads with
// the background-check capability hook; arrest/booking records show pre-pay, full criminal reveals POST-PAY.
const BACKGROUND_CFG = {
  variant: 'records-bg',
  idPrefix: 'bg',
  flow: 'background',
  teaser: 'background',
  autoPrime: true,
  headline: 'Run a Background Check',
  benefits: [
    ['shield', 'Arrest & criminal records'],
    ['scale', 'Court & case records'],
    ['search', 'Comprehensive records scan'],
  ],
  firstLabel: 'First name',
  lastLabel: 'Last name',
  firstPlaceholder: 'ex. John',
  lastPlaceholder: 'ex. Smith',
  socialProof: 'Used by individuals and researchers to check arrest, criminal, and court records.',
  vpLabel: 'What you may find',
  valuePreview: [
    ['shield', 'Arrest records'],
    ['file', 'Criminal history'],
    ['scale', 'Court cases'],
    ['search', 'Sex-offender check'],
    ['camera', 'Identity & photo'],
    ['pin', 'Addresses'],
    ['users', 'Aliases'],
  ],
  searchingOneHelper: 'Searching arrest and criminal records…',
  searchingOneList: ['Arrest records', 'Criminal databases', 'Court filings', 'County & state records'],
  searchingTwoList: ['Matching jurisdictions', 'Checking case records', 'County & state databases'],
  detailsTitle: 'Records found',
  confirmTitle: 'Confirm to view records',
  finalList: ['Arrest records', 'Criminal databases', 'Court filings', 'County & state records'],
};

const RecordsBackgroundCheckPage = () => <VerticalIntentLanding cfg={BACKGROUND_CFG} />;
export default RecordsBackgroundCheckPage;
