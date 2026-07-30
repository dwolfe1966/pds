// HomeFacts area-profile helpers — a place-centric ("neighborhood report") view built on the SAME
// public-domain data engine as the /people directory (ACS demographics + Wikidata + first-party sex-offender
// records), re-composed around an ADDRESS/CITY instead of a person. This is the idlookup.me/homefacts surface.
//
// Discipline: only REAL, sourced data is rendered. Modules whose public source we haven't ingested yet
// (schools, crime, environmental, natural-disaster) are declared here as PENDING with their real source named
// — we show the section + the source we're wiring, never a fabricated number.

import { getCityAcs, getCityWiki } from './facts';
import CITY_FEMA from '../data/city-fema.json';
import COUNTIES from '../data/counties.json';
import CITY_SCHOOLS from '../data/city-schools.json';
import CITY_EPA from '../data/city-epa.json';

// Public schools for a city — built by scripts/fetch-schools.mjs (NCES CCD via Urban Institute).
export function getCitySchools(stateCode, citySlug) {
  return CITY_SCHOOLS[`${String(stateCode).toUpperCase()}/${citySlug}`] || null;
}
// EPA Toxics Release Inventory facilities for a city — built by scripts/fetch-epa-tri.mjs.
export function getCityEpa(stateCode, citySlug) {
  return CITY_EPA[`${String(stateCode).toUpperCase()}/${citySlug}`] || null;
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
export function hfCountyPath(stateLc, slug) { return `/homefacts/${String(stateLc).toLowerCase()}/county/${slug}`; }

// ── County grain (data/counties.json — all US counties from FEMA NRI) ────────
export function getCounties(stateLc) { return COUNTIES[String(stateLc).toLowerCase()] || []; }
export function countyFromSlug(stateLc, slug) {
  return getCounties(stateLc).find((c) => c.slug === String(slug).toLowerCase()) || null;
}
// Resolve a county by its plain NAME (e.g. "Travis County" or "Travis") → the county record, for city→county
// cross-links. Matches the same slug rule used to build counties.json.
export function countyForName(stateLc, countyName) {
  if (!countyName) return null;
  const slug = String(countyName).toLowerCase().replace(/\bcounty\b|\bparish\b|\bborough\b|\bcensus area\b/g, '').trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return countyFromSlug(stateLc, slug);
}

export function getCountyByFips(fips) {
  const f = String(fips);
  for (const st of Object.keys(COUNTIES)) { const hit = COUNTIES[st].find((c) => c.fips === f); if (hit) return { ...hit, stateLc: st }; }
  return null;
}

// Shared ACS-row → stat-object shaper for county + ZCTA (both use the same variable set).
const ACS_VARS = ['B01003_001E', 'B01002_001E', 'B19013_001E', 'B19301_001E', 'B25077_001E', 'B25064_001E', 'B25003_001E', 'B25003_002E'];
function shapeAcsRow(header, row) {
  const g = (code) => { const n = Number(row[header.indexOf(code)]); return Number.isFinite(n) && n > -1e6 ? n : null; };
  const ownTot = g('B25003_001E'), ownOcc = g('B25003_002E');
  return {
    population: g('B01003_001E'), medianAge: g('B01002_001E'),
    medianHouseholdIncome: g('B19013_001E'), perCapitaIncome: g('B19301_001E'),
    medianHomeValue: g('B25077_001E'), medianGrossRent: g('B25064_001E'),
    pctOwnerOccupied: ownTot && ownOcc != null ? Math.round((ownOcc / ownTot) * 100) : null,
  };
}
async function fetchAcs(geoClause, year) {
  const key = process.env.CENSUS_API_KEY;
  if (!key) return null;
  const url = `https://api.census.gov/data/${year}/acs/acs5?get=${ACS_VARS.join(',')}&${geoClause}&key=${key}`;
  try {
    // next.revalidate keeps the page ISR-cached (fetch result cached with the page) instead of flipping the
    // route to dynamic — no live Census call per request.
    const r = await fetch(url, { signal: AbortSignal.timeout(6000), next: { revalidate: 5184000 } });
    if (!r.ok) return null;
    const rows = await r.json();
    return rows && rows[1] ? shapeAcsRow(rows[0], rows[1]) : null;
  } catch { return null; }
}

// ACS for a ZIP (ZCTA) — FETCH-AT-GENERATION, key-gated. Real ZIP-level demographics/property.
export async function getZctaAcs(zip, year = 2023) {
  if (!/^\d{5}$/.test(String(zip))) return null;
  return fetchAcs(`for=zip%20code%20tabulation%20area:${zip}`, year);
}

// ACS demographics/property for a county — FETCH-AT-GENERATION (ISR caches the result), gated on CENSUS_API_KEY.
// Returns an ACS-shaped object (subset) so demographicStats()/propertyStats() render whatever is present, or
// null (no key / fetch fails) so the page degrades gracefully. fips = 5-digit STCOFIPS.
export async function getCountyAcs(fips, year = 2023) {
  if (!/^\d{5}$/.test(String(fips))) return null;
  const st = String(fips).slice(0, 2), co = String(fips).slice(2);
  return fetchAcs(`for=county:${co}&in=state:${st}`, year);
}

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
  { id: 'environment',  label: 'Environmental hazards', status: 'live' },
  { id: 'disasters',    label: 'Natural disasters',     status: 'live' },
  { id: 'neighborhood', label: 'Neighborhood info',     status: 'live' },
  { id: 'offenders',    label: 'Sex offenders',         status: 'live' },
];

// Meta helpers for the profile page.
export function hasAreaData(stateCode, slug) { return !!getCityAcs(stateCode, slug); }
export { getCityAcs, getCityWiki };
