---
name: project_social_presence
description: Social-presence enrichment vertical — PDL+Gravatar getSocialPresence module + /api/social-presence; experimenting
metadata: 
  node_type: memory
  type: project
  originSessionId: c559d3ef-73d6-4bd2-ae57-b22ea4c6528f
---

**Model (settled):** social presence is ENRICH not discover — no vendor/platform maps name/email/phone→profile as a lookup; you resolve identity first (our data), then attach social. Layers: **paid seed** (marquee coverage) → **free/OSS** (corroboration + long-tail breadth) → **scrape** (enrich a known URL), gated behind ≥2-signal confidence. Research: `docs/research/social-presence-{data-research,oss-spike,vendor-eval}.md`.

**Self-serve check (2026-07-21):** PDL = self-serve free (100/mo, no CC). Spokeo API + Pipl = sales-gated (owner reaching out for the FCRA-clean production feed).

**KEY FINDING — PDL free tier returns RICH consumer social from EMAIL:** dwolfe66@gmail.com → 12 profiles incl. **Facebook + Twitter + LinkedIn + Pinterest + GitHub** (one lookup). Overturns "LinkedIn-only" expectation. Free OSS (Holehe) got only 6 dev/utility sites, no big social. So coverage is SOLVED technically; gating is now COMMERCIAL/LEGAL.

**BUILT (2026-07-21, LIVE on idlookup.me Vercel):**
- `seo/lib/socialFootprint.mjs` — Gravatar (email→name/photo/verified accounts), pure-JS, no key, DISPLAY-SAFE (opt-in public data).
- `seo/lib/socialPresence.mjs` — `getSocialPresence({email,name,city,state,expectedName})` merges PDL + Gravatar, filters DEAD platforms (google+/myspace/foursquare/…), tiers confidence (confirmed = Gravatar-verified OR ≥2-source; else reported), name-corroboration. Verified: 9 live profiles + photo + nameCorroborated.
- `seo/app/api/social-presence/route.js` — POST endpoint, CORS for consumer app.
- Eval harness: `scratchpad/social-spike/pdl-eval.mjs`. Keys: PDL_API_KEY (seo/.env.local, gitignored people-data-labs-key.rtf, 64 chars). Holehe venv in scratchpad/social-spike.

**LEGAL WATCH-ITEMS (owner: experimenting — flag, don't block):** (1) PDL terms bar PRODUCTION people-search/FCRA DISPLAY → eval+internal OK; public display of PDL data needs terms clearance OR Spokeo/Pipl; Gravatar is display-safe. (2) Displaying social = accuracy/defamation + CCPA opt-out + FCRA-no-screening. (3) NO faceprints (BIPA) — avatar URL only, no face-matching.

**OWNER ACTIONS:** (1) add PDL_API_KEY to Vercel env (deployed route runs Gravatar-only until then). (2) Spokeo + Pipl outreach (drafts in vendor-eval doc). **NEXT:** test PDL name+location key on our resolved people; pick a display surface (consumer report Social Presence module — display Gravatar now, PDL pending terms); liveness-verify URLs.
