# Master Growth Plan — 2026-07-11

_One strategy across the five areas the owner raised. The five are **not silos** — they're one
lifecycle: **Acquire → Convert → Retain.** This doc gives the opinionated sequence and makes the
seams explicit. Each area has its own deep doc (linked)._

## The map

```
ACQUIRE                         CONVERT                    RETAIN (non-payers → payers)
─────────                       ─────────                  ────────────────────────────
(i) idlookup.me SEO   ───────►  (ii) idlookup.ai   ──────► (v) Freemium  ◄── hooks ── (iii) Identity/
    directory → funnel handoff       paid funnel               (keep free                WSFY/Alerts
                                      (BeenVerified               warm)
                                       mimic)                       ▲
                                                                    │ delivery layer
                                                          (iv) First-party email platform
                                                               (SendGrid on the Vercel app)
```

**The three seams that make this one system, not five projects:**
1. **(iii) Identity/WSFY/Alerts _are_ the (v) freemium retention hooks.** "You're exposed," "someone
   searched for you," "a new record was found" is what pulls a non-payer back.
2. **(iv) email is the delivery layer for all of it** — abandoned-checkout, remarketing, monitoring
   alerts, win-back, WSFY pings all ride it. Nothing durable in (iii)/(v) works without it.
3. **One server-side backend unlocks the whole right side.** Production idlookup.ai is a pure SPA and
   can't hold a key, schedule a job, or listen for events — so a server-side runtime is the unlock for
   (iii), (iv), and (v) at once. The **Vercel+Neon+Cron pattern already proven by idlookup.me** is the
   obvious basis. **Open call:** reuse that same app vs. a separate isolated service — see "Open
   questions" below; lean separate for PII isolation.

## Deep docs
- (i) `docs/seo/idlookup-me-ga-readiness-2026-07.md`
- (ii) `docs/design/funnel-mimic-plan.md` + `docs/design/beenverified-funnel-teardown-2026-07.md`
- (iii) `docs/design/identity-management-wsfy-plan.md`
- (iv) `docs/design/email-platform-plan.md` + `docs/design/email-platform-current-state.md`
- (v) `docs/design/freemium-strategy-plan.md` + `docs/design/freemium-current-state.md`

---

## Opinionated sequence

Anchored to where we are: **BC went live in prod 2026-06-23; we're conversion-focused.** Conversion
(ii) and acquisition (i) pay off **now**; retention (iii/iv/v) pays off **once volume flows through a
converting funnel** — so it's second, not skipped. Within that:

> **Scope note (owner, 2026-07-11):** focus is **Convert + Retain** (funnels + free experience). The
> SEO/idlookup.me track is de-prioritized to a parallel trickle, not a front-three wave. The
> "deploy the 2026-07-03 redesign" item was **dropped** — git shows that work has been shipping
> incrementally (e.g. `921ae0b … compare live vs Trust Blue` is a live experiment), so there is no
> single undeployed redesign to ship.

### Wave 0 — Instrument the funnel (days)
1. **Make the funnel honestly measurable end-to-end:** `landing_view → search_submit → loader_complete
   → teaser_view → signup → paid`, split by ad-unit **and** A/B variant. `loader_complete` and
   `teaser_view` aren't cleanly distinct today; without them, Waves 1–2 aren't A/B-readable. _(ii)_
2. **Record a baseline:** free→paid rate, per-step drop-off, and free-account **return rate** (the one
   we basically don't have). _(ii)+(v)_
3. _(SEO, parallel trickle — not gating)_ fix the idlookup.me `relatedTo` 404 (`/people/{name}` →
   `/profiles/{name}`) and stand up the GSC **property** to watch indexing; **do NOT** submit the
   ≈868k-URL sitemap (thin-doorway manual-action risk — see Wave 2 #7). _(i)_

### Wave 1 — BeenVerified **optional flow** (primary bet) + safe funnel improvements (parallel)
> **Owner priority (2026-07-11):** pull the BeenVerified mimic forward and build it as an **optional
> flow** — a *separate, parallel funnel route* that runs alongside the existing funnel, never replaces
> it. Existing traffic's proven path is untouched; a controlled slice is routed through the new flow
> and measured head-to-head. This is why it can go early: it's additive and reversible (a flag/variant),
> so it doesn't risk the "one conversion shot" on the default path.

4. **Build the BeenVerified-style optional flow** _(decisions locked 2026-07-11)_. A new funnel route
   (`…/landing/v7` or `?flow=bv`) behind a **manual feature flag, OFF by default** — internal/manual
   testing first, no live A/B split until validated. **Structure-faithful:** progressive input drip →
   long **anticipation loader that carries the payoff** (loader-replaces-teaser, no blurred SUP) →
   **email capture mid-loader** (their key tactic, being tested; = a remarketing lead, not an account;
   needs a consent line) → paywall (disclosed trial + price anchor). **Guardrails kept:** disclosed
   trial terms + self-serve cancel (no hidden exit-intent trial, no phone-only cancel). Requires Wave 0
   instrumentation (`loader_complete`/`email_capture`/`teaser_view` distinct). _(ii)_
5. **Enrich the existing loader** (parallel) — real source-category checklist, live-activity ticker,
   rotating reassurance panels; progress stays honest. **NO "confidential search" line** (counter to
   our two-sided/WSFY model). _(ii)_
6. **Bulk-plan price anchor** at the paywall (presentation only). A/B. _(ii)_
7. **Progressive input refinement / "I'm not sure" skip escapes** on the existing funnel. _(ii)_
8. **Scope the PayPal + wallet BC ask** (recurring billing agreement) — already an owner item. _(ii)_

### Wave 2 — First real free experience (MyLife model)
9. **Rich free self-experience.** Exposure preview + score of the user's **own** public footprint
   (partial/teased via the `SupTeaserA` mechanic, **NOT** a full report) + "who's searching for you"
   as the return hook. No CC required, no report given away. Full self-report is **deferred**
   (CC-on-file + identity validation, segment-only). _(iii)+(v)_
10. **Server-side saved-people / search history** — durable state a free user returns for (today it's
    localStorage, dies on device change). _(v)_

### Wave 3 — Retention keystone: the send/monitoring backend (unlocks the rest of iii + v)
11. **Stand up the email/monitoring backend** (Vercel+Neon+Cron pattern; separate isolated service —
    see Open questions) — Phase 0 (sending subdomain + SPF/DKIM/DMARC + SendGrid key) → **Phase 1
    abandoned-checkout** (signal + templates already exist; likely pays for the build). _(iv)_
12. **Interim first-party Alerts** — our own re-search/diff loop → email on change. Real monitoring
    without waiting for BC's 4 capabilities. _(iii)+(iv)_
13. **Lifecycle drips** (welcome, saved-person nudge, win-back) + **partial WSFY from our own
    tracking**; keep full WSFY + a paid Identity-management tier as follow-ons. _(iii)+(iv)_

### Wave 4 (deferred / parallel trickle) — idlookup.me GA + BC-blocked features
14. **idlookup.me GA** (de-prioritized): decide thin-page posture → noindex the ~800k doorway leaves,
    keep city pages + real profiles → submit a pruned sitemap; opt-out propagation; bulk BC/IDI feed
    for real scale. _(i)_
15. **Full WSFY + persistent Alerts** once BC ships the inbound-activity finder + watch/monitoring
    capabilities; **paid Identity Management tier** (concierge opt-out + monitoring). _(iii)_
16. **Lever D experiment** — full self-report for a segment (CC-on-file + identity validation). _(v)_

### Parallel, continuous (BC-blocked, file don't wait)
- **BC asks register** (`bc-asks-register`): WSFY inbound-activity finder (1); Alerts CRUD/monitoring/
  feed/delivery (4); recurring PayPal; suppression-list sync (CAN-SPAM); bulk directory feed. Per
  `feedback_innovate_dont_wait_for_bc`: file in parallel, ship the data-we-own interims now.

## The biggest risks (cross-cutting)
- **idlookup.me thin-content manual action** — 99.9% of pages are doorway-shaped. Noindex the leaves
  before courting crawl. _(i)_
- **Owned-email deliverability + CAN-SPAM** — separate sending subdomain (protect BC's transactional
  inbox) + bidirectional suppression sync with BC. _(iv)_
- **Retention cluster stalling on BC** — mitigated by the first-party interims (Vercel backend). _(iii)_
- **Two-sided model, not confidential search** — we monetize BOTH sides (searchers AND WSFY for the
  searched-for). Never promise search confidentiality (owner 2026-07-11); it guts WSFY. This also
  differentiates us from one-sided tools (BeenVerified/TruthFinder). _(ii)+(iii)_
- **Don't spend the one conversion shot** — the free experience must *drive toward* conversion (partial
  self-reveal), not satisfy the need (a free full report). Full report giveaways are gated (CC-on-file,
  segment-only) and A/B-only. _(v)_
- **Conversion-vs-compliance** — tier every funnel mimic by risk; reject BeenVerified's dark patterns
  (email-before-value, fake progress, hidden trial, phone-only cancel). _(ii)+(v)_
- **Focus** — we just launched; keep the front three waves on Convert+Retain; SEO/BC-blocked work is
  a parallel trickle (Wave 4), not a front-line thread.

## Open questions to resolve before committing (load-bearing)
- _(Resolved 2026-07-11)_ **BeenVerified flow** = a separate **optional flow** behind a **manual feature
  flag** (off by default, internal test first), **structure-faithful + testing email-mid-loader**, with
  our guardrails (disclosed trial + self-serve cancel). Pulled forward to Wave 1. _(ii)_
- **Where the retention backend lives** — reuse the idlookup.me Vercel app vs. a **separate isolated
  service** (still Vercel/Neon, just not the public SEO app). Lean **separate**: consumer PII (member
  emails, watchlists, monitoring state) shouldn't live in the public directory's DB. _(iv)_
- _(Resolved 2026-07-11)_ **Report-pull COGS** — minimal per pull, so cost is **not** the blocker; the
  full self-report is deferred on **conversion-economics** grounds (one conversion shot) and gated
  (CC-on-file, segment-only) if tested. _(v)_

## One-line recommendation
Instrument the funnel + baseline (Wave 0); ship the safe funnel improvements (Wave 1) as the primary
thread; run the **BeenVerified experimental arm** and the **MyLife-style partial free self-experience**
(Wave 2) as the two big bets; stand up the **send/monitoring backend** (Wave 3) as the keystone that
unlocks the rest of retention. SEO/BC-blocked work stays a parallel trickle (Wave 4).
