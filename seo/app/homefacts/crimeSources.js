// Registry of city open-data crime datasets (Socrata), keyed "statelc/city-slug". Each city publishes
// incident-level crime with lat/lng on its own portal with its own schema — so this maps the few big metros
// that expose coordinates to their {domain, dataset, field names}. Verified live 2026-07-30. Extensible: add a
// city by verifying its dataset has lat/lng + a date + an offense-type field. (Austin omitted — its public
// dataset has no coordinates.)
export const CRIME_SOURCES = {
  'il/chicago':       { domain: 'data.cityofchicago.org', dataset: 'ijzp-q8t2', lat: 'latitude', lng: 'longitude', date: 'date',        type: 'primary_type',       label: 'Chicago Police Department' },
  'ca/los-angeles':   { domain: 'data.lacity.org',        dataset: '2nrs-mtv8', lat: 'lat',      lng: 'lon',       date: 'date_occ',    type: 'crm_cd_desc',        label: 'LAPD' },
  'ny/new-york':      { domain: 'data.cityofnewyork.us',  dataset: '5uac-w243', lat: 'latitude', lng: 'longitude', date: 'cmplnt_fr_dt', type: 'ofns_desc',         label: 'NYPD' },
  'ca/san-francisco': { domain: 'data.sfgov.org',         dataset: 'wg3w-h783', lat: 'latitude', lng: 'longitude', date: 'incident_date', type: 'incident_category', label: 'San Francisco Police Department' },
};

export function crimeSourceFor(stateLc, citySlug) {
  return CRIME_SOURCES[`${String(stateLc).toLowerCase()}/${String(citySlug).toLowerCase()}`] || null;
}
