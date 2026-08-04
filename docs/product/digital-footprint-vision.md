# Digital Footprint Management — The Large Vision

**Date:** 2026-08-04 · **Status:** strategy / thinking large (owner-requested)
**Related:** `digital-footprint-expose-research.md` (the Expose wedge), `profile-concept-model.md` (one-Profile model), `identity-control-and-owner-voice-spec.md`, `project_freemium_identity_community` (North Star)

> **Broker opt-out is one node. The company is the control layer for a person's entire digital identity — everywhere it lives.**

---

## 1. The thesis (the largest honest framing)

Today, a person's digital footprint is **administered by everyone except them** — brokers sell it, platforms shape it, search engines rank it, algorithms infer from it, and now AI models repeat it. The individual is the *subject* of their identity but never the *administrator* of it.

**We flip the administrator.** IDLookup becomes the **one control panel where a person sees, controls, and shapes how they appear across every surface their identity touches** — brokers, public records, search results, social, breaches, images, and AI. Not a point tool. The **operating system for your digital self.**

The one-line product: **"Your identity, everywhere — now administered by you."**

## 2. Why this is a category, not a feature — the market is fragmented on purpose

Every capability a person needs is a *separate* company today, each solving one slice:

| Need | Who owns it now | What they miss |
|---|---|---|
| Remove from brokers | DeleteMe, Optery, Incogni | only brokers; no search/social/AI |
| Fix Google results | BrandYourself, Reputation.com | agency-priced; no removal |
| Identity-theft / monitoring | Aura, LifeLock | credit-centric; not "how I appear" |
| Breach / dark-web | HaveIBeenPwned, credit monitors | passwords, not footprint |
| Image exposure | PimEyes, Clearview (adversary) | search only, no control |
| Reputation / mentions | Brandwatch, Mention | enterprise, not consumer-self |

**Nobody unifies them.** The person has to assemble 5–6 subscriptions and still has no single view. **The unification IS the opportunity** — the "everything app for your identity." Whoever aggregates the *view* and the *controls* owns the relationship; the point tools become suppliers behind it (the way we'd use Optery as *a supplier*, not a competitor).

## 3. The two primitives everything is built from

Build these once and every surface plugs in:

**A. The Exposure Graph** — *the see-everything layer.* One per-person map of every place they appear (each broker, each social profile, each public record, each breach, each search result, each image, each AI mention), each with: found/verified, data types exposed, freshness, sentiment, and **removal/control status**. This is the spine. The `profile-concept-model.md` "one Profile, many projections" is the same idea — extended from *our* record to the *whole ecosystem*.

**B. The Control Layer** — *the act-everywhere layer.* A unified set of actions the owner can take against any node in the graph:
- **Remove / Hide** (Expose) — opt out, suppress, deindex, takedown
- **Correct** — fix wrong data (wrong address, mis-matched record)
- **Contextualize** — the owner's voice/annotation on a record (no competitor has this)
- **Promote** (Present) — rank positive owned content, authored profile
- **Grant / Revoke** — permission control: who sees what
- **Monitor / Alert** — continuous re-scan, re-appearance, new-exposure alerts

**Exposure Graph × Control Layer = the product.** Every feature is a cell: `(surface) × (action)`.

## 4. The capability × surface matrix (full scope)

| Surface ↓ / Action → | See | Remove/Hide | Correct | Contextualize | Promote | Monitor |
|---|---|---|---|---|---|---|
| **IDLookup (us)** | ✅ built | ✅ WSFY works | — | spec'd | via SEO | WSFY |
| **Data brokers** | scan | Optery partner | custom removal | — | — | re-scan |
| **Public records** | ✅ our data | opt-out/seal* | dispute* | owner voice | — | alert |
| **Search (Google)** | scan | "Results about you" | — | — | ⭐ our SEO | rank watch |
| **Social** | presence (built, off) | guidance | — | — | authored | mentions |
| **Breaches / dark web** | HIBP-style | rotate/alert | — | — | — | ✅ built |
| **Images** | reverse-search | takedown | — | — | — | alert |
| **AI / LLM answers** | ⭐ new frontier | correction/feedback | — | — | seed | monitor |

*(★ = an angle where we have unusual advantage or first-mover room. \* = jurisdiction-dependent.)*

## 5. Why US — the unfair advantages incumbents can't copy

This is the part that makes the large vision *credible* rather than aspirational:

1. **We ARE the search engine → we own the top of funnel.** DeleteMe/Optery must *buy* leads. We *generate* them: every person who searches (themselves or others) is shown real exposure instantly. **Our acquisition cost for "here's what's public about you" is ~zero.** Nobody else has that.
2. **We have an SEO engine that ranks for names** (idlookup.me). The "Promote / fix my Google" axis that reputation firms charge $10k for — we can product-ize by hosting a **claimed, member-authored profile on our high-authority domain that ranks for their name.** Structural advantage on the Present axis.
3. **We already have identity verification** (KBA/DL). The trust primitive — "only the confirmed owner controls this" — is built. It gates everything and is itself a public trust badge.
4. **WSFY is a retention/urgency engine nobody else has.** "3 people searched for you this week" creates the recurring reason to come back that pure removal services lack.
5. **The two-class-data community flywheel** (the North Star). We hold broker-style records on ~200M non-members. Each is a "**is this you? claim + control**" front door → converts strangers into members → their control actions enrich the graph → more value → more claims. **A self-feeding growth loop competitors can't build** because they don't hold the underlying records.

**Synthesis:** we are simultaneously the *problem surface* (a people-search site) and uniquely positioned to be the *solution layer*. Handled transparently, that's not a conflict — it's the most authentic possible pitch: *"We're the search engine. We know exactly how your data spreads. Let us put you in charge of it."*

## 6. Land → expand (wedge to OS, without losing the vision)

- **Land (free):** *"See everything that's public about you."* We already are the search — instant exposure report. Zero-CAC hook.
- **Convert (paid):** remove from **us** + **brokers** (Optery). The DeleteMe wedge — the Expose axis we're building.
- **Expand horizontally (surface by surface):** + Google results → + breaches/dark web (built) → + social presence → + images → + public-records correction.
- **Expand vertically (deeper value):** owner voice → authored profile / rank (Present) → permission/consent control → continuous monitoring.
- **Become the OS:** one dashboard, one verified identity, every surface, every action. The place people *administer their digital self*.

Each step is independently monetizable, and each makes the next cheaper (same graph, same identity, same verification).

## 7. Three big bets worth naming (beyond the obvious)

1. **⭐ AI reputation — the open frontier (2026).** Increasingly, "what people learn about you" isn't a Google list — it's what **ChatGPT / Perplexity / Gemini** *say* when asked about you (often wrong, unsourced, unremovable). **Nobody owns "manage what AI says about you" yet.** We're positioned: we hold structured identity data + we rank on the web that trains these models + we have owner-verified truth (the owner-voice layer) to *seed correct answers*. First-mover potential in a category that's about to matter enormously.
2. **The permission / consent layer (flip the model).** Once a person has a verified, controlled identity with us, invert it: let *them* **grant** a verified slice to a landlord, employer, or date — "share my verified identity, revocable, on my terms." The footprint stops being only a liability to shrink and becomes an **asset the owner disburses.** Ties directly to the community North Star and opens B2B.
3. **The community flywheel as the moat.** Lean into two-class data: non-member records as claim front-doors, member control actions as data improvement, WSFY as the social/urgency layer. This is the growth engine — and the moat — that a pure removal service structurally cannot replicate.

## 8. Business model at scale

- **Free:** exposure report + hide-on-IDLookup + basic monitoring. (Acquisition; also the honest "we removed you from us first" trust proof.)
- **Consumer subscription (recurring):** broker removal + full monitoring + owner voice + Google/social. Re-listing cadence (3–6 mo) makes recurring *honest*, not a trap.
- **Premium / family:** deeper control, authored profile/rank, image + AI reputation, family plans.
- **B2B / API:** footprint scanning + the permission layer for executive protection, HR, dating-safety, fintech KYC-adjacent — powered by our search graph (Optery does the removal B2B; we can do the *identity/exposure* B2B).

## 9. The moat (why this compounds)

- **The Exposure Graph + zero-CAC search demand** that feeds it — data + distribution in one.
- **The two-class community flywheel** — non-members → claimed, controlled members.
- **Verification + owner voice** — owned, verified content nobody else holds.
- **SEO authority** — we can *rank*, so we can *promote*, not just remove.
- **Trust, if earned** — the transparent broker-turned-advocate is a story only we can tell.

## 10. What this means for near-term sequencing (vision without losing focus)

Think large, ship narrow — but ship the *spine*, not a silo:
1. **Build the Exposure Graph as the data model now**, even if v1 only populates the IDLookup + broker columns. Everything else plugs into it later. (Don't build broker-removal as a one-off; build it as the *second column of the graph.*)
2. **Complete our-surface control** (the recalibrated Expose first-move: subject-suppression seam + directory) — proof we deliver.
3. **Ship the itemized "footprint across the web"** (Optery-powered) as the graph's first external surface.
4. **Keep the OS framing in the UI from day one** — "your footprint" not "broker removal," so expansion is a fill-in, not a re-pitch.

---

**One-line summary:** *We're not building a broker-removal tool. We're building the one place a person administers how they appear across the entire internet — see it, control it, shape it — and we're the only company that both holds the data and owns the search demand to make that the default front door.*
