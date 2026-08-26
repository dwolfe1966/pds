---
name: project_identity_control_owner_voice
description: Product thesis — identity owners control visibility of every facet + get a voice (UGC) on their records; spec at docs/product/identity-control-and-owner-voice-spec.md
metadata: 
  node_type: memory
  type: project
  originSessionId: c559d3ef-73d6-4bd2-ae57-b22ea4c6528f
---

Owner's product thesis (2026-07-25), spec'd at `docs/product/identity-control-and-owner-voice-spec.md`.

**Mission = the company:** deliver real control over the visibility of every facet of a person's identity
(contact/address/education/employment/relatives/records) — on IDLookup properties (search, WSFY, SEO
directory, reports) AND elsewhere (other data brokers, private info stores, social services). The identity
OWNER, not the broker, is in control. Control is the destination; funnels/teasers/monitoring are acquisition.

**Two insights the owner stressed:**
1. **Discoverability gap** — it's NOT obvious to an identity owner that they CAN manage visibility of parts of
   their profile/report. Must establish "this is MY identity, I control it facet-by-facet" on first contact
   (inline per-facet toggles on "What's public", ownership-first reframing, coach-mark).
2. **Owner Voice / UGC** — let the owner COMMENT on public records to add context (e.g. record "DUI 1996" →
   owner note "went to rehab in 1997, clean & sober since"). Labeled owner-provided, confirmed-owner-gated,
   moderated. No competitor offers this.

**Current-state finding (CORRECTED by file-level audit 2026-08-04 — the earlier "Hide is a stub" was
conflated):** Per-item + global **Hide IS FUNCTIONAL and enforced on WSFY** — `member_suppression`
(`hidden_fields`/`activity_hidden`) is read back and applied in `seo/lib/wsfy.mjs` (drops suppressed
searchers + blanks hidden-facet affinity/occupation; verified live). The genuine STUB is a DIFFERENT seam:
`isSuppressed()` at `wsfy.mjs:42` (`return false`) — the hook for an external **IDI/index opt-out list** that
would suppress a member as a SEARCH SUBJECT on the MAIN search (what strangers see), not just WSFY. Real gaps:
(1) that subject-suppression seam, (2) **directory (idlookup.me) suppression** (render+sitemap don't consult
member_suppression), (3) **automated broker removal** — today `DigitalFootprint.js` is an honest MANUAL
link-out directory (per-broker opt-out links + Google "Results about you"), not an engine. **First step:
wire isSuppressed subject seam + directory suppression so Hide = gone everywhere on IDLookup, + honest
multi-surface status checklist.** Google-rank/Promote + sentiment = ABSENT; social presence built but flag-OFF.

**UPDATE 2026-08-06 (commit 97e0893) — gap #2 (directory suppression) NOW BUILT for the incarceration leaves.** Owner picked "make Hide real where we fully control it." A claimed member who sets "Hide me" (activity_hidden) is now filtered out of our public incarceration leaf pages (`/people/[state]/([city]|county/[county])/[name]`). Match = **name_norm+state+AGE(±1)**; age is REQUIRED (captured from the claimed identity at hide time → new lazy `age` col on member_suppression) so we NEVER over-suppress a same-name stranger (fairness+SEO). Filter is centralized in `seo/lib/incarceration.mjs` `rosterByNameState`/`rosterByNameCounty` via `suppressPublicRecords()` (in `search-activity-db.mjs`), so both generateMetadata(robots) + body see it → fully-suppressed name auto-noindexes. Fail-OPEN on DB error (don't break the directory). ⚠️ TWO FOLLOW-UPS: (a) **TIMELINESS** — leaf pages are ISR-cached 60d, so removal takes effect on regeneration, NOT instant; on-demand revalidatePath/Tag on hide is pending (needs a raw/unfiltered path lookup since the filter hides the records used to find paths). (b) **🚩 COPY** — Hide toggle copy still says only "hide my activity"; it now ALSO removes the public record, but the removal-CLAIM wording is the owner's honest-approach call (kept under-claimed for now, no false state shown). Sitemap suppression still not wired (separate from render). Google-rank/sentiment still ABSENT.

**EXPOSE-axis research brief (2026-08-04):** `docs/product/digital-footprint-expose-research.md` — owner chose
the Expose axis. Market (DeleteMe/Incogni/OneRep/Optery, 3-6mo re-list = recurring); build-vs-partner = HYBRID
(build our-surface, partner Optery API/white-label for external brokers); **CA DROP live Jan 2026 / enforced
Aug 1 2026** = tailwind + compliance obligation on us (we're a broker). See [[project_seo_live_idlookup_me]].

Scope layers: our search/WSFY (we control) → SEO directory (ours to build) → core BC/IDI record (BC opt-out
flow, exists) → external brokers/social (roadmap, the "get me off the internet" play). Reuse the monitoring
backbone (`identity_events`, Neon, WSFY KBA/DL verification). See [[project_identity_management]],
[[project_modular_profile]], [[project_freemium_identity_community]], [[project_phone_email_flow_roadmap]].
