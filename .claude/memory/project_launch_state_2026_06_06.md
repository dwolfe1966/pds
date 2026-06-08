---
name: launch-state-2026-06-06
description: "Current launch-sprint state: latest deployable bundles, what shipped (member/visitor phone, CSR search, Shn 6a22ff83, CTA, emails), open BC asks, and pending decisions."
metadata: 
  node_type: memory
  type: project
  originSessionId: 7aeba5ca-a8fd-4f98-b2f1-d4e52b390ce2
---

Snapshot end of 2026-06-06 session. Supersedes [[csr-triage-session-2026-06-04]] for live state.

**VERIFIED LIVE 2026-06-08** (curled the hosts + rebuilt HEAD → hashes match, no skew):
- **Consumer LIVE = `public.772bfb29.js`** on dev.www.idlookup.ai — == current HEAD build.
  Rolls up ALL report-parity work (address rows, property rewrite, financial/lien, criminal
  physical descriptors). Supersedes 742dba2e.
- **Admin LIVE = `admin.eff24bd1.js`** on dev.admin.www.bytecrtrs.com/csr/ — == current HEAD
  build. = the old `7aa4d485` + commit `2ad278d` (request updaterId in tracking displayFields
  + guard against trim). build-admin/ is now gitignored (commit 127f306).
  Structural verification only — live bytes == committed source. Functional/live-UAT smoke
  (needs BC captcha + creds, owner-interactive) NOT yet run this session.

**NEW deployable, NOT yet uploaded (consumer `public.673c4d74.js`, commit df48985):**
TRX/card-brand compliance — colored Visa/Mastercard/Amex/Discover acceptance marks
now shown on BOTH checkout surfaces (PaymentPage + SearchDetailPreviewVariantB inline
checkout). New `src/components/CardBrandMarks.js` = inline SVG logos (NOT image assets —
Parcel .png→{} gotcha); all four always visible, detected brand emphasized + others
dimmed. Removed redundant text pills. Owner to upload 673c4d74 → dev.www.idlookup.ai.

**Earlier deployable bundles (origin/main @ f79ad95, now superseded):**
- **Consumer `public.742dba2e.js`** — rolls up everything below.
- **Admin `admin.7aa4d485.js`** — single smart search + query-shape fix + dedicated
  results + direct-POST tracking (perPage:100). Supersedes the broken IIFE bundle
  `aad8122d` (DO NOT deploy aad8122d — its IIFE tracking.findUser switch was reverted).

**Shipped this session (all pushed):**
- **Member phone search** — `createReportForPhone` now does a phone teaser then creates
  the report via the **extId path** (`createReport({type:'extId', extId, contextKey:
  'sale.phone.report', teaserInput})`). `reversePhone` is a dead end: no teaserInput → 400,
  with phone-teaser teaserInput → 500. (reportService.js)
- **Visitor phone teaser** — `adaptTeaserResponse` now reads `commerceContent.raws[0]
  .transient.identities` (was only `raws[0].transient`; getData() path was dev-only). See
  [[bc-teaser-identities-nested-in-commercecontent-raws]].
- **CSR customer search** — collapsed 5 inputs into ONE smart box (auto-detects email/name/
  zip/phone/last4/24-hex-id). CRITICAL FIX: `csrFindUsers` now nests filters under `query`
  (BC ignores top-level → was returning the default list as fake matches). Dedicated
  "Search Results" header (only matches) + Clear. Status = a results filter, not search.
  Name = client-side scan of ~250 recent (BC has no server name filter). (UsersPage.js,
  apiWrapper.csrFindUsers)
- **CSR user-detail Searches/Reports/Logins** — direct-POST `/database/search` trackings,
  `perPage:100`, client-filter `d.updaterId === id`. BC ignores `query.updaterId`; updaterId
  absent on anonymous docs (pre-login). See [[bc-csr-user-object-omits-zip-card-phone]].
- **Payment CTA** → "I Agree, View Report Now" (global, bug #35).
- **Shn params** — `payment.requireTermsCheckbox` (#34, strict default true) +
  `search.zeroState` 'noRecords'|'thinMatch' (#51) in campaignRegistry; wired in PaymentPage
  + the 3 sales SRPs. Plus `optOut` flag (below). See [[shn-partner-attribution-framework]].
- **Lifecycle emails** — server/templates/email.js (10 templates) + `docs/email-previews/`
  standalone HTML (sample-data + `{{token}}` sets). NOT wired to real send triggers.
- **First real shN `6a22ff83ca16ad4ef68b84b5`** (Google Inmates Upper / Google / Search):
  landing `/name/landing/v3`, SUP `detail.variant 'a'`, `optOut:true` → OptOutNotice link
  ("Is this your information? Request removal / opt out" → /opt-out) on the sales SRP and
  the SUP variant components (added to VariantA/C/D). Registry keys `1:*..5:*` are still
  PLACEHOLDERS awaiting real strings.

**SUP variant preview:** `/search/<id>?v=a|b|c|d|e` (overrides shN `detail.variant`; default '1').

**Open BC asks (docs/):** BC_CSR_TRACKING_SCOPE (server-side tracking scope),
BC_CSR_SEARCH_GAPS (server name filter + order-by-id), BC_CTO_HANDOFF (attribution tree /
BIN / street; **Q2: confirm commerceorders.refer persists → if yes, add `refer` to billingSale,
small change on us**), BC_CSR_DATA_EXPOSURE (zip/last4cc/phone displayFields + intermittent
cold-load 403/404 session race = the "worked before not today" / row 4), BC_SIGNUP_WELCOME_EMAIL,
BC_PDF_DISCLAIMER, BC_SHN_PARTNER_SHAPE, BC_OPTOUT_FORM_STYLING.

**Pending owner decisions:** real shN strings for `1:*..5:*`; whether BC drives the shN UX
flags (checkbox/zeroState) vs local; wire lifecycle emails to send triggers; displayFields
hardening for tracking (offered, optional). Bug CSV `Bugs-6-6-26.csv`: #34/#35/#51 done,
#83 retest, #21/#41/#45/#73/#74/#77/#80/#81/#82 BC-pending. 2 moderate Dependabot (post-launch).

**Verify-on-deploy:** member/visitor phone `(909) 663-7878`; CSR search each type → matches;
user-detail tabs → only that user; `?shn=6a22ff83…` → v3 + variant a + opt-out link.
