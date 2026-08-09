# Finish & submit the browser extension — checklist

Self-contained steps to get **IDLookup Remove v1.0.0** live as **Unlisted** on the Chrome Web Store.
Full field copy lives in `chrome-web-store-listing.md` (same folder). Package: `idlookup-remove-1.0.0.zip`.

---

## 0. One-time account setup
- [ ] Sign in at https://chrome.google.com/webstore/devconsole with the owning Google account.
- [ ] Pay the **$5 one-time** developer fee + complete identity verification.

## 1. Load it unpacked (test + set up for screenshots)
- [ ] Make sure the consumer app is running and you're **signed in with a claimed identity** (so the extension has data to show).
- [ ] `chrome://extensions` → toggle **Developer mode** (top-right) → **Load unpacked** → select the `extension/` folder.
- [ ] Confirm the icon appears and the popup opens.

## 2. Capture screenshots (REQUIRED — store won't publish without ≥1)
Chrome accepts **1280×800** or **640×400** PNG/JPG. Capture at **1280×800** (crop/scale a browser window to that, or use a 1280-wide window and grab the content area). Aim for 3:

- [ ] **Shot 1 — Assist panel on a broker page.** Visit a data broker in the recipes list (e.g. `https://www.spokeo.com/optout` or `https://thatsthem.com/optout`). The IDLookup panel appears bottom-right ("Remove yourself from …" + Autofill). Capture the page with the panel visible.
- [ ] **Shot 2 — Your Digital Footprint.** In the app, go to **My Identity → Digital Footprint**. Capture the protection score + the map of categories.
- [ ] **Shot 3 — Popup, history OFF.** Click the extension icon; capture the popup showing your identity summary with the browsing-insights toggle **off** (privacy-first default). Place it over a neutral page.
- [ ] Save them somewhere you'll find them (e.g. `docs/extension/screenshots/`). *(Optional)* promo tile 440×280.

> Tip: don't show a real person's full SSN/DOB/account numbers in any shot. Name + city is fine.

## 3. Create the item
- [ ] Dev console → **Add new item** → upload `docs/extension/idlookup-remove-1.0.0.zip`.

## 4. Fill the listing (copy from `chrome-web-store-listing.md`)
- [ ] **Store listing** tab: item name, summary, description, category = Productivity, language = English.
- [ ] Upload the **screenshots** from step 2. (128 store icon is already in the package.)
- [ ] Homepage: `https://idlookup.me/extension` · Support email: `privacy@idlookup.ai`.
- [ ] **Privacy** tab: privacy policy URL `https://idlookup.me/extension-privacy`.
- [ ] Paste the **single purpose** statement.
- [ ] Paste each **permission justification** (storage, activeTab, scripting, host permissions, `<all_urls>`, history).
- [ ] Complete the **data-use disclosures** + check the **3 certifications** (all true for us).

## 5. Set visibility + submit
- [ ] **Visibility → Unlisted.**
- [ ] **Submit for review.** (Longer review is expected — broad host access + optional history are "sensitive." Our privacy policy + in-product consent already cover it.)

## 6. After it's approved
- [ ] Grab the Unlisted store URL.
- [ ] Update `seo/app/extension/page.js`: replace "Coming to the Chrome Web Store" with the real link (push → auto-deploys).
- [ ] (Optional) point the opt-out guide's `EXT_INSTALL_URL` (`src/components/OptOutGuide.js`) at the store link.
- [ ] Share the link for early access.

---

### File map
| What | Where |
|---|---|
| Upload package | `docs/extension/idlookup-remove-1.0.0.zip` |
| Listing field copy | `docs/extension/chrome-web-store-listing.md` |
| Source (for load-unpacked / rebuild) | `extension/` |
| Privacy policy (live) | https://idlookup.me/extension-privacy |
| Landing page (live) | https://idlookup.me/extension |

*Rebuild the zip after any `extension/` change:*
```
cd extension && zip -q ../docs/extension/idlookup-remove-1.0.0.zip \
  manifest.json background.js config.js content.js identity-bridge.js \
  popup.html popup.js panel.css recipes.js signals.js icon16.png icon32.png icon48.png icon128.png
```
