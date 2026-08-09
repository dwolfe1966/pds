# Foundational data providers — LexisNexis & TransUnion (strategy + verified levers)

2026-08-08. How to deal with the two *wholesale* data providers behind much of the ecosystem. Verified
consumer levers (live research) + the honest strategy. Distinct from the retail-broker catalog
(`broker-optout-automation-matrix.md`) because these are regulated, high-stakes, and freeze/dispute — not delete.

## The reframe
LexisNexis Risk Solutions and TransUnion aggregate courts/DMV/credit/utilities/property data and license it to
insurers, lenders, landlords, employers, collections — and, in part, retail brokers. They are **higher-stakes**
(they set your insurance premium and gate the apartment/job/loan) and **regulated** (FCRA / DPPA / GLBA), so
the levers are **freeze, suppress, dispute — never blanket delete**.

## The leverage reality (corrects the naive "starve the downstream" pitch)
Research is clear on both: **acting here does NOT meaningfully clear the retail people-search sites.** Retail
brokers mostly scrape public records themselves; the regulated credit/consumer files are **walled and never
sold** for marketing/people-search. So there are really **two separate jobs**, and we should frame them that way:

1. **Lock & correct the high-stakes file** — strong, durable, life-affecting. (Security freezes + FCRA disputes.)
2. **Reduce marketing/investigative exposure** — best-effort, recurring, re-aggregates. (Privacy-portal opt-outs
   of the *separate* arms: LexisNexis public-records products, TransUnion TLOxp + TruAudience.)

The differentiated value is Job #1 — the freezes and dispute rights that actually shape outcomes and that
retail-removal services (DeleteMe et al.) ignore. We should NOT sell "freeze LexisNexis → disappear from Spokeo."

## LexisNexis Risk Solutions — verified levers
| Lever | URL | Nature | Notes / gating |
|---|---|---|---|
| **Security freeze** ⭐ | consumer.risk.lexisnexis.com/freeze | security_freeze | Free; gates release of the LexisNexis Consumer Disclosure + SageStream reports. Broadly available. Not the big-3 bureaus. |
| State-privacy request | consumer.risk.lexisnexis.com/privacy → /request | suppression/delete | Do-Not-Sell + delete(non-exempt) + access + **correct**. **Only 20 privacy-law states.** FCRA/GLBA/DPPA data exempt from deletion. |
| C.L.U.E. / Current Carrier | consumer.risk.lexisnexis.com/request (CLUE line 1-866-897-8126) | file_access_only | Free annual disclosure + **dispute inaccuracies** (~7-yr claims retention). Access/correct, not remove. |
| General opt-out | consumer.risk.lexisnexis.com/opt | suppression | Prescreen + direct-marketing opt-out (anyone). Public-records "Information Suppression" is **narrow — officials / at-risk / ID-theft victims only** (do NOT present as an everyone button). |
| Accurint | — | no_optout | Business/LE product; no consumer opt-out (reachable only via narrow suppression, LE access retained). |

## TransUnion — verified levers
| Lever | URL | Nature | Notes / gating |
|---|---|---|---|
| **Credit freeze** ⭐ | transunion.com/credit-freeze | security_freeze | Federally free + reversible; blocks NEW-account access. Near-zero relist. Set at Equifax/Experian/Innovis too. |
| Prescreen opt-out | optoutprescreen.com | prescreen_optout | Covers all 4 bureaus in one request. 5-yr online **expires** (renew); permanent = mailed form. |
| Consumer privacy portal | transunion.com/consumer-privacy (833-395-6938) | suppression | Do-Not-Sell + delete(non-FCRA) across TU LLC/TUI/TURSS/TRADS/Marketing. Reaches marketing/investigative arms, **not** the credit file. State-law-dependent. |
| TLOxp / TLO (TRADS) | via consumer-privacy portal (+ TLOxpSupport@transunion.com) | suppression | Investigative/skip-trace (GLBA/DPPA, non-FCRA). Suppression **discretionary + HIGH relist** (re-aggregates). No standalone public form verified. |
| SmartMove / ShareAble (rental/employment) | transunion.com/client-support/rental-screening-disputes (800-230-9376) | file_access_only | FCRA — file disclosure + dispute + 100-word statement; accurate records stay. |
| TruAudience / Neustar (marketing identity) | via consumer-privacy portal | suppression | 16B+ signals / OneID graph; opt-out via state law; **HIGH relist** (re-links from 200+ sources). |

## What we must NOT promise
The regulated credit file, accurate FCRA screening records (credit/criminal/eviction/verifications), C.L.U.E.
claims history, DPPA driver data, GLBA financial data, and anything for fraud/identity/law-enforcement use —
**not deletable.** Consumers get **access + dispute + freeze**, not erasure. Marketing/investigative
suppression is **best-effort and re-aggregates** — say "reduce," not "remove."

## Recommended product treatment
1. **A distinct "Foundational sources" tier** in the footprint, above the retail brokers, marked high-impact.
2. **Two grouped jobs per provider:** "Lock & correct your file" (freeze + dispute — lead with these) and
   "Reduce marketing/investigative exposure" (privacy-portal opt-outs), each with the verified lever + the
   honest expectation (durable vs best-effort).
3. **Gating:** state-privacy delete = show state-eligibility; LexisNexis public-records suppression = show the
   narrow eligibility; note prescreen-opt-out 5-yr expiry (a monitoring re-check item).
4. **Copy frames outcomes, not disappearance:** "the file that sets your insurance rate / gates your loan,
   apartment, job — lock it and fix errors," not "erase yourself."
5. Feed each into the existing guide/tracker so freezes + disputes get the same prepared experience +
   re-check cadence (esp. the prescreen 5-yr renewal).
