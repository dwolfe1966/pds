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

**Second form (commit ca5188b):** Google also indexed the `/people/<state>/<name>` form
(e.g. `/people/de/david-davis`), which hit `[state]/[city]` with a name in the city slot → 404.
The `[city]` page now falls back to a **shared** name-in-state view (`seo/lib/name-in-state.js`)
when the slug is a name, not a city. Both URL forms render one view and share ONE canonical (the
`/people` form) to avoid duplicate content. Verified live: both forms 200, both canonical to
`/people/de/david-davis`.

**Follow-ups (not blocking):**
- After the Vercel deploy, spot-check a few real indexed URLs return 200 (owner can pull the
  list from Search Console).
- Source of the root URLs: the current sitemap only emits `/people/...`, so these are legacy.
  Consider adding the root `/<state>/<name>` set to the sitemap so Google re-crawls faster, OR
  301 them to the `/people/...` canonical once we're sure recovery is complete. For now serving
  200 self-canonical is the fastest bleed-stop.

## (i-b) Thin city pages — empty "Most common names" module
**Symptom:** many small cities yield 0–1 city-native common names under the strict city gate
(ct/groton, ct/bantam had 0; ct/stamford, ct/new-haven had 1), leaving the #2 conversion module empty.

**Fix (commit 7cb9eaa):** when a city has <12 city-native names, render a **"Popular names in
<State>"** fallback from `getStateTopNames` (deduped vs city names), linking to the name-in-state
pages `/people/{state}/{name}`. Fills the surface AND cross-links the recovery pages so they get
crawled. No gate change (calibration untouched). Verified live: ct/groton 0→25, ct/bantam 0→24,
ct/stamford 1→24 names.

**Collision note (answering owner):** the `[city]` name-fallback does NOT collide with cities —
`getCitySlice` is checked first (real cities always win), and the name pattern requires a hyphen
(`firstname-lastname`). So a hyphenated real city (`los-angeles`) renders the city page; only a
hyphenated non-city renders as a name. The hyphen + city-precedence cleanly separates the two under
`/people/{state}/…`. Only edge: a hyphenated place NOT in our city slice renders as a name page
(still 200, harmless).

## (i-c) Search Console 404 sweep (~1,000 URLs) — all recovered
GSC drilldown export (Table.csv, 1,000 rows) flagged legacy URLs. Breakdown + fix:
- **614** `/people/<state>/<name>` — already 200 after (i)/(i-b) (GSC crawled 7-11, pre-fix). Re-crawl only.
- **355** legacy **name-first** `/people/<name>[/<state>[/<city>[/<pid>]]]` — the real-profile pages moved
  to `/profiles/<name>/...`. **Middleware 301** (`seo/middleware.js`) prefix-swaps them (discriminator:
  seg1 hyphenated = name → redirect; 2-letter = state → route normally). Commit 281e686.
- **31** bare `/profiles/<name>` with no profile rows → 404. Plus the redirected bare names (182) landed
  on the same 404. **Fix:** `/profiles/[name]` now renders a **lenient hub** (name/surname facts + search
  CTA) at 200 when no profiles exist, instead of 404. Commit b6c24b0.
- **Verified live:** a 50-URL sample across every pattern → **50/50 = 200** (following redirects).

Follow-up: submit the sitemap / request validation in Search Console so Google re-crawls the 614 sooner.

## (ii) v11 pre-payment interstitial reworded
**Symptom:** in the `/name/landing/v11` BV flow, clicking a SERP result before payment shows an
interstitial (the `SignupPage` success panel) reading **"Account Created!"** — transactional and
slightly jarring pre-purchase.

**Fix (commit 76b0591):** reworded to **"Welcome to IDLookup"** (`src/pages/sales/SignupPage.js`);
redirect subtext and the page itself unchanged. Updated the `signupFlow.test` assertion. Rebuild →
`public.5c607f1b.js` — **needs BC upload** to go live. (SignupPage is the shared `/signup` success
panel, so all signup surfaces get the warmer copy.)
