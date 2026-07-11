# Freemium Current-State Map — idlookup.ai people-search

_Written 2026-07-11. Purpose: a precise map of what a FREE (authenticated-but-unpaid)
user experiences today, as the factual base for a freemium retention/engagement plan.
All claims cite file paths + line numbers in the consumer SPA._

---

## TL;DR

- The paywall is **exactly one route**: `/people/:id` (full report detail). Everything
  else a member can reach — dashboard, search, teaser results, alerts, Who's Searching,
  history, account — is open to free accounts.
- There is **no persistent free tier by design** — there is only "signed up, not yet
  paid." `isPaid` is a live-derived boolean off BC `getUserOrders()`; there is no stored
  flag (`src/context/AuthContext.js:240`).
- Paid entry is a **$1.00 / 7-day trial → $49.98 recurring** (`src/services/brand.js:40-42`).
  So "free" in practice = **pre-trial**. A free user who won't pay yet is parked, not served.
- Signup does **not** force checkout. Where a user lands depends on whether they came from
  a teaser: from a teaser → `/payment`; from a bare signup → `/dashboard`
  (`src/hooks/useSignup.js:150-153`). So a genuine free-account state exists — it's just thin.
- The two headline "engagement" features for free users — **Who's Searching** and **Alerts** —
  are **not real**. WSFY is seeded-PRNG synthetic data; Alerts is a one-shot search with a
  "Coming soon" banner. Both are BC-blocked.
- **Retention gap:** a free user who won't convert today has essentially nothing durable to
  come back for. Search history is local-only, the dashboard stat tiles/reports library are
  paid-only and render empty for free users, and the only "live" free surfaces are teasers
  that exist to push checkout.

---

## (a) The exact free / paid boundary

**Auth gate (`ProtectedRoute`, `src/pages/ProtectedRoute.js`)**
- Blocks unauthenticated users only. If `!token` → redirect to `/login?redirect=…`
  (lines 12-14). A `role` prop can require `admin` (lines 16-18), but no consumer route
  passes it. There is **no paid check here**.

**Paid gate (`PaidRoute`, `src/pages/PaidRoute.js`)**
- Reads `{ isPaid, loading, subscriptionLoading }` from AuthContext.
- While billing loads → renders `null` (lines 18-20).
- `isPaid === false` → `<Navigate to="/payment?upgrade=1" replace />` (lines 22-24).
- `isPaid === true` → renders children.

**Where `PaidRoute` is applied — exactly one route (`src/App.js`)**
```
/people/:id  →  <ProtectedRoute><PaidRoute><SearchResultDetailPage/></PaidRoute></ProtectedRoute>   (App.js:254-265)
```
Every other member route (`/dashboard`, `/people-search`, `/people-results`,
`/who-is-searching`, `/alerts`, `/search-history`, `/account`) is wrapped in
`ProtectedRoute` **only** (App.js:217-312). Confirmed: **the full report detail page is the
sole paywalled surface.**

**How paid/unpaid is determined (`src/context/AuthContext.js`)**
- `refreshSubscription()` calls `api.getUserOrders()` (line 93) on every token change
  (lines 156-159). Subscription is **never** restored from localStorage — always fetched
  fresh from BC (lines 161-168).
- An "operative" order = `status === 'active'` AND not a lapsed cancel
  (cancel-at-period-end still counts while `dueTimestamp > now`) (lines 101-118).
- `const isPaid = !!(subscription?.status === 'active' && subscription?.plan)` (line 240).
- **The 403 = "no orders" = unpaid pattern:** a 403 (or empty array) yields
  `subscription = null` → `isPaid = false` (unpaid). A 5xx/CORS/network error is treated
  **distinctly** as `subscriptionError = true` (BC unreachable) so a paying member isn't
  wrongly wiped during an outage (lines 137-150). There is **no local `isPaid` flag** — it is
  derived every session from BC. (Matches memory: BC billing is the single source of truth.)

---

## (b) What a FREE account can do today

Member nav tabs visible to everyone (`src/components/MemberNav.js:21-27`):
Dashboard · Search · History · Alerts · Who's Searching · Account.

| Surface | Free user can…? | Notes / cite |
|---|---|---|
| **Dashboard** (`/dashboard`, `Dashboard2.js`) | Yes | Sees marketing strip ("12B+ records"), an inline name-search box (the primary CTA), and a **"You're on a free account → Subscribe to unlock"** promo (lines 888-924). Stat tiles + Reports Library + Activity **only render when `isPaid`** (lines 968, 965-967) — free users get empty/absent data widgets. |
| **Search / SRP** (`/people-search` → `/people-results`) | Yes | Free members run full searches. On submit, `if (!isPaid)` they are routed to **teaser results** (`/people-results`), never to report creation — BC 403s report creation pre-payment (`MemberGeneralSearchPage.js:185-192`). |
| **Teaser results** (`SearchResultsPage.js`) | Yes (teaser only) | Shows result cards + an inline banner: **"Viewing full reports requires a Pro subscription — Upgrade now"** → `/payment` (lines 423-438). Clicking a result → `/people/:id` → bounced to `/payment?upgrade=1`. |
| **Full report** (`/people/:id`) | **No — paywalled** | The only gate. Redirects unpaid → `/payment?upgrade=1`. |
| **Who's Searching** (`/who-is-searching`) | Yes (teased) | **Synthetic/mock** — see (c). Free users see real-looking totals/charts but **masked names/locations** + an "Upgrade to Pro" banner (WSFY.js:252-313, 418-419). |
| **Alerts** (`/alerts`) | Yes (no persistence) | **Mock/coming-soon** — "Coming soon" banner; submit just runs a one-time search (AlertsPage.js:63-89, 36-59). No saved alerts, no monitoring. |
| **Search History** (`/search-history`) | Yes | **localStorage-only** (`utils/searchHistory.js`); no server persistence, so it does not survive device/browser change (SearchHistoryPage.js:18-28). |
| **Account** (`/account`) | Yes | Profile / billing management. Free user sees subscribe/upgrade paths. |
| **Profile / Settings** | Redirect | `/profile` and `/settings` both `Navigate` to `/account` (App.js:230-236, 298-304). |

---

## (c) Mock / synthetic vs real

- **Who's Searching (WSFY) — SYNTHETIC.** All searcher/viewer events are generated
  client-side from a **seeded PRNG keyed on user id/email** (`generateEvents`, so it's
  stable across refreshes) — explicitly "Replace with a real BC endpoint when available"
  (`WhoIsSearchingPage.js:41-44`). The free/paid split is purely cosmetic: free users see
  `maskName`/`maskLocation`/relative dates + blurred avatar; paid users see the same
  fabricated rows unmasked (lines 252-287, 335+). BC has no inbound-activity endpoint
  (memory: WISFY = 1 BC capability ask, BC-blocked). Note: this contradicts the honest
  "Nothing is fabricated" ethos the dashboard footer claims (Dashboard2.js:1027-1028).
- **Alerts — NOT IMPLEMENTED.** No BC scheduling/monitoring endpoint. Page is a search
  launcher with a "Coming soon" banner and benefit bullets (AlertsPage.js:5-12, 63-89).
  (Memory: Alerts = 4 BC capability asks, BC-blocked, roadmap-not-launch.)
- **Search History — REAL but LOCAL-ONLY.** Backed by localStorage, not BC; "when [a BC
  endpoint] ships, swap this to an API call" (SearchHistoryPage.js:18-21).
- **Dashboard stats / Reports Library / Activity — REAL but PAID-ONLY.** Data fetches are
  gated on `isPaid` (Dashboard2.js:576, 606, 635); for free users these widgets render
  nothing (lines 965-968). The dashboard deliberately shows no fabricated counters for free
  users.
- **Search + teasers — REAL.** Free-member search hits BC and returns real teaser identities;
  only report *creation/unlock* is gated.

---

## (d) The trial model & how it meets "free"

- Paid entry = **$1.00 today for a 7-day trial, then $49.98 recurring / 30 days**
  (`src/services/brand.js:40-42`; same across all three brands, lines 73-75 / 100-102).
  BC's live offer (`findByShmName`, `priceInfo.s0`/`s1`) is authoritative; brand values are
  the display copy and are verified to match the charge (brand.js:33-39). Partner offers can
  override via `useOfferPricing` (`src/hooks/useOfferPricing.js`).
- There is **no durable free tier and no free quota of full reports.** The paid copy promises
  "up to 5 full reports a day" (Dashboard2.js:909) — free = **zero** full reports. The
  distinction is binary: unpaid (teasers only) vs. trial/paid (reports).
- So **"free" ≈ "pre-trial."** A user can create an account and browse teasers/mock features
  indefinitely without paying, but the product gives them no reason to — every real payoff
  (the report) sits behind the $1 trial.

### Signup → free-account → payment flow
1. `useSignup.submit()` creates the BC account, sets token/user, stashes `_pendingPw` (so
   PaymentPage can `changePassword` after `billing.sale`), and stores `selectedPersonId` if
   the user came from a teaser (`src/hooks/useSignup.js:112-147`).
2. **Redirect logic (lines 150-153):** `target = redirectParam || (selectedPersonId ? '/payment' : '/dashboard')`,
   whitelisted against `['/payment','/dashboard','/people/','/account']` (lines 15-19).
   - **From a teaser** (has `selectedPersonId`) → **`/payment`** (checkout gate).
   - **Bare signup** (no teaser) → **`/dashboard`** (genuine free-account landing).
3. There **is** a real free-account state — it just isn't the primary funnel path. The Ads/
   teaser funnel funnels straight to `/payment`; only organic/nav signups land on the
   dashboard as a free member.

---

## (e) Where the retention / engagement gaps are

The narrow paywall is good for *conversion optics* (free users can look around), but the
free experience has **almost nothing durable to bring a non-converter back**:

1. **No real "why come back" hook.** The two features positioned as ongoing-value reasons —
   Alerts and Who's Searching — are mock. Alerts can't actually watch anyone; WSFY's
   "someone is searching for you" is fabricated. Neither produces a real, returnable signal
   (e.g. an email "3 new people viewed your profile"). This is the single biggest gap.
2. **Free dashboard is mostly empty.** Stat tiles, Reports Library, and Activity are
   paid-only and render nothing for free users (Dashboard2.js:965-968). A free member's
   dashboard is: a marketing strip + a search box + a "Subscribe" promo. No saved people,
   no watchlist, no personalized state.
3. **Nothing persists server-side for free users.** Search history is localStorage-only
   (lost on new device/incognito/clear); there is no saved-search, no bookmarked-person,
   no "your results" that survives a session or follows the account. A returning free user
   effectively starts from zero.
4. **No email/notification re-engagement loop for free users.** No "we found new records
   for your search," no drip. The only nudge is in-app upgrade banners they must return on
   their own to see.
5. **Teasers are pure upsell, not retained value.** Free search always dead-ends at the
   `/payment` wall on result click (SearchResultsPage.js:423-438; MemberGeneralSearchPage.js:189-191).
   The free user gets the *appetite* (a match exists) but zero *substance* and nothing saved.
6. **Binary value cliff.** Zero full reports free → 5/day paid. There is no "1 free full
   report" or partial-unlock to demonstrate real payoff before asking for the card.

**Implication for the plan:** the levers are (i) make Alerts/WSFY produce a *real* returnable
signal (BC-blocked today — parallel BC ask + client-side interim), (ii) give free users
durable, server-persisted state worth returning to (saved people / saved searches / a
watchlist), (iii) add a re-engagement channel (email on new records), and (iv) consider a
demonstrable free payoff (limited free report or richer teaser) to bridge the binary cliff.

---

## Key files

- Paywall: `src/pages/PaidRoute.js`, `src/pages/ProtectedRoute.js`, `src/App.js:254-312`
- Paid derivation: `src/context/AuthContext.js:80-240`
- Signup flow: `src/hooks/useSignup.js:112-197`
- Free-member search routing: `src/pages/member/MemberGeneralSearchPage.js:185-217`,
  `src/pages/member/SearchResultsPage.js:423-438`
- Free dashboard: `src/pages/member/Dashboard2.js:876-1013`
- WSFY (mock): `src/pages/member/WhoIsSearchingPage.js:41-44, 252-313`
- Alerts (mock): `src/pages/member/AlertsPage.js`
- History (local-only): `src/pages/member/SearchHistoryPage.js:18-28`
- Pricing/trial: `src/services/brand.js:40-42`, `src/hooks/useOfferPricing.js`, `src/pages/sales/PaymentPage.js`
- Nav: `src/components/MemberNav.js:21-27`
