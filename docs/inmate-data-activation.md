# Inmate Data — Activation Guide (keys + auth)

_2026-07-17. The code is built and env-gated (`seo/lib/incarceration.mjs`, `POST /api/incarceration`,
`InmateBookingTeaser` on `/name/landing/v3`). It renders **nothing** until a provider is configured, so
it's safe in the live funnel today. This is what to get so it lights up._

The integration is **provider-abstracted** — each provider is independent, so you can turn on one at a
time. Priority order: **UnlimitedCriminalChecks (best self-serve display candidate) → JailBase (free
enrichment) → Florida OBIS (free depth in one state).**

---

## 1. UnlimitedCriminalChecks (UCC) — the primary candidate

**Why:** self-serve, no approval gate, bundles DOC/inmate + arrest/booking + **mugshots** + court +
sex-offender, ~$0.006–0.01/search. It's the cleanest source we can legally **display** — *if* they
grant it in writing.

**What to get:**
1. **Developer account + API key** — sign up at `unlimitedcriminalchecks.com` → Developers (they give
   **25 free credits**, no approval). Copy the API key.
2. **⚠️ WRITTEN consumer-display permission** — this is the load-bearing one. Their default posture is
   "informational / personal-safety, not FCRA." Email their team and get in writing: *"We display
   returned booking/incarceration records (including mugshots) to consumers on our website — is that
   permitted under our agreement?"* **Do not enable UCC in prod until you have a yes in writing.**
3. **Confirm two things in the trial** (I built the adapter defensively so finalizing is a one-spot edit
   in `seo/lib/incarceration.mjs` → `ucc()`):
   - the **exact request shape** (endpoint path + params) and **auth header** (I assumed
     `POST /v1/criminal/search` + `Authorization: Bearer <key>` — correct if their docs differ),
   - the **exact response field names** (I mapped `first_name/last_name/charges[].description/mugshot/
     booking_date/facility/state` best-effort).

**Env to set on Vercel (SEO project):**
```
UCC_API_KEY   = <your key>
UCC_API_URL   = https://api.unlimitedcriminalchecks.com   # confirm the real base URL
```

---

## 2. JailBase — free county booking + mugshots (enrichment)

**Why:** free, no key, real bookings + charges + **mugshots** (image URLs), county-level. Patchy /
non-authoritative — good as *coverage fill*, not the backbone.

**The catch (confirmed):** direct jailbase.com **503s datacenter IPs**, so Vercel can't call it directly.
**Use the RapidAPI tier** — the adapter is now WIRED for it (2026-07-17), env-keyed. Verified from here:
RapidAPI auth works; the wrapper's endpoints are `/search/`, `/recent/`, `/sources/` (NOT
`/search_records/` — that 404s on RapidAPI). One live-caveat: **JailBase's own upstream is intermittently
503** (their service), so valid endpoints returned 503 during our test — retry, or it'll work from Vercel
when their origin is up. The adapter degrades gracefully (returns 0, logs the provider error, never crashes).

**Env to set on Vercel (SEO project) — the ONLY thing you need for JailBase:**
```
JAILBASE_RAPIDAPI_KEY  = <your RapidAPI key>          # from rapidapi.com (KEEP SECRET — env only)
JAILBASE_RAPIDAPI_HOST = jailbase-jailbase.p.rapidapi.com   # (this is the default; override only if it changes)
# optional: JAILBASE_SEARCH_PATH = /search/   JAILBASE_API_URL = <full base override>
```
_(The key is already in `seo/.env.local` for local testing — gitignored, never committed.)_

**Structure note:** JailBase search is **by source (jail), not by state** — `source_id` per facility. For
state coverage, first pull `/sources/` filtered by state, then query high-volume jails. POC: start with a
few big-county sources, or confirm whether `/search/` alone returns cross-source name results (verify when
their upstream is up).

---

## 3. Florida OBIS — free bulk (depth in one big state)

**Why:** Florida publishes its **complete public inmate database** as a **free monthly bulk download**
(~1.2 GB: active inmates, releases, aliases, offenses, incarceration history) at `fdc.myflorida.com`.
Cheapest way to prove real depth in a high-population state.

**What to do:** download the monthly file → a one-time ingest script loads it into a Neon table
(`fl_inmates`) → add a `florida-obis` provider adapter that queries that table. (Not built yet — say the
word and I'll write the ingest + adapter; it's self-contained and needs no external key.)

---

## After you set the env vars

1. Set the vars on the **Vercel SEO project** (they stay server-side — never in the consumer bundle).
2. Set **`REACT_APP_INCARCERATION_URL`** on the consumer app (or it derives from
   `REACT_APP_LEAD_CAPTURE_URL` → `/incarceration`).
3. Redeploy. The **booking teaser on `/name/landing/v3`** will start showing real records automatically
   (it's already wired + safe-by-default).

## The one non-negotiable
**Display rights are the binding constraint, not the tech** (per `docs/research/incarceration-data-apis.md`).
Get UCC's consumer-display permission **in writing** before enabling it. JailBase is public scraper-aggregate
(lower posture); still honor their ToS + rate limits. Never operate pay-to-remove on mugshots (~18 states
outlaw it) — free, prompt takedown + suppress expunged/sealed.
