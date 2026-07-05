// Data access for the SEO surface. THE BC seam: getPerson() is what Phase 0
// pages call; today it reads fixtures, and swaps to the live BC lookup when
// SEO ASK 0 lands (docs/seo/bc-coverage-probe.md — dev captcha fix / sample
// payloads). Keep the return shape stable: it mirrors the consumer app's
// teaser-adapter output plus report-tier fields.
//
// ISR economics (plan §1): pages set `revalidate = REVALIDATE_SECONDS`, so once
// live, BC sees ≈ one lookup per page per window — crawler traffic never fans
// out to per-hit API calls.

import { PEOPLE as FIXTURES } from './fixtures';
import REAL from '../data/profiles.json';
import { isPublicId, nameSlug, citySlug } from './ids';

// Serve REAL BC-teaser profiles (seo/scripts/fetch-profiles.mjs → data/profiles.json)
// when present; fall back to fixtures for local dev / before the first fetch.
const PEOPLE = REAL && Object.keys(REAL).length ? REAL : FIXTURES;

export const REVALIDATE_SECONDS = 60 * 60 * 24 * 60; // 60 days — people data is slow-changing

export async function getPerson(publicId) {
  if (!isPublicId(publicId)) return null;
  // TODO(BC): replace with the BC on-demand lookup (ourId → extId → teaser/report
  // fetch) once ASK 0 unblocks. Fixtures keep Phase 0 verifiable end-to-end.
  return PEOPLE[publicId] || null;
}

// ── Hub data seams (name → state → city) ──────────────────────────────────────
// Aggregate views over the person set, backed by fixtures today. TODO(BC): the
// name hub maps to BC/IDI `searchTeaser(first,last)` (returns real people +
// locations); state/city are filters on the name's returned set. The name×
// location surface is thus DERIVED from where a name's people actually live
// (Layer-1 skeleton in seo/data/ ranks WHICH names to query, highest demand first).
// Return null when a name has no people so the route 404s (thin-combo gate).

function allPeople() {
  return Object.values(PEOPLE);
}

// All people whose "first-last" slug matches — the /people/{name} hub.
export async function getPeopleByName(slug) {
  const people = allPeople().filter((p) => nameSlug(p.firstName, p.lastName) === slug);
  if (!people.length) return null;
  const byState = new Map();
  for (const p of people) {
    const key = p.state.toUpperCase();
    if (!byState.has(key)) byState.set(key, new Set());
    byState.get(key).add(p.city);
  }
  const states = [...byState.entries()]
    .map(([state, cities]) => ({ state, cities: [...cities].sort(), count: people.filter((p) => p.state.toUpperCase() === state).length }))
    .sort((a, b) => b.count - a.count || a.state.localeCompare(b.state));
  return {
    slug,
    firstName: people[0].firstName,
    lastName: people[0].lastName,
    total: people.length,
    states,
    people: people.sort((a, b) => (b.age || 0) - (a.age || 0)),
  };
}

// The name's people in one state — /people/{name}/{state}.
export async function getPeopleByNameState(slug, state) {
  const st = String(state).toUpperCase();
  const hub = await getPeopleByName(slug);
  if (!hub) return null;
  const people = hub.people.filter((p) => p.state.toUpperCase() === st);
  if (!people.length) return null;
  const cities = [...new Set(people.map((p) => p.city))].sort()
    .map((city) => ({ city, count: people.filter((p) => p.city === city).length }));
  return { ...hub, state: st, cities, people };
}

// The name's people in one city — /people/{name}/{state}/{city}.
export async function getPeopleByNameCity(slug, state, city) {
  const stateHub = await getPeopleByNameState(slug, state);
  if (!stateHub) return null;
  const people = stateHub.people.filter((p) => citySlug(p.city) === city);
  if (!people.length) return null;
  return { ...stateHub, cityName: people[0].city, people };
}

// Site-relative URLs for the sitemap (persons + name/state/city hubs). Fixture-
// backed for Phase 0. TODO(BC): at scale this becomes a chunked sitemap index
// streamed from the Layer-1 skeleton × the names BC actually returns people for
// (thin combos excluded — they 404 and never enter the sitemap).
export async function getSitemapUrls() {
  const urls = new Set(['/people']);
  const bySlug = new Map();
  for (const p of allPeople()) {
    const slug = nameSlug(p.firstName, p.lastName);
    urls.add(`/people/${slug}`);
    urls.add(`/people/${slug}/${p.state.toLowerCase()}`);
    urls.add(`/people/${slug}/${p.state.toLowerCase()}/${citySlug(p.city)}`);
    urls.add(`/people/${slug}/${p.state.toLowerCase()}/${citySlug(p.city)}/${p.id}`);
    bySlug.set(slug, true);
  }
  return [...urls];
}

// The /people index — available name hubs. TODO(BC): back with the top-N of the
// Layer-1 ranked skeleton (seo/data/name-pairs.ndjson). Fixtures list distinct names.
export async function getNameIndex() {
  const seen = new Map();
  for (const p of allPeople()) {
    const slug = nameSlug(p.firstName, p.lastName);
    if (!seen.has(slug)) seen.set(slug, { slug, firstName: p.firstName, lastName: p.lastName, count: 0 });
    seen.get(slug).count++;
  }
  return [...seen.values()].sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName));
}
