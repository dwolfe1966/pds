---
name: Bug-list execution status (2026-05-29)
description: Live tracker for the bug-triage execution from docs/qa/bug-triage-2026-05-29.md. Records what's shipped, what's next, and the latest consumer/admin bundle hashes. Update as items close.
type: project
originSessionId: 82d207c3-e509-423a-ac06-a3f99d812fa1
---
**Source list:** `docs/qa/bc client library - Bugs.csv` (62 items, ~20 pre-2026-05-29 complete).
**Triage doc:** `docs/qa/bug-triage-2026-05-29.md` (top-10 execution order).
**Deploy mechanism:** Owner deploys via FileZilla; BC cron picks up changes every ~60s.
**Owner directive (2026-05-29):** *"we are falling into a mode where we are wanting BC to make changes, instead of innovating and working around what they have built."* See `feedback_innovate_dont_wait_for_bc.md`.

## Shipped this session

| Bug | What landed | Bundle |
|---|---|---|
| #50 | Reactivate CTA when cancelled-in-period (was hitting `nonMemberOnlyCommerceOffer`). `handleReactivate` calls `cancelSubscription(orderId, { flag: false })`. | consumer `12afed5f` |
| #59 / #56 / #49 | `refreshSubscription` now treats cancelled-but-in-period (`subStatus==='canceled' && dueTimestamp > now`) as **operative**. `isPaid=true` covers paid window. Subscription object exposes `subStatus`. AccountPage shows "Canceling" badge + "Access until" + Reactivate button. Dashboard/search/report-list gates inherit via `isPaid`. | consumer `12afed5f` |
| #21 | BC ask drafted at `docs/BC_SIGNUP_WELCOME_EMAIL.md` — no client work, no backend. Launch posture: acceptable gap. | n/a |
| #28 | `validatePassword` reduced to 8-char min only. UI checklist trimmed to single row. **May regress if BC enforces complexity server-side** — test in dev. | consumer `a84bf338` |
| #52 | New `src/utils/email.js` with stricter regex `/^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/`. Wired into SignupPage submit with inline red error + red border. | consumer `a84bf338` |
| #37 | Validation entries for `billingFirstName`/`billingLastName`/`billingZip` on PaymentPage; submit-fail sets touched → red border via existing `styles.inputError`. | consumer `757a20b4` |
| #54 | ZIP capped at exactly 5 digits — `maxLength=5` + `onChange` strip + validation `/^\d{5}$/`. | consumer `757a20b4` |
| #31 | `formatExpiry` auto-prefixes `0` when first digit is 2-9 (single-digit month). Handles paste `926` → `09/26`. | consumer `e3fb86e7` |
| #38 | `window.scrollTo({top:0, behavior:'smooth'})` after payment success — no more landing on the footer. | consumer `4068bd49` |
| #46 | `SubscriptionTile` moved from above stats row to just above disclosure footer on Dashboard2. | consumer `4068bd49` |
| #48 | Replaced "🔍 Run a new search" button with `InlineNameSearch` (first/last/2-letter state) submitting to `/people-search?firstName=…&lastName=…&state=…` (MemberGeneralSearchPage already reads those params). Account/Contact buttons survive as smaller secondary actions. | consumer `4068bd49` |
| #53 | **Explicitly skipped.** Owner ack'd: red borders by default would dilute the actual error signal #37 just wired. | — |
| #55 | Status-first error classifier in PaymentPage outer catch: 401/403/`session\|expired\|unauth` → "Session expired", 409/`exists\|duplicate` → "Account exists, sign in instead", 402/decline-words → card decline (unchanged copy), 5xx → "trouble processing payments." Also replaced hardcoded "Your card was declined" fallback at line 382 with neutral "couldn't complete subscription." | consumer `779662e4` |
| #58 | AccountPage billing-history flatMap now synthesizes a single sale row per order when BC's `commercePayments[]` is empty — pulls amount from `commercePriceRules.find(_DESC_==='S0').candidates[0].id` and date from `orderTimestamp`. Owner confirmed history was completely empty post-signup. Real commercePayments take over when BC populates them later. | consumer `bce2685c` |
| #47 | Dropped "$29.99/month" suffix from two "Upgrade to Pro" CTAs that link to `/payment` (which actually offers a $1 trial). AccountPage:1147 and DashboardHome:1118 now just say "Upgrade to Pro". Also note: hardcoded $29.99 contradicts `brand.recurringPrice = $49.98` — broader copy-audit gap. | consumer `7fc30136` |
| #44 | **Closed as already-fixed.** Owner confirmed the 2026-05-26 web-report parity push (commit `345530b`, criminal/financial/property/licences extractors in `src/utils/reportExtract.js`) covers the gap the bug submitter flagged. | n/a |
| #45 | BC ask drafted at `docs/BC_PDF_DISCLAIMER.md` — asking whether the "fictional data" disclaimer is dev/sandbox-only (resolves on prod cutover) or unconditional (needs BC template change). Launch posture if BC blocks: soft-disable the "⬇ Download PDF" CTA on `SearchResultDetailPage` rather than ship a doc that says the report is fake. | n/a |
| #35 | **Deferred — backlog'd.** Owner concerned a compliance-led "I AGREE. VIEW REPORT NOW!" CTA would tank conversion vs current "Unlock Report — $1 Today" / "Start Trial — $1 Today" at `PaymentPage.js:875-876`. If revisited, A/B test rather than global swap. Tracked in `project_backlog.md`. | n/a |
| #33 | PaymentPage SUP "visit our contact form" `<Link to="/contact">` now opens in a new tab (`target="_blank" rel="noopener noreferrer"`) so cardholders don't lose their entered payment data mid-checkout. `Link` is react-router-dom — passes target through to the underlying `<a>`. | consumer `5c3f9159` |
| #26 | **Closed as already-fixed.** No `support@` anywhere in Footer.js or codebase; `brand.js` explicitly notes inbound support routes through `/contact`. Prior cleanup must have removed it. | n/a |
| #30 | Tightened mobile vertical rhythm on PaymentPage form: at ≤480px, `.fieldGroup margin-bottom 1.25rem → 0.75rem`, `.fieldRow gap 1rem → 0.75rem` (matters when grid collapses single-column), `.formCard padding 1.5rem → 1.25rem`. Desktop spacing unchanged. | consumer/css `41f8904d` / `79337ae6` |
| #32 | Same `target="_blank"` treatment as #33 for `<Link to="/terms">` and `<Link to="/privacy">` in the SUP disclosure. True lightbox is a deeper UX build; new-tab achieves the don't-lose-cart goal with one-line changes. | consumer `41f8904d` |
| #36 | Wrapped the "I'll upgrade later — go to my dashboard" button at PaymentPage:894-902 in `{token && (...)}`. Visible only for authenticated upgraders (the AccountPage/DashboardHome "Upgrade to Pro" flow); hidden for the unauthenticated signup funnel where /dashboard would just bounce. | consumer `41f8904d` |
| #27 | **Closed as already-fixed.** SignupPage.js:141-144 already shows "We'll only use your email for login, receipts, and account alerts. Never sold, shared, or used for marketing without your consent." plus opt-in checkbox at :179-187. | n/a |
| #29 | `.summaryCancel` on PaymentPage.module.css darkened from `#9ca3af` (gray-400, ~2.6:1 contrast on white — fails WCAG AA) to `#4b5563` (gray-600, ~6.3:1 — clear AA). Did NOT remove the disclosure per bug submitter's stronger suggestion — keeping the strip provides redundancy with the bottom SUP block. | consumer/css `47d260d0` / `c445a384` |
| #43 | Replaced member SRP empty-state copy at SearchResultsPage.js:441-446. Was "No results found / Try adjusting…"; now "No results to display / Common names with broad filters can return too many matches… narrow with middle initial, state, city, or ZIP… phone/email tend to land more directly." Trusts bug submitter's hypothesis that BC is over-matching, not under-matching. **Verification gap:** owner should re-run "John Smith CA" with dev console open to confirm BC actually returns empty (vs filtered/erroring). | consumer `47d260d0` |
| #57 | **Closed as already-fixed.** AccountPage.js:1109-1124 shows "Reactivate Subscription" whenever `subscription.subStatus === 'canceled'`. The #59 work made cancelled-but-in-period operative and exposed `subStatus`, so the button appears in exactly the state #57 describes. | n/a |
| #39 / #41 | **Closed as already-fixed** — covered by the 2026-05-26 web-report parity push (commit `345530b`). Owner has visual ack of post-parity report (per #44 confirmation). | n/a |
| #40 | Owner ran `(909) 663-7878` in dev — BC returned `412 → 400` on `/api/idLookup/report/create`. Bug was `createReportForPhone` not sending `contextKey`. Stale comment "no verified phone.report context key" was wrong; IIFE exposes `window.ApiWrapper.contextKey.sale.phone.report` and BC docs list it. Added contextKey to params; deleted the stale comment. Verify by re-running same number. | consumer `dcb7445f` |
| CSR-Collected-sum | PurchaseDetail / OrdersPage / UserDetail were reading BC's `transient.amount.collected`, which sums rejected payment attempts. Fixed by computing from `commercePayments[].status === 'fulfilled'` (with `type === 'sale'`) via new `src/utils/orderFinancials.js`. Refund modal pre-fill also fixed. Test pins the exact regression. | admin `084c1f38` → `4642ae89` |
| CSR-tabs-empty | `fetchLogins` / `fetchActivity` in UserDetailPage applied `docs.filter(d => d.updaterId === id)` to BC's tracking response — but BC's `displayFields` excludes `updaterId`, so filter wiped every doc. Surfaced today during CSR testing; **pre-existing since 2026-04-20** (commit `7692c73`), NOT caused by the Collected-sum fix earlier the same day. Server-side filter via `query.updaterId` already scopes correctly — verified from the response (consistent sessionId/clientId/IP across all returned docs). | admin `4642ae89` |

## Latest bundle hashes (2026-05-30 EOD)

- **Consumer:** `build/public.e46c7124.js` + css `public.c445a384.css` *(currently live on BC's VPS as of 2026-05-30 EOD)*
  Includes: full bug-list pass, OPTOUT flip, opt-out portal handoff fix
  (sync gesture + correct receiver), pre-deploy hygiene (test markers
  stripped, dead routes/pages dropped, brand-driven prices in VariantB),
  and `/search-history` re-added to MemberNav as "History".

- **Consumer (newer, NOT YET DEPLOYED):** `build/public.aea02ad1.js` + css `public.c445a384.css`
  (was `88b26763`; rebuilt 2026-06-01 — the shared `apiWrapper.js` Messages fix
  `a025577` bakes into the consumer bundle too. Difference vs `88b26763` is
  INERT for consumers: `csrFindUserContactMessages` is CSR-only, never called
  here. Re-upload optional — no consumer-facing change. `88b26763` is what's
  currently live on the consumer host.)
  Adds: real-production fix to `src/utils/reportExtract.js` so Relatives section
  populates from BC's `relationList` (was silently empty on every report).
  Also includes the test-infra refactor of `src/services/brand.js` (import.meta.url
  → static asset import — runtime behavior identical, just forces a new hash).
  **Owner can defer the re-upload** until #40/#43/#58/OPTOUT verifications land
  against `e46c7124` — only the relatives fix is user-visible; everything else
  is test infrastructure.

- **Admin (currently live):** `build-admin/admin.51fea1e8.js` + css `admin.de3592b0.css`
  Includes: launch-gap audit items 8-11 (UserDetail Notes tab merge,
  EmailTickets ?contactMessageId= deep-link, UsersPage name-search
  guard, data-removal partial-failure visibility).

- **Admin (newest, NOT YET DEPLOYED):** `build-admin/admin.844a2f72.js` + css `admin.de3592b0.css`
  (supersedes `93d93b68`/`aec3021e`. `844a2f72` = `93d93b68` + a behavior-
  preserving test refactor: `latestPaymentInfo` device/IP logic extracted to
  `orderFinancials.getLatestPaymentDeviceInfo` so the paymentTimestamp-epoch
  sort is unit-tested. INERT vs the staging-verified `93d93b68` — re-upload
  optional. Staging currently runs `93d93b68`. Commits a025577 + test commits.)
  - **Messages tab regression FIXED (2026-06-01).** The aec3021e IIFE-first
    change (commit f156c11) fixed Notes but BROKE Messages: routing
    `csrFindUserContactMessages` through `csrWrapper.api.user.findUserContacts`
    first returned BC's non-standard envelope (truthy object, no `docs[]`),
    which short-circuited the working fallbacks (direct REST → inbox-wide GET
    + client filter) → empty Messages list on UserDetail. Same trait already
    documented one method up: `csrFindContactMessages` is "Direct only" because
    BC's sibling `api.message.contact.find` returns the same awkward envelope.
    Fix (in OUR `src/services/apiWrapper.js`, NOT BC's IIFE): removed the
    IIFE-first block from `csrFindUserContactMessages` only; Notes keep their
    IIFE path (`csrFindUserAdminNotes`, where BC's envelope matches).
    **VERIFIED in staging 2026-06-01** — owner confirmed BOTH Notes & Messages
    render on test1@gmail.com user detail. Rolls up everything in aec3021e
    below, plus this fix. CLOSED.
  Rolls up four 2026-05-31 admin fixes:
  - **Notes & Messages tab empty.** BC's deployed CSR backend started
    returning 400 on `GET /message/admin/findNotes` and 404 on
    `POST /contactMessage/admin/find/:userId`. For NOTES, the IIFE method
    (`csrWrapper.api.user.findUserAdminNotes`) attaches whatever csr-side auth
    fields BC now requires and works — kept IIFE-first. For MESSAGES, the IIFE
    `findUserContacts` returns the wrong envelope (see 2026-06-01 fix above) —
    reverted to direct REST + inbox-filter. (Surfaced on test1@gmail.com.)
  - **UserDetail white page** (pre-existing). `latestPaymentInfo` sort used
    `(b.paymentTimestamp || b.createdAt || '').localeCompare(...)` but BC's
    `paymentTimestamp` is a numeric Unix-ms — `Number.prototype.localeCompare`
    doesn't exist, throws TypeError, React unmounts. Crashed UserDetail for
    user `6a1bb9d068c31e075cae9af6` (test1@gmail.com). Fixed by normalizing
    to epoch via `new Date(v).getTime()` before subtracting.

  Earlier 2026-05-31 fixes (also rolled into this bundle):
  - **CSR Collected sum** (was admin.084c1f38) — now reads from
    `commercePayments[].status === 'fulfilled'` instead of trusting BC's
    pre-summed `transient.amount.collected` (which included rejected
    attempts). Bug surfaced on order `6a1bb9d068c31e075cae9b12`
    (test1@gmail.com): showed $100.96 collected on an order that only
    ever collected $49.98. Refund modal pre-fill also fixed.
  - **CSR Searches/Reports/Logins tabs empty** (pre-existing since
    2026-04-20, surfaced today). `fetchLogins`/`fetchActivity` were
    applying `docs.filter(d => d.updaterId === id)` to BC's response, but
    BC's `displayFields` excludes `updaterId` from returned docs — filter
    wiped every row. Server-side filter (`csrFindUserTracking` passes
    `query.updaterId`) is doing the scoping correctly; removed the broken
    client-side filter.

## Top-10 execution order (still in flight)

From `docs/qa/bug-triage-2026-05-29.md`:

1. ✅ #50
2. ✅ #59
3. ✅ #49/#56 (folded into #59)
4. ✅ #21 (BC ask only — accepted as launch gap)
5. ✅ #52
6. ✅ #28
7. ✅ #37
8. ✅ #31
9. ✅ #38 + #46 + #48 batched
10. ✅ #55

## Next up (post top-10, per triage P1 ordering)

Top-10 + initial extensions all addressed. Remaining open in `bc client library - Bugs.csv` (status mostly blank; cross-reference against shipped table above):

**Sales/payment polish:** all shipped or closed (#26 / #27 / #29 / #30 / #32 / #33 / #36). #34 backlog'd per owner conservative-route direction (same risk class as #35 — going less-compliant on affiliate shN traffic flagged for separate decision).

**Member/report:** #39 / #41 / #43 / #57 all addressed (closed-as-fixed or copy-shipped). #42 backlog'd (sweeping feature removal — needs usage data, not a launch fix). #51 backlog'd (thin-match flow is a feature build, not a polish item).

**Admin (deferred) — validated 2026-06-01 against deployed `admin.93d93b68.js`:**
- **#60** CSR search: code present in deployed bundle (email/phone/ZIP/last4;
  name-search shows "not supported yet"). `/csr/admin.93d93b68.js` confirmed
  live (HTTP 200) on dev.admin.www.bytecrtrs.com. Needs one empirical search
  test w/ CSR login to fully close; code-wise fixed & shipped.
- **#61 / #62** Direct deep-links / SPA refresh: **FIXED — verified live
  2026-06-02.** `/csr/login`, `/csr/users`, `/csr/tickets` now all return 200
  serving the real SPA shell (`ByteCrtrs Admin` + `admin.844a2f72.js`). The host
  SPA catch-all is working. (Was 404 on 2026-06-01; BC ask doc
  `BC_ADMIN_SPA_ROUTING_404.md` was filed; resolved by 2026-06-02 — host config
  fixed + 844a2f72 uploaded.) **Admin bundle 844a2f72 is now LIVE** on
  dev.admin.www.bytecrtrs.com/csr/ (owner uploaded). Consumer live = 88b26763.

## What to do on resume (snapshot 2026-05-31 EOD)

**State of play:** Test suite went from 199 passing/16 failing/55 skipped to **277 passing/0 failing/0 skipped across 17 suites**. One real consumer P1 (relatives extraction) and four admin CSR bugs were caught + fixed live in this session as the owner tested test1@gmail.com.

### Bundles waiting for owner upload

- **Consumer `public.88b26763.js`** — `reportExtract.js` relatives fix (was silently empty on every report). Live consumer is still `public.e46c7124.js`; defer upload until owner-verifications in flight land if you want, then upload.
- **Admin `admin.aec3021e.js`** — rolls up ALL four admin fixes from today (Collected-sum / Searches-Reports-Logins tabs / UserDetail white-page / Notes-Messages routing). Live admin is still `51fea1e8.js`. **Upload this when ready** to verify the Notes & Messages IIFE-first routing works on BC's deployed backend.

### Outstanding owner verifications (carry-over from 2026-05-30 EOD, still valid)

These are against the current LIVE bundles (`e46c7124` / `51fea1e8`):
- **#40** — `(909) 663-7878` member phone search → expect jump-to-report.
- **#43** — "John Smith CA" → expect new empty-state copy.
- **#58** — fresh signup → synthesized $1 trial line on AccountPage.
- **OPTOUT** — BC-hosted portal end-to-end (confirmation deep-link still needs prod verification when BC sends email).

### Outstanding owner verifications AFTER uploading the new bundles

Against `88b26763` (consumer):
- **Relatives section** — open any report → "Relatives & Associates" Section 5 should populate from BC's `relationList`. Stats card "Relatives" count flips from always-0 to real number.

Against `aec3021e` (admin) — re-test test1@gmail.com user detail:
- **Order summary Collected** should match Payment History (fulfilled sales only).
- **Searches / Reports / Logins tabs** should populate (server-side filter works; redundant client filter was wiping every row).
- **UserDetail page** loads without white-screen (paymentTimestamp.localeCompare fix).
- **Notes & Messages tab** should populate. If still empty, paste the Network-tab requests for `/message/admin/findNotes` and `/contactMessage/admin/find` — IIFE-first should be hitting different paths now. Direct fallback would log `dbg` lines in dev (stripped in prod).

### Other carry-over

- **Admin trio (#60 / #61 / #62)** — already verifiable on live `51fea1e8` per the 2026-05-31 morning deploy-verifier run. Owner verification still pending.
- **Backlog items (#34, #35, #42, #51)** — owner direction needed.
- **Dependabot vulns** — all 4 dev/optional-service scope, post-launch.

### Memory artifacts written today

- `reference_jest_static_asset_imports.md` — fileMock pattern for src files that import .png/.svg/etc.
- `reference_authcontext_test_pattern.md` — useAuth() + flushAsync (two ticks).
- `feedback_no_clientside_filter_on_bc_database_search.md` — the bug class that regressed twice in admin tracking tabs; do NOT add client `.filter()` on `/database/search` responses.

### Today's commit summary (8 commits, all on `main`, ahead of origin)

```
bc1b5f4 chore(memory): admin bundle aec3021e + Notes/Messages IIFE-first fix
f156c11 fix(admin): Notes & Messages tab — route through IIFE first
60bb3e5 chore(memory): admin bundle 389ddd78 + UserDetail white-page fix
ab625e2 fix(admin): white page on UserDetail — paymentTimestamp.localeCompare crash
24ca326 chore(memory): feedback — never client-filter BC /database/search response
6905444 chore(memory): admin bundle 4642ae89 + CSR tabs-empty fix
c22686e fix(admin): CSR Searches/Reports/Logins tabs were empty
e1d43b5 chore(memory): admin bundle 084c1f38 + CSR-Collected-sum fix
8620d33 fix(admin): CSR tool Collected sum included rejected payment attempts
14b61f8 chore(memory): EOD snapshot — test-suite session (2026-05-31)
3799043 test: get suite into amazing shape — 199→267 passing, 0 failing, 0 skipped
```

### Non-blocking follow-ups (defer unless asked)

From the console log when the UserDetail white-page was diagnosed:
- `GET .../csr/[object Object] 404` — somewhere an object is passed as an `<img src>` / href.
- `POST .../contactMessage/admin/find/<id> 404` and `GET .../message/admin/findNotes?userId=<id> 400` — these will likely resolve when `admin.aec3021e.js` ships (IIFE-first routing). If they persist after upload, BC may have changed required query params.

## Open BC asks from this session

- `docs/BC_USERCONTACT_LIST_404.md` — **resolved** by BC 2026-05-28 (shipped `getUserContacts`); now superseded by:
- `docs/BC_GETUSERCONTACTS_SCOPE.md` — `getUserContacts` returns empty for member-submitted threads because `contact.create` doesn't auto-set `content.targetUserId`. We're shipping explicit `targetUserId` in the create body (consumer build had this in `3ea0db57`, carried forward). Three fix options proposed; awaiting BC reply.
- `docs/BC_SIGNUP_WELCOME_EMAIL.md` — please trigger welcome email on `commerceBilling/signup`. Low priority, launch-acceptable gap.
- `docs/BC_PDF_DISCLAIMER.md` — "fictional data" disclaimer prefix on `downloadPdfReport` output. Question whether dev-only or unconditional. Soft-disable PDF CTA is the launch fallback.
- `docs/BC_OPTOUT_FORM_STYLING.md` (filed 2026-05-30) — BC's hosted opt-out form at `/api/optOut/view/search` doesn't match the idlookup brand. Sent brand tokens (primary `#0d5d2f`, gray scale, radii, font stack). Launch posture: acceptable gap.

## Key code locations touched this session

Consumer:
- `src/context/AuthContext.js` → `refreshSubscription` operative-order logic
- `src/pages/member/AccountPage.js` → `handleReactivate`, Reactivate button, "Canceling" badge, synthesized billing-history row (#58)
- `src/pages/member/Dashboard2.js` → SubscriptionTile relocated, `InlineNameSearch` component
- `src/pages/member/DashboardHome.js` → Upgrade-to-Pro CTA cleanup
- `src/pages/member/SearchResultsPage.js` → SRP empty-state copy (#43)
- `src/pages/sales/PaymentPage.js` → billing validation, smart expiry, 5-digit ZIP, scroll-to-top, status-first error classifier (#55), SUP link targets (#33 #32), conditional skip-link (#36), mobile rhythm (#30)
- `src/pages/sales/SignupPage.js` → email validation + reduced password rules
- `src/pages/sales/OptOutLandingPage.js` → BC-hosted-portal handoff (sync gesture + correct receiver, 2026-05-30)
- `src/pages/sales/SearchDetailPreviewVariantB.js` → brand-driven prices (audit item 3)
- `src/pages/sales/NameSearchLandingV5Page.js` → debug markers stripped (audit item 1)
- `src/services/reportService.js` → `createReportForPhone` contextKey (#40)
- `src/services/apiWrapper.js` → `getUserContacts` wired; `goToOptOutPage` receiver fixed
- `src/components/MemberNav.js` → "History" nav entry
- `src/components/Footer.js` → AddonPage link removed
- `src/utils/email.js` (new) → strict-regex validator
- `src/App.js` → dropped /addon /cpcc /phone-search* /phone-search-loading /phone-search-results; test marker stripped
- `.env.production` → `REACT_APP_USE_NEW_API_OPTOUT=true`
- Deleted: `OptOutSearchResultsPage.js`, `OptOutInfoInputPage.js`, `AddonPage.js`, `PhoneSearchLandingPage.js`, `CPCCPage.js`

Admin:
- `src/pages/admin/UserDetailPage.js` → Notes tab merges adminFindUserAdminNotes (#8); data-removal partial-failure visibility (#11)
- `src/pages/admin/EmailTicketsPage.js` → ?contactMessageId= deep-link (#9)
- `src/pages/admin/UsersPage.js` → name-search guard (#10)
- `src/components/AdminNav.js` → placeholder tightened (#10)

Docs (BC asks filed this session):
- `docs/BC_PDF_DISCLAIMER.md`, `docs/BC_OPTOUT_FORM_STYLING.md`

Final commit before session end: `b0308a8 fix(admin): launch-gap audit items 8-11`. All pushed to origin/main.
