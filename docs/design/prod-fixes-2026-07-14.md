# Production fixes — 2026-07-14

Two critical prod issues, both fixed.

## (i) idlookup.me root /<state>/<name> URLs were indexed but 404ing — CRITICAL
**Symptom:** Google had indexed root-level `idlookup.me/<state>/<firstname>-<lastname>` URLs
(e.g. `/ca/david-johnson`) from an older URL structure. The current app only routes
`/people/[state]/[city]/[name]` (+ `/people/[state]/[city]`, `/people/[state]`), so those root
URLs 404'd → losing traffic and search ranking live.

**Fix (commit f0ee177):** new root route **`seo/app/[state]/[name]/page.js`** serves those exact
URLs a real, city-generalized 200 page — the state analog of the leaf: H1 "<Name> in <State>",
`estInState` estimate + first/surname facts, a **state-scoped** SERP hand-off (no city), city
links, and related names. Self-canonical (`SITE/<state>/<slug>`). Degrades gracefully (still 200)
when a name is below the city-page gate. Auto-deploys via Vercel on push.

**Containment:** the root catch-all is safe — static segments (`/people`, `/profiles`, `/api`)
take routing precedence, and `getStateSlice()` + a `NAME_SLUG_RE` (`^[a-z]+(?:-[a-z]+)+$`) guard
make any non-state / non-name slug `notFound()`. Verified `next build` compiles it as
`ƒ /[state]/[name]`.

**Follow-ups (not blocking):**
- After the Vercel deploy, spot-check a few real indexed URLs return 200 (owner can pull the
  list from Search Console).
- Source of the root URLs: the current sitemap only emits `/people/...`, so these are legacy.
  Consider adding the root `/<state>/<name>` set to the sitemap so Google re-crawls faster, OR
  301 them to the `/people/...` canonical once we're sure recovery is complete. For now serving
  200 self-canonical is the fastest bleed-stop.

## (ii) v11 pre-payment interstitial reworded
**Symptom:** in the `/name/landing/v11` BV flow, clicking a SERP result before payment shows an
interstitial (the `SignupPage` success panel) reading **"Account Created!"** — transactional and
slightly jarring pre-purchase.

**Fix (commit 76b0591):** reworded to **"Welcome to IDLookup"** (`src/pages/sales/SignupPage.js`);
redirect subtext and the page itself unchanged. Updated the `signupFlow.test` assertion. Rebuild →
`public.5c607f1b.js` — **needs BC upload** to go live. (SignupPage is the shared `/signup` success
panel, so all signup surfaces get the warmer copy.)
