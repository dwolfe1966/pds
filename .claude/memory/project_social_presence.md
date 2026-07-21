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

**TEASER WIRING (2026-07-21):** social wired into the signals engine + teaser (consumer app). `src/services/socialPresenceService.js` (client→/api/social-presence), `personSignals.js` (fetch in _computeRaw + signals.social in shapeSignals, behind `REACT_APP_SIGNALS_SOCIAL` default-OFF; new 'social' flow + secondary in inmate/divorce/dating), `SignalTeaser.js` (`<SocialPresence>` renderer: platform + masked handle + 🔒). 13 personSignals tests pass. Bundles: default (social OFF) `public.1cbb91eb.js`; **TEST bundle (social ON) `public.eed46fe6.js`**.
**NAME-KEY REALITY:** PDL name+state is SPOTTY (~40% even of famous names) — declines common names (no false attribution), rich when it hits. DEMO NAMES: **Marc Andreessen, CA (6 profiles)**, **Aaron Levie, CA (10 incl. Instagram)**. So teaser social SELF-GATES to whoever PDL confidently has.
**TO SEE IT LIVE (owner):** (1) add **PDL_API_KEY** to Vercel env (idlookup.me) — deployed route is Gravatar-only until then (name-key returns nothing); (2) upload TEST bundle **public.eed46fe6.js** to BC; (3) search Marc Andreessen / Aaron Levie, CA. ⚠️ PDL free = 100/mo → controlled TEST not live-funnel scale; default bundle keeps social OFF.
**OWNER ACTIONS (production):** Spokeo + Pipl outreach (FCRA-clean display; drafts in vendor-eval doc); resolve PDL display terms or swap. **NEXT:** add social to the REPORT (post-pay, email-keyed = rich); liveness-verify URLs; confidence labels on name-key matches.

**SUPERSEDED → STANDALONE (owner 2026-07-21):** the engine/SignalTeaser social wiring above was REVERTED — social competed poorly inside inmate/divorce/dating/SO flow teasers + zero-state gets little traffic. NOW: standalone `src/components/SocialPresenceTeaser.js` on the HAS-RESULTS SERP (SearchResultsPage), rich (photo + every platform masked + 🔒 + unlock CTA), self-gating, one direct fetchSocialPresence call, behind REACT_APP_SIGNALS_SOCIAL. Current TEST bundle (social ON) = **public.eed46fe6.js**. PDL_API_KEY IS LIVE in Vercel now (verified: deployed endpoint returns Aaron Levie 10 profiles). Watch spend: idlookup.me/api/pdl-usage. NAME-KEY still spotty (Aaron Levie/Marc Andreessen hit; most regular people self-gate to blank).

**LIVENESS + CONFIDENCE (2026-07-21):** getSocialPresence gained `verify` (report passes verify=true) → drops ONLY 404/410 URLs, keeps bot-blocked (403/429/999/login/timeout) so LinkedIn/FB/IG/X never falsely dropped (Aaron Levie 10→9, dead vimeo gone, marquee kept). Overall `confidence`: high=email/Gravatar, medium=name-key+PDL-name-corroborates-search+≥2 profiles, low=weak. SERP teaser gates OFF 'low' (Louis Offer 1-profile hidden; Aaron/Marc medium show); report email-key always high. Bundle public.eed46fe6.js.
