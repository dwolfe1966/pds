# Opt-out & monitoring automation — roadmap (2026-08-08)

Goal (owner): for **every** provider, go as far as we can to eliminate friction from opting out and
monitoring — a raw link is not enough. Prepare the member (what info is needed), pre-fill everything we can,
and automate what genuinely completes end-to-end. Some controls escalate beyond a form (expungement attorney,
credit remediation). Push each provider to its ceiling — and be honest about where that ceiling is.

## The wall (from the per-vendor research — see broker-optout-automation-matrix.md)
No provider exposes a removal API. Browser flows are walled by **CAPTCHA + "find your listing first" + an
out-of-band email/phone OTP** the user must complete. Many "removals" are actually **suppression**,
**file-access/dispute**, **freeze**, **account-deletion**, or **no opt-out**. So "we do it all for you" is a
trap; the honest maximum is provider-specific.

## The friction ladder (per provider, climb as high as each allows)
- **0 — raw link** (where we started).
- **1 — guided pre-flight**: what this ACHIEVES, what you'll need, steps, the verification you'll hit, timeline.
- **2 — prefilled request**: the exact CCPA letter / form values composed from the member's identity.
- **3 — extension-assisted**: autofills + navigates in the member's OWN logged-in session (they clear the
  CAPTCHA + click their own confirmation email). The one tool that beats the OTP/CAPTCHA wall.
- **4 — agent-executed**: we submit end-to-end. Only honest where it completes — the **email tier**.
- **5 — escalated to a partner**: expungement attorney, credit remediation. A referral marketplace, not a form.

## Phased plan (ordered by the wall, not by ambition)

### Phase 1 — Guided/prefill for ALL providers ✅ SHIPPED (2026-08-08, guided-layer-first per owner)
`src/services/optOutPlaybook.js` + `src/components/OptOutGuide.js`, wired into `DigitalFootprint`.
- Generic playbooks by (nature, method) cover every one of the ~85 sources; SPECIFIC overrides add exact
  detail (verification, timeline, notes) for the top providers.
- The guide states what's achieved, a have/need checklist (checked against the claimed identity), the steps,
  the verification hurdle, the timeline, and a pre-written CCPA request (copy / open-in-email) or prefill
  values to paste.
- **Next within Phase 1:** enrich SPECIFIC entries toward all high-weight providers; capture more identity
  fields (street address, DOB) at claim time so the checklist shows more ✓ and prefill is fuller.

### Phase 2 — Agent-executed email tier (real end-to-end removal, no CAPTCHA to defeat)
The B2B + several brokers accept an emailed CCPA request (Apollo, Lusha, Data Axle, Cognism, AtData, Hiya…).
Build: send from a monitored mailbox + an IMAP poller that clicks the confirmation links they reply with;
track status on the exposure node. Dependency: SendGrid domain-auth/envs (currently paused) + a reply inbox.
This is the highest-ROI *real* automation. Reuses the authorized-agent consent already captured.

### Phase 3 — Browser extension (rung 3) — a scoped, weeks-scale bet
In-session autofill + multi-step navigation + confirmation capture for the browser-walled people-search tier.
Prove the selector-maintenance model on the CLEAN targets first (That'sThem, SafeGraph, the PeopleConnect
cluster) before promising it across 85. Costs: per-broker DOM selectors (breakage treadmill), Chrome Web
Store review, broad permissions. Can also power **monitoring** (periodic in-session re-checks). Decide as its
own phase with real cost, not a casual add.

### Separate track — Partner marketplace (rung 5)
Vetted **expungement-attorney** and **credit-remediation** referrals, with the pre-flight that preps the
member. Legal + revenue-share + liability; a different build from the form flow. Surfaces where the control
requires it (criminal/court records → expungement; credit file → remediation, not deletion).

## Monitoring (second axis) — hits the SAME wall as detection
Re-checking whether a broker re-listed someone is as hard as the original scan (anti-bot; the vendor scan we
don't have). The extension (in-session re-check) is the vendor-free path. Until then the "monitors" label is
aspirational — don't let it stand in for real re-scanning. Real monitoring lands with Phase 3 (or a vendor).

## Honesty guardrails (owner, reinforced twice)
State the DEGREE, never all-or-nothing. Never present a removal/monitor state that isn't true. Where a
provider can only dispute (FCRA), freeze, or has no opt-out — say exactly that. See
[[feedback_honest_approach_flag]].
