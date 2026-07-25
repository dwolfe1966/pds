# Identity Control & Owner Voice — Product Spec

**Date:** 2026-07-25
**Status:** Draft for review
**Author:** Claude (from a working session with David)
**Related:** `project_identity_management`, `project_modular_profile`, `project_freemium_identity_community`, breach-monitoring build (2026-07-25), `docs/design/profile-concept-model.md`

---

## 1. Mission (why this is the company, not a feature)

**Deliver real control over the visibility of every facet of a person's identity — contact info, addresses, education, employment, relatives, and records — and give the identity owner a voice on what's said about them.**

Control must extend beyond our own walls:
- **IDLookup properties** — people-search results, WSFY, the public SEO directory (idlookup.me / idlookup.ai/people), reports.
- **Elsewhere** — other data brokers, private information stores, social services, background-check resellers, and any surface where the person's identity is exposed.

The identity owner — not the broker — is in control. That inversion is the product. Everything else (search funnels, teasers, monitoring) is acquisition and proof; **control is the destination.**

---

## 2. The core insight (the gap we're closing)

Two problems, both under-served today:

### 2a. Discoverability — the owner doesn't know they can control this
It is **not obvious to an identity owner that they can manage the visibility of different parts of their profile/report.** The capability is buried in a sub-tab and framed as a score mechanic. The mental model we need to establish on first contact is: **"This is MY identity. I decide what's visible, facet by facet."** If a member can't tell within seconds that they own and control this record, we've failed the core promise.

### 2b. The owner has no voice
A public record is presented as cold, decontextualized fact. A **"DUI — 1996"** line says nothing about the rehab in 1997 and the decades of sobriety since. The subject of the record — the person most affected by it — is the one party with **no way to add context.** That's both a fairness gap and a differentiator no broker offers.

> **Example (owner comment / UGC):**
> Record: *Public record — DUI, 1996*
> Owner note: *"I went to rehab in 1997 and have been clean and sober ever since."*

---

## 3. Current state (accurate, as of 2026-07-25)

"Hide my details" today is **three layers, and the most consequential one is a stub.**

| Layer | Status | What it does |
|---|---|---|
| **Score effect** | ✅ works | Hiding a driver drops it from the member's *own* exposure score. Motivational/cosmetic. |
| **Activity hidden (WSFY)** | ✅ works | `activity_hidden` hides the member's presence on our WSFY surfaces. Real but narrow. |
| **Suppression from others' searches** | ❌ **stub** | The single choke point that should remove the member from *other people's* searches — `personSignals.isSuppressed()` — is a hardcoded `return false` (TODO). Storage exists (`member_suppression.hidden_fields`), but **nothing reads it at search time.** |

**The credibility problem:** the UI says *"stops it being surfaced about you across IDLookup,"* but a stranger searching a member who clicked Hide **still sees their data.** We promise suppression we don't deliver. Fixing this — or softening the copy until we do — is the first priority.

There is no owner-commentary (UGC) capability at all today.

---

## 4. Feature set

### 4.1 Visibility control ("Hide / Show", per facet)
- **Per-facet toggles** — contact info, addresses, address history, relatives, education, employment, records (criminal/court), breaches. Each independently hideable.
- **Make it real (enforcement)** — wire `isSuppressed()` → `member_suppression` so a hidden facet actually disappears from `getPersonSignals` (the choke point already exists as invariant #5). We control the **augmentation layer** (incarceration, marriage/divorce, breach) — shippable without any partner.
- **Master control** — a one-click **"Hide my entire record"** in addition to per-facet, because the headline promise ("get me off the internet") is all-or-nothing for most users.
- **Honest multi-surface status** — a checklist that turns a vague promise into visible progress:
  `Our search ✓ · WSFY ✓ · Public directory ⏳ · Data brokers ⏳ · BC/IDI record ⏳`

### 4.2 Owner Voice (UGC / record commentary)
- The owner can **annotate a specific record** with context (the DUI → rehab example). Attached to a record, not the whole profile.
- **Display** — shown alongside the record wherever the report renders, **clearly labeled as owner-provided** ("Note from [name]") and visually distinct from verified data. Never presented as fact.
- **Governance** — moderation to prevent defamation / spam / third-party attacks; length limits; no links/PII of others; an appeal/report path.
- **Verification** — only the **confirmed owner** (KBA/DL, the existing WSFY verification) can annotate a record. This is also what makes the note *credible* to a viewer.
- **Value** — differentiator no competitor offers; converts a punitive record into a redemption narrative; strong emotional reason to claim + verify identity.

### 4.3 Scope — the surfaces control must reach
| Surface | We control? | Mechanism |
|---|---|---|
| IDLookup people-search results / teasers | ✅ yes | `isSuppressed` choke point → `member_suppression` |
| WSFY | ✅ yes | `activity_hidden` (exists) + facet suppression |
| Public SEO directory (idlookup.me / /people) | ⚙️ ours to build | deindex / suppress hidden records at render + sitemap |
| Core BC/IDI person record (name/address/relatives) | 🤝 partner | BC **opt-out** flow (exists) — we orchestrate + track |
| Other data brokers | 🌐 external | broker-removal service (roadmap; the big "get me off the internet" play) |
| Social services / private info stores | 🌐 external | future; part of the full mission |

---

## 5. Discoverability / UX (addressing 2a directly)

The control has to *announce itself*. Ideas:
- **Reframe the identity view around ownership** — lead with "This is your identity. You control what's visible." not an exposure score.
- **Every exposed facet shows an inline control affordance** — the "What's public about you" chips each carry a visible 👁 / 🙈 toggle, so control is obvious at the point of exposure (not hidden in a separate score list).
- **First-run coach-mark / onboarding** — on first visit to My Identity, a one-time overlay: "Tap any item to hide it — or add your side of the story."
- **Owner-voice prompt on records** — every record line shows an "Add context" affordance, inviting UGC.
- **Status as a hero** — the monitoring hero card (just built) is the template: a persistent, prominent "You're in control" surface with progress.

---

## 6. Verification & governance guardrails (non-negotiable)
- **Only the confirmed owner** can hide facets or annotate records (reuse WSFY KBA/DL verification). Prevents hiding/annotating someone else's record.
- **UGC moderation** — automated + human review path; clear community rules; no third-party PII, no defamation, no links.
- **Audit trail** — who hid/annotated what, when (already have `identity_events` — reuse it).
- **Compliance** — suppression must not be represented as an FCRA-regulated deletion; owner notes are opinion/context, not verified fact. Keep the non-CRA framing.

---

## 7. Enforcement architecture (how it actually works)
- **Suppression choke point** — `getPersonSignals` already routes every signal through `isSuppressed()` (invariant #5). Wire it to a **subject-level** lookup against `member_suppression` (keyed by verified identity: name+state, or a stable id). Per-facet: honor `hidden_fields` so hiding "relatives" removes only that signal.
- **UGC store** — a new `record_annotations` table: `{ owner_key, record_type, record_key, note, status(moderation), created_at }`. Read at report-render time; joined to the matching record.
- **Directory** — the SEO render + sitemap consult suppression to deindex/blank hidden records.
- **Events** — hide/show/annotate actions write `identity_events` → surface in My Activity (already wired) + notifications.
- **Reuse, don't rebuild** — monitoring's backbone (`identity_events`, Neon patterns, verification from WSFY) is the foundation.

---

## 8. Phasing (proposed)
1. **Make Hide real + honest** — wire `isSuppressed` → `member_suppression` for our augmentation layer; reconcile copy to what's enforced; add the multi-surface status checklist. *(Highest trust-per-effort; no partner dependency.)*
2. **Discoverability pass** — inline per-facet toggles on "What's public," ownership-first reframing, first-run coach-mark.
3. **Owner Voice (UGC) v1** — annotate records + confirmed-owner gating + moderation + labeled display.
4. **Directory scope** — suppress/deindex hidden records on idlookup.me / /people.
5. **BC opt-out orchestration** — drive + track the core-record opt-out from within Identity Control.
6. **Broker removal** — the external "get me off the internet" service (largest scope; likely partner or build).

---

## 9. Open questions / decisions
- Master "hide everything" vs facet-only for v1?
- UGC moderation: automated-only to start, or human-in-the-loop from day one?
- Does hiding a facet from *searchers* also remove it from the *owner's own* report view, or just from others'? (Recommend: others' only — the owner still sees their full record.)
- Directory suppression: real-time at render, or batch deindex? (SEO implications.)
- Pricing/tiering: is deep control (broker removal, full suppression) the premium tier, with basic hide + owner voice on the base/free tier? (Aligns with freemium-identity North Star.)
- How do we represent "verified owner note" to a viewer so it carries weight without asserting it as fact?

---

## 10. One-line summary
**We don't just tell people what's exposed — we hand them the controls and the microphone, on our properties first and everywhere their identity lives next.**
