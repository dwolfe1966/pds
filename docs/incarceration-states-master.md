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
| 3 | AZ | 🔴 PROBLEM | browser | ✅ | Cloudflare + WebForms |
| 4 | AR | 🟢 pending | html | ✅ | recon-5; +paid INA bulk |
| 5 | CA | ✅ LIVE | json | ❌ | CIRIS; charges=court |
| 6 | CO | 🔴 PROBLEM | captcha | ✅ | shape-count captcha |
| 7 | CT | 🔴 PROBLEM | browser | ❌ | WAF blocks curl |
| 8 | DE | 🔬 RECON | — | — | recon-6 |
| 9 | FL | ✅ LIVE | bulk | ✅ | OBIS 670k |
| 10 | GA | ✅ LIVE | html | ✅ charges | session flow |
| 11 | HI | 🟢 pending | json | ✅ | recon-5 |
| 12 | ID | 🟢 pending | html | ❌ | recon-5 |
| 13 | IL | ✅ LIVE | html | ✅ | 2-step |
| 14 | IN | ✅ LIVE | html | ❌ | 10 rows |
| 15 | IA | 🔬 RECON | — | — | recon-6 |
| 16 | KS | 🔴 PROBLEM | captcha | ✅ | KASPER |
| 17 | KY | 🔴 PROBLEM | proxy | ✅ | IP-blocked on Vercel (works residential) |
| 18 | LA | ✅ LIVE | html | ⚠️ | VINE; obscured id + expiring mug (caveat) |
| 19 | ME | 🔬 RECON | — | — | recon-6 |
| 20 | MD | ✅ LIVE | html | ❌ | needs first name |
| 21 | MA | 🔬 RECON | — | — | recon-6 (7M — big) |
| 22 | MI | 🔴 PROBLEM | session | ✅ | OTIS F5 affinity flaky on serverless |
| 23 | MN | 🔴 PROBLEM | tls | ✅ | incomplete cert chain |
| 24 | MS | 🟢 pending | html | ✅ | recon-5 |
| 25 | MO | 🔴 PROBLEM | captcha | ✅ | numeric-image captcha |
| 26 | MT | 🔬 RECON | — | — | recon-6 |
| 27 | NE | 🟢 pending | html | ❌ | recon-5 |
| 28 | NV | ✅ LIVE | html | ✅ (detail) | 20-row cap |
| 29 | NH | 🔬 RECON | — | — | recon-6 |
| 30 | NJ | 🔴 PROBLEM | browser | ✅ | SPA/anti-bot (recon-1/2) |
| 31 | NM | 🔴 PROBLEM | captcha | ✅ | reCAPTCHA **Enterprise** (hardest) |
| 32 | NY | 🔴 PROBLEM | browser | ❌ | F5 WAF; drops browser+residential |
| 33 | NC | ✅ LIVE | bulk+html | ✅ | **448k bulk roster** |
| 34 | ND | ⬜ TODO | — | — | recon-7 |
| 35 | OH | ✅ LIVE | html | ✅ charges | antiforgery |
| 36 | OK | 🔴 PROBLEM | captcha | ✅ | |
| 37 | OR | ✅ LIVE | html | ❌ | needs first name |
| 38 | PA | ✅ LIVE | json | ✅ (opt-in) | Captor API |
| 39 | RI | 🔬 RECON | — | — | recon-6 |
| 40 | SC | ✅ LIVE | json | ✅ | base64 mug; 250 cap |
| 41 | SD | 🔬 RECON | — | — | recon-6 |
| 42 | TN | 🔴 PROBLEM | browser+captcha | ❌ | WAF + JCaptcha (recon-3) |
| 43 | TX | ✅ LIVE | browser | ❌ | TDCJ via Browserless+residential |
| 44 | UT | ✅ LIVE | json | ❌ | 100-row page |
| 45 | VT | ⬜ TODO | — | — | recon-7 |
| 46 | VA | 🔴 PROBLEM | browser | ❌ | blocked (recon-2) |
| 47 | WA | ✅ LIVE | html | ❌ | Drupal filter |
| 48 | WV | 🔴 PROBLEM | captcha | ✅ | |
| 49 | WI | 🔴 PROBLEM | browser | ✅ | SPA (recon-3) |
| 50 | WY | ⬜ TODO | — | — | recon-7 |
| 51 | DC | ⬜ TODO | — | — | recon-7 (federal BOP for DC sentenced) |

## Tally (2026-07-18)
- ✅ **LIVE: 17** — AL, CA, FL, GA, IL, IN, LA, MD, NC, NV, OH, OR, PA, SC, TX, UT, WA
- 🟢 **pending (recon-5): 5** — AR, HI, ID, MS, NE → ~22 live
- 🔬 **RECON (recon-6): 8** — DE, IA, MA, ME, MT, NH, RI, SD
- ⬜ **TODO (recon-7): 5** — AK, ND, VT, WY, DC
- 🔴 **PROBLEM: 16** — AZ, CO, CT, KS, KY, MI, MN, MO, NJ, NM, NY, OK, TN, VA, WI, WV

## First-party roster (inmates table): **451k records** (NC 448k w/mugshots) — growing per search + bulk loads.

## Plan
1. Finish recon (recon-6 landing, recon-7 = last 5) → every jurisdiction surveyed.
2. Integrate all direct-fetch wins → maximize LIVE.
3. **Sweep back to PROBLEM states by fix wave** (proxy → tls → browser → captcha) — see problem-states doc.
