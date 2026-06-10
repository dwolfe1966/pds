# BC ask — CSR refund: `refundVoidOrder` requires IIFE-injected `billingSeriesId`

**Raised:** 2026-06-10 · **From:** PDS / idlookup CSR tooling · **Status:** OPEN (patched client-side; root cause unconfirmed)

> **Symptom:** CSR refunds fail with BC error **"billingSeriesId should not be empty."**

## Root cause (verified against the deployed IIFE)
CSR refund → `csrRefundVoidOrder` → `_viaCsr('api.user.refundVoidOrder', …)` which falls back to
a direct `POST /commerceBilling/correct` when the IIFE method is unavailable/throws. BC requires a
`billingSeriesId` on that endpoint, **but the csrApi docs don't list it as a param** — the deployed
`csrWrapper` injects it in a request interceptor: `makeBillingSeriesId({ clientId, apiId, type:'signup' })`
→ `signup|{clientId}|{apiId}|{timestamp}|{random8}`, using the **same** clientId/apiId as the request.
Our hand-rolled fallback didn't inject it, so BC rejected it.

## What we shipped (client-side patch, admin bundle `c7f09274`)
`_csrPost` now accepts `billingSeriesType` and injects a matching `billingSeriesId` from the same
clientId/apiId; `csrRefundVoidOrder` passes `type:'signup'`. **Needs validation with one real
low-value refund.**

## Asks
1. **Document `billingSeriesId` on `/commerceBilling/correct`** (csrApi.csv) — format, the `type`
   value expected for a refund/correct (`signup`? `sale`? `correct`?), and whether BC **validates**
   that clientId/apiId in the id match the request, or just requires it non-empty.
2. **Why is the IIFE `api.user.refundVoidOrder` path being bypassed to the fallback in prod?**
   The IIFE injects `billingSeriesId` itself; if it were running, refunds wouldn't fail. Is the
   method missing on the deployed `csrWrapper`, throwing, or not resolving at runtime? If you can
   confirm/fix the IIFE path, the client patch becomes belt-and-suspenders.
