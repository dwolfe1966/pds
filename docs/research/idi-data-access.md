# Getting Data Out of IDI Directly — Access, Methods & the Licensing Wall

**For:** idlookup.ai — we're a licensed IDI customer via ByteCrtrs, moving toward direct IDI console access.
**Compiled:** 2026-07 from two parallel research passes, verified against IDI's own primary Terms & Conditions (Last Modified **Aug 28, 2024**), Access Security Requirements (Jul 26, 2023), and Red Violet SEC filings. Load-bearing claims are double-sourced. **Not legal advice.**

---

## Bottom line up front

**Two separate questions, opposite answers:**

1. **Can we technically extract data from IDI?** — **Yes.** Three channels: a per-tenant **JSON API**, **batch** (upload a list → get enriched records), and the **console** (single-subject reports).
2. **Can we use IDI data to build a public, SEO-indexed people directory?** — **No.** IDI's standard license **explicitly prohibits** public display, redistribution, and bulk automated ingestion — verified verbatim, on **four independent clauses**. Going *direct* binds us **tighter** to these terms, not looser.

**So the make-or-break isn't the tech — it's the license.** And it collides head-on with our own memory note ("SEO: IDI licensed for public display + indexing"), which contradicts IDI's standard terms. **Resolve that first** (see ⚠️ below) before any IDI-based SEO build.

**The clean split going forward:**
- **IDI/idiCORE** → keep for what it's licensed for: the **gated, paid, logged-in report** flow (per-lookup, behind auth + permissible-purpose). ✅
- **Public / SEO directory** → must run on a **different** source with republication rights (self-compiled public records — our existing Layer-1 approach — or a bulk public-records feed). ❌ not IDI.

---

## ⚠️ The conflict to resolve first
Our memory says **"IDI licensed for public display + indexing."** IDI's **standard** Subscriber Terms say the opposite. Only two possibilities:
1. We hold a **bespoke, custom Subscriber Agreement** with an explicit written display/republication grant — in which case **get the exact clause in hand and confirm its scope** (display? indexing? bulk?), because it overrides the public terms.
2. The memory is **aspirational/incorrect** — in which case the public-directory-on-IDI plan is **blocked**.

**Action:** pull our actual signed Subscriber Agreement (or ask BC/IDI) and confirm the written grant. Do not build on the assumption.

---

## 1. Extraction methods (the "how")

| Path | Real? | What it is | Practical limit |
|---|---|---|---|
| **idiCORE API** | ✅ real, docs NDA-gated | Per-tenant URL + **Company Key + API Secret + Site Key**; raw JSON in/out; **every query must carry GLBA+DPPA permissible-use codes**. Test + Prod envs. | No public base URL / schema / rate limits. The best public artifact is the PingOne DaVinci **coreIDENTITY** connector. **Confirm endpoints/schemas/limits under the customer agreement.** |
| **Batch** | ✅ real, specs not public | Upload a list of subjects → get enriched contact/relatives/criminal back per record. **A bulk *query*, not a data license.** | File formats, max rows, SLA, delivery (SFTP vs portal) all unpublished — confirm with IDI. |
| **Bulk / flat-file / DB feed** | ❌ **no public evidence it exists** | The path that *would* populate millions of directory rows. | IDI delivers via a **hosted** environment (10-K); data stays on their platform. Any feed would be a bespoke contract that also **overrides** the resale/internal-use clauses — and ~44% of IDI's data is licensed *inbound* (credit-header), so IDI likely **can't** sub-license it as raw records anyway. |
| **Console / GUI** (`login.idicore.com`) | ✅ real | Admin-provisioned per-user (2FA or IP-allowlist); single-subject search → contact, relatives, property/vehicles, assets, bankruptcies/liens/judgments, **criminal**, social, IP; **pin-drop crime map** (radius ≤10mi); Search History. | Export appears to be **print/save the report page** — no confirmed **CSV/structured export** or list-building. **If the console caps exports, it's not a directory-population path regardless.** |

**Criminal/incarceration (the other goal):** criminal data is reachable via all three channels (console report, **idiCRIM** API/batch — "national criminal, court, arrest, sex-offender, 30+ yr depth", non-FCRA). **BUT** IDI's copy says "criminal, court, arrest, sex-offender" — it does **not** enumerate live **jail/DOC incarceration/booking** feeds. **Request a data dictionary + coverage matrix** to confirm incarceration depth before relying on it (ties back to the `inmatefinderhub.com` research).

---

## 2. The licensing wall — verified verbatim (Terms & Conditions, Aug 28 2024)

| Our need | IDI standard license | Verbatim clause |
|---|---|---|
| Public display on a consumer site | **PROHIBITED** | *"Services will be used by Subscriber only. **Information may not be delivered to, or filed with, any third party**"* + license is *"for **Subscriber's internal use**"* |
| SEO indexing | **PROHIBITED** (needs display, already barred) | — |
| Bulk ingestion to build a directory | **PROHIBITED by default** | *"Subscriber will not access… using any techniques, tool or process of **automation** ('Automated Searching')"* unless expressly authorized |
| — | Non-FCRA | *"ID is not a 'consumer reporting agency'…"* |
| — | No resale / no competitor | *"…will not… **resell the Services or Information, nor use the Services to create a competing product**"* |
| — | Purpose-locked | use only *"for the purpose(s) certified… **and for no other purpose**"* |
| — | No personal lookups | prohibited to use *"for personal reasons, including, to locate friends, family members…"* — **which is exactly what a consumer people-search end-user does** |

Also: **GLBA/DPPA/FTC-Act** governed; upstream data suppliers are **named third-party beneficiaries who can enforce directly** with stipulated injunctive relief. A class action already alleges Interactive Data "illegally sells consumer reports" into consumer-facing use — live exposure, not hypothetical.

**A public directory on idiCORE would breach ≥4 independent clauses.** There is **no public evidence** IDI offers any "display/republication" tier — absent a specific written grant, the default is **No**.

---

## 3. Getting direct access (achievable at our size)

- **Not enterprise-only** — IDI onboards **solo private investigators** and reported **10,022 billable customers** (FY2025). Eligibility is about fitting a **permissible-purpose vertical**, not company size.
- **Entry:** "Sign up for a Trial" on ididata.com → a rep begins account activation. Gated, "sole discretion," not self-serve.
- **Credentialing bar** (public Access Security Requirements): **user-level background screening**, ISO-27002-aligned security program, MFA-over-VPN, pen testing, 24-hr incident reporting, a written info-sec program (16 C.F.R. § 314.4), and an **ongoing audit/inspection right** (a *pre-onboarding physical site inspection* is **not** confirmed for IDI — that rigor is attributed to TLO/TLOxp).
- **Contract shape:** ~76% annual auto-renew contracts (monthly fee + overage), ~24% transactional.
- **Direct vs via BC:** going direct → we sign IDI's own Subscriber Agreement, are bound directly by the security requirements + permissible-purpose vetting, likely an annual commit. **Confirm exactly what changes vs the BC reseller path.**

## 4. Pricing signals (quote-only; no public rate card)
- **Model (verified, RDVT filings):** annual subscription + overage; FY2025 rev $90.3M (+20%), 84% adj. gross margin.
- **Per-unit (secondary/channel — treat as reported):** a reseller advertised **~$0.50/search** ("$50/mo for 100 searches, pay per hit"); a blog cites **$0.50–$2.00/record**, down to **$0.08/contact** at wholesale volume. Enterprise idiCORE is **quote-only** — get a real quote for our rate/minimums/term.

---

## 5. The strategic pivot for the SEO directory
The key structural insight: **internal-use-only is the industry default** — nearly every marketing/identity major (Data Axle, Versium, LexisNexis, IDI) forbids public display. Public people-search sites mostly **don't license** a display feed — they **self-compile raw public records**, which under US law needs no license to republish. **That's already our idlookup.me / Census-Layer-1 approach.**

**Recommended paths for the public/SEO layer:**
1. **Self-compile raw public records** (Spokeo/TruePeopleSearch model) — legally cleanest for display; matches our existing build. ← primary
2. **Bulk public-records feed** from a wholesale aggregator (Omni Data Retrieval, PublicData.com, NPD-type) **with republication rights written into the deal** — because the content is public record. ← licensed alternative
3. **Enformion / EnformionGO** — the one purpose-built people-data platform worth a **direct conversation about a display grant** (its public terms don't address display either way). ← the one vendor to actually ask.

*(Not fits for public display: Data Axle, Versium, LexisNexis/Accurint, Ekata — all internal-use/verification-only.)*

---

## Confirm-in-writing checklist (now that we have customer access)
1. **⚠️ Display/redistribution grant** — does our Subscriber Agreement permit public display + indexing + bulk use? (Highest priority; resolves the memory conflict.)
2. **API** — base URL/paths, auth headers/token flow, person-search + idiCRIM schemas, pagination, rate limits, IP-allowlist requirement. *(Ask for the login-gated API docs — obtainable now.)*
3. **Batch** — input format/layout, max job size, SLA, delivery channel, per-record price.
4. **Bulk feed** — does any flat-file/SFTP/DB-slice license exist at all? format, cadence, schema, minimums.
5. **Console** — is there structured/CSV export + any per-export row cap? list-building?
6. **Criminal** — data dictionary + coverage matrix; explicit confirmation of **incarceration/booking/DOC** vs arrest/court only.
7. **Pricing** — real per-search rate, minimums, term, setup.
8. **Direct-vs-reseller** — exactly what changes going direct vs via BC.

---

## Sources
Primary: ididata.com/termsandconditions.pdf (Aug 28 2024) · ididata.com/securityrequirements.pdf · ididata.com/solutions/idicore · /idicrim · /skip-tracing · hub.ididata.com/idicore-private-investigators · login.idicore.com (+/glba,/dppa) · pingone-davinci.github.io/documentation/idi-coreidentity (best public API artifact) · anyflip.com idiCORE Admin Guide · redviolet.com/brands · SEC RDVT FY2024/FY2025 10-K + subsidiary exhibit 21.1. Alternatives: go.enformion.com · data-axle.com/terms · versium.com/terms · omnidataretrieval.com · publicdata.com. Secondary (reported, not confirmed): reseller pricing pages, Krebs on Security, First Amendment Coalition.

*Caveats: API base URL/paths, batch I/O, feed formats, and export caps are **not public** for this credentialed non-FCRA platform — that's expected, hence the confirm-in-writing list. The load-bearing conclusion (public display/resale/bulk prohibited) is double-verified against the primary T&C PDF.*
