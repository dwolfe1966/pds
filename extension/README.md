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
- **`popup.html/js`** lets the member view/edit the removal profile directly.

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
