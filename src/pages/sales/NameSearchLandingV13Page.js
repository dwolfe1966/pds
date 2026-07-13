import React from 'react';
import VerticalIntentLanding from './VerticalIntentLanding';

// v13 — DEATH / obituary-records intent. Same v3 (incarceration) flow + chrome, death copy.
const DEATH_CFG = {
  variant: 'v13',
  idPrefix: 'v13',
  headline: 'Find Death Records & Obituaries',
  benefits: [
    ['flower', 'Confirm a passing'],
    ['file', 'Find obituary & burial details'],
    ['search', 'Comprehensive public-records scan'],
  ],
  firstLabel: 'First name',
  lastLabel: 'Last name',
  firstPlaceholder: 'ex. John',
  lastPlaceholder: 'ex. Smith',
  socialProof: 'Used by families, genealogists, and researchers to locate death records and obituaries.',
  vpLabel: 'What you may find',
  valuePreview: [
    ['file', 'Death record'],
    ['calendar', 'Date of death'],
    ['pin', 'Place of death'],
    ['flower', 'Obituary'],
    ['building', 'Burial / cemetery'],
    ['clock', 'Age at death'],
    ['users', 'Relatives'],
  ],
  searchingOneHelper: 'Searching vital and obituary records…',
  searchingOneList: ['State vital records', 'Obituaries', 'Cemetery records', 'Death indexes'],
  searchingTwoList: ['Matching records', 'Checking vital indexes', 'County & state databases'],
  detailsTitle: 'Records found',
  confirmTitle: 'Confirm to view records',
  finalList: ['State vital records', 'Obituaries', 'Cemetery records', 'Death indexes'],
};

const NameSearchLandingV13Page = () => <VerticalIntentLanding cfg={DEATH_CFG} />;
export default NameSearchLandingV13Page;
