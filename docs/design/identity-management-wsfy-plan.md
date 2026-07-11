# Identity Management & WSFY — Product Plan

_Draft 2026-07-11. Strategy + build plan for the member-facing "protect/monitor yourself" product cluster._

## 0. The one idea

We run a people-search engine. The **same data that makes us money by exposing people** is the
anxiety we can monetize on the other side: *"you are exposed — manage it / watch it / protect it."*
This is the BeenVerified / Spokeo / MyLife → identity-protection playbook, and it is the single most
natural upsell and freemium-retention hook we have. It costs a non-payer nothing to care that
**they** are visible; that emotional pull is what brings them back until they convert.

Three things get conflated under "identity" — keep them distinct:

| Product | Question it answers | Data source | Status today |
|---|---|---|---|
| **Identity Exposure** (NEW, ship-now) | "What of *mine* is publicly visible?" | Our own search + idlookup.me + opt-out flow — **we already own all of it** | Not built, but **zero BC blockers** |
| **WSFY** (Who's Searching For You) | "Who is looking *for me*?" | BC inbound-activity finder | Built UI, **mock** — 1 BC capability blocked |
| **Alerts / Monitoring** | "Tell me when something about a watched identity *changes*" | BC watch CRUD + change-detection + delivery | Built UI, **mock** — 4 BC capabilities blocked |

**Strategic wedge:** lead with **Identity Exposure** (shippable now, no dependency), because it (a)
gives free users a real reason to log back in, (b) is a clean paid upsell (concierge opt-out /
monitoring), and (c) does not wait on BC. WSFY and Alerts layer on top as BC ships the capabilities.
This follows `feedback_innovate_dont_wait_for_bc`: file the BC asks in parallel, ship the
data-we-own version now.

---

## 1. Identity Exposure — SHIP NOW (no BC dependency)

### 1a. What it is
A logged-in member's dashboard tile + dedicated page that runs a search on **their own identity**
and shows them what is publicly exposed, then routes them to manage/suppress it.

We already have every piece:
- **Search** on name/phone/email (member search already works — `MemberGeneralSearchPage`, SRP,
  report-for-identity).
- **The exposure surface** — our own results + the fact that a profile may be live and indexable on
  **idlookup.me** (the SEO directory). "Your profile is public and Google-indexable" is true, real,
  and ownable.
- **The remediation** — the opt-out flow already exists: `OptOutLandingPage` (`/opt-out`),
  `SuppressionListPage` (`/suppression-list`), and BC's hosted opt-out page via
  `apiWrapper … goPage('optOut')` + `optOut.confirmation()` (`src/services/apiWrapper.js:649-655,
  1026-1041`).

### 1b. The screen (v1) — PARTIAL reveal, not a full report (MyLife model)
_Owner direction 2026-07-11: give away **parts** of the self-view, not the full report — the MyLife
rich-free model. A full self-report is deferred/segment-gated (see §1e)._

"**Your Identity Exposure Snapshot**" (reuse the `DashboardHome` "identity protection snapshot"
subtitle already in `src/pages/member/DashboardHome.js:996` — the framing is already there):
- Run a self-search from the identity on file (name + city/state, optionally phone/email).
- Show an **Exposure Score + checklist**: "You appear in N public records," "Your profile is publicly
  visible on idlookup.me," "Phone / email / address exposed," "Relatives listed" — with **teased /
  masked snippets** (the `SupTeaserA` masked mechanic, pointed at the user), **not** the full unmasked
  detail. Every line is a real signal from data we already return at teaser depth.
- Each exposed item → a **"Suppress this"** CTA into the existing opt-out flow. Batch it into a
  guided "Manage my exposure" wizard instead of dumping them on BC's raw hosted page.
- **Re-scan** button (manual today; automated when we own the email/monitoring pipeline — see §4).
- The full unmasked self-report is **not** given here — it stays behind the paywall / the §1e gate,
  so the snapshot drives *toward* conversion rather than satisfying the need.

### 1c. Why it's the right first move
- **Free-tier retention (area v):** a durable, honest reason for a non-payer to keep an account and
  return — "check if you're exposed" — with no paywall lie.
- **Upsell path:** manual opt-out is free; **concierge opt-out + ongoing monitoring** is the paid
  add-on (the DeleteMe model). We can charge for convenience without gating the basic right.
- **Zero BC ask.** Ships this sprint.

### 1e. Deferred: full self-report (segment + CC-on-file)
Giving a member their **full** unmasked self-report is a **later, gated experiment**, not part of v1:
**credit card on file + identity validation, segment-only** (owner, 2026-07-11). Rationale: we often
get one conversion shot and don't spend it for free by default; COGS is minimal, the conversion
economics are the reason. Ties to `freemium-strategy-plan.md` Lever D.

### 1d. Legal watch-item (must get right)
We both **expose** people and offer to **suppress** exposure. That's fine (every incumbent does it)
but the copy must be clean: opt-out is a genuine suppression request with identity verification
(already the case — `SuppressionListPage` describes verification + the public-records carve-out).
Do **not** imply we remove data from *other* brokers unless we actually build that. Keep FCRA framing
intact ("not for FCRA-permissible purposes"). Confirm the idlookup.me opt-out removes the person from
**the entire directory surface** (decision #7 in `project_seo_concept_decisions`).

---

## 2. WSFY (Who's Searching For You) — BC-blocked, ship "coming soon" + file ask

### 2a. Current state
`WhoIsSearchingPage.js` (618 lines) is fully built with two tabs (**Searchers** / **Viewers**), an
honest "coming soon / sample preview" banner (`:543-564`) and a free-tier upgrade banner (`:418`).
It runs on synthetic seeded-PRNG data from `watchingHelpers.js` (`generateEvents`). This is the right
posture — do **not** fake it as real.

### 2b. The one BC ask
An **inbound-activity finder**: given a member's identity, return search+view events that *targeted
them*, aggregated/anonymized (city/state/time/type — never raw searcher PII). BC has
`tracking.create` (keyed by the *searcher*), so the events exist; there is no query by *target*.
Documented in `docs/BC_CONSUMER_FEATURE_ASKS.md` (Cluster 1). Owned by `bc-asks-register`.

### 2c. Interim we can own
When we stand up our own email/monitoring backend (§4 / area iv), **our own tracking** already
records searches run *on our site*. We can surface "someone searched this name on IDLookup" for
searches that flow through **us** (a subset of BC's full picture) without a BC ask — a partial WSFY
powered by our first-party tracking. Frame honestly as "activity on IDLookup," not "everywhere."

---

## 3. Alerts / Monitoring — BC-blocked, 4 capabilities

### 3a. Current state
`AlertsPage` runs a one-time search (no persistence); `getAlerts` / `/notifications` are mock. Built
UI, honest coming-soon.

### 3b. The four BC asks (`docs/BC_CONSUMER_FEATURE_ASKS.md`, Cluster 2)
1. Watch subscription CRUD (monitored identity + criteria + frequency).
2. Server-side monitoring / change-detection (new record / new inbound search).
3. Notification feed (list / markRead / delete).
4. Delivery pipeline (trigger → send via `managedContact` address store, which exists).

### 3c. Interim we can own (this is the big unlock — ties to area iv)
We do **not** have to wait for all four. With **our own backend + email platform (area iv)** we can
build a **client-of-our-own monitoring loop**:
- Persist a "watch" (monitored identity + cadence) in **our** store (not BC).
- A scheduled job on **our** server re-runs the search via the normal BC search API on a cadence and
  diffs the result against the last snapshot.
- On a change, deliver via **our SendGrid** pipeline (area iv) using the member's opt-in address.

This gives us **persistent alerts + monitoring + delivery without BC capabilities #1–#4** — we only
lean on BC for the search call we already make. BC's version is better (true server-side change
detection over the full dataset, inbound-search signal), so file the asks; but we can ship a real,
useful Alerts product ourselves in the interim. This is the strongest argument for building the
email/monitoring backend in area (iv).

---

## 4. Identity Management as a paid tier (the bigger bet)

Beyond the free exposure snapshot, there's a real **paid product**: ongoing identity monitoring +
concierge opt-out (the DeleteMe / LifeLock-lite model). Decision needed — **build vs partner**:

- **Build-lite (recommended first):** our own monitoring loop (§3c) + concierge opt-out (we already
  have the opt-out flow) + monthly "here's your exposure this month" email. All first-party, all on
  infra we're building anyway. Sells as a higher tier or add-on to the base subscription.
- **Partner/white-label** dark-web / credit / SSN monitoring (third-party API) if we want the full
  identity-protection surface. Higher trust bar, vendor cost, PII/compliance load — **defer** until
  the build-lite version proves demand.

Do **not** build dark-web/credit monitoring in-house — that's a partner integration or nothing.

---

## 5. Sequence & dependencies

1. **Now (no blockers):** Identity Exposure snapshot (§1) — build on existing search + opt-out. Doubles
   as the freemium retention hook (area v) and an upsell surface.
2. **Now (parallel):** re-confirm/file the WSFY (1) + Alerts (4) BC asks via `bc-asks-register`; keep
   both pages as honest coming-soon.
3. **After the email/monitoring backend exists (area iv):** interim first-party Alerts (§3c) +
   partial WSFY from our own tracking (§2c). This is why area (iv) is the keystone dependency for
   the whole retention cluster.
4. **Later:** paid Identity Management tier (§4 build-lite), then evaluate a monitoring partner.

## 6. BC asks (register these)
- **WSFY:** inbound-activity finder (1) — exists as spec.
- **Alerts:** watch CRUD, change-detection, notification feed, delivery (4) — exists as spec.
- Ask for the **anonymized** shape up front (privacy/legal) — no raw searcher PII to the target.

## 7. Risks
- **Legal:** exposing + suppressing the same data must be clean; keep opt-out verification + the
  public-records carve-out; don't overclaim cross-broker removal.
- **Cannibalization:** telling members "you're exposed, suppress it" removes profiles from our own
  index. Acceptable — opt-out volume is tiny vs. the funnel, and the trust/retention win dominates —
  but watch the rate.
- **BC-blocked drift:** if we lean only on BC for Alerts/WSFY, the cluster stalls. The §3c/§2c
  first-party interims are what keep it moving.
