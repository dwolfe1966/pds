# Profile Concept Model — "own your digital representation"

Status: **working draft for alignment** (2026-07-15). Source: owner direction + 3 research threads
(social-profile anatomy/viewer-tiering · data-broker profile taxonomy + gating · privacy-control &
"view as" patterns). This is the conceptual spine for the Identity → Profile product direction.

---

## 1. The core primitive: one **Profile**, projected through a viewer lens

There is **one entity — a Profile of a person** — and everything a user sees (a search "report", a
WSFY card, "My Profile", a recommended-people tile) is a **projection** of that one entity. "Report"
and "profile" are not two things: **today's paid "report" is simply the paid-viewer projection of an
unclaimed Profile.**

A projection is determined by three inputs:

- **Viewer class** — the fixed ladder (validated across LinkedIn/Facebook):
  `Anonymous → Free member → Paid member → Specifically-granted user → Owner (self)`
- **Claim status** — *unclaimed* (assembled from public data; the default) vs *claimed* (a member has
  mapped + verified to it).
- **Permissions** — if claimed, the owner's per-field/per-section choices for each viewer class, plus
  access granted to specific people.

Implication: **build one state-aware `ProfileView(subject, viewer, permissions)`** and it powers the
report page, My Profile, and every WSFY / search / recommended card. Build the projection engine once.

## 2. Two modes: **Me view** and **Others view**

- **Others view** — someone else's Profile, rendered at the viewer's tier. The default is *unclaimed*
  (viewer-tier gating only); owner-permissions overlay when a claim exists.
- **Me view** — your own Profile: the owner projection = your data + management controls + a
  **"view as" preview** of how each viewer class sees you.

Nav collapses to three: **Dashboard · My Profile · Search.**
- **Dashboard** — hub blending *Others* (search, WSFY "who's looking", recommended people) and *Me*
  (exposure snapshot, profile completeness, alerts).
- **My Profile** — the owner projection + controls.
- **Search** — the entry into Others-view Profiles.

## 3. The mission: **Transparency + Control** across the whole ecosystem

The product isn't "a profile page" — it's the **aggregation + control layer over a person's entire
digital representation ecosystem** (our idlookup profile is just *one node* we happen to fully control;
the graph also includes data brokers — Spokeo, PeopleFinders, BeenVerified… — social networks — FB,
LinkedIn — Google results, public records). Two pillars:

- **TRANSPARENCY** — *"I can see all of my representations, everywhere."* Aggregate every place the
  person appears, and show how they "look" there — with scores, sentiment, freshness, exposure.
- **CONTROL** — *"I can manage them — change, hide, or remove."* Per-representation actions: suppress on
  our surface, hand off / drive data-broker opt-outs, (aspirational) manage social + broker
  representations directly, and monitor + alert on re-appearance.

**The narrative arc we must own (core education):** most people arrive wanting to **DELETE everything.**
Real deletion from the public-record / broker / social ecosystem is **impossible** — data re-lists,
re-appears, re-propagates. Our job is to help them *understand* that and reframe to **MANAGE**, which is
more valuable and ongoing: transparency + continuous control beats a one-time (illusory) delete. This
"manage, don't delete" reframe is the emotional through-line of the whole Me-view.

### The two control dials (one Profile, two axes)
- **Expose axis (public reality) — v1 focus.** *Shrink* the involuntary footprint: suppress on our
  surfaces, drive/hand-off broker opt-outs, monitor + alert. DeleteMe / Aura / Incogni / Google-"Results
  about you" model. **This is where we start.**
- **Present axis (curated identity) — aspirational / phase 2.** *Grow* the intentional footprint: a
  claimed, authored profile (LinkedIn / About.me). Not v1.

**Data brokers only expose (and grudgingly opt-out). Social networks only present. We aggregate + control
BOTH across the ecosystem** — that's *"own your digital representation."*

## 4. Canonical section taxonomy (ordered)

Merged from the data-broker person-profile taxonomy + the social identity-header pattern. Order =
universal prominence.

1. **Identity header** — photo, name, age, current city/state, verification badge. *(Always public — the
   "findability" layer + emotional hook. Never gate it.)*
2. **Aliases / AKAs / name variants**
3. **Overview / jump-nav** — a section index that doubles as a "value manifest" (what the full profile holds)
4. **Contact** — phones, emails *(high-value; heavily gated)*
5. **Address history** — current + past, move dates, map
6. **Relatives & associates** *(names as free social-proof of a match)*
7. **Employment & education**
8. **Social & web presence** — linked profiles, usernames
9. **Criminal / court / traffic / registry** *(the "premium" section; teased as present, locked)*
10. **Assets & property** — real estate, vehicles
11. **Financial public records** — bankruptcies, liens, judgments, licenses
12. **Monitoring / freshness** — "last updated" + notify-on-change *(retention loop, not an apology)*

For a **claimed/presented** profile, the owner can also author a **Present layer** on top of the header
(headline/tagline, bio, curated links) — the About.me/LinkedIn hero.

## 5. Viewer-state matrix (what each tier sees)

| Section | Anonymous | Free member | Paid member | Owner (self) |
|---|---|---|---|---|
| Identity header | ✅ full | ✅ full | ✅ full | ✅ + edit |
| Overview/jump-nav (shape+counts) | ✅ counts only | ✅ counts only | ✅ | ✅ |
| Aliases | tease | ✅ | ✅ | ✅ |
| Contact | 🔒 "3 found" | 🔒 partial | ✅ | ✅ + hide toggles |
| Address history | 🔒 count | ✅ current only | ✅ full | ✅ + hide |
| Relatives | names teased | ✅ | ✅ | ✅ + hide |
| Employment/education | 🔒 | ✅ | ✅ | ✅ + hide |
| Social/web | 🔒 | ✅ | ✅ | ✅ + hide |
| Criminal/court | 🔒 "check" | 🔒 "check" | ✅ | ✅ |
| Assets/financial | 🔒 | 🔒 | ✅ | ✅ + hide |
| Monitoring/alerts | — | basic | ✅ | ✅ |
| Controls (hide/opt-out/present) | — | upsell | some | ✅ full |

Owner *permissions* can override cells (e.g. hide a section from Paid viewers, or grant a specific
person full access). Default when unclaimed = the tier column as-is. **Reveal shape, withhold detail** —
render every section as a real row with a truthful count/label, locked, not hidden.

## 6. Patterns we're borrowing (with sources in the research threads)

1. **Header always public, body tiered** — universal (social + brokers). Maps to anonymous-tease → paid-full.
2. **One record, many projections** — LinkedIn per-section public toggle; Facebook per-field audience selector.
3. **True "View as" preview** — Facebook/LinkedIn: re-render the real profile through a chosen viewer class,
   driven by the *live* gating rules (not a mock). Plus an incognito-style "what a stranger Googles" honest view.
4. **Category-label + live count tease** — brokers: "4 addresses · 2 relatives · Criminal: check", locked not hidden.
5. **Jump-nav as value manifest** — Spokeo: a top section index that makes the paywall feel like unlocking a known quantity.
6. **Progressive reveal by viewer state, NOT fake loading** — same page, three fidelity levels. (Avoid the FTC-sanctioned
   TruthFinder/Instant-Checkmate fake-scare-loading pattern.)
7. **Exposure dashboard** — DeleteMe/Aura/Incogni: one exposure score + itemized list + per-item status pipeline
   (found → in-progress → removed) + progress over time.
8. **Continuous monitoring + alerts** — turns one-time cleanup into a retained, recurring value loop.
9. **Grant-specific-access** — Facebook "specific friends" / LinkedIn connection tier: grant a named person full visibility.
10. **Claim + verify → badge + control** — CLEAR-style ID/selfie or KBA; unlocks edit/suppress rights AND is a public
    trust signal (LinkedIn verified ≈ +60% views). *(We already built KBA + DL-barcode verification for this.)*
11. **"Is this you? Manage or suppress" front door** — turn the buried opt-out liability into a visible trust signal.

## 7. What we already have that maps in

- **Exposure score + per-item hide** (My Identity) → the Expose-axis dashboard (pattern 7).
- **Per-item suppression enforced in WSFY** → per-section owner permissions (pattern 2), our surfaces.
- **KBA + DL-barcode verification** → claim+verify gate (pattern 10).
- **SEO people directory (idlookup.me)** → Others-view Profiles at the Anonymous tier, indexable.
- **WSFY** → an Others-view *relationship* signal ("who viewed me") on the Dashboard.
- **`SearchResultDetailPage` (the report)** → the Paid-viewer projection today; the thing to refactor into `ProfileView`.

## 8. Decisions locked (2026-07-15)

- **v1 = Claim + Expose/Control. Present is aspirational (phase 2).** No authored bio/headline/links in v1.
- **"View as" — whichever is easier ships in v1.** Live-rule render is desirable but not required; a simple
  3-tab preview is acceptable.
- **"Manage, don't delete" is the core narrative** — lead the Me-view with transparency + control, and
  explicitly educate that ecosystem-wide deletion is impossible.
- **Ecosystem scope is the north star** — aggregate representations from *everywhere* (brokers, social,
  Google, public records), and (aspirational) control them at the source, not just on idlookup.

## 9. Build efforts, sequenced

**v1 (buildable now — Claim + Transparency + Control on our surface + broker hand-off):**
1. **Report-as-Profile** — refactor `SearchResultDetailPage` into a shared, viewer-projected `ProfileView`
   (report page + My-profile + cards all become callers). The "visualize report as profile" work.
2. **My Profile = Me-view command center** — claim/verify (done: KBA/DL) + exposure dashboard (score +
   itemized "what's public" + per-item hide, mostly done) + a **"Your representations across the web"** panel
   (curated broker list with found/hidden/removal status + opt-out hand-off — the transparency+control MVP,
   DeleteMe site-by-site pattern) + the "manage don't delete" onboarding + a simple **"view as"** tab.
3. **Others-view Profile** — the viewer-state-aware profile reachable via search / WSFY / recommended-people
   (same `ProfileView`, non-owner projection).
4. **Monitoring + alerts** — "a new listing appeared / your info reappeared" (retention loop).

**Aspirational (phase 2+):** Present-layer authoring; automated cross-broker + social removal/management at
the source; sentiment/reputation scores aggregated across sources; the full "everywhere" representation graph.

## 10. Still-open (smaller) questions

- **Permission granularity** — per-section (simpler) vs per-field owner controls for v1? (Lean per-section.)
- **Unclaimed tier defaults** — confirm the Anonymous/Free/Paid columns in §5 against current monetization
  (must not give away what the paywall depends on).
- **Naming/route** — `/my-identity` → `/my-profile`, and report `/people/:id` → `/profile/:id`? (Keep aliases.)
- **Broker list sourcing** for the transparency panel — curated static list of major brokers (+ likelihood
  listed) vs live presence-detection? (Lean curated static for v1.)
