import React from 'react';
import SupTeaserA, { SUP_PALETTE_GREEN } from './SupTeaserA';

// Variant A — the default SUP (green). Design lives in the shared SupTeaserA.
const SearchDetailPreviewVariantA = ({ person, id }) => (
  <SupTeaserA person={person} id={id} palette={SUP_PALETTE_GREEN} />
);

export default SearchDetailPreviewVariantA;
