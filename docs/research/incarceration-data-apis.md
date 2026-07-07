# Incarceration Data APIs — Landscape & Integration Feasibility

**For:** `inmatefinderhub.com` (and potential feed into the IDLookup SEO layer)
**Compiled:** 2026-07 from three parallel research passes (federal/state · county/commercial · data-brokers/legal), cross-checked against primary sources. Load-bearing claims carry sources; unverified items are tagged **[UNVERIFIED]**. **Not legal advice.**

---

## Bottom line up front

1. **There is no unified, official, machine-readable nationwide incarceration API.** The data splits into federal (1 system, no API), ~50 fragmented state DOCs, and ~2,900+ county jails with no standard. The only near-national coverage is a **commercial, contract-gated** layer.
2. **The deepest incarceration data is "investigator-tier" and probably can't legally be shown on a consumer site.** Thomson Reuters CLEAR, TLOxp, LexisNexis Accurint, and our own IDI/idiCORE have real feeds — but their AUPs are written for law-enforcement / skip-trace use and **likely forbid consumer redisplay**, independent of FCRA. **This licensing question — not the technology — is the binding constraint.**
3. **The realistic path for a public site is the self-serve aggregator tier:** Enformion/Endato, Tracers, JailBase, UnlimitedCriminalChecks. Thinner compliance posture, but licensable to display. Every one needs one thing verified in a trial: *is the booking/incarceration payload returned via the API, or only the web tool?*
4. **Our own supplier (IDI/idiCORE) shows no explicit incarceration/booking feed** in its docs — so "ask BC/IDI to add incarceration" is a real open question, not a given. Check idiCRIM's actual payload once we're in the IDI console.

---

## The landscape, by tier

### Federal — Bureau of Prisons (BOP)
- **Official API: none.** Public web locator (now reCAPTCHA-gated) + FOIA only.
- **Unofficial:** a reverse-engineered JSON endpoint (`bop.gov/PublicInfo/execute/inmateloc?output=json`) documented by third parties (PrisonDB) but **not confirmed live**; name search is reCAPTCHA-gated. GitHub repos mostly wrap *aggregate* facility stats, not per-inmate.
- **Coverage:** federal custody only, released 1982–present, daily updates. Fields: name, register #, **age (no DOB)**, race, sex, release date, facility. **No charges, no photo.**
- **Verdict:** thin data, scrape-only, anti-automation. Not a foundation.

### State — 50 Departments of Corrections
- **Official API: none general.** Effectively **~50 bespoke systems** — different stacks, keys, schemas; some anti-scraping. No unified feed.
- **The exception worth knowing: Florida (OBIS)** publishes the **complete public inmate database as a free monthly bulk download** (~1.2 GB Access DB + Excel: active inmates, releases, aliases, offenses, detainers, incarceration history). The one clean person-level bulk roster.
- Others (Iowa, NY, NC, WA) publish mostly **de-identified/aggregate** analytics, not live rosters.
- **Verdict:** scrape-one-site-at-a-time, except Florida (free bulk) — a cheap way to seed one high-population state.

### County / local — ~2,900+ jails
- **Largest booking volume, least accessible.** The jail-software vendors that power the rosters — **JailTracker (Caliber), Zuercher/CentralSquare, Tyler, SmartCOP, Kalleo SmartWEB** — are **portal-only, no public API.** Nationwide county data is acquired by **scraping** those portals (that's what NYU's Jail Data Initiative and the background-check DBs do).
- **Disambiguation (common traps):** Securus, ViaPath/GTL, Smart Communications, JailATM, Aramark are **telecom/commissary/mail vendors — NOT data sources**; they explicitly withhold inmate data from the public.
- **Verdict:** no API tier here; it's scraping or a licensed aggregator.

### Commercial aggregation — the only near-national breadth
Paid, credentialed, legally constrained. See the provider matrix below.

---

## Provider matrix

### Enterprise / vetted tier — deepest data, but likely NOT licensable for consumer display

| Provider | API | Incarceration/booking? | Coverage (claimed) | Consumer redisplay? |
|---|---|---|---|---|
| **Thomson Reuters CLEAR (RTIA)** | Yes | **Strongest** — 140M+ booking records, 38M+ images, 2,000+ agencies, 43 states, +600k/mo | vast | ❌ vetted professionals only (non-FCRA, GLBA/DPPA) |
| **TLOxp (TransUnion)** | Yes | **Yes** — "Real-Time Incarcerations" (booking agency, facility, arrest date) | ~95% US pop | ❌ vetted (PI/legal/LE) |
| **LexisNexis Accurint** | Yes | **Yes** — DOC + county arrests + "Jail Bookings" section | [UNVERIFIED] | ❌ credentialed, per-search DPPA/GLBA attestation |
| **IDI / idiCORE (our supplier)** | Yes | **Ambiguous** — idiCRIM markets criminal/court/arrest/sex-offender; **no explicit incarceration/DOC/booking feed found** [UNVERIFIED] | ~100% US adults | ❌ strict permissible-purpose |
| **Appriss Insights / VINE (Equifax)** | Yes (JusticeXchange: web/batch/API) | **Yes** — the real nationwide feed; ~2,800 facilities, ~90% of near-real-time US incarcerations, 15-min refresh | 140–170M+ historical bookings | ⚠️ partner/gov-gated; **LE-restricted**; consumer-resale terms unknown — a contract question |

All uniformly **non-FCRA** + GLBA/DPPA-gated. A general "look up anyone" consumer feature usually has **no qualifying permissible purpose**, so reselling this data for open lookup typically **violates the subscriber agreement** (vendors credential/inspect partly to police this).

> **VINE note:** two separate things. The **free VINELink victim-notification tool is contractually off-limits for commercial use** (can't scrape/repurpose it). The **Appriss Insights commercial data business** (JusticeXchange / CrimSmart / TraceSmart) is real and API-based but LE/CRA-gated. Ownership verified: Appriss Insights is an **Equifax subsidiary** (acquired $1.825B, 2021; confirmed in Equifax's FY2025 10-K). *(The "Aware Recovery spin-out" premise is false.)*

### Self-serve / developer tier — the realistic consumer-display candidates

| Provider | Self-serve API | Incarceration/booking? | Pricing signal | Notes |
|---|---|---|---|---|
| **Enformion / Endato (EnformionGO)** | **Yes** — instant key, 100 free/mo, no contract | Criminal Search returns photos + offense/case; platform claims **arrest/booking/incarceration, ~87% of US jurisdictions, real-time** — but **API-exposed vs enterprise is [UNVERIFIED]** | free tier + paid | Cleanest self-serve API; non-CRA disclaimer + GLBA/DPPA credentialing. **Best first candidate — verify booking is in-API.** |
| **Tracers** | Yes (42B+ records) | **Richest on paper** — "Crim Watch": mugshots, charges, booking dates, release status, facility, length of incarceration, transfers; **85% of US real-time incarceration, 160M+ bookings, 2,800+ sources** — API vs web-tool exposure **[UNVERIFIED]** | enterprise-ish | Deepest booking data; confirm API field set. |
| **JailBase** | **Yes** — free, no key (rate-limited) | **Yes** — bookings, charges, **mugshots**; county-level | free | Scraper-aggregator; partial/unquantified county coverage. Good for enrichment/leads. |
| **UnlimitedCriminalChecks** | **Yes** — 25 free credits, no approval | **Yes** — bundles **DOC/inmate + arrest/booking + mugshots** + court + sex-offender | ~$0.006–0.01/search | Explicit FCRA warning; "informational/personal-safety" only. |
| **DataDoesIt** | Yes — 100 free credits | Arrest/warrant real-time + `mugshot_available` flag (not a full DOC feed) | $25/25k · $45/50k · $80/100k | Clear self-serve pricing. |
| **BackgroundChecks.com** | Yes (REST) | **Yes** — genuinely includes inmate/parole/release | — | Real API but **full FCRA obligations + terms forbid marketplace/aggregator resale.** |

### Not incarceration-data providers (named-but-wrong — don't chase)
People Data Labs (enrichment, no criminal), Ekata/Whitepages Pro (identity/fraud only), TazWorks (CRA *software*, not a feed), Cognito→Plaid & Berbix→Socure (KYC), Securus/ViaPath/Smart Communications/Aramark (telecom/commissary).

---

## Legal / compliance checklist (not legal advice)

1. **Never operate a pay-to-remove mugshot model.** ~18 states outlaw charging the subject to remove a booking photo (FL §901.43, OH §2927.22, GA §10-1-393.5 confirmed; CA SB 1027, TX SB 509, UT §17-22-30 **[confirm primary]**). Payment processors + Google acted against these sites in 2013. → **Free, prompt takedown (10–30 day norm); suppress expunged/sealed records.**
2. **FCRA:** showing criminal/incarceration data risks CRA classification **if used/marketed for eligibility** (employment/tenant/credit). *FTC v. Spokeo* = $800k for marketing to employers. The **"not a CRA / not for FCRA purposes" disclaimer is necessary but NOT a safe harbor** — back it with real controls (don't market to employers/landlords/lenders). We already do this on the IDLookup funnel.
3. **Scraping public rosters:** likely **not a CFAA crime** (public, non-authenticated pages — *hiQ*, *Van Buren*) — but **hiQ still lost $500k on contract/ToS + trespass**, which is the real exposure. → Don't authenticate/circumvent CAPTCHA/IP-blocks, honor robots.txt, rate-limit, prefer licensed feeds.
4. **GLBA/DPPA:** don't gate incarceration data itself — they govern **financial** and **DMV** data respectively. They only matter for *other* profile fields (address/DOB from DMV needs a DPPA use).
5. **Google Ads:** crime is a **sensitive-interest category** — **no remarketing / Customer Match / curated audiences** for criminal-record promotions; contextual/keyword targeting is allowed. No explicit mugshot-ad ban found **[confirm with Google]**. (This matches the caution already flagged on the v3 incarceration landing.)

---

## Recommendation for `inmatefinderhub.com`

**Buy self-serve, don't scrape 3,000 jails.** Concretely:

1. **Start with a self-serve API POC — lead candidate Enformion/Endato**, with **Tracers** as the deep-data alternate. In the free trial, verify the two load-bearing unknowns: **(a) is the booking/incarceration payload returned by the API** (not just their web tool), and **(b) does the AUP permit displaying it on a consumer site?** Get (b) in writing.
2. **Add JailBase (free) for county booking + mugshots** as enrichment/coverage fill, understanding it's patchy and non-authoritative.
3. **Seed Florida cheaply from OBIS** (free monthly bulk) as a proof of depth in one big state.
4. **Evaluate Appriss/VINE (Equifax) as the enterprise upgrade** only if volume justifies it *and* they'll grant consumer-display permitted-use (open contract question).
5. **When we get IDI console access, check idiCRIM's actual arrest/DOC payload** — if IDI already carries usable arrest/incarceration fields under a display-permitted license, that's the cheapest path (same supplier, no new vendor).

**Strategic upside:** incarceration is a **high-intent, high-volume search category** (exactly the v3 "Find Someone in Jail or Prison" landing we just built). A real incarceration feed could power **both** `inmatefinderhub.com` *and* a dedicated incarceration slice of the IDLookup SEO layer — the programmatic-SEO playbook applies directly (name × facility × state pages).

**Biggest risk to close first:** the licensing/redisplay question. The technology is solvable; the AUP is the gate. Resolve consumer-display rights with any vendor *before* building on their feed.

---

## Sources
Federal/state: bop.gov/inmateloc + /about_records.jsp · prisondb.github.io/bopapidocs · godort.libguides.com/prisonerdbs · fdc.myflorida.com (OBIS bulk) · doc.iowa.gov · dac.nc.gov · doccs.ny.gov · totalverify.equifax.com (scraping-reality blog). VINE/Appriss/Equifax: vine.equifax.com · apprissinsights.com press release · investor.equifax.com · SEC FY2025 10-K subsidiary exhibit · jxbatch.appriss.com · vinelink.com terms. Commercial: legal.thomsonreuters.com (CLEAR RTIA) · transunion.com/business-needs/investigations-tloxp · ididata.com/solutions/idicrim · go.enformion.com/developer-apis/criminal-search · tracers.com/api · jailbase.com/api · unlimitedcriminalchecks.com/Developers · datadoesit.com/Developers · backgroundchecks.com/developers/api · informdata.com/our-data. Legal: ftc.gov (Spokeo settlement) · Detroit Free Press v. DOJ (6th Cir. 2016) · leg.state.fl.us §901.43 · supremecourt.gov (Van Buren) · eff.org (hiQ) · support.google.com/adspolicy.

*Caveats: all facility/record counts are provider-stated marketing, not audited. BOP JSON endpoint not live-tested. Several mugshot-law bill numbers from removal-industry sites — confirm against primary statute. Enformion/Tracers API-exposed incarceration payload unverified — confirm in trial.*
