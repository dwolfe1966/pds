# Report Detail: Closing the Gap with the Legacy Product
### Stakeholder brief — PDS & BC staff and investors
**Date:** June 7, 2026 · **Status:** Built, verified, ready to deploy

---

## Executive summary

A question was raised by the team: the **legacy people‑search product ("OldCo")**
appeared to show **more information** in its consumer reports than the new
**IDLookup.ai product ("NewCo")** — specifically more detail per address and more
financial records — even though both run on the **same ByteCrtrs (BC) data platform
and the same underlying data provider.**

We investigated by comparing the same person's report on both products, all the way
down to the raw data each one receives.

**The finding is good news:** the difference was **not** a data gap, a vendor gap, or
a cost gap. NewCo was already **receiving the same — and in several areas richer —
data** from the BC platform. We were simply **not displaying all of it** on the report
screen, and in one case a small mapping error left a section nearly blank.

We have now closed every gap. The work was **entirely on our side, required no changes
from BC, and added no new data costs.** NewCo's report now presents data at **parity
with — and in places ahead of — the legacy product.**

---

## Background: why we looked

As PDS prepares the IDLookup.ai launch, a BC team member observed that the previous
product surfaced more in its reports. Because both products are powered by the same BC
platform and the same data provider, this was an important question to answer precisely:

- If BC were sending us **less data**, that would be a vendor/platform issue to escalate.
- If we were **receiving the data but not showing it**, that's ours to fix — quickly.

We resolved which it was before changing anything.

---

## What we found

We pulled the actual data feed behind a live report on **each** product and compared
them field by field. Results:

| Area | What the legacy product showed | What NewCo received | What NewCo was showing | Gap type |
|---|---|---|---|---|
| **Address history** | County, ZIP+4, dates per address | **All of it** (county, ZIP+4, dates, more) | Street, city, state, ZIP, dates | We had the data, weren't displaying County / ZIP+4 |
| **Financial (liens, judgments, bankruptcies)** | Detailed records | **Detailed records, populated** | Records shown, but missing a few fields | Minor display gap |
| **Criminal records** | — | **Mugshot, incarceration dates, sentence, physical description, vehicle** | Charge/court text only | We were discarding high‑value data |
| **Property records** | — | **Assessed/market value, beds/baths, ownership, sale history** | Almost nothing (mapping error) | A bug left the section nearly blank |

**Two takeaways:**

1. **NewCo receives equivalent‑or‑richer data than the legacy product** from the same
   BC platform. The "more information" the legacy product showed was a matter of
   **presentation, not data access.**
2. While confirming this, we discovered **additional opportunities the original
   question didn't mention** — most notably that our reports were receiving **mugshots
   and incarceration details** (highly relevant for our search audience) and discarding
   them, and that the **property section was rendering blank** due to a small internal
   mapping error.

---

## What we addressed

We enhanced the consumer report to surface the full depth of data already being
delivered:

- **Address history** — now shows **County** and **ZIP+4** alongside each address.
- **Criminal records** — now shows **booking photo (mugshot), name on record,
  conviction / commitment / release dates, sentence, physical marks, and associated
  vehicle.** (These details populate automatically for records that contain them.)
- **Property records** — the section, previously near‑empty, now displays **assessed
  and market value, bedrooms/baths, year built, ownership type, and last sale.**
- **Financial records** — added **lien type, court case number, and tax period.**
- **Phone numbers** — now flag **business** and **disconnected** lines.

All of this is **net‑new value to the customer at no additional data cost** — we are
simply presenting information we were already paying to receive.

---

## How we addressed it

A short, transparent account of the approach (kept jargon‑free):

1. **We measured before we changed anything.** Rather than assume, we captured the real
   data feed behind a live report on both products and compared them directly. This is
   what told us the gap was presentation, not data — and prevented us from raising an
   unnecessary request to BC.
2. **We fixed the presentation layer.** Two kinds of fixes: (a) display fields we were
   already receiving but hiding (county, ZIP+4, criminal detail), and (b) correct a
   small internal mapping so the property section reads the data the way BC actually
   delivers it.
3. **We verified against real reports.** We confirmed both that the data is correctly
   read **and** that it correctly appears on screen, checked across **seven** real
   reports — including subjects with property, criminal, and financial records — using
   the production build.
4. **We added automated tests** so these fields can't silently regress in the future.

The entire change is **on the NewCo application — no BC platform change, no new vendor
integration, no new data spend.**

---

## What this means

- **For PDS:** the IDLookup.ai report now matches the legacy product's depth and, with
  mugshots, incarceration detail, and full property records, **exceeds it** in areas
  that matter most to our audience — ready for launch.
- **For BC:** the platform was **already delivering the full, rich dataset.** No defect,
  no additional work required on the BC side. This is a vote of confidence in the data
  platform.
- **For investors:** this demonstrates (1) the product is **competitive on data depth**
  with the established prior product, (2) PDS delivers this **independently on its own
  stack with no added data cost**, and (3) the team operates with **measure‑first rigor**
  — diagnosing precisely before acting, and verifying against real data before shipping.

---

## Status & next step

- **Built and verified.** Ships with the next deployment of IDLookup.ai.
- **One open item to confirm (minor):** a few niche record categories on the legacy
  product (e.g., evictions, marriages/divorces) — we will confirm whether the BC feed
  includes them and, if so, surface them as well. This is the only item that could
  involve a BC question, and it is secondary to everything above.

---

*Technical appendix for engineering is maintained separately in*
`docs/qa/report-data-gap-analysis.md` *and* `docs/qa/report-breadth-comparison.md`.
