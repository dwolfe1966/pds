---
name: project_session_end_2026_07_02
description: Pick-up state after the funnel-theming + A/B-wiring session (2026-07-01/02)
metadata: 
  node_type: memory
  type: project
  originSessionId: 40472548-5ab1-4927-85ed-edc3ce3fb229
---

**HEAD:** `ac1840d` on `main` (all pushed). NOT yet deployed to BC VPS — owner uploads `build/`.

**What shipped this session (inmate A/B experience + full funnel theming):**
- Inmate A/B set: landings `v3a` (blue, clones v7) + `v3b` (dark, clones v8) at `/name/landing/v3a,v3b`; SUP teasers `i` (blue) + `j` (dark) — repurposed the old coral/violet i/j. All inmate-focused (facility/booking/charges/mugshots/release). Self-chrome + in-palette footers.
- **Funnel theme mechanism**: `funnel.theme` sessionStorage set by the landing via `useLandingTrack('name','v3a',true,'blue')` (v3b→'dark'); read by `useFunnelTheme()` (`src/hooks/useFunnelTheme.js`, blue/dark palettes). Applied to loader → results → SUP → payment; reverts to green at dashboard. Every landing sets/clears it (no leakage). `null` = green = zero regression everywhere.
- `ThemedFunnelHeader` (`src/components/`) = branded band on themed loader/results/payment (green nav/footer suppressed on themed funnel pages via `THEMED_FUNNEL_PREFIXES` + `funnelThemeActive()` in Header/Footer).
- Payment fully de-greened (colors-only; `handleSubmit`/validation/tracking untouched — verified).
- Results page: dark content panel fixes faded title; refine form moved BELOW results; mobile header spacing halved (`@media max-width:640px`, was no breakpoint) + dropped duplicate "Results for:" line.
- **A/B wiring** (see [[project_ab_test_theme_wiring]]): resolver interprets `theme.landing`→route + `theme.sup`(`ver=i`)→variant + `split_type/name`; `awaitTheme` boot-redirect gate on shN `6a22ff83ca16ad4ef68b84b5`. 340 jest tests (incl. `campaignResolver.abtest.test.js`).

**NEXT / open:**
1. **Deploy**: owner uploads `build/` to VPS; validate on prod.
2. **A/B live**: dev BC returns the OLD theme (`/name/landing/3, ver=a`) — the split is NOT configured on dev. BC must enable the v3a/v3b + i/j split on the tested env (check **prod**) for the arms to route. Code is ready.
3. Do a REAL themed run (v3a/v3b entry → results → SUP → payment) once BC serves the arms; also a real human purchase to confirm GA4/Ads (headless hits are bot-filtered).

**Caveats:** dev-proxy BC captcha intermittently blocks local *results-loaded* screenshots (verify via computed styles); `console.*` stripped in prod; no prod writes/mutation probes without owner. [[feedback_search_contextkey]] (campaign changes = one at a time).
