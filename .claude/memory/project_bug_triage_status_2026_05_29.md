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

## Latest bundle hashes

- **Consumer:** `build/public.a4cbbaf2.js` + css `public.c445a384.css` (2026-05-29 late, after `.env.production` OPTOUT flip)
- **Admin:** `build-admin/admin.5db1e886.js` (from earlier in the same session, F8 retest checklist + admin notes fix awaiting BC redeploy)

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

## What to do on resume

The full CSV is now either shipped, closed-as-fixed, BC-asked, or explicitly backlog'd with reasons. Remaining open work:
1. **Admin trio (#60/#61/#62)** — verify after next BC admin redeploy. Spawn `deploy-verifier` agent to compare deployed admin bundle against local `build-admin/`.
2. **#40 (member phone search)** — still deferred; need 5-min repro to determine BC-side vs us-side.
3. **#43 verification** — owner should re-run "John Smith CA" with dev console open; confirm BC truly returns empty (vs filtered/erroring). If error masquerading as empty, revisit copy and add error-state branch.
4. **Backlog items (#34, #35, #42, #51)** — owner direction needed before any code change; tracked in `project_backlog.md`.

## Open BC asks from this session

- `docs/BC_USERCONTACT_LIST_404.md` — **resolved** by BC 2026-05-28 (shipped `getUserContacts`); now superseded by:
- `docs/BC_GETUSERCONTACTS_SCOPE.md` — `getUserContacts` returns empty for member-submitted threads because `contact.create` doesn't auto-set `content.targetUserId`. We're shipping explicit `targetUserId` in the create body (consumer build had this in `3ea0db57`, carried forward). Three fix options proposed; awaiting BC reply.
- `docs/BC_SIGNUP_WELCOME_EMAIL.md` — please trigger welcome email on `commerceBilling/signup`. Low priority, launch-acceptable gap.
- `docs/BC_PDF_DISCLAIMER.md` — "fictional data" disclaimer prefix on `downloadPdfReport` output. Question whether dev-only or unconditional. Soft-disable PDF CTA is the launch fallback.
- `docs/BC_OPTOUT_FORM_STYLING.md` (filed 2026-05-30) — BC's hosted opt-out form at `/api/optOut/view/search` doesn't match the idlookup brand. Sent brand tokens (primary `#0d5d2f`, gray scale, radii, font stack). Launch posture: acceptable gap.

## Key code locations touched this session

- `src/context/AuthContext.js` → `refreshSubscription` operative-order logic
- `src/pages/member/AccountPage.js` → `handleReactivate`, Reactivate button, "Canceling" badge, paste-link UI removed earlier, debug aids gated behind `?debug=1`
- `src/pages/member/Dashboard2.js` → SubscriptionTile relocated, `InlineNameSearch` component added
- `src/pages/sales/PaymentPage.js` → billing validation entries, smart expiry, 5-digit ZIP, scroll-to-top on success
- `src/pages/sales/SignupPage.js` → email validation + reduced password rules
- `src/hooks/useSignup.js` → `validatePassword` simplified to 8-char min
- `src/utils/email.js` → new strict-regex validator
- `src/services/apiWrapper.js` → `getUserContacts` wired to new BC endpoint
- `src/pages/sales/OptOutLandingPage.js` → fully rewritten as BC-hosted-portal handoff
- Deleted: `OptOutSearchResultsPage.js`, `OptOutInfoInputPage.js`
