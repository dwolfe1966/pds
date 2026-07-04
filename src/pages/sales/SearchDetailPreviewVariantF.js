import React from 'react';
import SupTeaserA, { SUP_PALETTE_GREEN } from './SupTeaserA';

// Variant F — the HYBRID: the aggressive "closer" copy (variant C) AND the real
// map IA (variant E) together. tone="aggressive" + layout="realmap" on the shared
// component — the maximal challenger. Created 2026-07-04 per owner (challenger set).
const SearchDetailPreviewVariantF = ({ person, id }) => (
  <SupTeaserA person={person} id={id} palette={SUP_PALETTE_GREEN} tone="aggressive" layout="realmap" />
);

export default SearchDetailPreviewVariantF;
