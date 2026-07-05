// Build-time helpers for turning BC teaser identities into SEO profiles.
// mintPublicId: deterministic BC extId → our public id (p + 10 digits, matches
// PUBLIC_ID_RE). Deterministic so the same person keeps the same URL across
// re-fetches, and relatives cross-link by minting the relative's extId the same way.
import { createHash } from 'node:crypto';

export function mintPublicId(extId) {
  const h = createHash('sha1').update(String(extId || '')).digest();
  // First 5 bytes → a number, mod 1e10, zero-padded to 10 digits.
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
