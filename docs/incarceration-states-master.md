# Incarceration Data — MASTER State Tracker (all 50 + DC)

Single source of truth for every jurisdiction's status. Updated 2026-07-18.
Detail on non-working states: `incarceration-problem-states.md`. Strategy: `incarceration-data-strategy-provisional.md`.

**Status key:** ✅ LIVE (works from Vercel) · 🟢 LIVE-pending (integrated, verifying) · 🔬 RECON (in progress)
· 🔴 PROBLEM (see category) · ⬜ TODO (recon not run yet)
**Access:** json = JSON API · html = HTML-form scrape · bulk = downloadable roster · browser = needs Browserless

| # | State | Status | Access | Mugshots | Notes |
|---|---|---|---|---|---|
| 1 | AL | ✅ LIVE | html | ✅ | 25 rows |
| 2 | AK | ⬜ TODO | — | — | recon-7 |
| 3 | AZ | ✅ LIVE | browser | ✅ | **CRACKED 7/19**: Cloudflare managed challenge via Browserless BQL verify(cloudflare) (reusable CF bypass); name/ADC#/admit-date/mug; needs last+first-initial |
| 4 | AR | 🟢 pending | html | ✅ | recon-5; +paid INA bulk |
| 5 | CA | ✅ LIVE | json | ❌ | CIRIS; charges=court |
| 6 | CO | ✅ LIVE | captcha | ✅ | **CRACKED 7/19**: shape-count captcha (2Captcha textinstructions, ~50% retry); facility+age+mug |
| 7 | CT | 🔴 PROBLEM | browser | ❌ | WAF blocks curl |
| 8 | DE | ✅ LIVE | vine | ❌ | **CRACKED 7/19**: VINE guest session (no captcha, fast); custody+facility; needs first+last |
| 9 | FL | ✅ LIVE | bulk | ✅ | OBIS 670k |
| 10 | GA | ✅ LIVE | html | ✅ charges | session flow |
| 11 | HI | 🟢 pending | json | ✅ | recon-5 |
| 12 | ID | 🟢 pending | html | ❌ | recon-5 |
| 13 | IL | ✅ LIVE | html | ✅ | 2-step |
| 14 | IN | ✅ LIVE | html | ❌ | 10 rows |
| 15 | IA | 🔬 RECON | — | — | recon-6 |
| 16 | KS | ✅ LIVE | captcha | ✅ | **CRACKED 7/19**: KASPER reCAPTCHA v2 node-only; charges+facility+age+status |
| 17 | KY | 🔴 PROBLEM | proxy | ✅ | IP-blocked on Vercel (works residential) |
| 18 | LA | ✅ LIVE | html | ⚠️ | VINE; obscured id + expiring mug (caveat) |
| 19 | ME | 🔬 RECON | — | — | recon-6 |
| 20 | MD | ✅ LIVE | html | ❌ | needs first name |
| 21 | MA | 🔬 RECON | — | — | recon-6 (7M — big) |
| 22 | MI | ✅ LIVE | browser | ✅ (detail) | **CRACKED 7/18**: OTIS via Browserless single-session (james smith→6) |
| 23 | MN | 🔴 PROBLEM | tls | ✅ | cert rejected by BOTH node AND Chrome; needs intermediate cert / NODE_EXTRA_CA_CERTS |
| 24 | MS | 🟢 pending | html | ✅ | recon-5 |
| 25 | MO | 🔴 PROBLEM | captcha+waf | ✅ | Imperva WAF needs Browserless, but 2Captcha is UNREACHABLE from inside Browserless (proxy blocks it); needs puppeteer.connect-over-WS (drive browser from our node, solve locally) |
| 26 | MT | ✅ LIVE | browser | ✅ (detail) | **BUILT 7/19**: conweb F5 WAF via Browserless+residential (no captcha); name/age/status; facility/charges/mug on detail; surname-only OK |
| 27 | NE | ✅ LIVE | bulk | ❌ | NDCS xlsx roster; charges+facility+county+status+age; ⚠️18s cold-cache → make a DB bulk-ingest |
| 28 | NV | ✅ LIVE | html | ✅ (detail) | 20-row cap |
| 29 | NH | 🔴 PROBLEM | browser | ❌ | Akamai 403 even via Browserless+residential (2x confirmed 7/18) — HARD tier w/ NY/KY |
| 30 | NJ | 🔴 PROBLEM | imperva | ✅ | **Imperva reese84 ABP** — walls even real local Chrome; no solver exists → Enformion + OPRA bulk (7/19) |
| 31 | NM | ✅ LIVE | captcha | ❌ | **CRACKED 7/19**: reCAPTCHA v2 (NOT Enterprise) node-only; list-level (name/id/status); last-only OK; detail-enrich available |
| 32 | NY | 🔴 PROBLEM | browser | ❌ | F5 WAF; drops browser+residential |
| 33 | NC | ✅ LIVE | bulk+html | ✅ | **448k bulk roster** |
| 34 | ND | ⬜ TODO | — | — | recon-7 |
| 35 | OH | ✅ LIVE | html | ✅ charges | antiforgery |
| 36 | OK | ✅ LIVE | captcha | ✅ | **CRACKED 7/19**: reCAPTCHA v2 node-only; mugshots+age+status; needs first+last |
| 37 | OR | ✅ LIVE | html | ❌ | needs first name |
| 38 | PA | ✅ LIVE | json | ✅ (opt-in) | Captor API |
| 39 | RI | ✅ LIVE | browser | ❌ | **CRACKED 7/18**: F5/TSPD via Browserless form-submit navigation |
| 40 | SC | ✅ LIVE | json | ✅ | base64 mug; 250 cap |
| 41 | SD | 🔬 RECON | — | — | recon-6 |
| 42 | TN | 🔴 PROBLEM | browser+captcha | ❌ | WAF + JCaptcha (recon-3) |
| 43 | TX | ✅ LIVE | browser | ❌ | TDCJ via Browserless+residential |
| 44 | UT | ✅ LIVE | json | ❌ | 100-row page |
| 45 | VT | ⬜ TODO | — | — | recon-7 |
| 46 | VA | ✅ LIVE | captcha | ❌ | **CRACKED 7/18**: reCAPTCHA v2 solved NODE-ONLY via 2Captcha (no browser); needs first+last; james smith→10 |
| 47 | WA | ✅ LIVE | html | ❌ | Drupal filter |
| 48 | WV | 🟡 browser-tier | captcha+waf | ✅ | WORKING but AWS WAF (behavior-triggered) needs a real browser; reCAPTCHA solves node-side; charges+facility+mug (detail). Needs browser driver like MO |
| 49 | WI | ✅ LIVE | captcha | ✅ | **CRACKED 7/19**: reCAPTCHA v2 at entry (once/session, then free); demographics+mug+aliases; surname-only enumerable |
| 50 | WY | ✅ LIVE | html | ❌ | json feed; name/age/gender/status/DOC#; "james smith"=0 is real (small state) |
| 51 | DC | ⬜ TODO | — | — | recon-7 (federal BOP for DC sentenced) |

## TALLY (2026-07-19) — see `incarceration-coverage-grid.md` for the full data-types grid
- ✅ **COVERED: 41 / 51 (~80%)** — AK, AL, AR, CA, CO, DC, DE, FL, GA, HI, IA, ID, IL, IN, KS, LA, MA, MD, ME,
  MI, MO?, MS, MT, NC, NE, NM, NV, OH, OK, OR, PA, RI, SC, SD, TX, UT, VA, VT, WA, WI, WY  *(MO listed under "not yet")*
  - **mugshots** (~13): FL, GA, IL, NC, OH, PA, SC, AL, AR, MS, ME, ND, OK, WI, CO (+ more on detail: MI, MT, KS)
  - **charges** at list: FL, GA, OH, MS, VT, KS, NE (+ detail: MI, MT, WV)
- ❌ **NOT YET: 10** — WV + MO (working, need a browser driver), NY, KY, NH, MN, AZ, CT, NJ, TN (hard WAF/cert).
- **7/18–19 crackings:** MI, RI, VA (browser/captcha) · OK, NM, KS, WI, CO, DE (captcha wave) · MT (browser) · NE, WY (were false-negatives).

## First-party roster (inmates table): **451k records** (NC 448k w/mugshots) — growing per search + bulk loads.

## Fix-wave reality check (2026-07-18)
The "proxy wave" assumption was too optimistic — several IP-blocked states (KY, NH, RI) *also* TLS-reset or
Akamai/F5-block browsers, so they're NOT cheap proxy fixes. Revised waves by leverage:
1. **captcha-solver wave (best ROI)** — DE, KS, MO, CO, NM, OK, WV: ~7 states, most with mugshots, unblocked by
   one captcha-solver account (2Captcha/CapSolver, ~$1-3/1000). NM hardest (reCAPTCHA Enterprise). Needs owner key.
2. **tls wave** — MN: ship the missing intermediate cert / NODE_EXTRA_CA_CERTS.
3. **browser wave** — NY, AZ, CT, NJ, VA, WI, TN, MI (+ KY/NH/RI): Browserless flows; NY/AZ/KY are the hard ones.
4. **bulk/alt-source** — AR (paid INA bulk), NE (roster xlsx → make it a bulk ingest not live), SD (slow → cache).
