# Incarceration Data — Coverage Grid (all 50 + DC)

Ground truth as of **2026-07-19**. "Covered" = returns real records through our pipeline today (verified live
via the coverage sweep for direct states; via per-state cracking for browser/captcha states). Data-type flags
are what comes back at **list level** (several states carry more on a per-inmate detail fetch — noted).

**How:** `bulk` = downloaded roster in our Neon · `json` = JSON API · `html` = HTML-form scrape · `vine` =
Appriss/Equifax VINE guest session · `browser` = Browserless real browser (WAF) · `captcha` = 2Captcha solve.
**Tier:** `live` = fast, runs on the request · `async` = slow (browser/captcha), served from the DB, fed by the crawler.

## ✅ COVERED — 38 jurisdictions

| State | How | Tier | Mug | Facility | Charges | Status | Age | Notes |
|---|---|---|:--:|:--:|:--:|:--:|:--:|---|
| FL | bulk (OBIS 670k) | live | ✅ | ✅ | ✅ | ✅ | ✅ | richest; our Neon |
| NC | bulk 448k + html | async | ✅ | · | · | · | ✅ | bulk roster + live |
| GA | html | live | ✅ | ✅ | ✅ | ✅ | ✅ | richest live state |
| VT | html | live | · | ✅ | ✅ | ✅ | ✅ | charges at list |
| OH | html | live | ✅ | · | ✅ | ✅ | · | charges + mug |
| MS | html | live | · | ✅ | ✅ | · | · | charges |
| KS | captcha (reCAPTCHA v2) | async | ✅ | ✅ | ✅ | ✅ | ✅ | KASPER; detail charges/facility |
| MI | browser (OTIS) | async | ✅ | ✅ | ✅ | ✅ | · | MCL charges; mug on detail |
| AL | html | live | ✅ | ✅ | · | ✅ | ✅ | |
| AR | html | live | ✅ | ✅ | · | ✅ | ✅ | |
| LA | vine | live | ✅ | ✅ | · | ✅ | ✅ | obscured id/mug caveat |
| SC | json | live | ✅ | · | · | ✅ | ✅ | base64 mug; 250 cap |
| IL | html | live | ✅ | · | · | · | ✅ | |
| ME | html | live | ✅ | ✅ | · | ✅ | · | |
| ND | html | live | ✅ | · | · | ✅ | ✅ | |
| HI | vine/json | live | ✅ | ✅ | · | ✅ | · | |
| OK | captcha (reCAPTCHA v2) | async | ✅ | · | · | ✅ | ✅ | mugshots; needs first+last |
| WI | captcha (reCAPTCHA v2) | async | ✅ | · | · | ✅ | ✅ | demographics+aliases; once/session |
| CO | captcha (shape-count) | async | ✅ | ✅ | · | · | ✅ | ~50% solve retry |
| PA | json (Captor) | live | ⚪ | ✅ | · | ✅ | ✅ | mug opt-in (detail) |
| CA | json (CIRIS) | live | · | ✅ | · | ✅ | ✅ | charges = court |
| DC | json (fed BOP) | live | · | ✅ | · | ✅ | ✅ | 100 rows |
| DE | vine | live | · | ✅ | · | ✅ | ✅ | no captcha; needs first+last |
| PA/WA/IN/MD/AK | html/vine | live | · | ✅ | · | ✅ | ✅ | facility+status+age |
| VA | captcha (reCAPTCHA v2) | async | · | ✅ | · | ✅ | ✅ | needs first+last |
| TX | browser (TDCJ) | async | · | ✅ | · | ✅ | ✅ | Akamai; first×last sweep |
| NV | html | live | · | ✅ | · | · | · | 20-row cap; mug on detail |
| SD | vine (SAVIN) | live | · | · | · | ✅ | ✅ | thin; ~35s slow |
| CA/IA/ID/OR/UT | json/html | live | · | ⚪ | · | ⚪ | ✅ | thinner data |
| NE | bulk (xlsx roster) | live⚠️ | · | ✅ | ✅ | ✅ | ✅ | charges+county; ⚠️ 18s cold-cache → should become a DB bulk-ingest |
| WY | html (json feed) | live | · | · | · | ✅ | ✅ | name/age/gender/status; "james smith"=0 is real (small state) |
| RI | browser (F5) | async | · | ✅ | · | · | ✅ | flaky/low-yield per run |
| MT | browser (F5) | async | ⚪ | ⚪ | ⚪ | ✅ | ✅ | name/age(YOB)/status at list; facility/charges/mug on detail; surname-only OK |
| AZ | browser (Cloudflare/BQL) | async | ✅ | ⚪ | ⚪ | ✅ | ⚪ | **CRACKED 7/19** via Browserless BQL verify(cloudflare); name/ADC#/admit-date/**mug**; needs last+first-initial; age/race/facility/charges on detail |
| NM | captcha (reCAPTCHA v2) | async | · | · | · | ✅ | · | list-level; detail-enrich available |
| MA | vine | live | · | ✅ | · | ✅ | · | |

*(Rows grouped where several states share the same profile: WA, IN, MD, AK ≈ facility+status+age via html/vine;
CA/IA/ID/OR/UT ≈ name+age, thinner.)*

## ❌ NOT YET COVERED — 9 jurisdictions

| State | Blocker | Path forward | Data if solved |
|---|---|---|---|
| WV | AWS WAF (behavior JS challenge) + reCAPTCHA | browser-tier driver (browser clears WAF → node solves captcha) — WORKING, needs wiring | mug + charges + facility |
| MO | Imperva WAF + image captcha | puppeteer.connect over WS (2Captcha unreachable from inside Browserless) | mug + status |
| MN | incomplete TLS cert chain (node + Chrome both reject) | ship intermediate cert / NODE_EXTRA_CA_CERTS | mug |
| **NJ** | **Imperva reese84 ABP** — walls even real local Chrome; NO 2Captcha solver exists (continuous fingerprint/PoW sensor) | Enformion Criminal V2 + OPRA bulk | mug |
| **NY** | **F5/Shape** — drops browser+residential | Enformion Criminal V2 + FOIL bulk (open data is de-identified) | thin |
| **KY** | **TLS reset** even residential/browser | Enformion + alt source | mug |
| **CT** | **F5/Shape** "Request Rejected" | Enformion + bulk request | thin (no mug) |
| **NH** | **Akamai 403** even browser+residential | Enformion + bulk request | thin |
| **TN** | **WAF + JCaptcha** | browser + captcha (hard) | thin |

**Reality (2026-07-19):** the remaining WAF states split into (a) **crackable** — Cloudflare has a purpose-built
Browserless-BQL `verify` (AZ ✅); WAFs with a solvable captcha widget work — and (b) **NOT crackable with our
toolkit** — Imperva reese84 (NJ), F5/Shape (NY, CT), Akamai (NH), TLS-reset (KY): these are continuous
fingerprint/PoW sensors with no widget to outsource; even real local Chrome is walled. Per the sourcing research,
these go through **Enformion Criminal V2 (already have) + FOIL/OPRA bulk requests**, not scraping. See
`incarceration-data-sourcing-research.md`.

## Tally
- **Covered: 42 / 51 (~82%)** — of which **~14 carry mugshots**, **~7 carry charges at list level** (more on detail).
  (NE + WY were sweep false-negatives; MT + AZ built 7/19 — AZ via Browserless BQL verify(cloudflare), a reusable CF bypass.)
- **Not yet: 9** — WV + MO (working, need a browser driver), MN (cert), and 6 enterprise-bot-detection states
  (NJ/NY/KY/CT/NH/TN) that our scrape toolkit can't beat → aggregator + bulk-request path.
- **First-party roster (`inmates` table): FL 670k + NC 448k + seeded MI/TX/RI + growing via the crawler.**
