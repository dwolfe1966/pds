# HomeFacts Traffic Quality — first-party analysis

**Window:** 2026-08-21 20:54 → 2026-08-22 12:24 PT (~22.5 hours, continuous).
**Source:** idlookup.ai first-party event log (`web_events`) — every session that arrived from the HomeFacts
partner link (shN `6a7a2af6…`). This is our own server-side log, not a sampled analytics estimate.

---

## Headline

**Of 1,571 sessions HomeFacts sent us in ~22.5 hours, 97.4% was automated bot/proxy traffic. Only 2.6% (41
sessions) was real US traffic — and that slice behaved like real people.**

| Cohort | Sessions | Share | Engaged past landing |
|---|---:|---:|---:|
| **Total** | 1,571 | 100% | — |
| **Real (US)** | 41 | 2.6% | **17.1%** |
| **Bot / proxy (non-US)** | 1,530 | 97.4% | **0.0%** |

---

## Why we're certain the 97% is automated

Four independent signals, all pointing the same way:

1. **Geography.** 97.3% originates in **Singapore** (a global datacenter/proxy hub); 2.6% US; 0.1% Colombia.
   A genuine US offender-lookup audience does not come 97% from Singapore.
2. **Zero engagement.** **1,530 of 1,530 non-US sessions (100%) loaded a single page and left** — not one fired
   a second event (no click, no search). Exactly **1.00 events/session** vs **1.68** for US traffic.
3. **One fingerprint.** **1,529 of 1,530** share an *identical* browser user-agent (`Mac OS X 10_15_7 / WebKit`)
   — the signature of a single automation, not 1,500 distinct real devices.
4. **No human rhythm.** Non-US arrivals are a flat **~50–114 landings/hour around the clock**, including 4–8am,
   with no day/night curve. Humans sleep; this traffic doesn't.

Any one of these is suggestive; together they are conclusive.

---

## There is a real audience underneath

- **41 real US sessions** in ~22.5h (≈44/day at this rate).
- **17% engaged** — searched or viewed a profile — normal human behavior.
- **0 purchases from HomeFacts yet** (expected at 41 landings), **but** our general funnels converted **11 real
  US buyers** in the same window — proving the product and checkout work end-to-end. The HomeFacts channel
  simply isn't delivering enough *real* people to convert.

---

## Why this matters (and the opportunity)

- **~97% of HomeFacts traffic has no commercial value.** However the channel is currently valued or monetized,
  the overwhelming majority is Singapore bot/proxy traffic that will never convert for anyone.
- **A real, engaged US offender-lookup audience exists** beneath the noise — today tiny in our funnel and
  historically handed off to TruthFinder / Intelius for a per-lead sliver.
- **This is a management problem, not a demand problem.** Filtering the bot traffic and properly monetizing the
  real audience is exactly the case for **idlookup taking over management of HomeFacts** — but first, the
  immediate step is aligning with leadership on what the traffic actually is.

---

## Supporting data (attached)

- `homefacts-sessions.csv` — raw, one row per session (1,571): timestamp, country, cohort, arm, events, engaged,
  deepest step reached, user-agent.
- `homefacts-country-summary.csv` — sessions + engagement by country.
- `homefacts-hourly.csv` — hourly landings, US vs non-US (shows the flat 24/7 bot pattern).
- Reproducible any time: `seo/scripts/homefacts-traffic-analysis.mjs`.
