---
name: getshcomp-accessor
description: getShComp key semantics on ShapeCompiled — comp. prefix mandatory, absent returns "" not undefined, timing after getShapeCompiled
metadata:
  type: reference
---

`shapeCompiled.getShComp(key)` reads a resolved shapecomponent from the ShapeCompiled object (`window.ApiWrapper.api.shape.getShapeCompiled()`). Verified against deployed consumer IIFE (signature `develop_20260806-144457_d902b9f`, `/tmp/bc-iife.js` line 11 minified; class `M`, methods `getShComp`/`isShComp`/`getShapeCompiled`).

**Key format — `comp.` prefix is MANDATORY.** For a BC shapecomponent whose `name` = `tracking.partner.channel`, the accessor is `getShComp('comp.tracking.partner.channel')`. Rule: prepend `comp.` to the component name. `values` is keyed by the full `comp.<name>` string; `isShComp()` only recognizes strings starting with `comp.`. So partner attribution reads:
- `getShComp('comp.tracking.partner.name')` → e.g. `'nic'`
- `getShComp('comp.tracking.partner.channel')` → e.g. `'affiliate'`
- `getShComp('comp.tracking.partner.type')` → e.g. `'aff-network'`
- `getShComp('comp.client.theme')` → the raw `landing=...,sup=...,optout=...,thinmatch=...` string (our app parses it; see [[bc-shapecompiled-theme]])

**Absent/empty → returns `""` (empty string), NOT undefined/null.** getShComp only throws when the component `type==='json'` AND JSON.parse fails AND the 2nd arg `throwFlag===true` (default false). Scalar partner fields are never json, so they never throw; a missing component silently returns `""`. **Fallback branch must be `if (!value)` — do NOT test `=== undefined`.** Danger: a wrong key (missing `comp.` prefix, or typo) also returns `""`, indistinguishable from a genuinely absent component.

**Timing / visitor-level.** Values resolve after `await api.shape.getShapeCompiled()`, which GETs `/shape/compiled?shn=...` using params from `setShapeParams({shn})`. No auth needed — it's `this.request` (plain axios), visitor/session level, city etc. derived from request IP. getShapeCompiled memoizes on shn/shl/cascade (`de()` compares); calling `setShapeParams` with a new shn before the next getShapeCompiled forces a refetch. Read sequence: `setShapeParams({shn})` → `await getShapeCompiled()` → `.getShComp('comp.tracking.partner.*')`.

**Gotchas.** (1) Scalar values are run through the template engine `render()` — plain strings like `nic` pass through unchanged, but `${...}` tokens would be interpolated. (2) `client.theme` returns a raw delimited string, unlike the scalar partner fields — parse client-side. (3) Direct props (`shapeCompiled.device`, `.requestCity`, `.requestZip`, `.requestState`) are NOT via getShComp — plain instance fields.
