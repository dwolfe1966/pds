# Legal Consistency Review — Terms & Privacy (2026-06-08)

Compared the source Google Docs (exported to `docs/content/Terms-PR.pdf`,
`docs/content/Privacy Policy-PR.pdf`) against the live site pages
(`src/pages/sales/TermsPage.js`, `src/pages/sales/PrivacyPage.js`). Findings verified
against the actual files. **No code changed yet** — this is the findings report.

## Headline

**The source docs are unfilled TEMPLATES; the website is the more-complete version.**
The site is brand-aware (`src/services/brand.js`) and resolves the docs' bracketed
placeholders at render time. Substantively the site is a faithful **superset** of the
docs — arbitration, billing, FCRA, §1542, DMCA, all 17 state privacy rights, the CCPA
collection table, cookies, retention, GPC/DNT, financial-incentive disclosures are all
present and matching. The real work is (a) filling the docs and (b) a short list of
genuine site/doc divergences, four of them launch-critical.

## Placeholders in the source docs (unfilled) → what the site renders

| Doc placeholder | Site value (idlookup.ai) |
|---|---|
| Terms `[brand]` ×31, Privacy `[company]` ×3 | `brand.name` → **"IDLookup.AI"** (marketing name, NOT the legal entity) |
| `[price]` (Terms) | `recurringPriceStr` → **$49.98/mo** |
| `[SMS-phone]` (Terms), WA phone | `brand.supportPhone` → **833-861-9230** |
| `[domain]` / `[website]` | **idlookup.ai** |
| `[address]` | **People Data Systems LLC, 2803 Philadelphia Pike, Suite B #237, Claymont, DE 19703** (Terms only) |
| `[website/contact]` (email) | **No email** — site routes to `/contact` page |

Neither doc carries an effective/last-updated date; site shows Terms **5/19/2026**,
Privacy **5/15/2026**.

## CRITICAL (resolve before launch)

1. **Legal entity vs brand name (Terms + Privacy).** `[brand]`/`[company]` resolve to
   the marketing name "IDLookup.AI", not the operating entity **People Data Systems LLC**
   (which appears only inside the Terms mailing-address block, and nowhere on the Privacy
   page). The contracting party (Terms) and data controller (Privacy) should name the LLC.
   → Owner/legal decision: e.g. "IDLookup.AI, a service of People Data Systems LLC."

2. **Liability-cap divergence (Terms).** Doc: "...OR $100.." (bare). Site (`TermsPage.js:279`):
   "...OR $100, **WHICHEVER IS GREATER**." The added phrase turns the cap into a $100 *floor*
   — materially worse for the company and the opposite of a liability cap. → Legal to confirm
   intent, then make doc and site identical. (Doc's "$100.." double-period is also a typo.)

3. **Stale phone in the docs.** Docs hardcode **(866) 204-1902** (Terms ×3; Privacy WA notice).
   It appears **nowhere** in the live site (verified) — site uses 833-861-9230. → Fix the DOC.

4. **SPI internal contradiction (Privacy — in BOTH doc and site).** The CCPA table row L marks
   "Sensitive Personal Information — Not Collected," yet the policy includes a "Right to Limit
   Use of SPI" clause and a Texas note that "we may engage in the sale of your sensitive personal
   data." → Legal to decide whether SPI is collected/sold and align table + clause + Texas note.

## SITE-side consistency fixes (safe, mechanical — recommend applying)

5. **Restore "non-exclusive"** in the Terms content-license grant (`TermsPage.js:149`) — doc
   (L67) reads "royalty-free, **non-exclusive**, and sub-licensable"; the site dropped the word.

6. **Add the mailing address to the Privacy contact block** (`PrivacyPage.js` Contact section) —
   the Terms page shows the Claymont, DE address; the Privacy page shows none. Internal-site
   inconsistency + the doc's contact block expects a postal address. (Several state privacy laws
   expect a physical contact address.)

## Needs an owner/legal decision (not a mechanical fix)

7. **Contact channel policy.** Docs list Email + Mailing Address; site lists Phone + `/contact`
   page (no inbound email; Privacy has no postal address). Decide the canonical channel set and
   make Terms, Privacy, and both docs agree. (Confirm a contact form satisfies any DMCA-agent /
   email-contact obligation.)

8. **Children's-privacy age floor = 16** (both doc and site agree; COPPA is 13). Confirm 16 is the
   deliberate, documented standard.

## DOC-side fixes (owned by legal — these are the Google Docs, not code)

9. Fill ALL placeholders (`[brand]`/`[company]`/`[price]`/`[address]`/`[domain]`/`[website]`/
   `[website/contact]`/`[SMS-phone]`) and add a Last-Updated date so the archived PDF is
   self-contained and can't drift from the rendered site.
10. **Remove stray wrong-brand "PrivateRecords"** in Terms doc (Forbidden-Uses bullet) — template
    residue; the site already renders the correct brand.
11. Delete the stray connector sentence in the Privacy doc ("This section covers the management,
    security, and jurisdictional rights...") — leftover scaffolding not on the site.

## Bottom line

The live site is substantively consistent with — and more complete than — the source docs.
Launch-blocking items are the four CRITICALs (entity naming, liability-cap wording, stale doc
phone, SPI contradiction), all of which need a legal/owner call. The two safe site edits (#5, #6)
can ship immediately to tighten consistency.
