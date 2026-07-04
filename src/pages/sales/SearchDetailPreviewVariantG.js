import React from 'react';
import SupTeaserA, { SUP_PALETTE_GREEN } from './SupTeaserA';

// Variant G — the email-only challenger. Identical to the control (A) except the
// signup form drops the password field: we autogenerate a strong password, send
// it to BC via the existing plumbing (no BC change), and reveal it on the
// /paymentconfirm success screen. Isolates the friction impact of removing the
// password field. signup="email-only". Created 2026-07-04 per owner.
const SearchDetailPreviewVariantG = ({ person, id }) => (
  <SupTeaserA person={person} id={id} palette={SUP_PALETTE_GREEN} signup="email-only" />
);

export default SearchDetailPreviewVariantG;
