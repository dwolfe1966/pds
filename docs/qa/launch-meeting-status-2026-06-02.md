# IDLookup Launch Status — Owner + BC Meeting

**Date:** 2026-06-02
**Source list:** `docs/qa/bc client library - Bugs 6 - 2.csv` (79 items, IDs 1–79)
**Prepared from:** the CSV status column + our bug-triage execution record + a live code verification pass run today.

> Legend: ✅ Complete & in code · 🟡 Deferred by design / post-MVP · 🔴 Open (small front-end) · 🔵 **Needs BC / API-dev**

---

## 1. Headline counts

| Bucket | Count | Notes |
|---|---:|---|
| ✅ **Complete (front-end shipped)** | ~52 | The entire consumer funnel: name/phone landings, SRP, signup, payment, member dashboard, account/billing, opt-out. |
| 🟡 **Deferred by design** | 6 | Intentional product calls (need usage data or are post-MVP), not gaps. |
| 🔴 **Open front-end (small)** | 2 | Cosmetic/UX nits, low effort, non-blocking. |
| 🔵 **Needs BC / API-dev** | ~17 | Email, billing-renewal behavior, CSR permissions, hosting rewrite, reporting/attribution data. **This is where the real risk lives.** |

**Bottom line:** the user-facing front end is essentially launch-ready. The open items cluster almost entirely on the **BC/API side** — billing-renewal correctness, CSR tooling auth, and reporting/attribution data plumbing.

---

## 2. Status by item

### ✅ Complete — front-end (shipped & in code)
IDs **1–20** (all name/phone landing + SRP fixes: validation, split name fields, placeholders, FCRA-claim sweep, real result counts, mobile layout, sort/refine, blurred phone teaser), **22** (confirmation page), **23a/23b** (state required, sales + member), **24** (BC opt-out portal), **25** (terms/privacy/refund/CA-privacy consolidation), **26** (support email removed from footer), **27** (email disclosure on /search), **28** (8-char password min), **29** (billing disclosure moved off SUP top), **30** (mobile field spacing), **31** (smart expiry input), **32** (terms/privacy lightbox), **33** (contact-us new tab), **36** ("upgrade later" link), **37** (red-border on missing billing fields), **38** (scroll-to-top after signup), **39** (report extraction — relatives fix), **40** (phone search fixed*), **43** ("John Smith CA" empty-state), **46** (membership settings repositioned), **47** (upgrade CTA price copy), **48** (prominent search box), **49** (dashboard/account report parity), **50** (reactivate `nonMemberOnlyCommerceOffer` fixed), **52** (email regex validation*), **54** (5-digit ZIP), **55** (decline-vs-session error classifier), **56** (dashboard reports when cancelled), **57** (reactivate when cancelled), **58** ($1 trial billing-history line), **59** (search access through trial after cancel), **67** (double-logo/broken-image — verified single logo), **68** (session rotation — confirmed expected), **71** (member click → direct report, no redundant interstitial).

> *40/52 are code-complete but flagged for one owner smoke-test (phone search jump-to-report; email validation is strict-regex — true DNS/MX check is a BC/server item, see #52 below).

### 🟡 Deferred by design (not gaps — product decisions)
- **23c** — city typeahead → post-MVP.
- **34** — optional SUP consent checkbox per-shN → directional compliance call; needs per-shN flag from BC, not a polish item.
- **35** — "I AGREE. VIEW REPORT NOW!" CTA → owner concern it tanks conversion; recommend A/B test, not a global swap.
- **42** — remove Address search → pull usage from tracking first; don't kill a feature blind.
- **51** — thin-match experience → real feature build (branch SRP zero-state on shN); `ThinMatchPreview` component already exists.
- **53** — billing fields red-border *by default* → we chose touch-then-error instead (standard UX). Flag for discussion if owner still wants always-red.

### 🔴 Open front-end (small, low-risk)
- **69** — member SRP shows "X of Y" where Y grows on Load More instead of the true total up front. Minor; depends on BC returning a real total for the member endpoint (we already do this on the *sales* SRP via `transient.total`).
- **79** — member dashboard "run a new search" location is a free-text input; should be a state dropdown to match the landing/SRP. Small fix.

### 🔵 Needs BC / API-dev — see §3 for detail
IDs **21/75** (welcome email), **41** (report-endpoint depth), **44** (report↔PDF parity), **45** (PDF disclaimer), **60** (CSR customer search*), **61/62** (admin deep-link 404s), **63/64/65/72** (events logging), **66** (trial duration config), **73** (CSR fresh-signup permissions), **74** (cancel timestamp + renewal charge), **76** (card/BIN metadata), **77** (shN/attribution mapping), **78** (attribution on $1 fail/passthru).

> *60 (CSR customer search) is code-complete and deployed on our side; it needs one CSR-login confirmation, and historically was "fixed pending BC redeploy."

---

## 3. Blocker summary

### (a) 🔵 Blockers — API / BC dev

**Critical (confirm before real charges):**
- **#74 — Does cancel actually stop the renewal charge?** After a cancel-at-period-end, the order's recurring `CommerceBillingRecurScheduleEvent` stayed `status=active`. **As-is, a canceled member could be billed at renewal.** Need BC to confirm the schedule checks `subStatus` at bill time (or is deactivated). Also: where is the canonical cancel **date** recorded (revisions audit log?) — needed for churn cohorts.

**Launch-affecting:**
- **#73 — CSR permissions on fresh signup.** New CSR account → "Customers" = *forbidden resource*, "Orders" = *unable to load global order list*. CSR tooling unusable for newly-provisioned reps until BC grants the role/permissions.
- **#61/#62 — Admin SPA deep-link 404s.** `/csr/<route>` and refresh return 404; only `/csr/` resolves. **Filed:** `docs/BC_ADMIN_SPA_ROUTING_404.md` — BC nginx needs `try_files $uri $uri/ /csr/index.html`. (Workaround today: navigate from `/csr/` without refreshing.)
- **#21/#75 — Welcome email** not sent on paid signup. Filed: `docs/BC_SIGNUP_WELCOME_EMAIL.md`. Launch-acceptable gap (confirmation page exists), but users get no email receipt.
- **#66 — Trial duration mismatch.** Dev trial provisions ~30 days; checkout copy says 7. Confirm intended trial length and align `dueTimestamp`.

**Reporting / attribution (the big data plumbing block):**
- **#77 — shN/shL/shM mapping & queryability** (8 sub-questions). Records carry only ObjectId refs; per-partner/channel rollups require BC to **persist resolved shN/shL/partner/channel onto each commerce record** (or a stable mapping view). Without this, partner/channel reporting isn't possible.
- **#78 — Attribution on $1-fail→passthru / DS0 vs NDS0** cascade outcomes. Needs BC clarity on how declined-then-passthru attributes to partner.
- **#63/#64/#65/#72 — Event logging.** Visitor LP hits, failed searches, failed signups, and the cancel/keep lightbox aren't writing events. Mix of our tracking wiring and BC's events API.
- **#76 — Card type / BIN** metadata location in Mongo.
- **#41/#44/#45 — Report depth & PDF:** name vs phone report comprehensiveness (#41), member report page vs PDF parity (#44), and the PDF "fictional data" disclaimer (#45, filed `docs/BC_PDF_DISCLAIMER.md`). Largely bounded by BC report-endpoint data.

### (b) 🔴 Blockers — front-end dev

**There are effectively none that block launch.** Remaining front-end work is:
- **#79** — member dashboard state dropdown (small).
- **#69** — member SRP true-total count (minor; partly BC-total-dependent).
- **#53** — red-border-by-default (design decision pending owner).
- Plus the deferred-by-design set (#34/#35/#42/#51/#23c), which are product calls, not engineering blockers.

Test suite: **306 passing, 0 failing.** The three seams behind our worst recent admin bugs (BC-envelope fallback, payment-timestamp sort, tracking client-filter) now have regression guards. One known posture item (vendor strings in the consumer bundle) is logged and **deferred post-launch** — no secret exposed.

### (c) Risk assessment — soft launch (trickle users in)

**Verdict: VIABLE — recommended, with two eyes-open conditions.**

The user-facing happy path — search → SRP → signup → $1 trial payment → confirmation → member dashboard → view report — is **complete and tested**. Trickling users is the right call because it caps the blast radius of every open item below.

**Low risk (safe to trickle now):**
- Consumer funnel UX, validation, mobile, payment form, member account/billing flows — all shipped and covered by tests.
- Front-end open items (#69/#79) are cosmetic.

**Medium risk (acceptable at low volume, watch closely):**
- **Reporting blind spots (#63–65, #72, #77, #78).** During soft launch you'll have *limited* funnel/attribution analytics. You can still launch — just know you're partly flying blind on optimization until the events/attribution plumbing lands. Low user count = manageable.
- **Report depth perception (#41/#44).** Reports may read thinner than competitors; bounded by BC data. Trickle audience tolerates this better than a full launch.
- **No welcome email (#21).** Confirmation page covers the moment-of-truth; email receipt is a follow-up gap.

**Highest risk — gate before scaling (not just trickling):**
- **#74 billing/renewal.** If cancel does **not** suppress the recurring charge, a canceled trial user could be charged → refunds/chargebacks/trust damage. At trickle volume the exposure is small and recoverable, **but confirm BC's renewal behavior before any cohort reaches its first renewal date.** This is the single item that most warrants a definitive BC answer in this meeting.
- **#73 CSR tooling.** If support can't load Customers/Orders, you can't service the very users you're onboarding. Confirm CSR permissions are provisioned before reps go live.

**Recommended soft-launch posture:**
1. Trickle consumer users now — funnel is ready.
2. Get a **definitive BC answer on #74** (does cancel stop the renewal charge) before any user hits renewal.
3. Confirm **#73 CSR permissions** so support is operational.
4. Treat the first cohort as **instrumented learning**, accepting partial analytics until #77/events land.
5. Keep #61/#62 (admin routing) and #21 (welcome email) as fast-follow BC items — neither blocks a careful trickle.

---

*Front-end status verified in code 2026-06-02. BC-side items reflect what we can observe from the client + filed BC-ask docs under `docs/BC_*.md`; BC owns the authoritative answers.*
