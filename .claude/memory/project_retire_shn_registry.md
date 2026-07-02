---
name: project_retire_shn_registry
description: "Retiring the local campaignRegistry (drive from BC shape) — HELD, blocked on a BC ask"
metadata: 
  node_type: memory
  type: project
  originSessionId: 40472548-5ab1-4927-85ed-edc3ce3fb229
---

Goal: retire `src/services/campaignRegistry.js` (hand-maintained shn→config map = drift risk) and drive everything from BC's shape (`getShapeCompiled`). The registry should mirror BC, not be a local list. ("Project #3"; durable fix for the attribution-drift in [[reference_bc_shapecompiled_theme]] / `docs/reporting/shn-attribution-lookup.md`.)

**Status: HELD 2026-06-30 (owner deferred).** Full plan + the BC-shape probe table: `docs/reporting/retire-shn-registry-plan.md`.

Key finding (probed live, shn 6a273f983ee3447608a3aae5): BC's shape ALREADY supplies brand/optout/thinmatch/landing/sup (the resolver overrides the registry for partner/brand/optout/zeroState today), BUT **`comp.tracking.partner.{name,channel}` keys are declared yet EMPTY** (BC not populating) and there's **no shnName/display-name field** (only `containerDesc`). So the registry's only unique value now is populated attribution — deleting it today zeroes partner/channel/shnName.

Resume sequence: (1) **BC ask** — populate `comp.tracking.partner.{name,channel}` per shn + add a display-name field (cheap, keys exist) → via [[bc-asks-register]]; (2) safe prep — add `landing /N→/vN` + `sup ver=a→a` transforms in `campaignResolver.extractShapeProps`, remove dead fallbacks (`comp.partner.name`/`comp.connection.name` don't exist in BC schema); (3) when BC populates → delete per-shn entries, keep a thin `default` fallback. Sensitive campaign code — one change at a time ([[feedback_search_contextkey]]). Full shape surface: `.claude/agent-memory/bc-iife-investigator/reference_shape_compiled_surface.md`.
