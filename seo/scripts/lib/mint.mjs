// Build-time helpers for turning BC teaser identities into SEO profiles.
// mintPublicId: deterministic BC extId → our public id (p + 10 digits, matches
// PUBLIC_ID_RE). Deterministic so the same person keeps the same URL across
// re-fetches, and relatives cross-link by minting the relative's extId the same way.
import { createHash } from 'node:crypto';

// Mint a STABLE public id from natural attributes — NOT the BC obf1 extId, which
// is re-encrypted on every teaser call (verified: two back-to-back searches for
// the same person return different extIds). `parts` = e.g. [first,last,city,state,
// firstSeenYear]. Deterministic → URLs persist across re-fetches, and the SUP can
// re-find the person by the same attributes.
export function mintPublicId(parts) {
  const key = (Array.isArray(parts) ? parts : [parts])
    .map((p) => String(p == null ? '' : p).toLowerCase().trim())
    .join('|');
  const h = createHash('sha1').update(key).digest();
  const n = h.readUIntBE(0, 5) % 10_000_000_000;
  return 'p' + String(n).padStart(10, '0');
}

// BC returns UPPERCASE names; title-case for display ("DAVID WEXLER" → "David Wexler",
// "MCDONALD" → "McDonald" is out of scope — simple word-cap is fine for v0).
export function titleCase(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/\b([a-z])/g, (_, c) => c.toUpperCase())
    .replace(/\bMc([a-z])/g, (_, c) => 'Mc' + c.toUpperCase())
    .trim();
}

export function toInt(v) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : 0;
}
