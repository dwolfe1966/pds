import React from 'react';
import SupTeaserA, { SUP_PALETTE_GREEN } from './SupTeaserA';

// Variant C — the "closer". Same information architecture + green palette as A,
// but aggressive, conversion-focused copy plus extra sales devices (urgency
// strip, a redacted "locked report" preview, a confidentiality hook, and social
// proof). All driven by tone="aggressive" on the shared SupTeaserA — no
// duplicated layout, and it inherits the same REAL teaser-count logic (no fake
// data). Re-created 2026-07-04 per owner (the old dead C was deleted earlier).
const SearchDetailPreviewVariantC = ({ person, id }) => (
  <SupTeaserA person={person} id={id} palette={SUP_PALETTE_GREEN} tone="aggressive" showHook />
);

export default SearchDetailPreviewVariantC;
