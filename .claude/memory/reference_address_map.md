---
name: reference_address_map
description: Address-history map on the profile (Leaflet + OSM); the CSP tile caveat to check on the BC VPS
metadata: 
  node_type: memory
  type: reference
  originSessionId: c559d3ef-73d6-4bd2-ae57-b22ea4c6528f
---

Profile address-history map: `src/components/AddressMap.js` (Leaflet 1.9 + react-leaflet 4.2, added 2026-07-19). Plots geocoded addresses (IDI `addressList[].latitude/longitude`, passed through by reportExtract). Wired into `MyProfileModular` Locations module → shows on BOTH the report profile (`/people/:id`) and My Identity. Safe-by-default: renders nothing when no address has coords.

Design: pins are inline-SVG `L.divIcon` (NOT Leaflet default PNGs → avoids the broken-marker bundler bug + no external image requests). Only OSM **tiles** load remotely, by z/x/y grid — a pin's coordinates never leave the client (no address PII to the tile host). Newest address = green (`#0d5d2f`), priors = slate.

⚠️ **CSP caveat (verify on deployed BC bundle):** map tiles load from `https://{s}.tile.openstreetmap.org/...`. If BC's site sends a `Content-Security-Policy` with restrictive `img-src`/`default-src`, tiles are blocked → map shows a blank/gray grid (pins still render). If that happens, BC must allow `*.tile.openstreetmap.org` in `img-src`. Can't verify locally — only on the BC-served bundle.

Deps added: leaflet@1.9, react-leaflet@4.2 (React-18 compatible). Bundle grew ~160KB. Leaflet marker PNGs get copied to build/ but are unused at runtime (we use divIcon).

Deploy candidate carrying this: `public.956f8994.js` (also includes the React #31 report-crash fix + report-render hardening). Not yet on BC.
