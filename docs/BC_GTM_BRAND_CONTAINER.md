# BC ask — `comp.brand.gtm` loads the wrong GTM container on `idlookup.ai`

**Raised:** 2026-06-10 · **From:** PDS / idlookup · **Status:** PARTIALLY FIXED — only `idlookup.ai` left

> **Summary:** BC injects the brand's GTM container via `comp.client.init.header`
> (`comp.brand.gtm`). It now injects the correct container on 3 of 4 brands; the flagship
> **`idlookup.ai`** still injects the **dev** container (`GTM-WV7N6WWP`), so Google Ads
> conversions + analytics on idlookup.ai land in the wrong (dev) container.

## What we verified (live — re-probed 2026-06-13)
Loaded each domain and counted the GTM container(s) that BC injects:

| Domain | Loads | Expected | Status |
|---|---|---|---|
| `dev.www.idlookup.ai` | `GTM-WV7N6WWP` | `GTM-WV7N6WWP` (dev) | ✅ correct |
| `peoplesearcher.ai` | `GTM-PBFRPKNX` | `GTM-PBFRPKNX` | ✅ correct |
| `inmatefinderhub.com` | `GTM-TF6NWS79` | `GTM-TF6NWS79` | ✅ **FIXED by BC since 06-10** |
| `idlookup.ai` | **`GTM-WV7N6WWP`** | `GTM-THCSBJWN` | ❌ **still wrong (dev container)** |

(We removed our own per-host GTM loader from `index.html` so BC's injection is the single
source — that's why this is now fully BC-controlled. Probe confirms exactly one container
per domain, i.e. no double-load.)

## Ask (one remaining)
Set `comp.brand.gtm` (the value used by `comp.client.init.header`) for the last brand —
**the same fix you already applied to `inmatefinderhub.com`**:
- `idlookup.ai` → **`GTM-THCSBJWN`** (currently `GTM-WV7N6WWP`, the dev container)
- (leave `dev.www.idlookup.ai` → `GTM-WV7N6WWP`, `peoplesearcher.ai` → `GTM-PBFRPKNX`,
  `inmatefinderhub.com` → `GTM-TF6NWS79` as-is)

## Why it matters
Google Ads conversion tracking (sign-up + payment) is being configured in each brand's own
container. Until `comp.brand.gtm` is correct, the production `idlookup.ai` site won't load
the container that holds those conversion tags, so **conversions won't fire** (and any
analytics fire into the dev container). See `docs/GOOGLE_ADS_CONVERSION_SETUP.md`.

## Verify after fix
Reload each production domain and confirm exactly one GTM container loads and it's the
brand's own (not `GTM-WV7N6WWP`).
