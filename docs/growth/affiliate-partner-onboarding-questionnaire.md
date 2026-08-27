# Affiliate partner onboarding — link spec + questionnaire

**Parts A–B are partner-facing** (Part A = the tracking link we give them; Part B = what we need back).
**Part C is internal — do NOT send.** Companion to [`roadmap-affiliate.md`](roadmap-affiliate.md).

---

## Part A — the tracking link we hand you

Send traffic to our landing with your sub-IDs passed as **`refer_<name>`** params. Anything you pass as
`refer_*` is **captured on landing, persisted to the order, and echoed back on our postback** — so use it
for every ID you need to reconcile (click id, sub ids, creative, etc.). *(This is live as of the Phase-0
passthrough — [`gtm.js`](../../src/services/gtm.js) / [`trackingService.js`](../../src/services/trackingService.js).)*

**People-search / background funnel (MobileMarketing can reuse this):**
```
https://idlookup.ai/name/landing/v2?shns=<YOUR_SHN>&refer_partnerId=<partner>&refer_clickid={CLICK_ID}&refer_s1={SUB1}&refer_s2={SUB2}
```
**Phone funnel (reverse-phone intent):**
```
https://idlookup.ai/phone/landing/v2?shns=<YOUR_SHN>&refer_partnerId=<partner>&refer_clickid={CLICK_ID}&refer_s1={SUB1}
```
**Fluent (direct-to-SUP):** a dedicated landing that routes straight to the SUP (built in Track B); same
`refer_*` convention.

Rules of the road:
- Replace `{CLICK_ID}` / `{SUB1}` with **your macros**. Map each of your macros → one `refer_<name>`.
- **`shns`** = the partner/campaign code we assign you (drives pricing + the SUP shown). We give you this.
- Do **not** pass `shn`/`shl` yourself beyond `shns` — our system + BC own that resolution.
- Every `refer_<name>` you send comes back **verbatim** on the postback (Part B) for reconciliation.

---

## Part B — what we need from you (please fill + return)

> We fire your postback **only on a captured/confirmed sale** (our standard — we don't postback on an
> unconverted signup).

1. **Postback URL + macros.** The server-to-server URL we call when a sale is confirmed, and the exact
   parameter names/macros you expect (which of your `refer_*` values to echo back, plus any payout/event
   fields). Example: `https://you.example/postback?clickid={refer_clickid}&sub1={refer_s1}&event=sale`.
2. **Your sub-ID params.** List every macro you pass and what it means, and the `refer_<name>` you want it
   mapped to (Part A).
3. **Reporting.** Cadence + format you expect from us (Fluent = **monthly**; MobileMarketing = **daily,
   Google Sheet** — confirm). Which fields per row.
4. **Funnel + traffic type.** People-search / background / phone? Traffic type (incentivized, app,
   search)? This sets the landing + quality expectations.
5. **Creative.** For wall/placement: what sizes/assets do you need from us?

---

## Part C — internal reference (do NOT send to partners)

**Payout eligibility is ours, on BC's backend — never a partner conversation.** BC decides when we pay a
partner via internal cascade states: **CasA = captured payment** (a referral that converted; **pay**) vs
**CasD = cascade decliner** (provisioned/trialed but payment never captured; **don't pay**). We routinely
provision a trial "in the door" even when the card first fails for certain reasons (e.g. ISF) and attempt
capture at subscription conversion — so **payout fires on actual capture, not signup.** This maps to the
same billing signal we already classify (`sale`/`fulfilled` = captured; `D{n}.{x}` = declining) — see
[`../../.claude/... project_csr_billing_classification`]. Partners only ever see: a postback on a
confirmed sale + their report.

Per-partner:
- **Fluent (Incent):** incentivized → **direct-to-SUP** landing (new); **monthly** report; postback echoes
  `refer_*`; **we owe creative** for the wall.
- **MobileMarketing (App):** people-search/background → reuse `/name/landing/v2`; **daily Google Sheet**;
  postback echoes `refer_*`; front-end passes custom IDs as `refer_*` (persist to order automatically).
- **Inmate Search partner:** awaiting requirements.

---

## Where this leaves the build (internal)
- ✅ **Sub-ID passthrough live** — arbitrary `refer_*` → `commerceorders.refer` (verified in-code; **live
  end-to-end verify pending**: a real purchase from a `refer_*` link → confirm the values on the order).
- ⏳ **Postback service** — build once CasA/CasD + postback URLs return (gated on Q1–Q2; placement ties to
  the app-hosting decision).
- ⏳ **Reporting** (monthly / daily sheet), **Fluent landing + creative**.
