# Conversion-tracking test plan (Google Ads → GTM → site)

How to audit + verify the Ads conversion pipeline after the changes in
`google-ads-audit.md`. Three surfaces: **deployed bundle**, **GTM container**,
**Ads account**. Work top-to-bottom — each step assumes the one above passed.

Automated coverage: `node scripts/live-uat-gtm-shn.js` (steps 2a–2d below — no
captcha). The conversion-fire itself (step 3) stays manual: BC gates the search
step with a 412 captcha, so a bot can't walk the full funnel to payment.

---

## 0. Pre-reqs (nothing below is valid until these are true)
- [ ] GTM workspace-3 changes **Submitted/Published** (Tag Assistant previews the
      workspace; the live site runs the *published* version).
- [ ] Consumer bundle deployed (`public.7e46ce79.js` or later).
- [ ] Ads: `?shn=` on final URLs; dev→prod URLs; off-funnel domains
      (inmatessearcher.com / privaterecords.net) resolved.

## 1. Bundle is the right one
- [ ] `build/index.html` references the deployed `public.<hash>.js`.
- [ ] On the live site, View Source → same hash. (Rules out a stale upload.)

## 2. shN funnel + attribution — **automated** (`scripts/live-uat-gtm-shn.js`)
Run: `BASE=https://www.idlookup.ai node scripts/live-uat-gtm-shn.js`
(defaults to dev.www.idlookup.ai). All four should PASS:
- [ ] **2a shn-redirect** — `?shn=6a22ff83…` → `/name/landing/v3` (registry resolves).
- [ ] **2b attribution-capture** — `gclid` + `shn` persisted first-touch (sessionStorage).
- [ ] **2c datalayer** — `window.dataLayer` live; pushes carry `gclid`; **`partnerName`/
      `partnerChannel` populated** (`Google`/`Search`). ← this is the conversion GATE.
- [ ] **2d no-shn-control** — plain `/` does NOT redirect to the inmate funnel.

> If 2c shows `partnerName=[]`, the conversion gate can't match — the registry
> identity isn't reaching gtmContext. (Fixed in CampaignContext `persistIdentity`.)

## 3. Conversion fires — **manual, GTM Preview / Tag Assistant**
GTM → **Preview** → `https://www.idlookup.ai` → walk the funnel to the
**post-payment confirmation** (solve the BC captcha at the search step by hand).
On the confirmation screen, in Tag Assistant:
- [ ] A **`purchase`** event appears in the event stream.
- [ ] **"Adwords Pixel Signup Conversion"** = **Fired** on it — and **exactly once**.
- [ ] Variables tab on the tag:
  - [ ] `transactionAmount` = real trial charge (not the default `1`)
  - [ ] `transactionCurrency` = `USD`
  - [ ] **Order ID = BC `orderId`** (not session id) ← dedup
  - [ ] `partnerName`/`partnerChannel` = `Google`/`Search`
- [ ] **Conversion Linker** fired on initial page load.

## 4. Google Ads side
- [ ] **Settings → Auto-tagging** = ON (so the real `gclid` lands).
- [ ] **Goals → Conversions → [Signup action]** flips to **"Recording conversions" /
      "Tag active"** after a real test conversion (can lag hours).
- [ ] **Diagnostics** tab — no "tag not detected" / "no recent conversions" warnings.
- [ ] Spot-check a **Final URL**: lands on prod idlookup.ai, carries `?shn=`,
      and a `gclid` is appended after load.

## 5. Edge cases (one pass)
- [ ] **No double-count:** reach confirmation, refresh — `purchase` does NOT re-fire
      (bound to `billing.sale` success, not page mount); orderId dedup is the backstop.
- [ ] **Gating:** an organic / no-shN path does NOT fire the conversion (intentional).
- [ ] **zeroState per shN (#51):** for a shN whose registry entry sets
      `search.zeroState: 'thinMatch'`, a 0-result search shows `ThinMatchPreview`;
      a `noRecords` shN shows the "no records found" panel. (Set per shN in
      `campaignRegistry.js` → `search: { zeroState: … }`.)

---

### What's automatable vs not
| Check | Tool |
|---|---|
| shN resolves → landing, gclid/shn capture, partner on dataLayer | `live-uat-gtm-shn.js` ✅ |
| Conversion tag fires + variable values | GTM Preview / Tag Assistant (manual — captcha) |
| Auto-tagging, conversion status, final URLs | Google Ads UI (manual) |
