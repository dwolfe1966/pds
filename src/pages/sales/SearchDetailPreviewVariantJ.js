import React from 'react';
import SupTeaserA, { SUP_PALETTE_DARK } from './SupTeaserA';

// Variant J — inmate A/B SUP, dark/amber palette (matches landing v3b). Same
// design as the default SUP (variant A), re-skinned dark per owner 2026-07-03.
const SearchDetailPreviewVariantJ = ({ person, id }) => (
  <SupTeaserA person={person} id={id} palette={SUP_PALETTE_DARK} />
);

export default SearchDetailPreviewVariantJ;
