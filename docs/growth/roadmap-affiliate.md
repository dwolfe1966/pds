# Roadmap — Affiliate platform

**Status:** roadmap for review
**Goal:** a reusable affiliate platform that onboards traffic partners fast — with the first partners
(Fluent, MobileMarketing) as instances of the framework, not one-offs.

> Fluent / MobileMarketing are **partner-specific implementations**. The durable asset is the
> **platform**: capture → persist → convert → postback → report. Build the framework once; each new
> partner becomes a config + creative, not a rebuild.

---

## The affiliate framework (what every partner integration needs)

| Stage | What it does | State |
|---|---|---|
| **1. Capture** | Read partner URL params (`shN`, `shL`, custom click/sub-IDs) on landing | **Built** — `campaignResolver.js` + `campaignRegistry.js` resolve `shN`/`shL` to config; **extend** to carry arbitrary sub-IDs verbatim |
| **2. Persist** | Attach those params to the user + order so they survive to conversion | **Built** — `trackingService.js` assembles them into BC `data.refer`; **order-level `commerceorders.refer` persistence confirmed** |
| **3. Convert** | Fire the purchase/conversion (BC sale) | **Built** — GA4 + Ads conversion tracking live off the confirmed sale |
| **4. Postback** | Server-to-server call back to the partner on conversion, echoing their original params | **New** — none in `src/` today; port Fluent's compet pattern; fires server-side off the confirmed-sale signal (never a client pixel) |
| **5. Report** | Sales/conversions back to the partner on their cadence | **New** — monthly (Fluent), daily Google Sheet (MobileMarketing) |
| **6. Land** | Partner-appropriate landing experience | Reuse `/name/landing/v2` (people-search) or build a partner-specific one |

**Net:** stages 1–3 are largely built (attribution already reaches BC). The new platform work is the
**postback service (4)** + **reporting (5)** + the sub-ID passthrough extension (1).

## Postback design note (ties to the hosting decision)

- **Placement is resolved: BC emits the postback.** The pay-eligibility logic (CasA/CasD — see below) lives
  on **BC's backend**, and BC holds the order's persisted `refer_*` sub-IDs, so BC is the natural emitter —
  it fires the S2S postback **on captured payment**, echoing the partner's `refer_*`. (Not a client pixel —
  those get blocked, and prod strips `console.*`.)
- **CasA/CasD is our INTERNAL pay gate, never partner-facing.** BC pays a partner only on **CasA = captured
  payment** (the referral converted); **CasD = cascade decliner** (trial provisioned "in the door" — often
  despite an ISF-type card failure — but payment never captured) earns **no payout**. Payout fires on
  actual capture, not signup. Maps to the billing signal we already classify (`sale`/`fulfilled` vs
  `D{n}.{x}`).
- **Our side is nearly done:** persist the partner sub-IDs onto the order (Phase 0 ✅). Remaining is a
  **BC-coordination** item — hand BC each partner's postback URL/macros + confirm capture-gated firing —
  not a build on our funnel. (Supersedes the earlier "port a cascade offer-waterfall" reading — wrong.)

---

## Partner onboarding playbook (reusable per partner)

For each new partner, capture:
1. **Params** they pass in the URL (`shN`, `shL`, custom sub-IDs) + which must round-trip on the postback.
2. **Conversion tier** they pay on — **CasA vs CasD** — mapped to a concrete BC order/sale event.
3. **Postback URL + macro spec** (param names/format).
4. **Reporting** cadence + format (monthly / daily / sheet).
5. **Landing** (reuse `/name/landing/v2` or new) + **creative** (wall placement, etc.).
6. **Traffic type** (incentivized vs. app vs. search) — sets quality expectations + funnel choice.

---

## Partner instances

### Fluent (Incent) — incentivized traffic

- **Traffic:** incentivized (Incent) → low-intent. **"Direct to SUP"** fits. Creative + funnel must
  expect incent quality (affects CasA definition + any quality gating).
- **Conversion:** need **CasA** (= our Cascade-Acceptor event) — confirm Fluent is paid on cascade
  acceptance; firing it depends on porting the cascade flow (see Open items).
- **Reporting:** **monthly** sales (explicitly *not* CasD or CasA tiers) → monthly deliverable.
- **Postback:** S2S on sale, echoing the URL params they passed.
- **Placement:** on their wall → **marketing creative** needed.
- **Landing:** **new** Fluent landing routing straight to SUP.
- Note: Fluent's postbacks/reporting/cascades were implemented at compet — **port the pattern.**

### MobileMarketing (App traffic)

- **Traffic:** app → people-search *or* background-check funnel.
- **Conversion:** need **CasA** — ⚠️ open (same as above).
- **Reporting:** **daily** sales, likely a **Google Sheet** (not CasD/CasA) → daily deliverable.
- **Postback:** S2S on sale, echoing original URL params.
- **Front-end:** must **capture partner-URL params (SHNs, SHLs, custom IDs) and persist to BC** — the
  passthrough extension in stage 1. Most other work is backend.
- **Landing:** **reuse `/name/landing/v2`** (no new landing).

### Dimitri — *backlog*

- Named in the ex-CEO's partner notes, no spec yet. Slot into the onboarding playbook once requirements
  land. Placeholder so it isn't lost.

---

## Open items

- **CasA vs CasD — our INTERNAL pay gate, on BC's backend. Not a build on our side, not partner-facing.**
  BC pays a partner only on **CasA = captured payment**; **CasD = cascade decliner** (trial provisioned
  "in the door" despite a non-capturing card, e.g. ISF) earns no payout — payout fires on actual capture,
  not signup. It's the same billing capture signal we already classify (`sale`/`fulfilled` vs `D{n}.{x}`).
  **No cascade "offer-waterfall" to port — that reading was wrong.**
- **Postback URLs + macro/param spec** per partner → **hand to BC** (BC emits the postback on capture,
  echoing the persisted `refer_*`). The main remaining coordination item.
- **Placement: resolved — BC-emitted** (logic + refer_* live on BC). No longer tied to the hosting decision.

## Phasing

- **Phase 0 — ✅ passthrough shipped:** arbitrary partner sub-IDs now round-trip via generic `refer_*`
  capture → `commerceorders.refer` (`gtm.js` + `trackingService.js`; verified in-code). **Remaining:** a
  live end-to-end verify (a real purchase from a `refer_*` link → confirm the values land on the order),
  and send partners the **onboarding link spec + questionnaire**
  ([`affiliate-partner-onboarding-questionnaire.md`](affiliate-partner-onboarding-questionnaire.md)) — the
  partner-facing ask is just their **postback URL/macros** (no CasA/CasD — that's internal). Partner links
  pass sub-IDs as `refer_<name>` to our `/name/landing/v2` (people-search) or `/phone/landing/v2` (phone);
  shn/shl stay owned by BC automation.
- **Phase 1 — postback (BC-emitted):** BC fires the S2S postback on **captured payment** (CasA), echoing
  the persisted `refer_*`; CasD (no capture) → no payout. Our task is **coordination, not a build** — hand
  BC each partner's postback URL/macros + confirm capture-gated firing.
- **Phase 2 — Fluent landing + creative:** new direct-to-SUP landing; wall-placement creative.
- **Phase 3 — reporting:** monthly (Fluent) + daily Google Sheet (MobileMarketing).
- **Phase 4 — go live per partner** once postbacks reconcile against partner-side numbers.

## What we can do this week (visible progress, nothing gated)

- Phase 0: sub-ID passthrough + BC-persistence verification (pure client work, reversible).
- Send the CasA/CasD + postback-URL questionnaire to both partners.

## Owners (RACI)

*Roles, not names (assign in planning): **Lead** growth · **Eng** · **Analyst** · **Design** · **techBC**
BC eng · **Legal** · **CEO** · **Partner** (Fluent/MobileMarketing, external). RACI: R does the work ·
A accountable (one per row) · C consulted · I informed. **techBC/Partner rows are external-paced.***

| Phase / task | Wks | R | A | C | I |
|---|---|---|---|---|---|
| Phase 0 · sub-ID passthrough *(shipped)* | W0–1 | Eng | Lead | — | CEO |
| Live e2e verify (real purchase) | W1 | Eng, Analyst | Lead | techBC | — |
| Partners · postback URLs | W1–3 | Lead | Lead | Partner | Eng |
| BC · postback on capture (emit) | W3–6 | techBC | Lead | Eng | CEO |
| Fluent landing + creative | W3–5 | Eng, Design | Lead | — | CEO |
| Reporting (monthly / daily sheet) | W5–6 | Analyst | Lead | — | Partner |
| Go-live per partner | W6–8 | Lead | Lead | Partner, techBC | CEO |
