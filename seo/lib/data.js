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
import { getTaxonomyUrls } from './directory.js';
import { isPublicId, nameSlug, citySlug } from './ids';
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

// Site-relative URLs for the sitemap: the state → city → name taxonomy (memoized)
// plus the real-profile pages. Large (~600k+), so the sitemap route chunks this;
// memoized so the per-chunk calls don't recompute or re-query the DB each time.
let _sitemapUrls;
export async function getSitemapUrls() {
  if (_sitemapUrls) return _sitemapUrls;
  const urls = [...getTaxonomyUrls()]; // /people, state landings, city landings, name-in-city

  // Real-profile pages (other category, /profiles/*). If the DB is unreachable at
  // build time (e.g. a Neon blip, or a local build with no network to Neon), degrade
  // to the taxonomy + committed JSON rather than crashing the whole build/deploy.
  if (hasDb) {
    try {
      for (const r of await dbSitemapRows()) {
        const b = `/profiles/${r.name_slug}`;
        const s = `${b}/${r.state.toLowerCase()}`;
        urls.push(b, s, `${s}/${r.city_slug}`, `${s}/${r.city_slug}/${r.id}`);
      }
      _sitemapUrls = urls;
      return urls;
    } catch (e) {
      console.warn('[seo] sitemap: DB unreachable, falling back to JSON profiles —', e.message);
      // dbSitemapRows() throws before any push, so `urls` is still taxonomy-only here.
    }
  }
  for (const p of Object.values(PEOPLE)) {
    const b = `/profiles/${nameSlug(p.firstName, p.lastName)}`;
    const s = `${b}/${p.state.toLowerCase()}`;
    urls.push(b, s, `${s}/${citySlug(p.city)}`, `${s}/${citySlug(p.city)}/${p.id}`);
  }
  _sitemapUrls = urls;
  return urls;
}

// The /people index — available name hubs.
export async function getNameIndex() {
  if (hasDb) {
    try { return await dbNameIndex(); }
    catch (e) { console.warn('[seo] name index: DB unreachable, JSON fallback —', e.message); }
  }
  const seen = new Map();
  for (const p of Object.values(PEOPLE)) {
    const slug = nameSlug(p.firstName, p.lastName);
    if (!seen.has(slug)) seen.set(slug, { nameSlug: slug, slug, firstName: p.firstName, lastName: p.lastName, count: 0 });
    seen.get(slug).count++;
  }
  return [...seen.values()].sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName));
}
