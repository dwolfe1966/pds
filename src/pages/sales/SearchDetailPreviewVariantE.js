import React from 'react';
import SupTeaserA, { SUP_PALETTE_GREEN } from './SupTeaserA';

// Variant E — like D (map IA) but with a REAL map instead of the stylized SVG.
// layout="realmap" renders a keyless Google Maps embed for the person's city/
// state (no API key, no dependency, no coordinate dataset). City-level only.
// Production would swap the legacy embed for the official Maps Embed API (key)
// or bundled coords + OSM tiles. Created 2026-07-04 per owner (challenger set).
const SearchDetailPreviewVariantE = ({ person, id }) => (
  <SupTeaserA person={person} id={id} palette={SUP_PALETTE_GREEN} layout="realmap" />
);

export default SearchDetailPreviewVariantE;
