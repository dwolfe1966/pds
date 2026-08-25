# Paid Search — Wave 0 checklist + Wave 1 build sheet

**Companion to:** [`roadmap-paid-google-search-migration.md`](roadmap-paid-google-search-migration.md).
Operational build doc. Everything here obeys the **eCPA guardrails** (migrate like-for-like; one variable;
tCPA @ proven; small budget; kill-switch; respect conversion lag).

---

## Wave 0 — Foundations checklist (do ALL before any Wave-1 spend)

### A. Fix conversion tracking (the #1 blocker)
- [ ] **Audit misconfigured campaigns** — everything reading *"Eligible (Misconfigured) — missing a Google
      tag"*: `Reverse Phone – Track / Competitors / Call`, `PS Main – lower`, `LE – marriage lower`,
      `LE – divorce (lower)`, `BG – Misc Misc`. These are spending **untracked** (converting blind).
- [ ] **Install/verify the Google tag** (gtag or GTM) on **every** funnel page: `v11` landing, each SUP,
      and the **purchase/confirmation** step.
- [ ] **GCLID capture through the funnel** — confirm the ad `gclid` is captured on landing and **persisted
      through to the BC sale** (alongside `shns` in `referralParams` → `commerceorders.refer`). If gclid
      doesn't reach the conversion, **conversions won't attribute** and eCPA reads as ∞. This is the make-
      or-break wire.
- [ ] **Conversion action = the purchase/sale** (not a soft event). Count = *one* per click (acquisition);
      **value = order value** (for ROAS/value-cost). Consider **Enhanced Conversions** for accuracy.
- [ ] **Verify on a REAL purchase** — test buy → confirm it lands in Google Ads "Recent conversions" +
      GA4 realtime. (GA4 drops headless/bot hits — must be a real human purchase.)

### B. Guardrails (build before spend)
- [ ] **Portfolio Target CPA** bid strategy created (pools learning across the migrated core).
- [ ] **eCPA kill-switch** automated rule: *Pause campaign when* `Cost/conv (last 7 days) > 1.4 × target
      CPA` **AND** `Conversions (last 7 days) ≥ 15`; run daily; email alert. (The ≥15 floor stops it
      firing on noise.)
- [ ] **Budget guard** — daily budgets set at the Wave-1 starts below (ceilings, not targets).

### C. Structure & hygiene
- [ ] **Account-ownership check per campaign** — anything already in **our** account → **modify in place**
      (repoint landing to `v11`, keep bid learning); only *rebuild* what lives solely in the source account.
- [ ] Conversion actions, **standard naming** (`Vertical – Segment – v1`), **geo = US**, ad schedule.
- [ ] **Shared negative-keyword list** (jobs, free-only, "how to", competitor-brand as needed) + brand list.
- [ ] **Landing/CVR pre-check** — where possible, estimate `v11` CVR per vertical from existing traffic so
      the landing (the one unavoidable variable) isn't a blind change.

**Wave 0 exit:** a real purchase attributes in Google Ads + GA4; portfolio tCPA + kill-switch live.

---

## Wave 1 — campaign build sheet (the 9-campaign core)

**Every campaign:** bid = **portfolio Target CPA seeded at the Target CPA below**; keywords/match/copy
**ported verbatim** from the source campaign (they earned the eCPA — do not rewrite except for policy);
attribution via the `shns` id; geo US; shared negatives attached. **No keyword broadening** — that's a
later expansion sibling.

| # | Campaign (`new name`) | Landing / SUP · `shns` | Start $/day | Target CPA | Keyword themes to PORT (replace w/ source's exact winners) | Policy watch |
|---|---|---|---|---|---|---|
| 1 | `Inmate – Lower – v1` | v11 + inmate/booking SUP · `inmate-lo` | $100 | $10 | "find an inmate", "[state] inmate search", "[county] jail inmate lookup", "inmate locator", "vine lookup" | low |
| 2 | `Inmate – Upper – v1` | inmate/booking SUP · `inmate-up` | $250 | $14 | same as #1, upper-HHI audience | low |
| 3 | `PubRec-SSN – Lower – v1` | v11 + records SUP · `pubrec-ssn-lo` | $100 | $10 | "public records search", "background public records", "people records lookup" | ⚠ **SSN** — see rule |
| 4 | `LifeEvents-Death – Upper – v1` | LE teaser (death/obit) · `le-death-up` | $200 | $15 | "obituary search", "[state] death records", "find obituary", "recent deaths" | ⚠ sensitive-event |
| 5 | `LifeEvents-Divorce – Upper – v1` | LE teaser (divorce) · `le-div-up` | $200 | $17 | "[state] divorce records", "divorce record lookup", "is someone divorced" | med |
| 6 | `PubRec – Broad – v1` | records SUP · `pubrec` | $150 | $13 | "public records search", "free public records", "public records [name]" | med |
| 7 | `PubRec-SSN – Broad – v1` | records/SSN · `pubrec-ssn` | $75 | $9 | "public records lookup", "background records" | ⚠ **SSN** |
| 8 | `Criminal-Court – v1` | v11 + criminal SUP · `crim-court` | $75 | $9 | "criminal records search", "court records lookup", "criminal background check" | ⚠ criminal-copy |
| 9 | `Criminal-Arrests – v1` | criminal SUP · `crim-arrest` | $75 | $17 | "arrest records", "recent arrests", "[county] arrest records" | ⚠ arrest-copy |

> Keyword themes are **seeds for structure** — the actual build must **import the source campaign's exact
> keywords + match types**, because that specific set (not a paraphrase) is what earned the proven eCPA.
> Same for ad copy: **port the winning headlines/descriptions verbatim**, fix only policy.

### Ad-copy policy rules (fix at import; don't invent new claims)
- **SSN (#3, #7)** — Google **prohibits** ads that facilitate finding a person's SSN. Frame strictly as
  **"public records"**; **no "find/lookup SSN" copy**. Treat as the highest policy risk in Wave 1 — legal/
  policy sign-off before launch.
- **Criminal / arrests (#8, #9)** — no implication of guilt; "**public arrest/court records may be
  available**"; never target or name individuals. Arrests copy has defamation exposure — sign-off.
- **Life-events / death (#4)** — sensitive-event policy; respectful framing, no exploitative urgency.
- **Never** reuse the `"$1 / credit-card-required"` disclosure pattern — disclose price/terms per Google.

### `shns` id map (attribution → BC `commerceorders.refer`)
Assign the ids in the table (`inmate-lo`, `inmate-up`, `pubrec-ssn-lo`, `le-death-up`, `le-div-up`,
`pubrec`, `pubrec-ssn`, `crim-court`, `crim-arrest`). Confirm the resolver maps each to the right
vertical SUP; default to `v11` where a vertical SUP isn't built yet.

### Per-campaign launch steps (repeat for each of the 9)
1. Build campaign in our account with the `new name`; attach to the **portfolio tCPA** at its Target CPA.
2. Import the source campaign's **exact keywords + match types**; attach shared negatives.
3. Import the **winning ad units verbatim**; apply the policy fixes above.
4. Final URL = the landing/SUP with `?shns=<id>`; confirm gclid + shns persist to the sale.
5. Set the **start budget**; confirm the **kill-switch** covers the campaign.
6. Launch **Paused → enable**; **do not touch for the conversion window + ≥15 conv** (respect lag).
7. At ≥15–30 conv: if eCPA ≤ proven, hold/raise budget; if > proven ×1.4, the kill-switch pauses it →
   diagnose the **landing first** (the one changed variable).

---

## What NOT to do (the eCPA traps)
- ❌ Launch on uncapped **Maximize Conversions** — CPA floats up during learning.
- ❌ **Broaden keywords** or loosen match at migration — new queries = new (worse) eCPA mixed into the core.
- ❌ Change **two levers at once** — you lose attribution of any eCPA move.
- ❌ **React early** to a high eCPA before the conversion window + ≥15 conv — resets learning, worsens it.
- ❌ Fold an **expansion test** into a proven campaign — spin a separate sibling so the core stays clean.
