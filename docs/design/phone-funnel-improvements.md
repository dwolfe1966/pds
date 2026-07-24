# Logged-out phone search — assessment & improvement plan

**Date:** 2026-07-24. Ties to the compet-partner migration checklist (phone funnel = flagged gap).

## What it is today (verified in code)
Flow: `/phone/landing[/v2…v6]` → enter number → `/phone/loader` (`api.searchPeople({phone, type:'phone'})`)
→ `/phone/search-result` (`PhoneSearchResultsPage`).
- The search returns **only the person** behind the number: `fullName, ageRange, location, extId, id, provider` —
  **the identical shape to a name result.**
- The SRP shows **"Found N possible matches — sign up to see owner details,"** rendered as an **obscured list**
  (post the 15a/15b fix), click → signup.

## The three core problems
1. **Promise → payoff mismatch.** The landing promises **"Carrier & line type"** — but we have **no carrier,
   line-type, or spam data anywhere** (grep confirms zero). We can't deliver what the ad/landing sells. That's
   the single biggest issue: it erodes trust exactly at the conversion moment.
2. **Wrong mental model.** A phone number is **high-precision — one number → one owner.** We treat it like a
   name search: a *list* of "N possible matches" to pick from. Reverse-phone intent isn't "browse matches,"
   it's **"who is this ONE number?"**
3. **We ignore the dominant intent.** The #1 reason people reverse-look-up a number is **"who's calling me / is
   this spam/scam?"** — high emotion, high volume (it's the entire Truecaller/spam-lookup category). Our funnel
   leads with a neutral "Who Owns This Number?" and never touches spam/safety, the strongest hook.

## The reframe
Treat phone as its **own product with its own intent**, not a name-search variant:
> **"Who's calling you — and is it safe?"** One number → one answer: owner, location, line type, and a
> **spam/scam risk flag.**

### 1. Single-owner reveal, not a list (UX/flow)
Phone → loader → **one "owner card"** (blurred owner name + location + attributes) → paywall. Drop
"N possible matches." For the rare multi-owner number, show the strongest and note "+others." This matches the
member flow, which already goes direct (phone → report), and matches the intent.

### 2. Close the data gap — add phone intelligence (the enabler)
This unlocks everything. A phone-intelligence lookup gives us **line type (mobile / landline / VoIP), carrier,
and a spam/risk score** — cheap and fast:
- **Twilio Lookup** (~$0.005–0.05/number depending on packages), **Telnyx**, or a reverse-phone data broker.
- VoIP + high spam score = the exact signal that powers the "is this spam?" payoff *and* fraud filtering.
- **This makes the landing's promise real** (carrier & line type) and creates a **differentiated payoff** name
  search can't match.
- *If we won't add a provider:* remove the carrier/line-type promise and lean on owner + location + records —
  but that leaves the strongest hook (spam) on the table.

### 3. Phone-specific teaser payoff
The owner card should tease, blurred: **owner name · location · carrier · line type · ⚠ spam/scam risk ·
associated names.** That's the reverse-lookup payoff people actually pay for — and it reuses our person data +
the new line-intelligence + our enrichment.

### 4. Enrichment parity with the name funnel
Run the augmentation engine (`getPersonSignals`) on the **resolved owner** — booking/records, relatives, address.
Same teaser system the name funnel now uses; today the phone SRP has none.

### 5. Phone as an acquisition vertical (bigger picture)
"Who called me / reverse phone lookup / spam checker" is a **massive standalone search + ads category** and a
partner-traffic opportunity. The homefacts auto-prime pattern (params → primed reveal) applies directly to
phone-partner traffic (`?phone=` → owner card). Worth its own angle once the payoff is real.

## Compliance
Keep personal-safety / curiosity framing + FCRA disclaimer (not for eligibility). Spam-risk data is descriptive
("reported as spam"), not an assertion about the owner.

## Sequencing (highest leverage first)
1. **Decision: add a phone-intelligence provider?** (owner/BC — it's the enabler; ~$0.005/lookup). Everything
   below is far stronger with it.
2. **Reframe copy + single-owner reveal** (no provider needed — fixes the list mismatch + spam hook now).
3. **Phone-specific teaser** (owner + line type + spam + enrichment) — needs #1 for line/spam.
4. **Enrichment via getPersonSignals on the owner** (no provider needed).
5. **Phone acquisition angle** (later, once payoff is real).

## Open questions for owner
- Are we willing to add a phone-intelligence provider (Twilio Lookup / Telnyx / broker)? That's the crux — it
  turns the phone funnel from a name-search reskin into a real, differentiated reverse-lookup product.
- Does BC/IDI's phone search expose *any* line metadata we're not surfacing, or is it person-only? (Looks
  person-only — worth a 1-line confirm.)
