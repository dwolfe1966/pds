# Pre-Launch Test Log

**Started:** 2026-05-21
**Bundle under test:** `build/public.6cde142b.js`
**IIFE:** May-14 (66,527 bytes)
**Tester:** David Wolfe + Claude (pair)

## Test environments

- **Local** = `http://localhost:3000` via `node scripts/serve-prod.js` — serves the build/ bundle with `/api/*` proxied to `https://dev.www.idlookup.ai`. Fast iteration; production code path; production IIFE.
- **Prod** = `https://www.idlookup.ai` — deployed bundle on the prod host. Same code as Local once we deploy; only difference is the BC host the proxy hits.

## Plan

1. Run each test on **Local** first. Fix anything that breaks before moving on.
2. After all critical tests pass on Local → deploy → re-run on **Prod**.
3. Mark each test with Local + Prod results separately.

## Status legend

- ✅ Pass — works as expected
- ❌ Fail — record details, file follow-up
- 🟡 Pass with caveat — works but has rough edges
- ⏸ Blocked — depends on BC or other team
- ⏭ Skipped — not relevant for this environment

---

## Consumer App

### 🔴 Critical — revenue path

#### C1 — Homepage search bar

**Steps:** Open `/` in fresh incognito → header search bar → type "David Wolfe", state blank → submit

**Expected:** `POST /api/idLookup/teaser/search` → 200 (or 412→pwd→200) → navigate to `/people-results?firstName=David&lastName=Wolfe` → result cards render.

| Env | Status | Notes |
|---|---|---|
| Local | ✅ | 2026-05-21 — search dispatches, results render |
| Prod | TBD | |

#### C2 — Name landing wizard V5

**Steps:** `/name/landing/v5` → 4-step wizard (Name → Location → Details → Confirm) → submit

**Expected:** Same as C1 from the wizard endpoint. Search dispatches, results render.

| Env | Status | Notes |
|---|---|---|
| Local | ✅ | Validated earlier in session (post gtmSetSearchInput import fix) |
| Prod | TBD | |

#### C3 — Result-click → signup CTA (unauthenticated)

**Steps:** From C1 results page, click any result card (don't log in)

**Expected:** Navigate to `/search/<id>` (preview page) showing teaser data + signup form. No "Free Account" / "No credit card required" copy.

| Env | Status | Notes |
|---|---|---|
| Local | ✅ | 2026-05-21 — preview page renders; signup CTA copy correct |
| Prod | TBD | |

#### C4 — Signup new account

**Steps:** On the signup form, enter new email + password → submit

**Expected:** Account created → redirected to `/payment`. Form copy says "Create Account" (NOT "Create Free Account"); no "No credit card required" line.

| Env | Status | Notes |
|---|---|---|
| Local | ✅ | 2026-05-21 — signup creates BC account, lands on /payment |
| Prod | TBD | |

#### C5 — Payment / billing sale

**Steps:** On `/payment` → enter card details → submit → success screen → click "View report"

**Expected:** Sale completes; `getUserOrders` returns active order; report created; navigate to `/people/{commerceContentId}`; report renders.

| Env | Status | Notes |
|---|---|---|
| Local | ✅ | 2026-05-21 — full revenue path works end-to-end; **BC now returns matching $1/$49.98 pricing** (no longer the $0.98/$39.01 discrepancy from 2026-05-18 testing) |
| Prod | TBD | |

#### C6 — Payment decline

**Steps:** Repeat C5 with a decline-test card

**Expected:** Inline error on payment page; no navigation; no double-charge.

| Env | Status | Notes |
|---|---|---|
| Local | ⏸ deferred (F1) | BC TRX in sandbox mode — sandbox approves all cards. Decline UX must be validated after BC upgrades TRX to live. |
| Prod | ⏸ post-launch | Smoke test required immediately after TRX live-mode cutover |

#### C7 — Login

**Steps:** `/login` → existing credentials → submit

**Expected:** Token issued; navigate to `/dashboard`.

| Env | Status | Notes |
|---|---|---|
| Local | ✅ | 2026-05-21 — login flows clean; dashboard renders for subscribed user |
| Prod | TBD | |

### 🟡 Important — common surfaces

#### C8 — Phone landing search

**Steps:** `/phone/landing` → 10-digit number → submit

| Env | Status | Notes |
|---|---|---|
| Local | ✅ | 2026-05-21 — "works beautifully"; phone teaser search returns results |
| Prod | TBD | |

#### C9 — Email landing search

**Steps:** `/email/landing` → valid email → submit

| Env | Status | Notes |
|---|---|---|
| Local | ✅ | 2026-05-21 — email teaser search returns results |
| Prod | TBD | |

#### C10 — Contact form submit

**Steps:** `/contact` → fill form, leave phone blank → submit → type captcha pwd in modal

**Expected:** `submitContact` sends `phone: "2125550100"` sentinel + `orderId: "NOORDERID0000"`; `/contactMessage/create` returns 201; success screen with thread URL.

| Env | Status | Notes |
|---|---|---|
| Local | ✅ | Verified earlier this session |
| Prod | TBD | |

#### C11 — Opt-out request

**Steps:** `/opt-out` → search for "Tim Chin FL" → select record → submit removal

| Env | Status | Notes |
|---|---|---|
| Local | ✅ | 2026-05-21 — opt-out search returns results; portal link works |
| Prod | TBD | |

#### C12 — Opt-out confirmation link

**Steps:** Open `/opt-out?awqh[type]=confirmationRequestOptOut&awqh[optOutRequestId]=<id>` with a valid id from the email

| Env | Status | Notes |
|---|---|---|
| Local | ⏭ deferred | Requires real BC-generated opt-out confirmation link from email. Test post-deploy with a real opt-out flow. |
| Prod | TBD | Validate after a real opt-out request triggers a confirmation email |

#### C13 — Contact thread reply

**Steps:** `/contact/thread/<id>?h=<hash>` (from a CSR reply email link) → submit a user reply

| Env | Status | Notes |
|---|---|---|
| Local | ⏭ deferred | Requires real CSR reply email with valid contactMessageId + hash. Test post-deploy. |
| Prod | TBD | Validate after CSR sends a real reply email |

#### C14 — Legal pages render

**Steps:** Visit `/terms`, `/privacy`, `/refund`, `/cpcc`, `/suppression-list`

**Expected:** All render without errors. Phone in legal docs = brand.supportPhone. Last-updated dates current.

| Env | Status | Notes |
|---|---|---|
| Local | ✅ | 2026-05-21 — all 5 pages render; spot-checks pass (Terms §17 pricing, §14 Delaware venue, §22 Claymont DMCA address, §7 SMS HELP/STOP to 833-861-9230) |
| Prod | TBD | |

### 🟢 Member surfaces

#### C15 — Dashboard membership card

**Steps:** Log in → `/dashboard` → see Membership tile

**Expected:** Plan name is human-readable text from BC's offer (NOT raw 24-hex commerceOfferId).

| Env | Status | Notes |
|---|---|---|
| Local | ✅ | 2026-05-21 — both states verified during F2 fix: Subscribe Now CTA for unsubscribed, plan-name display for active |
| Prod | TBD | |

#### C16 — Member general search

**Steps:** Logged-in → `/people-search` → enter "John Smith FL" → submit

| Env | Status | Notes |
|---|---|---|
| Local | ✅ | 2026-05-21 — member search returns results; "View Full Report" CTA on cards |
| Prod | TBD | |

#### C17 — Report detail render

**Steps:** From C16 results, click → `/people/<commerceContentId>` loads → report sections render

**Expected:** All sections (Personal Info, Addresses, Phones, Emails, Relatives, etc.) populate. Header has download button.

| Env | Status | Notes |
|---|---|---|
| Local | ✅ | 2026-05-21 — report renders, no bugs. Layout/UX evolution noted for post-launch (see Follow-up F3) |
| Prod | TBD | |

#### C18 — PDF download

**Steps:** On report detail page → click "⬇ Download PDF"

**Expected:** BC popup opens → click Confirm → PDF downloads.

| Env | Status | Notes |
|---|---|---|
| Dev (idlookup) | ✅ | 2026-05-26 — F4 closed; BC re-added missing PDF library to all envs; PDF download works end-to-end |
| Prod | TBD | |

#### C19 — Profile update

**Steps:** `/account` → Profile tab → edit firstName/lastName/phone → save

| Env | Status | Notes |
|---|---|---|
| Local | ✅ | 2026-05-21 — profile update succeeds; **no captcha required on user.update** |
| Prod | TBD | |

#### C20 — Password change

**Steps:** `/account` → Security tab → enter current + new password → save

| Env | Status | Notes |
|---|---|---|
| Local | ✅ | 2026-05-22 — required fixing routing gap F5 (see below); password change now works via wrapper.api.user.changePassword |
| Prod | TBD | |

#### C21 — Subscription cancel

**Steps:** `/account` → Subscription & Billing → Cancel

| Env | Status | Notes |
|---|---|---|
| Local | ✅ | 2026-05-22 — required wiring (F6). BC response confirms `subStatus: "canceled"`, `status: "active"` until `dueTimestamp` end-of-period. Order ID 6a0fba42…6e8. |
| Prod | TBD | |

#### C22 — Account plan name display

**Steps:** `/account` → Subscription & Billing tab → Plan field

**Expected:** Human-readable name (NOT raw hex).

| Env | Status | Notes |
|---|---|---|
| Local | ✅ | 2026-05-22 — plan name human-readable; both /account and /dashboard correctly show "Canceling" state after cancel — UI status mapping works as-is |
| Prod | TBD | |

#### C23 — Member compose message

**Steps:** `/account` → Messages tab → Compose → send

**Expected:** Sends with phone (real or sentinel); succeeds after captcha.

| Env | Status | Notes |
|---|---|---|
| Local | ✅ | 2026-05-22 — member compose works; captcha + phone sentinel both functional |
| Prod | TBD | |

#### C24 — Past report PDF download

**Steps:** `/account` → past report row → Download PDF

| Env | Status | Notes |
|---|---|---|
| Dev (idlookup) | ✅ | 2026-05-26 — F4 closed; works with PDF library fix |
| Prod | TBD | |

#### C25 — Search history

**Steps:** `/search-history`

| Env | Status | Notes |
|---|---|---|
| Local | ✅ | 2026-05-22 — switched to localStorage-backed history (F7) since BC has no user-facing history endpoint. Persists, scoped per-user, delete works. |
| Prod | TBD | |

---

## Admin App

Tested against the deployed bundle at **`https://dev.www.bytecrtrs.com/csr/...`** (BC's own dev host serves the admin app — no local server used for admin testing this pass).

### 🔴 Critical CSR flows

#### A1 — Admin login

**Steps:** Admin app `/login` → credentials → submit

| Env | Status | Notes |
|---|---|---|
| Dev (bytecrtrs) | ✅ | 2026-05-22 — login successful, landed on /csr/users |
| Prod | TBD | |

#### A2 — Admin dashboard

**Steps:** Land on `/admin` → tickets count, recent activity render

| Env | Status | Notes |
|---|---|---|
| Local | TBD | |
| Prod | TBD | |

#### A3 — User search

**Steps:** `/csr/users` → search by email

| Env | Status | Notes |
|---|---|---|
| Dev (bytecrtrs) | ✅ | 2026-05-22 — user search returns results |
| Prod | TBD | |

#### A4 — User detail page

**Steps:** `/csr/users/<id>` → profile + orders + notes + tickets all load

| Env | Status | Notes |
|---|---|---|
| Dev (bytecrtrs) | ✅ | 2026-05-22 — all sections render |
| Prod | TBD | |

#### A5 — Refund email

**Steps:** UserDetailPage → "Request billing action" → RefundEmailModal → send

| Env | Status | Notes |
|---|---|---|
| Dev (bytecrtrs) | ❌ blocked by F8 | BC returns 404 (Cannot POST /api/message/admin/user/csrMail/create) — endpoint moved/removed |
| Prod | TBD | |

#### A6 — CSR tickets list

**Steps:** Admin nav → Tickets/Messages → list renders newest-first

| Env | Status | Notes |
|---|---|---|
| Dev (bytecrtrs) | ✅ | 2026-05-22 — tickets list renders, includes C23 message |
| Prod | TBD | |

#### A7 — CSR ticket reply

**Steps:** Open a ticket detail → reply → submit

| Env | Status | Notes |
|---|---|---|
| Dev (bytecrtrs) | ✅ | 2026-05-22 — CSR reply sent successfully via /contactMessage/admin/csrReply. **Caveat: reply doesn't surface in consumer's /account → Messages — see F9.** |
| Prod | TBD | |

#### A8 — Orders list

**Steps:** `/admin/orders` → list renders

| Env | Status | Notes |
|---|---|---|
| Local | TBD | |
| Prod | TBD | |

#### A9 — Order cancel

**Steps:** Order detail page → cancel order

| Env | Status | Notes |
|---|---|---|
| Local | TBD | |
| Prod | TBD | |

### 🟡 Important admin surfaces

#### A10 — Add note to user

| Env | Status | Notes |
|---|---|---|
| Local | TBD | |
| Prod | TBD | |

#### A11 — Create CSR

**Steps:** `/admin/cs-reps` → New CSR form → submit

| Env | Status | Notes |
|---|---|---|
| Local | TBD | |
| Prod | TBD | |

#### A12 — Mail activity

| Env | Status | Notes |
|---|---|---|
| Local | TBD | |
| Prod | TBD | |

#### A13 — Edit user profile (CSR-side)

| Env | Status | Notes |
|---|---|---|
| Local | TBD | |
| Prod | TBD | |

---

## Follow-ups discovered during testing

(Append findings as we go. Format: test ID + finding + decision/action.)

- **C5 (2026-05-21)** — BC updated its `commercePriceRules` to match our $1/$49.98 marketing display. The "TEMPORARY OVERRIDE (TRX approval)" comment block in `src/services/brand.js` (added 2026-05-19) is now stale — the override is the same as BC's actual offer. **Action:** drop the override comment in a future cleanup commit; pricing values stay the same.

### F1 — TRX still in sandbox mode; decline UX cannot be validated locally yet

**Discovered:** 2026-05-21 during C6 testing.

**Symptom:** Visa's universal decline test card `4000 0000 0000 0002` was approved as a valid subscription on dev.

**Root cause:** Confirmed by David — BC is intentionally running TRX in **sandbox mode** pending upgrade to **live mode**. Sandbox approves all card numbers regardless of decline triggers. This is expected sandbox behavior, not a defect.

**Status:** Not a bug. David is notifying BC that the sandbox is letting test cards through (so they can prioritize the live upgrade or configure a sandbox decline scenario for testing).

**Implication for our test pass:** Decline-UX validation (C6) cannot complete until BC flips TRX to live mode. Add to launch checklist: smoke test C6 on production immediately after TRX cutover with a real known-decline card.

### F10 — Web report missing most of the data BC returns ✅ RESOLVED

**Discovered:** 2026-05-26. The BC-generated PDF showed property details, criminal/court records, financial records (liens/bankruptcies/judgments/foreclosures), professional licences, etc. The consumer web report at `/people/<id>` showed only ~30% of the data BC actually returns. Diagnostic via `window._lastReportRaw.rawTransientKeys` confirmed BC sends ~40 lists on `identities[0]`; our extractor previously only consumed 8.

**Resolution (bundle `96c5fbe3`, 2026-05-26):**
- Extended `src/utils/reportExtract.js` to extract every list we have a schema for (criminal, lien, judgment, foreclosure, bankruptcy, property, professional licence, driver licence, veteran, business, sanctions, fraud, arrests, arrest watch, death, etc.) plus all summary count fields BC provides directly.
- Added sections 9–15 to `src/pages/member/SearchResultDetailPage.js`: Property Records, Professional Licences, Legal & Court Records, Arrests & Watchlist Records, Financial Records, Other Public Records, Sanctions & Fraud Watchlist Checks. Each conditionally renders only when populated — empty sections auto-hide; new BC data appears automatically when present.
- New sub-components: `PropertyCard`, `LicenseRow`, `CriminalCard`, `FinancialRecordCard`.

Verified 2026-05-26 against David Wolfe record — 8 criminal records + 3 liens render correctly.

---

### F9 — Consumer can't see CSR replies in /account unless compose happened on same device

**Discovered:** 2026-05-23 after A7 (CSR reply succeeded but reply didn't surface in consumer's /account → Messages tab on `dev.www.idlookup.ai`).

**Symptom:** `/account → Messages` tab fired no `/contactMessage/histories` call. localStorage `accountThreads:` was empty for the user on `dev.www.idlookup.ai`. `fetchMessages` bailed early because there were no thread refs to query.

**Root cause:** BC exposes only two contact-message read endpoints — `/contactMessage/histories?contactMessageId=X&hash=Y` (single thread) and the admin-side `/contactMessage/admin/find` (CSR-only). **No `/message/userContact/list` for consumers.** We rely on client-side capture of `(contactMessageId, hash)` at compose time — which is per-domain and per-device.

**Functional gaps:**
- User composes on device A → CSR replies → user logs in on device B → reply invisible in /account
- User composes on `localhost:3000` for testing → logs in on `dev.www.idlookup.ai` → reply invisible (different domain = different localStorage)
- User clears browser storage → all historical replies invisible

**Supported flow (works today):** BC sends user an email when CSR replies (the link path through `/contact/thread/<id>?h=<hash>` → `ContactThreadPage`). That's domain-independent.

**Action items:**
1. **BC ticket addition:** "Please expose `POST /api/message/userContact/list` (or equivalent) returning all contactMessage threads for the authenticated user — `{ contactMessageId, hash, latestReply, subject, status }[]`. Today the consumer can only see CSR replies via the per-message email link we send."
2. **Client-side stopgap (optional):** when /account → Messages tab loads with zero local thread refs, render a helpful empty state: *"Click the link in our email to view recent replies from support."* — instead of a blank tab.

---

### F8 — CSR "Request billing action" endpoint returns 404 (admin launch blocker)

**Discovered:** 2026-05-22 during A5 on `dev.www.bytecrtrs.com/csr/`.

**Symptom:** Clicking **"Request billing action"** on the User Detail page → fills the modal → submit → BC server responds with `Cannot POST /api/message/admin/user/csrMail/create?clientId=...&apiId=...` (HTTP 404). The "Cannot POST" prefix is the express/koa default — the route literally does not exist on BC's deployment.

**Likely cause:** BC has renamed, moved, or removed this admin endpoint. Our local API reference (memory: `bc_admin_api_reference.md`, 2026-05-07) documents `POST /api/message/admin/user/csrMail/create` as the CSR mail creation path, but BC's `dev.www.bytecrtrs.com` no longer serves it.

**Impact:**
- CSRs cannot send refund/billing emails to finance via the admin app
- Blocks customer-service operations at launch unless we route around or BC restores the path

**Action items:**
1. **BC ticket:** "What's the current CSR endpoint for `createCsrReply` / `createCsrMail` on `dev.www.bytecrtrs.com`? The previously-documented `POST /api/message/admin/user/csrMail/create` returns 404."
2. **Client side once BC clarifies:** update `apiWrapper.csrCreateCsrMail` + `csrCreateCsrReply` paths to match.

Also noted but NOT blocking:
- `GET /contactMessage/admin/find/<userId>` returns 404 — already handled by client fallback to `/contactMessage/admin/find` (no path param) per `csrFindUserContactMessages`. Just noisy in console.

---

### F7 — No BC endpoint for user search history (client-side workaround shipped)

**Discovered:** 2026-05-22 during C25.

**Symptom:** `Endpoint my-searches is not available in either API` on `/search-history`. Member search history was mock-only via `/searches/me`; BC has no equivalent user-facing endpoint.

**Confirmed via May-14 IIFE enumeration:** BC exposes `/idLookup/statistic/user{TeaserSearches,NameSearches,ReportCreations,PdfDownloads}` (COUNT only) and `/idLookup/report/list` (paid reports only). No per-search history endpoint with query text + timestamps + result count.

**Short-term resolution (bundle `ac5af252`, 2026-05-22):**
- New `src/utils/searchHistory.js` — localStorage ring buffer (max 50 entries), scoped per-user via JWT subject so different users on the same device get separate history.
- `api.searchPeople` records every authenticated search immediately after the BC response returns.
- `SearchHistoryPage` reads from `getSearchHistory()`; delete uses `deleteSearchHistoryItem(id)`. No network calls.
- Caveat: per-device, not cross-device synced. User clearing browser storage wipes it.

**Long-term action item:**
- **BC ticket addition:** "Please expose `/api/idLookup/userSearchHistory` (or equivalent) — `{ id, type, query, resultCount, timestamp }[]` for the logged-in user. BC has the data via `/tracking/create` ingest; we need a read endpoint for cross-device history."
- When BC ships it, swap the reader in SearchHistoryPage to call the API; treat localStorage as a fallback / offline cache.

---

### F6 — Subscription cancel endpoint not wired ✅ RESOLVED

**Discovered:** 2026-05-22 during C21.

**Symptom:** "Endpoint subscription is not available in either API" on cancel attempt.

**Root cause:** Same class of gap as F5 — `apiRouter` had no `cancel-subscription` case, no wrapper method, and `AccountPage` was calling `api.delete('/subscription', ...)` without passing an orderId. BC's `commerceBilling.cancelOrUncancelOrder(flag, orderId)` requires the explicit orderId.

**Resolution (bundle `c487bd19`, 2026-05-22):**
- `apiWrapper.cancelOrder({ orderId, flag })` — new method, IIFE-first with direct-POST fallback to `/commerceBilling/cancelOrUncancelOrder`.
- `apiRouter` — new `case 'cancel-subscription':` wires the body through to the wrapper. Added to `FORCE_NEW_API_ENDPOINTS`.
- `api.cancelSubscription(orderId, { flag })` — explicit named method, replaces the old `api.delete('/subscription')` call.
- `AccountPage.handleCancelConfirm` — resolves the active order from local state and passes its `_id` to the cancel call; surfaces a clean "No active subscription found to cancel" inline error if none exists.

**Verified by BC response showing `subStatus: 'canceled'` + `status: 'active'` + `dueTimestamp` populated (subscription terminates at end of current period — correct cancel semantics).**

---

### F5 — Password change endpoint not wired ✅ RESOLVED

**Discovered:** 2026-05-22 during C20.

**Symptom:** "Endpoint change-password is not available in either API" error on submit.

**Root cause:** `apiRouter.js` had no `case 'change-password':` handler in `callNewAPI`, no entry in `FEATURE_FLAGS`, and `change-password` was missing from `FORCE_NEW_API_ENDPOINTS`. With production's `REACT_APP_USE_MOCK_API=false`, the router fell through to the "not available" throw. Functionality gap from before the May-14 IIFE upgrade exposed `user.changePassword`.

**Resolution (bundle `bb79d8e9`, 2026-05-22):**
- `apiWrapper.changePassword({ newPassword })` — new method mirroring `userUpdate` pattern; tries `wrapper.api.user.changePassword(password)` IIFE method, falls back to direct POST `/user/changePassword`.
- `apiRouter` — new `case 'change-password':` extracts newPassword from body, forwards to wrapper.
- `change-password` added to `FORCE_NEW_API_ENDPOINTS` so production routes correctly.
- BC's endpoint does NOT require currentPassword; UI still collects it for UX, but only newPassword is forwarded. Documented in code comment.

---

### F4 — BC PDF download endpoint returns 500 ✅ RESOLVED

**Discovered:** 2026-05-21 during C18.

**Symptom:** Clicking "⬇ Download PDF" on a report detail page → BC returns HTTP **500** with body `{"message":"Internal Server Error","statusCode":500}`. Our client correctly catches the error and shows a "Download failed. Please try again later." banner; window._lastPdfError captures the upstream payload.

**Likely cause:** BC server-side PDF generation pipeline failure. Could be:
- PDF rendering service down/crashed
- Missing template / IDIData PDF integration broken
- Specific commerceContentId triggering the failure (need scope test — repro on different reports?)

**Status:** BC-side failure. Our error UX handles it cleanly.

**Resolution (2026-05-26):** BC reported the PDF rendering library was missing on dev and added it to all environments (dev + prod). Retested 2026-05-26 — PDF download works end-to-end (BC popup opens, PDF saves). C18 + C24 both pass.

---

### F3 — Report detail page layout/UX evolution (post-launch)

**Discovered:** 2026-05-21 during C17.

**Status:** Not a bug. The report detail page renders correctly with all data sections, but the layout/UX could be improved. David: "Still need to evolve the report detail page, but no bugs." Not blocking launch.

**Action:** Post-launch design pass — separate from current sprint.

---

### F2 — Unsubscribed users land on dashboard with no Subscribe CTA ✅ RESOLVED

**Discovered:** 2026-05-21 during the same C6 attempt.

**Symptom:** After signup-without-payment (or when subscription is canceled/lapsed), the member sees `/dashboard` with the Membership tile showing "Free" / "No plan" and a "Manage subscription" button — no prominent path to actually subscribe. Console fires multiple 403s on `getUserOrders`, `report/list`, `userTeaserSearches`, `userReportCreations`, `userPdfDownloads` since the user has no entitlements.

**Resolution (bundle `52b9731f`, 2026-05-21):**
- `Dashboard2.SubscriptionTile`: tile gets brand-tinted banner styling + "Unlock unlimited searches and full reports." subhead + filled-primary **"Subscribe Now"** button (routes to `/people-search` → user picks a target → lands on `/payment`).
- Subscribed members keep the original "Manage subscription" outlined-button affordance.
- Dashboard report-list + BC stats counters now gated behind `isPaid` — they no longer fire 403s for unsubscribed users. `getUserOrders` still fires (it's the source of truth for paid state).
- Verified on local 2026-05-21.

---

## Sign-off

| Environment | All critical pass? | Sign-off |
|---|---|---|
| Local | TBD | |
| Prod | TBD | |
