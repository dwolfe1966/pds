---
name: project_identity_management
description: "Identity Management product — 3-state /my-identity (not-mapped / mapped-free / mapped-paid), exposure score, per-item suppression enforced in WSFY"
metadata:
  node_type: memory
  type: project
  originSessionId: c559d3ef-73d6-4bd2-ae57-b22ea4c6528f
---

The "control what's exposed" side of [[project_wsfy_self_build]] — same member_enrichment / member_suppression
Neon tables. Top-level `/my-identity` (route → `AccountPage`, forces `activeTab='identity'`, drops Account
chrome). Also reachable as the old Account identity view. Consumer bundle `public.9779d7b5.js` (2026-07-14,
NOT yet on BC).

**3-state framework (owner: "framework first, then fill"), all in AccountPage identity block:**
- **(a) not-mapped** — green promo bullets + `SelfIdentifyCard forceShow`.
- **(b) mapped+free** — confirmed vCard as a LOCKED teaser: risk stats crisp (exposure score/level, relative
  count, category chips), data specifics BLURRED (`filter:blur`, `locked = !isPaid`) — employer, schools,
  exact location, per-driver detail. Single "Unlock full report & protection" upsell → `/payment?reason=identity`.
  Blur is CSS-only but safe (it's the member's OWN data; pure conversion device).
- **(c) mapped+paid** — full vCard + exposure, then **"📄 Your full background report"**: has `reportId` →
  "View full report →" links to `/people/${reportId}` (reuses the existing paid expose-all
  `SearchResultDetailPage`; reportId = canonical `commerceContentId`). No reportId → "Pull my full report →"
  = `setEditingIdentity(true)` re-runs identify (paid path auto-creates report). Then Protect (→/opt-out) /
  Promote (coming soon) tracks. Chose LINK not embed — the report renderer's card components are module-private
  in SearchResultDetailPage; refactoring pre-launch = risk.

**Exposure score** — `computeExposure(id, hiddenKeys)` in `src/services/memberEnrichment.js`. 6 drivers
(location/past/relatives/employment/education/report), each present→points; score 0-100, level Minimal/Low/
Medium/High. Hidden keys drop out of the score + return as `hidden[]`.

**Per-item suppression ("hide this", paid, SHIPPED 2026-07-14, ENFORCED in WSFY):**
- Backend `member_suppression` extended (`db/member-suppression-fields.sql`, applied): `activity_hidden`
  (the global "Hide my activity" flag — was row-existence; keeps row when field-hides remain) + `hidden_fields
  TEXT[]`. Fns in `seo/lib/search-activity-db.mjs`: `setFieldSuppression`, `getSuppressionState`,
  `getHiddenFieldsMap`; `getSuppressedUserIds`/`isMemberSuppressed` now gate on `activity_hidden=true`.
- `POST /api/suppression` with a `key` = per-field toggle; without = global. GET returns `{suppressed,hiddenFields}`.
- Client: `fetchSuppression()`→`{activityHidden,hiddenFields}`; `setFieldSuppression(key,on,meta)`.
- **WSFY enforcement** (`seo/lib/wsfy.mjs`): `TAG_SUPPRESS` maps exposure key→affinity tags (employment→
  occupation/colleague, education→high_school/college, past→past_local, relatives→relative/verified_relative/
  shared_relative, location→local). `getHiddenFieldsMap(memberIds)` per searcher → hidden tags filtered out +
  occupation/employer blanked when employment hidden. VERIFIED on live Neon: hiding employment drops Carol
  King's occupation tag from David Wolfe's WSFY; unhide restores.

**Storage is server-side** (member_enrichment/member_suppression via app-key-gated endpoints); localStorage
`wsfyMappedIdentity` is a display cache only.

**Form-re-render fix (2026-07-14):** confirm form used to re-render after mapping — `currentUserId()` returned
'' (BC keys id as `uniqueId` on dev, which it didn't check), so the mirror write (gated behind userId) was
skipped. Fixed: mirror writes UNCONDITIONALLY (client cache mustn't need a server id); `currentUserId()` now
checks `uniqueId` + falls back to the session JWT; identity passed through `onComplete`.

**Nav fix (2026-07-14):** /my-identity and /account are the SAME AccountPage → no remount between them → stale
`activeTab` rendered Account over Identity and vice-versa. Fixed via a `location.pathname` effect syncing activeTab.

**Owner TODO:** upload `public.9779d7b5.js` to BC. **Open fill:** free-tier deeper obfuscation done; full-report
embed (vs link) deferred; per-item hide currently paid-only. WSFY-AUTH (per-user) still the real gate ([[project_bc_consumer_feature_asks]]).
