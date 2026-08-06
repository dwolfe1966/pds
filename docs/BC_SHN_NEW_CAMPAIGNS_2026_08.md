# New shN campaigns — 2026-08-06 (PeopleSearch Free rename + PeopleSearch ad + Inmate-Affiliate)

Registry: `src/services/campaignRegistry.js`. Our registry carries **landing route + local
reporting labels** only; **BC mints the shN token and configures partner / channel / offer /
cascade / risk** on its side. Placeholder slugs work locally today (landing + attribution
labels + GTM), but BC stays on its DEFAULT shape until a real 24-hex shConId is minted and swapped in.

## The three campaigns

| Campaign | shN (today) | Funnel / landing | Partner | Channel | Status |
|---|---|---|---|---|---|
| **PeopleSearch Free** (renamed) | `6a70dee8368ec934bb214554` (real, live) | Free-to-search `/name/landing/v2` | Google | People Search | Live — label renamed from "People Search & Background Check" |
| **PeopleSearch** (new ad) | `peoplesearch` (placeholder) | Free-to-search `/name/landing/v2` | Google | People Search | Local-only until BC mints |
| **Inmate-Affiliate** (new partner) | `inmate-affiliate` (placeholder) | Inmate `/name/landing/v3` | Inmate-Affiliate | Inmate | Local-only until BC mints |

## Ad / partner URL scheme

Tag every campaign URL with `?shn=<token>` (first-touch; it survives the boot redirect and is now
also mirrored to a 60-day durable localStorage first-touch). No `shl` → resolves the partner-wide `…:*` entry.

- **PeopleSearch Free:** `https://www.idlookup.ai/?shn=6a70dee8368ec934bb214554`
  (or land directly: `…/name/landing/v2?shn=6a70dee8368ec934bb214554&intent=people_search&adgroup=people_search_free`)
- **PeopleSearch (new ad):** `https://www.idlookup.ai/?shn=peoplesearch` → boots to `/name/landing/v2`
- **Inmate-Affiliate (new partner):** `https://www.idlookup.ai/?shn=inmate-affiliate` → boots to `/name/landing/v3`

## What BC needs to provision

**A. PeopleSearch Free (existing token — one tweak):**
- Update this shN's **channel** in BC from `Background Check` → `People Search`, so BC's authoritative
  `data.tracking.partner.channel` matches our renamed label (else reporting shows two different channel
  names for the same funnel). No new token — same `6a70dee8368ec934bb214554`.

**B. PeopleSearch (new ad) — mint + configure a shConId:**
- partner = Google, channel = People Search
- offer / pricing / cascade / risk = same as the current free-to-search ad (mirror `6a70dee8…`)
- theme: landing `name/landing/2`, sup `ver=a`, thinmatch `yes`, optout `yes`

**C. Inmate-Affiliate (new partner) — mint + configure a shConId:**
- partner = Inmate-Affiliate (affiliate), channel = Inmate
- offer / pricing / cascade / risk = the affiliate terms for this partner (BC sets per contract)
- theme: landing `name/landing/3` (inmate), sup `ver=a`, thinmatch `yes`, **optout `no`**
  (affiliate relaxation — hides the SUP opt-out block); our registry also sets
  `payment.requireTermsCheckbox:false` to hide + not-require the SUP terms checkbox.

## Swapping placeholders → real tokens (when BC mints them)

One-line change per campaign in `campaignRegistry.js` — replace the slug key with the 24-hex shConId:
- `'peoplesearch:*'` → `'<minted-shConId>:*'`
- `'inmate-affiliate:*'` → `'<minted-shConId>:*'`

Keep the same object body. Also update the ad/partner URLs to `?shn=<minted-shConId>`. The resolver is
key-agnostic, so nothing else changes. Until then, the placeholder slugs give correct **landing + local
attribution/GTM labels**, but BC-side partner attribution + custom pricing only activate with the real token.
