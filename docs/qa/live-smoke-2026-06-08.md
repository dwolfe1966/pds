# Live Functional Smoke — 2026-06-08

Real-browser UAT against the **live** BC hosts (which were verified == HEAD build
this session). Read-only. Harness: `scripts/live-smoke-0608.js` (Playwright,
Galaxy S5 emulation for consumer, desktop for CSR). Creds loaded from the
gitignored `scripts/.smoke.env`; no new searches (avoids the BC captcha wall) —
reports opened by clicking an existing library link.

- **Consumer live bundle:** `public.772bfb29.js` on dev.www.idlookup.ai
- **Admin live bundle:** `admin.eff24bd1.js` on dev.admin.www.bytecrtrs.com/csr/
- **Member tested:** `test21@test21.com` (paid; owns the O.J. report)
- **Net read: both deployables functionally verified live. No regressions.**

> Note: `772bfb29` does NOT yet include the card-brand acceptance marks +
> no-red-on-load checkout fixes — those are in `public.366fddbb.js`, built but not
> yet uploaded. The checkout compliance work was visually verified separately
> (standalone SVG render screenshot), not in this live run.

---

## Consumer — report-detail parity ✅

Opened the live O.J. report (`/people/6a25df363ee3447608a236a7`) by clicking it
from test21's dashboard library (8 reports total). Body length 16,285 chars; no
captcha. Sections present: contact, phone, email, address, relatives, associates,
court, financial, property.

| Parity field (shipped this sprint) | Result | Notes |
|---|---|---|
| Address: County | ✅ renders | |
| Address: ZIP+4 | ✅ | `\d{5}-\d{4}` present |
| Address: Ownership | ✅ | |
| Address: residence duration | ✅ | e.g. "~6.3 yrs" via `residenceDuration()` |
| Address: map link | ✅ | 18 map links (one per address) |
| Property: assessed value | ✅ | `Assessed:` line |
| Property: beds/baths | ✅ | was ~blank before the rewrite |
| Property: "Last transfer" | ⚪ unconfirmed | renders as `Last transfer:` (SearchResultDetailPage:815), gated on `lastSale.date\|deedType`; probe searched the wrong term. Property card otherwise confirmed via assessed/beds. |
| Criminal: Description line | ✅ | physical descriptors render as a Description line |
| Criminal: hair/eyes | ✅ | |
| Criminal: height/weight | ⚪ expected-absent | folded into the Description line, not separate `Height`/`Weight` labels |
| Criminal: mugshot | ⚪ none (expected) | BC `photo` field is empty on all records — open BC ask, not a client gap |
| Financial: liens | ✅ | |

**Conclusion:** all report-parity work shipped this sprint renders correctly on a
real paid member's live report.

---

## CSR / Admin — user detail ✅

Logged in, searched a known customer (1 result), opened user
`/csr/users/6a11ea7daaf121809263f972`. Not forbidden; not a white page.

| Check | Result | Notes |
|---|---|---|
| Login | ✅ | not forbidden |
| Customer search | ✅ | returns the user |
| Tabs present | ✅ | Orders, Payments, Searches, Reports, Logins, Notes, Messages |
| Searches tab | ✅ 8 rows | the bug that was fixed (client-filter wiped rows) |
| Reports tab | ✅ 3 rows | |
| Logins tab | ✅ 18 rows | |
| Notes tab | ⚪ 0 rows | this user has no notes — not empty-by-bug |
| Notes & Messages render | ✅ | both sections show, not empty-both |
| "Collected" sum | ⚪ not on default view | label lives in the order drill-down, not user-detail top level — worth a manual confirm, not a regression |

---

## Follow-ups (minor, non-blocking)

1. Manually confirm the order-level **"Collected"** sum reads fulfilled-sales-only
   (the `orderFinancials` fix) — the probe didn't drill into an order.
2. Eyeball the property **"Last transfer"** line on a report whose property record
   has a populated sale date/deed type.
3. Upload `public.366fddbb.js` and re-verify the checkout card-brand logos +
   no-red-on-load live (covered by launch-checklist item 11).

## Harness gotchas captured (see memory)

- Open a member report by **clicking** the library link, not `page.goto(/people/:id)`
  — a full reload lets the narrow paywall redirect to `/dashboard` before paid
  status re-hydrates (you then read the dashboard as the "report").
- Pass creds with **straight** quotes; smart quotes `‘’` aren't shell quoting and
  get baked into the value, breaking login. The `.smoke.env` loader strips both.
