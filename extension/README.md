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
Two asks: (i) capture browsing history for insights, (ii) per-page identity feedback. **(ii) is built** (the
per-page copilot above — local-only, `activeTab`, honest). **(i) is gated on a data-model decision** because
browsing history is the most sensitive data an extension can touch and adding the `history` permission flips
the install prompt to "read your browsing history on all sites." The fork (recommend the middle):
1. **Local-only** — analyze history on-device, show insights, transmit nothing.
2. **Local + derived, per-item, consented sync** — e.g. "you appear to have a Spokeo account" → one footprint
   node; raw history NEVER leaves the device. ⭐ recommended default.
3. **Raw history to backend** — powerful, but the trust / legal / Web-Store "Limited Use" landmine for a
   privacy company; not recommended.
Build (i) only after the model is chosen; even locally, prefer derived/aggregated state over a raw history copy.

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
