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

## Independently confirmed by Google Analytics

GA4 (idlookup.ai property, 30 days: Jul 25 – Aug 23) tells the same story from a **second, independent source.**
Across **11,202 users** on the /homefacts landing pages:

- **96.7% non-US** — Singapore 60% (average engagement **1.70 seconds**) plus a broad international tail (Brazil,
  Vietnam, Pakistan, Ukraine, Russia…), all with near-zero engagement.
- **3.3% US** (372 users, average engagement 25.2s) — **the only cohort that converted (1 key event).**
- **0 conversions from any non-US traffic.**

GA4 also shows the HomeFacts channel is the **source** of the bot flood: **95% of idlookup.ai's entire Singapore
traffic (6,739 of 7,125) entered through the HomeFacts pages.** Our first-party log (~98% bot) and GA4 (~96.7%
non-US) — two independent measurement systems — **agree.** Data: [GA4 "HomeFacts Traffic Origin" sheet](https://docs.google.com/spreadsheets/d/1KeZKF11RszaNHUmV2iWaUbql6Q_PTWcBTas6dZoKAa8/edit).

---

## This is not HomeFacts's real audience — and that's the point

HomeFacts's *own* audience is **96.9% United States** (SimilarWeb), **~72–87% organic search**, and its top
organic queries are **real person names** (e.g. "andrew james davis," "connor whitworth"). So the 98% Singapore
bot traffic is specific to the **partner link we're receiving — not the people HomeFacts reaches.**

That sharpens the finding: **HomeFacts has a real, US, organic people-search audience, and it is not arriving in
our funnel.** Either the link is being crawled by bots, or the real users are still routed to the
TruthFinder / Intelius affiliate — either way, we are getting the noise and not the signal.

---

## The real slice behaves like real people — and converts

- **135 real US sessions** in ~3 days (≈45/day *through this link*).
- **20% engaged** — searched or viewed a profile; several reached checkout — normal human behavior (bots: 0%).
- **1 purchase** from that tiny real slice — the **first real conversion through the link.** At ~135 US landings
  it's a small sample, but it proves the **real US audience does convert.** The 98% that are bots never will — so
  the more of HomeFacts's *real* audience the link delivers instead of bots, the more revenue it produces.

---

## What this means

- **The HomeFacts link is passing us ~98% commercially-worthless traffic** — Singapore bot/proxy that will never
  convert — while HomeFacts's real, 96.9%-US, organic people-search audience goes elsewhere.
- **This is a routing / traffic-quality problem, not a demand problem.** The immediate step is simply to align on
  what this traffic is (this brief), then fix what the link delivers so HomeFacts's *real* audience is what flows
  — and can be monetized properly (see the companion brief).

---

## Supporting data

- **GA4 export (independent corroboration):** [HomeFacts Traffic Origin sheet](https://docs.google.com/spreadsheets/d/1KeZKF11RszaNHUmV2iWaUbql6Q_PTWcBTas6dZoKAa8/edit)
  — all traffic by country + traffic to the /homefacts landing pages (idlookup.ai property, 30 days). Saved copy:
  `sources/ga4-homefacts-traffic-origin-30d.csv`.
- **First-party log:** `homefacts-sessions.csv` (one row per session: time, country, cohort, arm, events, engaged,
  deepest step, user-agent) · `homefacts-country-summary.csv` · `homefacts-hourly.csv`. Reproducible via
  `seo/scripts/homefacts-traffic-analysis.mjs`.
