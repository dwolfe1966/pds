# Bug list triage — 2026-05-29

Source: `docs/qa/bc client library - Bugs.csv` (62 items, ~20 already complete).
Goal: ship the launch-critical fixes; defer the rest with intention.

## Scoring

- **Value** — direct impact on conversion, revenue, paying-user trust, or basic correctness.
  - 🔴 launch blocker
  - 🟠 high — measurable conversion/trust impact
  - 🟡 medium — polish that compounds
  - ⚪ low — cosmetic / minor UX
- **Effort** — implementation complexity.
  - S — under an hour
  - M — 1-3 hours
  - L — half day or more
- **Priority** = Value × cost-effectiveness. Top of each tier is what to ship first.

---

## P0 — Launch-blockers (must ship)

| # | Page | Bug | Val | Eff | Notes |
|---|---|---|---|---|---|
| **50** | Payment | Reactivate "Pro" returns `nonMemberOnlyCommerceOffer` | 🔴 | M | Paying customer literally cannot rejoin. Either send a different offer post-cancel, OR present a different CTA. Check BC's offer flag + which shN we're passing. |
| **59** | Member dashboard | Cancelled trial users lose search access immediately | 🔴 | M | They paid; access should run until billing period end (BC already returns `dueTimestamp`). Gate searchability on `dueTimestamp > now`, not `subStatus !== 'canceled'`. |
| **60** | CSR | Cannot search customers | 🔴 | M | Operations blocker. Likely the admin bundle has the F11/F12 fixes that haven't redeployed yet — verify after BC pushes. |
| **21** | Signup | No signup email sent | 🔴 | M | Transactional basics. `server/emailService.js` is wired (SendGrid/SES/SMTP). Wire signup → email after `auth.signup` returns. |
| **49** / **56** | Member dashboard | Cancelled state inconsistency: Account shows reports, Dashboard shows none | 🟠 | S | Same data, two surfaces — gate must be consistent. Most likely the dashboard's report-list fetch is gated on `isPaid` (which is false after cancel) where it should be gated on `hasOrders`. |
| **40** | Member search | Phone search returns nothing for `(909) 663-7878` | 🟠 | M | Could be us, could be BC. Reproduce + check the request shape against working sales phone search. |

## P1 — High value, ship if time

| # | Page | Bug | Val | Eff | Notes |
|---|---|---|---|---|---|
| **44** / **45** | Report / PDF | Web report missing data PDF has; PDF carries "test" / fictional disclaimer | 🟠 | M | F10 already widened web extractor (2026-05-26). Re-audit against current PDF. Also strip the fictional-data disclaimer from production PDFs — that's BC config. |
| **52** | Signup | Email accepts `testingreg052826c` (no @, no DNS check) | 🟠 | S | Add a real email regex + a basic DNS-MX check via a public endpoint. The DNS check is BC-side. |
| **28** | Signup | Password rules too strict (cap + special required) | 🟠 | S | 8-char min is industry standard. Drop the case/special requirement; keep length. One-line change in `validatePassword`. |
| **37** / **53** | Payment | No red-border on missing billing fields; want red border start state | 🟠 | S | Two halves of the same change. Red border on submit-fail is the higher-value half — do that. Red-border-by-default is cosmetic. |
| **31** | Payment | Smart CC expiry input (auto-prefix `0` when first digit ≥2) | 🟠 | S | Mask logic; reduces decline-rate. Apply same to month/year split if present. |
| **57** | Member account | No "Reactivate" button for cancelled users | 🟠 | M | Reverse of (50). BC's `cancelOrUncancelOrder({ flag: 'uncancel' })` should work for the still-active-until-period-end case. |
| **39** | Report page | Missing data vs competitors | 🟠 | L | Vague — needs a specific gap list. Don't burn time without one. |
| **55** | Payment | Bad session shown as payment decline | 🟠 | M | Surface the real error (e.g. "Session expired, please log in"). Currently misleading; users will blame their card. |
| **47** | Member account | "Upgrade to Pro" page mismatch after cancel | 🟡 | S | Strip the `$29.99` from the CTA copy when user has an active-cancelled subscription. |
| **58** | Member account | Billing history doesn't list the $1 trial charge | 🟡 | M | `billing.getOrders` likely returns it but our filter excludes it. Verify and unfilter. |
| **38** | Payment | Submit lands on footer (page is short) | 🟡 | S | `window.scrollTo({ top: 0 })` after success. |
| **48** | Member dashboard | Search box prominence — currently behind a button | 🟡 | S | Surface the search input inline. |
| **46** | Member dashboard | Membership section at top (encourages cancel) | 🟡 | S | Move Membership tile below Reports / Searches. |
| **42** | Member search | Remove address search (broken UX) | 🟡 | S | Just remove the option from the search-type selector. |
| **35** | Payment | Submit button copy: "I AGREE. VIEW REPORT NOW!" | 🟡 | S | Compliance + conversion. Copy change only. |

## P2 — Polish, post-launch fine

| # | Page | Bug | Val | Eff |
|---|---|---|---|---|
| **26** | Footer | Don't need support@ in footer | ⚪ | S |
| **27** | /search | Email disclosure (remarketing intent) | 🟡 | S |
| **29** | Payment | Grey billing disclosure on top of SUP | ⚪ | S |
| **30** | Payment | Too much space between fields on mobile | ⚪ | S |
| **32** | Payment | Terms/Privacy → lightbox instead of nav | 🟡 | M |
| **33** | Payment | "Contact us" → new tab | ⚪ | S |
| **34** | Payment | SUP checkbox required only on default shN | 🟡 | M |
| **36** | Payment | "I'll upgrade later → go to my dashboard" link | ⚪ | S |
| **54** | Payment | Cap zip input to 5 digits | ⚪ | S |
| **61** / **62** | CSR | Direct deep-links don't work (SPA refresh) | 🟡 | M | Nginx/Vercel rewrites issue, not code. |
| **41** | Report page | Name reports less comprehensive than phone reports | 🟠 | M | Same shape as 39 — needs a concrete gap list. |

## Defer / cut

| # | Page | Bug | Reason |
|---|---|---|---|
| **43** | Member SRP | "John Smith" CA shows no results | Likely BC-side cap; same root as resolved C5 #5. Re-verify, document, move on. |
| **51** | Signup | Thin match flow not supported | New feature category. Post-launch. |

---

## Recommended execution order (top 10 next)

The "ship in 24 hours of effort" list:

1. **50** — fix the cancel→reactivate offer mismatch. Most direct revenue recovery.
2. **59** — gate cancelled-trial search on `dueTimestamp`, not `subStatus`. They paid; honor it.
3. **49 / 56** — consolidate the dashboard vs account report-list gates. One source of truth.
4. **21** — wire signup email via existing `emailService.js`. Trust + standard expectation.
5. **52** — real email validation. Stops fake signups from polluting the data.
6. **28** — drop the password case/special rules. Reduces signup friction immediately.
7. **37** — red border on submit-fail for billing fields. Prevents "where did it fail?" support tickets.
8. **31** — smart CC expiry input. Lowers decline rate measurably.
9. **38** + **46** + **48** in one pass — three small dashboard / payment scroll/layout fixes. Knock them out together.
10. **55** — surface real session error instead of fake "payment declined". Trust + correctness.

**60** (CSR search) is launch-blocker but it's likely already-shipped-pending-redeploy (F11/F12). Verify against the next BC admin bundle before re-coding.

**40** (member phone search broken) needs a 5-minute reproduction first — if it's BC-side, we wait. If we're sending the wrong shape, it's quick.

**39 / 41 / 44** all need a concrete gap list before they're worth touching. Ask the designer or product to spend 10 minutes writing "here are the 5 specific fields competitors show that we don't."

---

## What we are explicitly NOT doing pre-launch

- Anything BC-blocked that doesn't have a clean client-side workaround (the F9 messaging enumeration story has consumed enough cycles).
- Anything in P2 that doesn't directly affect conversion or trust.
- Polish on flows we know we'll iterate after we have real user data.
