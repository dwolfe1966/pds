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

## Latest bundle hashes (2026-05-30 EOD)

- **Consumer:** `build/public.e46c7124.js` + css `public.c445a384.css` *(currently live on BC's VPS as of 2026-05-30 EOD)*
  Includes: full bug-list pass, OPTOUT flip, opt-out portal handoff fix
  (sync gesture + correct receiver), pre-deploy hygiene (test markers
  stripped, dead routes/pages dropped, brand-driven prices in VariantB),
  and `/search-history` re-added to MemberNav as "History".

- **Consumer (newer, NOT YET DEPLOYED):** `build/public.88b26763.js` + css `public.c445a384.css`
  Adds: real-production fix to `src/utils/reportExtract.js` so Relatives section
  populates from BC's `relationList` (was silently empty on every report).
  Also includes the test-infra refactor of `src/services/brand.js` (import.meta.url
  → static asset import — runtime behavior identical, just forces a new hash).
  **Owner can defer the re-upload** until #40/#43/#58/OPTOUT verifications land
  against `e46c7124` — only the relatives fix is user-visible; everything else
  is test infrastructure.

- **Admin:** `build-admin/admin.51fea1e8.js` + css `admin.de3592b0.css`
  Includes: launch-gap audit items 8-11 (UserDetail Notes tab merge,
  EmailTickets ?contactMessageId= deep-link, UsersPage name-search
  guard, data-removal partial-failure visibility).

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

**Admin (deferred):**
- **#60** CSR search likely fixed in admin source; waiting on BC's admin redeploy
- **#61** Admin direct links finicky (only the csr-login URL works)
- **#62** Same as #61 — symptom of router/SPA serving issue

## What to do on resume (snapshot 2026-05-30 EOD)

State of play: bug-list CSV fully addressed (shipped / closed-as-fixed / BC-asked / backlog'd). Two follow-up audits ran this session — pre-deploy hygiene (items 1-6) and admin items 8-11 — both shipped. Only the LAUNCH-GAP AUDIT item 7 was deferred at session end.

**Outstanding items, in order of priority:**

1. ~~**Audit item 7 — admin.html absolute script URLs.**~~ **Closed as non-issue (2026-05-30 resume).** Source `public/admin.html:11,15` keeps absolute URLs for local dev convenience, but `scripts/postbuild-admin.js` rewrites both `<script src>` to root-relative `/libs/api-wrapper/index.iife.js` and `/libs/csr-wrapper/index.iife.js` at build time. Confirmed in current `build-admin/index.html`. Equivalent consumer rewrite handled by `scripts/postbuild.js` — built `build/index.html` also uses `/libs/...`. No code change needed; do NOT edit the source `public/admin.html` to be relative (would 404 in `npm start` dev — BC's CDN serves the live IIFE there).

2. **Owner verifications outstanding** (against current bundles above):
   - **#40** — re-run `(909) 663-7878` member phone search. Expect: jumps straight to a report (contextKey now sent). If still errors, paste the new `[API Router] create-report failed — raw response:` line.
   - **#43** — re-run "John Smith CA" member search. Expect: new empty-state copy ("Common names with broad filters…"). If BC's raw response shows results being filtered out vs BC returning empty, that's a different bug — paste the dev console.
   - **#58** — fresh signup → AccountPage billing history should show the synthesized $1 trial line (built from `commercePriceRules.find(_DESC_==='S0')`).
   - **OPTOUT live flow** — `.env.production REACT_APP_USE_NEW_API_OPTOUT=true` is now live. Test the BC-hosted portal end-to-end (open portal works; confirmation deep-link `?awqh[...]=` still needs prod-side verification when BC sends the email).
   - **Opt-out portal styling** — BC ask filed (`BC_OPTOUT_FORM_STYLING.md`); cosmetic only, not a verifier task.
   - **Relatives section (NEW 2026-05-31)** — only triggers on the *new* consumer bundle `public.88b26763.js`, NOT the currently-deployed `public.e46c7124.js`. After uploading the new bundle: open any report → scroll to "Relatives & Associates" Section 5. Expect: populated rows for any record where BC returns `relationList`. Previously every report rendered an empty Relatives section due to a key-name bug in `src/utils/reportExtract.js` (was reading `relationshipList`, BC actually returns `relationList`). The stats card "Relatives" count will also flip from always-0 to the real number.

3. **Admin trio (#60 / #61 / #62)** — **BC redeployed 2026-05-30 23:25 GMT** (verified by deploy-verifier 2026-05-31). Deployed bundle hashes at `dev.admin.www.bytecrtrs.com/csr/` match local `admin.51fea1e8.js` + `admin.de3592b0.css` byte-for-byte. **Ready for owner verification:** #60 (CSR search), #61 (admin direct links), #62 (same routing class as #61).

4. **Backlog items (#34, #35, #42, #51)** — owner direction needed before any code change; tracked in `project_backlog.md` with rationale.

5. **Dependabot vulns** — all 4 are dev/optional-service scope (qs in `server/` and `tracking-api/` node_modules; ws + babel-systemjs in dev tooling). None ships in consumer bundle. Update on next dep refresh, post-launch.

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
