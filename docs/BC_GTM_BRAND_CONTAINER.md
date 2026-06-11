# BC ask — `comp.brand.gtm` loads the wrong GTM container on two brands

**Raised:** 2026-06-10 · **From:** PDS / idlookup · **Status:** OPEN

> **Summary:** BC injects the brand's GTM container via `comp.client.init.header`
> (`comp.brand.gtm`). On two production brands it injects the **dev** container instead of
> the brand's own, so Google Ads conversions + analytics land in the wrong (dev) container.

## What we verified (live)
Loaded each domain and counted the GTM container(s) that BC injects:

| Domain | Loads | Expected | Status |
|---|---|---|---|
| `dev.www.idlookup.ai` | `GTM-WV7N6WWP` | `GTM-WV7N6WWP` (dev) | ✅ correct |
| `peoplesearcher.ai` | `GTM-PBFRPKNX` | `GTM-PBFRPKNX` | ✅ correct |
| `idlookup.ai` | **`GTM-WV7N6WWP`** | `GTM-THCSBJWN` | ❌ **wrong (dev container)** |
| `inmatefinderhub.com` | **`GTM-WV7N6WWP`** | `GTM-TF6NWS79` | ❌ **wrong (dev container)** |

(We removed our own per-host GTM loader from `index.html` so BC's injection is the single
source — that's why this is now fully BC-controlled.)

## Ask
Set `comp.brand.gtm` (the value used by `comp.client.init.header`) **per brand**:
- `idlookup.ai` → **`GTM-THCSBJWN`**
- `inmatefinderhub.com` → **`GTM-TF6NWS79`**
- (leave `dev.www.idlookup.ai` → `GTM-WV7N6WWP`, `peoplesearcher.ai` → `GTM-PBFRPKNX`)

## Why it matters
Google Ads conversion tracking (sign-up + payment) is being configured in each brand's own
container. Until `comp.brand.gtm` is correct, the production `idlookup.ai` /
`inmatefinderhub.com` sites won't load the container that holds those conversion tags, so
**conversions won't fire** (and any analytics fire into the dev container). See
`docs/GOOGLE_ADS_CONVERSION_SETUP.md`.

## Verify after fix
Reload each production domain and confirm exactly one GTM container loads and it's the
brand's own (not `GTM-WV7N6WWP`).
