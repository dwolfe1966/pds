---
name: project_modular_profile
description: "Profile-as-product: report → viewer-projected Profile; modular My Profile (FB/LinkedIn) with Protect/Promote per module, paid tiers, insights, View As, persistence"
metadata:
  node_type: memory
  type: project
  originSessionId: c559d3ef-73d6-4bd2-ae57-b22ea4c6528f
---

The strategic pivot of [[project_identity_management]]: identity IS a product; report → **Profile**. Concept
spine: **docs/design/profile-concept-model.md** (one Profile entity, viewer-projected by viewer-class ×
claim-status × permissions; Present vs Expose; Transparency + Control; "manage, don't delete"). Research
threads → docs/research/lightweight-identity-verification.md + the profile-concept-model doc.

**ProfileView extraction (report-as-profile foundation):** `src/components/ProfileView.js` = the shared,
reusable render of a report AS a profile (SummaryBar + 17 sections + all card sub-components + exported
`styles`). Pure extraction from `SearchResultDetailPage` (which now renders `<ProfileView data viewer="paid"/>`,
1158→351 lines). `viewer` prop is a NO-OP seam for later projection. Verified via jest smoke test
(`src/tests/profileView.test.js`, uses react-dom/server + TextEncoder polyfill; renders every section from
`src/utils/sampleProfileData.js`). extractAll output IS the data contract.

**Modular My Profile (FB/LinkedIn social-profile model):** `src/components/MyProfileModular.js` — cover-image
vCard hero + module collection (About, Contact, Locations, Family, Work, Education, Online, Activity, and
records split into Court / Property / Financial). Each module:
- **Protect / Promote** disposition ('protect'=hide from others · 'promote'=feature public · neutral=default).
- **Source-coded** header (colored left-accent + label): `user` (green), `observed` (blue), `record` (amber).
- **Paid tier** (Contact, Court, Property, Financial): locked/blurred tease for anonymous/free viewers unless
  PROMOTED — preserves the paywall value for paid searchers. `PAID` set in the component.
- Coded infographic header: icon-in-source-chip + count badge + source/tier labels.
- **2-column layout**: LEFT = modules, RIGHT = owner-only assessment (protected/exposed/featured counts +
  score) + recommended actions + source legend. Single column when previewing as a viewer.
- **"Preview as" (View As)**: You / Anonymous / Free / Paid — re-renders per the viewer projection (protect→
  only you; promote→everyone; neutral→members). Paid modules lock for non-paid. THE thesis in one interaction.
- Data mapping = direct projection of extractAll: phones→Contact, addresses→Locations, relatives→Family,
  jobs→Work, criminalRecords→Court, properties→Property, liens/judgments/…→Financial. Activity feed = still
  SAMPLE (needs real WSFY/activity data). Family shows count-only (no names) until full report.
- Dispositions/view = local state; accepts `dispositions` (initial) + `onDispositionChange` for persistence.

**Persistence:** per-module disposition stored in `member_suppression.dispositions` JSONB (moduleId→
'protect'|'promote'; neutral clears key). `setModuleDisposition` / `getSuppressionState.dispositions` (seo lib);
`/api/suppression` POST handles `{module, disposition}` + GET returns dispositions; client
`setModuleDisposition(module, disposition)` + `fetchSuppression().dispositions`. Verified round-trip on Neon.

**Live in My Identity:** `/my-identity` subnav is now **Overview | My Profile | Digital Footprint** (3 tabs).
- Overview = the HUB (assessment): vCard + exposure + a compact **MyProfileSummary** connector ("Manage your
  profile →" switches to modular tab) — NO longer re-renders the full report (My Profile owns it). Per-tab
  value explainer under the subnav.
- My Profile = `MyProfileModularLive` — fetches report by reportId → extractAll → MyProfileModular; hero from
  mapped identity + Protection Score; dispositions load/persist. **Fallback:** mapped-but-no-report members
  get a thin profile built from enrichment (`identityToProfileData`: name/location/work/education) + a
  "Complete my profile" banner — NOT the "find my record" prompt (that bug is fixed). In DEV, sample fallback.
- `MyProfileReport.js` = the earlier inline-report wrapper (still used? Overview now uses the connector; report
  lives in the modular tab). `ProtectionScoreRing` / `DigitalFootprint` are the other identity modules.

**DEV preview:** `/dev/profile` route (NODE_ENV-gated in App.js) → `ProfilePreviewPage` renders MyProfileModular
with sample — the no-login local workbench for the layout. KEEP until launch, then unravel (route + sample +
ProfilePreviewPage). Sample is tree-shaken from prod (verified).

**NEXT (owner roadmap):** (#3, the big one) fold the **"others" profile (today's reports)** into this modular
schema — render `ProfileView`/report as the NON-owner projection (paid modules locked/teased) so search
results, WSFY, and reports all become viewer-projected Profiles. One component, owner-vs-others mode.

**Deprioritized:** local dev login routes to BC (502) not the mock — owner has staging + /dev/profile, so
fixing it isn't worth it (real report data needs BC anyway). See [[project_session_end_2026_07_15]].
