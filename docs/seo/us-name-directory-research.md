# Building a US Name + People Directory to Seed a Programmatic-SEO People-Search Site

**Status:** Research findings, compiled 2026-07-04. **Not legal advice** — sections flagged ⚠️ need counsel review before any product decision relies on them. All download URLs and record counts below were verified live against primary sources on 2026-07-03/04 unless marked otherwise. Where a figure could not be primary-verified it is flagged UNCERTAIN.

## Purpose & framing

We mint one indexable profile page per person-record (Spokeo/MyLife model). We already have a **per-profile hydration provider** — BC/IDI, an internal TransUnion/LexisNexis-equivalent identity/locator source — that we query on-demand for a specific first+last name and get back real people + city/state + attribute counts.

Two hard constraints shape everything below:

1. **BC/IDI cannot enumerate.** It answers "who is *John Smith*?" but not "list all Smiths in CA." So it cannot, by itself, generate the **URL universe** (the name×location skeleton) that a pSEO site needs.
2. **BC/IDI refuses very common ("head-term") names.** The most-searched names — exactly the highest-SEO-value pages — come back empty or rejected.

So we need **external data for two distinct jobs**: (A) a **name-universe skeleton** to know which name/location pages could exist and to prioritize by search demand, and (B) a **supplemental enumeration source** to cover the head-terms BC refuses. The founder's MyLife precedent maps cleanly: they built the name universe from open/public data, then **hydrated per-name via TransUnion & LexisNexis** (the hydration role BC/IDI now plays for us). BC/IDI is our hydration layer; its *only* gap vs TU/LN is the common-name refusal, so the second source exists **specifically and only** to cover refused head-terms.

---

## 1. Name-universe / skeleton sources (public / government)

These give the **name space** and the **location dimension** — the raw material for the URL skeleton. They are aggregate frequency tables, **not lists of real people**, so they cannot themselves populate a profile; they tell us *which* names exist and how common they are (= search demand proxy).

### 1a. US Census Bureau — Frequently Occurring Surnames

**2010 file (mature, clean, best drop-in):**
- Landing: https://www.census.gov/topics/population/genealogy/data/2010_surnames.html
- **162,253 surnames**, threshold = every surname **occurring ≥100 times** nationally (covers ~90% of the population).
- Fields: `NAME`, `RANK`, `COUNT`, `PROP100K`, `CUM_PROP100K`, and race/ethnicity percentage columns `PCTWHITE`, `PCTBLACK`, `PCTAPI`, `PCTAIAN`, `PCT2PRACE`, `PCTHISPANIC` (cells below disclosure threshold shown as `(S)`).
- Download (verified 200): full list zip (CSV+XLSX, ~13 MB) https://www2.census.gov/topics/genealogy/2010surnames/names.zip · Top-1000 XLSX https://www2.census.gov/topics/genealogy/2010surnames/Names_2010Census_Top1000.xlsx · methodology PDF https://www2.census.gov/topics/genealogy/2010surnames/surnames.pdf · live API `https://api.census.gov/data/2010/surname`
- License: US federal government work — public-domain-equivalent. Aggregated counts; does not identify individuals.

**2020 file — YES, IT NOW EXISTS (released 2026-04-14):** This is a change from the long-standing "2010 is the latest" situation, and the first Census name data since 1990 to include **first names**.
- Landing: https://www.census.gov/topics/population/genealogy/data/2020_names.html · press release https://www.census.gov/newsroom/press-releases/2026/2020-census-names-data.html · report C2020BR-14 https://www.census.gov/library/publications/2026/dec/c2020br-14.html
- **156,621 last names** and **53,615 first names**, threshold = **≥100 occurrences**.
- Breakdowns: last names × race/Hispanic; first names × race/Hispanic; first names × sex.
- Download (verified 200): last names https://www2.census.gov/topics/genealogy/2020surnames/Names2020_LastNames_RaceHispanic.xlsx · first names × sex https://www2.census.gov/topics/genealogy/2020surnames/Names2020_FirstNames_Sex.xlsx · first names × race https://www2.census.gov/topics/genealogy/2020surnames/Names2020_FirstNames_RaceHispanic.xlsx
- Caveat: ships as **separate XLSX workbooks** (sex/race split), not one tidy `RANK`/`PROP100K` table like 2010, and uses a "negative-adjusted" disclosure treatment. For a clean single-table drop-in the **2010 file is easier**; use 2020 for freshness + first-name breakdowns.

### 1b. SSA Baby Names (national + by-state first names)

- Landing/limits: https://www.ssa.gov/oact/babynames/limits.html · background https://www.ssa.gov/oact/babynames/background.html
- Download: national **https://www.ssa.gov/oact/babynames/names.zip** · state+DC **https://www.ssa.gov/oact/babynames/state/namesbystate.zip** (SSA bot-blocks automated fetch with 403; links confirmed via the data.gov mirror and work in a browser).
- Coverage: national **1880→present** (data.gov lists through birth-year 2025, updated 2026-05-08); state **1910→present**.
- Format: zip of per-year text files. National `yobYYYY.txt` records = `name,sex,number`; state `ST.txt` records = `state,sex,year,name,number`.
- **Privacy threshold:** names with **<5 occurrences** in any geography/year are excluded (so state sums < national).
- **BIRTHS, not living population:** a 100% sample of Social Security card applications (birth-cohort frequency by sex + year of birth) — **not** a count of people currently alive with that name; older cohorts include the deceased, and it excludes anyone who never got an SSN. Use it for first-name **prevalence/era signal**, not living-population estimates.
- License: public domain / US Government Work; data.gov tags it **CC0 1.0**. https://catalog.data.gov/dataset/baby-names-from-social-security-card-applications-national-data

### 1c. Census Gazetteer / places (the location dimension)

- Landing (2023 vintage, latest): https://www.census.gov/geographies/reference-files/2023/geo/gazetter-file.html (note the literal "gazetter" spelling in the URL) · record layouts https://www.census.gov/programs-surveys/geography/technical-documentation/records-layout/gaz-record-layouts/gaz23-record-layouts.html · raw index https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2023_Gazetteer/
- Geographies: national/state, counties, county subdivisions, **places (cities/towns)**, tracts, **ZCTAs**, congressional/legislative districts, school districts, urban areas.
- Download (verified 200): places https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2023_Gazetteer/2023_Gaz_place_national.zip · counties `...2023_Gaz_counties_national.zip` · ZCTAs `...2023_Gaz_zcta_national.zip`
- Format: tab-delimited UTF-8, zipped.
- Fields (places): `USPS, GEOID, ANSICODE, NAME, LSAD, FUNCSTAT, ALAND, AWATER, ALAND_SQMI, AWATER_SQMI, INTPTLAT, INTPTLONG`.
- **⚠️ Population correction:** the Gazetteer files **do NOT contain population** — only name, geo code, land/water area, and lat/long. For population (to prioritize location hubs) join a separate source keyed on `GEOID`: decennial P.L. 94-171 or **ACS** via `api.census.gov/data/2022/acs/acs5`, or download place-level population from data.census.gov.
- License: federal government work, public domain.

### 1d. Other open name-frequency sources

- **IPUMS USA** — name variables `NAMEFRST`/`NAMELAST` are **restricted** (Ancestry.com contract); not in the public files, application required. Great for research under license, **not** an open seed. Skip. https://usa.ipums.org/usa-action/variables/NAMEFRST
- **Data.gov** — a catalog, not a new source; its name datasets *are* the SSA/Census files above, useful mainly for canonical links + machine-readable license tags.
- **philipperemy/name-dataset** (PyPI `names-dataset`) — ~730K first / ~983K last names with gender + country. **Data provenance red flag:** derived from a leaked Facebook dump (~533M users). MIT code license, problematic data origin — **avoid** for a commercial site. https://github.com/philipperemy/name-dataset
- **sigpwned/popular-names-by-country-dataset** — forenames+surnames by country, cleaner provenance; worth a look for international breadth. https://github.com/sigpwned/popular-names-by-country-dataset
- **Kaggle mirrors** of SSA/Census — convenience copies, no new data, public-domain inherited.

**Skeleton bottom line:** first names ← SSA (CC0, births not living); surnames + demographics ← Census 2010 (clean) + 2020 (fresh, adds first names); locations ← 2023 Gazetteer + join ACS population by `GEOID`.

---

## 2. Real-people public-records sources (name → actual location)

These list **actual people** by name + location and can therefore *populate* profiles or seed enumeration for head-terms — but each carries coverage bias and legal constraints.

### 2a. State voter registration files (biggest coverage, biggest legal risk)

**Availability (EAC/Ballotpedia framing):** the EAC classifies each state as **open / mixed / restricted**. Per ~mid-2025 reporting: **10 states + DC free** to eligible requesters; **~24 states $1–$1,000**; **~13 states $1,001–$10,000**; top end **~$37,000**. https://ballotpedia.org/Availability_of_state_voter_files · https://www.eac.gov/sites/default/files/voters/Available_Voter_File_Information.pdf

- **Open/cheap examples:** Ohio (FREE download, https://data.ohiosos.gov/voter), North Carolina (FREE, withholds DOB/SSN/DL#, https://www.ncsbe.gov/results-data/voter-registration-data), Washington (free for "political purposes", RCW 29A.08.125), Florida (~$0, confirm), Michigan (QVF ~$23 via FOIA), Texas (~$1,279, "open" but commercial-use-barred).
- **Restricted / purpose-limited examples** (per NCSL): California (Elec. Code §2194/§2188 — election/scholarly/journalistic/political/governmental only; **commercial use is a misdemeanor**; data may not appear on any medium "routinely available to the public"), Hawaii, Minnesota, New Mexico (misuse = **4th-degree felony**), North Dakota, Tennessee, Wyoming. https://www.ncsl.org/elections-and-campaigns/access-to-and-use-of-voter-registration-lists · https://www.sos.ca.gov/administration/regulations/current-regulations/elections/access-voter-registration-information

**Fields:** full name, residential (+ mailing) address, registration date, voter status, precinct/jurisdiction, unique voter ID, and **voter history** (*which* elections voted in — never *who* they voted for). Varies by state: **party** only where there's party registration; **DOB vs age vs withheld** (WA releases DOB; NC withholds it); race/gender/phone inconsistent; **SSN/DL# essentially always confidential** — which limits value for disambiguating same-name people.

**National coverage if aggregated:** ~174M (Census self-report registered, 2024) to ~211M active registered (EAC 2024 EAVS) — i.e. **200M+ adults** with name+address, though skewed toward registrants and thinned by redactions.

**⚠️ The critical legal constraint — commercial online publication:**
- **~37 states statutorily prohibit commercial use / resale** of voter data (penalties from misdemeanor to felony). A paid consumer people-search index is close to the textbook prohibited "commercial use."
- Some states **explicitly ban putting voter data on the internet in searchable form** regardless of purpose — e.g. **Minnesota Stat. §201.091 subd. 4** bars placing list info "on the internet … in any list, database, or searchable format." That targets exactly what a people-search site does.
- **Active litigation:** the Voter Reference Foundation (VoteRef.com) has tried to publish state rolls online and faces suits/cease-and-desists in MA, NJ (Daniel's Law regime), PA, VA, SD. A First-Amendment-flavored *nonprofit* publisher gets sued; a *for-profit* republisher is more exposed, not less. https://www.propublica.org/article/voter-ref-foundation
- **Commercial aggregators exist but don't launder the restrictions:** L2, Aristotle, Catalist, TargetSmart, PDI license 50-state data under contracts that **flow down the state purpose-limits** (political/nonprofit/academic); L2 flags every record with a traceable ID and vets buyers against non-political use. https://l2-data.com/

**Verdict:** obtainable and broad, but **legally encumbered — not an open public-records windfall.** Do not build commercial display on voter data without a state-by-state permissibility matrix and legal sign-off. Best-case use is narrow: enumeration *seed* in the handful of states whose statutes don't bar commercial/online use, treated as a lead to hydrate via BC/IDI rather than as published content. ⚠️ counsel required.

### 2b. FEC individual contributions

- Bulk: **`itcont.txt`** (pipe-delimited) + header file `indiv_header_file.csv`; browse at https://www.fec.gov/data/browse-data/ ; API **OpenFEC** https://api.open.fec.gov/developers/ (DEMO_KEY works; 1,000 calls/hr with a free key).
- Fields: contributor **name, city, state, ZIP, employer, occupation**, amount, date (102+ fields total).
- Volume: tens of millions of rows per cycle, but **only itemized donors ($200+) are included** — a wealth/engagement-biased subset, not general population.
- License: public domain.
- **Legal note:** federal law (52 U.S.C. §30111 / 11 CFR 104.15) **prohibits using FEC contributor information for commercial solicitation or sale**. Usable as a locator/enrichment signal, **not** as a marketing list; the "commercial solicitation" bar needs counsel review for a people-search context. ⚠️

### 2c. Property / assessor records

- County parcel + ownership (owner name + property address), **~3,000 counties**, fragmented access (many free portals, some bulk-for-fee). Public-record status, but aggregator licenses restrict resale.
- Aggregators: **Regrid/Loveland** — **149M+ parcels** nationwide, ownership/address/zoning/attributes via a single API, **paid license** (https://regrid.com/ , https://regrid.com/api); also ATTOM, CoreLogic.
- Strong for name→address on **property owners**; misses renters, and dedup across 3,000 county schemas is real work.

### 2d. Professional-license registries

- State boards (nursing, medical, real estate, contractors, cosmetology, bar). Name + city + license type; public lookup, some states offer bulk/FOIA. **Occupation-limited coverage** but high-quality, defensibly-public data. Good for occupation-scoped hub pages.

### 2e. Business registrations / SoS filings

- Registered agents, officers, LLC members (name + address). **OpenCorporates** aggregates millions of companies with an API (https://api.opencorporates.com/) — note its terms restrict bulk/commercial reuse; check licensing. Narrow to business-affiliated people.
- Supplemental: obituaries, court records (PACER), marriage/property indices.

> **⚠️ Note:** the FEC/property/licenses/business detail in §2b–2e was grounded by direct verification of the load-bearing facts (FEC bulk file + OpenFEC, Regrid 149M parcels, OpenCorporates API); a dedicated sub-agent sweep of these sources was still completing at write time. Reconfirm per-source access terms before ingesting.

---

## 3. The broker / enumeration layer (the MyLife TU/LN equivalent)

**Key correction up front:** the classic "MyLife used TransUnion & LexisNexis" story describes **per-name hydration**, not enumeration — and those gated products are **the wrong tool for an open people-search display today.** The dividing line is **bulk/enumeration vs. permissible-purpose-gated lookup.**

### 3a. FCRA/GLBA/DPPA-gated tier — powerful, but NOT for open display or enumeration

- **LexisNexis Accurint / Risk Solutions** — names/aliases, address history, phones (incl. unlisted/cell), relatives/associates, SSN-trace, over an 84–92B-record pool linked by LexID. Enterprise contract-only, credentialed, permissible-purpose gated. **Batch append = yes** (Accurint Batch Services); **open-ended enumeration = no** — every query needs an initialed GLBA + DPPA permissible use. Verbatim: *"Accurint does not constitute a 'consumer report' as defined in the FCRA."* https://risk.lexisnexis.com/products/accurint-for-collections---contact-and-locate-workflow
- **TransUnion TLOxp** (rebranding consumer-facing as **TruLookup**) — ~10,000 sources fused into people/asset/relationship profiles. Credentialed accounts, permissible-purpose gated, **mandatory physical site inspection** to onboard. Verified pricing from a FOIA'd *law-enforcement* schedule: **$75/mo minimum**, people search **$0.40**, Comprehensive report **$7.00** (LE rates; commercial differs — don't treat as universal). **Batch/API = yes; purposeless enumeration/public display = no.** https://www.transunion.com/business-needs/investigations-tloxp
- Peers in this tier: **IDI/idiCORE** (Red Violet), **Pipl** (now fraud/identity, "vets every customer"), **Ekata** (Mastercard — verification, not browsable search). All gate every access; none fit open consumer display.

**Why this matters:** a public people-search page **asserts no GLBA/DPPA permissible purpose**, so it cannot lawfully surface the gated credit-header/DMV tiers. That is precisely *why* mainstream people-search operators source from **lower-tier public-records/marketing data**, not from Accurint/TLOxp — and why touching the gated tier and letting output be used for eligibility is exactly what the FTC has penalized (see §6). ⚠️ This inference is well-supported synthesis of FTC + vendor documents, not a single citable ruling — counsel review.

### 3b. Self-serve identity-graph APIs — the tier that actually fits open people-search

| Vendor | Enumeration? | Access / cost |
|---|---|---|
| **EnformionGO / Endato** | **YES** — Person Search returns a *list* of matching people; 25+ endpoints (295M profiles / 43B records claim) | **Self-serve**, free 100 matches/mo, no contract/minimums, dashboard + code samples; posts not-a-CRA disclaimer. https://go.enformion.com/developer-apis/ |
| **Enformion (direct)** | YES — enterprise identity graph (40+ yr, 98%+ US); same graph feeds the self-serve API | Enterprise |
| **People Data Labs** | Search/enrich, but **B2B/professional**, not consumer public-records | Self-serve; Pro from ~$98/mo (~$0.28/match) |
| **FullContact** | Enrich/resolve (marketing-oriented), not consumer enumeration | Self-serve dev API |
| **TruePeopleSearch (model)** | Free name/phone/address lookup from public records + social | Free public-records aggregation |

**Corrected corporate facts (the brief had these wrong):**
- **Endato = Enformion's self-serve brand → rebranded "EnformionGO" on 2025-06-02.** It is *not* TruthFinder's data arm. https://go.enformion.com/
- **BeenVerified is owned by The Lifetime Value Co. (LTVco), NOT PeopleConnect.** LTVco = BeenVerified, PeopleLooker, NeighborWho, Ownerly, PeopleSmart, NumberGuru, Bumper. **PeopleConnect** is a *separate* operator (Intelius, TruthFinder, Instant Checkmate, US Search). https://www.ltvco.com/founders/
- **No evidence Enformion supplies PeopleConnect** — don't assert that link.

**Enumeration-layer bottom line:** the vendor whose model fits our need — cheap, no contract, returns a *list* of matching identities, self-serve key, not-a-CRA framing — is **EnformionGO/Endato**. That is the realistic supplemental source for the head-terms BC/IDI refuses; the gated brokers are not.

---

## 4. Open-source libraries for name parsing / frequency / dedup

**Name & address parsing**
- **python-nameparser** (`HumanName`) — syntax-based personal-name parser (title/first/middle/last/suffix). https://github.com/derek73/python-nameparser
- **probablepeople** (DataMade) — probabilistic parser for names *and* corporate/entity names. https://github.com/datamade/probablepeople
- **libpostal / pypostal** — statistical international address parsing/normalization (C lib + Python binding), essential for normalizing the address side.

**Name → attribute inference / reference data**
- **`names-dataset`** (philipperemy) — gender + country per name (provenance caveat, §1d).
- **ethnicolr** — name→race/ethnicity inference trained on Census/voter data (useful for demographic hub facets, use carefully).
- **gender-guesser**, and the **`us`** package (state FIPS/abbrev metadata) for the location join.

**Record linkage / entity resolution / dedup** (the core of de-duping merged sources)
- **Splink** (MoJ Analytical Services) — fast, scalable **probabilistic** linkage; DuckDB on a laptop (~1M records/min) or Spark/Athena for **100M+**; term-frequency adjustments, no unique-ID required. Best fit for our scale. https://github.com/moj-analytical-services/splink
- **dedupe** (dedupeio) — active-learning fuzzy matching/dedup, **MIT license**, great for interactive labeling. https://github.com/dedupeio/dedupe
- **recordlinkage** (Python) — classic feature-based linkage toolkit, good for mid-size.
- **Zingg** — Spark-based ML entity resolution for enterprise scale.

**Recommendation:** parse with nameparser/probablepeople + libpostal → block/link with **Splink** (scales to our merged universe) → use **dedupe** for the human-in-the-loop labeling phase.

---

## 5. Recommended architecture for OUR case

The synthesis: **public skeleton defines the URL universe and priority → BC/IDI hydrates on demand → a self-serve enumeration source (Enformion/Endato) or narrowly-scoped public records covers the head-terms BC refuses → location hubs are built from what hydration actually returns → thin combos are noindexed.**

### The pipeline

1. **Build the name space (offline, one-time + annual refresh).**
   Cross Census surnames (162K from 2010, or 156K from 2020) × SSA/Census first names (top N by frequency). The full Cartesian product is ~162K × ~50K ≈ **8 billion** combos — absurd to mint. **Prioritize by frequency = search demand:** rank first names and surnames by count, and generate candidate pages from the **high-frequency band** first (e.g. top ~5K surnames × top ~2K first names ≈ 10M candidate name pages), expanding down the long tail as hydration proves them out.

2. **Hydrate per-name via BC/IDI (on demand, the core loop).**
   For each candidate first+last, query BC/IDI → get real people + city/state + attribute counts. **Only mint/index a page where BC returns real people.** This is the gate that keeps the index real and non-thin.

3. **Build location hubs from returned locations, not from the skeleton.**
   Don't pre-generate "John Smith in Toledo" from the Gazetteer. Instead, take the **cities/states BC actually returned** for a name and build `/name/{first}-{last}/{state}` and `/{state}/{city}` hubs from real hits. The Gazetteer (+ ACS population by `GEOID`) supplies canonical location names, spelling, and population weighting for hub prioritization — but the *existence* of a name×location page is driven by hydration output.

4. **Cover the head-terms BC refuses via a supplemental enumeration source.**
   For the common names BC rejects (Smith, Johnson, Garcia…), call a **self-serve identity-graph API (EnformionGO/Endato)** whose Person Search *returns a list* of matching people by name — split the query by state/city to get under any result cap and to produce the location breakdown BC couldn't. This is the **only** role of the second source: it substitutes for BC on the refused head-terms, feeding the same profile/hub minting pipeline.
   - **Cheap probe first (do before building a second pipeline):** does BC refuse on **name-alone** or **name+location**? If adding a city/state drops the result set under BC's refusal threshold, we may cover many head-terms *with BC itself* by iterating over Gazetteer locations — no second vendor needed for those. Test this before committing to Enformion volume.

5. **Avoid thin combos (noindex).**
   - Never index a name×location page that hydration returned **empty** for.
   - Set a **minimum-content bar** (e.g. ≥1 real person with ≥N attributes) before a page is indexable; below it, `noindex,follow` so crawl equity flows but Google doesn't see thin doorway pages.
   - De-dup people across BC + Enformion + public records with **Splink** before minting, so the same person doesn't spawn duplicate profiles.
   - Canonicalize name variants (nickname↔legal via nameparser) to one profile.

### Phased, cost-aware rollout

- **Phase 0 — skeleton + probe (days, ~$0 data cost).** Download Census surnames + SSA names + Gazetteer (all free/CC0). Build the frequency-ranked name/location tables. Run the **BC name-alone vs name+location refusal probe** (step 4). Decide whether a second vendor is even needed at head-terms.
- **Phase 1 — hydrate the head + mid band via BC (metered).** Mint pages for the top name bands where BC returns people. Build location hubs from real returns. This is pure BC cost + engineering; no new vendor.
- **Phase 2 — head-term supplement (only if the probe says BC can't cover them).** Start on **EnformionGO/Endato free tier (100/mo)** to validate the list-enumeration shape and page quality, then scale to paid volume for the refused head-terms. Keep it scoped to head-terms — the long tail stays on BC.
- **Phase 3 — enrich + long tail.** Layer defensible public records (property/assessor via Regrid, professional licenses) for richer profiles and additional hub facets; expand the name band downward as hydration economics allow.

**Deliberately NOT used:** voter files as *published content* (§2a legal risk), and the FCRA/GLBA/DPPA-gated brokers (Accurint/TLOxp) for display/enumeration (§3a — wrong permissible-purpose fit).

---

## 6. Legal / compliance notes

**⚠️ All of this needs review by counsel before launch.** Detail below was grounded by direct source verification; a dedicated legal-research sub-agent sweep was still completing at write time.

- **Public-records aggregation posture.** Publishing lawfully-obtained public records is broadly protected, but bounded by the FCRA, state privacy torts, and **source-specific use restrictions** (voter-file commercial bans §2a, FEC anti-solicitation §2b, DPPA/GLBA on the broker tier §3a). "It's public" is not a blanket permission — the *source's* terms travel with the data.
- **Non-FCRA framing (mandatory).** Operate as a **non-consumer-reporting-agency** and post the disclaimer everywhere output appears: *"not a consumer reporting agency; do not use for FCRA eligibility purposes"* (credit, employment, insurance, housing/tenant screening — 15 U.S.C. §1681b(a)(3)–(6)). **But the disclaimer is not a shield** — FTC guidance is explicit that if reports are marketed or expected to be used for eligibility, the FCRA applies regardless. Enforcement history: Spokeo **$800K** (2012), Instant Checkmate/**InfoTrack** (2014), TruthFinder/Instant Checkmate group **$5.8M** (2023). (Note: the oft-cited "LexisNexis 2023 CFPB action" does **not** appear to exist — the real hit was a ~$13.5M private *Berry v. LexisNexis* settlement ~2014–15.) https://www.ftc.gov/business-guidance/blog/2013/01/background-screening-reports-fcra-just-saying-youre-not-consumer-reporting-agency-isnt-enough
- **State data-broker registration laws (register + honor deletion):**
  - **California** — CCPA/CPRA + the **Delete Act** and its **DROP** (Delete Request & Opt-out Platform): data brokers register with the **CPPA**; beginning **2026-08-01**, brokers must check the accessible deletion mechanism **at least every 45 days** and process consumer deletion requests (Cal. Civ. Code §1798.99.86). https://cppa.ca.gov/data_brokers/ · https://privacy.ca.gov/drop-for-data-brokers/
  - **Vermont** — first-in-nation (2018/2019), **9 V.S.A. §§2446–2447**: register annually, maintain security, honor use limits.
  - **Texas** — registration before operating, **$300 fee**. **Oregon** — registration + fee + opt-out disclosure. (More states converging on the same register-and-delete model.)
- **Opt-out / suppression obligations.** Must offer a working opt-out/deletion path (CCPA/CPRA right to delete; DROP universal-delete cadence). Maintain a **suppression list** so deleted/opted-out records don't get re-minted on the next hydration pass — this is an architectural requirement, not just a policy page.
- **Address-suppression regimes.** **Daniel's Law (NJ)** and analogous statutes let judges, law-enforcement, and certain officials demand removal of home address/phone; NJ's regime (Atlas Data Privacy litigation) has driven active suits against publishers. Build a **priority takedown path** for these protected classes.
- **Source-law constraints on inputs.** DPPA (DMV data) and GLBA (credit-header) gate the broker tier; voter statutes gate §2a; FEC gates §2b. Our lower-tier/public-records + self-serve-graph sourcing (§3b) is the lower-risk path, but each source's terms must be honored in-contract.

---

## Recommended next steps

1. **Download the free skeleton now** (zero legal risk): Census 2010 + 2020 surnames/first-names, SSA national + state names, 2023 Gazetteer + ACS population. Build the frequency-ranked name and location tables.
2. **Run the BC refusal probe** (highest-leverage unknown): does BC/IDI refuse on **name-alone** or **name+location**? If name+location gets under the threshold, we may cover most head-terms with BC alone by iterating Gazetteer locations — potentially removing the need for a second vendor. Do this before spending on Enformion.
3. **Pilot EnformionGO/Endato free tier** (100 matches/mo) on 5–10 refused head-terms to validate the list-enumeration output shape and profile quality.
4. **Build the thin-combo gate** into the minting pipeline from day one: only index pages where hydration returns real people ≥ content bar; `noindex,follow` below it; Splink dedup before mint; maintain a suppression list.
5. **Commission legal review** of: the non-FCRA framing + disclaimer placement, a state-by-state voter-file permissibility matrix (only if we ever consider that source), CA Delete Act/DROP registration + 45-day deletion cadence, Vermont/Texas/Oregon registration, and a Daniel's-Law-style priority takedown process.
6. **Complete the two in-flight research sweeps** (FEC/property/licenses detail; OSS/legal deep-dive) and fold any deltas into §2 and §6 — the load-bearing facts are verified, but per-source access terms should be reconfirmed at ingest.

---

*Sources are linked inline throughout. Primary-verified load-bearing figures: 2010 surnames = 162,253 (≥100 threshold); 2020 = 156,621 last / 53,615 first (released 2026-04-14); SSA <5 excluded, national from 1880 / state from 1910, CC0; Gazetteer has no population field; Regrid 149M+ parcels; TLOxp $75/mo min + $0.40 people-search (LE schedule); FTC penalties Spokeo $800K / TruthFinder group $5.8M; CA Delete Act DROP 45-day cadence from 2026-08-01; Vermont 9 V.S.A. §§2446–2447; Texas $300 registration. Items flagged ⚠️/UNCERTAIN need confirmation or counsel.*
