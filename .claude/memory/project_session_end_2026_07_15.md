---
name: project_session_end_2026_07_15
description: "Session pickup 2026-07-15 — profile-as-product built (ProfileView + modular My Profile + tiers + persistence + IA); next = fold reports into modular schema (#3)"
metadata:
  node_type: memory
  type: project
  originSessionId: c559d3ef-73d6-4bd2-ae57-b22ea4c6528f
---

Pickup after a large profile-as-product session. Full detail: [[project_modular_profile]] +
docs/design/profile-concept-model.md. Identity product base: [[project_identity_management]].

**Latest consumer bundle: `public.b550f47f.js` (HEAD b28e9b0) — NOT yet on BC.** Carries the whole
session. SEO backend (`seo/`) changes pushed to main → Vercel; Neon migrations applied directly
(member_suppression.dispositions + verified_level + hidden_fields/activity_hidden all live).

**Shipped this session (in order):** lightweight verification (KBA in-flow + optional DL-barcode scan;
research doc); search-history → server endpoint (cross-device); logout hard-reload fix; state-(c) 3-state
My Identity; payment mobile vCard-first; BC asks answered (password reset param `resetPassword(email)`;
CSR reply = `message.contact.createCsrReply` → /contactMessage/admin/csrReply); Protection Score ring
(3-step stepper, on dashboard Row 2 + My Identity); unified page template (PageHeader/PageShell across all
member pages); nav (History→Activity feed, Alerts hidden); **the profile pivot** — ProfileView extraction,
modular My Profile (Protect/Promote, source-coding, paid tiers, insights, View As, 2-col assessment rail),
per-module disposition persistence, 3-tab My Identity IA (Overview hub → My Profile workspace + Digital
Footprint), MyProfileModularLive with enrichment fallback.

**NEXT — #3 (the big strategic move):** fold the **"others" profile (today's reports / SearchResultDetailPage
/ ProfileView)** into the modular schema as the **non-owner projection**. Same MyProfileModular component,
owner-vs-others mode: anonymous/free see teased + paid-locked modules, paid see full. Unifies search results,
WSFY cards, and reports under one viewer-projected Profile. The `viewer` prop on ProfileView + the PAID tier +
the View As projection in MyProfileModular are the seams already built for this.

**Then:** real Activity-feed data (currently sample); mapping audit (confirm enrichment carries occupation/
city so Work/Location populate on real accounts); wire Protect/Promote actions to real effect (opt-out/
suppression) beyond disposition storage.

**Owner-side TODO (not code):** deploy `public.b550f47f.js` to BC/staging to see the live authenticated
tabs (owner CAN deploy to staging — that's the test surface, not local). Confirm Vercel picked up seo/.

**Cautions carried:** CTA color #0d5d2f never #16a34a; never persist prod BC creds / no prod mutation probes;
PII/email never to GA4; app-key JQV5HXGO80RIGE9XRSPI is a semi-public in-bundle gate (not a user credential);
identity/prefs stored server-side (member_enrichment/member_suppression), localStorage = cache only; console.*
stripped in prod; commit messages: avoid backticks (shell substitution mangled 3 messages this session).

**Launch cleanup:** remove /dev/profile route + ProfilePreviewPage + sampleProfileData (dev scaffold). Also
outstanding: 2 Dependabot alerts (1 high/1 moderate) on main; local dev login routes to BC (deprioritized).
