---
name: project_phone_email_flow_roadmap
description: "Competitor phone/email funnel synthesis + our flow roadmap (P1/P2/P3, E3); Twilio Lookup approved 2026-07-24"
metadata: 
  node_type: memory
  type: project
  originSessionId: c559d3ef-73d6-4bd2-ae57-b22ea4c6528f
---

Competitor teardown (Spokeo, BeenVerified, TruthFinder, Instant Checkmate, PeopleFinders) of reverse
PHONE + EMAIL funnels, 2026-07-24. Full agent findings in the session; key patterns:
- **Pricing splits two camps:** bundled one-sub-all-verticals (Spokeo/BV/PeopleFinders ~$20-30/mo) vs
  **segmented** (TruthFinder/Instant Checkmate: phone = cheap $4.99-5.99 standalone WEDGE → upsell to
  ~$35 person membership; email premium/bundled). Phone-as-loss-leader is a real, copyable structural bet.
- **Phone is a SAFETY product, not curiosity** — everyone leads with "is this call spam/scam?" Spokeo's
  signature = **Phone Reputation Score** (Low/Med/High + 6 factors + crowd comments). Needs phone intel.
- **Email splits:** social-discovery (Spokeo/IC/PeopleFinders — Gravatar/social profiles/photos) vs
  security/breach dark-web scan (BV/TF — "protect yourself," +$2.99/mo monitoring upsell).
- **Loader theater** (TF/IC 2-3min fake "scanning millions of records" + repeated "graphic content"
  warnings) is a conversion weapon AND the exact thing that drew **FTC action** (non-CRA disclaimer +
  implied eligibility use). Our stance: HONEST progress ("checking public records/incarceration"), never
  fake theater — trust differentiator. Spam data must stay DESCRIPTIVE ("reported as spam"), never a risk
  assertion (the FTC line).

**Owner decisions (2026-07-24):**
1. **Twilio Lookup APPROVED** (~$0.005/number) — adds line type / carrier / spam signal; unlocks the
   safety/spam angle the whole category runs on. Key/provisioning = owner/ops; build behind an env-gated
   backend endpoint (secret can't live in the SPA — follow the /api/social-presence enrichment pattern).
2. **Prototype order: P3 → P1 → P2** (P2 after Twilio wired).
3. **Email pick = E3** (breach/exposure via HIBP) — cheapest net-new capability, compliant, monitoring
   upsell; email sibling of P3 (both "check your OWN exposure" → feed identity mgmt).

**The flows:**
- **P1 (ship now):** phone owner reveal + records — the shipped `/phone/landing/v1` single-owner reveal;
  lean harder on the incarceration moat. See [[project_email_on_payment_flow]] for its checkout.
- **P2 (needs Twilio):** "Is this call safe?" — lead with spam/line-type badge (blurred) + owner tease.
- **P3 (ship now, net-new, NO competitor does it):** reverse the lens — "enter YOUR number, see what's
  exposed + who's searching." Phone-first low-friction FRONT DOOR to the existing WSFY convert engine
  (`WsfyLandingPage` already does phone-match → KBA confirm → silent account → /payment?reason=wsfy).
  Uses `SignalTeaser viewerRelation="owner-self"` (severity-ordered exposure). See [[project_wsfy_self_build]],
  [[project_identity_management]], [[project_signals_augmentation]].
- **E3 (BUILT 2026-07-25):** `/email/exposure` "Is your email exposed?" — HIBP breach check (self-check),
  breach summary + exposed-data chips free, blurred breach names + removal-plan gated → WSFY engine
  (/see-who?email=). seo/lib/emailExposure.mjs + emailExposureDb.mjs (Neon cache, SHA-256 email key, 14d TTL,
  Core 1 tier). HIBP_API_KEY live on Vercel; live-verified.

**STATUS: P1/P2/P3/E3 all built. Provider keys (TWILIO_API_KEY/_SECRET, HIBP_API_KEY) live on idlookup.me
Vercel. Consumer bundle carrying all four NOT yet on BC — owner deploys. Provider libs degrade to
available:false when keys unset, so nothing breaks pre-key.** Twilio creds = API Key (SK+secret), no Account
SID; HIBP = Core 1 ($4.39/mo, 10 RPM, cache-gated). Both keys in gitignored docs/twilio/twilio-credentials.rtf.

**Separate DECISION (not a flow to build yet):** test a $4.99 phone-only micro-sub (TF/IC wedge) vs our
bundled sub — BC-offer/money-path change. See [[project_shn_framework]] for per-partner offer wiring.
