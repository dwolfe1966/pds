# BC ask — Remove "fictional data" disclaimer from production PDFs

**Raised:** 2026-05-29
**Bug ref:** #45 in `docs/qa/bc client library - Bugs.csv`
**Environment:** `https://dev.www.idlookup.ai/`
**Endpoint:** `apiWrapper.api.idLookup.downloadPdfReport({ commerceContentId })`

> **⚠️ VERIFIED ACTIVE 2026-06-08 — still present; question #1 answered: UNCONDITIONAL,
> not dev-only.** Pulled the live PDF for the O.J. report (`6a25df363ee3447608a236a7`,
> `GET /idLookup/report/pdf/<id>`, real member session; re-pulled twice, byte-identical
> 120,092 bytes). Data is unmistakably **real** (real Miami address, real foreclosure doc
> numbers/dates, 44 real criminal histories) yet page 1 still reads *"This report uses
> fictional data…"* — so the prefix is baked into BC's template regardless of data, will
> NOT resolve on prod cutover. (Owner first thought it was removed but confirmed they were
> viewing this same O.J. report, so the present-state is agreed.) **Action: BC must remove
> it for the `idlookup` brand (keep the FCRA "not a consumer report" line). Until then the
> launch fallback below applies — don't hand a paying customer a real report stamped
> "fictional data."** Verified via `scripts/verify-pdf-disclaimer.js`.
>
> **Audited ALL 9 of test21's report PDFs (`scripts/audit-pdf-disclaimers.js`) — 9/9 still
> carry the disclaimer**, including the most recent. The owner's own downloaded file
> (`MOLLY LYNN ARTZ (1).pdf`) was byte-identical (75,115 B) to our live pull and also
> contains it. NOTE: "no Section 10" in some PDFs is a RED HERRING — report sections are
> **data-conditional** (e.g. Molly's run has no §5 or §10 because there's no such data),
> unrelated to the disclaimer. So there is no "clean template" variant in play; the
> disclaimer is universal until BC removes it server-side.

## Copy-paste summary

> The PDF report we serve to paying members carries this disclaimer at
> the top of page 1:
>
> > **Disclaimer:** This report uses fictional data to illustrate how an
> > www.idlookup.ai report could look. It is not a consumer report and
> > must not be used for credit, employment, insurance or housing
> > decisions.
>
> Two questions:
>
> 1. **Is this a dev/sandbox-only prefix that BC strips automatically in
>    production?** If yes, this resolves itself the moment we point at
>    the prod BC backend — please confirm.
>
> 2. **If it's in the unconditional template:** please remove it for the
>    `idlookup` brand. The FCRA-style "not a consumer report" line is
>    fine to keep (we expect that), but "fictional data" is misleading
>    to a paying customer looking at real data about a real person.

## Why we can't do this client-side

- PDF is generated server-side by BC and delivered as bytes via
  `downloadPdfReport`. Client-side PDF manipulation would require pulling
  in a heavy lib (pdf-lib or similar) just to strip a header line —
  fragile and breaks if BC changes the template format.

## Launch posture if BC can't ship in time

If this is a dev-only prefix, we just verify it's gone when we cut over
to prod BC. If it's the unconditional template, **soft-block on the PDF
download button** until BC ships — we keep the web report (already at
parity per commit `345530b`) and disable the "⬇ Download PDF" CTA on
`SearchResultDetailPage` with a "PDF temporarily unavailable" tooltip,
rather than hand customers a document that says their report is fake.
