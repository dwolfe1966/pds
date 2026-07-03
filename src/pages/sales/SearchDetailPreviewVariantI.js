import React from 'react';
import SupTeaserA, { SUP_PALETTE_BLUE } from './SupTeaserA';

// Variant I — inmate A/B SUP, trust-blue palette (matches landing v3a). Same
// design as the default SUP (variant A), re-skinned blue per owner 2026-07-03.
const SearchDetailPreviewVariantI = ({ person, id }) => (
  <SupTeaserA person={person} id={id} palette={SUP_PALETTE_BLUE} />
);

export default SearchDetailPreviewVariantI;
