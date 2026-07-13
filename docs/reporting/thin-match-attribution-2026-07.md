# Thin-match attribution bug — SEO/referral traffic booked as PAID (2026-07)

**Status:** CONFIRMED. SEO/referral traffic from `idlookup.me` is being attributed
to the internal **default shN** (which reporting reads as paid/internal), even though
the distinguishing signal (`utm_source=idlookup.me`) is present. Root cause is that
**attribution is keyed on the shN**, and SEO traffic carries no shN → BC assigns the
default shN → reporting groups by shN and never looks at `utm_source`.

The recent surge to ~60% thin-match is consistent with the idlookup.me directory
(~866k thin name+city pages) sending deep links straight into the SERP, where sparse
name+city combos hit the ThinMatchPreview path.

---

## (a) Confirmed data flow for a SEO deep-link search

Scenario: visitor clicks an idlookup.me deep link and lands **directly** on
`https://www.idlookup.ai/name/search-result?firstName=John&lastName=Williams&state=AR&city=Texarkana&utm_source=idlookup.me&utm_medium=referral&utm_campaign=people-directory`
(no prior `/` visit, no `shn`).

### 1. UTM capture — happens, and before the first event
- `src/index.js:18` calls `captureReferralParams()` at module-eval time, **before**
  React renders.
- `captureReferralParams()` (`src/services/gtm.js:41-55`) reads `window.location.search`
  and stores `utm_source` / `utm_medium` / `utm_campaign` (all in `REFERRAL_FIELDS`,
  `gtm.js:24-34`) into `sessionStorage.referralParams`.
- The first tracking event (`results_view`) fires later in a `useEffect`
  (`SearchResultsPage.js:66-68`), so **`utm_source=idlookup.me` is captured before any
  event fires.** ✔ (Answers Q1.)

### 2. The deep link runs a real search and fires events
- `SearchResultsPage` mount fires `track('results_view', { search_type:'name', query,
  state, thin_match_version })` unconditionally (`SearchResultsPage.js:66-68`).
- `fetchResults` finds no `sessionStorage.nameSearchResults` → falls through to the
  URL-param branch (`SearchResultsPage.js:111-155`) and calls
  `api.searchPeople(...)` — **a real BC teaser search runs from the URL params.** ✔
- Sparse/no results + `campaign.search.zeroState === 'thinMatch'` (the default for
  no-shn traffic, see below) → renders `ThinMatchPreview` (`SearchResultsPage.js:461-467`).
- **Note:** `ThinMatchPreview` fires **no** tracking event of its own (verified —
  no `track` import in `src/components/ThinMatchPreview.js`). "Thin match" is only
  observable as `results_view` carrying `thin_match_version` with an empty result set.
- **Note:** `search_submit` is NOT fired on this page — it only fires in the
  wizard/loader path (`gtm.js:125`). A SEO deep-link search produces
  `CLIENT:results_view` (+ GA4 `client_results_view`) but no `search_submit`.
  Any "search count" that keys on `search_submit` under-counts these; one that keys
  on `results_view` or BC's server-side `USER:search` sees them.

### 3. Attribution carried on those events (`trackingService.track`, lines 189-252)
`data.refer` is built by `buildRefer()` (`trackingService.js:39-67`):
- `refer.source = 'idlookup.me'` (aliased from `utm_source`, line 46) ✔ present
- `refer.utm_medium = 'referral'`, `refer.utm_campaign = 'people-directory'` ✔ present
- `refer.shn` — **absent.** `attribution.shn` is only set from a URL `shn`/`shConId`
  (`index.js:32-35`); a SEO deep link has none.
- `refer.partner` / `refer.channel` — **absent.** These come only from
  `attribution.partner`/`attribution.channel`, set by `CampaignContext.persistIdentity`
  from the resolved campaign identity. For no-shn traffic the resolver returns the
  universal `default` entry whose identity is `{ partner:null, channel:null }`
  (`campaignRegistry.js:28`, `campaignResolver.js:140-149`), and the BC shape does not
  currently populate `comp.tracking.partner.{name,channel}` (per the "retire-shn-registry"
  memo). So nothing sets partner/channel → they never reach `refer`.

So the **BC tracking-store `data.refer` contains `source=idlookup.me`**, and — *if the
default-shN shape returns no partner name* — carries no paid partner/channel/shn.

⚠️ **CONTINGENT — verify before trusting "client refer is clean."** `extractShapeProps`
(`campaignResolver.js:93-96`) reads the partner name from **`comp.tracking.partner.name`
|| `comp.partner.name` || `comp.connection.name`**. The "retire-shn-registry" memo only
says BC hasn't populated `comp.tracking.partner.*` — it says nothing about
`comp.partner.name`/`comp.connection.name`. And we KNOW BC returns `comp.brand.name` (it
stamps `shnName` for all traffic incl. SEO). So it is plausible BC returns a partner name
for the **default** shN, in which case: `resolveCampaign` sets `identity.partner` →
`persistIdentity` sets `attribution.partner` + `gtmSetCampaign` → **`refer.partner` = the
default partner, and the CLIENT itself labels SEO as paid** (this is exactly the owner's
literal "our tracking attributes them to paid").

**Cheap discriminating check (no prod probe):** on a no-shn `?utm_source=idlookup.me`
load, inspect `sessionStorage['attribution.partner']` / `['attribution.channel']` (or the
dev `console.log` at `gtmContext.js:215-218`). If set to "Internal"/"IDL Default" → the
client mislabels and the root cause is client-side too; if absent → the tracking store is
clean and only BC/order-side (below) misbooks. Either way the fixes below are correct
(Fix 1 is written as an authoritative override, so it holds in both cases).

### Where "paid" actually creeps in
Two mechanisms, both keyed on the shN rather than on `utm_source`:

1. **BC server-side default-shN assignment.** BC assigns its **default shN** to any
   traffic that arrives without one ("client loads only default shN" — BC CTO). BC's
   server-side `USER:*` search events and, critically, the **order** (`commerceorders`)
   are stamped with the default shN. Reporting grouped by shN then files SEO searches
   and conversions under the default shN — a real internal/paid token, not "SEO".

2. **`commerceorders.refer` never receives the SEO signal.** At checkout,
   `buildReferQueryString()` (`trackingService.js:78-94`) is the only thing that feeds
   the persisted order-level `refer`. It sends **only** `refer_partnerId`/`refer_afid`/
   `refer_abc` + `refer_gclid`/`refer_fbclid`/`refer_msclkid`. It **drops `utm_source`
   entirely.** So a SEO conversion's order carries **no `idlookup.me` signal at all** →
   BC attributes the revenue to the default shN → reporting reads it as paid/internal.

3. **GA4 pollution (secondary).** Every BC response runs through
   `setBcAttributionFromResponse` (`apiRouter.js:243`), which walks the response for
   `shConId`/`shColId`/`brandId` and writes them into `gtmContext` state
   (`gtmContext.js:226-253`). For no-shn traffic those are BC's **default** shN, so GA4
   events emitted after the first BC response carry `shn = default shN` /
   `shnName = default brand`. GA4/Ads reporting that segments on `shn`/`shnName` then
   also sees SEO traffic as the default campaign. (GA4 *does* also carry raw
   `utm_source` on the gtm.js canonical events via `baseContext()` →
   `readReferralParams()`, `gtm.js:66-92` — so GA4 has both signals; which one the
   reporting/Ads config keys on decides the bucket. The `client_*` events from
   `trackingService` do NOT carry `utm_source` — they whitelist only
   partnerName/partnerChannel/shn/shl/shnName, `trackingService.js:224-227`.)

### Q5 — is `idlookup.me` ever treated as an organic/referral channel?
**No — not in tracking/attribution.** The only place idlookup.me is *classified* is
`funnelSplit.isSeoTraffic()` (`funnelSplit.js:26-39`), which checks
`utm_source in {idlookup.me, seo}`, `?seo=1`, or a `document.referrer` host of
`idlookup.me`. But that classifier is wired **only** to the A/B landing-split routing
(which landing page to show — `App.js:117,142`), **not** to tracking. `utm_source` is
otherwise passed through raw (`refer.source`), so BC/GA4 reporting must know to key on
it — and today it keys on shN instead.

---

## (b) Root cause (confirmed)

**Attribution is keyed on the shN, and there is no shN-independent channel
classification.** SEO/referral traffic from idlookup.me arrives with no shN, so:
- BC server-side files it under the **default shN**, and
- the **order** (`commerceorders.refer`) never receives `utm_source=idlookup.me`
  (buildReferQueryString omits it),

so reporting that groups by shN/partner counts these thin-match searches and
conversions as the internal/default (paid-looking) bucket. The one signal that would
separate them — `utm_source=idlookup.me` / `utm_medium=referral` — is captured and even
reaches the BC **tracking-store** `data.refer.source`, but it (1) is absent from the
**order** refer, and (2) is not turned into a channel label anywhere, so the
shN-grouped reports can't see it.

Additionally — pending the CONTINGENT check above — the client may itself be stamping
`refer.partner`/`attribution.partner` = the default-shN partner onto SEO events (if BC's
default-shN shape returns a `comp.partner.name`/`comp.connection.name`), in which case the
misattribution originates client-side too, not only in BC/order-side reporting. Fix 1
(authoritative override) corrects both.

---

## (c) Fix recommendation

### Client-side (we can ship now)

**Fix 1 — stamp an explicit channel on `data.refer` (tracking store).**
In `buildRefer()` (`trackingService.js:39-67`), when the visit is idlookup.me
referral, set a channel/partner value **distinct from the shN-derived partner**:

```js
// after the existing utm/shn/partner assembly, before the return:
const isSeoReferral =
  (params.utm_source || '').toLowerCase() === 'idlookup.me' ||
  (params.utm_medium || '').toLowerCase() === 'referral';
if (isSeoReferral) {                 // AUTHORITATIVE override — not fill-when-empty
  refer.channel = 'referral';        // or 'seo'
  refer.partner = 'idlookup.me';     // overwrite any default-shN partner leaked in
}
```
**Make this an override, not a fill-when-empty.** `utm_source=idlookup.me` is an
*unambiguous* SEO signal — paid always arrives as `?shn=…` and never carries it, so there
is no collision to protect against. Overriding makes the fix correct **whether or not the
shN path already stamped `refer.partner`/`channel`** (see the CONTINGENT note above) — so
you don't have to fully resolve that question to ship a correct fix. Reuse
`funnelSplit.isSeoTraffic()` (already encodes utm_source OR `document.referrer` host =
idlookup.me) so a deep link that lost its UTM but kept the referrer still classifies.

**Fix 2 (highest value) — carry the SEO signal onto the ORDER.**
In `buildReferQueryString()` (`trackingService.js:78-94`) add `refer_`-prefixed keys so
BC lands them on `commerceorders.refer` (BC ingests only `refer_*`, stripping the
prefix — same convention already proven for `refer_partnerId` and `refer_gclid`):

```js
push('refer_source', params.utm_source);       // → refer.source on the order
push('refer_utmMedium', params.utm_medium);     // → refer.utmMedium
// or a normalized channel:
if ((params.utm_source||'').toLowerCase()==='idlookup.me') push('refer_channel', 'seo');
```
This is the most important fix because it is the **order** (revenue) that is currently
being misbooked as paid — and the order refer today has zero idlookup.me signal.
⚠️ Needs a one-line BC confirmation that `refer_source`/`refer_channel` persist on
`commerceorders.refer` (the prefix convention is confirmed for other keys; the specific
keys are new). Low risk to add regardless.

**Fix 3 (secondary) — stop polluting GA4 with the default shN.**
`setBcAttributionFromResponse` backfills `gtmContext.shn`/`shnName` from every BC
response, which for no-shn traffic is the **default** shN. Gate it so it only backfills
when a first-touch shn/utm actually indicated a campaign (e.g. skip when
`isSeoTraffic()` is true and no URL `shn` was present), so SEO GA4 events don't inherit
the default-campaign shN. Optional but removes the same misattribution on the GA4 side.

### Reporting-side (BC / analyst — cannot be done in the client)

- **Group searches AND revenue by `data.refer.source` / the new `refer.channel`, not by
  shN.** The default shN is a catch-all bucket and must not be read as a paid campaign.
  The tracking store already has `refer.source=idlookup.me` today (Fix 2 extends this to
  the order).
- **On GA4/Ads:** build the paid-vs-organic split from `utm_source`/`utm_medium`
  (`referral` / `idlookup.me`), not from `shn`/`shnName`. GA4 already receives
  `utm_source` on the canonical (gtm.js) events.

### Client-fixable vs BC/reporting change
| Change | Where |
|---|---|
| Explicit `channel='referral'/'seo'` on tracking-store `data.refer` | **Client** (Fix 1) |
| SEO signal onto `commerceorders.refer` via `refer_source`/`refer_channel` | **Client** (Fix 2) — needs BC to confirm the key persists |
| Stop stamping default shN onto GA4 for no-shn traffic | **Client** (Fix 3) |
| Group searches/revenue by source/channel instead of shN | **BC / reporting** |
| Paid-vs-organic GA4/Ads split keyed on utm_source, not shN | **Reporting / GTM config** |

---

## File/line index (evidence)
- `src/index.js:18` — `captureReferralParams()` at boot (pre-render).
- `src/index.js:32-35` — `attribution.shn` only set from URL `shn`/`shConId`.
- `src/services/gtm.js:24-55` — REFERRAL_FIELDS incl. utm_*, captured to sessionStorage.
- `src/services/trackingService.js:39-67` — `buildRefer()`: `refer.source` from utm_source;
  partner/channel only from shN-derived `attribution.*`.
- `src/services/trackingService.js:78-94` — `buildReferQueryString()`: order refer omits utm_source.
- `src/pages/sales/PaymentPage.js:396` — `buildReferQueryString()` wired into billing.sale (the order-refer path).
- `src/services/campaignResolver.js:93-96` — partner name from `comp.tracking.partner.name` || `comp.partner.name` || `comp.connection.name` (CONTINGENT: default-shN may return one).
- `src/services/trackingService.js:189-252` — `track()` emits BC `CLIENT:*` (+ GA4 `client_*`).
- `src/pages/sales/SearchResultsPage.js:66-68` — `results_view` on mount (only event; no search_submit).
- `src/pages/sales/SearchResultsPage.js:111-155` — URL-param search on deep-link land.
- `src/pages/sales/SearchResultsPage.js:461-467` — ThinMatchPreview gate on zeroState.
- `src/components/ThinMatchPreview.js` — no tracking event fired.
- `src/services/campaignRegistry.js:28` — `default` identity partner/channel = null.
- `src/services/campaignResolver.js:120-171` — no-shn resolves to `default`; shape supplies no channel.
- `src/context/CampaignContext.js:57-73` — `persistIdentity` sets attribution.partner/channel only if present.
- `src/services/apiRouter.js:243` + `src/services/gtmContext.js:226-253` — response-walker stamps default shN into GA4 context.
- `src/services/funnelSplit.js:26-39` — `isSeoTraffic()` (idlookup.me detection) — used only for landing split, not tracking.
</content>
</invoke>
