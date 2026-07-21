# Social-Presence OSS Footprint Spike — Findings

_Spike (b), 2026-07-21. Measures what the FREE/OSS layer actually delivers on identities we've already resolved, to size how much it adds before paying for a feed. Tool: Holehe (email → account-exists across 121 sites), venv, no API keys. Maigret/Sherlock (username enumeration) couldn't build on the box's Python 3.9._

## Method
Holehe checks, for a given **email**, which of 121 sites have an account registered to it — passively (its design goal is to not alert the target; no reset emails sent). This is our highest-signal free path because our resolved-person data **has emails** (from BC reports/leads). Ran against a real email with known ground truth (owner's) so hits can be validated.

## Result (n=1 ground-truth email)
**6 of 121 sites reported an account**, in ~10 seconds:
- eventbrite, **gravatar**, replit, spotify, teamtreehouse, wordpress

**The corroboration win:** Gravatar returned the **real name ("David Wolfe") + a profile URL (+ avatar)** — a genuine *second signal* that confirms ownership and yields a photo. This is exactly the kind of ≥2-signal corroboration the model needs.

**The gap that matters:** none of the marquee consumer-social platforms surfaced.
- **Facebook, LinkedIn, TikTok — Holehe has no module at all** (too locked down to detect).
- **Instagram, Twitter/X, Snapchat, Pinterest — covered/attempted, returned nothing** (either genuinely unused on this email, or the modules silently failed on rate-limits/anti-bot — the documented failure mode).
- The 6 hits are all **dev/utility/misc** sites, not the social presence a people-search user expects.

## Username enumeration (qualitative — tool wouldn't build on 3.9)
The decisive issue is **ambiguity, not tooling**: a username derived from a name (e.g., `davidwolfe`) is not unique. "David Wolfe" is also a well-known health influencer — any enumeration on that handle returns *his* accounts, plus squatters/impersonators, not the subject's. Handles aren't unique → a raw enumeration hit is a **lead, not an identification**; attribution needs independent corroboration (shared email/phone, photo continuity, linked personal site).

## What this means for the combined model
The free layer is **real but thin, and structurally weak exactly where it matters most**:
- ❌ **Not a substitute for paid seeds on the marquee platforms.** FB/IG/X/LinkedIn/TikTok — the presence users actually want — do not come reliably (or at all) from free tools. Those need a **paid vendor (Spokeo/Pipl)**.
- ✅ **Real value as a CORROBORATION + BREADTH layer:** Gravatar-style name/photo/handle hits confirm a paid vendor's match (the 2nd signal), and free tools cover a **long tail** of niche/dev sites paid vendors skip.
- So the layering holds: **paid = marquee-platform seeds; free = corroboration + long-tail breadth; scrape = enrich/verify a known URL.** Free alone would produce a sparse, dev-skewed footprint and risky username guesses — not a shippable "social presence" section.

## Sizing caveat
n=1 ground-truth email. A fuller measurement (10–20 resolved-person emails) would firm up the hit rate — but the *structural* conclusion (marquee platforms absent from free; corroboration + long-tail is the free layer's real job) won't change, because it's a coverage/anti-bot fact, not a sample-size artifact.

## Recommendation → sets up eval (a)
Proceed to the **paid-seed eval (Spokeo + Pipl)** as the source of marquee-platform presence, and design the eval to measure exactly the gap the free layer can't fill: **FB/IG/X/LinkedIn coverage + match rate on our resolved people**. Keep the free layer in the architecture as the corroboration/breadth tier (Holehe email-footprint + a username-enumeration pass), always gated behind ≥2-signal confirmation before asserting "this is them."
