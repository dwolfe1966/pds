# Affiliate partner onboarding — link spec + questionnaire

Send to each partner (Fluent, MobileMarketing, …). Part A is **what we give them** (the tracking link);
Part B is **what we need back** to finish the integration. Companion to
[`roadmap-affiliate.md`](roadmap-affiliate.md).

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

1. **CasA vs CasD — define both.** They're distinct tiers in your reporting. For each: what is it, and
   **which tier are we paid on?** Map each to a concrete conversion event on our side (e.g. first sale /
   rebill / qualified lead) so our postback fires on the right one.
2. **Postback URL + macros.** The server-to-server URL we should call on a confirmed conversion, and the
   exact parameter names/macros you expect (which of your `refer_*` values to echo, plus any
   payout/event fields). Example: `https://you.example/postback?clickid={refer_clickid}&sub1={refer_s1}&event=sale`.
3. **Your sub-ID params.** List every macro you pass and what it means, and the `refer_<name>` you want it
   mapped to (Part A).
4. **Reporting.** Cadence + format you expect from us (Fluent = **monthly**; MobileMarketing = **daily,
   Google Sheet** — confirm). Which fields per row.
5. **Funnel + traffic type.** People-search / background / phone? Traffic type (incentivized, app,
   search)? This sets the landing + quality expectations.
6. **Creative.** For wall/placement: what sizes/assets do you need from us?

---

## Part C — what we already know (pre-filled; confirm/correct)

### Fluent (Incent)
- Traffic: **incentivized** → **direct-to-SUP** landing (new). Quality expectations set accordingly.
- Paid on: **CasA** — *need the definition (Q1)*.
- Reporting: **monthly** sales (not CasD/CasA tiers).
- Postback: yes — echo the `refer_*` you pass.
- Placement: on your wall → **we owe you creative** (Q6).

### MobileMarketing (App)
- Funnel: **people-search or background** → reuse `/name/landing/v2`.
- Paid on: **CasA** — *need the definition (Q1)*.
- Reporting: **daily**, likely a **Google Sheet** (not CasD/CasA).
- Postback: yes — echo the `refer_*` you pass.
- Front-end: pass your custom IDs as `refer_*` (Part A) — they persist to the order automatically.

### Dimitri — *awaiting requirements* (slot into Parts A/B when they land).

---

## Where this leaves the build (internal)
- ✅ **Sub-ID passthrough live** — arbitrary `refer_*` → `commerceorders.refer` (verified in-code; **live
  end-to-end verify pending**: a real purchase from a `refer_*` link → confirm the values on the order).
- ⏳ **Postback service** — build once CasA/CasD + postback URLs return (gated on Q1–Q2; placement ties to
  the app-hosting decision).
- ⏳ **Reporting** (monthly / daily sheet), **Fluent landing + creative**.
