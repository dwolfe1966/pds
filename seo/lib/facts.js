// Content-augmentation data for the directory pages: ACS city demographics
// (data/city-acs.json) + name facts (data/name-facts.json), plus the prose
// generators that turn those facts into unique, fact-grounded copy. All
// public-domain source data; no runtime API calls (pre-cached, ISR-friendly).

import CITY_ACS from '../data/city-acs.json';
import CITY_WIKI from '../data/city-wiki.json';
import CITY_PEOPLE from '../data/city-people.json';
import CITY_POPHISTORY from '../data/city-pophistory.json';
import CITY_HISTORIC from '../data/city-historic.json';
import CITY_NEWSPAPERS from '../data/city-newspapers.json';
import NAME_FACTS from '../data/name-facts.json';

const money = (n) => (n == null ? null : '$' + Number(n).toLocaleString('en-US'));
const pctStr = (n) => (n == null ? null : `${n}%`);
const commas = (n) => (n == null ? null : Number(n).toLocaleString('en-US'));

// ── loaders ────────────────────────────────────────────────────────────────
export function getCityAcs(stateCode, citySlug) {
  return CITY_ACS[`${String(stateCode).toUpperCase()}/${citySlug}`] || null;
}
export function getCityWiki(stateCode, citySlug) {
  return CITY_WIKI[`${String(stateCode).toUpperCase()}/${citySlug}`] || null;
}
export function getCityPeople(stateCode, citySlug) {
  return CITY_PEOPLE[`${String(stateCode).toUpperCase()}/${citySlug}`] || null;
}
export function getCityHistoric(stateCode, citySlug) {
  return CITY_HISTORIC[`${String(stateCode).toUpperCase()}/${citySlug}`] || null;
}
export function getCityNewspapers(stateCode, citySlug) {
  return CITY_NEWSPAPERS[`${String(stateCode).toUpperCase()}/${citySlug}`] || null;
}
// Historical population points (Wikidata, CC0) + the current ACS population as the
// latest anchor. Returns a year-sorted [{year, pop}]; the page charts it when ≥4.
export function getPopHistory(stateCode, citySlug, acsPop) {
  const hist = CITY_POPHISTORY[`${String(stateCode).toUpperCase()}/${citySlug}`] || [];
  const pts = hist.slice();
  const CUR = 2024; // ACS 5-year (2020–2024) vintage
  if (acsPop && !pts.some((p) => p.year === CUR)) pts.push({ year: CUR, pop: acsPop });
  return pts.sort((a, b) => a.year - b.year);
}
export function getFirstNameFacts(first) { return NAME_FACTS.firsts[String(first).toLowerCase()] || null; }
export function getSurnameFacts(last) { return NAME_FACTS.lasts[String(last).toLowerCase()] || null; }

// Wikidata (CC0) fact chips for the city header: Founded · County · Elevation.
export function cityWikiChips(w) {
  if (!w) return [];
  const chips = [];
  if (w.founded) chips.push(`Founded ${w.founded}`);
  if (w.county) chips.push(w.county);
  if (w.elevationM != null) chips.push(`Elev. ${Number(w.elevationM).toLocaleString('en-US')} m`);
  return chips;
}

// ── city snapshot grid ──────────────────────────────────────────────────────
export function cityStats(a) {
  if (!a) return [];
  return [
    a.medianAge != null && { label: 'Median age', value: `${a.medianAge}` },
    a.medianHouseholdIncome != null && { label: 'Median household income', value: money(a.medianHouseholdIncome) },
    a.medianHomeValue != null && { label: 'Median home value', value: money(a.medianHomeValue) },
    a.medianGrossRent != null && { label: 'Median rent', value: `${money(a.medianGrossRent)}/mo` },
    a.pctOwnerOccupied != null && { label: 'Homeownership', value: pctStr(a.pctOwnerOccupied) },
    a.pctBachelorsPlus != null && { label: "Bachelor's or higher", value: pctStr(a.pctBachelorsPlus) },
    a.meanCommuteMinutes != null && { label: 'Avg. commute', value: `${a.meanCommuteMinutes} min` },
    a.unemploymentRate != null && { label: 'Unemployment', value: pctStr(a.unemploymentRate) },
  ].filter(Boolean);
}

// Race/ethnicity rows (only those present), for a compact bar/list.
export function cityEthnicity(a) {
  if (!a) return [];
  return [
    ['White', a.pctWhite], ['Hispanic or Latino', a.pctHispanic],
    ['Black', a.pctBlack], ['Asian', a.pctAsian],
  ].filter(([, v]) => v != null && v > 0).map(([label, value]) => ({ label, value }));
}

// ── deterministic variation (avoid identical prose footprint across pages) ───
const hash = (s) => { let h = 0; for (let i = 0; i < String(s).length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); };

function topEthnicity(a) {
  const rows = cityEthnicity(a);
  if (!rows.length) return null;
  return rows.slice().sort((x, y) => y.value - x.value)[0];
}

// ── city prose ───────────────────────────────────────────────────────────────
export function cityProse(city, stateName, a, slugKey = '', w = null) {
  if (!a) return null;
  const pop = commas(a.population);
  const v = hash(slugKey + 'c') % 3;
  const s = [];
  if (v === 0 && pop) s.push(`${city} is home to roughly ${pop} residents.`);
  else if (v === 1 && pop) s.push(`With about ${pop} residents, ${city} is one of ${stateName}'s notable places.`);
  else s.push(`${city} is a city in ${stateName}${pop ? ` with about ${pop} residents` : ''}.`);

  // Wikidata (CC0) flavor: founding, county, nickname.
  if (w) {
    const bits = [];
    if (w.founded) bits.push(`was founded in ${w.founded}`);
    if (w.county) bits.push(`sits in ${w.county}`);
    if (bits.length) s.push(`${city} ${bits.join(' and ')}${w.nickname ? `, and is nicknamed "${w.nickname}"` : ''}.`);
    else if (w.nickname) s.push(`${city} is nicknamed "${w.nickname}".`);
  }

  if (a.medianAge != null && a.medianHouseholdIncome != null)
    s.push(`The median age is ${a.medianAge} and the median household income is ${money(a.medianHouseholdIncome)}.`);
  else if (a.medianAge != null) s.push(`The median age is ${a.medianAge}.`);

  if (a.medianHomeValue != null && a.pctOwnerOccupied != null)
    s.push(`Homes carry a median value of ${money(a.medianHomeValue)}, and about ${Math.round(a.pctOwnerOccupied)}% of residents own where they live.`);

  const eth = topEthnicity(a);
  if (eth && eth.value >= 40) s.push(`${eth.label} residents make up the largest share of the population (${eth.value}%).`);

  if (a.pctBachelorsPlus != null && a.meanCommuteMinutes != null)
    s.push(`Around ${Math.round(a.pctBachelorsPlus)}% of adults hold a bachelor's degree or higher, and the typical commute runs about ${Math.round(a.meanCommuteMinutes)} minutes.`);

  return s.join(' ');
}

// ── name prose (leaf) ────────────────────────────────────────────────────────
const ord = (r) => (r ? `#${commas(r)}` : null);

export function firstNameLine(first, ff) {
  if (!ff || !ff.gender) return `${first} is a U.S. given name.`;
  const g = ff.gender === 'unisex' ? 'unisex' : `predominantly ${ff.gender}`;
  const era = ff.peakDecade ? ` that peaked in popularity in the ${ff.peakDecade}` : '';
  return `${first} is a ${g} first name${era}.`;
}

export function surnameLine(last, lf) {
  if (!lf) return `${last} is a U.S. surname.`;
  const rank = lf.rank ? `the ${ord(lf.rank)} most common surname in the United States` : 'a U.S. surname';
  const eth = [['White', lf.pctWhite], ['Hispanic or Latino', lf.pctHispanic], ['Black', lf.pctBlack], ['Asian or Pacific Islander', lf.pctApi]]
    .filter(([, v]) => v != null).sort((a, b) => b[1] - a[1])[0];
  const ethStr = eth && eth[1] >= 40 ? ` About ${eth[1]}% of people with this surname identify as ${eth[0]}.` : '';
  return `${last} is ${rank}.${ethStr}`;
}

export function nameProse({ full, first, last, city, stateName, estInCity, acs, ff, lf, slugKey = '' }) {
  const s = [];
  const est = commas(estInCity);
  const v = hash(slugKey + 'n') % 2;
  if (v === 0) s.push(`An estimated ${est} people named ${full} live in ${city}, ${stateName}.`);
  else s.push(`${city}, ${stateName} is home to an estimated ${est} people named ${full}.`);
  s.push(firstNameLine(first, ff));
  s.push(surnameLine(last, lf));
  if (acs && acs.population != null)
    s.push(`${city} itself has about ${commas(acs.population)} residents${acs.medianAge != null ? `, with a median age of ${acs.medianAge}` : ''}.`);
  return s.join(' ');
}
