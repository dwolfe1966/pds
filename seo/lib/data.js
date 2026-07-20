// Sitemap URL source for the SEO /people surface.
//
// NOTE (2026-07-20): the /profiles/* IDI-individual-profile experiment was removed (abandoned — can't use IDI
// data for display). All /profiles data access (getPerson/getPeopleByName*/getNameIndex), its DB module
// (lib/db.mjs), fixtures, data/profiles.json, and the populate scripts (fetch-profiles/sweep-profiles/seed-db)
// went with it. This file now only builds the /people state→city→name taxonomy for the sitemap routes.

import { getTaxonomyUrls } from './directory.js';

// Memoized so the per-chunk sitemap calls don't recompute.
let _sitemapUrls;
export async function getSitemapUrls() {
  if (_sitemapUrls) return _sitemapUrls;
  _sitemapUrls = [...getTaxonomyUrls()]; // /people, state landings, city landings, name-in-city
  return _sitemapUrls;
}
