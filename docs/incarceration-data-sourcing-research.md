# How the big providers source incarceration data — and the non-scrape options for NY/NJ

Research 2026-07-19 (owner asked: are there API/Bulk options for NY/NJ, and how do LexisNexis/TransUnion get it).

## How LexisNexis / TransUnion / CLEAR actually get it — they DON'T scrape
The investigative-data giants (LexisNexis **Accurint**, Thomson Reuters **CLEAR**, TransUnion **TLOxp**) are
**aggregators**: they LICENSE + merge data from thousands of sources, they don't one-off scrape public lookups.
TLOxp alone claims "10,000 sources / 95% of the US population." Their incarceration/booking data comes from:

1. **Appriss Insights (now Equifax) — the wholesale incarceration backbone.** Equifax bought Appriss for **$1.825B**
   (2021). Appriss runs **VINE** and holds **170M+ historical booking records, ~90% of near-real-time US
   incarcerations across ~2,900 jails/prisons**, +1M records/month. The DOCs/jails **push** their booking feeds
   TO Appriss (official integrations) — so Appriss never scrapes either. LexisNexis/TransUnion/background screeners
   (via CrimSmart/TraceSmart, CRAs) resell Appriss data.
2. **Direct bulk feeds from state DOCs** — obtained via data-sharing/purchase agreements or public-records law.
3. **Court-record vendors + AOC bulk feeds** + their own credit-header/proprietary data.

**Their own admitted weakness (this is our moat argument):** aggregated data is frequently **stale or wrong** —
every source above says "verify against the actual source/court." First-party, direct-from-DOC data (what we
scrape) is **fresher + more accurate + display-controlled + zero-marginal-cost**. The aggregators trade freshness
for instant nationwide breadth.

## The key insight for the anti-bot states (NY, NJ, KY…)
The WAF-protected public **web lookup is only the consumer surface**. The SAME data is available through official,
WAF-free channels the pros use:
- **Public-records / bulk request** (FOIL in NY, OPRA in NJ) — the DOC hands you a data extract directly.
- **An aggregator license** (Appriss/Equifax, or our existing Enformion) — instant, but rented + less fresh.

So "how do they beat the F5 wall on NY?" — **they go around it**, not through it.

## NY specifically
- **data.ny.gov "Inmates Under Custody" (Socrata 55zc-sp6m)** — free JSON API, BUT **de-identified**: fields are
  snapshot_year / crime / age / county / facility / security_level / race — **NO name, NO DIN**. It's a statistical
  snapshot, **useless for per-person lookup.** (Verified live.)
- **Name-searchable NY data** exists only via: (a) the F5-blocked lookup (scrape — hard), (b) a **FOIL request to
  DOCCS for a bulk offender extract** (DIN + name + facility + status + crime) — the clean first-party path, exactly
  like FL OBIS which we already bulk-ingest, or (c) **Enformion/aggregator**.

## NJ specifically
- **No open-data portal / bulk API found.** The Offender Search Engine updates **biweekly**; NJ frames it under OPRA.
- Options: (a) SPA scrape (in progress), (b) **OPRA request for a bulk offender extract**, (c) Enformion/aggregator.

## Recommended strategy (hybrid — the pros' model, cheaper)
1. **NOW / nationwide floor: enable Enformion Endato "Criminal Search V2"** (we already have the account — it's an
   entitlement flip, not a new vendor). That gives NY/NJ **and every hard state** nationwide criminal+incarceration
   data with mugshots, immediately, as a fallback under our first-party layer. Highest leverage per effort.
2. **First-party for the states we can scrape** (our 41/51) — fresher + free + our moat. Keep going.
3. **FOIL (NY) / OPRA (NJ) bulk requests** for the high-value hard states — brings them first-party over time (like
   FL/NC bulk), WAF-free, near-free, periodic refresh. Slow (weeks) + manual, but durable.
4. **Appriss/Equifax** is the "buy comprehensive" option if we ever want to stop scraping — expensive licensing,
   less fresh than first-party. Not recommended near-term; it's what we're differentiating AGAINST.

**Bottom line for NY/NJ:** the scrape is the hard path; the *pro* path is (1) our existing Enformion (once Criminal
V2 is on) for instant coverage + (2) a FOIL/OPRA bulk request to make them first-party. The open-data API is a dead
end for NY (de-identified).

## Sources
- Equifax/Appriss Insights (incarceration wholesaler): https://totalverify.equifax.com/blog/all-blogs/-/post/got-incarceration-data-evaluating-the-leading-industry-sources-1 · https://www.prnewswire.com/news-releases/equifax-announces-definitive-agreement-to-acquire-appriss-insights-301351900.html
- TransUnion TLOxp (criminal/booking data): https://www.transunion.com/blog/law-enforcement-speed-up-investigations
- NY DOCCS open dataset (de-identified): https://data.ny.gov/resource/55zc-sp6m.json · https://doccs.ny.gov/research-and-reports
- NY name lookup (F5-walled): https://nysdoccslookup.doccs.ny.gov/
- NJ Offender Search + OPRA framing: https://www.nj.gov/corrections/pages/OffenderInformation.html
