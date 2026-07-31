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
import CITY_ORI from '../data/city-ori.json';
import STATE_SLICE from '../data/state-slice.json';
import COUNTY_ACS from '../data/county-acs.json';
import CITY_CRIME from '../data/city-crime.json';
import CITY_SCHOOLS from '../data/city-schools.json';
import CITY_SCHOOL_RATINGS from '../data/city-school-ratings.json';
import CITY_EPA from '../data/city-epa.json';

// Public schools for a city — built by scripts/fetch-schools.mjs (NCES CCD via Urban Institute).
export function getCitySchools(stateCode, citySlug) {
  return CITY_SCHOOLS[`${String(stateCode).toUpperCase()}/${citySlug}`] || null;
}
// City school proficiency rating (grade-8 % at/above proficient, reading & math) — scripts/fetch-school-ratings.mjs.
export function getCitySchoolRating(stateCode, citySlug) {
  return CITY_SCHOOL_RATINGS[`${String(stateCode).toUpperCase()}/${citySlug}`] || null;
}
// Overall proficiency band (avg of reading + math) → { label, color, score }.
export function schoolRatingBand(r) {
  if (!r) return null;
  const parts = [r.readPct, r.mathPct].filter((n) => n != null);
  if (!parts.length) return null;
  const score = Math.round(parts.reduce((a, b) => a + b, 0) / parts.length);
  const band = score >= 70 ? { label: 'Above average', color: '#2e7d52' }
    : score >= 55 ? { label: 'Average', color: '#6ba368' }
      : score >= 40 ? { label: 'Mixed', color: '#c69a2e' }
        : { label: 'Below average', color: '#d07d2e' };
  return { ...band, score };
}
// EPA Toxics Release Inventory facilities for a city — built by scripts/fetch-epa-tri.mjs.
export function getCityEpa(stateCode, citySlug) {
  return CITY_EPA[`${String(stateCode).toUpperCase()}/${citySlug}`] || null;
}
// City → primary police-agency ORI (data/city-ori.json, from scripts/fetch-city-ori.mjs).
export function getCityOri(stateCode, citySlug) {
  return CITY_ORI[`${String(stateCode).toUpperCase()}/${citySlug}`] || null;
}

// Crime rates for a city's police agency vs its state + the U.S. — FETCH-AT-GENERATION (ISR-cached),
// gated on FBI_CDE_KEY. Source: FBI UCR/NIBRS via the CDE "summarized/agency" endpoint, which returns the
// agency + state + national series in one call. Rates are monthly per-100k; we annualize (avg×12) for the
// latest full year. Returns { year, agency, violent:{place,state,us}, property:{...} } or null.
async function fetchCrimeSeries(ori, offense) {
  const key = process.env.FBI_CDE_KEY;
  if (!key) return null;
  const url = `https://api.usa.gov/crime/fbi/sapi/summarized/agency/${ori}/${offense}?from=01-2022&to=12-2023&api_key=${key}`;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(7000), next: { revalidate: 5184000 } });
    if (!r.ok) return null;
    const d = await r.json();
    return (d.offenses && d.offenses.rates) || null;
  } catch { return null; }
}
function annualize(series) {
  if (!series) return null;
  const years = [...new Set(Object.keys(series).map((k) => k.split('-')[1]))].sort();
  const yr = years[years.length - 1];
  const vals = Object.entries(series).filter(([k, v]) => k.endsWith(`-${yr}`) && v != null).map(([, v]) => v);
  if (!vals.length) return null;
  return { year: yr, rate: Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 12) };
}
export async function getCityCrime(stateCode, citySlug) {
  // Pre-cached (scripts/fetch-city-crime.mjs) — no runtime FBI call, no key needed at render.
  const cached = CITY_CRIME[`${String(stateCode).toUpperCase()}/${citySlug}`];
  if (cached) return cached;
  const m = getCityOri(stateCode, citySlug);
  if (!m || !process.env.FBI_CDE_KEY) return null;
  const [vRates, pRates] = await Promise.all([fetchCrimeSeries(m.ori, 'violent-crime'), fetchCrimeSeries(m.ori, 'property-crime')]);
  if (!vRates && !pRates) return null;
  const pick = (rates, kind) => {
    if (!rates) return null;
    const agencyKey = Object.keys(rates).find((k) => k.startsWith(m.agency) && k.endsWith('Offenses'));
    const usKey = 'United States Offenses';
    const stateKey = Object.keys(rates).find((k) => k.endsWith('Offenses') && k !== usKey && k !== agencyKey);
    const a = agencyKey && annualize(rates[agencyKey]);
    return a ? { kind, year: a.year, place: a.rate, state: (stateKey && annualize(rates[stateKey])?.rate) ?? null, us: annualize(rates[usKey])?.rate ?? null } : null;
  };
  const violent = pick(vRates, 'violent');
  const property = pick(pRates, 'property');
  if (!violent && !property) return null;
  return { agency: m.agency, year: (violent || property).year, violent, property };
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
  // Pre-cached (scripts/fetch-county-acs.mjs) — no runtime Census call, no key needed at render.
  if (COUNTY_ACS[String(fips)]) return COUNTY_ACS[String(fips)];
  const st = String(fips).slice(0, 2), co = String(fips).slice(2);
  return fetchAcs(`for=county:${co}&in=state:${st}`, year); // fallback if a county is missing from the cache
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
  { id: 'crime',        label: 'Crime',                 status: 'live' },
  { id: 'environment',  label: 'Environmental hazards', status: 'live' },
  { id: 'disasters',    label: 'Natural disasters',     status: 'live' },
  { id: 'neighborhood', label: 'Neighborhood info',     status: 'live' },
  { id: 'offenders',    label: 'Sex offenders',         status: 'live' },
];

// Meta helpers for the profile page.
// Build real, data-grounded FAQs for a city area profile → visible FAQ + FAQPage JSON-LD (SEO rich snippets /
// "People Also Ask"). Only includes questions we can answer from live data — never a hollow/fabricated answer.
export function cityFaqs({ city, stateName, acs, fema, crime, schools, offenders, county }) {
  const money = (n) => (n == null ? null : '$' + Number(n).toLocaleString('en-US'));
  const commas = (n) => (n == null ? null : Number(n).toLocaleString('en-US'));
  const out = [];
  if (acs?.population != null)
    out.push({ q: `What is the population of ${city}, ${stateName}?`, a: `${city} has a population of about ${commas(acs.population)}, according to the U.S. Census Bureau's American Community Survey (5-year).` });
  if (acs?.medianHomeValue != null)
    out.push({ q: `What is the average home value in ${city}?`, a: `The median home value in ${city} is ${money(acs.medianHomeValue)}${acs.medianGrossRent != null ? `, and the median gross rent is ${money(acs.medianGrossRent)}/month` : ''} (U.S. Census ACS).` });
  if (crime && crime.violent && crime.violent.us != null) {
    const v = crime.violent; const cmp = v.place > v.us ? 'higher than' : v.place < v.us ? 'lower than' : 'about equal to';
    out.push({ q: `Is ${city} safe? What is the crime rate?`, a: `${crime.agency} reported a violent-crime rate of about ${commas(v.place)} per 100,000 residents in ${crime.year} — ${cmp} the U.S. rate of ${commas(v.us)}. Source: FBI UCR/NIBRS.` });
  }
  if (fema?.rating)
    out.push({ q: `What natural-disaster risks does ${city} face?`, a: `FEMA's National Risk Index rates ${fema.county ? `${fema.county} County` : `${city}'s county`} as "${fema.rating}" overall${fema.hazards && fema.hazards.length ? `, with top hazards including ${fema.hazards.slice(0, 3).map((h) => h.label.toLowerCase()).join(', ')}` : ''}.` });
  if (schools?.count != null)
    out.push({ q: `How many schools are in ${city}?`, a: `${city} has ${commas(schools.count)} public schools${schools.byLevel ? ` (${['Elementary', 'Middle', 'High'].map((k) => schools.byLevel[k] ? `${schools.byLevel[k]} ${k.toLowerCase()}` : null).filter(Boolean).join(', ')})` : ''}. Source: U.S. Dept. of Education, NCES.` });
  if (offenders != null)
    out.push({ q: `How many registered sex offenders are in ${city}?`, a: `Public registry data lists ${commas(offenders)} registered sex offenders in or near ${city}. This is neighborhood-safety information from the public state registry.` });
  return out;
}

// Cities we cover that sit in a given county — for the county hub's internal links. Matches each city's FEMA
// county (data/city-fema.json carries the resolved county name per city) against the target county name.
export function citiesInCounty(stateLc, countyName) {
  const target = String(countyName || '').toLowerCase().trim();
  const slice = STATE_SLICE.states[String(stateLc).toLowerCase()];
  if (!target || !slice) return [];
  const out = [];
  for (const c of slice.cities) {
    const f = CITY_FEMA[`${slice.code}/${c.slug}`];
    if (f && String(f.county || '').toLowerCase().trim() === target) out.push({ city: c.city, slug: c.slug, pop: c.pop });
  }
  return out.sort((a, b) => (b.pop || 0) - (a.pop || 0));
}

export function hasAreaData(stateCode, slug) { return !!getCityAcs(stateCode, slug); }
export { getCityAcs, getCityWiki };
