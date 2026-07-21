# Social-Presence Paid-Seed Eval (a)

_2026-07-21. Which paid vendor supplies the marquee-platform social presence the free layer can't (see [social-presence-oss-spike.md](./social-presence-oss-spike.md)). Keyed off identities we've already resolved (enrich, not discover)._

## Self-serve reality (checked 2026-07-21)
| Vendor | Self-serve signup | For us |
|---|---|---|
| **PDL (People Data Labs)** | ✅ free API key, no CC, 100 lookups/mo, dashboard | **Test TODAY.** Professional layer (LinkedIn/Twitter/GitHub). Free tier omits contact/location; terms bar *production* people-search (eval-only) |
| **Spokeo API** | ❌ "Reach out to us today" (sales) | Production consumer-social (FB/IG/TikTok + photos) + FCRA-aware. Needs outreach |
| **Pipl** | ❌ sales-led / enterprise | Identity-cluster social; needs outreach + written FCRA/permissible-use approval |

**So: PDL now (free, no sales) to measure the professional layer; Spokeo + Pipl outreach for the consumer-social production feed.**

## The scorecard (score every vendor on the same 6 axes)
1. **Marquee-platform coverage** — of resolved people, % returning **Facebook / Instagram / X / LinkedIn / TikTok** profile URLs (the gap free can't fill). *This is the deciding axis.*
2. **Match rate & key** — % matched keying off *name+location* (people-search style) vs *email* (higher confidence); false-match rate.
3. **Payload quality** — profile URL only, or also username / photo / bio / follower counts? Photo is high-value (but no faceprints).
4. **Cost** — per-lookup / subscription / minimum; blended cost per *confirmed* social profile.
5. **Compliance fit** — do the terms permit consumer people-search display (non-FCRA, honoring opt-out)? Written permissible-use for Pipl.
6. **Access shape** — self-serve vs sales; API vs batch; rate limits; retention limits.

Run PDL through this now (harness: `scratchpad/social-spike/pdl-eval.mjs`); apply the same scorecard to Spokeo/Pipl after their trials/quotes.

## PDL self-serve test plan (today)
1. Sign up free at peopledatalabs.com → API key (no CC).
2. Drop the key + 5–15 already-resolved people (name+locality, some with email) into `pdl-eval.mjs`.
3. It reports per-person social hits + a scorecard (matched %, ≥1-social %, per-platform coverage).
4. **Read it against the spike:** PDL is LinkedIn/pro-skewed — expect strong LinkedIn/Twitter/GitHub, thin FB/IG. That quantifies the professional layer and confirms the consumer gap only Spokeo/Pipl close.

## Outreach drafts (Spokeo + Pipl)

**Spokeo — People Intelligence API** (via spokeo.com/business/api → Contact):
> Subject: API eval — consumer social-profile enrichment (people-search product)
> We run a consumer people-search product and want to enrich already-resolved identities with their social profiles (Facebook, Instagram, TikTok, X, LinkedIn — URL + photo). We'd key off name+location and phone/email. Looking to run a paid eval against ~1–2k of our resolved records to measure match rate + per-platform coverage, then scale.
> Questions: (1) per-lookup / subscription pricing + minimums for the Social Profiles field via the API; (2) which platforms return a URL + photo vs. a boolean; (3) match key options (name+location, phone, email) + typical match rates; (4) permitted use for **consumer** display (non-FCRA) — any restrictions; (5) batch vs real-time API; retention terms. Can you set up an eval key or a scoped trial?

**Pipl** (via pipl.com → Contact / Permissible Use):
> Subject: API eval + permissible-use for consumer people-search social enrichment
> We're a consumer people-search product. We resolve identity from public records and want Pipl's `social_profiles`/`usernames` to enrich those identities (no discovery from contact info — enrich-only). Two threads: (1) **Permissible-use approval in writing** for consumer people-search display of the social-profile fields — can our use be approved; (2) an eval: ~$/query, monthly minimum, and a trial against ~1k resolved records to measure social coverage + match rate. Which match keys (name+location, email, phone) perform best for enrich-only?

## Recommendation
Start PDL **today** (free, no sales) to bank the professional-layer number, and fire the Spokeo + Pipl outreach in parallel for the consumer-social production feed. Decide the production buy on the scorecard — coverage of FB/IG/X on *our* resolved people is the axis that settles it.

## PDL LIVE RESULT (2026-07-21, free tier, email key) — stronger than expected
Ran the free self-serve key against a ground-truth email (owner's). PDL matched the person and returned
**12 social profiles from ONE email lookup, including the marquee consumer platforms**:
`linkedin · facebook · twitter · github · gravatar · angellist · foursquare · pinterest · about.me · google+ · wordpress · myspace`.
- **Overturns the "LinkedIn-only / thin FB-IG" expectation** — FB + Twitter + LinkedIn + Pinterest all came back. Far richer than the free OSS layer (Holehe = 6 dev/utility sites, no FB/Twitter).
- Match key here = **email** (we have emails on the consumer BC report → email-enrich is directly usable there).
- CAVEATS: (1) includes **stale/dead platforms** (google+, myspace) → filter by liveness; (2) **name+location key** (the people-search-style key, e.g. on SEO where we lack email) is UNTESTED — needs our own resolved name+city pairs; (3) **PDL terms bar production people-search/FCRA display** → strong for EVAL + internal enrichment, but production *display* needs terms clearance OR the FCRA-clean vendors (Spokeo/Pipl, owner reaching out); (4) production cost = Pro ~$0.20–0.28/record.
- **Verdict:** PDL is the technically strongest + only self-serve source that returns the consumer-social presence. It settles the eval's deciding axis (marquee coverage from email = excellent). Next: (a) test the name+location key on our resolved people; (b) resolve display terms (PDL vs Spokeo/Pipl).

## Free layer built ("start with what we have"): seo/lib/socialFootprint.mjs
Server-side Gravatar enrichment (email → name + photo + verified linked accounts), pure-JS, no keys, no
terms restriction (public opt-in data) — shippable as the corroboration tier + a photo source, alongside a
paid seed (PDL/Spokeo/Pipl) for breadth.
