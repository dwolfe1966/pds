# Publish the browser extension — IDLookup Remove v1.0.0 (Unlisted)

The single guide to publish. **Do the steps here; paste the field copy from
[`chrome-web-store-listing.md`](./chrome-web-store-listing.md).** Target visibility: **Unlisted** (link-only
early access — hand out the link, gather feedback, flip to Public later).

**Upload package:** `docs/extension/idlookup-remove-1.0.0.zip` (already built; rebuild command at the bottom
if you change anything under `extension/`).

Includes: autofill opt-out forms, removal tracking, in-session reappearance/removal detection, "Re-check all,"
and the "Find where I'm exposed" discovery scan.

---

## 0 · One-time account setup
- [ ] Sign in at **https://chrome.google.com/webstore/devconsole** with the owning Google account.
- [ ] Pay the **$5 one-time** developer fee + complete identity verification.

## 1 · Test it first (load unpacked) + set up for screenshots
- [ ] Run the consumer app and **sign in with a claimed identity** (so the extension has data).
- [ ] `chrome://extensions` → enable **Developer mode** → **Load unpacked** → select the `extension/` folder.
- [ ] Confirm the toolbar icon appears and the popup opens.

## 2 · Capture screenshots (REQUIRED — the store won't publish without ≥1)
Format: **1280×800** or **640×400** PNG/JPG. Aim for 3:
- [ ] **Assist panel on a broker page** — visit a broker in the list (e.g. `thatsthem.com/optout`); capture the
      IDLookup panel (bottom-right) with the "Autofill" button.
- [ ] **Your Digital Footprint** — in the app, **My Identity → Digital Footprint**; capture the protection score
      + the category map.
- [ ] **Popup, history OFF** — click the extension icon; capture the identity summary with the browsing-insights
      toggle **off** (privacy-first default).
- [ ] Don't show a real SSN/DOB/card in any shot (name + city is fine). *(Optional promo tile 440×280.)*

## 3 · Create the item
- [ ] Dev console → **Add new item** → upload `docs/extension/idlookup-remove-1.0.0.zip`.

## 4 · Fill the listing — copy verbatim from `chrome-web-store-listing.md`
- [ ] **Store listing**: name, summary, description, category = Productivity, language = English; upload the
      screenshots (128 store icon is in the package).
- [ ] Homepage `https://idlookup.me/extension` · support `privacy@idlookup.ai`.
- [ ] **Privacy** tab: policy URL `https://idlookup.me/extension-privacy`.
- [ ] Paste the **single-purpose** statement.
- [ ] Paste each **permission justification** — storage, activeTab, scripting, host permissions, `<all_urls>`,
      history. (Unchanged; no new permissions were added.)
- [ ] Complete the **data-use disclosures** + tick the **3 certifications** (all true for us).

## 5 · Set visibility + submit
- [ ] **Visibility → Unlisted.**
- [ ] **Submit for review.** Expect a longer review — broad host access + optional `history` are "sensitive."
      Our live privacy policy + in-product consent already cover Limited Use, so this is expected, not a blocker.

## 6 · After it's approved
- [ ] Copy the Unlisted store URL.
- [ ] Update `seo/app/extension/page.js`: replace "Coming to the Chrome Web Store" → the real link (push →
      auto-deploys).
- [ ] *(Optional)* point `EXT_INSTALL_URL` in `src/components/OptOutGuide.js` at the store link.
- [ ] Share the link for early access.

---

### File map
| What | Where |
|---|---|
| Upload package | `docs/extension/idlookup-remove-1.0.0.zip` |
| Field copy to paste | `docs/extension/chrome-web-store-listing.md` |
| Source (load-unpacked / rebuild) | `extension/` |
| Privacy policy (live) | https://idlookup.me/extension-privacy |
| Landing page (live) | https://idlookup.me/extension |

### Rebuild the zip after any `extension/` change
```
cd extension && rm -f ../docs/extension/idlookup-remove-1.0.0.zip && zip -q ../docs/extension/idlookup-remove-1.0.0.zip \
  manifest.json background.js config.js content.js identity-bridge.js \
  popup.html popup.js panel.css recipes.js signals.js icon16.png icon32.png icon48.png icon128.png
```

### Notes
- The `appKey` in `config.js` is the public, gate-only key (same one the web app ships) — safe to include.
- Same zip works for **Edge Add-ons** (easy second channel). **Firefox** is a separate port.
