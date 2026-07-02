// Data access for the SEO surface. THE BC seam: getPerson() is what Phase 0
// pages call; today it reads fixtures, and swaps to the live BC lookup when
// SEO ASK 0 lands (docs/seo/bc-coverage-probe.md — dev captcha fix / sample
// payloads). Keep the return shape stable: it mirrors the consumer app's
// teaser-adapter output plus report-tier fields.
//
// ISR economics (plan §1): pages set `revalidate = REVALIDATE_SECONDS`, so once
// live, BC sees ≈ one lookup per page per window — crawler traffic never fans
// out to per-hit API calls.

import { PEOPLE } from './fixtures';
import { isPublicId } from './ids';

export const REVALIDATE_SECONDS = 60 * 60 * 24 * 60; // 60 days — people data is slow-changing

export async function getPerson(publicId) {
  if (!isPublicId(publicId)) return null;
  // TODO(BC): replace with the BC on-demand lookup (ourId → extId → teaser/report
  // fetch) once ASK 0 unblocks. Fixtures keep Phase 0 verifiable end-to-end.
  return PEOPLE[publicId] || null;
}
