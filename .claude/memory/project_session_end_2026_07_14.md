---
name: project_session_end_2026_07_14
description: "Session pick-up 2026-07-14 — Identity Management product built (3-state + per-item suppression); deploy state + queued next"
metadata:
  node_type: memory
  type: project
  originSessionId: c559d3ef-73d6-4bd2-ae57-b22ea4c6528f
---

Pick-up state after the Identity Management session. Full detail in [[project_identity_management]];
WSFY context in [[project_wsfy_self_build]].

**Current deploy candidates (NOT yet on BC / need owner action):**
- Consumer bundle **`public.9779d7b5.js`** (HEAD) — carries, in order shipped this session:
  1. 3-state `/my-identity` framework (not-mapped / mapped-free / mapped-paid).
  2. Free-tier vCard obfuscation (locked teaser; data blurred, risk stats crisp).
  3. State (c) full-report access ("View full report →" → /people/:reportId, or "Pull my full report").
  4. **Fix:** confirm form re-rendering after mapping (`currentUserId()` missed `uniqueId`; mirror now
     writes unconditionally + JWT fallback).
  5. **Fix:** /my-identity ↔ /account rendering over each other (same AccountPage, stale activeTab; path-sync effect).
  6. Per-item exposure suppression (paid), enforced in WSFY.
- SEO backend (`seo/`) changes pushed to main → Vercel auto-deploy (confirm). Neon migration
  `member-suppression-fields.sql` already applied directly (live regardless).

**Owner TODO (not code):** (1) upload `public.9779d7b5.js` to BC VPS. (2) confirm Vercel deployed the seo/
push. (3) set `WSFY_APP_KEY` (Vercel) == `REACT_APP_WSFY_APP_KEY` (consumer). (4) send WSFY-AUTH BC ask.
(5) SendGrid domain-auth for [[project_email_recovery_pipeline]].

**Verified this session on live Neon:** per-item Hide(employment) drops Carol King's occupation affinity +
detail from David Wolfe's (userId 6a3b06d3e1cabb1607d32ac0) WSFY summary; Unhide restores. Seed still
loaded (`seo/scripts/seed-wsfy-demo.mjs`, David Wolfe / LA / CA).

**Queued next (owner's call at session start next time):**
- Onboarding placement of self-identify (IdentityOnboardingModal is first-visit; revisit).
- Free-tier "Promote" track (curated public profile) — currently "coming soon".
- Full-report EMBED vs current link-out (deferred: SearchResultDetailPage card components are module-private).
- Optional `self=1` flag to suppress report-view tracking when a member views their OWN /people/:reportId.
- Real per-user WSFY-AUTH (BC ask) — the actual gate; app-key is interim ([[feedback_no_secrets_in_bundle]] — app-key is a semi-public gate, intentionally in-bundle, NOT a user credential).

**Cautions carried:** CTA color `#0d5d2f` never `#16a34a` ([[feedback_cta_color]]); never persist prod BC creds /
no prod mutation probes ([[project_bc_production_golive_2026_06_23]]); PII/email never to GA4; identity/prefs
stored server-side, localStorage is cache only.
