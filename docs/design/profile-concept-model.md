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

## 3. The differentiator: **Present vs Expose** (two dials on one Profile)

Every competitor sits on ONE axis. We're the only one on both:

- **Expose axis (public reality)** — the footprint already out there (public records, data brokers).
  We can't retract it from the world, but we can **suppress it on our surfaces, help remove it
  elsewhere (opt-out), and monitor + alert on re-appearance.** This is the DeleteMe / Aura / Incogni /
  Google-"Results about you" model. Owner dial = **shrink what's exposed.**
- **Present axis (curated identity)** — what the owner *chooses* to show: a claimed, authored profile.
  This is the LinkedIn / About.me / Facebook model. Owner dial = **grow what you present.**

**Data brokers only expose (and grudgingly opt-out). Social networks only present. We do both:**
shrink the involuntary footprint, grow the intentional one — *"own your digital representation."*

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

## 8. Biggest build efforts (owner's framing)

1. **Visualize the report as a Profile** — the shared `ProfileView` projection engine (report page becomes one caller).
2. **My Profile experience** — owner projection: present-layer authoring + expose dashboard + "view as" + verify badge.
3. **General "Others" Profile** — the viewer-state-aware profile reachable via search, WSFY, recommended-people.

## 9. Open questions to resolve before building

- **Present layer scope at launch** — do owners author a real "present" profile (bio/links/headline) now, or is v1
  just the "expose" dashboard + claim, with "present" as phase 2?
- **Permission granularity** — per-section (simpler) vs per-field (Facebook-grade) owner controls for v1?
- **"View as" fidelity** — a true live-rule render vs a simpler 3-tab mock for v1?
- **Unclaimed default** — confirm the Anonymous/Free/Paid column defaults above (esp. what's free vs paid) against
  current monetization (we must not give away what the paywall depends on).
- **Naming/route** — does `/my-identity` become `/my-profile`, and does the report page (`/people/:id`) become
  `/profile/:id`? (Keep aliases.)
- **Verification requirement** — is claim-to-control gated on KBA pass (lightweight) or optional-with-badge (LinkedIn model)?
