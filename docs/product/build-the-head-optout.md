# Build the Head — Our Own Opt-Out Automation

**Date:** 2026-08-05 · **Status:** architecture + v1 foundation
**Related:** `exposure-graph-spine.md`, `digital-footprint-expose-research.md` (Optery declined 2026-08-05 → own it), `digital-footprint-vision.md`

> Optery said no (and OneRep/others are competitors who may too). So we build our own removal for the
> **head** — the top ~30 brokers that hold most exposure — and own the IP, the itemization, and the
> relationship. The long tail stays manual/assisted or a cheap engine later. Manual opt-outs actually
> remove best (~70% vs ~35% avg automated), and we're a data company — this is the most "us."

---

## 1. The model

A per-broker **adapter** describes *how* to opt out; an **engine** runs an adapter for a person; the
**Exposure Graph** tracks status per node. No vendor. Plugs into everything already built.

```
identity + target broker → adapter (how) → engine (do it) → exposure_node.control_status → (confirm) → (re-scan)
```

## 2. Opt-out methods (per broker)

Each broker's adapter declares a `method` — we implement them cheapest-first:

| Method | How | Infra | v1? |
|---|---|---|---|
| **`manual`** | Give the user the opt-out URL; track the request (what we do today) | none | ✅ (fallback) |
| **`email`** | Send a formatted **CCPA authorized-agent** opt-out request to the broker's privacy address | serverless + our email infra | ✅ |
| **`form_post`** | POST the opt-out form directly (only brokers with a simple, non-JS, non-CAPTCHA endpoint) | serverless `fetch` | ✅ (where possible) |
| **`browser`** | Drive the multi-step JS form + CAPTCHA with Playwright | **a worker** (not Vercel) + CAPTCHA solver | ⏳ phase 2 |

**Reality:** most people-search opt-outs are JS forms with CAPTCHA + email confirmation → `browser`. So v1
automates the `email`/`form_post` subset and keeps the rest `manual`; `browser` adapters need a worker
(a small container/VPS running Playwright, or Browserless) — a phase-2 infra decision.

## 3. Legal — we act as the user's Authorized Agent

Submitting on someone's behalf requires their authorization (CCPA "authorized agent"; some brokers want a
signed **Limited Power of Attorney**). So before any automated submission:
- **Capture consent** — an explicit "authorize IDLookup to request removal on my behalf" step, stored with
  timestamp + scope (which brokers). This is the gate for `email`/`form_post`/`browser` (not needed for `manual`).
- Requests are framed as authorized-agent CCPA/state-privacy requests. Never misrepresent.

## 4. Confirmation + re-scan (the loop) — phase 2

- Many brokers **email a confirmation link**. A dedicated opt-out inbox (e.g. optout@) + a parser clicks/records
  it → node `optout_requested` → `optout_confirmed`.
- A periodic **re-scan** checks if the person re-listed → node `removed` → `reappeared` → re-submit. This is the
  recurring retention loop (data re-lists every 3–6 months).

## 5. Architecture / files

- `seo/lib/optout/adapters.mjs` — per-broker config (method + details + `buildRequest(identity)`), keyed by
  `source_key` (same keys as `source_registry`).
- `seo/lib/optout/engine.mjs` — `submitOptOut(adapter, identity, ctx)` → performs the method → `{status, detail}`.
- `seo/app/api/optout/route.js` — POST `{userId, sourceKeys, consent, identity}` → gate on claimed identity +
  consent → run each adapter → write `exposure_node.control_status` + `exposure_event`. App-key gated.
- Consumer: a **"Remove for me"** action (vs the manual "Remove →") on the footprint map that calls it, after a
  one-time consent capture.

## 6. The head list (v1 targets)

The ~30 highest-exposure brokers already in `source_registry` (people_search + background_check + the big
marketing brokers). Start `email`/`form_post` where the broker supports it; everything else `manual` until its
`browser` adapter lands.

## 7. Phasing

1. **v1 (this):** adapter framework + engine (`manual`/`email`/`form_post`) + `/api/optout` + graph status +
   consent gate. A few real adapters. "Remove for me" wired on the map.
2. **v2:** `browser` adapters on a worker (Playwright) + CAPTCHA + the confirmation inbox → real done-for-you.
3. **v3:** re-scan/re-list detection → the recurring loop; expand past the head with a cheap engine or more adapters.

## 8. Why this beats renting

- **No vendor-decline risk** (Optery just proved it) and no per-user fee.
- **Owned itemization** — native per-broker status in our graph (exactly the owner's requirement).
- **On-brand** — we know the people-search ecosystem cold.
- **Composable** — the long tail can still use a cheap engine behind the same graph if we ever want it.
