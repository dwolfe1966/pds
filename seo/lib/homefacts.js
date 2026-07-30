// HomeFacts area-profile helpers — a place-centric ("neighborhood report") view built on the SAME
// public-domain data engine as the /people directory (ACS demographics + Wikidata + first-party sex-offender
// records), re-composed around an ADDRESS/CITY instead of a person. This is the idlookup.me/homefacts surface.
//
// Discipline: only REAL, sourced data is rendered. Modules whose public source we haven't ingested yet
// (schools, crime, environmental, natural-disaster) are declared here as PENDING with their real source named
// — we show the section + the source we're wiring, never a fabricated number.

import { getCityAcs, getCityWiki } from './facts';
import CITY_FEMA from '../data/city-fema.json';
import CITY_SCHOOLS from '../data/city-schools.json';

// Public schools for a city — built by scripts/fetch-schools.mjs (NCES CCD via Urban Institute).
export function getCitySchools(stateCode, citySlug) {
  return CITY_SCHOOLS[`${String(stateCode).toUpperCase()}/${citySlug}`] || null;
}

// FEMA National Risk Index (natural-disaster risk) for a city's county — built by scripts/fetch-fema-nri.mjs.
export function getCityFema(stateCode, citySlug) {
  return CITY_FEMA[`${String(stateCode).toUpperCase()}/${citySlug}`] || null;
}
// Color for an NRI rating band (Very Low → Very High), for the risk bars/pills.
export function femaRatingColor(rating) {
  return {
    'Very Low': '#2e7d52', 'Relatively Low': '#6ba368', 'Relatively Moderate': '#c69a2e',
    'Relatively High': '#d07d2e', 'Very High': '#b23a48',
  }[rating] || '#8a94a6';
}

const money = (n) => (n == null ? null : '$' + Number(n).toLocaleString('en-US'));
const pct = (n) => (n == null ? null : `${n}%`);
const commas = (n) => (n == null ? null : Number(n).toLocaleString('en-US'));

// URL: /homefacts/{state-lc}/{city-slug}. State segment stays a bare 2-letter code (middleware only touches
// /people & /profiles, so /homefacts passes through untouched).
export function hfCityPath(stateLc, slug) { return `/homefacts/${String(stateLc).toLowerCase()}/${slug}`; }
export function hfStatePath(stateLc) { return `/homefacts/${String(stateLc).toLowerCase()}`; }

// ── Property report (ACS place-level) ────────────────────────────────────────
export function propertyStats(a) {
  if (!a) return [];
  return [
    a.medianHomeValue != null && { label: 'Median home value', value: money(a.medianHomeValue) },
    a.medianGrossRent != null && { label: 'Median gross rent', value: `${money(a.medianGrossRent)}/mo` },
    a.pctOwnerOccupied != null && { label: 'Owner-occupied', value: pct(a.pctOwnerOccupied) },
    a.medianYearBuilt != null && { label: 'Median year built', value: `${a.medianYearBuilt}` },
    a.households != null && { label: 'Households', value: commas(a.households) },
    a.avgHouseholdSize != null && { label: 'Avg. household size', value: `${a.avgHouseholdSize}` },
  ].filter(Boolean);
}

// ── Demographics (ACS place-level) ───────────────────────────────────────────
export function demographicStats(a) {
  if (!a) return [];
  return [
    a.population != null && { label: 'Population', value: commas(a.population) },
    a.medianAge != null && { label: 'Median age', value: `${a.medianAge}` },
    a.medianHouseholdIncome != null && { label: 'Median household income', value: money(a.medianHouseholdIncome) },
    a.perCapitaIncome != null && { label: 'Per-capita income', value: money(a.perCapitaIncome) },
    a.povertyRate != null && { label: 'Poverty rate', value: pct(a.povertyRate) },
    a.pctHighSchoolPlus != null && { label: 'High-school grad or higher', value: pct(a.pctHighSchoolPlus) },
    a.pctBachelorsPlus != null && { label: "Bachelor's degree or higher", value: pct(a.pctBachelorsPlus) },
    a.unemploymentRate != null && { label: 'Unemployment', value: pct(a.unemploymentRate) },
    a.meanCommuteMinutes != null && { label: 'Avg. commute', value: `${a.meanCommuteMinutes} min` },
    a.pctWorkFromHome != null && { label: 'Work from home', value: pct(a.pctWorkFromHome) },
  ].filter(Boolean);
}

// The 9 area-profile modules, in HomeFacts' order. `status` drives whether the section renders live data or an
// honest "sourcing" note. `source` names the real public dataset each pending module will be wired to next —
// all free / public-domain, same as the ACS + NSOPW sources already live.
export const HF_MODULES = [
  { id: 'summary',      label: 'Neighborhood report',   status: 'live' },
  { id: 'demographics', label: 'Demographics',          status: 'live' },
  { id: 'property',     label: 'Property report',       status: 'live' },
  { id: 'schools',      label: 'Schools',               status: 'live' },
  { id: 'crime',        label: 'Crime',                 status: 'pending', source: 'FBI Crime Data Explorer + local agencies (public)' },
  { id: 'environment',  label: 'Environmental hazards', status: 'pending', source: 'U.S. EPA — EJScreen / ECHO (public)' },
  { id: 'disasters',    label: 'Natural disasters',     status: 'live' },
  { id: 'neighborhood', label: 'Neighborhood info',     status: 'live' },
  { id: 'offenders',    label: 'Sex offenders',         status: 'live' },
];

// Meta helpers for the profile page.
export function hasAreaData(stateCode, slug) { return !!getCityAcs(stateCode, slug); }
export { getCityAcs, getCityWiki };
