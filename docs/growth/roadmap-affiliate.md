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

- Postbacks **fire server-side from a conversion-confirmed point** (BC sale) — client pixels get blocked
  and prod strips `console.*`. Hang the postback off the **same confirmed-sale signal GA4/Ads already
  uses**.
- Open design question: **where the receiver runs** — BC emits the postback directly, or a backend of
  ours receives the BC conversion and fans out to partners. This depends on the **SEO/app hosting
  decision** (Vercel vs BC infra) — pin CasA/CasD + partner postback URLs first, finalize placement with
  that decision.

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
- **Conversion:** need **CasA** — *confirm exact BC-event definition + that Fluent is paid on CasA.* ⚠️ open.
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

## Open items (gate the postback build — do not guess)

- **CasA vs CasD** — distinct partner-facing sale/conversion tiers. Need each one's exact definition +
  which tier each partner is paid on, mapped to a concrete BC order/sale event. Confirm with
  Fluent/MobileMarketing + BC billing.
- **Postback URLs + macro/param spec** per partner.
- **Postback-receiver placement** (BC-emitted vs. our backend) — decide with the hosting decision.

## Phasing

- **Phase 0 — now (no open item blocks it):** extend the refer passthrough to carry arbitrary partner
  sub-IDs verbatim; verify end-to-end that a MobileMarketing-style URL's params persist onto the BC
  order (`commerceorders.refer`). Reuse `/name/landing/v2`. In parallel, send partners the CasA/CasD +
  postback-URL questionnaire.
- **Phase 1 — postback service:** build/port the S2S postback off the confirmed-sale signal; wire
  CasA/CasD mapping once confirmed; placement per hosting decision.
- **Phase 2 — Fluent landing + creative:** new direct-to-SUP landing; wall-placement creative.
- **Phase 3 — reporting:** monthly (Fluent) + daily Google Sheet (MobileMarketing).
- **Phase 4 — go live per partner** once postbacks reconcile against partner-side numbers.

## What we can do this week (visible progress, nothing gated)

- Phase 0: sub-ID passthrough + BC-persistence verification (pure client work, reversible).
- Send the CasA/CasD + postback-URL questionnaire to both partners.
