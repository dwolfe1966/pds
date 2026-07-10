# SEO Content Augmentation — Source Landscape

_Research findings — 2026-07-10. "What's out there" for enriching the state/city/name
directory pages so they carry genuinely unique, useful content (not thin/doorway pages)._

Companion to: `docs/research/idi-data-access.md` (data-layer licensing) and the
city-grain taxonomy (`seo/lib/directory.js`, ~866k pages gated at `estInCity ∈ [2,750)`).

---

## The governing principle (read this first)

**Facts are free. Prose is not.**

- Population counts, median age, founding dates, coordinates, name frequencies — **facts
  are not copyrightable.** We can take them from any source, including Wikipedia's
  infoboxes, with no license obligation.
- Descriptive **prose is copyrightable.** Wikipedia text is **CC BY-SA 4.0** — usable
  only with *attribution + share-alike* (our derived text would have to be CC BY-SA too).
- Copying Wikipedia prose is also an **SEO dead-end**: Google canonicalizes duplicate
  content to the original, so our copy of a Wikipedia paragraph will never outrank
  Wikipedia — it just adds thin, non-ranking bulk.

**→ Strategy: pull structured FACTS from public-domain / CC0 sources, then GENERATE our
own unique prose from them.** This is license-clean *and* SEO-optimal in one move. Unique,
data-grounded pages are exactly what ranks and what dodges the "doorway page" penalty.

---

## Tier 1 — the clean pillars (public domain / CC0, API-accessible, authoritative)

### A. U.S. Census — American Community Survey (ACS) — the CITY dimension
- **License:** public domain (U.S. government work). No attribution required.
- **Access:** `api.census.gov`, free API key.
- **⚠️ Use ACS _5-year_ estimates, not 1-year.** 1-year only covers places ≥65,000 pop;
  **5-year covers _every_ place down to block-group regardless of size** — essential
  because most of our 2,070 cities are small. Latest is the 2020–2024 5-year release.
- **What it gives (per place):** total population, median age + age bands, sex, race /
  ethnicity, household & family size, median household income, poverty rate, educational
  attainment, employment & top occupations/industries, median home value, median rent,
  owner-vs-renter split, commute time.
- **Fit:** the backbone of every **city landing** page. One batch sweep of our city list
  → cache to JSON/Neon. Cheap, high-value, zero license friction.

### B. SSA given names + Census surnames — the NAME dimension
- **License:** public domain (both).
- **SSA Popular Baby Names** (`ssa.gov/oact/babynames`): national + per-state, 1880–2025,
  fields name/year/sex/state/count from a 100% sample of SS card applications. Privacy
  guard: names with <5 occurrences in a geography are suppressed. → first-name popularity,
  decade/era trend, gender split, rank.
- **Census "Frequently Occurring Surnames"** (decennial surname file): surname rank,
  national count, and race/ethnicity distribution per surname. → surname frequency +
  origin/ethnicity context.
- **Fit:** powers the **name-in-city leaf** pages with real, name-specific content
  ("Smith is the #1 U.S. surname, ~2.4M people…"; "David peaked in popularity in the
  1960s…"). This is the content that makes a leaf page non-thin.

### C. Wikidata — supplementary structured facts
- **License:** **CC0** (public-domain dedication — no attribution required). 94M+ entities.
- **Access:** SPARQL endpoint + REST API.
- **City properties:** P1082 population, P625 coordinates, P571 inception/founded, P2046
  area, elevation, P131 county / admin parent, timezone, sister cities, official website.
- **Fit:** fills the gaps ACS doesn't carry — founding/incorporation date, county seat,
  elevation, area — all CC0. A single SPARQL sweep keyed on our city list.

---

## Tier 2 — supplementary public-domain government sources (later depth)

| Source | Gives | Access |
|---|---|---|
| **BLS** (Bureau of Labor Statistics) | employment, wages by metro area | public domain, API |
| **FBI UCR / Crime Data Explorer** | city crime statistics | public domain, API |
| **NOAA / NWS Climate Normals** | weather/climate by location | public domain |
| **IRS SOI** | income statistics by ZIP | public domain, bulk |
| **HUD** | fair-market rent, housing | public domain, API |
| **USGS GNIS / Census Gazetteer** | place names, coordinates, land area | public domain, bulk |
| **data.gov** | catalog/aggregator over all of the above | public domain |

All public domain — safe to display, no attribution required.

---

## Tier 3 — usable but with strings (prefer to avoid for prose)

- **Wikipedia prose** — CC BY-SA. **Extract facts from infoboxes; do not copy sentences.**
  (Attribution + share-alike + duplicate-content = not worth it for text.)
- **OpenStreetMap** — ODbL. POIs/amenities/boundaries; attribution + share-alike on the
  *database*. Fine for a "places near" widget if we attribute.
- **GeoNames** — CC BY. Alternate place dataset; attribution required.
- **Proprietary (City-Data, Niche, Zillow, Redfin)** — **do not scrape.** Terms + copyright.

---

## Our own data — the actual SEO moat

The differentiator isn't the government data (competitors have it too) — it's what only we
can compute:
- **Estimated count of a name in a city** (our `estInCity` model).
- **Common names in a city / state** derived from our name slice + SSA.
- **Nearby cities** (we have coordinates).
- **Dense internal linking** across name hubs ↔ state ↔ city ↔ leaf.

Government facts make each page *credible and non-thin*; our derived data makes it *unique*.

---

## Per-page content plan (where each source lands)

**City landing — `/people/[state]/[city]`**
- Header: population, founded (Wikidata), county.
- Demographic snapshot (ACS 5-yr): pop, median age, households, median income, home value,
  education, top occupations.
- "Common names in [City]" → links to name-in-city leaves (our data + SSA).
- Nearby cities (our coords).
- Generated prose synthesizing the above in our own voice.

**Name-in-city leaf — `/people/[state]/[city]/[name]`**
- Header: "[Name] in [City], [State]" + estimated count (our model).
- First-name profile: popularity, decade peak, gender split (SSA).
- Surname profile: rank, count, ethnicity distribution (Census surnames).
- City context: a compact subset of the city demographics.
- SERP CTA into idlookup.ai + generated unique prose.

---

## Recommended first integration (sequence)

1. **ACS 5-year sweep** of our ~2,070-city list → cache (JSON now, Neon at scale). Highest
   value, one API pass, license-clean.
2. **SSA given-names + Census surname** bulk files → join to the existing name slice.
3. **Wikidata SPARQL sweep** for founded/county/elevation/coords on our cities.
4. **Prose generation** from the joined facts (templated with real variation, our voice).

## Licensing bottom line
- **Tier 1 (Census + SSA + Wikidata) = zero friction, no attribution required.** Build here.
- **Never copy Wikipedia/proprietary prose.** Facts only, then our own words.

## Sources
- [ACS Data via API](https://www.census.gov/programs-surveys/acs/data/data-via-api.html) ·
  [Census Developers / datasets](https://www.census.gov/data/developers/data-sets.html) ·
  [ACS 5-year](https://www.census.gov/data/developers/data-sets/acs-5year.html)
- [Wikidata SPARQL examples](https://www.wikidata.org/wiki/Wikidata:SPARQL_query_service/queries/examples)
- [SSA Popular Baby Names](https://www.ssa.gov/oact/babynames/) ·
  [Baby names data.gov (state)](https://catalog.data.gov/dataset/baby-names-from-social-security-card-applications-state-and-district-of-columbia-data)
- [Reusing Wikipedia content (CC BY-SA)](https://en.wikipedia.org/wiki/Wikipedia:Reusing_Wikipedia_content)
