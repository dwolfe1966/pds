# Competitor UX Teardown — Spokeo & PeopleFinders

**Focus:** Design + conversion anatomy (NOT SEO) of two page types we are optimizing for idlookup.ai:

- **(A) Search-entry "first page"** — homepage / name-search landing (our `/name/landing/v3` step 1).
- **(B) Profile-teaser / signup page** — blurred/partial profile that asks the user to sign up / pay (our signup teaser page).

**Date captured:** 2026-06-30.
**Method:** Live HTML fetched via `curl` (WebFetch/WebSearch were disabled in this environment). Spokeo serves fully rendered HTML for homepage, SERP, and single-profile teaser — all captured as **primary source (observed)**. PeopleFinders serves a JS-hydrated SPA: homepage value-prop copy is server-rendered (observed), but the post-search results/teaser/checkout is behind Cloudflare (live profile URL returned **HTTP 403**; search engines were captcha-gated; Wayback does not archive PF profile pages). PF page B is therefore **inferred and flagged**, grounded in PF's own homepage/SPA signals (progress-bar element, section taxonomy, an archived ad-campaign name literally called `..._Name_ContactInfo_Trial`) plus the category-standard pattern Spokeo demonstrates.

**Legend:** ✅ Observed (quoted from live/archived HTML) · ⚠️ Inferred (flagged, not directly observed) · 🚫 Blocked (could not retrieve).

---

## 1. SPOKEO

### 1A. Search-entry homepage — `https://www.spokeo.com/` ✅ Observed

**Above-the-fold layout.** Single centered hero on a clean white field. Top-left wordmark; top-right utility nav: `Spokeo Business` · `Login` · `Sign Up`. Hero is vertically stacked: short brand promise headline → search-type tab row → one wide search input → button. Everything funnels the eye to a single input. Below the fold is a long marketing/SEO page (record counts, report contents, testimonials, a huge alphabetical name index).

**Search form / CTA.**
- A **tab row** above the input: `name` · `email` · `phone` · `address` (single visible field; tabs swap intent — it is NOT a multi-step wizard).
- **Placeholder copy (verbatim):** `"Enter a Name, Phone Number, Address or Email"` (hero) and a secondary `"Search by Name, Phone, Email, Username, or Address"`.
- **Button copy:** `"Search Now"`. Single primary button. ✅ The CTA fill is a solid **orange `#fd6f0b`** (grounded from CSS — a `linear-gradient(#fd6f0b,#fd6f0b)` button background), deliberately contrasting the blue brand color — a high-contrast "color-pop" CTA pattern. Prominence/right-of-input is inferred from layout convention (⚠️ not confirmed from rendered geometry).
- Secondary CTA far down the page for the B2B product: `"try enterprise"`.
- Input `name="q"` — one free-text field for all types. Low friction: type anything, hit Search.

**Value proposition + copy (verbatim).**
- Headline: **"Spokeo. Know More."** (3 words — brand + benefit, not feature).
- Subhead: *"Search by name, phone, address, or email to confidentially lookup information about people you know such as yourself, friends, family, acquaintances, and old classmates."* — note **"confidentially"** (reassurance) and the **legitimizing use-case list** (yourself, friends, family, classmates) that frames the product as benign.
- Three benefit bullets: *"Lookup contact info and address"* · *"Uncover caller identity and location"* · *"Search for social and dating profiles."*
- Tone: **calm, reassuring, helpful** — not urgent. No countdowns or scarcity on the homepage.

**Trust / credibility signals.**
- **"Spokeo Has Been Featured On"** press-logo strip, with disclaimer: *"Reference to these media organizations should not be construed to imply an endorsement…"*.
- **Big-number record claims** under "Billions of Records / SEARCH INSTANTLY": **"130 Million Property Records · 6 Billion Consumer Records · 3.9 Billion Historical Records · 600 Million Court Records · 89 Million Business Records · 120+ Social Networks."**
- **Named testimonials with use-case framing**: George F. (Illinois) — stopped harassing texts; Jarrett M. (Florida) — Craigslist refund; Nery R. (California) — found a lost friend. Each ties a feature to a sympathetic human outcome.
- **US-based support** block: *"Contact Our US-Based Customer Care and Search Assistance Team"*, phone `1-888-271-9562`, hours `Mon - Sun: 7am - 5pm PT`.
- **FCRA disclaimer** in footer (compliance, also trust): *"Spokeo is not a consumer reporting agency as defined by the Fair Credit Reporting Act (FCRA)…"*.

**Visual style.** ✅ Grounded from CSS: white base (`theme-color #ffffff`), **accent-blue `#007cc2`**, a **contrasting orange CTA `#fd6f0b`**, neutral grays (`#758693`, `#4F5863`, `#e4e4e4`) and a faint teal tint (`#f0f8f9`). ⚠️ Typography (sans-serif), whitespace/density and "selling below the fold" are inferred from source structure, not rendered geometry. Trust-coded blue + conversion-orange button.

---

### 1B. Profile teaser / signup gate ✅ Observed (teaser) · ⚠️ checkout one click deeper (see note)

Spokeo's funnel is: homepage → **SERP** (list of matches) → **single-profile teaser** (the paywall) → checkout. Both the SERP and the profile teaser were captured live.

#### The SERP (results list) — e.g. `/John-Smith`
- **Headline:** `"72,049 people named John Smith found in California, Florida and 50 other states."` — leads with a **huge match count** to imply depth.
- A **"Browse Locations"** sidebar listing all 50 states with **per-state counts** (e.g. `California (7338)`, `Texas (6723)`) — reinforces "we have everything."
- Each list row is a **count-teaser**: name + **Age** + "Resides in {City, ST}" + one Relative/Alias + the line **`Includes Address(5) Phone(5) Email(1)`**. Counts are shown; the actual values are NOT. This is the core hook: *"we found 5 phone numbers — click to see them."*
- An on-page **FAQ** answers "How many…", "Where does X live?", "How many criminal records…" — using the data itself as bait (e.g. *"Our database currently contains 10,000 criminal records for 'John Smith'"*).

#### The single-profile teaser (the paywall page) — e.g. `/John-Smith/Indiana/Fort-Wayne/p4491415131`
This is the closest analogue to **our signup teaser** and the richest finding.

**Teaser anatomy — exactly what's shown free vs gated, and HOW it's obscured (verbatim):**

| Field | Free (shown) | Gated / obscured — HOW |
|---|---|---|
| Name | `John T Smith` (full) | — |
| Age | `Age 100` | — |
| AKA / Alias | `aka John P Smith` | — |
| Current address | partial: `ONUN Reed St, Fort Wayne, IN` | street number/name **char-masked** with placeholder letters (`ONUN`, later shown as `WXYZ`) |
| Phone | partial: `(260) 744-DYKT` | last 4 digits **masked with letters** (`DYKT`, `WXYZ`); `+2 phones` count shown |
| Email | partial: `y DBGL @gmail.com` | local-part **masked** (`DBGL`); `+2 emails` count shown |
| Past addresses | `Fort Wayne IN, South Bend IN +3 more` | count teaser |

**Obfuscation technique (key insight):** Spokeo does NOT use a CSS blur. It renders the **real layout with real surrounding context** (correct area code `(260) 744-`, correct domain `@gmail.com`, correct street like `___ Reed St`) and replaces only the sensitive characters with **fixed placeholder letters** (`WXYZ`, `DYKT`, `DBGL`, `ONUN`). This is more persuasive than a blur: it proves the data shape exists and is specific, while withholding the payload. ✅ The placeholder tokens are in the HTML server-side — i.e. the payload characters are **withheld at the source, not merely visually blurred client-side** (so the real values aren't sitting in the DOM for an unpaid viewer to extract). (⚠️ Whether a CSS blur is *additionally* layered on the visual render can't be determined from HTML alone.)

**Section-by-section gating with counts and micro-CTAs (verbatim):**
- `UNLOCK PROFILE` master CTA, plus a section tab strip: `Phone & Email (6)` · `All Addresses (6)` · `Family (4)` · `Social` · `Court (17)` · `And More`.
- **Phone & Email (6):** *"We found 6 phone numbers and email addresses. See John's contact info now »"* — then masked rows (`(260) 744-WXYZ · Fort Wayne, IN • Frontier`) + `VIEW 2 MORE`.
- **Address History (6):** *"We found 6 addresses for John. See where John has lived »"* — a Google **map** is shown, plus year-stamped masked rows: *"1 WXYZ Reed St … 2007-2024 — This home is the most recent known address for John. View more."* (Note the **carrier** and **property dates** are real — high specificity.)
- **Family Members (4):** *"We found 4 relatives for John. See John's family members »"* — names ARE shown (Mary Smith, Age 87; Ella Smithclark, Age 68; Harold Smith…) with `View more` gates on their details.
- **Court Records (17):** *"17 records for John Smith in Allen County. View court record search results »"* + escalating scope claims: *"We located 292 sex offenders matching the name John Smith"*, *"100,318 court search results for people named John Smith."* (`*` footnote: criminal/historical records **require an additional purchase** beyond the base report.)
- **Social Profiles / Historical / Wealth / Work & Education:** each a teaser card listing *what may be included* ("Online Aliases, Photos and Videos, Dating Sites…", "Property, Household Income…", "Employment & School History") with a `View more` gate. Branded with `3.9 BILLION RECORDS` / `120+ SOCIAL NETWORKS`.

**Signup/payment friction (observed on the teaser; checkout itself ⚠️).**
- The on-page capture is an **email-only soft gate**, NOT the price page: input placeholder `"Enter Your Email Address"`, copy *"Unlock Powerful Search Tips!"* and button **"Join for $0"** with *"By clicking Join for $0, I agree to receive emails from Spokeo and acknowledge the Privacy Policy."* This harvests an email at **zero perceived cost** before any price is shown.
- The hard paywall/checkout (card fields, price, recurring terms) sits one click past `UNLOCK PROFILE`. **⚠️ Not directly captured** — Spokeo's `/checkout` and `/join` paths are app-internal and not archived. The category-standard pattern is a low/$0-framed entry ("Join for $0" / trial) that converts to a recurring membership; **specific Spokeo prices/trial terms were NOT observed and are not asserted here.**

**Trust on the teaser:** investigator/relationship testimonials (*"As a diligent investigator… Spokeo has set me leaps and bounds ahead of my peers"*; *"I found my biological father… after 29 years"*; *"I found out I was dating a married man"*), the "Featured On" strip again, a **"light teal hollow checkmark"** data-quality badge (*"meets our highest-quality data standards"*), and the FCRA disclaimer.

**Urgency/social proof on teaser:** primarily **abundance + specificity** ("We found 6…", "17 records", real carriers/dates/maps) rather than countdown timers. The persuasion is "look how much real data is behind this wall," not "hurry."

---

## 2. PEOPLEFINDERS

### 2A. Search-entry homepage — `https://www.peoplefinders.com/` ✅ Observed (copy) · search widget JS-hydrated

**Above-the-fold layout.** SPA hero on white. Top-right: `{{ loginText }}` / `{{ joinText }}` (Sign Up / Login, hydrated client-side). A `page-progress` bar element (`{{ progress }}%`) exists in markup — i.e. the search triggers a **progress-bar "Searching…" interstitial** (observed in markup; the animation runs client-side). The markup places a **star-rating trust line — "Over 2,000 5-Star Ratings"** — early in the hero DOM (⚠️ source order; exact rendered position not confirmed, but it reads as a prominent above-the-fold trust beat).

**Search form / CTA.**
- The widget is JS-hydrated so live placeholder/button text wasn't in the static HTML, but the **field taxonomy is server-rendered** as tab/section labels: `Name` · `Phone Number` · `Email Address` · `Address` (Contact Information group), with deeper categories `Relationships` (Family Members, Roommates & Residents, Neighbors, Acquaintances, Business Colleagues), `Company & Profession`, `Home & Properties`.
- CTA label hydrates from `{{ joinText }}` → "Sign Up"; archived ad-campaign name **`11-05-25_Name_ContactInfo_Trial`** confirms the funnel intent: **Name → Contact Info → Trial**.

**Value proposition + copy (verbatim).**
- Headline: **"People Search & Public Records"** / brand line **"PeopleFinder: People Search & Public Records."**
- Tagline: **"Helping millions stay safe and connected."**
- Subhead: **"Navigate the digital world with confidence. Search for people with our hassle-free people search engine and public records database."** — note **"with confidence"** and **"hassle-free."**
- Archived variant headline (2023, observed): **"Over 7.8 Million People Rely on PeopleFinders. You Can, Too."** + *"Find detailed contact information on over 700 million adults in the United States. Our database is lightning-fast and gives you instant results."* (note **"instant results"** speed promise).
- **Use-case quadrants:** `Identify` (caller behind a number/email) · `Safeguard` (*"Protect yourself and your loved ones"*) · `Reconnect` (*"Search for people from your past"*) · `Research` (genealogy / neighbors). Tone is **safety + connection**, slightly warmer/more emotional than Spokeo.

**Trust / credibility signals (verbatim).**
- **Above the hero:** `"Over 2,000 5-Star Ratings"` (review-star social proof placed FIRST).
- `"PeopleFinders has been featured on:"` press-logo strip.
- **Big-number stat band:** **`120B` Public Records · `3M+` Customers · `6,000+` Data sources · `157M` Property records**, under **"Why PeopleFinders is best-in-class — A leading platform and the original people finder site — delivering meaningful people data since 1999."** (heritage/authority play: "original," "since 1999").
- **Named testimonials:** *"I appreciated the information they provided on my family history…"* — Joseph T.; *"I've been using PeopleFinders for over 20 years. Their information has always been up to date. It has helped my business tremendously."* — Keith G.; *"I was able to find everything I was looking for!"* — Mardisa V. Section header: **"Don't just take our word for it."**
- FCRA/CRA disclaimer in footer.

**Visual style.** ✅ Grounded from CSS: white base (`theme-color #ffffff`), a single dominant **brand blue `#2a8bcb`** (by far the most-used hex), gray `#A6A6A6`; app-store badge palette present (Google Play multicolor, Apple). No separate conversion-accent color stood out (unlike Spokeo's orange) — PF leans monochrome-blue. ✅ Emphasizes a **mobile app** (iOS/Android badges; Spokeo does not foreground one). ⚠️ "Denser benefit-grid layout" and typography inferred from DOM structure, not rendered geometry.

---

### 2B. Profile teaser / signup page 🚫 Blocked — ⚠️ Inferred

**Could not observe directly.** Live results/profile URL (`/people/john-smith`) returned **HTTP 403 (Cloudflare)**; `/people-search/...`, `/pricing`, `/faq` returned 404; DuckDuckGo and Bing HTML search were captcha-gated; Wayback archives PF marketing pages but **not** profile/results pages (CDX returned zero `/people/` or `/profile/` snapshots). The following is **inferred** from PF's own observed signals + the category-standard pattern Spokeo demonstrates. **Do not treat prices/trial terms below as observed — none were retrievable.**

**⚠️ Inferred teaser flow:**
- Search → **progress-bar interstitial** ("Searching billions of records… {{ progress }}%"). This is *observed in markup* (`page-progress` element) and is a deliberate **anticipation/effort-justification device** (the wait makes the result feel earned/comprehensive). This is the single clearest design difference vs Spokeo, which renders results instantly.
- → results list, then a **section-gated report teaser** mirroring PF's homepage taxonomy: **Contact Information** (Name/Phone/Email/Address), **Relationships** (Family/Roommates/Neighbors/Acquaintances), **Company & Profession**, **Home & Properties** (Property Photos, Value, Owners). Expect **count/section teasers** ("we found X relatives / Y addresses") with locked details, consistent with the category.
- → **Trial-framed signup** (the archived campaign literally names `Name_ContactInfo_Trial`): a low-friction entry (likely a time-boxed trial that converts to a recurring membership). **Specific price, trial length, and recurring amount: NOT observed — flagged.**

---

## 3. PATTERNS THAT CONVERT (synthesis)

1. **One field, many intents.** Both lead with a single prominent input + an intent tab row (Name/Phone/Email/Address). No multi-step wizard at entry. Lowest possible activation energy. Spokeo's `name="q"` accepts any input type.
2. **Benefit headline, not feature headline.** "Spokeo. Know More." / "Navigate the digital world with confidence." The promise is an *outcome* (knowing, safety), not a feature list.
3. **Legitimize the use case in the subhead.** Both explicitly frame benign uses (yourself, friends, family, classmates; "protect your loved ones") to defuse the creepiness objection before it forms. "Confidentially" / "with confidence" reassure.
4. **Stack big-number proof + press logos + named testimonials.** Billions-of-records counts, "featured on" strips, and *use-case-shaped* testimonials (harassing-texts, lost-father, Craigslist-refund) appear on BOTH the entry page and the teaser page. PF puts **"2,000 5-Star Ratings" above the fold, first** — review-stars as the very first trust beat.
5. **The teaser sells with specificity + counts, not blur.** Spokeo's winning move: show the **real data shape** (correct area code, real carrier, real property dates, a real map, real relative names/ages) and mask **only the payload characters** with fixed placeholders (`WXYZ`, `DYKT`). Pair every section with a **count** ("We found 6 phone numbers and email addresses") and a **micro-CTA** ("See John's contact info now »"). The user feels they're one click from data that demonstrably exists.
6. **Escalating scope = upsell bait.** Court/criminal/sex-offender counts ("17 records in Allen County," "292 sex offenders nationwide," "100,318 court results") widen the perceived value and seed the *additional-purchase* footnote.
7. **$0 / trial-framed entry; price deferred.** Spokeo harvests email with **"Join for $0"** before showing price; PF's funnel is named `..._Trial`. Price is pushed past the emotional peak (right after the teaser reveals how much exists).
8. **Anticipation interstitial (PF) vs instant (Spokeo).** PF uses a "Searching… %" progress bar to justify effort and build anticipation; Spokeo renders instantly to feel powerful. Both are valid — different conversion theories.
9. **Trust-coded visual system, two CTA philosophies.** Both: white base, blue brand color, FCRA disclaimers doubling as trust signals. Divergence (grounded from CSS): **Spokeo pairs blue `#007cc2` with a high-contrast orange CTA button `#fd6f0b`** (color-pop conversion pattern); **PeopleFinders is near-monochrome blue `#2a8bcb`** with no standout CTA accent. The contrasting-color CTA is the more aggressive conversion choice.

---

## 4. RECOMMENDATIONS FOR idlookup.ai (specific, testable)

> Research + design only. No app code was changed. Each item is framed as an A/B-testable change. (Our funnel context: `src/pages/sales/*LandingV*Page.js` for entry, plus the signup teaser page.)

### For `/name/landing` step 1 (search entry)

- **R1 — Single field + intent tabs, benefit-first button.** Confirm step 1 is ONE input with Name/Phone/Email/Address tabs (no multi-step before first search). Test button copy **"Search Now"** vs our current label, and test a **high-contrast CTA color** (Spokeo's orange-on-blue `#fd6f0b`) vs a same-family blue button (PF's approach). *Measure: search-submit rate.*
- **R2 — Outcome headline.** Replace any feature-y H1 with a 2–4 word benefit headline in the "Know More" mold, plus a subhead that **names benign use cases** ("look up yourself, family, an old classmate, an unknown caller") and includes a reassurance word ("confidentially" / "with confidence"). *Measure: bounce + search rate.*
- **R3 — Trust band above the fold.** Add a **review-stars + count line first** (PF puts "2,000 5-Star Ratings" above everything), then a press/"featured on" strip and a big-number record claim ("X billion records"). *Measure: scroll-depth + search rate.* (Use only claims we can substantiate via BC data — don't invent counts.)
- **R4 — Use-case testimonials.** Add 3 short named testimonials tied to concrete outcomes (stopped a harassing caller / reconnected with family / vetted an online seller). *Measure: search rate + signup rate downstream.*

### For the signup teaser page

- **R5 — Adopt character-masking, not blur, for the teaser.** This is the highest-leverage finding. Render the **real data shape** with only sensitive characters masked: show real area code + masked last-4 (`(260) 744-••••`), real email domain + masked local-part (`j••••@gmail.com`), real street suffix + masked number (`••• Reed St`). Avoid a flat CSS blur. *Measure: unlock/signup CTR.* (Verify with BC source-of-truth data; mask client-side at render, never ship full PII to an unpaid view.)
- **R6 — Per-section counts + micro-CTAs.** For each data category render a count headline and a "see it now" micro-link: *"We found {n} phone numbers — see {first name}'s contact info now »"*; *"{n} relatives found"*; *"{n} address records."* Pair with a master **UNLOCK** CTA. *Measure: section-CTA clicks → signup.* (Counts must come from BC; if BC doesn't return a count, show "Available in full report," not a fabricated number — see our "BC is source of truth" guardrail.)
- **R7 — Show specificity that proves depth.** Where BC returns it: a small map for address history, carrier/line-type for phones, year ranges for addresses, relative names+ages. Specificity converts better than generic "data available." *Measure: time-on-teaser + signup.*
- **R8 — Email-first soft gate before price.** Test a low-commitment **email capture** ("see your results" / "$0" framing) ahead of the card/price step, mirroring Spokeo's "Join for $0." Keep it honest about what they're agreeing to. *Measure: email-capture rate → eventual purchase.* (Confirm against our payment-UX research + FCRA copy; do not misrepresent recurring terms.)
- **R9 — Defer price to just after the teaser peak.** Sequence: teaser reveals how much exists → THEN price. Don't show price on the entry page. *Measure: teaser→checkout rate.*
- **R10 — Test a "Searching…" anticipation interstitial.** PF's progress bar is a deliberate device. A/B a short branded "Searching billions of records… {n}%" loader before the teaser vs instant render. *Measure: teaser-arrival → signup; watch abandon-during-loader.* (We already have loader steps in the V-pages — test duration/copy, and ensure it never reads as fake to the point of eroding trust.)
- **R11 — Trust on the teaser too.** Repeat testimonials + a data-quality/"verified" badge + FCRA disclaimer on the teaser page, not just the homepage. *Measure: signup rate.*
- **R12 — Escalating-scope upsell hooks.** If BC exposes court/criminal/property breadth, surface count-based teasers ("{n} court records in {county}") as upsell bait for premium/add-on report tiers. *Measure: upsell attach rate.*

### Compliance / honesty guardrails (apply to all of the above)
- Keep the **FCRA "not a consumer reporting agency"** disclaimer near the teaser and checkout (both competitors do; it's both legal cover and a trust beat).
- **Never fabricate counts, records, or testimonials.** All teaser numbers and data must derive from BC (source of truth). Where BC returns nothing, say "available in full report" — do not invent a count to look impressive.
- **Recurring/trial terms must be unambiguous** near the pay button (our payment-UX research already flags this).

---

## 5. WHAT'S OBSERVED vs INFERRED (audit trail)

| Item | Status | Note |
|---|---|---|
| Spokeo homepage (1A) | ✅ Observed | Full server-rendered HTML, quoted verbatim. |
| Spokeo SERP + single-profile teaser (1B) | ✅ Observed | Full server-rendered HTML incl. masking pattern, counts, CTAs. |
| Spokeo checkout (price/card/recurring) | ⚠️ Not observed | App-internal path past `UNLOCK PROFILE`; not archived. Email gate "Join for $0" WAS observed; prices/trial terms NOT asserted. |
| PeopleFinders homepage (2A) | ✅ Observed | Server-rendered value-prop copy + stat band + testimonials quoted; search widget JS-hydrated (taxonomy observed, live placeholder/button not). |
| PeopleFinders teaser/results/checkout (2B) | 🚫 Blocked / ⚠️ Inferred | Live 403 (Cloudflare); no Wayback profile snapshots; search engines captcha-gated. Progress-bar element + section taxonomy + `Name_ContactInfo_Trial` campaign name ARE observed; the teaser layout, gating, and all pricing/trial specifics are INFERRED and must be verified before being treated as fact. |

**Sources (fetched 2026-06-30):** `https://www.spokeo.com/`, `https://www.spokeo.com/John-Smith`, `https://www.spokeo.com/John-Smith/Indiana/Fort-Wayne/p4491415131`, `https://www.peoplefinders.com/`, `https://web.archive.org/web/2023id_/https://www.peoplefinders.com/find-people` (archived PF marketing variant).
