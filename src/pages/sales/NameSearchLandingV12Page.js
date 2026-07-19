import React from 'react';
import VerticalIntentLanding from './VerticalIntentLanding';

// v12 — DIVORCE / marriage-records intent. Same v3 (incarceration) flow + chrome, divorce copy.
const DIVORCE_CFG = {
  variant: 'v12',
  idPrefix: 'v12',
  flow: 'divorce', // session flow → SERP + SUP customize for divorce/marriage (like inmate)
  teaser: 'divorce', // renders DivorceTeaser at the details step (the conversion hook)
  headline: 'Find Divorce & Marriage Records',
  benefits: [
    ['heart', 'Verify a marriage or divorce'],
    ['scale', 'Find court case details'],
    ['search', 'Comprehensive public-records scan'],
  ],
  firstLabel: 'First name',
  lastLabel: 'Last name',
  firstPlaceholder: 'ex. John',
  lastPlaceholder: 'ex. Smith',
  socialProof: 'Used by individuals, attorneys, and researchers to locate marriage and divorce records.',
  vpLabel: 'What you may find',
  valuePreview: [
    ['seal', 'Marriage record'],
    ['file', 'Divorce filing'],
    ['scale', 'Court case #'],
    ['calendar', 'Filing date'],
    ['building', 'County / court'],
    ['users', 'Spouse name'],
    ['shield', 'Case status'],
  ],
  searchingOneHelper: 'Searching court and vital records…',
  searchingOneList: ['County courts', 'State vital records', 'Case filings', 'Marriage & divorce records'],
  searchingTwoList: ['Matching jurisdictions', 'Checking case records', 'County & state databases'],
  detailsTitle: 'Records found',
  confirmTitle: 'Confirm to view records',
  finalList: ['County courts', 'State vital records', 'Case filings', 'Marriage & divorce records'],
};

const NameSearchLandingV12Page = () => <VerticalIntentLanding cfg={DIVORCE_CFG} />;
export default NameSearchLandingV12Page;
