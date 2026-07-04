---
name: project_sup_challenger_variants
description: "SUP/Teaser challenger variants (a–j) — one shared component, 3 composable axes; how they dispatch"
metadata: 
  node_type: memory
  type: project
  originSessionId: 0aa0a521-254d-498f-bd45-2a3057b6e96b
---

The consumer **SUP / profile-teaser** page (`/search/:id` → `SearchDetailPreviewPage`)
is now ONE shared component `src/pages/sales/SupTeaserA.js`, driven by three
composable props, plus per-variant thin wrappers `SearchDetailPreviewVariant{X}.js`.
Built 2026-07-04 as a challenger set to A/B test (owner will run the tests).

**Three axes on SupTeaserA:**
- `palette` — SUP_PALETTE_GREEN / _BLUE / _DARK (exported from SupTeaserA).
- `tone` — `'aggressive'` swaps in salesy copy + urgency strip + redacted "locked
  report" preview + confidentiality hook + social proof (else measured default).
- `layout` — `'map'` (stylized SVG map + colored-dot category legend) or
  `'realmap'` (keyless Google Maps embed for the city/state) replaces the 4
  category cards. Legend + counts are REAL (from `person.records`, see
  [[reference_bc_teaser_response_shape]]).
- `signup` — `'email-only'` drops the password field, autogenerates one
  (`generatePassword()` in useSignup), and reveals it on the /paymentconfirm
  success panel. No BC change.

**Live variants (dispatch = `?v=` wins → campaign `detail.variant` → else 'a'):**
a=green control · b=green(≡a) · c=aggressive · d=stylized map · e=real map ·
f=aggressive×realmap hybrid · g=email-only(≡a+email-only) · i=blue · j=dark.
`MARKETING_VARIANTS = [a,b,c,d,e,f,g,i,j]`; unknown `?v=` falls back gracefully.
Retired/deleted: c/d/e/g/h/k OLD dead variants (removed, then c–g reused for the
new challengers); legacy inline '1' layout is unreachable dead code (flag: remove).

**Guardrails held:** NO fabricated data anywhere (counts/relatives/area — all real
or omitted); NO FCRA-regulated framing. Real-map is a legacy keyless embed — fine
for the test; production needs official Embed API (key) or bundled coords+OSM.
Everything committed+pushed; NOT deployed to VPS. Email-only confirm-reveal still
needs one LIVE purchase to verify (dev sale is BC/captcha-gated).
