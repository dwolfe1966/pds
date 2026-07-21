---
name: project_thinmatch_payment_fix
description: Thin-match now routes straight to payment (no email+password dead-end); unified CTA replaces v1/v2 A/B
metadata: 
  node_type: memory
  type: project
  originSessionId: c559d3ef-73d6-4bd2-ae57-b22ea4c6528f
---

**Fix 2026-07-21 (consumer app, bundle `public.58aaced5.js` — NOT yet on BC).** Bug: ~1/4 users, esp. `/name/landing/v11` — after email captured upstream, thin-match showed a create-email+password form instead of going to payment, because `ThinMatchPreview`'s `!token` branch rendered the full signup form regardless of captured email.

**New unified thin-match CTA** (replaces the v1/v2 A/B — `thinMatchVersion` prop removed):
- Visitor → **email-only signup** (`generatePassword()` + `sessionStorage _pwAuto='1'` so PaymentPage reveals credentials on confirmation) → straight to `/payment` (redirectParam, no selectedPersonId → general/promo mode). No password field. If email already captured (`getCapturedEmail()`), input skipped → one-click Continue ("Continuing as <email>").
- Free member → Continue Link to `/payment`. Paid member → refine hint (unchanged).
- Refine form stays BELOW the CTA (both scenarios); renamed `<h2>` "Search again" → "Refine Search" (SearchResultsPage.js).

**Mechanism** mirrors `SupTeaserA` `signup="email-only"` (the proven pattern). `useSignup.submit` navigates internally after success (setTimeout navigate, ~2s). v11 `dest=serp` (default) → `/name/search-result` → SearchResultsPage zero-state → ThinMatchPreview (confirmed path).

**getFailedCode()**: BC exposes `response.getFailedCode()` → `TooManyMatches|Unauthorized|Unknown|null` (BC doc edited 2026-07-20). Already wired in `deriveThinMatchFlags` (thinMatch.js:32 reads `getFailedCode?.()`), so common-name TooManyMatches now reliably lands this same Continue→payment CTA. Thin-match render still gated on `campaign.search.zeroState==='thinMatch'`.

**Advisor guards applied**: import `generatePassword` (silent-ReferenceError footgun avoided); set `_pwAuto` (else user locked out of paid account); keep signed-in branches; keep `/payment` no-personId. Build clean. **NEXT: owner uploads public.58aaced5.js to BC; verify v11 thin-match → Continue → payment live.**
