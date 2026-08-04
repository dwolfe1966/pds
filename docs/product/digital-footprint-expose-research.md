# Digital Footprint Control — The EXPOSE Axis (Research Brief)

**Date:** 2026-08-04 · **Status:** research / for direction
**Related:** `docs/design/profile-concept-model.md` (the two-axis model), `docs/product/identity-control-and-owner-voice-spec.md` (Protect spec), `project_identity_management`, `project_modular_profile`

> **Expose axis** = *shrink the involuntary footprint* — hide/remove a person's data from search. This is the buildable core of "control your digital footprint," and the owner's chosen direction (2026-08-04). The other axis — **Present** (grow the intentional footprint / Google rank) — is parked as phase 2.

---

## 0. TL;DR

- **Expose is a mature, recurring-revenue category** (DeleteMe, Incogni, OneRep, Optery, Aura). ~4,000 US data brokers; services cover 300–2,400 of them; **data re-lists every 3–6 months, so removal is a subscription, not a one-time job.**
- **Build vs partner is the crux — and the answer is HYBRID.** Don't hand-build 100+ broker opt-out integrations. **Partner** for external broker removal (Optery offers an API + white-label program). **Build** only what we uniquely own: suppression on *our* surfaces, verification, the transparency panel, SEO-directory suppression.
- **Regulatory earthquake — happening right now.** California's **DROP** (Delete Request & Opt-out Platform) went live Jan 1 2026; as of **Aug 1 2026** every registered broker must honor deletions via DROP or face **$200/request/day** fines. 300K+ Californians have already used it. This **commoditizes basic CA broker-removal** (the state does it free) *and* **obligates us** (our people-search directory makes us a data broker).
- **Our authentic edge:** we're a people-search company helping people manage people-search sites — we know the ecosystem, we already have identity verification (KBA/DL), and we hold the suppression choke point. The catch is the **optics landmine** (a broker running a removal service — see the OneRep scandal); we must be transparent about it.
- **We're further along than the old spec claimed.** Per-item + global **Hide is FUNCTIONAL and enforced on WSFY** (not a stub). What's actually missing: **subject-suppression on the main search surface** (the `isSuppressed()` external-opt-out seam is the real stub), **directory (idlookup.me) suppression**, and **automated broker removal** (today it's an honest manual link-out directory).
- **First move (no partner, pure build):** extend suppression from WSFY to the surfaces that still ignore it — the `isSuppressed()` subject seam + the public directory — so "Hide" means "gone everywhere on IDLookup," and reconcile any copy to match.

---

## 1. Why Expose is our wedge

- **Most defensible for us.** We are the ecosystem. Fixing our own suppression is pure build with instant credibility ("we removed you from *us*, here's proof").
- **Recurring by nature.** Re-listing every 3–6 months = an ongoing monitor-and-re-remove loop = subscription that structurally fights churn (unlike a one-time search).
- **Aligns with the freemium North Star.** Free = see your exposure + hide on our surface; Paid = external broker removal + continuous monitoring.
- **The honest narrative already decided:** *"manage, don't delete"* — real ecosystem-wide deletion is impossible (data re-propagates), so continuous control is the product, not a false "delete everything" promise.

## 2. How the market actually works

- **Coverage (for calibration):** OneRep ~318 people-search sites · DeleteMe ~750 monitored (removed ~122 in independent testing, risk-prioritized) · Incogni ~2,420 (adds marketing/financial brokers) · ~4,000 brokers exist total, most small/regional.
- **Mechanics:** each broker has its own opt-out (web form / email / mailed request). Services submit on the user's behalf using **Authorized Agent** requests (CCPA) and **Limited Power of Attorney (LPOA)** where required, capture **before/after screenshots** as proof, then **re-scan every ~90 days** and re-submit when data reappears.
- **The value is the loop, not the one-time removal.** Anyone can opt out manually; people pay for *done-for-you + continuous re-removal + proof*.

## 3. Build vs Partner — the crux decision

| Option | What it is | Pros | Cons |
|---|---|---|---|
| **A. Build our own** broker opt-out automation | Integrate 100s of broker opt-out flows ourselves | Full control, margin, owned data | Huge + never-ending maintenance (forms change, anti-bot, LPOA/legal per broker); slow to market |
| **B. Partner / white-label** (e.g. **Optery API**) | Embed a removal engine under our brand | Fast to market, they maintain the broker integrations, proven coverage | Rev-share/margin, dependency, another vendor's optics |
| **C. HYBRID (recommended)** | **Build** our-surface suppression + transparency + verification; **partner** for the external-broker long tail | Ship the trust-building core now (no partner), add external removal via partner without the integration burden | Two moving parts to integrate |

**Recommendation: C.** Build the piece we uniquely control and that no partner can give us (removal from *IDLookup* + verification + the transparency dashboard), and partner (Optery-style API) for the external broker long tail. We never want to hand-maintain 500 opt-out scrapers.

## 4. The regulatory earthquake: California DROP (tailwind + obligation)

- **What:** SB 362 (Delete Act) created **DROP** — a state-run portal where a CA resident makes **one verified request** and **all 500+ registered brokers** must delete + stop selling their data. Live since **Jan 1 2026**; **300K+** requests already submitted.
- **Enforcement is NOW:** from **Aug 1 2026**, brokers must check DROP every 45 days and process deletions within 45 days, or pay **$200 per request, per day**.
- **Double-edged for the product:**
  - ⬇️ **Commoditizes** basic CA broker-removal — the state does it free for registered brokers. A paid service's CA value shrinks to: non-registered brokers, **other states**, **continuous monitoring/re-appearance** (DROP is one-shot), **social + Google** (out of scope), and **done-for-you convenience/verification**.
  - ⬆️ **Tailwind:** massive public awareness that "you can make brokers delete you" — exactly our acquisition message. More states are following California.
- **It obligates US.** Our people-search / SEO directory likely makes IDLookup a **registered data broker** subject to DROP → we must build robust deletion/opt-out machinery *for compliance anyway.* **That same machinery powers the member-facing "Hide."** Compliance cost → product asset. (⚠️ confirm our registration/obligation status with the owner/legal.)

## 5. Our assets + the buildable core

*(Build state below verified by a file-level audit, 2026-08-04.)*

| Asset | State | Role in Expose |
|---|---|---|
| **Per-item + global Hide, enforced on WSFY** (`member_suppression` → `wsfy.mjs`) | ✅ **FUNCTIONAL** | Hiding a facet actually drops the member's presence/affinity from WSFY output. Verified on live Neon. This is real, working suppression. |
| Exposure score + per-item Hide UI (`/my-identity` Digital Footprint tab) | ✅ built | The dashboard + toggles (paid-only, optimistic, updates score) |
| KBA / DL-barcode verification | ✅ built | Gate so only the confirmed owner can hide their record |
| `isSuppressed()` — **subject/external-opt-out seam** (`wsfy.mjs:42`) | ❌ **STUB** (`return false`) | The hook that would suppress a member as a *search subject* against an IDI/index opt-out list — i.e. remove them from what strangers see on the **main** search, not just WSFY. **This is the real gap.** |
| SEO directory (idlookup.me) suppression | ⚙️ **not wired** | Directory render + sitemap don't consult `member_suppression` yet — hidden records can still be indexed. |
| Broker opt-out (`DigitalFootprint.js`) | ⚙️ **manual link-out only** | Honest directory of real per-broker opt-out links + Google "Results about you" — says "automated one-click removal coming." Upgrade target. |
| BC people-search opt-out | 🤝 delegated to BC | We host the confirmation landing; BC owns the search→request→verify flow |
| Social presence (`getSocialPresence`, PDL+Gravatar) | ✅ built, **flag-gated OFF** | Presence detection (Transparency), experimental; legal watch-items keep it off |
| Google-rank / "Promote" | ❌ absent ("Coming soon") | Present axis — out of scope for Expose |
| Sentiment | ❌ absent | Out of scope for Expose |

## 6. The optics landmine (must handle head-on)

A **data broker running a data-removal service is a known trust problem** — the OneRep investigation (its founder also operated people-search sites) damaged that brand. We have the *same* structural conflict. Turn it into a strength, transparently:
- **Lead with it:** "We're a people-search company. We know exactly how your data spreads — and we'll remove you from us first, on the record, then everywhere else."
- **Prove our-surface removal first** (verifiable) before promising external removal.
- Never quietly re-list a member we removed. Auditable, or the whole thesis dies.

## 7. Business model

- **Free:** see your exposure (what's public on us + a scan of where you appear) + **Hide on IDLookup** (our surface). Acquisition + trust.
- **Paid (recurring):** external broker removal (partner engine) + **continuous monitoring & re-removal** + owner-voice/annotation + priority. The re-listing cadence *justifies* the subscription honestly.

## 8. Phased plan

1. **Make "Hide" real + honest** — wire `isSuppressed` → `member_suppression` for the layer we control (our search, WSFY, augmentation signals); reconcile copy to what's actually enforced; add the multi-surface status checklist (`Our search ✓ · WSFY ✓ · Directory ⏳ · Brokers ⏳`). *No partner. Highest trust-per-effort.*
2. **Directory suppression** — deindex/blank hidden records on idlookup.me at render + sitemap.
3. **Transparency panel** — "Your representations across the web": a curated broker list with found / hidden / in-progress / removed status (the DeleteMe site-by-site pattern). Front door to removal.
4. **External broker removal via partner** (Optery-style API/white-label) + **DROP** integration for CA (surface the state's free path honestly — builds trust, and we're obligated anyway).
5. **Monitoring + re-appearance alerts** — the recurring retention loop.

## 9. Open questions / next research

- **Are we a registered CA data broker, and what's our DROP obligation/deadline?** (Compliance-critical, and it hands us the deletion machinery.) — for owner/legal.
- **Optery (or peer) partnership terms** — API pricing, rev-share, white-label constraints, coverage overlap with DROP. (Email `support@optery.com` per their partner program.)
- **Legal to act as Authorized Agent / LPOA** on members' behalf for external opt-outs.
- **Which states beyond CA** have (or are adding) DROP-like registries — coverage roadmap.
- **How much of "removal" do we do ourselves vs partner** at each price tier.

## 10. Recommended first move

**Complete our-surface suppression + make the status honest.** Hide already works on WSFY — so the job is to extend it to the surfaces that still ignore it and prove it:
1. **Wire the `isSuppressed()` subject seam** (`wsfy.mjs:42`) + **directory suppression** so a member who hides is actually removed as a *subject* from the main search and idlookup.me — not just from WSFY. This closes the "we promise suppression we don't fully deliver" gap.
2. **Ship the honest multi-surface status checklist** — `IDLookup search ✓ · WSFY ✓ · Public directory ⏳ · Data brokers ⏳ · BC/IDI record ⏳` — turning a vague promise into visible, provable progress.

Pure build, no partner, no legal dependency, and it converts our biggest liability into our biggest proof point. The transparency panel, partner-powered broker removal (Optery), DROP integration, and monitoring all layer on top of that credibility.

---

**Sources (market + regulatory):**
- Incogni — best data-removal services 2026: https://blog.incogni.com/essential-data-removal-tools/
- Incogni vs OneRep (coverage): https://cybernews.com/privacy-tools/incogni-vs-onerep/
- Aura — remove yourself from data brokers (re-listing cadence): https://www.aura.com/learn/how-to-remove-yourself-from-data-broker-sites
- DeleteMe — opt-out guides / coverage: https://joindeleteme.com/blog/opt-out-guides/
- Optery — data-removal API: https://www.optery.com/api/ · Partnership program: https://www.optery.com/partnership-program/
- CA DROP goes live (Clark Hill): https://www.clarkhill.com/news-events/news/is-your-business-a-data-broker-californias-drop-goes-live-and-calprivacy-continues-to-enforce-delete-act/
- DROP enforcement Aug 2026 (Alston & Bird): https://www.alstonprivacy.com/drop-is-coming-due-what-californias-delete-act-means-for-data-brokers-in-august/
- CA Privacy — DROP: https://privacy.ca.gov/data-brokers
