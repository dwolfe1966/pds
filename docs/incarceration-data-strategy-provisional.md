# Incarceration Data Sourcing — Provisional Strategic Assessment

**Status: PROVISIONAL — 2026-07-18.** Living document; being extended as the state-by-state canvas + build
proceeds. Supersedes the source-status snapshot in `datasources-status-2026-07-18.md` at the strategy level.

---

## Strategic thesis: a first-party, nationwide incarceration dataset is a structural moat
Owner call (2026-07-18): scrape **every** state inmate locator (+ county jails) to build our OWN nationwide
incarceration database, rather than renting per-search access from aggregators. This isn't a feature — it's
a moat:

- **Zero marginal cost.** Aggregators (UCC/Enformion) bill per search; a first-party DB costs nothing per
  query. It's the ONLY way the freemium/community north-star works at scale — you can't give away searches
  you pay per-call for.
- **Display control.** Aggregators gate what we may show (the recurring display-permission blocker).
  Scraped **public government records** are ours to structure, display, and build products on (with care).
- **SEO compounding.** First-party data → indexable pages we own (the idlookup.me engine). Aggregator data
  generally can't be republished for SEO. Inmate/booking pages are high-intent, low-competition queries.
- **The maintenance burden IS the moat.** 50 state sites + thousands of county jails that break constantly
  is *why competitors don't do this well*. Building the pipeline + monitoring to keep it green is the durable
  operational edge — not the data itself.

## The county-jail leverage insight
State DOC = **prison** population (long-term, fewer people). The high-volume, mugshot-rich, high-search-intent
data is **county jail bookings** (arrests) — thousands of sites. Key: most counties don't build their own —
they run a handful of **jail-management vendor platforms**. Scrape the *vendor platform* pattern once →
cover hundreds of counties per scraper. That's what makes county coverage tractable (not 3,000 one-offs).

## Guardrails (build it defensibly)
- Public records, but respect binding ToS/robots, rate-limit politely, no CAPTCHA-busting. Keep it defensible.
- **Never pay-to-remove mugshots** (~18 states outlaw it). Free, prompt takedown + honor opt-out/expungement.
  This is law AND brand.
- Aggregators are the **bridge** (turn on UCC now for breadth while we build) and the **backfill** for
  un-scraped states — not the destination.

---

## Source landscape (provisional)
Four tiers, best→worst effort-per-value:

| Tier | What | Example | Effort |
|---|---|---|---|
| **1. Named bulk download** | full roster file, names + fields | **FL OBIS** (done) | low — ingest once |
| **2. JSON/XHR API behind a locator** | reproduce the site's own data call | (per-state recon) | low-med |
| **3. HTML-form scrape** | server-rendered search → parse HTML | (per-state recon) | med |
| **4. SPA / anti-bot** | JS-rendered or captcha'd | CA CIRIS (likely) | high — headless (Playwright) |

### Key finding: NAMED bulk data is rare
Two kinds of "open" state data exist, and only one is useful:
- **Named roster** (searchable by name) — what a people-search product needs. **FL is nearly unique** in
  publishing this in bulk.
- **De-identified stats** (demographics/counts, NO names) — what most "open data" portals publish. Verified:
  NY's `data.ny.gov` "Incarcerated Individuals Under Custody" (id `55zc-sp6m`) has columns
  `snapshot_year, admission_type, county, gender, crime, age, facility, security, race` — **no name, no DIN**.
  NC's ASQ = "not specific offender identities." IL population datasets = same pattern (aggregate).
- **Named web locator** — all 50 states have one (named, one-at-a-time). With scraper capability, ALL 50
  become viable sources. This is the plan.

## Big-6 states — BUILT 2026-07-18 (`seo/lib/stateInmates.mjs`, wired into findBookings as `stateDoc`)
| State | Method | Mugshots | Live on Vercel? | Notes |
|---|---|---|---|---|
| FL | OBIS bulk (Neon) | ✅ | ✅ | separate (floridaObis provider) |
| **CA** | CDCR CIRIS JSON API | ❌ | ✅ **14 recs verified** | needs full `$limit+$skip+$sort`, literal `$` |
| **PA** | PA DOC Captor JSON API | ✅ (detail data-URI) | ✅ **29 recs verified** | mugshot opt-in (STATE_INMATES_PHOTOS) |
| **IL** | IDOC 2-step ASP | ✅ (URL) | ✅ verified | mugshot = pub_showfront.asp URL |
| **TX** | TDCJ HTML POST | ❌ | ❌ **IP-BLOCKED** | works via curl; TDCJ blocks Vercel/datacenter IPs → needs proxy |
| **NY** | DOCCS JSON POST | ❌ | ⛔ browser-tier | F5 BIG-IP WAF; TS cookie needs a real browser (Playwright) |
| **NJ** | DOC (SPA) | ❌ | ⛔ browser-tier | SPA/anti-bot; curl sample failed; roster IS crawlable via browser |

### Infra reality (this IS the moat's operational surface)
Three egress classes emerged — the operational capability to handle all three is the durable edge:
1. **Direct from Vercel** — CA, PA, IL (JSON APIs + old ASP). Just works.
2. **Datacenter-IP-blocked** — TX (TDCJ). Needs a **residential/rotating proxy** egress.
3. **JS/WAF-gated** — NY (F5). Needs **headless browser** (Playwright) to mint the challenge cookie.

## Aggregators (the bridge)
- **UCC** — verified self-serve; `GET unlimitedcriminalchecks.com/api-2.0/search.php`, X-API-Key+X-API-Secret,
  ~$0.01/search, mugshots + DOC + arrest + court + sex-offender. Best breadth NOW while we build. Needs keys
  + written display permission. (See `datasources-status-2026-07-18.md`.)
- **Enformion Criminal Search V2** — waiting on Enformion Sales.
- **JailBase** — dropped (chronic 503).

## Architecture (target)
- `seo/lib/incarceration.mjs` — provider-abstracted (existing). Add per-state adapters (`stateInmates.mjs`)
  behind the same normalized `BookingRecord` shape + `findBookings()` merge/dedupe.
- Live-scrape-per-search first (fast to ship), then **crawl-to-DB** where enumeration is possible
  (sequential DOC numbers / browse-all) to build the first-party table (like `fl_inmates`) → zero-cost queries + SEO.
- Headless (Playwright) tier for SPA/anti-bot states.

## Status / next
- **Live recon running** (parallel) for TX/CA/NY/IL/PA/NJ: each finds the real data endpoint, pulls a sample,
  returns an adapter spec. Build the working adapters from that; browser-tier the rest.
- Then: expand the canvas to all remaining states + the county-jail vendor-platform map.
- Open: legal review of scraping posture per source; storage/retention fine (our DB, public records).
