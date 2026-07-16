// OUR public-ID layer (locked decision §0.1): URLs are keyed to ids we mint
// (p + 10 digits), mapped internally to BC/IDI record ids. This file is the
// seam — Phase 0 validates format only; the real mint/store (and the BC extId
// mapping) lands with Phase 1 taxonomy work.

export const PUBLIC_ID_RE = /^p\d{10}$/;

export function isPublicId(id) {
  return PUBLIC_ID_RE.test(String(id || ''));
}

// slug helpers — lowercase, hyphenated, ascii-folded (plan §2)
export function nameSlug(firstName, lastName) {
  return `${firstName}-${lastName}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function citySlug(city) {
  return nameSlug(city, '').replace(/-$/, '');
}

// URL token for an individual (disambiguates same-name people in a city) — the age segment of the
// person_profiles key. Must match upsertPersonProfiles' ageTok. 'x' when age is unknown.
export function ageToken(age) {
  const t = age == null ? '' : String(age).replace(/[^0-9-]/g, '');
  return t || 'x';
}

// Real-profile pages live under /profiles/* (separate category from the
// state-first /people surface).
export function personPath(p) {
  return `/profiles/${nameSlug(p.firstName, p.lastName)}/${p.state.toLowerCase()}/${citySlug(p.city)}/${p.id}`;
}

export function namePath(p) {
  return `/profiles/${nameSlug(p.firstName, p.lastName)}`;
}

// Real-profile hub path builders (name → state → city).
export function nameStatePath(slug, state) {
  return `/profiles/${slug}/${String(state).toLowerCase()}`;
}

export function nameCityPath(slug, state, city) {
  return `/profiles/${slug}/${String(state).toLowerCase()}/${citySlug(city)}`;
}

// State-first path builders (the lead /people surface).
export function statePath(code) {
  return `/people/${String(code).toLowerCase()}`;
}

export function stateNamePath(code, slug) {
  return `/people/${String(code).toLowerCase()}/${slug}`;
}

// City-first taxonomy: state → city → name.
export function cityPath(code, citySlug) {
  return `/people/${String(code).toLowerCase()}/${citySlug}`;
}

export function cityNamePath(code, citySlug, nameSlug) {
  return `/people/${String(code).toLowerCase()}/${citySlug}/${nameSlug}`;
}

// Split a "first-last" name slug back into display-cased first/last words. Best-
// effort (multi-word names collapse to first token / rest) — used for hub H1s.
export function nameFromSlug(slug) {
  const parts = String(slug || '').split('-').filter(Boolean);
  if (!parts.length) return { firstName: '', lastName: '', display: '' };
  const cap = (w) => w.charAt(0).toUpperCase() + w.slice(1);
  const firstName = cap(parts[0]);
  const lastName = parts.slice(1).map(cap).join(' ');
  return { firstName, lastName, display: [firstName, lastName].filter(Boolean).join(' ') };
}
