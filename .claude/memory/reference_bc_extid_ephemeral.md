---
name: reference_bc_extid_ephemeral
description: BC teaser obf1 extId is EPHEMERAL — re-encrypted every call; never use as a stable id or cross-session match key
metadata: 
  node_type: memory
  type: reference
  originSessionId: 0aa0a521-254d-498f-bd45-2a3057b6e96b
---

**BC's teaser `obf1:` extId is re-encrypted on EVERY `searchTeaser` call** — verified
2026-07-05: two back-to-back searches for the SAME person (David Wexler, Simi Valley)
returned three different extIds (`0795…`, `63ad…`, `7a46…`). It carries an `iv` +
ciphertext; BC decrypts it server-side per request. So the extId:
- is **NOT stable** across (or even within) sessions,
- **cannot be a durable identifier, a URL key, or a cross-session match key.**

It IS still the right thing to pass to **report create at click-time** (the CURRENT
extId from the CURRENT search is valid for that request) — just never persist it and
expect it to match later.

**Where this bit us + the fix ([[project_seo_layer1_built]]):** the SEO→SUP direct
link matched on a captured extId → always "Person not found." Fix = mint STABLE public
ids from natural attributes (`name+city+state+first-seen-year`, `seo/scripts/lib/mint.mjs`)
and have the SUP cold-load ([[project_sup_challenger_variants]] SearchDetailPreviewPage)
re-find the person by those attributes (city + first-seen) in a fresh teaser, then use
that result's current extId for the report. Concept-decision #1 anticipated this
("mint our own stable ids over BC record ids").

**Rule of thumb:** any code that stores a teaser extId and later compares/looks it up
is a bug. Match people on stable attributes (name + city/state + first-seen), not extId.
