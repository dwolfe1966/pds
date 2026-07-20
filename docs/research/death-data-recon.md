# Death vertical — data-source recon

**Date:** 2026-07-20 · question: what powers the death (v13) angle — teaser hook + report payoff?

## Headline: license an obituary API (like divorce→Enformion), NOT scrape. SSDI is out.

Death records are as fragmented as marriage/divorce (~3,000 funeral homes + thousands of newspapers + county
probate), and the two richest scrape targets are legally fraught. So — same conclusion as the marriage/divorce
research — **a licensed, purpose-built obituary API is the pragmatic primary**, with **IDI's `deathList`
(already in the paid BC report) as the free report payoff**.

## The landscape

| Source | Named lookup | Data | Access / ToS | Cost | Verdict |
|---|---|---|---|---|---|
| **SSDI / DMF** | historical only | DOD, SSN-based | **certification-gated** (15 CFR 1110); **3-yr lag** on recent deaths; 2025 data-quality mess (living people added) | — | ❌ **OUT** — gated + stale for recent deaths |
| **FindAGrave** | yes | burial/cemetery, dates, photos | no API; scrape; **Ancestry-owned → litigious ToS** | scrape | ⚠️ moat but legal risk |
| **Legacy.com** | yes | **obituary text, funeral home, survivors** (richest) | no API; scrape; ToS | scrape | ⚠️ richest content but ToS |
| **ObituaryMonitor — Death Verification API** | ✅ name+DOB+city+state | death date, place, **obituary URL**, funeral home, confidence score | **licensed** (display via license); US 50+DC; daily refresh | **~$449/mo flat for 1–5k searches** (subscription, not per-match) | ✅ **clean teaser hook** |
| **AIS Death Data** | yes | obituaries (3,000+ funeral homes) + newspapers + county probate | licensed; online/batch/API | unknown — get quote | ✅ richer; confirm cost |
| **Tracers — Deceased Records** | yes | DOD + relatives | licensed (skip-trace); batch/API | unknown; NEW vendor | ✅ if worth a new vendor |
| **IDI `deathList` (via BC report)** | in report | date, state, source | **already paid** (in the report) | ~free post-pay | ✅ **report payoff NOW** |

## Recommendation
- **Teaser hook (the conversion payoff for v13):** license **ObituaryMonitor** (or price **AIS Death Data** for
  richer content). It's the death-equivalent of Enformion-for-divorce: named lookup, US-wide, and — key — a
  **flat monthly subscription (~$449 for 1–5k searches)**, so cost is *bounded* even on the high-volume teaser
  (unlike per-match). Delivers exactly the v13 promise: "confirm a passing" + death date + place + obituary link.
- **Report payoff (buildable NOW, $0):** surface IDI's `deathList` (already extracted as `data.deaths`) as a
  "Death Records & Obituary" section on the paid report. Makes the death *report* real today, no new vendor.
- **Scrape (FindAGrave / Legacy):** optional future moat, but Ancestry's litigious ToS + fragmentation make the
  licensed API the pragmatic primary — exactly the divorce conclusion (license > scrape when scraping is legally
  fraught). Legacy.com has the richest content (obituary text/survivors) if we ever accept the ToS risk.

## Owner decisions
1. **Approve a death/obituary API vendor** — ObituaryMonitor (~$449/mo, verification+link) vs. AIS Death Data
   (richer, get quote) vs. Tracers. New vendor + cost. This unlocks the v13 *teaser*.
2. **Build the free IDI post-pay death report section now** (no vendor, no approval needed) — makes the death
   *report* real immediately while the vendor decision is made.

## Build shape (once a teaser source is picked) — mirrors divorce
- `seo/lib/lifeEvents.mjs`: add a `deathSearch(query, env)` provider (obituary API), self-gating like marriage.
- `/api/life-events`: return `recordType:'death'` records; person-keyed cache (bound the subscription usage).
- Engine `getPersonSignals`: add a `death` signal + `FLOW_PRIORITY.death = { lead:'death' }`.
- `SignalTeaser`: a Death atomic renderer ("Died {date} · {place} — view obituary").
- v13 `DEATH_CFG`: add `flow:'death'`, `teaser:'death'` (currently absent → why v13 is silent).
- Report: render `data.deaths` (IDI) as the Death section (independent of the teaser vendor).
