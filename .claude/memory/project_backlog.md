---
name: Active backlog and known gaps
description: Forward-looking work — the five BACKLOG-X tracks plus known gaps not tied to a specific track. Captures intent and the most recent verified state; check code/git when acting.
type: project
originSessionId: ed6a1fb6-9daf-4f36-a40e-b2ed117467bc
---
## ⭐ HIGH PRIORITY (owner 2026-07-21 / 2026-07-22)

- **HP-4 — CA members: no online cancel → redirect to Contact CS. ✅ BUILT 2026-07-22 (public.027157f4.js, NOT deployed).** `AccountPage.isCaBillingOrder` (billing ZIP 90001–96162 + state==='CA' backup — state field is often empty/bogus) → Cancel button + confirm handler redirect CA to `/contact?topic=cancel`; ContactPage got a 'Cancel subscription' topic (prefilled). ⚠️ CONFIRM CA-detection method (zip-based) w/ owner — legal. Orig: For any
  member whose BILLING ADDRESS is in **California (state = CA)**, change the CONSUMER experience so that
  attempting to cancel a subscription online **redirects them to Contact Customer Support** instead of
  self-serve online cancellation. (Legal/retention: CA auto-renewal law nuance / handle via CS.) **How to
  apply:** gate the consumer cancel flow on the billing-address state — CA → route to `/contact` (or a
  CS-cancel path) instead of the cancel action. Billing state lives on the ORDER's billingAddress (BC), not
  the user object (see [[reference_bc_user_object_no_zip]]); the member's paid state derives from BC orders
  ([[feedback_subscription_state_authority]]). Confirm where the consumer cancel action lives + how to read
  the member's billing-address state client-side. NON-CA members keep online cancel.

## HP-1 — CSR STATUS ✅ LARGELY BUILT 2026-07-22 (see [[project_csr_billing_classification]])
Full billing lifecycle classifier + S-code taxonomy shipped across all CSR surfaces (list, vCard, Orders
tab, Purchases/Orders, order detail). Validated against 6 live customers. Deploy candidate
`admin.14ee842c.js` (NOT on BC). Only open item: confirm real retry `maxAttempts` (currently 10). Legacy
business rules mirrored (S0 no-retry, day-7 $49, ISF-retry vs Fraud-suspend, never-captured High-risk).

## ⭐ HIGH PRIORITY (owner 2026-07-21)

- **HP-1 — Mirror legacy customer-status business rules in the CSR.** Our CSR status
  (`src/pages/admin/userState.js` `getPlanState` + the per-page badges) is a client-side re-derivation
  that DOESN'T match our legacy business rules. The legacy system encodes **complex retry/provisioning
  logic**: e.g. a **trial is provisioned even when the initial payment fails**, and we **retry the charge
  (dunning) before cancelling the trial** — so "payment failed" is not immediately "cancelled/expired,"
  it's a retry window. We must mirror those exact statuses + transitions in the CSR so it reads the same
  as legacy + BC's own admin view. **Confirmed broken today:** Trial NEVER rolls into Subscriber for 100%
  of customers (frozen `transient.amount.collected` vs cycle price — count settled `sale` payments
  instead); refunded orders collapse to raw "Inactive"; `subStatus:expired` is overloaded across
  expiry+refund; cancel-at-period-end (still-has-access) shows flat "Cancelled". **Blockers/inputs owner
  is getting us:** (i) the legacy business-rules doc; (ii) ACCESS to BC's admin tool that replicates
  these statuses (the authoritative reference to mirror). **Also unused:** BC's `orderHistories`
  transition timeline is plumbed end-to-end (`csrFindOrderHistories`) but rendered nowhere — surface it.
  Full audit + evidence + target vocabulary + BC-confirm list in `docs/admin/order-status-definitions.md`.
  **How to apply:** wait for the legacy doc + BC-admin access; decide mirror-BC vs derived-labels; then
  rework `userState.js` (payment-count trial rule, refund-needs-inactive, resolve raw Inactive) + surface
  `orderHistories`. See [[reference_cancel_at_period_end]], [[reference_bc_getorder_price]],
  [[feedback_subscription_state_authority]].

- **HP-2 — CSR impersonation ("Log in as user"). ✅ COMPLETE end-to-end 2026-07-22 (consumer public.34c749f1.js + admin.eef20e97.js, NOT yet deployed).**
  `csrGetAutoLoginUrl` → `admin-auto-login-url` (in apiRouter allowlist + apiRouterAdmin) → `api.adminGetAutoLoginUrl`
  → `UserDetailPage` "Log in as user" button (ALL CSRs; result modal w/ Open/Copy; audit note that NEVER stores
  the URL; findLoginUrl digs the URL out of BC's wrapped response). Consumer adoption: login router sends `{}`
  for no-cred BC session-check → `AuthContext.adoptSession` → `/auth/session` (`SessionAdoptPage`) hydrates then
  routes to ?next (default /dashboard). Redirect targets `/auth/session`. **VERIFIED LIVE:** loginLink establishes
  a real same-origin session (no-arg login → isSuccess+user); no domain mismatch. Also resolves **HP-3** (no-arg
  login session-check is the adoption mechanism). Bugs found+fixed en route: missing allowlist entry (the real
  "not available in either API"), wrapped-response URL extraction, popup-block. **Still open:** BC Q2-Q5
  (TTL/single-use/revocable/server-audit) in `docs/BC_AUTOLOGIN_ASK.md` — nice-to-have, not blocking. Deploy BOTH
  bundles together (admin redirect needs the consumer /auth/session route live).
  **FOLLOW-UPS (tracked, owner 2026-07-22 — not blocking):**
  (a) **Send BC Q2–Q5** — TTL / single-use / revocable / server-side audit for the `getAutoLoginUrl` loginHash
      (it's a bearer credential). Route via the **bc-asks-register** agent; questions already drafted in
      `docs/BC_AUTOLOGIN_ASK.md`.
  (b) **"Viewing as {customer}" banner** on the consumer app during an impersonated session — a persistent
      indicator (and ideally an "exit impersonation" affordance) so a CSR never mistakes the customer's session
      for their own. Small follow-up; the impersonated session is a normal member session today (no banner).
- **HP-2 (orig) — CSR: auto-login-URL from an email (impersonate via link).** BC shipped
  **`csrWrapper.api.user.getAutoLoginUrl({ userId, redirect? })`** (added 2026-07-21,
  `POST /api/user/management/getAutoLoginUrl`) → returns `{ url }` (a `/api/auth/loginLink?loginHash=…&clientId=…&apiId=…`
  link). Visiting the URL logs the server in AS that user; optional `redirect` (e.g. `/contact`) lands them
  on a path post-login. **Use:** CSR generates a one-click "log in as this customer" link (email it or open
  it) to reproduce/solve the customer's problem in their own session. **How to apply:** wire `getAutoLoginUrl`
  into `apiWrapperCsr.js` + `apiRouterAdmin.js` + `api.js`; add a CSR action button on `UserDetailPage`.
  Guard it (CSR-role only, audit-log who impersonated whom). ⚠️ Impersonation = sensitive; confirm the
  loginHash is single-use/short-TTL with BC.

- **HP-3 — CSR: log a user in from the CSR to solve their problem.** BC:
  **`apiWrapper.api.auth.login({ username, password })`** — and calling `login()` with NO
  username/password checks whether the session is already logged in on the server (session-status check the
  client uses to maintain login state). Companion to HP-2 (getAutoLoginUrl is the linkless path). **How to
  apply:** scope alongside HP-2 — prefer `getAutoLoginUrl` (no credential handling) for CSR impersonation;
  use `auth.login()`'s no-arg session-check for verifying/maintaining the impersonated session state.

---

Five named tracks the team plans against. Numbers are referenced in commits/PRs.

**BACKLOG-1 — Outbound Email Platform.** `server/emailService.js` wired with SendGrid + SES + SMTP + console fallback. Unsubscribe handler lives at `/admin/unsubscribe`. **Gap:** there is no UI entry to send broadcasts — `EmailBroadcastPage.js` was deleted (the `/admin/email` route and nav link were removed in `2a9f31b`; verified absent 2026-05-29). `sendAlertDigest` is exported but never scheduled. No open/click tracking pixels in templates.

**BACKLOG-2 — Reporting / Tracking / Visualization.** `tracking-api/` is operational. **Storage migrated from NDJSON to SQLite** (`tracking-api/db.js`); the migration runs on boot. `landing_view` is now fired on every variant via `src/hooks/useLandingTrack.js` (Phone V6, Email V5, Name V2–V6). A/B variant tagging is sent in event properties. AnalyticsPage queries `/events/summary`. **Remaining:** retention policy / archival, dashboards beyond AnalyticsPage, alerting on funnel regressions.

**BACKLOG-3 — Tracking Platform (server-agnostic).** Only GTM → GA4 (`src/services/gtm.js`, `REACT_APP_GTM_ID=GTM-WV7N6WWP` in `.env.production`) is wired. No Segment / Mixpanel / PostHog. `cloudflare-worker.js` exists but is an API/CORS proxy, not an event ingest. Track is open if production drops `/server` and `/tracking-api`.

**BACKLOG-4 — Admin App (ByteCrtrs API).** Admin app builds via `scripts/build-admin.js` → `build-admin/`. `public/admin.html` loads the BC `csrWrapper` IIFE. Many CSR endpoints are wired in `src/services/apiWrapper.js`. The production-CSR-403 issue (commit `cddbcec` instrumented it) is **resolved**; the `[admin-auth-debug]` logging has been removed. Active focus has shifted to nav cleanup across the admin/CSR app.

**BACKLOG-5 — Member Experience Refinement.** Dashboard2 is the canonical `/dashboard` (commit `3108599`); old `DashboardHome` is orphaned but not deleted. WSFY page (`WhoIsSearchingPage.js`) is wired. AlertsPage redesigned as a search entry surface, not a fake-feed list. Visitor searches now persist across signup (`visitorSearchLog.js` → `POST /searches/import`). Active focus: building out the consumer-app test suite and cleaning up consumer nav.

## Near-term big-ticket items (owner, 2026-07-08)

- **PayPal as a payment type.** NEW. Today checkout is card-only via BC `commerce-billing-sale` (TRX). Adding PayPal needs a PayPal button on `PaymentPage` **plus BC accepting PayPal for the RECURRING trial→monthly** (a PayPal billing-agreement/subscription, not a one-time charge). Mostly a **BC ask** (BC owns billing) + client integration. **How to apply:** scope BC's PayPal support (esp. the recurring/subscription mechanism) BEFORE building any UI.

- **PDS-managed email platform (GUI + delivery).** Expands **BACKLOG-1**. A first-party system to **compose/manage** emails (templates, the abandoned-checkout flow, campaigns) AND **deliver** them. This is the real home for the `checkout_abandoned` trigger already wired in `PaymentPage.js` (this session) + moves email off the BC/architecture-deferred hold. `server/emailService.js` already has SendGrid+SES+SMTP plumbing but there's **no GUI** (`EmailBroadcastPage` was deleted, `2a9f31b`). **Bigger infra decision:** build-vs-adopt (SES/Sendgrid/Postmark/Customer.io), deliverability (SPF/DKIM/DMARC), PII boundary. **How to apply:** decide build-vs-adopt + delivery provider before designing the GUI (the team-facing compose/campaign surface).

## Known gaps (not tied to a single track)

- **Bug #35 — payment submit-button compliance copy (deferred, 2026-05-29).** Bug submitter asked the submit CTA to read `"I AGREE. VIEW REPORT NOW!"` so it's clearer the click is acceptance of the terms above. Today `PaymentPage.js:875-876` reads `"Unlock Report — $1 Today"` / `"Start Trial — $1 Today"`. **Owner concern (2026-05-29):** worried the compliance copy would tank conversion — we may need to **revert the CTA** if we ship it and metrics drop. **How to apply:** if revisited, A/B test (variant: current price-led CTA vs compliance-led CTA) rather than a global swap. Get a measurable read before committing.

- **Bug #34 — optional pre-checked SUP affirmative-consent checkbox (deferred, 2026-05-29).** Submitter wants the SUP affirmative-consent checkbox to be optional for affiliate-shN traffic, required only on default shN. **Why deferred:** same risk class as #35 — going less-compliant on a high-volume traffic channel is a directional call, not a polish item. **How to apply:** if revisited, scope a per-shN feature flag readable from BC's response; do not blanket-remove the checkbox.

- **Bug #42 — remove "Address" search type from member homepage (deferred, 2026-05-29).** Submitter says address search "looks like search by City/State/Zip" and is confusing. Removing a search type is a feature decision, not a copy fix. **How to apply:** before removing, pull usage from `tracking-api` (`landing_view` / `srp_view` by `searchType=address`) to see whether anyone uses it. If <1% of searches, safe to remove. Otherwise rename and clarify the input rather than killing the feature.

- **Bug #51 — thin-match flow not built (deferred, 2026-05-29).** Submitter: default shN should say "no records found" but other (paid) traffic should show a "thin match" preview/upsell experience. Today both paths render `ZeroResultsPanel`. Real fix is a meaningful feature build — branch the SRP zero-state on shN identity and show a thin-match teaser for non-default traffic. **How to apply:** scoped from `useShnIdentity` (`apiWrapper`-derived); show `ThinMatchPreview` component (already exists at `src/components/ThinMatchPreview.js`) on non-default paths; keep current `ZeroResultsPanel` on default.

- **Member phone search bypasses the SRP (observation, 2026-05-29).** `MemberGeneralSearchPage.handlePhoneSubmit` calls `createReportForPhone(phone)` → direct `/people/:commerceContentId`. Name and email both go through `/people-results` (an SRP). Phone is the only direct-create path. **Why:** likely intentional — phone is high-precision (one phone → one person), so an SRP would always be 0-or-1 results. **Why it might bite us:** if BC returns "no match" we currently throw a generic "couldn't generate report" with no way for the user to refine. If revisited: either add an SRP layer for phone (matches name/email UX), or improve the no-match messaging to guide toward name/email search. Tracked as the structural side of #40 (owner ack'd "not noticed before").

- **CSR ticket list — richer sorting & filtering (backlog, 2026-05-27).** Today `EmailTicketsPage.js` has audience / status (awaiting/replied) / category / resolution (open/resolved) / my-tickets / free-text search filters and sorts by `createdAt` desc only. **Wanted:** sort by last-activity (latest reply across thread) instead of createdAt; sort by age of oldest unanswered; group by assignee; save filter presets; "stale > N days" highlight; per-tag filter chips (not just free-text search); export to CSV. Why: as ticket volume grows, the queue needs better triage tooling than chronological + tags. How to apply: don't pre-build all of these — pick the top one or two when CSR feedback lands.


- **Consumer bundle leaks BC/CSR vendor strings (deferred to post-launch, 2026-06-01).** `build/public.*.js` contains `CsrWrapper` (17×), `ByteCrtrs`, and admin endpoint paths (`/database/search`, `/contactMessage/admin`). **This is a regression vs commit `34f18a0`** (2026-05-06), which scrubbed the consumer bundle and verified "0 occurrences of ByteCrtrs." Root cause: the `csr*` admin methods were later built onto the *shared* `src/services/apiWrapper.js` singleton (`export default new ApiWrapperService()`), and since both `apiRouter.js` (static import) and `api.js` (dynamic import) pull the whole class, the CSR surface can't tree-shake out of `build/`. **Severity: low** — no secrets (captcha pass confirmed clean), paths are auth-gated, and BC is the same company (brand-polish, not confidentiality) — so owner deferred past launch (2026-06-01). **How to apply:** split the `csr*` methods + CSR-only helpers (`_csrPost`/`_csrGet`/`_viaCsr`/`getCsrWrapper`/`loadCsrIife`) into an admin-only module that only `admin-index.js`/`AdminApp` imports; keep shared low-level helpers (`_unwrapBcResponse`) in a neutral module both import. Re-hashes BOTH bundles → re-run full suite + re-smoke-test admin Notes/Messages. Touches consumer AND admin = pause-and-confirm. Found by launch-readiness audit 2026-06-01 (otherwise GO: console-strip wired both builds, no secret/captcha leak, no hardcoded BC hosts in consumer, mock disabled, no dead stubs).

- **Optional phone # across ALL signup experiences (backlog, 2026-06-11, owner request).** The main `SignupPage.js` got an optional phone field (commit `67446e4`) that flows to the synthetic user → billing → Profile tab. **Remaining:** audit and add the same optional phone field to every OTHER signup surface — `SignupPageStepped`, the embedded `ThinMatchPreview` signup, any payment-embedded signup, and the email-landing variants — so phone capture is consistent everywhere. Reuse the `useSignup` `extraPayload:{ phone }` plumbing (already wired). Keep it optional; mirror `SignupPage`'s field markup/copy.

- **Thin-match experience polish (in progress 2026-06-11).** Bug #51's `ThinMatchPreview` is now wired and got: app-style green restyle (was blue), password copy aligned to the real 8-char rule, and post-signup → `/payment` (general promo-teaser mode → dashboard). Remaining if desired: live-test with a real thin-match search + fresh signup; consider a live password-requirement checklist like `SignupPage`.

- **BC mandate: client code must use ONLY csrWrapper lib methods — no direct `/api/...` calls (2026-06-22, Kwan).** Full audit of the CSR direct-call surface in `docs/BC_CSR_DIRECT_CALL_AUDIT.md` (37 methods classified SAFE / CONFIRM-shape / MIGRATE / BC-ASK). Net: most lib-first reads/mutations are already lib-served. **Hard BC asks (5): A offer.findByShmName, B CSR billing.sale, C global commerceOrder, D userContact reads, E contactMessage server-side email filter.** Everything else migrates on OUR side (drop the direct fallback): user.find/findAdmin/findOrders/orderPayments/orderHistories, message.contact.find/histories/replyLinkUrl, managedContact.find, optOut.find, tracking.findUser, + drop dead `/database/search` ladders. **Two candidate asks (findAdmin "/cs-reps" + tracking scoping) were INVESTIGATED and DROPPED** — auth-gated probe (`scripts/probe-csr-findadmin-tracking-verify.js`) proved findAdmin({}) returns real CSR staff and tracking.findUser scopes per-user; the earlier "0" results were the `{brandId:'idlookup'}` trap + un-authed-session glitch. The `validate:_isUsableList` guard is the tell for fallback-rescued reads. **Why it matters:** the mandate removes the direct fallback, so any call relying on it breaks at cutover — this is launch-relevant for the CSR app. **Is lib-only standard practice?** Partially. A vendor-owned client SDK as the *sole* integration surface is a legitimate, common API-governance pattern (lets BC refactor the backend, centralize auth/validation/rate-limiting, version the contract, and keep clients off raw collection queries like `/database/search` — which is the real thing they're closing). BUT it's only reasonable if the SDK is *complete and well-shaped*; mandating it while the lib is missing methods (offer/billing/global-order/userContact) and mis-shaping others pushes the burden onto BC to ship those first. Standard shops pair such a mandate with a published, versioned, fully-covering SDK + deprecation window — not a hard cutover against an incomplete lib. **How to apply:** treat the audit's BC-ASK list as the gating dependency; migrate the CONFIRM/MIGRATE items ourselves once shapes are verified; ask BC for a deprecation window (keep direct working until the lib covers 100%) rather than a same-day cutover. See [[csr-direct-endpoint-csrwrapper-library-migration-map]] and [[csr-lib-live-evidence-2026-06-17]].

- **CI/CD:** No `.github/workflows/`. `vercel.json` is deploy-config only.
- **Toast notifications:** Still inline `useState + setTimeout` patterns (e.g., `NotesPage.js`). No shared toast component / context.
- **`perPage: 5`** in `apiRouter.js` for history endpoints — verify BC handles >5 cleanly before raising.
- **Jest baseline (2026-05-04):** 0 failures, 225 passing, 56 skipped across 14 suites. Two fully-skipped suites remain — both depend on `hooks/useSignup`:
  - **signupFlow** — all 13 fail. Form reduced to email+password+optin (no fullName/zip), logic moved into `hooks/useSignup` which pulls in `gtm`, `loginHistory`, `visitorSearchLog`, `api.createTracking`, `api.post('/searches/import')` — none mocked. Real rewrite. Pair with signupTransitions T1.
  - **signupTransitions** — T1 surfaces the same `useSignup` drift; T2/T4 cover PaymentPage but use the new "You're in!" / click-through model now exercised in paymentFlow.test.js, so those should be partially salvageable; T5 (apiRouter unit) is closest to current reality.
- apiCallSignatures has one inline skip: `member/SettingsPage — handlePrivacyToggle`.
- The earlier 26-failure baseline (2026-03-17) was resolved by skipping rather than fixing. Three suites revived this session: **adminPageUnwrapping** (commit `6919afd`, +7 tests), **memberGeneralSearch** (commit `dbafe68`, +18 tests), **paymentFlow** (+15 tests — copy drift + new click-through success model captured as positive assertion).
- **Side note (resolved 2026-05-07):** `MemberGeneralSearchPage.js` `COMMON_US_CITIES` Orlando, FL duplicate is gone — only one entry now (line 22).
- **Recommended next investment:** signupFlow + signupTransitions as a paired rewrite. Reuse the `useSignup` mock surface across both files.
- **`REACT_APP_USE_NEW_API_AUTH=true`** in `.env.production`. Consumer auth is now on BC; the mock-only auth note from older memories is stale.

## UX backlog
- **Inmate teaser: vary the person-icon color when there's no mugshot + >1 record (owner 2026-07-19, LATER).**
  On `InmateBookingTeaser` (and likely `InmateBookingSection`), when records have no mugshot we show a generic
  person icon on a fixed light-blue background (dark person). When there are multiple no-mugshot records, ALTERNATE
  the icon/background palette per row so they're visually distinct: light-blue/dark, light-green/dark, light-pink/dark
  (cycle). Small polish; do when back on the inmate teaser. Files: `src/components/InmateBookingTeaser.js` (the 👤
  placeholder block) + `src/components/InmateBookingSection.js`.
- **Payment page mobile view: put the vCard FIRST** (above the $1 trial price), not the price first (owner 2026-07-14). Lead with the person/value, then the price. `src/pages/sales/PaymentPage.js` — reorder for the mobile breakpoint. Ties to [[payment_ux_research]] and the [[project_wsfy_self_build]] payment-teaser work (free user → "see who's searching for you" paywall).

## WSFY backlog (owner 2026-07-14, deferred from the teaser pass)
- **WSFY payment/upsell teaser: REPLACE the vCard — ✅ RESOLVED 2026-07-16.** Both halves done. LAYOUT: the person-vCard is already suppressed in the WSFY/identity flow via `isSelfContext` (PaymentPage.js:178; the vCard blocks + promo are gated `&& !isSelfContext`), and `WsfyPaymentTeaser` is styled as the white-rectangle vCard footprint — so it's already the standalone replacement, not a hero above a vCard (the old "hero ABOVE" note was stale). CONTENT (commit `281965f`, bundle `public.28de962a.js` not yet on BC): `buildWsfySummary` now returns `sameStateCount` + `highlights[]` (named callouts — "1 worked at Google", "N went to Reed College", "N searching from your state", "N in your area", "N may be relatives"); named school/employer come from the subject's OWN enrichment. Teaser renders highlights above the blurred unlock rows. Verified live (matchedVia=mapped_identity, "1 worked at Google", sameState=5). Depends on `member_enrichment` being populated for the named school/employer callouts (else falls back to same-state/local/relative). See [[project_wsfy_self_build]].
- **WSFY matching logic should use the CONFIRMED self-identify record.** Now that users confirm their identity by matching a search record (self-identify → `member_enrichment.report_id` + `self_person`), the reverse-join can key on that confirmed record (stable attrs / report person) for higher-precision "who's searching for you" matching, instead of only name+state fuzzy. Further exploration. See [[project_wsfy_self_build]].
- **WSFY Phase 2 — Identity Teaser Payment page.** From Account → My Identity mapped-state vCard, "Control what's exposed →" routes to `/payment?upgrade=1&reason=identity`. Build a dedicated identity-teaser payment experience there: the member's own vCard + identity-specific sales copy (control/hide what's exposed, remove from brokers, see who's searching), distinct from the WSFY (`reason=wsfy`) and report-unlock flows. Owner 2026-07-14.
- **WSFY Phase 2b — combine WSFY + identity value props into ONE teaser** (owner 2026-07-14). Today the payment page branches reason=wsfy ("who's searching for you") vs reason=identity ("control what's exposed") into two teasers (WsfyPaymentTeaser / IdentityPaymentTeaser). Later, merge into a single unified teaser/value-prop (your record + who's looking + control), since they're the same identity-protection story. Note only — do not build yet.
- **WSFY page 'recent searches' → vCard visual metaphor** (owner 2026-07-14). WhoIsSearchingPage EventRow should adopt the vCard look (more obfuscated). Assume MANY searchers map themselves to records, so we can tease far more per searcher: a relative, a past location, occupation/school/employer overlap, etc. Depends on searcher enrichment (member_enrichment) being populated.

- **Identity verification gate — LARGELY ADDRESSED 2026-07-16 (commit `d33fa72`, consumer bundle
  public.91aa05df.js→368fb6a5.js NOT yet on BC).** Advisor-scoped: gate the surfaces that expose THIRD
  PARTIES, NOT report-viewing (that's the product). (1) WSFY real-name REVEAL gated server-side in
  buildWsfySummary — names unmask only when `matchedVia==='mapped_identity'` (mapping required KBA);
  paid-but-unmapped gets the masked tease + `revealGated` flag → closes "type any name → see who's
  searching". (2) Exposure CONTROLS: /api/suppression POST requires `hasMappedIdentity` → 403 else.
  (3) KBA retries CAPPED at 5 then locked → lockout points to ID scan OR a Contact-support link (/contact)
  (were unlimited vs public-data decoys). (5) EXPOSE MAPPED IDENTITIES (owner 2026-07-16, commit `b4ecd12`):
  a searcher/viewer who CLAIMED their own identity is shown by real name even to a reveal-gated subject
  (anon/unmapped stay masked; suppression still drops hidden members); events/keySignals/viewers carry a
  `mapped` flag; WhoIsSearchingPage shows a 'Verified member' chip. (4) Client: WhoIsSearchingPage
  "Claim your record to reveal names" prompt when revealGated; IdentityOnboardingModal now leads with
  the real WSFY count. **DECISION I MADE (owner was away — CONFIRM):** reveal requires MAPPED-only
  (not card-tier); `REVEAL_REQUIRES` const in wsfy.mjs is one line to also accept card_info. **CEILING
  (still open):** tier + selfUserId are client-asserted (app-key only) → full closure needs WSFY
  auth-hardening (derive both from a trusted BC token); this NARROWS the hole, doesn't fully close it.
  **BEHAVIOR CHANGE:** paid members who reached WSFY via card/self-provided drop from reveal → tease.
  See [[project_wsfy_self_build]]. Original note (for context):
- **Identity mapping has NO identity verification (owner 2026-07-14, MUST-fix before wide launch).** Today the self-identify flow ([[project_identity_management]] / `SelfIdentifyCard`) lets a member map to ANY public record just by selecting it — we never prove they ARE that person. This is a real privacy/security hole: someone could claim a stranger's record and then see that person's WSFY activity ("who's searching for you"), exposure profile, per-item hide controls, and pull the full background report on them. Need a verification step during mapping before granting the identity dashboard. **Options to scope:** knowledge-based verification (KBA — quiz on facts from the record: prior address, relative name, etc.), phone/SMS or email OTP to a contact on the record, doc/ID verification (heavier), or a BC-side identity-proofing capability if one exists/lands. Likely a **BC ask** for a proofing endpoint + our client flow. **How to apply:** gate the paid identity surfaces (report pull, WSFY reveal, exposure controls) behind verification; a mere name/city/age self-match is NOT proof. Until built, treat mapping as unverified/self-asserted. See [[project_identity_management]], and the per-user auth gap in [[project_wsfy_self_build]] (WSFY-AUTH) — related but distinct (that's app-vs-user auth; this is are-you-really-this-record).

- **Resilient zero-result handling (IDI TooManyMatches + volatility) — BEFORE Phase 6 (owner 2026-07-20).** Common names (John/James Smith, FL) and INTERMITTENT failures both surface as zero-results; search was totally down 7/8–7/12. Root: IDI caps over-broad searches (by design) + transient IDI/BC failures — today both collapse to `thinMatchNoResults` so we can't retry smartly. **Plan (full detail in `docs/reporting/toomanymatches-diagnosis.md`):** (1) **BC ask — detailed error code** on zero results (TooManyMatches vs provider-down vs genuine-zero, + a match count) — PREREQUISITE; (2) **smart error-code-driven retry** on name/state zero-results: TooManyMatches → narrow by age-if-given-else-largest-city (1–2 retries, honest "likely matches in {city}", "deep search" GUI interstitial), transient → retry-same-once, genuine-zero → thin-match offer; (3) **first-party fallback** (incarceration + SEO people directory) when IDI capped/down = durable resilience; (4) investigate the 7/8–7/12 outage w/ BC. Sequencing: (1) before (2); do BEFORE unraveling legacy teasers ([[project_signals_augmentation]] Phase 6). NOT a BC/IDI "bug" — IDI cap is by-design; our client mishandles it. ALSO consider going straight to Enformion PersonSearch (we already integrate Enformion for divorce+enrich) to sidestep IDI TooManyMatches+volatility. DEFERRED 2026-07-20 — Phase 6 NO LONGER gated on this; proceeding with legacy-teaser removal separately.

## Onboarding-animation experience (per-flow config flag) — DONE 2026-07-21 (OnboardingReveal, campaign.onboarding|?onboard=1)
Configurable onboarding animation keyed off the landing flow (`/name/landing/v<x>`), shown
AFTER search results, BEFORE the SUP or Payment page. Requirements:
- Config flag PER landing-page flow (v<x>) to enable/disable it.
- Experience similar to v11's BV-style loader.
- If we DON'T have the visitor's email, CAPTURE it during this flow (reuse `captureEmail`).
- Show LOTS of teaser/enrichment data during the experience (build anticipation/value).
- Target duration ~15 seconds.
- Then hand off to SUP or Payment per the flow's config.
