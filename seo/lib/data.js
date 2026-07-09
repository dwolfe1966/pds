// Data access for the SEO surface. Profiles live in Neon Postgres (populated by
// the batch-runner, seo/scripts/sweep-profiles.mjs). When no DATABASE_URL is set,
// everything falls back to seo/data/profiles.json so local dev and the pre-DB
// Vercel build keep working. Return shape mirrors the consumer teaser-adapter.
//
// ISR economics (plan §1): pages set `revalidate = REVALIDATE_SECONDS`, so the DB
// is read ≈ once per page per window — crawler traffic never fans out to per-hit
// queries or BC calls.

import { PEOPLE as FIXTURES } from './fixtures';
import REAL from '../data/profiles.json';
import { NAME_SLICE, STATE_SLICE, getStateList, EST_IN_STATE_MIN, EST_IN_STATE_MAX } from './directory.js';
import { isPublicId, nameSlug, citySlug, statePath, stateNamePath } from './ids';
import { hasDb, dbGetPerson, dbPeopleByName, dbNameIndex, dbSitemapRows } from './db.mjs';

// JSON fallback set (used only when no DB is configured).
const PEOPLE = REAL && Object.keys(REAL).length ? REAL : FIXTURES;

export const REVALIDATE_SECONDS = 60 * 60 * 24 * 60; // 60 days — people data is slow-changing

// Raw people for a name-slug: Postgres when configured, else the local JSON map.
async function peopleForName(slug) {
  if (hasDb) return dbPeopleByName(slug);
  return Object.values(PEOPLE).filter((p) => nameSlug(p.firstName, p.lastName) === slug);
}

export async function getPerson(publicId) {
  if (!isPublicId(publicId)) return null;
  if (hasDb) return dbGetPerson(publicId);
  return PEOPLE[publicId] || null;
}

// ── Hub data seams (name → state → city) ──────────────────────────────────────
// The name×location surface is DERIVED from where a name's people actually live.
// Return null when a name has no people so the route 404s (thin-combo gate).

// All people whose "first-last" slug matches — the /people/{name} hub.
export async function getPeopleByName(slug) {
  const people = await peopleForName(slug);
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

// Site-relative URLs for the sitemap (persons + name/state/city hubs).
export async function getSitemapUrls() {
  const urls = new Set(['/people']);

  // State-first surface (lead): state landings + name-in-state, gated to the band IDI's
  // teaser can actually resolve — over the ceiling it refuses common names (thin), under
  // the floor it's "~1 in Wyoming" thin. Keeps "John Smith / WY", drops "John Smith / CA".
  for (const st of getStateList()) {
    urls.add(statePath(st.code));
    for (const slug of STATE_SLICE.topNames) {
      const nm = NAME_SLICE[slug];
      if (!nm) continue;
      const est = nm.estPeople * st.share;
      if (est < EST_IN_STATE_MIN || est > EST_IN_STATE_MAX) continue;
      urls.add(stateNamePath(st.code, slug));
    }
  }

  // Real-profile pages (other category, /profiles/*).
  if (hasDb) {
    for (const r of await dbSitemapRows()) {
      urls.add(`/profiles/${r.name_slug}`);
      urls.add(`/profiles/${r.name_slug}/${r.state.toLowerCase()}`);
      urls.add(`/profiles/${r.name_slug}/${r.state.toLowerCase()}/${r.city_slug}`);
      urls.add(`/profiles/${r.name_slug}/${r.state.toLowerCase()}/${r.city_slug}/${r.id}`);
    }
    return [...urls];
  }
  for (const p of Object.values(PEOPLE)) {
    const slug = nameSlug(p.firstName, p.lastName);
    urls.add(`/profiles/${slug}`);
    urls.add(`/profiles/${slug}/${p.state.toLowerCase()}`);
    urls.add(`/profiles/${slug}/${p.state.toLowerCase()}/${citySlug(p.city)}`);
    urls.add(`/profiles/${slug}/${p.state.toLowerCase()}/${citySlug(p.city)}/${p.id}`);
  }
  return [...urls];
}

// The /people index — available name hubs.
export async function getNameIndex() {
  if (hasDb) return dbNameIndex();
  const seen = new Map();
  for (const p of Object.values(PEOPLE)) {
    const slug = nameSlug(p.firstName, p.lastName);
    if (!seen.has(slug)) seen.set(slug, { nameSlug: slug, slug, firstName: p.firstName, lastName: p.lastName, count: 0 });
    seen.get(slug).count++;
  }
  return [...seen.values()].sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName));
}
