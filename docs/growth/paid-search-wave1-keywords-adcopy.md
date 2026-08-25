# Paid Search — Wave 1 keywords + ad copy (ported, compliant)

Source content extracted from the compet **Search keyword report** + **Ad report** (`docs/ads/compet/`).
Companion to [`paid-search-build-sheet.md`](paid-search-build-sheet.md).

## Two rules the source data forces

1. **Keywords port near-verbatim — EXCEPT SSN.** The proven keyword sets are portable, but the **SSN**
   winners (`find someone by social security number`, `ssn finder`, `find ssn`) are **Google-prohibited**
   (facilitating access to a person's SSN). Do **not** migrate them — see the SSN section.
2. **Ad copy must be REBUILT, not ported.** Every source campaign's copy is built on
   **"$1 / Credit Card Required / Cheapest Price"** and points at **competitor landing pages**
   (`inmatessearcher.com`, `privaterecords.net`, `backgroundcheckers.net`). That pattern is a policy
   landmine and isn't ours. Keep the **value-prop** headlines; drop every price/CC/cheapest hook; point at
   **v11**.
   > **eCPA caveat:** the "$1" offer was part of what drove the source CVR. Compliant copy + v11 is the
   > *deliberate* change (the one variable we isolate) — convey the value prop compliantly ("free to
   > search; full report available") and **watch CVR/eCPA closely** per the guardrails.

Each campaign below: **port keywords** (proven, with match type + source CPA), **rebuilt RSA** (compliant),
**policy**. Keywords with 0 clicks in-window are omitted; import the fuller set from the source as needed.

---

## 1–2. Inmate — Lower `inmate-lo` / Upper `inmate-up`  · SUP: inmate/booking (BookingSignal)

**Port keywords** (match type · source CPA):
`inmate search` (phrase $11.98 / broad $16.75 / exact $8.21) · `[find an inmate]` (exact $7.53–$12.25) ·
`find an inmate` (broad $3.92) · `[inmate locator]` ($8.35) · `[inmate lookup]` ($12.28) · `[find inmate]`
($8) · `inmate finder` ($2.37) · `convict search` ($5.35) · `federal inmate search` ($17.37) ·
`[federal inmate search]` ($1.20) · state phrases: `"Texas inmate search"`, `"Arizona inmate search"`,
`"Nevada inmate search"`, `"Tennessee inmate search"`, `"Pennsylvania inmate search"`, etc.
*Upper = same set, upper-HHI audience. Lower = same, lower-HHI.*

**Rebuilt RSA (drop all "$1/mugshot/CC"):**
- Headlines: `Inmate Search` · `Find an Inmate Online` · `Nationwide Inmate Search` · `Federal Inmate
  Search` · `Search Local, State & Federal` · `Inmate Locator` · `Find People in Jail` · `County Jail
  Inmate Search` · `Search Dept. of Corrections` · `Enter a Name to Start` · `Search Jails Nationwide` ·
  `{KeyWord:State Inmate Search}`
- Descriptions: `Search jail & prison records nationwide by name — local, state & federal.` ·
  `Enter a name to find where someone is incarcerated. Fast, accurate, easy.` ·
  `Free to search; full inmate report available. All 50 states.` ·
  `Find an inmate across every state. Enter a name and state to start.`
- **Policy:** low.

---

## 3 & 7-adjacent. Public Records — `pubrec` · SUP: records

**Port keywords:** `free public records` (broad $7.69) · `public records free` ($5.66) ·
`[free public records]` ($9.34) · `+public +record +finder` ($10.02) · `[public eviction records]`
($18.69) · `public records websites` ($11.99) · `public records` (broad $14.16) · state variants
(`texas public records`, `california public records`).

**Rebuilt RSA:**
- Headlines: `Search Public Records` · `Free Public Records Search` · `Public Records by Name` ·
  `Public Record Finder` · `Eviction & Court Records` · `Search Records by Name` · `Enter a Name to
  Start` · `Nationwide Public Records` · `Instant Public Records` · `Look Up Public Records`
- Descriptions: `Search public records by name — nationwide. Free to start.` ·
  `Enter a name to find available public records. Fast and easy.` ·
  `Public record finder: addresses, records, and more.` ·
  `Search public-records databases by name and state.`
- **Policy:** med.

---

## 4. Life-events — Death (Upper) `le-death-up` · SUP: life-events teaser

**Port keywords:** `public death records` (broad $17.74 — **high CPA, tighten**) · `birth and death
records` ($13.15) · `[free death certificates]` ($9.75) · `+death +notices` ($8.42) ·
`[public death records]` ($16.90) · `[free death records]` ($4.91) · `[death records]` ($14.58) ·
`[death certificate lookup]` ($13) · `obituaries` (broad $21.33 — high). *Keep death/obit focused —
the source campaign bled marriage/divorce terms in; hold those to their own campaigns.*

**Rebuilt RSA:**
- Headlines: `Search Death Records` · `Public Death Records` · `Obituary Search` · `Find Obituaries
  Online` · `Death Records & Obituaries` · `Death Certificate Lookup` · `Find Out Who Died & When` ·
  `Enter a Name to Start` · `Search Records by Name` · `Nationwide Death Records`
- Descriptions: `Search public death records and obituaries by name. Nationwide.` ·
  `Find out who died, when, and their age. Enter a name to start.` ·
  `Free to search; full death record and obituary details available.` ·
  `Look up death records and obituaries across all states.`
- **Policy:** sensitive-event — respectful framing, no exploitative urgency. Watch the broad-match CPA.

---

## 5. Life-events — Divorce (Upper) `le-div-up` · SUP: life-events teaser

**Port keywords:** `[free divorce records]` ($13.22) · `+view +divorce +records` ($27.72 — high) ·
`texas divorce records` ($12.22) · `+marriage +divorce +records` ($18.66) · `+divorce +records` ($13.33) ·
`[marriage and divorce records]` ($10.60) · `[divorce certificate]` ($12.58) · `+check +divorce +records`
($9.75) · `[view divorce records]` ($3.06) · state variants (`california/new york divorce records`).

**Rebuilt RSA:**
- Headlines: `Search Divorce Records` · `Public Divorce Records` · `Divorce Record Lookup` · `View Divorce
  Records Online` · `Find Out Who Got Divorced` · `Divorce Certificates` · `State Divorce Records` ·
  `Enter a Name to Start` · `Search Records by Name` · `Nationwide Divorce Records`
- Descriptions: `Search public divorce records by name — nationwide, local & state.` ·
  `Find out who got divorced. Enter a name to view divorce records.` ·
  `Free to search; full divorce record details available.` ·
  `Look up divorce records and certificates across all states.`
- **Policy:** med.

---

## 6. Criminal — Court `crim-court` · SUP: criminal

**Port keywords:** `+criminal +records` (broad $11.25) · `+criminal +reports` ($5.91) ·
`[criminal records search]` ($1.21) · `[criminal background check]` ($7.99) · `[free criminal records]` ·
`+court +record` · `[check criminal]` · `[public criminal record lookup]` · `[criminal record search]`.
*Spanish terms converted too (`record criminal usa`) — a Spanish ad group is a fair later test.*

**Rebuilt RSA:**
- Headlines: `Criminal Records Search` · `Court Records Lookup` · `Criminal Background Check` ·
  `Public Criminal Records` · `Search Court Records` · `Criminal History Lookup` · `Local & Federal
  Records` · `Enter a Name to Start` · `Search Records by Name` · `Nationwide Criminal Records`
- Descriptions: `Search public criminal & court records by name. Nationwide.` ·
  `Enter a name to find available criminal and court records.` ·
  `Criminal background records — local and federal. Free to search.` ·
  `Look up court and criminal records across all states.`
- **Policy:** ⚠ no implication of guilt; "records **may be** available"; no individual targeting.

---

## 8. Criminal — Arrests `crim-arrest` · SUP: criminal

**Port keywords:** `arrest records` (broad $20.84 — **high CPA, tighten/negative-out low-intent**) ·
`jail records` ($7.34) · self-check warrant terms: `warrant search`, `active warrant search`,
`do i have a warrant`, `how to check if i have a warrant`.

**Rebuilt RSA:**
- Headlines: `Arrest Records Search` · `Jail Records Lookup` · `Public Arrest Records` · `Warrant Search` ·
  `Search Arrest Records` · `Local & County Records` · `Enter a Name to Start` · `Search Records by
  Name` · `Nationwide Arrest Records` · `Check Public Records`
- Descriptions: `Search public arrest & jail records by name. Nationwide.` ·
  `Enter a name to find available arrest and jail records.` ·
  `Public arrest records — local, county & state. Free to search.` ·
  `Look up arrest and jail records across all states.`
- **Policy:** ⚠⚠ highest of the criminal set — defamation exposure; strictly "public arrest records may be
  available"; never assert guilt. Watch the broad `arrest records` CPA.

---

## SSN — `pubrec-ssn` / `pubrec-ssn-lo` · ⛔ DO NOT MIGRATE AS-IS

The proven SSN economics (2.49×–2.81×) were earned on **prohibited** keywords/copy:
`social security number lookup`, `find social security number`, `find someone by social security
number`, `ssn finder`, `ssn search by name`. Google **prohibits** ads that facilitate finding a person's
SSN — migrating these verbatim risks **account suspension**.

**Recommendation:**
- **Do not run** "find/lookup SSN" keywords or copy.
- **Fold the compliant slice into Public Records** (`pubrec`) — the `public records` / `background` intent
  that overlaps, framed strictly as public-records (never "find their SSN").
- Requires **legal/policy sign-off (punch-list D1)** before anything SSN-adjacent runs.
- Net: treat the 2.49×/2.81× as **not portable** — don't bank on it in the Wave-1 plan.

---

## Cross-campaign build notes
- **Negatives (shared):** `jobs`, `how to`, `my own`, `free` (where a paywall follows — avoids deceptive-
  free), `template`, `form`, DIY/self-service, competitor brands.
- **Match types:** port exactly as the source ran them (exact/phrase/broad mix above) — that mix earned the
  CPA. No loosening at migration.
- **Final URL:** every campaign → v11 + its SUP with `?shns=<id>` (replaces the competitor URLs).
- **DKI** (`{KeyWord:...}`) is portable but must resolve to compliant, on-policy text — QA before launch.
- **"Free … then a fee":** disclose pricing/trial **transparently on v11**, not with "$1 / credit card" in
  the ad. Keep "free to search / full report available" — compliant and preserves the hook's intent.
