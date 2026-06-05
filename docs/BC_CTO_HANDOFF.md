# PDS → ByteCrtrs — CTO / dev hand-off (single tick-through list)

**Updated:** 2026-06-04 · **From:** PDS / idlookup (QA + integration) · **For:** BC CTO + dev

One living doc to work through together. Ordered by unblock value. Each item: **Ask**,
**Why**, **Owner**, **Status**. Tick `[x]` as resolved.

**Launch framing (read first):** none of these block taking a signup. They block *analytics
maturity* (cost→revenue §M, per-partner rollups, card quality) and CSR-tool polish. We already
capture attribution at conversion via `tracking.create` `data.refer` (queryable through
`tracking.findUser`), so launch is **not** gated on the attribution-tree build below — treat
Tier 1 as a fast-follow.

---

## Tier 1 — Attribution (biggest unlock)

### [ ] 1. Build + expose the attribution hierarchy  *(@corp-queued #6 · detail: `BC_SHN_PARTNER_SHAPE.md`)*
**Ask:** (a) Build the **channel + acquisition-campaign + partner** nodes in the shape tree
(today: no channel node; `shl.partner.TODO` is an empty stub with 0 children; `shl.campaign` is
transactional-email campaigns, not marketing). (b) **Persist/expose the resolved
`shN`/`shL`/`shM`/`shNName`/`partner`/`channel` per commerce record** — today only
`shColId`/`shConId` ObjectId refs are stored, so any "by partner/channel" rollup needs tree
resolution.
**Why:** unblocks all per-partner/affiliate metrics, the affiliate monitor (Phase 11), and the
cost-model partner/channel rollup.
**Owner:** BC. **Status:** filed (#77-Q4 expose names, #77-Q6 model partners). **Fast-follow, not a launch gate** — our `data.refer` tracking workaround covers measurement in the interim.

### [ ] 2. Forward landing-URL params to the backend  *(@corp-queued #10)*
**⚠️ Resolve a contradiction first.** Your note says *"the backend already supports persisting
`shn`/`gclid`/`refer_*`/`utm_*` into `commerceorders.refer`."* Our integration notes
(`trackingService.js`) say `commerceorders.refer` **isn't persisting** — which is why we route
attribution through the tracking store instead. Confirmed in our code: our commerce call
(`billingSale`) currently sends **no** `refer`/`shn`/`gclid`.
**Ask (yes/no to CTO):** *If we add a `refer` block to `billingSale`, will BC persist it to
`commerceorders.refer`?*
  - **If yes** → small change on **us** (add `refer` to the sale payload); then it's done.
  - **If no** → BC ask: persist `commerceorders.refer` (backend support + we send it).
**Also confirm:** Google Ads **auto-tagging is ON** (so `gclid` lands on paid clicks); and the
**campaign → shN mapping** (1:1 node, or via captured params).
**Why:** Google Ads cost→revenue (`gclid`, §M6 eCPA / §M9) + refer-level (sub-publisher) cost.
**Owner:** TBD (depends on the yes/no).

---

## Tier 2 — Persist / expose billing + identity data ("the data exists, just return it")

### [ ] 3. Persist BIN / card intelligence  *(@corp-queued #5)*
**Ask:** the billing notification carries `ccType` (debit/credit/prepaid), `ccCountry`, `ccBank`,
`ccLevel`, `ccRegulated`, but it's **not persisted** to Mongo (`commercetokens` keeps only
network + bin + last4). Either persist the billing-time BIN lookup onto the token/payment, or let
the bot do its own BIN lookup on the stored `bin`.
**Why:** §M9 card-quality (prepaid/debit skew, issuer). *(TRX gateway result codes are persisted
at `commercepayments.rawResponse…` — those are fine.)*
**Owner:** BC. **Status:** genuine gap (our CSR raw-order viewer only surfaces what's already stored).

### [ ] 4. Persist the SUP street address  *(@corp-queued #11)*
**⚠️ Premise updated — our half is done.** Our frontend **now sends the real street** on
`billings[].billingAddress.street1` with `bogusFields.street1 = false` when the user fills it
(placeholder + bogus only when blank). *(Shipped in consumer build `df6359be` — pending deploy.)*
**Ask (reframed):** confirm BC **persists** `street1` (+ city/state) to
`commercetokens.billingAddress.street1` when we send it non-bogus — the schema slots already exist.
**Why:** needed if address is ever used for AVS / fraud / quality.
**Owner:** BC (persistence confirm).

### [ ] 5. Add `zip` / `last4cc` / `phone` to the CSR user-search projection  *(detail: `BC_CSR_DATA_EXPOSURE.md`)*
**Ask:** the CSR user object comes back **without** `zip`/`last4cc`/`phone` on **both**
`/api/database/search` and `/api/user/management/detail` — yet advanced search **filters** by
these server-side and works. So BC indexes/filters on them but omits them from the response
`displayFields`. Add them to the returned projection (or tell us they live only on the billing
token and we'll source from orders — we already do this for ZIP on the detail page).
**Why:** the CSR Users-list **Zip/CC columns render "—" for every customer** today.
**Owner:** BC. *(Same root pattern as #3/#4 — worth solving together.)*

---

## Tier 3 — CSR-tool reliability

### [ ] 6. Intermittent **403 on `/message/admin/findNotes`** (+ 404 on `:userId`)  *(detail: `BC_CSR_DATA_EXPOSURE.md`)*
**Ask:** on **cold page loads**, CSR-protected reads intermittently **403** before settling
(e.g. `GET /message/admin/findNotes → 403`, then 200 on retry). `POST /contactMessage/admin/find/:userId`
**404s** consistently. Is the CSR **session/auth gate racing** on cold load (request fires before
the session cookie is validated)? Is the `:userId` endpoint dead (retire vs fix)?
**Why:** a transient 403 makes a customer's notes briefly vanish — the likely root of QA **row 38**
("saved note not visible"). The same 403 signature appears on `/api/database/search` and plausibly
on **row 4** ("Register Member worked before, not today"). *(We've hardened our client to show a
Retry instead of a false "no notes", but the 403 is BC-side.)*
**Owner:** BC.

---

## Confirmations (low priority)

- [ ] **C1.** Prod Mongo: confirm the prod api user has `readWrite` on prod BC at migration
  (the analytics store / Ads import writes `cost_google_ads_*` there).
- [ ] **C2.** No rollup feed needed: we compute §M directly from BC (so `report/ar_metrics/tx_metrics`
  views aren't needed) — confirm there's no separate rollup feed we should use instead.

---

### Cross-references
- Tier 1 #1 → `docs/BC_SHN_PARTNER_SHAPE.md` (full Shn shape ask, #77-Q4/Q6)
- Tier 2 #5 / Tier 3 #6 → `docs/BC_CSR_DATA_EXPOSURE.md`
- Reframe rationale (Q2 contradiction, Q4 stale premise, launch framing) →
  `docs/qa/cto-communication-assessment-2026-06-04.md`
