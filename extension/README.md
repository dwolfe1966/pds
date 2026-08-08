# IDLookup Remove — browser extension (MVP)

Rung 3 of the opt-out friction ladder (see `docs/product/optout-automation-roadmap.md`): the one tool that
beats the CAPTCHA / OTP wall, because it runs in the **member's own authenticated browser session** — the
extension does the tedium (autofill, step guidance), the user does the parts only they can (solve the
CAPTCHA, click their confirmation email/SMS).

**Privacy-first by design:** the member's details live only in the browser's extension storage. The
extension sends **nothing** to us or anyone — it just fills forms locally.

## How it works
- **`identity-bridge.js`** runs on idlookup.ai / idlookup.me, reads the member's already-claimed identity +
  removal profile from localStorage, and syncs it into extension storage. So there's nothing to re-type.
- **`content.js`** runs on known broker domains. It shows a small panel (what removal here achieves + the
  exact verification hurdle) and an **Autofill** button. Autofill is **heuristic** — it matches form fields
  by attribute/label patterns (email / first / last / name / address / city / state / zip / phone) and fills
  them React-safely. This works across *most* opt-out forms **without per-broker selectors**, which keeps the
  maintenance surface small.
- **`recipes.js`** adds per-broker display name, the verification hurdle, step notes, and (where the
  heuristic isn't enough) explicit field overrides. Facts mirror `docs/product/broker-optout-automation-matrix.md`.
- **`popup.html/js` + `signals.js`** — the **per-page identity copilot**. Click the icon on ANY site and the
  popup analyzes the current tab (via `activeTab` — access only on your click, so the install prompt stays
  narrow) and shows an honest, catalog-backed insight: "this is a known data broker — opt-out available,"
  "social profile — lock down public visibility," "account form — use a unique password + masked email,"
  "this page asks for your email." It states only what we KNOW (host in our catalog / a form is present),
  never "your data is on this page" (that's the scan we don't have). The popup also holds the removal profile.

## Broadening beyond opt-out forms (owner direction, 2026-08-08)
Two asks, both now built: (ii) per-page identity feedback (the copilot above), and (i) **browsing-history
capture — owner chose raw-to-backend WITH upfront global consent + full delete control.**

### History insights (i) — how the consent + delete guarantees work
- **Off by default.** `history` is an **optional permission** — it is NOT requested at install (the install
  prompt stays narrow). It's requested ONLY when the user clicks "Turn on history insights" in the popup.
- **Consent is upfront + recorded.** Turning it on requires the `history` grant AND records a consent row
  server-side (`history_consent`); the backend refuses to store anything without it (defense in depth).
- **What syncs:** `background.js` backfills past history once (chunked) + listens for new visits, POSTing
  `{url,title,visitedAt}` to `/api/history` keyed by the signed-in userId.
- **Delete is real + total.** "Delete my history & turn off" wipes every stored row (`DELETE /api/history`),
  flips consent off, removes the listener, and revokes the `history` permission.
- **Sign-in required** — history is attributed to the member's account (userId synced by the bridge).

### ⚠️ Required before go-live (raw browsing history = highest-sensitivity)
- A **prominent in-product disclosure** + a **public privacy policy** describing exactly what's collected,
  why, retention, and deletion (Chrome Web Store **Limited Use** policy — mandatory for history data).
- Confirm **encryption at rest** (Neon default) + access controls on `browsing_history`.
- Consider a retention cap / auto-expiry and a "download my data" export.

## What this MVP proves (and what it doesn't)
- ✅ End-to-end model: sync identity → land on a broker → autofill → user completes verification.
- ✅ Heuristic autofill generalizes across many forms (proven cleanly on the no-CAPTCHA targets:
  **That'sThem, SafeGraph**); on CAPTCHA/OTP sites it fills what it can and guides the rest.
- ⏳ **Not yet:** verified per-broker selector overrides for the messiest forms; the "find your listing"
  auto-navigation; auto-detecting the confirmation step; icons; Chrome Web Store packaging/review.
- ⚠️ **Maintenance model:** the heuristic absorbs most breakage; recipes only need tending when a specific
  broker's form is unusual. Add a broker = add a host to `manifest.json` + a `recipes.js` entry.

## Load it (dev)
1. Chrome → `chrome://extensions` → enable **Developer mode** → **Load unpacked** → select this `extension/` folder.
2. Sign in at https://www.idlookup.ai (syncs your details), or add them via the extension popup.
3. Visit a broker opt-out page (e.g. https://thatsthem.com/optout) → the panel appears → **Autofill** →
   solve any CAPTCHA + confirm via email.

## Next steps to productionize
- Add icons (48/128) + Web Store listing + a privacy policy (accurate: local-only, no data collection).
- Expand `recipes.js` with verified selector overrides + `findListing` navigation for the top brokers,
  starting with the PeopleConnect cluster (one flow covers 4 sites).
- Optional: in-session **monitoring** — periodic re-check of a broker page for re-listing (same session, so
  it beats the anti-bot wall the same way).
