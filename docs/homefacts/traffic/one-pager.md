# The HomeFacts partner traffic we're receiving — a profile

_Prepared for the NIC / HomeFacts discussion (D. Teng). This brief profiles **the traffic that currently reaches
our funnel through the HomeFacts partner link** — measured with our own server-side event log, not sampled
analytics. Its companion profiles HomeFacts's *own* audience and the opportunity to grow and monetize it._

**Window:** 2026-08-21 → 2026-08-24 (~68.7 hours continuous) · **13,218 events · 6,860 sessions.**
**Source:** idlookup.ai first-party log (`web_events`), every session arriving from the HomeFacts link (shN `6a7a2af6…`).

---

## Headline

**Of the 6,860 sessions the HomeFacts link delivered to us over ~3 days, 98.0% was automated bot/proxy traffic.
Only 2.0% (135 sessions) was real US traffic — and that slice behaved like real people.** Critically, this is
**not** a picture of HomeFacts's real audience: HomeFacts itself is **96.9% US** (SimilarWeb). The partner link
is passing us **bots, not the people HomeFacts actually reaches.**

| Cohort | Sessions | Share | Engaged past landing |
|---|---:|---:|---:|
| **Total** | 6,860 | 100% | — |
| **Real (US)** | 135 | 2.0% | **20.0%** |
| **Bot / proxy (non-US)** | 6,725 | 98.0% | **0.0%** |

---

## Why we're certain the 98% is automated

Four independent signals, all pointing the same way:

1. **Geography.** **97.9% originates in Singapore** (a global datacenter/proxy hub); 2.0% US; a handful of
   one-off others. A genuine US offender-lookup audience does not come 98% from Singapore.
2. **Zero engagement.** **6,725 of 6,725 non-US sessions (100%) loaded one page and left** — not one fired a
   second event. Exactly **1.00 events/session**, vs **2.30** for US traffic.
3. **One fingerprint.** **6,720 of 6,725** share an *identical* browser user-agent (`Mac OS X 10_15_7 / WebKit`)
   — the signature of a single automation, not thousands of distinct real devices.
4. **No human rhythm.** Non-US arrivals are a steady drip around the clock, including overnight hours, with no
   day/night curve. Humans sleep; this traffic doesn't.

Any one of these is suggestive; together they are conclusive.

---

## This is not HomeFacts's real audience — and that's the point

HomeFacts's *own* audience is **96.9% United States** (SimilarWeb), **~72–87% organic search**, and its top
organic queries are **real person names** (e.g. "andrew james davis," "connor whitworth"). So the 98% Singapore
bot traffic is specific to the **partner link we're receiving — not the people HomeFacts reaches.**

That sharpens the finding: **HomeFacts has a real, US, organic people-search audience, and it is not arriving in
our funnel.** Either the link is being crawled by bots, or the real users are still routed to the
TruthFinder / Intelius affiliate — either way, we are getting the noise and not the signal.

---

## The real slice behaves like real people

- **135 real US sessions** in ~3 days (≈45/day *through this link*).
- **20% engaged** — searched or viewed a profile; a handful reached checkout — normal human behavior (bots: 0%).
- **0 purchases through the HomeFacts link yet** (expected at this volume) — while our general funnels are
  converting real US buyers in the same window. The product and checkout work; the **link simply isn't
  delivering the real people** to convert.

---

## What this means

- **The HomeFacts link is passing us ~98% commercially-worthless traffic** — Singapore bot/proxy that will never
  convert — while HomeFacts's real, 96.9%-US, organic people-search audience goes elsewhere.
- **This is a routing / traffic-quality problem, not a demand problem.** The immediate step is simply to align on
  what this traffic is (this brief), then fix what the link delivers so HomeFacts's *real* audience is what flows
  — and can be monetized properly (see the companion brief).

---

## Supporting data (attached / reproducible)

- `homefacts-sessions.csv` — raw, one row per session: timestamp, country, cohort, arm, events, engaged, deepest
  step, user-agent · `homefacts-country-summary.csv` · `homefacts-hourly.csv`.
- Reproducible any time: `seo/scripts/homefacts-traffic-analysis.mjs` (regenerates all of the above).
