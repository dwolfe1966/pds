# Assessment — QA→BC-CTO attribution/data questions (2026-06-04)

Reviewing the QA-employee's CTO question list (attribution hierarchy, landing-param
forwarding, BIN/card, street address, + two confirmations). Verdict per item, what's
**BC's** vs **ours** vs **already done**, launch-criticality, and the strategic call the
owner flagged (how much of the old weinform.org setup to replicate via Shn).

## TL;DR

- **The list is good and mostly accurate** — push it. But **two items have stale/contradictory
  premises that will make us look sloppy or send BC chasing the wrong thing. Fix those before sending.**
- **None of these are launch-blockers for the consumer funnel.** They block *analytics maturity*
  (§M cost→revenue, per-partner rollups, card-quality), not the ability to take a signup. We
  already have a **working attribution path** (every event/conversion stamps `data.refer` into
  BC's tracking store, queryable via `tracking.findUser`) that does NOT depend on any of these.
- **Strategic call (Shn / old-site replication):** treat the full attribution-tree build (Q1)
  as a **fast-follow, not a launch gate.** Ship on the thin bridge; ask BC to model partners
  durably in parallel. Replicating weinform's full 26-brand richness now would gate launch on
  BC backend work we don't control.

## Two fixes before sending

1. **Q4 (street address) premise is STALE.** The note says "the frontend collects street but
   only ZIP reaches the DB … `street1` stored empty, `bogusFields.street1 = true`." **We already
   fixed the frontend** (commit 9ac6145): `PaymentPage` now sends the real `street1` with
   `bogusFields.street1 = false` when the user fills it (placeholder + bogus only when blank).
   → Reframe Q4 to: *"We now send the real street on `billings[].billingAddress.street1` with
   `bogusFields.street1=false`. Please confirm BC **persists** it to `commercetokens.billingAddress.street1`
   (today it may still be dropping it)."* The ask is persistence, not "please accept what we send."
   ⚠️ Caveat: this is in consumer build `df6359be`, **not yet deployed** — verify live before claiming it.

2. **Q2 (forward params) has an internal CONTRADICTION.** The note says *"the backend already
   supports persisting them into `commerceorders.refer`."* But our own `trackingService.js:34`
   says the opposite — *"`commerceorders.refer` isn't persisting (#77),"* which is **why** we route
   attribution through the tracking store instead. Both can't be true. Confirmed in code: our
   commerce call (`billingSale` → `saleParams`) carries **no** `refer`/`shn`/`gclid` today — we only
   send those to `tracking.create`. → Make Q2 a **yes/no to the CTO first:** *"If we add a `refer`
   block to `billingSale`, will it persist to `commerceorders.refer`? (Our notes say it currently
   doesn't.)"* If **yes** → it's a ~small change on us (add `refer` to `saleParams`). If **no** →
   it's the BC ask as written. Don't assert "the frontend just isn't sending it" until that's settled.

## Per-question verdict

| # | Item | Whose | Launch? | What to do |
|---|---|---|---|---|
| **1** | Build + expose attribution tree (channel/partner/campaign nodes; persist resolved shN/shL/shM/partner/channel per commerce record) | **BC** | **No — fast-follow** | Already filed as `BC_SHN_PARTNER_SHAPE.md` (#77-Q4/Q6). This is the durable version of what our `data.refer` tracking workaround already does. Keep pushing it, but **don't gate launch on it.** This is the "how much old-site to replicate" item — see Strategic below. |
| **2** | Forward landing params (shn/gclid/refer/utm) to the **commerce record** | **TBD — resolve contradiction** | No | See fix #2. Our tracking-store path already captures these for measurement; the commerce-record path is cleaner/durable. Also good asks: confirm Google Ads auto-tagging ON; confirm campaign→shN mapping. |
| **3** | Persist BIN/card intelligence (ccType/ccCountry/ccBank/ccLevel/ccRegulated) | **BC** | No (analytics) | Genuine BC gap. Our recent CSR raw-order viewer (#76) only surfaces what's already stored (network/bin/last4); the richer card fields live in the billing notification but aren't persisted. Pure BC ask — clean. |
| **4** | Persist SUP street address | **BC (we did our half)** | No | See fix #1 — reframe to persistence confirmation. |
| C1 | Prod Mongo `readWrite` for the analytics/Ads-import user at migration | BC | No | Fine as-is. |
| C2 | Confirm no separate rollup feed (we compute §M from BC directly) | BC | No | Fine as-is. |

## Strategic — how much of the old site (weinform) to replicate

The real tension behind Q1. The old site had a heavy **26-brand config tool** (weinform.org) with
full per-partner/channel/campaign modeling. Q1 essentially asks BC to rebuild that richness in the
shape tree. Our Shn framework was deliberately scoped **lighter** — *"customize to a point,"* a thin
local bridge (`campaignRegistry` = landing route + interim identity/offer) plus BC-driven pricing
(`findByShmName`) and attribution via `data.refer`.

**Recommendation: ship launch on the thin bridge; pursue the full tree as a fast-follow.**
- **Launch-critical subset (already working):** capture attribution at conversion (`data.refer`
  on `signup_complete`/`payment_complete`) and roll up by partner post-hoc via `tracking.findUser`.
  This does not need BC to model anything.
- **Fast-follow (BC-dependent, not a gate):** real partner nodes in the shape (Q1/#77-Q6),
  human partner/channel names on the shape (#77-Q4), commerce-record `refer` (Q2), card
  intelligence (Q3), AVS street persistence (Q4). Each makes the analytics *durable/native*
  rather than bridged — valuable, but none blocks taking money on day 1.
- **Don't** replicate weinform's full config-UI surface. The whole Shn design premise is that BC
  is the source of truth and we keep the bridge thin; rebuilding a 26-brand config tool re-creates
  the maintenance burden the team explicitly moved away from.

**One-line for the owner:** the CTO list is the right *fast-follow* backlog; reframe Q2/Q4 so we
don't send contradictory/stale premises, and decouple all of it from the launch gate.

## What I'm adding to the BC communication (this session)
See `docs/BC_CSR_DATA_EXPOSURE.md` — concrete CSR-tool asks: (a) add `zip`/`last4cc`/`phone` to
the CSR user-**search** `displayFields` (today they're filter-only, so the CSR Users-list Zip/CC
columns render "—" for everyone — same "expose the data" theme as Q3/Q4); and (b) the **intermittent
403 on `/message/admin/findNotes`** (+ 404 on `contactMessage/admin/find/:userId`) — a cold-load
session/auth race that's the likely cause of QA row 38 ("saved note not visible") **and** plausibly
row 4 ("Register Member worked before, not today"). Same 403 signature appears on `/database/search`.
