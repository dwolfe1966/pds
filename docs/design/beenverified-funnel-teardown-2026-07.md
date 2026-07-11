# BeenVerified Paid-Funnel Teardown (2026-07)

**Purpose:** Reverse-engineer BeenVerified's *current* paid consumer funnel (ad/landing → search → loader → email-capture → paywall) and its organic SEO teaser, so we can mimic the highest-converting patterns on idlookup.ai. Authorized competitive research.

**Date:** 2026-07-11
**Method:** First-hand walk of `https://www.beenverified.com` via Playwright (Cloudflare did **not** block this time — a major upgrade over the 2026-06-28 `docs/seo/competitive-teardown.md`, where every BeenVerified page was Cloudflare-walled). I ran a real name search (Michael Johnson, CA), progressed all the way to the payment wall, and **stopped without paying / entered no card**. I then loaded the organic `/people/` directory page directly. Secondary sources (2025–2026 reviews) used only to characterize funnel arms I did not personally hit ($1 trial, asterisked teaser). Every claim below is tagged **[first-hand]** or **[secondary]**.

Screenshots in scratchpad: `01-loader.png` … `08-people-directory-michael-johnson.png`.

> **Read this caveat first.** BeenVerified heavily **A/B-tests funnel arms** (campaign IDs in the URL: `a19763`, `32fc4f`, `98101d`, `f429ba`…). The arm I walked (`a19763`) is a **no-trial, no-blurred-preview, straight-to-monthly** arm. Other arms show a **$1/7-day trial** (surfaced via exit-intent) and an **asterisked/blurred results preview** [secondary]. Do not treat any single price or step as canonical — the *mechanics* generalize, the *specifics* rotate.

---

## 1. Step-by-step funnel map (arm `a19763`, first-hand)

The through-line: **collect the search inputs one field at a time, drip micro-commitments, then hold a fake-progress loader near-complete while extracting the email — before showing anything.**

| # | URL / state | What's on screen | What's collected | Persuasion device |
|---|---|---|---|---|
| 0 | `/` (home) | Hero "The **Everyday** Information Company", People/Phone/Email/Address/Vehicle tabs, First+Last name inputs, one "Search" button | First + last name | Trustpilot "Over 2,500 reviews / Tried by millions", "12 Products in one", DigiCert "Privacy Secured" badge |
| 1 | `/lp/a19763/2/loading` | **"Thank you. Where Do They Live?"** — City + State dropdown, **"I'm not sure."** escape | City, State | Persistent right rail: **"146,270,528+ reports have been run"** counter + rotating testimonials |
| 2 | same URL | "Refining Your Search / Looking up billions of records" spinner | — | Fake-progress transition between question steps |
| 3 | same URL | **"Can you share the following details to help narrow down our results?"** — Age + Middle Name, "I'm not sure." | Age, middle name | Progressive profiling; each field optional to reduce abandonment |
| 4 | same URL | **"Please confirm before we continue / There are limits to how you can use BeenVerified reports"** — FCRA checkbox + **"I Agree"** | FCRA consent click | Compliance-as-micro-commitment (also legally required) |
| 5 | `/lp/a19763/3/building-report` | **Fake-progress builder**: big "**7% … 51% … 100%**" counter + animated "**Searching:** Home Address · Phone Numbers · Social Media · Photos · Court Records" checklist. Carousels anticipation panels (see §2). "**Please do not hit the Back button. Your information may be lost.**" | — | Zeigarnik/anticipation; loss-aversion lock-in; live-activity + testimonials |
| 6 | still `/building-report`, held at **75%** | Loader **halts** on **"Save Results / To see your results, we need this basic information"** → **email field + Continue** | **Email** | Progress bar frozen at 75% = sunk-cost. "We'll never sell your information." |
| 7 | still 75% | Second capture step: **"Your First Name / Your Last Name"** (the *searcher's* name) + Submit | **Searcher's own name** | Progressive profiling continues before payoff |
| 8 | `/building-report` resumes 77→100% | Loader finishes; more anticipation panels (Property, Criminal/Traffic, Relatives, Social, Monitoring upsell) | — | Header rotates feature boasts ("Now with PDF Downloads", "data confidence scoring") |
| 9 | `/lp/a19763/4/subscribe?hide-fcra=true` — **"Final Step"** | **Paywall** (see §4). No results ever shown. | Card (I stopped here) | "As Seen on MTV's Catfish" badge, guarantee, "Confidential Searching" |

**Headline structural finding:** in this arm there is **no SRP and no blurred SUP**. The search-results list and the teaser profile are *replaced entirely by the anticipation panels inside the loader*, and the **email is captured mid-loader, before any data is revealed**. The user pays first, sees results second. (Contrast our funnel, which shows a real SRP and a masked SUP teaser *before* asking for anything — §9.)

---

## 2. Persuasion / urgency mechanics (first-hand inventory)

Every one of these was observed on-screen:

- **Long fake-progress loader (~90 seconds).** Percent counter climbs 7→100 slowly, with a fixed "Searching:" checklist of 5 data categories animating checkmarks. This is the "Searching 247 sources…" pattern taken to an extreme — it's the funnel's core engine, not a detail.
- **Anticipation panels carouseled inside the loader**, each describing data the report *may* contain: "Social Media Scan" (Facebook/Instagram/Twitter/LinkedIn/Pinterest/YouTube/Skype/Reddit logos), "Addresses and Property", "Criminal or Traffic", "Relatives & Connections", "Ongoing notifications/Monitoring", "Miscellaneous". They sell the payoff while stalling.
- **Live-activity / volume counters:** "146,270,528+ reports have been run"; header ticker "On average, **35,000 people run searches on BeenVerified every day**".
- **Rotating testimonials** throughout (dating red-flags, finding biological family, stalking convictions, "someone offered to drive my daughter home from soccer practice…" — fear + reunion framing). Attribution to ConsumerAffairs.com for authority.
- **Loss-aversion lock-in:** "Please do not hit the Back button. Your information may be lost."
- **Sunk-cost hold:** progress frozen at 75% until the email is entered.
- **Micro-commitment laddering:** name → location → age → FCRA "I Agree" → email → own name. Each step trivially cheap; "I'm not sure." escapes keep the funnel moving rather than losing the user.
- **Use-case normalization donut:** "How Do People Use BeenVerified? — 21% Curiosity/Scam Avoiders, 20% Phone/Email, 19% Family/Friends, 17% Personal Records, 13% Cheating/Dating, 10% Address & Property" — makes snooping feel normal/majority behavior.
- **Trust/authority badges:** DigiCert TLS verify button, "As Seen on MTV's Catfish", "SOC 2, GDPR & CCPA Compliant", NY street address, support phone.

**Notably ABSENT at BeenVerified:** any **"someone is searching for you"** / reverse-WSFY hook. That's a **MyLife** pattern, not BeenVerified's. Worth flagging because it's directly adjacent to our WSFY / Identity-Management product — the category leader does *not* use it in the acquisition funnel, so it's a differentiation opening for us rather than table stakes.

---

## 3. The organic SEO teaser (a *separate* surface — first-hand)

Loading `https://www.beenverified.com/people/michael-johnson/` directly (the Cloudflare-blocked-before SEO surface) reveals the **classic Spokeo teaser model, now confirmed for BeenVerified**:

- **`<h1>` "Michael Johnson Phone & Names Directory"**, `<title>` "Michael Johnson — Phone Numbers, Addresses & Public Records Directory | BeenVerified".
- A **records list** ("Michael Johnson Records"), each entry showing, largely **UNMASKED**:
  - Name + city/state + **Age** ("Michael E Johnson in Bradenton, Florida | Age: 49")
  - A templated narrative sentence ("Michael may go by Michelle M Johnson and have relatives of…") — the **anti-thin-content FAQ/narrative machine**.
  - **Full phone numbers** ("941-504-4255, 941-756-4780, 941-748-6050") — *fully visible*, not blurred.
  - Addresses (city-level), **Relatives (linked to their own `/people/` pages)**, Email (**domain only**: "@aol.com, @yahoo.com"), "Seen As" aliases, Previous Locations, **Job Title**, **Work Email** (domain only), **Education**.
- **Filters:** Age / State / City. **"Looking for a different Michael?"** with related people. **FAQ** block. **"Related Names"** internal-link mesh.
- The per-record **"Details"** button routes into the **paid loader funnel** (its `data-href` = `/lp/98101d/2/loading?fn=…&ln=…`), gated by a `privacy-overlay` FCRA interstitial.

So the organic surface gives away a *lot* (full phones, relatives, job, education) to win "is this the right person?" intent and rank, then gates the **full report** (exact street address, full email local-part, criminal detail, monitoring) behind the funnel. **Gated vs free split, confirmed:** free = counts + aliases + city + relatives + *full phones* + domains; gated = street-level address, full emails, criminal/court detail, the compiled PDF report, monitoring.

- **[secondary]** Other paid-funnel arms show an **asterisked/blurred in-funnel preview** ("Contact Information: 3 records found", "Criminal Records: Available", key digits masked) rather than the straight-to-paywall I hit. This is the "counts not values" blur our own SUP already implements.

---

## 4. Pricing presentation & dark-pattern-adjacent tactics (first-hand, arm `a19763`)

Paywall (`/subscribe`), no results shown:

- **Plan cards (radio):**
  - **1 month Membership — $36.89/mo** (default selected)
  - **3 month Membership — $23.98/mo, "$71.94 Today"** (bulk anchor; makes monthly look expensive)
- **Payment options up front:** Apple Pay, Google Pay, PayPal, Credit/Debit Card (one-tap wallets reduce card friction).
- **Order Summary:** "1 month Membership / Online Access / **7 Search Types** / Total Today: $36.89 / Plus applicable sales tax".
- **Compliance / negative-option copy near CTA (Billing FAQ):** "Your membership **automatically renews every month** unless you cancel before the start of the next term… **limited to 100 reports per month**… cancel any time by **calling 1-866-885-6480 or emailing support@beenverified.com**." — **No self-serve online cancel** [secondary corroborates]; phone/email-only cancellation is squarely FTC click-to-cancel risk.
- **Reassurance stack:** "Satisfaction Guaranteed… offer a refund", "**Confidential Searching!** The people you search will **not** be notified", "**Why Aren't My Reports Free?** — 'Public' records are not necessarily 'free'. We pay for expensive bulk data…" (pre-empts the "this should be free" objection).
- **[secondary]** **$1 / 7-day trial** exists but is **hidden behind exit-intent** (surfaces when you try to leave the pricing/subscribe page), then **auto-converts to the full monthly rate** if not cancelled in 7 days. Pricing is A/B'd: I saw **$36.89/mo**; reviews cite **$26.89/mo** on other arms.

**Dark-pattern-adjacent tactics observed:** fake-progress timer; email captured *before* value delivered; near-complete progress held hostage for the email; trial concealed behind exit-intent; phone/email-only cancellation; auto-renew disclosed only in a secondary FAQ block, not adjacent to the button as a bold line. Several of these are things **our owner has already deliberately rejected** (see §9) — flagged in the mimic list.

---

## 5. Post-purchase / freemium / remarketing (first-hand + inferred)

- **No free tier, no usable free account, no teaser account.** You cannot log in and view anything without paying — the mid-loader email+name capture creates a **lead/remarketing record, not a functional account** (the form even offers "Already a BeenVerified member? Click here to login", i.e. accounts are paid-only). Retention of non-payers is therefore **pure email remarketing** on the address captured at 75%.
- The consent line ("you agree to **receive email from BeenVerified**") is the explicit remarketing opt-in, bundled into the "Continue" click — the email is the whole point of capturing it before the paywall (so an abandoner is still monetizable via drip email).

---

## 6. Monitoring / alerts / WSFY upsells (first-hand)

- **Monitoring is pre-sold *inside the loader*** ("Preparing Monitoring / **Ongoing notifications** — Don't be 'left in the dark'. BeenVerified can notify you whenever there are changes… People are frequently moving, creating new social media profiles and changing phone numbers. **You could miss out** if important information changes in the future") and again in the "Miscellaneous" panel ("proprietary Monitoring feature, which sends alerts… on an ongoing basis"). It's framed as **fear-of-missing-changes**, bundled into the subscription rather than a separate SKU.
- **No "who's searching for you" / reverse-lookup-on-yourself upsell** in the funnel (that's MyLife/WSFY territory). BeenVerified's self-directed angle is only the passive homepage "Search Yourself — monitor your public records and online reputation" card. **Implication for our Identity-Management / WSFY products:** the category leader leaves the active "someone is looking at *you*" hook on the table — it's a genuine differentiator for us, but we own the "is it compelling / is it creepy" call.

---

## 7. What CHANGED / what we were MISSING vs prior docs

Versus `docs/seo/competitive-teardown.md` (2026-06-28) and the "Funnel UX Research" memory note (2026-03-16):

- **Unblocked.** The prior teardown had BeenVerified 100% Cloudflare-walled (robots/sitemap only). This walk captured the **live paid funnel and the organic `/people/` template first-hand** — fills the biggest hole in that doc. The `/people/` template matches the Spokeo model it documented (records list + linked relatives + templated narrative + FAQ + related-names mesh; full phones free, street/criminal gated).
- **New since the 2026-03 research:** the funnel is now a **long multi-step drip with the email captured mid-loader at a frozen 75%**, not a single search→results→signup. The 2026-03 note assumed a results/teaser page *then* signup; the current default arm **skips the visible results page entirely** and front-loads email capture. Our note's "embed signup at 40% scroll depth" is superseded by BeenVerified's "embed email capture *inside the loader before results*".
- **Confirmed still-true from the 2026-03 note:** record-count hero social proof, "Searching N sources" loader, live-activity counters, "we never notify the person you searched", counts-not-values teaser.
- **Correction to carry forward:** "someone is searching for you" is **not** a BeenVerified tactic (it's MyLife). The 2026-03 note lists it generically; attribute it correctly.

---

## 8. Prioritized MIMIC LIST (impact × effort × compliance risk)

Ranked by expected conversion impact. **Compliance tag** separates "safe to adopt" from "our owner has deliberately rejected the adjacent version / FTC risk."

### Tier A — high impact, low effort, SAFE (do these)
1. **Slower, richer loader with anticipation panels.** Ours (`NameSearchLoaderPage`) runs ~2s with 3 static phrases. Replace with a longer, honest builder that **carousels category panels** ("Scanning phone records", "Checking property & address history", "Compiling relatives") + rotating real testimonials + a live counter. Reuses our existing `deriveThinMatchFlags` data. *Impact: high (perceived value + anticipation). Effort: low. Risk: none if timings track a real BC call and we don't fake "found" specifics.*
2. **Live-activity + volume social proof in the funnel.** Add an honest "N searches run today / N reports compiled" ticker to loader + SUP. *We have real BC/GA4 numbers — use them, don't fabricate. Impact: high. Effort: low.*
3. **"Confidential — we never notify the person you searched" reassurance line** on SRP and SUP. High-converting, honest, we already never notify. *Impact: med-high. Effort: trivial.*
4. **"Why isn't this free?" objection pre-empt** near the paywall CTA ("Public records aren't free — we license bulk data to keep reports affordable"). *Impact: med. Effort: trivial.*
5. **3-month / bulk plan anchor** beside the monthly on `PaymentPage` (their $23.98/mo-billed-$71.94 vs $36.89/mo). Pure anchoring; raises AOV and makes monthly feel reasonable. *Impact: med-high. Effort: low. Risk: none (both real prices, clearly disclosed).*

### Tier B — high impact, medium effort, SAFE
6. **Progressive location/age refinement between search and results** ("Where do they live?" → optional age/middle), each with an "I'm not sure" escape. Improves match quality *and* is a micro-commitment ladder. We currently collect everything on the landing. *Impact: high (better SRP + commitment). Effort: med.*
7. **Monitoring/alerts pre-sell inside the funnel**, framed as fear-of-missing-changes, bundled into the subscription — directly maps to our **Identity-Management / alerts** roadmap. *Impact: med-high (upsell + differentiation). Effort: med (needs the product).*
8. **Anticipation panels that double as the SUP** — richer "here's the category of what we found" cards with real counts (we already do counts in `SupTeaserA`; make them more visual/animated). *Impact: med. Effort: med.*

### Tier C — CAUTION / owner has rejected the adjacent version / FTC risk (do NOT blindly copy)
9. **Email capture *before* showing results.** BeenVerified extracts email at a frozen-75% loader with no payoff. **Our funnel deliberately shows a real SRP + masked SUP first** and only asks for signup to unlock. Front-loading email before value is higher-friction-for-lower-trust and abandonment-remarketing-dependent; **recommend we keep our "value first, then gate" order** but consider an *optional* "email me these results" soft-capture on the SUP. *Risk: trust; do not hard-gate.*
10. **Fake/indefinite progress + "don't hit back or you'll lose your info."** Adopt *honest* anticipation pacing (Tier A #1), **not** a deceptive timer or loss-aversion scare. *Risk: FTC deceptive-design.*
11. **Trial hidden behind exit-intent + auto-convert + phone/email-only cancellation.** Squarely FTC negative-option / click-to-cancel. **Do not.** If we run a trial, disclose price+renewal **bold, adjacent to the CTA**, and offer **self-serve online cancel** (we already lean this way). *Risk: high legal.*
12. **Pre-checked / bundled marketing opt-in.** Their "Continue" bundles email consent. Our memory note already says opt-in must **not** be pre-checked. Keep it explicit. *Risk: consent/trust.*

---

## 9. Gap analysis vs our current idlookup.ai funnel

Our funnel (from `src/pages/sales/`): landing (`NameSearchLandingV*`) → loader (`NameSearchLoaderPage`) → SRP (`SearchResultsPage`) → SUP teaser (`SupTeaserA` / `SearchDetailPreviewPage`) → signup (`SignupPage`) → payment (`PaymentPage`).

| Dimension | BeenVerified (observed) | idlookup.ai (current) | Gap / action |
|---|---|---|---|
| **Info-collection order** | One field at a time, drip across steps, "I'm not sure" escapes | All fields on the landing, passed as URL params to loader | **Add progressive location/age refinement** (Tier B #6) |
| **Loader** | ~90s, carouseled anticipation panels, live counter, testimonials, loss-aversion | ~2s, 3 static phrases, static chips | **Biggest cheap win — enrich the loader** (Tier A #1,2) |
| **Results page (SRP)** | *Skipped* in default paid arm; full data on organic SEO page | Real SRP with masked cards | **We're ahead** (value-first). Add "confidential" + "most likely match" badge |
| **Teaser (SUP)** | Straight to paywall (this arm) / asterisked blur (other arms) | `SupTeaserA`: masked values **with real counts**, found-chips, redacted locked-report preview, honest freshness — **never fabricated** | **We're ahead on honesty.** Consider optional email-soft-capture; richer visual counts |
| **Email capture** | Before results, frozen-75% loader, for remarketing | At signup, to unlock (value already shown) | **Keep our order.** Optionally add non-blocking "email me this" on SUP (Tier C #9, soft only) |
| **Pricing** | $36.89/mo default + $71.94/3mo anchor; wallets; trial hidden behind exit-intent | See `PaymentPage.js` | **Add a bulk-plan anchor + wallet options** (Tier A #5). Keep trial disclosure bold/adjacent, self-serve cancel |
| **Auto-renew / cancel** | Auto-renew in secondary FAQ; phone/email-only cancel (FTC risk) | (our policy) | **Do the opposite deliberately** — bold adjacent disclosure + online cancel = trust moat |
| **Freemium / retention** | None; paid-only accounts; email remarketing only | (our model) | Consider a **free saved-search / email-alert account** as a legitimate non-payer retention play (also feeds Identity-Management) |
| **Monitoring / alerts** | Pre-sold in loader, bundled | Roadmap (WSFY/alerts, BC-blocked) | **Pre-sell monitoring in the funnel** once the product lands (Tier B #7) |
| **WSFY / "who's searching for you"** | **Absent** at BeenVerified | Our WSFY product | **Differentiation opening** — nobody in this set uses it in acquisition; we can, if we get the tone right |
| **Trust badges** | Trustpilot, DigiCert, MTV Catfish, SOC2/CCPA | (varies) | Add a visible trust bar (SSL/compliance/press) per the 2026-03 note (still not fully done) |

**Bottom line:** our funnel is **more honest and value-first** than BeenVerified's default arm (real SRP, real SUP with never-fabricated counts, value-before-email). The two safe, high-ROI gaps to close are (1) a **much richer, longer, anticipation-driven loader** with live social proof, and (2) **progressive input refinement + a bulk-plan price anchor**. Everything BeenVerified does around *email-before-value, fake progress, hidden trials, and phone-only cancellation* we should treat as an **anti-pattern to consciously avoid** — and our "value-first + transparent billing + self-serve cancel" is a defensible trust differentiator, not a weakness.
