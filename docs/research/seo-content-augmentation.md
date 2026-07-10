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

---

# Part B — Exact codes & file formats (implementation reference)

_Added 2026-07-10 after the ACS prototype (`seo/scripts/fetch-acs.mjs`) landed 99.9%
match (2,067/2,070 cities → `seo/data/city-acs.json`). This section is what the fetchers
expand from._

## B1. ACS 5-year variable catalog (the full high-value set)

Dataset path uses the **end year**: `/2023/acs/acs5` = 2019–2023 5-year. Geography:
`?get=NAME,<vars>&for=place:*&in=state:<FIPS>&key=<KEY>`. **The API allows up to 50
variables per `get=` call**, so our whole catalog (~40) fits in ONE call per state — no
extra API cost to go from the current 9 vars to the full set. Full searchable catalog:
`api.census.gov/data/2023/acs/acs5/variables.html`.

**Population & age**
- `B01003_001E` total population · `B01002_001E` median age
- `B01001_002E` male / `B01001_026E` female → sex ratio

**Race / ethnicity** — use **B03002** (Hispanic-aware), not B02001
- `B03002_001E` total · `_003E` White NH · `_004E` Black NH · `_006E` Asian NH ·
  `_005E` AIAN NH · `_012E` Hispanic (any race) → compute % each

**Households**
- `B11001_001E` households · `B25010_001E` avg household size

**Income / poverty**
- `B19013_001E` median HH income · `B19301_001E` per-capita income
- `B17001_002E` / `B17001_001E` → poverty rate

**Housing**
- `B25077_001E` median home value · `B25064_001E` median gross rent
- `B25003_001E`/`_002E`/`_003E` occupied/owner/renter → tenure % · `B25035_001E` median year built

**Education (pop 25+)** — `B15003`
- `_001E` total · `_017E` HS · `_021E` associate · `_022E` bachelor · `_023E` master ·
  `_024E` professional · `_025E` doctorate → % HS+, % BA+ (leaf already computes BA+)

**Employment / occupation / commute**
- `B23025_003E` civilian labor force / `_005E` unemployed → unemployment rate
- `C24010` occupation-by-sex → "top occupations"
- `B08303_001E` total commuters · `B08301_021E` worked from home

**Marital** — `B12001` (married/never/divorced) if we want it.

**State→FIPS** map is already in the fetcher. `PR` and territories skipped (place coverage differs).

## B2. SSA given names — the FIRST-name dimension (public domain)
- **National:** `https://www.ssa.gov/oact/babynames/names.zip` → `yob1880.txt … yob2024.txt`,
  each line `name,sex,count`, sorted sex then count-desc. 1880–present.
- **State:** `https://www.ssa.gov/oact/babynames/state/namesbystate.zip` → `{ST}.TXT`,
  each line `state,sex,year,name,count`. 1910–present.
- Privacy: names with <5 occurrences in a geography are suppressed.
- **Derive per first name:** total count, gender split, all-time rank, decade of peak,
  trend line, and **per-state popularity rank** (state files) → "David is the #N male name in CA."

## B3. Census names — the SURNAME (and first-name) dimension (public domain)
- **2020 Census names (NEWER — first AND last names):**
  `https://www.census.gov/topics/population/genealogy/data/2020_names.html` — names occurring
  ≥100 times, with race/ethnicity breakdown. **Prefer this over the 2010 file.**
- **2010 surnames (fallback / well-documented columns):**
  `Names_2010Census.csv` — columns: `name, rank, count, prop100k, cum_prop100k, pctwhite,
  pctblack, pctapi, pctaian, pct2prace, pcthispanic` (suppressed cells = `(S)`).
- **Derive per surname:** national count, rank, race/ethnicity distribution → "Smith is the
  #1 U.S. surname (~2.4M)…".

## B4. Join plan
- `city-acs.json` (DONE) — keyed `ST/city-slug`.
- Next: build `name-facts.json` from SSA + Census names, keyed by first-name and surname;
  join to `name-slice.json`'s `{first,last}`.
- Page templates then read `city-acs` + `name-facts` (no runtime API calls — all pre-cached,
  consistent with the ISR economics in `lib/data.js`).

## Sources
- [ACS Data via API](https://www.census.gov/programs-surveys/acs/data/data-via-api.html) ·
  [Census Developers / datasets](https://www.census.gov/data/developers/data-sets.html) ·
  [ACS 5-year](https://www.census.gov/data/developers/data-sets/acs-5year.html)
- [Wikidata SPARQL examples](https://www.wikidata.org/wiki/Wikidata:SPARQL_query_service/queries/examples)
- [SSA Popular Baby Names](https://www.ssa.gov/oact/babynames/) ·
  [names.zip (national)](https://www.ssa.gov/oact/babynames/names.zip) ·
  [namesbystate.zip](https://www.ssa.gov/oact/babynames/state/namesbystate.zip)
- [Census 2020 first & last names](https://www.census.gov/topics/population/genealogy/data/2020_names.html) ·
  [2010 surnames](https://www.census.gov/topics/population/genealogy/data/2010_surnames.html)
- [Reusing Wikipedia content (CC BY-SA)](https://en.wikipedia.org/wiki/Wikipedia:Reusing_Wikipedia_content)
