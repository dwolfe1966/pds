---
name: shape-compiled-surface
description: Full enumerated /shape/compiled surface for a real shn — creds-free GET probe, what backs getShComp, registry→shape source map, which fields are populated vs empty vs ungettable
metadata:
  type: reference
---

# BC /shape/compiled — full surface (registry retirement)

**Creds-free probe (read-only, no mutation):** `getShapeCompiled()` is a plain
`GET /api/shape/compiled?shn=<id>&shl=<id?>&cascade=true&clientId=<rand>&apiId=<rand>`.
`clientId`/`apiId` are NOT secrets — the IIFE generates both via `getRandomId()` (32-hex);
backend only requires them PRESENT (omitting → `400 missing apiId or clientId`).

```bash
CID=$(python3 -c "import secrets;print(secrets.token_hex(16))"); AID=$(python3 -c "import secrets;print(secrets.token_hex(16))")
curl -sS "https://dev.www.idlookup.ai/api/shape/compiled?shn=6a273f983ee3447608a3aae5&cascade=true&clientId=$CID&apiId=$AID" -H accept:application/json
```
`shn` + `cascade=true` ALONE resolves the collection (response carries `shColId`/`collectionName`); no explicit `shl` needed.

**How getShComp works:** `R.fromData(resp.data)` Object.assigns the JSON onto the shape obj.
`getShComp(key)` = render `values[key]`, JSON.parse if `types[key]==='json'`. So the full
client surface = `values` keys; `keys[]` = declared schema (may exceed populated `values`);
`serverOnlyKeys.comp` was `[]` (nothing withheld — empty fields are just unset in the shN sheet).

## Real shn 6a273f983ee3447608a3aae5 ("Google Inmates Lower"), probed 2026-06-30
- TOP-LEVEL metadata (on response obj, NOT via getShComp): `shConId`, `containerName`=`shn.idlookup.lookup.google.inamte.lower` (note "inamte" typo), `containerDesc`=`shN : IDL google inmate lower`, `shColId`=`6a03c9fe265f0e8dfcd57ccb`, `collectionName`=`shl.root.idl.lookup.google.inmate.lower`, `brandId`=`idlookup`, `brandName`=`IDLookup.AI`, `brandDomain`.
- `comp.client.theme` (type json) = EXACTLY `{landing:"/name/landing/3", sup:"ver=a", optout:"yes", thinmatch:"yes"}` — nothing else (no channel/name/category in theme).
- Populated `values`: comp.brand.{name,id,domain,gtm,customer.email,customer.phone}, comp.client.{theme,init.header,init.body,privacy,signup.nameSearch.terms}, code{}.

## Registry field → shape source (3 buckets)
**A. Populated now → RETIREABLE** (with transform): brand←comp.brand.name (`IDLookup.AI`, not registry's `IDL`); optOut←theme.optout=="yes"; zeroState/thinMatch←theme.thinmatch; landing←theme.landing (`/name/landing/3`→needs `/v3` map); detail.variant←theme.sup (`ver=a`→parse to `a`).
**B. Schema-declared but EMPTY for this shn → CHEAP BC ask (shN-sheet data entry, capability exists):** partner←comp.tracking.partner.name (UNPOPULATED — partner enrichment currently dead); channel←comp.tracking.partner.channel (UNPOPULATED — this is the ONLY channel key in schema).
**C. No clean source → REAL GAP:** shnName ("Google Inmates Lower") — only machine/desc strings (containerName/containerDesc/collectionName) carry it; no display-name comp key. Either BC adds one or derive from containerDesc.

## Resolver bug to flag (campaignResolver.js:69-71)
`extractShapeProps` falls back partnerName to `comp.partner.name` and `comp.connection.name`.
Neither exists in BC's `keys[]` schema — only `comp.tracking.partner.name`. Two of three
fallbacks can NEVER hit. Dead code; not harmful but misleading.

Related: [[bc-shapecompiled-theme]] (in user auto-memory reference_bc_shapecompiled_theme.md).
