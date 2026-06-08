# Terms & Privacy — Alignment Decisions (2026-06-08)

Owner-approved decisions from aligning the live site Terms/Privacy pages to the
compliance-officer-authored source docs (`docs/content/Terms-PR.pdf`,
`docs/content/Privacy Policy-PR.pdf`). Supersedes the open questions in
`docs/content/legal-consistency-review-2026-06-08.md`.

**Method:** exhaustive clause-by-clause diff of `src/pages/sales/TermsPage.js` and
`src/pages/sales/PrivacyPage.js` against the source docs. The substance — CCPA
collection table (rows A–L), all 17 state-rights jurisdictions, arbitration, FCRA,
DMCA (incl. perjury statements), subscription/billing, retention, GPC/DNT — already
matched the docs **verbatim**. Only small deltas remained.

## Changes APPLIED to the site (committed)

| Page | Change | Why |
|---|---|---|
| Terms | Restored **"non-exclusive"** in the content-license grant (§3.2) | Doc has it; site had dropped the word |
| Terms | Liability cap → **"…OR $100."** (removed "WHICHEVER IS GREATER") (§9) | Match doc; the site's "whichever is greater" inverted the cap into a floor |
| Terms | Swapped two **Forbidden-Uses bullets** into doc order ("disparages…" before "unlawful, harmful…") (§4) | Match doc ordering |
| Privacy | Added **Mailing Address** to the Contact block (People Data Systems LLC, 2803 Philadelphia Pike, Suite B #237, Claymont, DE 19703) | Doc requires it; matches Terms |
| Both | Bumped **Last Updated** to **6/8/2026** (was Terms 5/19, Privacy 5/15) | Content changed this date |

Commits: `d871f03` (alignment) + this date bump. Consumer bundle to deploy:
rebuild from HEAD (supersedes `public.f2fcad61.js`).

## Owner decisions on the flagged items

1. **Phone number — KEEP 833.** The docs hardcode **(866) 204-1902** in 4 places
   (Terms ×3, Privacy WA notice). That number is **not ours** — the provisioned support
   line is **833-861-9230** (`brand.js`, per-brand). The site correctly renders the brand
   line; **no site change**. → **DOC FIX NEEDED:** compliance should replace (866) 204-1902
   with the brand support line (it's stale template residue).
2. **Contact block — KEEP Web Contact + Phone.** Owner confirmed the site's model (Web
   Contact Us page + Phone, no public inbound email). The docs list "Email + Mailing Address";
   **no site change** (we don't publish an inbound legal email). → **DOC FIX NEEDED:** update
   the docs' Contact block to "Web Contact Us page + Phone (+ Mailing Address)" to match.
3. **§24 Notices truncated sentence (Terms).** The doc sentence trails off ("…you must use
   the following mailing address" then stops). Site keeps its sensible completion (cross-ref to
   the Contact section). **OK as-is.** → **DOC FIX NEEDED:** compliance to supply the intended ending.
4. **"Usage" cross-reference (Privacy).** Doc references a "Usage" section that doesn't exist;
   site uses the correct "Uses of Personal Information Collected." **Kept the correct site ref.**
   → **DOC FIX NEEDED:** correct the doc's cross-reference label.
5. **Last Updated date.** Bumped to 6/8/2026 (applied above).
6. **Minor Privacy prose cross-refs.** Two spots where the site turned "Contact Information
   section" into a working `/contact` link. **Owner OK to keep the links** — no change.

## Doc-side follow-ups for the compliance officer (NOT code)

The source docs are templates with unfilled placeholders + a few stale artifacts. To make
the archived PDFs self-contained and match the published site, compliance should:
- Fill all placeholders: `[brand]`/`[company]`→brand name, `[price]`→$49.98, `[domain]`/
  `[website]`→idlookup.ai, `[address]`→the Claymont DE address, `[SMS-phone]`/phone→833-861-9230,
  `[website/contact]`→the /contact model.
- Replace the stale **(866) 204-1902** with the brand support line (#1).
- Update the **Contact block** to the Web-Contact + Phone model (#2).
- Complete the **truncated §24 Notices** sentence (#3) and fix the **"Usage"** cross-ref (#4).
- Remove the stray wrong-brand **"PrivateRecords"** reference (Terms Forbidden-Uses) and the
  Privacy stray connector sentence; clean the **"$100.."** double-period typo.
- Add a **Last-Updated date** to the docs.

## Open compliance questions surfaced (for legal, unchanged by this pass)

- **Legal entity vs brand:** `[brand]`/`[company]` render as "IDLookup.AI" (marketing name).
  The operating entity **People Data Systems LLC** appears only in the mailing address.
  Counsel to decide whether the contracting party / data controller should name the LLC.
- **Sensitive PI contradiction (Privacy, in both doc and site):** CCPA table row L = "Sensitive
  PI — Not Collected," yet the policy has a "Right to Limit SPI" clause + a Texas "may sell
  sensitive data" note. Counsel to reconcile.
- **Children's age floor = 16** (both agree; COPPA is 13) — confirm intended.
