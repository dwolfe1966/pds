---
name: project_session_end_2026_07_22
description: "Session-end 2026-07-22 — CSR billing overhaul, impersonation done, onboarding fixes; pickup state"
metadata:
  type: project
---

**Big arcs this session:**
1. **CSR billing lifecycle classification — the dominant work.** Built a full S-code classifier mirroring
   the legacy business rules across EVERY CSR surface. See [[project_csr_billing_classification]] for the
   durable reference (taxonomy, BC mapping, files, validated cases). Deploy candidate **`admin.14ee842c.js`**.
   Validated live against Cassie/godwill/rakim/christenbury/Tera/lacanda12. Only open: confirm `maxAttempts`.
2. **CSR impersonation (HP-2/HP-3) ✅ COMPLETE + WORKING.** `getAutoLoginUrl` "Log in as user" (all CSRs) +
   consumer `/auth/session` adoption route. Verified end-to-end by owner. Consumer `public.34c749f1.js` +
   admin (now superseded by the billing bundle). Bugs fixed en route: allowlist registration, wrapped-URL
   extraction, popup-block. BC asks (TTL/single-use/revocable/audit) in `docs/BC_AUTOLOGIN_ASK.md` — nice-to-have.
3. **Onboarding reveal fixes (consumer).** ?onboard=1 persistence (index.js) + the real bug: ResultCard
   self-navigated (stopPropagation) so the gate never fired → pass `onClick={handleResultClick}`. Restyled
   light/on-brand + surfaces real enrichment matches. Consumer bundle was `public.dd976490.js` (pre-impersonation).
4. **Deploy MIME error** was a partial BC upload (index.html without the matching hashed JS) — upload the
   whole build/ set.

**NEW backlog (owner 2026-07-22):** HP-4 — CA-billing-address members must be redirected to Contact CS
instead of online cancel (consumer). In [[project_backlog]].

**PENDING OWNER ACTIONS:** (1) deploy `admin.14ee842c.js` (billing) + the consumer bundle when ready;
(2) confirm retry `maxAttempts` (=10?) to finalize "of N"; (3) SEO — STILL NO TRAFFIC, investigating next
(see [[project_seo_recovery]] / [[project_seo_indexing_incident]]); (4) 16 Dependabot vulns; (5) sitemap-
directory.xml submission in GSC/Bing.

**NEXT:** SEO traffic diagnosis (owner: "still no traffic"); then HP-4 (CA cancel); HP-1 maxAttempts confirm.
See [[project_csr_billing_classification]], [[project_backlog]].
