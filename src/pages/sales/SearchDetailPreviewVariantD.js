import React from 'react';
import SupTeaserA, { SUP_PALETTE_GREEN } from './SupTeaserA';

// Variant D — reorganized IA (Spokeo-inspired). Same vCard + real teaser counts,
// but under the vCard it swaps the 4 category cards for a location MAP panel +
// a colored-dot category legend built from the real counts. Driven by
// layout="map" on the shared SupTeaserA (no map SDK / API key — self-contained;
// the map is stylized, city/state is real). Re-created 2026-07-04 per owner.
const SearchDetailPreviewVariantD = ({ person, id }) => (
  <SupTeaserA person={person} id={id} palette={SUP_PALETTE_GREEN} layout="map" />
);

export default SearchDetailPreviewVariantD;
