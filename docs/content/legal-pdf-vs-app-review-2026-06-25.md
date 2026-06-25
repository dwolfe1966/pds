# Legal Pages — PDF vs App Review (2026-06-25)

**Question asked:** Are the in-app Terms of Service & Privacy Policy identical to the source PDFs (minus errors, with variables replaced)?

**Sources compared:**
- `docs/content/Terms of Service.pdf` (11 pp) ⟷ `src/pages/sales/TermsPage.js`
- `docs/content/Privacy Policy.pdf` (20 pp) ⟷ `src/pages/sales/PrivacyPage.js`

## Verdict
**Substantially IDENTICAL — no app rewrite needed.** Both app pages reproduce the PDFs' sections in the same order with near-verbatim text. Every divergence is one of: (a) a `[placeholder]` correctly resolved to a `{brand.*}` variable, or (b) an error in the PDF that the app already corrected. **The app is the corrected master; the PDFs carry the errors.** Load-bearing facts verified to match: prices ($1.00 trial / $49.98 recurring), 7-day trial, $100 liability cap, mailing address (People Data Systems LLC, 2803 Philadelphia Pike, Suite B #237, Claymont, DE 19703), Delaware governing law + Claymont arbitration venue, statutes (CDA §230, FCRA, DMCA, Cal. Civ. §1542), the full state-rights data table, CA SB 362 metrics, age-16 minimum, support phone digits (866-204-1902).

---

## Errors to fix in the PDFs (app already correct)

### Terms of Service.pdf
1. Unresolved placeholders throughout: `[brand]`, `[phone]`, `[price]`, `[domain]`, `[website/contact]`, `[address]` — app resolves all via brand config.
2. `$100..` — double period in Limitation of Liability.
3. Stray leading `* ` on every DMCA "Notification Requirements" bullet.
4. Asterisk wrapping `*"…"*` around the two counter-notification sworn statements.
5. Contact Information "**Email:** `[website/contact]`" — an "Email" label pointing at a contact-page value (no real email exists; support routes through `/contact`). App relabels to "Web Contact Us page."
6. Notices clause is **truncated**: "…you must use the following mailing address" (no completion). App completes it.
7. Cosmetic typos: "non-refundable" missing terminal period; double space ("right  to assume"); "Discounts **And** Promotions" capitalization.

### Privacy Policy.pdf
1. Unresolved placeholders: `[company]` (×3), `[website]`, `[website/contact]`, `[address]` — app resolves all.
2. **Broken cross-reference:** cites a "**Usage**" section that does not exist; should be "**Uses of Personal Information Collected**." App fixed.
3. **Orphan sentence** after the Retention bullets: *"This section covers the management, security, and jurisdictional rights associated with your data."* — stray; app omits it.
4. Mislabeled "Email:" field (label vs contact-path value), same as Terms #5. App relabeled.
5. Double period: *…using our "Contact Us" page`..`* (Special Protections section). App has single period.

---

## Items to CONFIRM (app-only; not errors — owner decision)
1. **"Last Updated: 6/8/2026"** appears in the app but not the PDFs. Confirm the date is still accurate (if the policy text changed since, bump it; otherwise leave).
2. **Section numbering** — the app numbers sections (1., 1.1, …); the PDFs are unnumbered. Numbering is an improvement (navigability) but is a structural difference. **Keep numbered (recommended) or strip to match the PDF?**
3. **Contact section extras** — the app adds a **Phone** bullet (both pages) and a **Web Home page** bullet (Privacy) not in the PDFs. Recommended keep (they're helpful + accurate).
4. **Phone format** — app renders `866-204-1902`; PDFs show `(866) 204-1902`. Same digits, cosmetic. Normalize only if a single display format is wanted brand-wide.

## Recommendation
Treat the **app as the corrected master.** No app edits needed for legal substance. To make the published PDFs match, fix the PDF errors above (or regenerate the PDFs from the app text). Then resolve the 4 confirm items.
