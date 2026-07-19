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
| NM | captcha (reCAPTCHA v2) | async | · | · | · | ✅ | · | list-level; detail-enrich available |
| MA | vine | live | · | ✅ | · | ✅ | · | |

*(Rows grouped where several states share the same profile: WA, IN, MD, AK ≈ facility+status+age via html/vine;
CA/IA/ID/OR/UT ≈ name+age, thinner.)*

## ❌ NOT YET COVERED — 13 jurisdictions

| State | Blocker | Path forward | Data if solved |
|---|---|---|---|
| WV | AWS WAF (behavior JS challenge) + reCAPTCHA | browser-tier driver (browser clears WAF → node solves captcha) — WORKING, needs wiring | mug + charges + facility |
| MO | Imperva WAF + image captcha | puppeteer.connect over WS (2Captcha unreachable from inside Browserless) | mug + status |
| NY | F5 WAF (drops browser+residential) | hard — stealth browser | thin |
| KY | TLS reset (even residential/browser) | hard — stealth / alt source | mug |
| NH | Akamai 403 (even browser+residential) | hard — stealth browser | thin |
| MN | incomplete TLS cert chain (node + Chrome both reject) | ship intermediate cert / NODE_EXTRA_CA_CERTS | mug |
| AZ | Cloudflare managed challenge + WebForms | stealth browser | mug |
| CT | F5/Shape "Request Rejected" | stealth browser (headed) | thin (no mug) |
| NJ | SPA / anti-bot | Browserless SPA render | mug |
| TN | WAF + JCaptcha | browser + captcha | thin |
| MT | not yet integrated (recon-6) | build adapter | tbd |

## Tally
- **Covered: 40 / 51 (~78%)** — of which **~13 carry mugshots**, **~7 carry charges at list level** (more on detail).
  (NE + WY corrected from "zero" — they work; the sweep's "james smith" probe was a false negative for small states.)
- **Not yet: 11** — 2 working-but-need-browser-driver (WV, MO), 8 hard-WAF/cert (NY, KY, NH, MN, AZ, CT, NJ, TN),
  1 not-built (MT).
- **First-party roster (`inmates` table): FL 670k + NC 448k + seeded MI/TX/RI + growing via the crawler.**
