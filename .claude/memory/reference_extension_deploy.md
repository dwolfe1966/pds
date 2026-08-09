---
name: reference_extension_deploy
description: "How/where to deploy the IDLookup Remove browser extension (Chrome Web Store, Unlisted)"
metadata: 
  node_type: memory
  type: reference
  originSessionId: c559d3ef-73d6-4bd2-ae57-b22ea4c6528f
---

The browser assistant (`extension/`, MV3) is deployed via the **Chrome Web Store, visibility = UNLISTED** (owner decision 2026-08-09 — link-only early access, matches the "email for early access" landing at idlookup.me/extension; flip to Public later).

- **Submission package:** `docs/extension/idlookup-remove-1.0.0.zip` (rebuild from `extension/` if changed).
- **Paste-ready listing** (description, single-purpose, per-permission justifications, data disclosures, submit steps): `docs/extension/chrome-web-store-listing.md`.
- Version bumped to **1.0.0**; added icon16/32 (were only 48/128); fixed the manifest description (dropped the false "never leaves your browser" — consented monitoring/history DO sync to our API).
- **Owner-only steps:** register CWS dev account ($5 one-time) + identity/domain verify, upload zip, paste listing, complete privacy form, set Unlisted, submit. Review is longer because of `<all_urls>` + optional `history` (sensitive) — that's expected; privacy policy (idlookup.me/extension-privacy) + consent flow already satisfy Limited Use.
- **Still needed before submit:** ≥1 screenshot (1280×800 or 640×400); optional 440×280 promo tile.
- **After approval:** update `seo/app/extension/page.js` ("Coming to the Chrome Web Store" → real link) and optionally the opt-out guide's EXT_INSTALL_URL.
- Test now without the store: `chrome://extensions` → Developer mode → Load unpacked → `extension/`. The `appKey` in config.js is the public gate-only key (safe in bundle). See [[reference_browser_agent]], [[project_monitoring_loop]].
