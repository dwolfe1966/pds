# The Exposure Graph — the Spine

**Date:** 2026-08-04 · **Status:** architecture / for build
**Related:** `digital-footprint-vision.md` (why), `digital-footprint-expose-research.md` (the Expose wedge), `profile-concept-model.md` (one-Profile projection model)

> The Exposure Graph is the **one data model every footprint feature plugs into.** Build it once; brokers, search, social, breaches, and AI all become *columns*. The unit is a **specific listing on a specific provider** — which is exactly the per-data-provider itemization we want, native.

---

## 1. Design principles (why this shape)

1. **Surface-agnostic core.** ONE node schema for every surface — a Spokeo listing, a LinkedIn profile, a Google result, a breach, an AI answer are all the same row type, differentiated by `surface_type` + `source`. Adding "AI answers" later is new *data*, not a new *schema*. That's what makes it a spine, not a broker table.
2. **The node = (subject × source × url).** One row per place-a-person-appears. Per-provider by construction → powers the itemized "Spokeo ✓ removed · BeenVerified ⏳ in-progress" UI natively. No aggregate black box.
3. **Control status lives on the node, not the account.** Every node is independently actionable and trackable (found → requested → removed → reappeared).
4. **Vendor-agnostic control.** `control_method` + `external_ref` let us mix engines behind one uniform status — our own suppression for IDLookup, Optery *or* OneRep *or* our-own-head for brokers, Google "Results about you" for search. **We can swap Optery for a cheaper engine without touching the graph.** (This is why the vendor decision doesn't block the spine.)
5. **Federate, don't rebuild.** We already have several columns' worth of data — `member_suppression` (our-surface control), `member_enrichment` (identity), breach monitor, `getSocialPresence`, WSFY. The graph *federates* these and adds the external nodes.

## 2. Core schema (Neon / Postgres)

### `exposure_node` — the spine
The one place a person appears, on one provider.

```sql
CREATE TABLE exposure_node (
  id             BIGSERIAL PRIMARY KEY,
  subject_key    TEXT NOT NULL,        -- the verified identity (member userId, or stable identity hash)
  surface_type   TEXT NOT NULL,        -- idlookup | data_broker | public_record | search_result
                                       --   | social_profile | breach | image | ai_answer | other
  source_key     TEXT NOT NULL,        -- normalized provider id: 'spokeo','beenverified','google',
                                       --   'linkedin','idlookup','HIBP:linkedin-2021', ...
  url            TEXT,                  -- the SPECIFIC listing/page URL (per-provider itemization)
  found_status   TEXT DEFAULT 'unknown', -- found | not_found | unknown
  data_types     TEXT[] DEFAULT '{}',  -- ['name','address','phone','email','relatives','dob',...]
  exposure_detail JSONB,               -- snapshot of exposed values (server-side; PII)
  screenshot_url TEXT,                 -- proof image (vendor- or self-captured)
  sentiment      TEXT,                 -- positive | neutral | negative | null (search/social/ai only)
  confidence     TEXT DEFAULT 'medium',-- match confidence: high | medium | low
  severity       INT DEFAULT 1,        -- weight for the exposure score
  control_status TEXT DEFAULT 'none',  -- none | hidden | optout_requested | optout_confirmed
                                       --   | removed | reappeared | correction_requested | promoted
  control_method TEXT,                 -- our_suppression | optery | onerep | manual | google_rar | drop | owner
  external_ref   TEXT,                 -- vendor's id for this exposure (status sync)
  first_seen     TIMESTAMPTZ DEFAULT now(),
  last_checked   TIMESTAMPTZ DEFAULT now(),
  last_changed   TIMESTAMPTZ DEFAULT now(),
  UNIQUE (subject_key, source_key, url)
);
CREATE INDEX idx_expnode_subject ON exposure_node(subject_key);
CREATE INDEX idx_expnode_surface ON exposure_node(surface_type);
CREATE INDEX idx_expnode_status  ON exposure_node(control_status);
```

### `exposure_event` — append-only history (timeline, monitoring, proof)
```sql
CREATE TABLE exposure_event (
  id          BIGSERIAL PRIMARY KEY,
  node_id     BIGINT REFERENCES exposure_node(id),
  subject_key TEXT NOT NULL,
  event_type  TEXT NOT NULL,   -- discovered | optout_submitted | removed | reappeared
                               --   | correction_submitted | annotated | promoted | rescanned
  method      TEXT,            -- which engine/actor
  detail      JSONB,
  screenshot_url TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);
```
*(Reuse the `identity_events` pattern already in the codebase.)*

### `source_registry` — the provider catalog ("by data provider" lives here)
Reference table that drives scanning, the itemized UI, and *which engine removes from which source*.
```sql
CREATE TABLE source_registry (
  source_key      TEXT PRIMARY KEY,   -- 'spokeo'
  surface_type    TEXT NOT NULL,      -- data_broker
  display_name    TEXT NOT NULL,      -- 'Spokeo'
  category        TEXT,               -- people_search | marketing | public_record | social | ...
  opt_out_url     TEXT,               -- manual opt-out page (already curated in DigitalFootprint.js)
  removal_method  TEXT,               -- our_head | optery | onerep | manual | google_rar
  relist_days     INT,                -- typical re-appearance window (for the monitoring loop)
  weight          INT DEFAULT 1       -- default severity contribution
);
```

### `owner_annotation` — Owner Voice (from the identity-control spec)
```sql
CREATE TABLE owner_annotation (
  id          BIGSERIAL PRIMARY KEY,
  subject_key TEXT NOT NULL,
  node_id     BIGINT REFERENCES exposure_node(id),  -- or a record_key for public records
  note        TEXT NOT NULL,
  status      TEXT DEFAULT 'pending',  -- moderation: pending | approved | rejected
  created_at  TIMESTAMPTZ DEFAULT now()
);
```

## 3. Federation — what maps into the graph today (no rebuild)

| Surface column | Source of truth today | Into the graph as |
|---|---|---|
| **IDLookup** | our data + `member_suppression` | `surface_type='idlookup'`; `control_status` derived from suppression state |
| **Breaches** | breach monitor (built) | `surface_type='breach'`, one node per breach |
| **Social** | `getSocialPresence` (built, flag-off) | `surface_type='social_profile'`, one node per network |
| **Data brokers** | Optery/OneRep/our-head scan (to build) | `surface_type='data_broker'`, one node per broker listing |
| **Search (Google)** | scan + our SEO directory (to build) | `surface_type='search_result'` |
| **Identity / subject** | `member_enrichment`, `self_person`, verification | the `subject_key` + confidence |
| **AI answers** | future | `surface_type='ai_answer'` — schema already fits |

The **exposure score** becomes a pure function over the nodes: `Σ (severity × found × not-yet-removed)`, weighted by surface. `computeExposure` already exists — repoint it at the graph.

## 4. Service / API surface

- `GET  /api/exposure/:subject` → nodes grouped by surface + rolled-up score + status counts. Powers the "your footprint across the web" dashboard.
- `POST /api/exposure/:subject/scan` → fan out scans to enabled sources/vendors; upsert nodes; log `exposure_event('discovered')`.
- `POST /api/exposure/node/:id/action` → `{action: remove|hide|correct|annotate|promote}` → **routed by `source_registry.removal_method`** to the right engine (our suppression / Optery / OneRep / Google RAR / manual instructions); log the event.
- `POST /api/exposure/webhook/:vendor` → vendor status callbacks (Optery webhooks: optout_submitted, removed) → update node `control_status` + log event.

All app-key gated like the existing `/api/suppression` route.

## 5. v1 scope (ship the spine, populate two columns)

Build the schema + service now; populate the columns we already own first, so the graph is *real* on day one and the rest is fill-in:

1. **`exposure_node` + `exposure_event` + `source_registry` + service/API.**
2. **Populate IDLookup column** from `member_suppression` (control_status) — the surface we fully own.
3. **Populate Breach + Social columns** from the built breach monitor + `getSocialPresence`.
4. **Seed `source_registry`** with the brokers already curated in `DigitalFootprint.js` (opt-out URLs) — so the broker column renders as itemized rows (found/manual-optout) even before a removal vendor is wired.
5. **Broker removal engine plugs in later** (Optery / OneRep / our-head) via `control_method` — the graph doesn't change when we pick or swap the vendor.

## 6. Why this is the right first build

- It's the **spine**: every later bet (AI reputation, permission layer, promote/rank, monitoring) is a new `surface_type` or a new `control_status`, not a rewrite.
- It makes broker removal **itemized-by-provider natively** (the owner's requirement) — the node *is* the provider listing.
- It's **vendor-agnostic** — decouples the build from the Optery-vs-alternatives decision.
- It **federates what we already built** (suppression, breach, social) into one coherent view instead of leaving them as disconnected features.
- The UI writes itself from the graph: group nodes by surface, show per-node status + score. "Your footprint across the web," powered by one query.

---

**One-line summary:** *One node per place-you-appear, on one provider, with its own status and history — federate what we have, plug engines in behind it, and every future surface is a column, not a rebuild.*
