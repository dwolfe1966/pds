import React from 'react';
import SupTeaserA, { SUP_PALETTE_GREEN } from './SupTeaserA';

// Variant B — consolidated onto the shared default SUP design (green) per the
// 2026-07-04 teaser cleanup. Was a separate legacy layout; now identical to A so
// every live teaser shares one design + real BC counts. Re-skin with a palette
// here if a future A/B test needs a visual difference.
const SearchDetailPreviewVariantB = ({ person, id }) => (
  <SupTeaserA person={person} id={id} palette={SUP_PALETTE_GREEN} />
);

export default SearchDetailPreviewVariantB;
